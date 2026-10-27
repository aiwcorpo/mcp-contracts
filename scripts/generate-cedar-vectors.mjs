// Generates test-vectors/entity-builder and test-vectors/policy-decisions with scripts/lib/entity-builder.mjs.
// Expected decisions are written here by hand; the Java tests evaluate them with cedar-java.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { path } from './lib/contracts.mjs';
import { build, BuilderError, vscFromResourceDefaults } from './lib/entity-builder.mjs';

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
  sdReader: 'b1a7c0de-0000-4000-8000-00000000000a',
  confluenceEditor: 'b1a7c0de-0000-4000-8000-00000000000b',
  platform: 'b1a7c0de-0000-4000-8000-00000000000c',
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
  sdReader: () => caller('sdReader', ['mcp-servicedesk-read', 'mcp-servicedesk-queue-42']),
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
  updatePage: tool('confluence', 'update_page', 'UPDATE', 'update', [{ argument: 'pageId', type: 'Confluence::Page' }]),
  updateGroup: tool('gitlab', 'update_group', 'UPDATE', 'update', [{ argument: 'groupPath', type: 'GitLab::Group' }]),
  transferProject: tool('gitlab', 'transfer_project', 'UPDATE', 'update', [
    { argument: 'projectPath', type: 'GitLab::Project' }, { argument: 'targetGroup', type: 'GitLab::Group' }]),
  archiveProjects: tool('gitlab', 'archive_projects', 'UPDATE', 'update', [{ argument: 'projectPaths', type: 'GitLab::Project' }]),
  searchSpace: tool('confluence', 'search_space', 'READ_ONLY', 'read', [{ argument: 'spaceKey', type: 'Confluence::Space' }]),
  listQueueTickets: tool('servicedesk', 'list_queue_tickets', 'READ_ONLY', 'read', [{ argument: 'queueId', type: 'ServiceDesk::Queue' }]),
};

const project = (key, category = '') => ({ type: 'Jira::Project', id: key, attrs: { key, category } });
const issue = (key, projectKey, category) => ({ type: 'Jira::Issue', id: key, attrs: { key }, parent: project(projectKey, category) });
const vs = (slug, resourceDefaults) => ({ slug, ...(resourceDefaults && { resourceDefaults }) });
// The gateway puts the link into the internal JWT as vs + vsc (CC-027); both builders read only the claims.
const viaVs = (user, link) => ({ caller: { ...user, vs: link.slug, vsc: vscFromResourceDefaults(link.resourceDefaults) } });

// Scope mapping of the example bundle (CC-037); vectors refer to it by path.
const STATIC_PATH = 'cedar/examples/static-entities.json';
const STATIC = JSON.parse(readFileSync(path(STATIC_PATH), 'utf8'));

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
    expected = build(level, input, STATIC);
  } catch (e) {
    if (!(e instanceof BuilderError)) throw e;
    expected = { error: e.code };
  }
  write('entity-builder', name, { description, level, staticEntities: STATIC_PATH, input, expected });
};

builderVector('gateway-basic', 'Gateway: reader calls get_issue; issue key goes to refs.jiraIssue only.', 'gateway',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-123' } });
builderVector('scopes-from-mapping', 'principal.scopes come only from the bundle mapping: unmapped groups (even with a conventional name), names differing in case and non-mcp groups grant nothing; mcp-team-platform shows a name that does not encode its scopes.', 'gateway', {
  caller: caller('reader', [
    'mcp-jira-read', 'mcp-jira-proj-ABC', 'mcp-jira-proj-DEF', 'mcp-confluence-space-ENG', 'mcp-gitlab-grp-team-a',
    'mcp-opensearch-idx-logs-team-a', 'mcp-servicedesk-queue-42', 'mcp-client-claude-code', 'mcp-platform-admin',
    'mcp-gitlab-grp-team-c', 'mcp-jira-proj-abc', 'mcp-team-platform', 'employees',
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
builderVector('vsc-without-vs', 'vsc claim without vs: inconsistent input, denied (the JWT receiver already rejects it).', 'gateway',
  { caller: { ...users.reader(), vsc: { jiraProjects: ['ABC'] } }, tool: tools.getIssue, arguments: { issueKey: 'ABC-1' } });
builderVector('vs-without-vsc', 'vs claim without vsc: inconsistent input, denied.', 'gateway',
  { caller: { ...users.reader(), vs: 'team-a-dev' }, tool: tools.getIssue, arguments: { issueKey: 'ABC-1' } });
builderVector('tool-unknown-risk', 'Registry entry with a risk outside READ_ONLY, UPDATE, DESTRUCTIVE: denied, a typo must not bypass risk rules.', 'gateway',
  { caller: users.destroyer({ mfa: 60 }), tool: { ...tools.deleteIssue, risk: 'DESTRUCTlVE' }, arguments: { issueKey: 'ABC-1' } });
builderVector('server-virtual-server', 'Server: narrowing comes from the vsc claim, so a server can apply the link (CC-027).', 'server', {
  ...viaVs(users.writer2(), vs('team-a-dev', { 'Jira::Project': ['ABC'] })), tool: tools.getIssue, arguments: { issueKey: 'DEF-5' },
  resource: issue('DEF-5', 'DEF', 'Software') });
builderVector('mfa-age', 'mfa claim becomes principal.mfaAge and context.mfaAge.', 'gateway',
  { caller: users.destroyer({ mfa: 120 }), tool: tools.deleteIssue, arguments: { issueKey: 'ABC-1' } });
builderVector('server-jira-issue', 'Server: resolved issue with parent project; project attribute duplicates the parent edge.', 'server',
  { caller: users.writer(), tool: tools.updateIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'ABC', 'Software') });
builderVector('server-jira-issue-moved', 'Server: issue key says ABC but the system resolved it into HR (Restricted).', 'server',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-123' }, resource: issue('ABC-123', 'HR', 'Restricted') });
builderVector('server-opensearch-index', 'Server: index scopes are every dash prefix of the name.', 'server', {
  caller: users.osReader(), tool: tools.searchIndex, arguments: { index: 'logs-team-a-2026.10' },
  resource: { type: 'OpenSearch::Index', id: 'logs-team-a-2026.10', attrs: { name: 'logs-team-a-2026.10', tags: ['logs'] } } });
builderVector('server-gitlab-project', 'Server: GitLab project in a subgroup; scopes are every ancestor group path.', 'server', {
  caller: users.gitlabWriter(), tool: tools.updateProject, arguments: { projectPath: 'team-a/sub/app' },
  resource: { type: 'GitLab::Project', id: 'team-a/sub/app', attrs: { path: 'team-a/sub/app' },
    parent: { type: 'GitLab::Group', id: 'team-a/sub', attrs: { path: 'team-a/sub' } } } });
builderVector('server-confluence-page-tree', 'Server: page scopes are its space, its ancestor pages and itself.', 'server', {
  caller: caller('confluenceEditor', ['mcp-confluence-read', 'mcp-confluence-write', 'mcp-confluence-handbook-editors']),
  tool: tools.updatePage, arguments: { pageId: '1234' },
  resource: { type: 'Confluence::Page', id: '1234', attrs: { id: '1234', ancestorIds: ['1100', '1000'] },
    parent: { type: 'Confluence::Space', id: 'HB', attrs: { key: 'HB', labels: [] } } } });
builderVector('resource-null-attribute', 'A null attribute from the resolver means "no attribute"; for the required classification (category) the builder refuses the entity (CC-062).', 'server',
  { caller: users.reader(), tool: tools.searchIssues, arguments: { projectKeys: ['ABC'] },
    resource: { type: 'Jira::Project', id: 'ABC', attrs: { key: 'ABC', category: null } } });
builderVector('resource-missing-classification-parent', 'Issue whose resolved project lacks category: refused (CC-062).', 'server',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' },
    resource: { type: 'Jira::Issue', id: 'ABC-1', attrs: { key: 'ABC-1' }, parent: { type: 'Jira::Project', id: 'ABC', attrs: { key: 'ABC' } } } });
builderVector('resource-missing-labels', 'Confluence space without labels: refused (CC-062).', 'server',
  { caller: users.confluenceReader(), tool: tools.searchSpace, arguments: { spaceKey: 'ENG' },
    resource: { type: 'Confluence::Space', id: 'ENG', attrs: { key: 'ENG' } } });
builderVector('mfa-negative', 'Negative mfa age is not possible; refused like the JWT schema (minimum 0, CC-065).', 'gateway',
  { caller: users.destroyer({ mfa: -5 }), tool: tools.deleteIssue, arguments: { issueKey: 'ABC-1' } });
builderVector('refs-opensearch-index-list', 'Index argument with a comma list: not one concrete index name (CC-056, review H1).', 'gateway',
  { caller: users.osReader(), tool: tools.searchIndex, arguments: { index: 'logs-team-a-x,secret-y' } });
builderVector('refs-opensearch-index-wildcard', 'Index argument with wildcards (CC-056).', 'gateway',
  { caller: users.osReader(), tool: tools.searchIndex, arguments: { index: 'logs-team-a-*,*' } });
builderVector('refs-jira-project-injection', 'Project key that would break out of a JQL list (CC-056, review H2).', 'gateway',
  { caller: users.writer(), tool: tools.createIssue, arguments: { projectKey: 'ABC) OR project in (HR' } });
builderVector('refs-gitlab-path-traversal', 'GitLab path with .. segments.', 'gateway',
  { caller: users.gitlabWriter(), tool: tools.createProject, arguments: { groupPath: 'team-a/../team-b' } });
builderVector('resolved-resource-invalid-id', 'Resolver returned an index id with a comma; the builder refuses to build it.', 'server', {
  caller: users.osReader(), tool: tools.searchIndex, arguments: {},
  resource: { type: 'OpenSearch::Index', id: 'logs-team-a,secret', attrs: { name: 'logs-team-a,secret', tags: [] } } });
builderVector('vsc-invalid-id', 'vsc id outside the Jira key pattern.', 'gateway',
  { caller: { ...users.reader(), vs: 'team-a-dev', vsc: { jiraProjects: ['ABC) OR project in (HR'] } }, tool: tools.getIssue, arguments: { issueKey: 'ABC-1' } });
builderVector('tool-unknown-resource-type', 'resourceRefs with a type outside the model: denied.', 'gateway',
  { caller: users.reader(), tool: tool('jira', 'get_board', 'READ_ONLY', 'read', [{ argument: 'boardId', type: 'Jira::Board' }]), arguments: { boardId: '7' } });

// ---------- policy decisions ----------
outDir('policy-decisions');
let decisionCount = 0;
const decision = (name, description, level, input, expected, { covers = [], mutate } = {}) => {
  const built = build(level, input, STATIC);
  if (mutate) mutate(built);
  decisionCount++;
  write('policy-decisions', name, {
    description,
    covers,
    // How request and entities were produced; implementations can rebuild them from this input.
    builder: { level, staticEntities: STATIC_PATH, input, ...(mutate && { adjustment: 'remove-tool-entity' }) },
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
decision('gw-gitlab-write-outside-scope-passes-gateway', 'GitLab UPDATE into team-b with scope team-a passes the gateway: group scopes are hierarchical and checked by the server (srv-gitlab-create-in-sibling-group).', 'gateway',
  { caller: users.gitlabWriter(), tool: tools.createProject, arguments: { groupPath: 'team-b' } }, allow('gitlab-call-update'));
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
decision('srv-read-project-without-category', 'Server: project without a category in Jira (category "" by the resolver).', 'server',
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
const group = (groupPath) => ({ type: 'GitLab::Group', id: groupPath, attrs: { path: groupPath } });
const projectIn = (projectPath) => ({ type: 'GitLab::Project', id: projectPath, attrs: { path: projectPath },
  parent: group(projectPath.slice(0, projectPath.lastIndexOf('/'))) });
decision('srv-gitlab-subgroup-covered', 'Server: grant on team-a covers a project in subgroup team-a/sub (CC-037).', 'server',
  { caller: users.gitlabWriter(), tool: tools.updateProject, arguments: { projectPath: 'team-a/sub/app' }, resource: projectIn('team-a/sub/app') },
  allow('gitlab-update-project-in-scope'), { covers: ['scope_hierarchy'] });
decision('srv-gitlab-sibling-not-covered', 'Server: grant on team-a does not cover sibling group team-b.', 'server',
  { caller: users.gitlabWriter(), tool: tools.updateProject, arguments: { projectPath: 'team-b/sub/app' }, resource: projectIn('team-b/sub/app') },
  deny(), { covers: ['scope_hierarchy'] });
decision('srv-gitlab-similar-prefix-not-covered', 'Server: grant on team-a does not cover team-ab (path segments, not string prefix).', 'server',
  { caller: users.gitlabWriter(), tool: tools.updateProject, arguments: { projectPath: 'team-ab/app' }, resource: projectIn('team-ab/app') },
  deny(), { covers: ['scope_hierarchy'] });
decision('srv-gitlab-group-without-mapping', 'Server: mcp-gitlab-grp-team-c follows the naming convention but has no mapping in the bundle, so it grants nothing.', 'server',
  { caller: caller('gitlabWriter', ['mcp-gitlab-read', 'mcp-gitlab-write', 'mcp-gitlab-grp-team-c']), tool: tools.updateProject,
    arguments: { projectPath: 'team-c/app' }, resource: projectIn('team-c/app') },
  deny(), { covers: ['scope_hierarchy', 'no_group'] });
decision('srv-gitlab-mapping-name-without-path', 'Server: mcp-team-platform grants GitLab group platform although its name encodes no path.', 'server',
  { caller: caller('platform', ['mcp-gitlab-read', 'mcp-gitlab-write', 'mcp-team-platform']), tool: tools.updateProject,
    arguments: { projectPath: 'platform/api' }, resource: projectIn('platform/api') },
  allow('gitlab-update-project-in-scope'), { covers: ['scope_hierarchy'] });
decision('srv-gitlab-create-in-sibling-group', 'Server: creating a project in team-b (resolved group) with scope team-a.', 'server',
  { caller: users.gitlabWriter(), tool: tools.createProject, arguments: { groupPath: 'team-b' }, resource: group('team-b') }, deny());
decision('srv-gitlab-create-in-subgroup', 'Server: creating a project in team-a/sub with scope team-a.', 'server',
  { caller: users.gitlabWriter(), tool: tools.createProject, arguments: { groupPath: 'team-a/sub' }, resource: group('team-a/sub') },
  allow('gitlab-update-group-in-scope'), { covers: ['scope_hierarchy'] });
const editor = () => caller('confluenceEditor', ['mcp-confluence-read', 'mcp-confluence-write', 'mcp-confluence-handbook-editors']);
decision('srv-confluence-page-tree-covered', 'Server: page 1234 under granted page 1000.', 'server',
  { caller: editor(), tool: tools.updatePage, arguments: { pageId: '1234' },
    resource: { type: 'Confluence::Page', id: '1234', attrs: { id: '1234', ancestorIds: ['1000', '1100'] }, parent: { type: 'Confluence::Space', id: 'HB', attrs: { key: 'HB', labels: [] } } } },
  allow('confluence-update-page-in-scope'), { covers: ['scope_hierarchy'] });
decision('srv-confluence-page-outside-tree', 'Server: page 2000 in another tree of the same space.', 'server',
  { caller: editor(), tool: tools.updatePage, arguments: { pageId: '2000' },
    resource: { type: 'Confluence::Page', id: '2000', attrs: { id: '2000', ancestorIds: ['1999'] }, parent: { type: 'Confluence::Space', id: 'HB', attrs: { key: 'HB', labels: [] } } } },
  deny(), { covers: ['scope_hierarchy'] });
decision('gw-vs-search-without-project-passes-gateway', 'Search without project keys through a link limited to ABC passes the gateway (nothing to compare); the server must narrow the query and filter results (CC-036).', 'gateway',
  { ...viaVs(users.writer2(), vs('team-a-dev', { 'Jira::Project': ['ABC'] })), tool: tools.searchIssues, arguments: { text: 'outage' } },
  allow('jira-call-read'), { covers: ['virtual_server_narrowing', 'search_results'] });
decision('srv-vs-search-result-outside-link', 'Server, result filtering: issue DEF-9 returned by the search is outside the link and is dropped.', 'server',
  { ...viaVs(users.writer2(), vs('team-a-dev', { 'Jira::Project': ['ABC'] })), tool: tools.searchIssues, arguments: { text: 'outage' },
    resource: issue('DEF-9', 'DEF', 'Software') },
  deny('vs-narrow-jira-issue'), { covers: ['virtual_server_narrowing', 'search_results', 'forbid_overrides_permit'] });
decision('srv-vs-search-result-inside-link', 'Server, result filtering: issue ABC-7 is kept.', 'server',
  { ...viaVs(users.writer2(), vs('team-a-dev', { 'Jira::Project': ['ABC'] })), tool: tools.searchIssues, arguments: { text: 'outage' },
    resource: issue('ABC-7', 'ABC', 'Software') },
  allow('jira-read'), { covers: ['virtual_server_narrowing', 'search_results'] });
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
}, deny('confluence-forbid-restricted-page'), { covers: ['restricted', 'forbid_overrides_permit'] });

const page = (id, spaceKey, labels = []) => ({ type: 'Confluence::Page', id, attrs: { id },
  parent: { type: 'Confluence::Space', id: spaceKey, attrs: { key: spaceKey, labels } } });
const ticket = (id, queueId) => ({ type: 'ServiceDesk::Ticket', id, attrs: { id },
  parent: { type: 'ServiceDesk::Queue', id: queueId, attrs: { id: queueId } } });
const gitlabProject = (projectPath) => {
  const group = projectPath.slice(0, projectPath.lastIndexOf('/'));
  return { type: 'GitLab::Project', id: projectPath, attrs: { path: projectPath },
    parent: { type: 'GitLab::Group', id: group, attrs: { path: group } } };
};

decision('gw-confluence-read-allowed', 'Confluence reader calls a READ_ONLY Confluence tool.', 'gateway',
  { caller: users.confluenceReader(), tool: tools.searchSpace, arguments: { spaceKey: 'OPS' } }, allow('confluence-call-read'));
decision('gw-vs-narrows-confluence-space', 'Link limited to space ENG; tool names space OPS.', 'gateway',
  { ...viaVs(users.confluenceReader(), vs('eng-docs', { 'Confluence::Space': ['ENG'] })), tool: tools.searchSpace, arguments: { spaceKey: 'OPS' } },
  deny('vs-narrow-call-confluence-space'), { covers: ['virtual_server_narrowing', 'forbid_overrides_permit'] });
decision('gw-vs-narrows-servicedesk-queue', 'Link limited to queue 42; tool names queue 7.', 'gateway',
  { ...viaVs(users.sdReader(), vs('support', { 'ServiceDesk::Queue': ['42'] })), tool: tools.listQueueTickets, arguments: { queueId: 7 } },
  deny('vs-narrow-call-servicedesk-queue'), { covers: ['virtual_server_narrowing', 'forbid_overrides_permit'] });
decision('srv-confluence-read-allowed', 'Server: page in a normal space.', 'server',
  { caller: users.confluenceReader(), tool: tools.getPage, arguments: { pageId: '1001' }, resource: page('1001', 'ENG') }, allow('confluence-read'));
decision('srv-vs-narrows-confluence-page', 'Server: page in OPS through a link limited to ENG.', 'server',
  { ...viaVs(users.confluenceReader(), vs('eng-docs', { 'Confluence::Space': ['ENG'] })), tool: tools.getPage, arguments: { pageId: '2002' },
    resource: page('2002', 'OPS') },
  deny('vs-narrow-confluence-page'), { covers: ['virtual_server_narrowing', 'forbid_overrides_permit'] });
decision('srv-servicedesk-read-allowed', 'Server: ticket in queue 42.', 'server',
  { caller: users.sdReader(), tool: tools.getTicket, arguments: { ticketId: 501 }, resource: ticket('501', '42') }, allow('servicedesk-read'));
decision('srv-vs-narrows-servicedesk-ticket', 'Server: ticket in queue 7 through a link limited to queue 42.', 'server',
  { ...viaVs(users.sdReader(), vs('support', { 'ServiceDesk::Queue': ['42'] })), tool: tools.getTicket, arguments: { ticketId: 777 },
    resource: ticket('777', '7') },
  deny('vs-narrow-servicedesk-ticket'), { covers: ['virtual_server_narrowing', 'forbid_overrides_permit'] });
decision('srv-vs-narrows-gitlab-project', 'Server: project of team-b through a link limited to group team-a.', 'server',
  { ...viaVs(users.gitlabReader(), vs('team-a-code', { 'GitLab::Group': ['team-a'] })), tool: tools.getProject, arguments: { projectPath: 'team-b/app' },
    resource: gitlabProject('team-b/app') },
  deny('vs-narrow-gitlab-project'), { covers: ['virtual_server_narrowing', 'forbid_overrides_permit'] });
decision('srv-vs-inside-gitlab-group', 'Server: project of team-a through the same link.', 'server',
  { ...viaVs(users.gitlabReader(), vs('team-a-code', { 'GitLab::Group': ['team-a'] })), tool: tools.getProject, arguments: { projectPath: 'team-a/app' },
    resource: gitlabProject('team-a/app') },
  allow('gitlab-read'), { covers: ['virtual_server_narrowing'] });
decision('srv-vs-narrows-opensearch-index', 'Server: index of another team through a link limited to prefix logs-team-a.', 'server',
  { ...viaVs(caller('osReader', ['mcp-opensearch-read', 'mcp-opensearch-idx-logs-team-a', 'mcp-opensearch-idx-logs-team-b']),
    vs('team-a-logs', { 'OpenSearch::Index': ['logs-team-a'] })), tool: tools.searchIndex, arguments: { index: 'logs-team-b-2026.10' },
    resource: { type: 'OpenSearch::Index', id: 'logs-team-b-2026.10', attrs: { name: 'logs-team-b-2026.10', tags: [] } } },
  deny('vs-narrow-opensearch-index'), { covers: ['virtual_server_narrowing', 'forbid_overrides_permit'] });

console.log(`policy decisions: ${decisionCount}`);

// ---------- result filtering (CC-036) ----------
outDir('result-filter');
const resultFilter = (name, description, input, items, kept, queryConstraints) =>
  write('result-filter', name, { description, staticEntities: STATIC_PATH, policies: 'cedar/examples', input, items,
    expected: { kept, queryConstraints } });

resultFilter('jira-search-through-link',
  'Search through a link limited to ABC: the server limits the JQL to the intersection and drops every returned issue outside the link, Restricted ones and ones it cannot evaluate.',
  { ...viaVs(users.writer2(), vs('team-a-dev', { 'Jira::Project': ['ABC'] })), tool: tools.searchIssues, arguments: { text: 'outage' } },
  [issue('ABC-7', 'ABC', 'Software'), issue('DEF-9', 'DEF', 'Software'), issue('HR-1', 'HR', 'Restricted'),
    { type: 'Jira::Issue', id: 'ABC-8', attrs: { key: 'ABC-8' } }],
  ['ABC-7'],
  { 'Jira::Project': { virtualServer: ['ABC'], virtualServerType: 'Jira::Project', granted: ['ABC', 'DEF'] } });
resultFilter('opensearch-search-without-link',
  'OpenSearch search: the index pattern is limited to granted prefixes, and results from other indices are dropped.',
  { caller: users.osReader(), tool: tools.searchIndex, arguments: {} },
  [{ type: 'OpenSearch::Index', id: 'logs-team-a-2026.10', attrs: { name: 'logs-team-a-2026.10', tags: [] } },
    { type: 'OpenSearch::Index', id: 'logs-team-b-2026.10', attrs: { name: 'logs-team-b-2026.10', tags: [] } },
    { type: 'OpenSearch::Index', id: 'logs-team-ab', attrs: { name: 'logs-team-ab', tags: [] } }],
  ['logs-team-a-2026.10'],
  { 'OpenSearch::Index': { virtualServer: null, virtualServerType: 'OpenSearch::Index', granted: ['logs-team-a'] } });
resultFilter('gitlab-projects-through-link',
  'GitLab project list through a link limited to group team-a: subgroup projects are kept, other groups and team-ab are dropped.',
  { ...viaVs(users.gitlabReader(), vs('team-a-code', { 'GitLab::Group': ['team-a'] })), tool: tools.getProject, arguments: {} },
  [projectIn('team-a/app'), projectIn('team-a/sub/svc'), projectIn('team-b/app'), projectIn('team-ab/app')],
  ['team-a/app', 'team-a/sub/svc'],
  { 'GitLab::Group': { virtualServer: ['team-a'], virtualServerType: 'GitLab::Group', granted: [] } });
resultFilter('confluence-pages-through-link',
  'Confluence page search through a link limited to space ENG: the page query is narrowed by space; pages of OPS and of a restricted space are dropped.',
  { ...viaVs(users.confluenceReader(), vs('eng-docs', { 'Confluence::Space': ['ENG'] })), tool: tools.getPage, arguments: {} },
  [page('1001', 'ENG'), page('2002', 'OPS'), page('3003', 'ENG', ['restricted'])],
  ['1001'],
  { 'Confluence::Page': { virtualServer: ['ENG'], virtualServerType: 'Confluence::Space', granted: [] },
    'Confluence::Space': { virtualServer: ['ENG'], virtualServerType: 'Confluence::Space', granted: ['ENG'] } });
resultFilter('servicedesk-tickets-through-link',
  'Service desk ticket list through a link limited to queue 42.',
  { ...viaVs(users.sdReader(), vs('support', { 'ServiceDesk::Queue': ['42'] })), tool: tools.getTicket, arguments: {} },
  [ticket('501', '42'), ticket('777', '7')],
  ['501'],
  { 'ServiceDesk::Queue': { virtualServer: ['42'], virtualServerType: 'ServiceDesk::Queue', granted: ['42'] } });
resultFilter('opensearch-no-grants',
  'User with mcp-opensearch-read but no mapped index prefix: granted is empty, so the server must not query at all; any returned index is dropped.',
  { caller: caller('osReader', ['mcp-opensearch-read', 'mcp-opensearch-idx-unmapped']), tool: tools.searchIndex, arguments: {} },
  [{ type: 'OpenSearch::Index', id: 'logs-team-a-2026.10', attrs: { name: 'logs-team-a-2026.10', tags: [] } }],
  [],
  { 'OpenSearch::Index': { virtualServer: null, virtualServerType: 'OpenSearch::Index', granted: [] } });

// ---------- every value of every resourceRef (CC-061) ----------
outDir('resource-checks');
const resourceCheck = (name, description, input, resources, allowed) =>
  write('resource-checks', name, { description, staticEntities: STATIC_PATH, policies: 'cedar/examples', input, resources,
    expected: { allowed } });
resourceCheck('transfer-inside-scope', 'Transfer team-a/app to team-a/sub: source project and target group are both evaluated and allowed.',
  { caller: users.gitlabWriter(), tool: tools.transferProject, arguments: { projectPath: 'team-a/app', targetGroup: 'team-a/sub' } },
  [projectIn('team-a/app'), group('team-a/sub')], true);
resourceCheck('transfer-to-sibling-group', 'Transfer team-a/app to team-b: the source is allowed, the target is not, so the call is denied.',
  { caller: users.gitlabWriter(), tool: tools.transferProject, arguments: { projectPath: 'team-a/app', targetGroup: 'team-b' } },
  [projectIn('team-a/app'), group('team-b')], false);
resourceCheck('transfer-from-sibling-group', 'Transfer team-b/app into team-a: the target is allowed, the source is not.',
  { caller: users.gitlabWriter(), tool: tools.transferProject, arguments: { projectPath: 'team-b/app', targetGroup: 'team-a' } },
  [projectIn('team-b/app'), group('team-a')], false);
resourceCheck('array-with-one-outside', 'Archive three projects; one of them is outside the scope, so the whole call is denied.',
  { caller: users.gitlabWriter(), tool: tools.archiveProjects, arguments: { projectPaths: ['team-a/app', 'team-a/sub/svc', 'team-ab/app'] } },
  [projectIn('team-a/app'), projectIn('team-a/sub/svc'), projectIn('team-ab/app')], false);
resultFilter('jira-project-without-category', 'An element whose project the resolver returned without category is dropped (CC-062).',
  { caller: users.reader(), tool: tools.searchIssues, arguments: {} },
  [issue('ABC-7', 'ABC', 'Software'), { type: 'Jira::Issue', id: 'ABC-8', attrs: { key: 'ABC-8' }, parent: { type: 'Jira::Project', id: 'ABC', attrs: { key: 'ABC' } } }],
  ['ABC-7'],
  { 'Jira::Project': { virtualServer: null, virtualServerType: 'Jira::Project', granted: [] } });
decision('srv-transfer-target-outside-scope', 'Server, transfer_project: the target group team-b is evaluated on its own and denied (CC-061).', 'server',
  { caller: users.gitlabWriter(), tool: tools.transferProject, arguments: { projectPath: 'team-a/app', targetGroup: 'team-b' }, resource: group('team-b') },
  deny(), { covers: ['scope_hierarchy', 'every_resource_ref'] });
decision('srv-transfer-source-in-scope', 'Server, transfer_project: the source project team-a/app is allowed; the call still needs every other value allowed.', 'server',
  { caller: users.gitlabWriter(), tool: tools.transferProject, arguments: { projectPath: 'team-a/app', targetGroup: 'team-b' }, resource: projectIn('team-a/app') },
  allow('gitlab-update-project-in-scope'), { covers: ['scope_hierarchy', 'every_resource_ref'] });
