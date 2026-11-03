# Contributing

The contracts are frozen: a change to `openapi/`, `schemas/`, `cedar/` or `test-vectors/` starts as a
`proposed` entry in `CONTRACT_CHANGES.md` and needs approval before it is implemented. Packaging, tooling,
documentation and test-only fixes do not need an entry.

## Setup

Node 24 (`.nvmrc`) and JDK 25. Windows through WSL2.

```bash
npm ci
./scripts/verify-all.sh     # npm test, ./mvnw clean verify, jar contents check
```

`./scripts/verify-all.sh` must pass before a merge. Generated files (`openapi/bundled/`, `mocks/`, some vectors)
come from `npm run generate*`; do not edit them by hand, the drift tests fail otherwise.

## Commits

Subject in English, imperative, up to 72 characters. The body describes the change, not the process.
SemVer rules and the release steps are in the README ("Wersjonowanie", "Wydanie").

## License

Contributions are licensed under Apache-2.0 (see `LICENSE`).
