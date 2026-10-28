// Reference implementation of the broker rules for the TOTP authenticator (C4, CC-091, CC-092): RFC 6238 with
// HMAC-SHA-1, 6 digits, 30 s step, window of one step either way, one-time steps, lockout, enrollment. The broker
// (ws-06) implements the same behaviour; test-vectors/totp/ is the shared specification.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const STEP_SECONDS = 30;
export const DEFAULTS = Object.freeze({
  windowSteps: 1,
  maxFailures: 5,
  failureWindowSeconds: 900,
  lockSeconds: 900,
  enrollmentTtlSeconds: 600,
  enrollmentMaxWrongCodes: 3,
});

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(text) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of text) {
    const index = BASE32.indexOf(ch);
    if (index < 0) throw new Error(`not Base32: ${ch}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export const stepOf = (epochSeconds) => Math.floor(epochSeconds / STEP_SECONDS);

/** HOTP/TOTP value of one step as a 6 digit string (leading zeros kept). */
export function totpCode(secretBase32, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}

const sameText = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Greatest step of the window whose code equals the given one, or null. */
export function matchingStep(secretBase32, code, epochSeconds, windowSteps = DEFAULTS.windowSteps) {
  const now = stepOf(epochSeconds);
  for (let step = now + windowSteps; step >= now - windowSteps; step--) {
    if (sameText(totpCode(secretBase32, step), code)) return step;
  }
  return null;
}

export const isCodeFormat = (code) => typeof code === 'string' && /^[0-9]{6}$/.test(code);

export function otpauthUri(username, secretBase32) {
  const label = encodeURIComponent(username);
  return `otpauth://totp/MCP%20Platform:${label}?secret=${secretBase32}&issuer=MCP%20Platform&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Check of a code against an active registration. `state` is {lastAcceptedStep, failures: [epoch seconds], lockedUntil}
 * and is returned changed in `state`. Results: ok, invalid, replayed, locked, malformed (HTTP 400, nothing changes).
 * Only the passing of time lifts a lock: no operation of the API does (CC-091).
 */
export function verify(secret, state, code, at, config = DEFAULTS) {
  const next = { lastAcceptedStep: state.lastAcceptedStep, failures: [...state.failures], lockedUntil: state.lockedUntil };
  if (!isCodeFormat(code)) return { result: 'malformed', state: next };
  if (next.lockedUntil !== null && at < next.lockedUntil) {
    return { result: 'locked', retryAfterSeconds: Math.ceil(next.lockedUntil - at), state: next };
  }
  if (next.lockedUntil !== null) {
    next.lockedUntil = null;
    next.failures = [];
  }
  const step = matchingStep(secret, code, at, config.windowSteps);
  if (step !== null && (next.lastAcceptedStep === null || step > next.lastAcceptedStep)) {
    next.lastAcceptedStep = step;
    next.failures = [];
    return { result: 'ok', state: next };
  }
  next.failures = [...next.failures.filter((t) => t > at - config.failureWindowSeconds), at];
  if (next.failures.length >= config.maxFailures) next.lockedUntil = at + config.lockSeconds;
  return { result: step === null ? 'invalid' : 'replayed', state: next };
}

/**
 * Confirmation of a pending enrollment. `pending` is {createdAt, wrongCodes} or null (none, expired earlier or
 * destroyed). Results: active (lastAcceptedStep is set to the step of the code), invalid_code,
 * enrollment_invalid (expired, unknown or the third wrong code), malformed.
 */
export function confirmEnrollment(secret, pending, code, at, config = DEFAULTS) {
  if (!isCodeFormat(code)) return { result: 'malformed', pending };
  if (pending === null || at > pending.createdAt + config.enrollmentTtlSeconds) {
    return { result: 'enrollment_invalid', pending: null };
  }
  const step = matchingStep(secret, code, at, config.windowSteps);
  if (step !== null) return { result: 'active', lastAcceptedStep: step, pending: null };
  const wrongCodes = pending.wrongCodes + 1;
  if (wrongCodes >= config.enrollmentMaxWrongCodes) return { result: 'enrollment_invalid', pending: null };
  return { result: 'invalid_code', pending: { ...pending, wrongCodes } };
}
