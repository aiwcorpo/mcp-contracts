// Minimal deterministic ustar writer/reader for policy bundle vectors (regular files only).
import { gzipSync, gunzipSync } from 'node:zlib';

const BLOCK = 512;

function header(name, size) {
  const h = Buffer.alloc(BLOCK);
  const put = (value, offset, length) => h.write(value, offset, length, 'ascii');
  const octal = (value, length) => value.toString(8).padStart(length - 1, '0') + '\0';
  if (Buffer.byteLength(name) > 100) throw new Error(`name too long for ustar: ${name}`);
  put(name, 0, 100);
  put(octal(0o644, 8), 100, 8);
  put(octal(0, 8), 108, 8);
  put(octal(0, 8), 116, 8);
  put(octal(size, 12), 124, 12);
  put(octal(0, 12), 136, 12);
  put('        ', 148, 8);
  put('0', 156, 1);
  put('ustar\0', 257, 6);
  put('00', 263, 2);
  let sum = 0;
  for (const byte of h) sum += byte;
  put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return h;
}

export function tarGz(files) {
  const chunks = [];
  for (const [name, content] of files) {
    const data = Buffer.from(content);
    chunks.push(header(name, data.length), data, Buffer.alloc((BLOCK - (data.length % BLOCK)) % BLOCK));
  }
  chunks.push(Buffer.alloc(BLOCK * 2));
  return gzipSync(Buffer.concat(chunks), { level: 9 });
}

export function untarGz(buffer) {
  const raw = gunzipSync(buffer);
  const files = new Map();
  for (let offset = 0; offset + BLOCK <= raw.length;) {
    const name = raw.subarray(offset, offset + 100).toString('ascii').replace(/\0.*$/s, '');
    if (!name) break;
    const size = parseInt(raw.subarray(offset + 124, offset + 136).toString('ascii').replace(/\0.*$/s, '').trim(), 8);
    files.set(name, raw.subarray(offset + BLOCK, offset + BLOCK + size).toString('utf8'));
    offset += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
  }
  return files;
}
