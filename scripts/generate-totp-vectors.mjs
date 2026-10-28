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

const state = (lastAcceptedStep = null, failures = [], lockedUntil = null, extra = {}) => ({ lastAcceptedStep, failures: failures.map(iso), lockedUntil: lockedUntil === null ? null : iso(lockedUntil), ...extra });
const verifyVector = (name, description, initial, steps) => write(name, { description: `${description} ${NOTE}`, secret: SECRET, initial, steps });
const stepAfter = (lastAcceptedStep, lockedUntil = null, extra = {}) => ({ lastAcceptedStep, lockedUntil: lockedUntil === null ? null : iso(lockedUntil), ...extra });

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

// Daily limit (CC-126): 20 failures (invalid or replayed) within 24 hours disable the authenticator until the user
// registers again. A success does not reset this counter; the 5/15 minute lock is separate and unchanged.
{
  const gap = 1200; // 20 minutes: never five failures in 15 minutes, so the short lock does not interfere
  const at = (i) => T0 + i * gap;
  Array.from({ length: 25 }, (_, i) => at(i)).forEach(assertWrong);
  const wrong = (i, after = stepAfter(null)) => ({ op: 'verify', at: iso(at(i)), code: WRONG, expected: { result: 'invalid', after } });
  const first19 = Array.from({ length: 19 }, (_, i) => wrong(i));
  verifyVector('daily-limit-disables-at-twenty', 'The 20th failure within 24 hours disables the authenticator; afterwards even a correct code gets disabled and is not looked at.', state(),
    [...first19, wrong(19, stepAfter(null, null, { disabled: true })),
      { op: 'verify', at: iso(at(20)), code: codeAt(at(20)), expected: { result: 'disabled', after: stepAfter(null, null, { disabled: true }) } }]);
  verifyVector('daily-limit-nineteen-is-not-enough', 'Nineteen failures leave the authenticator active; a correct code is accepted.', state(),
    [...first19, { op: 'verify', at: iso(at(19)), code: codeAt(at(19)), expected: { result: 'ok', after: stepAfter(stepOf(at(19))) } }]);
  const late = T0 + 25 * 3600;
  assertWrong(late);
  verifyVector('daily-limit-old-failures-expire', 'The window is rolling: nineteen failures older than 24 hours do not count, the next one is only invalid.', state(),
    [...first19, { op: 'verify', at: iso(late), code: WRONG, expected: { result: 'invalid', after: stepAfter(null) } }]);
  const okAt = at(10) + 600;
  verifyVector('daily-limit-success-does-not-reset', 'A success resets the 5/15 minute counter but not the daily one: ten failures, a success, ten more failures disable.', state(),
    [...Array.from({ length: 10 }, (_, i) => wrong(i)),
      { op: 'verify', at: iso(okAt), code: codeAt(okAt), expected: { result: 'ok', after: stepAfter(stepOf(okAt)) } },
      ...Array.from({ length: 10 }, (_, i) => ({ op: 'verify', at: iso(at(11 + i)), code: WRONG,
        expected: { result: 'invalid', after: stepAfter(stepOf(okAt), null, i === 9 ? { disabled: true } : {}) } }))]);
  verifyVector('daily-limit-replayed-counts', 'Replayed codes count toward the daily limit as well: initial state with 19 failures in the last hours, one replay disables.',
    state(S, [], null, { dailyFailures: Array.from({ length: 19 }, (_, i) => T0 - 3600 - i * 600).map(iso) }),
    [{ op: 'verify', at: iso(T0 + 3), code: codeAt(T0), expected: { result: 'replayed', after: stepAfter(S, null, { disabled: true }) } }]);
  verifyVector('daily-limit-disabled-ignores-lock-state', 'A disabled authenticator answers disabled, not locked, and malformed codes are still 400.', state(S, [], null, { disabled: true }),
    [{ op: 'verify', at: iso(T0), code: codeAt(T0, 1), expected: { result: 'disabled', after: stepAfter(S, null, { disabled: true }) } },
      { op: 'verify', at: iso(T0 + 1), code: '12345', expected: { result: 'malformed', after: stepAfter(S, null, { disabled: true }) } }]);
  verifyVector('daily-limit-locked-attempts-not-counted', 'Attempts answered locked are not failures: five failures lock, ten attempts during the lock change nothing, and the sixth real failure after the lock is only invalid.', state(),
    (() => {
      const f = Array.from({ length: 5 }, (_, i) => T0 + i * 60);
      const until = f[4] + 900;
      return [...f.map((t) => ({ op: 'verify', at: iso(t), code: WRONG, expected: { result: 'invalid', after: stepAfter(null, t === f[4] ? until : null) } })),
        ...Array.from({ length: 10 }, (_, i) => ({ op: 'verify', at: iso(f[4] + 10 + i), code: WRONG, expected: { result: 'locked', retryAfterSeconds: until - (f[4] + 10 + i), after: stepAfter(null, until) } })),
        { op: 'verify', at: iso(until), code: WRONG, expected: { result: 'invalid', after: stepAfter(null) } }];
    })());
}

// Parallel attempts (H1): the check, the counters and the lock are one atomic step per user (reserve before the code is
// computed), so fifty wrong codes in the same second give exactly five invalid answers and then locked.
{
  const t = T0 + 100;
  assertWrong(t);
  const until = t + 900;
  verifyVector('concurrent-fifty-wrong-codes-give-exactly-five-checks', 'Fifty wrong codes at the same instant: exactly five are checked (invalid), the other forty-five are locked. A broker that reads the counter before writing would answer invalid fifty times.', state(),
    Array.from({ length: 50 }, (_, i) => ({ op: 'verify', at: iso(t), code: WRONG,
      expected: i < 5 ? { result: 'invalid', after: stepAfter(null, i === 4 ? until : null) } : { result: 'locked', retryAfterSeconds: 900, after: stepAfter(null, until) } })));
  const gap = 1200;
  const base = T0 - 20 * gap;
  const twentieth = Array.from({ length: 19 }, (_, i) => base + i * gap);
  twentieth.forEach(assertWrong);
  verifyVector('concurrent-wrong-codes-hit-the-daily-limit-once', 'Nineteen failures are on record and three wrong codes arrive at the same instant: the first disables the authenticator, the others get disabled (the daily counter cannot be passed by racing).',
    state(null, [], null, { dailyFailures: twentieth.map(iso) }),
    [0, 1, 2].map((i) => ({ op: 'verify', at: iso(T0), code: WRONG, expected: i === 0 ? { result: 'invalid', after: stepAfter(null, null, { disabled: true }) } : { result: 'disabled', after: stepAfter(null, null, { disabled: true }) } })));
}

// Invalidation of the current codes when the owner cancels an operation (CC-128): a held code is replayed and is not a
// wrong guess; the next step works.
{
  const held = codeAt(T0);
  const heldAhead = codeAt(T0, 1);
  const verifyHeld = (i, code, at = T0 + 10 + i) => ({ op: 'verify', at: iso(at), code, expected: { result: 'burned', after: stepAfter(S + 1) } });
  const nextOk = T0 + 60;
  verifyVector('burn-held-code-is-burned-and-not-counted', 'The owner cancels: the codes of the current and the next step are burned. The held code is burned ten times without any effect on the limits, and the code of the next step (two steps on) is accepted.', state(),
    [{ op: 'burn', at: iso(T0 + 5), expected: { after: stepAfter(S + 1) } },
      ...Array.from({ length: 10 }, (_, i) => verifyHeld(i, held)),
      { op: 'verify', at: iso(nextOk), code: codeAt(nextOk), expected: { result: 'ok', after: stepAfter(stepOf(nextOk)) } }]);
  verifyVector('burn-also-burns-the-next-step-code', 'A phone that runs ahead shows the code of the next step: it is burned too.', state(),
    [{ op: 'burn', at: iso(T0 + 5), expected: { after: stepAfter(S + 1) } }, verifyHeld(0, heldAhead)]);
  const wrong = [0, 10, 20, 30].map((d) => T0 + d);
  wrong.forEach(assertWrong);
  verifyVector('burn-does-not-feed-the-lockout', 'Four wrong codes are on record, the held code is burned many times after the burn: no lock; the next real wrong code is the fifth failure and locks. Replays of burned codes did not count.', state(),
    [...wrong.map((t) => ({ op: 'verify', at: iso(t), code: WRONG, expected: { result: 'invalid', after: stepAfter(null) } })),
      { op: 'burn', at: iso(T0 + 35), expected: { after: stepAfter(S + 2) } },
      ...Array.from({ length: 8 }, (_, i) => ({ op: 'verify', at: iso(T0 + 36 + i), code: held, expected: { result: 'burned', after: stepAfter(S + 2) } })),
      { op: 'verify', at: iso(T0 + 50), code: WRONG, expected: { result: 'invalid', after: stepAfter(S + 2, T0 + 50 + 900) } }]);
  verifyVector('burn-does-not-feed-the-daily-limit', 'Nineteen failures in the last day and many presentations of the burned code: the daily counter is untouched, still active.', state(null, [], null, { dailyFailures: Array.from({ length: 19 }, (_, i) => T0 - 3600 - i * 600).map(iso) }),
    [{ op: 'burn', at: iso(T0 + 5), expected: { after: stepAfter(S + 1) } }, ...Array.from({ length: 5 }, (_, i) => verifyHeld(i, held))]);
  verifyVector('burn-is-idempotent-and-never-goes-back', 'A second burn in the same step changes nothing; a burn never lowers lastAcceptedStep.', state(S + 5),
    [{ op: 'burn', at: iso(T0 + 5), expected: { after: stepAfter(S + 5) } }, { op: 'burn', at: iso(T0 + 6), expected: { after: stepAfter(S + 5) } }]);
}

// Enrollment: the pending seed lives 10 minutes, three wrong codes destroy it.
const enrollVector = (name, description, createdAt, steps) =>
  write(name, { description: `${description} ${NOTE}`, secret: SECRET, enrollment: { createdAt: iso(createdAt), wrongCodes: 0 }, steps });
{
  const created = T0 - 60;
  write('enrollment-replaces-disabled-registration', {
    description: `Registering again is the only way out of a disabled authenticator (CC-126): the confirmed enrollment clears the disabled state and the daily counter, the code of the activation is replayed afterwards and the next step works. ${NOTE}`,
    secret: SECRET,
    initial: state(S - 100, [], null, { disabled: true, dailyFailures: Array.from({ length: 20 }, (_, i) => T0 - 7200 - i * 60).map(iso) }),
    enrollment: { createdAt: iso(T0 - 60), wrongCodes: 0 },
    steps: [{ op: 'verify', at: iso(T0 - 30), code: codeAt(T0 - 30), expected: { result: 'disabled', after: stepAfter(S - 100, null, { disabled: true }) } },
      { op: 'confirm', at: iso(T0), code: codeAt(T0), expected: { result: 'active', lastAcceptedStep: S } },
      { op: 'verify', at: iso(T0 + 5), code: codeAt(T0), expected: { result: 'replayed', after: stepAfter(S) } },
      { op: 'verify', at: iso(T0 + 35), code: codeAt(T0 + 35), expected: { result: 'ok', after: stepAfter(S + 1) } }],
  });
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
