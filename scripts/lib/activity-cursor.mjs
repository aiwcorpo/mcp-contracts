// Reference for the cursor of GET /admin/v1/activity/calls (CC-095): opaque, carries only the position, and is
// authenticated by the gateway: HMAC-SHA-256 over (sub, position, iat) with a gateway key, a tag of at least 128 bits
// compared in constant time, valid 15 minutes. Anything else (changed, issued for another sub, expired) is 400.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const CURSOR_LIFETIME_SECONDS = 900;
const TAG_BYTES = 16;

const mac = (key, sub, payload) => createHmac('sha256', key).update(`${sub}\n${payload}`).digest().subarray(0, TAG_BYTES);

export function issueCursor({ key, sub, ts, requestId, iat }) {
  const payload = Buffer.from(JSON.stringify({ ts, requestId, iat })).toString('base64url');
  return `${payload}.${mac(key, sub, payload).toString('base64url')}`;
}

/** Position of the cursor, or null when it must be answered with 400. */
export function openCursor({ key, sub, cursor, now }) {
  const [payload, tag, ...rest] = String(cursor).split('.');
  if (!payload || !tag || rest.length > 0) return null;
  const given = Buffer.from(tag, 'base64url');
  const expected = mac(key, sub, payload);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let position;
  try { position = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
  if (typeof position?.iat !== 'number' || now < position.iat || now - position.iat > CURSOR_LIFETIME_SECONDS) return null;
  return { ts: position.ts, requestId: position.requestId };
}
