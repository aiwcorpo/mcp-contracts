import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { setupServer } from 'msw/node';
import { createPortalBffHandlers, LOGIN_ERROR_CODES, MOCK_XSRF_TOKEN } from '../dist/msw/index.js';
import { generateMswExamples, generateWiremock } from '../scripts/generate-mocks.mjs';
import { path } from '../scripts/lib/contracts.mjs';

const BASE = 'http://portal.test';
const server = setupServer(...createPortalBffHandlers({ baseUrl: BASE }));
before(() => server.listen({ onUnhandledRequest: 'error' }));
after(() => server.close());

test('WireMock stubs are up to date (npm run generate:mocks)', async () => {
  const expected = await generateWiremock();
  const committed = {};
  for (const dir of readdirSync(path('mocks', 'wiremock'))) {
    for (const file of readdirSync(path('mocks', 'wiremock', dir, 'mappings'))) {
      committed[`${dir}/mappings/${file}`] = readFileSync(path('mocks', 'wiremock', dir, 'mappings', file), 'utf8');
    }
  }
  assert.deepEqual(Object.keys(committed).sort(), Object.keys(expected).sort());
  for (const [file, content] of Object.entries(expected)) assert.equal(committed[file], content, file);
});

test('MSW example table is up to date (npm run generate:mocks)', async () => {
  assert.equal(readFileSync(path('mocks', 'msw', 'portal-bff.examples.ts'), 'utf8'), await generateMswExamples());
});

test('MSW: default example and XSRF cookie on /me', async () => {
  const res = await fetch(`${BASE}/api/v1/me`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).username, 'jkowalski');
  assert.match(res.headers.get('set-cookie') ?? '', /^__Host-XSRF-TOKEN=[^;]+; Path=\/; Secure; SameSite=Strict$/);
});

test('MSW: Prefer header selects a named example', async () => {
  const res = await fetch(`${BASE}/api/v1/me`, { headers: { Prefer: 'example=admin' } });
  assert.equal((await res.json()).isAdmin, true);
});

test('MSW: mutating call without X-XSRF-TOKEN is rejected', async () => {
  const res = await fetch(`${BASE}/api/v1/connections/jira`, { method: 'DELETE' });
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: 'csrf_invalid' });
});

test('MSW: mutating call with matching cookie and header succeeds', async () => {
  const headers = { 'X-XSRF-TOKEN': MOCK_XSRF_TOKEN, Cookie: `__Host-XSRF-TOKEN=${MOCK_XSRF_TOKEN}` };
  const del = await fetch(`${BASE}/api/v1/connections/jira`, { method: 'DELETE', headers });
  assert.equal(del.status, 204);
  const put = await fetch(`${BASE}/api/v1/connections/jira/secret`, {
    method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: 'test-only' }),
  });
  assert.equal(put.status, 200, 'no step-up for PUT secret (CC-090)');
  const stepUp = await fetch(`${BASE}/api/v1/authenticator/enrollment`, { method: 'POST', headers: { ...headers, Prefer: 'example=step_up_required' } });
  assert.equal(stepUp.status, 401);
  const body = await stepUp.json();
  assert.equal(body.error, 'step_up_required');
  assert.ok(body.stepUpUrl, 'stepUpUrl (CC-010)');
  assert.equal(body.url, undefined);
});

test('MSW: getMcpEndpoint answers the default example and rejects a parameter outside the filter (CC-175)', async () => {
  const ok = await fetch(`${BASE}/api/v1/me/mcp-endpoint?systems=jira&access=read`);
  assert.equal(ok.status, 200);
  assert.match((await ok.json()).url, /\/mcp$/);
  const rejected = await fetch(`${BASE}/api/v1/me/mcp-endpoint?system=jira`);
  assert.equal(rejected.status, 400);
  const body = await rejected.json();
  assert.equal(body.error, 'invalid_request');
  assert.equal(body.reason, 'invalid_filter');
});

test('MSW: every response carries X-Request-Id (CC-087)', async () => {
  const res = await fetch(`${BASE}/api/v1/catalog`);
  assert.match(res.headers.get('x-request-id') ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('MSW: OAuth callback redirects', async () => {
  const res = await fetch(`${BASE}/api/v1/oauth/callback?code=c&state=s`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/catalog?connected=gitlab');
});

test('MSW: login redirects to the IdP without session or CSRF (CC-023)', async () => {
  const res = await fetch(`${BASE}/api/v1/auth/login?returnPath=/catalog`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /^https:\/\/keycloak\.internal\//);
});

test('MSW: logout requires the XSRF header (CC-023)', async () => {
  assert.equal((await fetch(`${BASE}/api/v1/auth/logout`, { method: 'POST' })).status, 403);
  const headers = { 'X-XSRF-TOKEN': MOCK_XSRF_TOKEN, Cookie: `__Host-XSRF-TOKEN=${MOCK_XSRF_TOKEN}` };
  assert.equal((await fetch(`${BASE}/api/v1/auth/logout`, { method: 'POST', headers })).status, 204);
});

test('MSW: confirmation preview carries expiresAt and the resource, and needs no step-up (CC-015, CC-091, CC-098)', async () => {
  const res = await fetch(`${BASE}/api/v1/confirmations/cnf_4k9Qe2LxW7tB3mZp`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.expiresAt);
  assert.deepEqual(body.resource, { type: 'Jira::Issue', id: 'ABC-123', parent: 'Jira::Project::ABC' });
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('MSW: there is no decision endpoint for confirmations (CC-091)', async () => {
  const headers = { 'X-XSRF-TOKEN': MOCK_XSRF_TOKEN, Cookie: `__Host-XSRF-TOKEN=${MOCK_XSRF_TOKEN}`, 'Content-Type': 'application/json' };
  await assert.rejects(fetch(`${BASE}/api/v1/confirmations/cnf_4k9Qe2LxW7tB3mZp`, { method: 'POST', headers, body: JSON.stringify({ decision: 'approve' }) }));
});

test('MSW: authenticator registration (CC-093)', async () => {
  const headers = { 'X-XSRF-TOKEN': MOCK_XSRF_TOKEN, Cookie: `__Host-XSRF-TOKEN=${MOCK_XSRF_TOKEN}`, 'Content-Type': 'application/json' };
  const status = await fetch(`${BASE}/api/v1/authenticator`);
  assert.equal((await status.json()).state, 'active');
  assert.equal((await (await fetch(`${BASE}/api/v1/authenticator`, { headers: { Prefer: 'example=none' } })).json()).state, 'none');
  assert.match((await (await fetch(`${BASE}/api/v1/authenticator`, { headers: { Prefer: 'example=locked' } })).json()).lockedUntil, /Z$/);
  const started = await fetch(`${BASE}/api/v1/authenticator/enrollment`, { method: 'POST', headers });
  assert.equal(started.status, 201);
  assert.equal(started.headers.get('cache-control'), 'no-store');
  const body = await started.json();
  assert.match(body.secret, /^[A-Z2-7]{32}$/);
  assert.ok(body.otpauthUri.includes(`secret=${body.secret}`));
  const confirm = await fetch(`${BASE}/api/v1/authenticator/enrollment/confirm`, { method: 'POST', headers, body: JSON.stringify({ enrollmentId: body.enrollmentId, code: '705202' }) });
  assert.equal(confirm.status, 200);
  for (const [example, status422] of [['invalid_code', 'invalid_code'], ['enrollment_invalid', 'enrollment_invalid']]) {
    const res = await fetch(`${BASE}/api/v1/authenticator/enrollment/confirm`, { method: 'POST', headers: { ...headers, Prefer: `example=${example}` }, body: '{}' });
    assert.equal(res.status, 422);
    assert.equal((await res.json()).error, status422);
  }
  assert.equal((await fetch(`${BASE}/api/v1/authenticator`, { method: 'DELETE', headers })).status, 204);
  const noStepUp = await fetch(`${BASE}/api/v1/authenticator`, { method: 'DELETE', headers: { ...headers, Prefer: 'example=step_up_required' } });
  assert.equal(noStepUp.status, 401);
});

test('MSW: invalid returnPath gives 400 (CC-032)', async () => {
  const res = await fetch(`${BASE}/api/v1/auth/login?returnPath=%2F%2Fevil.test`, { redirect: 'manual' });
  assert.equal(res.status, 400);
  const headers = { 'X-XSRF-TOKEN': MOCK_XSRF_TOKEN, Cookie: `__Host-XSRF-TOKEN=${MOCK_XSRF_TOKEN}`, 'Content-Type': 'application/json' };
  const start = await fetch(`${BASE}/api/v1/connections/gitlab/oauth`, { method: 'POST', headers, body: JSON.stringify({ returnPath: '/%252Fevil' }) });
  assert.equal(start.status, 400);
});

test('MSW: returnPath on a reserved prefix gives 400, /apiary does not (CC-099)', async () => {
  const headers = { 'X-XSRF-TOKEN': MOCK_XSRF_TOKEN, Cookie: `__Host-XSRF-TOKEN=${MOCK_XSRF_TOKEN}`, 'Content-Type': 'application/json' };
  for (const [returnPath, status] of [['/api/v1/me', 400], ['/v/team-a-dev/mcp', 400], ['/./api/v1/me', 400], ['/apiary', 200]]) {
    const res = await fetch(`${BASE}/api/v1/connections/gitlab/oauth`, { method: 'POST', headers, body: JSON.stringify({ returnPath }) });
    assert.equal(res.status, status, returnPath);
  }
  const login = await fetch(`${BASE}/api/v1/auth/login?returnPath=${encodeURIComponent('/s/mcp-jira/mcp')}`, { redirect: 'manual' });
  assert.equal(login.status, 400);
});

test('MSW: /me can report mfaFreshUntil (CC-053) and login error codes are exported (CC-051)', async () => {
  const res = await fetch(`${BASE}/api/v1/me`, { headers: { Prefer: 'example=mfa_fresh' } });
  assert.match((await res.json()).mfaFreshUntil, /Z$/);
  assert.deepEqual([...LOGIN_ERROR_CODES], ['cancelled', 'idp_error', 'session_expired', 'step_up_failed']);
});

test('WireMock stubs of C4 send X-Request-Id (CC-047)', () => {
  const stub = JSON.parse(readFileSync(path('mocks', 'wiremock', 'credential-broker', 'mappings', 'resolveCredential.json'), 'utf8'));
  for (const mapping of stub.mappings) assert.ok(mapping.response.headers['X-Request-Id'], mapping.name);
});

test('MSW: malformed JSON body gives 400, not 500 (review 1.2.0 L7)', async () => {
  const headers = { 'X-XSRF-TOKEN': MOCK_XSRF_TOKEN, Cookie: `__Host-XSRF-TOKEN=${MOCK_XSRF_TOKEN}`, 'Content-Type': 'application/json' };
  const res = await fetch(`${BASE}/api/v1/connections/gitlab/oauth`, { method: 'POST', headers, body: '{not json' });
  assert.equal(res.status, 400);
});

test('MSW: unknown system gives 400 (CC-054)', async () => {
  const headers = { 'X-XSRF-TOKEN': MOCK_XSRF_TOKEN, Cookie: `__Host-XSRF-TOKEN=${MOCK_XSRF_TOKEN}` };
  const res = await fetch(`${BASE}/api/v1/connections/sharepoint`, { method: 'DELETE', headers });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'invalid_request' });
});

test('MSW: activity calls list with the X-Next-Cursor header allowed and rows without arguments (CC-095)', async () => {
  const res = await fetch(`${BASE}/api/v1/activity/calls?result=confirmation&q=delete`);
  assert.equal(res.status, 200);
  const rows = await res.json();
  assert.ok(rows.some((r) => r.result === 'confirmed' && r.wrongCodeCount === 2));
  for (const row of rows) assert.equal(row.arguments, undefined);
});

test('WireMock stubs of C4 carry no-store on every response with a secret (review 3.0.0 L4)', () => {
  for (const [file, statuses] of [['startAuthenticatorEnrollment', [201]], ['verifyAuthenticatorCode', [200]], ['resolveCredential', [200]]]) {
    const stub = JSON.parse(readFileSync(path('mocks', 'wiremock', 'credential-broker', 'mappings', `${file}.json`), 'utf8'));
    for (const mapping of stub.mappings.filter((m) => statuses.includes(m.response.status))) {
      assert.equal(mapping.response.headers['Cache-Control'], 'no-store', `${file}: ${mapping.name}`);
    }
  }
});

test('MSW: the preview view is recorded by an explicit POST, never by the GET (CC-127)', async () => {
  const headers = { 'X-XSRF-TOKEN': MOCK_XSRF_TOKEN, Cookie: `__Host-XSRF-TOKEN=${MOCK_XSRF_TOKEN}` };
  assert.equal((await fetch(`${BASE}/api/v1/confirmations/cnf_4k9Qe2LxW7tB3mZp/viewed`, { method: 'POST', headers })).status, 204);
  assert.equal((await fetch(`${BASE}/api/v1/confirmations/cnf_4k9Qe2LxW7tB3mZp/viewed`, { method: 'POST' })).status, 403);
  const next = await fetch(`${BASE}/api/v1/activity/calls`);
  assert.ok((next.headers.get('x-next-cursor') ?? '').length > 0 && next.headers.get('x-next-cursor').length <= 256);
});

test('MSW: the owner can cancel a pending confirmation, nothing is approved (CC-128)', async () => {
  const headers = { 'X-XSRF-TOKEN': MOCK_XSRF_TOKEN, Cookie: `__Host-XSRF-TOKEN=${MOCK_XSRF_TOKEN}` };
  assert.equal((await fetch(`${BASE}/api/v1/confirmations/cnf_4k9Qe2LxW7tB3mZp/cancel`, { method: 'POST', headers })).status, 204);
  assert.equal((await fetch(`${BASE}/api/v1/confirmations/cnf_4k9Qe2LxW7tB3mZp/cancel`, { method: 'POST' })).status, 403);
  const missing = await fetch(`${BASE}/api/v1/confirmations/cnf_4k9Qe2LxW7tB3mZp/cancel`, { method: 'POST', headers: { ...headers, Prefer: 'example=not_found_or_denied' } });
  assert.equal(missing.status, 404);
});
