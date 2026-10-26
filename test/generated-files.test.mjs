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
