// Generates the TEST key material in test-vectors/keys. Run once; it refuses to overwrite because every
// signed vector depends on these keys. NOT FOR PRODUCTION: the private keys are public in this repository.
import { existsSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { path } from './lib/contracts.mjs';

export const KEYS = [
  { name: 'test-gateway-jwt-a', kid: 'test-gw-2026-10-a', type: 'ec', purpose: 'Gateway internal JWT (C2), active key A' },
  { name: 'test-gateway-jwt-b', kid: 'test-gw-2026-10-b', type: 'ec', purpose: 'Gateway internal JWT (C2), active key B (rotation)' },
  { name: 'test-attacker-jwt', kid: 'test-attacker', type: 'ec', purpose: 'Not in any JWKS; signs bad-signature vectors' },
  { name: 'test-idp-corp', kid: 'test-idp-corp', type: 'ec', purpose: 'Stands in for the IdP (C1) in the token passthrough vector' },
  { name: 'test-policy-bundle', kid: 'test-policy-bundle', type: 'ed25519', purpose: 'Signs policy bundles (C7)' },
  { name: 'test-policy-overrides', kid: 'test-policy-overrides', type: 'ed25519', purpose: 'Signs overrides bundles (C7), separate key' },
];

const dir = (...p) => path('test-vectors', 'keys', ...p);

function generate({ name, kid, type }) {
  const pair = type === 'ec'
    ? generateKeyPairSync('ec', { namedCurve: 'P-256' })
    : generateKeyPairSync('ed25519');
  const alg = type === 'ec' ? 'ES256' : 'EdDSA';
  const privateJwk = { ...pair.privateKey.export({ format: 'jwk' }), kid, alg, use: 'sig' };
  const publicJwk = { ...pair.publicKey.export({ format: 'jwk' }), kid, alg, use: 'sig' };
  const base = `${name}.NOT-FOR-PRODUCTION`;
  writeFileSync(dir(`${base}.private.jwk.json`), JSON.stringify(privateJwk, null, 2) + '\n');
  writeFileSync(dir(`${base}.private.pem`), pair.privateKey.export({ format: 'pem', type: 'pkcs8' }));
  writeFileSync(dir(`${name}.public.jwk.json`), JSON.stringify(publicJwk, null, 2) + '\n');
  writeFileSync(dir(`${name}.public.pem`), pair.publicKey.export({ format: 'pem', type: 'spki' }));
  return publicJwk;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (existsSync(dir('test-gateway-jwks.json'))) {
    console.error('test keys already exist; delete test-vectors/keys/*.json|*.pem by hand to regenerate all vectors');
    process.exit(1);
  }
  const publics = Object.fromEntries(KEYS.map((k) => [k.name, generate(k)]));
  writeFileSync(dir('test-gateway-jwks.json'), JSON.stringify(
    { keys: [publics['test-gateway-jwt-a'], publics['test-gateway-jwt-b']] }, null, 2) + '\n');
  writeFileSync(dir('test-idp-jwks.json'), JSON.stringify({ keys: [publics['test-idp-corp']] }, null, 2) + '\n');
  console.log('generated', KEYS.length, 'test key pairs');
}
