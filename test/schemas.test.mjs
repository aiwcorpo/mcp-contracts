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

test('common.schema.json names no system, server or resource type', () => {
  const defs = readJson('schemas', 'common.schema.json').$defs;
  assert.equal(defs.SystemId.enum, undefined);
  assert.equal(defs.ServerId.enum, undefined);
  assert.equal(defs.ResourceType.enum, undefined);
  for (const name of ['SystemId', 'ServerId', 'QualifiedToolName', 'ResourceType']) assert.equal(typeof defs[name].pattern, 'string', name);
  // Descriptions may use a system as an example; no enumeration or constant may name one.
  const named = [];
  const walk = (node, where) => {
    if (Array.isArray(node)) return node.forEach((child, i) => walk(child, `${where}/${i}`));
    if (node === null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if ((key === 'enum' || key === 'const') && JSON.stringify(value).match(/jira|confluence|gitlab|servicedesk|opensearch/i)) named.push(`${where}/${key}`);
      walk(value, `${where}/${key}`);
    }
  };
  walk(readJson('schemas', 'common.schema.json'), '#');
  assert.deepEqual(named, []);
});

test('system, server and tool name patterns of the identifiers (7.0.0)', () => {
  const ajv = createAjv();
  const check = (def) => ajv.compile({ $ref: `common.schema.json#/$defs/${def}` });
  const system = check('SystemId');
  for (const id of ['jira', 'notes', 'ab', 'a1', 'weather2']) assert.ok(system(id), id);
  for (const id of ['', 'a', 'Notes', '1ab', 'my-notes', 'my_notes', 'a'.repeat(32)]) assert.ok(!system(id), id);
  const server = check('ServerId');
  assert.ok(server('mcp-notes') && !server('mcp-n') && !server('notes') && !server('mcp-my-notes'));
  const tool = check('QualifiedToolName');
  assert.ok(tool('notes__get_folder') && tool('jira__get_issue') && !tool('Notes__get') && !tool('notes_get') && !tool('notes__get__x'));
  const type = check('ResourceType');
  assert.ok(type('Notes::Folder') && type('GitLab::Project') && !type('notes::Folder') && !type('Notes') && !type('Notes::folder'));
});
