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
import { listJson } from '../scripts/lib/contracts.mjs';

test('entity-builder vectors agree with scripts/lib/entity-builder.mjs', () => {
  for (const { name, data } of listJson('test-vectors', 'entity-builder')) {
    let actual;
    try {
      actual = build(data.level, data.input);
    } catch (e) {
      if (!(e instanceof BuilderError)) throw e;
      actual = { error: e.code };
    }
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), data.expected, name);
  }
});
