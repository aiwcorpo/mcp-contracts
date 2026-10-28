// Reference rules of the gateway for C11 (CC-091): what happens to a destructive call. Used only by tests; the
// gateway (ws-05) implements the same table. The code is a TOTP verified by the broker, so the gateway only binds a
// pending call to (sub, serverId, tool, sha256 of the canonical arguments without confirmation_code) and maps the
// broker answer.
import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';

export const TTL_SECONDS = 120;
export const MAX_ATTEMPTS = 3;
// A code is valid for up to 90 s (30 s step, window of one step either way): a code typed after the preview stays usable that long.
export const CODE_VALIDITY_SECONDS = 90;

export function argumentsHash(args) {
  const { confirmation_code: _omitted, ...rest } = args;
  return 'sha256:' + createHash('sha256').update(canonicalize(rest), 'utf8').digest('hex');
}

/**
 * First call of a tool that needs confirmation. `authenticator` is the answer of GET /v1/authenticator
 * ('none', 'active', 'disabled' or 'unavailable'); `pendingCalls` are the user's pending calls
 * [{ tool, serverId, argsSha256, risk, createdAt, confirmationId }]; `pendingLimit` is the configured limit for
 * pending calls that are not DESTRUCTIVE (default 3). A user has at most one pending DESTRUCTIVE operation (CC-127):
 * a new one supersedes the older ones, whose ids are returned in `supersededIds`, unless the preview of an older one was
 * opened (see below).
 */
export function firstCall({ authenticator, pendingCalls, pendingLimit, call, at, burn = 'ok' }) {
  if (authenticator === 'unavailable') return { outcome: 'upstream_unavailable', pendingCreated: false };
  if (authenticator === 'none' || authenticator === 'disabled') return { outcome: 'confirmation_required', register: true, pendingCreated: false };
  const hash = argumentsHash(call.arguments);
  // A tombstone of a superseded call (`supersededBy`) is not a pending call: it neither matches a repeated first call nor
  // counts toward a limit, and a new pending call for the same operation replaces it (CC-127).
  const live = pendingCalls.filter((p) => !p.supersededBy && !p.ended && p.cancelledAt === undefined && at <= p.createdAt + TTL_SECONDS);
  const same = live.find((p) => p.serverId === call.serverId && p.tool === call.tool && p.argsSha256 === hash);
  if (same) return { outcome: 'confirmation_required', register: false, confirmationId: same.confirmationId, expiresAt: same.createdAt + TTL_SECONDS, pendingCreated: false, supersededIds: [] };
  if (call.risk === 'DESTRUCTIVE') {
    // First wins after the preview (CC-127): once the owner has opened the preview of a DESTRUCTIVE call A (the viewed call
    // sets previewViewedAt), a DIFFERENT DESTRUCTIVE operation B is refused until A is confirmed or the block ends at
    // max(A.expiresAt, previewViewedAt + 90 s). Exhausting the attempts of A or letting it expire does not end the block
    // earlier: the record stays as a blocking trace, otherwise the code typed for A could confirm B (review 3.0.0, N-H1).
    const blockers = pendingCalls.filter((p) => p.risk === 'DESTRUCTIVE' && p.previewViewedAt !== undefined && p.ended !== 'confirmed' && p.ended !== 'cancelled' && p.cancelledAt === undefined && !p.supersededBy
      && !(p.serverId === call.serverId && p.tool === call.tool && p.argsSha256 === hash)
      && at <= Math.max(p.createdAt + TTL_SECONDS, p.previewViewedAt + CODE_VALIDITY_SECONDS));
    if (blockers.length > 0) {
      const until = Math.max(...blockers.map((p) => Math.max(p.createdAt + TTL_SECONDS, p.previewViewedAt + CODE_VALIDITY_SECONDS)));
      return { outcome: 'confirmation_blocked', retryAfterSeconds: Math.max(1, Math.ceil(until - at)), pendingCreated: false };
    }
    // The block has ended, but a code typed for a viewed, unconfirmed A can still be valid (up to 90 s after A expired).
    // So creating B first burns the current codes at the broker, in the same per-user step as the creation; if the broker
    // fails, B is not created (review 3.0.0, F-H1). Needed also when A was CONFIRMED: a second code the user typed for A
    // (after a code that was refused for being on a step boundary) could still confirm B (G-H1). Not needed for the same
    // operation, nor for A that was cancelled (a cancel burned already). The trace of a viewed A is kept at least until
    // A.expiresAt + 90 s, whatever its state and whatever the end of the block (G-M1).
    const toBurn = pendingCalls.filter((p) => p.risk === 'DESTRUCTIVE' && p.previewViewedAt !== undefined && p.ended !== 'cancelled'
      && p.cancelledAt === undefined && !p.supersededBy && !p.burned
      // The same operation is exempt only while A was not executed: after a CONFIRMED A, a second code typed "for A" could
      // confirm the repeated operation A' (3.0.1), so the codes are burned before A' is created too.
      && !(p.ended !== 'confirmed' && p.serverId === call.serverId && p.tool === call.tool && p.argsSha256 === hash)
      && at <= p.createdAt + TTL_SECONDS + CODE_VALIDITY_SECONDS);
    if (toBurn.length > 0 && burn === 'failed') return { outcome: 'upstream_unavailable', pendingCreated: false };
    const supersededIds = live.filter((p) => p.risk === 'DESTRUCTIVE').map((p) => p.confirmationId);
    return { outcome: 'confirmation_required', register: false, expiresAt: at + TTL_SECONDS, pendingCreated: true, supersededIds, ...(toBurn.length > 0 && { invalidatedCodes: true }) };
  }
  const others = live.filter((p) => p.risk !== 'DESTRUCTIVE');
  if (others.length >= pendingLimit) {
    // Seconds until the oldest of them expires, i.e. until a slot is free.
    const retryAfterSeconds = Math.max(1, Math.ceil(Math.min(...others.map((p) => p.createdAt + TTL_SECONDS)) - at));
    return { outcome: 'rate_limited', retryAfterSeconds, pendingCreated: false };
  }
  return { outcome: 'confirmation_required', register: false, expiresAt: at + TTL_SECONDS, pendingCreated: true, supersededIds: [] };
}

/**
 * Retry with confirmation_code. `pending` is the stored record or null; `verification` is what the broker answers
 * to POST /v1/authenticator/verify ({result, retryAfterSeconds?}) and is only consulted when the gateway calls the
 * broker (`verifyCalled`), which it does only for a live pending call bound to the retry. A pending call that is
 * found but whose broker call fails keeps its attempts: the code is not "spent". A pending call that was superseded
 * by a newer DESTRUCTIVE one is kept as a tombstone until its own TTL ends (`supersededBy`), so that its retry gets
 * confirmation_superseded instead of confirmation_failed (CC-127); the broker is not asked.
 */
export function retry({ pending, attempt, verification, at }) {
  const hash = argumentsHash(attempt.arguments);
  const bound = pending !== null
    && pending.sub === attempt.sub && pending.serverId === attempt.serverId && pending.tool === attempt.tool && pending.argsSha256 === hash;
  if (!bound) return { outcome: 'confirmation_failed', verifyCalled: false };
  if (at > pending.createdAt + TTL_SECONDS) return { outcome: 'confirmation_failed', verifyCalled: false, auditReason: 'confirmation_expired' };
  if (pending.supersededBy) return { outcome: 'confirmation_superseded', verifyCalled: false, auditReason: 'superseded' };
  if (pending.cancelledAt !== undefined) return { outcome: 'confirmation_cancelled', verifyCalled: false, auditReason: 'cancelled_by_owner' };
  if (pending.attemptsLeft <= 0) return { outcome: 'confirmation_failed', verifyCalled: false, auditReason: 'attempts_exhausted' };
  switch (verification.result) {
    case 'ok':
      return { outcome: 'execute', verifyCalled: true, pendingConsumed: true, attemptsLeft: pending.attemptsLeft,
        auditReason: pending.previewViewedAt !== undefined ? 'user_confirmed' : 'user_confirmed_no_preview' };
    case 'invalid':
    case 'replayed': {
      const attemptsLeft = pending.attemptsLeft - 1;
      return { outcome: 'confirmation_failed', verifyCalled: true, pendingConsumed: attemptsLeft === 0, attemptsLeft,
        ...(attemptsLeft === 0 && { auditReason: 'attempts_exhausted' }) };
    }
    case 'burned':
      // Broker: the code is of a step burned by a cancel. Not a wrong guess: no attempt is spent, nothing counted; the client
      // sees confirmation_failed like for a replay (no new oracle).
      return { outcome: 'confirmation_failed', verifyCalled: true, pendingConsumed: false, attemptsLeft: pending.attemptsLeft, auditReason: 'code_burned' };
    case 'locked':
      return { outcome: 'rate_limited', verifyCalled: true, pendingConsumed: false, attemptsLeft: pending.attemptsLeft, retryAfterSeconds: verification.retryAfterSeconds };
    case 'disabled':
      return { outcome: 'confirmation_required', register: true, verifyCalled: true, pendingConsumed: false, attemptsLeft: pending.attemptsLeft, auditReason: 'authenticator_disabled' };
    case 'not_registered':
      return { outcome: 'confirmation_required', register: true, verifyCalled: true, pendingConsumed: false, attemptsLeft: pending.attemptsLeft, auditReason: 'authenticator_not_registered' };
    default:
      return { outcome: 'upstream_unavailable', verifyCalled: true, pendingConsumed: false, attemptsLeft: pending.attemptsLeft };
  }
}

/**
 * Several first calls that arrive at the same time. Creating a pending DESTRUCTIVE call and superseding the older one
 * is ONE atomic operation per user (a conditional write or a per-user lock), so the result equals applying the calls one
 * after the other in some order: at most one DESTRUCTIVE call stays pending. Returns the result of each call and the
 * ids that are pending at the end.
 */
export function firstCallsInOrder({ authenticator, pendingCalls, pendingLimit, calls, steps, at }) {
  let live = pendingCalls.map((p) => ({ ...p }));
  const results = [];
  // `steps` mixes first calls ({ call }) and openings of a preview ({ preview: confirmationId }); marking the preview as
  // viewed and the check for it in a new first call are atomic with each other (one operation per user).
  const sequence = steps ?? calls.map((call) => ({ call }));
  sequence.forEach((step, index) => {
    if (step.preview !== undefined) {
      // GET and viewed of a call whose attempts ran out: 404 when it was never viewed, idempotent when it was (3.0.1, G-L4).
      const target = live.find((p) => p.confirmationId === step.preview && !p.supersededBy && at <= p.createdAt + TTL_SECONDS
        && p.ended !== 'confirmed' && p.ended !== 'cancelled' && p.cancelledAt === undefined && (!p.ended || p.previewViewedAt !== undefined));
      if (target) target.previewViewedAt = at;
      results.push(target ? { previewed: true } : { previewed: false, status: 404 });
      return;
    }
    if (step.cancel !== undefined) {
      const target = live.find((p) => p.confirmationId === step.cancel && !p.supersededBy && at <= p.createdAt + TTL_SECONDS && p.ended !== 'confirmed');
      // The broker burn comes first; if it fails nothing is cancelled (503).
      if (step.burn === 'failed' && live.some((p) => p.confirmationId === step.cancel && p.ended !== 'cancelled')) {
        results.push({ cancelled: false, status: 503 });
        return;
      }
      // Only the cancel that changes the state burns the codes; repeating it is a plain 204 (review 3.0.0, F-L8).
      const first = target && target.ended !== 'cancelled';
      if (target) target.ended = 'cancelled';
      results.push(target ? { cancelled: true, burnedCodes: Boolean(first) } : { cancelled: false, status: 404 });
      return;
    }
    const call = step.call;
    const result = firstCall({ authenticator, pendingCalls: live, pendingLimit, call, at, burn: step.burn });
    results.push(result);
    if (result.invalidatedCodes) live = live.map((p) => (p.previewViewedAt !== undefined ? { ...p, burned: true } : p));
    if (result.pendingCreated) {
      live = live.map((p) => (result.supersededIds?.includes(p.confirmationId) ? { ...p, supersededBy: `new-${index}` } : p));
      live.push({ confirmationId: `new-${index}`, serverId: call.serverId, tool: call.tool, risk: call.risk, argsSha256: argumentsHash(call.arguments), createdAt: at });
    }
  });
  return { results, pendingIds: live.filter((p) => !p.supersededBy && !p.ended).map((p) => p.confirmationId) };
}

/**
 * Retries that arrive at the same time for one pending call. The attempt is RESERVED atomically before the broker is
 * asked (the counter of attempts is decremented first), so N parallel retries cause at most `attemptsLeft` broker
 * calls. A reservation is returned when the answer is locked, disabled, not_registered or the broker fails; it is kept
 * for invalid and replayed. Consuming the pending call on `ok` is a compare-and-delete: only one retry executes.
 * `attempts[i].verification` is the broker answer for that retry, used only if the retry gets to ask the broker.
 */
export function retriesInOrder({ pending, attempts, at }) {
  let current = pending === null ? null : { ...pending };
  let brokerCalls = 0;
  const outcomes = [];
  for (const item of attempts) {
    // The owner's cancel (CC-128) is a compare-and-delete on the same record as the code check, so it is ordered with
    // the retries. Idempotent while the record lives; 404 once the call is gone (executed, exhausted, expired, superseded).
    if (item.cancel) {
      if (current !== null && at <= current.createdAt + TTL_SECONDS) {
        current.cancelledAt = at;
        outcomes.push('cancelled');
      } else outcomes.push('not_found');
      continue;
    }
    const { attempt, verification } = item;
    const hash = argumentsHash(attempt.arguments);
    const bound = current !== null && current.sub === attempt.sub && current.serverId === attempt.serverId && current.tool === attempt.tool && current.argsSha256 === hash;
    if (bound && current.cancelledAt !== undefined) {
      outcomes.push('confirmation_cancelled');
      continue;
    }
    if (!bound || at > current.createdAt + TTL_SECONDS || current.attemptsLeft <= 0) {
      outcomes.push('confirmation_failed');
      continue;
    }
    current.attemptsLeft -= 1;
    brokerCalls += 1;
    switch (verification.result) {
      case 'ok':
        // A cancel that arrived while the broker was checking wins: executing consumes the pending call atomically, and a
        // cancelled record cannot be consumed. The step of the code is spent at the broker, which is acceptable.
        if (item.cancelDuringVerification) { current.cancelledAt = at; outcomes.push('confirmation_cancelled'); } else { outcomes.push('execute'); current = null; }
        break;
      case 'invalid': case 'replayed':
        outcomes.push('confirmation_failed');
        if (current.attemptsLeft === 0) current = null;
        break;
      case 'burned': current.attemptsLeft += 1; outcomes.push('confirmation_failed'); break;
      case 'locked': current.attemptsLeft += 1; outcomes.push('rate_limited'); break;
      case 'disabled': case 'not_registered': current.attemptsLeft += 1; outcomes.push('confirmation_required'); break;
      default: current.attemptsLeft += 1; outcomes.push('upstream_unavailable');
    }
  }
  return { outcomes, brokerCalls, attemptsLeft: current === null || current.cancelledAt !== undefined ? null : current.attemptsLeft };
}
