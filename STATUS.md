# Status ws-00 (mcp-contracts)

## Zrobione

- Kamień 1: szkielet repo, build Maven (jar z zasobami + jar `test-vectors`), npm, wrapper Maven.
- Schemat Cedar `cedar/mcp.cedarschema` i polityki przykładowe; walidacja strict przez cedar-java 4.10.0
  (klasyfikator `uber` z natywną biblioteką dla darwin-arm64 i linux-x86_64).
- Kamień 2: OpenAPI 3.1 dla C4, C5, C12 (`openapi/`), wersje jednoplikowe dla generatorów
  (`openapi/bundled/`), JSON Schema 2020-12 (`schemas/`), lint Spectral i walidacja przykładów przez ajv.
  Sprawdzone ręcznie: openapi-generator 7.26.0 `typescript-angular` (BFF) i `java` (C4, C5) generują
  i kompilują klientów z plików `bundled`.
- Uwzględniona zmiana planu z 21:58: CSRF w C12 wg konwencji Angulara (`XSRF-TOKEN` / `X-XSRF-TOKEN`),
  CC-020 oznaczone jako `resolved`.
- Kamień 3: testowe klucze (`test-vectors/keys`, NOT FOR PRODUCTION), wektory JWT (28, podpisane ES256),
  manifestów, `definitionHash` (RFC 8785), zdarzeń audytu, błędów C10, paczek polityk (podpisy Ed25519,
  rollback, overrides) i `latest.json`; referencyjne weryfikatory w `test/*.test.mjs`.
- Poprawka po przeglądzie bezpieczeństwa: wzorce `url`/`sigUrl` w `policy-bundle-latest.schema.json`
  zakotwiczone i ograniczone do nazw plików w tym samym katalogu; reguły spójności rewizji (CC-026)
  i negatywne wektory `bundles/latest-*.json`.
- Kamień 4: specyfikacja entity buildera (`cedar/entity-builder.md`), 15 wektorów buildera, 38 wektorów
  decyzji Cedar (gateway i serwer, wszystkie przypadki z DoD); dwie niezależne implementacje buildera
  (JS generuje wektory, Java w testach je wykonuje) i ocena decyzji przez cedar-java z walidacją żądania
  względem schematu.

## Odstępstwa od briefu

- Brak.

## Otwarte pytania

- Patrz `CONTRACT_CHANGES.md`.
