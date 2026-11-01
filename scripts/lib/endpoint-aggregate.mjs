// Reference for the aggregate endpoint /mcp (CC-169, CC-176): which tools a tools/list shows, how tools/call is routed and
// when a session is told that its list changed. Used by the vectors in test-vectors/endpoint-aggregate/; the gateway
// (ws-05) implements the same rules.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { applyFilter } from './endpoint-filter.mjs';

/** CC-180: the time one server has to answer the read of its tools/list; configurable, 3 s by default. */
export const DEFAULT_TOOLS_LIST_TIMEOUT_MS = 3000;
/** CC-181: tools in one page of tools/list. */
export const PAGE_SIZE = 100;

const bytewise = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * `servers`: [{ serverId, available, tools: [{ name: "<system>__<tool>", risk, approved, enabled, served, definitionMatches, allowedByPolicy }] }].
 * A tool is listed when it is approved, enabled, served by the server, has the approved definition and the policy
 * decision for the current token allows it; a server that is not available is skipped as a whole (CC-169). The account
 * connection does not take part: a system without a connection keeps its tools (the call answers credential_required).
 * Order: system by ServerId, then tool name, bytewise.
 */
export function visibleTools(servers) {
  const out = [];
  for (const server of [...servers].sort((a, b) => bytewise(a.serverId, b.serverId))) {
    if (!server.available) continue;
    const listed = server.tools
      .filter((t) => t.approved && t.enabled && t.served && t.definitionMatches && t.allowedByPolicy)
      .sort((a, b) => bytewise(a.name, b.name));
    out.push(...listed.map(({ name, risk }) => ({ name, risk })));
  }
  return out;
}

/**
 * CC-180: whether a server counts as available for one tools/list. The read of its tools/list (taken from the cache within
 * the TTL, or made now) must end with a valid result within the timeout. A timeout, a connection or TLS error, a status other
 * than 200, a body that is not a JSON-RPC result of tools/list and a result that does not match the schema all make the server
 * unavailable for this list; it is skipped, and nothing else about it is concluded (no definition_changed, no tool_not_served).
 * `read` is { outcome: 'ok' | 'error' | 'invalid', elapsedMs } or { outcome: 'cached' } for a read inside the TTL.
 */
export function serverAvailable(read, timeoutMs = DEFAULT_TOOLS_LIST_TIMEOUT_MS) {
  if (read.outcome === 'cached') return true;
  return read.outcome === 'ok' && read.elapsedMs <= timeoutMs;
}

/** tools/call on /mcp goes to mcp-<system> by the prefix of the name (CC-169); anything else is not_found_or_denied. */
export function routeCall(name, knownSystems) {
  const sep = typeof name === 'string' ? name.indexOf('__') : -1;
  if (sep <= 0) return { error: 'not_found_or_denied' };
  const system = name.slice(0, sep);
  const tool = name.slice(sep + 2);
  if (!knownSystems.includes(system) || tool === '') return { error: 'not_found_or_denied' };
  return { serverId: `mcp-${system}`, tool };
}

/**
 * CC-176, moved to M6 by CC-179 and not required in this version: a session would be notified when the result of its
 * tools/list (filter applied) is not what it was. A tool counts as changed when its name, its risk or, if given, its
 * definitionHash differs. Kept as the reference for M6.
 */
export function listChangedNotification(filter, before, after) {
  const entries = (tools) => applyFilter(filter, tools).map((t) => `${t.name} ${t.risk} ${t.definitionHash ?? ''}`);
  const a = entries(before);
  const b = entries(after);
  return a.length !== b.length || a.some((entry, i) => entry !== b[i]);
}

/** Position of a tool in the list: system by ServerId, then tool name, bytewise (CC-169). The key of a cursor. */
export const listKey = (tool) => `mcp-${tool.name.slice(0, tool.name.indexOf('__'))}\u0000${tool.name}`;

/**
 * CC-181: one page of the list that tools/list computes (already filtered, in the order of CC-169). The cursor names the
 * last tool of the previous page, so a tool added or removed between two requests neither repeats nor skips a tool that
 * stays. nextCursorAfter is the name of the last tool of this page when more follow, otherwise null.
 */
export function page(list, afterName = null, pageSize = PAGE_SIZE) {
  const sorted = [...list].sort((a, b) => bytewise(listKey(a), listKey(b)));
  const after = afterName === null ? null : sorted.find((t) => t.name === afterName) ?? { name: afterName };
  const rest = after === null ? sorted : sorted.filter((t) => bytewise(listKey(t), listKey(after)) > 0);
  const tools = rest.slice(0, pageSize);
  return { tools: tools.map((t) => t.name), nextCursorAfter: rest.length > pageSize ? tools[tools.length - 1].name : null };
}

export const CURSOR_LIFETIME_SECONDS = 900;
const CURSOR_TEST_KEY = 'test-only-tools-list-cursor-key-NOT-FOR-PRODUCTION';
const TAG_BYTES = 16;
const mac = (sub, payload) => createHmac('sha256', CURSOR_TEST_KEY).update(`${sub}\n${payload}`).digest().subarray(0, TAG_BYTES);

/**
 * CC-181: the cursor of tools/list is opaque, carries the position and the normalized filter, and is authenticated by the
 * gateway like the cursor of the activity list (CC-095): HMAC-SHA-256 over (sub, payload) with a gateway key that all
 * instances share, a tag of at least 128 bits compared in constant time, valid 15 minutes. This is a model, not a format:
 * the gateway may build its cursors differently as long as it refuses what this function refuses. The vectors pin only
 * the outcome.
 */
export function issueCursor({ sub, canonicalFilter, afterName, iat }) {
  const payload = Buffer.from(JSON.stringify({ afterName, filter: canonicalFilter, iat })).toString('base64url');
  return `${payload}.${mac(sub, payload).toString('base64url')}`;
}

/** The same answer, -32602, for every cause: malformed, changed, expired, issued to another user or for another filter. */
export function readCursor(cursor, { sub, canonicalFilter, now }) {
  const invalid = { error: { code: -32602, message: 'Invalid cursor' } };
  if (typeof cursor !== 'string') return invalid;
  const [payload, tag, ...rest] = cursor.split('.');
  if (!payload || !tag || rest.length > 0) return invalid;
  const given = Buffer.from(tag, 'base64url');
  const expected = mac(sub, payload);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return invalid;
  let position;
  try {
    position = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return invalid;
  }
  if (typeof position?.iat !== 'number' || now < position.iat || now - position.iat > CURSOR_LIFETIME_SECONDS) return invalid;
  if (position.filter !== canonicalFilter || typeof position.afterName !== 'string') return invalid;
  return { afterName: position.afterName };
}

export const DEFAULT_AUDIT_INTERVAL_SECONDS = 10;

/**
 * CC-190: audit of requests the gateway refuses for a reason the client can repeat at will (invalid_filter, filter_mismatch,
 * invalid_cursor and a tools/call that is not_found_or_denied). Per user and reason one event in each interval; the rest only
 * raise a counter. Same rule as RateLimitAuditThrottle of the gateway (CC-156): per instance, in memory, interval 10 s by
 * default (MCP_RATE_LIMIT_AUDIT_INTERVAL). The refusal itself is never throttled, so every event has rejected: true.
 * `events` is [{ t (seconds), sub, reason }] in time order.
 */
export function auditThrottle(events, intervalSeconds = DEFAULT_AUDIT_INTERVAL_SECONDS) {
  const last = new Map();
  const suppressed = {};
  const decisions = events.map(({ t, sub, reason }) => {
    const key = `${sub}\n${reason}`;
    const at = last.get(key);
    const emit = at === undefined || t - at >= intervalSeconds;
    if (emit) last.set(key, t);
    else suppressed[reason] = (suppressed[reason] ?? 0) + 1;
    return { t, sub, reason, rejected: true, audited: emit };
  });
  return { decisions, suppressed };
}
