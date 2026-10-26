import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAjv, schemaFiles } from '../scripts/lib/contracts.mjs';

test('every JSON Schema compiles under draft 2020-12 in strict mode', () => {
  const ajv = createAjv();
  for (const file of schemaFiles()) {
    assert.ok(ajv.getSchema(file), `${file} did not compile`);
  }
});
