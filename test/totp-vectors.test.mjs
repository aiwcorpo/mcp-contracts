import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listJson } from '../scripts/lib/contracts.mjs';
import { activate, base32Decode, burn, base32Encode, confirmEnrollment, otpauthUri, stepOf, totpCode, verify } from '../scripts/lib/totp.mjs';

const epoch = (iso) => Date.parse(iso) / 1000;
const vectors = listJson('test-vectors', 'totp');

test('RFC 6238 appendix B values (SHA-1, 6 digits)', () => {
  const { data } = vectors.find((v) => v.name === 'rfc6238-sha1.json');
  assert.equal(base32Encode(Buffer.from('12345678901234567890')), data.secret);
  assert.deepEqual(base32Decode(data.secret), Buffer.from('12345678901234567890'));
  for (const { time, step, code } of data.cases) {
    assert.equal(stepOf(time), step);
    assert.equal(totpCode(data.secret, step), code, `t=${time}`);
  }
});

function run(data) {
  let state = data.initial ? {
    lastAcceptedStep: data.initial.lastAcceptedStep,
    failures: data.initial.failures.map(epoch),
    dailyFailures: (data.initial.dailyFailures ?? []).map(epoch),
    lockedUntil: data.initial.lockedUntil === null ? null : epoch(data.initial.lockedUntil),
    disabled: data.initial.disabled ?? false,
  } : { lastAcceptedStep: null, failures: [], dailyFailures: [], lockedUntil: null, disabled: false };
  let pending = data.enrollment ? { createdAt: epoch(data.enrollment.createdAt), wrongCodes: data.enrollment.wrongCodes } : null;
  const trace = [];
  for (const step of data.steps) {
    const at = epoch(step.at);
    if (step.op === 'confirm') {
      const out = confirmEnrollment(data.secret, pending, step.code, at);
      pending = out.pending;
      if (out.result === 'active') state = activate(state, out.lastAcceptedStep);
      trace.push({ step, actual: { result: out.result, ...(out.result === 'active' && { lastAcceptedStep: out.lastAcceptedStep }) } });
    } else if (step.op === 'burn') {
      state = burn(state, at);
      trace.push({ step, actual: { after: { lastAcceptedStep: state.lastAcceptedStep, lockedUntil: state.lockedUntil === null ? null : new Date(state.lockedUntil * 1000).toISOString().replace('.000Z', 'Z') } } });
    } else {
      const out = verify(data.secret, state, step.code, at);
      state = out.state;
      trace.push({
        step,
        actual: {
          result: out.result,
          ...(out.retryAfterSeconds !== undefined && { retryAfterSeconds: out.retryAfterSeconds }),
          after: {
            lastAcceptedStep: state.lastAcceptedStep,
            lockedUntil: state.lockedUntil === null ? null : new Date(state.lockedUntil * 1000).toISOString().replace('.000Z', 'Z'),
            ...(state.disabled && { disabled: true }),
          },
        },
      });
    }
  }
  return trace;
}

for (const { name, data } of vectors.filter((v) => v.data.steps)) {
  test(`totp/${name}`, () => {
    assert.match(data.description, /NOT FOR PRODUCTION/);
    for (const { step, actual } of run(data)) assert.deepEqual(actual, step.expected, `${step.op} at ${step.at}`);
  });
}

test('totp/otpauth-uri.json: fixed form, Base32 seed pattern', () => {
  const { data } = vectors.find((v) => v.name === 'otpauth-uri.json');
  const pattern = /^[A-Z2-7]{32}$/;
  assert.ok(pattern.test(data.secret));
  for (const bad of data.invalidSecrets) assert.ok(!pattern.test(bad), bad);
  for (const { username, uri } of data.cases) {
    assert.equal(otpauthUri(username, data.secret), uri);
    assert.ok(uri.startsWith('otpauth://totp/MCP%20Platform:'));
    assert.ok(uri.endsWith(`&issuer=MCP%20Platform&algorithm=SHA1&digits=6&period=30`));
  }
  assert.ok(data.cases.some((c) => c.uri.includes('a%20b')));
});

test('every totp vector marks the seed as published', () => {
  for (const { name, data } of vectors) assert.match(data.description, /NOT FOR PRODUCTION/, name);
});
