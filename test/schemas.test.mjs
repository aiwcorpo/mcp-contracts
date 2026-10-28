import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAjv, path, readJson, schemaFiles } from '../scripts/lib/contracts.mjs';

test('every JSON Schema compiles under draft 2020-12 in strict mode', () => {
  const ajv = createAjv();
  for (const file of schemaFiles()) {
    assert.ok(ajv.getSchema(file), `${file} did not compile`);
  }
});

// CC-079: servers read these definitions from the contracts jar (starter @ArgumentLimits contractPattern), so their
// names are API: removing or renaming one is a major change. README lists them.
const STABLE_DEFS = ['JiraProjectKey', 'JiraIssueKey', 'ConfluenceSpaceKey', 'ConfluencePageId', 'GitLabGroupPath', 'GitLabProjectPath',
  'OpenSearchIndexName', 'OpenSearchIndexPrefix', 'ServiceDeskQueueId', 'ServiceDeskTicketId'];

test('common.schema.json keeps the definitions used by servers (CC-079)', () => {
  const defs = readJson('schemas', 'common.schema.json').$defs;
  const readme = readFileSync(path('README.md'), 'utf8');
  for (const name of STABLE_DEFS) {
    assert.equal(typeof defs[name]?.pattern, 'string', `${name} with a pattern`);
    assert.ok(readme.includes(`\`${name}\``), `${name} listed in README`);
  }
  const used = new Set(Object.values(defs.ResourceIdPatterns.const).flatMap((kinds) => Object.values(kinds)));
  for (const name of used) assert.ok(STABLE_DEFS.includes(name), `${name} is used by ResourceIdPatterns and must be on the stable list`);
});
