# mcp-contracts

Maszynowa wersja kontraktów platformy MCP z `01-contracts.md`: OpenAPI 3.1, JSON Schema 2020-12,
schemat Cedar, specyfikacja entity buildera, testowe klucze, wektory testowe i mocki. Zmiany w
[`CHANGELOG.md`](CHANGELOG.md). Licencja: Apache-2.0 ([`LICENSE`](LICENSE), [`NOTICE`](NOTICE)).

## Dla kogo i jak używać

To biblioteka dla autorów komponentów platformy MCP (gateway, broker poświadczeń, portal, serwery MCP dla
Jiry, Confluence, GitLaba, OpenSearch i service desku), nie produkt do uruchomienia. Inne repozytoria
generują z niej klientów, mocki i testy kontraktowe. Artefakty są wydawane do GitHub Packages organizacji
`aiwcorpo` (Maven i npm), z GitHub Actions po tagu `vX.Y.Z`. GitHub Packages wymaga uwierzytelnienia także
do odczytu: token z uprawnieniem `read:packages`.

Maven (`~/.m2/settings.xml`, serwer `github` z loginem GitHub i tokenem):

```xml
<repositories>
  <repository>
    <id>github</id>
    <url>https://maven.pkg.github.com/aiwcorpo/mcp-contracts</url>
  </repository>
</repositories>
<dependencies>
  <dependency>
    <groupId>pl.aiwcorpo.mcp</groupId>
    <artifactId>mcp-contracts</artifactId>
    <version>6.3.2</version>
  </dependency>
  <dependency>
    <groupId>pl.aiwcorpo.mcp</groupId>
    <artifactId>mcp-contracts</artifactId>
    <version>6.3.2</version>
    <classifier>test-vectors</classifier>
    <scope>test</scope>
  </dependency>
</dependencies>
```

npm (`.npmrc` projektu: `@aiwcorpo:registry=https://npm.pkg.github.com` i `//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}`):

```bash
npm install --save-dev @aiwcorpo/mcp-contracts@6.3.2
```

Importy: `@aiwcorpo/mcp-contracts/msw`, `.../types/portal-bff`, `.../openapi/*`, `.../schemas/*`, `.../test-vectors/*`.
Klucze prywatne testów nie wchodzą do paczki npm (zob. "Artefakty"). Zgłaszanie podatności: [`SECURITY.md`](SECURITY.md);
wkład: [`CONTRIBUTING.md`](CONTRIBUTING.md). Moduły Java: `mcp-cedar-entities` (wspólny entity builder Cedar dla
gateway'a i startera), `mcp-policy-bundle` (referencyjny odbiorca paczek polityk) i `mcp-manifest`.

Kontrakty są zamrożone: zmiany zgłasza się w [`CONTRACT_CHANGES.md`](CONTRACT_CHANGES.md), zatwierdza
człowiek. Tam też są wszystkie miejsca, w których `01-contracts.md` był nieprecyzyjny, z przyjętym
wariantem; CC-001 ... CC-034 wdrożone w 1.1.0, CC-036 ... CC-045 w 1.2.0, CC-046 ... CC-067 w 2.0.0,
CC-068 ... CC-077 w 2.1.0, CC-035 odrzucone; CC-169 ... CC-177 w 5.0.0.

## Co jest gdzie

| Kontrakt | Plik |
| --- | --- |
| C2 wewnętrzny JWT | `schemas/internal-jwt.schema.json`, wektory `test-vectors/jwt/` |
| C4 Credential Broker | `openapi/credential-broker.v1.yaml`, zdarzenie C4.3 `schemas/credential-invalidated-event.schema.json` |
| C5 Gateway admin | `openapi/gateway-admin.v1.yaml` |
| Adres `/mcp` i filtr (C1, C5) | sekcja "Jeden adres do całej platformy", `scripts/lib/endpoint-filter.mjs`, `java/mcp-manifest` (`EndpointFilter`), `test-vectors/endpoint-filter/`, `test-vectors/endpoint-aggregate/` |
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
│   ├── untrusted-text/      # kształt UntrustedText (CC-072)
│   ├── confirmation-binding/  # oczekujące wywołanie i wynik weryfikacji kodu (C11, CC-091)
│   ├── totp/  text-hygiene/  gateway-authentication/  # CC-092, CC-126 / CC-121, CC-122 / CC-124
│   ├── connect-redirects/  catalog-actions/  return-paths/  # CC-086, CC-083, CC-032, CC-099
│   ├── servicedesk-service-account/  # reguła kolejek konta serwisowego (CC-076)
│   ├── credential-type-header/  # typ poświadczenia: nagłówek a konfiguracja serwera (CC-166)
│   ├── query-rendering/     # zapytania serwera ze struktury (CC-160)
│   ├── endpoint-filter/  endpoint-aggregate/  mcp-endpoint/  oauth-metadata/  # filtr w query /mcp, lista i routing, odpowiedź BFF, metadane OAuth (CC-169 ... CC-187)
│   ├── entity-builder/      # wejście buildera -> encje i kontekst Cedar
│   └── policy-decisions/    # żądanie Cedar -> decyzja i polityki rozstrzygające
├── mocks/wiremock/          # stuby C4 i C5 (generowane)
├── mocks/msw/               # handlery MSW dla C12 (TS)
├── java/mcp-contracts/      # moduł Maven: jar z zasobami + jar test-vectors (pom, bez kodu)
├── java/mcp-cedar-entities/ # moduł Maven: entity builder + testy JUnit (Cedar, wektory decyzji, filtr wyników)
├── java/mcp-policy-bundle/  # moduł Maven: odbiorca paczek polityk, PolicyStore, lint + testy na wektorach paczek
├── java/mcp-manifest/       # moduł Maven: RFC 8785, definitionHash, reguły manifestu, EndpointFilter + testy na wektorach
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

Wyjątek w 2.2.0/2.2.1: CC-085 (`resourceDefaults` uśpione, `400 resource_defaults_unsupported`; od 5.0.0 pole nie istnieje, CC-173) jest zaostrzeniem
walidacji wydanym jako minor na decyzję człowieka (brak konsumentów); w 2.2.1 usunięto odpowiedź `400
expires_at_invalid` dodaną w 2.2.0 (CC-084, brak konsumentów). Szczegóły w `CHANGELOG.md`.

Wyjątek: 6.3.0, 6.3.1 i 6.3.2 mają zmiany major według tabeli, wydane jako minor i patch na decyzję człowieka (2026-11-03, wzór 5.1.0 i 6.2.0): CC-219 (stała klauzula `type = page` w CQL zmienia oczekiwane wyjście wektorów `query-rendering/cql-plain` i `cql-hostile-value`; jedynym odbiorcą jest serwer Confluence), CC-227 (adapter tylko do odczytu: `approve` wpisu adaptera z `risk` innym niż `READ_ONLY` to `422 classification_not_allowed`, a zapisane wcześniej `UPDATE` i `DESTRUCTIVE` tracą ważność; kanał adaptera jest zaimplementowany w gatewayu od 6.2.0, ale nie działa na żadnym stosie z użytkownikami, więc zapisane klasyfikacje zapisu istnieją tylko w stosie deweloperskim i testach) oraz CC-226 w 6.3.1 (claimy `rsk` i `act` z 6.3.0 usunięte i zastąpione `mcp_risk` i `mcp_action`, ograniczonymi do sidecara adaptera; 6.3.0 nie został wypchnięty ani wdrożony). Szczegóły: `CHANGELOG.md` ("6.3.0", "6.3.1").

Wyjątek: 6.1.0 i 6.2.0 (CC-206, CC-207) poprawiają elementy 6.0.0 i 6.1.0, których nikt nie wdrożył (kanał adaptera, `BalancerError`, bezstanowy `list_changed`). Według tabeli są tam zmiany major (nowa wartość enum `gateway_timeout` w 6.1.0; w 6.2.0 inny punkt odniesienia `list_changed`, nowy kod `classification_inconsistent`, węższa odpowiedź `200` kanału adaptera, kolejność `403` przed `400` i `422`, wynik `removed` przy usunięciu narzędzia adaptera), wydane jako minor na decyzję człowieka (2026-11-03). Szczegóły: `CHANGELOG.md` ("6.1.0", "6.2.0").

6.0.0 (CC-192 ... CC-205) jest majorem zgodnym z tabelą, bez wyjątków: nowa wartość enum `PendingTool.source` i `risk`/`action` warunkowo wymagane we wpisie manifestu (CC-193), `PolicyLintCli` kończący się błędem przy schemacie albo polityce, które nie przechodzą walidacji (CC-203), zmienione oczekiwania wektorów `audit-throttle-*` (CC-195). Bajty `mcp.cedarschema` bez zmian. Migracja per strumień: `CHANGELOG.md` ("6.0.0").

Wyjątek: 5.1.0 (CC-178 ... CC-188) poprawia wydanie 5.0.0, którego nikt nie wdrożył. Według tabeli jest tam kilka zmian major: `listChanged` z `true` na `false` (CC-179), `PolicyLintCli` kończący się błędem przy polityce niemożliwej do spełnienia (CC-183), ścisły wzorzec `EndpointFilterQuery`, warunki pola `filter` w audycie i wynik `EndpointFilter.allows` dla ryzyka spoza zbioru (CC-186),
mock MSW odrzucający `%` i powtórzony parametr (CC-182), zmiana wejścia jednego wektora `list-changed-*` (CC-187) oraz wynik `tools/call` i kontroli sesji w scenariuszach, które 5.0.0 zostawiało sprzeczne (CC-178, CC-184). Człowiek zdecydował (2026-10-31), że wydanie to 5.1.0, bo dochodzą funkcje kontraktu (`nextCursor`, limit czasu), a niezgodności dotyczą wersji bez konsumentów. Bajty `mcp.cedarschema` bez zmian. Szczegóły i migracja: `CHANGELOG.md` ("5.1.0").

Wyjątek: 5.1.1 (CC-189, CC-190) jest według tabeli zmianą oczekiwanej odpowiedzi (query ponad limit transportu to `400`/`414` bez `reason`) i zmianą zachowania audytu (ograniczanie częstotliwości zdarzeń odrzuceń). Wydane jako patch na decyzję człowieka (2026-11-01): obie dotyczą przypadków, których 5.1.0 nie dało się zaimplementować zgodnie z tekstem (limit transportu poza gatewayem) albo zalewały audyt. Schematy poza `TransportLimitError` i bajty Cedar bez zmian.

Wyjątek: 5.1.2 (CC-191) zmienia wejście i oczekiwania wektorów `audit-throttle-*` z 5.1.1 (klucz ograniczania audytu obejmuje cel) i dodaje opcjonalne pole `suppressedCount`. Wydane jako patch na decyzję człowieka (2026-11-01), po przeglądzie CC-190: 5.1.1 miało wabik jednego powodu, który ukrywał inne cele. Dotyka ws-05.

5.0.0 jest majorem zgodnym z tabelą: usunięte operacje, pola i wartości enum (CC-173 ... CC-175, CC-177), nowe bajty schematu Cedar (SHA-256 `51d71b2dbb7f61fd2593cf4c2f1a2373dea06e8b4431425a3f1aa24fa10a0ba5`, poprzednio `902b2540...`), zmienione oczekiwania wektorów. Migracja per komponent: `CHANGELOG.md` ("5.0.0").

Wyjątek: w 4.1.0 podłoga ryzyka liczy także wpis oczekujący (CC-167): `PUT` z niższym ryzykiem niż zgłoszone wcześniej, nawet tylko jako oczekujące, przechodził w 4.0.x, a teraz to narzędzie czeka na administratora (`pending_approval`, `riskLowered`, ukryte);
według tej tabeli to zaostrzenie walidacji, czyli major. Wydane jako minor na decyzję człowieka (2026-10-29), jak 4.0.1, bo jest to doprecyzowanie reguły z 4.0.0 ("obniżenie `risk` zawsze 422"),
a nie ma konsumentów, którzy zależą od przyjmowania niższego ryzyka; wyjście w dół zapewnia jawne `acceptRiskLowering` administratora. Przy okazji wiersze aktywności z odmową zmieniają wynik z `error`
na `denied_*` (CC-165), a serwer odmawia przy rozjeździe typu poświadczenia (CC-166): `result` to otwarty napis, a reguła serwera dotyczy żądań z poświadczeniem i działa w obu kierunkach wersji
(stary gateway już wysyła nagłówek, więc nowy serwer z nim działa, o ile typ zgadza się z jego konfiguracją; stary serwer nie sprawdza i nie ma tej ochrony): wdrażać razem.

Wyjątek: w 4.0.1 (CC-163, CC-164) usunięcie trybu `serverConfiguredQueues` (kolejki konta serwisowego z konfiguracji serwera, CC-076) i zmiana oczekiwania
wektora `srv-servicedesk-service-account-granted-in-server-config` z `continue` na `deny`, a także zaostrzenie reguły przykładowej `credential-type.cedar` (lista dozwolona
typów poświadczeń), są według tej tabeli zmianami major. Wydane jako patch, bo naprawiają sprzeczność wydania 4.0.0: wektor dopuszczał tryb, który przykładowa reguła z tego
samego wydania odrzucała, więc tryb nigdy nie działał z przykładem (odmowa, fail-closed), a zmiana nie zmienia bajtów schematu Cedar. Dotyka ws-04 (konfiguracja serwera nie otwiera
kolejek) i ws-09 (przebudowa paczek na przykładzie 4.0.1). Człowiek zdecydował (2026-10-29), że wydanie to 4.0.1 z tym wyjątkiem, jak 3.1.0.

Wyjątek: w 3.1.0 CC-129 (nowy wymagany atrybut encji GitLaba i nowe wymagane wejście buildera, nowe bajty schematu Cedar) jest według tej
tabeli zmianą major i **jest łamiąca dla paczek polityk 3.0.x** (serwer GitLaba musi podać `ancestorClassifications`, paczki trzeba
przebudować). Wydanie jako 3.1.0 (minor) wynikło z błędu koordynatora, który nazwał zmianę addytywną; człowiek zdecydował (2026-10-28),
że 3.1.0 zostaje z tym wyjątkiem SemVer, jak 2.1.0.

Wyjątek: w 2.1.0 CC-071 (nowa wartość enum `event: "authentication"`) i CC-074 (zawężenie wzorców indeksów
OpenSearch) są według tej tabeli zmianami major, a wydane jako minor na wyraźną decyzję człowieka z 2026-10-27;
skutki dla konsumentów opisuje `CHANGELOG.md`.

Tarballe npm nie są w gicie. `npm run pack` zapisuje je lokalnie do `release/` (katalog w `.gitignore`), a
tarballa wersji, która ma już tag, nie nadpisuje (odmawia), więc suma integralności w `package-lock.json`
konsumenta, który wskazuje taki plik, pozostaje ważna. Wydane wersje są w GitHub Packages.

Każde wydanie: wpis w `CONTRACT_CHANGES.md` ze statusem `accepted`, podbicie wersji w `pom.xml`,
`package.json` i polach `info.version`, tag `vX.Y.Z`. Paczka polityk wskazuje wersję kontraktów w
`manifest.json.schemaVersion`.

## Artefakty

| Artefakt | Zawartość | Użycie |
| --- | --- | --- |
| `pl.aiwcorpo.mcp:mcp-contracts:6.3.2` (jar) | `openapi/`, `schemas/`, `cedar/`, `mocks/wiremock/` pod prefiksem classpath `mcp-contracts/` | może być w runtime (np. schemat Cedar, walidacja manifestu) |
| `pl.aiwcorpo.mcp:mcp-contracts:6.3.2:test-vectors` (jar, klasyfikator) | `test-vectors/` łącznie z kluczami testowymi, pod `mcp-contracts/test-vectors/` | **tylko** `<scope>test</scope>` |
| `pl.aiwcorpo.mcp:mcp-cedar-entities:6.3.2` (jar + javadoc) | entity builder Cedar (C7, C9) | gateway (ws-05) i starter (ws-02), runtime |
| `pl.aiwcorpo.mcp:mcp-policy-bundle:6.3.2` (jar + javadoc) | weryfikacja i ładowanie paczek polityk C7, `PolicyStore`, lint polityk | gateway, starter, potok ws-09 |
| `pl.aiwcorpo.mcp:mcp-manifest:6.3.2` (jar + javadoc) | `definitionHash` (RFC 8785), reguły manifestu C6 i `EndpointFilter` (filtr w query `/mcp`, CC-170) | starter (generowanie), gateway (rejestracja, filtr), BFF (filtr) |
| `pl.aiwcorpo.mcp:mcp-contracts-parent:6.3.2` (pom) | rodzic modułów | instalowany razem z nimi |
| `@aiwcorpo/mcp-contracts@6.3.2` (npm, GitHub Packages) | wszystko powyżej poza jarami + typy TS (`dist/types`) + handlery MSW (`dist/msw`) | `npm install --save-dev @aiwcorpo/mcp-contracts@6.3.2`; lokalnie `npm run pack` daje `release/aiwcorpo-mcp-contracts-<wersja>.tgz` |

W Mavenie klucze testowe (także prywatne, publiczne z założenia) są tylko w jarze `test-vectors`, żeby komponent
produkcyjny nie mógł przypadkiem załadować testowego JWKS z classpath; testy odbiorców podpisują nimi tokeny i
paczki, więc jar zostaje osobnym artefaktem z `<scope>test</scope>`. Paczka npm zawiera `test-vectors/` bez plików
`*NOT-FOR-PRODUCTION*` (klucze prywatne); klucze publiczne i JWKS zostają, bo wektory ich używają do weryfikacji.
Kto w testach Node potrzebuje kluczy prywatnych, bierze je z jaru `test-vectors` albo z repozytorium.

Instalacja lokalna:

```bash
./mvnw install          # ~/.m2/repository/pl/aiwcorpo/mcp/{mcp-contracts,mcp-cedar-entities,mcp-policy-bundle,mcp-manifest,mcp-contracts-parent}/<wersja>/
npm ci && npm run pack  # release/aiwcorpo-mcp-contracts-<wersja>.tgz (poza gitem)
```

```xml
<dependency>
  <groupId>pl.aiwcorpo.mcp</groupId>
  <artifactId>mcp-contracts</artifactId>
  <version>2.2.0</version>
</dependency>
<dependency>
  <groupId>pl.aiwcorpo.mcp</groupId>
  <artifactId>mcp-contracts</artifactId>
  <version>2.2.0</version>
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
`ResolvedResource`, `CedarRequest`, `QueryConstraint`; od 5.0.0 bez `VirtualServerScope`, bez `Caller.withVirtualServer` i bez pól `virtualServer` w `QueryConstraint`, CC-173) i typy cedar-java w sygnaturach
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
  <version>2.2.0</version>
</dependency>
```

```java
EntityBuilder builder = new EntityBuilder(loadedBundle.scopeMapping());   // mapowanie z entities/static.json
Caller caller = Caller.of(claims.sub(), claims.usr(), claims.grp(), claims.azp())
        .withMfaAge(120);
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
odmowę wywołania. `McpCedarSchema.schema()` daje
schemat tej wersji kontraktów; do oceny polityk używaj schematu z załadowanej paczki.

## mcp-policy-bundle (odbiorca paczek polityk)

Referencyjny odbiorca C7 (CC-045): weryfikuje i ładuje paczkę z bajtów; pobieranie `latest.json` i plików
(ETag, interwał) robi komponent. Zależności: `mcp-cedar-entities`, cedar-java, jackson-databind. Bez Springa.

```java
PublicKey mainKey = BundleVerifier.ed25519PublicKeyFromPem(config.mainKeyPem());
BundleVerifier main = BundleVerifier.of(Channel.MAIN, mainKey, config.mainKeyId(), config.allowTestKeys())
        .withDevstackProfile(config.devstackProfile()); // klucze dev-* tylko przy obu zgodach (CC-137)
BundleVerifier overrides = BundleVerifier.of(Channel.OVERRIDES, overridesKey, config.overridesKeyId(), config.allowTestKeys())
        .withDevstackProfile(config.devstackProfile());

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
tylko z `allowTestKeys`, CC-044; identyfikator `dev-*` tylko w trybie dev, czyli z `allowTestKeys` i `withDevstackProfile(true)`, CC-137), podpis Ed25519, archiwum (`TarReader`: prefiks ustar, sumy kontrolne, tylko pliki zwykłe i katalogi, bez nazw
absolutnych, `.`/`..` i duplikatów, limity 1000 wpisów, 4 MiB na plik, 16 MiB razem), `manifest.json` i zgodność
rewizji, zawartość (overrides: tylko `manifest.json` i `policies/**`, CC-028), rewizja ściśle wyższa w ramach
kanału, polityki (bez szablonów, bez `permit` w overrides; od 5.0.0 bez lintu `vsScopes` i `virtualServer`, bo tych pól nie ma w schemacie, CC-173), schemat bajtowo równy `cedar/mcp.cedarschema` (`schema_mismatch`, CC-059), walidacja strict (overrides
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

Lint dla potoku ws-09: `java -cp <classpath> pl.aiwcorpo.mcp.policy.bundle.PolicyLintCli [--overrides] [--schema <plik>]
policies/` (kod wyjścia 0 = czysto, 1 = naruszenia, 2 = błąd, od 6.0.0 także wtedy, gdy schemat albo polityka w ogóle nie przechodzą walidacji: wcześniej taki przebieg kończył się kodem 0, CC-203). Zgłasza szablony, a z `--overrides` każdy `permit`. Od 5.0.0 nie sprawdza już `context.vsScopes`
i `context.virtualServer` (CC-173): polityka, która czyta je bez ochrony `has`, nie przechodzi walidacji schematu w odbiorcy. Zgłasza też każdą politykę, którą walidator Cedar nazywa niemożliwą do spełnienia ("policy is impossible", `PolicyLint.impossible`, CC-183):
`forbid` z ochroną `context has vsScopes && ...` albo z literówką w ochronie przechodzi walidację i nigdy nie pasuje, a to cichy fail-open. Schemat to `cedar/mcp.cedarschema` tej wersji, chyba że podano `--schema`. To bramka potoku; odbiorca paczki (`BundleVerifier`) takiej polityki nie odrzuca
(wektor `main-forbid-guarded-by-has-removed-vsscopes-accepted` zostaje). Ograniczenie: Cedar ostrzega tylko, gdy dowiedzie, że warunek jest fałszywy dla każdego żądania, więc `(context has virtualServer) || principal has username` przechodzi bez ostrzeżenia.

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

## Zamrożony schemat Cedar (linia 4.0)

`cedar/mcp.cedarschema` jest bajtowo zamrożony w obrębie linii, łącznie z komentarzem nagłówka i końcami linii LF: paczka
polityk musi nieść dokładnie ten plik (CC-059), więc każda zmiana, nawet komentarza, sprawia, że komponenty na różnych wydaniach
odrzucają nawzajem swoje paczki (`schema_mismatch`). Testy (Node i Java) porównują skrót SHA-256 pliku. Potok ws-09 kopiuje plik bez
konwersji końców linii (`.gitattributes` wymusza LF). Schemat był taki sam w 2.0.0 ... 3.0.2; **3.1.0 dodaje atrybut
`inheritedClassification` (CC-129) na `GitLab::Group` i `GitLab::Project`**, więc paczki zbudowane na schemacie 3.0.x trzeba
przebudować (wejście `schemaVersion` paczki i bajty schematu), a komponenty gateway, starter i serwery muszą używać bibliotek 3.1.0.
Skrót SHA-256 schematu 3.1.0: `cf79068bc845d392a12a96c88431564afc4eb5afc1697cda083180717b7e4d8a`.

**4.0.0 dodaje opcjonalny atrybut kontekstu `credentialType` (CC-136)** i zmienia komentarz nagłówka, więc bajty pliku są inne
(SHA-256 `902b254090cc7bd5b8f4ff3fa26b76850f516e9d07da0f9faed1729deb1412f7`). Atrybut jest opcjonalny w modelu: paczka zbudowana na
schemacie 3.1.x nie przechodzi na schemacie 4.0.0 (bajty), ale polityki bez `credentialType` działają bez zmian; polityka czytająca
go musi chronić odczyt przez `has` (gateway i starter 4.0.0 podają go zawsze). Biblioteki, paczki polityk i serwery przechodzą na 4.0.0 razem (wejście `schemaVersion` paczki
i bajty schematu).

## Identyfikatory zasobów

Identyfikatory każdego typu zasobu mają wzorzec zgodny z dokumentacją systemu (CC-056, tabela w
`cedar/entity-builder.md` sekcja 9, `schemas/common.schema.json` `ResourceIdPatterns`, w Javie `ResourceIds`).
Nazwy indeksów OpenSearch zaczynają się od litery lub cyfry, więc indeksy ukryte i systemowe (`.security`, `.ds-*`) nie
przechodzą (CC-074). Niepasujące identyfikatory są odrzucane w argumentach narzędzi, zasobach z resolvera
i mapowaniu zakresów. Walidatory JSON Schema w Javie często dopasowują wzorzec przez `Matcher.find()`, przy którym
`$` przepuszcza końcowe `\n` (`"ABC\n"`); komponenty, które walidują identyfikatory samym schematem JSON, wołają
dodatkowo `ResourceIds.isValid`, które dopasowuje całość. Serwer mimo to cytuje identyfikatory w JQL/CQL i buduje wzorce OpenSearch w postaci
`p,p-*`.

## Metody MCP i JWT (C2, C11)

Reguły wariantów JWT (CC-030, CC-033, CC-038, CC-069, CC-070):

| Żądanie | Wariant | `tool` |
| --- | --- | --- |
| `tools/call` (także ponowienie z `inputResponses` po `InputRequiredResult`, MRTR) | użytkownika | wymagany, `== params.name`, nowy JWT przy każdym ponowieniu |
| `initialize`, `server/discover`, `tools/list`, `ping`, `GET /mcp-manifest` | użytkownika albo serwisowy | zabroniony |
| `subscriptions/listen`, `notifications/*`, odpowiedzi JSON-RPC, `GET`/`DELETE` na endpoincie MCP | tylko użytkownika | zabroniony |
| broker `POST /v1/credentials/resolve` | tylko użytkownika | wymagany |
| broker `GET /v1/authenticator`, `POST /v1/authenticator/verify`, `POST /v1/authenticator/invalidate-codes` (z gateway'a, CC-092, CC-128) | tylko użytkownika | wymagany (narzędzie, które jest potwierdzane; dla `invalidate-codes` narzędzie operacji, która powoduje spalenie) |
| broker `GET /v1/systems` | użytkownika albo serwisowy | zabroniony |

Wariant serwisowy jest używany wyłącznie bez sesji (bezstanowo): wszystkie żądania w ramach sesji, w tym
`notifications/initialized` i `notifications/cancelled`, idą wariantem użytkownika (CC-070).

`prv` równe `00000000000000-0000000` oznacza gateway bez załadowanej paczki polityk (M1). To nie jest rewizja żadnej
paczki; odbiorca nie wnioskuje z niej o polityce. Od M2 gateway bez paczki nie wstaje (CC-068).

C11: w erze MCP 2026-07-28 kanał potwierdzenia "elicitation URL" to `InputRequiredResult` z żądaniem elicitation w
trybie URL, ponawiany `tools/call` niesie `inputResponses`. Elicitation może tylko otworzyć `previewUrl`; kod wpisuje
człowiek w kliencie (CC-091, 3.0.0).

## Potwierdzenia kodem TOTP (C11, od 3.0.0)

Akcję destrukcyjną potwierdza bieżący 6-cyfrowy kod z konta "MCP Platform" w aplikacji Authenticator, wpisywany w
kliencie AI (CC-091). Kod weryfikuje broker (C4 `verifyAuthenticatorCode`), gateway dostaje tylko wynik.

1. Pierwsze wywołanie: gateway pyta brokera o rejestrację (`GET /v1/authenticator`). Brak rejestracji: fail-closed,
   `confirmation_required` z samym `registerUrl`, bez oczekującego wywołania. Rejestracja jest: gateway zapisuje
   oczekujące wywołanie pod kluczem (`sub`, `serverId`, `tool`, SHA-256 kanonicznych argumentów bez
   `confirmation_code`), TTL 120 s, 3 próby, i odpowiada `confirmation_required` z `confirmationId`, `description`
   (opis liczony przez gateway), `previewUrl` i `expiresAt`. Powtórzone pierwsze wywołanie zwraca ten sam rekord bez
   przedłużania TTL. Powstanie oczekującego wywołania `DESTRUCTIVE` i unieważnienie poprzedniego to **jedna operacja
   atomowa na użytkownika** (warunkowy zapis albo blokada per `sub`); równoległe pierwsze wywołania dają najwyżej jedno
   oczekujące (`first-calls-parallel-*`). **Użytkownik ma najwyżej jedną oczekującą operację `DESTRUCTIVE`** (CC-127): nowa, inna operacja
   `DESTRUCTIVE` (inne narzędzie albo argumenty) unieważnia poprzednią. Poprzednia dostaje w audycie powód
   `superseded` (zdarzenie `confirmation`), a jej ponowienie z kodem kończy się błędem C10 `confirmation_superseded`
   (bez pytania brokera i bez zużycia próby lub kroku TOTP; ślad po unieważnionym wywołaniu gateway trzyma do końca jego
   pierwotnego TTL, potem to zwykłe `confirmation_failed`); podgląd unieważnionego wywołania to `404`. **Ślad nie jest
   oczekującym wywołaniem:** ponowne wywołanie unieważnionej operacji tworzy nowe oczekujące wywołanie (nowe
   `confirmationId`, nowy TTL, unieważnia bieżące `DESTRUCTIVE`) i zastępuje ślad `superseded` pod tym samym kluczem, więc
   kolejne ponowienie z kodem trafia w nowy rekord (`first-call-after-superseded-same-operation`, `retry-after-reissue`);
   ślady nie liczą się do limitu. **Ślad blokujący** (obejrzane, niepotwierdzone A: oczekujące, wyczerpane albo wygasłe) jest
   przechowywany osobno, na `sub`, nie pod kluczem operacji, i nie jest zastępowany przez nowe wywołanie tej samej
   operacji (A'); zasada "zastępuje ślad" dotyczy wyłącznie śladów `superseded`
   (`first-calls-sequence-exhausted-a-then-same-operation-then-b`). Limit oczekujących
   na `sub` (domyślnie 3) dotyczy już tylko potwierdzeń o innym ryzyku niż `DESTRUCTIVE` (wymaganych przez politykę) i
   daje `rate_limited` z `retryAfterSeconds` równym czasowi do wygaśnięcia najstarszego z nich.
2. Podgląd (`previewUrl`, C12 `GET /api/v1/confirmations/{id}`) jest **opcjonalny**: tylko odczyt, tylko właściciel,
   sesja bez świeżego MFA, `no-store`; kod działa także bez jego otwarcia. Ryzyko rezydualne przyjęte przez człowieka
   (2026-10-27): kod potwierdza obecność człowieka, nie operację. Podgląd pokazuje stan z chwili otwarcia i się nie
   odświeża: nowa operacja `DESTRUCTIVE` może unieważnić oglądaną przed wpisaniem kodu, a strona dalej ją pokazuje (frontend
   powinien ją odpytywać i po `404` pokazać "link nieaktualny"). **Pierwsza wygrywa po otwarciu podglądu** (CC-127): gdy
   właściciel otworzył podgląd oczekującej operacji `DESTRUCTIVE` A, inna operacja `DESTRUCTIVE` B jej nie unieważnia,
   tylko dostaje błąd C10 `confirmation_blocked` z `retryAfterSeconds` (czas do końca blokady) do czasu potwierdzenia A
   albo do `max(wygaśnięcie A, otwarcie podglądu + 90 s)`, także gdy A wyczerpało próby lub wygasło wcześniej;
   `retryAfterSeconds` ma zawsze co najmniej 1. Po końcu blokady kod wpisany dla A może być jeszcze ważny (do 90 s po
   wygaśnięciu A, np. podgląd otwarty od razu, a kod wpisany tuż przed końcem TTL), więc **tworzenie B po obejrzanym śladzie A w dowolnym stanie (oczekujące, wyczerpane, wygasłe, a także potwierdzone: drugi kod wpisany "dla A" mógłby potwierdzić B) najpierw woła u brokera `invalidate-codes`** (w tej samej sekcji per użytkownik co utworzenie B;
   błąd brokera to `upstream_unavailable` dla B i nic nie powstaje; nie dotyczy anulowanego A (anulowanie już spaliło kody) ani tej samej operacji, o ile A nie zostało wykonane; po **potwierdzonym** A spalanie dotyczy także tej samej operacji A' (drugi kod wpisany "dla A" mógłby potwierdzić A'; `first-call-preview-viewed-confirmed-same-operation-burns`); wektory
   `first-call-late-code-viewed-early-burns-before-creating-b` i `first-call-preview-viewed-confirmed-burns-before-b`). **Ślad obejrzanego A (w dowolnym stanie) gateway przechowuje co najmniej do `A.expiresAt + 90 s` (210 s od utworzenia), niezależnie od końca blokady; wcześniejsze usunięcie jest niezgodne z kontraktem** (inaczej tworzenie B po końcu blokady nie wiedziałoby, że ma spalić kody). Klient nie ma wtedy prosić użytkownika o kod dla B. Otwarcie podglądu zapisuje jawne
   wywołanie z wyrenderowanej, widocznej strony (`POST /api/v1/confirmations/{id}/viewed`), nie sam `GET`, więc prerender
   nie blokuje operacji; zapis i sprawdzenie przy B są atomowe względem siebie. **Anulowanie** (CC-128): właściciel może w
   podglądzie anulować oczekującą operację (`POST /api/v1/confirmations/{id}/cancel`, sesja i XSRF, bez MFA, bo niczego nie
   zatwierdza i nie jest to decyzja "zatwierdź"); anulowanie usuwa oczekujące wywołanie atomowo z weryfikacją kodu (kod wpisany
   równolegle po anulowaniu go nie potwierdza), zdejmuje blokadę, a następne ponowienie agenta dostaje `confirmation_cancelled`
   (audyt `cancelled_by_owner`, w `/activity/calls` wynik `cancelled`). Anulowanie **unieważnia też bieżące kody TOTP właściciela** u brokera (`POST /v1/authenticator/invalidate-codes`, wołane przez gateway przed usunięciem oczekującego wywołania; błąd to `503` i nic nie jest anulowane; pali tylko pierwsze skuteczne anulowanie, powtórzone jest zwykłym `204`; anulowanie obejrzanego śladu z wyczerpanymi próbami też jest dozwolone i zdejmuje blokadę): krok zegara brokera i następny są oznaczone jako zużyte, więc kod wpisany dla anulowanej operacji i trzymany przez agenta nie potwierdzi nowej (jest `burned` (wynik brokera) i nie liczy się do limitów 5/15 min i 20/24 h); poprawny jest dopiero kod z kroku o dwa dalej (po 30-60 s). Opis operacji w niezaufanym kliencie może się różnić od
   oczekującej niezależnie od tego, czy podgląd był otwarty. Audyt odróżnia oba przypadki
   (`user_confirmed` i `user_confirmed_no_preview`).
3. Ponowienie z tymi samymi argumentami i `confirmation_code` (wzorzec `^[0-9]{6}$`, pole dokładane do `inputSchema`
   poza `definitionHash`): kod o złym formacie to `invalid_argument` i nie zużywa próby. Gateway szuka oczekującego
   wywołania; gdy go nie ma, wygasło albo argumenty się różnią, odpowiada `confirmation_failed` bez pytania brokera
   (krok TOTP zostaje niewykorzystany). W przeciwnym razie woła brokera i mapuje wynik: `ok` wykonuje narzędzie i
   zużywa oczekujące wywołanie, `invalid`/`replayed` to `confirmation_failed` i -1 próba (przy 0 oczekujące
   wywołanie znika), `burned` (kod ze spalonego kroku) to `confirmation_failed` na zewnątrz jak `replayed` (bez nowej wyroczni), ale bez zużycia próby i bez liczenia jako błędny kod (`code_burned`), `locked` to `rate_limited` z `retryAfterSeconds` bez zużycia próby, `not_registered` to
   `confirmation_required` z `registerUrl`, błąd brokera to `upstream_unavailable` (kod nie jest "oddawany").
   **Atomowość (wymóg normatywny):** gateway rezerwuje próbę atomowo PRZED pytaniem brokera (dekrement `attemptsLeft`;
   rezerwacja wraca przy `locked`, `disabled`, `not_registered` i błędzie brokera, zostaje przy `invalid` i `replayed`), więc
   N równoległych ponowień daje najwyżej `attemptsLeft` pytań do brokera, a zużycie oczekującego wywołania przy `ok` to
   compare-and-delete (wykonuje się jedno). Wektory: `retries-parallel-*`.
4. Broker (RFC 6238: HMAC-SHA-1, 6 cyfr, krok 30 s, okno +-1 krok, każdy krok przyjęty raz): 5 błędnych kodów
   (`invalid` lub `replayed`) w 15 minut blokuje weryfikację użytkownika na 15 minut. Drugi, dzienny limit (CC-126):
   **20 błędnych kodów w 24 godziny** (okno kroczące; `invalid` lub `replayed`, nie liczą się odpowiedzi `locked` ani
   `malformed`, a sukces nie zeruje licznika) **wyłącza Authenticator** użytkownika (`state: disabled`, powód
   `daily_failure_limit`, zdarzenie `authenticator` z powodem `authenticator_disabled`) do ponownej rejestracji ze
   step-up MFA Entra; wyłączony Authenticator odpowiada `disabled` bez sprawdzania kodu, a gateway odsyła użytkownika
   pod `registerUrl` jak przy braku rejestracji. Wyłączenie dzienne **nie jest odblokowaniem** i nie zmienia zasady
   "blokada tylko czasem": blokady 5/15 min nikt nie zdejmuje, a wyłączony Authenticator nie wraca do życia, tylko
   zostaje zastąpiony nową rejestracją (jej aktywacja zeruje licznik dzienny i stan `disabled`, blokada użytkownika
   zostaje). Portal pokazuje stan i baner, ale nie ma przycisku odblokowania. **Atomowość (wymóg normatywny):** sprawdzenie "nie
   zablokowany, nie wyłączony", liczniki 5/15 min i 20/24 h oraz blokada to jeden krok atomowy na `sub` (serializacja albo
   rezerwacja próby jednym warunkowym zapisem przed obliczeniem TOTP); 50 równoległych błędnych kodów daje dokładnie 5
   sprawdzeń i resztę `locked` (`totp/concurrent-*`). **Blokada jest własnością użytkownika, nie rejestracji** (decyzja
   człowieka 2026-10-28): usunięcie, ponowna rejestracja i reset ją zostawiają, a aktywacja nowej rejestracji zeruje
   liczniki (krótki i dzienny) oraz stan `disabled`, ale nie blokadę (`activate` w `scripts/lib/totp.mjs`). **Blokada zdejmuje się tylko
   upływem czasu** (decyzja człowieka 2026-10-28): w portalu nie ma odblokowania, usunięcie i ponowna rejestracja jej
   nie zdejmują, reset przez `mcp-offboarding` też nie. Rejestracja w toku ważna 10 minut, trzy błędne kody ją
   niszczą. Rejestrację zakłada się i usuwa po świeżym MFA Entra (BFF, CC-093); zgubiony telefon: usunięcie
   rejestracji po MFA Entra i założenie od nowa, a gdy utracony jest też czynnik Entra, helpdesk woła
   `POST /v1/admin/users/{sub}/authenticator/reset` (CN `mcp-offboarding`).
5. Przechowywanie ziarna (wymóg normatywny, CC-092): ziarno aktywne i ziarno rejestracji w toku są szyfrowane wyłącznie
   przez Transit (bez envelope, jak poświadczenia) pod ścieżką `mcp/authenticators/<sha256(sub)>`, rekord po odszyfrowaniu
   zawiera `sub` porównywany z żądaniem, ziarno w toku żyje 10 minut i jest usuwane po aktywacji, po TTL i po trzecim
   błędnym kodzie; baza trzyma tylko metadane, ziarna nigdy jawnie w Redis ani w bazie. Broker ufa BFF co do świeżości MFA
   (mTLS CN `mcp-portal-bff`): świadome założenie. Ziarno wychodzi z brokera raz, w `201` rejestracji do właściciela (`no-store`, wyjątek w niezmienniku 4 planu), nigdy
   do logów, audytu ani sesji BFF. Kodu, ziarna i `otpauthUri` nie ma w C8 (pole `event: "authenticator"`, CC-094).
6. Nie ma decyzji "zatwierdź" ani "odrzuć" i nie ma endpointu decyzji: potwierdzenie to wyłącznie kod TOTP. Właściciel może tylko anulować oczekującą operację (pkt 2); bez tego odmowa to niewpisanie kodu, a oczekujące wywołanie wygasa po
   120 s. Kod `confirmation_declined` zniknął z C10. SPI `ConfirmationCodeSender` jest bezprzedmiotowe.
7. Ryzyko rezydualne i jego ograniczenia (niezmiennik 9 planu, decyzja człowieka 2026-10-27): kod TOTP nie jest
   związany z operacją, więc potwierdza obecność człowieka, a nie argumenty; zmanipulowany agent może pokazać opis
   operacji A, mając oczekującą B, i użyć kodu wpisanego dla B. Mechanizmy ograniczające, bez wymogu podglądu: jedna
   oczekująca operacja `DESTRUCTIVE` na użytkownika (bez otwartego podglądu nowa unieważnia starszą przed wpisaniem kodu i
   zostawia ślad w audycie; po otwarciu podglądu pierwsza wygrywa i nowa jest odrzucana, więc człowiek, który zobaczył
   operację w zaufanym kanale, nie traci jej po cichu; kod może potwierdzić najnowszą oczekującą `DESTRUCTIVE`, ale także jedno z oczekujących potwierdzeń o innym
   ryzyku, których to nie obejmuje, i tylko raz), TTL 120 s, 3 próby na wywołanie, blokada 5/15 min, wyłączenie po 20 błędach na dobę,
   jednorazowość kroku TOTP, opcjonalny podgląd w zaufanym kanale i audyt, który odróżnia potwierdzenie z podglądem
   (`user_confirmed`) od bez (`user_confirmed_no_preview`). Mechanizm "jedna operacja" bez podglądu nie zapobiega podmianie (agent może unieważnić A własnym B i dopiero B
   potwierdzić kodem), tylko zawęża liczbę oczekujących i zostawia ślad `superseded`; użytkownik, który nie otworzył
   podglądu, nie dostaje w chwili wpisywania kodu żadnego sygnału. Po otwarciu podglądu podmiana przez inną operację
   `DESTRUCTIVE` jest zablokowana do końca blokady (nie obejmuje to potwierdzeń o innym ryzyku); niechcianą operację właściciel może anulować w podglądzie (pkt 2), co blokadę zdejmuje. Konsekwencja limitu dziennego: agent może wyłączyć Authenticator
   ok. 20 błędnymi kodami (ok. godziny), czyli odmowa usługi dla potwierdzeń do ponownej rejestracji ze step-up MFA Entra
   (CC-126).
8. Reguła `destructive-requires-fresh-mfa` (`cedar/examples/step-up.cedar`, wektory `gw-destructive-*-mfa`) zostaje w
   przykładach bez zmian, ale **nie wchodzi do paczki produkcyjnej** (ws-09): użytkownik nie ma mieć dwóch mechanizmów.

**Zegary:** okna blokady i spalania liczy zegar gateway'a, ważność kodu zegar brokera; oba są synchronizowane NTP, rozjazd do 5 s, a margines 90 s obejmuje też telefon spieszący (łączny rozjazd do 30 s).

**Podgląd, anulowanie i wyczerpane próby:** `GET` i `viewed` dla wywołania, które wyczerpało próby, to `404`, gdy nigdy nie było oglądane (nic nie blokuje), a dla oglądanego `viewed` jest idempotentne i blokada trwa; anulowanie działa do `expiresAt` wywołania (potem `404`, choć blokada może trwać do 90 s dłużej) i dla oglądanego wyczerpanego śladu zdejmuje blokadę. Wymagania dla strony podglądu (ws-08): po `expiresAt` albo po `404` strona nie pokazuje operacji jako oczekującej i mówi "nie wpisuj kodu dla tej operacji"; przy błędzie `viewed` pokazuje, że ochrona "pierwsza wygrywa" nie jest aktywna.

**Utrata stanu potwierdzeń (niezmiennik 6, fail-closed):** stan potwierdzeń gateway'a (oczekujące wywołania, ślady, `previewViewedAt`) leży w
trwałym magazynie (Redis z `appendonly`, `maxmemory-policy noeviction`, przy replikacji `WAIT` dla zapisu widoku). Brak rekordu lub
śladu po restarcie albo failoverze to brak potwierdzenia (nigdy "potwierdzone"), a tworzenie `DESTRUCTIVE` przy niedostępnym magazynie to
`503 upstream_unavailable`. Gdy gateway nie może wykazać ciągłości stanu (brak znacznika epoki zapisanego przy starcie), przez 210 s od
startu pierwsze utworzenie `DESTRUCTIVE` na danym `sub` woła `invalidate-codes` przed utworzeniem (jak po obejrzanym śladzie), a pierwszy kod
przyjęty od użytkownika poprzedza takie wywołanie, żeby kod wpisany przed utratą stanu nie potwierdził nowej operacji.

Wektory: `test-vectors/confirmation-binding/` (pierwsze wywołanie i ponowienie, wynik brokera jest daną wejściową),
`test-vectors/totp/` (RFC 6238, okno, jednorazowość kroku, blokada, rejestracja, URI `otpauth`; ziarno testowe z RFC
6238, NOT FOR PRODUCTION), referencje w `scripts/lib/confirmation.mjs` i `scripts/lib/totp.mjs`.

## Jedna domena (CC-089)

Portal i gateway mają jeden publiczny origin za reverse proxy:

| Ścieżka | Cel |
| --- | --- |
| `/` | aplikacja web (fallback tras SPA na `index.html`) |
| `/api` | BFF (także callback OIDC BFF: `redirect_uri` pod `/api`) |
| `/mcp`, `/s/` | gateway (MCP); `/v/` zostało usunięte, gateway odpowiada na nie `404` (CC-177) |
| `/.well-known/oauth-protected-resource*` | gateway (RFC 9728, wariant ze ścieżką leży w korzeniu domeny) |

Zasady: adres publiczny (`url`, `clientConfigs`, `resource_metadata`) pochodzi z konfiguracji `publicBaseUrl`, nigdy z
`Host`/`X-Forwarded-Host` żądania; gateway ufa `X-Forwarded-*` tylko od proxy. Ciasteczka `__Host-session` i
`__Host-XSRF-TOKEN` mają `Path=/` (prefiks `__Host-` i odczyt przez SPA nie pozwalają na `/api`), więc proxy usuwa
nagłówek `Cookie` na trasach gateway'a, a gateway nie przekazuje `Cookie` dalej (do nagłówków usuwanych w C3:
`X-MCP-*`, `X-PAT-*`, `Authorization`, `X-Request-Id` dochodzi `Cookie`). Odpowiedzi gateway'a dla klientów MCP to
wyłącznie `application/json` i `text/event-stream`, także dla błędów (404, 405, 406, 5xx) i niezależnie od
`Accept`: gateway nigdy nie odpowiada `text/html` na trasach publicznych. Proxy dokłada na **każdej** trasie gateway'a
(`/mcp`, `/s/`, `/.well-known/oauth-protected-resource*`) `X-Content-Type-Options: nosniff` i `Content-Security-Policy:
default-src 'none'; sandbox`, na każdej odpowiedzi, także 4xx/5xx z upstreamu i własnych stronach błędów (nginx:
`add_header ... always`). Odpowiedzi tych tras nie niosą `Set-Cookie` (proxy go usuwa), BFF nie wysyła nagłówków CORS
(ten sam origin), a proxy przekazuje znormalizowaną ścieżkę i nie wystawia przez trasy publiczne ani `/admin/v1/*`,
ani JWKS gateway'a (osobny listener; `/s/../admin/v1/...` i `%2e%2e` dają 404). Proxy nie nadpisuje `X-Request-Id`
z BFF. Angular Router nie definiuje tras zaczynających się od `/api`, `/mcp`, `/s/`, `/v/`, `/.well-known/`. `/f/` nie jest zarezerwowane (CC-171).

## Jeden adres do całej platformy (CC-169 ... CC-177)

Od 5.0.0 nie ma zapisanych linków (`/v/<slug>/mcp`), tabeli `virtual_servers`, API linków (C5 i C12), limitu `MCP_VIRTUAL_SERVERS_MAX_PER_USER`, claimów `vs` i `vsc`, `context.virtualServer` i `context.vsScopes` w Cedar, pola `resourceDefaults`
ani zdarzenia `virtual_server_change`. Zawężanie zasobów w adresie nie istnieje; gdyby wróciło, wróci jako nowy CC z nowym claimem (np. `rsc`), nie ze starego `vsc` (CC-173).

**Adresy.** `<publicBaseUrl>/mcp` zwraca w `tools/list` wszystkie narzędzia, które użytkownik może teraz wywołać, ze wszystkich systemów: część wspólną zatwierdzonych, włączonych, obsługiwanych przez serwer i zgodnych z zatwierdzoną
definicją narzędzi z decyzją Cedar dla bieżącego tokenu (lista jest liczona przy każdym `tools/list`, nie zapisana; niezmiennik 5 bez zmian). Nazwy to `<system>__<narzędzie>`, a `tools/call` gateway kieruje po prefiksie do `mcp-<system>`; nie ma routera opartego na modelu.
`<publicBaseUrl>/s/<serverId>/mcp` zostaje (jeden system; `systems` w filtrze musi być tam puste albo równe systemowi trasy, inaczej `400`). System bez połączenia konta ma narzędzia widoczne, a wywołanie daje `credential_required` z `connectUrl`;
serwer niedostępny albo z niezgodną definicją jest pomijany na liście (przy wywołaniu `upstream_unavailable` albo `tool_disabled`, o ile filtr narzędzia nie wycina; kolejność w "Filtr w query"), a uszkodzona lista jednego serwera nie unieważnia pozostałych.
Odczyty `tools/list` serwerów idą równolegle, każdy z limitem czasu `MCP_TOOLS_LIST_TIMEOUT` (milisekundy, domyślnie `3000`, wartość niedodatnia zatrzymuje start; CC-180). Serwer jest niedostępny dla tej listy, gdy odczyt, który musiała wykonać (TTL 60 s), nie dał poprawnego wyniku w limicie: przekroczenie limitu, błąd połączenia lub TLS, status inny niż `200`,
treść niebędąca wynikiem `tools/list` albo niezgodna ze schematem; odczyt z pamięci podręcznej w TTL nie podlega limitowi. Pominięcie nie jest dowodem zmiany ani braku narzędzi (bez `definition_changed` i `tool_not_served`).
Lista ma najwyżej 100 narzędzi na stronę; dalsze strony niesie `nextCursor` (kursor nieprzezroczysty, związany z `sub` i filtrem, ważny 15 minut; zły kursor to zawsze `-32602`, także pusty napis `""` i `null` (CC-225): pierwsza strona to żądanie bez pola `cursor`; CC-181, CC-200). Klient, który nie idzie za `nextCursor`, widzi tylko pierwszą stronę. Kolejność listy jest stała: system według `ServerId`, w systemie nazwa narzędzia (bajtowo).
`initialize` zwraca ten sam `serverInfo` dla każdej postaci adresu. `/v/` odpowiada `404 not_found_or_denied` bez zdarzenia audytu, bez względu na token; kod przejściowy ani okres deprecjacji nie istnieją (CC-177). Wektory: `test-vectors/endpoint-aggregate/`.

**Filtr w query (CC-170).** `systems=` (id systemu bez `mcp-`), `tools=` (`<system>__<narzędzie>`), `access=read|write`, `exclude=` (wpis z `__` to narzędzie, inny to system). Wynik widoczny dla modelu to zbiór z `/mcp` przecięty z filtrem:
`systems` AND `tools` AND `access` AND NOT `exclude`; `tools` zawęża i niczego nie dodaje. `access=read` to narzędzia o ryzyku zatwierdzonego wpisu `READ_ONLY`, `access=write` to `UPDATE` i `DESTRUCTIVE` (zbiory rozłączne; brak parametru to oba).
Filtr działa na `risk` z rejestru, nie na `action` z manifestu serwera. Postać kanoniczna: parametry w kolejności `systems`, `tools`, `access`, `exclude`, wartości małymi literami, posortowane bajtowo, bez duplikatów, przecinek niekodowany, np. `systems=gitlab,jira&access=read`.
Wielkość liter w nazwach i wartościach nie ma znaczenia przy odczycie. `400` (`{"error":"invalid_request","reason":"invalid_filter"}`, schemat `EndpointFilterError`, bez `WWW-Authenticate`) dają: nieznany parametr (literówka `system=` nie może po cichu zdjąć filtra), parametr powtórzony, pusta wartość lub pusty wpis, `%` w query
(także zakodowany przecinek `%2c`), znak spoza `[A-Za-z0-9_,=&]`, wpis niezgodny ze składnią, `access` inne niż `read` i `write`, więcej niż 5 wpisów `systems`, 100 `tools` albo 100 `exclude` (po usunięciu duplikatów) oraz query dłuższe niż 512 bajtów.
Najpierw sprawdzany jest token (bez ważnego tokenu odpowiedź to `401` z wyzwaniem, także przy złym filtrze), potem filtr. Wpis składniowo poprawny, ale nieistniejący, bez uprawnień, wyłączony, oczekujący na zatwierdzenie albo z pominiętego serwera jest pomijany tak samo jak narzędzie bez dostępu (niezmiennik 8):
bez `400` i bez różnicy w odpowiedzi. Pusta część wspólna to `initialize` bez błędu i `{"tools": []}`. `tools/call` na narzędzie spoza wyniku to `not_found_or_denied`; audyt ma `reason: filter_scope`, gdy użytkownik ma prawo do narzędzia, a odcina je filtr, w pozostałych przypadkach powody dotychczasowe (`not_granted` itd.).
**Kolejność przy wywołaniu (CC-178):** najpierw `mayCall`, czyli wpis rejestru (w dowolnym stanie) i decyzja Cedar na poziomie narzędzia (ta sama, która kwalifikuje je do `tools/list`, bez argumentów), niezależna od dostępności serwera: brak to `not_found_or_denied` z `not_granted`, a zakaz (`forbid`, np. z paczki `overrides`) to ten sam kod klienta z powodem audytu `policy_forbid` (CC-198); wiersz aktywności użytkownika w obu przypadkach to `denied_not_granted`, żeby nie zdradzał istnienia narzędzia (niezmiennik 8).
Potem filtr: narzędzie wycięte to `not_found_or_denied` z `filter_scope`, bez względu na stan serwera, narzędzia i konta (stan nie wycieka). Dopiero narzędzie, które filtr zostawia, dostaje `tool_disabled`, potem `upstream_unavailable`, potem `credential_required`, a po nich decyzja Cedar z argumentami i bramka potwierdzenia `DESTRUCTIVE`.
Filtr poprzedza więc bramkę potwierdzenia: wywołanie wycięte nie tworzy, nie zużywa i nie unieważnia oczekującego potwierdzenia. Wektory `endpoint-filter/call-state-*`.
Query dłuższe niż limit transportu (około 15 KB, zależnie od wdrożenia) nie dociera do filtra: to `400` albo `414` w JSON `{"error":"invalid_request"}`, bez `reason` (schemat `TransportLimitError`, CC-189); `invalid_filter` obowiązuje do tego limitu.
Zdarzenia audytu odrzuceń, które klient może powtarzać (`invalid_filter`, `filter_mismatch`, `invalid_cursor` i `tools/call` z `not_found_or_denied`), są zapisywane najwyżej raz na użytkownika, powód i cel (nazwa narzędzia albo skrót filtra lub kursora; do 50 kluczy na użytkownika i powód, nadmiar dzieli klucz zbiorczy, CC-195) w interwale `MCP_RATE_LIMIT_AUDIT_INTERVAL` (domyślnie 10 s, stan w pamięci instancji, jak `RateLimitAuditThrottle`); resztę liczy `mcp_audit_endpoint_suppressed_total{reason}`, a po każdym oknie para (użytkownik, powód) dostaje jedno zdarzenie z `suppressedCount` (ile) i `suppressedTargets` (ile różnych celów); okno zamyka się po interwale od pierwszego zdarzenia okna niezależnie od ruchu, a zamknięcie procesu zapisuje podsumowania otwartych okien; odrzucenie działa zawsze (CC-190, CC-191). Wektory `endpoint-aggregate/audit-throttle-*`.
Wpis `tools` i `exclude` jest ograniczony 512 bajtami całego query, nie setką narzędzi: po `tools=` zostaje 506 bajtów, czyli 16 nazw po 30 znaków (31 po 15); większy wybór wyraża się przez `systems` i `exclude` (CC-185).
Filtr tylko zawęża: nigdy nie przyznaje, klient może go pominąć albo zmienić, więc nie jest granicą bezpieczeństwa. Referencja: `scripts/lib/endpoint-filter.mjs`, klasa Java `pl.aiwcorpo.mcp.manifest.EndpointFilter` (moduł `mcp-manifest`), wektory `test-vectors/endpoint-filter/`.

**Token IdP z claimami, które nie istnieją (CC-201).** Gateway czyta z tokenu klienta `iss`, `aud`, `sub`, `exp` i kilka znanych claimów; pozostałe, w tym `vs` i `vsc` usunięte w 5.0.0, ignoruje: token jest przyjęty albo odrzucony z powodu tych czterech, nie reszty. JWT wewnętrzny (C2) gateway buduje ze znanych pól i nie kopiuje claimów tokenu IdP, więc `vs` i `vsc` nie docierają do serwerów ani brokera (które i tak odrzucają je jako `invalid_claims`, CC-173). Wektory `idp-token-claims/`.
Niepoprawny escape w query (`%zz`, `%`, `%4`) to `invalid_filter` jak każdy `%` po dekodowaniu; kontener nie może odpowiedzieć `500` (CC-202, wektory `mcp-endpoint/http-broken-escape`, `http-lone-percent`, `http-half-escape`).

**OAuth (CC-171, wariant V2).** Identyfikator zasobu to `<publicBaseUrl>/mcp` bez query; `WWW-Authenticate: Bearer resource_metadata="<publicBaseUrl>/.well-known/oauth-protected-resource/mcp"` też bez query, a filtr jest tylko w adresie żądania MCP. Dokument metadanych ma `resource: <publicBaseUrl>/mcp`;
zapytanie o metadane z query dostaje ten sam dokument. `aud` tokenu pozostaje `mcp-gateway`, a gateway nie porównuje `aud` z adresem. Podstawa: test z 2026-10-31: Keycloak 26.8.1 odrzuca `resource` z query, a Claude Code z V2 zalogował się, odświeżył token po 27 minutach i zachował filtr.
**Przyjęte ryzyko:** V2 potwierdzone tylko dla Claude Code. Klient, który odrzuca `resource` bez query albo nie zachowuje query przy odświeżeniu tokenu, nie zadziała z filtrem do czasu dodania trasy `/f/` (nowy CC); `/mcp` bez filtra zadziała z każdym klientem zgodnym z RFC 9728.
Klient, który po prostu gubi query, łączy się z `/mcp` bez filtra i dostaje pełną listę bez błędu: to ciche poszerzenie widoku, nie uprawnień (Cedar rozstrzyga przy każdym wywołaniu; CC-187).

**Sesja (CC-172, CC-184).** Gdy protokół ma sesję (`Mcp-Session-Id`), znormalizowany filtr z `initialize` jest zapisany przy sesji, a każde następne żądanie sesji (także `DELETE`) musi mieć ten sam znormalizowany filtr; sesja nie przechodzi między użytkownikami ani trasami.
Bez sesji (MCP 2026-07-28, CC-070) filtr obowiązuje per żądanie. Przy HA wiązanie leży w Redisie razem z sesjami. Kolejność kontroli:

| Krok | Kontrola | Odpowiedź |
| --- | --- | --- |
| 1 | token | `401` z wyzwaniem (albo `503`) |
| 2 | składnia query | `400 invalid_filter`; zależy tylko od bajtów żądania, sesja nie jest czytana |
| 3 | `sub` sesji | sesja cudza albo nieznana: `404` jak dla nieznanej sesji, bez `filter_mismatch` |
| 4 | trasa sesji | inna trasa niż ta, na której sesja powstała: `404`, `filter_mismatch` |
| 5 | filtr po normalizacji | inny, dodany albo brak: `404`, `filter_mismatch` |

`Mcp-Session-Id` razem z `_meta` to żądanie sesyjne (kroki 2 do 5), `_meta` niczego nie wyłącza. Wiązanie porządkuje audyt (jedna sesja, jeden filtr) i nie jest barierą bezpieczeństwa: klient po `404` inicjuje nową sesję z innym filtrem, a uprawnienia wyznacza Cedar przy każdym wywołaniu.
`GET` na `/mcp` i `/s/<serverId>/mcp` to `405` z `Allow: POST, DELETE` (po sprawdzeniu tokenu), bo gateway nie wystawia strumienia serwera (CC-179). Wektory: `endpoint-filter/session-*` i `session-order-*`.

**Audyt i aktywność (CC-174).** Zdarzenia gateway'a `tool_call`, `policy_decision`, `confirmation` i `credential_resolve` mają opcjonalne pole `filter` (postać kanoniczna, najwyżej 512 znaków, tylko gdy żądanie miało filtr); `authentication`, serwery i broker go nie mają
(korelacja po `requestId`). Wpisy `filter` mają składnię nazw systemów i narzędzi, ale wybiera je klient i nikt ich nie porównuje z listą platformy (CC-186). Pole `virtualServer` zniknęło z C8 i C12. Powody: `filter_scope` (zastępuje `link_scope`; reguła SIEM na starą nazwę przestanie pasować), `invalid_filter` (`policy_decision`, wynik `error`, bez pola `filter`), `filter_mismatch`.
Wiersz aktywności ma `filter` zamiast nazwy linku i wynik `denied_filter_scope` (grupa `denied`).

**Kreator w portalu (CC-175).** Nic nie jest zapisywane. `GET /api/v1/me/mcp-endpoint?systems=&tools=&access=&exclude=` (C12) zwraca znormalizowany adres, `clientConfigs` zbudowane z `publicBaseUrl` (nigdy z żądania) i `toolCount`: liczbę narzędzi z katalogu użytkownika (`granted`, nie `disabled`), które filtr zostawia.
`toolCount` służy do ostrzeżenia o rozmiarze listy; `tools/list` gatewaya jest rozstrzygający. Zły filtr to `400 invalid_request` z `reason: invalid_filter`. Adres w poleceniu `claude mcp add` jest w cudzysłowie, bo zawiera `&`. Wektory: `test-vectors/mcp-endpoint/`.
BFF dostaje cztery parametry jako wartości typowane w OpenAPI, zdekodowane przez warstwę HTTP (przecinek wysłany jako `%2C` dochodzi jako `,`), i sam składa query (`composeQuery`); wartość, która po zdekodowaniu ma `%`, `&` albo `=`, jest złym filtrem. Mock MSW odrzuca to samo (CC-182).
Kreator mieści w adresie około 16 nazw narzędzi po 30 znaków (limit to 512 bajtów query, nie 100 narzędzi): pokazuje licznik bajtów i nie wysyła zapytania, którego nie da się złożyć (CC-185).
`POST /admin/v1/users/{sub}/purge` gatewaya zostaje (oczekujące potwierdzenia, ślady kodów, sesje MCP w Redisie, cache poświadczeń); traci tylko część "linki".

**Powiadomienia `list_changed` (CC-176, CC-179, CC-192; od 6.0.0 wymagane).** Gateway deklaruje `capabilities.tools.listChanged: true` na `/mcp` i `/s/<serverId>/mcp`,
w obu postaciach protokołu (z sesją i bezstanowej), i wysyła puste `notifications/tools/list_changed`, gdy zmienia się wynik `tools/list` danej sesji.
- **Wyzwalacze:** zatwierdzenie, wyłączenie (także wyłącznik awaryjny, CC-194), włączenie, zmiana definicji i usunięcie narzędzia; zmiana grup użytkownika albo rewizji paczki polityk (wykrywana przy odświeżeniu tokenu albo przy żądaniu, więc sesja bezczynna może dostać powiadomienie z opóźnieniem);
  zmiana dostępności serwera. Zmiana połączenia konta nie jest wyzwalaczem (lista się nie zmienia, zmienia się tylko wynik wywołania).
- **Zasady:** najwyżej jedno powiadomienie na sesję w oknie 1 s (zmiany w oknie łączą się w jedno, wysyłane na końcu okna, także gdy lista wróciła do poprzedniej); powiadomienie nie trafia do sesji, której filtr wycina zmienione narzędzia; powiadomienia nie są audytowane;
  opóźnienie od zdarzenia do powiadomienia najwyżej 5 s także przy wielu instancjach (decyzja człowieka, 2026-11-03) (zdarzenia rejestru i wyłączników idą do wszystkich instancji przez Redis pub/sub albo licznik wersji). **Zmiana paczki polityk jest wyjątkiem (CC-228, osłabienie obietnicy 5 s z 6.0.0 i 6.2.0, na którą mógł się opierać ws-10):** instancja wysyła `list_changed` po tym, jak sama załaduje nową paczkę, więc opóźnienie zależy od jej odpytywania paczki i nie ma gwarancji 5 s; gateway nie czeka na wszystkie instancje, a lista z `tools/list` jest zawsze liczona z paczki załadowanej na instancji, która odpowiada.
  Wektory: `endpoint-aggregate/list-changed-*` (decyzja o liście) i `list-changed-sequence-*` (okno 1 s).
- **`GET` na `/mcp` i `/s/<serverId>/mcp`** z `Accept: text/event-stream` i `Mcp-Session-Id` otwiera strumień. Kolejność kontroli jak w CC-184 (token `401`/`503`, składnia `400`, `sub` sesji `404`, trasa `404`, filtr `404` z `filter_mismatch`);
  `GET` bez sesji albo bez `Accept: text/event-stream` to `405` z `Allow: POST, DELETE, GET`. W postaci bezstanowej strumień otwiera `subscriptions/listen` (POST): nie ma sesji, strumień jest związany z filtrem tego żądania; kolejność kontroli to token (`401`/`503`), potem składnia filtra (`400 invalid_filter`), bez `filter_mismatch`, bo nie ma z czym porównać. Punktem odniesienia listy jest zawsze lista użytkownika z chwili otwarcia strumienia, którą zna instancja trzymająca strumień; `tools/list` obsłużone w międzyczasie (być może przez inną instancję za balancerem) nim nie jest (wektory `endpoint-filter/stream-open-stateless-*`, `endpoint-aggregate/list-changed-stateless-*`; decyzja człowieka, 2026-11-03, CC-207). Wektory `endpoint-filter/stream-open-*`.
- **Klasyfikacja w tokenie sidecara adaptera (CC-226, od 6.3.1).** Dla `tools/call` narzędzia serwera w trybie adaptera gateway dodaje do wariantu użytkownika wewnętrznego JWT claimy `mcp_risk` (`READ_ONLY`, `UPDATE`, `DESTRUCTIVE`) i `mcp_action` (`read`, `update`, `delete`, `admin`) z klasyfikacji administratora w rejestrze; zawsze razem, tylko z `tool` i tylko zgodną parą. Nazwy nie kolidują z `act` z RFC 8693. Schemat ma osobny wariant `AdapterUserClaims`, ale odbiorcy nie rozpozna schemat, więc obowiązuje reguła odbiorcy: **tylko sidecar adaptera przyjmuje te claimy; serwer natywny i broker odrzucają token z `mcp_risk` albo `mcp_action` jako `invalid_claims`** (pole `verifier.receiverMode` w wektorach `jwt/`). Gateway wysyła je wyłącznie do `serverId` w trybie adaptera. Sidecar, który dostaje `tools/call` bez tych claimów (starszy gateway, niezgodny tryb), odmawia (fail-closed, powód `classification_missing`, wektor `jwt/classification-missing-at-adapter`), tak jak narzędzie adaptera bez klasyfikacji liczy się jak `DESTRUCTIVE`; wartość inną niż `READ_ONLY` loguje i liczy (po CC-227 gateway jej nie wyśle). Serwer natywny i broker najprościej walidują względem `#/$defs/UserClaims` i `#/$defs/ServiceClaims`, nie korzenia, wtedy odrzuca schemat. Sidecar używa ich zamiast ryzyka zastępczego z podpowiedzi obcego serwera; claimy z tokenu IdP są ignorowane (wektor `idp-token-claims/with-classification-claims`). Wektory `jwt/valid-adapter-classification`, `classification-at-native-server`, `classification-at-broker`, `classification-risk-without-action`, `classification-without-tool`, `classification-pair-does-not-fit`.
- **Życie strumienia:** kończy się z wygaśnięciem tokenu, którym go otwarto (klient otwiera nowy), z `DELETE` sesji i z `purge` użytkownika. Zdarzenia nie są odtwarzane (`Last-Event-ID` jest ignorowane): po ponownym połączeniu klient wywołuje `tools/list`. Utrata powiadomienia nie psuje bezpieczeństwa, bo `tools/call` jest sprawdzane przy każdym wywołaniu.
- **Bez limitu strumieni na użytkownika, z limitem na instancję (CC-223).** Żaden strumień, ani `GET`, ani `POST subscriptions/listen`, nie liczy się do limitu żądań w toku (`MCP_MAX_CONCURRENT_REQUESTS`, CC-199), a liczba otwartych strumieni jest metryką gateway'a (CC-207). Instancja trzyma najwyżej `MCP_MAX_OPEN_STREAMS` otwartych strumieni (domyślnie 2000, `GET` sesji i `subscriptions/listen` razem; decyzja człowieka, 2026-11-03). Powyżej limitu otwarcie strumienia to `503` z `Retry-After` (`MCP_SHED_RETRY_AFTER_SECONDS`, domyślnie 2 s) i tym samym ciałem co przeciążenie z CC-199 (`upstream_unavailable`, bez `WWW-Authenticate`), a licznik odmów to metryka. Otwarcie strumienia jest zwykłym żądaniem dla limitów użytkownika i klienta (CC-135) i przechodzi wszystkie kontrole kolejności z CC-184 przed sprawdzeniem limitu; wpis strumienia jest zwalniany przy każdym końcu, także gdy odpowiedź nie wystartowała. Wektor `gateway-authentication/streams-limit-reached`.
- **Heartbeat strumieni (CC-207).** Gateway wysyła na każdym otwartym strumieniu SSE (`GET` i `POST subscriptions/listen`) linię komentarza SSE `: keepalive` co 15 s (`MCP_SSE_HEARTBEAT_INTERVAL`, domyślnie 15 s), żeby pośrednik nie zerwał bezczynnego strumienia. nginx nie odróżnia `subscriptions/listen` od innego `POST /mcp`, więc dla `/mcp` i `/s/...` obowiązuje to samo: `proxy_buffering off` i `proxy_read_timeout` co najmniej 60 s (czterokrotność heartbeatu). Zerwanie strumienia przez balancer jest `504` albo zamknięciem połączenia; klient otwiera nowy strumień i wywołuje `tools/list`.

**Semantyka dostarczenia (CC-204).** `tools/call` o ryzyku `READ_ONLY` można bezpiecznie ponowić. `UPDATE` jest dostarczane **co najmniej raz**: po błędzie o nieznanym wyniku (`502` z balancera, reset połączenia, limit czasu klienta) ponowienie przez klienta może wykonać operację drugi raz;
platforma nie wprowadza klucza idempotencji i gateway sam nie ponawia `tools/call` o ryzyku `UPDATE` ani `DESTRUCTIVE` do serwera. `DESTRUCTIVE` wymaga przy ponowieniu nowego potwierdzenia (kod TOTP jest jednorazowy, C11). Autor narzędzia `UPDATE` powinien, gdzie system docelowy pozwala, zaprojektować operację tak, by jej powtórzenie było nieszkodliwe.
Gdy instancja gatewaya padnie w trakcie żądania, balancer odpowiada `502` z ciałem `{"error":"bad_gateway","message":"The request may or may not have been processed. Check the result before repeating a write."}` (schemat `BalancerError`, tekst stały); to samo dla `504` (`gateway_timeout`, limit odczytu). Balancer nie ponawia żądania, które już wysłał: `proxy_next_upstream error timeout` **bez** `non_idempotent` (nginx nie przekazuje wtedy `POST` do kolejnego upstreamu po wysłaniu), więc przełączenie na inną instancję zachodzi tylko wtedy, gdy połączenie nie powstało (instancja martwa, `proxy_connect_timeout`). `non_idempotent` jest zabronione dla `POST /mcp` (CC-206); `proxy_next_upstream off` byłoby błędem w drugą stronę, bo usuwa przełączenie, gdy nic nie zostało wysłane, i daje `502` z tekstem o nieznanym wyniku bez powodu.

**Rozmiar listy i zasięg prompt injection.** Pięć systemów to kilkadziesiąt narzędzi, dwadzieścia systemów kilkaset; opisy narzędzi zużywają kontekst modelu i pogarszają wybór, więc powyżej progu, który wyznaczy pomiar M5, zalecany jest filtr `systems=` i `access=read`.
Jedna sesja sięga do wszystkich systemów użytkownika, więc tekst z jednego systemu (np. strona Confluence z wstrzykniętym poleceniem) może skłonić model do zapisu w innym. Uprawnienia się nie zmieniają (per użytkownik, DESTRUCTIVE z kodem TOTP, `UntrustedText`), ale zasięg rośnie;
filtr ogranicza zasięg, nie jest granicą bezpieczeństwa.

## Zapis tokenu (CC-090)

`PUT /api/v1/connections/{system}/secret` wymaga ważnej sesji i `X-XSRF-TOKEN`, bez step-up MFA. Od 2.2.3 zapis nie jest
chroniony porównaniem tożsamości (CC-101); użytkownik widzi podpięte konto (`backendUser`). `expiresAt` jest opcjonalną informacją użytkownika (prawdziwy termin PAT ustawia się w systemie
docelowym): broker przyjmuje każdą poprawną datę albo brak pola, a status `expiring` (< 7 dni) istnieje tylko przy podanej
dacie (CC-084).

## Doprecyzowania z fali M2 (2.2.4)

- **OAuth w C4 (CC-102):** `completeOAuth` odpowiada `400 invalid_request` dla systemu bez `user-oauth` (jak `oauth/start`); BFF
  mapuje błąd lub `503` tej operacji na `connectError=provider_error`.
- **`client_secret` klienta OAuth (CC-104, D6):** broker trzyma go w OpenBao w `secret/data/mcp/oauth-clients/<system>`, osobno
  od połączeń użytkowników (`mcp/connections/<sha256(sub)>/<system>`); żadna odpowiedź poza `resolve` go nie zwraca.
- **`CredentialRequired.connectUrl` (CC-105):** pole informacyjne; gateway buduje link z własnego `publicBaseUrl` i
  ignoruje wartość brokera (jedno źródło adresu portalu).
- **Port wewnętrzny gateway'a (CC-106):** `/admin/v1/*` i JWKS (C2) są na jednym porcie TLS. Klienci JWKS mogą nie
  przedstawić certyfikatu klienta (clientAuth), więc cel certyfikatu klienta sprawdza się w warstwie aplikacji dla
  `/admin/v1`, nie w handshake TLS (dotyczy też brokera i startera).
- **Metryki (CC-108):** `/actuator/prometheus` czyta scraper z certyfikatem clientAuth z CA wewnętrznego i CN `mcp-prometheus`
  (lista CN w konfiguracji komponentu; certyfikat z `gen-certs.sh` w ws-01).
- **Audyt zmian linków (CC-107):** historyczne; zdarzenie `virtual_server_change` i jego powody zniknęły w 5.0.0 razem z linkami (CC-174).
- **Wygasanie (CC-103):** `expiring` i `expiresAt` dotyczą tylko `user-secret` z podaną datą; `user-oauth` ma
  `expiresAt: null`.
- **Struktura wyniku (CC-112):** narzędzie z `outputSchema` zwraca `structuredContent` zgodny ze schematem; `UntrustedText`
  jest rekordem wyniku, pola systemu leżą obok; wiki markup konwertuje serwer (`format` to `text/plain` albo
  `text/markdown`).

## Whoami (C4.1)

Od 2.2.3 (CC-101) broker wywołuje whoami systemu docelowego po zapisie sekretu lub wymianie kodu OAuth **tylko** po to,
żeby sprawdzić ważność poświadczenia (`422 secret_invalid`) i odczytać `backendUser`. Nie porównuje go z tożsamością
SSO: ta sama osoba ma różne loginy w różnych systemach (np. `asmith` w Jirze, `alice.smith` w GitLabie), a e-mail
bywa niepewny. Od 3.0.0 kod `identity_mismatch` nie istnieje w żadnym enum (`PutSecretError`, `OAuthCompleteError`,
`ConnectErrorCode`), a katalog `test-vectors/whoami-identity/` (reguły porównania z 2.2.1 i 2.2.2, CC-100) jest usunięty.
Portal pokazuje "Połączono jako <backendUser>" po zapisie i w Połączeniach.

| System | Żądanie | Pole czytane jako `backendUser` |
| --- | --- | --- |
| Jira Data Center | `GET /rest/api/2/myself` | `name` |
| Confluence Data Center | `GET /rest/api/user/current` (CC-073) | `username` |
| GitLab | `GET /api/v4/user` | `username` |

OpenSearch (`token-exchange`) i service desk (`service-account`) nie mają tokenu użytkownika do sprawdzenia.

Odpowiedź 401 z systemu to `secret_invalid`.

## Higiena tekstu (CC-121, CC-122)

Jedna definicja dla gateway'a i serwerów (`scripts/lib/text-hygiene.mjs`, wektory `test-vectors/text-hygiene/`, pliki
w ASCII ze znakami jako `\uXXXX`). **Zbiór zakazany:** kontrolki C0 poza TAB, LF, CR; DEL i kontrolki C1; U+2028 i
U+2029; niesparowane surogaty; nieznaki (U+FDD0..U+FDEF, U+xFFFE i U+xFFFF); każdy znak `\p{Cf}` poza U+200C..U+200F
(ZWNJ, ZWJ, LRM, RLM), czyli m.in. U+200B, U+2060, U+FEFF, U+00AD, U+061C, kontrolki dwukierunkowości
U+202A..U+202E i U+2066..U+2069 oraz znaki tagów U+E0000..U+E007F; znaki niewidoczne poza `\p{Cf}`: U+034F, U+115F,
U+1160, U+3164, U+FFA0, U+2800 i selektory wariantów U+FE00..U+FE0F oraz U+E0100..U+E01EF, z wyjątkiem pojedynczego U+FE0F
bezpośrednio po znaku emoji (`Extended_Pictographic`).

- **Argumenty narzędzi:** znak ze zbioru zakazanego daje `invalid_argument` (C10, komunikat bez wartości). W wartościach
  z `pattern` (identyfikatory) zakazane są dodatkowo TAB, LF i CR. W argumentach przechodzących przez filtr wzmianek
  (serwer przekazuje tekst do systemu, który interpretuje wzmianki) zakazane są też znaki pełnej szerokości ASCII
  U+FF01..U+FF5E (np. "@all" zapisane znakami U+FF20 U+FF41 U+FF4C U+FF4C); sam ASCII `@all` obsługuje filtr startera, nie kontrakt.
- **Tekst z systemu** (`UntrustedText`, wyniki narzędzi): serwer zastępuje każdy maksymalny ciąg znaków zakazanych **jedną
  spacją** (bez przycinania i bez scalania z sąsiednimi spacjami), żeby usunięcie nie sklejało słów ("ignore" +
  U+200B + "previous").
- **Bez normalizacji Unicode:** nie stosuje się NFKC ani NFC. Ligatury, tekst pełnej szerokości i sekwencje łączące
  przechodzą bez zmian (poza zbiorem zakazanym); NFKC zmieniłby zwykły tekst i nie jest potrzebny, skoro znaki pełnej
  szerokości są odrzucane tam, gdzie mają znaczenie.

## Odpowiedzi gateway'a na odrzucone i niedostępne uwierzytelnienie (C1, CC-124)

Token klienta odrzucony po sprawdzeniu (`missing_token`, `malformed`, `bad_signature`, `unknown_kid`, `alg_not_allowed`,
`wrong_issuer`, `wrong_audience`, `expired`, `not_yet_valid`, `invalid_claims`): `401` z
`WWW-Authenticate: Bearer resource_metadata="<publicBaseUrl>/.well-known/oauth-protected-resource<ścieżka trasy>"`,
bez powodu (powód idzie do audytu), ciało `unauthenticated`. Gdy gateway nie może sprawdzić tokenu, bo nie ma
użytecznego zestawu kluczy IdP (JWKS niedostępny i brak użytecznej kopii, także nieznany `kid` przy nieudanym
odświeżeniu): `503` z ciałem `upstream_unavailable` (C10), **bez** nagłówka `WWW-Authenticate` (ani `invalid_token`, ani
`resource_metadata`: klient nie ma zaczynać logowania, które nie pomoże), z `Cache-Control: no-store`, bez `Set-Cookie`
i z `Retry-After`. **`Retry-After`: tak**, liczba całkowita sekund równa konfigurowanemu odstępowi ponowienia pobrania
kluczy (1..60, domyślnie 10): RFC 9110 dopuszcza go przy 503, a bez niego klienty i biblioteki ponawiają od razu i
dobijają niedostępny IdP; koszt to jedna stała konfiguracji. Pozostaje fail-closed (żądanie nie jest wykonywane).
**Przeciążenie i magazyn sesji (CC-199).** Żądanie, które gateway odrzuca, bo jest za dużo żądań w toku (`MCP_MAX_CONCURRENT_REQUESTS`, domyślnie 128, po `MCP_CONCURRENCY_QUEUE_WAIT`), to `503` z `Retry-After` (domyślnie 2 s, `MCP_SHED_RETRY_AFTER_SECONDS`), ciałem `upstream_unavailable`, `Cache-Control: no-store`, bez `WWW-Authenticate` i bez wywołania czegokolwiek za bramą.
Żądanie sesyjne, gdy gateway nie może odczytać ani zapisać sesji MCP (Redis), to `503` z `Retry-After` (domyślnie 10 s) i tym samym ciałem, nie `404`: sesja nie jest nieznana, jest nieczytelna. Wektory `gateway-authentication/overloaded`, `session-store-unavailable`. **Katalog bez stanu wyłączników (CC-224).** `GET /admin/v1/catalog` przy nieczytelnym stanie wyłączników to `503 upstream_unavailable` z `Retry-After`, nie katalog z narzędziem wyłączonym pokazanym jako dostępne (fail-closed, wektor `kill-switch/store-unreadable-catalog`).
Kolejność decyzji: najpierw kontrole niezależne od kluczy (brak tokenu, format, `alg`), więc `missing_token`, `malformed` i `alg_not_allowed` są zawsze `401`, także przy awarii IdP; dopiero potem wybór klucza. Nieznany `kid` powoduje najwyżej jedno pobranie kluczy na minimalny odstęp (po udanym pobraniu w tym odstępie to `401 unknown_kid` bez ponownego pobrania, po nieudanym `503`), żeby nie wzmacniać ruchu do IdP (`gateway-authentication-decision/`). Zdarzenie `authentication` z `reason: jwks_unavailable` i `errorCode: upstream_unavailable` zostaje. Wektory: `test-vectors/gateway-authentication/`.

## Treść z systemu w wynikach narzędzi (C10, C6)

Treść swobodna pochodząca z systemu (opis strony, komentarz, treść zgłoszenia, wiersz logu) jest zwracana jako
obiekt `UntrustedText` (`schemas/common.schema.json#/$defs/UntrustedText`, CC-072): `kind: "untrusted-data"`,
`format` (`text/plain` albo `text/markdown`), `text`, `truncated`; serwer może dodać własne pola (np.
`omittedMacros`). Narzędzie zwracające taką treść powinno deklarować `outputSchema` z tym kształtem, wtedy wchodzi on
do `definitionHash` (C6, CC-004). Gateway, klienci i testy ws-10 sprawdzają jedną regułę zamiast kształtów per serwer.

## Konto serwisowe service desku (C7)

Dla poświadczenia `service-account` serwer ocenia każdy zasób `ServiceDesk::*` względem kolejki zwróconej przez
system w chwili wywołania (zgłoszenie przeniesione do innej kolejki ma nową kolejkę, argument się nie liczy); brak
grantu kolejki w paczce polityk oznacza odmowę (niezmiennik 6, CC-076). Jedynym źródłem grantów kolejek jest paczka: lista kolejek
z konfiguracji serwera (`serverConfiguredQueues`, `MCP_SERVICEDESK_ALLOWED_QUEUES`) nie jest grantem i nie otwiera kolejki (CC-163). Reguła działa przed
Cedar i zostaje; wektory w `test-vectors/servicedesk-service-account/`, a nie w `policy-decisions/`. Od 4.0.0 model Cedar
niesie opcjonalne `context.credentialType` (CC-136) jako drugą linię obrony: gateway bierze typ z własnej konfiguracji systemu (tej samej,
której używa CC-159) i podaje go zawsze przed decyzją Cedar, serwer z własnej konfiguracji. Przykład `cedar/examples/credential-type.cedar`
jest fail-closed (brak atrybutu też daje odmowę) i zabrania odczytu kolejki lub zgłoszenia poza przyznanym zakresem przy koncie serwisowym;
reguła serwera z CC-076 zostaje i nie zależy od niego. Reguły przykładu rozpoznają poświadczenie użytkownika listą dozwoloną
(`user-oauth`, `user-secret`, `token-exchange`); brak typu albo nieznany typ jest traktowany jak konto serwisowe, czyli odmowa poza grantem (CC-164).

## Rejestr i przypinanie definicji (CC-097, CC-133)

Gateway trzyma dla każdego narzędzia zatwierdzoną definicję (jej odcisk to `definitionHash`) i nie pokazuje ani nie wykonuje
narzędzia, którego aktualna definicja jest inna. Reguły:

1. **Skąd jest manifest i kto go wysyła.** Ciało `PUT /admin/v1/registry/servers/{serverId}` to manifest zbudowany z przeglądanego commitu
   (artefakt etapu budowy, `target/mcp-manifest.json`), nigdy manifest pobrany z działającego serwera, a zadanie potoku działa tylko na chronionej
   gałęzi. Tożsamość potoku jest związana z serwerem (CC-161): certyfikat ma CN `mcp-registry-ci-<serverId>` (np. `mcp-registry-ci-mcp-jira`), a gateway
   przyjmuje go tylko dla `PUT` ze ścieżką o tym samym `serverId`; inny CN, także dawny `mcp-registry-ci`, to `403`, nic nie jest zapisywane, a audyt
   to `authentication` z powodem `client_certificate_rejected`. Wybrałem CN na serwer, a nie SAN z `serverId`, bo kontrakt już autoryzuje po CN
   (`x-allowed-client-cn`) i nie trzeba sprawdzać drugiego miejsca w certyfikacie. Potok jednego repozytorium nie zmieni więc wpisu cudzego serwera.
   Poza trybem dev gateway nie pobiera manifestu od serwera i nigdy go nie zatwierdza; bootstrap (pobranie manifestu od serwera) istnieje tylko w trybie
   dev (sekcja "Tryb produkcyjny i tryb dev") i też sprawdza `environment`.
2. **Co zatwierdza wdrożenie.** Przegląd commitu zatwierdza narzędzia, które nie zmieniają danych: nowe albo zmienione narzędzie `READ_ONLY`
   jest `approved` (`approvedInVersion` = wersja manifestu), wpis z niezmienionym `definitionHash` zostaje. Nowe albo zmienione narzędzie
   `UPDATE` lub `DESTRUCTIVE` jest `pending_approval` (`change` `new` albo `changed`, `pendingVersion` = wersja manifestu) i czeka na `approve`
   administratora (grupa `mcp-platform-admin`, hash równy `pendingHash`). Narzędzie, którego manifest już nie ma, jest usuwane. Audyt
   `admin_change` z `definitionHash`: `definition_registered` (zatwierdzone), `definition_submitted` (czeka), `tool_removed`; zatwierdzenie to
   `definition_approved` z `sub` administratora.
3. **Zmiana poza wdrożeniem blokuje narzędzie.** Odpowiedź na `tools/list` klientowi gateway buduje zawsze z zatwierdzonych wpisów, nie
   przekazuje jej z serwera. Gateway trzyma ostatnio widzianą definicję każdego narzędzia z `tools/list` serwera (odczyt odświeżany co TTL,
   konfiguracja, **najwyżej 60 s**) i porównuje ją z zatwierdzoną przy każdym `tools/list` klienta i przed każdym `tools/call`; okno, w którym
   zmieniony serwer może jeszcze obsłużyć wywołanie, to więc najwyżej 60 s. Różnica to `pending_approval` ze `source: server` i `change: changed`:
   definicja pochodzi z serwera, a `risk`, `action` i `resourceRefs` gateway bierze z zatwierdzonego wpisu (zmiana w runtime ich nie zmienia),
   `pendingHash` liczy z nich, a `pendingVersion` to wersja z `initialize`, wartość kontrolowana przez serwer, dlatego administrator widzi ją razem
   ze `source`. Narzędzie jest wtedy ukryte w `tools/list`, a wywołanie daje C10 `tool_disabled` (audyt: `definition_changed`), aż `approve`.
   Zatwierdzone narzędzie, którego serwer nie podaje w `tools/list`, jest ukryte tak samo (fail-closed): nie trafia do `tools/list` klienta,
   wywołanie daje `tool_disabled`; wraca, gdy serwer znów je poda. Audyt: przy każdym odrzuconym wywołaniu (nie raz na odczyt) `tool_call` albo
   `policy_decision` z `deny` i powodem `tool_not_served` (tak samo `definition_changed`), z `sub` wołającego. Nieudany odczyt `tools/list` serwera
   (niedostępny) nie jest dowodem ani zmiany, ani braku: gateway zachowuje ostatni udany odczyt, nie ukrywa wszystkich narzędzi i nie emituje tych
   powodów, a wywołanie, które wymaga świeżego odczytu, a dostaje błąd, jest odrzucane jako `upstream_unavailable` bez wołania serwera (fail-closed). Narzędzie, które serwer pokazuje, a którego nie ma
   w rejestrze, jest ignorowane (nie ma dla niego `risk` ani `action`); `change: new` powstaje tylko przy `PUT`.
   **Pierwszeństwo (CC-162):** wpis `pending_approval` ze `source: ci` (zostawiony przez `PUT`) nigdy nie jest zastępowany odczytem z serwera: różnica
   między serwerem a takim wpisem tylko blokuje narzędzie i jest logowana, a administrator zatwierdza ten sam wpis z commitu. Wpis ze `source: server`
   powstaje tylko tam, gdzie nie ma wpisu ze `source: ci`; nowszy odczyt z inną definicją zastępuje poprzedni wpis `server` (nowy `pendingHash`, więc
   `approve` ze starym hashem to `409`); znika, gdy serwer znów podaje zatwierdzoną definicję; `PUT` go zastępuje: gdy niesie inną definicję, powstaje wpis `ci`,
   a gdy niesie definicję równą zatwierdzonej, wpis `server` jest usuwany (serwer dalej podający inną definicję powstaje od nowa przy następnym odczycie). Wersja wpisu to `pendingVersion` (dla `ci` wersja manifestu, dla `server` wersja zgłoszona przez serwer).
4. **Podłoga ryzyka (CC-167).** Podłoga to najwyższe ryzyko, jakie kiedykolwiek zgłoszono dla narzędzia (także we wpisie oczekującym i w wpisach usuniętych); nie spada przy
   usunięciu ani ponownym dodaniu. `PUT` z narzędziem o ryzyku niższym od podłogi **nie odrzuca manifestu**: to jedno narzędzie staje się `pending_approval` (`source: ci`, `change` jak w regule 2: `changed`,
   a `new` z `approvedInVersion: null` dla narzędzia usuniętego i dodanego ponownie; `riskLowered: true`), pozostaje ukryte i odmawiane jako `tool_disabled`, a reszta manifestu przechodzi wg zwykłych reguł. `422` przy `PUT` zostaje dla pozostałych odrzuceń (niezgodny
   hash, reguły semantyczne manifestu, `environment_mismatch`, `credential_type_mismatch`, niezgodność z konfiguracją gateway'a). Wpis `riskLowered` zatwierdza wyłącznie administrator
   (`mcp-platform-admin`, nigdy potok): `approve` z `acceptRiskLowering: true` (BFF wymaga wtedy świeżego MFA, jak rejestracja Authenticatora: `401 step_up_required` ze `stepUpUrl`, to samo okno;
   zwykłe `approve` bez zmian i BFF wysyła pole tylko przy `true`), podłoga spada do zatwierdzonego ryzyka, a audyt to jedno zdarzenie `admin_change` z powodem `risk_lowered_by_admin`
   (zamiast `definition_approved`; pole `risk` niesie nowe ryzyko). Bez flagi `approve` takiego wpisu to `422 risk_lowered`; z flagą przy wpisie, który niczego nie obniża, pole jest ignorowane
   (`definition_approved`). Wpisy `source: server` podłogi nie podnoszą (`risk` pochodzi z zatwierdzonego wpisu). Reguła 4 wygrywa z regułą 2: także powrót do wcześniej zatwierdzonej definicji (np. cofnięty commit po omyłkowym
   zgłoszeniu wyższego ryzyka) jest zgłoszeniem poniżej podłogi i czeka na administratora; narzędzie jest ukryte do jego decyzji. Gateway ufa BFF co do świeżego MFA przy `acceptRiskLowering`
   (jak broker przy Authenticatorze, CC-093): przyjmuje `approve` tylko od CN `mcp-portal-bff` z tokenem administratora.
5. **Ryzyko rezydualne przyjęte przez człowieka (2026-10-29).** Zmiana nazwy z obniżeniem ryzyka w jednym `PUT` (usunięte narzędzie zapisu
   i nowe narzędzie `READ_ONLY` w tym samym manifeście) przechodzi bez `approve`: gateway nie wiąże ich ze sobą. Chronią przegląd commitu
   i reguły startera dla `risk` i `action`.
6. `RegistryTool.change`, `approvedInVersion` i `PendingTool.pendingVersion` są informacyjne (widok administracji); decyzja zawsze wiąże
   `definitionHash`. Nie ma operacji "odrzuć": brak zatwierdzenia to narzędzie ukryte (fail-closed).

### Serwery obce przez adapter (CC-193)

Adapter (`mcp-server-adapter`, sidecar obcego serwera MCP) wysyła rejestrowi przy starcie manifest z `source: adapter` operacją `PUT /admin/v1/registry/adapters/{serverId}` (`submitAdapterManifest`, CC-206). Certyfikat adaptera ma CN `mcp-adapter-<serverId>` (porównanie całego CN, jak dla potoku, CC-161), inny niż `mcp-registry-ci-<serverId>`: potok nie użyje tej operacji, a adapter `registerServer`. Które `serverId` obsługuje adapter, ustala konfiguracja gatewaya, nigdy manifest: dla takiego `serverId` `registerServer` odpowiada `422` (`adapter_mode_mismatch`), dla innego tak odpowiada `submitAdapterManifest`, a manifest bez `source: adapter` na kanale adaptera albo z nim na kanale potoku też jest `422`. Kolejność odpowiedzi (CC-207): najpierw certyfikat (`403`), więc wywołujący bez właściwego CN nie dowie się, w jakim trybie jest serwer; potem `serverId` w ciele względem ścieżki (`400`); potem tryb i `source` (`422`). Odpowiedź `200` adaptera (`AdapterRegistryServer`) nie niesie `classifiedBy` ani `classifiedAt`: adapter nie zna tożsamości administratorów. Narzędzie nieobecne w manifeście adaptera jest usuwane wraz z klasyfikacją admina; gdy wróci, jest nowe i wymaga ponownej klasyfikacji (decyzja człowieka, 2026-11-03). Wywołanie niczego nie zatwierdza: każde nowe lub zmienione narzędzie jest `pending_approval` z `source: adapter`, także wyglądające na odczyt, a wpis bez zmiany hasha zostaje ze swoją klasyfikacją (wektory `adapter-registry/`). Różnica znaleziona przy odczycie `tools/list` działającego serwera w trybie adaptera daje oczekujący wpis z `source: adapter` (nigdy `server`), więc `approve` wymaga klasyfikacji, a poprzednia nie jest stosowana po cichu. Hash wpisu adaptera liczy się zawsze z wpisu manifestu, bez `risk` i `action`, także gdy wpis wzbogacono klasyfikacją z rejestru (kontrola trzymanych manifestów na starcie). Demo i pierwsze wdrożenie adaptera dotyczą pięciu znanych systemów (`SystemId`, `ServerId`, schemat Cedar); obcy serwer na szóstym systemie wymaga zmiany major (nowy system), o którą decyduje człowiek po M6. Wektory `registry-approval/` pokrywają `classification_required`, `classification_not_allowed`, obniżenie klasyfikacji i narzędzie niesklasyfikowane. Wpisy takiego manifestu **nie mają** `risk` ani `action` (adapter nie klasyfikuje, wektory `invalid-adapter-risk-claimed`, `invalid-adapter-action-claimed`) i mają puste `resourceRefs` (polityki są na poziomie narzędzia).
`definitionHash` takiego wpisu obejmuje definicję, `resourceRefs`, `system` i `credential`, **bez** `risk` i `action` (klucze nie występują w płaskim obiekcie; wektor `definition-hash/get-issue-adapter-without-classification`).
Wpis dostaje w rejestrze `source: adapter`, nigdy nie jest zatwierdzany automatycznie i do zatwierdzenia jest ukryty i odmawiany jako `tool_disabled`. Administrator zatwierdza go przez `approve` z `risk` i `action` (bez nich `422 manifest_rejected`, `reason: classification_required`;
dla wpisu spoza adaptera `classification_not_allowed`). Od 6.3.0 adapter jest tylko do odczytu (CC-227): `risk` inne niż `READ_ONLY` dla wpisu adaptera to `422 classification_not_allowed`, dopóki kontrakt nie da adapterowi zakresu zasobów. Klasyfikacja `UPDATE` albo `DESTRUCTIVE` zapisana wcześniej (6.2.x) traci ważność: gateway przy starcie przenosi taki wpis do `pending_approval` (`source: adapter`, nowy `pendingHash` = zapisany hash, ukryty, `tool_disabled`). Unieważniona klasyfikacja zostaje podłogą (CC-167), więc ponowne `approve` jako `READ_ONLY` jest obniżeniem: wymaga `acceptRiskLowering` i świeżego MFA administratora w portalu, bez wyjątku, audyt `risk_lowered_by_admin` (wektory `registry-approval/stored-update-classification-is-hidden`, `adapter-invalidated-update-*`, `adapter-invalidated-destructive-*`). Klasyfikacja jest daną rejestru poza hashem: rejestr zapisuje `risk`, `action`, administratora i czas (`classifiedBy`, `classifiedAt`), katalog i Cedar biorą je stamtąd, a audyt to `admin_change` z `definition_approved`, nowym `risk` i nowym `action` (pole `action` zdarzenia odróżnia klasyfikację od zwykłego zatwierdzenia). `risk` i `action` muszą do siebie pasować (`read` tylko dla `READ_ONLY`, `update` dla `UPDATE`, `delete` dla `DESTRUCTIVE`, `admin` dla `UPDATE` albo `DESTRUCTIVE`), inaczej `422 classification_inconsistent`.
Obniżenie wcześniejszej klasyfikacji podlega podłodze ryzyka i `acceptRiskLowering` (CC-167). Zmiana definicji obcego narzędzia zmienia hash i wpis wraca do oczekujących; poprzednia klasyfikacja jest pokazana adminowi jako sugestia, nie stosowana. `annotations` obcego serwera są niezaufanymi podpowiedziami i nie są nigdy czytane jako ryzyko.
Adapter publikuje definicje zamknięte i ograniczone (CC-078, CC-123) i sprawdza argumenty przed przekazaniem wywołania; kontrakt nie łagodzi wymagań wobec definicji.

### Wyłącznik awaryjny (CC-194)

Administrator (`mcp-platform-admin`) wyłącza serwer albo pojedyncze narzędzie operacjami `PUT` i `DELETE` na `/admin/v1/registry/servers/{serverId}/kill-switch` i `/admin/v1/registry/servers/{serverId}/tools/{tool}/kill-switch` (C5), lista aktywnych: `GET /admin/v1/kill-switches`. W portalu: `PUT`/`DELETE` pod `/api/v1/admin/...` (C12).
- **Skutek:** wywołanie dostaje `tool_disabled` (C10) z powodem audytu `kill_switch`, narzędzie znika z `tools/list` i katalogu (`disabled: true`, `disabledBy: kill_switch`), serwer wyłącza wszystkie swoje narzędzia. Przyjęte wcześniej wywołanie nie jest przerywane; oczekujące potwierdzenie `DESTRUCTIVE` wyłączonego narzędzia kończy się przy potwierdzeniu `tool_disabled`.
- **Kolejność (CC-206):** przełącznik jest stanem narzędzia jak inne (CC-178): sprawdza się go po `mayCall` i po filtrze adresu. Użytkownik, który nie może wywołać narzędzia, albo którego filtr je wycina, dostaje `not_found_or_denied` (powody `not_granted`, `filter_scope`), nigdy `tool_disabled`, które zdradziłoby istnienie narzędzia (niezmiennik 8). Nieczytelny magazyn przełączników to `upstream_unavailable` dla każdego, kto dotarł do tego kroku. Wektory `kill-switch/call-user-without-access`, `call-outside-filter`, `endpoint-filter/call-state-kill-switch-*`.
- **Trwałość:** przełącznik jest zapisany w bazie rejestru i przeżywa restart. Należy do adresu (serwer, narzędzie), nie do manifestu: narzędzie, które znika z manifestu, zachowuje przełącznik (jest na liście i działa, gdy narzędzie wróci), a jego `DELETE` to `204`; `PUT` dla narzędzia nieznanego rejestrowi to `404`. `approve`, ponowny `PUT` manifestu i rejestracja go nie zdejmują; zdejmuje go tylko `DELETE` tego samego zakresu (zdjęcie przełącznika narzędzia nie zdejmuje przełącznika serwera). Bez wygasania.
- **Fail-closed:** gateway, który nie potrafi odczytać stanu przełączników, odmawia wywołania (`upstream_unavailable`) i nic nie wymienia na liście; zapis, który się nie udał, to `503`, nigdy `204`.
- **Propagacja:** po `204` skutek na każdej instancji najpóźniej po 5 s (zapis w bazie, unieważnienie przez wspólny kanał, a instancja czyta stan z pamięci podręcznej nie starszej niż 5 s i nie przedłuża jej, gdy odczyt zawiedzie).
- **MFA:** włączenie bez świeżego MFA (incydent nie czeka na drugi składnik), zdjęcie po świeżym MFA administratora w portalu (`401 step_up_required`).
- **Audyt:** `admin_change` z `kill_switch_set` i `kill_switch_cleared` (sub administratora; tekst `reason` z żądania zostaje w rejestrze i portalu, nie w zdarzeniu); odmowy to `tool_call` deny z `reason: kill_switch`, `errorCode: tool_disabled`; wiersz aktywności `tool_disabled`.
System i serwer oznaczają tu to samo (`mcp-<system>`). Wektory `kill-switch/`.

## Retencja i offboarding (CC-134, CC-155)

- **Dwie warstwy.** Tabela aktywności portalu (`/activity`, `/activity/calls`) to konfiguracja komponentu, domyślnie 30 dni (nie stała
  kontraktu). Pełny audyt C8 idzie na stdout do SIEM, gdzie retencja wynosi 365 dni (po stronie SIEM, poza platformą). Aktywność
  odchodzącego użytkownika zostaje do końca retencji tabeli jako dowód; `purge` jej nie kasuje.
- **Offboarding to trzy niezależne, idempotentne wywołania**, w dowolnej kolejności (zalecana: najpierw IdP/IGA, żeby tokeny przestały
  się odnawiać): usunięcie grup w IdP/IGA, `POST /v1/admin/users/{sub}/purge` brokera (C4) i `POST /admin/v1/users/{sub}/purge`
  gateway'a (C5), oba z certyfikatu `mcp-offboarding`, bez tokenu. Broker usuwa połączenia i sekrety (wszystkie wersje), przepływy
  OAuth, rejestrację Authenticatora i wiersz blokady, i publikuje `credential.invalidated`; gateway usuwa oczekujące
  potwierdzenia, sesje MCP w Redisie i cache poświadczeń (do 4.x także linki). Audyt: `connection_change`/`user_purged`, `authenticator`/`authenticator_removed`.
- **Sesje portalu** kończy back-channel logout z IdP (nie ma osobnego endpointu), a token klienta MCP wygasa najdalej po 60 minutach (C1).
  **Okno przyjęte przez człowieka (2026-10-29):** po `purge` nie blokujemy `sub`; token wydany wcześniej działa do wygaśnięcia, więc przez
  najwyżej 60 minut odchodzący może jeszcze użyć systemu, który nie wymaga jego połączenia (konto serwisowe Service Desku). `purge` powtórzony
  po wylogowaniu jest bezpieczny i zalecany (otwarty przepływ OAuth mógł utworzyć połączenie po pierwszym).
- **Ślad w audycie:** każde wywołanie `purge` (broker i gateway) zostawia jedno zdarzenie `admin_change` z powodem `user_purged`, także gdy nic nie było
  do usunięcia i dla nieznanego `sub` (odpowiedź `204` jest ta sama); do tego zdarzenia per połączenie.
- **Czyszczenie nieużywanych połączeń.** Po okresie bez użycia (konfiguracja brokera, domyślnie 180 dni) broker usuwa połączenie;
  audyt `connection_change` z powodem `unused_cleanup`. Wcześniej portal oznacza je jako wygasające (bez przypomnień).

## Limity zapytań (CC-135, CC-156)

Wartości limitów to konfiguracja komponentu, nie kontrakt. Kontrakt mówi tylko, co dostaje wywołujący i co trafia do audytu.

- **Wymiary w gateway'u** (liczniki w Redisie): na użytkownika, na parę (użytkownik, klient AI) i na parę (użytkownik, narzędzie).
  Dla narzędzi `DESTRUCTIVE` można ustawić osobny, niższy limit jako konfigurację per narzędzie (kontrakt się nie zmienia).
- **`tools/call` ponad limit:** wynik narzędzia C10 `rate_limited` z `retryAfterSeconds` (liczba całkowita, co najmniej 1); wywołanie
  nie dociera do serwera ani brokera. **Inne żądania MCP** (`initialize`, `tools/list`, ...): HTTP `429` z `Retry-After` (sekundy, co
  najmniej 1) i ciałem `{"error":"rate_limited","message":...,"retryAfterSeconds":n}`, bez `WWW-Authenticate` (klient ma czekać, nie
  logować się od nowa, jak w CC-124). Nigdzie nie ma nagłówków `X-RateLimit-*`: nie zdradzamy ustawień. Wektory:
  `gateway-authentication/rate-limited*.json`.
- **Audyt:** `tool_call` (dla `tools/call`) albo `policy_decision` z `decision: deny`, `outcome: denied`, `errorCode: rate_limited`
  i powodem `rate_limited_user`, `rate_limited_client` albo `rate_limited_tool` (klient nie dowiaduje się, który limit, administrator tak).
  Gateway może agregować nadmiar jak przy CC-125. W `activity/calls` wiersz ma wynik `rate_limited` (grupa filtra `denied`). Wynik wiersza wynika z powodu ostatniego zdarzenia (CC-165): `rate_limited_*` -> `rate_limited`, `definition_changed` i `tool_not_served`
  -> `tool_disabled`, `exchange_denied` -> `denied_not_granted`, a dla `tool_call` z `outcome` innym niż `ok` także `not_granted`, `filter_scope` (do 4.x `link_scope`), `policy_forbid`, `step_up_required`
  (wcześniej taki wiersz miał wynik `error`). Portal nie proponuje `request_access` na podstawie samego `result`: C10 `access_denied` nie niesie `requiredEntitlements`.
- **Redis niedostępny:** limity w gateway'u fail-closed. Gdy licznik nie odpowiada, `tools/call` daje C10 `upstream_unavailable`, a inne żądania MCP HTTP `503` z ciałem
  `{"error":"upstream_unavailable","message":...}` (kształt C10), `Retry-After` jak w CC-124, bez `WWW-Authenticate` i bez `Set-Cookie` (CC-167); gateway nie przepuszcza ruchu bez liczenia.
  Wektor `gateway-authentication/rate-limit-store-unavailable`. Audyt: powód `upstream_unavailable` na zdarzeniu `tool_call`/`policy_decision`.
- **Broker i BFF:** start i zakończenie przepływu OAuth w brokerze (na `sub`), zapis tokenu i operacje Authenticatora w BFF (na sesję):
  `429 rate_limited` z `Retry-After`. Rejestracja Authenticatora: domyślnie 10 startów na godzinę na `sub` (CC-151).

## Poświadczenia token-exchange i konto serwisowe (CC-157, CC-158, CC-159)

Opisy w `resolveCredential` (C4):

- **`token-exchange`** (OpenSearch): gateway wymienia token użytkownika (C1) na token dla brokera (`aud=mcp-credential-broker`, RFC 8693)
  i podaje go w `subjectToken`; broker wymienia go w IdP na token dla systemu (`aud` i zakres z konfiguracji systemu) i zwraca
  `type: token-exchange`, `scheme: Bearer`, `expiresAt` zawsze podany (nigdy `null`) i `cacheTtlSeconds` nie większe niż 60 i nie dłuższe niż
  do `expiresAt`. Nic nie jest zapisywane w sekretach. Odmowa IdP: `403 exchange_denied`, w C10 `access_denied` bez `requiredEntitlements`,
  audyt `credential_resolve` z powodem `exchange_denied`.
- **`service-account`** (Service Desk): klucz konta jest w OpenBao (`secret/data/mcp/service-accounts/<system>`); `scheme` zgodny z systemem
  (też `Basic`), `expiresAt` zgodne z rotacją albo `null`. Użytkownik nie ma połączenia, więc `GET /v1/connections` go nie zwraca.
- **`user-secret` jako `Basic` (CC-222, CC-213, od 6.3.1).** System, który przyjmuje `user-secret` jako login i hasło lub token (Jira i Confluence Cloud z e-mailem, OpenSearch klienta z własnymi kontami), ma w `GET /v1/systems` `userSecretScheme: Basic`; C12 przenosi to samo pole w `CatalogCredential`, więc portal pokazuje pole loginu dokładnie wtedy. `PutSecretRequest.username` razem z `secret` to jeden sekret; bez `username` dla systemu `Basic` i z `username` dla systemu `Bearer` broker odpowiada `400 invalid_request` (nie próbuje Bearer). `username` jest `writeOnly`, nigdy nie jest logowany ani zwracany (połączenie pokazuje `backendUser`); `resolve` zwraca `scheme: Basic` z `base64(login:secret)` (przykład `user_secret_basic`), a wartość po zdekodowaniu to login i hasło jawnym tekstem, więc nagłówek `X-MCP-Credential` nie trafia do logów (niezmiennik 7). `deployment` (`dc`, `cloud`) jest informacją i o polu loginu nie decyduje.
- **System bez konfiguracji w brokerze:** `422 system_not_configured` zamiast `400`; gateway odpowiada klientowi C10 `internal_error`, ale loguje
  odrębną przyczynę, a audyt `credential_resolve` ma powód `system_not_configured` (outcome `error`).
- **`context.credentialType` i nagłówek `X-MCP-Credential-Type` (CC-166, CC-167).** Konfiguracja systemu to **zbiór** dozwolonych typów (GitLab: `user-oauth` i `user-secret`, typ
  domyślny `user-oauth`); system nie miesza `service-account` z typami użytkownika (**norma, CC-168**: gateway odmawia startu przy takiej konfiguracji systemu, serwer odmawia startu, gdy `accepted-credential-types` miesza oba rodzaje, a rejestracja manifestu z takim `acceptedTypes` to `422 credential_type_mismatch`; wektor `manifests/invalid-credential-types-mixed`). Nagłówek niesie typ zwrócony przez broker (dla GitLaba typ połączenia użytkownika, np. `user-secret`
  dla PAT). Gateway odmawia przed użyciem poświadczenia, gdy ten typ nie należy do zbioru z konfiguracji systemu (C10 `internal_error`, audyt `credential_resolve` z powodem
  `credential_type_mismatch`). Serwer sprawdza, że nagłówek należy do zbioru jego dozwolonych typów (`accepted-credential-types`), **przed** oceną Cedar, sondą grantu i resolverami, tak by
  poświadczenie nie zostało użyte: dla żądania z `X-MCP-Credential` brak nagłówka, wartość spoza czterech typów albo spoza zbioru to odmowa (`internal_error` bez szczegółów, audyt
  `policy_decision`/`tool_call` z powodem `credential_type_mismatch`); serwer bez żadnego skonfigurowanego typu, który dostaje poświadczenie, też odmawia. Żądania bez poświadczenia
  (`initialize`, `tools/list`, wywołania rejestru) nie są sprawdzane. **`context.credentialType` w Cedar** to typ domyślny systemu z konfiguracji gateway'a (po stronie serwera: pierwszy typ z `accepted-credential-types`; nie ma osobnej właściwości): Cedar jest oceniany przed
  pytaniem brokera, więc typ faktycznie użyty nie jest jeszcze znany; reguły `credential-type.cedar` odróżniają konto serwisowe od poświadczenia użytkownika po tym typie domyślnym, a
  zbiór systemu nigdy nie łączy obu rodzajów. Wektory `credential-type-header/` (w tym GitLab z dwoma typami). Nagłówek jest w C3 od początku; nowa jest reguła serwera.
- **Założenie modelu zagrożeń (decyzja człowieka 2026-10-29).** Ruch gateway -> serwer chroni mTLS i podpisany JWT (C2), a gateway usuwa przychodzące `X-MCP-*`, więc uznajemy to za
  wystarczające: nagłówek typu nie jest podpisany i nie ma claimu typu w JWT. Sprawdzenie chroni przed rozjazdem konfiguracji, nie przed atakującym na ścieżce między gateway'em
  a serwerem; ten wymagałby osobnej decyzji (claim typu i skrót poświadczenia w JWT).
- **Manifest a konfiguracja gateway'a:** przy rejestracji i przy starcie gateway sprawdza, że typ poświadczenia, o który poprosi broker dla systemu,
  jest w `credential.acceptedTypes` manifestu; inaczej `422 manifest_rejected` z powodem `credential_type_mismatch`. Dotyczy **każdego typu ze zbioru systemu** (GitLab z `user-oauth` i `user-secret` wymaga obu w `acceptedTypes`), nie tylko typu domyślnego. Trzymany manifest, który
  nie przechodzi sprawdzenia przy starcie, nie jest zastępowany ani usuwany: serwer ma `enabled: false`, jego narzędzia dają `tool_disabled`, a gateway
  loguje przyczynę, aż zarejestrowany zostanie manifest, który przechodzi. **Kolejność migracji:** serwer OpenSearch (jego manifest deklaruje dziś
  `acceptedTypes: [user-secret]`, a konfiguracja gateway'a i brokera ma `token-exchange`) musi wyjść z `acceptedTypes` zawierającym `token-exchange`
  i być zarejestrowany **przed** startem gateway'a 4.0.0; inaczej serwer jest wyłączony po starcie.
- **Broker sprawdza `subjectToken`:** `aud` równe `mcp-credential-broker`, ważny `exp` i `sub` równe `sub` wewnętrznego JWT; inaczej `400 invalid_request`
  i audyt `subject_token_invalid`.

## Tryb produkcyjny i tryb dev (CC-137, CC-138)

- **Definicja.** Tryb produkcyjny jest domyślny: komponent, który nie dostał jawnej zgody, działa jak produkcja. Tryb dev wymaga **dwóch zgód**:
  profilu `devstack` (stos deweloperski) **i** jawnego ustawienia (zalecana nazwa `allowTestKeys`). Samo `allowTestKeys` bez profilu `devstack`
  nie włącza trybu dev; profil bez ustawienia też nie.
- **Rozróżnienie kluczy.** Klucze `test-` (opublikowane klucze wektorów) wymagają tylko `allowTestKeys`: tak działają testy jednostkowe komponentów bez stosu
  (CC-044). Klucze `dev-` wymagają trybu dev, czyli obu zgód; w wektorach pole `devstackProfile` obok `allowTestKeys`.
- **Klucze `dev-`.** Reguła CC-044 obejmuje też klucze, których `kid` zaczyna się od `dev-`: odbiorcy (serwery, broker, gateway, odbiorcy paczek)
  odrzucają je z powodem `test_key_not_allowed` poza trybem dev (samo `allowTestKeys` nie wystarcza). Stos dev generuje własne klucze z takim prefiksem; lista odcisków opublikowanych
  kluczy testowych zostaje bez zmian. Ograniczenie: dla paczek reguła czyta nazwę klucza z konfiguracji odbiorcy, którą nadaje operator, więc klucz
  dev skonfigurowany pod inną nazwą jej nie podlega (w trybie dev nie ma to znaczenia); a tryb dev włącza przy okazji opublikowane klucze testowe.
  Wektory (klucze nieopublikowane, spoza listy SPKI, więc odrzuca je wyłącznie prefiks): `jwt/dev-kid-rejected-by-default`,
  `jwt/valid-dev-kid-in-dev-mode`, `jwt/dev-kid-rejected-without-devstack-profile`, `bundles/dev-key-id-rejected-by-default`, `bundles/dev-key-rejected-without-devstack-profile`,
  `bundles/dev-key-accepted-in-dev-mode`.
- **Znacznik w manifeście.** Opcjonalne `environment` (`production` | `dev`; brak znaczy `production`, pole nie wchodzi do `definitionHash`).
  Gateway w trybie produkcyjnym odrzuca manifest z `dev` (`422 manifest_rejected`, powód `environment_mismatch`). Sprawdzenie obejmuje `PUT`,
  start gateway'a i bootstrap trybu dev; w trybie produkcyjnym bootstrapu nie ma.

## Audyt: żądania bez ważnego tokenu (CC-143, CC-152)

Odbiorca żądań bez poprawnego tokenu (serwer przez starter, broker, gateway) może ograniczyć liczbę zdarzeń `authentication`: osobny budżet
na powód dla `missing_token` i `malformed`, nadmiar liczy się tylko w liczniku `mcp_audit_authentication_suppressed_total{component,reason}`
(wspólna nazwa). Żądanie odrzucone `400` albo `413` zanim dojdzie do weryfikacji JWT (zły format, za duże) nie jest zdarzeniem `authentication`,
tylko wchodzi do licznika żądań, żeby nie mnożyć powodów.

## Doprecyzowania 4.0.0

- **Manifest powstaje przy starcie albo w budowie** (CC-140): starter generuje go w budowie (`target/mcp-manifest.json`, artefakt przeglądanego
  commitu) albo buduje przy starcie z `tools/list` serwera (`GET /mcp-manifest`, do porównania i do bootstrapu dev). Do `PUT` rejestru trafia
  wyłącznie artefakt budowy (CC-133).
- **Wektory `gateway-authentication/`** (CC-144): `resourcePath` to trasa (`/s/mcp-jira`), a metadane zasobu (RFC 9728) wskazują adres
  endpointu (`/s/mcp-jira/mcp`).
- **Znacznik epoki stanu potwierdzeń** (CC-145): zapis w jednym magazynie ze stanem potwierdzeń, ważny 210 s po utracie. Przy wielu
  instancjach gateway'a każda traktuje brak znacznika jako utratę stanu (opis C11 powyżej).
- **"Ostatnie użycie" konta serwisowego** (CC-150): portal liczy je z wierszy `/activity/calls` o wyniku `ok` lub `confirmed` (i `error`, jeśli
  wywołanie dotarło do systemu); odmowy i wygasłe potwierdzenia się nie liczą. Bez nowego pola.
- **Klasyfikacja** (CC-149), **kolejność ocen** i jeden tekst odmowy (CC-146), **pusty zakres** (CC-147), **przykłady polityk** zapisu (CC-148),
  **zapytania serwera** (CC-160): `cedar/entity-builder.md`.

## Korelacja żądań

Każde żądanie ma jeden `requestId` (UUIDv7) od wejścia do audytu: gateway nadaje go w `rid` i `X-Request-Id`
(C2/C3), BFF tworzy własny i wysyła go w `X-Request-Id` do brokera i gateway'a (CC-047). Broker zwraca użyty
identyfikator w nagłówku `X-Request-Id` każdej odpowiedzi. BFF zwraca go przeglądarce w `X-Request-Id` każdej własnej
odpowiedzi `/api/v1/*` (CC-087) i ignoruje wartość przysłaną przez klienta; odpowiedzi 502/504 generowane przez sam
proxy go nie mają, więc UI musi to obsłużyć.

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
            <version>2.2.0</version>
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
`flow_invalid`, `hash_mismatch`, `step_up_required`).

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
| `jwt/` | 66 | odbiorca C2: 23 poprawne, 43 odrzucenia (podpis, `kid`, klucz testowy i `kid` z prefiksem `dev-` (CC-137), `alg`, `iss`, `aud`, `exp` ze skew, `iat`, czas życia, `jti`, wariant serwisowy, obecność i zgodność `tool`, `rid` != `X-Request-Id`, claimy `vs`/`vsc` odrzucone jako `invalid_claims` (CC-173), token IdP, metody MCP 2026-07-28, wariant serwisowy poza listą, wywołania `authenticator` brokera z `tool`) |
| `manifests/` | 62 | manifest C6: schemat (w tym wymagane `title`), reguły semantyczne, zamknięty i ograniczony `inputSchema`, przeliczony `definitionHash` |
| `definition-hash/` | 13 | `definitionHash` (RFC 8785 + SHA-256), CC-004, CC-042 |
| `audit-events/` | 128 | zdarzenia C8, w tym zakaz argumentów, sekretów, kodów, ziarna i `otpauthUri`, znaków sterujących i bidi, odrzucone uwierzytelnienie (CC-071, CC-125), `authenticator`, pole `filter` (CC-174), usunięte `virtualServer` i `virtual_server_change` jako odrzucone |
| `tool-errors/` | 33 | każdy kod C10 + przypadki odrzucane (dwa kształty `confirmation_required`, `confirmation_superseded`, `confirmation_blocked`, `confirmation_cancelled`) |
| `bundles/` | 44 | paczki C7: podpis, klucz testowy, rollback, `overrides`, `latest.json`, bezpieczeństwo tar, usunięte `vsScopes` i `virtualServer` (CC-173), walidacja, mapowanie zakresów |
| `return-paths/` | 35 | `returnPath` C4/C12 (CC-032), od 3.0.0 bez prefiksów `/api`, `/s`, `/v`, `/.well-known`, od 5.0.0 także `/mcp` (CC-169; `/f/` wolne) i segmentów `.`/`..` oraz średnika, który serwery czytają jak parametr ścieżki (CC-099) |
| `entity-builder/` | 42 | wejście buildera (z mapowaniem zakresów) -> encje i kontekst Cedar |
| `policy-decisions/` | 79 | decyzje Cedar na politykach z `cedar/examples`, w tym hierarchia zakresów i wyszukiwanie |
| `result-filter/` | 7 | filtrowanie wyników i ograniczenie zapytania (CC-036) |
| `resource-ids/` | 10 | wzorce identyfikatorów per system (CC-056), w tym OpenSearch bez wiodącej kropki (CC-074) |
| `untrusted-text/` | 8 | kształt `UntrustedText` (CC-072) |
| `confirmation-binding/` | 77 | pierwsze wywołanie i ponowienie z kodem: oczekujące wywołanie, jedna operacja `DESTRUCTIVE`, mapowanie wyniku brokera (CC-091, CC-126, CC-127) |
| `totp/` | 46 | Authenticator brokera: RFC 6238, okno, jednorazowość kroku, blokada 5/15 min, limit dzienny, rejestracja, URI `otpauth` (CC-092, CC-126); ziarno z RFC 6238, NOT FOR PRODUCTION |
| `text-hygiene/` | 79 | zbiór zakazany w argumentach, identyfikatorach i filtrach wzmianek oraz zastępowanie w tekście z systemu (CC-121, CC-122) |
| `activity-calls/` | 57 | `ActivityCall` i agregacja zdarzeń jednego wywołania w wiersz (CC-095) |
| `gateway-authentication-decision/` | 12 | wybór powodu i statusu 401/503 ze stanu kopii kluczy, `kid` i odświeżenia (CC-124) |
| `activity-cursor/` | 9 | kursor `/activity/calls`: HMAC, związanie z `sub`, ważność 15 min (CC-095); klucz testowy, NOT FOR PRODUCTION |
| `gateway-authentication/` | 21 | 401 z `resource_metadata` (także dla `/mcp` z filtrem i bez query w wyzwaniu, CC-171), 503 bez `WWW-Authenticate` i z `Retry-After` (CC-124) albo 429 z `Retry-After` i ciałem `rate_limited` (CC-156) |
| `catalog-actions/` | 19 | akcje katalogu portalu per status, w tym `request_access` bez `requiredEntitlements` i `view_request` przy oczekującym wniosku (CC-083, CC-113) |
| `query-rendering/` | 26 | zapytania serwera ze struktury: JQL i CQL z wrogimi wartościami, wzorzec i rozwiązanie nazw indeksów OpenSearch (CC-160) |
| `credential-type-header/` | 13 | nagłówek `X-MCP-Credential-Type` a konfiguracja serwera: zgodność, rozjazd, brak, nieznana wartość (CC-166) |
| `servicedesk-service-account/` | 6 | kolejka konta serwisowego oceniana na wartości z systemu (CC-076) |
| `endpoint-filter/` | 119 | filtr w query `/mcp` (CC-170, CC-172, CC-178, CC-184): składnia i normalizacja, trasa `/s/`, zbiór widoczny (także ryzyko spoza zbioru), `tools/call` pod filtrem i ze stanem narzędzia, serwera i konta, wiązanie z sesją i kolejność kontroli, ciało `400`; Java wykonuje `parse`, `route`, `apply`, `call`, `session` |
| `endpoint-aggregate/` | 79 | lista `/mcp` jako część wspólna, kolejność, routing po prefiksie, dostępność serwera i limit czasu (CC-180), strony i kursor `tools/list` (CC-181), `list_changed` (materiał dla M6), `/v/` jako `404` (CC-169, CC-177) |
| `mcp-endpoint/` | 18 | odpowiedź BFF `GET /api/v1/me/mcp-endpoint`: adres, `clientConfigs`, `toolCount`, `400`, query złożone z zdekodowanych wartości (CC-175, CC-182) |
| `kill-switch/` | 18 | wyłącznik awaryjny: odmowa `tool_disabled` z powodem `kill_switch`, lista, potwierdzenie, fail-closed przy nieczytelnym stanie, `approve` i `PUT` nie zdejmują, zdjęcie per zakres (CC-194) |
| `balancer-errors/` | 3 | `502` balancera po awarii instancji w trakcie żądania, stały tekst o nieznanym wyniku (CC-204) |
| `adapter-registry/` | 13 | kanał adaptera: CN, tryb adaptera, pending z `source: adapter`, odczyt w czasie działania (CC-206) |
| `registry-approval/` | 20 | `approve` z klasyfikacją narzędzia adaptera, `classification_required`, `classification_not_allowed`, obniżenie (CC-193, CC-206) |
| `idp-token-claims/` | 8 | claimy tokenu IdP: `vs` i `vsc` ignorowane, nie kopiowane do JWT wewnętrznego (CC-201) |
| `oauth-metadata/` | 6 | dokument metadanych chronionego zasobu: `resource` bez query, query ignorowane, `/v/` jako `404` (CC-171, CC-187) |

Formaty:

- **JWT:** `token`, zdekodowane `header`/`claims` (informacyjnie), `verifier` (`issuer`, `audience`,
  `jwks` - ścieżka względem `test-vectors/`, `now` - zegar do wstrzyknięcia, `clockSkewSeconds`,
  `maxLifetimeSeconds`, `seenJtis` - stan magazynu `jti`, `receiverMode` - opcjonalny, `adapter` (sidecar adaptera), `native` (serwer natywny) albo `broker`; brak pola znaczy "nie sidecar", CC-226), `request` (metoda JSON-RPC i `toolName` albo
  żądanie HTTP), `expected` (`valid`, `httpStatus`, `reason`). Implementacja musi zgodzić się co do
  `valid`/`httpStatus`; `reason` nazywa wstrzyknięty defekt i pomaga w diagnozie.
- **Paczki:** `latest` (treść `latest.json`), `bundle`/`signature` (pliki w `bundles/files/`),
  `publicKey`, `channel` (`main`/`overrides`), `loadedRevision`, `expected` (`accept`, `reason`).
- **Pozostałe:** `description`, dane wejściowe i `expected`; opis w `cedar/entity-builder.md` (Cedar) i
  w testach `test/*.test.mjs`, które są też referencyjnymi weryfikatorami.

## Definicje `common.schema.json` jako stabilne API (CC-079)

Serwery czytają te definicje z jara kontraktów w chwili rejestracji narzędzia (starter: `@ArgumentLimits(contractPattern
= "<nazwa>")` bierze `pattern` i `maxLength`): `JiraProjectKey`, `JiraIssueKey`, `ConfluenceSpaceKey`,
`ConfluencePageId`, `GitLabGroupPath`, `GitLabProjectPath`, `OpenSearchIndexName`, `OpenSearchIndexPrefix`,
`ServiceDeskQueueId`, `ServiceDeskTicketId`. Zmiana nazwy albo usunięcie definicji z tej listy to **major**; zmiana
`pattern` lub `maxLength` podlega zwykłej tabeli SemVer (zaostrzenie to major, poluzowanie minor). Wzorce tych definicji
są te same, których używa `ResourceIds` w `mcp-cedar-entities` (wektory `resource-ids/` sprawdzają oba, CC-056,
CC-074). Test `test/schemas.test.mjs` pilnuje, żeby lista była kompletna względem `ResourceIdPatterns`.

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
7. `definition.title` jest wymagane (schemat, CC-115).
8. `inputSchema` jest zamknięty i ograniczony (CC-078, CC-123), reguły `input-schema-closed`,
   `input-schema-bounded`, `input-schema-no-combinators`: korzeń ma `type: object`, każdy obiekt ma
   `additionalProperties: false` (bez map otwartych, `patternProperties`, `unevaluatedProperties`); każdy węzeł ma
   `type`; każdy `string` ma `maxLength` (chyba że `enum`/`const`), każda tablica `maxItems` i `items` (także przy
   `prefixItems`), każdy `integer`/`number` `minimum` i `maximum` (chyba że `enum`/`const`), każdy `pattern` zaczyna się od
   `^`, kończy na nieeskejpowanym `$` i nie ma alternacji poza grupą (`^a|b$` nie jest zakotwiczony); brak `allOf`, `anyOf`, `oneOf`, `not`, `if`, `then`, `else`. Przy naruszeniu schematu serwer
   odpowiada `invalid_argument` (C10): komunikat może wskazać argument zadeklarowany w schemacie i regułę, nigdy wartość
   ani niezadeklarowaną nazwę.
9. `credential.acceptedTypes` albo zawiera samo `service-account`, albo same typy użytkownika (`user-oauth`, `user-secret`, `token-exchange`); mieszanie to reguła
   `credential-types-not-mixed` (CC-168), przy rejestracji `422 manifest_rejected` z powodem `credential_type_mismatch`.

## Wymagania dla odbiorców i paczek polityk

- Odbiorcy C2 i odbiorcy paczek domyślnie odrzucają klucze z identyfikatorem `test-*` i `dev-*`; `test-*` wyłącza jawne ustawienie
  (zalecana nazwa `allowTestKeys`) w testach i dev (CC-044), `dev-*` dopiero tryb dev: profil `devstack` i to ustawienie razem (CC-137). `mcp-policy-bundle` rozpoznaje opublikowane
  klucze testowe także po skrócie SPKI, niezależnie od identyfikatora w konfiguracji; odbiorcy C2 powinni robić to
  samo z kluczami z `test-vectors/keys/test-gateway-jwks.json`. Wektory mają `allowTestKeys: true` i osobne
  przypadki odrzucenia.
- Paczka polityk (ws-09) nie czyta `vsScopes` ani `virtualServer` (nie ma ich w schemacie od 5.0.0, CC-173) i dostarcza mapowanie zakresów w
  `entities/static.json` (CC-037).
- Serwery z narzędziami wyszukiwania i list ograniczają zapytanie i filtrują wyniki (CC-036,
  `cedar/entity-builder.md` sekcja 8).
- Odbiorca paczek: `mcp-policy-bundle` (CC-045).

## Wydanie (proces)

1. Wersja dokładnie `X.Y.Z` w pomach, `package.json` i `info.version` OpenAPI; `./scripts/verify-all.sh` zielony (robi `./mvnw clean verify`
   i `scripts/check-jar-contents.mjs`: jary muszą zawierać dokładnie pliki drzewa źródeł).
2. Sprawdzić, że w `~/.m2` nie ma jeszcze `X.Y.Z` (wydane wersje są niezmienne), commit `Release X.Y.Z`, tag `vX.Y.Z`.
3. Wypchnięcie tagu uruchamia `.github/workflows/release.yml` (weryfikacja, `npm publish`, `./mvnw deploy`, SBOM CycloneDX); potem wersja `X.Y.(Z+1)-SNAPSHOT`. Lokalnie: `./mvnw clean install` (do `~/.m2`) i `npm run pack`.

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

CI: wydania buduje GitHub Actions (`.github/workflows/release.yml`). Kontrole na co dzień: **GitLab CI** (`.gitlab-ci.yml`), bo firmowe repozytoria i serwer MCP dla GitLaba są w GitLabie;
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
