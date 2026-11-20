// Generates test-vectors/broker-eligibility and agent-clients, and the agent vectors in gateway-authentication, policy-data-push,
// policy-data-gate and activity-calls (CC-261, CC-265, CC-266). The expected values come from scripts/lib/agents.mjs and
// broker-eligibility.mjs; the gateway, the broker and the starter must reproduce them. It adds files and removes none.
import { mkdirSync, writeFileSync } from 'node:fs';
import { path } from './lib/contracts.mjs';
import { agentToolDecision, agentWriteDecision, classifyCaller, listAgentsDecision, policyDataBodyFor, revisionAfterChange, serverAzpDecision } from './lib/agents.mjs';
import { agentsAllowedWrite, brokerEligibility } from './lib/broker-eligibility.mjs';
import { aggregateCall } from './lib/activity-calls.mjs';

const write = (dir, name, value) => {
  mkdirSync(path('test-vectors', dir), { recursive: true });
  writeFileSync(path('test-vectors', dir, name), JSON.stringify(value, null, 2) + '\n');
};

// ---------- agents: registry, broker eligibility, policy data (CC-261, CC-266) ----------
{
  const OWN = 'sha256:' + 'a'.repeat(64);
  const SA_SUB = '7d0f3c1e-2b64-4a8e-9a0b-5c1f6e2d8a47';
  const registry = [
    { clientId: 'agent-reports', serviceAccountSub: SA_SUB, status: 'active' },
    { clientId: 'agent-sleeper', serviceAccountSub: '0b3a9d52-6a3c-4d06-8e1c-4f5a7f1e9c33', status: 'suspended' },
  ];
  const token = { azp: 'agent-reports', sub: SA_SUB, principalType: 'agent', iat: 1000, exp: 1300 };
  const auth = (name, description, input) => write('gateway-authentication', `${name}.json`, { description, input, expected: classifyCaller(input) });
  auth('agent-active', 'An active entry of the registry, the marker of the IdP, the sub of its service account and a lifetime of 300 s: an agent.', { token, registry });
  auth('agent-unknown-azp-with-marker', 'The marker agent on an azp that is not in the registry: 401 agent_not_registered.', { token: { ...token, azp: 'agent-unknown' }, registry });
  auth('agent-known-azp-without-marker', 'The azp of an agent without the marker of the IdP: 401 agent_not_registered, never treated as a human client.', { token: { ...token, principalType: undefined }, registry });
  auth('agent-sub-mismatch', 'A sub other than the service account of the entry: 401 agent_not_registered.', { token: { ...token, sub: 'someone-else' }, registry });
  auth('agent-token-over-300-seconds', 'exp - iat of 301 s: 401 agent_token_lifetime.', { token: { ...token, exp: 1301 }, registry });
  auth('agent-suspended', 'A suspended agent is refused with agent_suspended (access_denied for tools/call, -32602 for resources and prompts).', { token: { ...token, azp: 'agent-sleeper', sub: '0b3a9d52-6a3c-4d06-8e1c-4f5a7f1e9c33' }, registry });
  auth('agent-registry-unreadable', 'An unreadable registry refuses an agent (fail-closed).', { token, registry: null, registryReadable: false });
  auth('agent-registry-unreadable-human-unaffected', 'A human client is not affected by an unreadable registry.', { token: { azp: 'claude-code', sub: 'user-1', iat: 1000, exp: 4600 }, registry: null, registryReadable: false });
  auth('agent-not-in-allowed-clients-still-accepted', 'The registry replaces MCP_ALLOWED_CLIENTS for the azp of an agent: an active entry is accepted although the azp is not in the list of human clients.', { token, registry, allowedClients: ['claude-code'] });
  auth('agent-azp-in-allowed-clients-without-registry-entry', 'An azp in MCP_ALLOWED_CLIENTS that carries the marker of an agent but has no entry: 401, the list does not make an agent.', { token: { ...token, azp: 'claude-code' }, registry, allowedClients: ['claude-code'] });
  const tool = (name, description, input) => write('gateway-authentication', `${name}.json`, { description, input, expected: agentToolDecision(input) });
  tool('agent-max-risk-not-found-or-denied', 'A tool above maxRisk is refused as not_found_or_denied with the reason agent_max_risk, never access_denied.', { maxRisk: 'READ_ONLY', toolRisk: 'UPDATE', event: 'call' });
  tool('agent-max-risk-hides-tool', 'The same tool is absent from tools/list.', { maxRisk: 'READ_ONLY', toolRisk: 'UPDATE', event: 'list' });
  tool('agent-max-risk-read-only-tool-allowed', 'A READ_ONLY tool passes for an agent of any ceiling.', { maxRisk: 'READ_ONLY', toolRisk: 'READ_ONLY', event: 'call' });
  tool('agent-update-denied-no-confirmation', 'maxRisk UPDATE lets an UPDATE tool pass the ceiling, but an agent has no authenticator: no confirmation is created and the answer is access_denied with principal_not_eligible.', { maxRisk: 'UPDATE', toolRisk: 'UPDATE', event: 'call' });
  tool('agent-destructive-above-ceiling', 'A DESTRUCTIVE tool is above every ceiling an agent can have.', { maxRisk: 'UPDATE', toolRisk: 'DESTRUCTIVE', event: 'call' });

  const eligibility = (name, description, input) => write('broker-eligibility', `${name}.json`, { description, input, expected: brokerEligibility(input) });
  const sa = { supportedTypes: ['service-account'], agentsAllowed: false };
  const saAllowed = { supportedTypes: ['service-account'], agentsAllowed: true };
  const both = { supportedTypes: ['user-secret', 'user-oauth', 'token-exchange'], agentsAllowed: false };
  eligibility('agent-user-secret-403', 'An agent with a user-secret system: 403 principal_not_eligible before the secret store is read.', { operation: 'resolve', claims: { pty: 'agent', tool: 'get_issue' }, system: both, credentialType: 'user-secret' });
  eligibility('agent-user-oauth-403', 'An agent with a user-oauth system: 403 principal_not_eligible, no credential_required.', { operation: 'resolve', claims: { pty: 'agent', tool: 'get_issue' }, system: both, credentialType: 'user-oauth' });
  eligibility('agent-service-account-without-flag-403', 'service-account for a system with agentsAllowed false: 403.', { operation: 'resolve', claims: { pty: 'agent', tool: 'get_issue' }, system: sa, credentialType: 'service-account' });
  eligibility('agent-service-account-with-flag-200', 'service-account for a system with agentsAllowed true: 200.', { operation: 'resolve', claims: { pty: 'agent', tool: 'get_issue' }, system: saAllowed, credentialType: 'service-account' });
  eligibility('agent-token-exchange-200', 'token-exchange: the broker exchanges the token of the agent, 200.', { operation: 'resolve', claims: { pty: 'agent', tool: 'get_issue' }, system: both, credentialType: 'token-exchange' });
  eligibility('agent-authenticator-403', 'An agent has no authenticator: 403 principal_not_eligible.', { operation: 'authenticator', claims: { pty: 'agent', tool: 'update_issue' }, system: sa });
  eligibility('delegated-without-act-401', 'pty delegated without act: 401 invalid_claims.', { operation: 'resolve', claims: { pty: 'delegated', tool: 'get_issue' }, system: both, credentialType: 'user-secret' });
  eligibility('delegated-user-secret-200', 'pty delegated with act resolves by the sub of the human, every type allowed.', { operation: 'resolve', claims: { pty: 'delegated', act: { sub: 'agent-sub' }, tool: 'get_issue' }, system: both, credentialType: 'user-secret' });
  eligibility('delegated-authenticator-200', 'The authenticator works for delegated by the sub of the human.', { operation: 'authenticator', claims: { pty: 'delegated', act: { sub: 'agent-sub' }, tool: 'update_issue' }, system: both });
  eligibility('resolve-with-resource-200', 'resolve with resource instead of tool.', { operation: 'resolve', claims: { resource: 'servicedesk://ticket/T-1' }, system: both, credentialType: 'user-secret' });
  eligibility('resolve-with-tool-and-resource-401', 'A token with both tool and resource: 401 invalid_claims.', { operation: 'resolve', claims: { tool: 'get_issue', resource: 'servicedesk://ticket/T-1' }, system: both, credentialType: 'user-secret' });
  eligibility('no-pty-unchanged', 'Without pty nothing changes.', { operation: 'resolve', claims: { tool: 'get_issue' }, system: both, credentialType: 'user-secret' });
  const written = (name, description, input) => write('broker-eligibility', `${name}.json`, { description, input, expected: agentsAllowedWrite(input) });
  written('agents-allowed-without-service-account-422', 'agentsAllowed true without service-account in supportedTypes: 422 system_rejected.', { after: { supportedTypes: ['user-secret'], agentsAllowed: true } });
  written('agents-allowed-enabled-needs-fresh-mfa', 'Turning agentsAllowed on needs a fresh MFA.', { before: { supportedTypes: ['service-account'], agentsAllowed: false }, after: { supportedTypes: ['service-account'], agentsAllowed: true }, othersChanged: false });
  written('agents-allowed-disabled-alone-no-mfa', 'A replace that only turns agentsAllowed off needs no fresh MFA.', { before: { supportedTypes: ['service-account'], agentsAllowed: true }, after: { supportedTypes: ['service-account'], agentsAllowed: false }, othersChanged: false });

  const agentWrite = (name, description, input) => write('agent-clients', `${name}.json`, { description, input, expected: agentWriteDecision(input) });
  agentWrite('create-valid', 'A valid entry: 201, maxRisk READ_ONLY and delegationAllowed false by default.', { operation: 'create', body: { clientId: 'agent-reports', serviceAccountSub: SA_SUB, ownerSub: 'owner-1', allowedGroups: ['mcp-jira-read'] } });
  agentWrite('create-destructive-group', 'A group with the suffix -destructive: 422 agent_group_not_allowed.', { operation: 'create', body: { clientId: 'agent-reports', serviceAccountSub: SA_SUB, ownerSub: 'owner-1', allowedGroups: ['mcp-jira-destructive'] } });
  agentWrite('create-platform-admin-group', 'mcp-platform-admin: 422 agent_group_not_allowed.', { operation: 'create', body: { clientId: 'agent-reports', serviceAccountSub: SA_SUB, ownerSub: 'owner-1', allowedGroups: ['mcp-platform-admin'] } });
  agentWrite('create-max-risk-destructive', 'maxRisk DESTRUCTIVE: 422 max_risk_not_allowed.', { operation: 'create', body: { clientId: 'agent-reports', serviceAccountSub: SA_SUB, ownerSub: 'owner-1', maxRisk: 'DESTRUCTIVE' } });
  agentWrite('create-duplicate', 'A clientId that exists: 409 agent_exists.', { operation: 'create', body: { clientId: 'agent-reports', serviceAccountSub: SA_SUB, ownerSub: 'owner-1' }, existing: ['agent-reports'] });
  agentWrite('update-max-risk-update', 'Raising maxRisk to UPDATE is allowed.', { operation: 'update', body: { maxRisk: 'UPDATE' } });
  agentWrite('update-destructive-group', 'The same group rule on update.', { operation: 'update', body: { allowedGroups: ['mcp-gitlab-destructive'] } });
  const list = (name, description, input) => write('agent-clients', `${name}.json`, { description, input, expected: listAgentsDecision(input) });
  const agents = [{ clientId: 'agent-reports', ownerSub: 'owner-1' }, { clientId: 'agent-billing', ownerSub: 'owner-2' }];
  list('list-owner-me', 'owner=me returns only the agents of the caller and needs no group.', { owner: 'me', isAdmin: false, callerSub: 'owner-1', agents });
  list('list-all-without-group-403', 'The whole registry without the administrator group: 403.', { isAdmin: false, callerSub: 'owner-1', agents });
  list('list-all-as-admin', 'The administrator sees the whole registry.', { isAdmin: true, callerSub: 'admin-1', agents });

  const dataBody = (name, description, input) => write('policy-data-push', `${name}.json`, { description, input, expected: policyDataBodyFor(input) });
  const activeAgents = [{ clientId: 'agent-reports', status: 'active' }, { clientId: 'agent-sleeper', status: 'suspended' }];
  dataBody('allowed-agent-clients-new-server', 'A server whose manifest has contractsVersion 8.0.0 gets allowedAgentClients with the active agents only.', { contractsVersion: '8.0.0', agents: activeAgents });
  dataBody('allowed-agent-clients-empty-array', 'No active agent: a server of 8.0.0 or higher gets an empty array.', { contractsVersion: '8.1.0', agents: [] });
  dataBody('old-server-without-allowed-agent-clients', 'A server whose manifest has no contractsVersion gets a push without the field (not an empty array), so a human call is not refused with 409 policy_data_stale.', { agents: activeAgents });
  dataBody('allowed-agent-clients-server-7x', 'contractsVersion 7.2.0: the field is left out.', { contractsVersion: '7.2.0', agents: activeAgents });

  const azp = (name, description, input) => write('policy-data-gate', `${name}.json`, { description, input, expected: serverAzpDecision(input) });
  azp('agent-azp-in-allowed-clients-refused', 'The azp of an agent token that is listed only in allowedClients is refused: an agent is accepted only from allowedAgentClients.', { pty: 'agent', azp: 'agent-reports', allowedClients: ['agent-reports'], allowedAgentClients: [] });
  azp('agent-azp-in-allowed-agent-clients', 'The azp of an agent token listed in allowedAgentClients passes.', { pty: 'agent', azp: 'agent-reports', allowedClients: ['claude-code'], allowedAgentClients: ['agent-reports'] });
  azp('human-azp-in-allowed-agent-clients-refused', 'A token without pty never takes its azp from allowedAgentClients.', { azp: 'agent-reports', allowedClients: ['claude-code'], allowedAgentClients: ['agent-reports'] });
  azp('delegated-azp-from-allowed-agent-clients', 'A delegated token takes its azp from allowedAgentClients too.', { pty: 'delegated', azp: 'agent-reports', allowedClients: ['claude-code'], allowedAgentClients: ['agent-reports'] });
  const revision = (name, description, input) => write('policy-data-gate', `${name}.json`, { description, input, expected: revisionAfterChange(input) });
  revision('agent-suspended-raises-revision', 'Suspending an agent raises the revision of the policy data (max of previous + 1 and the epoch milliseconds) and pushes it.', { previous: 41, nowMs: 1795000000000 });
  revision('agent-created-raises-revision-past-clock', 'A previous revision at or above the clock still rises by one.', { previous: 1795000000000, nowMs: 1795000000000 });

  const row = { requestId: '0192d1b2-7c3a-7d4e-8f10-2a3b4c5d6e01', ts: '2026-10-26T20:00:00.000Z' };
  const rowVector = (name, description, value, valid) => write('activity-calls', `${valid ? 'valid' : 'invalid'}-${name}.json`, { description, value, expected: { valid } });
  rowVector('resource-row-without-tool', 'A row of a resource read has kind resource and no tool (CC-265).', { ...row, kind: 'resource', resource: { type: 'ServiceDesk::Ticket', id: 'T-1' }, result: 'ok' }, true);
  rowVector('prompt-row-without-tool', 'A row of a prompt get has kind prompt, the name the client used, and no tool.', { ...row, kind: 'prompt', prompt: 'servicedesk__summarize_ticket', result: 'ok' }, true);
  rowVector('kind-unknown', 'kind is tool, resource or prompt.', { ...row, kind: 'agent', result: 'ok' }, false);
  rowVector('prompt-not-qualified', 'prompt is the qualified name <system>__<prompt>.', { ...row, kind: 'prompt', prompt: 'summarize_ticket', result: 'ok' }, false);
  const agentEvents = (n, reason, errorCode) => [{ ts: '2026-10-26T20:00:00.000Z', requestId: `0192d1b2-7c3a-7d4e-8f10-2a3b4c5d6e${n}`, component: 'gateway', componentId: 'mcp-gateway', sub: SA_SUB, client: 'agent-reports', event: 'tool_call', server: 'mcp-jira', tool: 'update_issue', risk: 'UPDATE', decision: 'deny', reason, outcome: 'denied', errorCode }];
  for (const [n, reason, errorCode] of [['71', 'agent_max_risk', 'not_found_or_denied'], ['72', 'agent_suspended', 'access_denied'], ['73', 'principal_not_eligible', 'access_denied']]) {
    const events = agentEvents(n, reason, errorCode);
    write('activity-calls', `aggregation-agent-${reason.replaceAll('_', '-')}.json`, { description: `A refusal of an agent with the reason ${reason}: the row is denied_not_granted (CC-266, CC-261).`, now: '2026-10-26T20:00:30.000Z', events, expected: aggregateCall(events, Date.parse('2026-10-26T20:00:30.000Z') / 1000) });
  }
}
