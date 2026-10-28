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
    for (const { argument } of tool.resourceRefs) {
      if (!idArgument(tool.definition.inputSchema?.properties?.[argument])) violations.push('resource-ref-argument-declared');
    }
    if (tool.definition.name !== tool.name) violations.push('definition-name-matches');
    if (tool.definition.inputSchema?.properties?.confirmation_code !== undefined) violations.push('no-confirmation-code');
    violations.push(...inputSchemaViolations(tool.definition.inputSchema));
    if (manifestEntryHash(manifest, tool) !== tool.definitionHash) violations.push('definition-hash-matches');
  }
  return [...new Set(violations)];
}

// CC-043: a resourceRef must name a declared top-level argument whose values can be ids; a typo would leave
// context.refs empty and gateway rules would silently pass.
const ID_TYPES = new Set(['string', 'integer']);
function idArgument(property) {
  if (!property || typeof property !== 'object') return false;
  if (ID_TYPES.has(property.type)) return true;
  return property.type === 'array' && ID_TYPES.has(property.items?.type);
}

// CC-078, CC-123: inputSchema is closed and bounded, so that the gateway and the server agree on what a valid
// argument is and no argument can be unbounded. Applies to every tool of a manifest.
const COMBINATORS = ['allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else'];
const TYPES = new Set(['string', 'integer', 'number', 'boolean', 'array', 'object']);
const isCount = (value) => Number.isInteger(value) && value >= 0;

export function inputSchemaViolations(root) {
  const found = new Set();
  if (!root || typeof root !== 'object' || root.type !== 'object') found.add('input-schema-closed');
  const walk = (node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      found.add('input-schema-bounded');
      return;
    }
    if (COMBINATORS.some((keyword) => keyword in node)) found.add('input-schema-no-combinators');
    if (typeof node.type !== 'string' || !TYPES.has(node.type)) {
      found.add('input-schema-bounded');
      return;
    }
    const fixed = 'enum' in node || 'const' in node;
    if (node.pattern !== undefined && !(typeof node.pattern === 'string' && node.pattern.startsWith('^') && node.pattern.endsWith('$'))) {
      found.add('input-schema-bounded');
    }
    if (node.type === 'string' && !fixed && !isCount(node.maxLength)) found.add('input-schema-bounded');
    if ((node.type === 'integer' || node.type === 'number') && !fixed && !(typeof node.minimum === 'number' && typeof node.maximum === 'number')) {
      found.add('input-schema-bounded');
    }
    if (node.type === 'array') {
      if (!isCount(node.maxItems) || node.items === undefined) found.add('input-schema-bounded');
      if (node.items !== undefined) walk(node.items);
      for (const item of node.prefixItems ?? []) walk(item);
    }
    if (node.type === 'object') {
      if (node.additionalProperties !== false || 'patternProperties' in node || 'unevaluatedProperties' in node) found.add('input-schema-closed');
      for (const property of Object.values(node.properties ?? {})) walk(property);
    }
  };
  if (root && typeof root === 'object' && root.type === 'object') walk(root);
  return [...found];
}
