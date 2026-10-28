# mcp-contracts

Maszynowa wersja kontraktów platformy MCP z `01-contracts.md`: OpenAPI 3.1, JSON Schema 2020-12,
schemat Cedar, specyfikacja entity buildera, testowe klucze, wektory testowe i mocki. Inne repozytoria
generują z tego klientów, mocki i testy kontraktowe. Ostatnie wydanie **2.2.5**, tag `v2.2.5`; wersja robocza **3.0.0-SNAPSHOT** (bez tagu, zakres w `CHANGELOG.md`) (1.2.1 nie
zostało wydane osobno); zmiany w
[`CHANGELOG.md`](CHANGELOG.md). Moduły Java: `mcp-cedar-entities` (wspólny entity builder Cedar dla gateway'a i
startera) i `mcp-policy-bundle` (referencyjny odbiorca paczek polityk).

Kontrakty są zamrożone: zmiany zgłasza się w [`CONTRACT_CHANGES.md`](CONTRACT_CHANGES.md), zatwierdza
człowiek. Tam też są wszystkie miejsca, w których `01-contracts.md` był nieprecyzyjny, z przyjętym
wariantem; CC-001 ... CC-034 wdrożone w 1.1.0, CC-036 ... CC-045 w 1.2.0, CC-046 ... CC-067 w 2.0.0,
CC-068 ... CC-077 w 2.1.0, CC-035 odrzucone.

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
│   ├── untrusted-text/      # kształt UntrustedText (CC-072)
│   ├── confirmation-binding/  # oczekujące wywołanie i wynik weryfikacji kodu (C11, CC-091)
│   ├── totp/  text-hygiene/  gateway-authentication/  # CC-092, CC-126 / CC-121, CC-122 / CC-124
│   ├── connect-redirects/  catalog-actions/  return-paths/  # CC-086, CC-083, CC-032, CC-099
│   ├── servicedesk-service-account/  # reguła kolejek konta serwisowego (CC-076)
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

Wyjątek w 2.2.0/2.2.1: CC-085 (`resourceDefaults` uśpione, `400 resource_defaults_unsupported`) jest zaostrzeniem
walidacji wydanym jako minor na decyzję człowieka (brak konsumentów); w 2.2.1 usunięto odpowiedź `400
expires_at_invalid` dodaną w 2.2.0 (CC-084, brak konsumentów). Szczegóły w `CHANGELOG.md`.

Wyjątek: w 2.1.0 CC-071 (nowa wartość enum `event: "authentication"`) i CC-074 (zawężenie wzorców indeksów
OpenSearch) są według tej tabeli zmianami major, a wydane jako minor na wyraźną decyzję człowieka z 2026-10-27;
skutki dla konsumentów opisuje `CHANGELOG.md`.

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
| `pl.aiwcorpo.mcp:mcp-contracts:2.2.5` (jar) | `openapi/`, `schemas/`, `cedar/`, `mocks/wiremock/` pod prefiksem classpath `mcp-contracts/` | może być w runtime (np. schemat Cedar, walidacja manifestu) |
| `pl.aiwcorpo.mcp:mcp-contracts:2.2.5:test-vectors` (jar, klasyfikator) | `test-vectors/` łącznie z kluczami testowymi, pod `mcp-contracts/test-vectors/` | **tylko** `<scope>test</scope>` |
| `pl.aiwcorpo.mcp:mcp-cedar-entities:2.2.5` (jar + javadoc) | entity builder Cedar (C7, C9) | gateway (ws-05) i starter (ws-02), runtime |
| `pl.aiwcorpo.mcp:mcp-policy-bundle:2.2.5` (jar + javadoc) | weryfikacja i ładowanie paczek polityk C7, `PolicyStore`, lint polityk | gateway, starter, potok ws-09 |
| `pl.aiwcorpo.mcp:mcp-manifest:2.2.5` (jar + javadoc) | `definitionHash` (RFC 8785) i reguły manifestu C6 | starter (generowanie), gateway (rejestracja) |
| `pl.aiwcorpo.mcp:mcp-contracts-parent:2.2.5` (pom) | rodzic modułów | instalowany razem z nimi |
| `release/aiwcorpo-mcp-contracts-2.2.5.tgz` (npm, `@aiwcorpo/mcp-contracts`) | wszystko powyżej poza jarami + typy TS (`dist/types`) + handlery MSW (`dist/msw`) | `npm install ../mcp-contracts/release/aiwcorpo-mcp-contracts-2.2.5.tgz` |

W Mavenie klucze testowe są tylko w jarze `test-vectors`, żeby komponent produkcyjny nie mógł przypadkiem
załadować testowego JWKS z classpath. Paczka npm zawiera `test-vectors/` (w tym klucze) i jest
przeznaczona do `devDependencies`; nie jest publikowana do rejestru (`"private": true`).

Instalacja lokalna:

```bash
./mvnw install          # ~/.m2/repository/pl/aiwcorpo/mcp/{mcp-contracts,mcp-cedar-entities,mcp-policy-bundle,mcp-manifest,mcp-contracts-parent}/2.2.5/
npm ci && npm run pack  # release/aiwcorpo-mcp-contracts-2.2.5.tgz
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
  <version>2.2.0</version>
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
Nazwy indeksów OpenSearch zaczynają się od litery lub cyfry, więc indeksy ukryte i systemowe (`.security`, `.ds-*`) nie
przechodzą (CC-074). Niepasujące identyfikatory są odrzucane w `resourceDefaults`, `vsc`, argumentach narzędzi, zasobach z resolvera
i mapowaniu zakresów. Walidatory JSON Schema w Javie często dopasowują wzorzec przez `Matcher.find()`, przy którym
`$` przepuszcza końcowe `\n` (`"ABC\n"`); gateway (ws-05) przy zapisie `ResourceDefaults` i odbiorcy `vsc` wołają
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
   błąd brokera to `upstream_unavailable` dla B i nic nie powstaje; nie dotyczy tej samej operacji ani anulowanego A, bo anulowanie już spaliło kody; wektory
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
| `/s/`, `/v/` | gateway (MCP) |
| `/.well-known/oauth-protected-resource*` | gateway (RFC 9728, wariant ze ścieżką leży w korzeniu domeny) |

Zasady: adres publiczny (`url`, `clientConfigs`, `resource_metadata`) pochodzi z konfiguracji `publicBaseUrl`, nigdy z
`Host`/`X-Forwarded-Host` żądania; gateway ufa `X-Forwarded-*` tylko od proxy. Ciasteczka `__Host-session` i
`__Host-XSRF-TOKEN` mają `Path=/` (prefiks `__Host-` i odczyt przez SPA nie pozwalają na `/api`), więc proxy usuwa
nagłówek `Cookie` na trasach gateway'a, a gateway nie przekazuje `Cookie` dalej (do nagłówków usuwanych w C3:
`X-MCP-*`, `X-PAT-*`, `Authorization`, `X-Request-Id` dochodzi `Cookie`). Odpowiedzi gateway'a dla klientów MCP to
wyłącznie `application/json` i `text/event-stream`, także dla błędów (404, 405, 406, 5xx) i niezależnie od
`Accept`: gateway nigdy nie odpowiada `text/html` na trasach publicznych. Proxy dokłada na **każdej** trasie gateway'a
(`/s/`, `/v/`, `/.well-known/oauth-protected-resource*`) `X-Content-Type-Options: nosniff` i `Content-Security-Policy:
default-src 'none'; sandbox`, na każdej odpowiedzi, także 4xx/5xx z upstreamu i własnych stronach błędów (nginx:
`add_header ... always`). Odpowiedzi tych tras nie niosą `Set-Cookie` (proxy go usuwa), BFF nie wysyła nagłówków CORS
(ten sam origin), a proxy przekazuje znormalizowaną ścieżkę i nie wystawia przez trasy publiczne ani `/admin/v1/*`,
ani JWKS gateway'a (osobny listener; `/s/../admin/v1/...` i `%2e%2e` dają 404). Proxy nie nadpisuje `X-Request-Id`
z BFF. Angular Router nie definiuje tras zaczynających się od `/api`, `/s/`, `/v/`, `/.well-known/`.

## Zawężenie zasobów jest uśpione (CC-085)

Kreator linków nie zawęża zasobów. `resourceDefaults` zostaje w schematach, ale gateway (C5) i BFF (C12) odpowiadają
`400 resource_defaults_unsupported` dla niepustej wartości; brak pola lub `{}` jest przyjęte, a odpowiedzi nigdy go
nie zawierają. Kolejność kontroli: najpierw obecność niepustego obiektu (`resource_defaults_unsupported`), dopiero
potem jego zawartość; wartość, która nie jest obiektem, to `400 invalid_request`. Mechanika `vsc` (C2), `context.vsScopes` (Cedar) i wektory na niej oparte są bez zmian.

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
- **Audyt zmian linków (CC-107):** `admin_change` z `reason` ze słownika `vs_created`, `vs_deleted`, `slug_taken`,
  `not_granted`, `invalid_request`, `virtual_server_limit`, `not_found_or_denied` (opis pola `reason` w C8). Lista narzędzi
  linku wymaga nowego pola w schemacie C8 i jest w grupie A (poza 2.2.4).
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
grantu kolejki w paczce i w konfiguracji serwera oznacza odmowę (niezmiennik 6, CC-076). Reguła działa przed
Cedar, bo model Cedar nie niesie typu poświadczenia (`mcp.cedarschema` jest zamrożony w 2.x); wektory w
`test-vectors/servicedesk-service-account/`, a nie w `policy-decisions/`.

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
| `jwt/` | 57 | odbiorca C2: 22 poprawne, 35 odrzuceń (podpis, `kid`, klucz testowy, `alg`, `iss`, `aud`, `exp` ze skew, `iat`, czas życia, `jti`, wariant serwisowy, obecność i zgodność `tool`, `rid` != `X-Request-Id`, `vs`/`vsc`, token IdP, metody MCP 2026-07-28, wariant serwisowy poza listą, wywołania `authenticator` brokera z `tool`) |
| `manifests/` | 52 | manifest C6: schemat (w tym wymagane `title`), reguły semantyczne, zamknięty i ograniczony `inputSchema`, przeliczony `definitionHash` |
| `definition-hash/` | 12 | `definitionHash` (RFC 8785 + SHA-256), CC-004, CC-042 |
| `audit-events/` | 78 | zdarzenia C8, w tym zakaz argumentów, sekretów, kodów, ziarna i `otpauthUri`, znaków sterujących i bidi, odrzucone uwierzytelnienie (CC-071, CC-125), `authenticator`, `virtual_server_change` |
| `tool-errors/` | 31 | każdy kod C10 + przypadki odrzucane (dwa kształty `confirmation_required`, `confirmation_superseded`, `confirmation_blocked`, `confirmation_cancelled`) |
| `bundles/` | 41 | paczki C7: podpis, klucz testowy, rollback, `overrides`, `latest.json`, bezpieczeństwo tar, lint `vsScopes`, walidacja, mapowanie zakresów |
| `return-paths/` | 31 | `returnPath` C4/C12 (CC-032), od 3.0.0 bez prefiksów `/api`, `/s`, `/v`, `/.well-known` i segmentów `.`/`..` oraz średnika, który serwery czytają jak parametr ścieżki (CC-099) |
| `entity-builder/` | 36 | wejście buildera (z mapowaniem zakresów) -> encje i kontekst Cedar |
| `policy-decisions/` | 69 | decyzje Cedar na politykach z `cedar/examples`, w tym hierarchia zakresów i wyszukiwanie przez link |
| `result-filter/` | 7 | filtrowanie wyników i ograniczenie zapytania (CC-036) |
| `resource-ids/` | 10 | wzorce identyfikatorów per system (CC-056), w tym OpenSearch bez wiodącej kropki (CC-074) |
| `untrusted-text/` | 8 | kształt `UntrustedText` (CC-072) |
| `confirmation-binding/` | 73 | pierwsze wywołanie i ponowienie z kodem: oczekujące wywołanie, jedna operacja `DESTRUCTIVE`, mapowanie wyniku brokera (CC-091, CC-126, CC-127) |
| `totp/` | 46 | Authenticator brokera: RFC 6238, okno, jednorazowość kroku, blokada 5/15 min, limit dzienny, rejestracja, URI `otpauth` (CC-092, CC-126); ziarno z RFC 6238, NOT FOR PRODUCTION |
| `text-hygiene/` | 79 | zbiór zakazany w argumentach, identyfikatorach i filtrach wzmianek oraz zastępowanie w tekście z systemu (CC-121, CC-122) |
| `activity-calls/` | 38 | `ActivityCall` i agregacja zdarzeń jednego wywołania w wiersz (CC-095) |
| `gateway-authentication-decision/` | 12 | wybór powodu i statusu 401/503 ze stanu kopii kluczy, `kid` i odświeżenia (CC-124) |
| `activity-cursor/` | 9 | kursor `/activity/calls`: HMAC, związanie z `sub`, ważność 15 min (CC-095); klucz testowy, NOT FOR PRODUCTION |
| `gateway-authentication/` | 13 | 401 z `resource_metadata` albo 503 bez `WWW-Authenticate` i z `Retry-After` (CC-124) |
| `servicedesk-service-account/` | 6 | kolejka konta serwisowego oceniana na wartości z systemu (CC-076) |

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
