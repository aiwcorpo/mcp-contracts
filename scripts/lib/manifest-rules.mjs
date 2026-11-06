// Rules of C5/C6 that JSON Schema cannot express (README: "Manifest semantic rules", CC-005, CC-018).
import { manifestEntryHash, policiesHash } from './definition-hash.mjs';

export const RESERVED_SYSTEM_IDS = ['gateway', 'offboarding', 'portal', 'broker', 'prometheus', 'platform', 'admin', 'registry', 'adapter', 'internal', 'ci'];

export function manifestRuleViolations(manifest) {
  const violations = [];
  if (RESERVED_SYSTEM_IDS.includes(manifest.system)) violations.push('system-not-reserved');
  if (manifest.serverId !== `mcp-${manifest.system}`) violations.push('serverId-matches-system');
  // CC-168: the credential types of a system are either service-account alone or user types; a mix would let the Cedar context (the default type of
  // the system) hide a service account.
  const accepted = manifest.credential?.acceptedTypes ?? [];
  if (accepted.includes('service-account') && accepted.some((t) => t !== 'service-account')) violations.push('credential-types-not-mixed');
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
  violations.push(...resourceTypeViolations(manifest));
  violations.push(...policiesViolations(manifest));
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

const ATTRIBUTE = /^[a-z][A-Za-z0-9]*$/;
export const MAX_PATTERN_LENGTH = 512;
export const MAX_ID_LENGTH = 1024;

// The grammar of idPattern and scopePattern, chosen so that matching is linear: at most 512 characters, no back references, no
// lookaround, no quantifier applied to a group that contains a quantifier, and every quantified group with alternatives lets them
// start with disjoint characters ((a|aa)+ is out). Twin of PatternGrammar in mcp-manifest. Returns the first violation or null.
function firstCharacters(branch) {
  if (branch === '') return null;
  const set = new Set();
  const c = branch[0];
  if (c === '[') {
    const end = branch.indexOf(']');
    if (end < 0 || branch[1] === '^') return null;
    const inner = branch.slice(1, end);
    for (let i = 0; i < inner.length; i++) {
      let a = inner[i];
      if (a === '\\') {
        if (i + 1 >= inner.length || /[A-Za-z0-9]/.test(inner[i + 1])) return null;
        a = inner[++i];
      }
      if (i + 2 < inner.length && inner[i + 1] === '-') {
        const b = inner[i + 2];
        if (b === '\\') return null;
        for (let k = a.charCodeAt(0); k <= b.charCodeAt(0); k++) set.add(k);
        i += 2;
      } else set.add(a.charCodeAt(0));
    }
    return set;
  }
  if (c === '\\') {
    if (branch.length < 2) return null;
    const e = branch[1];
    if (e === 'd') { for (let k = 48; k <= 57; k++) set.add(k); return set; }
    if (/[A-Za-z0-9]/.test(e)) return null;
    set.add(e.charCodeAt(0));
    return set;
  }
  if ('().*+?{|^$'.includes(c)) return null;
  set.add(c.charCodeAt(0));
  return set;
}

function ambiguousAlternatives(body) {
  const branches = [];
  let depth = 0;
  let inClass = false;
  let from = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\') i++;
    else if (inClass) inClass = c !== ']';
    else if (c === '[') inClass = true;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === '|' && depth === 0) { branches.push(body.slice(from, i)); from = i + 1; }
  }
  branches.push(body.slice(from));
  if (branches.length < 2) return null;
  const seen = new Set();
  for (const branch of branches) {
    const first = firstCharacters(branch);
    if (first === null) return 'alternatives in a quantified group must start with a literal or a simple class';
    for (const k of first) {
      if (seen.has(k)) return 'alternatives in a quantified group overlap';
    }
    for (const k of first) seen.add(k);
  }
  return null;
}

export function grammarViolation(regex) {
  if (regex.length > MAX_PATTERN_LENGTH) return `longer than ${MAX_PATTERN_LENGTH} characters`;
  const groups = [];
  let inClass = false;
  let lastClosedHadQuantifier = false;
  let lastBody = null;
  for (let i = 0; i < regex.length; i++) {
    const c = regex[i];
    if (c === '\\') {
      const next = regex[i + 1] ?? ' ';
      if (!inClass && ((next >= '1' && next <= '9') || next === 'k')) return 'back reference';
      i++;
      lastClosedHadQuantifier = false;
      lastBody = null;
      continue;
    }
    if (inClass) { inClass = c !== ']'; continue; }
    if (c === '[') {
      inClass = true;
    } else if (c === '(') {
      if (/^\(\?(=|!|<=|<!)/.test(regex.slice(i))) return 'lookaround';
      let bodyStart = i + 1;
      if (regex.startsWith('(?:', i)) { bodyStart = i + 3; i += 2; }
      else if (regex.startsWith('(?<', i)) {
        const close = regex.indexOf('>', i);
        if (close < 0) return 'unsupported group syntax';
        bodyStart = close + 1;
        i = close;
      } else if (regex.startsWith('(?', i)) return 'unsupported group syntax';
      groups.push({ bodyStart, had: false });
      lastBody = null;
      continue;
    } else if (c === ')') {
      if (groups.length === 0) return 'unbalanced parenthesis';
      const group = groups.pop();
      if (group.had && groups.length > 0) groups[groups.length - 1].had = true;
      lastClosedHadQuantifier = group.had;
      lastBody = regex.slice(group.bodyStart, i);
      continue;
    } else if (c === '*' || c === '+' || c === '?' || c === '{') {
      if (c === '{' && !/^\{\d+(,\d*)?\}/.test(regex.slice(i))) {
        lastClosedHadQuantifier = false;
        lastBody = null;
        continue;
      }
      if (lastClosedHadQuantifier) return 'quantifier applied to a group that contains a quantifier';
      if (lastBody !== null) {
        const ambiguous = ambiguousAlternatives(lastBody);
        if (ambiguous) return ambiguous;
      }
      if (groups.length > 0) groups[groups.length - 1].had = true;
      if (c === '{') i = regex.indexOf('}', i);
      lastClosedHadQuantifier = false;
      lastBody = null;
      continue;
    }
    lastClosedHadQuantifier = false;
    lastBody = null;
  }
  return groups.length === 0 ? null : 'unbalanced parenthesis';
}
const namespaceOf = (type) => type.slice(0, type.indexOf('::'));

// 7.0.0: the declarations are the only source of what the entity builder knows, so an inconsistent one is refused at
// registration. Patterns must compile in the subset Java and ECMAScript share.
function resourceTypeViolations(manifest) {
  const found = new Set();
  const declared = new Map(manifest.resourceTypes.map((r) => [r.type, r]));
  const compiles = (pattern) => {
    try {
      new RegExp(pattern, 'u');
      return true;
    } catch {
      return false;
    }
  };
  for (const d of manifest.resourceTypes) {
    const attributes = d.attributes ?? [];
    if (attributes.includes('scopes')) found.add('resource-types-valid');
    if (d.parent !== undefined) {
      const parent = declared.get(d.parent);
      if (parent && namespaceOf(parent.type) !== namespaceOf(d.type)) found.add('resource-types-valid');
      if (attributes.includes(d.parentAttribute) || d.parentAttribute === 'scopes' || !ATTRIBUTE.test(d.parentAttribute ?? '')) found.add('resource-types-valid');
    }
    if (d.earlyScopeCheck && d.scopePattern === undefined) found.add('resource-types-valid');
    if (d.classification && !attributes.includes(d.classification.attribute)) found.add('resource-types-valid');
    for (const pattern of [d.idPattern, d.scopePattern]) {
      if (pattern !== undefined && (!anchoredPattern(pattern) || grammarViolation(pattern) !== null || !compiles(pattern))) found.add('resource-types-valid');
    }
  }
  const namespaces = new Set(manifest.resourceTypes.map((r) => namespaceOf(r.type)));
  if (namespaces.size > 1 || (manifest.policies && namespaces.size === 1 && !namespaces.has(manifest.policies.namespace))) {
    found.add('resource-types-namespace');
  }
  return [...found];
}

function policiesViolations(manifest) {
  const found = new Set();
  const { policies } = manifest;
  if (!policies) return [];
  const names = policies.files.map((f) => f.name);
  if (names.some((name, i) => i > 0 && !(names[i - 1] < name))) found.add('policies-files-sorted-unique');
  if (policiesHash(policies, manifest.resourceTypes).hash !== manifest.policiesHash) found.add('policies-hash-matches');
  return [...found];
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
    if (node.pattern !== undefined && !anchoredPattern(node.pattern)) {
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

// A pattern is anchored when it starts with ^, ends with an unescaped $ and has no alternation outside every group, so
// that "^a|b$" (which matches any string containing b) is not accepted (CC-123).
export function anchoredPattern(pattern) {
  if (typeof pattern !== 'string' || !pattern.startsWith('^') || !pattern.endsWith('$')) return false;
  let backslashes = 0;
  for (let i = pattern.length - 2; i >= 0 && pattern[i] === '\\'; i--) backslashes++;
  if (backslashes % 2 === 1) return false;
  let depth = 0;
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\') { i++; continue; }
    if (inClass) { if (ch === ']') inClass = false; continue; }
    if (ch === '[') inClass = true;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === '|' && depth === 0) return false;
  }
  return true;
}
