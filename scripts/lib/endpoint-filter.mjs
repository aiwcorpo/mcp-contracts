// Reference for the filter in the query of the aggregate MCP endpoint (CC-170, CC-172). The gateway (ws-05), the portal
// (ws-07, through the BFF operation getMcpEndpoint) and the Java class pl.aiwcorpo.mcp.manifest.EndpointFilter must give
// the same answers; test-vectors/endpoint-filter/ pins them.

export const PARAMETERS = ['systems', 'tools', 'access', 'exclude'];
// The query is limited in bytes, not in entries (CC-185): "tools=" and the separators leave 506 bytes, so 16 names of 30
// characters or 31 names of 15 characters fit, not 100. A larger selection is expressed with systems and exclude.
export const MAX_QUERY_BYTES = 512;
export const MAX_SYSTEMS = 20;
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
    // A risk outside the closed set READ_ONLY, UPDATE, DESTRUCTIVE is in neither access group (CC-186).
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
 * Order of the checks of a request on /mcp or /s/<serverId>/mcp that carries a session (CC-184). The token is checked first
 * (not modeled here: a request without a valid token is a 401 before anything below). Then:
 *   1. syntax of the query: 400 invalid_filter; the answer depends only on the bytes of the request, the session is not read;
 *   2. the session belongs to the caller (`sub`): a session of another user and an unknown one give the same 404 and no
 *      filter_mismatch, so a request cannot tell whether a session exists;
 *   3. the route of the session: 404, filter_mismatch;
 *   4. the filter of the session after normalization: 404, filter_mismatch.
 * `Mcp-Session-Id` makes the request a session request whatever `_meta` says (a request with both is checked as above).
 * `session` is null for an unknown or expired session.
 */
export function sessionDecision({ requestQuery, route, callerSub, session }) {
  let requested;
  try {
    requested = parseFilter(requestQuery).canonical;
  } catch (e) {
    if (!(e instanceof InvalidFilter)) throw e;
    return { status: 400, error: 'invalid_request', reason: 'invalid_filter', sessionRead: false };
  }
  if (session === null || session.sub !== callerSub) return { status: 404, body: 'as for an unknown session', auditReason: null };
  if (session.route !== route) return { status: 404, body: 'as for an unknown session', auditReason: 'filter_mismatch' };
  if (parseFilter(session.initializeQuery).canonical !== requested) {
    return { status: 404, body: 'as for an unknown session', auditReason: 'filter_mismatch' };
  }
  return { status: 'continue' };
}

/**
 * CC-192: GET on /mcp or /s/<serverId>/mcp opens the stream of server notifications. The token has been checked (401, 503 come
 * before). Without Mcp-Session-Id or without Accept: text/event-stream the answer is 405, Allow: POST, DELETE, GET (the stateless
 * variant opens its stream with subscriptions/listen, a POST). With both the checks of a request of a session follow in the order
 * of CC-184 (sessionDecision); `continue` means the stream is opened for that session and filter.
 */
export function streamOpenDecision({ variant = 'session', sessionId, accept, ...session }) {
  // CC-206: the stateless variant has no session. The stream is opened by subscriptions/listen (a POST) and bound to the filter of that
  // request: token first, then the syntax of the filter (400); there is nothing to compare with, so no filter_mismatch.
  if (variant === 'stateless') {
    try {
      parseFilter(session.requestQuery);
    } catch (e) {
      if (!(e instanceof InvalidFilter)) throw e;
      return { status: 400, error: 'invalid_request', reason: 'invalid_filter', sessionRead: false };
    }
    return { status: 'continue' };
  }
  if (!sessionId || !/(^|,)\s*text\/event-stream\s*(;|,|$)/u.test(accept ?? '')) {
    return { status: 405, headers: { Allow: 'POST, DELETE, GET' } };
  }
  return sessionDecision(session);
}

/**
 * What the gateway does with tools/call on an endpoint with a filter (CC-170, CC-178, invariant 8). The filter is checked
 * first: a tool that the filter leaves out is not_found_or_denied whatever the state of its server, of the tool and of the
 * account, and the audit reason says filter_scope only when the user may call the tool. `mayCall` is the set of tools the
 * user could call without the filter: the registry knows the tool and the Cedar decision at the level of the tool (the
 * decision of tools/list, without arguments) allows it. It does not depend on availability. Only a tool the filter leaves
 * visible gets to the state checks, in this order: tool_disabled, upstream_unavailable, credential_required.
 * `state` is { toolEnabled, serverAvailable, connected }, all true when omitted; `pendingConfirmation` (optional) says that
 * the user has a pending DESTRUCTIVE confirmation for this call: the filter comes before the confirmation gate, so a call
 * the filter cuts leaves it untouched.
 */
export function callDecision(filter, tool, mayCall, state = null) {
  const visible = applyFilter(filter, mayCall).some((t) => t.name === tool);
  const s = { toolEnabled: true, serverAvailable: true, connected: true, ...state };
  const denied = (errorCode, auditReason) => ({ outcome: 'denied', errorCode, auditReason });
  let decision;
  if (visible) {
    // CC-206: the emergency switch is a state of the tool like the others: it comes after mayCall and the filter, so that a user who may
    // not call the tool, or whose filter cuts it, gets not_found_or_denied and not tool_disabled.
    if (s.killSwitch) decision = denied('tool_disabled', 'kill_switch');
    else if (!s.toolEnabled) decision = denied('tool_disabled', 'tool_disabled');
    else if (!s.serverAvailable) decision = denied('upstream_unavailable', 'upstream_unavailable');
    else if (!s.connected) decision = denied('credential_required', 'credential_required');
    else decision = { outcome: 'allowed' };
  } else {
    decision = denied('not_found_or_denied', mayCall.some((t) => t.name === tool) ? 'filter_scope' : 'not_granted');
    if (state?.pendingConfirmation && decision.auditReason === 'filter_scope') decision.pendingConfirmation = 'untouched';
  }
  return decision;
}
