// Generates test-vectors/endpoint-filter and test-vectors/endpoint-aggregate (CC-169, CC-170, CC-172, CC-176).
// The expected values come from the reference in scripts/lib/endpoint-filter.mjs and endpoint-aggregate.mjs; the Java class
// EndpointFilter and the tests must reproduce them.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { path } from './lib/contracts.mjs';
import { applyFilter, callDecision, checkRoute, InvalidFilter, parseFilter, sessionMatches } from './lib/endpoint-filter.mjs';
import { listChangedNotification, routeCall, visibleTools } from './lib/endpoint-aggregate.mjs';
import { mcpEndpoint } from './lib/mcp-endpoint.mjs';

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
parseVector('systems-five', 'Five systems are at the limit.', 'systems=confluence,gitlab,jira,opensearch,servicedesk');
parseVector('systems-six', 'Six systems are over the limit of 5.', 'systems=a,b,c,d,e,f');
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
changedVector('definition-approved-outside-filter', 'The same event, but the filter of the session cuts the tool: no notification.', 'systems=gitlab', [gitlabRead], [gitlabRead]);
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
const endpointVector = (name, description, rawQuery, catalog = userCatalog) => {
  endpointOut(name, { description, input: { publicBaseUrl: PUBLIC_BASE_URL, rawQuery, catalog }, expected: mcpEndpoint({ publicBaseUrl: PUBLIC_BASE_URL, rawQuery, catalog }) });
};
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
endpointVector('invalid-percent-encoding', 'No percent-encoding.', 'systems=jira%2cgitlab');

console.log('endpoint vectors written');
