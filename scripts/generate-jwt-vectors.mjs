// Generates test-vectors/jwt. ES256 signatures are randomized, so re-running rewrites every token;
// tests never regenerate, they verify the committed tokens.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { SignJWT, importJWK } from 'jose';
import { path, readJson } from './lib/contracts.mjs';

const ISSUER = 'https://mcp-gateway.internal';
const T0 = Date.parse('2026-10-26T12:00:00Z') / 1000;
const key = (name) => readJson('test-vectors', 'keys', `${name}.NOT-FOR-PRODUCTION.private.jwk.json`);

const iso = (epoch) => new Date(epoch * 1000).toISOString().replace('.000Z', 'Z');
const b64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

function userClaims(overrides = {}) {
  return {
    iss: ISSUER,
    aud: 'mcp-jira',
    sub: '6f1c2a9e-4d4b-4c51-9a53-1e0f0c7d2b11',
    usr: 'jkowalski',
    grp: ['mcp-jira-read', 'mcp-jira-write', 'mcp-jira-proj-ABC'],
    azp: 'claude-code',
    tool: 'get_issue',
    rid: USER_RID,
    prv: '20261026120000-a1b2c3d',
    iat: T0,
    exp: T0 + 60,
    jti: '0192d1b2-7c3a-7f00-9a11-000000000001',
    ...overrides,
  };
}

function serviceClaims(overrides = {}) {
  return {
    iss: ISSUER,
    aud: 'mcp-jira',
    sub: 'system:mcp-gateway',
    grp: [],
    rid: SERVICE_RID,
    prv: '20261026120000-a1b2c3d',
    iat: T0,
    exp: T0 + 60,
    jti: '0192d1b2-7c3a-7f00-9a11-000000000002',
    ...overrides,
  };
}

async function sign(claims, keyName, header = {}) {
  const jwk = key(keyName);
  const protectedHeader = { alg: 'ES256', kid: jwk.kid, typ: 'JWT', ...header };
  return new SignJWT(claims).setProtectedHeader(protectedHeader).sign(await importJWK(jwk, 'ES256'));
}

const USER_RID = '0192d1b2-7c3a-7d4e-8f10-2a3b4c5d6e7f';
const SERVICE_RID = '0192d1b2-7c3a-7d4e-8f10-2a3b4c5d6e80';
// xRequestId is the X-Request-Id header sent with the token; receivers require it to equal rid.
const toolsCall = (name, xRequestId = USER_RID) => ({ kind: 'jsonrpc', method: 'tools/call', toolName: name, xRequestId });
const rpc = (method, xRequestId = SERVICE_RID) => ({ kind: 'jsonrpc', method, xRequestId });
const http = (method, path, xRequestId = USER_RID) => ({ kind: 'http', method, path, xRequestId });

function verifier(overrides = {}) {
  return {
    issuer: ISSUER,
    audience: 'mcp-jira',
    jwks: 'keys/test-gateway-jwks.json',
    now: iso(T0 + 10),
    clockSkewSeconds: 30,
    maxLifetimeSeconds: 60,
    seenJtis: [],
    ...overrides,
  };
}

function decode(token) {
  if (!token) return { header: null, claims: null };
  const [h, p] = token.split('.');
  return { header: JSON.parse(Buffer.from(h, 'base64url')), claims: JSON.parse(Buffer.from(p, 'base64url')) };
}

const vectors = [];
const add = async (name, description, { token, request, verifierOverrides, valid, reason }) => {
  vectors.push({ name, description, token, request, verifier: verifier(verifierOverrides), valid, reason });
};

await add('valid', 'User variant for tools/call, signed with active key A.', {
  token: await sign(userClaims(), 'test-gateway-jwt-a'), request: toolsCall('get_issue'), valid: true });
await add('valid-second-kid', 'Signed with active key B; both kids of the JWKS must be accepted during rotation.', {
  token: await sign(userClaims({ jti: '0192d1b2-7c3a-7f00-9a11-000000000003' }), 'test-gateway-jwt-b'),
  request: toolsCall('get_issue'), valid: true });
await add('valid-within-skew', 'Verified 29 s after exp; inside the 30 s clock skew.', {
  token: await sign(userClaims({ jti: '0192d1b2-7c3a-7f00-9a11-000000000004' }), 'test-gateway-jwt-a'),
  request: toolsCall('get_issue'), verifierOverrides: { now: iso(T0 + 60 + 29) }, valid: true });
await add('valid-virtual-server-mfa', 'Call through a virtual server: vs with its narrowing vsc (CC-027) and mfa.', {
  token: await sign(userClaims({ vs: 'team-a-dev', vsc: { jiraProjects: ['ABC'] }, mfa: 120, tool: 'delete_issue', jti: '0192d1b2-7c3a-7f00-9a11-000000000005' }), 'test-gateway-jwt-a'),
  request: toolsCall('delete_issue'), valid: true });
await add('valid-broker', 'User variant sent to the credential broker for resolve.', {
  token: await sign(userClaims({ aud: 'mcp-credential-broker', jti: '0192d1b2-7c3a-7f00-9a11-000000000006' }), 'test-gateway-jwt-a'),
  request: http('POST', '/v1/credentials/resolve'),
  verifierOverrides: { audience: 'mcp-credential-broker' }, valid: true });
await add('valid-virtual-server-without-narrowing', 'Link that only lists tools: vsc is an empty object.', {
  token: await sign(userClaims({ vs: 'my-tools', vsc: {}, jti: '0192d1b2-7c3a-7f00-9a11-000000000007' }), 'test-gateway-jwt-a'),
  request: toolsCall('get_issue'), valid: true });
for (const [suffix, request, jti] of [
  ['initialize', rpc('initialize', USER_RID), '40'],
  ['tools-list', rpc('tools/list', USER_RID), '41'],
  ['ping', rpc('ping', USER_RID), '42'],
  ['manifest', http('GET', '/mcp-manifest'), '43'],
]) {
  await add(`valid-user-variant-${suffix}`, `User variant is also accepted for ${request.method} ${request.path ?? ''}`.trim() + ' (CC-033).', {
    token: await sign(userClaims({ jti: `0192d1b2-7c3a-7f00-9a11-0000000000${jti}` }), 'test-gateway-jwt-a'), request, valid: true });
}
await add('valid-service-broker-systems', 'Service variant accepted by the broker only for GET /v1/systems (CC-030).', {
  token: await sign(serviceClaims({ aud: 'mcp-credential-broker', jti: '0192d1b2-7c3a-7f00-9a11-000000000044' }), 'test-gateway-jwt-a'),
  request: http('GET', '/v1/systems', SERVICE_RID), verifierOverrides: { audience: 'mcp-credential-broker' }, valid: true });
for (const [suffix, request, jti] of [
  ['initialize', rpc('initialize'), '10'],
  ['tools-list', rpc('tools/list'), '11'],
  ['ping', rpc('ping'), '12'],
  ['manifest', http('GET', '/mcp-manifest', SERVICE_RID), '13'],
]) {
  await add(`valid-service-${suffix}`, `Service variant accepted for ${request.method} ${request.path ?? ''}`.trim() + '.', {
    token: await sign(serviceClaims({ jti: `0192d1b2-7c3a-7f00-9a11-0000000000${jti}` }), 'test-gateway-jwt-a'),
    request, valid: true });
}

await add('missing-token', 'No Authorization header. Never anonymous.', {
  token: null, request: toolsCall('get_issue'), valid: false, reason: 'missing_token' });
await add('expired', 'Verified 31 s after exp; outside the 30 s clock skew.', {
  token: await sign(userClaims({ jti: '0192d1b2-7c3a-7f00-9a11-000000000020' }), 'test-gateway-jwt-a'),
  request: toolsCall('get_issue'), verifierOverrides: { now: iso(T0 + 60 + 31) }, valid: false, reason: 'expired' });
await add('wrong-aud', 'Token for mcp-confluence presented to mcp-jira.', {
  token: await sign(userClaims({ aud: 'mcp-confluence', jti: '0192d1b2-7c3a-7f00-9a11-000000000021' }), 'test-gateway-jwt-a'),
  request: toolsCall('get_issue'), valid: false, reason: 'wrong_audience' });
await add('aud-array', 'aud as an array that contains the receiver; C2 defines aud as a single string.', {
  token: await sign(userClaims({ aud: ['mcp-jira', 'mcp-confluence'], jti: '0192d1b2-7c3a-7f00-9a11-000000000022' }), 'test-gateway-jwt-a'),
  request: toolsCall('get_issue'), valid: false, reason: 'invalid_claims' });
await add('wrong-iss', 'Issuer is not the configured gateway issuer.', {
  token: await sign(userClaims({ iss: 'https://mcp-gateway-rogue.internal', jti: '0192d1b2-7c3a-7f00-9a11-000000000023' }), 'test-gateway-jwt-a'),
  request: toolsCall('get_issue'), valid: false, reason: 'wrong_issuer' });
const replayedJti = '0192d1b2-7c3a-7f00-9a11-000000000024';
await add('replayed-jti', 'Valid token whose jti was already accepted within its validity window.', {
  token: await sign(userClaims({ jti: replayedJti }), 'test-gateway-jwt-a'),
  request: toolsCall('get_issue'), verifierOverrides: { seenJtis: [replayedJti] }, valid: false, reason: 'replayed_jti' });
await add('bad-sig', 'Signed by a key outside the JWKS while claiming kid of key A.', {
  token: await sign(userClaims({ jti: '0192d1b2-7c3a-7f00-9a11-000000000025' }), 'test-attacker-jwt', { kid: 'test-gw-2026-10-a' }),
  request: toolsCall('get_issue'), valid: false, reason: 'bad_signature' });
{
  const original = await sign(userClaims({ jti: '0192d1b2-7c3a-7f00-9a11-000000000026' }), 'test-gateway-jwt-a');
  const [h, , s] = original.split('.');
  const forged = userClaims({ jti: '0192d1b2-7c3a-7f00-9a11-000000000026', grp: ['mcp-jira-read', 'mcp-jira-destructive'] });
  await add('tampered-payload', 'Payload changed after signing (group added); signature no longer matches.', {
    token: `${h}.${b64url(forged)}.${s}`, request: toolsCall('get_issue'), valid: false, reason: 'bad_signature' });
}
await add('unknown-kid', 'kid not present in the gateway JWKS.', {
  token: await sign(userClaims({ jti: '0192d1b2-7c3a-7f00-9a11-000000000027' }), 'test-attacker-jwt'),
  request: toolsCall('get_issue'), valid: false, reason: 'unknown_kid' });
{
  const header = { alg: 'none', typ: 'JWT', kid: 'test-gw-2026-10-a' };
  await add('alg-none', 'Unsigned token (alg none).', {
    token: `${b64url(header)}.${b64url(userClaims({ jti: '0192d1b2-7c3a-7f00-9a11-000000000028' }))}.`,
    request: toolsCall('get_issue'), valid: false, reason: 'alg_not_allowed' });
}
{
  const header = { alg: 'HS256', typ: 'JWT', kid: 'test-gw-2026-10-a' };
  const input = `${b64url(header)}.${b64url(userClaims({ jti: '0192d1b2-7c3a-7f00-9a11-000000000029' }))}`;
  const secret = readFileSync(path('test-vectors', 'keys', 'test-gateway-jwt-a.public.pem'));
  const mac = createHmac('sha256', secret).update(input).digest('base64url');
  await add('alg-hs256', 'Algorithm confusion: HS256 with the public key PEM of key A as the HMAC secret.', {
    token: `${input}.${mac}`, request: toolsCall('get_issue'), valid: false, reason: 'alg_not_allowed' });
}
await add('lifetime-too-long', 'exp - iat = 3600 s, above the 60 s limit of C2 (CC-003).', {
  token: await sign(userClaims({ exp: T0 + 3600, jti: '0192d1b2-7c3a-7f00-9a11-000000000030' }), 'test-gateway-jwt-a'),
  request: toolsCall('get_issue'), valid: false, reason: 'lifetime_too_long' });
await add('issued-in-future', 'iat 120 s after the verifier clock, beyond the 30 s skew (CC-003).', {
  token: await sign(userClaims({ iat: T0 + 130, exp: T0 + 190, jti: '0192d1b2-7c3a-7f00-9a11-000000000031' }), 'test-gateway-jwt-a'),
  request: toolsCall('get_issue'), valid: false, reason: 'not_yet_valid' });
{
  const claims = userClaims();
  delete claims.jti;
  await add('missing-jti', 'No jti; replay protection is impossible.', {
    token: await sign(claims, 'test-gateway-jwt-a'), request: toolsCall('get_issue'), valid: false, reason: 'invalid_claims' });
}
await add('service-variant-tools-call', 'Service variant used for tools/call; only allowed for initialize, tools/list, ping and the manifest.', {
  token: await sign(serviceClaims({ jti: '0192d1b2-7c3a-7f00-9a11-000000000032' }), 'test-gateway-jwt-a'),
  request: toolsCall('get_issue', SERVICE_RID), valid: false, reason: 'service_token_not_allowed' });
await add('service-variant-broker', 'Service variant sent to the broker resolve endpoint, which needs a user.', {
  token: await sign(serviceClaims({ aud: 'mcp-credential-broker', jti: '0192d1b2-7c3a-7f00-9a11-000000000033' }), 'test-gateway-jwt-a'),
  request: http('POST', '/v1/credentials/resolve', SERVICE_RID),
  verifierOverrides: { audience: 'mcp-credential-broker' }, valid: false, reason: 'service_token_not_allowed' });
await add('server-token-at-broker', 'Token issued for mcp-jira presented to the broker.', {
  token: await sign(userClaims({ jti: '0192d1b2-7c3a-7f00-9a11-000000000045' }), 'test-gateway-jwt-a'),
  request: http('POST', '/v1/credentials/resolve'), verifierOverrides: { audience: 'mcp-credential-broker' },
  valid: false, reason: 'wrong_audience' });
await add('request-id-mismatch', 'X-Request-Id header differs from rid; the correlation id must not be replaced on the way.', {
  token: await sign(userClaims({ jti: '0192d1b2-7c3a-7f00-9a11-000000000046' }), 'test-gateway-jwt-a'),
  request: toolsCall('get_issue', '0192d1b2-7c3a-7d4e-8f10-ffffffffffff'), valid: false, reason: 'request_id_mismatch' });
await add('vs-without-vsc', 'vs claim without its narrowing; a server could not apply the link (CC-027).', {
  token: await sign(userClaims({ vs: 'team-a-dev', jti: '0192d1b2-7c3a-7f00-9a11-000000000047' }), 'test-gateway-jwt-a'),
  request: toolsCall('get_issue'), valid: false, reason: 'invalid_claims' });
await add('vsc-without-vs', 'Narrowing without the virtual server slug.', {
  token: await sign(userClaims({ vsc: { jiraProjects: ['ABC'] }, jti: '0192d1b2-7c3a-7f00-9a11-000000000048' }), 'test-gateway-jwt-a'),
  request: toolsCall('get_issue'), valid: false, reason: 'invalid_claims' });
await add('service-variant-with-tool', 'Claims of the service variant plus a tool claim; matches neither variant.', {
  token: await sign(serviceClaims({ tool: 'get_issue', jti: '0192d1b2-7c3a-7f00-9a11-000000000034' }), 'test-gateway-jwt-a'),
  request: toolsCall('get_issue'), valid: false, reason: 'invalid_claims' });
await add('tool-mismatch', 'JWT issued for get_issue, tools/call asks for delete_issue.', {
  token: await sign(userClaims({ jti: '0192d1b2-7c3a-7f00-9a11-000000000035' }), 'test-gateway-jwt-a'),
  request: toolsCall('delete_issue'), valid: false, reason: 'tool_mismatch' });
await add('idp-token-passthrough', 'User token from the IdP (C1) sent straight to a server; servers accept only gateway tokens.', {
  token: await sign({
    iss: 'https://keycloak.internal/realms/corp', aud: ['mcp-gateway'], sub: '6f1c2a9e-4d4b-4c51-9a53-1e0f0c7d2b11',
    azp: 'claude-code', preferred_username: 'jkowalski', groups: ['mcp-jira-read'], iat: T0, exp: T0 + 1800,
  }, 'test-idp-corp'),
  request: toolsCall('get_issue'), valid: false, reason: 'unknown_kid' });

mkdirSync(path('test-vectors', 'jwt'), { recursive: true });
for (const v of vectors) {
  const { header, claims } = decode(v.token);
  const body = {
    description: v.description,
    token: v.token,
    header,
    claims,
    verifier: v.verifier,
    request: v.request,
    expected: v.valid ? { valid: true, httpStatus: 200 } : { valid: false, httpStatus: 401, reason: v.reason },
  };
  writeFileSync(path('test-vectors', 'jwt', `${v.name}.json`), JSON.stringify(body, null, 2) + '\n');
}
console.log(`wrote ${vectors.length} JWT vectors`);
