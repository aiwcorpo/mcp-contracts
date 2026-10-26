// Rules of C5/C6 that JSON Schema cannot express (README: "Reguły semantyczne manifestu").
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
  return violations;
}
