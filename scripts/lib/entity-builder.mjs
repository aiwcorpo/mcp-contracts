// JavaScript implementation of cedar/entity-builder.md, used to generate vectors. The Java reference in
// src/test must produce the same output; two implementations agreeing is what makes the vectors trustworthy.

const SCOPE_GROUPS = {
  jira: { proj: 'jiraProjects' },
  confluence: { space: 'confluenceSpaces' },
  gitlab: { grp: 'gitlabGroups' },
  opensearch: { idx: 'opensearchIndexPrefixes' },
  servicedesk: { queue: 'servicedeskQueues' },
};
const SCOPE_FIELDS = ['jiraProjects', 'confluenceSpaces', 'gitlabGroups', 'opensearchIndexPrefixes', 'servicedeskQueues'];
const VS_SCOPE_FIELD = {
  'Jira::Project': 'jiraProjects',
  'Confluence::Space': 'confluenceSpaces',
  'GitLab::Group': 'gitlabGroups',
  'OpenSearch::Index': 'opensearchIndexPrefixes',
  'ServiceDesk::Queue': 'servicedeskQueues',
};
const PARENT_ATTRIBUTE = {
  'Jira::Issue': 'project',
  'Confluence::Page': 'space',
  'GitLab::Project': 'group',
  'ServiceDesk::Ticket': 'queue',
};

export class BuilderError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Array.prototype.sort without a comparator orders by UTF-16 code units, like Java String.compareTo.
const sortedSet = (values) => [...new Set(values)].sort();
const uid = (type, id) => ({ type, id });
const ref = (type, id) => ({ __entity: { type, id } });

export function refsField(resourceType) {
  const [namespace, type] = resourceType.split('::');
  return namespace.toLowerCase() + type;
}

export function scopesFromGroups(groups) {
  const scopes = Object.fromEntries(SCOPE_FIELDS.map((f) => [f, []]));
  for (const group of groups) {
    const match = /^mcp-([a-z]+)-([a-z]+)-(.+)$/.exec(group);
    if (!match) continue;
    const field = SCOPE_GROUPS[match[1]]?.[match[2]];
    if (field) scopes[field].push(match[3]);
  }
  for (const f of SCOPE_FIELDS) scopes[f] = sortedSet(scopes[f]);
  return scopes;
}

export function namePrefixes(name) {
  const parts = name.split('-');
  return sortedSet(parts.map((_, i) => parts.slice(0, i + 1).join('-')));
}

function argumentIds(argumentName, value) {
  if (value === undefined || value === null) return [];
  if (typeof value === 'string') return [value];
  if (Number.isInteger(value)) return [String(value)];
  if (Array.isArray(value)) {
    return value.map((v) => {
      if (typeof v === 'string') return v;
      if (Number.isInteger(v)) return String(v);
      throw new BuilderError('invalid_argument', `${argumentName}: array element is not a string or integer`);
    });
  }
  throw new BuilderError('invalid_argument', `${argumentName}: not a resource identifier`);
}

function buildContext({ caller, tool, arguments: args = {}, virtualServer }) {
  const context = { client: caller.azp };
  if (caller.vs !== undefined) {
    if (!virtualServer || virtualServer.slug !== caller.vs) {
      throw new BuilderError('internal_error', 'virtual server definition missing for vs claim');
    }
    context.virtualServer = caller.vs;
    const defaults = virtualServer.resourceDefaults ?? {};
    if (Object.keys(defaults).length > 0) {
      context.vsScopes = {};
      for (const [type, ids] of Object.entries(defaults)) {
        const field = VS_SCOPE_FIELD[type];
        if (!field) throw new BuilderError('internal_error', `resourceDefaults type ${type} cannot narrow`);
        context.vsScopes[field] = sortedSet(ids);
      }
    }
  }
  if (caller.mfa !== undefined) context.mfaAge = caller.mfa;
  context.refs = {};
  for (const { argument, type } of tool.resourceRefs) {
    const field = refsField(type);
    context.refs[field] = sortedSet([...(context.refs[field] ?? []), ...argumentIds(argument, args[argument])]);
  }
  return context;
}

function principalEntities(caller) {
  const groups = sortedSet(caller.grp.filter((g) => g.startsWith('mcp-')));
  const attrs = { username: caller.usr, client: caller.azp, scopes: scopesFromGroups(groups) };
  if (caller.mfa !== undefined) attrs.mfaAge = caller.mfa;
  return [
    { uid: uid('User', caller.sub), attrs, parents: groups.map((g) => uid('UserGroup', g)) },
    ...groups.map((g) => ({ uid: uid('UserGroup', g), attrs: {}, parents: [] })),
  ];
}

function systemEntity({ type, id, attrs = {} }, parent) {
  const out = { ...attrs };
  if (type === 'OpenSearch::Index') out.namePrefixes = namePrefixes(attrs.name);
  if (PARENT_ATTRIBUTE[type]) {
    if (!parent) throw new BuilderError('internal_error', `${type} needs its parent`);
    out[PARENT_ATTRIBUTE[type]] = ref(parent.type, parent.id);
  }
  return { uid: uid(type, id), attrs: out, parents: parent ? [uid(parent.type, parent.id)] : [] };
}

function sortEntities(entities) {
  // Code-point order of type, then id: simple to reproduce in any language.
  const key = (e) => [e.uid.type, e.uid.id];
  return entities.sort((a, b) => {
    const [ta, ia] = key(a);
    const [tb, ib] = key(b);
    if (ta !== tb) return ta < tb ? -1 : 1;
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  });
}

export function build(level, input) {
  const { caller, tool } = input;
  const context = buildContext(input);
  const entities = principalEntities(caller);
  let action;
  let resource;
  if (level === 'gateway') {
    action = uid('Action', 'call');
    resource = uid('Tool', `${tool.system}__${tool.name}`);
    entities.push({ uid: resource, attrs: { server: tool.serverId, name: tool.name, risk: tool.risk }, parents: [] });
  } else {
    action = uid('Action', tool.action);
    const { resource: resolved } = input;
    resource = uid(resolved.type, resolved.id);
    if (resolved.parent) entities.push(systemEntity(resolved.parent, null));
    entities.push(systemEntity(resolved, resolved.parent));
  }
  return { principal: uid('User', caller.sub), action, resource, context, entities: sortEntities(entities) };
}
