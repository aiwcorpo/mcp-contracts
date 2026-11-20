// Reference rules for the agent registry (CC-261, CC-266). Used by the vectors in test-vectors/agent-clients, gateway-authentication
// (agent-*), kill-switch (agent-*), policy-data-push and policy-data-gate; the gateway, the broker and the starter implement the same rules.

const RISK_ORDER = { READ_ONLY: 0, UPDATE: 1, DESTRUCTIVE: 2 };
const AGENT_TOKEN_MAX_LIFETIME_SECONDS = 300;
const AGENT_ID = /^agent-[a-z][a-z0-9]*(-[a-z0-9]+)*$/u;

/**
 * Whether the token of a caller is an agent, after iss, aud and exp were checked (CC-266). `token` is { azp, sub, principalType?, iat, exp };
 * `registry` is the list of entries { clientId, serviceAccountSub, status }, or null when it cannot be read. An unreadable registry refuses
 * what could be an agent (a token with the agent marker or an azp of an agent id) and leaves the others alone.
 */
export function classifyCaller({ token, registry, registryReadable = true }) {
  const marked = token.principalType === 'agent';
  const looksLikeAgent = marked || AGENT_ID.test(token.azp);
  if (!registryReadable) {
    return looksLikeAgent
      ? { principal: 'agent', decision: 'deny', status: 503, errorCode: 'upstream_unavailable', reason: 'upstream_unavailable' }
      : { principal: 'human', decision: 'continue' };
  }
  const entry = registry.find((e) => e.clientId === token.azp);
  if (entry === undefined) {
    return marked
      ? { principal: 'agent', decision: 'deny', status: 401, reason: 'agent_not_registered' }
      : { principal: 'human', decision: 'continue' };
  }
  if (!marked || token.sub !== entry.serviceAccountSub) return { principal: 'agent', decision: 'deny', status: 401, reason: 'agent_not_registered' };
  if (token.exp - token.iat > AGENT_TOKEN_MAX_LIFETIME_SECONDS) return { principal: 'agent', decision: 'deny', status: 401, reason: 'agent_token_lifetime' };
  if (entry.status === 'suspended') return { principal: 'agent', decision: 'deny', status: 200, errorCode: 'access_denied', reason: 'agent_suspended' };
  return { principal: 'agent', decision: 'continue', clientId: entry.clientId };
}

/**
 * What the gateway does with a tool for an agent whose ceiling is `maxRisk` (CC-266, CC-261). The check is part of mayCall: a tool above the
 * ceiling is hidden and answered not_found_or_denied, never access_denied. An UPDATE tool passes it for maxRisk UPDATE, but the confirmation needs the
 * authenticator that an agent does not have, so no confirmation is created and the answer is access_denied with principal_not_eligible.
 */
export function agentToolDecision({ maxRisk, toolRisk, event }) {
  const above = RISK_ORDER[toolRisk] > RISK_ORDER[maxRisk];
  if (event === 'list') return { listed: !above };
  if (above) return { allowed: false, errorCode: 'not_found_or_denied', auditReason: 'agent_max_risk' };
  if (toolRisk === 'READ_ONLY') return { allowed: true };
  return { allowed: false, errorCode: 'access_denied', auditReason: 'principal_not_eligible', confirmationCreated: false };
}

const destructiveGroup = (group) => group === 'mcp-platform-admin' || /-destructive$/u.test(group);

/** 201, 409 or 422 of createAgentClient and the 422 of updateAgentClient (CC-266). `existing` is the list of clientIds already registered. */
export function agentWriteDecision({ operation, body, existing = [] }) {
  if (operation === 'create' && existing.includes(body.clientId)) return { status: 409, error: 'agent_exists' };
  if (body.maxRisk === 'DESTRUCTIVE') return { status: 422, error: 'agent_rejected', reason: 'max_risk_not_allowed' };
  if ((body.allowedGroups ?? []).some(destructiveGroup)) return { status: 422, error: 'agent_rejected', reason: 'agent_group_not_allowed' };
  return operation === 'create' ? { status: 201, maxRisk: body.maxRisk ?? 'READ_ONLY', delegationAllowed: body.delegationAllowed ?? false } : { status: 200 };
}

/** listAgentClients: the whole registry needs the administrator group, owner=me does not (CC-266). */
export function listAgentsDecision({ owner = null, isAdmin, callerSub, agents }) {
  if (owner === 'me') return { status: 200, clientIds: agents.filter((a) => a.ownerSub === callerSub).map((a) => a.clientId) };
  if (!isAdmin) return { status: 403, error: 'access_denied' };
  return { status: 200, clientIds: agents.map((a) => a.clientId) };
}

/**
 * The kill switch of an agent (CC-266). The owner may put it, only an administrator may lift it, the lift needs a fresh MFA (checked before
 * the address is looked at), and the agent of another person does not exist for a caller without the group.
 */
export function agentSwitchDecision({ event, callerSub, isAdmin, freshMfa = false, ownerSub }) {
  if (event === 'lift') {
    if (!freshMfa) return { status: 401, error: 'step_up_required' };
    if (!isAdmin) return { status: 403, error: 'access_denied' };
    return { status: 204 };
  }
  if (!isAdmin && callerSub !== ownerSub) return { status: 404, error: 'not_found_or_denied' };
  return { status: 204, raisesPolicyDataRevision: true };
}

const atLeast8 = (version) => {
  if (version === undefined) return false;
  const [major] = version.split('.').map(Number);
  return major >= 8;
};

/**
 * The body of the policy data push for one server (CC-266). allowedAgentClients goes only to a server whose approved manifest has
 * contractsVersion 8.0.0 or higher, and is left out altogether, not sent as an empty array, for any other (PolicyData is closed).
 */
export function policyDataBodyFor({ contractsVersion, agents }) {
  if (!atLeast8(contractsVersion)) return { includesAllowedAgentClients: false };
  return { includesAllowedAgentClients: true, allowedAgentClients: agents.filter((a) => a.status === 'active').map((a) => a.clientId).sort() };
}

/** The check of azp that a server makes in code before Cedar (CC-266): a human client and an agent client are separate lists. */
export function serverAzpDecision({ pty = null, azp, allowedClients, allowedAgentClients = [] }) {
  const list = pty === null ? allowedClients : allowedAgentClients;
  return list.includes(azp) ? { decision: 'continue' } : { decision: 'deny', reason: 'client_not_allowed' };
}

/** Revision of the policy data after a change of the registry: the rule of the gateway is max(previous + 1, epoch milliseconds). */
export const revisionAfterChange = ({ previous, nowMs }) => ({ revision: Math.max(previous + 1, nowMs), pushed: true });
