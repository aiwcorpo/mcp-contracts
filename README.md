# mcp-contracts

Maszynowa wersja kontraktów platformy MCP z `01-contracts.md`: OpenAPI 3.1, JSON Schema 2020-12,
schemat Cedar, specyfikacja entity buildera, testowe klucze, wektory testowe i mocki. Inne repozytoria
generują z tego klientów, mocki i testy kontraktowe. Wersja **1.0.0**, tag `v1.0.0`.

Kontrakty są zamrożone: zmiany zgłasza się w [`CONTRACT_CHANGES.md`](CONTRACT_CHANGES.md), zatwierdza
człowiek. Tam też są wszystkie miejsca, w których `01-contracts.md` był nieprecyzyjny, z wariantem
przyjętym w 1.0.0.

## Co jest gdzie

| Kontrakt | Plik |
| --- | --- |
| C2 wewnętrzny JWT | `schemas/internal-jwt.schema.json`, wektory `test-vectors/jwt/` |
| C4 Credential Broker | `openapi/credential-broker.v1.yaml`, zdarzenie C4.3 `schemas/credential-invalidated-event.schema.json` |
| C5 Gateway admin | `openapi/gateway-admin.v1.yaml` |
| C6 manifest serwera | `schemas/server-manifest.schema.json`, wektory `test-vectors/manifests/`, `test-vectors/definition-hash/` |
| C7 paczka polityk | `schemas/policy-bundle-manifest.schema.json`, `schemas/policy-bundle-latest.schema.json`, wektory `test-vectors/bundles/` |
| C7 model Cedar | `cedar/mcp.cedarschema`, `cedar/examples/*.cedar`, `cedar/entity-builder.md` |
| C8 audyt | `schemas/audit-event.schema.json`, wektory `test-vectors/audit-events/` |
| C9 grupy | `cedar/entity-builder.md` (parsowanie), `schemas/common.schema.json#/$defs/GroupName` |
| C10 błędy narzędzi | `schemas/tool-error.schema.json`, wektory `test-vectors/tool-errors/` |
| C12 Portal BFF | `openapi/portal-bff.v1.yaml` |

Wspólne typy (identyfikatory systemów, `requestId`, rewizja polityk, kody C10) są w
`schemas/common.schema.json`; specyfikacje OpenAPI odwołują się do schematów JSON, więc każdy typ jest
zdefiniowany raz. `openapi/bundled/*.bundled.yaml` to wersje jednoplikowe (generowane, nie edytować) dla
generatorów kodu.

```
mcp-contracts/
├── openapi/                 # C4, C5, C12 + bundled/ dla generatorów
├── schemas/                 # JSON Schema 2020-12 (bez $id: odwołania względne do plików)
├── cedar/                   # schemat, polityki przykładowe, specyfikacja entity buildera
├── test-vectors/
│   ├── keys/                # KLUCZE TESTOWE, NOT FOR PRODUCTION
│   ├── jwt/  manifests/  definition-hash/  audit-events/  tool-errors/  bundles/
│   ├── entity-builder/      # wejście buildera -> encje i kontekst Cedar
│   └── policy-decisions/    # żądanie Cedar -> decyzja i polityki rozstrzygające
├── mocks/wiremock/          # stuby C4 i C5 (generowane)
├── mocks/msw/               # handlery MSW dla C12 (TS)
├── scripts/                 # generatory i verify-all.sh
├── test/                    # testy Node (lint, schematy, wektory, mocki)
└── src/test/java/           # testy JUnit: Cedar (cedar-java), referencyjny entity builder
```

## Wersjonowanie (SemVer)

Wersja dotyczy całego repozytorium naraz: jar, paczka npm i tag git mają ten sam numer.

| Zmiana | Wersja | Przykład |
| --- | --- | --- |
| usunięcie lub zmiana nazwy pola, endpointu, wartości enum; nowa wartość enum (np. nowy system: zmienia też schemat Cedar); zaostrzenie walidacji; zmiana schematu Cedar, po której istniejące polityki lub encje przestają przechodzić walidację; zmiana oczekiwania w istniejącym wektorze | **major** | `2.0.0` |
| nowe pole opcjonalne w odpowiedzi lub żądaniu, nowy endpoint, nowe wektory | **minor** | `1.1.0` |
| poprawka opisu, literówki, nowy przykład zgodny ze schematem | **patch** | `1.0.1` |

Każde wydanie: wpis w `CONTRACT_CHANGES.md` ze statusem `accepted`, podbicie wersji w `pom.xml`,
`package.json` i polach `info.version`, tag `vX.Y.Z`. Paczka polityk wskazuje wersję kontraktów w
`manifest.json.schemaVersion`.

## Artefakty

| Artefakt | Zawartość | Użycie |
| --- | --- | --- |
| `pl.aiwcorpo.mcp:mcp-contracts:1.0.0` (jar) | `openapi/`, `schemas/`, `cedar/`, `mocks/wiremock/` pod prefiksem classpath `mcp-contracts/` | może być w runtime (np. schemat Cedar, walidacja manifestu) |
| `pl.aiwcorpo.mcp:mcp-contracts:1.0.0:test-vectors` (jar, klasyfikator) | `test-vectors/` łącznie z kluczami testowymi, pod `mcp-contracts/test-vectors/` | **tylko** `<scope>test</scope>` |
| `release/aiwcorpo-mcp-contracts-1.0.0.tgz` (npm, `@aiwcorpo/mcp-contracts`) | wszystko powyżej + typy TS (`dist/types`) + handlery MSW (`dist/msw`) | `npm install ../mcp-contracts/release/aiwcorpo-mcp-contracts-1.0.0.tgz` |

W Mavenie klucze testowe są tylko w jarze `test-vectors`, żeby komponent produkcyjny nie mógł przypadkiem
załadować testowego JWKS z classpath. Paczka npm zawiera `test-vectors/` (w tym klucze) i jest
przeznaczona do `devDependencies`; nie jest publikowana do rejestru (`"private": true`).

Instalacja lokalna:

```bash
./mvnw install          # ~/.m2/repository/pl/aiwcorpo/mcp/mcp-contracts/1.0.0/
npm ci && npm run pack  # release/aiwcorpo-mcp-contracts-1.0.0.tgz
```

```xml
<dependency>
  <groupId>pl.aiwcorpo.mcp</groupId>
  <artifactId>mcp-contracts</artifactId>
  <version>1.0.0</version>
</dependency>
<dependency>
  <groupId>pl.aiwcorpo.mcp</groupId>
  <artifactId>mcp-contracts</artifactId>
  <version>1.0.0</version>
  <classifier>test-vectors</classifier>
  <scope>test</scope>
</dependency>
```

Odczyt z classpath: `getResource("/mcp-contracts/cedar/mcp.cedarschema")`,
`/mcp-contracts/test-vectors/jwt/valid.json` itd.

## Generowanie klienta

Generatory dostają pliki z `openapi/bundled/`. Sprawdzone: openapi-generator **7.26.0**, generator `java`
z biblioteką `native` (C4, C5: generuje i kompiluje się) oraz `typescript-angular` (C12). Generator wypisuje
`ERROR ... Unknown type mutualTLS` dla schematu bezpieczeństwa mTLS; to nie przerywa generowania, mTLS
konfiguruje się w kliencie HTTP (certyfikat klienta), nie w wygenerowanym kodzie.

### Java (gateway, broker, BFF)

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-dependency-plugin</artifactId>
  <executions>
    <execution>
      <id>unpack-contracts</id>
      <phase>initialize</phase>
      <goals><goal>unpack</goal></goals>
      <configuration>
        <artifactItems>
          <artifactItem>
            <groupId>pl.aiwcorpo.mcp</groupId>
            <artifactId>mcp-contracts</artifactId>
            <version>1.0.0</version>
            <includes>mcp-contracts/openapi/bundled/**</includes>
          </artifactItem>
        </artifactItems>
        <outputDirectory>${project.build.directory}/contracts</outputDirectory>
      </configuration>
    </execution>
  </executions>
</plugin>
<plugin>
  <groupId>org.openapitools</groupId>
  <artifactId>openapi-generator-maven-plugin</artifactId>
  <version>7.26.0</version>
  <executions>
    <execution>
      <id>credential-broker-client</id>
      <goals><goal>generate</goal></goals>
      <configuration>
        <inputSpec>${project.build.directory}/contracts/mcp-contracts/openapi/bundled/credential-broker.v1.bundled.yaml</inputSpec>
        <generatorName>java</generatorName>
        <library>native</library>
        <apiPackage>pl.aiwcorpo.mcp.gateway.broker.client.api</apiPackage>
        <modelPackage>pl.aiwcorpo.mcp.gateway.broker.client.model</modelPackage>
        <configOptions><useJakartaEe>true</useJakartaEe></configOptions>
      </configuration>
    </execution>
  </executions>
</plugin>
```

Dla Spring Boot 4 można użyć `<library>restclient</library>`; ten wariant nie był sprawdzany w ws-00.
Serwery (broker, gateway admin) mogą generować interfejsy serwerowe generatorem `spring`
(`interfaceOnly=true`) z tych samych plików.

Bez Mavena (Docker):

```bash
docker run --rm -v "$PWD:/local" openapitools/openapi-generator-cli:v7.26.0 generate \
  -i /local/openapi/bundled/gateway-admin.v1.bundled.yaml -g java --library native -o /local/out/gateway-admin-client
```

### TypeScript / Angular (portal, ws-08)

Klient Angulara (decyzja D13) z `portal-bff.v1.bundled.yaml`, generator `typescript-angular`:

```bash
docker run --rm -v "$PWD:/local" openapitools/openapi-generator-cli:v7.26.0 generate \
  -i /local/node_modules/@aiwcorpo/mcp-contracts/openapi/bundled/portal-bff.v1.bundled.yaml \
  -g typescript-angular -o /local/src/app/api
```

albo `npx @openapitools/openapi-generator-cli generate ...` z tymi samymi argumentami (wymaga Javy).
CSRF (C12): BFF ustawia ciasteczko `XSRF-TOKEN`, Angular `HttpClient` sam odsyła je w nagłówku
`X-XSRF-TOKEN` dla POST/PUT/DELETE pod warunkiem, że żądania idą na ten sam origin, czyli `basePath`
klienta ma być pusty lub względny. Pola `csrf` w `Configuration.credentials` wygenerowanego klienta nie
trzeba ustawiać.

Same typy (bez Angulara) są w paczce npm, wygenerowane przez openapi-typescript i
json-schema-to-typescript:

```ts
import type { components } from '@aiwcorpo/mcp-contracts/types/portal-bff';
import type { InternalJWTClaimsC2 } from '@aiwcorpo/mcp-contracts/types/schemas/internal-jwt';
type Catalog = components['schemas']['PortalCatalog'];
```

## Mocki

Mocki odpowiadają przykładami z OpenAPI (każdy przykład przechodzi walidację schematem w `npm test`).
Domyślnie zwracany jest pierwszy przykład sukcesu; inny wybiera się nagłówkiem
`Prefer: example=<nazwa przykładu>` (nazwy jak w `examples` w YAML, np. `credential_required`,
`identity_mismatch`, `hash_mismatch`, `step_up_required`).

### WireMock (C4, C5)

```bash
docker run --rm -p 8081:8080 -v "$PWD/mocks/wiremock/credential-broker:/home/wiremock:ro" wiremock/wiremock:3.13.2
docker run --rm -p 8082:8080 -v "$PWD/mocks/wiremock/gateway-admin:/home/wiremock:ro" wiremock/wiremock:3.13.2

curl -X POST localhost:8081/v1/credentials/resolve -H 'Authorization: Bearer x' -d '{"system":"jira"}'
curl -X POST localhost:8081/v1/credentials/resolve -H 'Authorization: Bearer x' -H 'Prefer: example=credential_required' -d '{}'
```

Operacje wymagające tokenu Bearer dają `401 {"error":"unauthenticated"}` bez nagłówka `Authorization`.
Mock nie sprawdza mTLS ani treści tokenu. W JUnit (WireMock 3) można wskazać stuby z jara:
`WireMockConfiguration.options().usingFilesUnderClasspath("mcp-contracts/mocks/wiremock/credential-broker")`.
`npm run smoke:wiremock` uruchamia oba mocki w Dockerze i sprawdza kilka odpowiedzi.

### MSW (C12)

```ts
import { setupWorker } from 'msw/browser';
import { createPortalBffHandlers } from '@aiwcorpo/mcp-contracts/msw';

await setupWorker(...createPortalBffHandlers()).start();
```

W testach Node: `setupServer(...createPortalBffHandlers({ baseUrl: 'http://localhost' }))` z `msw/node`.
Handlery wymagają na POST/PUT/DELETE nagłówka `X-XSRF-TOKEN` równego ciasteczku `XSRF-TOKEN`
(403 `csrf_invalid` inaczej); `GET /api/v1/me` ustawia to ciasteczko. Wyłączenie:
`createPortalBffHandlers({ enforceCsrf: false })`. Pojedynczą odpowiedź do `server.use(...)` daje
`portalBffExample('getPortalCatalog', 'mixed')`. Wymagane `msw` ^3 (peer dependency).

## Wektory testowe

| Katalog | Liczba | Co sprawdza |
| --- | --- | --- |
| `jwt/` | 28 | odbiorca C2: 9 poprawnych, 19 odrzuceń (podpis, `kid`, `alg`, `iss`, `aud`, `exp` ze skew, `iat`, czas życia, `jti`, wariant serwisowy, `tool` != `params.name`, token IdP) |
| `manifests/` | 14 | manifest C6: schemat i reguły semantyczne |
| `definition-hash/` | 10 | `definitionHash` (RFC 8785 + SHA-256), CC-004 |
| `audit-events/` | 14 | zdarzenia C8, w tym zakaz argumentów, sekretów i kodów |
| `tool-errors/` | 18 | każdy kod C10 + przypadki odrzucane |
| `bundles/` | 16 | paczki C7: podpis Ed25519, rollback, `overrides`, `latest.json` (CC-026) |
| `entity-builder/` | 15 | wejście buildera -> encje i kontekst Cedar |
| `policy-decisions/` | 38 | decyzje Cedar na politykach z `cedar/examples` |

Formaty:

- **JWT:** `token`, zdekodowane `header`/`claims` (informacyjnie), `verifier` (`issuer`, `audience`,
  `jwks` - ścieżka względem `test-vectors/`, `now` - zegar do wstrzyknięcia, `clockSkewSeconds`,
  `maxLifetimeSeconds`, `seenJtis` - stan magazynu `jti`), `request` (metoda JSON-RPC i `toolName` albo
  żądanie HTTP), `expected` (`valid`, `httpStatus`, `reason`). Implementacja musi zgodzić się co do
  `valid`/`httpStatus`; `reason` nazywa wstrzyknięty defekt i pomaga w diagnozie.
- **Paczki:** `latest` (treść `latest.json`), `bundle`/`signature` (pliki w `bundles/files/`),
  `publicKey`, `channel` (`main`/`overrides`), `loadedRevision`, `expected` (`accept`, `reason`).
- **Pozostałe:** `description`, dane wejściowe i `expected`; opis w `cedar/entity-builder.md` (Cedar) i
  w testach `test/*.test.mjs`, które są też referencyjnymi weryfikatorami.

## Reguły semantyczne manifestu

Poza JSON Schema (`scripts/lib/manifest-rules.mjs`, CC-018), sprawdzane przez gateway przy rejestracji:

1. `serverId == "mcp-" + system`.
2. Nazwy narzędzi unikalne w manifeście.
3. Każdy `resourceRefs[].type` i `resourceTypes[].parent` jest zadeklarowany w `resourceTypes`, a typy w
   `resourceTypes` się nie powtarzają.

## Walidacja lokalna i CI

```bash
./scripts/verify-all.sh     # npm test + ./mvnw verify; SMOKE_WIREMOCK=1 dodaje test mocków w Dockerze
```

- `npm test`: Spectral (`.spectral.yaml`, także walidacja przykładów), budowa `dist/`, testy Node:
  kompilacja schematów (ajv, strict, 2020-12), przykłady OpenAPI, wektory JWT/manifestów/hashy/audytu/
  błędów/paczek, zgodność plików generowanych (bundled OpenAPI, WireMock, MSW, wektory buildera), MSW.
- `./mvnw verify` (Java 25): schemat Cedar w trybie strict i polityki przykładowe (cedar-java 4.10.0,
  klasyfikator `uber` z natywną biblioteką dla macOS/Linux x86_64 i aarch64), wektory entity buildera
  (referencyjna implementacja w Javie + walidacja encji schematem), wektory decyzji, budowa obu jarów.

CI: **GitLab CI** (`.gitlab-ci.yml`), bo firmowe repozytoria i serwer MCP dla GitLaba są w GitLabie;
joby `node`, `java`, `wiremock-smoke` (Docker-in-Docker) i na tagu `package-jar`, `package-npm`.
Obrazy w CI: `node:24.18.0-bookworm`, `maven:3.9.12-eclipse-temurin-25`, `docker:28.3.2`.

## Generatory

| Skrypt | Co robi |
| --- | --- |
| `npm run generate` | `openapi/bundled/` i mocki z OpenAPI |
| `npm run generate:vectors` | wektory deterministyczne: manifesty, hashe, audyt, błędy, paczki |
| `npm run generate:cedar` | wektory entity buildera i decyzji (`scripts/lib/entity-builder.mjs`) |
| `scripts/generate-jwt-vectors.mjs` | wektory JWT (podpisy ES256 są losowe: uruchomienie zmienia wszystkie tokeny) |
| `scripts/generate-test-keys.mjs` | klucze testowe; odmawia nadpisania |

Po zmianie OpenAPI: `npm run generate`, po zmianie polityk przykładowych: `npm run generate:vectors`
(paczki zawierają polityki) i `npm run generate:cedar`.
