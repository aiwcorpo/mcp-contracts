// Release gate for the npm package: what `npm publish` would upload is exactly the allowlisted set of files, the package
// has no lifecycle scripts that would run on a consumer's machine (or in the publish job), and the publish settings point
// at npmjs.org with provenance. Run by `npm test` and by the release workflow before the tarball is built.
import { execFileSync } from 'node:child_process';
import { path, readJson } from './lib/contracts.mjs';

const manifest = readJson('package.json');
const problems = [];

const lifecycle = ['preinstall', 'install', 'postinstall', 'prepublish', 'preprepare', 'prepare', 'postprepare',
  'prepublishOnly', 'prepack', 'postpack', 'publish', 'postpublish'];
for (const name of lifecycle) {
  if (manifest.scripts && name in manifest.scripts) problems.push(`scripts.${name} runs on install or publish`);
}
if (manifest.gypfile || manifest.bin) problems.push('gypfile and bin are not allowed in a data package');

const publish = manifest.publishConfig ?? {};
if (publish.registry !== 'https://registry.npmjs.org/') problems.push(`publishConfig.registry is ${publish.registry}`);
if (publish.access !== 'public') problems.push('publishConfig.access must be public (scoped package)');
if (publish.provenance !== true) problems.push('publishConfig.provenance must be true');
if (!manifest.name.startsWith('@aiwcorpo/')) problems.push(`name ${manifest.name} is outside the @aiwcorpo scope`);
if (manifest.repository?.url !== 'git+https://github.com/aiwcorpo/mcp-contracts.git') {
  problems.push('repository.url must be the GitHub repository (provenance compares it with the workflow)');
}

const allowed = [
  /^(CHANGELOG|CONTRACT_CHANGES|README)\.md$/,
  /^(LICENSE|NOTICE|package\.json)$/,
  /^openapi\/[^/]+\.yaml$/,
  /^openapi\/bundled\/[^/]+\.yaml$/,
  /^schemas\/[^/]+\.json$/,
  /^cedar\/(mcp\.cedarschema|entity-builder\.md)$/,
  /^cedar\/examples\/[^/]+$/,
  /^security\/published-test-keys\.json$/,
  /^test-vectors\/.+$/,
  /^mocks\/msw\/[^/]+\.ts$/,
  /^mocks\/wiremock\/.+\.json$/,
  /^dist\/(msw|types)\/.+\.(js|d\.ts)$/,
];
const packed = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: path(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const files = packed[0].files.map((f) => f.path);
for (const file of files) {
  if (!allowed.some((re) => re.test(file))) problems.push(`unexpected file in the tarball: ${file}`);
  if (/NOT-FOR-PRODUCTION/.test(file)) problems.push(`private test key in the tarball: ${file}`);
  if (file.split('/').some((part) => part.startsWith('.'))) problems.push(`hidden file in the tarball: ${file}`);
}
for (const required of ['package.json', 'LICENSE', 'NOTICE', 'README.md', 'dist/msw/index.js', 'cedar/mcp.cedarschema']) {
  if (!files.includes(required)) problems.push(`missing from the tarball: ${required}`);
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`check-npm-package: ${problem}`);
  process.exit(1);
}
console.log(`check-npm-package: ${files.length} files, no lifecycle scripts, publish to npmjs.org with provenance`);
