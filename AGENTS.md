# AGENTS.md

mcp-contracts is the machine-readable contract set of [MCP Platform](https://github.com/aiwcorpo/mcp-platform): OpenAPI 3.1
(`openapi/`), JSON Schema 2020-12 (`schemas/`), the Cedar schema and platform policies (`cedar/`), test vectors, test keys
and mocks. It calls nothing. The gateway, the credential broker, the portal BFF and frontend, and every MCP server build
against its Maven artifacts (`pl.aiwcorpo.mcp`) or the npm package `@aiwcorpo/mcp-contracts`, and run its vectors in their
tests. A change here changes what those repositories must implement. Background: [README.md](README.md),
[CONTRIBUTING.md](CONTRIBUTING.md).

## Commands

Node 24 (`.nvmrc`) and JDK 25. `verify-all.sh` looks for a JDK 25 itself (JAVA_HOME, PATH, `java_home -v 25`,
`brew --prefix openjdk@25`); for plain `./mvnw` set `JAVA_HOME` to a JDK 25 yourself.

```bash
npm ci
./scripts/verify-all.sh            # full check, what CI runs: npm test, ./mvnw clean verify, jar contents
npm test                           # spectral lint, dist build, node tests, npm package check
node --test test/vectors.test.mjs  # one node test file
./mvnw -B verify                   # Java modules only
./mvnw -B -pl java/mcp-manifest -am verify     # one module
SMOKE_WIREMOCK=1 ./scripts/verify-all.sh       # adds the WireMock smoke test (Docker)
```

`verify-all.sh` takes under a minute after `npm ci` and needs no Docker unless `SMOKE_WIREMOCK=1`.

Generators (outputs are committed; regenerate, never hand-edit):

```bash
npm run generate           # openapi/bundled/ and mocks/ from openapi/*.yaml
npm run generate:vectors   # manifests, hashes, audit, errors, totp, text hygiene, cursor, endpoint vectors
npm run generate:cedar     # entity builder, decision, result filter, resource check and id vectors
```

Run `npm run generate` after any change in `openapi/`; after changing `cedar/examples/systems/jira` or
`test-vectors/fixtures/notes`, run `generate:vectors` and then `generate:cedar`. `test/generated-files.test.mjs` fails on
drift. Do not run `scripts/generate-jwt-vectors.mjs` or `scripts/generate-certificate-vectors.mjs` unless the change needs
new tokens or certificates: their signatures and keys are random, so every file changes.

## Layout

- `openapi/bundled/`, `mocks/msw/`, `mocks/wiremock/`: generated from `openapi/*.yaml`.
- `test-vectors/`: shared with every component; the gateway, broker and servers run them. Changing an expected value in an
  existing vector is a major change (README, "Versioning (SemVer)").
- `test-vectors/keys/`: test keys, private ones included on purpose (`NOT-FOR-PRODUCTION`). Do not regenerate or replace
  them; `generate-test-keys.mjs` refuses to overwrite.
- `cedar/mcp.cedarschema`: frozen byte for byte within the 7.x line; tests compare its SHA-256 and `.gitattributes`
  enforces LF.
- `test/*.test.mjs`: node tests, also the reference verifiers of the vector formats. `java/*/src/test`: Java tests of the
  three modules (Cedar schema and policies, entity builder and decision vectors, manifest rules).
- `dist/` and `release/` are build output and git-ignored.

## Rules

- A change to `openapi/`, `schemas/`, `cedar/` or `test-vectors/` needs an entry `## CC-<n> | <contract> | <title>` in
  `CONTRACT_CHANGES.md`, in Polish, with the next free number and the fields of the latest entries (source, problem,
  change, files, SemVer compatibility, status). Write status `proposed`; only a person sets `accepted` or `rejected`. Packaging, tooling, documentation and test-only fixes need no entry.
- Add a line under `## Unreleased` in `CHANGELOG.md` that names the CC number, in the language the section already uses.
- Classify every change by the SemVer table in the README (new enum value, stricter validation or a changed vector
  expectation is major) and state the class in the SemVer field of the CC entry.
- Strings in specs and vectors follow the text hygiene rule (README, "Text hygiene"); vectors and examples use dummy data.
- Dev dependencies in `package.json` are exact versions; CI images and GitHub Actions are pinned (exact tag, commit SHA).

## Boundaries

Releases are done by a person: do not change the version (poms, `package.json`, `info.version` in the OpenAPI files),
tag, push tags, run `npm run pack` for a release, publish to Maven Central or npm, or edit `.github/workflows/release.yml`
without being asked. Do not push to main.

Never commit secrets, tokens, real keys, `.env` files, internal host names or IP addresses. The only keys in the
repository are the test keys under `test-vectors/keys/`.

## Pull requests

One change per PR, normally one CC entry. Commit subject in English, imperative, up to 72 characters, CC number in
parentheses when there is one (`... (CC-250)`); the body describes the change. `./scripts/verify-all.sh` must pass and
generated files must be regenerated in the same commit. Details: CONTRIBUTING.md.
