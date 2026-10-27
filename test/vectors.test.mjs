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
