// Packs the npm tarball into release/, a git-ignored directory. Tarballs are no longer committed: the published
// package lives on npmjs.org (see .github/workflows/release.yml). Local consumers that still depend on
// file:../mcp-contracts/release/<name>.tgz keep working from the tarballs on disk. The tarball of a version that
// already has a git tag is never rewritten, so its bytes and integrity hash stay stable.
import { existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { path, readJson } from './lib/contracts.mjs';

const { version } = readJson('package.json');
const tarball = path('release', `aiwcorpo-mcp-contracts-${version}.tgz`);
const tagged = execFileSync('git', ['tag', '-l', `v${version}`], { cwd: path(), encoding: 'utf8' }).trim() !== '';
if (existsSync(tarball) && tagged) {
  console.error(`${tarball} belongs to the released tag v${version}; refusing to overwrite it`);
  process.exit(1);
}
mkdirSync(path('release'), { recursive: true });
execFileSync('npm', ['pack', '--pack-destination', path('release')], { cwd: path(), stdio: 'inherit' });
