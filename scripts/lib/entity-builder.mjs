// JavaScript implementation of cedar/entity-builder.md, used to generate vectors. The Java library
// java/mcp-cedar-entities must produce the same output; two implementations agreeing is what makes the vectors
// trustworthy.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Per-system id patterns (common.schema.json, CC-056): one source for the schemas and this builder.
const COMMON = JSON.parse(readFileSync(fileURLToPath(new URL('../../schemas/common.schema.json', import.meta.url)), 'utf8')).$defs;
const ID_PATTERNS = Object.fromEntries(Object.entries(COMMON.ResourceIdPatterns.const).map(([type, kinds]) => [type,
  Object.fromEntries(Object.entries(kinds).map(([kind, def]) => [kind, new RegExp(COMMON[def].pattern, 'u')]))]));
export function validId(type, kind, id) {
  const pattern = ID_PATTERNS[type]?.[kind];
  return pattern !== undefined && typeof id === 'string' && pattern.test(id);
}

const SCOPE_FIELDS = ['jiraProjects', 'confluenceSpaces', 'gitlabGroups', 'opensearchIndexPrefixes', 'servicedeskQueues'];
// Scope field of principal.scopes / vsScopes for each grantable flat resource type.
const SCOPE_FIELD_BY_TYPE = {
  'Jira::Project': 'jiraProjects',
  'Confluence::Space': 'confluenceSpaces',
  'GitLab::Group': 'gitlabGroups',
  'OpenSearch::Index': 'opensearchIndexPrefixes',
  'ServiceDesk::Queue': 'servicedeskQueues',
};
const TYPE_BY_SCOPE_FIELD = Object.fromEntries(Object.entries(SCOPE_FIELD_BY_TYPE).map(([t, f]) => [f, t]));
// Types a mapping in entities/static.json may grant (CC-037). Confluence::Page grants a page tree.
export const SCOPE_TYPES = [...Object.keys(SCOPE_FIELD_BY_TYPE), 'Confluence::Page'];
// context.refs fields whose ids are grantable flat scopes and therefore become ResourceScope entities.
const SCOPE_REF_TYPES = new Set(['Jira::Project', 'Confluence::Space', 'GitLab::Group', 'ServiceDesk::Queue']);
const RESOURCE_TYPES = new Set([
  'Jira::Project', 'Jira::Issue', 'Confluence::Space', 'Confluence::Page', 'GitLab::Group', 'GitLab::Project',
  'OpenSearch::Index', 'ServiceDesk::Queue', 'ServiceDesk::Ticket',
]);
const PARENT_ATTRIBUTE = {
  'Jira::Issue': 'project',
  'Confluence::Page': 'space',
  'GitLab::Project': 'group',
  'ServiceDesk::Ticket': 'queue',
};
// Classification attributes a resolver must deliver (CC-062): without them a Restricted rule could not match.
const REQUIRED_CLASSIFICATION = {
  'Jira::Project': ['category', (v) => typeof v === 'string'],
  'Confluence::Space': ['labels', Array.isArray],
  'OpenSearch::Index': ['tags', Array.isArray],
};
// Classification attributes and their shape; values are normalized to one canonical form (CC-067).
const CLASSIFICATION = {
  'Jira::Project': ['category', 'string'],
  'Confluence::Space': ['labels', 'set'],
  'OpenSearch::Index': ['tags', 'set'],
  'GitLab::Group': ['classification', 'set'],
  'GitLab::Project': ['classification', 'set'],
  'ServiceDesk::Queue': ['classification', 'set'],
};
// Same as Java String.trim() plus ASCII-only lower case, so both builders agree byte for byte.
export const normalizeClassification = (value) => value.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '').replace(/[A-Z]/g, (c) => c.toLowerCase());
const RISKS = new Set(['READ_ONLY', 'UPDATE', 'DESTRUCTIVE']);
const ACTIONS = new Set(['read', 'update', 'delete', 'admin']);
const MAX_VSC_ITEMS = 50;

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
const scopeId = (type, id) => `${type}/${id}`;
const scopeRefs = (ids) => sortedSet(ids).map((id) => ref('ResourceScope', id));

export function refsField(resourceType) {
  const [namespace, type] = resourceType.split('::');
  return namespace.toLowerCase() + type;
}

export function namePrefixes(name) {
  const parts = name.split('-');
  return sortedSet(parts.map((_, i) => parts.slice(0, i + 1).join('-')));
}

export function pathPrefixes(path) {
  const parts = path.split('/');
  return sortedSet(parts.map((_, i) => parts.slice(0, i + 1).join('/')));
}

/** Parses the scope mapping out of entities/static.json (Cedar entity JSON). */
export function scopeMapping(staticEntities) {
  const mapping = new Map();
  for (const entity of staticEntities) {
    if (entity.uid.type !== 'UserGroup') continue;
    const scopes = [];
    for (const parent of entity.parents ?? []) {
      if (parent.type !== 'ResourceScope') {
        throw new BuilderError('internal_error', `UserGroup ${entity.uid.id}: parent ${parent.type} is not a ResourceScope`);
      }
      const slash = parent.id.indexOf('/');
      const type = parent.id.slice(0, slash);
      if (slash <= 0 || !SCOPE_TYPES.includes(type) || !validId(type, 'scope', parent.id.slice(slash + 1))) {
        throw new BuilderError('internal_error', `UserGroup ${entity.uid.id}: invalid scope id ${parent.id}`);
      }
      scopes.push(parent.id);
    }
    if (mapping.has(entity.uid.id)) throw new BuilderError('internal_error', `UserGroup ${entity.uid.id} listed twice`);
    mapping.set(entity.uid.id, sortedSet(scopes));
  }
  return mapping;
}

/** Gateway side of CC-027: resourceDefaults of a link -> the vsc claim of the internal JWT. */
export function vscFromResourceDefaults(resourceDefaults = {}) {
  const vsc = {};
  for (const [type, ids] of Object.entries(resourceDefaults)) {
    const field = SCOPE_FIELD_BY_TYPE[type];
    if (!field) throw new BuilderError('internal_error', `resourceDefaults type ${type} cannot narrow`);
    for (const id of ids) if (!validId(type, 'scope', id)) throw new BuilderError('internal_error', `invalid ${type} scope id`);
    vsc[field] = sortedSet([...(vsc[field] ?? []), ...ids]);
  }
  return vsc;
}

function argumentIds(argumentName, value) {
  if (value === undefined || value === null) return [];
  if (typeof value === 'string') return [value];
  // Any number with an integral value: JSON parsers disagree on whether 4711.0 is an integer.
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

function buildContext({ caller, tool, arguments: args = {} }) {
  if (!RISKS.has(tool.risk)) throw new BuilderError('internal_error', `unknown risk ${tool.risk}`);
  if (!ACTIONS.has(tool.action)) throw new BuilderError('internal_error', `unknown action ${tool.action}`);
  const context = { client: caller.azp };
  if ((caller.vs === undefined) !== (caller.vsc === undefined)) {
    throw new BuilderError('internal_error', 'vs and vsc must be present together');
  }
  if (caller.vs !== undefined) {
    context.virtualServer = caller.vs;
    for (const [field, ids] of Object.entries(caller.vsc)) {
      if (!SCOPE_FIELDS.includes(field)) throw new BuilderError('internal_error', `vsc field ${field} unknown`);
      if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_VSC_ITEMS) {
        throw new BuilderError('internal_error', `vsc field ${field} must hold 1..${MAX_VSC_ITEMS} ids`);
      }
      for (const id of ids) {
        if (!validId(TYPE_BY_SCOPE_FIELD[field], 'scope', id)) throw new BuilderError('internal_error', `vsc field ${field}: invalid id`);
      }
    }
    const fields = SCOPE_FIELDS.filter((f) => f in caller.vsc);
    if (fields.length > 0) {
      context.vsScopes = {};
      for (const field of fields) {
        context.vsScopes[field] = scopeRefs(caller.vsc[field].map((id) => scopeId(TYPE_BY_SCOPE_FIELD[field], id)));
      }
    }
  }
  if (caller.mfa !== undefined) {
    if (!Number.isInteger(caller.mfa) || caller.mfa < 0) throw new BuilderError('invalid_argument', 'mfa age must be >= 0');
    context.mfaAge = caller.mfa;
  }
  const refIds = {};
  for (const { argument, type } of tool.resourceRefs) {
    if (!RESOURCE_TYPES.has(type)) throw new BuilderError('internal_error', `unknown resource type ${type}`);
    const field = refsField(type);
    const ids = argumentIds(argument, args[argument]);
    for (const id of ids) {
      if (!validId(type, 'resource', id)) throw new BuilderError('invalid_argument', `${argument}: not a valid ${type} id`);
    }
    refIds[field] = { type, ids: [...(refIds[field]?.ids ?? []), ...ids] };
  }
  context.refs = {};
  for (const [field, { type, ids }] of Object.entries(refIds)) {
    context.refs[field] = SCOPE_REF_TYPES.has(type) ? scopeRefs(ids.map((id) => scopeId(type, id))) : sortedSet(ids);
  }
  return context;
}

function principalEntities(caller, mapping) {
  const groups = sortedSet(caller.grp.filter((g) => g.startsWith('mcp-')));
  const byField = Object.fromEntries(SCOPE_FIELDS.map((f) => [f, []]));
  for (const group of groups) {
    for (const id of mapping.get(group) ?? []) {
      const field = SCOPE_FIELD_BY_TYPE[id.slice(0, id.indexOf('/'))];
      if (field) byField[field].push(id);
    }
  }
  const scopes = Object.fromEntries(SCOPE_FIELDS.map((f) => [f, scopeRefs(byField[f])]));
  const attrs = { username: caller.usr, client: caller.azp, scopes };
  if (caller.mfa !== undefined) attrs.mfaAge = caller.mfa;
  return [
    { uid: uid('User', caller.sub), attrs, parents: groups.map((g) => uid('UserGroup', g)) },
    ...groups.map((g) => ({ uid: uid('UserGroup', g), attrs: {}, parents: (mapping.get(g) ?? []).map((id) => uid('ResourceScope', id)) })),
  ];
}

function resourceScopeIds(resource, parent) {
  const a = resource.attrs ?? {};
  switch (resource.type) {
    case 'Jira::Project': return [scopeId('Jira::Project', resource.id)];
    case 'Jira::Issue': return [scopeId('Jira::Project', parent.id)];
    case 'Confluence::Space': return [scopeId('Confluence::Space', resource.id)];
    case 'Confluence::Page':
      return [scopeId('Confluence::Space', parent.id),
        ...(a.ancestorIds ?? []).map((p) => scopeId('Confluence::Page', p)), scopeId('Confluence::Page', resource.id)];
    case 'GitLab::Group': return pathPrefixes(resource.id).map((p) => scopeId('GitLab::Group', p));
    case 'GitLab::Project': return pathPrefixes(parent.id).map((p) => scopeId('GitLab::Group', p));
    case 'OpenSearch::Index': return namePrefixes(resource.id).map((p) => scopeId('OpenSearch::Index', p));
    case 'ServiceDesk::Queue': return [scopeId('ServiceDesk::Queue', resource.id)];
    case 'ServiceDesk::Ticket': return [scopeId('ServiceDesk::Queue', parent.id)];
    default: throw new BuilderError('internal_error', `unknown resource type ${resource.type}`);
  }
}

function systemEntity(resource, parent) {
  if (!validId(resource.type, 'resource', resource.id)) {
    throw new BuilderError('internal_error', `resolved ${resource.type} has an invalid id`);
  }
  for (const a of resource.attrs?.ancestorIds ?? []) {
    if (!validId('Confluence::Page', 'resource', a)) throw new BuilderError('internal_error', 'invalid ancestor page id');
  }
  const required = REQUIRED_CLASSIFICATION[resource.type];
  if (required && !required[1](resource.attrs?.[required[0]])) {
    throw new BuilderError('internal_error', `${resource.type} without ${required[0]}`);
  }
  const out = {};
  for (const [k, v] of Object.entries(resource.attrs ?? {})) {
    if (v !== null && v !== undefined) out[k] = k === 'ancestorIds' ? sortedSet(v) : v;
  }
  const classification = CLASSIFICATION[resource.type];
  if (classification && out[classification[0]] !== undefined) {
    const [name, shape] = classification;
    if (shape === 'string') {
      if (typeof out[name] !== 'string') throw new BuilderError('internal_error', `${resource.type}.${name} must be a string`);
      out[name] = normalizeClassification(out[name]);
    } else {
      if (!Array.isArray(out[name]) || out[name].some((v) => typeof v !== 'string')) {
        throw new BuilderError('internal_error', `${resource.type}.${name} must be a list of strings`);
      }
      out[name] = sortedSet(out[name].map(normalizeClassification));
    }
  }
  if (PARENT_ATTRIBUTE[resource.type]) {
    if (!parent) throw new BuilderError('internal_error', `${resource.type} needs its parent`);
    out[PARENT_ATTRIBUTE[resource.type]] = ref(parent.type, parent.id);
  }
  out.scopes = scopeRefs(resourceScopeIds(resource, parent));
  return { uid: uid(resource.type, resource.id), attrs: out, parents: parent ? [uid(parent.type, parent.id)] : [] };
}

function sortEntities(entities) {
  return entities.sort((a, b) => {
    if (a.uid.type !== b.uid.type) return a.uid.type < b.uid.type ? -1 : 1;
    return a.uid.id < b.uid.id ? -1 : a.uid.id > b.uid.id ? 1 : 0;
  });
}

export function build(level, input, staticEntities) {
  const { caller, tool } = input;
  const mapping = scopeMapping(staticEntities);
  const context = buildContext(input);
  const entities = principalEntities(caller, mapping);
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
    if (resolved.parent) entities.push(systemEntity(resolved.parent, resolved.parent.parent));
    entities.push(systemEntity(resolved, resolved.parent));
  }
  return { principal: uid('User', caller.sub), action, resource, context, entities: sortEntities(entities) };
}
