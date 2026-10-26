import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { setupServer } from 'msw/node';
import { createPortalBffHandlers, MOCK_XSRF_TOKEN } from '../dist/msw/index.js';
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
  assert.match(res.headers.get('set-cookie') ?? '', /XSRF-TOKEN=/);
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
  const headers = { 'X-XSRF-TOKEN': MOCK_XSRF_TOKEN, Cookie: `XSRF-TOKEN=${MOCK_XSRF_TOKEN}` };
  const del = await fetch(`${BASE}/api/v1/connections/jira`, { method: 'DELETE', headers });
  assert.equal(del.status, 204);
  const put = await fetch(`${BASE}/api/v1/connections/jira/secret`, {
    method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'example=step_up_required' },
    body: JSON.stringify({ secret: 'test-only' }),
  });
  assert.equal(put.status, 401);
  assert.equal((await put.json()).error, 'step_up_required');
});

test('MSW: OAuth callback redirects', async () => {
  const res = await fetch(`${BASE}/api/v1/oauth/callback?code=c&state=s`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/catalog?connected=gitlab');
});
