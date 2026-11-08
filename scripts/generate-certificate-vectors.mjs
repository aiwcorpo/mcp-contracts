// Generates test-vectors/certificate-fingerprint (CC-249). The certificates are made with openssl and have random keys, so re-running rewrites
// every vector; tests never regenerate, they check the committed files. The fingerprint is the SHA-256 of the DER encoding of the certificate,
// as sha256:<64 lower-case hex digits>, never a hash of the PEM text.
import { execFileSync } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { path } from './lib/contracts.mjs';

const dir = path('test-vectors', 'certificate-fingerprint');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'mcp-cert-'));

function selfSigned(cn, sans, days) {
  const key = join(work, `${cn}.key`);
  const crt = join(work, `${cn}.crt`);
  execFileSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', key, '-out', crt,
    '-subj', `/CN=${cn}`, '-days', String(days), '-addext', `subjectAltName=${sans.map((s) => (/^[0-9.]+$/.test(s) ? `IP:${s}` : `DNS:${s}`)).join(',')}`], { stdio: 'ignore' });
  return readFileSync(crt, 'utf8');
}

const fingerprintOfDer = (der) => `sha256:${createHash('sha256').update(der).digest('hex')}`;
const write = (name, value) => writeFileSync(join(dir, `${name}.json`), JSON.stringify(value, null, 2) + '\n');
const describe = (pem, cn, sans) => {
  const cert = new X509Certificate(pem);
  return { certificatePem: pem, subject: `CN=${cn}`, issuer: `CN=${cn}`, sans, notAfter: new Date(cert.validTo).toISOString().replace('.000Z', 'Z'), derBase64: cert.raw.toString('base64'), fingerprint: fingerprintOfDer(cert.raw) };
};

const notes = describe(selfSigned('mcp-notes', ['mcp-notes', '10.20.0.15'], 365), 'mcp-notes', ['mcp-notes', '10.20.0.15']);
write('self-signed-ec', { description: 'A self-signed certificate: the fingerprint is the SHA-256 of its DER encoding (derBase64), in lower-case hex without colons.', ...notes, expected: { fingerprint: notes.fingerprint, matches: true } });

const rewrapped = notes.certificatePem.trim().split('\n').slice(1, -1).join('');
const wrap = (width, eol) => `-----BEGIN CERTIFICATE-----${eol}${rewrapped.match(new RegExp(`.{1,${width}}`, 'g')).join(eol)}${eol}-----END CERTIFICATE-----${eol}`;
write('pem-rewrapped-same-fingerprint', { description: 'The same certificate as PEM with 76-character lines and CRLF line ends: the DER is the same, so the fingerprint is the same. The PEM text is never what is hashed.', certificatePem: wrap(76, '\r\n'), derBase64: notes.derBase64, expected: { fingerprint: notes.fingerprint, matches: true } });

write('hash-of-pem-text-is-wrong', { description: 'SHA-256 over the PEM text (with its header lines and line breaks) is not the fingerprint.', certificatePem: notes.certificatePem, derBase64: notes.derBase64, claimedFingerprint: `sha256:${createHash('sha256').update(notes.certificatePem).digest('hex')}`, expected: { fingerprint: notes.fingerprint, matches: false } });
write('hash-of-base64-text-is-wrong', { description: 'SHA-256 over the base64 text of the DER is not the fingerprint either.', certificatePem: notes.certificatePem, derBase64: notes.derBase64, claimedFingerprint: `sha256:${createHash('sha256').update(notes.derBase64).digest('hex')}`, expected: { fingerprint: notes.fingerprint, matches: false } });

const renewed = describe(selfSigned('mcp-notes', ['mcp-notes', '10.20.0.15'], 365), 'mcp-notes', ['mcp-notes', '10.20.0.15']);
write('renewal-changes-the-fingerprint', { description: 'A certificate renewed for the same name, even with the same subject and SANs, has another fingerprint: a pinned server that renews is unreachable until the new fingerprint is approved (a ca server needs nothing).', approved: notes.fingerprint, presented: { certificatePem: renewed.certificatePem, derBase64: renewed.derBase64, fingerprint: renewed.fingerprint }, expected: { matches: notes.fingerprint === renewed.fingerprint } });

for (const [name, value, valid, why] of [
  ['format-valid', notes.fingerprint, true, 'sha256: and 64 lower-case hex digits.'],
  ['format-colons-uppercase', notes.fingerprint.slice(7).toUpperCase().match(/../g).join(':'), false, 'The colon-separated upper-case form that openssl and browsers print is not the format of the contract.'],
  ['format-uppercase-hex', `sha256:${notes.fingerprint.slice(7).toUpperCase()}`, false, 'Hex digits are lower case.'],
  ['format-algorithm-prefix-uppercase', `SHA256:${notes.fingerprint.slice(7)}`, false, 'The prefix is sha256: in lower case.'],
  ['format-without-prefix', notes.fingerprint.slice(7), false, 'The prefix is part of the value.'],
  ['format-too-short', notes.fingerprint.slice(0, -2), false, '62 hex digits.'],
  ['format-sha1', `sha1:${createHash('sha1').update(Buffer.from(notes.derBase64, 'base64')).digest('hex')}`, false, 'Only SHA-256.'],
]) write(name, { description: `Format of CertificateFingerprint: ${why}`, fingerprint: value, expected: { valid } });

rmSync(work, { recursive: true, force: true });
console.log('certificate vectors written');
