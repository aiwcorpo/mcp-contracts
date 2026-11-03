# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through GitHub: Security tab of this repository, "Report a vulnerability"
(private vulnerability reporting). Do not open a public issue for a security problem.

Include the affected version (`package.json` / `pom.xml`), the file or contract involved (for example an
OpenAPI operation, a schema, a Cedar rule or a test vector), and steps to reproduce.

## Scope

This repository holds contracts and test data, not a running service. In scope: a contract that permits an
insecure implementation (an authorization gap in a Cedar schema, a schema that accepts a malformed token, an
OpenAPI operation without the required authentication), and defects in the Java modules (`mcp-cedar-entities`,
`mcp-policy-bundle`, `mcp-manifest`).

Out of scope: the private keys in `test-vectors/keys/` (files named `*NOT-FOR-PRODUCTION*`). They are published on
purpose, sign test vectors only, and are on the list of rejected keys in `security/published-test-keys.json`. A
production deployment that accepts one of them is a misconfiguration of that deployment.

## Supported versions

Only the latest released version receives fixes. Published versions are immutable; a fix ships as a new
patch or minor release (see "Wersjonowanie" in the README).
