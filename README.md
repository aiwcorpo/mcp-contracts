# mcp-contracts

Part of [MCP Platform](https://github.com/aiwcorpo/mcp-platform), a self-hosted MCP gateway for companies. Documentation: [mcp.aiwcorpo.pl](https://mcp.aiwcorpo.pl/).

The machine-readable form of the MCP platform contracts: OpenAPI 3.1, JSON Schema 2020-12, the Cedar schema, the entity
builder specification, test keys, test vectors and mocks. Changes are listed in [`CHANGELOG.md`](CHANGELOG.md). License:
Apache-2.0 ([`LICENSE`](LICENSE), [`NOTICE`](NOTICE)).

## Who this is for and how to use it

**Status: 7.0.0 is unreleased.** The current content is the 7.0.0 work in progress (dynamic servers); it may still change until the release tag `v7.0.0`, so a component that builds against a local 7.0.0 must rebuild when it changes.

This is a library for the authors of platform components (the gateway, the credential broker, the portal, and every MCP server
of the platform), not a product to run. Other repositories generate clients,
mocks and contract tests from it. The Maven artifacts are released to Maven Central (group `pl.aiwcorpo.mcp`) and the npm
package to npmjs.org (`@aiwcorpo/mcp-contracts`), both from GitHub Actions after a `vX.Y.Z` tag; reading them needs no token
and no account. Coordinates and examples are in "Using the artifacts" below, the release process in "Releasing".

npm imports: `@aiwcorpo/mcp-contracts/msw`, `.../types/portal-bff`, `.../openapi/*`, `.../schemas/*`, `.../test-vectors/*`.
Private test keys are not part of the npm package (see "Artifacts"). Report vulnerabilities as described in
[`SECURITY.md`](SECURITY.md); contribution rules are in [`CONTRIBUTING.md`](CONTRIBUTING.md). Java modules:
`mcp-cedar-entities` (the Cedar entity builder and the validation of server policy fragments, shared by the gateway and the
starter) and `mcp-manifest`.

The contracts are frozen: a change is proposed in [`CONTRACT_CHANGES.md`](CONTRACT_CHANGES.md) and approved by a person.
That file also records every place where the original contract text was imprecise, with the variant that was adopted.
CC-001 ... CC-034 shipped in 1.1.0, CC-036 ... CC-045 in 1.2.0, CC-046 ... CC-067 in 2.0.0, CC-068 ... CC-077 in 2.1.0,
CC-169 ... CC-177 in 5.0.0, CC-229 ... CC-236 in 7.0.0; CC-035 was rejected.

## Using the artifacts

Maven Central, group `pl.aiwcorpo.mcp`, no repository entry and no credentials needed (Central is the default repository):

| Artifact | Packaging | Use |
| --- | --- | --- |
| `pl.aiwcorpo.mcp:mcp-contracts` | jar, plus classifier `test-vectors` | contract files as classpath resources; the `test-vectors` jar holds the TEST keys and belongs in `<scope>test</scope>` only |
| `pl.aiwcorpo.mcp:mcp-cedar-entities` | jar | shared Cedar entity builder and validation of policy fragments |
| `pl.aiwcorpo.mcp:mcp-manifest` | jar | `definitionHash` and manifest rules |
| `pl.aiwcorpo.mcp:mcp-contracts-parent` | pom | parent of the modules above |

```xml
<dependency>
  <groupId>pl.aiwcorpo.mcp</groupId>
  <artifactId>mcp-contracts</artifactId>
  <version>7.0.0</version>
</dependency>
<dependency>
  <groupId>pl.aiwcorpo.mcp</groupId>
  <artifactId>mcp-contracts</artifactId>
  <version>7.0.0</version>
  <classifier>test-vectors</classifier>
  <scope>test</scope>
</dependency>
```

npm, public registry, scope `@aiwcorpo`, no `.npmrc` needed:

```bash
npm install --save-dev @aiwcorpo/mcp-contracts@7.0.0
```

The npm package is published from GitHub Actions with provenance; `npm audit signatures` shows the attestation that ties the
tarball to the tag and the workflow run. Maven artifacts carry a GPG signature (`.asc`); the public key is published on
`keyserver.ubuntu.com`. A version is immutable once it is on Central, so a fix is a new number.

If you built 7.0.0 locally or installed it from another source before it reached Central, delete
`~/.m2/repository/pl/aiwcorpo/mcp/*/7.0.0` and let Maven fetch the published files; the local copies are not byte-identical.

## What is where

| Contract | File |
| --- | --- |
| C2 internal JWT | `schemas/internal-jwt.schema.json`, vectors in `test-vectors/jwt/` |
| C4 credential broker | `openapi/credential-broker.v1.yaml`, the C4.3 event `schemas/credential-invalidated-event.schema.json` |
| C5 gateway admin | `openapi/gateway-admin.v1.yaml` |
| The `/mcp` address and its filter (C1, C5) | section "One address for the whole platform", `scripts/lib/endpoint-filter.mjs`, `java/mcp-manifest` (`EndpointFilter`), `test-vectors/endpoint-filter/`, `test-vectors/endpoint-aggregate/` |
| C6 server manifest | `schemas/server-manifest.schema.json`, vectors in `test-vectors/manifests/` and `test-vectors/definition-hash/` |
| C7 Cedar model | `cedar/mcp.cedarschema` (base schema), `cedar/platform/*.cedar` (policies of the gateway), `cedar/examples/` (server fragments and overrides as models), `cedar/entity-builder.md` |
| C7 policy data and servers | `openapi/gateway-admin.v1.yaml` (`/admin/v1/servers`, `/admin/v1/policy/*`), `openapi/mcp-server.v1.yaml` (`PolicyData`, `POST /.well-known/mcp-policy-data`), `openapi/credential-broker.v1.yaml` (`/v1/admin/systems`) |
| C14 server interface | `openapi/mcp-server.v1.yaml`: what every MCP server serves to the gateway (`GET /.well-known/mcp-manifest`, `POST /.well-known/mcp-policy-data`) and the public JWKS of the gateway (`GET /.well-known/mcp-jwks.json`), section "Connecting a server" |
| C8 audit | `schemas/audit-event.schema.json`, vectors in `test-vectors/audit-events/` |
| C9 groups | `cedar/entity-builder.md` (parsing), `java/mcp-cedar-entities` (implementation), `schemas/common.schema.json#/$defs/GroupName` |
| C10 tool errors | `schemas/tool-error.schema.json`, vectors in `test-vectors/tool-errors/` |
| C12 portal BFF | `openapi/portal-bff.v1.yaml` |

Shared types (system identifiers, `requestId`, the policy revision, the C10 codes) live in `schemas/common.schema.json`. The
OpenAPI specifications refer to the JSON schemas, so every type is defined once. `openapi/bundled/*.bundled.yaml` are the
single-file versions for code generators (generated, do not edit).

```
mcp-contracts/
├── openapi/                 # C4, C5, C12, C14 + bundled/ for generators
├── schemas/                 # JSON Schema 2020-12 (no $id: relative references between files)
├── cedar/                   # base schema, platform policies, example fragments, entity builder specification
├── test-vectors/
│   ├── keys/                # TEST KEYS, NOT FOR PRODUCTION
│   ├── jwt/  manifests/  definition-hash/  policies-hash/  audit-events/  tool-errors/
│   ├── policy-data-gate/  policy-data-push/  address-refusal/  server-connection/  certificate-fingerprint/  # CC-237, CC-249
│   ├── fixtures/            # the neutral Notes fragment and the scope mapping that the Cedar vectors run on
│   ├── untrusted-text/      # shape of UntrustedText (CC-072)
│   ├── confirmation-binding/  # pending call and code verification result (C11, CC-091)
│   ├── totp/  text-hygiene/  gateway-authentication/  # CC-092, CC-126 / CC-121, CC-122 / CC-124
│   ├── connect-redirects/  catalog-actions/  return-paths/  # CC-086, CC-083, CC-032, CC-099
│   ├── servicedesk-service-account/  # queue rule of the service account (CC-076)
│   ├── credential-type-header/  # credential type: header versus server configuration (CC-166)
│   ├── query-rendering/     # server queries built from a structure (CC-160)
│   ├── endpoint-filter/  endpoint-aggregate/  mcp-endpoint/  oauth-metadata/  # /mcp query filter, list and routing, BFF response, OAuth metadata (CC-169 ... CC-187)
│   ├── entity-builder/      # builder input -> Cedar entities and context
│   └── policy-decisions/    # Cedar request -> decision and determining policies
├── mocks/wiremock/          # stubs for C4 and C5 (generated)
├── mocks/msw/               # MSW handlers for C12 (TS)
├── java/mcp-contracts/      # Maven module: jar with resources + test-vectors jar (pom, no code)
├── java/mcp-cedar-entities/ # Maven module: entity builder + JUnit tests (Cedar, decision vectors, result filter)
├── java/mcp-manifest/       # Maven module: RFC 8785, definitionHash, manifest rules, EndpointFilter + tests on vectors
├── spectral-functions/      # Spectral rule for x-allowed-client-cn
├── scripts/                 # generators and verify-all.sh
└── test/                    # Node tests (lint, schemas, vectors, mocks)
```

## Versioning (SemVer)

The version applies to the whole repository at once: the jars, the npm package and the git tag carry the same number.

| Change | Version | Example |
| --- | --- | --- |
| removing or renaming a field, endpoint or enum value; a new enum value (a system is not one: systems, servers and resource types are runtime data); stricter validation; a Cedar schema change after which existing policies or entities no longer validate; a changed expectation in an existing vector | **major** | `2.0.0` |
| a new optional field in a response or request, a new endpoint, new vectors | **minor** | `1.1.0` |
| a description fix, typos, a new example that conforms to the schema | **patch** | `1.0.1` |

Strict SemVer by this table applies from 2.0.0. Releases 1.1.0 and 1.2.0 contained incompatible changes labelled as minor;
the broker, the BFF and the frontend depend on 1.1.0, so the full list of incompatible changes since 1.1.0 and their effect on
consumers is in `CHANGELOG.md` under 2.0.0.

Exceptions to the table, each decided by the maintainers and described in `CHANGELOG.md`:

- **6.3.0, 6.3.1 and 6.3.2** contain changes that are major by the table and were released as minor and patch (decision of
  2026-11-03, following the pattern of 5.1.0 and 6.2.0). CC-219: the constant clause `type = page` in CQL changes the expected
  output of the vectors `query-rendering/cql-plain` and `cql-hostile-value`; the only receiver is the Confluence server.
  CC-227: the adapter is read-only. `approve` of an adapter entry whose `risk` is not `READ_ONLY` is `422
  classification_not_allowed`, and `UPDATE` and `DESTRUCTIVE` classifications stored earlier become invalid. The adapter
  channel has been implemented in the gateway since 6.2.0 but runs on no stack with real users, so stored write
  classifications exist only on the development stack and in tests. CC-226 in 6.3.1: the claims `rsk` and `act` from 6.3.0
  were removed and replaced by `mcp_risk` and `mcp_action`, limited to the adapter sidecar; 6.3.0 was neither pushed nor
  deployed. See `CHANGELOG.md` ("6.3.0", "6.3.1").
- **6.1.0 and 6.2.0** (CC-206, CC-207) correct parts of 6.0.0 and 6.1.0 that nobody deployed (the adapter channel,
  `BalancerError`, the stateless `list_changed`). By the table they contain major changes (the new enum value
  `gateway_timeout` in 6.1.0; in 6.2.0 a different reference point for `list_changed`, the new code
  `classification_inconsistent`, a narrower `200` response of the adapter channel, `403` evaluated before `400` and `422`,
  and a `removed` result when an adapter tool is removed). They were released as minor by decision of 2026-11-03. See
  `CHANGELOG.md` ("6.1.0", "6.2.0").
- **5.1.0** (CC-178 ... CC-188) corrects 5.0.0, which nobody deployed. By the table it contains several major changes:
  `listChanged` going from `true` to `false` (CC-179), `PolicyLintCli` failing on a policy that can never be satisfied
  (CC-183), the strict `EndpointFilterQuery` pattern, the conditions of the `filter` field in audit and the result of
  `EndpointFilter.allows` for a risk outside the set (CC-186), the MSW mock rejecting `%` and a repeated parameter (CC-182),
  a changed input of one `list-changed-*` vector (CC-187), and the result of `tools/call` and of the session checks in
  scenarios that 5.0.0 left contradictory (CC-178, CC-184). The decision of 2026-10-31 was to release it as 5.1.0, because
  contract features arrive with it (`nextCursor`, the time limit) and the incompatibilities concern a version without
  consumers. The bytes of `mcp.cedarschema` are unchanged. Details and migration: `CHANGELOG.md` ("5.1.0").
- **5.1.1** (CC-189, CC-190) changes an expected response by the table (a query above the transport limit is `400`/`414`
  without `reason`) and changes audit behaviour (rate limiting of rejection events). Released as a patch by decision of
  2026-11-01: both concern cases that 5.1.0 could not implement as written (the transport limit sits outside the gateway) or
  that flooded the audit. Schemas other than `TransportLimitError` and the Cedar bytes are unchanged.
- **5.1.2** (CC-191) changes the input and expectations of the `audit-throttle-*` vectors from 5.1.1 (the audit throttling key
  includes the target) and adds the optional field `suppressedCount`. Released as a patch by decision of 2026-11-01, after the
  review of CC-190: 5.1.1 had a single-reason decoy that hid other targets. It affects the gateway.
- **4.1.0**: the risk floor also counts a pending entry (CC-167). A `PUT` with a lower risk than reported earlier, even only as
  pending, passed in 4.0.x; now that tool waits for an administrator (`pending_approval`, `riskLowered`, hidden). By this table
  that is stricter validation, so major. It was released as minor by decision of 2026-10-29, like 4.0.1, because it clarifies
  the 4.0.0 rule ("lowering `risk` is always 422") and no consumer depends on accepting a lower risk; an explicit
  `acceptRiskLowering` by an administrator is the way down. In the same release, activity rows with a denial change their
  result from `error` to `denied_*` (CC-165), and the server refuses on a credential type mismatch (CC-166): `result` is an
  open string, and the server rule applies to requests that carry a credential and works in both directions of the version
  (an old gateway already sends the header, so a new server works with it as long as the type matches its configuration; an old
  server does not check and has no such protection). Deploy them together.
- **4.0.1** (CC-163, CC-164): removing the `serverConfiguredQueues` mode (service account queues from the server
  configuration, CC-076), changing the expectation of the vector `srv-servicedesk-service-account-granted-in-server-config`
  from `continue` to `deny`, and tightening the example rule `credential-type.cedar` (an allow list of credential types) are
  major by this table. Released as a patch because they fix a contradiction in 4.0.0: the vector allowed a mode that the
  example rule from the same release rejected, so the mode never worked with the example (denial, fail-closed), and the change
  does not alter the bytes of the Cedar schema. It affects the servers (server configuration does not open queues) and the
  policy pipeline (bundles must be rebuilt on the 4.0.1 example). Decided on 2026-10-29, like 3.1.0.
- **3.1.0**: CC-129 (a new required GitLab entity attribute, a new required builder input, new bytes of the Cedar schema) is
  major by this table and **breaks policy bundles of 3.0.x** (the GitLab server must supply `ancestorClassifications` and
  bundles must be rebuilt). It was released as 3.1.0 (minor) because the coordinator called the change additive; on
  2026-10-28 the maintainers decided that 3.1.0 stays with this SemVer exception, like 2.1.0.
- **2.1.0**: CC-071 (the new enum value `event: "authentication"`) and CC-074 (narrower OpenSearch index patterns) are major by
  this table and were released as minor by explicit decision of 2026-10-27; the effect on consumers is in `CHANGELOG.md`.
- **2.2.0 and 2.2.1**: CC-085 (`resourceDefaults` dormant, `400 resource_defaults_unsupported`; the field no longer exists
  since 5.0.0, CC-173) is stricter validation released as minor by decision, since there were no consumers. In 2.2.1 the `400
  expires_at_invalid` response added in 2.2.0 was removed (CC-084, no consumers). Details in `CHANGELOG.md`.

7.0.0 (CC-229 ... CC-236) is a major release by the table, with no exceptions: the system, server and resource type enumerations
become patterns, the Cedar base schema loses every system namespace (new bytes, SHA-256
`6340b0f5704c5d865aac9ec4e3e16cfcbdd2cfe6a4748377db7abcad7d8518b1`), `User.scopes`, `Tool.requiredGroup` and `context.refs` change shape,
the manifest gains `policies`, `policiesHash` and required declarations, the entity builder API takes `ResourceTypes`, and policy
bundles, their receiver module and their signing keys are removed. Migration per component: `CHANGELOG.md` ("7.0.0").

6.0.0 (CC-192 ... CC-205) is a major release by the table, with no exceptions: a new enum value `PendingTool.source` and
`risk`/`action` conditionally required in a manifest entry (CC-193), `PolicyLintCli` failing when the schema or a policy does
not validate (CC-203), changed expectations of the `audit-throttle-*` vectors (CC-195). The bytes of `mcp.cedarschema` are
unchanged. Migration per workstream: `CHANGELOG.md` ("6.0.0"). 5.0.0 is likewise a major release by the table: removed
operations, fields and enum values (CC-173 ... CC-175, CC-177), new bytes of the Cedar schema (SHA-256
`51d71b2dbb7f61fd2593cf4c2f1a2373dea06e8b4431425a3f1aa24fa10a0ba5`, previously `902b2540...`) and changed vector
expectations. Migration per component: `CHANGELOG.md` ("5.0.0").

npm tarballs are not kept in git. `npm run pack` writes them locally to `release/` (a directory in `.gitignore`) and refuses to
overwrite the tarball of a version that already has a tag, so the integrity hash in a consumer's `package-lock.json` that
points at such a file stays valid. Released versions are on npmjs.org and in Maven Central.

Every release needs an entry in `CONTRACT_CHANGES.md` with status `accepted`, the version raised in `pom.xml`, `package.json`
and the `info.version` fields, and the tag `vX.Y.Z`.

## Artifacts

| Artifact | Contents | Use |
| --- | --- | --- |
| `pl.aiwcorpo.mcp:mcp-contracts:7.0.0` (jar) | `openapi/`, `schemas/`, `cedar/`, `mocks/wiremock/` under the classpath prefix `mcp-contracts/` | may be on the runtime classpath (for example the Cedar schema, manifest validation) |
| `pl.aiwcorpo.mcp:mcp-contracts:7.0.0:test-vectors` (jar, classifier) | `test-vectors/` including the test keys, under `mcp-contracts/test-vectors/` | **only** `<scope>test</scope>` |
| `pl.aiwcorpo.mcp:mcp-cedar-entities:7.0.0` (jar + javadoc) | Cedar entity builder (C7, C9), validation of policy fragments and overrides | gateway and starter, runtime |
| `pl.aiwcorpo.mcp:mcp-manifest:7.0.0` (jar + javadoc) | `definitionHash` (RFC 8785), C6 manifest rules and `EndpointFilter` (the `/mcp` query filter, CC-170) | starter (generation), gateway (registration, filter), BFF (filter) |
| `pl.aiwcorpo.mcp:mcp-contracts-parent:7.0.0` (pom) | parent of the modules | installed together with them |
| `@aiwcorpo/mcp-contracts@7.0.0` (npm, npmjs.org) | everything above except the jars, plus TS types (`dist/types`) and MSW handlers (`dist/msw`) | `npm install --save-dev @aiwcorpo/mcp-contracts@7.0.0`; locally `npm run pack` produces `release/aiwcorpo-mcp-contracts-<version>.tgz` |

In Maven the test keys (private ones too, which are public by design) are only in the `test-vectors` jar, so that a production
component cannot load a test JWKS from the classpath by accident. Receiver tests sign tokens with them, so the jar
stays a separate artifact with `<scope>test</scope>`. The npm package contains `test-vectors/` without the
`*NOT-FOR-PRODUCTION*` files (private keys); public keys and the JWKS stay, because the vectors use them for verification. Node
tests that need the private keys take them from the `test-vectors` jar or from the repository.

Local installation:

```bash
./mvnw install          # ~/.m2/repository/pl/aiwcorpo/mcp/{mcp-contracts,mcp-cedar-entities,mcp-manifest,mcp-contracts-parent}/<version>/
npm ci && npm run pack  # release/aiwcorpo-mcp-contracts-<version>.tgz (outside git)
```

Reading from the classpath: `getResource("/mcp-contracts/cedar/mcp.cedarschema")`,
`/mcp-contracts/test-vectors/jwt/valid.json` and so on.

## mcp-cedar-entities (entity builder and policy fragments)

The shared implementation of `cedar/entity-builder.md` for the gateway and the starter (CC-019). Dependencies: cedar-java
4.10.0 (the `uber` classifier with native libraries), jackson-databind 2.x (required by cedar-java anyway, not exposed in the
API) and `mcp-contracts`. No Spring. Input records are immutable; `CedarRequest` contains cedar-java objects, which cedar-java
keeps mutable (do not modify them). `EntityBuilder` holds the declared resource types and the scope mapping and is thread-safe;
when a server is added or removed, a manifest changes or the administrator writes a new mapping, a new builder is created.

**No type is built in.** `ResourceTypes.union` refuses two registries in one namespace; patterns follow a linear-time grammar (no nested quantifiers, lookaround or back references, at most 512 characters; ids over 1024 characters are invalid before matching). `PlatformServerPolicies` generates the `platform-*` policies that every server loads next to its fragment (restricted data, service account outside scope). `ResourceTypes` holds the `resourceTypes` declarations of the registered manifests
(`ResourceTypes.fromJson`, `ResourceTypes.union` for the gateway), `ScopeMapping` the administrator's group -> scope mapping
(`ScopeMapping.of` to validate a document, `ScopeMapping.ofRegistered` to evaluate (skips an invalid scope on its own and reports it in `ignored()`), `ScopeMapping.fromJson` for the `scopeMapping`
of the policy data). `Scopes.pathPrefixes` and `Scopes.dashPrefixes` are helpers for the server that derives `scopes` of a resource.

**API compatibility (CC-039):** the public records (`Caller`, `ToolDescriptor`, `ResourceRef`, `ResolvedResource`,
`ResourceTypeDeclaration`, `CedarRequest`, `QueryConstraint`) and the cedar-java types in signatures are part of the API. Adding
a record component, or moving to a new major version of cedar-java, is a new major version of the library.

**Environment:** Spring Boot 4.1.0 manages jackson-databind 2.x at 2.21.4 (next to Jackson 3) and overrides the 2.20.0 of this
module; the module tests pass with 2.21.4 (`./mvnw verify -Djackson.version=2.21.4`). cedar-java 4.10.0 `uber` has native
libraries for macOS (x86_64, aarch64), Linux with glibc (x86_64, aarch64) and Windows x86_64. There is no musl build, so Alpine
images do not work; use a glibc image such as `eclipse-temurin:25-jre`. Compiling against the validation response of cedar-java
needs Guava on the compile classpath (it is a runtime dependency of cedar-java already; this module declares it `provided`).

```xml
<dependency>
  <groupId>pl.aiwcorpo.mcp</groupId>
  <artifactId>mcp-cedar-entities</artifactId>
  <version>7.0.0</version>
</dependency>
```

```java
// gateway: the types of every registered server, the mapping from the policy data
ResourceTypes types = ResourceTypes.union(registeredManifests.stream().map(m -> ResourceTypes.fromJson(m.resourceTypesJson())).toList());
ScopeMapping mapping = ScopeMapping.fromJson(types, policyData.scopeMappingJson(), true);
EntityBuilder builder = new EntityBuilder(types, mapping);
Caller caller = Caller.of(claims.sub(), claims.usr(), claims.grp(), claims.azp()).withMfaAge(120);
ToolDescriptor tool = new ToolDescriptor("mcp-jira", "jira", "get_issue", "READ_ONLY", "read",
        List.of(new ResourceRef("issueKey", "Jira::Issue")));

// gateway: Action::"call" on Tool, decided by the platform policies and the overrides
CedarRequest call = builder.forToolCall(caller, tool, arguments);
AuthorizationResponse decision = engine.isAuthorized(call.toAuthorizationRequest(McpCedarSchema.schema()),
        McpCedarSchema.platformPolicies(), call.cedarEntities());

// server: the tool's action on a resource resolved from the system, decided by the server's own policies
ResolvedResource issue = ResolvedResource.of("Jira::Issue", "ABC-123", Map.of("key", "ABC-123"))
        .withScopes(List.of("Jira::Project/HR"))
        .withParent(ResolvedResource.of("Jira::Project", "HR", Map.of("key", "HR", "category", "Restricted"))
                .withScopes(List.of("Jira::Project/HR")));
CedarRequest onResource = builder.forResource(caller, tool, arguments, issue);
AuthorizationResponse r = engine.isAuthorized(onResource.toAuthorizationRequest(PolicyFragments.composeSchema(fragmentSchemaText)),
        PolicyFragments.policySet(policyFileTexts), onResource.cedarEntities());
```

Search and lists (CC-036): `builder.queryConstraint(caller, "Jira::Project")` says what to limit the query to the system to,
and `new ResultFilter(builder, authorizer).allowed(caller, tool, arguments, items, item -> resolvedResourceOf(item))` keeps only
the items the policy allows (the rest are dropped, also when evaluation fails).

Policy fragments (C6, C7): `PolicyFragments.validateFragment(namespace, schemaText, policyFiles, types)` is the check that the
starter runs at build and at start and the gateway at registration (strict validation of the composition, one namespace, `scopes` on
every type, no `Action::"call"` or `Tool`, no impossible policy, declarations that match the schema);
`PolicyFragments.validateOverride(id, text, targetFragmentSchema)` validates an emergency override. `McpCedarSchema.text()` is the
base schema, `McpCedarSchema.platformPolicies()` the policies of the gateway.

`EntityBuilderException` (code `INVALID_ARGUMENT` or `INTERNAL_ERROR`, `wireCode()` is the C10 code) means the call is refused.
A malformed declaration or fragment is an `IllegalArgumentException` or a failed `Result`: those are registration-time errors.

## IGA port (C13)

An internal BFF port (it does not affect the OpenAPI, CC-052). The requester is a `Requester` with identity attributes from the
OIDC token of the BFF session, never from the browser:

```java
record Requester(String sub, String username, Optional<String> email, Map<String, Object> claims) {}

interface AccessGovernance {
  List<Entitlement> catalog(String system);
  List<AccessRequest> requestsOf(Requester requester);
  RequestResult request(Requester requester, String entitlement);
}
```

Each IGA adapter chooses the requester identifier from configuration (for example `requester-id-claim`, default
`preferred_username`); a missing claim in `Requester` is an adapter error and a refusal (fail-closed). The shapes of
`AccessRequest` and `RequestResult`: CC-024.

## Frozen Cedar schema (7.0 line)

`cedar/mcp.cedarschema` is the base schema, in the empty namespace. Every server's fragment is appended to its text and validated
against the result, so the file is frozen byte for byte within a major line, including the header comment and LF line endings:
a change of one byte could make a fragment that validated yesterday fail today. The tests (Node and Java) compare the SHA-256 of
the file (`.gitattributes` enforces LF). SHA-256 of the 7.0.0 schema: `6340b0f5704c5d865aac9ec4e3e16cfcbdd2cfe6a4748377db7abcad7d8518b1`.
It names no system, server or resource type; it has `ResourceScope`, `UserGroup`, `User` (with one flat `scopes` set), `Tool` (with
`requiredGroup`), `RequestContext` (`refs` is a set of `ResourceScope`) and the action `call`. The previous bytes
(`51d71b2d...`, 5.0.0 ... 6.3.2) are not valid on this line, and policy bundles no longer exist.

## Resource identifiers

Identifiers of a resource type have the pattern that the server declares in `resourceTypes[].idPattern` (CC-056, CC-229); the
patterns of the former built-in systems are data in `cedar/examples/systems/*/resource-types.json` and described in
`cedar/entity-builder.md` section 12. Non-matching identifiers are rejected in tool arguments, in resources from the resolver
and in the scope mapping (`scopePattern`). Patterns are matched against the whole value (`ResourceTypes.isValidId`): a Java JSON
Schema validator that matches with `Matcher.find()` lets `$` accept a trailing `\n` (`"ABC\n"`), so a component must not rely on the
JSON schema of a tool argument alone. The server still quotes identifiers in the query language of its system.

## MCP methods and JWT (C2, C11)

Rules for the JWT variants (CC-030, CC-033, CC-038, CC-069, CC-070):

| Request | Variant | `tool` |
| --- | --- | --- |
| `tools/call` (also a retry with `inputResponses` after an `InputRequiredResult`, MRTR) | user | required, `== params.name`, a new JWT for every retry |
| `initialize`, `server/discover`, `tools/list`, `ping` | user or service | forbidden |
| server `GET /.well-known/mcp-manifest` (the gateway pulls the manifest, C14) | none: served without a token | none |
| server `POST /.well-known/mcp-policy-data` (the gateway pushes policy data, C14) | service only, `use: policy-data` | forbidden |
| `subscriptions/listen`, `notifications/*`, JSON-RPC responses, `GET`/`DELETE` on the MCP endpoint | user only | forbidden |
| broker `POST /v1/credentials/resolve` | user only | required |
| broker `GET /v1/authenticator`, `POST /v1/authenticator/verify`, `POST /v1/authenticator/invalidate-codes` (from the gateway, CC-092, CC-128) | user only | required (the tool being confirmed; for `invalidate-codes`, the tool of the operation that causes the burn) |
| broker `GET /v1/systems` | user or service | forbidden |

The service variant is used only without a session (statelessly): all requests within a session, including
`notifications/initialized` and `notifications/cancelled`, use the user variant (CC-070).

**Purpose of a token, `use` (CC-249).** Every internal JWT carries `use`: `call` or `policy-data`, and a receiver refuses a token whose
purpose is not the one of the endpoint, with `401` and the reason `wrong_purpose`, whatever else is valid (signature, `aud`, `exp`, `jti`):

| Endpoint | `use` required |
| --- | --- |
| `POST /.well-known/mcp-policy-data` of a server | `policy-data` |
| everything else: the MCP endpoint of a server (`initialize`, `server/discover`, `tools/list`, `ping`, `tools/call`, streams, notifications) and every endpoint of the credential broker | `call` |

The user variant has `use: call` only. `GET /.well-known/mcp-manifest` is outside this table: a server serves it without authentication (no token required, none sent, a header that arrives is ignored). The policy-data endpoint accepts the service variant only (no user, no tool). The check of the purpose
comes before the checks of the variant and of `tool`, so a policy-data token used for `tools/call` is `wrong_purpose`. `jti` is one-time for every
purpose, `aud` is the `serverId` of the receiver, `exp - iat` is at most 60 s. A token without `use`, or with another value, is `invalid_claims`
(the schema is closed). Vectors: `test-vectors/jwt/purpose-*`.

There is no purpose `manifest` and no exception to `aud`: a token with `use: manifest` is `invalid_claims`, and every token that is checked needs `aud` equal to the `serverId` of the receiver.
The manifest holds nothing secret (tool descriptions and policies, which are in the source of the server) and the port of a server is reachable only from the platform host.
Vector: `jwt/valid-manifest-without-token`.

A `prv` of `00000000000000-0000000` means a gateway without policy data. It is not the revision of any data, and a receiver draws no
conclusion about policy from it. Since 7.0.0 `prv` is the revision of the policy data of the gateway (CC-234): a server that sees a newer one
than it holds does not evaluate the call and answers `409 policy_data_stale`; the gateway pushes its data and repeats the call once
(CC-249, "Policy data gate").

C11: in the MCP 2026-07-28 era, the "elicitation URL" confirmation channel is an `InputRequiredResult` with an elicitation
request in URL mode, and the retried `tools/call` carries `inputResponses`. Elicitation may only open `previewUrl`; the human
types the code in the client (CC-091, 3.0.0).

## TOTP code confirmations (C11, since 3.0.0)

A destructive action is confirmed by the current 6-digit code from the "MCP Platform" account in the Authenticator app, typed in
the AI client (CC-091). The broker verifies the code (C4 `verifyAuthenticatorCode`); the gateway receives only the result.

1. First call: the gateway asks the broker about registration (`GET /v1/authenticator`). Without a registration it fails
   closed: `confirmation_required` with only `registerUrl`, and no pending call. With a registration the gateway stores a
   pending call under the key (`sub`, `serverId`, `tool`, SHA-256 of the canonical arguments without `confirmation_code`), TTL
   120 s, 3 attempts, and answers `confirmation_required` with `confirmationId`, `description` (computed by the gateway),
   `previewUrl` and `expiresAt`. A repeated first call returns the same record without extending the TTL. Creating a pending
   `DESTRUCTIVE` call and invalidating the previous one are **one atomic operation per user** (a conditional write or a lock
   per `sub`); parallel first calls produce at most one pending call (`first-calls-parallel-*`). **A user has at most one
   pending `DESTRUCTIVE` operation** (CC-127): a new, different `DESTRUCTIVE` operation (another tool or other arguments)
   invalidates the previous one. The previous one gets the audit reason `superseded` (a `confirmation` event), and a retry of it
   with a code ends with the C10 error `confirmation_superseded` (the broker is not asked, and no attempt or TOTP step is
   consumed; the gateway keeps a trace of the invalidated call until its original TTL ends, after which it is an ordinary
   `confirmation_failed`); the preview of an invalidated call is `404`. **A trace is not a pending call:** calling the
   invalidated operation again creates a new pending call (a new `confirmationId`, a new TTL, invalidating the current
   `DESTRUCTIVE` one) and replaces the `superseded` trace under the same key, so the next retry with a code hits the new record
   (`first-call-after-superseded-same-operation`, `retry-after-reissue`); traces do not count toward the limit. A **blocking
   trace** (viewed, unconfirmed A: pending, exhausted or expired) is stored separately, per `sub`, not under the operation key,
   and a new call of the same operation (A') does not replace it; the rule "replaces the trace" applies only to `superseded`
   traces (`first-calls-sequence-exhausted-a-then-same-operation-then-b`). The limit of pending calls per `sub` (3 by default)
   now applies only to confirmations of a risk other than `DESTRUCTIVE` (required by policy) and gives `rate_limited` with
   `retryAfterSeconds` equal to the time until the oldest of them expires.
2. The preview (`previewUrl`, C12 `GET /api/v1/confirmations/{id}`) is **optional**: read-only, owner only, a session without
   fresh MFA, `no-store`; the code works without opening it. Residual risk accepted by the maintainers (2026-10-27): the code
   confirms the presence of a human, not the operation. The preview shows the state at the moment it is opened and does not
   refresh: a new `DESTRUCTIVE` operation can invalidate the one being viewed before the code is typed while the page still
   shows it (the frontend should poll it and show "link outdated" after a `404`). **After the preview is opened, the first
   operation wins** (CC-127): when the owner has opened the preview of a pending `DESTRUCTIVE` operation A, a different
   `DESTRUCTIVE` operation B does not invalidate it but gets the C10 error `confirmation_blocked` with `retryAfterSeconds` (the
   time to the end of the block), until A is confirmed or until `max(expiry of A, preview opened + 90 s)`, also when A has run
   out of attempts or expired earlier; `retryAfterSeconds` is always at least 1. After the block ends, a code typed for A may
   still be valid (up to 90 s after A expires, for example when the preview was opened at once and the code typed just before
   the TTL ended), so **creating B after a viewed trace of A in any state (pending, exhausted, expired, and also confirmed: a
   second code typed "for A" could confirm B) first calls `invalidate-codes` at the broker** (in the same per-user critical
   section as creating B; a broker error is `upstream_unavailable` for B and nothing is created; this does not apply to a
   cancelled A (cancelling already burned the codes) or to the same operation, unless A was executed; after a **confirmed** A,
   burning also applies to the same operation A' (a second code typed "for A" could confirm A';
   `first-call-preview-viewed-confirmed-same-operation-burns`); vectors
   `first-call-late-code-viewed-early-burns-before-creating-b` and `first-call-preview-viewed-confirmed-burns-before-b`).
   **The gateway keeps the trace of a viewed A (in any state) at least until `A.expiresAt + 90 s` (210 s from creation),
   regardless of when the block ends; removing it earlier violates the contract** (otherwise creating B after the block ended
   would not know that it has to burn codes). The client must not then ask the user for a code for B. Opening the preview is
   recorded by an explicit call from the rendered, visible page (`POST /api/v1/confirmations/{id}/viewed`), not by the `GET`
   alone, so a prerender does not block the operation; the write and the check at B are atomic with respect to each other.
   **Cancelling** (CC-128): in the preview the owner can cancel a pending operation (`POST
   /api/v1/confirmations/{id}/cancel`, session and XSRF, no MFA, because it approves nothing and is not an "approve" decision).
   Cancelling removes the pending call atomically with code verification (a code typed in parallel after the cancellation does
   not confirm it), lifts the block, and the agent's next retry gets `confirmation_cancelled` (audit `cancelled_by_owner`,
   result `cancelled` in `/activity/calls`). Cancelling **also invalidates the owner's current TOTP codes** at the broker (`POST
   /v1/authenticator/invalidate-codes`, called by the gateway before the pending call is removed; a broker error is `503` and
   nothing is cancelled; only the first effective cancellation burns, a repeated one is a plain `204`; cancelling a viewed trace
   with exhausted attempts is also allowed and lifts the block): the broker clock step and the next one are marked as used, so a
   code typed for the cancelled operation and held by the agent will not confirm a new one (it is `burned`, a broker result, and
   does not count toward the 5/15 min and 20/24 h limits); a valid code is only the one from two steps later (after 30-60 s).
   The description of an operation in an untrusted client may differ from the pending one whether or not the preview was
   opened. The audit tells the two cases apart (`user_confirmed` and `user_confirmed_no_preview`).
3. A retry with the same arguments and `confirmation_code` (pattern `^[0-9]{6}$`, a field added to `inputSchema` outside
   `definitionHash`): a code of the wrong format is `invalid_argument` and does not consume an attempt. The gateway looks for the
   pending call; if there is none, it has expired or the arguments differ, it answers `confirmation_failed` without asking the
   broker (the TOTP step stays unused). Otherwise it calls the broker and maps the result: `ok` runs the tool and consumes the
   pending call; `invalid`/`replayed` is `confirmation_failed` and -1 attempt (at 0 the pending call disappears); `burned` (a
   code from a burned step) is `confirmation_failed` outwardly like `replayed` (no new oracle), but without consuming an attempt
   and without counting as a wrong code (`code_burned`); `locked` is `rate_limited` with `retryAfterSeconds` without consuming
   an attempt; `not_registered` is `confirmation_required` with `registerUrl`; a broker error is `upstream_unavailable` (the
   code is not "spent"). **Atomicity (normative requirement):** the gateway reserves an attempt atomically BEFORE asking the
   broker (a decrement of `attemptsLeft`; the reservation is returned on `locked`, `disabled`, `not_registered` and a broker
   error, and kept on `invalid` and `replayed`), so N parallel retries produce at most `attemptsLeft` questions to the broker,
   and consuming the pending call on `ok` is a compare-and-delete (one execution happens). Vectors: `retries-parallel-*`.
4. The broker (RFC 6238: HMAC-SHA-1, 6 digits, 30 s step, a window of +-1 step, each step accepted once): 5 wrong codes
   (`invalid` or `replayed`) in 15 minutes block the user's verification for 15 minutes. A second, daily limit (CC-126): **20
   wrong codes in 24 hours** (a sliding window; `invalid` or `replayed`; `locked` and `malformed` answers do not count, and a
   success does not reset the counter) **disables the user's Authenticator** (`state: disabled`, reason `daily_failure_limit`,
   an `authenticator` event with the reason `authenticator_disabled`) until it is registered again with Entra step-up MFA. A
   disabled Authenticator answers `disabled` without checking the code, and the gateway sends the user to `registerUrl` as if
   there were no registration. The daily disabling **is not an unblock** and does not change the rule "a block ends only with
   time": nobody lifts the 5/15 min block, and a disabled Authenticator is not revived but replaced by a new registration
   (activating it resets the daily counter and the `disabled` state; the user's block stays). The portal shows the state and a
   banner but has no unblock button. **Atomicity (normative requirement):** the check "not locked, not disabled", the 5/15 min
   and 20/24 h counters and the block are one atomic step per `sub` (serialization, or reserving an attempt with a single
   conditional write before the TOTP is computed); 50 parallel wrong codes give exactly 5 checks and the rest `locked`
   (`totp/concurrent-*`). **The block belongs to the user, not to the registration** (maintainer decision of 2026-10-28):
   removing, re-registering and resetting leave it in place, and activating a new registration resets the counters (short and
   daily) and the `disabled` state, but not the block (`activate` in `scripts/lib/totp.mjs`). **A block is lifted only by the
   passage of time** (decision of 2026-10-28): the portal has no unblock, removing and re-registering do not lift it, and a reset
   by `mcp-offboarding` does not either. A registration in progress is valid for 10 minutes, and three wrong codes destroy it.
   A registration is created and removed after fresh Entra MFA (BFF, CC-093); for a lost phone, remove the registration after
   Entra MFA and create it again, and when the Entra factor is lost too, the helpdesk calls `POST
   /v1/admin/users/{sub}/authenticator/reset` (CN `mcp-offboarding`).
5. Seed storage (normative requirement, CC-092): the active seed and the seed of a registration in progress are encrypted only
   by Transit (no envelope, like credentials) under the path `mcp/authenticators/<sha256(sub)>`; the decrypted record contains
   `sub`, which is compared with the request; a seed in progress lives 10 minutes and is deleted after activation, after the TTL
   and after the third wrong code; the database keeps only metadata, and seeds are never stored in plaintext in Redis or the
   database. The broker trusts the BFF about the freshness of MFA (mTLS CN `mcp-portal-bff`): a deliberate assumption. The seed
   leaves the broker once, in the `201` of the registration to the owner (`no-store`, an exception to the rule that secrets are
   never returned), and never goes to logs, audit or the BFF session. The code, the seed and `otpauthUri` are not in C8 (the
   field `event: "authenticator"`, CC-094).
6. There is no "approve" or "reject" decision and no decision endpoint: confirmation is the TOTP code and nothing else. The
   owner can only cancel a pending operation (item 2); otherwise a refusal is not typing the code, and the pending call expires
   after 120 s. The code `confirmation_declined` was removed from C10. The SPI `ConfirmationCodeSender` is obsolete.
7. Residual risk and its limits (decision of 2026-10-27): the TOTP code is not bound to the operation, so it confirms the
   presence of a human, not the arguments; a manipulated agent can show the description of operation A while B is pending and use
   the code typed for B. Mitigations, without requiring the preview: one pending `DESTRUCTIVE` operation per user (without an
   open preview, a new one invalidates the older one before the code is typed and leaves an audit trace; after the preview is
   opened the first wins and the new one is rejected, so a human who saw the operation in the trusted channel does not lose it
   silently; a code can confirm the newest pending `DESTRUCTIVE` operation, but also one of the pending confirmations of another
   risk, which this rule does not cover, and only once), a TTL of 120 s, 3 attempts per call, the 5/15 min block, disabling after
   20 errors a day, one-time use of a TOTP step, the optional preview in a trusted channel, and an audit that distinguishes
   confirmation with the preview (`user_confirmed`) from confirmation without it (`user_confirmed_no_preview`). The "one
   operation" mechanism without the preview does not prevent substitution (the agent can invalidate A with its own B and only
   then confirm B with the code); it narrows the number of pending operations and leaves a `superseded` trace. A user who did not
   open the preview gets no signal at the time of typing the code. After the preview is opened, substitution by another
   `DESTRUCTIVE` operation is blocked until the block ends (this does not cover confirmations of another risk); the owner can
   cancel an unwanted operation in the preview (item 2), which lifts the block. A consequence of the daily limit: an agent can
   disable the Authenticator with about 20 wrong codes (about an hour), which denies confirmations until re-registration with
   Entra step-up MFA (CC-126).
8. The rule `override-destructive-requires-fresh-mfa` (`cedar/examples/overrides/step-up.cedar`, kept as the example of a gateway override: it forbids when `context.mfaAge` is missing or stale, so a token without the `mfa` claim is refused, vectors `gw-destructive-*-mfa`) stays in the
   examples unchanged but **is not part of the production bundle**: a user is not meant to have two mechanisms.

**Clocks:** the block and burn windows are counted by the gateway clock and the validity of a code by the broker clock. Both
are NTP-synchronized with a drift of up to 5 s, and the 90 s margin also covers a fast phone (a total drift of up to 30 s).

**Preview, cancelling and exhausted attempts:** `GET` and `viewed` for a call that ran out of attempts are `404` when it was
never viewed (nothing blocks); for a viewed one `viewed` is idempotent and the block lasts. Cancelling works until the call's
`expiresAt` (then `404`, although the block may last up to 90 s longer) and, for a viewed exhausted trace, lifts the block.
Requirements for the preview page: after `expiresAt` or after a `404` the page does not show the operation as pending and says
not to enter a code for it; when `viewed` fails, it shows that the "first wins" protection is not active.

**Loss of confirmation state (fail-closed):** the gateway's confirmation state (pending calls, traces, `previewViewedAt`) lives
in durable storage (Redis with `appendonly`, `maxmemory-policy noeviction`, and `WAIT` for the write of the view under
replication). A missing record or trace after a restart or failover means no confirmation (never "confirmed"), and creating a
`DESTRUCTIVE` call while the store is unavailable is `503 upstream_unavailable`. When the gateway cannot show continuity of the
state (no epoch marker written at startup), then for 210 s from startup the first creation of a `DESTRUCTIVE` call for a given
`sub` calls `invalidate-codes` before creating it (as after a viewed trace), and the first code accepted from a user is
preceded by such a call, so that a code typed before the state was lost does not confirm a new operation.

Vectors: `test-vectors/confirmation-binding/` (first call and retry; the broker result is input data), `test-vectors/totp/`
(RFC 6238, the window, one-time use of a step, the block, registration, the `otpauth` URI; the test seed comes from RFC 6238,
NOT FOR PRODUCTION), references in `scripts/lib/confirmation.mjs` and `scripts/lib/totp.mjs`.

## One domain (CC-089)

The portal and the gateway have one public origin behind a reverse proxy:

| Path | Target |
| --- | --- |
| `/` | web application (SPA routes fall back to `index.html`) |
| `/api` | BFF (including the BFF OIDC callback: `redirect_uri` under `/api`) |
| `/mcp`, `/s/` | gateway (MCP); `/v/` was removed and the gateway answers it with `404` (CC-177) |
| `/.well-known/oauth-protected-resource*` | gateway (RFC 9728; the variant with a path sits at the domain root) |

Rules: the public address (`url`, `clientConfigs`, `resource_metadata`) comes from the `publicBaseUrl` configuration, never from
the request's `Host`/`X-Forwarded-Host`; the gateway trusts `X-Forwarded-*` only from the proxy. The cookies `__Host-session`
and `__Host-XSRF-TOKEN` have `Path=/` (the `__Host-` prefix and reading by the SPA do not allow `/api`), so the proxy removes
the `Cookie` header on gateway routes and the gateway does not forward `Cookie` (it joins the headers removed in C3: `X-MCP-*`,
`X-PAT-*`, `Authorization`, `X-Request-Id`). Gateway responses to MCP clients are only `application/json` and
`text/event-stream`, also for errors (404, 405, 406, 5xx) and regardless of `Accept`: the gateway never answers `text/html` on
public routes. On **every** gateway route (`/mcp`, `/s/`, `/.well-known/oauth-protected-resource*`) the proxy adds
`X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`, on every response, including 4xx/5xx
from the upstream and the proxy's own error pages (nginx: `add_header ... always`). Responses on these routes carry no
`Set-Cookie` (the proxy removes it), the BFF sends no CORS headers (same origin), and the proxy forwards a normalized path and
does not expose `/admin/v1/*` or the gateway JWKS through public routes (a separate listener; `/s/../admin/v1/...` and `%2e%2e`
give 404). The proxy does not overwrite the BFF's `X-Request-Id`. The Angular Router defines no routes starting with `/api`,
`/mcp`, `/s/`, `/v/`, `/.well-known/`. `/f/` is not reserved (CC-171).

## One address for the whole platform (CC-169 ... CC-177)

Since 5.0.0 there are no saved links (`/v/<slug>/mcp`), no `virtual_servers` table, no link API (C5 and C12), no limit
`MCP_VIRTUAL_SERVERS_MAX_PER_USER`, no claims `vs` and `vsc`, no `context.virtualServer` and `context.vsScopes` in Cedar, no
`resourceDefaults` field and no `virtual_server_change` event. Narrowing resources in the address does not exist; if it
returns, it returns as a new CC with a new claim (for example `rsc`), not from the old `vsc` (CC-173).

**Addresses.** `<publicBaseUrl>/mcp` returns in `tools/list` all tools the user can call now, from all systems: the
intersection of approved, enabled tools that the server serves and that match the approved definition, with a Cedar decision for
the current token (the list is computed on every `tools/list`, not stored). Names are `<system>__<tool>`, and the gateway routes
`tools/call` by prefix to `mcp-<system>`; there is no model-based router. `<publicBaseUrl>/s/<serverId>/mcp` stays (one system;
`systems` in the filter must be empty there or equal to the route's system, otherwise `400`). A system without a connected
account has its tools visible, and a call gives `credential_required` with `connectUrl`. A server that is unavailable or has a
mismatched definition is omitted from the list (on a call, `upstream_unavailable` or `tool_disabled`, unless the tool filter
removes it; the order is in "Filter in the query"), and a damaged list from one server does not invalidate the others. The
`tools/list` reads of servers run in parallel, each with the time limit `MCP_TOOLS_LIST_TIMEOUT` (milliseconds, default `3000`, a
non-positive value stops startup; CC-180). A server is unavailable for this list when the read it had to perform (TTL 60 s) did
not give a correct result within the limit: a timeout, a connection or TLS error, a status other than `200`, a body that is not a
`tools/list` result or does not match the schema; a read from the cache within the TTL is not subject to the limit. An omission is
not proof of a change or of missing tools (no `definition_changed` and no `tool_not_served`). The list has at most 100 tools per
page; further pages carry `nextCursor` (an opaque cursor bound to `sub` and the filter, valid for 15 minutes; a bad cursor is
always `-32602`, including the empty string `""` and `null` (CC-225): the first page is a request without the `cursor` field;
CC-181, CC-200). A client that does not follow `nextCursor` sees only the first page. The order of the list is fixed: by system
in `ServerId` order, and within a system by tool name (bytewise). `initialize` returns the same `serverInfo` for every form of the
address. `/v/` answers `404 not_found_or_denied` without an audit event, regardless of the token; there is no transition code
and no deprecation period (CC-177). Vectors: `test-vectors/endpoint-aggregate/`.

**Filter in the query (CC-170).** `systems=` (a system id without `mcp-`), `tools=` (`<system>__<tool>`), `access=read|write`,
`exclude=` (an entry with `__` is a tool, any other is a system). The result visible to the model is the set from `/mcp`
intersected with the filter: `systems` AND `tools` AND `access` AND NOT `exclude`; `tools` narrows and adds nothing.
`access=read` means tools whose approved registry risk is `READ_ONLY`, `access=write` means `UPDATE` and `DESTRUCTIVE` (disjoint
sets; no parameter means both). The filter works on the `risk` from the registry, not on the `action` from the server manifest.
Canonical form: parameters in the order `systems`, `tools`, `access`, `exclude`, values in lower case, sorted bytewise, without
duplicates, an unencoded comma, for example `systems=gitlab,jira&access=read`. Case in names and values does not matter when
reading. `400` (`{"error":"invalid_request","reason":"invalid_filter"}`, schema `EndpointFilterError`, no `WWW-Authenticate`) is
given for: an unknown parameter (a typo `system=` must not silently drop the filter), a repeated parameter, an empty value or
entry, `%` in the query (also an encoded comma `%2c`), a character outside `[A-Za-z0-9_,=&]`, an entry that does not match the
syntax, `access` other than `read` and `write`, more than 20 `systems` entries, 100 `tools` or 100 `exclude` entries (after
removing duplicates), and a query longer than 512 bytes. The token is checked first (without a valid token the response is `401`
with a challenge, also for a bad filter), then the filter. An entry that is syntactically correct but nonexistent, without
permission, disabled, pending approval or from an omitted server is skipped just like a tool without access (a denied tool must
be indistinguishable from a missing one): no `400` and no difference in the response. An empty intersection is `initialize` without
an error and `{"tools": []}`. A `tools/call` on a tool outside the result is `not_found_or_denied`; the audit has `reason:
filter_scope` when the user has the right to the tool and the filter cuts it off, and in other cases the existing reasons
(`not_granted` and so on).
**Order on a call (CC-178):** first `mayCall`, that is the registry entry (in any state) and the Cedar decision at tool level (the
same one that qualifies it for `tools/list`, without arguments), independent of server availability: a missing grant is
`not_found_or_denied` with `not_granted`, and a prohibition (`forbid`, for example an emergency override) is the same client
code with the audit reason `policy_forbid` (CC-198); the user's activity row in both cases is `denied_not_granted`, so that it does
not reveal that the tool exists. Then the filter: a tool cut by the filter is `not_found_or_denied` with `filter_scope`, regardless
of the state of the server, the tool and the account (the state does not leak). Only a tool that the filter leaves gets
`tool_disabled`, then `upstream_unavailable`, then `credential_required`, and after them the Cedar decision with arguments and the
`DESTRUCTIVE` confirmation gate. The filter therefore precedes the confirmation gate: a call cut out by the filter does not
create, consume or invalidate a pending confirmation. Vectors `endpoint-filter/call-state-*`.
A query longer than the transport limit (about 15 KB, depending on the deployment) never reaches the filter: it is `400` or `414`
with the JSON `{"error":"invalid_request"}`, without `reason` (schema `TransportLimitError`, CC-189); `invalid_filter` applies up
to that limit. Audit events of rejections that a client can repeat (`invalid_filter`, `filter_mismatch`, `invalid_cursor` and
`tools/call` with `not_found_or_denied`) are written at most once per user, reason and target (a tool name, or a hash of the
filter or cursor; up to 50 keys per user and reason, the excess shares one aggregate key, CC-195) in the interval
`MCP_RATE_LIMIT_AUDIT_INTERVAL` (default 10 s, state in instance memory, like `RateLimitAuditThrottle`); the remainder is counted
by `mcp_audit_endpoint_suppressed_total{reason}`, and after each window the pair (user, reason) gets one event with
`suppressedCount` (how many) and `suppressedTargets` (how many distinct targets). The window closes one interval after the first
event of the window regardless of traffic, and shutting the process down writes the summaries of open windows; the rejection
itself always happens (CC-190, CC-191). Vectors `endpoint-aggregate/audit-throttle-*`. The `tools` and `exclude` entries are
limited by the 512 bytes of the whole query, not by a hundred tools: after `tools=` 506 bytes remain, which is 16 names of 30
characters (31 of 15); a larger selection is expressed with `systems` and `exclude` (CC-185). The filter only narrows: it never
grants, and a client can omit or change it, so it is not a security boundary. Reference: `scripts/lib/endpoint-filter.mjs`, the
Java class `pl.aiwcorpo.mcp.manifest.EndpointFilter` (module `mcp-manifest`), vectors `test-vectors/endpoint-filter/`.

**An IdP token with claims that do not exist (CC-201).** The gateway reads `iss`, `aud`, `sub`, `exp` and a few known claims from
the client token and ignores the rest, including `vs` and `vsc` removed in 5.0.0: the token is accepted or rejected because of
those four, not the rest. The gateway builds the internal JWT (C2) from known fields and does not copy IdP token claims, so `vs`
and `vsc` do not reach servers or the broker (which reject them as `invalid_claims` anyway, CC-173). Vectors `idp-token-claims/`.
An invalid escape in the query (`%zz`, `%`, `%4`) is `invalid_filter` like any `%` after decoding; the container must not answer
`500` (CC-202, vectors `mcp-endpoint/http-broken-escape`, `http-lone-percent`, `http-half-escape`).

**OAuth (CC-171, variant V2).** The resource identifier is `<publicBaseUrl>/mcp` without a query; `WWW-Authenticate: Bearer
resource_metadata="<publicBaseUrl>/.well-known/oauth-protected-resource/mcp"` also has no query, and the filter is only in the
address of the MCP request. The metadata document has `resource: <publicBaseUrl>/mcp`; a metadata request with a query gets the
same document. The token `aud` stays `mcp-gateway`, and the gateway does not compare `aud` with the address. Basis: a test of
2026-10-31 in which Keycloak 26.8.1 rejects a `resource` with a query, while Claude Code with V2 logged in, refreshed the token
after 27 minutes and kept the filter. **Accepted risk:** V2 is confirmed only for Claude Code. A client that rejects a `resource`
without a query, or does not keep the query when refreshing the token, will not work with the filter until a `/f/` route is added
(a new CC); `/mcp` without a filter works with every RFC 9728 compliant client. A client that simply drops the query connects to
`/mcp` without a filter and gets the full list without an error: this is a silent widening of the view, not of permissions (Cedar
decides on every call; CC-187).

**Session (CC-172, CC-184).** When the protocol has a session (`Mcp-Session-Id`), the normalized filter from `initialize` is stored
with the session, and every later request of the session (`DELETE` too) must have the same normalized filter; a session does not
move between users or routes. Without a session (MCP 2026-07-28, CC-070) the filter applies per request. With HA the binding is
kept in Redis together with the sessions. Order of checks:

| Step | Check | Response |
| --- | --- | --- |
| 1 | token | `401` with a challenge (or `503`) |
| 2 | query syntax | `400 invalid_filter`; depends only on the request bytes, the session is not read |
| 3 | `sub` of the session | a foreign or unknown session: `404` as for an unknown session, without `filter_mismatch` |
| 4 | route of the session | a route other than the one where the session was created: `404`, `filter_mismatch` |
| 5 | filter after normalization | different, added or missing: `404`, `filter_mismatch` |

`Mcp-Session-Id` together with `_meta` is a session request (steps 2 to 5); `_meta` disables nothing. The binding orders the audit
(one session, one filter) and is not a security barrier: after a `404` the client initializes a new session with a different
filter, and permissions are decided by Cedar on every call. `GET` on `/mcp` and `/s/<serverId>/mcp` is `405` with `Allow: POST,
DELETE` (after the token check) because the gateway does not expose a server stream (CC-179). Vectors: `endpoint-filter/session-*`
and `session-order-*`.

**Audit and activity (CC-174).** The gateway events `tool_call`, `policy_decision`, `confirmation` and `credential_resolve` have
the optional field `filter` (canonical form, at most 512 characters, only when the request had a filter); `authentication`,
servers and the broker do not have it (correlation by `requestId`). `filter` entries have the syntax of system and tool names, but
the client chooses them and nobody compares them with the platform's list (CC-186). The field `virtualServer` is gone from C8 and
C12. Reasons: `filter_scope` (replaces `link_scope`; a SIEM rule on the old name stops matching), `invalid_filter`
(`policy_decision`, result `error`, no `filter` field), `filter_mismatch`. An activity row has `filter` instead of a link name and
the result `denied_filter_scope` (group `denied`).

**Wizard in the portal (CC-175).** Nothing is stored. `GET /api/v1/me/mcp-endpoint?systems=&tools=&access=&exclude=` (C12) returns
the normalized address, `clientConfigs` built from `publicBaseUrl` (never from the request) and `toolCount`: the number of tools
from the user's catalog (`granted`, not `disabled`) that the filter leaves. `toolCount` serves as a warning about list size; the
gateway's `tools/list` is authoritative. A bad filter is `400 invalid_request` with `reason: invalid_filter`. The address in the
`claude mcp add` command is quoted because it contains `&`. Vectors: `test-vectors/mcp-endpoint/`. The BFF receives the four
parameters as values typed in the OpenAPI, decoded by the HTTP layer (a comma sent as `%2C` arrives as `,`), and composes the
query itself (`composeQuery`); a value that has `%`, `&` or `=` after decoding is a bad filter. The MSW mock rejects the same
(CC-182). The wizard fits about 16 tool names of 30 characters in the address (the limit is 512 bytes of query, not 100 tools):
it shows a byte counter and does not send a request that cannot be composed (CC-185). `POST /admin/v1/users/{sub}/purge` of the
gateway stays (pending confirmations, code traces, MCP sessions in Redis, the credential cache); only the "links" part goes.

**`list_changed` notifications (CC-176, CC-179, CC-192; required since 6.0.0).** The gateway declares
`capabilities.tools.listChanged: true` on `/mcp` and `/s/<serverId>/mcp`, in both forms of the protocol (with a session and
stateless), and sends an empty `notifications/tools/list_changed` when the `tools/list` result of a given session changes.
- **Triggers:** approval, disabling (also the kill switch, CC-194), enabling, a definition change and removal of a tool; a change
  of the user's groups or of the policy data revision (detected on token refresh or on a request, so an idle session may get the
  notification late); a change of server availability. A change of the account connection is not a trigger (the list does not
  change, only the result of a call does).
- **Rules:** at most one notification per session in a 1 s window (changes within the window merge into one, sent at the end of
  the window, also when the list returned to the previous one); a notification does not reach a session whose filter cuts out the
  changed tools; notifications are not audited; the delay from the event to the notification is at most 5 s, also with several
  instances (maintainer decision of 2026-11-03; registry and kill switch events reach all instances through Redis pub/sub or a
  version counter). **A change of the policy data (the scope mapping, an override, an approved policy fragment) is an exception (CC-228, a weakening of the 5 s promise of 6.0.0 and 6.2.0 that a
  consumer may have relied on):** an instance sends `list_changed` after it has loaded the new policy data itself, so the delay depends
  on its polling of the data and there is no 5 s guarantee; the gateway does not wait for all instances, and the list from `tools/list`
  is always computed from the policy data loaded on the instance that answers. Vectors: `endpoint-aggregate/list-changed-*` (the
  decision about the list) and `list-changed-sequence-*` (the 1 s window).
- **`GET` on `/mcp` and `/s/<serverId>/mcp`** with `Accept: text/event-stream` and `Mcp-Session-Id` opens a stream. The order of
  checks is as in CC-184 (token `401`/`503`, syntax `400`, `sub` of the session `404`, route `404`, filter `404` with
  `filter_mismatch`); `GET` without a session or without `Accept: text/event-stream` is `405` with `Allow: POST, DELETE, GET`.
  In the stateless form the stream is opened by `subscriptions/listen` (POST): there is no session, and the stream is bound to
  the filter of that request; the order of checks is the token (`401`/`503`), then the filter syntax (`400 invalid_filter`),
  without `filter_mismatch`, because there is nothing to compare with. The reference point of the list is always the user's list
  at the moment the stream was opened, as known to the instance that holds the stream; a `tools/list` served in the meantime
  (perhaps by another instance behind the balancer) is not that reference point (vectors
  `endpoint-filter/stream-open-stateless-*`, `endpoint-aggregate/list-changed-stateless-*`; decision of 2026-11-03, CC-207).
  Vectors `endpoint-filter/stream-open-*`.
- **Classification in the adapter sidecar token (CC-226, since 6.3.1).** For a `tools/call` of a tool of a server in adapter mode,
  the gateway adds to the user variant of the internal JWT the claims `mcp_risk` (`READ_ONLY`, `UPDATE`, `DESTRUCTIVE`) and
  `mcp_action` (`read`, `update`, `delete`, `admin`) from the administrator's classification in the registry; always together,
  only with `tool`, and only a matching pair. The names do not collide with `act` from RFC 8693. The schema has a separate
  variant `AdapterUserClaims`, but a schema cannot tell the receiver, so the receiver rule applies: **only the adapter sidecar
  accepts these claims; a native server and the broker reject a token with `mcp_risk` or `mcp_action` as `invalid_claims`** (the
  field `verifier.receiverMode` in the `jwt/` vectors). The gateway sends them only to a `serverId` in adapter mode. A sidecar that
  gets a `tools/call` without these claims (an older gateway, a mismatched mode) refuses (fail-closed, reason
  `classification_missing`, vector `jwt/classification-missing-at-adapter`), just as an adapter tool without a classification is
  treated as `DESTRUCTIVE`; it logs and counts a value other than `READ_ONLY` (after CC-227 the gateway will not send one). A
  native server and the broker validate most simply against `#/$defs/UserClaims` and `#/$defs/ServiceClaims`, not the root; then
  the schema rejects it. The sidecar uses the claims instead of the substitute risk from the hints of the foreign server; claims
  from the IdP token are ignored (vector `idp-token-claims/with-classification-claims`). Vectors `jwt/valid-adapter-classification`,
  `classification-at-native-server`, `classification-at-broker`, `classification-risk-without-action`,
  `classification-without-tool`, `classification-pair-does-not-fit`.
- **Stream lifetime:** it ends with the expiry of the token it was opened with (the client opens a new one), with `DELETE` of the
  session and with a user `purge`. Events are not replayed (`Last-Event-ID` is ignored): after reconnecting, the client calls
  `tools/list`. Losing a notification does not harm security, because `tools/call` is checked on every call.
- **No per-user stream limit, a per-instance limit (CC-223).** No stream, neither `GET` nor `POST subscriptions/listen`, counts
  toward the in-flight request limit (`MCP_MAX_CONCURRENT_REQUESTS`, CC-199), and the number of open streams is a gateway metric
  (CC-207). An instance holds at most `MCP_MAX_OPEN_STREAMS` open streams (default 2000, `GET` of sessions and
  `subscriptions/listen` together; decision of 2026-11-03). Above the limit, opening a stream is `503` with `Retry-After`
  (`MCP_SHED_RETRY_AFTER_SECONDS`, default 2 s) and the same body as the overload of CC-199 (`upstream_unavailable`, no
  `WWW-Authenticate`), and the count of refusals is a metric. Opening a stream is an ordinary request for the user and client
  limits (CC-135) and passes all the order checks of CC-184 before the limit is checked; the stream entry is released on every
  end, also when the response did not start. Vector `gateway-authentication/streams-limit-reached`.
- **Stream heartbeat (CC-207).** On every open SSE stream (`GET` and `POST subscriptions/listen`) the gateway sends the SSE comment
  line `: keepalive` every 15 s (`MCP_SSE_HEARTBEAT_INTERVAL`, default 15 s), so that an intermediary does not drop an idle
  stream. nginx cannot tell `subscriptions/listen` from any other `POST /mcp`, so the same applies to `/mcp` and `/s/...`:
  `proxy_buffering off` and `proxy_read_timeout` of at least 60 s (four times the heartbeat). A stream cut by the balancer is `504`
  or a closed connection; the client opens a new stream and calls `tools/list`.

**Delivery semantics (CC-204).** A `tools/call` with risk `READ_ONLY` can be retried safely. `UPDATE` is delivered **at least
once**: after an error with an unknown result (a `502` from the balancer, a connection reset, a client timeout) a retry by the
client may execute the operation a second time. The platform introduces no idempotency key, and the gateway itself does not retry
a `tools/call` of risk `UPDATE` or `DESTRUCTIVE` to a server. A retry of `DESTRUCTIVE` needs a new confirmation (a TOTP code is
single-use, C11). The author of an `UPDATE` tool should, where the target system allows, design the operation so that repeating it
is harmless. When a gateway instance dies in the middle of a request, the balancer answers `502` with the body
`{"error":"bad_gateway","message":"The request may or may not have been processed. Check the result before repeating a write."}`
(schema `BalancerError`, constant text); the same for `504` (`gateway_timeout`, read limit). The balancer does not retry a
request it has already sent: `proxy_next_upstream error timeout` **without** `non_idempotent` (nginx then does not pass a `POST`
to the next upstream after sending it), so switching to another instance happens only when the connection was not established
(a dead instance, `proxy_connect_timeout`). `non_idempotent` is forbidden for `POST /mcp` (CC-206); `proxy_next_upstream off`
would be a mistake in the other direction, because it removes the switch when nothing was sent and gives a `502` with the text
about an unknown result for no reason.

**List size and prompt injection reach.** Five systems are a few dozen tools, twenty systems a few hundred; tool descriptions use
up the model's context and make selection worse, so above a threshold to be set by measurement, the filter `systems=` and
`access=read` is recommended. One session reaches all of the user's systems, so text from one system (for example a Confluence
page with an injected instruction) may push the model to write in another. Permissions do not change (per user, DESTRUCTIVE with a
TOTP code, `UntrustedText`), but the reach grows; the filter limits the reach and is not a security boundary.

## Writing the token (CC-090)

`PUT /api/v1/connections/{system}/secret` requires a valid session and `X-XSRF-TOKEN`, with no step-up MFA. Since 2.2.3 the write
is not protected by an identity comparison (CC-101); the user sees the connected account (`backendUser`). `expiresAt` is optional
information from the user (the real PAT expiry is set in the target system): the broker accepts any valid date or no field, and
the status `expiring` (< 7 days) exists only when a date was given (CC-084).

## Clarifications in 2.2.4

- **OAuth in C4 (CC-102):** `completeOAuth` answers `400 invalid_request` for a system without `user-oauth` (like
  `oauth/start`); the BFF maps an error or `503` of this operation to `connectError=provider_error`.
- **OAuth client `client_secret` (CC-104):** the broker keeps it in OpenBao under `secret/data/mcp/oauth-clients/<system>`,
  separately from user connections (`mcp/connections/<sha256(sub)>/<system>`); no response other than `resolve` returns it.
- **`CredentialRequired.connectUrl` (CC-105):** an informational field; the gateway builds the link from its own `publicBaseUrl`
  and ignores the broker's value (one source of the portal address).
- **The gateway internal port (CC-106):** `/admin/v1/*` and the JWKS (C2) are on one TLS port. JWKS clients may not present a
  client certificate (clientAuth), so the client certificate's target is checked in the application layer for `/admin/v1`, not in
  the TLS handshake (this applies to the broker and the starter too).
- **Metrics (CC-108):** `/actuator/prometheus` is read by a scraper with a clientAuth certificate from the internal CA and CN
  `mcp-prometheus` (the CN list is in the component's configuration; the certificate comes from `gen-certs.sh`).
- **Audit of link changes (CC-107):** historical; the event `virtual_server_change` and its reasons disappeared in 5.0.0 together
  with links (CC-174).
- **Expiry (CC-103):** `expiring` and `expiresAt` apply only to `user-secret` with a given date; `user-oauth` has
  `expiresAt: null`.
- **Result structure (CC-112):** a tool with an `outputSchema` returns `structuredContent` that matches the schema; `UntrustedText`
  is a result record, the system's fields sit next to it; the server converts wiki markup (`format` is `text/plain` or
  `text/markdown`).

## Whoami (C4.1)

Since 2.2.3 (CC-101) the broker calls whoami of the target system after a secret is written or an OAuth code is exchanged **only**
to check that the credential is valid (`422 secret_invalid`) and to read `backendUser`. It does not compare it with the SSO
identity: the same person has different logins in different systems (for example `asmith` in Jira, `alice.smith` in GitLab), and
the e-mail can be unreliable. Since 3.0.0 the code `identity_mismatch` exists in no enum (`PutSecretError`, `OAuthCompleteError`,
`ConnectErrorCode`), and the directory `test-vectors/whoami-identity/` (the comparison rules of 2.2.1 and 2.2.2, CC-100) was
removed. The portal shows "Connected as <backendUser>" after the write and in Connections.

| System | Request | Field read as `backendUser` |
| --- | --- | --- |
| Jira Data Center | `GET /rest/api/2/myself` | `name` |
| Confluence Data Center | `GET /rest/api/user/current` (CC-073) | `username` |
| GitLab | `GET /api/v4/user` | `username` |

OpenSearch (`token-exchange`) and the service desk (`service-account`) have no user token to check. A 401 from the system is
`secret_invalid`.

## Text hygiene (CC-121, CC-122)

One definition for the gateway and the servers (`scripts/lib/text-hygiene.mjs`, vectors `test-vectors/text-hygiene/`, files in
ASCII with characters written as `\uXXXX`). **The forbidden set:** C0 controls except TAB, LF, CR; DEL and C1 controls; U+2028
and U+2029; unpaired surrogates; noncharacters (U+FDD0..U+FDEF, U+xFFFE and U+xFFFF); every `\p{Cf}` character except
U+200C..U+200F (ZWNJ, ZWJ, LRM, RLM), which includes U+200B, U+2060, U+FEFF, U+00AD, U+061C, the bidirectional controls
U+202A..U+202E and U+2066..U+2069 and the tag characters U+E0000..U+E007F; invisible characters outside `\p{Cf}`: U+034F, U+115F,
U+1160, U+3164, U+FFA0, U+2800 and the variation selectors U+FE00..U+FE0F and U+E0100..U+E01EF, except a single U+FE0F directly
after an emoji character (`Extended_Pictographic`). The gateway applies the same set to the names and texts of a tool definition when an
administrator approves it (CC-250).

- **Tool arguments:** a character from the forbidden set gives `invalid_argument` (C10, a message without the value). In values
  with a `pattern` (identifiers), TAB, LF and CR are also forbidden. In arguments that pass through the mention filter (the
  server forwards text to a system that interprets mentions), the full-width ASCII characters U+FF01..U+FF5E are also forbidden
  (for example "@all" written with U+FF20 U+FF41 U+FF4C U+FF4C); plain ASCII `@all` is handled by the starter's filter, not by
  the contract.
- **Text from a system** (`UntrustedText`, tool results): the server replaces every maximal run of forbidden characters with
  **one space** (without trimming and without merging with neighbouring spaces), so that removal does not glue words together
  ("ignore" + U+200B + "previous").
- **No Unicode normalization:** neither NFKC nor NFC is applied. Ligatures, full-width text and combining sequences pass
  unchanged (outside the forbidden set); NFKC would alter ordinary text and is not needed, since full-width characters are
  rejected where they matter.

## Gateway responses to rejected and unavailable authentication (C1, CC-124)

A client token rejected after checking (`missing_token`, `malformed`, `bad_signature`, `unknown_kid`, `alg_not_allowed`,
`wrong_issuer`, `wrong_audience`, `expired`, `not_yet_valid`, `invalid_claims`): `401` with `WWW-Authenticate: Bearer
resource_metadata="<publicBaseUrl>/.well-known/oauth-protected-resource<route path>"`, without a reason (the reason goes to the
audit), with the body `unauthenticated`. When the gateway cannot check the token because there is no usable set of IdP keys (the
JWKS is unavailable and there is no usable copy, also an unknown `kid` with a failed refresh): `503` with the body
`upstream_unavailable` (C10), **without** the `WWW-Authenticate` header (neither `invalid_token` nor `resource_metadata`: the
client must not start a login that would not help), with `Cache-Control: no-store`, without `Set-Cookie` and with `Retry-After`.
**`Retry-After`: yes**, an integer number of seconds equal to the configured key refetch interval (1..60, default 10): RFC 9110
allows it with 503, and without it clients and libraries retry at once and hammer an unavailable IdP; the cost is one
configuration constant. The behaviour stays fail-closed (the request is not executed).

**Overload and the session store (CC-199).** A request the gateway rejects because too many requests are in flight
(`MCP_MAX_CONCURRENT_REQUESTS`, default 128, after `MCP_CONCURRENCY_QUEUE_WAIT`) is `503` with `Retry-After` (default 2 s,
`MCP_SHED_RETRY_AFTER_SECONDS`), the body `upstream_unavailable`, `Cache-Control: no-store`, no `WWW-Authenticate`, and with no
call to anything behind the gateway. A session request when the gateway can neither read nor write the MCP session (Redis) is
`503` with `Retry-After` (default 10 s) and the same body, not `404`: the session is not unknown, it is unreadable. Vectors
`gateway-authentication/overloaded`, `session-store-unavailable`. **A catalog without kill switch state (CC-224).** `GET
/admin/v1/catalog` with an unreadable kill switch state is `503 upstream_unavailable` with `Retry-After`, not a catalog with a
disabled tool shown as available (fail-closed, vector `kill-switch/store-unreadable-catalog`).

Order of decisions: first the checks that do not depend on keys (missing token, format, `alg`), so `missing_token`, `malformed` and
`alg_not_allowed` are always `401`, also during an IdP outage; only then the key selection. An unknown `kid` causes at most one key
fetch per minimum interval (after a successful fetch within that interval it is `401 unknown_kid` without refetching, after a
failed one `503`), so as not to amplify traffic to the IdP (`gateway-authentication-decision/`). The `authentication` event with
`reason: jwks_unavailable` and `errorCode: upstream_unavailable` stays. Vectors: `test-vectors/gateway-authentication/`.

## System content in tool results (C10, C6)

Free-form content that comes from a system (a page description, a comment, the body of an issue, a log line) is returned as an
`UntrustedText` object (`schemas/common.schema.json#/$defs/UntrustedText`, CC-072): `kind: "untrusted-data"`, `format`
(`text/plain` or `text/markdown`), `text`, `truncated`; a server may add its own fields (for example `omittedMacros`). A tool that
returns such content should declare an `outputSchema` with this shape, which then enters `definitionHash` (C6, CC-004). The
gateway, clients and tests check one rule instead of a shape per server.

## Credential type in Cedar (CC-076, CC-136, CC-163, CC-164)

Since 4.0.0 the Cedar model carries the optional `context.credentialType` (CC-136): the gateway takes the type from its own
configuration of the server (the same one CC-159 uses) and always supplies it before the Cedar decision, and the server from its
own configuration. A rule that limits a `service-account`, which sees everything in its system, is written in the policy of the
server: the example is `test-vectors/fixtures/notes/credential-type.cedar` (it forbids a folder outside the user's grant unless the
credential is a user credential, and is fail-closed: a missing or unknown type is treated like a service account, CC-164), with
the decision vectors `policy-decisions/srv-notes-*`. The grants come only from the scope mapping, never from the server
configuration (CC-163). Until 6.3.2 this was a fixed rule for the service desk with its own vectors
(`servicedesk-service-account/`); a server author now writes it in the fragment.

## Connecting a server (CC-249)

An MCP server author builds the server from the template and runs it anywhere, with any HTTPS certificate, a self-signed one, or `http` inside the
Docker network of the platform. The platform operator enters the address in the portal and approves. The gateway does the rest: it connects to the server (the server
connects to nothing of the platform except the public key set of the gateway), and there is no certificate of the internal CA for a server, no client certificate on
either side, no token to create, and no CI certificate. The server-facing interface is C14, `openapi/mcp-server.v1.yaml`; the admin side is C5 (`createServer`,
`approveServerConnection`, `refreshServer`) and C12.

1. **Add.** `POST /admin/v1/servers` with `{internalUrl, allowPlainHttp?, credential?, expectedSystem?}` (fresh MFA). In this order: the URL is checked (`400`); the host is resolved and every
   resolved address is checked, refusing loopback, link-local (`169.254.0.0/16` with `169.254.169.254`, `fe80::/10`), unspecified and multicast addresses, the cloud metadata addresses `100.100.100.200` and
   `192.0.0.192` (class `metadata`, also `fd00:ec2::254`), an IPv6 address that carries an IPv4 address (IPv4-mapped, IPv4-compatible, NAT64) being judged as that IPv4 address (a 6to4 address
   only when it embeds a metadata address), and a literal such as `127.1`, `2130706433` or `0xc00000c0` as the address it denotes (`422 address_refused`). The operator can refuse more with the
   gateway setting `MCP_SERVER_REFUSED_ADDRESSES`: a comma-separated list of IPs and CIDRs, for example `10.20.0.0/16,172.31.5.9`; a range also matches the IPv4 address inside an IPv4-mapped,
   IPv4-compatible or NAT64 address, and the refusal class is `refused_by_configuration`. `http`
   needs `allowPlainHttp` (`422 plain_http_not_allowed`); a TLS handshake is made without a client certificate, reading the leaf certificate (`422 tls_handshake_failed`); the
   manifest is pulled (`422 manifest_unreachable`, `422 manifest_invalid`); when the request names an `expectedSystem` and the manifest claims another system, `422 system_mismatch` (vector `server-connection/add-expected-system-mismatch`); `serverId` is `mcp-<system>` of the manifest (`422 system_reserved`, `409 server_exists`,
   `422 namespace_conflict`). Private addresses are allowed. **Check before each connection.** The gateway applies the address rule to every resolved address at add time and again before each connection it makes (probe, manifest pull, policy-data push, tool call), then connects with a standard HTTP client, which may try the resolved addresses in order; a refused address makes the server unreachable (`lastError: address_refused`). The rule alone does not stop DNS rebinding, TLS does: for `ca` the host name must match a certificate from a trusted CA, for `pinned` the certificate must be the pinned one, so a name that is moved to another address cannot present an acceptable certificate. `plain` exists only with the administrator's flag, for servers in the Docker network of the gateway, whose names Docker's internal DNS resolves; the short window between the check and the connection is accepted there. The `Host` header carries the name of `internalUrl`, and the self-signed certificate of a server needs no `Host` match on the server side. Vectors `address-refusal/`.
2. **Trust, chosen per server at approval.** `ca`: the chain leads to a CA in the server trust of the gateway (the default truststore of the JVM plus an optional PEM bundle in its
   configuration) AND the host of `internalUrl` matches (standard hostname verification); renewals need nothing. `pinned`: exactly one leaf certificate, by the SHA-256 of its DER encoding
   (`sha256:<64 lower-case hex>`, never the hash of the PEM text; vectors `certificate-fingerprint/`), no chain and no hostname check; another certificate makes the server unreachable
   (`certificate_changed`) and is recorded as `pendingConnection` for approval. `plain`: `http` only, with `allowPlainHttp`, shown with a warning. The proposal is `ca` when the certificate
   validates for the host, `pinned` otherwise, `plain` for `http`; the administrator may choose `pinned` instead of a proposed `ca`. `POST /admin/v1/servers/{serverId}/connection/approve`
   (fresh MFA) takes the `tlsMode` and the `fingerprint` that the administrator saw; another pending fingerprint is `409 connection_changed`. Vectors `server-connection/`.
3. **Everything is pending at first.** The server is created `pending_approval` with a pending connection, pending policies and pending tools, `READ_ONLY` ones included. A tool is listed and
   callable only when the connection AND the policies AND the tool are approved; until then `tool_disabled` (vector `server-connection/first-connection-all-tools-pending`).
4. **Refresh and the runtime loop.** `POST /admin/v1/servers/{serverId}/refresh` probes and pulls at once; the gateway does the same in a loop. "At most every 60 s" is an upper bound on how stale the manifest can be, not a fixed schedule: an unreachable server may be retried sooner (the gateway uses 5 s). A changed hash makes the
   entry pending, exactly like the pinning of a definition that changed outside a deployment (next section); an unreachable server is `status: unreachable` and its calls are
   `upstream_unavailable`.
5. **The server side (starter).** No client certificate is required on its port. `GET /.well-known/mcp-manifest` needs no token (it is open). Every other path except a minimal health check needs a valid internal JWT of the right purpose (`use`, section "MCP methods and
   JWT"); keys come from `MCP_GATEWAY_JWKS_URI` (`https://<domain>/.well-known/mcp-jwks.json`, public, served by the gateway through the public listener, `GET /.well-known/mcp-jwks.json` of C14).
   TLS: its own keystore or PEM, else a self-signed certificate generated once into a state directory and reused, or `MCP_PLAIN_HTTP=true`. The one-time `jti` store is in memory (bounded, TTL = the
   token `exp`); Redis only when several instances sit behind a balancer. These are settings of the starter, not part of the contract text of C14.

### Policy data gate (CC-237, CC-249)

The gateway pushes the policy data of a server to it (`POST /.well-known/mcp-policy-data`, body `PolicyData`: `revision`, `scopeMapping` reduced to the namespace of the server, `allowedClients`,
`overrides` for this server or all servers, `approvedPoliciesHash`) after every change of the revision and periodically (at most every 60 s). The server never fetches anything. It replaces its data
only with a strictly newer `revision` (equal or older: `200`, `accepted: false`; the gateway treats `accepted: false` with a revision above the one it pushed as a failed push). The token's `prv` is the revision of the body: a body with another `revision` is `400 invalid_request`. The data lives in memory, so a restarted server holds none. A `tools/call` is evaluated only through this gate
(`scripts/lib/policy-data-gate.mjs`, Java twin `PolicyDataGate` in `mcp-manifest`):

1. The server holds no data, or the `prv` of the token is greater than its `revision`: `409 {"error":"policy_data_stale","heldRevision":...,"requiredRevision":...}` before anything is executed.
   This wins over every other refusal: data that is behind decides nothing.
2. The data is current but nothing is approved for the server (`policies_not_approved`), its own `policiesHash` differs from `approvedPoliciesHash` (`policies_differ`), or an override does not validate against
   its composed schema (`overrides_invalid`): the answer is `upstream_unavailable` (C10), final.
3. Otherwise the call is evaluated.

On `409 policy_data_stale` the gateway pushes its current data and repeats the `tools/call` **once** with a new token (new `jti`; the first token is spent). If the second answer is again `409`, or the push
fails, the client gets `upstream_unavailable`; any other refusal is not retried and triggers no push. Vectors: `policy-data-gate/` (the rule), `policy-data-push/` (the replacement rule and the gateway sequence).

## Registry and definition pinning (CC-097, CC-133, CC-249)

For every tool the gateway keeps an approved definition (its fingerprint is `definitionHash`) and neither shows nor runs a tool
whose current definition differs. Rules:

1. **Where the manifest comes from and who pulls it (CC-249).** The gateway pulls the manifest from the server itself (`GET /.well-known/mcp-manifest`, C14)
   when an administrator adds the server, on a refresh and in a runtime loop (at most every 60 s as an upper bound on staleness; an unreachable server may be retried sooner, the gateway uses 5 s); nothing is written to the registry by a
   pipeline, and there is no certificate of a pipeline (`PUT /admin/v1/registry/servers/{serverId}` and its certificate are gone). The body is
   the C6 manifest that the starter builds from the code of the running server; the gateway recomputes every hash and applies the rules of
   "Manifest semantic rules" and `environment` (section "Production mode and dev mode") before it stores anything. A manifest that fails
   changes nothing. See "Connecting a server" for the connection (TLS trust, address rules) and its approval.
2. **What a pulled manifest approves: nothing.** A new or changed tool, a `READ_ONLY` one included, is `pending_approval` (`change` `new` or
   `changed`, `pendingVersion` = the manifest version, `source: manifest`) and waits for an administrator's `approve` (group
   `mcp-platform-admin`, hash equal to `pendingHash`); an entry with an unchanged `definitionHash` stays. The first connection of a server is
   therefore all pending: before CC-249 the review of a commit approved `READ_ONLY` tools, and no reviewed commit stands behind a pulled manifest.
   The group floor (CC-245, CC-246) is kept and set by approval, but it decides nothing on a pull, because everything that changes is pending.
   A tool that the manifest no longer has is removed. The `admin_change` audit with `definitionHash`: `definition_submitted` (waiting),
   `tool_removed`; an approval is `definition_approved` with the administrator's `sub` (`definition_registered` is no longer written). Vectors
   `registry-approval/pull-*`, `adapter-registry/*`, `server-connection/first-connection-*`.
3. **A change outside a deployment blocks the tool.** The gateway always builds the `tools/list` answer to a client from approved
   entries and does not pass on the server's. It keeps the last seen definition of every tool from the server's `tools/list` (the
   read is refreshed every TTL, configurable, **at most 60 s**) and compares it with the approved one on every client `tools/list`
   and before every `tools/call`; the window in which a changed server can still serve a call is therefore at most 60 s. A
   difference is `pending_approval` with `source: server` and `change: changed`: the definition comes from the server, while the
   gateway takes `risk`, `action` and `resourceRefs` from the approved entry (a runtime change does not alter them), computes
   `pendingHash` from them, and `pendingVersion` is the version from `initialize`, a value the server controls, which is why the
   administrator sees it together with `source`. The tool is then hidden in `tools/list` and a call gives the C10 `tool_disabled`
   (audit: `definition_changed`) until `approve`. An approved tool that the server does not return in `tools/list` is hidden the
   same way (fail-closed): it does not reach the client's `tools/list`, a call gives `tool_disabled`, and it comes back when the
   server returns it. Audit: on every rejected call (not once per read) `tool_call` or `policy_decision` with `deny` and the reason
   `tool_not_served` (likewise `definition_changed`), with the caller's `sub`. A failed read of the server's `tools/list`
   (unavailable) is evidence neither of a change nor of absence: the gateway keeps the last successful read, does not hide all
   tools and does not emit these reasons, and a call that needs a fresh read but gets an error is rejected as
   `upstream_unavailable` without calling the server (fail-closed). A tool that the server shows and that is not in the registry is
   ignored (it has no `risk` or `action`); `change: new` arises only from a pulled manifest.
   **Precedence (CC-162):** a `pending_approval` entry with `source: manifest` (left by a pull) is never replaced by a read from the
   server: a difference between the server and such an entry only blocks the tool and is logged, and the administrator approves
   the same entry from the manifest. An entry with `source: server` arises only where there is no `source: manifest` entry; a newer read
   with a different definition replaces the previous `server` entry (a new `pendingHash`, so an `approve` with the old hash is
   `409`); it disappears when the server again serves the approved definition; a pulled manifest replaces it: when it carries a different
   definition, a `manifest` entry arises, and when it carries a definition equal to the approved one, the `server` entry is removed (a
   server that keeps serving a different definition creates it again at the next read). The entry version is `pendingVersion` (for
   `manifest` the manifest version, for `server` the version the server reported).
4. **The risk floor (CC-167).** The floor is the highest risk ever reported for a tool (also in a pending entry and in removed
   entries); it does not drop when a tool is removed or added again. A pulled manifest with a tool of a risk lower than the floor **does not
   reject the manifest**: that one tool becomes `pending_approval` (`source: manifest`, `change` as in rule 2: `changed`, and `new` with
   `approvedInVersion: null` for a tool that was removed and added again; `riskLowered: true`), stays hidden and is refused as
   `tool_disabled`, and the rest of the manifest goes through under the usual rules. a manifest that fails is refused as a whole for the other rejections
   (a hash mismatch, the semantic manifest rules, `environment_mismatch`, `credential_type_mismatch`, a mismatch with the gateway
   configuration). An entry with `riskLowered` is approved only by an administrator (`mcp-platform-admin`, never a pulled manifest):
   `approve` with `acceptRiskLowering: true` (the BFF then requires fresh MFA, like registering the Authenticator: `401
   step_up_required` with `stepUpUrl`, the same window, and the gateway checks it on the token as well, CC-250; a plain `approve` is unchanged and the BFF sends the field only when it is
   `true`); the floor drops to the approved risk, and the audit is one `admin_change` event with the reason `risk_lowered_by_admin`
   (instead of `definition_approved`; the field `risk` carries the new risk). Without the flag, `approve` of such an entry is `422
   risk_lowered`; with the flag on an entry that lowers nothing, the field is ignored (`definition_approved`). `source: server`
   entries do not raise the floor (`risk` comes from the approved entry). Rule 4 wins over rule 2: even a return to a previously
   approved definition (for example a reverted commit after a mistaken report of a higher risk) is a report below the floor and
   waits for an administrator; the tool is hidden until the decision. The gateway accepts `approve` only from the CN `mcp-portal-bff`
   with an administrator token, and checks the fresh MFA for `acceptRiskLowering` itself (CC-250).
   **Hidden characters (CC-250).** `approve` refuses a definition whose names or texts hold a character of the forbidden set of the text
   hygiene rule: `422 manifest_rejected` without `reason`, the tool stays pending, the audit is `admin_change` with `hidden_characters`,
   outcome `denied`, `tool` and `definitionHash`.
5. **Residual risk accepted by the maintainers (2026-10-29).** A rename with a risk reduction in a single pulled manifest (a removed write
   tool and a new `READ_ONLY` tool in the same manifest) passes without `approve`: the gateway does not link them. Protection comes
   from the administrator who reads the pending entries (a removed tool and a new `READ_ONLY` one are both pending since CC-249, so the rename is seen) and from the starter's rules for `risk` and `action`.
6. `RegistryTool.change`, `approvedInVersion` and `PendingTool.pendingVersion` are informational (an administration view); a decision
   always binds `definitionHash`. There is no "reject" operation: a missing approval is a hidden tool (fail-closed).

### Foreign servers through an adapter (CC-193)

The adapter (`mcp-server-adapter`, the sidecar of a foreign MCP server) is a server like any other for the gateway (CC-249): it serves its manifest with
`source: adapter` at `GET /.well-known/mcp-manifest` and the gateway pulls it; there is no adapter channel, no `PUT /admin/v1/registry/adapters/{serverId}`
and no certificate of an adapter any more. Whether a server is served by an adapter is the `source` of its first manifest: the gateway stores it as the
flag `adapter` of the server when it is added, and the flag never changes. A later manifest whose `source` disagrees with the stored mode is refused like any
invalid manifest (`manifest_invalid`, `manifestReason: adapter_source_mismatch`) and changes nothing. (Before CC-249 the flag was given by the administrator and
a manifest could not set it; now the manifest sets it once, and the administrator sees `adapter: true` on the card, while the gateway still asks for the classification of
every tool, so a server that claims to be an adapter gains nothing.) The adapter has no business with the identity of administrators, so the pull carries neither `classifiedBy` nor
`classifiedAt` to it. A tool absent from the adapter manifest is removed together with the admin's classification; when it returns it is new
and needs a new classification (decision of 2026-11-03). A pull approves nothing: every new or changed tool is
`pending_approval` with `source: adapter`, also one that looks like a read, and an entry whose hash is unchanged keeps its
classification (vectors `adapter-registry/`). A difference found when reading the `tools/list` of a running server in adapter mode
gives a pending entry with `source: adapter` (never `server`), so `approve` requires a classification, and the previous one is not
silently applied. The hash of an adapter entry is always computed from the manifest entry, without `risk` and `action`, also when
the entry was enriched with the registry classification (a check of the held manifests at startup). A foreign server on any
system id is added the same way as a server built on the starter: the system in the broker (`putAdminSystem`) and the server in the
gateway (`createServer` with `adapter: true`), without a release of the contracts (since 7.0.0). The vectors in
`registry-approval/` cover `classification_required`, `classification_not_allowed`, lowering a classification and an
unclassified tool. Entries of such a manifest **have no** `risk` or `action` (the adapter does not classify; vectors
`invalid-adapter-risk-claimed`, `invalid-adapter-action-claimed`) and have empty `resourceRefs` (policies work at tool level).
The `definitionHash` of such an entry covers the definition, `resourceRefs`, `system` and `credential`, **without** `risk` and
`action` (the keys are absent from the flat object; vector `definition-hash/get-issue-adapter-without-classification`).
The entry gets `source: adapter` in the registry, is never approved automatically and, until approved, is hidden and refused as
`tool_disabled`. An administrator approves it with `approve` carrying `risk` and `action` (without them `422 manifest_rejected`,
`reason: classification_required`; for an entry that does not come from an adapter, `classification_not_allowed`). Since 6.3.0 the
adapter is read-only (CC-227): a `risk` other than `READ_ONLY` for an adapter entry is `422 classification_not_allowed` until the
contract gives the adapter a resource scope. A `UPDATE` or `DESTRUCTIVE` classification stored earlier (6.2.x) becomes invalid: at
startup the gateway moves such an entry to `pending_approval` (`source: adapter`, a new `pendingHash` = the stored hash, hidden,
`tool_disabled`). The invalidated classification stays as the floor (CC-167), so approving again as `READ_ONLY` is a lowering: it
requires `acceptRiskLowering` and the administrator's fresh MFA in the portal, with no exception, and the audit is
`risk_lowered_by_admin` (vectors `registry-approval/stored-update-classification-is-hidden`, `adapter-invalidated-update-*`,
`adapter-invalidated-destructive-*`). A classification is registry data outside the hash: the registry stores `risk`, `action`,
the administrator and the time (`classifiedBy`, `classifiedAt`), the catalog and Cedar take them from there, and the audit is
`admin_change` with `definition_approved`, the new `risk` and the new `action` (the event's `action` field tells a
classification from a plain approval). `risk` and `action` must fit each other (`read` only for `READ_ONLY`, `update` for
`UPDATE`, `delete` for `DESTRUCTIVE`, `admin` for `UPDATE` or `DESTRUCTIVE`), otherwise `422 classification_inconsistent`.
Lowering an earlier classification is subject to the risk floor and to `acceptRiskLowering` (CC-167). A change of a foreign tool's
definition changes the hash and the entry returns to pending; the previous classification is shown to the admin as a suggestion
and not applied. `annotations` of a foreign server are untrusted hints and are never read as risk. The adapter publishes closed
and bounded definitions (CC-078, CC-123) and checks arguments before passing a call on; the contract does not relax its
requirements for definitions.

### Kill switch (CC-194)

An administrator (`mcp-platform-admin`) disables a server or a single tool with `PUT` and `DELETE` on
`/admin/v1/registry/servers/{serverId}/kill-switch` and `/admin/v1/registry/servers/{serverId}/tools/{tool}/kill-switch` (C5); the
list of active ones is `GET /admin/v1/kill-switches`. In the portal: `PUT`/`DELETE` under `/api/v1/admin/...` (C12).
- **Effect:** a call gets `tool_disabled` (C10) with the audit reason `kill_switch`, the tool disappears from `tools/list` and the
  catalog (`disabled: true`, `disabledBy: kill_switch`), and a server switch disables all of the server's tools. A call accepted
  earlier is not interrupted; a pending `DESTRUCTIVE` confirmation of a disabled tool ends with `tool_disabled` when confirmed.
- **Order (CC-206):** the switch is tool state like any other (CC-178): it is checked after `mayCall` and after the address filter.
  A user who cannot call the tool, or whose filter cuts it out, gets `not_found_or_denied` (reasons `not_granted`, `filter_scope`),
  never `tool_disabled`, which would reveal that the tool exists. An unreadable switch store is `upstream_unavailable` for anyone
  who reaches this step. Vectors `kill-switch/call-user-without-access`, `call-outside-filter`,
  `endpoint-filter/call-state-kill-switch-*`.
- **Persistence:** the switch is stored in the registry database and survives a restart. It belongs to the address (server, tool),
  not to the manifest: a tool that disappears from the manifest keeps its switch (it is on the list and takes effect when the tool
  returns), and its `DELETE` is `204`; a `PUT` for a tool unknown to the registry is `404`. `approve`, a pulled manifest and
  a refresh do not lift it; only a `DELETE` of the same scope does (lifting a tool switch does not lift the server switch). No
  expiry.
- **Fail-closed:** a gateway that cannot read the switch state refuses the call (`upstream_unavailable`) and lists nothing; a write
  that failed is `503`, never `204`.
- **Propagation:** after a `204`, the effect on every instance comes no later than 5 s (a database write, invalidation over a shared
  channel, and an instance reads the state from a cache no older than 5 s and does not extend it when the read fails).
- **MFA:** enabling needs no fresh MFA (an incident does not wait for a second factor); lifting needs the administrator's fresh MFA in
  the portal and on the token the gateway gets (`401 step_up_required`, CC-250).
- **Audit:** `admin_change` with `kill_switch_set` and `kill_switch_cleared` (the administrator's sub; the `reason` text from the
  request stays in the registry and the portal, not in the event); refusals are `tool_call` deny with `reason: kill_switch`,
  `errorCode: tool_disabled`; the activity row `tool_disabled`.

System and server mean the same here (`mcp-<system>`). Vectors `kill-switch/`.

## Retention and offboarding (CC-134, CC-155)

- **Two layers.** The portal activity table (`/activity`, `/activity/calls`) is component configuration, 30 days by default (not a
  contract constant). The full C8 audit goes to stdout for the SIEM, where retention is 365 days (on the SIEM side, outside the
  platform). The activity of a departing user stays until the table's retention ends, as evidence; `purge` does not delete it.
- **Offboarding is three independent, idempotent calls**, in any order (recommended: IdP/IGA first, so that tokens stop being
  renewed): removing groups in the IdP/IGA, `POST /v1/admin/users/{sub}/purge` of the broker (C4) and `POST
  /admin/v1/users/{sub}/purge` of the gateway (C5), both with the `mcp-offboarding` certificate and no token. The broker removes
  connections and secrets (all versions), OAuth flows, the Authenticator registration and the lock row, and publishes
  `credential.invalidated`; the gateway removes pending confirmations, MCP sessions in Redis and the credential cache (in 4.x also
  links). Audit: `connection_change`/`user_purged`, `authenticator`/`authenticator_removed`.
- **Portal sessions** end through back-channel logout from the IdP (there is no separate endpoint), and an MCP client token expires
  after 60 minutes at most (C1). **A window accepted by the maintainers (2026-10-29):** after `purge` the `sub` is not blocked; a
  token issued earlier works until it expires, so for at most 60 minutes a departing user can still use a system that does not
  need their connection (the Service Desk service account). A `purge` repeated after logout is safe and recommended (an open OAuth
  flow could have created a connection after the first one).
- **Audit trail:** every `purge` call (broker and gateway) leaves one `admin_change` event with the reason `user_purged`, also when
  there was nothing to delete and for an unknown `sub` (the `204` response is the same); plus per-connection events.
- **Cleanup of unused connections.** After a period without use (broker configuration, 180 days by default) the broker removes the
  connection; the audit is `connection_change` with the reason `unused_cleanup`. Before that the portal marks them as expiring (no
  reminders).

## Rate limits (CC-135, CC-156)

The limit values are component configuration, not contract. The contract says only what the caller gets and what goes to the audit.

- **Dimensions in the gateway** (counters in Redis): per user, per pair (user, AI client) and per pair (user, tool). For
  `DESTRUCTIVE` tools a separate, lower limit can be set as per-tool configuration (the contract does not change).
- **`tools/call` over the limit:** the C10 tool result `rate_limited` with `retryAfterSeconds` (an integer, at least 1); the call
  does not reach the server or the broker. **Other MCP requests** (`initialize`, `tools/list`, ...): HTTP `429` with `Retry-After`
  (seconds, at least 1) and the body `{"error":"rate_limited","message":...,"retryAfterSeconds":n}`, without `WWW-Authenticate` (the
  client should wait, not log in again, as in CC-124). There are no `X-RateLimit-*` headers anywhere: the settings are not
  disclosed. Vectors: `gateway-authentication/rate-limited*.json`.
- **Audit:** `tool_call` (for `tools/call`) or `policy_decision` with `decision: deny`, `outcome: denied`, `errorCode:
  rate_limited` and the reason `rate_limited_user`, `rate_limited_client` or `rate_limited_tool` (the client does not learn which
  limit, the administrator does). The gateway may aggregate the excess as in CC-125. In `activity/calls` the row has the result
  `rate_limited` (filter group `denied`). The result of a row follows from the reason of the last event (CC-165): `rate_limited_*`
  -> `rate_limited`, `definition_changed` and `tool_not_served` -> `tool_disabled`, `exchange_denied` -> `denied_not_granted`, and
  for a `tool_call` with an `outcome` other than `ok` also `not_granted`, `filter_scope` (until 4.x `link_scope`), `policy_forbid`,
  `step_up_required` (previously such a row had the result `error`). The portal does not offer `request_access` on the basis of
  `result` alone: the C10 `access_denied` carries no `requiredEntitlements`.
- **Redis unavailable:** gateway limits are fail-closed. When the counter does not answer, `tools/call` gives the C10
  `upstream_unavailable`, and other MCP requests an HTTP `503` with the body `{"error":"upstream_unavailable","message":...}` (the
  C10 shape), `Retry-After` as in CC-124, no `WWW-Authenticate` and no `Set-Cookie` (CC-167); the gateway does not let traffic
  through without counting. Vector `gateway-authentication/rate-limit-store-unavailable`. Audit: the reason `upstream_unavailable`
  on the `tool_call`/`policy_decision` event.
- **Broker and BFF:** starting and finishing an OAuth flow in the broker (per `sub`), writing a token and Authenticator operations in
  the BFF (per user, `sub`, on each BFF instance; a new session or a new login does not start a new window, CC-255): `429
  rate_limited` with `Retry-After`. Authenticator registration: 10 starts per hour per `sub` by default
  (CC-151).

## Token-exchange credentials and the service account (CC-157, CC-158, CC-159)

Descriptions in `resolveCredential` (C4):

- **`token-exchange`** (OpenSearch): the gateway exchanges the user token (C1) for a token for the broker
  (`aud=mcp-credential-broker`, RFC 8693) and passes it as `subjectToken`; the broker exchanges it at the IdP for a token for the
  system (`aud` and scope from the system configuration) and returns `type: token-exchange`, `scheme: Bearer`, `expiresAt` always
  present (never `null`) and `cacheTtlSeconds` no greater than 60 and no longer than the time to `expiresAt`. Nothing is stored
  in secrets. An IdP refusal is `403 exchange_denied`, in C10 `access_denied` without `requiredEntitlements`, with the audit
  `credential_resolve` and the reason `exchange_denied`.
- **`service-account`** (Service Desk): the account key is in OpenBao (`secret/data/mcp/service-accounts/<system>`); `scheme`
  matches the system (also `Basic`), `expiresAt` matches the rotation or is `null`. The user has no connection, so `GET
  /v1/connections` does not return it.
- **`user-secret` as `Basic` (CC-222, CC-213, since 6.3.1).** A system that accepts `user-secret` as a login and password or a token
  (Jira and Confluence Cloud with an e-mail, an OpenSearch with its own accounts) has `userSecretScheme: Basic` in `GET
  /v1/systems`; C12 carries the same field in `CatalogCredential`, so the portal shows the login field exactly then.
  `PutSecretRequest.username` together with `secret` is one secret; without `username` for a `Basic` system, and with `username`
  for a `Bearer` system, the broker answers `400 invalid_request` (it does not try Bearer). `username` is `writeOnly`, never
  logged or returned (the connection shows `backendUser`); `resolve` returns `scheme: Basic` with `base64(login:secret)` (example
  `user_secret_basic`), and the decoded value is the login and password in plain text, so the `X-MCP-Credential` header must not
  reach logs. `deployment` (`dc`, `cloud`) is informational and does not decide on the login field.
- **A system with no broker configuration:** `422 system_not_configured` instead of `400`; the gateway answers the client with the
  C10 `internal_error` but logs a separate cause, and the `credential_resolve` audit has the reason `system_not_configured`
  (outcome `error`).
- **`context.credentialType` and the header `X-MCP-Credential-Type` (CC-166, CC-167).** A system's configuration is a **set** of
  allowed types (GitLab: `user-oauth` and `user-secret`, default type `user-oauth`); a system does not mix `service-account` with
  user types (**a norm, CC-168**: the gateway refuses to start with such a system configuration, a server refuses to start when
  `accepted-credential-types` mixes both kinds, and registering a manifest with such `acceptedTypes` is `422
  credential_type_mismatch`; vector `manifests/invalid-credential-types-mixed`). The header carries the type returned by the broker
  (for GitLab the type of the user's connection, for example `user-secret` for a PAT). The gateway refuses before using the
  credential when that type does not belong to the set from the system configuration (C10 `internal_error`, audit
  `credential_resolve` with the reason `credential_type_mismatch`). The server checks that the header belongs to the set of its
  allowed types (`accepted-credential-types`) **before** the Cedar evaluation, the grant probe and the resolvers, so that the
  credential is not used: for a request with `X-MCP-Credential`, a missing header, a value outside the four types or outside the
  set is a refusal (`internal_error` without details, audit `policy_decision`/`tool_call` with the reason
  `credential_type_mismatch`); a server with no configured type that receives a credential also refuses. Requests without a
  credential (`initialize`, `tools/list`, registry calls) are not checked. **`context.credentialType` in Cedar** is the system's
  default type from the configuration of the server in the registry, `credential.type` (on the server side: the first type of `accepted-credential-types`; there is no
  separate property): Cedar is evaluated before the broker is asked, so the type actually used is not known yet; the
  `credential-type.cedar` rules tell a service account from a user credential by this default type, and a system's set never
  combines both kinds. Vectors `credential-type-header/` (including GitLab with two types). The header has been in C3 from the
  start; the server rule is new.
- **A threat model assumption (maintainer decision of 2026-10-29).** Gateway -> server traffic is protected by TLS (the trust chosen by an administrator per server, CC-249) and a signed JWT
  (C2), and the gateway removes incoming `X-MCP-*`, so this is considered sufficient: the type header is not signed and there is no
  type claim in the JWT. The check protects against a configuration mismatch, not against an attacker on the path between the
  gateway and the server; that would need a separate decision (a type claim and a credential hash in the JWT).
- **Manifest versus the server in the registry:** at registration and at startup the gateway checks that the credential type the broker
  will be asked for the system is in the manifest's `credential.acceptedTypes`; otherwise `422 manifest_rejected` with the reason
  `credential_type_mismatch`. This applies to **every type in the system's set** (GitLab with `user-oauth` and `user-secret`
  needs both in `acceptedTypes`), not only the default. A held manifest that does not pass the check at startup is neither
  replaced nor removed: the server has `enabled: false`, its tools give `tool_disabled`, and the gateway logs the cause until a
  manifest that passes is registered. **Migration order:** the OpenSearch server (whose manifest declares `acceptedTypes:
  [user-secret]` today, while the gateway and broker configuration has `token-exchange`) must move to `acceptedTypes` containing
  `token-exchange` and be registered **before** gateway 4.0.0 starts; otherwise the server is disabled after startup.
- **The broker checks `subjectToken`:** `aud` equal to `mcp-credential-broker`, a valid `exp` and a `sub` equal to the `sub` of the
  internal JWT; otherwise `400 invalid_request` and the audit `subject_token_invalid`.

## Production mode and dev mode (CC-137, CC-138)

- **Definition.** Production mode is the default: a component that was not explicitly allowed behaves like production. Dev mode
  needs **two consents**: the `devstack` profile (the development stack) **and** an explicit setting (recommended name
  `allowTestKeys`). `allowTestKeys` alone without the `devstack` profile does not enable dev mode; neither does the profile
  without the setting.
- **Telling keys apart.** `test-` keys (the published vector keys) need only `allowTestKeys`: this is how component unit tests work
  without a stack (CC-044). `dev-` keys need dev mode, that is both consents; in vectors the field `devstackProfile` sits next to
  `allowTestKeys`.
- **`dev-` keys.** The CC-044 rule also covers keys whose `kid` starts with `dev-`: receivers (servers, broker, gateway) reject them with the reason `test_key_not_allowed` outside dev mode (`allowTestKeys` alone is not enough). The dev
  stack generates its own keys with this prefix; the list of fingerprints of published test keys is unchanged. Dev mode also enables the published test keys. Vectors
  (unpublished keys, not on the SPKI list, so only the prefix rejects them): `jwt/dev-kid-rejected-by-default`,
  `jwt/valid-dev-kid-in-dev-mode`, `jwt/dev-kid-rejected-without-devstack-profile`.
- **The manifest marker.** The optional `environment` (`production` | `dev`; missing means `production`, and the field does not enter
  `definitionHash`). A gateway in production mode rejects a manifest with `dev` (`422 manifest_rejected`, reason
  `environment_mismatch`). The check covers every manifest the gateway pulls and the manifests it holds at startup.

## Audit: requests without a valid token (CC-143, CC-152)

A receiver of requests without a correct token (a server through the starter, the broker, the gateway) may limit the number of
`authentication` events: a separate budget per reason for `missing_token` and `malformed`, with the excess counted only in the
counter `mcp_audit_authentication_suppressed_total{component,reason}` (a shared name). A request rejected with `400` or `413`
before JWT verification is reached (a bad format, too large) is not an `authentication` event but enters the request counter, so
as not to multiply reasons.

## Clarifications in 4.0.0

- **The manifest is created at startup or at build time** (CC-140): the starter generates it at build time
  (`target/mcp-manifest.json`) or builds it at startup from the server's `tools/list`, and serves it at `GET /.well-known/mcp-manifest`
  (C14, CC-249), where the gateway pulls it. No pipeline sends it to the registry any more (CC-133 is replaced by CC-249).
- **`gateway-authentication/` vectors** (CC-144): `resourcePath` is the route (`/s/mcp-jira`), and the resource metadata (RFC 9728)
  points at the endpoint address (`/s/mcp-jira/mcp`).
- **The confirmation state epoch marker** (CC-145): a write in the same store as the confirmation state, valid for 210 s after a
  loss. With several gateway instances, each treats a missing marker as a loss of state (the C11 description above).
- **A service account's "last use"** (CC-150): the portal computes it from `/activity/calls` rows with the result `ok` or `confirmed`
  (and `error` if the call reached the system); denials and expired confirmations do not count. No new field.
- **Classification** (CC-149), **the order of evaluation** and a single refusal text (CC-146), **an empty scope** (CC-147), **write
  policy examples** (CC-148), **server queries** (CC-160): `cedar/entity-builder.md`.

## Request correlation

Every request has one `requestId` (UUIDv7) from entry to audit: the gateway assigns it in `rid` and `X-Request-Id` (C2/C3), and the
BFF creates its own and sends it in `X-Request-Id` to the broker and the gateway (CC-047). The broker returns the identifier it used in
the `X-Request-Id` header of every response. The BFF returns it to the browser in `X-Request-Id` on every one of its own `/api/v1/*`
responses (CC-087) and ignores a value sent by the client; 502/504 responses generated by the proxy itself do not have it, so the UI
must handle that.

## mcp-manifest (definitionHash and manifest rules)

`pl.aiwcorpo.mcp:mcp-manifest` (CC-063, only jackson-databind, an API on JSON strings): `CanonicalJson.canonicalize(json)` (RFC
8785), `DefinitionHash.compute(definition, entry, system, credential)`, `DefinitionHash.ofManifestTool(manifest, tool)`,
`PoliciesHash.of(policiesJson)` (the `policiesHash` of a manifest, 7.0.0), `ManifestRules.violations(manifest)` (rule codes as in
the section "Manifest semantic rules"). Validation of the manifest against the JSON Schema is done separately, before the rules.

## Client generation

Generators take the files from `openapi/bundled/`. Verified: openapi-generator **7.26.0**, the `java` generator with the `native`
library (C4, C5: it generates and compiles) and `typescript-angular` (C12). The generator prints `ERROR ... Unknown type mutualTLS`
for the mTLS security scheme; this does not stop generation, and mTLS is configured in the HTTP client (the client certificate), not
in the generated code. The allowed client certificate CNs for each C4 and C5 operation are in the extension `x-allowed-client-cn`
(a different CN -> 403).

Java (gateway, broker, BFF): unpack `mcp-contracts/openapi/bundled/**` from the `mcp-contracts` jar with `maven-dependency-plugin`
(goal `unpack`, phase `initialize`) and point `openapi-generator-maven-plugin` 7.26.0 at the unpacked file, for example
`<inputSpec>${project.build.directory}/contracts/mcp-contracts/openapi/bundled/credential-broker.v1.bundled.yaml</inputSpec>` with
`<generatorName>java</generatorName>`, `<library>native</library>` and `<configOptions><useJakartaEe>true</useJakartaEe></configOptions>`.
For Spring Boot 4 `<library>restclient</library>` can be used; that variant was not verified. Servers (the broker, gateway admin)
can generate server interfaces with the `spring` generator (`interfaceOnly=true`) from the same files. Without Maven:

```bash
docker run --rm -v "$PWD:/local" openapitools/openapi-generator-cli:v7.26.0 generate \
  -i /local/openapi/bundled/gateway-admin.v1.bundled.yaml -g java --library native -o /local/out/gateway-admin-client
```

TypeScript / Angular (portal): the Angular client comes from `portal-bff.v1.bundled.yaml` with the `typescript-angular` generator:

```bash
docker run --rm -v "$PWD:/local" openapitools/openapi-generator-cli:v7.26.0 generate \
  -i /local/node_modules/@aiwcorpo/mcp-contracts/openapi/bundled/portal-bff.v1.bundled.yaml \
  -g typescript-angular -o /local/src/app/api
```

or `npx @openapitools/openapi-generator-cli generate ...` with the same arguments (it needs Java). CSRF (C12, CC-055): the BFF sets the
cookie `__Host-XSRF-TOKEN` (Secure, Path=/, no Domain), and Angular sends it back in the `X-XSRF-TOKEN` header for POST/PUT/DELETE once
`provideHttpClient(withXsrfConfiguration({cookieName: '__Host-XSRF-TOKEN', headerName: 'X-XSRF-TOKEN'}))` is configured, provided that
requests go to the same origin, so the client's `basePath` must be empty or relative. The `csrf` fields in `Configuration.credentials`
of the generated client do not need to be set.

The types alone (without Angular) are in the npm package, generated by openapi-typescript and json-schema-to-typescript:

```ts
import type { components } from '@aiwcorpo/mcp-contracts/types/portal-bff';
import type { InternalJWTClaimsC2 } from '@aiwcorpo/mcp-contracts/types/schemas/internal-jwt';
type Catalog = components['schemas']['PortalCatalog'];
```

## Mocks

The mocks answer with the examples from the OpenAPI (every example is validated against the schema in `npm test`). By default the
first success example is returned; another one is selected with the header `Prefer: example=<example name>` (names as in `examples`
in the YAML, for example `credential_required`, `flow_invalid`, `hash_mismatch`, `step_up_required`).

### WireMock (C4, C5)

```bash
docker run --rm -p 8081:8080 -v "$PWD/mocks/wiremock/credential-broker:/home/wiremock:ro" wiremock/wiremock:3.13.2
docker run --rm -p 8082:8080 -v "$PWD/mocks/wiremock/gateway-admin:/home/wiremock:ro" wiremock/wiremock:3.13.2

curl -X POST localhost:8081/v1/credentials/resolve -H 'Authorization: Bearer x' -d '{"system":"jira"}'
curl -X POST localhost:8081/v1/credentials/resolve -H 'Authorization: Bearer x' -H 'Prefer: example=credential_required' -d '{}'
```

Operations that require a Bearer token give `401 {"error":"unauthenticated"}` without an `Authorization` header. The mock checks
neither mTLS nor the token contents. In JUnit (WireMock 3) the stubs can be taken from the jar:
`WireMockConfiguration.options().usingFilesUnderClasspath("mcp-contracts/mocks/wiremock/credential-broker")`. `npm run
smoke:wiremock` starts both mocks in Docker and checks a few responses.

### MSW (C12)

```ts
import { setupWorker } from 'msw/browser';
import { createPortalBffHandlers } from '@aiwcorpo/mcp-contracts/msw';

await setupWorker(...createPortalBffHandlers()).start();
```

In Node tests: `setupServer(...createPortalBffHandlers({ baseUrl: 'http://localhost' }))` from `msw/node`. On POST/PUT/DELETE the
handlers require an `X-XSRF-TOKEN` header equal to the `__Host-XSRF-TOKEN` cookie (otherwise 403 `csrf_invalid`), and an unknown
`{system}` gives 400 (CC-054); `GET /api/v1/me` sets that cookie. `GET /api/v1/auth/login` answers 302 to the test IdP, and `POST
/api/v1/auth/logout` 204. To turn the check off: `createPortalBffHandlers({ enforceCsrf: false })`. A single response for
`server.use(...)` is given by `portalBffExample('getPortalCatalog', 'mixed')`. Requires `msw` ^3 (a peer dependency).

## Test vectors

| Directory | Count | What it checks |
| --- | --- | --- |
| `jwt/` | 75 | the C2 receiver: 23 valid (one of them the manifest without a token), 52 rejections, 9 of them about the purpose `use` (`purpose-*`: a call token at the policy-data endpoint and the reverse, a policy-data token at the MCP endpoint, `use: manifest` as an unknown value, a missing or unknown `use`, `jti` replay, wrong audience) (signature, `kid`, test key and a `kid` with the `dev-` prefix (CC-137), `alg`, `iss`, `aud`, `exp` with skew, `iat`, lifetime, `jti`, the service variant, presence and match of `tool`, `rid` != `X-Request-Id`, claims `vs`/`vsc` rejected as `invalid_claims` (CC-173), an IdP token, MCP 2026-07-28 methods, the service variant outside the list, broker `authenticator` calls with `tool`) |
| `manifests/` | 110 | the C6 manifest: schema (including the required `title`), semantic rules, a closed and bounded `inputSchema`, a recomputed `definitionHash` |
| `definition-hash/` | 13 | `definitionHash` (RFC 8785 + SHA-256), CC-004, CC-042 |
| `audit-events/` | 140 | C8 events, including the ban on arguments, secrets, codes, seed and `otpauthUri`, control and bidi characters, rejected authentication (CC-071, CC-125), `authenticator`, the `filter` field (CC-174), and the removed `virtualServer` and `virtual_server_change` as rejected |
| `tool-errors/` | 33 | every C10 code plus rejected cases (two shapes of `confirmation_required`, `confirmation_superseded`, `confirmation_blocked`, `confirmation_cancelled`) |
| `policies-hash/` | 5 | `policiesHash` of `policies` and `resourceTypes` of a manifest (RFC 8785 + SHA-256, CC-232) |
| `policy-data-gate/` | 10 | the rule that binds a server to approved policies and current policy data, with `policy_data_stale` for a server that is behind (CC-237, CC-249) |
| `policy-data-push/` | 11 | the replacement rule of a push and the gateway sequence: push and one repeat, no third attempt, a refusal that is not retried (CC-249) |
| `address-refusal/` | 70 | loopback, link-local, `169.254.169.254`, unspecified, multicast and limited broadcast in IPv4 and IPv6, the metadata addresses fd00:ec2::254, 100.100.100.200 and 192.0.0.192 (also in 6to4 and as inet_aton literals), configured refusals (`MCP_SERVER_REFUSED_ADDRESSES`), and behind IPv4-mapped, IPv4-compatible and NAT64 forms, URL literals, every resolved address, check before each connection (CC-249) |
| `server-connection/` | 24 | first connection with every tool pending (`READ_ONLY` too), tool availability, `ca` renewal versus `pinned` change, approval of a connection (CC-249) |
| `certificate-fingerprint/` | 12 | SHA-256 over the DER of real certificates (`sha256:<lower-case hex>`), PEM re-wrapping, wrong inputs, the format (CC-249); random keys, `scripts/generate-certificate-vectors.mjs` is not part of `generate:vectors` |
| `fixtures/` | - | not vectors: the neutral Notes fragment (`notes/`: schema, `resource-types.json`, policies) and the scope mappings that the Cedar vectors run on; the Jira fragment is `cedar/examples/systems/jira` |
| `return-paths/` | 35 | `returnPath` of C4/C12 (CC-032); since 3.0.0 without the prefixes `/api`, `/s`, `/v`, `/.well-known`, since 5.0.0 also `/mcp` (CC-169; `/f/` is free) and without `.`/`..` segments and the semicolon, which servers read as a path parameter (CC-099) |
| `entity-builder/` | 54 | builder input (with the declarations and the scope mapping) -> Cedar entities and context, errors included (CC-233) |
| `policy-decisions/` | 44 | Cedar decisions: gateway vectors on `cedar/platform` and the example overrides, server vectors on the fragments of Jira and Notes, including the scope hierarchy and credential type |
| `result-filter/` | 5 | result filtering and query limiting (CC-036) |
| `resource-checks/` | 5 | every value of every `resourceRef` evaluated (CC-061) |
| `resource-ids/` | 14 | `idPattern` and `scopePattern` of the declarations, including the former built-in systems (CC-056, CC-074) |
| `untrusted-text/` | 8 | the shape of `UntrustedText` (CC-072) |
| `confirmation-binding/` | 77 | first call and retry with a code: the pending call, one `DESTRUCTIVE` operation, mapping of the broker result (CC-091, CC-126, CC-127) |
| `totp/` | 46 | the broker Authenticator: RFC 6238, the window, one-time use of a step, the 5/15 min block, the daily limit, registration, the `otpauth` URI (CC-092, CC-126); the seed comes from RFC 6238, NOT FOR PRODUCTION |
| `text-hygiene/` | 79 | the forbidden set in arguments, identifiers and mention filters, and replacement in system text (CC-121, CC-122) |
| `activity-calls/` | 57 | `ActivityCall` and aggregating the events of one call into a row (CC-095) |
| `gateway-authentication-decision/` | 12 | choosing the reason and the 401/503 status from the key copy state, `kid` and refresh (CC-124) |
| `activity-cursor/` | 9 | the `/activity/calls` cursor: HMAC, binding to `sub`, 15 min validity (CC-095); a test key, NOT FOR PRODUCTION |
| `gateway-authentication/` | 21 | 401 with `resource_metadata` (also for `/mcp` with a filter and without a query in the challenge, CC-171), 503 without `WWW-Authenticate` and with `Retry-After` (CC-124), or 429 with `Retry-After` and the body `rate_limited` (CC-156) |
| `catalog-actions/` | 19 | portal catalog actions per status, including `request_access` without `requiredEntitlements` and `view_request` with a pending request (CC-083, CC-113) |
| `query-rendering/` | 26 | server queries from a structure: JQL and CQL with hostile values, the OpenSearch index pattern and name resolution (CC-160) |
| `credential-type-header/` | 13 | the `X-MCP-Credential-Type` header versus server configuration: match, mismatch, missing, unknown value (CC-166) |
| `endpoint-filter/` | 119 | the `/mcp` query filter (CC-170, CC-172, CC-178, CC-184): syntax and normalization, the `/s/` route, the visible set (also a risk outside the set), `tools/call` under a filter and with tool, server and account state, session binding and the order of checks, the `400` body; Java runs `parse`, `route`, `apply`, `call`, `session` |
| `endpoint-aggregate/` | 79 | the `/mcp` list as an intersection, order, routing by prefix, server availability and the time limit (CC-180), pages and the `tools/list` cursor (CC-181), `list_changed`, `/v/` as `404` (CC-169, CC-177) |
| `mcp-endpoint/` | 18 | the BFF answer `GET /api/v1/me/mcp-endpoint`: the address, `clientConfigs`, `toolCount`, `400`, a query composed from decoded values (CC-175, CC-182) |
| `kill-switch/` | 18 | the kill switch: the `tool_disabled` refusal with the reason `kill_switch`, the list, confirmation, fail-closed on unreadable state, `approve` and `PUT` do not lift it, lifting per scope (CC-194) |
| `balancer-errors/` | 3 | the balancer's `502` after an instance dies mid-request, the constant text about an unknown result (CC-204) |
| `adapter-registry/` | 9 | what a pulled manifest leaves in the registry: adapter mode derived from `source`, pending with `source: manifest` or `adapter`, a source that disagrees, a read at runtime (CC-206, CC-249) |
| `registry-approval/` | 28 | `approve` with an adapter tool classification, `classification_required`, `classification_not_allowed`, lowering (CC-193, CC-206); `pull-*`: what a pulled manifest does with one tool, nothing approved, a `READ_ONLY` one included (CC-249) |
| `idp-token-claims/` | 8 | IdP token claims: `vs` and `vsc` ignored, not copied into the internal JWT (CC-201) |
| `oauth-metadata/` | 6 | the protected resource metadata document: `resource` without a query, a query ignored, `/v/` as `404` (CC-171, CC-187) |

Formats:

- **JWT:** `token`, the decoded `header`/`claims` (informational), `verifier` (`issuer`, `audience`, `jwks` - a path relative to
  `test-vectors/`, `now` - a clock to inject, `clockSkewSeconds`, `maxLifetimeSeconds`, `seenJtis` - the state of the `jti`
  store, `receiverMode` - optional, `adapter` (the adapter sidecar), `native` (a native server) or `broker`; a missing field means
  "not a sidecar", CC-226), `request` (the JSON-RPC method and `toolName`, or an HTTP request), `expected` (`valid`,
  `httpStatus`, `reason`). An implementation must agree on `valid`/`httpStatus`; `reason` names the injected defect and helps
  with diagnosis.
- **Cedar vectors (7.0.0):** `resourceTypes` (a list of files with the declarations), `scopeMapping` (a file), `input`, `expected`;
  decisions also `policies` (`schema`: a fragment schema file or `null`, `policies`: directories with `.cedar` files); described in
  `cedar/entity-builder.md`, section 10.
- **The rest:** `description`, input data and `expected`; described in `cedar/entity-builder.md` (Cedar) and in the tests
  `test/*.test.mjs`, which are also the reference verifiers.

## Identifiers in `common.schema.json` (CC-079, CC-229)

`SystemId` (`^[a-z][a-z0-9]{1,30}$`), `ServerId` (`^mcp-<SystemId>$`), `QualifiedToolName` (`<system>__<tool>`) and `ResourceType`
(`^[A-Z][A-Za-z0-9]{0,30}::[A-Z][A-Za-z0-9]{0,30}$`, the namespace is the Cedar namespace of the server) are patterns, not
enumerations; the four credential types stay an enumeration because they are protocol, not a list of systems. Until 6.3.2 this
file also held the id patterns of the five systems (`JiraProjectKey` ... `ServiceDeskTicketId`, `ResourceIdPatterns`) for the
`@ArgumentLimits(contractPattern = ...)` of the starter; they are gone, and a server takes the pattern of an argument from its own
`resourceTypes[].idPattern`. `test/schemas.test.mjs` checks that no enumeration in the file names a system.

## Manifest semantic rules

Beyond the JSON Schema (`scripts/lib/manifest-rules.mjs`, CC-018), checked by the gateway at registration:

1. `serverId == "mcp-" + system`.
2. Tool names are unique within the manifest.
3. Every `resourceRefs[].type` and `resourceTypes[].parent` is declared in `resourceTypes`, and the types in `resourceTypes` do not
   repeat.
4. `definition.name == name` and `definition.inputSchema` does not declare `confirmation_code` (CC-005).
5. `definitionHash` recomputed from `definition` (with `title`, CC-042), `risk`, `action`, `resourceRefs`, `system` and `credential`
   (`scripts/lib/definition-hash.mjs`, CC-004) equals the declared one.
6. Every `resourceRefs[].argument` exists in `definition.inputSchema.properties` and has the type `string`, `integer` or `array` with
   `items` of type `string`/`integer` (CC-043).
7. `definition.title` is required (the schema, CC-115).
8. `inputSchema` is closed and bounded (CC-078, CC-123), rules `input-schema-closed`, `input-schema-bounded`,
   `input-schema-no-combinators`: the root has `type: object`, every object has `additionalProperties: false` (no open maps,
   `patternProperties`, `unevaluatedProperties`); every node has a `type`; every `string` has `maxLength` (unless `enum`/`const`),
   every array has `maxItems` and `items` (also with `prefixItems`), every `integer`/`number` has `minimum` and `maximum` (unless
   `enum`/`const`), every `pattern` starts with `^`, ends with an unescaped `$` and has no alternation outside a group (`^a|b$` is
   not anchored); no `allOf`, `anyOf`, `oneOf`, `not`, `if`, `then`, `else`. When the schema is violated, the server answers
   `invalid_argument` (C10): the message may name an argument declared in the schema and the rule, never the value or an undeclared
   name.
9. `credential.acceptedTypes` contains either `service-account` alone or user types alone (`user-oauth`, `user-secret`,
   `token-exchange`); mixing is the rule `credential-types-not-mixed` (CC-168), and at registration `422 manifest_rejected` with
   the reason `credential_type_mismatch`.
10. Every declaration in `resourceTypes` is consistent (`resource-types-valid`): `parent` is declared in the same namespace and goes
    with `parentAttribute`, which is not in `attributes` and not `scopes`; `earlyScopeCheck` needs a `scopePattern`; the
    `classification` attribute is one of `attributes`; `idPattern` and `scopePattern` are anchored (`^...$`, no top-level
    alternation) and compile. All types are in one namespace, equal to `policies.namespace` (`resource-types-namespace`, CC-232).
11. `policies.files` has unique names in ascending order (`policies-files-sorted-unique`) and `policiesHash` recomputed from
    `policies` and `resourceTypes` (RFC 8785 + SHA-256, `scripts/lib/definition-hash.mjs` `policiesHash`) equals the declared one
    (`policies-hash-matches`). The schema requires `policies` and `policiesHash` together, for every manifest that is not an
    adapter's, and forbids them (and `resourceTypes` entries) in an adapter manifest.

## Requirements for receivers

- C2 receivers reject keys with the identifier `test-*` and `dev-*` by default; `test-*` is enabled by an
  explicit setting (recommended name `allowTestKeys`) in tests and dev (CC-044), `dev-*` only by dev mode: the `devstack` profile
  and that setting together (CC-137). C2 receivers recognize the published test keys also by SPKI hash
  (`PublishedTestKeys`, `security/published-test-keys.json`), regardless of the identifier in configuration, for the keys from
  `test-vectors/keys/test-gateway-jwks.json`. The vectors have `allowTestKeys: true` and separate rejection cases.
- Servers with search and list tools limit the query and filter the results (CC-036, `cedar/entity-builder.md` section 11).
- A server validates its policy fragment at build and at start, and the gateway at registration, with the same rules
  (`PolicyFragments.validateFragment`).

## Releasing

Per release (a maintainer):

1. Version exactly `X.Y.Z` in the poms, `package.json` and OpenAPI `info.version`; entry in `CONTRACT_CHANGES.md` with status
   `accepted`; `./scripts/verify-all.sh` green (it runs `./mvnw clean verify`, `npm test` including `scripts/check-npm-package.mjs`,
   and `scripts/check-jar-contents.mjs`: the jars must contain exactly the files of the source tree).
2. `./mvnw -Prelease -Dgpg.skip verify` builds the sources and javadoc jars Central requires (javadoc without errors; the
   module `mcp-contracts` has no Java API, its javadoc jar is a pointer to this README).
3. Commit `Release X.Y.Z`, tag `vX.Y.Z`, and push only that one tag (`git push origin vX.Y.Z`, never `git push --tags`: old
   local tags would start releases). The repository must be public by then: npm provenance does not work for a private
   repository, and the workflow stops at its first step otherwise. `.github/workflows/release.yml` then runs:
   - `build` (read-only, no cache): verification, `npm pack`, jars with sources and javadoc, CycloneDX SBOMs.
   - `publish-maven` (environment `release`, needs approval): checks the exact file list of the artifact, the `package.json`
     of the npm tarball and the npm client, signs the Maven files with GPG (every signature is verified against the fingerprint
     in the repository variable `GPG_FINGERPRINT`), uploads one bundle to the Central Portal as `USER_MANAGED` and waits for
     `VALIDATED`. If the version is already on Central, the upload is skipped. No build tool runs in this job.
   - `publish-npm` (environment `release-npm`, needs approval): `npm publish --provenance`; skipped when the version is
     already on npmjs.org.
4. Open https://central.sonatype.com/publishing/deployments, look at the deployment and press **Publish** (or **Drop**).
   Publishing is the one step that cannot be undone, so it stays manual. It appears on Central within minutes to an hour.
   Only after that does the reviewer of `release-npm` approve `publish-npm`, so the npm package never appears for a
   release that was dropped.
5. Re-running a failed workflow is safe. One exception: a deployment that is `VALIDATED` but neither published nor dropped
   is not visible to the workflow, so drop it in the Portal before re-running, or the upload creates a second one.

Without CI, from a maintainer's machine: put the Portal user token in `~/.m2/settings.xml` as server `central`, export
`MAVEN_GPG_PASSPHRASE` (or use gpg-agent) and run `./mvnw -Prelease deploy`. `central.autoPublish` defaults to `false`;
`-Dcentral.autoPublish=true` publishes without the manual step and is meant for a release that was already validated once.
`npm run pack` makes a local tarball in `release/` (git-ignored); it is not what CI publishes.

One-time setup (a human):

1. Account on https://central.sonatype.com and the namespace `pl.aiwcorpo`: the Portal shows a verification key; add it as a
   DNS TXT record on `aiwcorpo.pl` (exactly that host) and press Verify. Requires control of the domain.
2. Portal user token (Account, Generate User Token): repository secrets `MAVEN_CENTRAL_USERNAME` and `MAVEN_CENTRAL_TOKEN`.
3. GPG key dedicated to releases (`gpg --quick-generate-key "aiwcorpo releases" ed25519 sign 2y`; with a passphrase). Publish the
   public key: `gpg --keyserver keyserver.ubuntu.com --send-keys <fingerprint>`. keys.openpgp.org publishes a key only with a
   confirmed e-mail address of a user ID, so use it only if the key has an organisational address as its UID; otherwise leave
   that keyserver out. Secrets `GPG_PRIVATE_KEY` (`gpg --armor --export-secret-keys <fingerprint>`) and `GPG_PASSPHRASE`, and the
   repository variable `GPG_FINGERPRINT` (the workflow refuses a key with another fingerprint). Keep an offline copy of the key
   and its revocation certificate, and add the fingerprint to `SECURITY.md`.
4. Put the four Maven secrets in the GitHub environment `release` (not repository-wide). In both environments (`release` and
   `release-npm`): required reviewers other than the person who pushes the tag, the option **Prevent self-review**, and a
   deployment rule that allows only tags `v*`. In Settings, Rules, add a tag ruleset for `v*` that blocks deletion and
   updates, so a released tag cannot be moved.
5. npm: create the organization `aiwcorpo` on npmjs.org (free for public packages; check that the name is available) and turn on 2FA for it.
   The first version cannot use trusted publishing, because the trusted publisher is configured on an existing package: either put a
   granular access token (read and write, package scope `@aiwcorpo`, short expiry, with **Bypass two-factor authentication**
   ticked: a token without it is rejected for publishing on an account with 2FA) in the secret `NPM_TOKEN` of the environment
   `release-npm` for the first release, or publish the first tarball by hand with `npm publish --provenance=false --access public` from a machine with 2FA.
   Then, on the package page, Settings, Trusted Publisher: GitHub Actions, organization `aiwcorpo`, repository `mcp-contracts`,
   workflow `release.yml`, environment `release-npm`; delete `NPM_TOKEN`.

## Local validation and CI

```bash
./scripts/verify-all.sh     # npm test + ./mvnw verify; SMOKE_WIREMOCK=1 adds the mock test in Docker
```

- `npm test`: Spectral (`.spectral.yaml`, including example validation), the `dist/` build, Node tests: schema compilation (ajv,
  strict, 2020-12), OpenAPI examples, JWT/manifest/hash/audit/error vectors, consistency of generated files (bundled
  OpenAPI, WireMock, MSW, builder vectors), MSW.
- `./mvnw verify` (Java 25): the Cedar base schema in strict mode, the platform policies, the example fragments and overrides
  (cedar-java 4.10.0, the `uber` classifier with a native library for macOS/Linux x86_64 and aarch64), the entity builder, decision
  and result filter vectors run by `mcp-cedar-entities` (with entity validation against the composed schema and a second pass
  without `forbid`), the validation of fragments and overrides, the manifest rules and hashes in `mcp-manifest`, and building the jars.

CI: releases are built and published by GitHub Actions (`.github/workflows/release.yml`). Everyday checks run in **GitLab CI**
(`.gitlab-ci.yml`), because the company repositories and the GitLab MCP server are on GitLab; the jobs are `node`, `java`,
`wiremock-smoke` (Docker-in-Docker) and, on a tag, `package-jar` and `package-npm`. Images in CI: `node:24.18.0-bookworm`,
`maven:3.9.12-eclipse-temurin-25`, `docker:28.3.2`.

## Generators

| Script | What it does |
| --- | --- |
| `npm run generate` | `openapi/bundled/` and the mocks from the OpenAPI |
| `npm run generate:vectors` | deterministic vectors: manifests, hashes, audit, errors |
| `npm run generate:cedar` | builder, decision, result filter, resource check and id vectors (`scripts/lib/entity-builder.mjs`) |
| `scripts/generate-jwt-vectors.mjs` | JWT vectors (ES256 signatures are random: running it changes every token) |
| `scripts/generate-test-keys.mjs` | test keys; refuses to overwrite |

After changing the OpenAPI, run `npm run generate`; after changing the example fragments (`cedar/examples/systems/jira`,
`test-vectors/fixtures/notes`), run `npm run generate:vectors` (the manifests carry them) and `npm run generate:cedar`.
