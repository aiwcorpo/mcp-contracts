# Status ws-00 (mcp-contracts)

Ostatnie wydanie **1.2.0** (tag `v1.2.0`). W przygotowaniu **2.0.0** (bez tagu, zawiera niewydane 1.2.1):
CC-046 ... CC-053 i CC-056 wdrożone, poprawki z przeglądu 1.2.0 (M4, L1 ... L7, M3); czeka na decyzje człowieka
w pozostałych punktach przeglądu (H3, H4, M1, M2, M5, M6, M7). Zmiany i zgodność: `CHANGELOG.md`.

Walidacja: `./scripts/verify-all.sh` zielony (`npm test`, `./mvnw verify` w trzech modułach),
`npm run smoke:wiremock` zielony lokalnie. Testy modułów Java przechodzą także z jackson-databind 2.21.4
(wersja zarządzana przez Spring Boot 4.1.0).

## Zrobione w 2.0.0 (bez tagu)

- CC-056: wzorce identyfikatorów per system (schematy, `ResourceDefaults`, `vsc`, buildery JS i Java,
  `ResourceIds`, mapowanie zakresów), obowiązki serwera przy zapytaniach, `QueryConstraint.virtualServerType`,
  `ResultFilter.cedarAuthorizer`; wektory `resource-ids/`, nowe `result-filter/` (GitLab, Confluence, service
  desk, brak zakresów) i negatywne z przeglądu.
- Przegląd 1.2.0: M3 (README bez wyjątku SemVer), M4 (klucze testowe po SPKI), L1 ... L7; CHANGELOG z listą
  niezgodności względem 1.1.0 i wpływem na konsumentów.
- Zgłoszenia ws-07 i ws-09 ponumerowane: CC-054, CC-055, CC-057, CC-058 (`open`).

## Zrobione wcześniej w ramach 1.2.1 (wchodzi w 2.0.0)

- CC-046 (`credential.invalidated` po zastąpieniu poświadczenia), CC-047 (`X-Request-Id` w C4, także w stubach
  WireMock), CC-048 (`returnPath` w `stepUpUrl`), CC-049 (tylko token w `PutSecretRequest`), CC-050 (503 w 14
  operacjach C12), CC-051 (kody `loginError`, wektory `login-redirects/`), CC-052 (port C13 z `Requester`,
  README), CC-053 (`Me.mfaFreshUntil`, MSW).
- `release/` trzyma tarballe wszystkich wydań; `scripts/pack-release.mjs` nie nadpisuje tarballi wydanych wersji.

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

- CC-054, CC-055 (ws-07), CC-057, CC-058 (ws-09).
- Punkty przeglądu 1.2.0 czekające na decyzję: H3 (przypięcie schematu i encji statycznych paczki), H4 (ocena
  każdego zasobu z każdego `resourceRef`), M1 (magazyn paczek w module), M2 (`context.virtualServer` w `permit`,
  pokrywa się z CC-058), M5 (`Restricted` przy braku `category`), M6 (rollback po restarcie), M7 (reguły manifestu
  i `definitionHash` w Javie).
