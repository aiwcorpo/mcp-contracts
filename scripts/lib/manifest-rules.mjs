// Rules of C5/C6 that JSON Schema cannot express (README: "Manifest semantic rules", CC-005, CC-018).
import { manifestEntryHash, manifestPrimitiveHash, policiesHash } from './definition-hash.mjs';

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
    ...(manifest.resourceTemplates ?? []).flatMap((t) => t.variables.map((v) => v.type).filter(Boolean)),
    ...(manifest.prompts ?? []).flatMap((p) => p.argumentRules.map((r) => r.type).filter(Boolean)),
  ];
  if (declared.size !== manifest.resourceTypes.length || referenced.some((type) => !declared.has(type))) {
    violations.push('resource-types-declared');
  }
  violations.push(...resourceTypeViolations(manifest));
  violations.push(...policiesViolations(manifest));
  violations.push(...primitiveViolations(manifest));
  for (const tool of manifest.tools) {
    if (tool.additionalGroup !== undefined) {
      const prefix = `mcp-${manifest.system}-`;
      const suffix = tool.additionalGroup.startsWith(prefix) ? tool.additionalGroup.slice(prefix.length) : '';
      if (!/^[a-z][a-z0-9-]{0,30}$/.test(suffix) || ['read', 'write', 'destructive'].includes(suffix)) violations.push('additional-group-valid');
    }
    for (const { type } of tool.resourceRefs) {
      if (declared_(manifest).get(type)?.valueOnly === true) violations.push('resource-types-valid');
    }
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

const declared_ = (manifest) => new Map(manifest.resourceTypes.map((r) => [r.type, r]));
// CC-262: a type of one of these names would shadow a type of the base schema (Cedar 4 refuses a shadowed type).
export const RESERVED_TYPE_NAMES = ['User', 'UserGroup', 'ResourceScope', 'Tool', 'McpResource', 'McpPrompt', 'RequestContext'];
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
      // Same refusal as PatternGrammar: java.util.regex reads \Q...\E and \c as multi-character escapes.
      if (next === 'Q' || next === 'E' || next === 'c') return 'quote or control escape';
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
  return groups.length === 0 ? neighbouringQuantifiers(regex) : 'unbalanced parenthesis';
}

// \xHH, \uHHHH, \cX, \x{...}, \u{...}, \p{...}, \P{...}, \N{...} are one atom (PatternGrammar.escapeEnd).
function escapeEnd(regex, at) {
  const kind = regex[at + 1] ?? ' ';
  let end = at + 2;
  if ('xupPN'.includes(kind) && regex[at + 2] === '{' && regex.indexOf('}', at) > 0) end = regex.indexOf('}', at) + 1;
  else if (kind === 'x') end = at + 4;
  else if (kind === 'u') end = at + 6;
  else if (kind === 'c' || kind === 'p' || kind === 'P') end = at + 3;
  return Math.min(end, regex.length);
}

// The one BMP character of a hexadecimal escape, or null (any character) for every other multi-character escape.
function escapedCharacter(escape) {
  const hex = /^\\[xu](?:([0-9A-Fa-f]{2}|[0-9A-Fa-f]{4})|\{([0-9A-Fa-f]{1,6})\})$/.exec(escape);
  if (hex === null) return null;
  const code = parseInt(hex[1] ?? hex[2], 16);
  return code > 0xffff ? null : new Set([code]);
}

// Twin of PatternGrammar.neighbouringQuantifiers: two variable-width atoms of one sequence with overlapping characters
// (a*a*, a?a?, a{0,9}a{0,9}) cost about n^k steps on a failing id, unless a fixed atom disjoint from every variable atom
// before it separates them. A group is one atom over the characters of its body; only alternation starts a new sequence.
function neighbouringQuantifiers(regex) {
  const overlaps = (a, b) => a === null || b === null || [...a].some((k) => b.has(k));
  let i = 0;
  let violation = null;
  const quantifier = () => {
    let range = [1, 1];
    const q = regex[i];
    const counted = /^\{(\d+)(,(\d*))?\}/.exec(regex.slice(i));
    if (q === '*' || q === '+' || q === '?') {
      range = [q === '+' ? 1 : 0, q === '?' ? 1 : -1];
      i++;
    } else if (counted) {
      const min = Number(counted[1]);
      range = [min, counted[2] === undefined ? min : counted[3] === '' ? -1 : Number(counted[3])];
      i += counted[0].length;
    } else return range;
    if (regex[i] === '?' || regex[i] === '+') i++;
    return range;
  };
  const scan = () => {
    let any = false;
    let all = new Set();
    let variableBody = false;
    let pending = false;
    let pendingChars = null;
    while (i < regex.length && violation === null) {
      const c = regex[i];
      if (c === ')') break;
      if (c === '|') { variableBody = true; pending = false; i++; continue; }
      if (c === '^' || c === '$') { i++; continue; }
      let chars;
      let variable = false;
      if (c === '(') {
        if (regex.startsWith('(?:', i)) i += 3;
        else if (regex.startsWith('(?<', i) && regex.indexOf('>', i) > 0) i = regex.indexOf('>', i) + 1;
        else i++;
        const inner = scan();
        i++;
        if (inner === null) { quantifier(); continue; }
        ({ chars, variable } = inner);
      } else {
        let end = i + 1;
        if (c === '\\') end = escapeEnd(regex, i);
        else if (c === '[') {
          let k = i + 1;
          while (k < regex.length && regex[k] !== ']') k += regex[k] === '\\' ? 2 : 1;
          end = Math.min(k, regex.length - 1) + 1;
        }
        chars = c === '.' ? null : c === '\\' && end - i > 2 ? escapedCharacter(regex.slice(i, end)) : firstCharacters(regex.slice(i, end));
        i = end;
      }
      const [min, max] = quantifier();
      if (max === 0) continue;
      variable = variable || min !== max;
      any = true;
      all = all === null || chars === null ? null : new Set([...all, ...chars]);
      variableBody = variableBody || variable;
      if (variable) {
        if (pending && overlaps(pendingChars, chars)) violation = 'neighbouring quantified atoms overlap';
        else if (pending) pendingChars = new Set([...pendingChars, ...chars]);
        else { pending = true; pendingChars = chars; }
      } else if (pending && pendingChars !== null && chars !== null && !overlaps(pendingChars, chars)) {
        pending = false;
      }
    }
    return any ? { chars: all, variable: variableBody } : null;
  };
  scan();
  return violation;
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
    if (RESERVED_TYPE_NAMES.includes(d.type.slice(d.type.indexOf('::') + 2))) found.add('resource-type-name-reserved');
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

const TEMPLATE_VARIABLE = /\{([^{}]*)\}/g;
const LEVEL1_VARIABLE = /^[A-Za-z][A-Za-z0-9]{0,31}$/;
const PLACEHOLDER = /\{\{([^{}]*)\}\}/g;
const schemeOf = (uri) => uri.slice(0, uri.indexOf('://'));
const uriBody = (uri) => uri.slice(uri.indexOf('://') + 3);

/** Variable names of a URI template in order of occurrence, or null when the template is not level 1 (only {name}). */
export function templateVariables(template) {
  const names = [];
  const rest = template.replace(TEMPLATE_VARIABLE, (_, name) => {
    names.push(name);
    return '';
  });
  if (rest.includes('{') || rest.includes('}') || names.some((n) => !LEVEL1_VARIABLE.test(n))) return null;
  return names;
}

/**
 * Whether a URI template matches a URI when every variable stands for any non-empty text. Literal parts are found left to right
 * without backtracking, so the cost is linear in the length of the URI for each part.
 */
export function templateMatches(template, uri) {
  const literals = template.split(TEMPLATE_VARIABLE).filter((_, i) => i % 2 === 0);
  if (literals.length === 1) return uri === literals[0];
  if (!uri.startsWith(literals[0])) return false;
  let at = literals[0].length;
  for (const literal of literals.slice(1, -1)) {
    const found = uri.indexOf(literal, at + 1);
    if (found < 0) return false;
    at = found + literal.length;
  }
  const last = literals[literals.length - 1];
  return uri.length - last.length >= at + 1 && uri.endsWith(last);
}

const compiles = (pattern) => {
  try {
    new RegExp(pattern, 'u');
    return true;
  } catch {
    return false;
  }
};

// CC-258: resources, resource templates and prompts. definitionHash mismatches are reported as definition-hash-matches, like tools.
function primitiveViolations(manifest) {
  const found = new Set();
  const resources = manifest.resources ?? [];
  const templates = manifest.resourceTemplates ?? [];
  const prompts = manifest.prompts ?? [];
  const adapter = manifest.source === 'adapter';
  const declared = declared_(manifest);
  const schemeFits = (uri) => {
    const scheme = schemeOf(uri);
    return adapter ? scheme.startsWith(`${manifest.system}+`) : scheme === manifest.system;
  };
  const names = [...resources, ...templates].map((e) => e.name);
  if (new Set(names).size !== names.length) found.add('resource-names-unique');
  for (const [kind, entries] of [['resource', resources], ['resourceTemplate', templates], ['prompt', prompts]]) {
    for (const entry of entries) {
      if (manifestPrimitiveHash(manifest, kind, entry) !== entry.definitionHash) found.add('definition-hash-matches');
      if (entry.additionalGroup !== undefined) {
        const prefix = `mcp-${manifest.system}-`;
        const suffix = entry.additionalGroup.startsWith(prefix) ? entry.additionalGroup.slice(prefix.length) : '';
        if (!/^[a-z][a-z0-9-]{0,30}$/.test(suffix) || ['read', 'write', 'destructive'].includes(suffix)) found.add('additional-group-valid');
      }
    }
  }
  for (const resource of resources) {
    if (resource.definition.name !== resource.name) found.add('resources-valid');
    if (!schemeFits(resource.definition.uri)) found.add('resource-uri-scheme');
  }
  const skeletons = new Set();
  for (const template of templates) {
    const { definition, variables } = template;
    if (definition.name !== template.name) found.add('resource-templates-valid');
    if (!schemeFits(definition.uriTemplate)) found.add('resource-uri-scheme');
    const names_ = templateVariables(definition.uriTemplate);
    if (names_ === null) found.add('uri-template-level1');
    else {
      const first = [...new Set(names_)];
      if (first.length !== variables.length || first.some((n, i) => variables[i].name !== n)) found.add('uri-variables-bound');
      const skeleton = definition.uriTemplate.replace(TEMPLATE_VARIABLE, '{}');
      if (skeletons.has(skeleton)) found.add('resource-uri-unambiguous');
      skeletons.add(skeleton);
      if (resources.some((r) => templateMatches(definition.uriTemplate, r.definition.uri))) found.add('resource-uri-unambiguous');
    }
    if (adapter) {
      for (const variable of variables) {
        if (!anchoredPattern(variable.pattern) || grammarViolation(variable.pattern) !== null || !compiles(variable.pattern)) found.add('resource-templates-valid');
      }
    } else if (!variables.some((v) => declared.has(v.type) && declared.get(v.type).valueOnly !== true)) {
      found.add('uri-template-entity-variable');
    }
  }
  const promptNames = prompts.map((p) => p.name);
  if (new Set(promptNames).size !== promptNames.length) found.add('prompts-valid');
  for (const prompt of prompts) {
    const argumentNames = (prompt.definition.arguments ?? []).map((a) => a.name);
    const ruleNames = prompt.argumentRules.map((r) => r.name);
    if (prompt.definition.name !== prompt.name) found.add('prompts-valid');
    if (new Set(argumentNames).size !== argumentNames.length || new Set(ruleNames).size !== ruleNames.length
      || argumentNames.length !== ruleNames.length || argumentNames.some((n) => !ruleNames.includes(n))) found.add('prompts-valid');
    for (const rule of prompt.argumentRules) {
      if (!anchoredPattern(rule.pattern) || !compiles(rule.pattern)) found.add('prompts-valid');
    }
    for (const message of prompt.messages) {
      const used = [];
      const rest = message.text.replace(PLACEHOLDER, (_, name) => {
        used.push(name);
        return '';
      });
      if (used.some((n) => !argumentNames.includes(n)) || rest.includes('{{') || rest.includes('}}')) found.add('prompt-placeholders-declared');
    }
  }
  return [...found];
}
