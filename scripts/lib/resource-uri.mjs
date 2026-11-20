// Reference for matching a requested resource URI against a URI template of RFC 6570 level 1 (CC-259). The gateway and the
// server use the same algorithm, so a URI that one accepts the other accepts with the same variables; test-vectors/resource-uri/
// pins it. A template is only {name} expressions between literal text (the manifest rule uri-template-level1 refuses operators
// and modifiers).
import { checkArgument } from './text-hygiene.mjs';

const UNRESERVED = /^[A-Za-z0-9\-._~]$/;
const VALUE = '(?:[A-Za-z0-9\\-._~]|%[0-9A-Fa-f]{2})+';

/** RFC 6570 level 1 expansion of one value: every character outside ALPHA, DIGIT and -._~ is percent-encoded in UTF-8, so "/" is %2F. */
export function encodeValue(value) {
  let out = '';
  for (const ch of value) {
    if (UNRESERVED.test(ch)) out += ch;
    else for (const byte of Buffer.from(ch, 'utf8')) out += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out;
}

/** Parts of a template: literal strings and { variable } entries, in order. */
export function templateParts(template) {
  const parts = [];
  let rest = template;
  while (rest.length > 0) {
    const open = rest.indexOf('{');
    if (open === -1) {
      parts.push(rest);
      break;
    }
    if (open > 0) parts.push(rest.slice(0, open));
    const close = rest.indexOf('}', open);
    if (close === -1) throw new Error('unterminated expression');
    parts.push({ variable: rest.slice(open + 1, close) });
    rest = rest.slice(close + 1);
  }
  return parts;
}

export function expand(template, values) {
  return templateParts(template).map((part) => (typeof part === 'string' ? part : encodeValue(values[part.variable]))).join('');
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function decodeStrict(encoded) {
  const bytes = [];
  for (let i = 0; i < encoded.length; ) {
    if (encoded[i] === '%') {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 3;
    } else {
      bytes.push(encoded.charCodeAt(i));
      i += 1;
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}

/** The hexadecimal digits of percent codes compare without regard to case; nothing else does. */
const normalizeHex = (uri) => uri.replace(/%[0-9A-Fa-f]{2}/g, (code) => code.toUpperCase());

/**
 * `variables` is [{ name, idPattern }] of the template (the pattern of the type of each variable). Returns { match: true, variables }
 * with the decoded values, or { match: false, reason }: shape (the text does not have the form of the template) or variable (it has, but a value
 * is not valid for its type). Each variable is decoded exactly once (strict UTF-8), must match the whole of its
 * idPattern and the text hygiene for identifiers, and the template expanded with the decoded values must equal the requested URI
 * byte for byte (up to the case of hex digits), so a query, a fragment, userinfo, an upper-case scheme, an encoded slash that the
 * type does not allow and a double encoding never match.
 */
export function matchTemplate(template, variables, uri) {
  const parts = templateParts(template);
  const names = parts.filter((p) => typeof p !== 'string').map((p) => p.variable);
  const regex = new RegExp(`^${parts.map((p) => (typeof p === 'string' ? escapeRegex(p) : `(${VALUE})`)).join('')}$`, 's');
  if (/[^\x21-\x7e]/.test(uri)) return { match: false, reason: 'shape' };
  const found = regex.exec(uri);
  if (found === null) return { match: false, reason: 'shape' };
  const decoded = {};
  for (const [i, name] of names.entries()) {
    const declared = variables.find((v) => v.name === name);
    const value = decodeStrict(found[i + 1]);
    if (declared === undefined || value === null) return { match: false, reason: 'variable' };
    if (!new RegExp(declared.idPattern, 'u').test(value) || !checkArgument(value, { identifier: true }).valid) return { match: false, reason: 'variable' };
    decoded[name] = value;
  }
  if (expand(template, decoded) !== normalizeHex(uri)) return { match: false, reason: 'variable' };
  return { match: true, variables: decoded };
}

/** A static resource matches by equality of the URI, byte for byte. */
export const matchStatic = (staticUri, uri) => staticUri === uri;

/**
 * Finds what a requested URI refers to among the approved entries: `resources` is [{ name, uri }], `templates` is
 * [{ name, uriTemplate, variables: [{ name, idPattern }] }]. The manifest rule resource-uri-unambiguous guarantees at most one entry. No entry gives { kind: null, reason }, the audit reason.
 */
export function resolveUri({ resources, templates }, uri) {
  const exact = resources.find((r) => matchStatic(r.uri, uri));
  if (exact) return { kind: 'resource', name: exact.name };
  let reason = 'uri_no_match';
  for (const t of templates) {
    const m = matchTemplate(t.uriTemplate, t.variables, uri);
    if (m.match) return { kind: 'template', name: t.name, variables: m.variables };
    if (m.reason === 'variable') reason = 'variable_invalid';
  }
  return { kind: null, reason };
}
