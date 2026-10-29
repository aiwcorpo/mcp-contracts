// Reference mapping of C1 failures to the HTTP answer of the gateway (CC-124). Used only by tests; the gateway (ws-05)
// implements the same table. A token that was checked and rejected is 401 with the RFC 9728 challenge and no reason; a
// failure of the infrastructure the check depends on (the IdP key set) is 503 without any challenge, so that a client
// does not start a new login that cannot help.
export const RETRY_AFTER_SECONDS = 10;
const INFRASTRUCTURE = new Set(['jwks_unavailable']);

export function gatewayAuthenticationResponse({ reason, publicBaseUrl, resourcePath, retryAfterSeconds = RETRY_AFTER_SECONDS }) {
  // CC-156: a request over a limit that is not a tool call. The client waits; it does not log in again, so no challenge,
  // and no X-RateLimit-* header, which would reveal the settings.
  if (reason === 'rate_limited') {
    const wait = Math.max(1, Math.ceil(retryAfterSeconds));
    return {
      status: 429,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': String(wait),
      },
      absentHeaders: ['WWW-Authenticate', 'Set-Cookie', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
      body: { error: 'rate_limited', message: 'Too many requests. Try again later.', retryAfterSeconds: wait },
    };
  }
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

/**
 * Which reason a token gets (CC-124). Checks that need no key come first: format, algorithm, claims that are readable
 * without verification. Only then the key is looked up. `keyCache` is the state of the IdP key set: 'usable' (fresh or
 * within the allowed staleness) or 'none' (never loaded or too old). `kid` is 'known' (in the usable key set) or
 * 'unknown'. `refresh` is the result of a fetch that the gateway is allowed to make for an unknown kid or an empty cache:
 * 'ok' (kid found: 'ok-kid-found', kid still unknown: 'ok-kid-missing'), 'failed', 'skipped-after-success' (the last
 * fetch succeeded less than the minimum interval ago, no new fetch) or 'skipped-after-failure' (the last fetch failed
 * less than the interval ago, no new fetch). An unknown kid never causes more than one fetch per interval.
 * Returns the reason (null when the signature check may go on) and the HTTP status.
 */
export function keyDecision({ independentReason = null, keyCache, kid, refresh = null }) {
  if (independentReason !== null) return { reason: independentReason, status: 401 };
  if (keyCache === 'usable' && kid === 'known') return { reason: null, status: null };
  if (refresh === 'ok-kid-found') return { reason: null, status: null };
  if (refresh === 'ok-kid-missing' || refresh === 'skipped-after-success') return { reason: 'unknown_kid', status: 401 };
  return { reason: 'jwks_unavailable', status: 503 };
}
