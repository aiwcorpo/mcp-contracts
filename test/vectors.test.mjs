import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, createPublicKey, verify } from 'node:crypto';
import canonicalize from 'canonicalize';
import { createAjv, formatErrors, listJson, path, readJson, schemaValidator } from '../scripts/lib/contracts.mjs';
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
      name: tool.name, description: tool.description, inputSchema,
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

// Reference receiver for C7 + CC-008 + CC-026.
const ts = (revision) => revision.slice(0, 14);
const revisionOf = (file, suffix) => file.match(new RegExp(`^policies-([0-9]{14}-[0-9a-f]{7})${suffix}$`))?.[1];
const validateLatest = schemaValidator(ajv, 'policy-bundle-latest.schema.json');
const validateBundleManifest = schemaValidator(ajv, 'policy-bundle-manifest.schema.json');

function checkLatest(latest) {
  if (!validateLatest(latest)) return false;
  return revisionOf(latest.url, '\\.tar\\.gz') === latest.revision && revisionOf(latest.sigUrl, '\\.tar\\.gz\\.sig') === latest.revision;
}

function containsPermit(policyText) {
  const code = policyText.replace(/\/\/[^\n]*/g, '');
  return /\bpermit\s*\(/.test(code);
}

function receive(c) {
  if (!checkLatest(c.latest)) return 'invalid_latest';
  const archive = readFileSync(path('test-vectors', 'bundles', c.bundle));
  const signature = readFileSync(path('test-vectors', 'bundles', c.signature));
  const key = createPublicKey(readFileSync(path('test-vectors', c.publicKey)));
  if (signature.length !== 64 || !verify(null, archive, key, signature)) return 'bad_signature';
  const files = untarGz(archive);
  const manifest = JSON.parse(files.get('manifest.json'));
  if (!validateBundleManifest(manifest)) return 'manifest_invalid';
  if (manifest.revision !== c.latest.revision || !manifest.gitSha.startsWith(manifest.revision.slice(15))) return 'manifest_mismatch';
  for (const required of ['schema.cedarschema', 'entities/static.json']) {
    if (!files.has(required)) return 'archive_incomplete';
  }
  if (c.loadedRevision && ts(manifest.revision) <= ts(c.loadedRevision)) return 'not_newer';
  if (c.channel === 'overrides') {
    for (const [name, text] of files) if (name.startsWith('policies/') && containsPermit(text)) return 'permit_in_overrides';
  }
  return null;
}

test('policy bundle vectors', () => {
  const vectors = listJson('test-vectors', 'bundles');
  assert.ok(vectors.length >= 10);
  for (const { name, data } of vectors) {
    const reason = data.bundle ? receive(data) : (checkLatest(data.latest) ? null : 'invalid_latest');
    if (data.expected.accept) assert.equal(reason, null, name);
    else assert.equal(reason, data.expected.reason, name);
  }
});
