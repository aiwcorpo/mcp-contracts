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
