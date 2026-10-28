import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';
import { createAjv, dereferenceOpenApi, formatErrors, listJson, path, readJson, schemaValidator } from '../scripts/lib/contracts.mjs';
import { manifestEntryHash } from '../scripts/lib/definition-hash.mjs';
import { manifestRuleViolations } from '../scripts/lib/manifest-rules.mjs';
import { untarGz } from '../scripts/lib/tar.mjs';
import { catalogActions } from '../scripts/lib/catalog-actions.mjs';
import { argumentsHash, firstCall, retry } from '../scripts/lib/confirmation.mjs';
import { gatewayAuthenticationResponse } from '../scripts/lib/gateway-authentication.mjs';

const ajv = createAjv();

test('definition-hash vectors: canonical form and sha256', () => {
  const vectors = listJson('test-vectors', 'definition-hash');
  assert.ok(vectors.length >= 5);
  const byName = Object.fromEntries(vectors.map((v) => [v.name, v.data]));
  for (const { name, data } of vectors) {
    const { tool, manifestEntry, server } = data.input;
    const inputSchema = structuredClone(tool.inputSchema);
    if (inputSchema.properties?.confirmation_code) {
      delete inputSchema.properties.confirmation_code;
      inputSchema.required = (inputSchema.required ?? []).filter((r) => r !== 'confirmation_code');
    }
    const flat = {
      name: tool.name, ...(tool.title !== undefined && { title: tool.title }), description: tool.description, inputSchema,
      ...(tool.outputSchema !== undefined && { outputSchema: tool.outputSchema }),
      ...(tool.annotations !== undefined && { annotations: tool.annotations }),
      risk: manifestEntry.risk, action: manifestEntry.action, resourceRefs: manifestEntry.resourceRefs ?? [],
      system: server.system, credential: server.credential,
    };
    assert.equal(canonicalize(flat), data.canonical, name);
    assert.equal('sha256:' + createHash('sha256').update(data.canonical, 'utf8').digest('hex'), data.expected, name);
    if (data.sameAs) assert.equal(data.expected, byName[data.sameAs].expected, `${name} sameAs`);
    if (data.differsFrom) assert.notEqual(data.expected, byName[data.differsFrom].expected, `${name} differsFrom`);
  }
});

test('manifest vectors: schema plus semantic rules', () => {
  const validate = schemaValidator(ajv, 'server-manifest.schema.json');
  for (const { name, data } of listJson('test-vectors', 'manifests')) {
    const schemaOk = validate(data.manifest);
    const schemaErrors = formatErrors(validate.errors);
    const violations = schemaOk ? manifestRuleViolations(data.manifest) : ['schema'];
    if (data.expected.valid) {
      assert.deepEqual(violations, [], `${name}: ${schemaErrors}`);
    } else {
      assert.ok(violations.includes(data.expected.rule), `${name}: expected ${data.expected.rule}, got ${violations}`);
    }
  }
});

test('definitionHash recomputed from each valid manifest equals the declared one (CC-005)', () => {
  for (const { name, data } of listJson('test-vectors', 'manifests').filter((v) => v.data.expected.valid)) {
    for (const tool of data.manifest.tools) {
      assert.equal(manifestEntryHash(data.manifest, tool), tool.definitionHash, `${name}: ${tool.name}`);
    }
  }
});

test('ReturnPath vectors (CC-032)', async () => {
  const spec = await dereferenceOpenApi('credential-broker.v1.yaml');
  const validate = ajv.compile(structuredClone(spec.components.schemas.ReturnPath));
  const vectors = listJson('test-vectors', 'return-paths');
  assert.ok(vectors.length >= 5);
  for (const { name, data } of vectors) assert.equal(validate(data.value), data.expected.valid, name);
});

test('resource id vectors match the per-system patterns (CC-056)', () => {
  const defs = readJson('schemas', 'common.schema.json').$defs;
  const vectors = listJson('test-vectors', 'resource-ids');
  assert.ok(vectors.length >= 10);
  for (const { name, data } of vectors) {
    const def = defs.ResourceIdPatterns.const[data.type][data.kind];
    const pattern = new RegExp(defs[def].pattern, 'u');
    const max = defs[def].maxLength ?? Infinity;
    const ok = (id) => pattern.test(id) && id.length <= max;
    for (const id of data.valid) assert.ok(ok(id), `${name}: ${id} should be valid`);
    for (const id of data.invalid) assert.ok(!ok(id), `${name}: ${id} should be invalid`);
  }
});

test('login failure redirect vectors (CC-051)', async () => {
  const spec = await dereferenceOpenApi('portal-bff.v1.yaml');
  const codes = spec.components.schemas.LoginErrorCode.enum;
  const allowed = new Set(codes.map((c) => `/?loginError=${c}`));
  const vectors = listJson('test-vectors', 'login-redirects');
  assert.equal(vectors.filter((v) => v.data.expected.valid).length, codes.length);
  for (const { name, data } of vectors) assert.equal(allowed.has(data.location), data.expected.valid, name);
});

test('UntrustedText vectors (CC-072)', () => {
  const validate = schemaValidator(ajv, 'common.schema.json#/$defs/UntrustedText');
  const vectors = listJson('test-vectors', 'untrusted-text');
  assert.ok(vectors.some((v) => v.data.expected.valid) && vectors.some((v) => !v.data.expected.valid));
  for (const { name, data } of vectors) assert.equal(validate(data.value), data.expected.valid, `${name}: ${formatErrors(validate.errors)}`);
});

// Reference rule of CC-076, executed by the server before Cedar: with a service account the queue returned by
// the system for the resource must be granted in the bundle or in the server configuration.
function serviceDeskServiceAccountDecision({ credentialType, bundleQueueGrants, serverConfiguredQueues, resource }) {
  if (credentialType !== 'service-account') return { decision: 'continue' };
  const queue = resource.type === 'ServiceDesk::Queue' ? resource.id : resource.queueReturnedBySystem;
  return [...bundleQueueGrants, ...serverConfiguredQueues].includes(queue)
    ? { decision: 'continue' } : { decision: 'deny', errorCode: 'not_found_or_denied' };
}

test('service desk service account vectors (CC-076)', () => {
  const vectors = listJson('test-vectors', 'servicedesk-service-account');
  assert.ok(vectors.some((v) => v.data.expected.decision === 'deny') && vectors.some((v) => v.data.expected.decision === 'continue'));
  for (const { name, data } of vectors) assert.deepEqual(serviceDeskServiceAccountDecision(data.input), data.expected, name);
  for (const required of ['srv-servicedesk-service-account-no-queue-grant', 'srv-servicedesk-ticket-moved-out-of-granted-queue']) {
    assert.equal(vectors.find((v) => v.name === `${required}.json`)?.data.expected.decision, 'deny', required);
  }
});

const toSeconds = (iso) => (iso === undefined ? undefined : Date.parse(iso) / 1000);

// Reference rules of C11 (CC-091): the gateway binds a pending call to (sub, serverId, tool, sha256 of the canonical
// arguments without confirmation_code), valid 120 s with 3 attempts, and maps the answer of the broker.
test('confirmation vectors: first call and retry (CC-091)', () => {
  const vectors = listJson('test-vectors', 'confirmation-binding');
  assert.ok(vectors.some((v) => v.data.kind === 'retry') && vectors.some((v) => v.data.kind === 'first-call'));
  for (const { name, data } of vectors) {
    if (data.kind === 'first-call') {
      const actual = firstCall({
        authenticator: data.authenticator,
        pendingCalls: data.pendingCalls.map((p) => ({ ...p, createdAt: toSeconds(p.createdAt) })),
        pendingLimit: data.pendingLimit, call: data.call, at: toSeconds(data.at),
      });
      const { expiresAt, ...rest } = actual;
      const expected = { ...data.expected };
      const expectedExpires = toSeconds(expected.expiresAt);
      delete expected.expiresAt;
      assert.deepEqual(rest, expected, name);
      assert.equal(expiresAt, expectedExpires, `${name}: expiresAt`);
    } else {
      const actual = retry({
        pending: data.pending === null ? null : { ...data.pending, createdAt: toSeconds(data.pending.createdAt) },
        attempt: data.attempt, verification: data.verification, at: toSeconds(data.attempt.at),
      });
      assert.deepEqual(actual, data.expected, name);
    }
  }
});

test('confirmation vectors: code format and the pending argument hash are consistent (CC-091)', () => {
  const pattern = new RegExp(readJson('schemas', 'common.schema.json').$defs.ConfirmationCode.pattern);
  for (const { name, data } of listJson('test-vectors', 'confirmation-binding').filter((v) => v.data.kind === 'retry')) {
    assert.ok(pattern.test(data.attempt.arguments.confirmation_code), name);
    if (data.expected.outcome === 'execute') assert.equal(argumentsHash(data.attempt.arguments), data.pending.argsSha256, `${name}: executed arguments are the pending ones`);
  }
});

test('valid-jira manifest uses the hashes from definition-hash vectors', () => {
  const manifest = readJson('test-vectors', 'manifests', 'valid-jira.json').manifest;
  for (const tool of manifest.tools) {
    const vector = readJson('test-vectors', 'definition-hash', `${tool.name.replaceAll('_', '-')}.json`);
    assert.equal(tool.definitionHash, vector.expected, tool.name);
  }
});

for (const [dir, schema, field] of [
  ['audit-events', 'audit-event.schema.json', 'event'],
  ['tool-errors', 'tool-error.schema.json', 'error'],
]) {
  test(`${dir} vectors match ${schema}`, () => {
    const validate = schemaValidator(ajv, schema);
    const vectors = listJson('test-vectors', dir);
    assert.ok(vectors.some((v) => v.data.expected.valid) && vectors.some((v) => !v.data.expected.valid));
    for (const { name, data } of vectors) {
      assert.equal(validate(data[field]), data.expected.valid, `${name}: ${formatErrors(validate.errors)}`);
    }
  });
}

test('every C10 code has a valid tool-error vector', () => {
  const codes = readJson('schemas', 'common.schema.json').$defs.ErrorCode.enum;
  const covered = new Set(listJson('test-vectors', 'tool-errors').filter((v) => v.data.expected.valid).map((v) => v.data.error.error));
  for (const code of codes) assert.ok(covered.has(code), code);
});

// Not the reference receiver: signature, revision order and the overrides rules (permit detection needs the
// Cedar parser) are executed by PolicyBundleVectorTest in java/mcp-cedar-entities. Here only the JSON documents
// are checked against their schemas.
const revisionOf = (file, suffix) => file.match(new RegExp(`^policies-([0-9]{14}-[0-9a-f]{7})${suffix}$`))?.[1];
const validateLatest = schemaValidator(ajv, 'policy-bundle-latest.schema.json');
const validateBundleManifest = schemaValidator(ajv, 'policy-bundle-manifest.schema.json');

function latestOk(latest) {
  return validateLatest(latest)
    && revisionOf(latest.url, '\\.tar\\.gz') === latest.revision
    && revisionOf(latest.sigUrl, '\\.tar\\.gz\\.sig') === latest.revision;
}

test('policy bundle vectors: latest.json and manifest.json documents', () => {
  const vectors = listJson('test-vectors', 'bundles');
  assert.ok(vectors.length >= 10);
  for (const { name, data } of vectors) {
    const expectInvalidLatest = data.expected.reason === 'invalid_latest';
    assert.equal(latestOk(data.latest), !expectInvalidLatest, name);
    if (data.bundle && data.expected.accept) {
      const files = untarGz(readFileSync(path('test-vectors', 'bundles', data.bundle)));
      const manifest = JSON.parse(files.get('manifest.json'));
      assert.ok(validateBundleManifest(manifest), `${name}: ${formatErrors(validateBundleManifest.errors)}`);
      assert.equal(manifest.revision, data.latest.revision, name);
    }
  }
});

test('connectError redirect vectors (CC-086)', async () => {
  const spec = await dereferenceOpenApi('portal-bff.v1.yaml');
  const codes = spec.components.schemas.ConnectErrorCode.enum;
  const allowed = new Set([
    '/?loginError=session_expired', '/catalog?connected=gitlab',
    ...codes.map((c) => `/catalog?connectError=${c}`),
    ...codes.map((c) => `/connect/gitlab?step=2&connectError=${c}`),
    ...codes.map((c) => `/catalog?connectError=${c}&system=gitlab`),
  ]);
  const vectors = listJson('test-vectors', 'connect-redirects');
  for (const code of codes) assert.ok(vectors.some((v) => v.data.expected.valid && v.data.location.endsWith(`connectError=${code}`)), code);
  for (const { name, data } of vectors) assert.equal(allowed.has(data.location), data.expected.valid, name);
});

test('catalog action vectors (CC-083)', async () => {
  const spec = await dereferenceOpenApi('portal-bff.v1.yaml');
  const statuses = spec.components.schemas.CatalogStatus.enum;
  const actions = new Set(spec.components.schemas.CatalogAction.enum);
  const vectors = listJson('test-vectors', 'catalog-actions');
  for (const status of statuses) assert.ok(vectors.some((v) => v.data.input.status === status), status);
  for (const { name, data } of vectors) {
    assert.deepEqual(catalogActions(data.input), data.expected.actions, name);
    for (const a of data.expected.actions) assert.ok(actions.has(a), `${name}: ${a}`);
  }
});

test('gateway answers to rejected and unavailable authentication (CC-124)', () => {
  const vectors = listJson('test-vectors', 'gateway-authentication');
  assert.ok(vectors.some((v) => v.data.expected.status === 401) && vectors.some((v) => v.data.expected.status === 503));
  const validateError = schemaValidator(ajv, 'tool-error.schema.json');
  for (const { name, data } of vectors) {
    assert.deepEqual(gatewayAuthenticationResponse(data.input), data.expected, name);
    assert.ok(validateError(data.expected.body), `${name}: body is a C10 error`);
    for (const header of data.expected.absentHeaders) assert.equal(data.expected.headers[header], undefined, `${name}: ${header} absent`);
    if (data.expected.status === 503) {
      assert.ok(!('WWW-Authenticate' in data.expected.headers), `${name}: no challenge, the client must not re-authenticate`);
      assert.match(data.expected.headers['Retry-After'], /^[1-9][0-9]?$/);
    }
  }
});

test('the audit schema ties jwks_unavailable to upstream_unavailable, the 503 of CC-124', () => {
  const validate = schemaValidator(ajv, 'audit-event.schema.json');
  const base = { ts: '2026-10-28T10:00:00.123Z', requestId: '0192d1b2-7c3a-7d4e-8f10-2a3b4c5d6e7f', component: 'gateway', componentId: 'mcp-gateway', event: 'authentication', decision: 'deny', reason: 'jwks_unavailable', outcome: 'denied' };
  assert.ok(validate({ ...base, errorCode: 'upstream_unavailable' }));
  assert.ok(!validate({ ...base, errorCode: 'unauthenticated' }));
});
