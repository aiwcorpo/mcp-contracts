// Generates test-vectors/activity-cursor/ (CC-095). The key is a published test key, NOT FOR PRODUCTION.
import { mkdirSync, writeFileSync } from 'node:fs';
import { path } from './lib/contracts.mjs';
import { issueCursor } from './lib/activity-cursor.mjs';

const KEY = 'test-only-activity-cursor-key-NOT-FOR-PRODUCTION';
const SUB = '6f1c2a9e-4d4b-4c51-9a53-1e0f0c7d2b11';
const OTHER = 'b1a7c0de-0000-4000-8000-000000000001';
const IAT = Date.parse('2026-10-26T20:00:00Z') / 1000;
const write = (name, value) => {
  mkdirSync(path('test-vectors', 'activity-cursor'), { recursive: true });
  writeFileSync(path('test-vectors', 'activity-cursor', `${name}.json`), JSON.stringify(value, null, 2) + '\n');
};
const pos = { ts: '2026-10-26T19:50:00.000Z', requestId: '0192d1b2-7c3a-7d4e-8f10-2a3b4c5d6e7f' };
const good = issueCursor({ key: KEY, sub: SUB, ...pos, iat: IAT });
const vector = (name, description, input, expected) => write(name, { description: `${description} Key: test only, NOT FOR PRODUCTION.`, key: KEY, input, expected });
const at = (s) => new Date((IAT + s) * 1000).toISOString().replace('.000Z', 'Z');
vector('valid', 'A cursor issued for the same sub, used within 15 minutes.', { sub: SUB, cursor: good, now: at(60) }, { valid: true, position: pos });
vector('valid-at-lifetime-limit', 'Exactly 15 minutes after issue.', { sub: SUB, cursor: good, now: at(900) }, { valid: true, position: pos });
vector('invalid-expired', 'One second after the lifetime.', { sub: SUB, cursor: good, now: at(901) }, { valid: false });
vector('invalid-other-sub', 'The cursor of another user is refused: 400, never rows of the issuer.', { sub: OTHER, cursor: good, now: at(60) }, { valid: false });
const [payload, tag] = good.split('.');
const flipped = Buffer.from(payload, 'base64url'); flipped[2] ^= 1;
vector('invalid-payload-changed', 'A changed position byte breaks the tag.', { sub: SUB, cursor: `${flipped.toString('base64url')}.${tag}`, now: at(60) }, { valid: false });
const badTag = Buffer.from(tag, 'base64url'); badTag[0] ^= 1;
vector('invalid-tag-changed', 'A changed tag byte.', { sub: SUB, cursor: `${payload}.${badTag.toString('base64url')}`, now: at(60) }, { valid: false });
vector('invalid-short-tag', 'A tag shorter than 128 bits is refused.', { sub: SUB, cursor: `${payload}.${tag.slice(0, 10)}`, now: at(60) }, { valid: false });
vector('invalid-not-a-cursor', 'Arbitrary text.', { sub: SUB, cursor: 'abc', now: at(60) }, { valid: false });
vector('invalid-issued-in-the-future', 'A cursor from the future (clock manipulation).', { sub: SUB, cursor: good, now: at(-5) }, { valid: false });
console.log('cursor vectors written');
