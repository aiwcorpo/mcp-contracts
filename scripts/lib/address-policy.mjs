// Reference of the address rule for servers (CC-249): the gateway refuses to connect to a loopback, link-local (169.254.0.0/16, which holds the
// cloud metadata address 169.254.169.254, and fe80::/10), unspecified or multicast address. Private ranges (10/8, 172.16/12, 192.168/16, fc00::/7)
// are allowed: servers live on the internal network. An IPv6 address that carries an IPv4 address (IPv4-mapped ::ffff:a.b.c.d, the deprecated
// IPv4-compatible ::a.b.c.d, NAT64 64:ff9b::a.b.c.d) is judged as the IPv4 address it carries. Used by the vectors in test-vectors/address-refusal.
import { isIP } from 'node:net';

function parseIPv4(text) {
  return text.split('.').map(Number);
}

function parseIPv6(text) {
  const bare = text.split('%')[0];
  let tail = [];
  let head = bare;
  const lastColon = bare.lastIndexOf(':');
  if (bare.slice(lastColon + 1).includes('.')) {
    const v4 = parseIPv4(bare.slice(lastColon + 1));
    tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]];
    head = bare.slice(0, lastColon + 1) + '0:0';
  }
  const [left, right] = head.split('::');
  const groups = (part) => (part === undefined || part === '' ? [] : part.split(':').map((g) => parseInt(g, 16)));
  const l = groups(left);
  const r = head.includes('::') ? groups(right) : [];
  const all = head.includes('::') ? [...l, ...Array(8 - l.length - r.length).fill(0), ...r] : l;
  if (tail.length > 0) all.splice(6, 2, ...tail);
  return all.flatMap((g) => [g >> 8, g & 0xff]);
}

function classifyV4([a, b, c, d]) {
  if (a === 127) return 'loopback';
  if (a === 169 && b === 254) return 'link_local';
  if (a === 0) return 'unspecified';
  if (a >= 224 && a <= 239) return 'multicast';
  return null;
}

function embeddedV4(bytes) {
  const zeroTo = (n) => bytes.slice(0, n).every((x) => x === 0);
  if (zeroTo(10) && bytes[10] === 0xff && bytes[11] === 0xff) return { form: 'ipv4_mapped', v4: bytes.slice(12) };
  if (zeroTo(12) && bytes.slice(12).some((x) => x !== 0) && !(bytes.slice(12, 15).every((x) => x === 0) && bytes[15] === 1)) return { form: 'ipv4_compatible', v4: bytes.slice(12) };
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b && bytes.slice(4, 12).every((x) => x === 0)) return { form: 'nat64', v4: bytes.slice(12) };
  return null;
}

/** The decision for one address given as text: { allowed: true } or { allowed: false, class, judgedAs? }. */
export function addressDecision(text) {
  const family = isIP(text.split('%')[0]);
  if (family === 0) return { allowed: false, class: 'not_an_address' };
  if (family === 4) {
    const cls = classifyV4(parseIPv4(text));
    return cls === null ? { allowed: true } : { allowed: false, class: cls };
  }
  const bytes = parseIPv6(text);
  const embedded = embeddedV4(bytes);
  if (embedded !== null) {
    const cls = classifyV4(embedded.v4);
    return cls === null ? { allowed: true } : { allowed: false, class: cls, judgedAs: embedded.v4.join('.') };
  }
  if (bytes.every((x) => x === 0)) return { allowed: false, class: 'unspecified' };
  if (bytes.slice(0, 15).every((x) => x === 0) && bytes[15] === 1) return { allowed: false, class: 'loopback' };
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return { allowed: false, class: 'link_local' };
  if (bytes[0] === 0xff) return { allowed: false, class: 'multicast' };
  return { allowed: true };
}

/** Every resolved address of a host is checked; one refused address refuses the host. The same function runs again at connect time on the address connected to. */
export function hostDecision(resolved) {
  for (const address of resolved) {
    const d = addressDecision(address);
    if (!d.allowed) return { allowed: false, reason: 'address_refused', address, class: d.class };
  }
  return resolved.length === 0 ? { allowed: false, reason: 'host_not_resolved' } : { allowed: true };
}

/** An address literal in a URL is judged as the address it denotes after the WHATWG URL normalisation (127.1, 0x7f.1 and 2130706433 are 127.0.0.1). */
export function urlDecision(url) {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) === 0) return { needsResolution: true, host };
  const d = addressDecision(host);
  return d.allowed ? { allowed: true, host } : { allowed: false, reason: 'address_refused', host, class: d.class };
}
