// Reference mapping of C1 failures to the HTTP answer of the gateway (CC-124). Used only by tests; the gateway (ws-05)
// implements the same table. A token that was checked and rejected is 401 with the RFC 9728 challenge and no reason; a
// failure of the infrastructure the check depends on (the IdP key set) is 503 without any challenge, so that a client
// does not start a new login that cannot help.
export const RETRY_AFTER_SECONDS = 10;
const INFRASTRUCTURE = new Set(['jwks_unavailable']);

export function gatewayAuthenticationResponse({ reason, publicBaseUrl, resourcePath, retryAfterSeconds = RETRY_AFTER_SECONDS }) {
  if (INFRASTRUCTURE.has(reason)) {
    return {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': String(retryAfterSeconds),
      },
      absentHeaders: ['WWW-Authenticate', 'Set-Cookie'],
      body: { error: 'upstream_unavailable', message: 'The identity provider keys are temporarily unavailable. Try again in a few seconds.' },
    };
  }
  return {
    status: 401,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'WWW-Authenticate': `Bearer resource_metadata="${publicBaseUrl}/.well-known/oauth-protected-resource${resourcePath}"`,
    },
    absentHeaders: ['Retry-After', 'Set-Cookie'],
    body: { error: 'unauthenticated', message: 'Authentication required.' },
  };
}
