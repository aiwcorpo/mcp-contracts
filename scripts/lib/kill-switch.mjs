// Reference of the emergency switch of a server or a tool (CC-194). Used by the vectors in test-vectors/kill-switch; the gateway
// (ws-05) implements the same rules.

/** serverId and tool of a qualified tool name: jira__update_issue is mcp-jira and update_issue. */
function split(qualified) {
  const at = qualified.indexOf('__');
  return { serverId: `mcp-${qualified.slice(0, at)}`, tool: qualified.slice(at + 2) };
}

export function isSwitchedOff(switches, qualifiedTool) {
  const { serverId, tool } = split(qualifiedTool);
  return switches.some((s) => s.serverId === serverId && (s.scope === 'server' || s.tool === tool));
}

/**
 * What a gateway instance does with a switched tool. `storeReadable` false is a gateway that cannot read the switches (fail-closed:
 * the call is refused as upstream_unavailable and nothing is listed). A switch is lifted only by its own DELETE: an approval, a
 * registration of a manifest and a lift of the other scope leave it as it is.
 * The switch is a state of the tool like the others (CC-178, CC-206): it is looked at only for a user who may call the tool (`mayCall`) and
 * whose filter leaves it visible (`inFilter`); everyone else gets not_found_or_denied and learns nothing (invariant 8). The unreadable store
 * is the same refusal for everyone who gets that far.
 * events: call and confirm (the gate of a pending DESTRUCTIVE call is checked again before it runs) -> { allowed, errorCode, auditReason };
 * list (tools/list and the catalog) -> { listed }; approve, register -> { switches } after the event; lift-tool, lift-server -> { switches }.
 */
export function killSwitchDecision({ switches, tool, event, storeReadable = true, mayCall = true, inFilter = true }) {
  if (event === 'call' || event === 'confirm') {
    if (!mayCall) return { allowed: false, errorCode: 'not_found_or_denied', auditReason: 'not_granted' };
    if (!inFilter) return { allowed: false, errorCode: 'not_found_or_denied', auditReason: 'filter_scope' };
    if (!storeReadable) return { allowed: false, errorCode: 'upstream_unavailable', auditReason: 'upstream_unavailable' };
    if (isSwitchedOff(switches, tool)) return { allowed: false, errorCode: 'tool_disabled', auditReason: 'kill_switch' };
    return { allowed: true };
  }
  // CC-224: the catalog is computed with the state of the switches; an unreadable state is a 503, never a catalog that shows a switched tool.
  if (event === 'catalog') return storeReadable ? { status: 200 } : { status: 503, errorCode: 'upstream_unavailable', retryAfter: true };
  if (event === 'list') return { listed: storeReadable && !isSwitchedOff(switches, tool) };
  const { serverId, tool: name } = split(tool);
  if (event === 'lift-tool') return { switches: switches.filter((s) => !(s.scope === 'tool' && s.serverId === serverId && s.tool === name)) };
  if (event === 'lift-server') return { switches: switches.filter((s) => !(s.scope === 'server' && s.serverId === serverId)) };
  if (event === 'approve' || event === 'register') return { switches };
  throw new Error(`unknown event ${event}`);
}
