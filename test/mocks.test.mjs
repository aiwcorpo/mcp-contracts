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
  const bad = await fetch(`${BASE}/api/v1/connections/jira/secret`, {
    method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'example=expires_at_invalid' },
    body: JSON.stringify({ secret: 'test-only', expiresAt: '2020-01-01T00:00:00Z' }),
  });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error, 'expires_at_invalid');
  const stepUp = await fetch(`${BASE}/api/v1/confirmations/cnf_4k9Qe2LxW7tB3mZp`, { headers: { Prefer: 'example=step_up_required' } });
  assert.equal(stepUp.status, 401);
  const body = await stepUp.json();
  assert.equal(body.error, 'step_up_required');
  assert.ok(body.stepUpUrl, 'stepUpUrl (CC-010)');
  assert.equal(body.url, undefined);
});

test('MSW: non-empty resourceDefaults is rejected (CC-085)', async () => {
  const headers = { 'X-XSRF-TOKEN': MOCK_XSRF_TOKEN, Cookie: `__Host-XSRF-TOKEN=${MOCK_XSRF_TOKEN}`, 'Content-Type': 'application/json' };
  const base = { slug: 'team-a-dev', displayName: 'Team A', tools: ['jira__get_issue'] };
  const rejected = await fetch(`${BASE}/api/v1/virtual-servers`, { method: 'POST', headers, body: JSON.stringify({ ...base, resourceDefaults: { 'Jira::Project': ['ABC'] } }) });
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).error, 'resource_defaults_unsupported');
  for (const extra of [{}, { resourceDefaults: {} }]) {
    const ok = await fetch(`${BASE}/api/v1/virtual-servers`, { method: 'POST', headers, body: JSON.stringify({ ...base, ...extra }) });
    assert.equal(ok.status, 201);
  }
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

test('MSW: confirmation preview carries expiresAt (CC-015)', async () => {
  const res = await fetch(`${BASE}/api/v1/confirmations/cnf_4k9Qe2LxW7tB3mZp`);
  assert.ok((await res.json()).expiresAt);
});

test('MSW: invalid returnPath gives 400 (CC-032)', async () => {
  const res = await fetch(`${BASE}/api/v1/auth/login?returnPath=%2F%2Fevil.test`, { redirect: 'manual' });
  assert.equal(res.status, 400);
  const headers = { 'X-XSRF-TOKEN': MOCK_XSRF_TOKEN, Cookie: `__Host-XSRF-TOKEN=${MOCK_XSRF_TOKEN}`, 'Content-Type': 'application/json' };
  const start = await fetch(`${BASE}/api/v1/connections/gitlab/oauth`, { method: 'POST', headers, body: JSON.stringify({ returnPath: '/%252Fevil' }) });
  assert.equal(start.status, 400);
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
