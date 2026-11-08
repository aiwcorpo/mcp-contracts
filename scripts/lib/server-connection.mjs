// Reference of what an administrator sees and what the gateway serves while a server is being connected (CC-249).
// Used by the vectors in test-vectors/server-connection.

/**
 * The state right after `POST /admin/v1/servers`: the manifest was pulled and nothing is approved. `tools` is [{ name, risk }]. Every tool is
 * pending_approval, a READ_ONLY one included, the policies are pending, the connection is pending and no tool is listed to anyone.
 */
export function firstConnection({ tlsMode, tools }) {
  return {
    status: 'pending_approval',
    connection: null,
    pendingConnection: { tlsMode },
    policies: 'pending_approval',
    tools: Object.fromEntries(tools.map((t) => [t.name, 'pending_approval'])),
    listed: [],
  };
}

/**
 * Whether a tool is listed and callable: the connection AND the policies AND the tool must be approved. A tool of a server whose connection
 * or policies wait is hidden and refused as tool_disabled (audit reason tool_disabled), the same fail-closed answer as for a pending tool;
 * `disabledBy` is approval (C5, DisabledBy). `serverStatus` unreachable or certificate_changed (an approved connection that the server does not
 * meet right now) does not hide the tool but refuses the call as upstream_unavailable (C10).
 */
export function toolAvailability({ connectionApproved, policiesApproved, toolStatus, serverStatus = 'connected' }) {
  if (!connectionApproved || !policiesApproved || toolStatus !== 'approved') {
    return { listed: false, errorCode: 'tool_disabled', disabledBy: 'approval' };
  }
  if (serverStatus === 'unreachable' || serverStatus === 'certificate_changed') return { listed: true, errorCode: 'upstream_unavailable' };
  return { listed: true };
}

/**
 * The connection a pinned or ca server presents against the approved one. `approved` is { tlsMode, fingerprint } and `presented` is
 * { fingerprint, validatesAsCa }. Pinned: another fingerprint makes the server unreachable and records a pending connection (certificate_changed).
 * ca: a renewal that still validates needs nothing; a certificate that no longer validates becomes pending too (ca_validation_failed).
 * plain: nothing to check.
 */
export function connectionCheck({ approved, presented }) {
  if (approved.tlsMode === 'plain') return { status: 'connected' };
  if (approved.tlsMode === 'pinned') {
    return presented.fingerprint === approved.fingerprint
      ? { status: 'connected' }
      : { status: 'certificate_changed', pendingConnection: { tlsMode: presented.validatesAsCa ? 'ca' : 'pinned', reason: 'certificate_changed' } };
  }
  return presented.validatesAsCa
    ? { status: 'connected', connectionRefreshed: presented.fingerprint !== approved.fingerprint }
    : { status: 'certificate_changed', pendingConnection: { tlsMode: 'pinned', reason: 'ca_validation_failed' } };
}

/**
 * What approveServerConnection answers. `pending` is { tlsMode (proposed), fingerprint, validatesAsCa } or null; `body` is { tlsMode, fingerprint };
 * `addedWithAllowPlainHttp` and `scheme` come from the server. 409 first (nothing pending, or another certificate than the one shown), then 422 for a
 * mode the pending connection does not allow.
 */
export function approveConnectionDecision({ pending, body, scheme = 'https', addedWithAllowPlainHttp = false }) {
  if (pending === null) return { status: 409, error: 'no_pending_connection' };
  if (body.fingerprint !== pending.fingerprint) return { status: 409, error: 'connection_changed' };
  const allowed = scheme === 'http'
    ? body.tlsMode === 'plain' && addedWithAllowPlainHttp
    : (body.tlsMode === 'pinned') || (body.tlsMode === 'ca' && pending.validatesAsCa);
  if (!allowed) return { status: 422, error: 'server_rejected', reason: 'tls_mode_not_allowed' };
  return { status: 200, connection: { tlsMode: body.tlsMode, fingerprint: body.fingerprint }, pendingConnection: null };
}

/**
 * Whether the add request is refused because the manifest names another system than the administrator expected. `expectedSystem` is the optional
 * field of the request (null or absent: no check), `manifestSystem` the `system` of the pulled manifest. The check runs before any decision on the
 * serverId, so a server that claims a system whose users hold credentials is refused when the administrator named the system they expected.
 */
export function expectedSystemDecision({ expectedSystem = null, manifestSystem }) {
  if (expectedSystem !== null && expectedSystem !== manifestSystem) return { status: 422, error: 'server_rejected', reason: 'system_mismatch' };
  return { status: 200 };
}
