import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listJson } from '../scripts/lib/contracts.mjs';
import { checkArgument, sanitizeSystemText } from '../scripts/lib/text-hygiene.mjs';

const OPTIONS = {
  argument: {},
  'argument-identifier': { identifier: true },
  'argument-mention-filtered': { mention: true },
};
const vectors = listJson('test-vectors', 'text-hygiene');

test('text-hygiene vectors cover every mode with accepted and rejected input (CC-121, CC-122)', () => {
  for (const mode of [...Object.keys(OPTIONS), 'system-text']) {
    assert.ok(vectors.some((v) => v.data.mode === mode), mode);
  }
  for (const mode of Object.keys(OPTIONS)) {
    assert.ok(vectors.some((v) => v.data.mode === mode && v.data.expected.valid) && vectors.some((v) => v.data.mode === mode && !v.data.expected.valid), mode);
  }
});

for (const { name, data } of vectors) {
  test(`text-hygiene/${name}`, () => {
    if (data.mode === 'system-text') {
      assert.equal(sanitizeSystemText(data.input), data.expected.output);
    } else {
      assert.deepEqual(checkArgument(data.input, OPTIONS[data.mode]), data.expected);
    }
  });
}

test('sanitized system text is a fixed point and passes the argument check', () => {
  for (const { data } of vectors.filter((v) => v.data.mode === 'system-text')) {
    const once = sanitizeSystemText(data.input);
    assert.equal(sanitizeSystemText(once), once);
    assert.equal(checkArgument(once).valid, true);
  }
});

test('the vector files are ASCII only (invisible characters stay visible in review)', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const { path } = await import('../scripts/lib/contracts.mjs');
  for (const name of readdirSync(path('test-vectors', 'text-hygiene'))) {
    assert.ok(!/[^\x09\x0a\x20-\x7e]/.test(readFileSync(path('test-vectors', 'text-hygiene', name), 'utf8')), name);
  }
});
