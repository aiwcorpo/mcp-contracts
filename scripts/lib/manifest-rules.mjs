// Rules of C5/C6 that JSON Schema cannot express (README: "Reguły semantyczne manifestu", CC-005, CC-018).
import { manifestEntryHash } from './definition-hash.mjs';

export function manifestRuleViolations(manifest) {
  const violations = [];
  if (manifest.serverId !== `mcp-${manifest.system}`) violations.push('serverId-matches-system');
  const names = manifest.tools.map((t) => t.name);
  if (new Set(names).size !== names.length) violations.push('unique-tool-names');
  const declared = new Set(manifest.resourceTypes.map((r) => r.type));
  const referenced = [
    ...manifest.tools.flatMap((t) => t.resourceRefs.map((r) => r.type)),
    ...manifest.resourceTypes.map((r) => r.parent).filter(Boolean),
  ];
  if (declared.size !== manifest.resourceTypes.length || referenced.some((type) => !declared.has(type))) {
    violations.push('resource-types-declared');
  }
  for (const tool of manifest.tools) {
    if (tool.definition.name !== tool.name) violations.push('definition-name-matches');
    if (tool.definition.inputSchema?.properties?.confirmation_code !== undefined) violations.push('no-confirmation-code');
    if (manifestEntryHash(manifest, tool) !== tool.definitionHash) violations.push('definition-hash-matches');
  }
  return [...new Set(violations)];
}
