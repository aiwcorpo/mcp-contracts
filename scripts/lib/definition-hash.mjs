// definitionHash of C6 as fixed by CC-004/CC-005: RFC 8785 canonical JSON of the flat object below, SHA-256.
import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';

export function hashInput({ tool, manifestEntry, server }) {
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
  return definitionHash({
    tool: entry.definition,
    manifestEntry: { risk: entry.risk, action: entry.action, resourceRefs: entry.resourceRefs },
    server: { system: manifest.system, credential: manifest.credential },
  }).hash;
}
