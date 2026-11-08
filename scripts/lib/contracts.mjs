import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import YAML from 'yaml';
import $RefParser from '@apidevtools/json-schema-ref-parser';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OPENAPI_FILES = ['credential-broker.v1.yaml', 'gateway-admin.v1.yaml', 'mcp-server.v1.yaml', 'portal-bff.v1.yaml'];

export function path(...parts) {
  return join(ROOT, ...parts);
}

export function readJson(...parts) {
  return JSON.parse(readFileSync(path(...parts), 'utf8'));
}

export function listJson(...parts) {
  return readdirSync(path(...parts))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({ name, data: readJson(...parts, name) }));
}

export function schemaFiles() {
  return readdirSync(path('schemas')).filter((name) => name.endsWith('.schema.json')).sort();
}

// OpenAPI 3.1 schema objects may carry these annotation keywords; they do not affect validation.
const OPENAPI_KEYWORDS = ['example', 'discriminator', 'xml', 'externalDocs'];

export function createAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  for (const keyword of OPENAPI_KEYWORDS) ajv.addKeyword(keyword);
  // Schemas have no $id so that every tool resolves their relative refs against the file location;
  // registering under the file name gives ajv the same resolution.
  for (const file of schemaFiles()) ajv.addSchema(readJson('schemas', file), file);
  return ajv;
}

export function schemaValidator(ajv, file) {
  const validate = ajv.getSchema(file);
  if (!validate) throw new Error(`schema not registered: ${file}`);
  return validate;
}

export function loadOpenApi(file) {
  return YAML.parse(readFileSync(path('openapi', file), 'utf8'));
}

export async function dereferenceOpenApi(file) {
  return $RefParser.dereference(path('openapi', file), { dereference: { circular: false } });
}

export function* operations(spec) {
  for (const [route, item] of Object.entries(spec.paths ?? {})) {
    for (const method of ['get', 'put', 'post', 'delete', 'patch']) {
      if (item[method]) yield { route, method, operation: item[method], pathItem: item };
    }
  }
}

export function formatErrors(errors) {
  return (errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
}
