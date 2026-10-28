// Generates test-vectors/totp/ (CC-092): the behaviour of the broker's TOTP authenticator. Expected values are
// written down here, not taken from scripts/lib/totp.mjs, and test/totp-vectors.test.mjs checks the reference
// implementation against them, so the two cannot drift together.
import { mkdirSync, writeFileSync } from 'node:fs';
import { path } from './lib/contracts.mjs';
import { matchingStep, otpauthUri, stepOf, totpCode } from './lib/totp.mjs';

// RFC 6238 test seed (ASCII "12345678901234567890"). Published, NOT FOR PRODUCTION.
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const NOTE = 'Seed of RFC 6238 appendix B, published: NOT FOR PRODUCTION.';
const T0 = 1792000030; // 2026-10-14T17:47:10Z, step 59733334

const write = (name, value) => {
  mkdirSync(path('test-vectors', 'totp'), { recursive: true });
  writeFileSync(path('test-vectors', 'totp', `${name}.json`), JSON.stringify(value, null, 2) + '\n');
};
const iso = (epoch) => new Date(epoch * 1000).toISOString().replace('.000Z', 'Z');
const codeAt = (epoch, stepDelta = 0) => totpCode(SECRET, stepOf(epoch) + stepDelta);
// A code that is wrong at every moment of the vector: asserted below so that a collision cannot hide a bug.
const WRONG = '000000';
const assertWrong = (epoch) => {
  if (matchingStep(SECRET, WRONG, epoch) !== null) throw new Error(`WRONG is valid at ${epoch}`);
};

write('rfc6238-sha1', {
  description: `Codes of RFC 6238 appendix B (last 6 digits of the 8 digit values), HMAC-SHA-1, step 30 s. ${NOTE}`,
  secret: SECRET,
  cases: [59, 1111111109, 1111111111, 1234567890, 2000000000, 20000000000].map((time) => ({ time, step: stepOf(time), code: totpCode(SECRET, stepOf(time)) })),
});

const state = (lastAcceptedStep = null, failures = [], lockedUntil = null) => ({ lastAcceptedStep, failures: failures.map(iso), lockedUntil: lockedUntil === null ? null : iso(lockedUntil) });
const verifyVector = (name, description, initial, steps) => write(name, { description: `${description} ${NOTE}`, secret: SECRET, initial, steps });
const stepAfter = (lastAcceptedStep, lockedUntil = null) => ({ lastAcceptedStep, lockedUntil: lockedUntil === null ? null : iso(lockedUntil) });

const S = stepOf(T0);
verifyVector('verify-valid-current', 'Code of the current step, no history: accepted, the step becomes the last accepted one.', state(),
  [{ op: 'verify', at: iso(T0), code: codeAt(T0), expected: { result: 'ok', after: stepAfter(S) } }]);
verifyVector('verify-valid-previous-step', 'Code of the previous step is inside the window.', state(),
  [{ op: 'verify', at: iso(T0), code: codeAt(T0, -1), expected: { result: 'ok', after: stepAfter(S - 1) } }]);
verifyVector('verify-valid-next-step', 'Code of the next step (phone clock slightly ahead) is inside the window.', state(),
  [{ op: 'verify', at: iso(T0), code: codeAt(T0, 1), expected: { result: 'ok', after: stepAfter(S + 1) } }]);
verifyVector('verify-invalid-two-steps-back', 'Two steps back is outside the window; no resynchronisation.', state(),
  [{ op: 'verify', at: iso(T0), code: codeAt(T0, -2), expected: { result: 'invalid', after: stepAfter(null) } }]);
verifyVector('verify-invalid-two-steps-ahead', 'Two steps ahead is outside the window.', state(),
  [{ op: 'verify', at: iso(T0), code: codeAt(T0, 2), expected: { result: 'invalid', after: stepAfter(null) } }]);
verifyVector('verify-replayed-same-step', 'The step of this code was already accepted: replayed.', state(S),
  [{ op: 'verify', at: iso(T0), code: codeAt(T0), expected: { result: 'replayed', after: stepAfter(S) } }]);
verifyVector('verify-replayed-older-step', 'A code of an older step than the last accepted one is replayed too.', state(S),
  [{ op: 'verify', at: iso(T0), code: codeAt(T0, -1), expected: { result: 'replayed', after: stepAfter(S) } }]);
verifyVector('verify-valid-next-step-after-use', 'After a step was used, the code of the next step is accepted (two confirmations need two codes).', state(S),
  [{ op: 'verify', at: iso(T0), code: codeAt(T0, 1), expected: { result: 'ok', after: stepAfter(S + 1) } }]);
verifyVector('verify-same-code-twice', 'The same code twice within its step: the second one is replayed.', state(),
  [{ op: 'verify', at: iso(T0), code: codeAt(T0), expected: { result: 'ok', after: stepAfter(S) } },
    { op: 'verify', at: iso(T0 + 5), code: codeAt(T0), expected: { result: 'replayed', after: stepAfter(S) } }]);
verifyVector('verify-malformed-5-digits', 'Five digits: 400, nothing counted and nothing changes.', state(),
  [{ op: 'verify', at: iso(T0), code: '70520', expected: { result: 'malformed', after: stepAfter(null) } }]);
verifyVector('verify-malformed-7-digits', 'Seven digits.', state(),
  [{ op: 'verify', at: iso(T0), code: '7052020', expected: { result: 'malformed', after: stepAfter(null) } }]);
verifyVector('verify-malformed-letter', 'A letter in the code.', state(),
  [{ op: 'verify', at: iso(T0), code: '70520a', expected: { result: 'malformed', after: stepAfter(null) } }]);
verifyVector('verify-malformed-leading-space', 'Leading space is not trimmed.', state(),
  [{ op: 'verify', at: iso(T0), code: ' 705202', expected: { result: 'malformed', after: stepAfter(null) } }]);
{
  const t = 1111111109; // RFC 6238: 081804
  verifyVector('verify-leading-zero-is-text', 'The code 081804 is compared as text; the number 81804 is not a code.', state(),
    [{ op: 'verify', at: iso(t), code: '081804', expected: { result: 'ok', after: stepAfter(stepOf(t)) } },
      { op: 'verify', at: iso(t + 30), code: '81804', expected: { result: 'malformed', after: stepAfter(stepOf(t)) } }]);
}
verifyVector('verify-not-counted-malformed-then-lockout-unaffected', 'Malformed codes do not count toward the lock: 10 of them, then a good code.', state(),
  [...Array.from({ length: 10 }, (_, i) => ({ op: 'verify', at: iso(T0 + i), code: '12345', expected: { result: 'malformed', after: stepAfter(null) } })),
    { op: 'verify', at: iso(T0 + 11), code: codeAt(T0 + 11), expected: { result: 'ok', after: stepAfter(stepOf(T0 + 11)) } }]);

// Lockout: 5 consecutive failures within 15 minutes lock verification for 15 minutes; only time lifts the lock.
{
  const fails = Array.from({ length: 5 }, (_, i) => T0 + i * 60);
  fails.forEach(assertWrong);
  const lockedUntil = fails[4] + 900;
  const wrongSteps = fails.map((at) => ({ op: 'verify', at: iso(at), code: WRONG, expected: { result: 'invalid', after: stepAfter(null, at === fails[4] ? lockedUntil : null) } }));
  const sixth = T0 + 5 * 60;
  verifyVector('lockout-five-failures-lock', 'Five wrong codes in 15 minutes lock verification; a sixth, correct code gets locked without being looked at.', state(),
    [...wrongSteps, { op: 'verify', at: iso(sixth), code: codeAt(sixth), expected: { result: 'locked', retryAfterSeconds: lockedUntil - sixth, after: stepAfter(null, lockedUntil) } }]);
  verifyVector('lockout-lifts-only-by-time', 'One second before the lock ends the answer is still locked, at the end the correct code is accepted.', state(),
    [...wrongSteps,
      { op: 'verify', at: iso(lockedUntil - 1), code: codeAt(lockedUntil - 1), expected: { result: 'locked', retryAfterSeconds: 1, after: stepAfter(null, lockedUntil) } },
      { op: 'verify', at: iso(lockedUntil), code: codeAt(lockedUntil), expected: { result: 'ok', after: stepAfter(stepOf(lockedUntil)) } }]);
  verifyVector('lockout-no-unlock-by-repeating', 'Hammering during the lock does not extend it and does not lift it.', state(),
    [...wrongSteps,
      ...[1, 100, 500, 899].map((delta) => ({ op: 'verify', at: iso(fails[4] + delta), code: WRONG, expected: { result: 'locked', retryAfterSeconds: lockedUntil - (fails[4] + delta), after: stepAfter(null, lockedUntil) } })),
      { op: 'verify', at: iso(lockedUntil + 1), code: codeAt(lockedUntil + 1), expected: { result: 'ok', after: stepAfter(stepOf(lockedUntil + 1)) } }]);
}
{
  const fourWrong = Array.from({ length: 4 }, (_, i) => T0 + i * 10);
  fourWrong.forEach(assertWrong);
  const wrong = (at) => ({ op: 'verify', at: iso(at), code: WRONG, expected: { result: 'invalid', after: stepAfter(null) } });
  const right = T0 + 60;
  verifyVector('lockout-four-failures-then-success', 'Four wrong codes and then a correct one: accepted, no lock.', state(),
    [...fourWrong.map(wrong), { op: 'verify', at: iso(right), code: codeAt(right), expected: { result: 'ok', after: stepAfter(stepOf(right)) } }]);
  const again = Array.from({ length: 4 }, (_, i) => right + 40 + i * 10);
  again.forEach(assertWrong);
  const second = right + 120;
  verifyVector('lockout-success-resets-counter', 'A success resets the counter: four wrong, a success, four wrong and a success are all accepted.', state(),
    [...fourWrong.map(wrong), { op: 'verify', at: iso(right), code: codeAt(right), expected: { result: 'ok', after: stepAfter(stepOf(right)) } },
      ...again.map((at) => ({ op: 'verify', at: iso(at), code: WRONG, expected: { result: 'invalid', after: stepAfter(stepOf(right)) } })),
      { op: 'verify', at: iso(second), code: codeAt(second), expected: { result: 'ok', after: stepAfter(stepOf(second)) } }]);
  const late = T0 + 16 * 60;
  assertWrong(late);
  verifyVector('lockout-old-failures-expire', 'Failures older than 15 minutes do not count: four wrong, then a fifth after 16 minutes is only invalid.', state(),
    [...fourWrong.map(wrong), { op: 'verify', at: iso(late), code: WRONG, expected: { result: 'invalid', after: stepAfter(null) } }]);
}
{
  const at = (i) => T0 + i * 3; // all inside step S: the code of S is still in the window
  const first = { op: 'verify', at: iso(at(0)), code: codeAt(at(0)), expected: { result: 'ok', after: stepAfter(stepOf(at(0))) } };
  const replay = (i) => ({ op: 'verify', at: iso(at(i)), code: codeAt(at(0)), expected: { result: 'replayed', after: stepAfter(stepOf(at(0)), i === 5 ? at(5) + 900 : null) } });
  verifyVector('lockout-replayed-counts-as-failure', 'Replayed codes count like wrong ones: after one success, five replays inside the same step lock.', state(),
    [first, ...[1, 2, 3, 4, 5].map(replay)]);
}

// Enrollment: the pending seed lives 10 minutes, three wrong codes destroy it.
const enrollVector = (name, description, createdAt, steps) =>
  write(name, { description: `${description} ${NOTE}`, secret: SECRET, enrollment: { createdAt: iso(createdAt), wrongCodes: 0 }, steps });
{
  const created = T0 - 60;
  enrollVector('enrollment-valid-activates', 'A correct first code activates the registration and sets the last accepted step.', created,
    [{ op: 'confirm', at: iso(T0), code: codeAt(T0), expected: { result: 'active', lastAcceptedStep: S } }]);
  enrollVector('enrollment-code-is-replayed-afterwards', 'The code that activated the registration cannot confirm an operation right after; the next step can.', created,
    [{ op: 'confirm', at: iso(T0), code: codeAt(T0), expected: { result: 'active', lastAcceptedStep: S } },
      { op: 'verify', at: iso(T0 + 5), code: codeAt(T0), expected: { result: 'replayed', after: stepAfter(S) } },
      { op: 'verify', at: iso(T0 + 35), code: codeAt(T0 + 35), expected: { result: 'ok', after: stepAfter(S + 1) } }]);
  assertWrong(T0);
  enrollVector('enrollment-wrong-then-right', 'One wrong code does not destroy the enrollment.', created,
    [{ op: 'confirm', at: iso(T0), code: WRONG, expected: { result: 'invalid_code' } },
      { op: 'confirm', at: iso(T0 + 1), code: codeAt(T0 + 1), expected: { result: 'active', lastAcceptedStep: stepOf(T0 + 1) } }]);
  enrollVector('enrollment-three-wrong-codes-destroy', 'The third wrong code destroys the enrollment; a correct code afterwards is enrollment_invalid and the user starts again.', created,
    [{ op: 'confirm', at: iso(T0), code: WRONG, expected: { result: 'invalid_code' } },
      { op: 'confirm', at: iso(T0 + 1), code: WRONG, expected: { result: 'invalid_code' } },
      { op: 'confirm', at: iso(T0 + 2), code: WRONG, expected: { result: 'enrollment_invalid' } },
      { op: 'confirm', at: iso(T0 + 3), code: codeAt(T0 + 3), expected: { result: 'enrollment_invalid' } }]);
  const ttl = T0 + 600;
  enrollVector('enrollment-valid-at-ttl', 'Exactly 10 minutes after the start the enrollment is still valid.', T0,
    [{ op: 'confirm', at: iso(ttl), code: codeAt(ttl), expected: { result: 'active', lastAcceptedStep: stepOf(ttl) } }]);
  enrollVector('enrollment-expired', 'One second after the 10 minute TTL the enrollment is gone, even with a correct code.', T0,
    [{ op: 'confirm', at: iso(ttl + 1), code: codeAt(ttl + 1), expected: { result: 'enrollment_invalid' } }]);
  enrollVector('enrollment-malformed-code', 'A malformed code is 400 and does not count as a wrong code.', created,
    [{ op: 'confirm', at: iso(T0), code: '12345', expected: { result: 'malformed' } },
      { op: 'confirm', at: iso(T0), code: '12345', expected: { result: 'malformed' } },
      { op: 'confirm', at: iso(T0), code: '12345', expected: { result: 'malformed' } },
      { op: 'confirm', at: iso(T0 + 1), code: codeAt(T0 + 1), expected: { result: 'active', lastAcceptedStep: stepOf(T0 + 1) } }]);
}

write('otpauth-uri', {
  description: `Fixed form of the otpauth URI (CC-092); username is percent-encoded. ${NOTE}`,
  secret: SECRET,
  cases: ['jkowalski', 'a b', 'jan.kowalski', 'zoe'].map((username) => ({ username, uri: otpauthUri(username, SECRET) })),
  invalidSecrets: ['gezdgnbvgy3tqojqgezdgnbvgy3tqojq', 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJ', 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ=', 'GEZDGNBVGY3TQOJ1GEZDGNBVGY3TQOJQ'],
});
console.log('totp vectors written');
