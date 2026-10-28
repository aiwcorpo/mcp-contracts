// Fails when a built jar does not contain exactly the files of the source tree. A jar built from a target/ directory that
// was not cleaned kept files that a release had removed (3.0.0 and 3.0.1 shipped 49 deleted test vectors and a deleted
// WireMock stub); this check, run after `./mvnw clean verify`, makes that impossible to miss.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from './lib/contracts.mjs';

const version = readFileSync(join(ROOT, 'pom.xml'), 'utf8').match(/<artifactId>mcp-contracts-parent<\/artifactId>\s*<version>([^<]+)<\/version>/)[1];
const ignored = (name) => name === '.DS_Store';

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => !ignored(n)).flatMap((n) => {
    const full = join(dir, n);
    return statSync(full).isDirectory() ? walk(full) : [relative(ROOT, full)];
  });
}

function jarFiles(jar) {
  return execFileSync('unzip', ['-Z1', jar], { encoding: 'utf8' }).split('\n')
    .filter((n) => n.startsWith('mcp-contracts/') && !n.endsWith('/') && !ignored(n.split('/').pop()))
    .map((n) => n.slice('mcp-contracts/'.length));
}

const checks = [
  ['mcp-contracts', ['openapi', 'schemas', 'cedar', 'security', 'mocks/wiremock']],
  ['mcp-contracts-test-vectors', ['test-vectors']],
];
let failed = false;
for (const [name, roots] of checks) {
  const jar = join(ROOT, 'java', 'mcp-contracts', 'target', name === 'mcp-contracts' ? `mcp-contracts-${version}.jar` : `mcp-contracts-${version}-test-vectors.jar`);
  if (!existsSync(jar)) throw new Error(`${jar} missing: run ./mvnw clean verify first`);
  const expected = new Set(roots.flatMap((r) => walk(join(ROOT, r))));
  const actual = new Set(jarFiles(jar));
  const extra = [...actual].filter((f) => !expected.has(f));
  const missing = [...expected].filter((f) => !actual.has(f));
  if (extra.length > 0 || missing.length > 0) {
    failed = true;
    console.error(`${jar}: ${extra.length} file(s) only in the jar, ${missing.length} only in the source tree`);
    for (const f of extra.slice(0, 20)) console.error(`  only in jar: ${f}`);
    for (const f of missing.slice(0, 20)) console.error(`  only in tree: ${f}`);
  } else {
    console.log(`${name}: ${actual.size} files, identical to the source tree`);
  }
}
if (failed) process.exit(1);
