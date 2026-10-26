# Status ws-00 (mcp-contracts)

Wersja **1.1.0**, tag `v1.1.0` (poprzednio `v1.0.0`). Zmiany: `CHANGELOG.md`.

Walidacja: `./scripts/verify-all.sh` zielony (`npm test` 70 testów, `./mvnw verify` w obu modułach, łącznie
195 testów JUnit), `npm run smoke:wiremock` zielony lokalnie (porty 28081/28082, bo 18081 zajmuje
`mcp-platform-dev`).

## Zrobione w 1.1.0

- Decyzje człowieka z 2026-10-26: CC-001 ... CC-026 `accepted` i wdrożone, w tym CC-005 (definicja MCP w
  manifeście), CC-010 (`stepUpUrl`), CC-015 (`expiresAt`), CC-019 (moduł `mcp-cedar-entities`), CC-023
  (`/api/v1/auth/login`, `/api/v1/auth/logout`).
- Przegląd 1.0.0: nowe CC-027 ... CC-034 `accepted` i wdrożone (claim `vsc`, paczka `overrides`, wszystkie
  typy zawężalne w politykach przykładowych, wariant serwisowy dla `GET /v1/systems`, audyt, `returnPath`,
  wariant użytkownika dla metod protokołu, MFA przy podglądzie potwierdzenia) oraz poprawki bez zmiany
  kontraktu (`x-allowed-client-cn` + reguła Spectral, `no-store`, odbiorca paczek w Javie z parserem Cedar,
  walidacja `risk`, walidacja encji wektorów decyzji, drugi przebieg bez `forbid`, nowe wektory JWT).
- Przegląd bezpieczeństwa commitów: `returnPath` bez `%`, `resource.id` bez C1/U+2028/U+2029.
- Build Maven wielomodułowy: rodzic `mcp-contracts-parent`, moduły `java/mcp-contracts` (współrzędne jarów
  bez zmian) i `java/mcp-cedar-entities`.
- Pozycja ws-01 (tożsamość TLS brokera i gateway'a) przenumerowana na CC-035, status `open`, treść bez zmian.

## Odstępstwa od briefu

- Encja grup użytkownika w Cedar nazywa się `UserGroup` (CC-001, zaakceptowane).
- Walidacja Cedar przez cedar-java w JUnit zamiast `cedar validate` (decyzja koordynatora).
- Klucze testowe w Mavenie tylko w jarze `test-vectors`; paczka npm je zawiera.
- Pliki ponad listę briefu: `schemas/common.schema.json`, `policy-bundle-latest.schema.json`,
  `credential-invalidated-event.schema.json`, `openapi/bundled/`, `spectral-functions/`, katalogi wektorów
  `definition-hash/`, `tool-errors/`, `bundles/`, `entity-builder/`, `return-paths/`, moduł
  `mcp-cedar-entities`.
- Tarball npm w `release/` (w repozytorium).

## Niedokończone / niesprawdzone

- Pipeline GitLab CI nieuruchomiony na runnerze; joby `node` i `java` sprawdzone w tych samych obrazach w
  1.0.0, w 1.1.0 tylko lokalnie (`verify-all.sh`).
- Generator `java`/`restclient` i serwerowy `spring` niesprawdzone.
- Test paczek polityk w Node nie jest referencyjny (tylko schematy JSON); referencja to
  `PolicyBundleVectorTest` w Javie.
- Wektory JWT nie są deterministyczne (losowe podpisy ES256).

## Otwarte pytania

- CC-035 (zgłoszenie ws-01): tożsamość TLS/SAN brokera i wewnętrznego endpointu gateway'a.
