// Reference of the address rule for servers (CC-249): the gateway refuses to connect to a loopback, link-local (169.254.0.0/16, which holds the
// cloud metadata address 169.254.169.254, and fe80::/10), unspecified or multicast address. Private ranges (10/8, 172.16/12, 192.168/16, fc00::/7)
// are allowed: servers live on the internal network, except the IPv6 metadata address fd00:ec2::254 (refused by name) and the limited broadcast 255.255.255.255. An IPv6 address that carries an IPv4 address (IPv4-mapped ::ffff:a.b.c.d, the deprecated
// IPv4-compatible ::a.b.c.d, NAT64 64:ff9b::a.b.c.d) is judged as the IPv4 address it carries. The metadata addresses 100.100.100.200 (Alibaba Cloud) and
// 192.0.0.192 (Oracle Cloud) are refused as class `metadata` in every one of those forms and in a 6to4 address (2002::/16) that embeds one of the metadata
// addresses (169.254.169.254 included); any other 6to4 address is judged as an IPv6 address. The operator can add ranges (MCP_SERVER_REFUSED_ADDRESSES of the
// gateway): class `refused_by_configuration`. Used by the vectors in test-vectors/address-refusal.
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

const METADATA_V4 = ['100.100.100.200', '192.0.0.192'];

function classifyV4([a, b, c, d]) {
  if (METADATA_V4.includes(`${a}.${b}.${c}.${d}`)) return 'metadata';
  if (a === 127) return 'loopback';
  if (a === 169 && b === 254) return 'link_local';
  if (a === 0) return 'unspecified';
  if (a >= 224 && a <= 239) return 'multicast';
  if (a === 255 && b === 255 && c === 255 && d === 255) return 'broadcast';
  return null;
}

function embeddedV4(bytes) {
  const zeroTo = (n) => bytes.slice(0, n).every((x) => x === 0);
  if (zeroTo(10) && bytes[10] === 0xff && bytes[11] === 0xff) return { form: 'ipv4_mapped', v4: bytes.slice(12) };
  if (zeroTo(12) && bytes.slice(12).some((x) => x !== 0) && !(bytes.slice(12, 15).every((x) => x === 0) && bytes[15] === 1)) return { form: 'ipv4_compatible', v4: bytes.slice(12) };
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b && bytes.slice(4, 12).every((x) => x === 0)) return { form: 'nat64', v4: bytes.slice(12) };
  return null;
}

// 6to4 (2002::/16) carries the IPv4 address in bytes 2..5. It is judged as that IPv4 address only when it is a metadata address:
// every other 6to4 address stays an ordinary IPv6 address (a relay is not the host it names).
function metadataIn6to4(bytes) {
  if (bytes[0] !== 0x20 || bytes[1] !== 0x02) return null;
  const v4 = bytes.slice(2, 6);
  const text = v4.join('.');
  return text === '169.254.169.254' || METADATA_V4.includes(text) ? v4 : null;
}

function parseRange(entry) {
  const [address, prefix] = entry.trim().split('/');
  const family = isIP(address);
  if (family === 0) throw new Error(`not an address range: ${entry}`);
  const bytes = family === 4 ? parseIPv4(address) : parseIPv6(address);
  const bits = prefix === undefined ? bytes.length * 8 : Number(prefix);
  if (!Number.isInteger(bits) || bits < 0 || bits > bytes.length * 8) throw new Error(`not an address range: ${entry}`);
  return { bytes, bits };
}

function inRange(bytes, { bytes: base, bits }) {
  if (bytes.length !== base.length) return false;
  for (let i = 0; i < bits; i++) {
    const mask = 0x80 >> (i % 8);
    if ((bytes[Math.floor(i / 8)] & mask) !== (base[Math.floor(i / 8)] & mask)) return false;
  }
  return true;
}

/** MCP_SERVER_REFUSED_ADDRESSES: a comma-separated list of IPs and CIDRs, as an array of entries or as the setting text. */
function parseRanges(refused) {
  const entries = typeof refused === 'string' ? refused.split(',') : refused;
  return entries.filter((e) => e.trim() !== '').map(parseRange);
}

/** The decision for one address given as text: { allowed: true } or { allowed: false, class, judgedAs? }. `refused` is the operator's list. */
export function addressDecision(text, refused = []) {
  const builtIn = builtInDecision(text);
  if (!builtIn.allowed) return builtIn;
  const ranges = parseRanges(refused);
  if (ranges.length === 0) return builtIn;
  const family = isIP(text.split('%')[0]);
  const bytes = family === 4 ? parseIPv4(text) : parseIPv6(text);
  if (ranges.some((r) => inRange(bytes, r))) return { allowed: false, class: 'refused_by_configuration' };
  // A range also matches the IPv4 address inside an IPv4-mapped, IPv4-compatible or NAT64 address.
  const embedded = family === 6 ? embeddedV4(bytes) : null;
  if (embedded !== null && ranges.some((r) => inRange(embedded.v4, r))) {
    return { allowed: false, class: 'refused_by_configuration', judgedAs: embedded.v4.join('.') };
  }
  return builtIn;
}

function builtInDecision(text) {
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
  const sixToFour = metadataIn6to4(bytes);
  if (sixToFour !== null) return { allowed: false, class: classifyV4(sixToFour) ?? 'metadata', judgedAs: sixToFour.join('.') };
  if (bytes.every((x) => x === 0)) return { allowed: false, class: 'unspecified' };
  if (bytes.slice(0, 15).every((x) => x === 0) && bytes[15] === 1) return { allowed: false, class: 'loopback' };
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return { allowed: false, class: 'link_local' };
  if (bytes[0] === 0xff) return { allowed: false, class: 'multicast' };
  // The AWS IPv6 metadata address sits inside the allowed unique-local range fc00::/7, so it is refused by name.
  if (bytes.join(',') === [0xfd, 0x00, 0x0e, 0xc2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x02, 0x54].join(',')) return { allowed: false, class: 'metadata' };
  return { allowed: true };
}

/** Every resolved address of a host is checked; one refused address refuses the host. The same function runs again before each connection. */
export function hostDecision(resolved, refused = []) {
  for (const address of resolved) {
    const d = addressDecision(address, refused);
    if (!d.allowed) return { allowed: false, reason: 'address_refused', address, class: d.class };
  }
  return resolved.length === 0 ? { allowed: false, reason: 'host_not_resolved' } : { allowed: true };
}

/** An address literal in a URL is judged as the address it denotes after the WHATWG URL normalisation (127.1, 0x7f.1 and 2130706433 are 127.0.0.1). */
export function urlDecision(url, refused = []) {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) === 0) return { needsResolution: true, host };
  const d = addressDecision(host, refused);
  return d.allowed ? { allowed: true, host } : { allowed: false, reason: 'address_refused', host, class: d.class };
}
