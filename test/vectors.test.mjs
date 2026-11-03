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
import { argumentsHash, firstCall, firstCallsInOrder, retriesInOrder, retry } from '../scripts/lib/confirmation.mjs';
import { openCursor } from '../scripts/lib/activity-cursor.mjs';
import { aggregateCall } from '../scripts/lib/activity-calls.mjs';
import { gatewayAuthenticationResponse, idpTokenClaimsDecision, keyDecision, protectedResourceMetadata } from '../scripts/lib/gateway-authentication.mjs';
import { applyFilter, callDecision, checkRoute, InvalidFilter, parseFilter, sessionDecision, sessionMatches, streamOpenDecision } from '../scripts/lib/endpoint-filter.mjs';
import { auditThrottle, issueCursor, listChangedNotification, listChangedSequence, page, readCursor, routeCall, serverAvailable, visibleTools } from '../scripts/lib/endpoint-aggregate.mjs';
import { composeQuery, mcpEndpoint } from '../scripts/lib/mcp-endpoint.mjs';
import { killSwitchDecision } from '../scripts/lib/kill-switch.mjs';
import { submissionDecision } from '../scripts/lib/adapter-registry.mjs';
import { adapterToolState, approveDecision } from '../scripts/lib/registry-approval.mjs';

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
      ...(manifestEntry.risk !== undefined && { risk: manifestEntry.risk }), ...(manifestEntry.action !== undefined && { action: manifestEntry.action }),
      resourceRefs: manifestEntry.resourceRefs ?? [],
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
// the system for the resource must be granted in the policy bundle (CC-163: the server configuration is not a source of grants).
function serviceDeskServiceAccountDecision({ credentialType, bundleQueueGrants, resource }) {
  if (credentialType !== 'service-account') return { decision: 'continue' };
  const queue = resource.type === 'ServiceDesk::Queue' ? resource.id : resource.queueReturnedBySystem;
  return bundleQueueGrants.includes(queue)
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
    if (data.kind === 'first-calls-parallel') {
      const { results, pendingIds } = firstCallsInOrder({
        authenticator: data.authenticator, pendingCalls: data.pendingCalls.map((p) => ({ ...p, createdAt: toSeconds(p.createdAt), previewViewedAt: toSeconds(p.previewViewedAt), cancelledAt: toSeconds(p.cancelledAt) })),
        pendingLimit: data.pendingLimit, calls: data.calls, steps: data.steps, at: toSeconds(data.at),
      });
      const calls = results.map((r) => (r.previewed === undefined && r.cancelled === undefined ? r : null));
      if (data.expected.burns) assert.deepEqual(results.map((r) => (r.cancelled === undefined ? null : (r.cancelled ? r.burnedCodes : null))), data.expected.burns, name);
      if (data.expected.cancels) assert.deepEqual(results.map((r) => (r.cancelled === undefined ? null : (r.cancelled ? true : r.status))), data.expected.cancels, name);
      assert.deepEqual(calls.map((r) => (r === null ? [] : (r.supersededIds ?? []))), data.expected.supersededIds, name);
      if (data.expected.outcomes) assert.deepEqual(calls.map((r) => (r === null ? null : r.outcome)), data.expected.outcomes, name);
      if (data.expected.previews) assert.deepEqual(results.map((r) => (r.previewed === false ? r.status : null)), data.expected.previews, name);
      assert.deepEqual(pendingIds, data.expected.pendingIds, name);
      assert.ok(pendingIds.length <= 1, `${name}: at most one pending DESTRUCTIVE call`);
    } else if (data.kind === 'retries-parallel') {
      const actual = retriesInOrder({ pending: { ...data.pending, createdAt: toSeconds(data.pending.createdAt) }, attempts: data.attempts, at: toSeconds(data.at) });
      assert.deepEqual(actual, data.expected, name);
    } else if (data.kind === 'first-call') {
      const actual = firstCall({
        authenticator: data.authenticator,
        pendingCalls: data.pendingCalls.map((p) => ({ ...p, createdAt: toSeconds(p.createdAt), previewViewedAt: toSeconds(p.previewViewedAt), cancelledAt: toSeconds(p.cancelledAt) })),
        pendingLimit: data.pendingLimit, call: data.call, at: toSeconds(data.at), burn: data.burn,
      });
      const { expiresAt, ...rest } = actual;
      const expected = { ...data.expected };
      const expectedExpires = toSeconds(expected.expiresAt);
      delete expected.expiresAt;
      assert.deepEqual(rest, expected, name);
      assert.equal(expiresAt, expectedExpires, `${name}: expiresAt`);
    } else {
      const actual = retry({
        pending: data.pending === null ? null : { ...data.pending, createdAt: toSeconds(data.pending.createdAt), previewViewedAt: toSeconds(data.pending.previewViewedAt), cancelledAt: toSeconds(data.pending.cancelledAt) },
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

test('activity-calls vectors: ActivityCall schema and aggregation of one call (CC-095)', async () => {
  const spec = await dereferenceOpenApi('gateway-admin.v1.yaml');
  const validate = ajv.compile(structuredClone(spec.components.schemas.ActivityCall));
  const vectors = listJson('test-vectors', 'activity-calls');
  assert.ok(vectors.length >= 25);
  for (const { name, data } of vectors) {
    if (data.events) {
      const row = aggregateCall(data.events, toSeconds(data.now));
      assert.deepEqual(row, data.expected, name);
      assert.ok(validate(row), `${name}: ${formatErrors(validate.errors)}`);
      const auditValidate = schemaValidator(ajv, 'audit-event.schema.json');
      for (const event of data.events) assert.ok(auditValidate(event), `${name}: input event is a valid C8 event`);
    } else {
      assert.equal(validate(data.value), data.expected.valid, `${name}: ${formatErrors(validate.errors)}`);
    }
  }
});

test('gateway key decision: which reason a token gets and whether it is 401 or 503 (CC-124)', () => {
  const vectors = listJson('test-vectors', 'gateway-authentication-decision');
  assert.ok(vectors.some((v) => v.data.expected.status === 503) && vectors.some((v) => v.data.expected.status === 401));
  for (const { name, data } of vectors) assert.deepEqual(keyDecision(data.input), data.expected, name);
});

test('activity cursor vectors: authenticated, bound to sub, 15 minutes (CC-095)', () => {
  const vectors = listJson('test-vectors', 'activity-cursor');
  assert.ok(vectors.some((v) => v.data.expected.valid) && vectors.some((v) => !v.data.expected.valid));
  for (const { name, data } of vectors) {
    const position = openCursor({ key: data.key, sub: data.input.sub, cursor: data.input.cursor, now: toSeconds(data.input.now) });
    assert.equal(position !== null, data.expected.valid, name);
    if (data.expected.valid) assert.deepEqual(position, data.expected.position, name);
  }
});

test('query rendering vectors: quoting, scope in parentheses, resolved index names (CC-160)', async () => {
  const { openSearchPattern, QueryError, renderCql, renderJql, resolveIndexArgument, resolveIndexNames } = await import('../scripts/lib/query-rendering.mjs');
  const render = { jql: renderJql, cql: renderCql, 'opensearch-pattern': ({ granted }) => openSearchPattern(granted),
    'opensearch-resolve': ({ granted, resolved }) => resolveIndexNames(granted, resolved),
    'opensearch-argument': ({ granted, argument, resolved }) => resolveIndexArgument(argument, granted, resolved) };
  const vectors = listJson('test-vectors', 'query-rendering');
  assert.ok(vectors.length >= 15);
  for (const { name, data } of vectors) {
    let actual;
    try { const out = render[data.kind](data.input); actual = data.kind === 'opensearch-argument' ? out : { query: out }; } catch (e) { if (!(e instanceof QueryError)) throw e; actual = { error: 'nothing_to_query_or_not_allowed' }; }
    assert.deepEqual(actual, data.expected, name);
  }
});

test('credential type header vectors: a difference refuses the call (CC-166)', async () => {
  const { credentialTypeCheck } = await import('../scripts/lib/credential-type-check.mjs');
  const vectors = listJson('test-vectors', 'credential-type-header');
  assert.ok(vectors.length >= 13 && vectors.some((v) => v.data.expected.decision === 'continue') && vectors.some((v) => v.data.expected.decision === 'deny'));
  for (const { name, data } of vectors) assert.deepEqual(credentialTypeCheck(data.input), data.expected, name);
});

test('endpoint filter vectors: parsing, normalization, route, visible set, call and session rules (CC-170, CC-172)', () => {
  const validQuery = schemaValidator(ajv, 'common.schema.json#/$defs/EndpointFilterQuery');
  const validError = schemaValidator(ajv, 'common.schema.json#/$defs/EndpointFilterError');
  const validTransport = schemaValidator(ajv, 'common.schema.json#/$defs/TransportLimitError');
  const vectors = listJson('test-vectors', 'endpoint-filter');
  const kinds = new Set(vectors.map((v) => v.data.kind));
  assert.deepEqual([...kinds].sort(), ['apply', 'call', 'call-state', 'error-response', 'parse', 'route', 'session', 'session-order', 'stream-open']);
  assert.ok(vectors.length >= 100);
  for (const { name, data } of vectors) {
    const { input, expected } = data;
    if (data.kind === 'parse' || data.kind === 'route') {
      let result;
      try {
        const parsed = parseFilter(input.query);
        if (data.kind === 'route') checkRoute(parsed.filter, input.routeSystem);
        result = { valid: true, canonical: parsed.canonical, ...(data.kind === 'parse' && { filter: parsed.filter }) };
      } catch (e) {
        if (!(e instanceof InvalidFilter)) throw e;
        result = { valid: false, cause: e.cause, response: { status: 400, error: 'invalid_request', reason: 'invalid_filter' } };
      }
      assert.deepEqual(result, expected, name);
      if (expected.valid && expected.canonical !== '') {
        assert.ok(validQuery(expected.canonical), `${name}: canonical form matches EndpointFilterQuery`);
        assert.equal(parseFilter(expected.canonical).canonical, expected.canonical, `${name}: canonical form is a fixed point`);
      }
    } else if (data.kind === 'apply') {
      const { filter } = parseFilter(input.query);
      assert.deepEqual(applyFilter(filter, input.tools).map((t) => t.name), expected.visible, name);
    } else if (data.kind === 'call') {
      const { filter } = parseFilter(input.query);
      assert.deepEqual({ canonical: parseFilter(input.query).canonical, ...callDecision(filter, input.tool, input.tools) }, expected, name);
    } else if (data.kind === 'call-state') {
      const { filter } = parseFilter(input.query);
      assert.deepEqual({ canonical: parseFilter(input.query).canonical, ...callDecision(filter, input.tool, input.tools, input.state) }, expected, name);
      assert.deepEqual(input.mayCall, input.tools.map((t) => t.name), `${name}: mayCall is the set of the tools, whatever the state`);
    } else if (data.kind === 'session') {
      assert.equal(sessionMatches(input.initializeQuery, input.requestQuery), expected.match, name);
    } else if (data.kind === 'session-order') {
      assert.deepEqual(sessionDecision(input), expected, name);
    } else if (data.kind === 'stream-open') {
      assert.deepEqual(streamOpenDecision(input), expected, name);
    } else {
      if (expected.statusOneOf) {
        assert.ok(validTransport(expected.body), `${name}: ${formatErrors(validTransport.errors)}`);
        assert.equal(expected.bodyHasReason, false, name);
        assert.ok(Buffer.byteLength(input.query) >= 15 * 1024, `${name}: over the transport limit`);
      } else if (expected.status === 400) {
        assert.ok(validError(expected.body), `${name}: ${formatErrors(validError.errors)}`);
        assert.throws(() => parseFilter(input.query), InvalidFilter);
      } else {
        assert.equal(gatewayAuthenticationResponse({ reason: 'missing_token', publicBaseUrl: 'https://mcp.aiwcorpo.pl', resourcePath: '/mcp' }).headers['WWW-Authenticate'], expected.headers['WWW-Authenticate'], name);
      }
    }
  }
});

test('the filter limits of CC-170 are reachable, and the tool limit is covered by the length limit', () => {
  const nameOf = (i) => `a__b${i}`;
  assert.throws(() => parseFilter(`tools=${Array.from({ length: 101 }, (_, i) => nameOf(i)).join(',')}`), (e) => e.cause === 'query_too_long');
  assert.equal(parseFilter(`exclude=${Array.from({ length: 100 }, (_, i) => `a${i}`).join(',')}`).filter.exclude.length, 100);
});

test('the audit event and the activity row carry the filter in the canonical form (CC-174)', () => {
  const validate = schemaValidator(ajv, 'audit-event.schema.json');
  const base = { ts: '2026-10-28T10:00:00.123Z', requestId: '0192d1b2-7c3a-7d4e-8f10-2a3b4c5d6e7f', component: 'gateway', componentId: 'mcp-gateway', event: 'tool_call' };
  for (const filter of ['systems=jira', 'systems=gitlab,jira&access=write&exclude=jira__delete_issue', 'tools=jira__get_issue']) {
    assert.ok(validate({ ...base, filter }), filter);
  }
  for (const filter of ['', 'systems=', 'access=maybe', 'systems=jira&&access=read', 'ACCESS=read', 'systems=jira,gitlab&tools=jira__get_issue&access=read&exclude=a&x=1',
    '&access=read', 'systems=jira&', 'tools=jira', 'tools=a__b__c', 'access=read&systems=jira', 'systems=jira&access=readx', 'exclude=jira__', 'systems=jira,']) {
    assert.ok(!validate({ ...base, filter }), filter);
  }
  assert.ok(validate({ ...base, filter: 'exclude=confluence,jira__delete_issue' }));
});

test('the filter field belongs to the gateway and to four events, and a rejected filter has none (CC-186)', () => {
  const validate = schemaValidator(ajv, 'audit-event.schema.json');
  const base = { ts: '2026-10-28T10:00:00.123Z', requestId: '0192d1b2-7c3a-7d4e-8f10-2a3b4c5d6e7f', component: 'gateway', componentId: 'mcp-gateway', event: 'tool_call', filter: 'systems=jira' };
  assert.ok(validate(base));
  for (const event of ['policy_decision', 'confirmation', 'credential_resolve']) assert.ok(validate({ ...base, event }), event);
  for (const event of ['connection_change', 'admin_change', 'authenticator']) assert.ok(!validate({ ...base, event, outcome: 'ok', reason: 'user_purged' }), event);
  assert.ok(!validate({ ...base, component: 'server', componentId: 'mcp-jira' }), 'servers do not receive the filter');
  assert.ok(!validate({ ...base, component: 'broker', componentId: 'mcp-credential-broker', event: 'credential_resolve' }), 'the broker does not receive the filter');
  assert.ok(!validate({ ...base, event: 'policy_decision', decision: 'deny', outcome: 'error', reason: 'invalid_filter' }), 'nothing valid was normalized');
  assert.ok(validate({ ...base, event: 'policy_decision', decision: 'deny', outcome: 'denied', reason: 'filter_mismatch' }));
});

test('aggregate endpoint vectors: visible list, routing and list_changed (CC-169, CC-176, CC-177)', () => {
  const vectors = listJson('test-vectors', 'endpoint-aggregate');
  assert.deepEqual([...new Set(vectors.map((v) => v.data.kind))].sort(), ['audit-throttle', 'availability', 'cursor', 'legacy-route', 'list', 'list-changed', 'list-changed-sequence', 'page', 'routing']);
  const validateError = schemaValidator(ajv, 'tool-error.schema.json');
  for (const { name, data } of vectors) {
    if (data.kind === 'list') {
      assert.deepEqual(visibleTools(data.input.servers).map((t) => t.name), data.expected.visible, name);
    } else if (data.kind === 'routing') {
      assert.deepEqual(routeCall(data.input.name, data.input.knownSystems), data.expected, name);
    } else if (data.kind === 'audit-throttle') {
      const { events, ...options } = data.input;
      const result = auditThrottle(events, options);
      assert.deepEqual(result, data.expected, name);
      assert.ok(result.decisions.every((d) => d.rejected), `${name}: the refusal itself is never throttled`);
      const left = result.decisions.filter((d) => !d.audited).length;
      assert.equal(result.summaries.reduce((n, x) => n + x.suppressedCount, 0), left, `${name}: every event left out is in a summary`);
      assert.ok(result.summaries.every((x) => x.suppressedTargets >= 1 && x.suppressedTargets <= x.suppressedCount), `${name}: suppressedTargets (CC-195)`);
    } else if (data.kind === 'availability') {
      assert.equal(serverAvailable(data.input.read, data.input.timeoutMs), data.expected.available, name);
    } else if (data.kind === 'page') {
      assert.deepEqual(page(data.input.tools, data.input.afterName, data.input.pageSize), data.expected, name);
    } else if (data.kind === 'cursor') {
      const { issuedFor, presentedBy, mutation, afterSeconds } = data.input;
      const iat = Date.parse('2026-10-31T10:00:00Z') / 1000;
      let cursor = issueCursor({ sub: issuedFor.sub, canonicalFilter: parseFilter(issuedFor.query).canonical, afterName: 'jira__get_issue', iat });
      if (mutation === 'tampered') cursor = `${cursor.slice(0, -2)}${cursor.endsWith('AA') ? 'BB' : 'AA'}`;
      if (mutation === 'malformed') cursor = 'not-a-cursor';
      if (mutation === 'not-a-string') cursor = 42;
      if (mutation === 'empty-string') cursor = '';
      const result = readCursor(cursor, { sub: presentedBy.sub, canonicalFilter: parseFilter(presentedBy.query).canonical, now: iat + afterSeconds });
      assert.deepEqual(result.error ? { valid: false, error: result.error } : { valid: true }, data.expected, name);
    } else if (data.kind === 'list-changed-sequence') {
      assert.deepEqual({ notifyAt: listChangedSequence(parseFilter(data.input.query).filter, data.input.snapshots, data.input.windowSeconds) }, data.expected, name);
      assert.ok(data.expected.notifyAt.every((t, i, all) => i === 0 || t - all[i - 1] >= data.input.windowSeconds), `${name}: at most one notification per window`);
    } else if (data.kind === 'list-changed') {
      assert.equal(listChangedNotification(parseFilter(data.input.query).filter, data.input.before, data.input.after), data.expected.notify, name);
    } else {
      assert.equal(data.expected.status, 404, name);
      assert.ok(validateError(data.expected.body), `${name}: ${formatErrors(validateError.errors)}`);
      assert.equal(data.expected.audit, null, `${name}: no audit event for a route that does not exist`);
    }
  }
});

test('mcp-endpoint vectors: the BFF answer for a filter (CC-175)', async () => {
  const spec = await dereferenceOpenApi('portal-bff.v1.yaml');
  const validateOk = ajv.compile(structuredClone(spec.components.schemas.McpEndpoint));
  const validateInvalid = ajv.compile(structuredClone(spec.components.schemas.InvalidFilter));
  const vectors = listJson('test-vectors', 'mcp-endpoint');
  assert.ok(vectors.some((v) => v.data.expected.status === 200) && vectors.some((v) => v.data.expected.status === 400));
  for (const { name, data } of vectors) {
    if (data.input.httpQuery !== undefined) assert.equal(composeQuery(new URLSearchParams(data.input.httpQuery)), data.input.rawQuery, `${name}: rawQuery is what the BFF composes`);
    assert.deepEqual(mcpEndpoint(data.input), data.expected, name);
    const validate = data.expected.status === 200 ? validateOk : validateInvalid;
    assert.ok(validate(data.expected.body), `${name}: ${formatErrors(validate.errors)}`);
  }
});

test('the examples of getMcpEndpoint equal what the reference builds for their address', async () => {
  const spec = await dereferenceOpenApi('portal-bff.v1.yaml');
  const examples = spec.paths['/api/v1/me/mcp-endpoint'].get.responses['200'].content['application/json'].examples;
  for (const [name, { value }] of Object.entries(examples)) {
    const query = value.url.includes('?') ? value.url.split('?')[1] : '';
    const built = mcpEndpoint({ publicBaseUrl: 'https://mcp.aiwcorpo.pl', rawQuery: query, catalog: [] }).body;
    assert.equal(value.url, built.url, name);
    assert.deepEqual(value.clientConfigs, built.clientConfigs, name);
    assert.equal(value.filter, built.filter, name);
  }
});

test('oauth-metadata vectors: the document of the protected resource ignores the query (CC-171, CC-187)', () => {
  const vectors = listJson('test-vectors', 'oauth-metadata');
  assert.ok(vectors.length >= 6 && vectors.some((v) => v.data.expected.status === 404) && vectors.some((v) => v.data.input.requestQuery !== ''));
  for (const { name, data } of vectors) {
    assert.deepEqual(protectedResourceMetadata(data.input), data.expected, name);
    if (data.expected.status === 200) assert.ok(!data.expected.document.resource.includes('?'), `${name}: resource has no query`);
  }
});

test('internal JWT claims vs and vsc no longer exist (CC-173)', () => {
  const claims = readJson('test-vectors', 'jwt', 'valid.json').claims;
  const validate = schemaValidator(ajv, 'internal-jwt.schema.json');
  assert.ok(validate(claims), formatErrors(validate.errors));
  for (const extra of [{ vs: 'team-a-dev' }, { vsc: { jiraProjects: ['ABC'] } }, { vs: 'team-a-dev', vsc: {} }]) {
    assert.ok(!validate({ ...claims, ...extra }), JSON.stringify(extra));
  }
});

test('the Cedar schema has neither virtualServer nor vsScopes (CC-173)', () => {
  const code = readFileSync(path('cedar', 'mcp.cedarschema'), 'utf8').split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
  assert.ok(!/virtualServer|vsScopes|VsScopes/.test(code));
});

test('kill-switch vectors: a switched tool is refused, hidden and stays off until its own lift (CC-194)', () => {
  const vectors = listJson('test-vectors', 'kill-switch');
  assert.ok(vectors.length >= 12);
  for (const { name, data } of vectors) assert.deepEqual(killSwitchDecision(data.input), data.expected, name);
  const byName = Object.fromEntries(vectors.map((v) => [v.name, v.data.expected]));
  assert.equal(byName['call-switched-tool.json'].auditReason, 'kill_switch');
  assert.equal(byName['call-switched-tool.json'].errorCode, 'tool_disabled');
  assert.equal(byName['store-unreadable-call.json'].allowed, false, 'fail-closed');
});

test('the balancer answer after the failure of an instance has the fixed text (CC-204)', () => {
  const validate = schemaValidator(ajv, 'common.schema.json#/$defs/BalancerError');
  const vectors = listJson('test-vectors', 'balancer-errors');
  assert.ok(vectors.length >= 1);
  for (const { name, data } of vectors) {
    if (data.expected.balancerTriesNextInstance) {
      assert.equal(data.expected.nonIdempotentRetry, false, `${name}: a request that was sent is never repeated (no non_idempotent)`);
      continue;
    }
    assert.ok(validate(data.expected.body), `${name}: ${formatErrors(validate.errors)}`);
    assert.ok([502, 504].includes(data.expected.status), name);
    assert.equal(data.expected.body.error, data.expected.status === 502 ? 'bad_gateway' : 'gateway_timeout', name);
    assert.equal(data.expected.balancerRepeatsRequest, false, name);
  }
  assert.ok(!validate({ error: 'bad_gateway', message: 'The request was not processed.' }), 'the text is a constant');
});

test('claims of the IdP token that no longer exist are ignored, not copied (CC-201)', () => {
  const vectors = listJson('test-vectors', 'idp-token-claims');
  assert.ok(vectors.some((v) => v.data.expected.ignoredClaims.includes('vs')));
  for (const { name, data } of vectors) assert.deepEqual(idpTokenClaimsDecision(data.input), data.expected, name);
  const validate = schemaValidator(ajv, 'internal-jwt.schema.json');
  const internal = readJson('test-vectors', 'jwt', 'valid.json').claims;
  assert.ok(!validate({ ...internal, vs: 'team-a-dev' }), 'the internal JWT refuses what the IdP token may carry');
});

test('an adapter manifest has no risk and no action, and its hash does not cover them (CC-193)', () => {
  const validate = schemaValidator(ajv, 'server-manifest.schema.json');
  const vectors = listJson('test-vectors', 'manifests').filter((v) => v.name.includes('adapter'));
  assert.ok(vectors.length >= 5);
  for (const { name, data } of vectors) {
    const ok = validate(data.manifest);
    const violations = ok ? manifestRuleViolations(data.manifest) : ['schema'];
    if (data.expected.valid) assert.deepEqual(violations, [], `${name}: ${formatErrors(validate.errors)}`);
    else assert.ok(violations.includes(data.expected.rule), `${name}: ${violations}`);
  }
});

test('adapter registry: channel, certificate, mode and what stays pending (CC-193, CC-206)', () => {
  const vectors = listJson('test-vectors', 'adapter-registry');
  assert.ok(vectors.length >= 10);
  for (const { name, data } of vectors) assert.deepEqual(submissionDecision(data.input), data.expected, name);
  for (const { name, data } of vectors.filter((v) => v.data.input.channel === 'adapter' && v.data.expected.status === 200)) {
    assert.deepEqual(data.expected.approvedByCall, [], `${name}: nothing of an adapter is approved by a call`);
  }
});

test('approval with a classification of an adapter tool (CC-193, CC-206)', () => {
  const vectors = listJson('test-vectors', 'registry-approval');
  const reasons = new Set(vectors.map((v) => v.data.expected.reason).filter(Boolean));
  assert.deepEqual([...reasons].sort(), ['classification_not_allowed', 'classification_required', 'risk_lowered']);
  for (const { name, data } of vectors) {
    assert.deepEqual('entry' in data.input ? approveDecision(data.input) : adapterToolState(data.input), data.expected, name);
  }
});

test('the hash of an adapter entry never covers risk and action, also when the entry carries the classification (CC-206)', () => {
  const manifest = readJson('test-vectors', 'manifests', 'valid-adapter.json').manifest;
  for (const tool of manifest.tools) {
    assert.equal(manifestEntryHash(manifest, { ...tool, risk: 'UPDATE', action: 'update' }), tool.definitionHash, tool.name);
  }
  const starter = readJson('test-vectors', 'manifests', 'valid-jira.json').manifest;
  assert.notEqual(manifestEntryHash(starter, { ...starter.tools[0], risk: 'DESTRUCTIVE' }), starter.tools[0].definitionHash, 'a starter entry hashes its risk');
});
