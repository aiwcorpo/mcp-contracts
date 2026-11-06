// JavaScript implementation of cedar/entity-builder.md, used to generate vectors. The Java library
// java/mcp-cedar-entities must produce the same output; two implementations agreeing is what makes the vectors
// trustworthy. It knows no resource type: everything comes from the resourceTypes declarations it is given.

import { readFileSync } from 'node:fs';
import { path as contractPath } from './contracts.mjs';
import { anchoredPattern } from './manifest-rules.mjs';

const TYPE = /^[A-Z][A-Za-z0-9]{0,30}::[A-Z][A-Za-z0-9]{0,30}$/;
const ATTRIBUTE = /^[a-z][A-Za-z0-9]*$/;

export class BuilderError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Declarations (the resourceTypes array of a manifest) as a registry; throws on an inconsistent set. */
export function resourceTypes(declarations) {
  const byType = new Map();
  for (const d of declarations) {
    if (byType.has(d.type)) throw new Error(`resource type declared twice: ${d.type}`);
    byType.set(d.type, d);
  }
  const registry = new Map();
  for (const d of byType.values()) {
    const namespace = d.type.split('::')[0];
    if (!TYPE.test(d.type)) throw new Error(`not a resource type: ${d.type}`);
    const attributes = d.attributes ?? [];
    if (new Set(attributes).size !== attributes.length || attributes.some((a) => !ATTRIBUTE.test(a) || a === 'scopes')) {
      throw new Error(`${d.type}: attributes not allowed`);
    }
    if ((d.parent === undefined) !== (d.parentAttribute === undefined)) throw new Error(`${d.type}: parent and parentAttribute go together`);
    if (d.parent !== undefined) {
      if (!byType.has(d.parent) || d.parent.split('::')[0] !== namespace) throw new Error(`${d.type}: parent not declared in the same namespace`);
      if (!ATTRIBUTE.test(d.parentAttribute) || d.parentAttribute === 'scopes' || attributes.includes(d.parentAttribute)) {
        throw new Error(`${d.type}: parentAttribute not allowed`);
      }
    }
    if (!anchoredPattern(d.idPattern)) throw new Error(`${d.type}: idPattern must be anchored`);
    if (d.scopePattern !== undefined && !anchoredPattern(d.scopePattern)) throw new Error(`${d.type}: scopePattern must be anchored`);
    if (d.earlyScopeCheck && d.scopePattern === undefined) throw new Error(`${d.type}: earlyScopeCheck needs a scopePattern`);
    if (d.classification && !attributes.includes(d.classification.attribute)) throw new Error(`${d.type}: classification attribute not in attributes`);
    registry.set(d.type, {
      declaration: { ...d, attributes },
      id: new RegExp(d.idPattern, 'u'),
      scope: d.scopePattern === undefined ? null : new RegExp(d.scopePattern, 'u'),
    });
  }
  return registry;
}

/** Reads and joins resource-types.json files (paths relative to the repository root). */
export function loadResourceTypes(paths) {
  return resourceTypes(paths.flatMap((p) => JSON.parse(readFileSync(contractPath(p), 'utf8'))));
}

export const validId = (types, type, id) => typeof id === 'string' && (types.get(type)?.id.test(id) ?? false);
export const validScopeLocalId = (types, type, id) => typeof id === 'string' && (types.get(type)?.scope?.test(id) ?? false);

// Scope id <Type>/<local>; the type is everything before the first slash.
function scopeType(types, scopeId) {
  const slash = scopeId.indexOf('/');
  if (slash <= 0 || slash === scopeId.length - 1) return undefined;
  const type = scopeId.slice(0, slash);
  return validScopeLocalId(types, type, scopeId.slice(slash + 1)) ? type : undefined;
}

// Same as Java String.trim() plus ASCII-only lower case, so both builders agree byte for byte.
export const normalizeClassification = (value) => value.replace(/^[\u0000- ]+|[\u0000- ]+$/g, '').replace(/[A-Z]/g, (c) => c.toLowerCase());
const RISKS = new Set(['READ_ONLY', 'UPDATE', 'DESTRUCTIVE']);
const ACTIONS = new Set(['read', 'update', 'delete', 'admin']);
const REQUIRED_GROUP_SUFFIX = { READ_ONLY: 'read', UPDATE: 'write', DESTRUCTIVE: 'destructive' };

// Array.prototype.sort without a comparator orders by UTF-16 code units, like Java String.compareTo.
const sortedSet = (values) => [...new Set(values)].sort();
const uid = (type, id) => ({ type, id });
const ref = (type, id) => ({ __entity: { type, id } });
const scopeId = (type, id) => `${type}/${id}`;
const scopeRefs = (ids) => sortedSet(ids).map((id) => ref('ResourceScope', id));

export function pathPrefixes(path) {
  const parts = path.split('/');
  return sortedSet(parts.map((_, i) => parts.slice(0, i + 1).join('/')));
}

export function dashPrefixes(name) {
  const parts = name.split('-');
  return sortedSet(parts.map((_, i) => parts.slice(0, i + 1).join('-')));
}

/** Parses the scopeMapping of the policy data ([{group, scopes}]) against the declared types. */
export function scopeMapping(types, entries, { skipUndeclared = false } = {}) {
  const mapping = new Map();
  for (const entry of entries) {
    const scopes = [];
    for (const id of entry.scopes ?? []) {
      const slash = id.indexOf('/');
      if (skipUndeclared && !types.has(slash > 0 ? id.slice(0, slash) : '')) continue;
      if (scopeType(types, id) === undefined) throw new BuilderError('internal_error', `group ${entry.group}: invalid scope id ${id}`);
      scopes.push(id);
    }
    if (!entry.group || mapping.has(entry.group)) throw new BuilderError('internal_error', `group missing or listed twice: ${entry.group}`);
    mapping.set(entry.group, sortedSet(scopes));
  }
  return mapping;
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

const CREDENTIAL_TYPES = new Set(['user-oauth', 'user-secret', 'token-exchange', 'service-account']);

function declaration(types, type) {
  const entry = types.get(type);
  if (!entry) throw new BuilderError('internal_error', `unknown resource type ${type}`);
  return entry.declaration;
}

/** Every value of every resourceRef argument as { type, id }, in argument order. */
export function resourceValues(types, tool, args = {}) {
  const values = [];
  for (const { argument, type } of tool.resourceRefs) {
    declaration(types, type);
    for (const id of argumentIds(argument, args[argument])) {
      if (!validId(types, type, id)) throw new BuilderError('invalid_argument', `${argument}: not a valid ${type} id`);
      values.push({ type, id });
    }
  }
  return values;
}

function buildContext(types, { caller, tool, arguments: args = {}, credentialType }) {
  if (!RISKS.has(tool.risk)) throw new BuilderError('internal_error', `unknown risk ${tool.risk}`);
  if (!ACTIONS.has(tool.action)) throw new BuilderError('internal_error', `unknown action ${tool.action}`);
  const context = { client: caller.azp };
  if (credentialType !== undefined) {
    if (!CREDENTIAL_TYPES.has(credentialType)) throw new BuilderError('internal_error', `unknown credentialType ${credentialType}`);
    context.credentialType = credentialType;
  }
  if (caller.mfa !== undefined) {
    if (!Number.isInteger(caller.mfa) || caller.mfa < 0) throw new BuilderError('invalid_argument', 'mfa age must be >= 0');
    context.mfaAge = caller.mfa;
  }
  const early = resourceValues(types, tool, args)
    .filter(({ type }) => types.get(type).declaration.earlyScopeCheck)
    .map(({ type, id }) => scopeId(type, id));
  context.refs = scopeRefs(early);
  return context;
}

function principalEntities(caller, mapping) {
  const groups = sortedSet(caller.grp.filter((g) => g.startsWith('mcp-')));
  const userScopes = sortedSet(groups.flatMap((g) => mapping.get(g) ?? []));
  const attrs = { username: caller.usr, client: caller.azp, scopes: scopeRefs(userScopes) };
  if (caller.mfa !== undefined) attrs.mfaAge = caller.mfa;
  return [
    { uid: uid('User', caller.sub), attrs, parents: groups.map((g) => uid('UserGroup', g)) },
    ...groups.map((g) => ({ uid: uid('UserGroup', g), attrs: {}, parents: (mapping.get(g) ?? []).map((id) => uid('ResourceScope', id)) })),
  ];
}

function normalizedClassification(type, classification, attrs) {
  const { attribute, kind, required } = classification;
  const value = attrs[attribute];
  if (value === undefined || value === null) {
    if (required) throw new BuilderError('internal_error', `${type} without ${attribute}`);
    return;
  }
  if (kind === 'string') {
    if (typeof value !== 'string') throw new BuilderError('internal_error', `${type}.${attribute} must be a string`);
    attrs[attribute] = normalizeClassification(value);
  } else {
    if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
      throw new BuilderError('internal_error', `${type}.${attribute} must be a list of strings`);
    }
    attrs[attribute] = sortedSet(value.map(normalizeClassification));
  }
}

function resourceEntity(types, resource, parent) {
  const d = declaration(types, resource.type);
  if (!validId(types, resource.type, resource.id)) throw new BuilderError('internal_error', `resolved ${resource.type} has an invalid id`);
  const input = Object.fromEntries(Object.entries(resource.attrs ?? {}).filter(([, v]) => v !== null && v !== undefined));
  if (d.classification) normalizedClassification(resource.type, d.classification, input);
  const out = {};
  for (const [name, value] of Object.entries(input)) {
    if (!d.attributes.includes(name)) throw new BuilderError('internal_error', `${resource.type}: attribute ${name} is not declared`);
    out[name] = value;
  }
  let parents = [];
  if (d.parent !== undefined) {
    if (!parent) throw new BuilderError('internal_error', `${resource.type} needs its parent`);
    if (parent.type !== d.parent) throw new BuilderError('internal_error', `${resource.type} needs a parent of type ${d.parent}`);
    out[d.parentAttribute] = ref(parent.type, parent.id);
    parents = [uid(parent.type, parent.id)];
  } else if (parent) {
    throw new BuilderError('internal_error', `${resource.type} declares no parent`);
  }
  for (const scope of resource.scopes ?? []) {
    if (scopeType(types, scope) === undefined) throw new BuilderError('internal_error', `${resource.type}: invalid scope id ${scope}`);
  }
  out.scopes = scopeRefs(resource.scopes ?? []);
  return { uid: uid(resource.type, resource.id), attrs: out, parents };
}

function sortEntities(entities) {
  return entities.sort((a, b) => {
    if (a.uid.type !== b.uid.type) return a.uid.type < b.uid.type ? -1 : 1;
    return a.uid.id < b.uid.id ? -1 : a.uid.id > b.uid.id ? 1 : 0;
  });
}

/** Builds { principal, action, resource, context, entities } for level 'gateway' or 'server'. */
export function build(level, input, types, mapping) {
  const { caller, tool } = input;
  const context = buildContext(types, input);
  const entities = principalEntities(caller, mapping);
  let action;
  let resource;
  if (level === 'gateway') {
    action = uid('Action', 'call');
    resource = uid('Tool', `${tool.system}__${tool.name}`);
    entities.push({
      uid: resource,
      attrs: { server: tool.serverId, name: tool.name, risk: tool.risk, requiredGroup: ref('UserGroup', `mcp-${tool.system}-${REQUIRED_GROUP_SUFFIX[tool.risk]}`) },
      parents: [],
    });
  } else {
    const { resource: resolved } = input;
    const d = declaration(types, resolved.type);
    action = uid(`${d.type.split('::')[0]}::Action`, tool.action);
    resource = uid(resolved.type, resolved.id);
    for (let p = resolved.parent; p; p = p.parent) entities.push(resourceEntity(types, p, p.parent));
    entities.push(resourceEntity(types, resolved, resolved.parent));
  }
  return { principal: uid('User', caller.sub), action, resource, context, entities: sortEntities(entities) };
}
