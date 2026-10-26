// Generates test-vectors/entity-builder and test-vectors/policy-decisions with scripts/lib/entity-builder.mjs.
// Expected decisions are written here by hand; the Java tests evaluate them with cedar-java.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { path } from './lib/contracts.mjs';
import { build, BuilderError } from './lib/entity-builder.mjs';

const SUB = {
  reader: 'b1a7c0de-0000-4000-8000-000000000001',
  writer: 'b1a7c0de-0000-4000-8000-000000000002',
  writer2: 'b1a7c0de-0000-4000-8000-000000000003',
  destroyer: 'b1a7c0de-0000-4000-8000-000000000004',
  nobody: 'b1a7c0de-0000-4000-8000-000000000005',
  gitlabReader: 'b1a7c0de-0000-4000-8000-000000000006',
  gitlabWriter: 'b1a7c0de-0000-4000-8000-000000000007',
  osReader: 'b1a7c0de-0000-4000-8000-000000000008',
  confluenceReader: 'b1a7c0de-0000-4000-8000-000000000009',
};
const caller = (name, grp, extra = {}) => ({ sub: SUB[name], usr: name.toLowerCase(), grp, azp: 'claude-code', ...extra });

const users = {
  reader: () => caller('reader', ['mcp-jira-read']),
  writer: () => caller('writer', ['mcp-jira-read', 'mcp-jira-write', 'mcp-jira-proj-ABC']),
  writer2: () => caller('writer2', ['mcp-jira-read', 'mcp-jira-write', 'mcp-jira-proj-ABC', 'mcp-jira-proj-DEF']),
  destroyer: (extra) => caller('destroyer', ['mcp-jira-read', 'mcp-jira-destructive', 'mcp-jira-proj-ABC'], extra),
  nobody: () => caller('nobody', []),
  gitlabReader: () => caller('gitlabReader', ['mcp-gitlab-read']),
  gitlabWriter: () => caller('gitlabWriter', ['mcp-gitlab-read', 'mcp-gitlab-write', 'mcp-gitlab-grp-team-a']),
  osReader: () => caller('osReader', ['mcp-opensearch-read', 'mcp-opensearch-idx-logs-team-a']),
  confluenceReader: () => caller('confluenceReader', ['mcp-confluence-read', 'mcp-confluence-space-ENG']),
};

const tool = (system, name, risk, action, resourceRefs = []) => ({ serverId: `mcp-${system}`, system, name, risk, action, resourceRefs });
const tools = {
  getIssue: tool('jira', 'get_issue', 'READ_ONLY', 'read', [{ argument: 'issueKey', type: 'Jira::Issue' }]),
  searchIssues: tool('jira', 'search_issues', 'READ_ONLY', 'read', [{ argument: 'projectKeys', type: 'Jira::Project' }]),
  createIssue: tool('jira', 'create_issue', 'UPDATE', 'update', [{ argument: 'projectKey', type: 'Jira::Project' }]),
  updateIssue: tool('jira', 'update_issue', 'UPDATE', 'update', [{ argument: 'issueKey', type: 'Jira::Issue' }]),
  deleteIssue: tool('jira', 'delete_issue', 'DESTRUCTIVE', 'delete', [{ argument: 'issueKey', type: 'Jira::Issue' }]),
  moveIssue: tool('jira', 'move_issue', 'UPDATE', 'update', [
    { argument: 'issueKey', type: 'Jira::Issue' },
    { argument: 'fromProject', type: 'Jira::Project' },
    { argument: 'toProject', type: 'Jira::Project' },
  ]),
  listProjects: tool('jira', 'list_projects', 'READ_ONLY', 'read'),
  getProject: tool('gitlab', 'get_project', 'READ_ONLY', 'read', [{ argument: 'projectPath', type: 'GitLab::Project' }]),
  createProject: tool('gitlab', 'create_project', 'UPDATE', 'update', [{ argument: 'groupPath', type: 'GitLab::Group' }]),
  updateProject: tool('gitlab', 'update_project', 'UPDATE', 'update', [{ argument: 'projectPath', type: 'GitLab::Project' }]),
  searchIndex: tool('opensearch', 'search', 'READ_ONLY', 'read', [{ argument: 'index', type: 'OpenSearch::Index' }]),
  getTicket: tool('servicedesk', 'get_ticket', 'READ_ONLY', 'read', [{ argument: 'ticketId', type: 'ServiceDesk::Ticket' }]),
  getPage: tool('confluence', 'get_page', 'READ_ONLY', 'read', [{ argument: 'pageId', type: 'Confluence::Page' }]),
};

const project = (key, category) => ({ type: 'Jira::Project', id: key, attrs: category ? { key, category } : { key } });
const issue = (key, projectKey, category) => ({ type: 'Jira::Issue', id: key, attrs: { key }, parent: project(projectKey, category) });
const vs = (slug, resourceDefaults) => ({ slug, ...(resourceDefaults && { resourceDefaults }) });
const viaVs = (user, link) => ({ caller: { ...user, vs: link.slug }, virtualServer: link });

const outDir = (name) => {
  rmSync(path('test-vectors', name), { recursive: true, force: true });
  mkdirSync(path('test-vectors', name), { recursive: true });
};
const write = (dir, name, value) => writeFileSync(path('test-vectors', dir, `${name}.json`), JSON.stringify(value, null, 2) + '\n');

// ---------- entity builder ----------
outDir('entity-builder');
const builderVector = (name, description, level, input) => {
  let expected;
  try {
    expected = build(level, input);
  } catch (e) {
    if (!(e instanceof BuilderError)) throw e;
    expected = { error: e.code };
  }
  write('entity-builder', name, { description, level, input, expected });
};

builderVector('gateway-basic', 'Gateway: reader calls get_issue; issue key goes to refs.jiraIssue only.', 'gateway',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-123' } });
builderVector('scopes-from-groups', 'All scope group forms of C9; unknown systems, unknown resource kinds and non-mcp groups add no scope.', 'gateway', {
  caller: caller('reader', [
    'mcp-jira-read', 'mcp-jira-proj-ABC', 'mcp-jira-proj-DEF', 'mcp-confluence-space-ENG', 'mcp-gitlab-grp-team-a',
    'mcp-opensearch-idx-logs-team-a', 'mcp-servicedesk-queue-42', 'mcp-client-claude-code', 'mcp-platform-admin',
    'mcp-jira-board-7', 'mcp-wiki-proj-X', 'employees',
  ]),
  tool: tools.listProjects,
  arguments: {},
});
builderVector('refs-array-deduplicated', 'Array argument becomes a sorted set without duplicates.', 'gateway',
  { caller: users.reader(), tool: tools.searchIssues, arguments: { projectKeys: ['DEF', 'ABC', 'ABC'] } });
builderVector('refs-missing-argument', 'Declared resourceRef whose argument is absent: field present with an empty set.', 'gateway',
  { caller: users.reader(), tool: tools.searchIssues, arguments: {} });
builderVector('refs-integer-id', 'Integer argument converted to its decimal string.', 'gateway',
  { caller: caller('reader', ['mcp-servicedesk-read']), tool: tools.getTicket, arguments: { ticketId: 4711 } });
builderVector('refs-invalid-object', 'Object as a resource id: builder fails, the call is denied (fail-closed, invalid_argument).', 'gateway',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: { key: 'ABC-123' } } });
builderVector('refs-two-arguments-same-type', 'Two arguments of the same type are merged into one set.', 'gateway',
  { caller: users.writer(), tool: tools.moveIssue, arguments: { issueKey: 'ABC-1', fromProject: 'ABC', toProject: 'DEF' } });
builderVector('tool-without-refs', 'Tool with no resourceRefs: refs is an empty record.', 'gateway',
  { caller: users.reader(), tool: tools.listProjects, arguments: { anything: 'ignored' } });
builderVector('virtual-server-scopes', 'Virtual server resourceDefaults become context.vsScopes.', 'gateway', {
  ...viaVs(users.writer2(), vs('team-a-dev', { 'Jira::Project': ['ABC'], 'OpenSearch::Index': ['logs-team-a'], 'GitLab::Group': ['team-a'] })),
  tool: tools.createIssue, arguments: { projectKey: 'ABC' } });
builderVector('virtual-server-without-defaults', 'Virtual server with only a tool list: virtualServer set, no vsScopes.', 'gateway',
  { ...viaVs(users.reader(), vs('my-tools')), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' } });
builderVector('virtual-server-without-vs-claim', 'Link definition passed for a call without vs claim: inconsistent input, denied.', 'gateway',
  { caller: users.reader(), virtualServer: vs('team-a-dev', { 'Jira::Project': ['ABC'] }), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' } });
builderVector('mfa-age', 'mfa claim becomes principal.mfaAge and context.mfaAge.', 'gateway',
  { caller: users.destroyer({ mfa: 120 }), tool: tools.deleteIssue, arguments: { issueKey: 'ABC-1' } });
builderVector('server-jira-issue', 'Server: resolved issue with parent project; project attribute duplicates the parent edge.', 'server',
  { caller: users.writer(), tool: tools.updateIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'ABC', 'Software') });
builderVector('server-jira-issue-moved', 'Server: issue key says ABC but the system resolved it into HR (Restricted).', 'server',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-123' }, resource: issue('ABC-123', 'HR', 'Restricted') });
builderVector('server-opensearch-index', 'Server: namePrefixes computed from the index name.', 'server', {
  caller: users.osReader(), tool: tools.searchIndex, arguments: { index: 'logs-team-a-2026.10' },
  resource: { type: 'OpenSearch::Index', id: 'logs-team-a-2026.10', attrs: { name: 'logs-team-a-2026.10', tags: ['logs'] } } });
builderVector('server-gitlab-project', 'Server: GitLab project with parent group.', 'server', {
  caller: users.gitlabWriter(), tool: tools.updateProject, arguments: { projectPath: 'team-a/app' },
  resource: { type: 'GitLab::Project', id: 'team-a/app', attrs: { path: 'team-a/app' },
    parent: { type: 'GitLab::Group', id: 'team-a', attrs: { path: 'team-a' } } } });

// ---------- policy decisions ----------
outDir('policy-decisions');
let decisionCount = 0;
const decision = (name, description, level, input, expected, { covers = [], mutate } = {}) => {
  const built = build(level, input);
  if (mutate) mutate(built);
  decisionCount++;
  write('policy-decisions', name, {
    description,
    covers,
    // How request and entities were produced; implementations can rebuild them from this input.
    builder: { level, input, ...(mutate && { adjustment: 'remove-tool-entity' }) },
    policies: 'cedar/examples',
    request: { principal: built.principal, action: built.action, resource: built.resource, context: built.context },
    entities: built.entities,
    expected,
  });
};
const allow = (...determiningPolicies) => ({ decision: 'allow', determiningPolicies });
const deny = (...determiningPolicies) => ({ decision: 'deny', determiningPolicies });

decision('gw-jira-read-allowed', 'Reader calls a READ_ONLY Jira tool.', 'gateway',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' } }, allow('jira-call-read'));
decision('gw-no-group-denied', 'User without any mcp- group: default deny.', 'gateway',
  { caller: users.nobody(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' } }, deny(), { covers: ['no_group'] });
decision('gw-other-system-group-denied', 'mcp-gitlab-read does not open Jira.', 'gateway',
  { caller: users.gitlabReader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' } }, deny(), { covers: ['no_group'] });
decision('gw-update-without-write-group', 'UPDATE tool without mcp-jira-write.', 'gateway',
  { caller: users.reader(), tool: tools.updateIssue, arguments: { issueKey: 'ABC-1' } }, deny(), { covers: ['write_without_write_group'] });
decision('gw-update-allowed', 'UPDATE tool with mcp-jira-write; issue key alone is checked on the server.', 'gateway',
  { caller: users.writer(), tool: tools.updateIssue, arguments: { issueKey: 'ABC-1' } }, allow('jira-call-update'));
decision('gw-create-in-scope', 'Create in a project granted by mcp-jira-proj-ABC.', 'gateway',
  { caller: users.writer(), tool: tools.createIssue, arguments: { projectKey: 'ABC', summary: 'x' } }, allow('jira-call-update'));
decision('gw-create-outside-scope', 'Create in DEF without mcp-jira-proj-DEF: forbid wins over the group permit.', 'gateway',
  { caller: users.writer(), tool: tools.createIssue, arguments: { projectKey: 'DEF', summary: 'x' } },
  deny('jira-call-write-outside-scope'), { covers: ['forbid_overrides_permit'] });
decision('gw-destructive-fresh-mfa', 'DESTRUCTIVE with mcp-jira-destructive and MFA 120 s ago.', 'gateway',
  { caller: users.destroyer({ mfa: 120 }), tool: tools.deleteIssue, arguments: { issueKey: 'ABC-1' } }, allow('jira-call-destructive'));
decision('gw-destructive-unknown-mfa', 'DESTRUCTIVE without mfa claim (unknown = stale).', 'gateway',
  { caller: users.destroyer(), tool: tools.deleteIssue, arguments: { issueKey: 'ABC-1' } },
  deny('destructive-requires-fresh-mfa'), { covers: ['forbid_overrides_permit'] });
decision('gw-destructive-stale-mfa', 'DESTRUCTIVE with MFA two hours ago.', 'gateway',
  { caller: users.destroyer({ mfa: 7200 }), tool: tools.deleteIssue, arguments: { issueKey: 'ABC-1' } },
  deny('destructive-requires-fresh-mfa'), { covers: ['forbid_overrides_permit'] });
decision('gw-destructive-without-group', 'DESTRUCTIVE with fresh MFA but only read and write groups.', 'gateway',
  { caller: { ...users.writer(), mfa: 60 }, tool: tools.deleteIssue, arguments: { issueKey: 'ABC-1' } }, deny());
decision('gw-unknown-tool', 'Tool absent from the registry: no Tool entity, every policy errors or does not match, deny.', 'gateway',
  { caller: users.reader(), tool: tool('jira', 'drop_project', 'READ_ONLY', 'read'), arguments: {} }, deny(),
  { covers: ['unknown_tool'], mutate: (b) => { b.entities = b.entities.filter((e) => e.uid.type !== 'Tool'); } });
decision('gw-vs-narrows-project', 'Virtual server limited to ABC; user may write in DEF but not through this link.', 'gateway',
  { ...viaVs(users.writer2(), vs('team-a-dev', { 'Jira::Project': ['ABC'] })), tool: tools.createIssue, arguments: { projectKey: 'DEF' } },
  deny('vs-narrow-call-jira-project'), { covers: ['virtual_server_narrowing', 'forbid_overrides_permit'] });
decision('gw-vs-inside-narrowing', 'Same link, project ABC inside the narrowing.', 'gateway',
  { ...viaVs(users.writer2(), vs('team-a-dev', { 'Jira::Project': ['ABC'] })), tool: tools.createIssue, arguments: { projectKey: 'ABC' } },
  allow('jira-call-update'), { covers: ['virtual_server_narrowing'] });
decision('gw-vs-narrows-reads', 'Narrowing applies to reads too: search over ABC and DEF through an ABC-only link.', 'gateway',
  { ...viaVs(users.writer2(), vs('team-a-dev', { 'Jira::Project': ['ABC'] })), tool: tools.searchIssues, arguments: { projectKeys: ['ABC', 'DEF'] } },
  deny('vs-narrow-call-jira-project'), { covers: ['virtual_server_narrowing'] });
decision('gw-vs-other-type-not-narrowed', 'Link narrows Confluence spaces only; Jira projects are not narrowed by it.', 'gateway',
  { ...viaVs(users.writer2(), vs('docs', { 'Confluence::Space': ['ENG'] })), tool: tools.createIssue, arguments: { projectKey: 'DEF' } },
  allow('jira-call-update'), { covers: ['virtual_server_narrowing'] });
decision('gw-vs-cannot-grant', 'A link never grants: user without groups through a link that lists ABC.', 'gateway',
  { ...viaVs(users.nobody(), vs('team-a-dev', { 'Jira::Project': ['ABC'] })), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' } },
  deny(), { covers: ['virtual_server_narrowing', 'no_group'] });
decision('gw-search-read-any-project', 'Reads are not scope-limited at the gateway; the system enforces the user\'s own rights.', 'gateway',
  { caller: users.reader(), tool: tools.searchIssues, arguments: { projectKeys: ['ABC', 'HR'] } }, allow('jira-call-read'));
decision('gw-gitlab-read-allowed', 'GitLab reader.', 'gateway',
  { caller: users.gitlabReader(), tool: tools.getProject, arguments: { projectPath: 'team-a/app' } }, allow('gitlab-call-read'));
decision('gw-gitlab-write-without-group', 'GitLab UPDATE in a granted group, but without mcp-gitlab-write.', 'gateway',
  { caller: caller('gitlabReader', ['mcp-gitlab-read', 'mcp-gitlab-grp-team-a']), tool: tools.createProject, arguments: { groupPath: 'team-a' } },
  deny(), { covers: ['write_without_write_group'] });
decision('gw-gitlab-write-outside-scope', 'GitLab UPDATE into team-b with scope team-a.', 'gateway',
  { caller: users.gitlabWriter(), tool: tools.createProject, arguments: { groupPath: 'team-b' } },
  deny('gitlab-call-write-outside-scope'), { covers: ['forbid_overrides_permit'] });
decision('gw-gitlab-write-in-scope', 'GitLab UPDATE into team-a.', 'gateway',
  { caller: users.gitlabWriter(), tool: tools.createProject, arguments: { groupPath: 'team-a' } }, allow('gitlab-call-update'));

decision('srv-read-issue-allowed', 'Server: read an issue in a normal project.', 'server',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'ABC', 'Software') }, allow('jira-read'));
decision('srv-read-restricted-issue', 'Server: issue in a Restricted project; forbid wins over jira-read.', 'server',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'HR-7' }, resource: issue('HR-7', 'HR', 'Restricted') },
  deny('jira-forbid-restricted-issue'), { covers: ['restricted', 'forbid_overrides_permit'] });
decision('srv-moved-issue-restricted', 'Server: ABC-123 was moved to HR (Restricted); the argument still looks like ABC.', 'server',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-123' }, resource: issue('ABC-123', 'HR', 'Restricted') },
  deny('jira-forbid-restricted-issue'), { covers: ['restricted', 'forbid_overrides_permit'] });
decision('srv-read-restricted-project', 'Server: Restricted project itself.', 'server',
  { caller: users.reader(), tool: tools.searchIssues, arguments: { projectKeys: ['HR'] }, resource: project('HR', 'Restricted') },
  deny('jira-forbid-restricted-project'), { covers: ['restricted', 'forbid_overrides_permit'] });
decision('srv-read-project-without-category', 'Server: project with no category attribute (optional attribute, has-guard).', 'server',
  { caller: users.reader(), tool: tools.searchIssues, arguments: { projectKeys: ['ABC'] }, resource: project('ABC') }, allow('jira-read'));
decision('srv-read-without-group', 'Server: no mcp-jira-read.', 'server',
  { caller: users.nobody(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'ABC', 'Software') }, deny(), { covers: ['no_group'] });
decision('srv-update-in-scope', 'Server: update in ABC with mcp-jira-proj-ABC.', 'server',
  { caller: users.writer(), tool: tools.updateIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'ABC', 'Software') },
  allow('jira-update-issue-in-scope'));
decision('srv-update-outside-scope', 'Server: update an issue of DEF with scope ABC only.', 'server',
  { caller: users.writer(), tool: tools.updateIssue, arguments: { issueKey: 'DEF-5' }, resource: issue('DEF-5', 'DEF', 'Software') }, deny());
decision('srv-update-without-write-group', 'Server: update without mcp-jira-write.', 'server',
  { caller: users.reader(), tool: tools.updateIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'ABC', 'Software') },
  deny(), { covers: ['write_without_write_group'] });
decision('srv-delete-in-scope', 'Server: delete in scope with mcp-jira-destructive.', 'server',
  { caller: users.destroyer({ mfa: 120 }), tool: tools.deleteIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'ABC', 'Software') },
  allow('jira-delete-issue-in-scope'));
decision('srv-vs-narrows-issue', 'Server: read DEF-5 through a link limited to ABC.', 'server',
  { ...viaVs(users.writer2(), vs('team-a-dev', { 'Jira::Project': ['ABC'] })), tool: tools.getIssue, arguments: { issueKey: 'DEF-5' },
    resource: issue('DEF-5', 'DEF', 'Software') },
  deny('vs-narrow-jira-issue'), { covers: ['virtual_server_narrowing', 'forbid_overrides_permit'] });
decision('srv-gitlab-update-in-scope', 'Server: GitLab project in group team-a.', 'server', {
  caller: users.gitlabWriter(), tool: tools.updateProject, arguments: { projectPath: 'team-a/app' },
  resource: { type: 'GitLab::Project', id: 'team-a/app', attrs: { path: 'team-a/app' }, parent: { type: 'GitLab::Group', id: 'team-a', attrs: { path: 'team-a' } } },
}, allow('gitlab-update-project-in-scope'));
decision('srv-gitlab-update-outside-scope', 'Server: GitLab project in group team-b.', 'server', {
  caller: users.gitlabWriter(), tool: tools.updateProject, arguments: { projectPath: 'team-b/app' },
  resource: { type: 'GitLab::Project', id: 'team-b/app', attrs: { path: 'team-b/app' }, parent: { type: 'GitLab::Group', id: 'team-b', attrs: { path: 'team-b' } } },
}, deny());
decision('srv-opensearch-prefix-match', 'Server: index logs-team-a-2026.10 within prefix logs-team-a.', 'server', {
  caller: users.osReader(), tool: tools.searchIndex, arguments: { index: 'logs-team-a-2026.10' },
  resource: { type: 'OpenSearch::Index', id: 'logs-team-a-2026.10', attrs: { name: 'logs-team-a-2026.10', tags: ['logs'] } },
}, allow('opensearch-read-in-scope'));
decision('srv-opensearch-prefix-boundary', 'Server: logs-team-ab is not inside prefix logs-team-a (dash boundary).', 'server', {
  caller: users.osReader(), tool: tools.searchIndex, arguments: { index: 'logs-team-ab' },
  resource: { type: 'OpenSearch::Index', id: 'logs-team-ab', attrs: { name: 'logs-team-ab', tags: [] } },
}, deny());
decision('srv-confluence-restricted-page', 'Server: page in a space labelled restricted.', 'server', {
  caller: users.confluenceReader(), tool: tools.getPage, arguments: { pageId: '90210' },
  resource: { type: 'Confluence::Page', id: '90210', attrs: { id: '90210' },
    parent: { type: 'Confluence::Space', id: 'LEGAL', attrs: { key: 'LEGAL', labels: ['restricted'] } } },
}, deny('confluence-forbid-restricted-page'), { covers: ['restricted'] });

console.log(`policy decisions: ${decisionCount}`);
