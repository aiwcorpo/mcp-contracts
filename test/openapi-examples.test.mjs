import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAjv, dereferenceOpenApi, formatErrors, OPENAPI_FILES, operations } from '../scripts/lib/contracts.mjs';

// Spectral already checks examples; this repeats it with ajv in strict draft 2020-12 mode so that
// unevaluatedProperties and formats behave exactly like in the JSON Schema vector tests.
function* examplesOf(operation) {
  const body = operation.requestBody?.content?.['application/json'];
  for (const [name, ex] of Object.entries(body?.examples ?? {})) {
    yield { where: `request ${name}`, schema: body.schema, value: ex.value };
  }
  for (const [status, response] of Object.entries(operation.responses ?? {})) {
    const media = response.content?.['application/json'];
    for (const [name, ex] of Object.entries(media?.examples ?? {})) {
      yield { where: `${status} ${name}`, schema: media.schema, value: ex.value };
    }
  }
}

for (const file of OPENAPI_FILES) {
  test(`${file}: every example matches its schema`, async () => {
    const spec = await dereferenceOpenApi(file);
    const ajv = createAjv();
    let count = 0;
    for (const { route, method, operation } of operations(spec)) {
      for (const { where, schema, value } of examplesOf(operation)) {
        const validate = ajv.compile(structuredClone(schema));
        assert.ok(validate(value), `${method.toUpperCase()} ${route} ${where}: ${formatErrors(validate.errors)}`);
        count++;
      }
    }
    assert.ok(count > 0, 'no examples found');
  });

  test(`${file}: every operation has a 2xx or 3xx example or an empty success response`, async () => {
    const spec = await dereferenceOpenApi(file);
    for (const { route, method, operation } of operations(spec)) {
      const success = Object.entries(operation.responses).find(([status]) => /^[23]/.test(status));
      assert.ok(success, `${method} ${route} has no success response`);
      const media = success[1].content?.['application/json'];
      if (media) {
        assert.ok(Object.keys(media.examples ?? {}).length > 0, `${method} ${route} success response has no example`);
      }
    }
  });
}
