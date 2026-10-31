// Reference for the filter in the query of the aggregate MCP endpoint (CC-170, CC-172). The gateway (ws-05), the portal
// (ws-07, through the BFF operation getMcpEndpoint) and the Java class pl.aiwcorpo.mcp.manifest.EndpointFilter must give
// the same answers; test-vectors/endpoint-filter/ pins them.

export const PARAMETERS = ['systems', 'tools', 'access', 'exclude'];
export const MAX_QUERY_BYTES = 512;
export const MAX_SYSTEMS = 5;
export const MAX_TOOLS = 100;
export const MAX_EXCLUDE = 100;

const SYSTEM = /^[a-z][a-z0-9]*$/;
const TOOL = /^[a-z][a-z0-9]*__[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const ALLOWED_CHARACTERS = /^[A-Za-z0-9_,=&]*$/;
const MAX_TOOL_LENGTH = 80;
const MAX_SYSTEM_LENGTH = 32;

export class InvalidFilter extends Error {
  constructor(cause) {
    super(cause);
    this.cause = cause;
  }
}

const bytewise = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sortedUnique = (values) => [...new Set(values)].sort(bytewise);

const isSystem = (entry) => entry.length <= MAX_SYSTEM_LENGTH && SYSTEM.test(entry);
const isTool = (entry) => entry.length <= MAX_TOOL_LENGTH && TOOL.test(entry);

function list(name, value) {
  if (value === '') throw new InvalidFilter('empty_value');
  const entries = value.split(',');
  if (entries.some((entry) => entry === '')) throw new InvalidFilter('empty_entry');
  const unique = sortedUnique(entries);
  for (const entry of unique) {
    const ok = name === 'systems' ? isSystem(entry) : name === 'tools' ? isTool(entry) : isSystem(entry) || isTool(entry);
    if (!ok) throw new InvalidFilter('invalid_entry');
  }
  const max = { systems: MAX_SYSTEMS, tools: MAX_TOOLS, exclude: MAX_EXCLUDE }[name];
  if (unique.length > max) throw new InvalidFilter('too_many_entries');
  return unique;
}

/**
 * Parses the query of a request (without the leading "?"). Returns the normalized filter and its canonical text; an empty
 * query is no filter (canonical ""). Throws InvalidFilter with a short internal cause; the client only ever sees
 * 400 invalid_request, reason invalid_filter (schemas/common.schema.json, EndpointFilterError).
 */
export function parseFilter(rawQuery) {
  if (rawQuery === undefined || rawQuery === null || rawQuery === '') return { filter: emptyFilter(), canonical: '' };
  if (Buffer.byteLength(rawQuery, 'utf8') > MAX_QUERY_BYTES) throw new InvalidFilter('query_too_long');
  if (rawQuery.includes('%')) throw new InvalidFilter('percent_encoding');
  if (!ALLOWED_CHARACTERS.test(rawQuery)) throw new InvalidFilter('forbidden_character');
  const filter = emptyFilter();
  const seen = new Set();
  for (const part of rawQuery.split('&')) {
    if (part === '') throw new InvalidFilter('empty_parameter');
    const eq = part.indexOf('=');
    if (eq <= 0 || part.indexOf('=', eq + 1) !== -1) throw new InvalidFilter('malformed_parameter');
    const name = part.slice(0, eq).toLowerCase();
    const value = part.slice(eq + 1).toLowerCase();
    if (!PARAMETERS.includes(name)) throw new InvalidFilter('unknown_parameter');
    if (seen.has(name)) throw new InvalidFilter('repeated_parameter');
    seen.add(name);
    if (name === 'access') {
      if (value !== 'read' && value !== 'write') throw new InvalidFilter('invalid_access');
      filter.access = value;
    } else {
      filter[name] = list(name, value);
    }
  }
  return { filter, canonical: canonicalText(filter) };
}

export const emptyFilter = () => ({ systems: null, tools: null, access: null, exclude: null });

export function canonicalText(filter) {
  const parts = [];
  if (filter.systems) parts.push(`systems=${filter.systems.join(',')}`);
  if (filter.tools) parts.push(`tools=${filter.tools.join(',')}`);
  if (filter.access) parts.push(`access=${filter.access}`);
  if (filter.exclude) parts.push(`exclude=${filter.exclude.join(',')}`);
  return parts.join('&');
}

/** /s/<serverId>/mcp: systems must be absent or exactly the system of the route (CC-169). */
export function checkRoute(filter, routeSystem) {
  if (routeSystem === null || filter.systems === null) return;
  if (filter.systems.length !== 1 || filter.systems[0] !== routeSystem) throw new InvalidFilter('systems_not_route_system');
}

/**
 * The part of a list of tools that the filter leaves visible. `tools` is [{ name: "<system>__<tool>", risk }] and must
 * already be the set the user may call (CC-169); the filter only narrows it (CC-170). Order is kept.
 */
export function applyFilter(filter, tools) {
  return tools.filter((tool) => {
    const system = tool.name.slice(0, tool.name.indexOf('__'));
    if (filter.systems && !filter.systems.includes(system)) return false;
    if (filter.tools && !filter.tools.includes(tool.name)) return false;
    if (filter.access === 'read' && tool.risk !== 'READ_ONLY') return false;
    if (filter.access === 'write' && tool.risk !== 'UPDATE' && tool.risk !== 'DESTRUCTIVE') return false;
    if (filter.exclude && (filter.exclude.includes(system) || filter.exclude.includes(tool.name))) return false;
    return true;
  });
}

/** CC-172: the filter of a later request of a session must equal the one of initialize, after normalization. */
export function sessionMatches(initializeQuery, requestQuery) {
  return parseFilter(initializeQuery).canonical === parseFilter(requestQuery).canonical;
}

/**
 * What the gateway does with tools/call on an endpoint with a filter (CC-170, invariant 8): a tool that is in the visible
 * list is called; every other tool is not_found_or_denied, and the audit reason says filter_scope only when the user may
 * call the tool and the filter is what removes it. `mayCall` is the set of tools the user could call without the filter.
 */
export function callDecision(filter, tool, mayCall) {
  const visible = applyFilter(filter, mayCall).some((t) => t.name === tool);
  if (visible) return { outcome: 'allowed' };
  const reason = mayCall.some((t) => t.name === tool) ? 'filter_scope' : 'not_granted';
  return { outcome: 'denied', errorCode: 'not_found_or_denied', auditReason: reason };
}
