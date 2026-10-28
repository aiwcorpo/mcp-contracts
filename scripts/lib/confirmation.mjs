// Reference rules of the gateway for C11 (CC-091): what happens to a destructive call. Used only by tests; the
// gateway (ws-05) implements the same table. The code is a TOTP verified by the broker, so the gateway only binds a
// pending call to (sub, serverId, tool, sha256 of the canonical arguments without confirmation_code) and maps the
// broker answer.
import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';

export const TTL_SECONDS = 120;
export const MAX_ATTEMPTS = 3;

export function argumentsHash(args) {
  const { confirmation_code: _omitted, ...rest } = args;
  return 'sha256:' + createHash('sha256').update(canonicalize(rest), 'utf8').digest('hex');
}

/**
 * First call of a tool that needs confirmation. `authenticator` is the answer of GET /v1/authenticator
 * ('none', 'active' or 'unavailable'); `pendingCalls` are the user's pending calls
 * [{ tool, serverId, argsSha256, createdAt, confirmationId }]; `pendingLimit` is the configured limit (default 3).
 */
export function firstCall({ authenticator, pendingCalls, pendingLimit, call, at }) {
  if (authenticator === 'unavailable') return { outcome: 'upstream_unavailable', pendingCreated: false };
  if (authenticator === 'none') return { outcome: 'confirmation_required', register: true, pendingCreated: false };
  const hash = argumentsHash(call.arguments);
  const live = pendingCalls.filter((p) => at <= p.createdAt + TTL_SECONDS);
  const same = live.find((p) => p.serverId === call.serverId && p.tool === call.tool && p.argsSha256 === hash);
  if (same) return { outcome: 'confirmation_required', register: false, confirmationId: same.confirmationId, expiresAt: same.createdAt + TTL_SECONDS, pendingCreated: false };
  if (live.length >= pendingLimit) return { outcome: 'rate_limited', pendingCreated: false };
  return { outcome: 'confirmation_required', register: false, expiresAt: at + TTL_SECONDS, pendingCreated: true };
}

/**
 * Retry with confirmation_code. `pending` is the stored record or null; `verification` is what the broker answers
 * to POST /v1/authenticator/verify ({result, retryAfterSeconds?}) and is only consulted when the gateway calls the
 * broker (`verifyCalled`), which it does only for a live pending call bound to the retry. A pending call that is
 * found but whose broker call fails keeps its attempts: the code is not "spent".
 */
export function retry({ pending, attempt, verification, at }) {
  const hash = argumentsHash(attempt.arguments);
  const bound = pending !== null
    && pending.sub === attempt.sub && pending.serverId === attempt.serverId && pending.tool === attempt.tool && pending.argsSha256 === hash;
  if (!bound) return { outcome: 'confirmation_failed', verifyCalled: false };
  if (at > pending.createdAt + TTL_SECONDS) return { outcome: 'confirmation_failed', verifyCalled: false, auditReason: 'confirmation_expired' };
  if (pending.attemptsLeft <= 0) return { outcome: 'confirmation_failed', verifyCalled: false, auditReason: 'attempts_exhausted' };
  switch (verification.result) {
    case 'ok':
      return { outcome: 'execute', verifyCalled: true, pendingConsumed: true, attemptsLeft: pending.attemptsLeft,
        auditReason: pending.previewViewed ? 'user_confirmed' : 'user_confirmed_no_preview' };
    case 'invalid':
    case 'replayed': {
      const attemptsLeft = pending.attemptsLeft - 1;
      return { outcome: 'confirmation_failed', verifyCalled: true, pendingConsumed: attemptsLeft === 0, attemptsLeft,
        ...(attemptsLeft === 0 && { auditReason: 'attempts_exhausted' }) };
    }
    case 'locked':
      return { outcome: 'rate_limited', verifyCalled: true, pendingConsumed: false, attemptsLeft: pending.attemptsLeft, retryAfterSeconds: verification.retryAfterSeconds };
    case 'not_registered':
      return { outcome: 'confirmation_required', register: true, verifyCalled: true, pendingConsumed: false, attemptsLeft: pending.attemptsLeft, auditReason: 'authenticator_not_registered' };
    default:
      return { outcome: 'upstream_unavailable', verifyCalled: true, pendingConsumed: false, attemptsLeft: pending.attemptsLeft };
  }
}
