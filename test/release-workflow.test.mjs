import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { path } from '../scripts/lib/contracts.mjs';

// A v* tag can point at any commit, and the workflow it starts is the one of that commit; the build must refuse a commit
// that main does not contain before any artifact reaches the publish jobs.
test('release.yml builds only a tagged commit that is on main', () => {
  const workflow = parse(readFileSync(path('.github', 'workflows', 'release.yml'), 'utf8'));
  const steps = workflow.jobs.build.steps;
  const checkout = steps.findIndex((s) => (s.uses ?? '').startsWith('actions/checkout@'));
  const onMain = steps.findIndex((s) => /git merge-base --is-ancestor "\$GITHUB_SHA" origin\/main/.test(s.run ?? ''));
  const firstBuild = steps.findIndex((s) => s.run === './scripts/verify-all.sh');
  assert.ok(checkout >= 0 && onMain > checkout, 'a step after the checkout runs git merge-base --is-ancestor against origin/main');
  assert.ok(onMain < firstBuild, 'the check runs before the build');
  assert.equal(workflow.jobs['publish-maven'].needs, 'build');
});
