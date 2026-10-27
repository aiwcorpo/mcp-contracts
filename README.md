# mcp-contracts

Maszynowa wersja kontraktów platformy MCP z `01-contracts.md`: OpenAPI 3.1, JSON Schema 2020-12,
schemat Cedar, specyfikacja entity buildera, testowe klucze, wektory testowe i mocki. Inne repozytoria
generują z tego klientów, mocki i testy kontraktowe. Wersja **2.0.2**, tag `v2.0.2` (poprawki do 2.0.0; 1.2.1 nie
zostało wydane osobno); zmiany w
[`CHANGELOG.md`](CHANGELOG.md). Moduły Java: `mcp-cedar-entities` (wspólny entity builder Cedar dla gateway'a i
startera) i `mcp-policy-bundle` (referencyjny odbiorca paczek polityk).

Kontrakty są zamrożone: zmiany zgłasza się w [`CONTRACT_CHANGES.md`](CONTRACT_CHANGES.md), zatwierdza
człowiek. Tam też są wszystkie miejsca, w których `01-contracts.md` był nieprecyzyjny, z przyjętym
wariantem; CC-001 ... CC-034 wdrożone w 1.1.0, CC-036 ... CC-045 w 1.2.0, CC-046 ... CC-067 w 2.0.0,
CC-035 odrzucone.

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
| C9 grupy | `cedar/entity-builder.md` (parsowanie), `java/mcp-cedar-entities` (implementacja), `schemas/common.schema.json#/$defs/GroupName` |
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
├── java/mcp-contracts/      # moduł Maven: jar z zasobami + jar test-vectors (pom, bez kodu)
├── java/mcp-cedar-entities/ # moduł Maven: entity builder + testy JUnit (Cedar, wektory decyzji, filtr wyników)
├── java/mcp-policy-bundle/  # moduł Maven: odbiorca paczek polityk, PolicyStore, lint + testy na wektorach paczek
├── java/mcp-manifest/       # moduł Maven: RFC 8785, definitionHash, reguły manifestu + testy na wektorach
├── spectral-functions/      # reguła Spectral dla x-allowed-client-cn
├── scripts/                 # generatory i verify-all.sh
└── test/                    # testy Node (lint, schematy, wektory, mocki)
```

## Wersjonowanie (SemVer)

Wersja dotyczy całego repozytorium naraz: jar, paczka npm i tag git mają ten sam numer.

| Zmiana | Wersja | Przykład |
| --- | --- | --- |
| usunięcie lub zmiana nazwy pola, endpointu, wartości enum; nowa wartość enum (np. nowy system: zmienia też schemat Cedar); zaostrzenie walidacji; zmiana schematu Cedar, po której istniejące polityki lub encje przestają przechodzić walidację; zmiana oczekiwania w istniejącym wektorze | **major** | `2.0.0` |
| nowe pole opcjonalne w odpowiedzi lub żądaniu, nowy endpoint, nowe wektory | **minor** | `1.1.0` |
| poprawka opisu, literówki, nowy przykład zgodny ze schematem | **patch** | `1.0.1` |

Od 2.0.0 obowiązuje ścisły SemVer według tabeli powyżej. Wydania 1.1.0 i 1.2.0 zawierały zmiany niezgodne
oznaczone jako minor; broker (ws-06), BFF (ws-07) i frontend (ws-08) zależą od 1.1.0, więc pełna lista zmian
niezgodnych względem 1.1.0 i ich wpływ na konsumentów są w `CHANGELOG.md` przy 2.0.0.

`release/` przechowuje tarballe npm **wszystkich** wydań (konsumenci zależą od nich przez ścieżkę
`file:../mcp-contracts/release/aiwcorpo-mcp-contracts-<wersja>.tgz`). Starych tarballi się nie usuwa, a
tarballa wersji, która ma już tag, się nie nadpisuje (`npm run pack` tego odmawia), więc suma integralności w
`package-lock.json` konsumenta pozostaje ważna.

Każde wydanie: wpis w `CONTRACT_CHANGES.md` ze statusem `accepted`, podbicie wersji w `pom.xml`,
`package.json` i polach `info.version`, tag `vX.Y.Z`. Paczka polityk wskazuje wersję kontraktów w
`manifest.json.schemaVersion`.

## Artefakty

| Artefakt | Zawartość | Użycie |
| --- | --- | --- |
| `pl.aiwcorpo.mcp:mcp-contracts:2.0.2` (jar) | `openapi/`, `schemas/`, `cedar/`, `mocks/wiremock/` pod prefiksem classpath `mcp-contracts/` | może być w runtime (np. schemat Cedar, walidacja manifestu) |
| `pl.aiwcorpo.mcp:mcp-contracts:2.0.2:test-vectors` (jar, klasyfikator) | `test-vectors/` łącznie z kluczami testowymi, pod `mcp-contracts/test-vectors/` | **tylko** `<scope>test</scope>` |
| `pl.aiwcorpo.mcp:mcp-cedar-entities:2.0.2` (jar + javadoc) | entity builder Cedar (C7, C9) | gateway (ws-05) i starter (ws-02), runtime |
| `pl.aiwcorpo.mcp:mcp-policy-bundle:2.0.2` (jar + javadoc) | weryfikacja i ładowanie paczek polityk C7, `PolicyStore`, lint polityk | gateway, starter, potok ws-09 |
| `pl.aiwcorpo.mcp:mcp-manifest:2.0.2` (jar + javadoc) | `definitionHash` (RFC 8785) i reguły manifestu C6 | starter (generowanie), gateway (rejestracja) |
| `pl.aiwcorpo.mcp:mcp-contracts-parent:2.0.2` (pom) | rodzic modułów | instalowany razem z nimi |
| `release/aiwcorpo-mcp-contracts-2.0.2.tgz` (npm, `@aiwcorpo/mcp-contracts`) | wszystko powyżej poza jarami + typy TS (`dist/types`) + handlery MSW (`dist/msw`) | `npm install ../mcp-contracts/release/aiwcorpo-mcp-contracts-2.0.2.tgz` |

W Mavenie klucze testowe są tylko w jarze `test-vectors`, żeby komponent produkcyjny nie mógł przypadkiem
załadować testowego JWKS z classpath. Paczka npm zawiera `test-vectors/` (w tym klucze) i jest
przeznaczona do `devDependencies`; nie jest publikowana do rejestru (`"private": true`).

Instalacja lokalna:

```bash
./mvnw install          # ~/.m2/repository/pl/aiwcorpo/mcp/{mcp-contracts,mcp-cedar-entities,mcp-policy-bundle,mcp-manifest,mcp-contracts-parent}/2.0.2/
npm ci && npm run pack  # release/aiwcorpo-mcp-contracts-2.0.2.tgz
```

```xml
<dependency>
  <groupId>pl.aiwcorpo.mcp</groupId>
  <artifactId>mcp-contracts</artifactId>
  <version>2.0.2</version>
</dependency>
<dependency>
  <groupId>pl.aiwcorpo.mcp</groupId>
  <artifactId>mcp-contracts</artifactId>
  <version>2.0.2</version>
  <classifier>test-vectors</classifier>
  <scope>test</scope>
</dependency>
```

Odczyt z classpath: `getResource("/mcp-contracts/cedar/mcp.cedarschema")`,
`/mcp-contracts/test-vectors/jwt/valid.json` itd.

## mcp-cedar-entities (entity builder)

Wspólna implementacja `cedar/entity-builder.md` dla gateway'a i startera (CC-019). Zależności: cedar-java
4.10.0 (klasyfikator `uber` z natywnymi bibliotekami), jackson-databind 2.x (wymagany i tak przez cedar-java,
nie występuje w API), `mcp-contracts`. Bez Springa. Rekordy wejściowe są niezmienne; `CedarRequest` zawiera
obiekty cedar-java, które cedar-java trzyma jako mutowalne (nie modyfikuj ich). `EntityBuilder` trzyma tylko
mapowanie zakresów i jest bezpieczny wątkowo; po załadowaniu nowej paczki tworzy się nowy builder.

**Zgodność API (CC-039):** publiczne rekordy (`Caller`, `ToolDescriptor`, `ResourceRef`,
`VirtualServerScope`, `ResolvedResource`, `CedarRequest`, `QueryConstraint`) i typy cedar-java w sygnaturach
są częścią API. Dodanie składnika rekordu albo przejście na nową wersję major cedar-java to nowa wersja major
biblioteki.

**Środowisko:** Spring Boot 4.1.0 zarządza jackson-databind 2.x w wersji 2.21.4 (obok Jacksona 3) i nadpisze
2.20.0 z tego modułu; testy modułów przechodzą z 2.21.4 (`./mvnw verify -Djackson.version=2.21.4`).
cedar-java 4.10.0 `uber` ma biblioteki natywne dla macOS (x86_64, aarch64), Linuksa z glibc (x86_64, aarch64)
i Windows x86_64; nie ma wersji dla musl, więc obrazy Alpine nie zadziałają (użyj obrazu z glibc, np.
`eclipse-temurin:25-jre`).

```xml
<dependency>
  <groupId>pl.aiwcorpo.mcp</groupId>
  <artifactId>mcp-cedar-entities</artifactId>
  <version>2.0.2</version>
</dependency>
```

```java
EntityBuilder builder = new EntityBuilder(loadedBundle.scopeMapping());   // mapowanie z entities/static.json
Caller caller = Caller.of(claims.sub(), claims.usr(), claims.grp(), claims.azp())
        .withMfaAge(120)
        .withVirtualServer(VirtualServerScope.fromClaims(claims.vs(), claims.vsc())); // tylko gdy są vs i vsc
ToolDescriptor tool = new ToolDescriptor("mcp-jira", "jira", "get_issue", "READ_ONLY", "read",
        List.of(new ResourceRef("issueKey", "Jira::Issue")));

// gateway: Action::"call" na Tool
CedarRequest call = builder.forToolCall(caller, tool, arguments);
// serwer: akcja narzędzia na zasobie rozwiązanym z systemu
ResolvedResource issue = ResolvedResource.of("Jira::Issue", "ABC-123", Map.of("key", "ABC-123"))
        .withParent(ResolvedResource.of("Jira::Project", "HR", Map.of("key", "HR", "category", "Restricted")));
CedarRequest onResource = builder.forResource(caller, tool, arguments, issue);

AuthorizationResponse r = engine.isAuthorized(
        onResource.toAuthorizationRequest(bundleSchema), bundlePolicies, onResource.cedarEntities());
```

Wyszukiwanie i listy (CC-036): `builder.queryConstraint(caller, "Jira::Project")` mówi, do czego ograniczyć
zapytanie do systemu, a `new ResultFilter(builder, authorizer).allowed(caller, tool, arguments, items,
item -> resolvedResourceOf(item))` zostawia tylko elementy dozwolone przez politykę (reszta jest pomijana,
także przy błędzie oceny).

`EntityBuilderException` (kod `INVALID_ARGUMENT` albo `INTERNAL_ERROR`, `wireCode()` = kod C10) oznacza
odmowę wywołania. Gateway tworzy claim `vsc` przez
`VirtualServerScope.fromResourceDefaults(slug, resourceDefaults).vsScopes()`. `McpCedarSchema.schema()` daje
schemat tej wersji kontraktów; do oceny polityk używaj schematu z załadowanej paczki.

## mcp-policy-bundle (odbiorca paczek polityk)

Referencyjny odbiorca C7 (CC-045): weryfikuje i ładuje paczkę z bajtów; pobieranie `latest.json` i plików
(ETag, interwał) robi komponent. Zależności: `mcp-cedar-entities`, cedar-java, jackson-databind. Bez Springa.

```java
PublicKey mainKey = BundleVerifier.ed25519PublicKeyFromPem(config.mainKeyPem());
BundleVerifier main = BundleVerifier.of(Channel.MAIN, mainKey, config.mainKeyId(), config.allowTestKeys());
BundleVerifier overrides = BundleVerifier.of(Channel.OVERRIDES, overridesKey, config.overridesKeyId(), config.allowTestKeys());

BundlePointer pointer = BundlePointer.parse(latestJsonBytes);
try {
    PolicyBundle bundle = main.verifyMain(pointer, archiveBytes, signatureBytes, Optional.ofNullable(loadedMainRevision));
    // nie scalaj encji statycznych: builder tworzy UserGroup z bundle.scopeMapping() (CC-059)
} catch (BundleRejectedException e) {
    // zostaje poprzednia paczka; e.reason().wireCode() do metryki i logu
}
PolicyBundle emergency = overrides.verifyOverrides(pointerO, archiveO, signatureO,
        Optional.ofNullable(loadedOverridesRevision), currentMain);
```

Kolejność kontroli: `latest.json` (CC-026), klucz (identyfikator `test-*` i opublikowane klucze testowe po SPKI
tylko z `allowTestKeys`, CC-044), podpis Ed25519, archiwum (`TarReader`: prefiks ustar, sumy kontrolne, tylko pliki zwykłe i katalogi, bez nazw
absolutnych, `.`/`..` i duplikatów, limity 1000 wpisów, 4 MiB na plik, 16 MiB razem), `manifest.json` i zgodność
rewizji, zawartość (overrides: tylko `manifest.json` i `policies/**`, CC-028), rewizja ściśle wyższa w ramach
kanału, polityki (bez szablonów, bez `permit` w overrides, `vsScopes` i `virtualServer` tylko w `forbid`, CC-041,
CC-058), schemat bajtowo równy `cedar/mcp.cedarschema` (`schema_mismatch`, CC-059), walidacja strict (overrides
schematem paczki głównej, CC-040), `static.json` wyłącznie encje `UserGroup` i mapowanie zakresów (CC-037, CC-059).

Rozmiar archiwum przed dekompresją nie jest sprawdzany przez moduł: komponent ogranicza pobieranie (np. do
16 MiB, tyle co limit po rozpakowaniu) zanim przekaże bajty. `TarReader` przyjmuje tylko ścisły ustar; potok
ws-09 buduje paczkę bez rozszerzeń pax (macOS: `COPYFILE_DISABLE=1 tar --no-xattrs --format=ustar -czf ...`,
GNU tar: `tar --format=ustar -czf ...`), inaczej paczka zostanie odrzucona (`archive_invalid`).

Zamiast samodzielnej podmiany komponent może użyć `PolicyStore` (CC-060): `store.loadMain(...)`,
`store.loadOverrides(...)` i `store.current()` dają jedną spójną migawkę (`policies()` z obu kanałów, `schema()`,
`entityBuilder()`); aktualizacje są serializowane, `@id` muszą być unikalne między kanałami, a nowa paczka główna
sprzeczna z załadowanymi `overrides` jest odrzucana (stan się nie zmienia). Paczka główna musi mieć schemat równy
`cedar/mcp.cedarschema` tej wersji kontraktów, a `static.json` wyłącznie encje `UserGroup` (CC-059).

Gotowość po restarcie: jeśli plik stanu pokazuje, że paczka `overrides` była aktywna, `store.awaitingOverrides()`
zwraca `true`, a `store.isReady()` `false`, dopóki `overrides` nie zostaną załadowane ponownie. Komponent nie
obsługuje ruchu, dopóki magazyn nie jest gotowy, albo do skonfigurowanego limitu czasu, po którym podnosi alarm
(awaryjne `forbid` nie mogą zniknąć po cichu). Katalog stanu należy do jednej instancji komponentu (osobny katalog
na replikę); magazyn i tak czyta plik przed każdą decyzją i bierze nowszą z wartości pamięci i dysku, zapisuje
go z `fsync` pliku i katalogu, a błąd zapisu daje `state_write_failed`.

Ochrona przed cofnięciem po restarcie (CC-066): `new PolicyStore(main, overrides, new PolicyStore.Persistence(
stateDir, Map.of(Channel.MAIN, minimumRevision), auditLog::warn))` zapisuje w `stateDir` ostatnią rewizję i
skrót archiwum per kanał (atomowo). Po restarcie przyjmowana jest tylko rewizja nowsza albo ta sama z tym samym
archiwum; rewizja minimalna z konfiguracji obowiązuje zawsze; brak lub uszkodzony plik stanu daje ostrzeżenie do
audytu i działa według minimum.

Lint dla potoku ws-09: `java -cp <classpath> pl.aiwcorpo.mcp.policy.bundle.PolicyLintCli [--overrides]
policies/` (kod wyjścia 0 = czysto, 1 = naruszenia, 2 = błąd). Sprawdza, że `context.vsScopes` i
`context.virtualServer` występują tylko w `forbid` (CC-041, CC-058).

## Port IGA (C13)

Port wewnętrzny BFF (bez wpływu na OpenAPI, CC-052). Wnioskodawca to `Requester` z atrybutami tożsamości z
tokenu OIDC sesji BFF, nigdy z przeglądarki:

```java
record Requester(String sub, String username, Optional<String> email, Map<String, Object> claims) {}

interface AccessGovernance {
  List<Entitlement> catalog(String system);
  List<AccessRequest> requestsOf(Requester requester);
  RequestResult request(Requester requester, String entitlement);
}
```

Każdy adapter IGA wybiera identyfikator wnioskodawcy z konfiguracji (np. `requester-id-claim`, domyślnie
`preferred_username`); brak tego claimu w `Requester` to błąd adaptera i odmowa (fail-closed). Kształty
`AccessRequest` i `RequestResult`: CC-024.

## Zamrożony schemat Cedar (linia 2.x)

`cedar/mcp.cedarschema` jest bajtowo zamrożony w całej linii 2.x, łącznie z komentarzem nagłówka (`2.0.0`) i
końcami linii LF: paczka polityk musi nieść dokładnie ten plik (CC-059), więc każda zmiana, nawet komentarza,
sprawiłaby, że komponenty na różnych wydaniach 2.0.x odrzucałyby nawzajem swoje paczki (`schema_mismatch`).
Testy (Node i Java) porównują skrót SHA-256 pliku. Potok ws-09 kopiuje plik bez konwersji końców linii
(`.gitattributes` wymusza LF). Zmiana schematu to wydanie 3.0.0.

## Identyfikatory zasobów

Identyfikatory każdego typu zasobu mają wzorzec zgodny z dokumentacją systemu (CC-056, tabela w
`cedar/entity-builder.md` sekcja 9, `schemas/common.schema.json` `ResourceIdPatterns`, w Javie `ResourceIds`).
Niepasujące identyfikatory są odrzucane w `resourceDefaults`, `vsc`, argumentach narzędzi, zasobach z resolvera
i mapowaniu zakresów. Walidatory JSON Schema w Javie często dopasowują wzorzec przez `Matcher.find()`, przy którym
`$` przepuszcza końcowe `\n` (`"ABC\n"`); gateway (ws-05) przy zapisie `ResourceDefaults` i odbiorcy `vsc` wołają
dodatkowo `ResourceIds.isValid`, które dopasowuje całość. Serwer mimo to cytuje identyfikatory w JQL/CQL i buduje wzorce OpenSearch w postaci
`p,p-*`.

## Korelacja żądań

Każde żądanie ma jeden `requestId` (UUIDv7) od wejścia do audytu: gateway nadaje go w `rid` i `X-Request-Id`
(C2/C3), BFF tworzy własny i wysyła go w `X-Request-Id` do brokera i gateway'a (CC-047). Broker zwraca użyty
identyfikator w nagłówku `X-Request-Id` każdej odpowiedzi.

## mcp-manifest (definitionHash i reguły manifestu)

`pl.aiwcorpo.mcp:mcp-manifest` (CC-063, tylko jackson-databind, API na napisach JSON):
`CanonicalJson.canonicalize(json)` (RFC 8785), `DefinitionHash.compute(definition, entry, system, credential)`,
`DefinitionHash.ofManifestTool(manifest, tool)`, `ManifestRules.violations(manifest)` (kody reguł jak w sekcji
"Reguły semantyczne manifestu"). Walidację JSON Schema manifestu robi się osobno, przed regułami.

## Generowanie klienta

Generatory dostają pliki z `openapi/bundled/`. Sprawdzone: openapi-generator **7.26.0**, generator `java`
z biblioteką `native` (C4, C5: generuje i kompiluje się) oraz `typescript-angular` (C12). Generator wypisuje
`ERROR ... Unknown type mutualTLS` dla schematu bezpieczeństwa mTLS; to nie przerywa generowania, mTLS
konfiguruje się w kliencie HTTP (certyfikat klienta), nie w wygenerowanym kodzie. Dozwolone CN certyfikatu
klienta dla każdej operacji C4 i C5 są w rozszerzeniu `x-allowed-client-cn` (inny CN -> 403).

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
            <version>2.0.2</version>
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
CSRF (C12, CC-055): BFF ustawia ciasteczko `__Host-XSRF-TOKEN` (Secure, Path=/, bez Domain), a Angular
odsyła je w nagłówku `X-XSRF-TOKEN` dla POST/PUT/DELETE po skonfigurowaniu
`provideHttpClient(withXsrfConfiguration({cookieName: '__Host-XSRF-TOKEN', headerName: 'X-XSRF-TOKEN'}))`, pod warunkiem, że żądania idą na ten sam origin, czyli `basePath`
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
Handlery wymagają na POST/PUT/DELETE nagłówka `X-XSRF-TOKEN` równego ciasteczku `__Host-XSRF-TOKEN`
(403 `csrf_invalid` inaczej), a nieznany `{system}` daje 400 (CC-054); `GET /api/v1/me` ustawia to ciasteczko. `GET /api/v1/auth/login` odpowiada 302
do testowego IdP, `POST /api/v1/auth/logout` 204. Wyłączenie:
`createPortalBffHandlers({ enforceCsrf: false })`. Pojedynczą odpowiedź do `server.use(...)` daje
`portalBffExample('getPortalCatalog', 'mixed')`. Wymagane `msw` ^3 (peer dependency).

## Wektory testowe

| Katalog | Liczba | Co sprawdza |
| --- | --- | --- |
| `jwt/` | 42 | odbiorca C2: 15 poprawnych, 27 odrzuceń (podpis, `kid`, klucz testowy, `alg`, `iss`, `aud`, `exp` ze skew, `iat`, czas życia, `jti`, wariant serwisowy, obecność i zgodność `tool`, `rid` != `X-Request-Id`, `vs`/`vsc`, token IdP) |
| `manifests/` | 26 | manifest C6: schemat, reguły semantyczne, przeliczony `definitionHash` |
| `definition-hash/` | 11 | `definitionHash` (RFC 8785 + SHA-256), CC-004, CC-042 |
| `audit-events/` | 22 | zdarzenia C8, w tym zakaz argumentów, sekretów, kodów, znaków sterujących i bidi |
| `tool-errors/` | 18 | każdy kod C10 + przypadki odrzucane |
| `bundles/` | 33 | paczki C7: podpis, klucz testowy, rollback, `overrides`, `latest.json`, bezpieczeństwo tar, lint `vsScopes`, walidacja, mapowanie zakresów |
| `return-paths/` | 12 | `returnPath` C4/C12 (CC-032) |
| `entity-builder/` | 22 | wejście buildera (z mapowaniem zakresów) -> encje i kontekst Cedar |
| `policy-decisions/` | 60 | decyzje Cedar na politykach z `cedar/examples`, w tym hierarchia zakresów i wyszukiwanie przez link |
| `result-filter/` | 2 | filtrowanie wyników i ograniczenie zapytania (CC-036) |

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
4. `definition.name == name` i `definition.inputSchema` nie deklaruje `confirmation_code` (CC-005).
5. `definitionHash` przeliczony z `definition` (z `title`, CC-042), `risk`, `action`, `resourceRefs`, `system`,
   `credential` (`scripts/lib/definition-hash.mjs`, CC-004) równa się zadeklarowanemu.
6. Każdy `resourceRefs[].argument` istnieje w `definition.inputSchema.properties` i ma typ `string`, `integer`
   albo `array` z `items` typu `string`/`integer` (CC-043).

## Wymagania dla odbiorców i paczek polityk

- Odbiorcy C2 i odbiorcy paczek domyślnie odrzucają klucze z identyfikatorem `test-*`; wyłącza to tylko jawne
  ustawienie (zalecana nazwa `allowTestKeys`) w dev/test (CC-044). `mcp-policy-bundle` rozpoznaje opublikowane
  klucze testowe także po skrócie SPKI, niezależnie od identyfikatora w konfiguracji; odbiorcy C2 powinni robić to
  samo z kluczami z `test-vectors/keys/test-gateway-jwks.json`. Wektory mają `allowTestKeys: true` i osobne
  przypadki odrzucenia.
- Paczka polityk (ws-09) musi zawężać linki dla wszystkich pięciu typów z `resourceDefaults` i ich typów
  podrzędnych (CC-029), czytać `vsScopes` i `virtualServer` tylko w `forbid` (CC-041, CC-058) i dostarczać mapowanie zakresów w
  `entities/static.json` (CC-037).
- Serwery z narzędziami wyszukiwania i list ograniczają zapytanie i filtrują wyniki (CC-036,
  `cedar/entity-builder.md` sekcja 8).
- Odbiorca paczek: `mcp-policy-bundle` (CC-045).

## Walidacja lokalna i CI

```bash
./scripts/verify-all.sh     # npm test + ./mvnw verify; SMOKE_WIREMOCK=1 dodaje test mocków w Dockerze
```

- `npm test`: Spectral (`.spectral.yaml`, także walidacja przykładów), budowa `dist/`, testy Node:
  kompilacja schematów (ajv, strict, 2020-12), przykłady OpenAPI, wektory JWT/manifestów/hashy/audytu/
  błędów/paczek, zgodność plików generowanych (bundled OpenAPI, WireMock, MSW, wektory buildera), MSW.
- `./mvnw verify` (Java 25): schemat Cedar w trybie strict i polityki przykładowe (cedar-java 4.10.0,
  klasyfikator `uber` z natywną biblioteką dla macOS/Linux x86_64 i aarch64), wektory entity buildera i
  decyzji i filtra wyników wykonywane przez `mcp-cedar-entities` (z walidacją encji schematem i drugim
  przebiegiem bez `forbid`), wektory paczek przez `mcp-policy-bundle`, budowa jarów.

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
