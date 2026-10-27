import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';
import { createAjv, dereferenceOpenApi, formatErrors, listJson, path, readJson, schemaValidator } from '../scripts/lib/contracts.mjs';
import { manifestEntryHash } from '../scripts/lib/definition-hash.mjs';
import { manifestRuleViolations } from '../scripts/lib/manifest-rules.mjs';
import { untarGz } from '../scripts/lib/tar.mjs';

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

// Reference check of C11 (CC-077): the code is bound to (sub, serverId, tool, sha256 of the canonical arguments
// without confirmation_code), valid 120 s, 3 attempts, one-time.
function checkConfirmationCode({ issued, state, attempt }) {
  const { confirmation_code: _omitted, ...args } = attempt.arguments;
  const hash = 'sha256:' + createHash('sha256').update(canonicalize(args), 'utf8').digest('hex');
  if (state.used) return { valid: false, reason: 'already_used' };
  if (state.failedAttempts >= issued.maxAttempts) return { valid: false, reason: 'attempts_exhausted' };
  if (Date.parse(attempt.at) > Date.parse(issued.issuedAt) + issued.ttlSeconds * 1000) return { valid: false, reason: 'expired' };
  if (attempt.sub !== issued.sub || attempt.serverId !== issued.serverId || attempt.tool !== issued.tool || hash !== issued.argsSha256) {
    return { valid: false, reason: 'binding_mismatch' };
  }
  return attempt.arguments.confirmation_code === issued.code ? { valid: true } : { valid: false, reason: 'wrong_code' };
}

test('confirmation code binding vectors (CC-077)', () => {
  const pattern = new RegExp(readJson('schemas', 'common.schema.json').$defs.ConfirmationCode.pattern);
  for (const { name, data } of listJson('test-vectors', 'confirmation-binding')) {
    assert.ok(pattern.test(data.issued.code), name);
    assert.deepEqual(checkConfirmationCode(data), data.expected, name);
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
  ]);
  const vectors = listJson('test-vectors', 'connect-redirects');
  for (const code of codes) assert.ok(vectors.some((v) => v.data.expected.valid && v.data.location.endsWith(`connectError=${code}`)), code);
  for (const { name, data } of vectors) assert.equal(allowed.has(data.location), data.expected.valid, name);
});

test('secret expiry vectors (CC-084)', () => {
  const vectors = listJson('test-vectors', 'secret-expiry');
  assert.ok(vectors.length >= 5);
  for (const { name, data } of vectors) {
    const now = Date.parse(data.now);
    const at = Date.parse(data.expiresAt);
    assert.equal(at > now && at <= now + data.maxDays * 86400000, data.expected.valid, name);
    if (!data.expected.valid) assert.equal(data.expected.error, 'expires_at_invalid', name);
  }
});

// Reference table of CC-083: the actions the BFF returns per catalog status.
function catalogActions({ status, supportedTypes, connectionType, someToolDenied }) {
  const connectable = supportedTypes.some((t) => t === 'user-oauth' || t === 'user-secret');
  const renew = connectionType === 'user-oauth' ? 'reconnect' : 'add_secret';
  const out = [];
  switch (status) {
    case 'connected':
      out.push('copy_link');
      if (connectable) out.push('disconnect');
      if (someToolDenied) out.push('request_access');
      break;
    case 'expiring': out.push('copy_link', renew, 'disconnect'); break;
    case 'reconnect_required': out.push(renew, 'disconnect'); break;
    case 'not_connected':
      if (supportedTypes.includes('user-oauth')) out.push('connect_oauth');
      if (supportedTypes.includes('user-secret')) out.push('add_secret');
      break;
    case 'request_pending': out.push('view_request'); break;
    case 'no_access': out.push('request_access'); break;
    default: throw new Error(status);
  }
  return out.sort();
}

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
