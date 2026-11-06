// Generates test-vectors/entity-builder, policy-decisions, result-filter, resource-checks and resource-ids with
// scripts/lib/entity-builder.mjs. Expected decisions are written here by hand; the Java tests evaluate them with cedar-java.
// No vector depends on a system being built in: every one names the resourceTypes declarations it runs on, either the
// Jira example (cedar/examples/systems/jira), the neutral Notes fixture (test-vectors/fixtures/notes) or, for the id and
// scope derivations of the former built-in systems, the other example declarations.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { path } from './lib/contracts.mjs';
import {
  build as buildEntities, BuilderError, dashPrefixes, loadResourceTypes, pathPrefixes, scopeMapping, validId, validScopeLocalId,
} from './lib/entity-builder.mjs';

const JIRA = 'cedar/examples/systems/jira/resource-types.json';
const NOTES = 'test-vectors/fixtures/notes/resource-types.json';
const CONFLUENCE = 'cedar/examples/systems/confluence/resource-types.json';
const GITLAB = 'cedar/examples/systems/gitlab/resource-types.json';
const OPENSEARCH = 'cedar/examples/systems/opensearch/resource-types.json';
const SERVICEDESK = 'cedar/examples/systems/servicedesk/resource-types.json';
const MAPPING = 'test-vectors/fixtures/scope-mapping.json';
const MAPPING_EXAMPLE_SYSTEMS = 'test-vectors/fixtures/scope-mapping-example-systems.json';

const SUB = {
  reader: 'b1a7c0de-0000-4000-8000-000000000001',
  writer: 'b1a7c0de-0000-4000-8000-000000000002',
  writer2: 'b1a7c0de-0000-4000-8000-000000000003',
  destroyer: 'b1a7c0de-0000-4000-8000-000000000004',
  nobody: 'b1a7c0de-0000-4000-8000-000000000005',
  notesReader: 'b1a7c0de-0000-4000-8000-000000000006',
  notesWriter: 'b1a7c0de-0000-4000-8000-000000000007',
  notesDestroyer: 'b1a7c0de-0000-4000-8000-000000000008',
  teamWriter: 'b1a7c0de-0000-4000-8000-000000000009',
  weatherReader: 'b1a7c0de-0000-4000-8000-00000000000a',
  confluenceReader: 'b1a7c0de-0000-4000-8000-00000000000b',
  gitlabWriter: 'b1a7c0de-0000-4000-8000-00000000000c',
};
const caller = (name, grp, extra = {}) => ({ sub: SUB[name], usr: name.toLowerCase(), grp, azp: 'claude-code', ...extra });
const users = {
  reader: () => caller('reader', ['mcp-jira-read']),
  writer: () => caller('writer', ['mcp-jira-read', 'mcp-jira-write', 'mcp-jira-proj-ABC']),
  writer2: () => caller('writer2', ['mcp-jira-read', 'mcp-jira-write', 'mcp-jira-proj-ABC', 'mcp-jira-proj-DEF']),
  destroyer: (extra) => caller('destroyer', ['mcp-jira-read', 'mcp-jira-destructive', 'mcp-jira-proj-ABC'], extra),
  nobody: () => caller('nobody', []),
  notesReader: () => caller('notesReader', ['mcp-notes-read']),
  notesWriter: () => caller('notesWriter', ['mcp-notes-read', 'mcp-notes-write', 'mcp-notes-nb-alpha', 'mcp-notes-folder-team']),
  notesDestroyer: () => caller('notesDestroyer', ['mcp-notes-read', 'mcp-notes-destructive', 'mcp-notes-nb-alpha']),
  weatherReader: () => caller('weatherReader', ['mcp-weather-read']),
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
  getNote: tool('notes', 'get_note', 'READ_ONLY', 'read', [{ argument: 'noteId', type: 'Notes::Note' }]),
  getFolder: tool('notes', 'get_folder', 'READ_ONLY', 'read', [{ argument: 'folderPath', type: 'Notes::Folder' }]),
  searchNotebooks: tool('notes', 'search_notebooks', 'READ_ONLY', 'read', [{ argument: 'notebook', type: 'Notes::Notebook' }]),
  searchFolders: tool('notes', 'search_folders', 'READ_ONLY', 'read', [{ argument: 'folderPath', type: 'Notes::Folder' }]),
  updateNote: tool('notes', 'update_note', 'UPDATE', 'update', [{ argument: 'noteId', type: 'Notes::Note' }]),
  updateNotebook: tool('notes', 'update_notebook', 'UPDATE', 'update', [{ argument: 'notebook', type: 'Notes::Notebook' }]),
  updateFolder: tool('notes', 'update_folder', 'UPDATE', 'update', [{ argument: 'folderPath', type: 'Notes::Folder' }]),
  deleteNote: tool('notes', 'delete_note', 'DESTRUCTIVE', 'delete', [{ argument: 'noteId', type: 'Notes::Note' }]),
  moveFolder: tool('notes', 'move_folder', 'UPDATE', 'update', [
    { argument: 'folderPath', type: 'Notes::Folder' }, { argument: 'targetFolder', type: 'Notes::Folder' }]),
  archiveFolders: tool('notes', 'archive_folders', 'UPDATE', 'update', [{ argument: 'folderPaths', type: 'Notes::Folder' }]),
  forecast: tool('weather', 'forecast', 'READ_ONLY', 'read'),
};

const project = (key, category = '') => ({ type: 'Jira::Project', id: key, attrs: { key, category }, scopes: [`Jira::Project/${key}`] });
const issue = (key, projectKey, category) => ({
  type: 'Jira::Issue', id: key, attrs: { key }, parent: project(projectKey, category), scopes: [`Jira::Project/${projectKey}`],
});
const notebook = (id, labels = []) => ({ type: 'Notes::Notebook', id, attrs: { name: id, labels }, scopes: [`Notes::Notebook/${id}`] });
const note = (id, notebookId, labels, attrs = {}) => ({
  type: 'Notes::Note', id, attrs: { title: `Note ${id}`, ...attrs }, parent: notebook(notebookId, labels), scopes: [`Notes::Notebook/${notebookId}`],
});
// The server derives the scopes of a folder from its path; the vectors use the same prefix rule the starter offers.
const folder = (id, classification) => ({
  type: 'Notes::Folder', id, attrs: { path: id, ...(classification !== undefined && { classification }) },
  scopes: pathPrefixes(id).map((p) => `Notes::Folder/${p}`),
});

const outDir = (name) => {
  rmSync(path('test-vectors', name), { recursive: true, force: true });
  mkdirSync(path('test-vectors', name), { recursive: true });
};
const write = (dir, name, value) => writeFileSync(path('test-vectors', dir, `${name}.json`), JSON.stringify(value, null, 2) + '\n');

const registries = new Map();
const registry = (paths) => {
  const key = paths.join('|');
  if (!registries.has(key)) registries.set(key, loadResourceTypes(paths));
  return registries.get(key);
};
const mappingFor = (types, mappingPath) => scopeMapping(types, JSON.parse(readFileSync(path(mappingPath), 'utf8')));
const buildFor = (level, input, { resourceTypes = [JIRA, NOTES], scopeMappingPath = MAPPING } = {}) => {
  const types = registry(resourceTypes);
  return buildEntities(level, input, types, mappingFor(types, scopeMappingPath));
};

// ---------- entity builder ----------
outDir('entity-builder');
const builderVector = (name, description, level, input, options = {}) => {
  const { resourceTypes = [JIRA, NOTES], scopeMappingPath = MAPPING } = options;
  let expected;
  try {
    expected = buildFor(level, input, options);
  } catch (e) {
    if (!(e instanceof BuilderError)) throw e;
    expected = { error: e.code };
  }
  write('entity-builder', name, { description, level, resourceTypes, scopeMapping: scopeMappingPath, input, expected });
};

builderVector('gateway-basic', 'Gateway: reader calls get_issue; Jira::Issue is not an early-check type, so refs is empty, and the tool needs the group mcp-jira-read.', 'gateway',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-123' } });
builderVector('gateway-early-scope-refs', 'Only the ids of types declared earlyScopeCheck reach context.refs, as ResourceScope ids.', 'gateway',
  { caller: users.writer(), tool: tools.createIssue, arguments: { projectKey: 'ABC' } });
builderVector('gateway-required-group-update', 'Tool.requiredGroup of an UPDATE tool is mcp-<system>-write.', 'gateway',
  { caller: users.writer(), tool: tools.updateIssue, arguments: { issueKey: 'ABC-1' } });
builderVector('gateway-required-group-destructive', 'Tool.requiredGroup of a DESTRUCTIVE tool is mcp-<system>-destructive, for a system the contracts have never heard of.', 'gateway',
  { caller: users.notesDestroyer(), tool: tools.deleteNote, arguments: { noteId: '17' } });
builderVector('gateway-unlisted-system', 'A system that appears nowhere in the contracts: the Tool entity is built from the tool entry alone.', 'gateway',
  { caller: users.weatherReader(), tool: tools.forecast, arguments: {} });
builderVector('scopes-from-mapping', 'User.scopes is one flat set of every scope of the mapped groups: unmapped groups (even with a conventional name), names differing in case and non-mcp groups grant nothing; mcp-team-platform shows a name that does not encode its scopes.', 'gateway', {
  caller: caller('reader', [
    'mcp-jira-read', 'mcp-jira-proj-ABC', 'mcp-jira-proj-DEF', 'mcp-notes-nb-alpha', 'mcp-notes-folder-team', 'mcp-notes-folder-team-sub',
    'mcp-client-claude-code', 'mcp-platform-admin', 'mcp-notes-folder-unmapped', 'mcp-jira-proj-abc', 'mcp-team-platform', 'employees',
  ]),
  tool: tools.listProjects,
  arguments: {},
});
builderVector('refs-array-deduplicated', 'Array argument becomes a sorted set without duplicates.', 'gateway',
  { caller: users.reader(), tool: tools.searchIssues, arguments: { projectKeys: ['DEF', 'ABC', 'ABC'] } });
builderVector('refs-missing-argument', 'Declared resourceRef whose argument is absent: refs is an empty set.', 'gateway',
  { caller: users.reader(), tool: tools.searchIssues, arguments: {} });
builderVector('refs-integer-id', 'An integer argument is converted to its decimal string and checked against the idPattern of the type.', 'gateway',
  { caller: users.notesReader(), tool: tools.getNote, arguments: { noteId: 4711 } });
builderVector('refs-integer-id-out-of-pattern', 'An integer that does not match the idPattern (leading zero is impossible, so 0) is refused.', 'gateway',
  { caller: users.notesReader(), tool: tools.getNote, arguments: { noteId: 0 } });
builderVector('refs-invalid-object', 'Object as a resource id: builder fails, the call is denied (fail-closed, invalid_argument).', 'gateway',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: { key: 'ABC-123' } } });
builderVector('refs-two-arguments-same-type', 'Two arguments of the same type are merged into one set.', 'gateway',
  { caller: users.writer(), tool: tools.moveIssue, arguments: { issueKey: 'ABC-1', fromProject: 'ABC', toProject: 'DEF' } });
builderVector('refs-jira-project-injection', 'A project key that carries JQL is refused by the idPattern, also for an early-check type.', 'gateway',
  { caller: users.reader(), tool: tools.searchIssues, arguments: { projectKeys: ['ABC) OR project in (HR'] } });
builderVector('refs-folder-path-traversal', 'A path argument with .. does not match the idPattern of a path-shaped type.', 'gateway',
  { caller: users.notesReader(), tool: tools.getFolder, arguments: { folderPath: 'team/../platform' } });
builderVector('refs-non-early-id-validated', 'A type that is not early-check still has its ids validated, and does not reach refs.', 'gateway',
  { caller: users.notesReader(), tool: tools.getFolder, arguments: { folderPath: 'team/sub' } });
builderVector('tool-without-refs', 'Tool with no resourceRefs: refs is an empty set.', 'gateway',
  { caller: users.reader(), tool: tools.listProjects, arguments: { anything: 'ignored' } });
builderVector('tool-unknown-risk', 'Registry entry with a risk outside READ_ONLY, UPDATE, DESTRUCTIVE: denied, a typo must not bypass risk rules.', 'gateway',
  { caller: users.destroyer({ mfa: 60 }), tool: { ...tools.deleteIssue, risk: 'DESTRUCTlVE' }, arguments: { issueKey: 'ABC-1' } });
builderVector('tool-unknown-resource-type', 'A resourceRef type no registered server declared: internal_error. There is no built-in type.', 'gateway',
  { caller: users.reader(), tool: tool('jira', 'get_thing', 'READ_ONLY', 'read', [{ argument: 'thing', type: 'Jira::Thing' }]), arguments: { thing: 'x' } });
builderVector('tool-resource-type-of-no-registered-server', 'A type of a server that is not in the registry (the Confluence example is not loaded here): internal_error.', 'gateway',
  { caller: users.reader(), tool: tool('confluence', 'get_page', 'READ_ONLY', 'read', [{ argument: 'pageId', type: 'Confluence::Page' }]), arguments: { pageId: '1000' } });
builderVector('mfa-age', 'mfa claim becomes principal.mfaAge and context.mfaAge.', 'gateway',
  { caller: users.destroyer({ mfa: 120 }), tool: tools.deleteIssue, arguments: { issueKey: 'ABC-1' } });
builderVector('mfa-negative', 'A negative MFA age is invalid_argument.', 'gateway',
  { caller: users.destroyer({ mfa: -1 }), tool: tools.deleteIssue, arguments: { issueKey: 'ABC-1' } });
builderVector('credential-type-user-oauth-on-server', 'context.credentialType is set when the caller gives it (CC-136).', 'server',
  { caller: users.notesReader(), tool: tools.getFolder, arguments: { folderPath: 'team' }, credentialType: 'user-oauth', resource: folder('team') });
builderVector('credential-type-service-account', 'service-account in the context.', 'gateway',
  { caller: users.notesReader(), tool: tools.getFolder, arguments: { folderPath: 'team' }, credentialType: 'service-account' });
builderVector('credential-type-unknown', 'A fifth credential type is internal_error.', 'gateway',
  { caller: users.notesReader(), tool: tools.getFolder, arguments: { folderPath: 'team' }, credentialType: 'service_account' });

builderVector('server-jira-issue', 'Server: the issue, its project as parent entity and as attribute, scopes of the project from the resolver.', 'server',
  { caller: users.writer(), tool: tools.updateIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'ABC', 'Software') });
builderVector('server-jira-issue-moved', 'The project comes from the system, not from the key: ABC-1 now lives in HR.', 'server',
  { caller: users.writer(), tool: tools.updateIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'HR', 'Restricted') });
for (const [suffix, value] of [['canonical', 'restricted'], ['trailing-space', 'Restricted '], ['upper-case', 'RESTRICTED']]) {
  builderVector(`classification-normalized-${suffix}`, `Classification string ${JSON.stringify(value)} is normalized (trim, ASCII lower case) to restricted (CC-067).`, 'server',
    { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'HR-1' }, resource: project('HR', value) });
}
builderVector('classification-set-normalized', 'A classification set is normalized and deduplicated.', 'server',
  { caller: users.notesReader(), tool: tools.getFolder, arguments: { folderPath: 'team' }, resource: folder('team', [' Restricted', 'restricted', 'Confidential']) });
builderVector('classification-wrong-shape', 'A classification string given as a list: internal_error.', 'server',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'HR-1' }, resource: { ...project('HR'), attrs: { key: 'HR', category: ['restricted'] } } });
builderVector('classification-set-wrong-shape', 'A classification set with a non-string element: internal_error.', 'server',
  { caller: users.notesReader(), tool: tools.getFolder, arguments: { folderPath: 'team' }, resource: folder('team', ['restricted', 7]) });
builderVector('classification-optional-absent', 'An optional classification may be absent.', 'server',
  { caller: users.notesReader(), tool: tools.getFolder, arguments: { folderPath: 'team' }, resource: folder('team') });
builderVector('resource-missing-classification-parent', 'The parent project of an issue has no category: the issue is not built (internal_error).', 'server',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' }, resource: { ...issue('ABC-1', 'ABC', 'Software'), parent: { type: 'Jira::Project', id: 'ABC', attrs: { key: 'ABC' }, scopes: ['Jira::Project/ABC'] } } });
builderVector('resource-missing-labels', 'A notebook without the required labels is not built.', 'server',
  { caller: users.notesReader(), tool: tools.getNote, arguments: { noteId: '17' }, resource: { ...note('17', 'alpha', []), parent: { type: 'Notes::Notebook', id: 'alpha', attrs: { name: 'alpha' }, scopes: ['Notes::Notebook/alpha'] } } });
builderVector('resource-null-attribute', 'A null attribute means the attribute is absent.', 'server',
  { caller: users.notesReader(), tool: tools.getNote, arguments: { noteId: '17' }, resource: note('17', 'alpha', [], { pinned: null }) });
builderVector('resource-optional-attribute', 'An optional declared attribute that the resolver gives is kept.', 'server',
  { caller: users.notesReader(), tool: tools.getNote, arguments: { noteId: '17' }, resource: note('17', 'alpha', [], { pinned: true }) });
builderVector('resolved-resource-invalid-id', 'A resolved resource whose id does not match its idPattern is not built.', 'server',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('abc-1', 'ABC', 'Software') });
builderVector('resolved-resource-undeclared-attribute', 'An attribute that the manifest does not declare is refused: the schema would refuse the entity anyway.', 'server',
  { caller: users.notesReader(), tool: tools.getNote, arguments: { noteId: '17' }, resource: note('17', 'alpha', [], { color: 'red' }) });
builderVector('resolved-resource-scopes-attribute', 'scopes is not an attribute the resolver may set; it comes from the scopes input.', 'server',
  { caller: users.notesReader(), tool: tools.getNote, arguments: { noteId: '17' }, resource: note('17', 'alpha', [], { scopes: ['Notes::Notebook/beta'] }) });
builderVector('resolved-resource-parent-attribute', 'The parent attribute is added by the builder; the resolver does not give it.', 'server',
  { caller: users.notesReader(), tool: tools.getNote, arguments: { noteId: '17' }, resource: note('17', 'alpha', [], { notebook: 'alpha' }) });
builderVector('resolved-resource-parent-missing', 'A type that declares a parent needs it.', 'server',
  { caller: users.notesReader(), tool: tools.getNote, arguments: { noteId: '17' }, resource: { type: 'Notes::Note', id: '17', attrs: { title: 'x' }, scopes: [] } });
builderVector('resolved-resource-parent-wrong-type', 'The parent must be of the declared parent type.', 'server',
  { caller: users.notesReader(), tool: tools.getNote, arguments: { noteId: '17' }, resource: { ...note('17', 'alpha', []), parent: folder('team') } });
builderVector('resolved-resource-parent-not-declared', 'A type without a declared parent does not take one.', 'server',
  { caller: users.notesReader(), tool: tools.getFolder, arguments: { folderPath: 'team' }, resource: { ...folder('team'), parent: notebook('alpha') } });
builderVector('resolved-resource-unknown-type', 'A resolved resource of an undeclared type is not built.', 'server',
  { caller: users.notesReader(), tool: tools.getFolder, arguments: { folderPath: 'team' }, resource: { type: 'Notes::Drawer', id: 'x', attrs: {}, scopes: [] } });
builderVector('resolved-resource-scope-of-undeclared-type', 'A scope id of a type nobody declared is internal_error.', 'server',
  { caller: users.notesReader(), tool: tools.getFolder, arguments: { folderPath: 'team' }, resource: { ...folder('team'), scopes: ['Notes::Drawer/x'] } });
builderVector('resolved-resource-scope-not-matching-pattern', 'A scope id whose local part does not match the scopePattern of its type is internal_error.', 'server',
  { caller: users.notesReader(), tool: tools.getFolder, arguments: { folderPath: 'team' }, resource: { ...folder('team'), scopes: ['Notes::Folder/Team'] } });
builderVector('resolved-resource-scope-of-ungrantable-type', 'A type without a scopePattern cannot appear in scopes.', 'server',
  { caller: users.notesReader(), tool: tools.getNote, arguments: { noteId: '17' }, resource: { ...note('17', 'alpha', []), scopes: ['Notes::Note/17'] } });
builderVector('server-notes-note', 'Server: a note carries the scope of its notebook; the notebook labels are normalized.', 'server',
  { caller: users.notesWriter(), tool: tools.updateNote, arguments: { noteId: '17' }, resource: note('17', 'alpha', ['Draft']) });
builderVector('server-notes-folder-path-scopes', 'Server: the scopes of a folder are the prefixes of its path (Scopes.pathPrefixes), a grant on team covers team/sub/leaf.', 'server',
  { caller: users.notesWriter(), tool: tools.updateFolder, arguments: { folderPath: 'team/sub/leaf' }, resource: folder('team/sub/leaf') });
builderVector('server-gitlab-project-path-prefixes', 'Scope derivation of the former GitLab server as data: a project carries the scopes of every group on its path; the topics of the ancestors are the server\'s own business (inheritedClassification is an ordinary declared attribute).', 'server', {
  caller: caller('gitlabWriter', ['mcp-gitlab-read', 'mcp-gitlab-write', 'mcp-gitlab-grp-team-a']),
  tool: tool('gitlab', 'update_project', 'UPDATE', 'update', [{ argument: 'projectPath', type: 'GitLab::Project' }]),
  arguments: { projectPath: 'team-a/sub/app' },
  resource: {
    type: 'GitLab::Project', id: 'team-a/sub/app', attrs: { path: 'team-a/sub/app', classification: ['Internal'], inheritedClassification: ['restricted'] },
    parent: { type: 'GitLab::Group', id: 'team-a/sub', attrs: { path: 'team-a/sub', inheritedClassification: ['restricted'] }, scopes: pathPrefixes('team-a/sub').map((p) => `GitLab::Group/${p}`) },
    scopes: pathPrefixes('team-a/sub').map((p) => `GitLab::Group/${p}`),
  },
}, { resourceTypes: [GITLAB, CONFLUENCE, OPENSEARCH, SERVICEDESK], scopeMappingPath: MAPPING_EXAMPLE_SYSTEMS });
builderVector('server-opensearch-index-dash-prefixes', 'Scope derivation of the former OpenSearch server as data: an index carries the scope of every dash prefix of its name (Scopes.dashPrefixes).', 'server', {
  caller: caller('reader', ['mcp-opensearch-read', 'mcp-opensearch-idx-logs-team-a']),
  tool: tool('opensearch', 'search', 'READ_ONLY', 'read', [{ argument: 'index', type: 'OpenSearch::Index' }]),
  arguments: { index: 'logs-team-a-2026.10' },
  resource: { type: 'OpenSearch::Index', id: 'logs-team-a-2026.10', attrs: { name: 'logs-team-a-2026.10', tags: ['Prod'] }, scopes: dashPrefixes('logs-team-a-2026.10').map((p) => `OpenSearch::Index/${p}`) },
}, { resourceTypes: [GITLAB, CONFLUENCE, OPENSEARCH, SERVICEDESK], scopeMappingPath: MAPPING_EXAMPLE_SYSTEMS });
builderVector('server-confluence-page-tree', 'Scope derivation of the former Confluence server as data: a page carries its space and the page ids of its ancestors, so a grant on page 1000 covers the tree below it.', 'server', {
  caller: caller('confluenceReader', ['mcp-confluence-read', 'mcp-confluence-handbook-editors']),
  tool: tool('confluence', 'update_page', 'UPDATE', 'update', [{ argument: 'pageId', type: 'Confluence::Page' }]),
  arguments: { pageId: '1002' },
  resource: {
    type: 'Confluence::Page', id: '1002', attrs: { id: '1002', ancestorIds: ['1000', '1001'] },
    parent: { type: 'Confluence::Space', id: 'ENG', attrs: { key: 'ENG', labels: [] }, scopes: ['Confluence::Space/ENG'] },
    scopes: ['Confluence::Space/ENG', 'Confluence::Page/1000', 'Confluence::Page/1001', 'Confluence::Page/1002'],
  },
}, { resourceTypes: [GITLAB, CONFLUENCE, OPENSEARCH, SERVICEDESK], scopeMappingPath: MAPPING_EXAMPLE_SYSTEMS });
builderVector('mapping-example-systems', 'The scope mapping of the former built-in systems is valid against their declarations: the User.scopes of a member of several groups.', 'gateway', {
  caller: caller('confluenceReader', ['mcp-confluence-space-ENG', 'mcp-gitlab-grp-team-a', 'mcp-opensearch-idx-logs-team-a', 'mcp-servicedesk-queue-42']),
  tool: tool('servicedesk', 'update_ticket', 'UPDATE', 'update', [{ argument: 'queueId', type: 'ServiceDesk::Queue' }]),
  arguments: { queueId: '42' },
}, { resourceTypes: [GITLAB, CONFLUENCE, OPENSEARCH, SERVICEDESK], scopeMappingPath: MAPPING_EXAMPLE_SYSTEMS });

// ---------- policy decisions ----------
// Gateway decisions use the platform policies (cedar/platform) and the example overrides; server decisions use the policies
// of the fragment of the server, composed with the base schema.
outDir('policy-decisions');
// platformServer: the policies that PlatformServerPolicies generates from the declarations of the namespace run next to the fragment.
const JIRA_FRAGMENT = { namespace: 'Jira', schema: 'cedar/examples/systems/jira/schema.cedarschema', policies: ['cedar/examples/systems/jira'], platformServer: true };
const NOTES_FRAGMENT = { namespace: 'Notes', schema: 'test-vectors/fixtures/notes/schema.cedarschema', policies: ['test-vectors/fixtures/notes'], platformServer: true };
const GATEWAY_POLICIES = { schema: null, policies: ['cedar/platform', 'cedar/examples/overrides'] };
let decisionCount = 0;
const decision = (name, description, level, rawInput, expected, { covers = [], adjustment, policies } = {}) => {
  // A server always knows its credential type (CC-136); a vector that does not name one runs with a user credential.
  const input = level === 'server' && !('credentialType' in rawInput) ? { ...rawInput, credentialType: 'user-oauth' } : rawInput;
  const built = buildFor(level, input);
  decisionCount++;
  write('policy-decisions', name, {
    description,
    covers,
    policies: policies ?? (level === 'gateway' ? GATEWAY_POLICIES : (input.resource.type.startsWith('Notes::') ? NOTES_FRAGMENT : JIRA_FRAGMENT)),
    // How request and entities were produced; implementations can rebuild them from this input.
    builder: { level, resourceTypes: [JIRA, NOTES], scopeMapping: MAPPING, input, ...(adjustment && { adjustment }) },
    request: { principal: built.principal, action: built.action, resource: built.resource, context: adjustment === 'remove-refs' ? Object.fromEntries(Object.entries(built.context).filter(([k]) => k !== 'refs')) : built.context },
    entities: built.entities.filter((e) => adjustment !== 'remove-tool-entity' || e.uid.type !== 'Tool'),
    expected,
  });
};
const allow = (...determiningPolicies) => ({ decision: 'allow', determiningPolicies });
const deny = (...determiningPolicies) => ({ decision: 'deny', determiningPolicies });

decision('gw-read-allowed', 'Reader calls a READ_ONLY tool: the platform permit applies, whatever the server.', 'gateway',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' } }, allow('platform-call-by-group'));
decision('gw-no-group-denied', 'User without any mcp- group: default deny.', 'gateway',
  { caller: users.nobody(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' } }, deny(), { covers: ['no_group'] });
decision('gw-other-system-group-denied', 'mcp-notes-read does not open a Jira tool: the required group is derived from the system of the tool.', 'gateway',
  { caller: users.notesReader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' } }, deny(), { covers: ['no_group'] });
decision('gw-update-without-write-group', 'UPDATE tool without mcp-jira-write.', 'gateway',
  { caller: users.reader(), tool: tools.updateIssue, arguments: { issueKey: 'ABC-1' } }, deny(), { covers: ['write_without_write_group'] });
decision('gw-update-allowed', 'UPDATE tool with mcp-jira-write; an issue key alone is checked on the server (not an early-check type).', 'gateway',
  { caller: users.writer(), tool: tools.updateIssue, arguments: { issueKey: 'ABC-1' } }, allow('platform-call-by-group'));
decision('gw-create-in-scope', 'Create in a project granted by mcp-jira-proj-ABC: the early check passes.', 'gateway',
  { caller: users.writer(), tool: tools.createIssue, arguments: { projectKey: 'ABC' } }, allow('platform-call-by-group'));
decision('gw-create-outside-scope', 'Create in a project the user is not granted: the platform forbid overrides the group permit.', 'gateway',
  { caller: users.writer(), tool: tools.createIssue, arguments: { projectKey: 'DEF' } }, deny('platform-call-write-outside-scope'),
  { covers: ['forbid_overrides_permit', 'scope_hierarchy'] });
decision('gw-move-one-project-outside', 'Two granted projects and one that is not: every id must be granted.', 'gateway',
  { caller: users.writer2(), tool: tools.moveIssue, arguments: { issueKey: 'ABC-1', fromProject: 'ABC', toProject: 'GHI' } }, deny('platform-call-write-outside-scope'),
  { covers: ['forbid_overrides_permit', 'every_resource_ref'] });
decision('gw-move-both-granted', 'Both projects granted.', 'gateway',
  { caller: users.writer2(), tool: tools.moveIssue, arguments: { issueKey: 'ABC-1', fromProject: 'ABC', toProject: 'DEF' } }, allow('platform-call-by-group'),
  { covers: ['every_resource_ref'] });
decision('gw-read-outside-scope-allowed', 'Reading is not limited by scope at the gateway; the server decides.', 'gateway',
  { caller: users.reader(), tool: tools.searchIssues, arguments: { projectKeys: ['DEF'] } }, allow('platform-call-by-group'), { covers: ['search_results'] });
decision('gw-write-without-refs-denied', 'A write whose context has no refs is refused (fail closed), not treated as having nothing to check.', 'gateway',
  { caller: users.writer(), tool: tools.createIssue, arguments: { projectKey: 'ABC' } }, deny('platform-call-write-without-refs'),
  { covers: ['forbid_overrides_permit'], adjustment: 'remove-refs' });
decision('gw-read-without-refs-allowed', 'A read does not need refs.', 'gateway',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' } }, allow('platform-call-by-group'), { adjustment: 'remove-refs' });
decision('gw-unknown-tool-denied', 'A tool that is not in the registry has no Tool entity: deny, also for a user in every group.', 'gateway',
  { caller: users.writer(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' } }, deny(), { covers: ['unknown_tool'], adjustment: 'remove-tool-entity' });
decision('gw-destructive-allowed-with-fresh-mfa', 'DESTRUCTIVE tool with the destructive group and an MFA 60 seconds old.', 'gateway',
  { caller: users.destroyer({ mfa: 60 }), tool: tools.deleteIssue, arguments: { issueKey: 'ABC-1' } }, allow('platform-call-by-group'));
decision('gw-destructive-without-mfa', 'DESTRUCTIVE tool, no mfa claim: step-up override forbids.', 'gateway',
  { caller: users.destroyer(), tool: tools.deleteIssue, arguments: { issueKey: 'ABC-1' } }, deny('override-destructive-requires-fresh-mfa'), { covers: ['forbid_overrides_permit'] });
decision('gw-destructive-with-stale-mfa', 'DESTRUCTIVE tool, MFA two hours old: step-up override forbids.', 'gateway',
  { caller: users.destroyer({ mfa: 7200 }), tool: tools.deleteIssue, arguments: { issueKey: 'ABC-1' } }, deny('override-destructive-requires-fresh-mfa'), { covers: ['forbid_overrides_permit'] });
decision('gw-notes-read-allowed', 'A neutral system: the same two platform policies decide, nothing names it.', 'gateway',
  { caller: users.notesReader(), tool: tools.getNote, arguments: { noteId: '17' } }, allow('platform-call-by-group'));
decision('gw-notes-update-notebook-in-scope', 'Notes notebook is an early-check type: granted notebook passes.', 'gateway',
  { caller: users.notesWriter(), tool: tools.updateNotebook, arguments: { notebook: 'alpha' } }, allow('platform-call-by-group'));
decision('gw-notes-update-notebook-outside-scope', 'Notes notebook is an early-check type: a notebook outside the grant is forbidden at the gateway.', 'gateway',
  { caller: users.notesWriter(), tool: tools.updateNotebook, arguments: { notebook: 'gamma' } }, deny('platform-call-write-outside-scope'), { covers: ['forbid_overrides_permit'] });
decision('gw-notes-update-folder-not-early', 'Notes folder is not early-check (its scopes are path prefixes): the gateway leaves a folder outside the exact grants to the server.', 'gateway',
  { caller: users.notesWriter(), tool: tools.updateFolder, arguments: { folderPath: 'team/sub' } }, allow('platform-call-by-group'));
decision('gw-system-unknown-to-everything', 'A system added at runtime and never mentioned in any file: allowed by its own group alone.', 'gateway',
  { caller: users.weatherReader(), tool: tools.forecast, arguments: {} }, allow('platform-call-by-group'));

decision('srv-jira-read-allowed', 'Server: reader reads an issue of an ordinary project.', 'server',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'ABC', 'Software') }, allow('jira-read'));
decision('srv-jira-read-nobody-denied', 'Server: no group, no permit.', 'server',
  { caller: users.nobody(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'ABC', 'Software') }, deny(), { covers: ['no_group'] });
decision('srv-jira-read-restricted-project', 'Restricted project is never available, even to a reader.', 'server',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'HR-1' }, resource: project('HR', 'Restricted') }, deny('platform-jira-restricted-project'),
  { covers: ['restricted', 'forbid_overrides_permit'] });
decision('srv-jira-read-restricted-issue', 'Issue of a restricted project: forbid through the parent attribute.', 'server',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'HR-1' }, resource: issue('HR-1', 'HR', 'Restricted') }, deny('platform-jira-restricted-issue-by-project'),
  { covers: ['restricted', 'forbid_overrides_permit'] });
decision('srv-moved-issue-restricted', 'ABC-1 was moved into a restricted project: the project comes from the system, not from the key (cedar/entity-builder.md section 4).', 'server',
  { caller: users.reader(), tool: tools.getIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'HR', 'Restricted') }, deny('platform-jira-restricted-issue-by-project'),
  { covers: ['restricted', 'forbid_overrides_permit'] });
decision('srv-jira-update-issue-in-scope', 'Update an issue of a granted project.', 'server',
  { caller: users.writer(), tool: tools.updateIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'ABC', 'Software') }, allow('jira-update-issue-in-scope'));
decision('srv-jira-update-issue-outside-scope', 'Update an issue of a project that is not granted: default deny.', 'server',
  { caller: users.writer(), tool: tools.updateIssue, arguments: { issueKey: 'DEF-1' }, resource: issue('DEF-1', 'DEF', 'Software') }, deny(), { covers: ['scope_hierarchy'] });
decision('srv-jira-update-without-write-group', 'In scope but without the write group.', 'server',
  { caller: caller('reader', ['mcp-jira-read', 'mcp-jira-proj-ABC']), tool: tools.updateIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'ABC', 'Software') }, deny(),
  { covers: ['write_without_write_group'] });
decision('srv-jira-delete-in-scope', 'Delete needs the destructive group and the scope.', 'server',
  { caller: users.destroyer({ mfa: 60 }), tool: tools.deleteIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'ABC', 'Software') }, allow('jira-delete-issue-in-scope'));
decision('srv-jira-delete-with-write-group-only', 'The write group does not delete.', 'server',
  { caller: users.writer(), tool: tools.deleteIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'ABC', 'Software') }, deny());
decision('srv-jira-group-named-like-a-project-grants-nothing', 'A group whose name merely looks like a grant (case differs) is not in the mapping and grants nothing.', 'server',
  { caller: caller('writer', ['mcp-jira-read', 'mcp-jira-write', 'mcp-jira-proj-abc']), tool: tools.updateIssue, arguments: { issueKey: 'ABC-1' }, resource: issue('ABC-1', 'ABC', 'Software') }, deny());
decision('srv-notes-folder-subpath-in-scope', 'A grant on the folder team covers team/sub/leaf: the folder carries every prefix of its path as scope.', 'server',
  { caller: users.notesWriter(), tool: tools.updateFolder, arguments: { folderPath: 'team/sub/leaf' }, resource: folder('team/sub/leaf') }, allow('notes-update-in-scope'),
  { covers: ['scope_hierarchy'] });
decision('srv-notes-folder-sibling-outside-scope', 'A grant on team does not cover teamx/a: the scope matches whole path segments.', 'server',
  { caller: users.notesWriter(), tool: tools.updateFolder, arguments: { folderPath: 'teamx/a' }, resource: folder('teamx/a') }, deny(), { covers: ['scope_hierarchy'] });
decision('srv-notes-note-in-scope', 'A note carries the scope of its notebook.', 'server',
  { caller: users.notesWriter(), tool: tools.updateNote, arguments: { noteId: '17' }, resource: note('17', 'alpha', []) }, allow('notes-update-in-scope'));
decision('srv-notes-note-in-restricted-notebook', 'A note of a notebook labelled restricted (the builder normalizes the label).', 'server',
  { caller: users.notesWriter(), tool: tools.updateNote, arguments: { noteId: '17' }, resource: note('17', 'alpha', [' Restricted']) }, deny('platform-notes-restricted-note-by-notebook'),
  { covers: ['restricted', 'forbid_overrides_permit'] });
decision('srv-notes-folder-restricted', 'A folder classified restricted.', 'server',
  { caller: users.notesWriter(), tool: tools.updateFolder, arguments: { folderPath: 'team' }, resource: folder('team', ['RESTRICTED']) }, deny('platform-notes-restricted-folder'),
  { covers: ['restricted', 'forbid_overrides_permit'] });
decision('srv-notes-delete-note', 'Delete needs the destructive group; the note is in the granted notebook.', 'server',
  { caller: users.notesDestroyer(), tool: tools.deleteNote, arguments: { noteId: '17' }, resource: note('17', 'alpha', []) }, allow('notes-delete-in-scope'));
{
  const folderRead = (name, description, credentialType, expected, input = {}) => decision(name, description, 'server', {
    caller: users.notesReader(), tool: tools.getFolder, arguments: { folderPath: 'platform' }, credentialType, resource: folder('platform'), ...input,
  }, expected);
  folderRead('srv-notes-service-account-outside-grant', 'A service account reads a folder outside the grants of the user: forbidden (CC-136).', 'service-account', deny('platform-notes-folder-service-account-outside-scope'));
  folderRead('srv-notes-user-oauth-outside-grant', 'A user credential is limited by the system itself, so the rule does not touch it.', 'user-oauth', allow('notes-read'));
  folderRead('srv-notes-credential-type-missing', 'Without a credentialType the rule fails closed, like a service account (CC-164).', undefined, deny('platform-notes-folder-service-account-outside-scope'));
  folderRead('srv-notes-service-account-inside-grant', 'A service account inside the grants of the user: allowed.', 'service-account', allow('notes-read'),
    { caller: caller('notesReader', ['mcp-notes-read', 'mcp-team-platform']) });
}
console.log(`policy decisions: ${decisionCount}`);

// ---------- result filtering (CC-036) ----------
outDir('result-filter');
const resultFilter = (name, description, fragment, rawInput, items, kept, queryConstraints) => {
  const input = { credentialType: 'user-oauth', ...rawInput };
  write('result-filter', name, {
    description, resourceTypes: [JIRA, NOTES], scopeMapping: MAPPING, policies: fragment, input, items, expected: { kept, queryConstraints },
  });
};

resultFilter('jira-search-granted-projects',
  'Search: the server drops every returned issue that is restricted or that it cannot evaluate (no category on its project); issues of granted projects are kept, reading is not limited by scope.',
  JIRA_FRAGMENT, { caller: users.writer2(), tool: tools.searchIssues, arguments: { text: 'outage' } },
  [issue('ABC-7', 'ABC', 'Software'), issue('DEF-9', 'DEF', 'Software'), issue('HR-1', 'HR', 'Restricted'),
    { type: 'Jira::Issue', id: 'ABC-8', attrs: { key: 'ABC-8' } }],
  ['ABC-7', 'DEF-9'],
  { 'Jira::Project': { granted: ['ABC', 'DEF'] } });
resultFilter('jira-project-without-category', 'An element whose project the resolver returned without category is dropped (CC-062).',
  JIRA_FRAGMENT, { caller: users.reader(), tool: tools.searchIssues, arguments: {} },
  [issue('ABC-7', 'ABC', 'Software'), { ...issue('ABC-8', 'ABC', 'Software'), parent: { type: 'Jira::Project', id: 'ABC', attrs: { key: 'ABC' }, scopes: ['Jira::Project/ABC'] } }],
  ['ABC-7'],
  { 'Jira::Project': { granted: [] } });
resultFilter('notes-folders-restricted-dropped',
  'A folder list: restricted folders are dropped at any depth, the others are kept; the query is limited to the granted folder prefixes.',
  NOTES_FRAGMENT, { caller: users.notesWriter(), tool: tools.searchFolders, arguments: {} },
  [folder('team'), folder('team/sub', ['restricted']), folder('team/sub/leaf'), folder('platform')],
  ['team', 'team/sub/leaf', 'platform'],
  { 'Notes::Folder': { granted: ['team'] }, 'Notes::Notebook': { granted: ['alpha'] } });
resultFilter('notes-no-grants',
  'User with the read group but no mapped scope: granted is empty. Reading is not limited by scope, so the filter keeps the element; the empty grant is what stops a query against a backend that does not enforce rights.',
  NOTES_FRAGMENT, { caller: caller('notesReader', ['mcp-notes-read', 'mcp-notes-folder-unmapped']), tool: tools.searchFolders, arguments: {} },
  [folder('team')],
  ['team'],
  { 'Notes::Folder': { granted: [] }, 'Notes::Notebook': { granted: [] } });
resultFilter('notes-notes-of-restricted-notebook',
  'Notes of a notebook labelled restricted are dropped through the parent attribute.',
  NOTES_FRAGMENT, { caller: users.notesReader(), tool: tools.getNote, arguments: {} },
  [note('1', 'alpha', []), note('2', 'beta', ['restricted']), note('3', 'alpha', ['draft'])],
  ['1', '3'],
  { 'Notes::Notebook': { granted: [] } });

// ---------- every value of every resourceRef (CC-061) ----------
outDir('resource-checks');
const resourceCheck = (name, description, input, resources, allowed) =>
  write('resource-checks', name, { description, resourceTypes: [JIRA, NOTES], scopeMapping: MAPPING, policies: NOTES_FRAGMENT, input: { credentialType: 'user-oauth', ...input }, resources, expected: { allowed } });
resourceCheck('transfer-inside-scope', 'Move team/a under team/sub: source and target folder are both evaluated and allowed.',
  { caller: users.notesWriter(), tool: tools.moveFolder, arguments: { folderPath: 'team/a', targetFolder: 'team/sub' } },
  [folder('team/a'), folder('team/sub')], true);
resourceCheck('transfer-to-sibling-group', 'Move team/a to platform: the source is allowed, the target is not, so the call is denied.',
  { caller: users.notesWriter(), tool: tools.moveFolder, arguments: { folderPath: 'team/a', targetFolder: 'platform' } },
  [folder('team/a'), folder('platform')], false);
resourceCheck('transfer-from-sibling-group', 'Move platform/a into team: the target is allowed, the source is not.',
  { caller: users.notesWriter(), tool: tools.moveFolder, arguments: { folderPath: 'platform/a', targetFolder: 'team' } },
  [folder('platform/a'), folder('team')], false);
resourceCheck('array-with-one-outside', 'Archive three folders; one of them is outside the scope (teamx is not team), so the whole call is denied.',
  { caller: users.notesWriter(), tool: tools.archiveFolders, arguments: { folderPaths: ['team/a', 'team/sub/b', 'teamx/a'] } },
  [folder('team/a'), folder('team/sub/b'), folder('teamx/a')], false);
resourceCheck('array-all-inside', 'Archive two folders, both inside the scope.',
  { caller: users.notesWriter(), tool: tools.archiveFolders, arguments: { folderPaths: ['team/a', 'team/sub/b'] } },
  [folder('team/a'), folder('team/sub/b')], true);
decision('srv-transfer-target-outside-scope', 'Server, move_folder: the target folder platform is evaluated on its own and denied (CC-061).', 'server',
  { caller: users.notesWriter(), tool: tools.moveFolder, arguments: { folderPath: 'team/a', targetFolder: 'platform' }, resource: folder('platform') },
  deny(), { covers: ['scope_hierarchy', 'every_resource_ref'] });
decision('srv-transfer-source-in-scope', 'Server, move_folder: the source folder team/a is allowed; the call still needs every other value allowed.', 'server',
  { caller: users.notesWriter(), tool: tools.moveFolder, arguments: { folderPath: 'team/a', targetFolder: 'platform' }, resource: folder('team/a') },
  allow('notes-update-in-scope'), { covers: ['scope_hierarchy', 'every_resource_ref'] });

// ---------- id and scope patterns of the declarations ----------
// The patterns of the former built-in systems are data now: these vectors check the declarations that ship as examples.
outDir('resource-ids');
const ids = (name, resourceTypes, type, kind, valid, invalid) => {
  const types = registry([resourceTypes]);
  const check = kind === 'resource' ? validId : validScopeLocalId;
  for (const id of valid) if (!check(types, type, id)) throw new Error(`${name}: ${JSON.stringify(id)} should be valid`);
  for (const id of invalid) if (check(types, type, id)) throw new Error(`${name}: ${JSON.stringify(id)} should be invalid`);
  write('resource-ids', name, { resourceTypes, type, kind, valid, invalid });
};
ids('jira-project', JIRA, 'Jira::Project', 'resource', ['ABC', 'HR', 'PLAT_2', 'A1'], ['abc', 'A', 'ABCDEFGHIJK', '1AB', 'AB-C', 'ABC) OR project in (HR', 'AB C', '"ABC"', 'ABC\n']);
ids('jira-issue', JIRA, 'Jira::Issue', 'resource', ['ABC-1', 'PLAT_2-4711'], ['ABC-0', 'abc-1', 'ABC-1 OR 1=1', 'ABC', 'ABC-01']);
ids('confluence-space', CONFLUENCE, 'Confluence::Space', 'resource', ['ENG', 'eng2', 'HB'], ['~jkowalski', 'ENG DOCS', 'ENG-1', 'ENG"', '']);
ids('confluence-page', CONFLUENCE, 'Confluence::Page', 'resource', ['1', '1000', '9223372036854775807'], ['0', '01', '12a', '-5', '1 OR 1=1']);
ids('gitlab-group', GITLAB, 'GitLab::Group', 'resource', ['team-a', 'team-a/sub', 'Team_A.v2', 'a'],
  ['team-a/', '/team-a', 'team-a//sub', 'team-a/../team-b', '-team', 'team-', 'team--a', 'team a', '.hidden', 'a'.repeat(1025)]);
ids('gitlab-project', GITLAB, 'GitLab::Project', 'resource', ['team-a/app', 'team-a/sub/svc'], ['app', 'team-a/app/', 'team-a/../x', '/app']);
ids('opensearch-index', OPENSEARCH, 'OpenSearch::Index', 'resource', ['logs-team-a-2026.10', 'logs', 'kibana_1', '0logs'],
  ['logs-team-a-x,secret-y', 'logs-team-a-*,*', 'logs-*', '_all', '-logs', 'Logs', 'remote:logs', '<logs-{now/d}>', 'logs team', '.', '..',
    '.security', '.kibana_1', '.opendistro_security', '.ds-logs-000001']);
ids('opensearch-prefix', OPENSEARCH, 'OpenSearch::Index', 'scope', ['logs-team-a', 'logs', 'a', '0'],
  ['logs-', 'logs.', 'logs-*', 'logs,x', '_x', '.ds-logs', '.security', '.']);
ids('servicedesk-queue', SERVICEDESK, 'ServiceDesk::Queue', 'resource', ['42', 'IT_support', 'q-1'], ['', '-1', 'q 1', 'q/1', '42;DROP']);
ids('servicedesk-ticket', SERVICEDESK, 'ServiceDesk::Ticket', 'resource', ['501', 'INC-1'], ['INC 1', 'INC/1', '']);
ids('notes-notebook', NOTES, 'Notes::Notebook', 'resource', ['alpha', 'team-1'], ['Alpha', '1alpha', 'alpha_1', 'alpha team', '', 'a'.repeat(33)]);
ids('notes-folder', NOTES, 'Notes::Folder', 'resource', ['team', 'team/sub', 'a/b/c/d/e'], ['team/', '/team', 'team//sub', 'team/../x', 'Team']);
ids('notes-folder-scope', NOTES, 'Notes::Folder', 'scope', ['team', 'team/sub'], ['team/', 'team/..', '']);
ids('notes-note-has-no-scope', NOTES, 'Notes::Note', 'scope', [], ['17', '1']);
