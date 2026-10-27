import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bundleOpenApi, bundledName } from '../scripts/bundle-openapi.mjs';
import { OPENAPI_FILES, path } from '../scripts/lib/contracts.mjs';

// Generated files are committed so that the jar and consumers without Node get them; they must not drift.
for (const file of OPENAPI_FILES) {
  test(`openapi/bundled/${bundledName(file)} is up to date (npm run generate)`, async () => {
    const committed = readFileSync(path('openapi', 'bundled', bundledName(file)), 'utf8');
    assert.equal(committed, await bundleOpenApi(file));
  });
}

import { build, BuilderError } from '../scripts/lib/entity-builder.mjs';
import { listJson, readJson } from '../scripts/lib/contracts.mjs';

test('entity-builder vectors agree with scripts/lib/entity-builder.mjs', () => {
  for (const { name, data } of listJson('test-vectors', 'entity-builder')) {
    let actual;
    try {
      actual = build(data.level, data.input, readJson(data.staticEntities));
    } catch (e) {
      if (!(e instanceof BuilderError)) throw e;
      actual = { error: e.code };
    }
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), data.expected, name);
  }
});

import { createHash, createPublicKey } from 'node:crypto';
import { readdirSync } from 'node:fs';

test('cedar/mcp.cedarschema is frozen for the 2.x line (byte hash, LF only)', () => {
  const bytes = readFileSync(path('cedar', 'mcp.cedarschema'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '1a55ec858db9c5ba303d9e1432e962a6bc50dd8fbeef7741278ae15ea8f588b1');
  assert.ok(!bytes.includes(0x0d));
});

test('security/published-test-keys.json lists exactly the published test keys', () => {
  const fromFiles = readdirSync(path('test-vectors', 'keys')).filter((n) => n.endsWith('.public.pem')).map((n) =>
    createHash('sha256').update(createPublicKey(readFileSync(path('test-vectors', 'keys', n))).export({ type: 'spki', format: 'der' })).digest('hex')).sort();
  const listed = readJson('security', 'published-test-keys.json').keys.map((k) => k.spkiSha256).sort();
  assert.deepEqual(listed, fromFiles);
});
