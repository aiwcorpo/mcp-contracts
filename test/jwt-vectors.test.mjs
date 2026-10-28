import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { compactVerify, importJWK } from 'jose';
import { createAjv, listJson, path, readJson, schemaValidator } from '../scripts/lib/contracts.mjs';

const SERVICE_METHODS = new Set(['initialize', 'server/discover', 'tools/list', 'ping']);
const ajv = createAjv();
const validateClaims = schemaValidator(ajv, 'internal-jwt.schema.json');

// Server: initialize, server/discover (CC-069), tools/list, ping, GET /mcp-manifest. Broker: GET /v1/systems only (CC-030).
function serviceRequestAllowed(request, audience) {
  if (audience === 'mcp-credential-broker') return request.method === 'GET' && request.path === '/v1/systems';
  if (request.kind === 'jsonrpc') return SERVICE_METHODS.has(request.method);
  return request.method === 'GET' && request.path === '/mcp-manifest';
}

// Reference receiver for C2. Order of checks only decides which reason is reported for a token with
// several defects; every vector has exactly one defect.
async function verify(vector) {
  const { token, verifier, request } = vector;
  if (!token) return 'missing_token';
  const parts = token.split('.');
  if (parts.length !== 3) return 'malformed';
  const header = JSON.parse(Buffer.from(parts[0], 'base64url'));
  if (header.alg !== 'ES256') return 'alg_not_allowed';
  const jwks = readJson('test-vectors', verifier.jwks);
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) return 'unknown_kid';
  if (header.kid.startsWith('test-') && !verifier.allowTestKeys) return 'test_key_not_allowed';
  let claims;
  try {
    const { payload } = await compactVerify(token, await importJWK(jwk, 'ES256'), { algorithms: ['ES256'] });
    claims = JSON.parse(Buffer.from(payload));
  } catch {
    return 'bad_signature';
  }
  if (!validateClaims(claims)) return 'invalid_claims';
  if (claims.iss !== verifier.issuer) return 'wrong_issuer';
  if (claims.aud !== verifier.audience) return 'wrong_audience';
  const now = Date.parse(verifier.now) / 1000;
  if (now > claims.exp + verifier.clockSkewSeconds) return 'expired';
  if (claims.iat > now + verifier.clockSkewSeconds) return 'not_yet_valid';
  if (claims.exp - claims.iat > verifier.maxLifetimeSeconds) return 'lifetime_too_long';
  if (verifier.seenJtis.includes(claims.jti)) return 'replayed_jti';
  const service = claims.sub === 'system:mcp-gateway';
  if (service && !serviceRequestAllowed(request, verifier.audience)) return 'service_token_not_allowed';
  if (request.xRequestId !== claims.rid) return 'request_id_mismatch';
  const toolCall = request.kind === 'jsonrpc' && request.method === 'tools/call';
  // Broker operations that serve one tool call: resolve and the authenticator checks of the gateway (CC-092).
  const resolve = request.kind === 'http' && (
    (request.method === 'POST' && ['/v1/credentials/resolve', '/v1/authenticator/verify', '/v1/authenticator/invalidate-codes'].includes(request.path))
    || (request.method === 'GET' && request.path === '/v1/authenticator'));
  if (!service) {
    if ((toolCall || resolve) && claims.tool === undefined) return 'tool_missing';
    if (!toolCall && !resolve && claims.tool !== undefined) return 'tool_not_allowed';
  }
  if (toolCall && claims.tool !== request.toolName) return 'tool_mismatch';
  return null;
}

const vectors = listJson('test-vectors', 'jwt');

test('files required by the ws-00 brief exist', () => {
  for (const name of ['valid', 'expired', 'wrong-aud', 'replayed-jti', 'bad-sig']) {
    assert.ok(existsSync(path('test-vectors', 'jwt', `${name}.json`)), name);
  }
});

test('every C2 rejection case is covered', () => {
  const reasons = new Set(vectors.map((v) => v.data.expected.reason).filter(Boolean));
  for (const reason of ['missing_token', 'bad_signature', 'unknown_kid', 'alg_not_allowed', 'wrong_issuer',
    'wrong_audience', 'expired', 'replayed_jti', 'service_token_not_allowed', 'tool_mismatch',
    'invalid_claims', 'lifetime_too_long', 'not_yet_valid', 'request_id_mismatch', 'tool_missing',
    'tool_not_allowed', 'test_key_not_allowed']) {
    assert.ok(reasons.has(reason), `no vector for ${reason}`);
  }
});

for (const { name, data } of vectors) {
  test(`jwt/${name}`, async () => {
    const reason = await verify(data);
    if (data.expected.valid) {
      assert.equal(reason, null);
      assert.equal(data.expected.httpStatus, 200);
      assert.ok(validateClaims(data.claims), 'valid token must match internal-jwt.schema.json');
    } else {
      assert.equal(reason, data.expected.reason);
      assert.equal(data.expected.httpStatus, 401);
    }
  });
}
