// Reference for the aggregate endpoint /mcp (CC-169, CC-176): which tools a tools/list shows, how tools/call is routed and
// when a session is told that its list changed. Used by the vectors in test-vectors/endpoint-aggregate/; the gateway
// (ws-05) implements the same rules.
import { applyFilter } from './endpoint-filter.mjs';

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

/** tools/call on /mcp goes to mcp-<system> by the prefix of the name (CC-169); anything else is not_found_or_denied. */
export function routeCall(name, knownSystems) {
  const sep = typeof name === 'string' ? name.indexOf('__') : -1;
  if (sep <= 0) return { error: 'not_found_or_denied' };
  const system = name.slice(0, sep);
  const tool = name.slice(sep + 2);
  if (!knownSystems.includes(system) || tool === '') return { error: 'not_found_or_denied' };
  return { serverId: `mcp-${system}`, tool };
}

/** CC-176: a session is notified when the result of its tools/list (filter applied) is not what it was. */
export function listChangedNotification(filter, before, after) {
  const names = (tools) => applyFilter(filter, tools).map((t) => t.name);
  const a = names(before);
  const b = names(after);
  return a.length !== b.length || a.some((name, i) => name !== b[i]);
}
