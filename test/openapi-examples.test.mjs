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

test('portal-bff.v1.yaml: every response declares X-Request-Id (CC-087)', async () => {
  const spec = await dereferenceOpenApi('portal-bff.v1.yaml');
  for (const { route, method, operation } of operations(spec)) {
    for (const [status, response] of Object.entries(operation.responses)) {
      assert.ok(response.headers?.['X-Request-Id'], `${method.toUpperCase()} ${route} ${status}`);
    }
  }
});

test('portal-bff.v1.yaml: catalog examples follow the action table of CC-083', async () => {
  const { catalogActions } = await import('../scripts/lib/catalog-actions.mjs');
  const spec = await dereferenceOpenApi('portal-bff.v1.yaml');
  const operation = operations(spec).find((o) => o.operation.operationId === 'getPortalCatalog').operation;
  const examples = Object.entries(operation.responses['200'].content['application/json'].examples);
  const seen = new Set();
  for (const [exampleName, example] of examples) {
    for (const server of example.value.servers) {
      seen.add(server.status);
      const where = `${exampleName} ${server.serverId}`;
      assert.deepEqual([...server.actions].sort(), catalogActions({
        status: server.status,
        supportedTypes: server.credential.supportedTypes,
        connectionType: server.connection?.type,
        hasConnection: server.connection != null,
        someToolDenied: server.tools.some((t) => t.access === 'denied'),
      }), where);
      if (['service-account', 'token-exchange'].includes(server.credential.defaultType)) {
        assert.equal(server.connection, null, `${where}: nothing to connect`);
      }
      if (['not_connected', 'request_pending', 'no_access'].includes(server.status)) {
        assert.equal(server.connection, null, `${where}: no connection`);
      }
      for (const tool of server.tools) {
        if (tool.risk === 'DESTRUCTIVE') assert.equal(tool.requiresConfirmation, true, `${where} ${tool.name}`);
      }
    }
  }
  for (const status of spec.components.schemas.CatalogStatus.enum) assert.ok(seen.has(status), `no example for ${status}`);
});

test('credential-broker.v1.yaml: every response declares X-Request-Id (CC-047)', async () => {
  const spec = await dereferenceOpenApi('credential-broker.v1.yaml');
  for (const { route, method, operation } of operations(spec)) {
    for (const [status, response] of Object.entries(operation.responses)) {
      assert.ok(response.headers?.['X-Request-Id'], `${method.toUpperCase()} ${route} ${status}`);
    }
  }
});

// The seed of the authenticator leaves the platform exactly once, in the 201 of enrollment (CC-092, CC-093): no other
// response of C4 or C12 may carry `secret` or `otpauthUri`, and the 201 must be no-store.
for (const [file, enrollmentOperation] of [['credential-broker.v1.yaml', 'startAuthenticatorEnrollment'], ['portal-bff.v1.yaml', 'startMyAuthenticatorEnrollment']]) {
  test(`${file}: only ${enrollmentOperation} returns the authenticator seed`, async () => {
    const spec = await dereferenceOpenApi(file);
    const seedFields = new Set(['secret', 'otpauthUri']);
    const hasSeed = (value) => value !== null && typeof value === 'object'
      && (Array.isArray(value) ? value.some(hasSeed) : Object.entries(value).some(([k, v]) => (seedFields.has(k) && typeof v === 'string') || hasSeed(v)));
    let found = 0;
    for (const { route, method, operation } of operations(spec)) {
      for (const [status, response] of Object.entries(operation.responses)) {
        const media = response.content?.['application/json'];
        const withSeed = Object.values(media?.examples ?? {}).some((example) => hasSeed(example.value));
        const properties = JSON.stringify(media?.schema?.properties ?? {});
        const schemaSeed = /"(secret|otpauthUri)"/.test(properties);
        if (operation.operationId === enrollmentOperation && status === '201') {
          found++;
          assert.ok(withSeed && schemaSeed, 'the 201 carries the seed');
          assert.equal(response.headers['Cache-Control'].schema.const, 'no-store');
        } else {
          assert.ok(!withSeed && !schemaSeed, `${method.toUpperCase()} ${route} ${status} must not carry a seed`);
        }
      }
    }
    assert.equal(found, 1);
  });
}
