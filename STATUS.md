# Status ws-00 (mcp-contracts)

Wersja **1.2.0**, tag `v1.2.0` (poprzednio `v1.1.0`, `v1.0.0`). Zmiany i lista niezgodności: `CHANGELOG.md`.

Walidacja: `./scripts/verify-all.sh` zielony (`npm test`, `./mvnw verify` w trzech modułach),
`npm run smoke:wiremock` zielony lokalnie. Testy modułów Java przechodzą także z jackson-databind 2.21.4
(wersja zarządzana przez Spring Boot 4.1.0).

## Zrobione w 1.2.0

- Decyzje człowieka z 2026-10-27: CC-036 ... CC-045 `accepted` i wdrożone; CC-035 `rejected`.
  - CC-036: obowiązek serwera przy wyszukiwaniu i listach, `ResultFilter`, `queryConstraint`, wektory.
  - CC-037: zakresy zasobów jako dane w `entities/static.json`, `ResourceScope`, hierarchia GitLab, drzewa
    stron Confluence, prefiksy OpenSearch; przykład `cedar/examples/static-entities.json`.
  - CC-038 (`tool` tylko dla `tools/call`/`resolve`), CC-039 (API `mcp-cedar-entities` + poprawki L4),
    CC-040 (overrides walidowane schematem głównym), CC-041 (lint `vsScopes`), CC-042 (`title`, bez
    `icons`/`_meta`), CC-043 (argument `resourceRefs` w `inputSchema`), CC-044 (klucze `test-*`), CC-045 (moduł
    `mcp-policy-bundle` z utwardzonym tar).
- Przegląd 1.1.0: wszystkie LOW (L1 ... L9) i M1 (sekcje niezgodności w CHANGELOG, wyjątek SemVer w README).
- Zgłoszenia ws-06 przenumerowane na CC-046, CC-047, status `open`, treść bez zmian.

## Odstępstwa od briefu

- Encja grup użytkownika w Cedar nazywa się `UserGroup` (CC-001).
- Walidacja Cedar przez cedar-java w JUnit zamiast `cedar validate` (decyzja koordynatora).
- Klucze testowe w Mavenie tylko w jarze `test-vectors`; paczka npm je zawiera.
- Pliki ponad listę briefu: `schemas/common.schema.json`, `policy-bundle-latest.schema.json`,
  `credential-invalidated-event.schema.json`, `openapi/bundled/`, `spectral-functions/`,
  `cedar/examples/static-entities.json`, katalogi wektorów `definition-hash/`, `tool-errors/`, `bundles/`,
  `entity-builder/`, `return-paths/`, `result-filter/`, moduły `mcp-cedar-entities` i `mcp-policy-bundle`.
- Tarball npm w `release/` (w repozytorium).

## Niedokończone / niesprawdzone

- Pipeline GitLab CI nieuruchomiony na runnerze (lokalnie `verify-all.sh`).
- Generator `java`/`restclient` i serwerowy `spring` niesprawdzone.
- Test paczek w Node nie jest referencyjny (tylko schematy JSON); referencja to `mcp-policy-bundle`.
- Wektory JWT niedeterministyczne (losowe podpisy ES256).
- Reguły manifestu (CC-018, CC-043) są tylko w JS (`scripts/lib/manifest-rules.mjs`); w Javie nie ma
  implementacji reguł manifestu, gateway (ws-05) musi je zaimplementować wg README i wektorów.

## Otwarte pytania

- CC-046 (ws-06): `credential.invalidated` także po zastąpieniu sekretu.
- CC-047 (ws-06): `X-Request-Id` w wywołaniach BFF -> broker.
