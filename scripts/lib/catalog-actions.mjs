// Reference table of CC-083: the actions the BFF returns per catalog status. Shared by the vector test and the
// test that checks the OpenAPI examples against the same rule.
// CC-113: request_access needs known requiredEntitlements (entitlementsKnown, default true), otherwise there is nothing to ask for;
// a pending request for an entitlement that a denied tool needs (pendingRequestForDeniedTool) shows view_request instead,
// also for a connected server.
export function catalogActions({ status, supportedTypes, connectionType, hasConnection, someToolDenied, entitlementsKnown = true, pendingRequestForDeniedTool = false }) {
  const renew = connectionType === 'user-oauth' ? 'reconnect' : 'add_secret';
  const out = [];
  switch (status) {
    case 'connected':
      out.push('copy_link');
      if (hasConnection) out.push('disconnect');
      if (someToolDenied && pendingRequestForDeniedTool) out.push('view_request');
      else if (someToolDenied && entitlementsKnown) out.push('request_access');
      break;
    case 'expiring': out.push('copy_link', renew, 'disconnect'); break;
    case 'reconnect_required': out.push(renew, 'disconnect'); break;
    case 'not_connected':
      if (supportedTypes.includes('user-oauth')) out.push('connect_oauth');
      if (supportedTypes.includes('user-secret')) out.push('add_secret');
      break;
    case 'request_pending': out.push('view_request'); break;
    case 'no_access': if (entitlementsKnown) out.push('request_access'); break;
    default: throw new Error(status);
  }
  return out.sort();
}

// CC-265: resources, resource templates and prompts have no actions of their own; an entry with access denied counts for the
// server row like a denied tool. `entries` are the catalog entries of one server as {kind, access, requiredEntitlements,
// disabled}, kind being tool, resource, resource-template or prompt. A disabled resource, template or prompt is not denied
// (there is nothing to ask for until an administrator enables it); a tool counts as before, disabled or not, so inputs that only
// involve tools give what catalogActions gave. `pendingEntitlements` are the entitlements of the user's pending requests (C13).
const countsAsDenied = (entry) => entry.access === 'denied' && !(entry.kind !== 'tool' && entry.disabled === true);

export function deniedEntryFlags(entries, pendingEntitlements = []) {
  const denied = entries.filter(countsAsDenied);
  return {
    someToolDenied: denied.length > 0,
    entitlementsKnown: denied.some((e) => (e.requiredEntitlements ?? []).length > 0),
    pendingRequestForDeniedTool: denied.some((e) => (e.requiredEntitlements ?? []).some((g) => pendingEntitlements.includes(g))),
  };
}

export const catalogActionsOfEntries = ({ entries, pendingEntitlements, ...server }) => catalogActions({ ...server, ...deniedEntryFlags(entries, pendingEntitlements) });

// Status rules 1 and 2 of GET /api/v1/catalog (CC-021) with entries counted like tools: the server has no access when none of its
// entries is granted (disabled does not change a grant), and a pending request for an entitlement of any of them (a disabled resource, template or prompt asks for nothing) makes it
// request_pending. The rules 3 to 5 need the system and the connection.
export function catalogStatus({ entries, pendingEntitlements = [], credentialDefaultType, connectionStatus }) {
  if (!entries.some((e) => e.access === 'granted')) {
    const needed = entries.filter((e) => !(e.kind !== 'tool' && e.disabled === true)).flatMap((e) => e.requiredEntitlements ?? []);
    return needed.some((g) => pendingEntitlements.includes(g)) ? 'request_pending' : 'no_access';
  }
  if (['service-account', 'token-exchange'].includes(credentialDefaultType)) return 'connected';
  switch (connectionStatus) {
    case 'connected': return 'connected';
    case 'expiring': return 'expiring';
    case 'expired': case 'revoked': case 'error': case 'needs_reconnect': return 'reconnect_required';
    default: return 'not_connected';
  }
}
