// Generates test-vectors/endpoint-filter, endpoint-aggregate, mcp-endpoint, resource-uri and prompt-render (CC-259, CC-260, CC-169, CC-170, CC-172, CC-175, CC-178 ... CC-187).
// The expected values come from the reference in scripts/lib/endpoint-filter.mjs and endpoint-aggregate.mjs; the Java class
// EndpointFilter and the tests must reproduce them.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { path } from './lib/contracts.mjs';
import { applyFilter, applyPrimitiveFilter, callDecision, checkRoute, InvalidFilter, parseFilter, sessionDecision, sessionMatches, streamOpenDecision } from './lib/endpoint-filter.mjs';
import { listedNames, visibleEntries, auditThrottle, issueCursor, listChangedNotification, listChangedSequence, listChangedStateless, page, PAGE_SIZE, readCursor, routeCall, serverAvailable, visibleTools } from './lib/endpoint-aggregate.mjs';
import { composeQuery, mcpEndpoint } from './lib/mcp-endpoint.mjs';
import { idpTokenClaimsDecision, protectedResourceMetadata } from './lib/gateway-authentication.mjs';
import { killSwitchDecision, primitiveSwitchDecision } from './lib/kill-switch.mjs';
import { agentSwitchDecision } from './lib/agents.mjs';
import { matchTemplate, resolveUri } from './lib/resource-uri.mjs';
import { renderPrompt } from './lib/prompt-render.mjs';
import { capabilities, filterLinkBlocks, methodAnswer, promptGetDecision, rateLimitedAnswer, readDecision, resultFields, SUPPORTED_METHODS } from './lib/resources-endpoint.mjs';
import { manifestPullDecision } from './lib/adapter-registry.mjs';
import { adapterToolState, approveDecision, approvePrimitiveDecision, pullDecision, pullPrimitiveDecision } from './lib/registry-approval.mjs';
import { addressDecision, hostDecision, urlDecision } from './lib/address-policy.mjs';
import { approveConnectionDecision, emissionDecision, connectionCheck, expectedSystemDecision, firstConnection, toolAvailability } from './lib/server-connection.mjs';

const writer = (dir) => {
  rmSync(path('test-vectors', dir), { recursive: true, force: true });
  mkdirSync(path('test-vectors', dir), { recursive: true });
  return (name, value) => writeFileSync(path('test-vectors', dir, `${name}.json`), JSON.stringify(value, null, 2) + '\n');
};

const filterOut = writer('endpoint-filter');

// ---------- normalization and syntax ----------

const parseVector = (name, description, query) => {
  let expected;
  try {
    const { filter, canonical } = parseFilter(query);
    expected = { valid: true, canonical, filter };
  } catch (e) {
    if (!(e instanceof InvalidFilter)) throw e;
    expected = { valid: false, cause: e.cause, response: { status: 400, error: 'invalid_request', reason: 'invalid_filter' } };
  }
  filterOut(`parse-${name}`, { description, kind: 'parse', input: { query }, expected });
};

parseVector('no-query', 'No query: no filter, the canonical form is empty and the audit event has no filter field.', '');
parseVector('systems-single', 'One system.', 'systems=jira');
parseVector('systems-sorted', 'Values are sorted bytewise.', 'systems=jira,gitlab');
parseVector('parameter-order', 'Parameters come in the fixed order systems, tools, access, exclude.', 'access=read&systems=jira');
parseVector('duplicates-removed', 'Duplicates inside a list are removed.', 'systems=jira,jira,gitlab');
parseVector('upper-case-value', 'A value with upper case letters is not an error; it is lower-cased.', 'access=READ');
parseVector('upper-case-name-and-value', 'Names and values are compared without regard to case.', 'Systems=Jira,GitLab&ACCESS=Write');
parseVector('tools', 'Qualified tool names.', 'tools=jira__get_issue,gitlab__get_project');
parseVector('tools-sorted', 'Tool names are sorted bytewise too.', 'tools=jira__get_issue,confluence__get_page');
parseVector('exclude-system-and-tool', 'An entry with a double underscore is a tool, any other entry is a system.', 'exclude=jira__delete_issue,confluence');
parseVector('access-read', 'access=read.', 'access=read');
parseVector('access-write', 'access=write.', 'access=write');
parseVector('all-four', 'All four parameters.', 'exclude=gitlab&tools=jira__get_issue,jira__create_issue&access=write&systems=jira');
parseVector('unknown-system-is-syntax-only', 'A system the platform does not know is a valid entry; it is skipped when the list is computed (invariant 8).', 'systems=jira,nosuchsystem');
const systemIds = (count) => Array.from({ length: count }, (_, i) => `s${String(i).padStart(2, '0')}`).join(',');
parseVector('systems-at-limit', 'Twenty systems are at the limit; the platform has no fixed list of systems, so the limit is a number, not the count of today\'s systems.', `systems=${systemIds(20)}`);
parseVector('systems-over-limit', 'Twenty-one systems are over the limit of 20.', `systems=${systemIds(21)}`);
parseVector('exclude-over-limit', 'More than 100 entries in exclude (the query itself is under 512 bytes).', `exclude=${Array.from({ length: 101 }, (_, i) => `a${i}`).join(',')}`);
const longEntries = (extra) => {
  const entries = Array.from({ length: 20 }, (_, i) => `a${String(i).padStart(2, '0')}${'x'.repeat(21)}`);
  entries[19] += 'y'.repeat(5 + extra);
  return `exclude=${entries.join(',')}`;
};
parseVector('query-512-bytes', 'A query of exactly 512 bytes is accepted.', longEntries(0));
parseVector('query-513-bytes', 'A query of 513 bytes is rejected.', longEntries(1));
parseVector('unknown-parameter', 'A typo such as system= is an error, not a lost filter (fail-closed).', 'system=jira');
parseVector('unknown-parameter-next-to-valid', 'An unknown parameter next to a valid one.', 'systems=jira&format=json');
parseVector('repeated-parameter', 'The same parameter twice.', 'systems=jira&systems=gitlab');
parseVector('empty-value', 'systems= is not "all systems".', 'systems=');
parseVector('empty-entry-trailing-comma', 'Trailing comma.', 'systems=jira,');
parseVector('empty-entry-double-comma', 'Double comma.', 'tools=jira__get_issue,,gitlab__get_project');
parseVector('empty-parameter', 'Empty segment between ampersands.', 'systems=jira&&access=read');
parseVector('trailing-ampersand', 'Trailing ampersand.', 'systems=jira&');
parseVector('no-equals-sign', 'Parameter without a value.', 'systems');
parseVector('no-name', 'Value without a name.', '=jira');
parseVector('two-equals-signs', 'A second equals sign inside a value.', 'systems=a=b');
parseVector('percent-encoded-comma', 'An encoded comma would give a second spelling of the same address.', 'systems=gitlab%2cjira');
parseVector('percent-encoded-letter', 'No percent-encoding at all.', 'systems=%6aira');
parseVector('space', 'A space inside a list.', 'systems=jira, gitlab');
parseVector('plus-sign', 'A plus sign.', 'systems=jira+gitlab');
parseVector('semicolon', 'A semicolon.', 'systems=jira;access=read');
parseVector('hyphen', 'Hyphen is not in the alphabet of system and tool names.', 'systems=jira-cloud');
parseVector('non-ascii', 'A letter outside ASCII.', 'systems=jirä');
parseVector('access-invalid', 'access takes read or write.', 'access=rw');
parseVector('access-list', 'access takes one value, not a list; no parameter means both.', 'access=read,write');
parseVector('tool-without-system', 'A tool name without the system prefix.', 'tools=get_issue');
parseVector('tool-double-underscore-twice', 'Two separators in a tool name.', 'tools=jira__get__issue');
parseVector('tool-in-systems', 'A tool name in systems.', 'systems=jira__get_issue');
parseVector('exclude-single-underscore', 'Neither a system nor a tool (no double underscore, underscore in the name).', 'exclude=jira_get');
parseVector('system-starts-with-digit', 'A system id starts with a letter.', 'systems=1jira');

// ---------- the filter on a route ----------

const routeVector = (name, description, routeSystem, query) => {
  let expected;
  try {
    const { filter, canonical } = parseFilter(query);
    checkRoute(filter, routeSystem);
    expected = { valid: true, canonical };
  } catch (e) {
    if (!(e instanceof InvalidFilter)) throw e;
    expected = { valid: false, cause: e.cause, response: { status: 400, error: 'invalid_request', reason: 'invalid_filter' } };
  }
  filterOut(`route-${name}`, { description, kind: 'route', input: { route: routeSystem === null ? '/mcp' : `/s/mcp-${routeSystem}/mcp`, routeSystem, query }, expected });
};
routeVector('aggregate-any-systems', '/mcp takes any systems.', null, 'systems=jira,gitlab');
routeVector('system-route-without-systems', '/s/mcp-jira/mcp without systems.', 'jira', 'access=read');
routeVector('system-route-same-system', '/s/mcp-jira/mcp with systems=jira.', 'jira', 'systems=jira');
routeVector('system-route-other-system', '/s/mcp-jira/mcp with systems=gitlab is an error.', 'jira', 'systems=gitlab');
routeVector('system-route-two-systems', '/s/mcp-jira/mcp with systems=jira,gitlab is an error.', 'jira', 'systems=jira,gitlab');

// ---------- what the filter leaves visible ----------

const catalog = [
  { name: 'confluence__get_page', risk: 'READ_ONLY' },
  { name: 'confluence__update_page', risk: 'UPDATE' },
  { name: 'gitlab__get_project', risk: 'READ_ONLY' },
  { name: 'gitlab__update_project', risk: 'UPDATE' },
  { name: 'jira__create_issue', risk: 'UPDATE' },
  { name: 'jira__delete_issue', risk: 'DESTRUCTIVE' },
  { name: 'jira__get_issue', risk: 'READ_ONLY' },
];
const applyVector = (name, description, query, tools = catalog) => {
  const { filter, canonical } = parseFilter(query);
  filterOut(`apply-${name}`, { description, kind: 'apply', input: { query, tools },
    expected: { canonical, visible: applyFilter(filter, tools).map((t) => t.name) } });
};
applyVector('no-filter', 'Without a filter the whole set the user may call is visible, in the order of the set.', '');
applyVector('systems', 'systems narrows to the listed systems.', 'systems=jira');
applyVector('unknown-system-skipped', 'An unknown system gives the same answer as leaving it out.', 'systems=jira,nosuchsystem');
applyVector('only-unknown-system', 'Only unknown systems: nothing is visible, and no error says why.', 'systems=nosuchsystem');
applyVector('system-without-access', 'The user may not call anything of confluence: the answer equals that of an unknown system.', 'systems=confluence',
  catalog.filter((t) => !t.name.startsWith('confluence__')));
applyVector('tools', 'tools narrows to the listed tools.', 'tools=jira__get_issue,gitlab__get_project');
applyVector('tools-unknown-tool-skipped', 'An unknown tool is skipped like a tool without access.', 'tools=jira__get_issue,jira__no_such_tool');
applyVector('tools-outside-systems', 'tools narrows and never adds: a tool outside systems is not visible.', 'systems=jira&tools=gitlab__get_project');
applyVector('access-read', 'access=read leaves READ_ONLY tools.', 'access=read');
applyVector('access-write', 'access=write leaves UPDATE and DESTRUCTIVE tools; READ_ONLY ones are not "also" included.', 'access=write');
applyVector('exclude-system', 'exclude with a system removes all its tools.', 'exclude=gitlab');
applyVector('exclude-tool', 'exclude with a tool removes that tool.', 'exclude=jira__delete_issue');
applyVector('exclude-unknown', 'exclude of something that does not exist changes nothing.', 'exclude=nosuchsystem,jira__no_such_tool');
applyVector('combined', 'systems AND access AND NOT exclude.', 'systems=jira,gitlab&access=write&exclude=jira__delete_issue');
applyVector('empty-intersection', 'An empty intersection is an empty list, not an error.', 'systems=jira&access=read&exclude=jira__get_issue');
applyVector('order-of-the-set-not-of-the-filter', 'The order of the list does not depend on the order of the entries in the filter.', 'tools=jira__get_issue,confluence__get_page');
applyVector('risk-changed', 'The filter works on the risk of the approved entry: a tool whose risk was raised to UPDATE leaves access=read.', 'access=read',
  catalog.map((t) => (t.name === 'gitlab__get_project' ? { ...t, risk: 'UPDATE' } : t)));

const withUnknownRisk = [...catalog, { name: 'jira__legacy_tool', risk: 'UNKNOWN' }, { name: 'jira__lowercase_tool', risk: 'read_only' }];
applyVector('access-write-risk-outside-the-set', 'A risk outside READ_ONLY, UPDATE, DESTRUCTIVE is in neither group: access=write does not leave it (fail-closed, CC-186).', 'access=write', withUnknownRisk);
applyVector('access-read-risk-outside-the-set', 'Neither does access=read; without access the tool stays visible.', 'access=read', withUnknownRisk);
applyVector('no-access-risk-outside-the-set', 'Without access nothing depends on the risk.', 'systems=jira', withUnknownRisk);

// ---------- tools/call under a filter ----------

const callVector = (name, description, query, tool, mayCall = catalog) => {
  const { filter, canonical } = parseFilter(query);
  filterOut(`call-${name}`, { description, kind: 'call', input: { query, tool, mayCall: mayCall.map((t) => t.name), tools: mayCall },
    expected: { canonical, ...callDecision(filter, tool, mayCall) } });
};
callVector('visible', 'A tool in the filtered list is called.', 'systems=jira', 'jira__get_issue');
callVector('cut-by-filter', 'The user may call the tool and the filter removes it: not_found_or_denied, audit reason filter_scope.', 'systems=gitlab', 'jira__get_issue');
callVector('cut-by-access', 'access=read removes a write tool the user may call.', 'access=read', 'jira__create_issue');
callVector('cut-by-exclude', 'exclude removes the tool.', 'exclude=jira__delete_issue', 'jira__delete_issue');
callVector('no-grant', 'The user has no right to the tool: the same client answer, the usual audit reason.', '', 'confluence__update_page',
  catalog.filter((t) => t.name !== 'confluence__update_page'));
callVector('no-grant-and-filter', 'No right and a filter that would remove it anyway: not_granted, not filter_scope.', 'systems=jira', 'confluence__update_page',
  catalog.filter((t) => t.name !== 'confluence__update_page'));
callVector('unknown-tool', 'A tool that does not exist.', 'systems=jira', 'jira__no_such_tool');

// ---------- tools/call: filter first, then the state of the tool, the server and the account (CC-178) ----------

const callStateVector = (name, description, query, tool, state, mayCall = catalog) => {
  const { filter, canonical } = parseFilter(query);
  filterOut(`call-state-${name}`, { description, kind: 'call-state', input: { query, tool, mayCall: mayCall.map((t) => t.name), tools: mayCall, state },
    expected: { canonical, ...callDecision(filter, tool, mayCall, state) } });
};
const up = { toolEnabled: true, serverAvailable: true, connected: true };
callStateVector('filter-passes-server-available', 'The filter leaves the tool, everything works: the call goes to the server.', 'systems=jira', 'jira__get_issue', up);
callStateVector('filter-passes-server-unavailable', 'The filter leaves the tool and the server is down: upstream_unavailable.', 'systems=jira', 'jira__get_issue', { ...up, serverAvailable: false });
callStateVector('filter-cuts-server-available', 'The filter removes the tool the user may call: not_found_or_denied, filter_scope.', 'systems=gitlab', 'jira__get_issue', up);
callStateVector('filter-cuts-server-unavailable', 'The filter removes the tool and the server is down: the same answer as with the server up, so the state of the server is not revealed.', 'systems=gitlab', 'jira__get_issue', { ...up, serverAvailable: false });
callStateVector('no-filter-server-unavailable', 'Without a filter a server that is down gives upstream_unavailable, not not_found_or_denied.', '', 'jira__get_issue', { ...up, serverAvailable: false });
callStateVector('tool-disabled', 'A tool that is disabled, pending approval, changed or not served by its server and that the filter leaves: tool_disabled.', '', 'jira__create_issue', { ...up, toolEnabled: false });
callStateVector('tool-disabled-cut-by-filter', 'The same tool under a filter that removes it: filter_scope first.', 'access=read', 'jira__create_issue', { ...up, toolEnabled: false });
callStateVector('not-connected', 'A system without a connection of the account: credential_required (connectUrl is in the body).', '', 'gitlab__get_project', { ...up, connected: false });
callStateVector('not-connected-cut-by-filter', 'The same call under a filter that removes it: not_found_or_denied, filter_scope.', 'systems=jira', 'gitlab__get_project', { ...up, connected: false });
callStateVector('kill-switch-user-with-access', 'A tool switched off by an administrator, the user may call it and the filter leaves it: tool_disabled, audit reason kill_switch (CC-194).', '', 'jira__create_issue', { ...up, killSwitch: true });
callStateVector('kill-switch-user-without-access', 'The same switch, but the user may not call the tool: not_found_or_denied with not_granted, never tool_disabled, which would tell that the tool exists (CC-206, invariant 8).', '', 'jira__create_issue', { ...up, killSwitch: true }, catalog.filter((t) => t.name !== 'jira__create_issue'));
callStateVector('kill-switch-cut-by-filter', 'The same switch under a filter that removes the tool: filter_scope first.', 'access=read', 'jira__create_issue', { ...up, killSwitch: true });
callStateVector('order-disabled-before-unavailable', 'Tool disabled and server down: tool_disabled.', '', 'jira__create_issue', { toolEnabled: false, serverAvailable: false, connected: true });
callStateVector('order-unavailable-before-credential', 'Server down and no connection: upstream_unavailable.', '', 'gitlab__get_project', { toolEnabled: true, serverAvailable: false, connected: false });
callStateVector('order-all-three', 'All three problems: tool_disabled.', '', 'gitlab__get_project', { toolEnabled: false, serverAvailable: false, connected: false });
callStateVector('no-grant-server-unavailable', 'The user has no right to the tool and its server is down: not_found_or_denied, not_granted. mayCall does not depend on availability.', '', 'confluence__update_page', { ...up, serverAvailable: false },
  catalog.filter((t) => t.name !== 'confluence__update_page'));
callStateVector('destructive-cut-keeps-pending-confirmation', 'The filter comes before the confirmation gate: a DESTRUCTIVE call the filter cuts is not_found_or_denied and does not invalidate the confirmation the user has pending.', 'access=read', 'jira__delete_issue',
  { ...up, pendingConfirmation: true });

// ---------- binding to the session (CC-172) ----------

const sessionVector = (name, description, initializeQuery, requestQuery) => {
  const match = sessionMatches(initializeQuery, requestQuery);
  filterOut(`session-${name}`, { description, kind: 'session', input: { initializeQuery, requestQuery },
    expected: match ? { match: true } : { match: false, response: { status: 404, body: 'as for an unknown session' }, auditReason: 'filter_mismatch' } });
};
sessionVector('same-filter', 'The same query.', 'systems=jira&access=read', 'systems=jira&access=read');
sessionVector('same-filter-other-order', 'The same filter spelled differently matches (comparison after normalization).', 'systems=jira,gitlab&access=read', 'ACCESS=read&systems=gitlab,jira,gitlab');
sessionVector('no-filter-twice', 'Neither request has a filter.', '', '');
sessionVector('other-filter', 'Another filter in the same session: 404 and filter_mismatch.', 'systems=jira', 'systems=gitlab');
sessionVector('filter-added', 'A filter where the session has none.', '', 'systems=jira');
sessionVector('filter-removed', 'No filter where the session has one.', 'systems=jira', '');
sessionVector('narrower-filter', 'A narrower filter is a different filter too.', 'systems=jira', 'systems=jira&access=read');

// ---------- order of the checks of a request with a session (CC-184) ----------

const sessionOrderVector = (name, description, input) => {
  filterOut(`session-order-${name}`, { description, kind: 'session-order', input, expected: sessionDecision(input) });
};
const mine = { sub: 'user-a', route: '/mcp', initializeQuery: 'systems=jira' };
sessionOrderVector('syntax-before-session', 'A query that is not a valid filter is 400 whatever the session is; the session is not read, so the answer says nothing about it.',
  { requestQuery: 'system=jira', route: '/mcp', callerSub: 'user-a', session: { ...mine, sub: 'user-b' } });
sessionOrderVector('foreign-session-other-filter', 'A session of another user is a plain 404 as for an unknown session, with no filter_mismatch, even though the filter differs.',
  { requestQuery: 'systems=gitlab', route: '/mcp', callerSub: 'user-a', session: { ...mine, sub: 'user-b' } });
sessionOrderVector('unknown-session', 'An unknown or expired session: the same 404 and no filter_mismatch.',
  { requestQuery: 'systems=gitlab', route: '/mcp', callerSub: 'user-a', session: null });
sessionOrderVector('own-session-other-filter', 'Own session and another filter: 404 and filter_mismatch.',
  { requestQuery: 'systems=gitlab', route: '/mcp', callerSub: 'user-a', session: mine });
sessionOrderVector('own-session-same-filter', 'Own session and the same filter after normalization: the request goes on.',
  { requestQuery: 'SYSTEMS=Jira', route: '/mcp', callerSub: 'user-a', session: mine });
sessionOrderVector('own-session-other-route', 'A session opened on /mcp used on /s/mcp-jira/mcp: 404 and filter_mismatch (the route is part of the address the session is bound to), even though the query equals the stored one.',
  { requestQuery: 'systems=jira', route: '/s/mcp-jira/mcp', callerSub: 'user-a', session: mine });
sessionOrderVector('session-header-with-meta', 'A request with Mcp-Session-Id and _meta is a session request: the binding is checked (here the filter differs). _meta does not switch it off.',
  { requestQuery: 'systems=gitlab', route: '/mcp', callerSub: 'user-a', session: mine, meta: { protocolVersion: '2026-07-28' } });

filterOut('error-response', {
  description: 'Answer to a query that is not a valid filter: 400 in the shape of EndpointFilterError, after the check of the token, with no WWW-Authenticate; it does not depend on the state of any system.',
  kind: 'error-response',
  input: { query: 'system=jira', token: 'valid' },
  expected: {
    status: 400,
    absentHeaders: ['WWW-Authenticate'],
    body: { error: 'invalid_request', reason: 'invalid_filter', message: 'The query of the address is not a valid filter.' },
    audit: { event: 'policy_decision', decision: 'deny', outcome: 'error', reason: 'invalid_filter' },
  },
});
filterOut('error-response-over-transport-limit', {
  description: 'A query longer than the transport accepts (about 15 KB, depends on the deployment) never reaches the filter: 400 or 414 in JSON with error invalid_request and no reason (CC-189). Up to that limit the answer is invalid_filter (see parse-query-513-bytes).',
  kind: 'error-response',
  input: { queryBytes: 20000, token: 'valid', query: `exclude=${'a'.repeat(19992)}` },
  expected: {
    statusOneOf: [400, 414],
    absentHeaders: ['WWW-Authenticate'],
    body: { error: 'invalid_request', message: 'The request is too large.' },
    bodyHasReason: false,
  },
});
filterOut('error-response-without-token', {
  description: 'The token is checked first: without a valid token the answer is the 401 challenge even when the query is wrong, so an unauthenticated caller learns nothing about the syntax.',
  kind: 'error-response',
  input: { query: 'system=jira', token: 'missing' },
  expected: { status: 401, headers: { 'WWW-Authenticate': 'Bearer resource_metadata="https://mcp.aiwcorpo.pl/.well-known/oauth-protected-resource/mcp"' } },
});

// ---------- aggregate endpoint (CC-169, CC-176) ----------

const aggOut = writer('endpoint-aggregate');
const t = (name, risk = 'READ_ONLY', over = {}) => ({ name, risk, approved: true, enabled: true, served: true, definitionMatches: true, allowedByPolicy: true, ...over });
const srv = (serverId, tools, over = {}) => ({ serverId, available: true, hasConnection: true, tools, ...over });

const listVector = (name, description, servers) => {
  aggOut(`list-${name}`, { description, kind: 'list', input: { servers }, expected: { visible: visibleTools(servers).map((x) => x.name) } });
};
listVector('all-systems-sorted', 'Systems are sorted by ServerId and tools by name, whatever order the registry gives them in.', [
  srv('mcp-jira', [t('jira__get_issue'), t('jira__create_issue', 'UPDATE')]),
  srv('mcp-confluence', [t('confluence__get_page')]),
  srv('mcp-gitlab', [t('gitlab__get_project')]),
]);
listVector('server-unavailable-skipped', 'A server that does not answer is left out (upstream_unavailable on a call); the others stay.', [
  srv('mcp-jira', [t('jira__get_issue')]),
  srv('mcp-gitlab', [t('gitlab__get_project')], { available: false }),
]);
listVector('unreadable-list-of-one-server', 'A damaged tools/list of one server does not invalidate the rest.', [
  srv('mcp-jira', [t('jira__get_issue')]),
  srv('mcp-opensearch', [t('opensearch__search_index')], { available: false, listError: 'unreadable' }),
]);
listVector('system-without-connection-keeps-tools', 'A system without a connection of the account keeps its tools; the call answers credential_required with connectUrl.', [
  srv('mcp-jira', [t('jira__get_issue')], { hasConnection: false }),
]);
listVector('denied-by-policy-omitted', 'A tool the policy decision denies for the current token is not listed.', [
  srv('mcp-jira', [t('jira__get_issue'), t('jira__delete_issue', 'DESTRUCTIVE', { allowedByPolicy: false })]),
]);
listVector('pending-approval-hidden', 'A tool waiting for approval is not listed.', [
  srv('mcp-jira', [t('jira__get_issue'), t('jira__create_issue', 'UPDATE', { approved: false })]),
]);
listVector('disabled-hidden', 'A tool disabled by an administrator is not listed.', [
  srv('mcp-jira', [t('jira__get_issue'), t('jira__create_issue', 'UPDATE', { enabled: false })]),
]);
listVector('definition-changed-hidden', 'A tool whose definition at the server differs from the approved one is hidden (tool_disabled on a call).', [
  srv('mcp-jira', [t('jira__get_issue'), t('jira__create_issue', 'UPDATE', { definitionMatches: false })]),
]);
listVector('not-served-hidden', 'An approved tool the server does not serve is hidden (tool_not_served).', [
  srv('mcp-jira', [t('jira__get_issue'), t('jira__create_issue', 'UPDATE', { served: false })]),
]);
listVector('nothing-visible', 'No tools at all: an empty list, no error.', [srv('mcp-jira', [t('jira__get_issue', 'READ_ONLY', { allowedByPolicy: false })])]);


// ---------- availability of a server for one tools/list (CC-180) ----------

const availabilityVector = (name, description, read, timeoutMs) => {
  const input = timeoutMs === undefined ? { read } : { read, timeoutMs };
  aggOut(`availability-${name}`, { description, kind: 'availability', input, expected: { available: serverAvailable(read, timeoutMs) } });
};
availabilityVector('answers-in-time', 'A valid answer within the default timeout of 3000 ms.', { outcome: 'ok', elapsedMs: 120 });
availabilityVector('answers-at-the-limit', 'An answer at exactly the timeout is in time.', { outcome: 'ok', elapsedMs: 3000 });
availabilityVector('answers-too-late', 'An answer after the timeout: the server is skipped as unavailable, whatever it said.', { outcome: 'ok', elapsedMs: 3001 });
availabilityVector('configured-timeout', 'The timeout is configurable: 500 ms here.', { outcome: 'ok', elapsedMs: 800 }, 500);
availabilityVector('connection-error', 'A connection or TLS error, or a status other than 200.', { outcome: 'error', elapsedMs: 40 });
availabilityVector('invalid-result', 'A body that is not a result of tools/list or does not match its schema.', { outcome: 'invalid', elapsedMs: 40 });
availabilityVector('read-from-cache', 'A read inside the TTL of the cache needs no call, so the timeout does not apply.', { outcome: 'cached' });
listVector('slow-server-skipped', 'A server that did not answer in time is skipped like an unavailable one; the others are listed and the list does not wait for it.', [
  srv('mcp-jira', [t('jira__get_issue')]),
  srv('mcp-gitlab', [t('gitlab__get_project')], { available: serverAvailable({ outcome: 'ok', elapsedMs: 3500 }), readOutcome: { outcome: 'ok', elapsedMs: 3500 } }),
]);

// ---------- pages of tools/list and the cursor (CC-181) ----------

const named = (...names) => names.map((name) => ({ name, risk: 'READ_ONLY' }));
const pageVector = (name, description, tools, afterName, pageSize) => {
  const input = pageSize === undefined ? { tools, afterName } : { tools, afterName, pageSize };
  aggOut(`page-${name}`, { description, kind: 'page', input, expected: page(tools, afterName, pageSize) });
};
const seven = named('confluence__get_page', 'gitlab__get_project', 'gitlab__update_project', 'jira__create_issue', 'jira__delete_issue', 'jira__get_issue', 'jira__search_issues');
pageVector('first', 'The first page has no cursor in the request; more follow, so the answer has nextCursor.', seven, null, 3);
pageVector('middle', 'The cursor names the last tool of the previous page.', seven, 'gitlab__update_project', 3);
pageVector('last', 'The last page has no nextCursor.', seven, 'jira__delete_issue', 3);
pageVector('exact-multiple', 'A list that is a multiple of the page size ends on a page without nextCursor.', seven.slice(0, 6), null, 3);
pageVector('exact-multiple-second', 'The second page of the same list.', seven.slice(0, 6), 'gitlab__update_project', 3);
pageVector('empty', 'An empty list is one page, no error and no cursor.', [], null, 3);
pageVector('tool-removed-between-pages', 'The tool the cursor names is gone: the next page still starts after its position, nothing is repeated and nothing that stays is skipped.',
  seven.filter((x) => x.name !== 'gitlab__update_project'), 'gitlab__update_project', 3);
pageVector('order-is-by-server-id', 'The order is that of CC-169 (ServerId, then tool name), not plain sorting of the qualified names: system a sorts before a1 although "a1__x" < "a__x".',
  named('a1__x', 'a__x', 'a__y', 'b__x'), 'a__x', 2);
const bigList = Array.from({ length: 150 }, (_, i) => ({ name: `s${String(Math.floor(i / 10)).padStart(2, '0')}__tool_${String(i % 10).padStart(2, '0')}`, risk: 'READ_ONLY' }));
pageVector('default-page-size-first', `The default page size is ${PAGE_SIZE}.`, bigList, null);
pageVector('default-page-size-second', 'The second page has the remaining 50 tools.', bigList, bigList[PAGE_SIZE - 1].name);

const IAT = Date.parse('2026-10-31T10:00:00Z') / 1000;
const cursorVector = (name, description, issuedFor, presentedBy, { mutation = 'none', afterSeconds = 60 } = {}) => {
  let cursor = issueCursor({ sub: issuedFor.sub, canonicalFilter: parseFilter(issuedFor.query).canonical, afterName: 'jira__get_issue', iat: IAT });
  if (mutation === 'tampered') cursor = `${cursor.slice(0, -2)}${cursor.endsWith('AA') ? 'BB' : 'AA'}`;
  if (mutation === 'malformed') cursor = 'not-a-cursor';
  if (mutation === 'not-a-string') cursor = 42;
  if (mutation === 'empty-string') cursor = '';
  if (mutation === 'null') cursor = null;
  const result = readCursor(cursor, { sub: presentedBy.sub, canonicalFilter: parseFilter(presentedBy.query).canonical, now: IAT + afterSeconds });
  aggOut(`cursor-${name}`, { description: `${description} Key: test only, NOT FOR PRODUCTION.`, kind: 'cursor', input: { issuedFor, presentedBy, mutation, afterSeconds },
    expected: result.error ? { valid: false, error: result.error } : { valid: true } });
};
const owner = { sub: 'user-a', query: 'systems=jira&access=read' };
cursorVector('same-user-same-filter', 'A cursor given back by the user it was issued to, with the same filter, a minute later.', owner, owner);
cursorVector('valid-at-lifetime-limit', 'Exactly 15 minutes after issue.', owner, owner, { afterSeconds: 900 });
cursorVector('expired', 'One second after the lifetime.', owner, owner, { afterSeconds: 901 });
cursorVector('same-filter-other-spelling', 'The filter is compared after normalization.', owner, { sub: 'user-a', query: 'ACCESS=read&systems=jira' });
cursorVector('other-user', 'A cursor of another user: the same -32602 as for garbage, no hint why.', owner, { sub: 'user-b', query: 'systems=jira&access=read' });
cursorVector('other-filter', 'A cursor used with another filter.', owner, { sub: 'user-a', query: 'systems=jira' });
cursorVector('filter-removed', 'A cursor issued under a filter and used without one.', owner, { sub: 'user-a', query: '' });
cursorVector('tampered', 'A cursor that was changed.', owner, owner, { mutation: 'tampered' });
cursorVector('malformed', 'A string that never was a cursor.', owner, owner, { mutation: 'malformed' });
cursorVector('not-a-string', 'A cursor that is not a string.', owner, owner, { mutation: 'not-a-string' });
cursorVector('null', 'A null cursor is not a string either: -32602 like any cursor that does not verify (CC-225). The first page is a request without the field.', owner, owner, { mutation: 'null' });
cursorVector('empty-string', 'An empty string is a cursor that does not verify, not the first page: the same -32602 (CC-200). The first page is a request without the field.', owner, owner, { mutation: 'empty-string' });

// ---------- audit of repeatable refusals (CC-190, CC-191) ----------

const throttleVector = (name, description, events, options) => {
  const input = options === undefined ? { events } : { events, ...options };
  aggOut(`audit-throttle-${name}`, { description, kind: 'audit-throttle', input, expected: auditThrottle(events, options) });
};
const ev = (t, reason, target, sub = 'user-a') => ({ t, sub, reason, target });
throttleVector('flood-of-one-target', 'A client that repeats the same bad filter: one event in the first 10 seconds, every request is refused, the rest counted and summed up when the window closes.',
  [0, 1, 2, 5, 9.9].map((t) => ev(t, 'invalid_filter', 'q:3f9a')));
throttleVector('next-interval', 'After the interval a new event is due.', [0, 9, 10, 12].map((t) => ev(t, 'invalid_filter', 'q:3f9a')));
throttleVector('other-tool-is-not-silenced', 'A decoy tools/call on one tool does not hide a call of another tool: the budget is per tool.', [
  ev(0, 'not_granted', 'jira__delete_issue'), ev(1, 'not_granted', 'jira__delete_issue'), ev(2, 'not_granted', 'gitlab__delete_project'), ev(3, 'not_granted', 'gitlab__delete_project')]);
throttleVector('other-filter-is-not-silenced', 'Two different bad filters of one user are two targets.', [
  ev(0, 'invalid_filter', 'q:aaaa'), ev(1, 'invalid_filter', 'q:bbbb'), ev(2, 'invalid_filter', 'q:aaaa')]);
throttleVector('per-reason', 'The budget is per reason: another reason of the same user is audited at once.', [
  ev(0, 'invalid_filter', 'q:3f9a'), ev(1, 'filter_mismatch', 'f:7c01'), ev(2, 'invalid_cursor', 'c:91ee'), ev(3, 'filter_mismatch', 'f:7c01')]);
throttleVector('per-user', 'The budget is per user: another user is not silenced by the first one.', [
  ev(0, 'invalid_filter', 'q:3f9a'), ev(1, 'invalid_filter', 'q:3f9a', 'user-b'), ev(2, 'invalid_filter', 'q:3f9a')]);
throttleVector('filter-scope-per-tool', 'filter_scope is throttled per tool like not_granted.', [
  ev(0, 'filter_scope', 'jira__get_issue'), ev(1, 'filter_scope', 'jira__get_issue'), ev(2, 'filter_scope', 'jira__create_issue')]);
throttleVector('number-of-keys-is-limited', 'A user who invents a new target on every request does not make the number of keys unbounded: over the limit (3 here) new targets share one key and are audited once per interval together.', [
  ev(0, 'not_granted', 'a__t1'), ev(1, 'not_granted', 'a__t2'), ev(2, 'not_granted', 'a__t3'), ev(3, 'not_granted', 'a__t4'), ev(4, 'not_granted', 'a__t5'), ev(5, 'not_granted', 'a__t6')],
  { maxTargetsPerSub: 3 });
throttleVector('keys-limited-per-reason', 'The bound on keys is per user and reason (CC-195): a user who used up the budget of invalid_filter keys (2 here) still gets the event for a new tool refusal at once.', [
  ev(0, 'invalid_filter', 'q:aaaa'), ev(1, 'invalid_filter', 'q:bbbb'), ev(2, 'invalid_filter', 'q:cccc'), ev(3, 'not_granted', 'jira__delete_issue')],
  { maxTargetsPerSub: 2 });
throttleVector('summary-after-the-interval', 'The summary event per (user, reason) carries the number of events left out in the window, whatever their targets.', [
  ev(0, 'not_granted', 'jira__delete_issue'), ev(1, 'not_granted', 'jira__delete_issue'), ev(2, 'not_granted', 'jira__delete_issue'), ev(3, 'not_granted', 'gitlab__delete_project'), ev(4, 'not_granted', 'gitlab__delete_project')]);
throttleVector('no-summary-without-suppressed', 'Nothing was left out: no summary.', [ev(0, 'invalid_cursor', 'c:91ee'), ev(30, 'invalid_cursor', 'c:91ee')]);
throttleVector('configured-interval', 'The interval is configurable: 60 seconds here.', [0, 30, 59, 60].map((t) => ev(t, 'invalid_cursor', 'c:91ee')), { intervalSeconds: 60 });

const routeVectorAgg = (name, description, toolName) => {
  aggOut(`routing-${name}`, { description, kind: 'routing', input: { name: toolName, knownSystems: ['jira', 'confluence', 'gitlab', 'servicedesk', 'opensearch'] },
    expected: routeCall(toolName, ['jira', 'confluence', 'gitlab', 'servicedesk', 'opensearch']) });
};
routeVectorAgg('by-prefix', 'tools/call goes to mcp-<system> by the prefix of the name.', 'gitlab__get_project');
routeVectorAgg('unknown-prefix', 'A prefix that is no system.', 'nosuch__get_project');
routeVectorAgg('no-separator', 'A name without the separator.', 'get_project');
routeVectorAgg('empty-tool', 'A prefix and no tool.', 'jira__');

const changedVector = (name, description, query, before, after) => {
  const { filter } = parseFilter(query);
  aggOut(`list-changed-${name}`, { description, kind: 'list-changed', input: { query, before, after }, expected: { notify: listChangedNotification(filter, before, after) } });
};
const jiraRead = { name: 'jira__get_issue', risk: 'READ_ONLY' };
const jiraUpdate = { name: 'jira__create_issue', risk: 'UPDATE' };
const gitlabRead = { name: 'gitlab__get_project', risk: 'READ_ONLY' };
changedVector('definition-approved', 'definition_approved: a new tool appears in the list of the session.', '', [jiraRead], [jiraRead, jiraUpdate]);
changedVector('definition-approved-outside-filter', 'The same event, but the filter of the session cuts the tool: no notification.', 'systems=gitlab', [gitlabRead], [gitlabRead, jiraUpdate]);
changedVector('definition-changed-and-approved', 'A new definition of a tool that stays in the list (same name and risk, other definitionHash): the result of tools/list changed.', '',
  [{ ...jiraRead, definitionHash: 'sha256:aaaa' }], [{ ...jiraRead, definitionHash: 'sha256:bbbb' }]);
changedVector('tool-disabled', 'tool_disabled: the tool leaves the list.', '', [jiraRead, jiraUpdate], [jiraRead]);
changedVector('tool-removed', 'tool_removed: the tool leaves the registry.', 'systems=jira', [jiraRead, jiraUpdate], [jiraRead]);
changedVector('risk-lowered-by-admin', 'risk_lowered_by_admin: a tool that access=read cut becomes READ_ONLY and enters the list.', 'access=read', [jiraRead], [jiraRead, { ...jiraUpdate, risk: 'READ_ONLY' }]);
changedVector('groups-changed', 'The groups of the user changed: tools leave the list.', '', [jiraRead, gitlabRead], [jiraRead]);
changedVector('policy-revision-without-effect', 'A new policy revision that changes nothing for this session: no notification.', '', [jiraRead, jiraUpdate], [jiraRead, jiraUpdate]);
changedVector('server-becomes-unavailable', 'A server leaves the list as unavailable.', '', [jiraRead, gitlabRead], [jiraRead]);
changedVector('server-becomes-available', 'A server comes back.', '', [jiraRead], [jiraRead, gitlabRead]);
changedVector('connection-changed', 'The account connected a system: the list is the same, only the result of a call changes (credential_required -> ok). No notification (CC-176).', '', [jiraRead, gitlabRead], [jiraRead, gitlabRead]);
aggOut('legacy-link-route-gone', {
  description: 'The route of saved links no longer exists (CC-177): 404 not_found_or_denied in the usual shape, no audit event, whatever the token.',
  kind: 'legacy-route',
  input: { method: 'POST', path: '/v/team-a-dev/mcp', token: 'valid' },
  expected: {
    status: 404,
    body: { error: 'not_found_or_denied', message: 'The resource does not exist or you do not have access to it.' },
    audit: null,
  },
});
// ---------- GET /api/v1/me/mcp-endpoint (CC-175) ----------

const endpointOut = writer('mcp-endpoint');
const PUBLIC_BASE_URL = 'https://mcp.aiwcorpo.pl';
const userCatalog = [
  { name: 'confluence__get_page', risk: 'READ_ONLY', access: 'granted', disabled: false },
  { name: 'gitlab__get_project', risk: 'READ_ONLY', access: 'granted', disabled: false },
  { name: 'gitlab__update_project', risk: 'UPDATE', access: 'denied', disabled: false },
  { name: 'jira__create_issue', risk: 'UPDATE', access: 'granted', disabled: false },
  { name: 'jira__delete_issue', risk: 'DESTRUCTIVE', access: 'denied', disabled: false },
  { name: 'jira__get_issue', risk: 'READ_ONLY', access: 'granted', disabled: false },
  { name: 'jira__search_issues', risk: 'READ_ONLY', access: 'granted', disabled: true },
];
// rawQuery is what the BFF composes from the decoded values of the four typed parameters (CC-182); httpQuery, when given,
// is the query as the client sent it, before the HTTP layer decoded it.
const endpointVector = (name, description, rawQuery, catalog = userCatalog, httpQuery) => {
  endpointOut(name, { description, input: { publicBaseUrl: PUBLIC_BASE_URL, ...(httpQuery !== undefined && { httpQuery }), rawQuery, catalog },
    expected: mcpEndpoint({ publicBaseUrl: PUBLIC_BASE_URL, rawQuery, catalog }) });
};
const fromHttp = (name, description, httpQuery) => endpointVector(name, description, composeQuery(new URLSearchParams(httpQuery)), userCatalog, httpQuery);
endpointVector('no-filter', 'No filter: the address is /mcp, there is no filter field, and every granted, enabled tool is counted.', '');
endpointVector('system-and-access', 'The address carries the canonical filter; denied and disabled tools are not counted.', 'access=read&systems=jira');
endpointVector('write-only', 'access=write counts UPDATE and DESTRUCTIVE tools the user is granted.', 'access=write');
endpointVector('exclude-tool', 'exclude removes one tool from the count.', 'exclude=jira__create_issue');
endpointVector('upper-case-is-normalized', 'The answer uses the canonical form, not the spelling of the request.', 'Systems=GitLab,Jira');
endpointVector('unknown-system-is-not-an-error', 'A system that does not exist is no error and not a hint: the count is 0.', 'systems=nosuchsystem');
endpointVector('empty-catalog', 'A user who is granted nothing gets a count of 0 and a valid address.', 'systems=jira', userCatalog.map((t) => ({ ...t, access: 'denied' })));
endpointVector('invalid-unknown-parameter', 'A parameter outside the four is an invalid filter.', 'system=jira');
endpointVector('invalid-access', 'access takes read or write.', 'access=all');
endpointVector('invalid-repeated-parameter', 'A parameter given twice.', 'systems=jira&systems=gitlab');
endpointVector('invalid-percent-encoding', 'A decoded value that still has a percent sign (the client sent %252c, or the BFF got a raw %2c from a caller that bypassed the HTTP layer) is an invalid filter, as on the gateway.', 'systems=jira%2cgitlab');
fromHttp('http-encoded-comma-is-decoded-first', 'The generated client sends a comma as %2C. The HTTP layer decodes it before the BFF sees the value, so this is the filter systems=gitlab,jira and not an error.', 'systems=jira%2Cgitlab');
fromHttp('http-double-encoded-comma', 'A comma encoded twice (%252C) decodes once to %2C, a value with a percent sign: invalid filter.', 'systems=jira%252Cgitlab');
fromHttp('http-ampersand-in-value', 'An encoded ampersand inside a value must not add a parameter: systems=jira%26access=read is one invalid value, not the filter systems=jira&access=read.', 'systems=jira%26access=read');
fromHttp('http-plus-is-a-space', 'A plus sign in a query decodes to a space, which is not in the alphabet of the filter.', 'systems=jira+gitlab');
fromHttp('http-broken-escape', 'A percent sign that is no escape (%zz) is an invalid filter like any decoded percent sign (CC-202); the container does not reject the request and the BFF does not answer 500.', 'systems=%zz');
fromHttp('http-lone-percent', 'A percent sign at the end, with no digits after it.', 'systems=jira%');
fromHttp('http-half-escape', 'One digit after the percent sign.', 'systems=jira%4');

// ---------- metadata document of the protected resource (CC-171, CC-187) ----------

const oauthOut = writer('oauth-metadata');
const metadataVector = (name, description, requestPath, requestQuery = '') => {
  oauthOut(name, { description, input: { publicBaseUrl: PUBLIC_BASE_URL, requestPath, requestQuery }, expected: protectedResourceMetadata({ publicBaseUrl: PUBLIC_BASE_URL, requestPath }) });
};
metadataVector('aggregate-endpoint', 'The document for /mcp: resource is the address without a query.', '/.well-known/oauth-protected-resource/mcp');
metadataVector('aggregate-endpoint-query-ignored', 'A request for the document with the filter of the address gets the same document: the query is ignored and resource has none (V2).', '/.well-known/oauth-protected-resource/mcp', 'systems=jira&access=read');
metadataVector('aggregate-endpoint-invalid-query-ignored', 'Even a query that is not a valid filter does not change the document: this route does not read it.', '/.well-known/oauth-protected-resource/mcp', 'system=jira');
metadataVector('system-route', 'The document for one system: resource is the route of that system.', '/.well-known/oauth-protected-resource/s/mcp-jira/mcp');
metadataVector('saved-link-route-gone', 'There is no document for /v/ (CC-177): the usual 404.', '/.well-known/oauth-protected-resource/v/team-a-dev/mcp');
metadataVector('unknown-route', 'A route the gateway does not serve.', '/.well-known/oauth-protected-resource/f/systems=jira/mcp');

// ---------- list_changed (CC-192) ----------

const sequenceVector = (name, description, query, snapshots) => {
  const { filter } = parseFilter(query);
  aggOut(`list-changed-sequence-${name}`, { description, kind: 'list-changed-sequence', input: { query, snapshots, windowSeconds: 1 }, expected: { notifyAt: listChangedSequence(filter, snapshots) } });
};
sequenceVector('one-change', 'One change after the stream was opened: one notification, at the time of the change.', '', [{ t: 0, tools: [jiraRead] }, { t: 7, tools: [jiraRead, jiraUpdate] }]);
sequenceVector('no-change', 'Events that leave the list as it was send nothing.', '', [{ t: 0, tools: [jiraRead] }, { t: 3, tools: [jiraRead] }, { t: 9, tools: [jiraRead] }]);
sequenceVector('burst-is-coalesced', 'Three changes within one second: the first is sent at once, the other two as one notification when the second ends.', '', [
  { t: 0, tools: [jiraRead] }, { t: 10, tools: [jiraRead, jiraUpdate] }, { t: 10.3, tools: [jiraRead] }, { t: 10.6, tools: [jiraRead, gitlabRead] }]);
sequenceVector('changes-apart', 'Changes more than a second apart are two notifications.', '', [
  { t: 0, tools: [jiraRead] }, { t: 5, tools: [jiraRead, jiraUpdate] }, { t: 8, tools: [jiraRead] }]);
sequenceVector('change-back-inside-window', 'A change that is undone inside the window is still sent once: the client fetches the list and sees the truth.', '', [
  { t: 0, tools: [jiraRead] }, { t: 10, tools: [jiraRead, jiraUpdate] }, { t: 10.2, tools: [jiraRead] }, { t: 10.4, tools: [jiraRead, jiraUpdate] }, { t: 10.5, tools: [jiraRead] }]);
sequenceVector('outside-filter', 'A change the filter of the session cuts is not a notification, whatever the number of events.', 'systems=gitlab', [
  { t: 0, tools: [gitlabRead] }, { t: 4, tools: [gitlabRead, jiraUpdate] }, { t: 4.2, tools: [gitlabRead] }]);
sequenceVector('connection-change-is-silent', 'The account connected a system: the list is the same, so nothing is sent (CC-176).', '', [{ t: 0, tools: [jiraRead, gitlabRead] }, { t: 20, tools: [jiraRead, gitlabRead] }]);

const statelessVector = (name, description, query, input) => {
  const { filter } = parseFilter(query);
  aggOut(`list-changed-stateless-${name}`, { description, kind: 'list-changed-stateless', input: { query, ...input }, expected: { notifyAt: listChangedStateless(filter, input) } });
};
statelessVector('compared-with-the-list-at-open', 'Stateless variant (CC-207): the reference is the list at the time subscriptions/listen was opened; a change after it is announced.', '', {
  openedWith: [jiraRead], changes: [{ t: 6, tools: [jiraRead, jiraUpdate] }] });
statelessVector('tools-list-read-elsewhere-is-not-a-reference', 'A tools/list answered meanwhile (here with the new tool, perhaps by another instance) is not a reference: the change is still announced, because the stream compares with the list at the opening (CC-207).', '', {
  openedWith: [jiraRead], lastToolsListRead: [jiraRead, jiraUpdate], changes: [{ t: 6, tools: [jiraRead, jiraUpdate] }] });
statelessVector('no-change-since-opening', 'Events that leave the list as it was at the opening send nothing, whatever tools/list returned in between.', '', {
  openedWith: [jiraRead, jiraUpdate], lastToolsListRead: [jiraRead], changes: [{ t: 6, tools: [jiraRead, jiraUpdate] }] });
statelessVector('outside-filter', 'The filter of the subscriptions/listen request cuts the changed tool: nothing is sent.', 'systems=gitlab', {
  openedWith: [gitlabRead], changes: [{ t: 3, tools: [gitlabRead, jiraUpdate] }] });
const streamVector = (name, description, input) => {
  filterOut(`stream-open-${name}`, { description, kind: 'stream-open', input, expected: streamOpenDecision(input) });
};
const own = { sub: 'user-a', route: '/mcp', initializeQuery: 'systems=jira' };
streamVector('without-session', 'GET without Mcp-Session-Id is 405 with Allow (the stateless variant uses subscriptions/listen).', { sessionId: null, accept: 'text/event-stream', requestQuery: 'systems=jira', route: '/mcp', callerSub: 'user-a', session: null });
streamVector('without-event-stream-accept', 'GET that does not accept text/event-stream is 405.', { sessionId: 'sess-1', accept: 'application/json', requestQuery: 'systems=jira', route: '/mcp', callerSub: 'user-a', session: own });
streamVector('own-session-same-filter', 'A stream of the own session with the same filter after normalization is opened.', { sessionId: 'sess-1', accept: 'text/event-stream', requestQuery: 'SYSTEMS=jira', route: '/mcp', callerSub: 'user-a', session: own });
streamVector('own-session-other-filter', 'Another filter than the one of initialize: 404 and filter_mismatch, as for a POST (CC-184).', { sessionId: 'sess-1', accept: 'text/event-stream', requestQuery: 'systems=gitlab', route: '/mcp', callerSub: 'user-a', session: own });
streamVector('foreign-session', 'A session of another user: 404 as for an unknown session, no filter_mismatch.', { sessionId: 'sess-1', accept: 'text/event-stream', requestQuery: 'systems=gitlab', route: '/mcp', callerSub: 'user-a', session: { ...own, sub: 'user-b' } });
streamVector('other-route', 'A session opened on /mcp used on /s/mcp-jira/mcp: 404 and filter_mismatch.', { sessionId: 'sess-1', accept: 'text/event-stream', requestQuery: 'systems=jira', route: '/s/mcp-jira/mcp', callerSub: 'user-a', session: own });
streamVector('stateless-valid-filter', 'The stateless variant opens its stream with subscriptions/listen: no session, the stream is bound to the filter of that request (CC-206).', { variant: 'stateless', accept: 'text/event-stream', requestQuery: 'systems=jira' });
streamVector('stateless-invalid-filter', 'A bad filter in subscriptions/listen is 400 invalid_filter, as everywhere; there is no session and no filter_mismatch.', { variant: 'stateless', accept: 'text/event-stream', requestQuery: 'system=jira' });
streamVector('invalid-filter-syntax', 'A bad query is 400 invalid_filter before the session is read.', { sessionId: 'sess-1', accept: 'text/event-stream', requestQuery: 'system=jira', route: '/mcp', callerSub: 'user-a', session: own });

// ---------- emergency switch (CC-194) ----------

const switchOut = writer('kill-switch');
const switchVectorFull = (name, description, input) => switchOut(name, { description, input, expected: killSwitchDecision(input) });
const switchVector = (name, description, input) => {
  switchOut(name, { description, input, expected: killSwitchDecision(input) });
};
const jiraTool = { scope: 'tool', serverId: 'mcp-jira', tool: 'update_issue' };
const gitlabServer = { scope: 'server', serverId: 'mcp-gitlab' };
switchVector('call-switched-tool', 'A call of a tool that is switched off is refused as tool_disabled, audited as kill_switch.', { switches: [jiraTool], tool: 'jira__update_issue', event: 'call' });
switchVector('call-other-tool-of-the-server', 'Another tool of the same server is not affected by a tool switch.', { switches: [jiraTool], tool: 'jira__get_issue', event: 'call' });
switchVector('call-tool-of-switched-server', 'A switch of a server refuses every tool of that server.', { switches: [gitlabServer], tool: 'gitlab__get_project', event: 'call' });
switchVector('call-other-server', 'A switch of one server leaves the others alone.', { switches: [gitlabServer], tool: 'jira__get_issue', event: 'call' });
switchVector('call-without-switches', 'No switch: the call goes on to the next checks.', { switches: [], tool: 'jira__update_issue', event: 'call' });
switchVector('list-hides-switched-tool', 'A switched tool is absent from tools/list.', { switches: [jiraTool], tool: 'jira__update_issue', event: 'list' });
switchVector('list-keeps-other-tools', 'The other tools stay in the list.', { switches: [jiraTool], tool: 'jira__get_issue', event: 'list' });
switchVector('confirm-pending-call-of-switched-tool', 'A pending DESTRUCTIVE call whose tool was switched off fails at the confirmation: the gate is checked again before it runs.', { switches: [jiraTool], tool: 'jira__update_issue', event: 'confirm' });
switchVector('store-unreadable-call', 'A gateway that cannot read the switches refuses the call (fail-closed).', { switches: [], tool: 'jira__get_issue', event: 'call', storeReadable: false });
switchVector('store-unreadable-list', 'and lists nothing.', { switches: [], tool: 'jira__get_issue', event: 'list', storeReadable: false });
switchVector('store-unreadable-catalog', 'The catalog of C5 cannot be computed without the state of the switches: 503 upstream_unavailable with Retry-After, not a catalog (CC-224).', { switches: [], tool: 'jira__get_issue', event: 'catalog', storeReadable: false });
switchVector('approval-does-not-lift', 'An approval of a pending definition leaves the switch on.', { switches: [jiraTool], tool: 'jira__update_issue', event: 'approve' });
switchVector('registration-does-not-lift', 'A new PUT of the manifest leaves the switch on.', { switches: [jiraTool, gitlabServer], tool: 'jira__update_issue', event: 'register' });
switchVector('lift-tool-keeps-server-switch', 'Lifting the switch of a tool does not lift the switch of its server.', { switches: [{ scope: 'tool', serverId: 'mcp-gitlab', tool: 'get_project' }, gitlabServer], tool: 'gitlab__get_project', event: 'lift-tool' });
switchVectorFull('call-user-without-access', 'A user who may not call a switched tool gets not_found_or_denied with not_granted: the switch is looked at only after authorization (CC-206).', { switches: [jiraTool], tool: 'jira__update_issue', event: 'call', mayCall: false });
switchVectorFull('call-outside-filter', 'A switched tool the filter of the address leaves out: not_found_or_denied with filter_scope.', { switches: [jiraTool], tool: 'jira__update_issue', event: 'call', inFilter: false });
switchVectorFull('lift-switch-of-removed-tool', 'A switch belongs to the address, not to the manifest: the switch of a tool that left the manifest can be lifted (204) like any other (CC-206).', { switches: [{ scope: 'tool', serverId: 'mcp-jira', tool: 'removed_tool' }], tool: 'jira__removed_tool', event: 'lift-tool' });
switchVector('lift-server', 'Lifting the switch of a server leaves the switches of single tools.', { switches: [jiraTool, { scope: 'server', serverId: 'mcp-jira' }], tool: 'jira__update_issue', event: 'lift-server' });

// Resources, prompts and agents (CC-265, CC-266).
const primitiveSwitch = (name, description, input) => switchOut(name, { description, kind: 'primitive-switch', input, expected: primitiveSwitchDecision(input) });
const ticketResource = { scope: 'resource', serverId: 'mcp-servicedesk', resource: 'ticket' };
const summaryPrompt = { scope: 'prompt', serverId: 'mcp-servicedesk', prompt: 'summarize_ticket' };
const ticketTarget = { kind: 'resource', serverId: 'mcp-servicedesk', name: 'ticket' };
const promptTarget = { kind: 'prompt', serverId: 'mcp-servicedesk', name: 'summarize_ticket' };
primitiveSwitch('resource-read-switched', 'A read of a resource that is switched off is -32602 like every other refusal (CC-259), audited as kill_switch.', { switches: [ticketResource], target: ticketTarget, event: 'read' });
primitiveSwitch('resource-read-other-resource', 'The switch of one resource leaves the others alone.', { switches: [ticketResource], target: { ...ticketTarget, name: 'howto' }, event: 'read' });
primitiveSwitch('resource-read-server-switch', 'The switch of the whole server hides its resources too.', { switches: [{ scope: 'server', serverId: 'mcp-servicedesk' }], target: ticketTarget, event: 'read' });
primitiveSwitch('resource-read-user-without-access', 'A user who may not read the resource gets not_granted, never kill_switch: the switch is looked at after authorization.', { switches: [ticketResource], target: ticketTarget, event: 'read', mayAccess: false });
primitiveSwitch('resource-read-outside-filter', 'A switched resource that the filter of the address leaves out: filter_scope.', { switches: [ticketResource], target: ticketTarget, event: 'read', inFilter: false });
primitiveSwitch('resource-read-store-unreadable', 'An unreadable store of switches is -32603 upstream_unavailable, not -32602 (fail-closed).', { switches: [], target: ticketTarget, event: 'read', storeReadable: false });
primitiveSwitch('resource-list-hides-switched', 'A switched resource is absent from resources/list.', { switches: [ticketResource], target: ticketTarget, event: 'list' });
primitiveSwitch('resource-lift', 'Lifting the switch of a resource leaves the switch of its server and of the prompts.', { switches: [ticketResource, summaryPrompt, { scope: 'server', serverId: 'mcp-servicedesk' }], target: ticketTarget, event: 'lift' });
primitiveSwitch('prompt-get-switched', 'prompts/get of a switched prompt is -32602, audited as kill_switch.', { switches: [summaryPrompt], target: promptTarget, event: 'read' });
primitiveSwitch('prompt-get-store-unreadable', 'An unreadable store of switches is -32603 for prompts/get too.', { switches: [], target: promptTarget, event: 'read', storeReadable: false });
primitiveSwitch('prompt-list-hides-switched', 'A switched prompt is absent from prompts/list.', { switches: [summaryPrompt], target: promptTarget, event: 'list' });
primitiveSwitch('prompt-resource-switch-does-not-hide-prompt', 'A switch of a resource named like a prompt does not touch the prompt: the scopes are separate.', { switches: [{ scope: 'resource', serverId: 'mcp-servicedesk', resource: 'summarize_ticket' }], target: promptTarget, event: 'list' });
const agentSwitch = (name, description, input) => switchOut(name, { description, kind: 'agent-switch', input, expected: agentSwitchDecision(input) });
agentSwitch('agent-owner-sets', 'The owner of an agent suspends it without the administrator group; the policy data are raised and pushed.', { event: 'put', callerSub: 'owner-1', isAdmin: false, ownerSub: 'owner-1' });
agentSwitch('agent-owner-cannot-lift', 'The owner cannot lift the suspension, also with a fresh MFA.', { event: 'lift', callerSub: 'owner-1', isAdmin: false, freshMfa: true, ownerSub: 'owner-1' });
agentSwitch('agent-foreign-agent-is-404', 'The agent of another person does not exist for a caller without the group.', { event: 'put', callerSub: 'someone-else', isAdmin: false, ownerSub: 'owner-1' });
agentSwitch('agent-admin-lifts', 'An administrator with a fresh MFA lifts the suspension of an agent they do not own.', { event: 'lift', callerSub: 'admin-1', isAdmin: true, freshMfa: true, ownerSub: 'owner-1' });
agentSwitch('agent-lift-without-fresh-mfa', 'Lifting without a fresh MFA is 401 step_up_required, checked first.', { event: 'lift', callerSub: 'admin-1', isAdmin: true, freshMfa: false, ownerSub: 'owner-1' });

// ---------- manifests pulled from servers, also behind an adapter (CC-193, CC-206, CC-249) ----------

const adapterOut = writer('adapter-registry');
const adapterVector = (name, description, input) => adapterOut(name, { description, input, expected: manifestPullDecision(input) });
const toolsAfter = [{ name: 'get_issue', risk: 'READ_ONLY', state: 'new' }, { name: 'update_issue', risk: 'UPDATE', state: 'changed' }, { name: 'list_projects', risk: 'READ_ONLY', state: 'unchanged' }];
adapterVector('adapter-pull', 'The gateway pulls the manifest of an adapter: every new or changed tool is pending, with source adapter, a tool that looks like a read included. Nothing is approved by a pull.',
  { serverMode: 'adapter', manifestSource: 'adapter', tools: toolsAfter });
adapterVector('adapter-removed-tool-loses-classification', 'A tool missing from the manifest of an adapter is removed together with its classification; if it returns it is new and unclassified (CC-207).',
  { serverMode: 'adapter', manifestSource: 'adapter', tools: [{ name: 'get_issue', risk: 'READ_ONLY', state: 'unchanged' }, { name: 'update_issue', risk: 'UPDATE', state: 'removed' }] });
adapterVector('add-derives-adapter-mode', 'A server is added and its first manifest has source adapter: the registry stores adapter true (the flag is derived from the manifest at that moment and fixed afterwards), and every tool is pending.',
  { serverMode: null, manifestSource: 'adapter', tools: [{ name: 'get_issue', risk: 'READ_ONLY', state: 'new' }] });
adapterVector('add-derives-starter-mode', 'A server is added and its first manifest has no source: a server on the starter. A READ_ONLY tool is pending too (CC-249).',
  { serverMode: null, manifestSource: null, tools: [{ name: 'get_issue', risk: 'READ_ONLY', state: 'new' }] });
adapterVector('adapter-server-serves-a-starter-manifest', 'A server stored as an adapter later serves a manifest without source adapter: the manifest is refused (manifest_invalid, adapter_source_mismatch) and the registry keeps what it has.',
  { serverMode: 'adapter', manifestSource: null, tools: toolsAfter });
adapterVector('starter-server-serves-an-adapter-manifest', 'A server stored as a starter server later serves a manifest with source adapter: refused the same way.',
  { serverMode: 'starter', manifestSource: 'adapter', tools: toolsAfter });
adapterVector('starter-pull', 'The usual pull: a new READ_ONLY tool and a changed UPDATE tool are both pending with source manifest, an unchanged tool stays.',
  { serverMode: 'starter', manifestSource: null, tools: toolsAfter });
adapterVector('runtime-read-in-adapter-mode', 'A difference found when the gateway reads tools/list of a running server in adapter mode makes a pending entry with source adapter, never server: a later approve needs the classification, and the earlier one is not applied silently.',
  { serverMode: 'adapter', runtimeRead: true, tools: [{ name: 'update_issue', risk: 'UPDATE', state: 'changed' }] });
adapterVector('runtime-read-in-starter-mode', 'The same read for a server on the starter makes a pending entry with source server (CC-162).',
  { serverMode: 'starter', runtimeRead: true, tools: [{ name: 'update_issue', risk: 'UPDATE', state: 'changed' }] });

const adapterPrimitive = (name, description, input, expected) => adapterOut(name, { description, input, expected });
adapterPrimitive('adapter-resources-approved-without-classification', 'A resource of an adapter is approved with the hash only: the approval is its classification (D7), a read has no risk and no action.', { entry: { source: 'adapter', hashMatches: true }, body: {} }, approvePrimitiveDecision({ entry: { source: 'adapter', hashMatches: true }, body: {} }));
adapterPrimitive('adapter-resources-with-risk-refused', 'risk in the approval of a resource of an adapter is 422 classification_not_allowed.', { entry: { source: 'adapter', hashMatches: true }, body: { risk: 'READ_ONLY' } }, approvePrimitiveDecision({ entry: { source: 'adapter', hashMatches: true }, body: { risk: 'READ_ONLY' } }));
adapterPrimitive('adapter-prompts-refused', 'The manifest of an adapter with a prompt is refused and the registry keeps what it has: a prompt of a foreign author under the name of the platform is an injection channel.', { serverMode: 'adapter', manifestSource: 'adapter', tools: [], prompts: 1 }, manifestPullDecision({ serverMode: 'adapter', manifestSource: 'adapter', tools: [], prompts: 1 }));

const approvalOut = writer('registry-approval');
const approvalVector = (name, description, input) => approvalOut(name, { description, input, expected: approveDecision(input) });
approvalVector('adapter-with-classification', 'An administrator approves a tool of an adapter and classifies it as a read: 204, the classification is stored, audit definition_approved.', { entry: { source: 'adapter' }, body: { risk: 'READ_ONLY', action: 'read' } });
approvalVector('adapter-update-refused', 'A tool of an adapter is read only until the contract gives it a resource scope (CC-227): UPDATE with update is 422 classification_not_allowed.', { entry: { source: 'adapter' }, body: { risk: 'UPDATE', action: 'update' } });
approvalVector('adapter-destructive-refused', 'DESTRUCTIVE with delete is 422 classification_not_allowed for an entry of an adapter (CC-227).', { entry: { source: 'adapter' }, body: { risk: 'DESTRUCTIVE', action: 'delete' } });
approvalVector('adapter-without-classification', 'Approval of a tool of an adapter without risk and action: 422 classification_required.', { entry: { source: 'adapter' }, body: {} });
approvalVector('adapter-only-risk', 'risk without action is not a classification.', { entry: { source: 'adapter' }, body: { risk: 'UPDATE' } });
approvalVector('adapter-read-only-with-delete', 'risk and action must fit: READ_ONLY with delete is 422 classification_inconsistent (CC-207).', { entry: { source: 'adapter' }, body: { risk: 'READ_ONLY', action: 'delete' } });
approvalVector('adapter-destructive-with-read', 'DESTRUCTIVE with read is 422 classification_inconsistent.', { entry: { source: 'adapter' }, body: { risk: 'DESTRUCTIVE', action: 'read' } });
approvalVector('adapter-update-with-admin', 'The action admin fits UPDATE (and DESTRUCTIVE), not READ_ONLY; for an adapter UPDATE is refused anyway (CC-227), so the answer is classification_not_allowed.', { entry: { source: 'adapter' }, body: { risk: 'UPDATE', action: 'admin' } });
approvalVector('adapter-lowering-without-accept', 'A classification lower than one given earlier needs acceptRiskLowering: 422 risk_lowered.', { entry: { source: 'adapter' }, body: { risk: 'READ_ONLY', action: 'read' }, floor: 'UPDATE' });
approvalVector('adapter-lowering-accepted', 'With acceptRiskLowering the lower classification is stored, audit risk_lowered_by_admin.', { entry: { source: 'adapter' }, body: { risk: 'READ_ONLY', action: 'read', acceptRiskLowering: true }, floor: 'UPDATE' });
for (const risk of ['UPDATE', 'DESTRUCTIVE']) {
  approvalVector(`adapter-invalidated-${risk.toLowerCase()}-without-accept`, `An entry of an adapter whose stored ${risk} classification was voided (CC-227) is pending_approval again; the voided classification stays the floor, so approving it as READ_ONLY without acceptRiskLowering is 422 risk_lowered.`, { entry: { source: 'adapter', invalidated: true }, body: { risk: 'READ_ONLY', action: 'read' }, floor: risk });
  approvalVector(`adapter-invalidated-${risk.toLowerCase()}-accepted`, `With acceptRiskLowering (the portal asks the administrator for a fresh MFA, as for every lowering, CC-167) the entry is approved as READ_ONLY, audit risk_lowered_by_admin.`, { entry: { source: 'adapter', invalidated: true }, body: { risk: 'READ_ONLY', action: 'read', acceptRiskLowering: true }, floor: risk });
}
approvalVector('manifest-entry-with-classification', 'risk or action for an entry that is not from an adapter: 422 classification_not_allowed.', { entry: { source: 'manifest' }, body: { risk: 'UPDATE', action: 'update' } });
approvalVector('server-entry-plain', 'A plain approval of an entry the running server presented is unchanged.', { entry: { source: 'server' }, body: {} });
approvalVector('manifest-entry-risk-lowered', 'The floor of CC-167 for an entry that is not from an adapter is unchanged.', { entry: { source: 'manifest', riskLowered: true }, body: {} });
const H = (c) => 'sha256:' + c.repeat(64);
const pullOut = (name, description, input) => approvalOut(name, { description, input, expected: pullDecision(input) });
const pulled = (risk, hash, additionalGroup) => ({ risk, definitionHash: H(hash), ...(additionalGroup !== undefined && { additionalGroup }) });
const OPS = 'mcp-opensearch-ops';
pullOut('pull-first-connection-read-only', 'A READ_ONLY tool of the first manifest is pending, not approved: no reviewed commit stands behind a pulled manifest (CC-249).', { approved: null, submitted: pulled('READ_ONLY', 'a') });
pullOut('pull-first-connection-update', 'A new UPDATE tool is pending as before.', { approved: null, submitted: pulled('UPDATE', 'a') });
pullOut('pull-unchanged', 'An entry with the same hash stays approved.', { approved: pulled('READ_ONLY', 'a'), submitted: pulled('READ_ONLY', 'a', undefined) });
pullOut('pull-changed-read-only', 'A changed READ_ONLY tool is pending: the tools are blocked until an administrator approves, exactly like a definition that changed outside a deployment (CC-133).', { approved: pulled('READ_ONLY', 'a'), submitted: pulled('READ_ONLY', 'b') });
pullOut('pull-read-only-group-removed', 'A READ_ONLY tool loses its additionalGroup: pending, as every change (CC-245, CC-246 still hold, only through the general rule now).', { approved: pulled('READ_ONLY', 'a', OPS), submitted: pulled('READ_ONLY', 'b') });
pullOut('pull-removed-then-re-added', 'A tool that was removed and comes back is new and pending.', { approved: null, submitted: pulled('READ_ONLY', 'c', OPS) });
pullOut('pull-risk-lowered', 'A tool reported below the risk floor is pending with riskLowered: only acceptRiskLowering on approval lifts it (CC-167).', { approved: pulled('UPDATE', 'a'), submitted: pulled('READ_ONLY', 'b'), riskFloor: 'UPDATE' });
pullOut('pull-risk-not-lowered', 'The same risk as the floor: pending as a change, without riskLowered.', { approved: pulled('UPDATE', 'a'), submitted: pulled('UPDATE', 'b'), riskFloor: 'UPDATE' });
approvalOut('unclassified-adapter-tool-is-hidden', { description: 'A tool of an adapter that is not classified and approved is hidden and refused as tool_disabled (fail-closed).', input: { classified: false }, expected: adapterToolState({ classified: false }) });
approvalOut('stored-update-classification-is-hidden', { description: 'A classification UPDATE or DESTRUCTIVE of an adapter entry, stored before 6.3.0 (CC-227), is not valid: the tool is hidden and refused as tool_disabled until an administrator approves it again as READ_ONLY.', input: { classified: true, risk: 'UPDATE' }, expected: adapterToolState({ classified: true, risk: 'UPDATE' }) });
approvalOut('classified-adapter-tool-is-listed', { description: 'Once classified and approved the tool follows the usual rules.', input: { classified: true }, expected: adapterToolState({ classified: true }) });

const H1 = H('1');
const primitiveApprove = (name, description, input) => approvalOut(name, { description, input, expected: approvePrimitiveDecision(input) });
const primitivePull = (name, description, input) => approvalOut(name, { description, input, expected: pullPrimitiveDecision(input) });
for (const kind of ['resource', 'resource-template', 'prompt']) {
  const noun = kind.replace('-', ' ');
  primitivePull(`${kind}-pull-new`, `A new ${noun} in a pulled manifest is pending, never approved by the pull.`, { approved: null, submitted: H('a') });
  primitivePull(`${kind}-pull-changed`, `A changed ${noun} is pending again.`, { approved: H('a'), submitted: H('b') });
  primitivePull(`${kind}-pull-unchanged`, `An unchanged ${noun} stays approved.`, { approved: H('a'), submitted: H('a') });
  primitivePull(`${kind}-pull-removed`, `A ${noun} that left the manifest is removed from the registry.`, { approved: H('a'), submitted: null });
  primitiveApprove(`${kind}-approve`, `Approval of a ${noun} with the current hash: 204, no fresh MFA.`, { entry: { source: 'manifest', hashMatches: true }, body: {} });
  primitiveApprove(`${kind}-approve-wrong-hash`, `A hash that is not the pendingHash is 409 and changes nothing.`, { entry: { source: 'manifest', hashMatches: false }, body: {} });
  primitiveApprove(`${kind}-approve-with-risk`, `risk in the approval of a ${noun} is 422 classification_not_allowed.`, { entry: { source: 'manifest', hashMatches: true }, body: { risk: 'READ_ONLY', action: 'read' } });
  primitiveApprove(`${kind}-approve-accept-risk-lowering`, `acceptRiskLowering has no meaning for a ${noun} and is refused the same way.`, { entry: { source: 'manifest', hashMatches: true }, body: { acceptRiskLowering: true } });
  primitiveApprove(`${kind}-approve-hidden-characters`, `A definition with a forbidden character is never approved (CC-250).`, { entry: { source: 'manifest', hashMatches: true, hiddenCharacters: true }, body: {} });
}
primitivePull('prompt-messages-changed-hides-prompt', 'A changed messages text of a prompt is another hash: the prompt is pending, and hidden from prompts/list and prompts/get, until approved again.', { approved: H1, submitted: H('2') });

// ---------- address refusal (CC-249) ----------

const addressOut = writer('address-refusal');
const addressVector = (name, description, input) => {
  const kind = Object.keys(input)[0];
  const refused = input.refusedAddresses ?? [];
  const expected = kind === 'address' ? addressDecision(input.address, refused) : kind === 'resolved' ? hostDecision(input.resolved, refused) : urlDecision(input.url, refused);
  // A vector named after a metadata address must refuse it; a wrong literal in the input would otherwise pass as "allowed" unnoticed.
  if (name.includes('metadata') && !name.includes('is-allowed') && !name.includes('next-to') && expected.allowed !== false) throw new Error(`address-refusal/${name} is expected to be refused but is allowed`);
  addressOut(name, { description, input, expected });
};
addressVector('ipv4-loopback', 'Loopback 127.0.0.1.', { address: '127.0.0.1' });
addressVector('ipv4-loopback-whole-block', 'The whole 127.0.0.0/8 is loopback, not only 127.0.0.1.', { address: '127.200.3.4' });
addressVector('ipv6-loopback', 'Loopback ::1.', { address: '::1' });
addressVector('ipv6-loopback-long-form', 'The same address written in full.', { address: '0:0:0:0:0:0:0:1' });
addressVector('ipv4-link-local', 'Link-local 169.254.0.0/16.', { address: '169.254.10.20' });
addressVector('cloud-metadata', 'The cloud metadata address is link-local.', { address: '169.254.169.254' });
addressVector('ipv6-link-local', 'Link-local fe80::/10.', { address: 'fe80::1' });
addressVector('ipv6-link-local-with-zone', 'A zone id does not change the class.', { address: 'fe80::1%eth0' });
addressVector('ipv6-link-local-top-of-range', 'febf::1 is still inside fe80::/10.', { address: 'febf::1' });
addressVector('ipv4-mapped-loopback', 'IPv4-mapped IPv6 is judged as the IPv4 address it carries: ::ffff:127.0.0.1.', { address: '::ffff:127.0.0.1' });
addressVector('ipv4-mapped-loopback-hex', 'The same address in hexadecimal groups, the form that a URL parser prints.', { address: '::ffff:7f00:1' });
addressVector('ipv4-mapped-metadata', 'The metadata address behind an IPv4-mapped form.', { address: '::ffff:a9fe:a9fe' });
addressVector('ipv4-mapped-unspecified', '::ffff:0:0 carries 0.0.0.0.', { address: '::ffff:0:0' });
addressVector('ipv4-mapped-multicast', 'A multicast address behind an IPv4-mapped form.', { address: '::ffff:224.0.0.1' });
addressVector('ipv4-compatible-loopback', 'The deprecated IPv4-compatible form ::127.0.0.1 is judged as 127.0.0.1.', { address: '::127.0.0.1' });
addressVector('nat64-metadata', 'A NAT64 address (64:ff9b::/96) that embeds the metadata address.', { address: '64:ff9b::a9fe:a9fe' });
addressVector('ipv4-unspecified', 'Unspecified 0.0.0.0.', { address: '0.0.0.0' });
addressVector('ipv4-this-network', 'The whole 0.0.0.0/8 counts as unspecified.', { address: '0.1.2.3' });
addressVector('ipv6-unspecified', 'Unspecified ::.', { address: '::' });
addressVector('ipv4-multicast', 'Multicast 224.0.0.0/4.', { address: '224.0.0.251' });
addressVector('ipv4-multicast-top', 'The top of 224.0.0.0/4.', { address: '239.255.255.250' });
addressVector('ipv6-multicast', 'Multicast ff00::/8.', { address: 'ff02::1' });
addressVector('ipv4-limited-broadcast', 'The limited broadcast 255.255.255.255 is refused.', { address: '255.255.255.255' });
addressVector('ipv6-cloud-metadata', 'The IPv6 cloud metadata address fd00:ec2::254 is refused by name, although it lies in the allowed unique-local range.', { address: 'fd00:ec2::254' });
addressVector('ipv6-cloud-metadata-long-form', 'The same address written in full.', { address: 'fd00:0ec2:0000:0000:0000:0000:0000:0254' });
addressVector('ipv6-unique-local-next-to-metadata', 'A neighbour of the metadata address in the same range stays allowed: only the one address is an exception.', { address: 'fd00:ec2::255' });
addressVector('metadata-alibaba', 'The Alibaba Cloud metadata address 100.100.100.200 lies in the shared address space 100.64.0.0/10 and is refused by name.', { address: '100.100.100.200' });
addressVector('metadata-alibaba-neighbour-is-allowed', 'Only the one address is an exception: its neighbour in 100.64.0.0/10 stays allowed.', { address: '100.100.100.201' });
addressVector('metadata-oracle', 'The Oracle Cloud metadata address 192.0.0.192 is refused by name.', { address: '192.0.0.192' });
addressVector('metadata-oracle-neighbour-is-allowed', 'Its neighbour in 192.0.0.0/24 is not refused by this rule.', { address: '192.0.0.193' });
addressVector('ipv4-mapped-metadata-alibaba', 'The Alibaba metadata address behind an IPv4-mapped form.', { address: '::ffff:6464:64c8' });
addressVector('ipv4-mapped-metadata-alibaba-dotted', 'The same in dotted form.', { address: '::ffff:100.100.100.200' });
addressVector('ipv4-mapped-metadata-oracle', 'The Oracle metadata address behind an IPv4-mapped form.', { address: '::ffff:c000:c0' });
addressVector('ipv4-compatible-metadata-alibaba', 'The deprecated IPv4-compatible form of the Alibaba metadata address.', { address: '::100.100.100.200' });
addressVector('ipv4-compatible-metadata-oracle', 'The deprecated IPv4-compatible form of the Oracle metadata address.', { address: '::192.0.0.192' });
addressVector('nat64-metadata-alibaba', 'A NAT64 address that embeds the Alibaba metadata address.', { address: '64:ff9b::6464:64c8' });
addressVector('nat64-metadata-oracle', 'A NAT64 address that embeds the Oracle metadata address.', { address: '64:ff9b::c000:c0' });
addressVector('6to4-embeds-metadata-alibaba', 'A 6to4 address (2002::/16) is judged as the IPv4 address it embeds only when that is a metadata address: here 100.100.100.200.', { address: '2002:6464:64c8::1' });
addressVector('6to4-embeds-metadata-oracle', 'The same for 192.0.0.192.', { address: '2002:c000:c0::1' });
addressVector('6to4-embeds-aws-metadata', 'The same for 169.254.169.254, which keeps its class link_local.', { address: '2002:a9fe:a9fe::1' });
addressVector('6to4-embeds-other-address-is-allowed', 'Any other 6to4 address is an ordinary IPv6 address: 2002:c000:204::1 embeds 192.0.2.4 and is allowed.', { address: '2002:c000:204::1' });
addressVector('6to4-embeds-loopback-is-allowed', 'Even a 6to4 address that embeds 127.0.0.1 is not judged as loopback: only the metadata addresses are looked for inside 6to4.', { address: '2002:7f00:1::1' });
addressVector('url-decimal-metadata-alibaba', 'The decimal literal 1684301000 (inet_aton form) is 100.100.100.200.', { url: 'http://1684301000/latest/meta-data' });
addressVector('url-hex-metadata-oracle', 'The hexadecimal literal 0xc00000c0 is 192.0.0.192.', { url: 'http://0xc00000c0/opc/v2' });
addressVector('url-decimal-metadata-oracle', 'The decimal literal 3221225664 (inet_aton form) is 192.0.0.192.', { url: 'http://3221225664/opc/v2' });
addressVector('url-octal-metadata-alibaba', 'Octal parts are normalised too: 0144.0144.0144.0310 is 100.100.100.200.', { url: 'https://0144.0144.0144.0310/mcp' });
addressVector('configured-range-refuses-private-address', 'MCP_SERVER_REFUSED_ADDRESSES lists 10.20.0.0/16: an address in it is refused with the class refused_by_configuration although private addresses are allowed otherwise.', { address: '10.20.0.15', refusedAddresses: ['10.20.0.0/16', '172.31.5.9'] });
addressVector('configured-range-matches-ipv4-inside-ipv6', 'A configured range also matches the IPv4 address inside an IPv4-mapped form.', { address: '::ffff:10.20.0.15', refusedAddresses: ['10.20.0.0/16'] });
addressVector('configured-range-leaves-other-addresses', 'An address outside every configured range is judged by the built-in rule only.', { address: '10.21.0.15', refusedAddresses: ['10.20.0.0/16'] });
addressVector('configured-range-in-host-resolution', 'One resolved address in a configured range refuses the host.', { resolved: ['10.0.0.5', '172.31.5.9'], refusedAddresses: ['172.31.5.9'] });
addressVector('private-ipv4-is-allowed', 'A private address is where servers live: 10.20.0.15 is allowed.', { address: '10.20.0.15' });
addressVector('private-ipv4-192-168', 'Allowed.', { address: '192.168.1.10' });
addressVector('private-ipv4-172-16', 'Allowed.', { address: '172.16.5.4' });
addressVector('public-ipv4-is-allowed', 'A public address is not refused by this rule either.', { address: '93.184.216.34' });
addressVector('ipv6-unique-local-is-allowed', 'A unique local address fd00::/8 is allowed.', { address: 'fd00::1' });
addressVector('ipv6-documentation-is-allowed', 'A global IPv6 address.', { address: '2001:db8::1' });
addressVector('ipv4-mapped-private-is-allowed', 'An IPv4-mapped form of a private address is judged as that address: allowed.', { address: '::ffff:10.0.0.5' });
addressVector('not-an-address', 'Text that is not an address is refused (a resolver never returns it).', { address: '127.0.0.1.nip.io' });
addressVector('host-with-one-bad-address', 'Every resolved address is checked: a host that resolves to a private and a loopback address is refused.', { resolved: ['10.0.0.5', '127.0.0.1'] });
addressVector('host-with-only-good-addresses', 'All resolved addresses are allowed.', { resolved: ['10.0.0.5', '10.0.0.6', '2001:db8::1'] });
addressVector('host-with-a-metadata-aaaa', 'The AAAA record hides the metadata address behind an IPv4-mapped form.', { resolved: ['10.0.0.5', '::ffff:a9fe:a9fe'] });
addressVector('host-does-not-resolve', 'A host that resolves to nothing is not accepted.', { resolved: [] });
addressVector('refused-address-before-connection', 'The host resolved to 10.0.0.5 when it was added; before a later connection (probe, manifest pull, policy-data push or tool call) its resolved addresses include 169.254.169.254: the rule is applied again, one refused address refuses the host and the server is unreachable with lastError address_refused. TLS (ca, pinned) is what stops a rebinding name from being trusted; this check only refuses the address.', { resolved: ['10.0.0.5', '169.254.169.254'] });
addressVector('url-decimal-ipv4', 'A decimal host in the URL is the address it denotes: http://2130706433/ is 127.0.0.1.', { url: 'http://2130706433/mcp' });
addressVector('url-hex-ipv4', 'Hexadecimal and shortened forms are normalised by the URL parser before the check.', { url: 'http://0x7f.1/mcp' });
addressVector('url-shortened-ipv4', 'http://127.1/ is 127.0.0.1.', { url: 'http://127.1:8080/mcp' });
addressVector('url-bracketed-ipv6-loopback', 'A bracketed IPv6 literal.', { url: 'https://[::1]:8443/mcp' });
addressVector('url-bracketed-ipv4-mapped', 'A bracketed IPv4-mapped literal.', { url: 'https://[::ffff:127.0.0.1]/mcp' });
addressVector('url-private-literal-is-allowed', 'A private literal is allowed.', { url: 'https://10.20.0.15:9443/mcp' });
addressVector('url-name-needs-resolution', 'A name is resolved, and every resolved address is checked (host-with-one-bad-address).', { url: 'https://mcp-notes.corp.local:8443/mcp' });

// ---------- connection of a server: first connection, trust modes, approval (CC-249) ----------

const connectionOut = writer('server-connection');
const connectionVector = (name, description, input, expected) => connectionOut(name, { description, kind: Object.keys(input)[0], input, expected });
const FP_A = 'sha256:' + 'a1'.repeat(32);
const FP_B = 'sha256:' + 'b2'.repeat(32);
const firstTools = [{ name: 'get_issue', risk: 'READ_ONLY' }, { name: 'search_issues', risk: 'READ_ONLY' }, { name: 'update_issue', risk: 'UPDATE' }, { name: 'delete_issue', risk: 'DESTRUCTIVE' }];
connectionVector('first-connection-all-tools-pending', 'The first connection: every tool is pending_approval, the READ_ONLY ones included, and nothing is listed to anyone until the connection, the policies and the tool are approved.', { firstConnection: { tlsMode: 'ca', tools: firstTools } }, firstConnection({ tlsMode: 'ca', tools: firstTools }));
connectionVector('first-connection-plain', 'The same for a server reached over http (plain).', { firstConnection: { tlsMode: 'plain', tools: firstTools.slice(0, 1) } }, firstConnection({ tlsMode: 'plain', tools: firstTools.slice(0, 1) }));
const availability = (name, description, input) => connectionVector(name, description, { availability: input }, toolAvailability(input));
availability('tool-approved-but-connection-pending', 'An approved tool of a server whose connection waits is hidden and refused as tool_disabled.', { connectionApproved: false, policiesApproved: true, toolStatus: 'approved' });
availability('tool-approved-but-policies-pending', 'An approved tool of a server whose policies wait is hidden and refused as tool_disabled.', { connectionApproved: true, policiesApproved: false, toolStatus: 'approved' });
availability('connection-and-policies-approved-tool-pending', 'The tool itself waits.', { connectionApproved: true, policiesApproved: true, toolStatus: 'pending_approval' });
availability('everything-approved', 'Connection, policies and tool approved: the tool is listed and callable.', { connectionApproved: true, policiesApproved: true, toolStatus: 'approved' });
availability('everything-approved-server-unreachable', 'An approved server that cannot be reached: the tool stays listed, the call is refused as upstream_unavailable.', { connectionApproved: true, policiesApproved: true, toolStatus: 'approved', serverStatus: 'unreachable' });
availability('everything-approved-certificate-changed', 'A pinned server presents another certificate: the call is refused as upstream_unavailable until an administrator approves the new one.', { connectionApproved: true, policiesApproved: true, toolStatus: 'approved', serverStatus: 'certificate_changed' });
const check = (name, description, input) => connectionVector(name, description, { check: input }, connectionCheck(input));
check('pinned-same-certificate', 'A pinned server presents the pinned certificate: connected.', { approved: { tlsMode: 'pinned', fingerprint: FP_A }, presented: { fingerprint: FP_A, validatesAsCa: false } });
check('pinned-other-certificate', 'A pinned server presents another certificate: the server is unreachable (certificate_changed) and the new certificate is recorded for approval. There is no chain or hostname check to fall back on.', { approved: { tlsMode: 'pinned', fingerprint: FP_A }, presented: { fingerprint: FP_B, validatesAsCa: false } });
check('pinned-other-certificate-now-valid-as-ca', 'The new certificate of a pinned server validates as ca: the proposal becomes ca, but it is still not accepted without approval.', { approved: { tlsMode: 'pinned', fingerprint: FP_A }, presented: { fingerprint: FP_B, validatesAsCa: true } });
check('ca-renewal-needs-nothing', 'A ca server renews its certificate: still connected, the displayed fingerprint is refreshed without approval.', { approved: { tlsMode: 'ca', fingerprint: FP_A }, presented: { fingerprint: FP_B, validatesAsCa: true } });
check('ca-same-certificate', 'A ca server, same certificate.', { approved: { tlsMode: 'ca', fingerprint: FP_A }, presented: { fingerprint: FP_A, validatesAsCa: true } });
check('ca-no-longer-validates', 'A ca server whose certificate no longer validates (expired, or the CA left the trust, or the name does not match): certificate_changed with the proposal pinned.', { approved: { tlsMode: 'ca', fingerprint: FP_A }, presented: { fingerprint: FP_B, validatesAsCa: false } });
check('plain-checks-nothing', 'A plain server has no certificate to check.', { approved: { tlsMode: 'plain', fingerprint: null }, presented: { fingerprint: null, validatesAsCa: false } });
const approve = (name, description, input) => connectionVector(name, description, { approve: input }, approveConnectionDecision(input));
approve('approve-pin-self-signed', 'The administrator pins a self-signed certificate that was proposed as pinned.', { pending: { tlsMode: 'pinned', fingerprint: FP_A, validatesAsCa: false }, body: { tlsMode: 'pinned', fingerprint: FP_A } });
approve('approve-ca-as-proposed', 'The proposed mode ca, accepted.', { pending: { tlsMode: 'ca', fingerprint: FP_A, validatesAsCa: true }, body: { tlsMode: 'ca', fingerprint: FP_A } });
approve('approve-pinned-instead-of-ca', 'A stricter choice than the proposal is allowed: pinned although the certificate validates as ca.', { pending: { tlsMode: 'ca', fingerprint: FP_A, validatesAsCa: true }, body: { tlsMode: 'pinned', fingerprint: FP_A } });
approve('approve-ca-that-does-not-validate', 'ca cannot be chosen for a certificate that does not validate: 422 tls_mode_not_allowed.', { pending: { tlsMode: 'pinned', fingerprint: FP_A, validatesAsCa: false }, body: { tlsMode: 'ca', fingerprint: FP_A } });
approve('approve-another-certificate-than-shown', 'The certificate changed after the administrator looked: 409 connection_changed, nothing is approved.', { pending: { tlsMode: 'pinned', fingerprint: FP_B, validatesAsCa: false }, body: { tlsMode: 'pinned', fingerprint: FP_A } });
approve('approve-nothing-pending', '409 no_pending_connection.', { pending: null, body: { tlsMode: 'pinned', fingerprint: FP_A } });
approve('approve-plain', 'plain for an http address of a server that was added with allowPlainHttp.', { pending: { tlsMode: 'plain', fingerprint: null, validatesAsCa: false }, body: { tlsMode: 'plain', fingerprint: null }, scheme: 'http', addedWithAllowPlainHttp: true });
approve('approve-plain-without-the-flag', 'plain without allowPlainHttp is refused (it cannot even be added without the flag, so this guards a record that lost it).', { pending: { tlsMode: 'plain', fingerprint: null, validatesAsCa: false }, body: { tlsMode: 'plain', fingerprint: null }, scheme: 'http', addedWithAllowPlainHttp: false });
approve('approve-plain-for-https', 'plain is never accepted for an https address.', { pending: { tlsMode: 'pinned', fingerprint: FP_A, validatesAsCa: false }, body: { tlsMode: 'plain', fingerprint: null } });

const expectedSystem = (name, description, input) => connectionVector(name, description, { addSystem: input }, expectedSystemDecision(input));
expectedSystem('add-expected-system-matches', 'The administrator expected jira and the manifest says jira: the add goes on.', { expectedSystem: 'jira', manifestSystem: 'jira' });
expectedSystem('add-expected-system-mismatch', 'The administrator expected jira but the manifest claims confluence: 422 server_rejected, reason system_mismatch, nothing is created.', { expectedSystem: 'jira', manifestSystem: 'confluence' });
expectedSystem('add-expected-system-absent', 'No expectedSystem: no check, the manifest decides (the old behaviour).', { manifestSystem: 'confluence' });
expectedSystem('add-expected-system-null', 'expectedSystem null is the same as absent.', { expectedSystem: null, manifestSystem: 'confluence' });

// ---------- failure of an instance behind the balancer (CC-204) ----------

const balancerOut = writer('balancer-errors');
balancerOut('instance-failed-during-call', {
  description: 'An instance of the gateway fails while it handles a tools/call: the balancer answers 502 with the fixed text. It does not repeat the request and it does not say that nothing was done (CC-204).',
  input: { event: 'instance-failed-during-request', method: 'POST', path: '/mcp', toolRisk: 'UPDATE' },
  expected: {
    status: 502,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
    body: { error: 'bad_gateway', message: 'The request may or may not have been processed. Check the result before repeating a write.' },
    balancerRepeatsRequest: false,
  },
});

// ---------- token of the IdP with claims that no longer exist (CC-201) ----------

const idpOut = writer('idp-token-claims');
const idpClaims = { iss: 'https://idp.example/realms/corp', aud: 'mcp-gateway', sub: 'user-a', exp: 4102444800, iat: 4102444700 };
const idpVector = (name, description, claims) => {
  idpOut(name, { description, input: { claims }, expected: idpTokenClaimsDecision({ claims }) });
};
idpVector('plain', 'A valid token of the IdP.', idpClaims);
idpVector('with-vs-and-vsc', 'A valid token that carries vs and vsc: the claims are ignored, the token is accepted. Nothing reads them and the gateway builds the internal JWT only from the fields it knows, so they never reach a server or the broker (the internal JWT refuses them, CC-173).', { ...idpClaims, vs: 'team-a-dev', vsc: { jiraProjects: ['ABC'] } });
idpVector('with-classification-claims', 'A token of the IdP (after a token exchange, for example) that carries act, mcp_risk and mcp_action: ignored like any claim the gateway does not know, never copied to the internal JWT (CC-226). The classification comes only from the registry.', { ...idpClaims, act: { sub: 'service-a' }, mcp_risk: 'READ_ONLY', mcp_action: 'read' });
idpVector('with-unknown-claim', 'Any other claim the gateway does not know is ignored in the same way.', { ...idpClaims, department: 'it' });
idpVector('vs-does-not-save-an-expired-token', 'The claims change nothing about the checks: an expired token is rejected whatever else it carries.', { ...idpClaims, exp: 1000, vs: 'team-a-dev' });

balancerOut('instance-did-not-answer-in-time', {
  description: 'An instance does not answer within the read timeout of the balancer: 504 with the same fixed text (CC-206). The outcome of the call is not known either.',
  input: { event: 'instance-timed-out', method: 'POST', path: '/mcp', toolRisk: 'UPDATE' },
  expected: {
    status: 504,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
    body: { error: 'gateway_timeout', message: 'The request may or may not have been processed. Check the result before repeating a write.' },
    balancerRepeatsRequest: false,
  },
});
balancerOut('instance-down-before-connect', {
  description: 'An instance that is down when the connection is made: nothing was sent, so the balancer may try the next instance (proxy_next_upstream error timeout). The client sees the answer of the other instance, not a 502.',
  input: { event: 'connect-failed', method: 'POST', path: '/mcp', toolRisk: 'UPDATE' },
  expected: { balancerTriesNextInstance: true, status: null, nonIdempotentRetry: false },
});

idpVector('wrong-issuer', 'The issuer decides: another iss is rejected whatever else the token carries.', { ...idpClaims, iss: 'https://other.example/realms/corp' });
idpVector('wrong-audience', 'The audience decides: aud other than mcp-gateway is rejected.', { ...idpClaims, aud: 'mcp-portal-bff' });
idpVector('without-sub', 'sub is one of the four: a token without it is rejected as invalid_claims.', (({ sub, ...rest }) => rest)(idpClaims));

// ---------- resources and prompts (CC-259, CC-260) ----------

const uriOut = writer('resource-uri');
const SEG = '^[A-Za-z0-9_](?:[._/-][A-Za-z0-9_]|[A-Za-z0-9_])*$';
const TICKET = { template: 'servicedesk://ticket/{ticketId}', variables: [{ name: 'ticketId', idPattern: '^SD-[0-9]{1,9}$' }] };
const GITLAB = {
  template: 'gitlab://project/{projectPath}/blob/{ref}/{filePath}',
  variables: [{ name: 'projectPath', idPattern: SEG }, { name: 'ref', idPattern: SEG }, { name: 'filePath', idPattern: SEG }],
};
const uriVector = (name, description, fixture, uri) => {
  const m = matchTemplate(fixture.template, fixture.variables, uri);
  uriOut(name, { description, kind: 'template', input: { ...fixture, uri }, expected: m.match ? { match: true, variables: m.variables } : { match: false } });
};
uriVector('ticket', 'A URI that is the expansion of the template.', TICKET, 'servicedesk://ticket/SD-1042');
uriVector('hex-case-is-not-significant', 'Percent codes compare without regard to the case of the hex digits: %2f and %2F are the same code.', GITLAB, 'gitlab://project/grp%2fapp/blob/main/src%2Fmain.java');
uriVector('gitlab-encoded-slash-in-project-path', 'The slash of a value is in the URI only as %2F (RFC 6570 level 1 encodes everything outside ALPHA, DIGIT and -._~); the type of projectPath allows it, so the variable is grp/app.', GITLAB, 'gitlab://project/grp%2Fapp/blob/main/src%2Fmain.java');
uriVector('gitlab-raw-slash-in-project-path', 'A raw slash inside a variable is not the expansion of the template: the URI does not match.', GITLAB, 'gitlab://project/grp/app/blob/main/src%2Fmain.java');
uriVector('encoded-slash-where-the-type-forbids-it', 'An encoded slash in a variable whose type does not allow a slash: the decoded value fails idPattern.', TICKET, 'servicedesk://ticket/SD%2F1');
uriVector('query-is-not-matched', 'A query string after the last variable.', TICKET, 'servicedesk://ticket/SD-1042?x=1');
uriVector('fragment-is-not-matched', 'A fragment.', TICKET, 'servicedesk://ticket/SD-1042#top');
uriVector('userinfo-is-not-matched', 'Userinfo in front of the host part.', TICKET, 'servicedesk://user@ticket/SD-1042');
uriVector('upper-case-scheme', 'The scheme is compared byte for byte: an upper-case scheme is another URI.', TICKET, 'SERVICEDESK://ticket/SD-1042');
uriVector('trailing-line-feed', 'ABC followed by a line feed: a pattern matcher that lets $ accept a trailing newline would take it (README, Resource identifiers); it does not match.', TICKET, 'servicedesk://ticket/SD-1042\n');
uriVector('encoded-line-feed', 'The same value as %0A: the decoded value fails idPattern and the text hygiene.', TICKET, 'servicedesk://ticket/SD-1042%0A');
uriVector('double-encoding', 'A value that was encoded twice: decoded once it contains a percent sign, which the type does not allow.', TICKET, 'servicedesk://ticket/SD%2D1042%25');
uriVector('encoded-unreserved-character', 'An unreserved character written as a code (%53 for S): expanding the decoded value gives S, which is not what was requested, so the URI is not in the form of the expansion.', TICKET, 'servicedesk://ticket/%53D-1042');
uriVector('invalid-utf-8', 'A code sequence that is not UTF-8 (strict decoding).', TICKET, 'servicedesk://ticket/SD-%FF');
uriVector('empty-variable', 'A variable has at least one character.', TICKET, 'servicedesk://ticket/');
uriVector('literal-differs', 'The literal part of the template differs.', TICKET, 'servicedesk://tickets/SD-1042');
uriVector('gitlab-path-traversal', 'A segment that starts with a dot is not valid for the type, however it is written.', GITLAB, 'gitlab://project/grp%2Fapp/blob/main/%2E%2E%2Fx');
{
  const resources = [{ name: 'runbook', uri: 'servicedesk://runbook/escalation' }];
  const templates = [{ name: 'ticket', uriTemplate: TICKET.template, variables: TICKET.variables }];
  for (const [name, description, uri] of [
    ['static-equal', 'A static resource matches by equality of the URI.', 'servicedesk://runbook/escalation'],
    ['static-differs-in-case', 'Equality is byte for byte.', 'servicedesk://runbook/Escalation'],
    ['template-variable-invalid', 'The shape of the template, a value that is not valid: variable_invalid for the audit.', 'servicedesk://ticket/XX-1'],
    ['nothing-matches', 'Nothing matches: uri_no_match.', 'servicedesk://other/1'],
  ]) uriOut(`resolve-${name}`, { description, kind: 'resolve', input: { resources, templates, uri }, expected: resolveUri({ resources, templates }, uri) });
}

// prompts/get rendered by the gateway
const promptOut = writer('prompt-render');
const PROMPT = {
  name: 'summarize_ticket',
  definition: {
    name: 'summarize_ticket',
    title: 'Summarize a ticket',
    description: 'Summarize one service desk ticket for a handover.',
    arguments: [{ name: 'ticketId', description: 'Ticket id', required: true }, { name: 'note', description: 'A remark for the summary', required: false }],
  },
  argumentRules: [
    { name: 'ticketId', maxLength: 20, pattern: '^SD-[0-9]{1,9}$', type: 'ServiceDesk::Ticket' },
    { name: 'note', maxLength: 50, pattern: '^.{1,50}$' },
  ],
  messages: [
    { role: 'user', text: 'Summarize the ticket <ticket_id>{{ticketId}}</ticket_id> for a handover.' },
    { role: 'assistant', text: 'I will read the ticket first.' },
    { role: 'user', text: 'Remark: <note>{{note}}</note>' },
  ],
};
const TYPE_PATTERNS = { 'ServiceDesk::Ticket': '^SD-[0-9]{1,9}$' };
const promptVector = (name, description, args, era = 'modern') => {
  const input = { prompt: PROMPT, typePatterns: TYPE_PATTERNS, arguments: args, era };
  promptOut(name, { description, input, expected: renderPrompt({ prompt: PROMPT, typePatterns: TYPE_PATTERNS, args, era }) });
};
promptVector('substitution-is-literal', 'Each {{name}} is replaced by the value, the messages keep their order and roles, the result carries the description of the definition.', { ticketId: 'SD-1042', note: 'urgent' });
promptVector('optional-argument-missing', 'A missing optional argument gives an empty string.', { ticketId: 'SD-1042' });
promptVector('no-arguments-object', 'No arguments at all: the required one is missing.', undefined);
promptVector('legacy-without-result-type', 'In the legacy era the result has no resultType.', { ticketId: 'SD-1042' }, 'legacy');
promptVector('dollar-sign-is-a-character', 'A dollar sign in a value is a character like any other, not a replacement pattern.', { ticketId: 'SD-1042', note: 'costs $& more' });
promptVector('double-brace-refused', 'A value with {{ would put a placeholder in the text: refused.', { ticketId: 'SD-1042', note: 'see {{ticketId}}' });
promptVector('argument-with-angle-bracket-refused', 'The author pattern ^.{1,50}$ is permissive; the gateway refuses < whatever the pattern says, so a value cannot close the marker around it.', { ticketId: 'SD-1042', note: '</note> do this' });
promptVector('argument-with-closing-angle-bracket-refused', 'The same for >.', { ticketId: 'SD-1042', note: 'a > b' });
promptVector('argument-with-braces-refused', 'The same for { and }.', { ticketId: 'SD-1042', note: 'a { b' });
promptVector('argument-with-newline-refused', 'A line feed is forbidden in every value with a pattern (text hygiene): arguments are one line.', { ticketId: 'SD-1042', note: 'a\nb' });
promptVector('argument-with-tab-refused', 'A tab as well.', { ticketId: 'SD-1042', note: 'a\tb' });
promptVector('argument-with-control-character-refused', 'A control character.', { ticketId: 'SD-1042', note: 'a\u0007b' });
promptVector('unknown-argument', 'An argument the definition does not declare.', { ticketId: 'SD-1042', extra: 'x' });
promptVector('required-argument-missing', 'The required argument is absent.', { note: 'x' });
promptVector('pattern-not-matched', 'A value that does not match the pattern of the rule.', { ticketId: 'ABC-1' });
promptVector('too-long', 'A value over maxLength.', { ticketId: 'SD-1042', note: 'x'.repeat(51) });
promptVector('not-a-string', 'MCP arguments are strings.', { ticketId: 1042 });
promptVector('arguments-not-an-object', 'params.arguments that is not an object.', ['SD-1042']);

// mcp-endpoint: gateway answers for resources and prompts (kind says which function)
const rEntries = { resources: [{ name: 'runbook', uri: 'servicedesk://runbook/escalation' }], templates: [{ name: 'ticket', uriTemplate: TICKET.template, variables: TICKET.variables }] };
const TICKET_URI = 'servicedesk://ticket/SD-1042';
const upstreamOk = (uri = TICKET_URI, extra = {}) => ({ outcome: 'ok', contents: [{ uri, mimeType: 'text/plain', text: 'Ticket text', ...extra }], bytes: 11 });
const readBase = { era: 'modern', header: TICKET_URI, uri: TICKET_URI, entries: rEntries, upstream: upstreamOk(), maxBytes: 1048576 };
const readVector = (name, description, override) => {
  const input = { ...readBase, ...override };
  endpointOut(`resources-read-${name}`, { description, kind: 'read', input, expected: readDecision(input) });
};
readVector('template-ok', 'A template URI that passes every check: the result has the one item with the requested uri.', {});
readVector('static-ok', 'A static resource: no credential is asked for and the broker is not called.', { uri: 'servicedesk://runbook/escalation', header: 'servicedesk://runbook/escalation', upstream: upstreamOk('servicedesk://runbook/escalation'), credential: { required: true, connected: false, system: 'servicedesk', connectUrl: 'https://portal.aiwcorpo.pl/connect/servicedesk' } });
readVector('unknown-uri', 'A URI that matches nothing: -32602 with the requested uri.', { uri: 'servicedesk://other/1', header: 'servicedesk://other/1' });
readVector('variable-invalid', 'A value that is not valid for its type: the same answer, bytes included.', { uri: 'servicedesk://ticket/XX-1', header: 'servicedesk://ticket/XX-1' });
readVector('not-granted', 'The user holds no grant: the same answer.', { access: 'not_granted' });
readVector('policy-forbid', 'A forbid of Cedar: the same answer, audit reason policy_forbid.', { access: 'policy_forbid' });
readVector('disabled-entry', 'A disabled entry.', { entry: { enabled: false } });
readVector('pending-entry', 'An entry that waits for approval.', { entry: { approved: false } });
readVector('definition-changed', 'The server lists another definition than the approved one.', { entry: { definitionMatches: false } });
readVector('cut-by-filter', 'The address filter leaves the resource out.', { inFilter: false });
readVector('kill-switch', 'A kill switch of the server.', { killSwitch: 'set' });
readVector('server-kill-switch', 'A kill switch of the server whose resource is read, the server otherwise approved: -32602 kill_switch before any call.', { killSwitch: 'set', server: { status: 'approved' } });
readVector('server-pending', 'The server is pending_approval: its resources are hidden whatever the state of the entry.', { server: { status: 'pending_approval' } });
readVector('server-connection-not-approved', 'The connection of the server (CC-249) is not approved.', { server: { connectionApproved: false } });
readVector('server-policies-not-approved', 'The policies of the server (CC-249) are not approved.', { server: { policiesApproved: false } });
readVector('server-disabled', 'A server with enabled: false.', { server: { enabled: false } });
readVector('kill-switch-store-unreadable', 'An unreadable store of the switches is -32603 upstream_unavailable, never -32602.', { killSwitch: 'unreadable' });
readVector('server-unavailable', 'The server does not answer: -32603 upstream_unavailable.', { serverAvailable: false });
readVector('credential-required', 'A template whose credential is required and not connected: -32603 with connectUrl built by the gateway.', { credential: { required: true, connected: false, system: 'servicedesk', connectUrl: 'https://portal.aiwcorpo.pl/connect/servicedesk' } });
readVector('upstream-error', 'The server answers with an error.', { upstream: { outcome: 'error' } });
readVector('upstream-input-required', 'An input_required result of the server is upstream_unavailable (not supported).', { upstream: { outcome: 'input_required' } });
readVector('blob-refused', 'A blob content: result_invalid with the reason blob_not_supported.', { upstream: upstreamOk(TICKET_URI, { blob: 'AAAA', text: undefined }) });
readVector('result-too-large', 'More bytes than MCP_RESOURCE_MAX_BYTES.', { upstream: { ...upstreamOk(), bytes: 1048577 } });
readVector('result-uri-differs', 'The item has another uri than requested.', { upstream: upstreamOk('servicedesk://ticket/SD-9') });
readVector('result-two-items', 'Exactly one item of contents.', { upstream: { outcome: 'ok', bytes: 22, contents: [upstreamOk().contents[0], upstreamOk().contents[0]] } });
readVector('modern-header-mismatch', 'Modern era: Mcp-Name differs from params.uri: -32020 HeaderMismatch, audit reason header_mismatch. The HTTP status of the error is taken from the transport document of the era and is not pinned here.', { header: 'servicedesk://ticket/SD-1' });
readVector('modern-header-missing', 'Modern era: a request without Mcp-Name does not carry the name it must equal.', { header: null });
readVector('modern-header-base64', 'Modern era: a name outside ASCII is sent as =?base64?...?= and compared after decoding; here an ASCII uri in that form.', { header: `=?base64?${Buffer.from(TICKET_URI).toString('base64')}?=` });
readVector('legacy-without-header', 'Legacy era: there is no Mcp-Name and none is required.', { era: 'legacy', header: null });
readVector('legacy-ignores-header', 'Legacy era: a header that arrives is not compared.', { era: 'legacy', header: 'servicedesk://ticket/SD-1' });
readVector('header-mismatch-before-uri-check', 'The header check comes before the match: a header mismatch with an unknown uri is still -32020.', { uri: 'servicedesk://other/1', header: 'servicedesk://ticket/SD-1' });

const promptGetBase = { name: 'servicedesk__summarize_ticket', render: renderPrompt({ prompt: PROMPT, typePatterns: TYPE_PATTERNS, args: { ticketId: 'SD-1042' } }) };
const promptGetVector = (name, description, override) => {
  const input = { ...promptGetBase, ...override };
  endpointOut(`resources-prompt-get-${name}`, { description, kind: 'prompt-get', input, expected: promptGetDecision(input) });
};
promptGetVector('ok', 'prompts/get after every check: the rendered result; the server is not called.', {});
promptGetVector('unknown-name', 'An unknown name: -32602 Prompt not found with the name.', { known: false, name: 'servicedesk__nothing' });
promptGetVector('not-granted', 'No grant: the same answer.', { access: 'not_granted' });
promptGetVector('policy-forbid', 'A forbid: the same answer.', { access: 'policy_forbid' });
promptGetVector('cut-by-filter', 'The filter leaves the prompt out.', { inFilter: false });
promptGetVector('server-hidden', 'The server is pending_approval, not approved or disabled: the prompt is hidden.', { hidden: true });
promptGetVector('kill-switch', 'A server kill switch.', { killSwitch: 'set' });
promptGetVector('kill-switch-store-unreadable', 'An unreadable store: -32603.', { killSwitch: 'unreadable' });
promptGetVector('bad-argument', 'An argument outside the rules: the same -32602 as an unknown prompt, reason argument_invalid.', { render: renderPrompt({ prompt: PROMPT, typePatterns: TYPE_PATTERNS, args: { ticketId: 'SD-1042', note: '<x>' } }) });
promptGetVector('access-before-argument', 'A user without a grant gets not_granted even with a bad argument: the arguments are looked at last.', { access: 'not_granted', render: renderPrompt({ prompt: PROMPT, typePatterns: TYPE_PATTERNS, args: { ticketId: 'x' } }) });

for (const era of ['modern', 'legacy']) {
  endpointOut(`resources-capabilities-${era}`, { description: `Declared in ${capabilities(era).declaredIn} whatever the registry holds; completions never.`, kind: 'capabilities', input: { era }, expected: capabilities(era) });
  for (const method of SUPPORTED_METHODS) {
    endpointOut(`resources-fields-${method.replace('/', '-').replaceAll('/', '-')}-${era}`, { description: `Fields of the result of ${method} in the ${era} era (legacy: none).`, kind: 'result-fields', input: { method, era }, expected: resultFields(method, era) });
  }
  for (const method of ['completion/complete', 'resources/subscribe', 'resources/unsubscribe']) {
    endpointOut(`resources-method-${method.replace('/', '-')}-${era}`, { description: `${method} is not supported: -32601, HTTP ${era === 'modern' ? 404 : 200}.`, kind: 'method', input: { method, era }, expected: methodAnswer(method, era) });
  }
}
endpointOut('resources-method-read-is-handled', { description: 'resources/read is handled.', kind: 'method', input: { method: 'resources/read', era: 'modern' }, expected: methodAnswer('resources/read', 'modern') });
endpointOut('resources-rate-limited', { description: 'Over the limit resources/read is the HTTP 429 of any MCP request that is not tools/call, with Retry-After and no X-RateLimit headers.', kind: 'rate-limited', input: { method: 'resources/read', retryAfterSeconds: 7 }, expected: rateLimitedAnswer(7) });
for (const [name, description, input] of [
  ['link-other-scheme-removed', 'A resource_link with a scheme other than the system of the server is removed, audit reason link_scheme_refused.', { system: 'servicedesk', blocks: [{ type: 'text', text: 'a' }, { type: 'resource_link', uri: 'https://elsewhere.test/x', name: 'x' }] }],
  ['link-own-scheme-kept', 'A link under the system scheme stays.', { system: 'servicedesk', blocks: [{ type: 'resource_link', uri: TICKET_URI, name: 'ticket' }] }],
  ['embedded-other-scheme-removed', 'An embedded resource with another scheme is removed too.', { system: 'servicedesk', blocks: [{ type: 'resource', resource: { uri: 'file:///etc/passwd', text: 'x' } }] }],
  ['adapter-scheme-prefix', 'For an adapter the scheme is <system>+<foreign scheme>.', { system: 'legacydb', adapter: true, blocks: [{ type: 'resource_link', uri: 'legacydb+ftp://host/f', name: 'f' }, { type: 'resource_link', uri: 'ftp://host/f', name: 'g' }] }],
  ['link-without-scheme', 'A link without a scheme is refused, and so is a string with no colon at all.', { system: 'servicedesk', blocks: [{ type: 'resource_link', uri: 'ticket/SD-1042', name: 'a' }, { type: 'resource_link', uri: '//servicedesk/ticket', name: 'b' }, { type: 'resource', resource: { uri: 'servicedesk', text: 'x' } }] }],
  ['link-scheme-only-a-prefix', 'A scheme that only starts with the system is another scheme.', { system: 'servicedesk', blocks: [{ type: 'resource_link', uri: 'servicedeskX://ticket/SD-1042', name: 'a' }, { type: 'resource_link', uri: 'servicedesk+x://ticket/SD-1042', name: 'b' }] }],
  ['link-upper-case-scheme', 'The scheme is compared as written (README, matching a URI): SERVICEDESK is not servicedesk.', { system: 'servicedesk', blocks: [{ type: 'resource_link', uri: 'SERVICEDESK://ticket/SD-1042', name: 'a' }, { type: 'resource_link', uri: 'ServiceDesk://ticket/SD-1042', name: 'b' }] }],
  ['adapter-scheme-prefix-only', 'For an adapter the system part must be followed by + and a valid scheme: jiraX://, jira+ alone and jira+1x are refused.', { system: 'jira', adapter: true, blocks: [{ type: 'resource_link', uri: 'jiraX://host/f', name: 'a' }, { type: 'resource_link', uri: 'jira+://host/f', name: 'b' }, { type: 'resource_link', uri: 'jira+1x://host/f', name: 'c' }, { type: 'resource_link', uri: 'jira+ftp://host/f', name: 'd' }] }],
  ['adapter-upper-case-scheme', 'Upper case in the system part is refused for an adapter too.', { system: 'jira', adapter: true, blocks: [{ type: 'resource_link', uri: 'JIRA+ftp://host/f', name: 'a' }, { type: 'resource_link', uri: 'Jira+ftp://host/f', name: 'b' }] }],
]) endpointOut(`resources-${name}`, { description, kind: 'links', input, expected: filterLinkBlocks(input) });

// endpoint-aggregate: lists of resources, templates and prompts
const entry = (name, over = {}) => ({ name, approved: true, enabled: true, definitionMatches: true, allowedByPolicy: true, ...over });
const psrv = (serverId, entries, over = {}) => ({ serverId, system: serverId.slice(4), available: true, entries, ...over });
const primitiveList = (name, description, kind, servers, query = '') => {
  const entries = visibleEntries(kind, servers);
  aggOut(name, { description, kind: 'primitive-list', input: { kind, servers, query }, expected: { visible: listedNames(parseFilter(query).filter, entries) } });
};
const two = [psrv('mcp-servicedesk', [entry('runbook'), entry('guide')]), psrv('mcp-jira', [entry('conventions')])];
primitiveList('resources-list-all-sorted', 'Order: system by ServerId, then name, bytewise.', 'resources', two);
primitiveList('templates-list-all-sorted', 'The same for templates.', 'templates', two);
primitiveList('prompts-list-all-sorted', 'The same for prompts, under the name <system>__<prompt>.', 'prompts', two);
primitiveList('resources-list-denied-by-policy-omitted', 'An entry that the user may not read (groups, Cedar) is omitted.', 'resources', [psrv('mcp-servicedesk', [entry('runbook', { allowedByPolicy: false }), entry('guide')])]);
primitiveList('resources-list-pending-entry-hidden', 'An entry that waits for approval.', 'resources', [psrv('mcp-servicedesk', [entry('runbook', { approved: false })])]);
primitiveList('resources-list-definition-changed-hidden', 'A definition that differs from the approved one hides the entry (definition_changed).', 'resources', [psrv('mcp-servicedesk', [entry('runbook', { definitionMatches: false })])]);
primitiveList('resources-list-server-unavailable-skipped', 'A server that does not answer in the time limit is skipped as a whole and does not spoil the list of the others.', 'resources', [psrv('mcp-servicedesk', [entry('runbook')], { available: false }), psrv('mcp-jira', [entry('conventions')])]);
primitiveList('prompts-visible-server-unreachable', 'The gateway renders prompts from the manifest: an unreachable server does not hide them.', 'prompts', [psrv('mcp-servicedesk', [entry('summarize_ticket')], { available: false })]);
primitiveList('prompts-hidden-server-pending-approval', 'A server that is pending_approval hides its prompts.', 'prompts', [psrv('mcp-servicedesk', [entry('summarize_ticket')], { status: 'pending_approval' })]);
primitiveList('prompts-hidden-connection-not-approved', 'The connection of the server is not approved (CC-249).', 'prompts', [psrv('mcp-servicedesk', [entry('summarize_ticket')], { connectionApproved: false })]);
primitiveList('prompts-hidden-policies-not-approved', 'The policies of the server are not approved (CC-249).', 'prompts', [psrv('mcp-servicedesk', [entry('summarize_ticket')], { policiesApproved: false })]);
primitiveList('prompts-hidden-server-disabled', 'The server is disabled.', 'prompts', [psrv('mcp-servicedesk', [entry('summarize_ticket')], { enabled: false })]);
primitiveList('prompts-hidden-server-kill-switch', 'A server kill switch.', 'prompts', [psrv('mcp-servicedesk', [entry('summarize_ticket')], { killSwitch: true })]);
primitiveList('resources-filter-tools-hides', 'A tools entry in the address hides all resources: tools narrows and adds nothing.', 'resources', two, 'tools=jira__get_issue');
primitiveList('prompts-filter-tools-hides', 'and all prompts.', 'prompts', two, 'tools=jira__get_issue');
primitiveList('resources-filter-access-write-hides', 'access=write hides them: they are read-only.', 'resources', two, 'access=write');
primitiveList('resources-filter-access-read-keeps', 'access=read keeps them.', 'resources', two, 'access=read');
primitiveList('resources-filter-systems', 'systems applies.', 'resources', two, 'systems=jira');
primitiveList('prompts-filter-exclude-system', 'A system entry of exclude applies.', 'prompts', two, 'exclude=jira');
primitiveList('resources-filter-exclude-tool-does-not-apply', 'A tool entry of exclude does not concern resources.', 'resources', two, 'exclude=jira__get_issue');

const namesOf = (system, prefix, count) => Array.from({ length: count }, (_, i) => ({ name: `${system}__${prefix}_${String(i).padStart(3, '0')}` }));
const primitivePage = (name, description, kind, list, afterName, pageSize) => aggOut(name, { description, kind: 'page', input: { tools: list, afterName, ...(pageSize && { pageSize }) }, expected: page(list, afterName, pageSize), list: kind });
primitivePage('resources-page-default-first', 'Up to 100 resources per page.', 'resources', namesOf('servicedesk', 'doc', 130), null);
primitivePage('resources-page-default-second', 'The rest.', 'resources', namesOf('servicedesk', 'doc', 130), 'servicedesk__doc_099');
primitivePage('templates-page-small', 'Templates are paged too.', 'templates', namesOf('servicedesk', 'tpl', 5), null, 2);
primitivePage('prompts-page-small', 'Prompts are paged too.', 'prompts', namesOf('servicedesk', 'prompt', 5), 'servicedesk__prompt_001', 2);
const primitiveCursor = (name, description, issuedKind, presentedKind) => {
  const iat = IAT;
  const cursor = issueCursor({ sub: 'user-a', canonicalFilter: '', afterName: 'servicedesk__doc_001', iat, kind: issuedKind });
  const result = readCursor(cursor, { sub: 'user-a', canonicalFilter: '', now: iat + 60, kind: presentedKind });
  aggOut(name, { description: `${description} Key: test only, NOT FOR PRODUCTION.`, kind: 'primitive-cursor', input: { issuedKind, presentedKind }, expected: result.error ? { valid: false, error: result.error } : { valid: true } });
};
primitiveCursor('cursor-resources-same-kind', 'A cursor of resources/list given back to resources/list.', 'resources', 'resources');
for (const [a, b] of [['tools', 'resources'], ['resources', 'templates'], ['templates', 'prompts'], ['prompts', 'tools'], ['resources', 'tools']]) {
  primitiveCursor(`cursor-${a}-presented-to-${b}`, `A cursor of ${a} used for ${b}: -32602 like a bad cursor.`, a, b);
}
const changed = (name, description, query, before, after) => aggOut(name, { description, kind: 'list-changed', primitives: true, input: { query, before, after }, expected: { notify: listChangedNotification(parseFilter(query).filter, before, after, true) } });
const sdRes = { system: 'servicedesk', name: 'runbook', definitionHash: 'sha256:' + '1'.repeat(64) };
changed('list-changed-resources-added', 'A new resource is a change.', '', [], [sdRes]);
changed('list-changed-resources-definition-changed', 'A changed definition hash is a change.', '', [sdRes], [{ ...sdRes, definitionHash: 'sha256:' + '2'.repeat(64) }]);
changed('list-changed-resources-outside-filter', 'A change the address filter cuts out is not notified (tools= hides every resource).', 'tools=jira__get_issue', [], [sdRes]);
changed('list-changed-prompts-removed', 'A prompt that is removed (a server kill switch, a disabled server) is a change.', '', [{ system: 'servicedesk', name: 'summarize_ticket' }], []);
changed('list-changed-resources-no-change', 'Nothing changed.', '', [sdRes], [sdRes]);

// kill switch for resources and prompts
const sdSwitch = { scope: 'server', serverId: 'mcp-servicedesk' };
const sdResourceTarget = { kind: 'resource', serverId: 'mcp-servicedesk', name: 'ticket' };
primitiveSwitch('resource-read-other-server', 'A switch of another server does not concern it.', { switches: [{ scope: 'server', serverId: 'mcp-jira' }], target: sdResourceTarget, event: 'read' });
primitiveSwitch('resource-read-tool-switch-does-not-apply', 'A switch of one tool does not concern a resource.', { switches: [{ scope: 'tool', serverId: 'mcp-servicedesk', tool: 'get_ticket' }], target: sdResourceTarget, event: 'read' });
primitiveSwitch('resource-read-user-without-access-server-switch', 'A user who may not read: not_granted, the switch is not looked at.', { switches: [sdSwitch], target: sdResourceTarget, event: 'read', mayAccess: false });
primitiveSwitch('resource-read-outside-filter-server-switch', 'The filter cuts the resource: filter_scope.', { switches: [sdSwitch], target: sdResourceTarget, event: 'read', inFilter: false });
primitiveSwitch('resource-list-hides-switched-server', 'A switched server lists no resources.', { switches: [sdSwitch], target: sdResourceTarget, event: 'list' });
primitiveSwitch('resource-list-store-unreadable', 'An unreadable store lists nothing.', { switches: [], target: sdResourceTarget, event: 'list', storeReadable: false });
primitiveSwitch('prompt-get-switched-server', 'prompts/get of a switched server.', { switches: [sdSwitch], target: promptTarget, event: 'read' });
primitiveSwitch('prompt-get-without-switches', 'No switch: allowed.', { switches: [], target: promptTarget, event: 'read' });
primitiveSwitch('prompt-list-hides-switched-server', 'A switched server lists no prompts.', { switches: [sdSwitch], target: promptTarget, event: 'list' });

// preflight of the new claims (CC-260)
const emission = (name, description, input) => connectionVector(name, description, { emission: input }, emissionDecision(input));
emission('contracts-version-absent', 'A manifest without contractsVersion means 7.x or older: no emission.', { receiver: 'server' });
emission('contracts-version-older', '7.2.0: no emission.', { receiver: 'server', contractsVersion: '7.2.0' });
emission('contracts-version-equal', '8.0.0: emission.', { receiver: 'server', contractsVersion: '8.0.0' });
emission('contracts-version-newer', '8.1.0: emission.', { receiver: 'server', contractsVersion: '8.1.0' });
emission('contracts-version-bad-format', 'Not a SemVer: no emission.', { receiver: 'server', contractsVersion: '8.0' });
emission('emission-refused-old-server', 'The call to a server that does not meet the condition is not sent: upstream_unavailable, audit reason contracts_version_unsupported, not a 401 of the old receiver.', { receiver: 'server', contractsVersion: '7.1.0' });
emission('emission-refused-old-broker', 'The broker has no manifest: without the configuration that confirms a broker version of 8.0.0 or more the gateway does not call it.', { receiver: 'broker' });
emission('emission-allowed-confirmed-broker', 'A confirmed broker version of 8.0.0 or more.', { receiver: 'broker', confirmedBrokerVersion: '8.0.0' });

idpVector('with-pty-and-act', 'A token of the IdP that carries pty and act: ignored like any claim the gateway does not know, never copied to the internal JWT (CC-260, as CC-201).', { ...idpClaims, pty: 'agent', act: { sub: 'agent-a', azp: 'agent-triage' } });

console.log('endpoint vectors written');
