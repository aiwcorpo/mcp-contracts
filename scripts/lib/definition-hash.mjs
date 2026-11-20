// definitionHash of C6 as fixed by CC-004/CC-005: RFC 8785 canonical JSON of the flat object below, SHA-256.
import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';

const HASHED_MEMBERS = ['name', 'title', 'description', 'inputSchema', 'outputSchema', 'annotations'];

export function hashInput({ tool, manifestEntry, server }) {
  // A member the hash does not cover would reach clients unpinned by the approval (CC-042 keeps icons and _meta out of v1).
  const unhashed = Object.keys(tool).find((member) => !HASHED_MEMBERS.includes(member));
  if (unhashed !== undefined) throw new Error(`definition member not covered by definitionHash: ${unhashed}`);
  const inputSchema = structuredClone(tool.inputSchema);
  // confirmation_code is added by the gateway to tools/list (C11) and never part of the hash.
  if (inputSchema?.properties?.confirmation_code) {
    delete inputSchema.properties.confirmation_code;
    if (Array.isArray(inputSchema.required)) {
      inputSchema.required = inputSchema.required.filter((r) => r !== 'confirmation_code');
    }
  }
  const flat = { name: tool.name };
  if (tool.title !== undefined) flat.title = tool.title;
  flat.description = tool.description;
  flat.inputSchema = inputSchema;
  if (tool.outputSchema !== undefined) flat.outputSchema = tool.outputSchema;
  if (tool.annotations !== undefined) flat.annotations = tool.annotations;
  // An entry of an adapter has no risk and no action (CC-193); the administrator's classification is not part of the hash.
  if (manifestEntry.risk !== undefined) flat.risk = manifestEntry.risk;
  if (manifestEntry.action !== undefined) flat.action = manifestEntry.action;
  if (manifestEntry.additionalGroup !== undefined) flat.additionalGroup = manifestEntry.additionalGroup;
  flat.resourceRefs = manifestEntry.resourceRefs ?? [];
  flat.system = server.system;
  flat.credential = server.credential;
  return flat;
}

export function definitionHash(input) {
  const canonical = canonicalize(hashInput(input));
  return { canonical, hash: 'sha256:' + createHash('sha256').update(canonical, 'utf8').digest('hex') };
}

/** Hash of a manifest tool entry (C6 with CC-005): its definition, its policy fields and the server fields. */
export function manifestEntryHash(manifest, entry) {
  // CC-206: for an adapter manifest the hash never covers risk and action, even when the entry was enriched with the classification of the
  // registry; it is always computed from the entry of the manifest as the adapter sent it.
  const classified = manifest.source === 'adapter' ? {} : { risk: entry.risk, action: entry.action };
  return definitionHash({
    tool: entry.definition,
    manifestEntry: { ...classified, resourceRefs: entry.resourceRefs, ...(entry.additionalGroup !== undefined && { additionalGroup: entry.additionalGroup }) },
    server: { system: manifest.system, credential: manifest.credential },
  }).hash;
}

/**
 * policiesHash of C6 (7.0.0): RFC 8785 canonical JSON of {"policies": <policies member>, "resourceTypes": <resourceTypes member>},
 * SHA-256. The declarations are covered because earlyScopeCheck, idPattern, scopePattern and classification weaken or strengthen checks.
 * The files are listed in file name order (a manifest rule), so the hash does not depend on how a build lists a directory.
 */
export function policiesHash(policies, resourceTypes) {
  const canonical = canonicalize({ policies, resourceTypes });
  return { canonical, hash: 'sha256:' + createHash('sha256').update(canonical, 'utf8').digest('hex') };
}

const PRIMITIVE_MEMBERS = {
  resource: ['name', 'title', 'description', 'uri', 'mimeType', 'annotations'],
  resourceTemplate: ['name', 'title', 'description', 'uriTemplate', 'mimeType', 'annotations'],
  prompt: ['name', 'title', 'description', 'arguments'],
};
// Entry fields next to the definition, in hash order (CC-258).
const PRIMITIVE_ENTRY_FIELDS = { resource: [], resourceTemplate: ['variables'], prompt: ['argumentRules', 'messages'] };

/**
 * Flat object hashed for a resource, a resource template or a prompt (CC-258): kind, the members of definition, the entry fields
 * (variables, or argumentRules and messages), additionalGroup when present, system, credential. kind keeps equal content under
 * two kinds from hashing alike, and keeps a primitive from colliding with a tool.
 */
export function primitiveHashInput({ kind, definition, entry = {}, server }) {
  const allowed = PRIMITIVE_MEMBERS[kind];
  if (allowed === undefined) throw new Error(`unknown kind: ${kind}`);
  const unhashed = Object.keys(definition).find((member) => !allowed.includes(member));
  if (unhashed !== undefined) throw new Error(`definition member not covered by definitionHash: ${unhashed}`);
  const flat = { kind };
  for (const member of allowed) if (definition[member] !== undefined) flat[member] = definition[member];
  for (const field of PRIMITIVE_ENTRY_FIELDS[kind]) flat[field] = entry[field];
  if (entry.additionalGroup !== undefined) flat.additionalGroup = entry.additionalGroup;
  flat.system = server.system;
  flat.credential = server.credential;
  return flat;
}

export function primitiveHash(input) {
  const canonical = canonicalize(primitiveHashInput(input));
  return { canonical, hash: 'sha256:' + createHash('sha256').update(canonical, 'utf8').digest('hex') };
}

/** Hash of a manifest resource, resource template or prompt entry; kind is resource, resourceTemplate or prompt. */
export function manifestPrimitiveHash(manifest, kind, entry) {
  return primitiveHash({ kind, definition: entry.definition, entry, server: { system: manifest.system, credential: manifest.credential } }).hash;
}
