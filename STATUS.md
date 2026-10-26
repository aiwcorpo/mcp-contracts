# Status ws-00 (mcp-contracts)

Wersja **1.0.0**, tag `v1.0.0`. Wszystkie pliki z listy briefu istnieją i przechodzą walidację
(`./scripts/verify-all.sh`: `npm test` 55 testów, `./mvnw verify` 76 testów, oba zielone; dodatkowo
`npm run smoke:wiremock` zielony lokalnie w Dockerze).

## Zrobione

- Kamień 1: szkielet repo, build Maven (jar z zasobami + jar `test-vectors`), npm, wrapper Maven.
  Schemat Cedar `cedar/mcp.cedarschema` i polityki przykładowe; walidacja strict przez cedar-java 4.10.0
  (klasyfikator `uber` z natywną biblioteką dla darwin-arm64, linux-x86_64 i linux-aarch64). Tryb strict
  jest potwierdzony testem negatywnym (`CedarSchemaTest.validatorRunsInStrictMode`), bo cedar-java nie
  wystawia przełącznika trybu.
- Kamień 2: OpenAPI 3.1 dla C4, C5, C12 (`openapi/`), wersje jednoplikowe dla generatorów
  (`openapi/bundled/`), JSON Schema 2020-12 (`schemas/`), lint Spectral i walidacja przykładów przez ajv.
  Sprawdzone ręcznie: openapi-generator 7.26.0 `typescript-angular` (BFF) i `java` (C4, C5) generują
  i kompilują klientów z plików `bundled`.
- Zmiana planu z 21:58 (koordynator): CSRF w C12 wg konwencji Angulara (`XSRF-TOKEN` / `X-XSRF-TOKEN`,
  SameSite=Strict) w `portal-bff.v1.yaml` i MSW; CC-020 `resolved`; README opisuje klienta
  `typescript-angular` (D13).
- Kamień 3: testowe klucze (`test-vectors/keys`, NOT FOR PRODUCTION), wektory JWT (28, podpisane ES256),
  manifestów, `definitionHash` (RFC 8785), zdarzeń audytu, błędów C10, paczek polityk (podpisy Ed25519,
  rollback, overrides) i `latest.json`; referencyjne weryfikatory w `test/*.test.mjs`.
- Poprawka po przeglądzie bezpieczeństwa: wzorce `url`/`sigUrl` w `policy-bundle-latest.schema.json`
  zakotwiczone i ograniczone do nazw plików w tym samym katalogu; reguły spójności rewizji (CC-026)
  i negatywne wektory `bundles/latest-*.json` oraz `bundles/renamed-old-bundle.json`.
- Kamień 4: specyfikacja entity buildera (`cedar/entity-builder.md`), 15 wektorów buildera, 38 wektorów
  decyzji Cedar (gateway i serwer, wszystkie przypadki z DoD); dwie niezależne implementacje buildera
  (JS generuje wektory, Java w testach je wykonuje) i ocena decyzji przez cedar-java z walidacją żądania
  względem schematu.
- Kamień 5: stuby WireMock 3 dla C4 i C5 (`mocks/wiremock/`, wybór przykładu nagłówkiem
  `Prefer: example=<nazwa>`, 401 bez tokenu Bearer), handlery MSW dla C12 (`mocks/msw/`, egzekwują
  `X-XSRF-TOKEN` == cookie `XSRF-TOKEN`); wszystko generowane z przykładów OpenAPI, test pilnuje zgodności.
- Kamień 6: `./mvnw install` (jar i jar `test-vectors` w `~/.m2`), `release/aiwcorpo-mcp-contracts-1.0.0.tgz`
  (`npm pack`, sprawdzone instalacją w osobnym projekcie i `tsc`), tag `v1.0.0`.
- Kamień 7: `.gitlab-ci.yml` i `scripts/verify-all.sh`. Joby `node` i `java` uruchomione lokalnie w tych
  samych obrazach Dockera co w CI (zielone).

## Odstępstwa od briefu

- Encja grup użytkownika w Cedar nazywa się `UserGroup`, nie `Group` (Cedar 4 odrzuca `Group` obok
  `GitLab::Group`), CC-001.
- Walidacja Cedar przez cedar-java w JUnit zamiast `cedar validate` (decyzja koordynatora).
- Dwa jary zamiast jednego: klucze i wektory w jarze z klasyfikatorem `test-vectors`.
- Pliki ponad listę briefu: `schemas/common.schema.json`, `schemas/policy-bundle-latest.schema.json`,
  `schemas/credential-invalidated-event.schema.json`, `openapi/bundled/`, katalogi wektorów
  `definition-hash/`, `tool-errors/`, `bundles/`, `entity-builder/`, specyfikacja `cedar/entity-builder.md`.
- Tarball npm leży w `release/` (w repozytorium), nie w `dist/` (`dist/` jest wynikiem budowy, ignorowany).

## Niedokończone / niesprawdzone

- Pipeline GitLab CI nie był uruchomiony na prawdziwym runnerze (repo nie ma zdalnego GitLaba). Joby
  `node` i `java` sprawdzone w tych samych obrazach lokalnie; job `wiremock-smoke` (Docker-in-Docker,
  podmiana `localhost` na `docker`) nie był uruchomiony.
- Generator `java` z biblioteką `restclient` (Spring Boot 4) i generator serwerowy `spring` nie były
  sprawdzane; sprawdzone tylko `java`/`native` i `typescript-angular`.
- Wektory JWT nie są deterministyczne (losowe podpisy ES256); ponowne wygenerowanie zmienia tokeny.

## Otwarte pytania

Wszystkie w `CONTRACT_CHANGES.md` (CC-001 ... CC-026, CC-020 rozstrzygnięte).
