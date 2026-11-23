// Generates test-vectors/broker-eligibility and agent-clients, and the agent vectors in gateway-authentication, policy-data-push,
// policy-data-gate, activity-calls and catalog-actions (CC-261, CC-265, CC-266). The expected values come from scripts/lib/agents.mjs and
// broker-eligibility.mjs; the gateway, the broker and the starter must reproduce them. It adds files and removes none.
import { mkdirSync, writeFileSync } from 'node:fs';
import { path } from './lib/contracts.mjs';
import { agentToolDecision, agentWriteDecision, classifyCaller, listAgentsDecision, policyDataBodyFor, revisionAfterChange, serverAzpDecision } from './lib/agents.mjs';
import { agentsAllowedWrite, brokerEligibility } from './lib/broker-eligibility.mjs';
import { aggregateCall } from './lib/activity-calls.mjs';
import { catalogActionsOfEntries, catalogStatus } from './lib/catalog-actions.mjs';

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
  dataBody('allowed-agent-clients-prerelease', 'contractsVersion 8.0.0-rc.1 is lower than 8.0.0, as for the emission of claims (CC-260): the field is left out.', { contractsVersion: '8.0.0-rc.1', agents: activeAgents });
  dataBody('allowed-agent-clients-malformed-version', 'A contractsVersion that is not SemVer (8.0): the field is left out, as claims are not emitted.', { contractsVersion: '8.0', agents: activeAgents });

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

// ---------- catalog actions and status with resources and prompts counted like tools (CC-265) ----------
// The expected values are written out by hand from the rule of CC-265, not taken from the functions: the generator only checks that
// the functions agree.
{
  const both = ['user-oauth', 'user-secret'];
  const connected = { status: 'connected', supportedTypes: both, connectionType: 'user-oauth', hasConnection: true };
  const tool = { kind: 'tool', access: 'granted', requiredEntitlements: [] };
  const promptDenied = { kind: 'prompt', access: 'denied', requiredEntitlements: ['mcp-jira-read'] };
  const vector = (name, description, input, actions) => {
    if (JSON.stringify(catalogActionsOfEntries(input)) !== JSON.stringify(actions)) throw new Error(`catalog-actions/${name}: the reference function disagrees with the rule`);
    write('catalog-actions', `${name}.json`, { description, input, expected: { actions } });
  };
  vector('entries-connected-denied-prompt-request-access', 'All tools granted and one prompt denied with known requiredEntitlements: the server row has request_access, as for a denied tool (CC-265).', { ...connected, entries: [tool, promptDenied] }, ['copy_link', 'disconnect', 'request_access']);
  vector('entries-connected-denied-resource-request-access', 'A denied resource counts like a denied tool.', { ...connected, entries: [tool, { kind: 'resource', access: 'denied', requiredEntitlements: ['mcp-jira-read'] }] }, ['copy_link', 'disconnect', 'request_access']);
  vector('entries-connected-denied-resource-template-request-access', 'A denied resource template counts like a denied tool.', { ...connected, entries: [tool, { kind: 'resource-template', access: 'denied', requiredEntitlements: ['mcp-jira-read'] }] }, ['copy_link', 'disconnect', 'request_access']);
  vector('entries-connected-denied-prompt-request-pending', 'A pending request for the entitlement the denied prompt needs: view_request instead of request_access.', { ...connected, entries: [tool, promptDenied], pendingEntitlements: ['mcp-jira-read'] }, ['copy_link', 'disconnect', 'view_request']);
  vector('entries-connected-denied-prompt-other-request-pending', 'A pending request for another entitlement does not replace request_access.', { ...connected, entries: [tool, promptDenied], pendingEntitlements: ['mcp-gitlab-read'] }, ['copy_link', 'disconnect', 'request_access']);
  vector('entries-connected-denied-prompt-unknown-entitlements', 'A denied prompt without requiredEntitlements: nothing to ask for, no request_access (CC-113).', { ...connected, entries: [tool, { kind: 'prompt', access: 'denied', requiredEntitlements: [] }] }, ['copy_link', 'disconnect']);
  vector('entries-connected-disabled-prompt-denied-no-effect', 'A disabled prompt is not counted as denied: the server row has no request_access.', { ...connected, entries: [tool, { ...promptDenied, disabled: true }] }, ['copy_link', 'disconnect']);
  vector('entries-connected-disabled-resource-denied-no-effect', 'A disabled resource is not counted as denied, whatever disabledBy.', { ...connected, entries: [tool, { kind: 'resource', access: 'denied', requiredEntitlements: ['mcp-jira-read'], disabled: true, disabledBy: 'kill_switch' }] }, ['copy_link', 'disconnect']);
  vector('entries-connected-granted-entries-only', 'Every tool and every entry granted: no request_access.', { ...connected, entries: [tool, { kind: 'resource', access: 'granted', requiredEntitlements: [] }, { kind: 'prompt', access: 'granted', requiredEntitlements: [] }] }, ['copy_link', 'disconnect']);
  vector('entries-connected-denied-tool-and-disabled-denied-prompt', 'A denied tool still counts when a denied prompt is disabled; the entitlements come from the tool.', { ...connected, entries: [{ ...tool, access: 'denied', requiredEntitlements: ['mcp-jira-write'] }, { ...promptDenied, disabled: true }] }, ['copy_link', 'disconnect', 'request_access']);
  vector('entries-not-connected-denied-prompt', 'A denied prompt does not add request_access outside the connected status, as for a denied tool.', { status: 'not_connected', supportedTypes: both, connectionType: null, hasConnection: false, entries: [tool, promptDenied] }, ['add_secret', 'connect_oauth']);
  vector('entries-no-access-denied-prompt', 'Status no_access with a denied prompt of known entitlements: request_access.', { status: 'no_access', supportedTypes: both, connectionType: null, hasConnection: false, entries: [promptDenied] }, ['request_access']);

  const state = (name, description, input, status) => {
    if (catalogStatus(input) !== status) throw new Error(`catalog-actions/${name}: the reference function disagrees with the rule`);
    write('catalog-actions', `${name}.json`, { description, input, expected: { status } });
  };
  const oauth = { credentialDefaultType: 'user-oauth', connectionStatus: 'connected' };
  state('status-granted-prompt-only-is-not-no-access', 'No tool is granted but a prompt is: rule 2 does not apply, the status follows the connection (CC-265).', { entries: [{ ...tool, access: 'denied', requiredEntitlements: ['mcp-jira-write'] }, { kind: 'prompt', access: 'granted', requiredEntitlements: [] }], ...oauth }, 'connected');
  state('status-granted-resource-only-not-connected', 'A granted resource is enough to leave no_access; with no connection the status is not_connected.', { entries: [{ kind: 'resource', access: 'granted', requiredEntitlements: [] }], credentialDefaultType: 'user-oauth', connectionStatus: null }, 'not_connected');
  state('status-nothing-granted-no-access', 'No tool, resource, template or prompt is granted: no_access.', { entries: [{ ...tool, access: 'denied', requiredEntitlements: ['mcp-jira-write'] }, promptDenied], ...oauth }, 'no_access');
  state('status-nothing-granted-prompt-request-pending', 'Nothing granted and a request pending for the entitlement of a denied prompt: request_pending.', { entries: [{ ...tool, access: 'denied', requiredEntitlements: [] }, promptDenied], pendingEntitlements: ['mcp-jira-read'], ...oauth }, 'request_pending');
  state('status-nothing-granted-disabled-prompt-request-not-pending', 'The only entry is a denied prompt that is disabled and its entitlement has a pending request: nothing to ask for until it is enabled, so no_access and not request_pending.', { entries: [{ kind: 'prompt', access: 'denied', requiredEntitlements: ['mcp-jira-read'], disabled: true }], pendingEntitlements: ['mcp-jira-read'], ...oauth }, 'no_access');
  state('status-granted-disabled-prompt-counts-as-granted', 'A disabled entry keeps its grant: access, not disabled, decides rules 1 and 2.', { entries: [{ ...tool, access: 'denied', requiredEntitlements: [] }, { kind: 'prompt', access: 'granted', requiredEntitlements: [], disabled: true }], ...oauth }, 'connected');
}

// ---------- activity rows of resource reads and prompt gets (CC-264, CC-265) ----------
// result and errorCode are written out by hand from CC-259 (what the client was told), CC-165 (result per reason) and CC-187 (a
// refusal of steps 3 to 6 is not_found_or_denied whatever its cause); the generator fails when aggregateCall disagrees.
{
  const NOW = '2026-10-26T20:00:30.000Z';
  const SUB = '6f1c2a9e-4d4b-4c51-9a53-1e0f0c7d2b11';
  const event = (n, kind, extra) => ({ ts: '2026-10-26T20:00:00.123Z', requestId: `0192d1b2-7c3a-7d4e-8f10-2a3b4c5d6e${n}`, component: 'gateway', componentId: 'mcp-gateway', sub: SUB, client: 'claude-code', event: kind, server: 'mcp-jira', ...extra });
  const resource = { type: 'Jira::Issue', id: 'ABC-123' };
  const NOT_FOUND = 'not_found_or_denied';
  const aggregation = (name, description, ev, result, errorCode) => {
    const row = { requestId: ev.requestId, ts: ev.ts, kind: ev.event === 'resource_read' ? 'resource' : 'prompt' };
    if (ev.client) row.client = ev.client;
    if (ev.filter) row.filter = ev.filter;
    if (ev.event === 'resource_read') {
      if (ev.resourceTemplate) row.resourceTemplate = ev.resourceTemplate;
      if (ev.resource) row.resource = ev.resource;
    } else row.prompt = `jira__${ev.prompt}`;
    const expected = { ...row, result, errorCode };
    const events = [ev];
    if (JSON.stringify(aggregateCall(events, Date.parse(NOW) / 1000)) !== JSON.stringify(expected)) throw new Error(`activity-calls/${name}: aggregateCall disagrees with the rule`);
    write('activity-calls', `aggregation-${name}.json`, { description, now: NOW, events, expected });
  };
  const read = (n, extra) => event(n, 'resource_read', extra);
  const get = (n, extra) => event(n, 'prompt_get', extra);
  aggregation('resource-read-ok', 'A resource_read that ended ok is a row of kind resource with the template and the entity of the audit event, result ok; no tool, no confirmation (CC-264, CC-265).',
    read('81', { resourceTemplate: 'issue', resource, decision: 'allow', outcome: 'ok', errorCode: null, latencyMs: 31 }), 'ok', null);
  aggregation('resource-read-uri-no-match', 'A URI that matches no approved entry is answered like an unknown tool name: the row is denied_not_granted with not_found_or_denied, so it does not tell a missing resource from a forbidden one (CC-187, invariant 8). Decision of the owner, 2026-11-22.',
    read('82', { decision: 'deny', reason: 'uri_no_match', outcome: 'denied', errorCode: NOT_FOUND }), 'denied_not_granted', NOT_FOUND);
  aggregation('resource-read-variable-invalid', 'A variable that fails the idPattern of its type gives the same -32602 as an unknown URI (CC-259): denied_not_granted with not_found_or_denied.',
    read('83', { resourceTemplate: 'issue', decision: 'deny', reason: 'variable_invalid', outcome: 'denied', errorCode: NOT_FOUND }), 'denied_not_granted', NOT_FOUND);
  aggregation('resource-read-not-granted', 'A resource the user is not granted: denied_not_granted with not_found_or_denied.',
    read('84', { resourceTemplate: 'issue', resource, decision: 'deny', reason: 'not_granted', outcome: 'denied', errorCode: NOT_FOUND }), 'denied_not_granted', NOT_FOUND);
  aggregation('resource-read-policy-forbid', 'A Cedar forbid on a resource is denied_not_granted with not_found_or_denied, whatever errorCode the event carries: the row does not tell it from a missing grant.',
    read('85', { resourceTemplate: 'issue', resource, decision: 'deny', reason: 'policy_forbid', outcome: 'denied', errorCode: 'access_denied' }), 'denied_not_granted', NOT_FOUND);
  aggregation('resource-read-definition-changed', 'A definition that differs from the approved one hides the entry: reason definition_changed, result tool_disabled (the existing result value is reused), not_found_or_denied.',
    read('86', { resourceTemplate: 'issue', decision: 'deny', reason: 'definition_changed', outcome: 'denied', errorCode: NOT_FOUND }), 'tool_disabled', NOT_FOUND);
  aggregation('resource-read-kill-switch', 'A kill switch on the resource: reason kill_switch, result tool_disabled, not_found_or_denied.',
    read('87', { resourceTemplate: 'issue', decision: 'deny', reason: 'kill_switch', outcome: 'denied', errorCode: NOT_FOUND }), 'tool_disabled', NOT_FOUND);
  aggregation('resource-read-filter-scope', 'An address filter that excludes the resource: reason filter_scope, result denied_filter_scope, not_found_or_denied.',
    read('88', { filter: 'systems=gitlab', resourceTemplate: 'issue', decision: 'deny', reason: 'filter_scope', outcome: 'denied', errorCode: NOT_FOUND }), 'denied_filter_scope', NOT_FOUND);
  aggregation('resource-read-result-too-large', 'A result above MCP_RESOURCE_MAX_BYTES is -32603 with upstream_unavailable (CC-259: a rejected result): an error row with that errorCode.',
    read('89', { resourceTemplate: 'issue', resource, decision: 'allow', reason: 'result_too_large', outcome: 'error', errorCode: 'upstream_unavailable' }), 'error', 'upstream_unavailable');
  aggregation('resource-read-upstream-unavailable', 'The server does not answer (step 7 of resources/read): an error row, upstream_unavailable.',
    read('91', { resourceTemplate: 'issue', resource, decision: 'allow', reason: 'upstream_unavailable', outcome: 'error', errorCode: 'upstream_unavailable' }), 'error', 'upstream_unavailable');
  aggregation('resource-read-credential-required', 'The account has no connection for a template that needs a credential: -32603 credential_required (CC-259), row credential_required.',
    read('92', { resourceTemplate: 'issue', resource, decision: 'allow', reason: 'credential_required', outcome: 'error', errorCode: 'credential_required' }), 'credential_required', 'credential_required');
  aggregation('resource-read-rate-limited-user', 'rate_limited_user on a resource read is a rate_limited row like on a tool call.',
    read('93', { decision: 'deny', reason: 'rate_limited_user', outcome: 'denied', errorCode: 'rate_limited' }), 'rate_limited', 'rate_limited');
  aggregation('resource-read-rate-limited-agent', 'rate_limited_agent is a rate_limited row (CC-264, rule rate_limited_* of CC-165).',
    read('94', { client: 'agent-reports', principalType: 'agent', decision: 'deny', reason: 'rate_limited_agent', outcome: 'denied', errorCode: 'rate_limited' }), 'rate_limited', 'rate_limited');
  aggregation('resource-read-agent-suspended', 'A suspended agent reading a resource: reason agent_suspended, denied_not_granted with not_found_or_denied as in audit-events/gateway-agent-suspended (CC-261, CC-266). The row has no field for the principal.',
    read('95', { client: 'agent-reports', principalType: 'agent', resourceTemplate: 'issue', decision: 'deny', reason: 'agent_suspended', outcome: 'denied', errorCode: NOT_FOUND }), 'denied_not_granted', NOT_FOUND);
  aggregation('prompt-get-ok', 'A prompt_get that ended ok is a row of kind prompt named <system>__<prompt>, result ok; no tool (CC-264, CC-265).',
    get('96', { prompt: 'triage_issue', decision: 'allow', outcome: 'ok', errorCode: null, latencyMs: 5, argsLength: 64, definitionHash: 'sha256:' + 'b'.repeat(64) }), 'ok', null);
  aggregation('prompt-get-argument-invalid', 'An argument that fails its rule is checked after authorization and the client is told so (CC-259): an error row with the errorCode of the event.',
    get('97', { prompt: 'triage_issue', decision: 'deny', reason: 'argument_invalid', outcome: 'error', errorCode: 'invalid_argument', argsLength: 30 }), 'error', 'invalid_argument');
  aggregation('prompt-get-definition-changed', 'A prompt whose messages changed is hidden until it is approved again: reason definition_changed, result tool_disabled, not_found_or_denied.',
    get('98', { prompt: 'triage_issue', decision: 'deny', reason: 'definition_changed', outcome: 'denied', errorCode: NOT_FOUND }), 'tool_disabled', NOT_FOUND);
  aggregation('prompt-get-hidden-kill-switch', 'A prompt under a kill switch (hidden): reason kill_switch, result tool_disabled, not_found_or_denied.',
    get('99', { prompt: 'triage_issue', decision: 'deny', reason: 'kill_switch', outcome: 'denied', errorCode: NOT_FOUND }), 'tool_disabled', NOT_FOUND);
  aggregation('prompt-get-not-granted', 'A prompt the user is not granted: denied_not_granted with not_found_or_denied.',
    get('a1', { prompt: 'triage_issue', decision: 'deny', reason: 'not_granted', outcome: 'denied', errorCode: NOT_FOUND }), 'denied_not_granted', NOT_FOUND);
  aggregation('prompt-get-policy-forbid', 'A Cedar forbid on a prompt: denied_not_granted with not_found_or_denied whatever errorCode the event carries.',
    get('a2', { prompt: 'triage_issue', decision: 'deny', reason: 'policy_forbid', outcome: 'denied', errorCode: 'access_denied' }), 'denied_not_granted', NOT_FOUND);
  aggregation('prompt-get-agent-suspended', 'A suspended agent getting a prompt: denied_not_granted with not_found_or_denied.',
    get('a3', { client: 'agent-reports', principalType: 'agent', prompt: 'triage_issue', decision: 'deny', reason: 'agent_suspended', outcome: 'denied', errorCode: NOT_FOUND }), 'denied_not_granted', NOT_FOUND);
}
