# Changelog

Format: SemVer versions (README, "Versioning (SemVer)"). CC numbers refer to `CONTRACT_CHANGES.md`.
Strict SemVer applies from 2.0.0. Releases 1.1.0 and 1.2.0 contained incompatible changes labelled as minor; they are listed in
their "Niezgodne z poprzednią wersją" sections and collected relative to 1.1.0 in the 2.0.0 section. Entries for released
versions are historical and are kept in the language they were written in.

## 7.0.0 - 2026-11-06

Serwery, systemy i typy zasobów przestają być listą w kontraktach: są danymi uruchomieniowymi (rejestr gatewaya, systemy brokera,
deklaracje w manifeście serwera). Decyzja właściciela platformy z 2026-11-06 ("dynamic servers"), CC-229 ... CC-236. Wydanie **major**
według tabeli SemVer, bez wyjątków. Bajty `cedar/mcp.cedarschema` są nowe (SHA-256 `48ab34c4e8cab2a48154c180fed51f48d1e6b1200e54751d32431ad35ae2d1d5`).

**Identyfikatory (CC-229).** `SystemId` to wzorzec `^[a-z][a-z0-9]{1,30}$`, `ServerId` to `^mcp-<SystemId>$`, `QualifiedToolName` ma ten sam wzorzec
systemu, `ResourceType` to `^[A-Z][A-Za-z0-9]{0,30}::[A-Z][A-Za-z0-9]{0,30}$`; wszystkie cztery były wyliczeniami pięciu systemów. Usunięte z
`common.schema.json`: `ScopeResourceType`, `JiraProjectKey`, `JiraIssueKey`, `ConfluenceSpaceKey`, `ConfluencePageId`, `GitLabGroupPath`,
`GitLabProjectPath`, `OpenSearchIndexName`, `OpenSearchIndexPrefix`, `ServiceDeskQueueId`, `ServiceDeskTicketId`, `ResourceIdPatterns` (wzorce to
teraz `resourceTypes[].idPattern` i `scopePattern` w manifeście; ich dotychczasowa treść jest w `cedar/examples/systems/*/resource-types.json`).
Nowa definicja `ResourceScopeId`. Wyliczenie czterech typów poświadczeń zostaje (to protokół, nie lista systemów). Limit wpisów `systems` w filtrze
`/mcp` rośnie z 5 do 20 (`EndpointFilter.MAX_SYSTEMS`), bo 5 było liczbą dawnych systemów; wektory `endpoint-filter/parse-systems-at-limit` i `-over-limit`.

**Schemat bazowy Cedar (CC-230).** `cedar/mcp.cedarschema` (pusta przestrzeń) zawiera tylko `ResourceScope`, `UserGroup`, `User`, `Tool`, `RequestContext`
i akcję `call`. Znikają przestrzenie `Jira`, `Confluence`, `GitLab`, `OpenSearch`, `ServiceDesk`, rekordy `Scopes` i `Refs` oraz akcje `read`, `update`,
`delete`, `admin` w pustej przestrzeni. `User.scopes` to jeden płaski zbiór `ResourceScope` (było: rekord z pięcioma polami), `Tool` ma `requiredGroup:
UserGroup` (`mcp-<system>-read` dla `READ_ONLY`, `-write` dla `UPDATE`, `-destructive` dla `DESTRUCTIVE`), `context.refs` to zbiór `ResourceScope` z
argumentów typów `earlyScopeCheck` (było: rekord pól `jiraProject`, `jiraIssue` ...).

**Polityki platformy (CC-231).** Nowy katalog `cedar/platform/` (w jarze i w npm): `platform-call-by-group` i `platform-call-write-outside-scope`. Gateway
decyduje o `call` tylko nimi i nadpisaniami administratora; `McpCedarSchema.platformPolicies()`. Dozwoleni klienci AI (`azp`) przestają być polityką Cedar:
lista w konfiguracji gatewaya (`MCP_ALLOWED_CLIENTS`), sprawdzana w kodzie przed Cedar przez gateway i starter. `cedar/examples/` zmienione: usunięte
`call-tool.cedar`, `read.cedar`, `update.cedar`, `forbid-restricted.cedar`, `credential-type.cedar`, `static-entities.json`; `step-up.cedar` w
`examples/overrides/`; nowe wzory serwerów `examples/systems/{jira,confluence,gitlab,opensearch,servicedesk}/` (schemat i `resource-types.json`; Jira ma też
polityki).

**Manifest i fragment serwera (CC-232).** `system` to `SystemId`. `resourceTypes[]` wymaga `type`, `attributes`, `idPattern` i przyjmuje `parent`, `parentAttribute`
(z `parent`), `scopePattern`, `earlyScopeCheck`, `classification {attribute, kind, required}`; atrybut rodzica nie jest już w `attributes`. Nowe człony
`policies {namespace, schema, files[{name, text}]}` i `policiesHash` (RFC 8785 + SHA-256 obiektu `{"policies", "resourceTypes"}`, więc zmiana deklaracji też wymaga zatwierdzenia): wymagane we wszystkich manifestach poza
manifestem adaptera, zakazane w manifeście adaptera, który nie deklaruje też `resourceTypes`. Nowe reguły semantyczne `resource-types-valid`,
`resource-types-namespace`, `policies-files-sorted-unique`, `policies-hash-matches`. Walidacja fragmentu (`PolicyFragments.validateFragment`): schemat bazowy i
fragment składają się w trybie strict, jedna przestrzeń, `scopes` na każdym typie, akcje `read`/`update`/`delete`/`admin`, bez `Action::"call"` i `Tool`, bez
polityk "impossible", deklaracje zgodne ze schematem. Rozpoznawanie nazw w cedar-java 4.10.0 sprawdzone: typy bazowe w przestrzeni serwera są bez
kwalifikacji, akcje `<Przestrzeń>::Action::"read"` działają (test `CedarSchemaTest`). Wektory: `manifests/` (93), `policies-hash/` (4).

**Entity builder (CC-233).** Dane z deklaracji, żadnych nazw typów w kodzie. Zmiany API `mcp-cedar-entities`: nowe `ResourceTypeDeclaration`, `ResourceTypes`
(`of`, `fromJson`, `union`), `Scopes` (`id`, `pathPrefixes`, `dashPrefixes`), `PolicyFragments`; `EntityBuilder(ResourceTypes, ScopeMapping)` zamiast
`EntityBuilder()` i `EntityBuilder(ScopeMapping)`; `EntityBuilder.resourceTypes()`; `ScopeMapping.of(types, map)`, `ofRegistered`, `fromJson` zamiast
`fromStaticEntities`; `ResolvedResource.scopes()` i `withScopes` (nowy składnik rekordu); `ToolDescriptor.requiredGroup()`; `McpCedarSchema.platformPolicies()`.
Usunięte: `ResourceIds`, `ResourceScopes`, `ScopeGroups`. Zmiany zachowania: akcja serwera to `<Przestrzeń typu zasobu>::Action::"<action>"`; zasób niesie
`scopes` podane przez resolver (builder sprawdza je względem `scopePattern`), nie wylicza ich; atrybut spoza `attributes` (także `scopes` i atrybut rodzica) to
`internal_error`; rodzic musi być typu zadeklarowanego; `inheritedClassification` GitLaba i wyprowadzenia zakresów (prefiksy ścieżek, prefiksy po myślnikach,
przodkowie stron) liczy serwer, nie builder; `ancestorClassifications` i `ancestorIds` nie są już znaczącymi wejściami buildera. Wektory przepisane wokół
fragmentów: `entity-builder/` (54), `policy-decisions/` (40), `result-filter/` (5), `resource-checks/` (5), `resource-ids/` (14); neutralny fixture `Notes`
w `test-vectors/fixtures/`. `cedar/entity-builder.md` przepisany.

**Dane polityki i API administratora (CC-234).** Gateway (C5): `GET /internal/v1/policy-data` (certyfikat serwera, `ETag` i `If-None-Match`), `GET`, `POST
/admin/v1/servers`, `GET`, `PATCH`, `DELETE /admin/v1/servers/{serverId}`, `GET`, `PUT /admin/v1/policy/scope-mapping` (`ETag`, `If-Match`), `GET /admin/v1/policy/overrides`,
`GET`, `PUT`, `DELETE /admin/v1/policy/overrides/{id}`, `GET .../registry/servers/{serverId}/policies/pending`, `POST .../policies/approve`; `RegistryServer` ma
`policiesStatus`, `policiesHash`, `pendingPoliciesHash`; nowe powody `manifest_rejected`: `policies_invalid`, `resource_types_invalid`, `namespace_conflict`.
Odbicia w BFF (C12): `/api/v1/admin/servers`, `/admin/policy/*`, `/admin/registry/servers/{serverId}/policies/*`, `/admin/systems`.

**Systemy brokera (CC-235).** C4: `GET /v1/admin/systems`, `PUT`, `DELETE /v1/admin/systems/{system}` (baseUrl, adapter `atlassian-dc`, `gitlab`, `opensearch`,
`generic-rest`, supportedTypes, defaultType, secretScheme, klient OAuth z sekretem tylko do zapisu). `GET /v1/systems` bez zmian.

**Bez paczek polityk (CC-236).** Usunięte: moduł `mcp-policy-bundle` (artefakt `pl.aiwcorpo.mcp:mcp-policy-bundle` nie powstaje w 7.0.0), schematy `policy-bundle-latest` i
`policy-bundle-manifest`, katalogi wektorów `bundles/`, `policy-store/` i `servicedesk-service-account/`, klucze testowe `test-policy-bundle`, `test-policy-overrides` i
`dev-policy-bundle.pub.pem` (z listy `published-test-keys.json` i `PublishedTestKeys`), generator tar. Wektor `tool-errors/upstream-unavailable-policy-bundle` nazywa
się `upstream-unavailable-policy-data`. Opisy `PolicyRevision` i `prv` mówią o danych polityki gatewaya.

**Poprawki po przeglądzie bezpieczeństwa (CC-237, w 7.0.0).** Zarezerwowane id systemów (`gateway`, `offboarding`, `portal`, `broker`, `prometheus`, `platform`, `admin`, `registry`, `adapter`, `internal`, `ci`); `approvedPoliciesHash` w danych polityki i reguła startera (odmowa przy różnym skrócie, rewizja tylko w górę, odświeżenie przy nowszym `prv`); cele nadpisań (`gateway` tylko `call` na `Tool`, serwery względem fragmentów) i id `override-<nazwa>`, zakaz prefiksów `platform-` i `override-` w politykach serwera, odrzucenie zdublowanych id; `PendingPolicies` z deklaracjami typów; `union` odrzuca wspólną przestrzeń, `deleteServer` czyści mapowanie; nieważny zakres pomijany osobno (`ignored()`), `approveServerPolicies` zwraca `ignoredMappingEntries`; gramatyka wzorców (bez zagnieżdżonych kwantyfikatorów, lookaround, odwołań wstecznych, 512 znaków, id do 1024); `PlatformServerPolicies` (restricted i konto serwisowe generowane z deklaracji); `platform-call-write-without-refs`; `If-Match`, `ETag` i świeże MFA w operacjach administratora, ponowny `clientSecret` w brokerze przy zmianie adresów; dane polityki zawężone do przestrzeni serwera; `PolicyRevision` jako rosnący licznik całkowity (wektory JWT i audytu przegenerowane).

**Migracja per składnik.**
- *gateway:* rejestr serwerów w PostgreSQL i API `/admin/v1/servers`; `ResourceTypes.union` z zarejestrowanych manifestów, `ScopeMapping.ofRegistered`; `EntityBuilder(types, mapping)`; decyzja `call` z
  `McpCedarSchema.platformPolicies()` i nadpisań; `GET /internal/v1/policy-data` i `prv`; zatwierdzenie `policiesHash`; walidacja fragmentu przy rejestracji; `MCP_ALLOWED_CLIENTS` w kodzie.
- *starter:* walidacja fragmentu w buildzie i przy starcie (`PolicyFragments.validateFragment`), `policies` i `policiesHash` w manifeście, `resourceTypes` z `idPattern`; `Scopes.pathPrefixes` i `Scopes.dashPrefixes` (do zawinięcia
  w jego `Scopes`); `@ArgumentLimits` bierze wzorzec z deklaracji; dane polityki z gatewaya zamiast paczki.
- *broker:* administracja systemami (`/v1/admin/systems`), sekret klienta w OpenBao.
- *portal:* ekrany serwerów, mapowania, nadpisań, zatwierdzenia polityk i systemów; mock MSW nie zna listy systemów (wzorzec `SystemId`).
- *serwery:* fragment w `src/main/resources/mcp/policies/` z jedną przestrzenią (wzór: `cedar/examples/systems/jira`), akcje `<Przestrzeń>::Action::"read"`, deklaracje typów, wyprowadzenie `scopes`
  i klasyfikacji (w tym `inheritedClassification` GitLaba i drzewo stron Confluence) w resolverze.
- *mcp-policies:* repozytorium przestaje być potrzebne (polityki serwerów leżą przy kodzie, polityki gatewaya to `cedar/platform`).

## 6.3.2 - 2026-11-03

Poprawki po drugim przeglądzie (6.3.1 nie było wypchnięte ani wdrożone). Bajty `cedar/mcp.cedarschema` bez zmian. Zgoda człowieka na wyjątek SemVer obejmuje cały pakiet poprawek 6.3.x po przeglądzie (6.3.0, 6.3.1, 6.3.2); zaostrzenia ponad CC-226 i CC-227, wszystkie bez konsumenta, bo Basic dla `user-secret` i kanał adaptera nie działają jeszcze nigdzie: węższy wzorzec `username`, `400` przy braku `username` dla systemu `Basic`, unieważnienie zapisanych klasyfikacji zapisu adaptera, odmowa sidecara bez klasyfikacji, zmienione wejście wektora `broker-authentication-denied-replay-store-unavailable`.

- **N1 (CC-227):** wpis adaptera z unieważnioną klasyfikacją `UPDATE` albo `DESTRUCTIVE` wraca do `pending_approval` (`source: adapter`, nowy `pendingHash`). Unieważniona klasyfikacja zostaje podłogą, więc ponowne `approve` jako `READ_ONLY` to obniżenie: `acceptRiskLowering` i świeże MFA w portalu, bez wyjątku, audyt `risk_lowered_by_admin`. Wektory `registry-approval/adapter-invalidated-{update,destructive}-{without-accept,accepted}`.
- **N2 (CC-222):** wzorzec `username` to zbiór znaków `backendUser` z CC-121 (`\p{Cc}`, `\p{Cf}`, `\p{Cs}`, separatory, wypełniacze) plus `:`; opis wskazuje CC-121.
- **N3 (CC-222):** przykłady z `userSecretScheme`, `deployment` i `username` (`GET /v1/systems`, katalog C12, `putMySecret`); mocki MSW i WireMock z nich.
- **N4 (CC-226):** `verifier.receiverMode` opisany w formacie wektorów; sidecar bez `mcp_risk` i `mcp_action` przy `tools/call` odmawia (powód `classification_missing`, wektor `jwt/classification-missing-at-adapter`); zalecenie walidacji względem `UserClaims` i `ServiceClaims` dla serwera natywnego i brokera.
- **N5:** zdanie o zakresie wyjątku (wyżej).

### Zmiany względem 6.3.1 dla strumieni

**ws-05 gateway:** unieważniony wpis adaptera wraca do `pending_approval` z podłogą; `approve` jako `READ_ONLY` wymaga `acceptRiskLowering` (wektory).
**ws-07, ws-08 portal:** przy ponownej klasyfikacji takiego wpisu dialog żąda `acceptRiskLowering` i świeżego MFA; pole loginu według `userSecretScheme` (przykłady w mockach).
**ws-06 broker:** wzorzec `username` z CC-121.
**ws-13 adapter, ws-02 starter:** sidecar odmawia `tools/call` bez `mcp_risk` i `mcp_action`; loguje i liczy wartość inną niż `READ_ONLY`.
**pozostałe:** zależność 6.3.2.

## 6.3.1 - 2026-11-03

Poprawki po przeglądzie 6.3.0 (tag `v6.3.0` był lokalny, nie wypchnięty ani wdrożony; 6.3.0 jest w `~/.m2` i jest niezmienne, więc poprawki idą pod nowym numerem). Bajty `cedar/mcp.cedarschema` bez zmian. Według tabeli SemVer jest tu zmiana major, **wyjątek zatwierdzony przez człowieka 2026-11-03** (wzór 5.1.0 i 6.2.0): **CC-226**: claimy `rsk` i `act` z 6.3.0 znikają ze schematu, zastępują je `mcp_risk` i `mcp_action` ograniczone do sidecara adaptera (6.3.0 nigdzie nie wdrożono). Pozostałe zmiany są opisami, nowymi wektorami i opcjonalnymi polami.

- **W1, W7 (CC-226):** `mcp_risk` i `mcp_action` zamiast `rsk` i `act` (`act` to claim z RFC 8693). Osobny wariant schematu `AdapterUserClaims` (para zgodna: `READ_ONLY` z `read`, `UPDATE` z `update` albo `admin`, `DESTRUCTIVE` z `delete` albo `admin`; wymagane `tool`). Reguła odbiorcy: tylko sidecar adaptera przyjmuje claimy; serwer natywny i broker odrzucają token jako `invalid_claims`. `verifier.receiverMode` w wektorach `jwt/`; nowe: `classification-at-native-server`, `classification-at-broker`, `classification-pair-does-not-fit`, `idp-token-claims/with-classification-claims`; przemianowane `valid-adapter-classification`, `classification-risk-without-action`, `classification-without-tool`. Opisy w schemacie i README poprawione.
- **W4, W5 (CC-222, CC-213):** `SystemInfo.userSecretScheme` (`Bearer`, `Basic`) w C4 i w `CatalogCredential` w C12, wraz z `deployment`; to `userSecretScheme`, nie `deployment`, decyduje o polu loginu. `username` jest `writeOnly`, nigdy nie jest logowany ani zwracany, wzorzec odrzuca C1, bidi i zero-width. Bez `username` przy systemie `Basic` i z `username` przy `Bearer`: `400`. Przykład `resolve` ze schematem `Basic` dla `user-secret`; README opisuje Basic dla `user-secret`; OpenSearch na własnej instalacji objęty.
- **W6 (CC-227):** klasyfikacja `UPDATE` i `DESTRUCTIVE` adaptera zapisana wcześniej traci ważność (wpis ukryty, `tool_disabled`, ponowne `approve` jako `READ_ONLY`); wektor `registry-approval/stored-update-classification-is-hidden`. Uzasadnienie wyjątku poprawione: kanał adaptera jest w gatewayu od 6.2.0, ale nie działa na stosie z użytkownikami. Opisy `ApproveRequest.risk`, `ApproveRequest.action` i `approveAdminTool` uzupełnione.
- **W2, W3 (CC-211, CC-212):** wektory brokera `broker-authentication-denied-*` są w generatorze; z `broker-authentication-denied-replay-store-unavailable` faktycznie usunięte `decision` (w 6.3.0 CHANGELOG to zapowiadał, a plik je miał).
- **W9 (CC-224):** zdanie w README i wektor `kill-switch/store-unreadable-catalog`. Polecenie dla ws-04 z 6.3.0 o usunięciu filtra po odpowiedzi wycofane: filtr zostaje jako obrona w głąb.
- **W10:** dwie zmiany z 6.3.0 opisane uczciwie. CC-228 osłabia obietnicę 5 s z 6.0.0 i 6.2.0, na której mógł się opierać ws-10 (nie jest tylko doprecyzowaniem). CC-210: odrzucanie przez BFF `reason` z ukrytymi znakami zaostrza pole C12 według tabeli.
- **W11:** status CC-226 w `CONTRACT_CHANGES.md` po przeglądzie bezpieczeństwa.
- **W8:** po CC-226 i CC-227 lokalna druga bariera sidecara spada do klasyfikacji administratora (zamierzone); zalecenie dla ws-13: logować i liczyć przypadki `mcp_risk` niższego niż ryzyko z podpowiedzi.

### Zmiany względem 6.3.0 dla strumieni

**ws-05 gateway:** claimy `mcp_risk` i `mcp_action` (nie `rsk` i `act`), tylko dla `serverId` w trybie adaptera, tylko zgodna para, tylko z `tool`; zapisane klasyfikacje `UPDATE` i `DESTRUCTIVE` wpisów adaptera przy przejściu na 6.3.x tracą ważność i wpis jest ukryty (`tool_disabled`) do ponownej klasyfikacji `READ_ONLY`; `503` katalogu (wektor `store-unreadable-catalog`).
**ws-02 starter:** tryb odbiorcy: claimy `mcp_risk` i `mcp_action` przyjmuje tylko sidecar adaptera, serwer natywny odrzuca je jako `invalid_claims`; renderer CQL bez zmian względem 6.3.0.
**ws-13 adapter:** `mcp_risk` i `mcp_action` zamiast `rsk` i `act`; licznik i log rozbieżności z ryzykiem z podpowiedzi.
**ws-06 broker:** token z `mcp_risk` albo `mcp_action` to `invalid_claims`; `userSecretScheme` i `deployment` w `GET /v1/systems`; `400` przy `username` bez `Basic` i przy braku `username` dla `Basic`; `username` nigdy w logach ani w odpowiedziach; wektory `broker-authentication-denied-*` bez `decision`.
**ws-07, ws-08 portal:** pole loginu według `CatalogCredential.userSecretScheme === 'Basic'`, nie według `deployment`; dialog klasyfikacji adaptera tylko `READ_ONLY` i `read`.
**ws-04 Confluence:** filtr typów po odpowiedzi zostaje (wycofane polecenie z 6.3.0). **ws-04 OpenSearch:** `userSecretScheme: Basic` dla własnej instalacji możliwy dopiero po decyzji o części 1 CC-213 w serwerze.
**ws-10 e2e:** nie zakładać 5 s po zmianie paczki polityk; scenariusz starego wpisu adaptera z `UPDATE`.
**ws-01, ws-03, ws-09, ws-11, ws-12:** zależność 6.3.1, bez zmian w kodzie.

## 6.3.0 - 2026-11-03

Minor z dwoma wyjątkami od tabeli SemVer (README, "Wersjonowanie"; wzór: 5.1.0 i 6.2.0), zatwierdzonymi przez człowieka 2026-11-03: **CC-219** (stała klauzula `AND type = page` w CQL zmienia oczekiwane wyjście dwóch istniejących wektorów, `query-rendering/cql-plain` i `cql-hostile-value`; jedynym odbiorcą jest serwer Confluence) i **CC-227** (adapter tylko do odczytu zaostrza `approveTool` dla wpisu adaptera; kanał adaptera nie jest wdrożony). Reszta jest zgodna wstecz: opisy, odpowiedzi opisujące istniejące zachowanie, nowe opcjonalne pola i nowe wektory. Bajty `cedar/mcp.cedarschema` bez zmian. Pakiet CC-210 ... CC-228 (decyzje: `mcp-platform-plan/plan-wydanie.md`, "Decyzje o pakiecie CC-210..226"). Odłożone: CC-214, CC-215, CC-216, CC-217, CC-218, CC-220, CC-221.

### Nowe i zmienione

- **CC-210 (C12):** `400` w `approveAdminTool`; opis `KillSwitchRequest.reason`: BFF odrzuca tekst z ukrytymi znakami `400`.
- **CC-211, CC-212 (C8):** broker zapisuje odrzucenie tokenu (`bad_signature`, `expired`, `replayed_jti` i pozostałe) jako zdarzenie `authentication`, nie jako zdarzenie operacji; `decision` jest opcjonalne dla `authentication`, broker go nie zapisuje. Wektory `audit-events/broker-authentication-denied-*` (+3), z `broker-authentication-denied-replay-store-unavailable` usunięte `decision`.
- **CC-213, CC-222 (C3, C4, C12):** `PutSecretRequest.username` (opcjonalne, bez `:` i znaków sterujących) razem z `secret` tworzy parę zapisaną jako jeden sekret; `resolve` zwraca schemat `Basic`. `SystemInfo.deployment` (`dc`, `cloud`, opcjonalne). Basic dla `service-account` nie zmienione (odłożone).
- **CC-219 (query-rendering):** CQL kończy się `AND type = page` (przed `ORDER BY`). Wyjątek SemVer.
- **CC-223 (C5, README):** limit otwartych strumieni na instancję (`MCP_MAX_OPEN_STREAMS`, 2000), `503` z `Retry-After` i ciałem przeciążenia. Wektor `gateway-authentication/streams-limit-reached`, referencja `reason: streams_limit_reached`.
- **CC-224 (C5):** `503` (`upstream_unavailable`, `Retry-After`) w `getCatalog` przy nieczytelnych wyłącznikach.
- **CC-225:** `cursor: null` w `tools/list` to `-32602`; wektor `endpoint-aggregate/cursor-null`.
- **CC-226 (C2):** opcjonalne claimy `rsk` i `act` w wariancie użytkownika, tylko razem i z `tool`, dla serwerów w trybie adaptera. Wektory `jwt/valid-adapter-classification`, `classification-risk-without-action`, `classification-without-tool`.
- **CC-227 (C5):** adapter tylko do odczytu: `risk` inne niż `READ_ONLY` przy `approve` wpisu adaptera to `422 classification_not_allowed`. Wektory `registry-approval/`: `adapter-with-classification` (teraz `READ_ONLY`), `adapter-update-refused`, `adapter-destructive-refused`; `adapter-update-with-admin` zmienia wynik. Wyjątek SemVer.
- **CC-228 (README):** `list_changed` po zmianie paczki polityk bez gwarancji 5 s.

### Zmiany względem 6.2.1 dla strumieni

**ws-05 gateway:** (1) `MCP_MAX_OPEN_STREAMS` i `503` (CC-223) zgodne z wektorem; (2) `503` katalogu z `Retry-After` (CC-224); (3) `cursor: null` to `-32602` (CC-225); (4) `approve` wpisu adaptera: `422 classification_not_allowed` dla `risk` innego niż `READ_ONLY` (CC-227); (5) claimy `rsk` i `act` w tokenie dla serwerów w trybie adaptera, wyłącznie do sidecarów adaptera, po przeglądzie bezpieczeństwa (CC-226); serwer natywny odrzuci je jako `invalid_claims`; (6) `list_changed` po zmianie paczki polityk bez 5 s (CC-228).
**ws-06 broker:** odrzucenie tokenu zapisywać jako `authentication` bez `server`, `sub` i `tool` (CC-211), bez `decision`; `PutSecretRequest.username` i `resolve` ze schematem `Basic`, `deployment` w `GET /v1/systems` (CC-222); `400` dla `username` przy systemie bez Basic.
**ws-02 starter:** CQL z `AND type = page` (CC-219, `scripts/lib/query-rendering.mjs`); `rsk` i `act` w claimach sidecara (CC-226); `decision` opcjonalne w zdarzeniu `authentication`.
**ws-04 Confluence:** CQL z `type = page` z rendererem startera (CC-219); filtrowanie typów po odpowiedzi zostaje jako obrona w głąb (korekta w 6.3.1); `Cql.contentIn` bez zmian. **ws-04 pozostałe serwery:** zależność 6.3.0, bez zmian w kodzie (CC-213: OpenSearch nadal tylko `token-exchange` do osobnej decyzji).
**ws-07, ws-08 portal:** `400` w `approveAdminTool` (CC-210); pole loginu w formularzu `user-secret` dla systemu z `deployment: cloud` (CC-222); dialog klasyfikacji adaptera oferuje tylko `READ_ONLY` i `read` (CC-227); `503` katalogu jak każde `503`.
**ws-13 adapter:** klasyfikacja może być tylko odczytem (CC-227); claimy `rsk` i `act` zamiast ryzyka zastępczego, gdy gateway je przekaże (CC-226).
**ws-10 e2e:** scenariusze: odmowa otwarcia strumienia po przekroczeniu limitu (`503`), `approve` adaptera jako `UPDATE` (`422`), zmiana paczki polityk bez założenia 5 s, `cursor: null`.
**ws-01, ws-09, ws-03, ws-11, ws-12:** zależność 6.3.0; ws-01: alert na `mcp_gateway_streams_refused_total`. Bez zmian w kodzie.

## 6.2.1 - 2026-11-03

Patch: tylko pakowanie i metadane, bez zmian w kontraktach (OpenAPI, schematy, Cedar, wektory bez zmian poza numerem `info.version`).

- Licencja Apache-2.0: `LICENSE`, `NOTICE`, `<licenses>` w pomach, `license` w `package.json` (wcześniej `UNLICENSED`).
- Publikacja: `distributionManagement` (Maven) i `publishConfig` (npm) na GitHub Packages organizacji `aiwcorpo`; workflow `.github/workflows/release.yml` (po tagu `vX.Y.Z`, SBOM CycloneDX). `"private": true` usunięte z `package.json`.
- Paczka npm nie zawiera już kluczy prywatnych testów (`test-vectors/keys/*NOT-FOR-PRODUCTION*`); zostają w jarze `test-vectors` (scope test). Klucze publiczne i JWKS bez zmian.
- `release/` nie jest śledzony w gicie (`.gitignore`); `npm run pack` pisze tam lokalnie.
- `scripts/verify-all.sh` bez ścieżek Homebrew (JAVA_HOME, PATH, `java_home`, `brew --prefix`, `/usr/lib/jvm`, SDKMAN).
- `SECURITY.md`, `CONTRIBUTING.md`, README: instalacja z GitHub Packages.

### Zmiany względem 6.2.0 dla strumieni

**ws-07, ws-08 (portal):** zależność `file:../../mcp-contracts/release/aiwcorpo-mcp-contracts-<wersja>.tgz` działa lokalnie, dopóki plik jest na dysku (katalog `release/` zostaje, poza gitem); na czystym checkoucie plik nie istnieje. Przejście: `@aiwcorpo/mcp-contracts@6.2.1` z GitHub Packages (`.npmrc` ze scope `@aiwcorpo`) albo lokalnie `npm run pack`. Zmiana sumy integralności w `package-lock.json` jest oczekiwana.
**pozostałe:** zależność 6.2.1 w Mavenie jest opcjonalna (bajty kontraktów jak w 6.2.0).

## 6.2.0 - 2026-11-03

Wyjątek SemVer (wzór: 5.1.0; README, "Wersjonowanie"): CC-207, poprawki po przeglądzie 6.1.0. Według tabeli są tu zmiany major: nowa wartość enum `gateway_timeout` w `BalancerError` (z 6.1.0), inny punkt odniesienia bezstanowego `list_changed`, nowy kod `422 classification_inconsistent`, węższa odpowiedź `200` kanału adaptera (`AdapterRegistryServer`), kolejność `403`, `400`, `422` w kanale adaptera, pole `removed` w referencji. Dotyczą kanału adaptera, `BalancerError` i bezstanowego `list_changed` z 6.0.0 i 6.1.0, których nikt nie wdrożył; człowiek zdecydował (2026-11-03), że wydanie to 6.2.0. Bajty `cedar/mcp.cedarschema` bez zmian.

- **Punkt odniesienia `list_changed` (S7):** lista użytkownika z chwili otwarcia strumienia `subscriptions/listen`; `tools/list` obsłużone gdzie indziej nie jest referencją. Referencja `listChangedStateless`, wektory `list-changed-stateless-*` (4) zamiast `list-changed-sequence-stateless-*`.
- **Strumienie (S8):** `POST subscriptions/listen` poza `MCP_MAX_CONCURRENT_REQUESTS` jak `GET`; heartbeat SSE `: keepalive` co 15 s (`MCP_SSE_HEARTBEAT_INTERVAL`).
- **Kanał adaptera:** kolejność `403`, `400` (`serverId` ciała różny od ścieżki), `422` (N11); odpowiedź bez `classifiedBy`/`classifiedAt` (N13); narzędzie nieobecne w manifeście jest usuwane wraz z klasyfikacją (decyzja człowieka); wektory `adapter-registry/` (13).
- **`approve` adaptera:** `risk` i `action` muszą do siebie pasować, inaczej `classification_inconsistent` (N14); wektory `registry-approval/` (13). `action` w audycie klasyfikacji w tekstach i jako `$ref` (N10).
- **Znane, odłożone do następnego majora (N1, N2):** schemat nie wymusza, że `RegistryTool.risk`/`action` są obecne poza oczekującym wpisem adaptera, ani że `KillSwitch.tool` występuje dokładnie przy `scope: tool`; obowiązuje opis. Egzekwowanie zaostrzyłoby walidację odpowiedzi.
- **Do potwierdzenia przez człowieka (STATUS):** kolejność reguł `idpTokenClaimsDecision` i semantyka osieroconego przełącznika; bez zmian w tym wydaniu.

### Zmiany względem 6.1.0 dla strumieni

**ws-01 stos dev i platforma:** dla `/mcp` i `/s/...` (obie postacie strumienia): `proxy_buffering off`, `proxy_read_timeout` co najmniej 60 s; heartbeat gatewaya co 15 s; zerwany strumień to `504` albo zamknięte połączenie, nie błąd gatewaya.
**ws-05 gateway:** (1) bezstanowy `list_changed` porównuje z listą z chwili otwarcia strumienia, nie z ostatnim `tools/list`; (2) `POST subscriptions/listen` poza limitem żądań w toku, metryka otwartych strumieni obejmuje obie postacie; (3) heartbeat SSE `: keepalive` co `MCP_SSE_HEARTBEAT_INTERVAL` (15 s) na każdym strumieniu; (4) kanał adaptera: `403` przed `400` przed `422`, odpowiedź bez `classifiedBy`/`classifiedAt`, usunięcie narzędzia usuwa klasyfikację; (5) `approve` adaptera: `classification_inconsistent`; (6) zdarzenie klasyfikacji niesie `risk` i `action`.
**ws-13 adapter:** obsłużyć `400` przy `serverId` ciała różnym od ścieżki; odpowiedź `200` bez pól administratora; po powrocie usuniętego narzędzia spodziewać się ponownej klasyfikacji.
**ws-07, ws-08:** `approve` adaptera może zwrócić `422 classification_inconsistent`: komunikat w dialogu klasyfikacji, para `risk`/`action` ograniczona do dozwolonych.
**ws-10 e2e:** scenariusze: strumień `POST subscriptions/listen` nie zajmuje miejsca w limicie i nie ginie po bezczynności (heartbeat); `tools/list` na innej instancji nie psuje powiadomień; `403` przed `422`.
**ws-02, ws-03, ws-04, ws-06, ws-09, ws-11, ws-12:** zależność 6.2.0, bez zmian w kodzie.

## 6.1.0 - 2026-11-03

Minor: CC-206, poprawki po przeglądzie 6.0.0 i decyzje człowieka z 2026-11-03. Bajty `cedar/mcp.cedarschema` bez zmian. Nie zaostrza walidacji istniejących danych, **z jednym wyjątkiem od tabeli SemVer**: `BalancerError.error` z `const: bad_gateway` na `enum: [bad_gateway, gateway_timeout]` (nowa wartość enum, według tabeli major; element bez wdrożeń, wyjątek zatwierdzony razem z 6.2.0). N1 i N2 (warunki w schematach odpowiedzi) odłożone do następnego majora. Reguła punktu odniesienia `subscriptions/listen` z tego wydania ("ostatni `tools/list` w połączeniu") jest wycofana w 6.2.0.

### Nowe i poprawione

- **Kanał adaptera (W1):** operacja C5 `submitAdapterManifest` (`PUT /admin/v1/registry/adapters/{serverId}`, CN `mcp-adapter-<serverId>`), tryb adaptera w konfiguracji gatewaya, `422 adapter_mode_mismatch` w obie strony, nowe narzędzia zawsze `pending_approval` z `source: adapter`, bez klasyfikacji. Wektory `adapter-registry/` (10), `registry-approval/` (10).
- **Adapter działa tylko dla pięciu znanych systemów (W2):** obcy serwer na szóstym systemie to zmiana major; bez zmiany enumów w 6.1.0.
- **Balancer (W3):** `proxy_next_upstream error timeout` bez `non_idempotent`; `BalancerError` także dla `504` (`gateway_timeout`).
- **Wyłącznik po autoryzacji (S1):** po `mayCall` i filtrze; użytkownik bez dostępu dostaje `not_found_or_denied`. Wektory `endpoint-filter/call-state-kill-switch-*` (3), `kill-switch/` (17).
- **Hash adaptera (S3), odczyt w czasie działania (S2), `subscriptions/listen` (S4), osierocony przełącznik (N3), `action` w audycie klasyfikacji (N4), `Retry-After` (N6), dokładniejsza referencja claimów IdP (N7), `PolicyLintCli.run` publiczne (N8), granica 5 s jako decyzja człowieka (D1).**
- **Wektory:** `endpoint-filter/stream-open-stateless-*` (2), `endpoint-aggregate/list-changed-sequence-stateless-*` (2), `balancer-errors/` (+2), `idp-token-claims/` (+3), `kill-switch/` (+3).

### Zmiany względem 6.0.0 dla strumieni

**ws-01 stos dev i platforma:** nginx bez `proxy_next_upstream off`: zostaje `error timeout` z `proxy_next_upstream_tries`, bez `non_idempotent`; strona błędu `504` w JSON z `BalancerError` (`gateway_timeout`) obok `502`; certyfikat adaptera z CN `mcp-adapter-<serverId>` dla demo.
**ws-05 gateway:** (1) tryb adaptera w konfiguracji per `serverId`; operacja `submitAdapterManifest` z CN `mcp-adapter-<serverId>`; `registerServer` i `submitAdapterManifest` w złym trybie albo z manifestem o złym `source` to `422 adapter_mode_mismatch`; narzędzia z adaptera zawsze oczekujące, bez klasyfikacji ukryte jako `tool_disabled`; odczyt `tools/list` w trybie adaptera tworzy wpis `source: adapter`; hash adaptera zawsze bez `risk`/`action` (też przy kontroli trzymanych manifestów); (2) wyłącznik sprawdzany po `mayCall` i po filtrze (wektory `call-state-kill-switch-*`), `PUT` dla nieznanego narzędzia `404`, przełącznik narzędzia usuniętego z manifestu zostaje; (3) `subscriptions/listen` bez sesji: token, składnia filtra, bez `filter_mismatch`, punkt odniesienia z ostatniego `tools/list` albo z chwili otwarcia; (4) `approve` adaptera: `classification_required`, `classification_not_allowed`, obniżenie z `acceptRiskLowering` (wektory `registry-approval/`), zdarzenie z `risk` i `action`.
**ws-13 adapter:** wysyłka manifestu operacją `submitAdapterManifest` z certyfikatem `mcp-adapter-<serverId>`; tylko pięć znanych systemów; hash przez `DefinitionHash.ofManifestTool`.
**ws-09 polityki:** `PolicyChecks.impossible` (`mcp-policies/.ci/.../PolicyChecks.java`) łapie tylko `AuthException`, a `PolicyLint.impossible` od 6.0.0 rzuca `IllegalStateException` przy błędzie walidacji: dodać ten wyjątek do `catch` i zapisać problem na liście zamiast przerywać krok.
**ws-06 broker:** potwierdzić wyniki i `errorCode` dziewięciu powodów z opisu `reason`; wektory pokrywają tylko `database_unavailable`, `refresh_token_lost`, `secret_missing`.
**ws-10 e2e:** scenariusze: użytkownik bez dostępu woła wyłączone narzędzie (`not_found_or_denied`), pomyłka trybu kanału (`422`), `subscriptions/listen` ze złym filtrem, `504` balancera, failover nginx przy martwej instancji (bez `502`).
**ws-07, ws-08, ws-02, ws-03, ws-04, ws-11, ws-12:** zależność 6.1.0, bez zmian w kodzie; ws-11 dopisuje, że adapter działa dla pięciu znanych systemów.

### Erratum do 6.0.0 (tag bez zmian)

- Lista "Niezgodne wstecz względem 5.1.2" w 6.0.0 miała 8 pozycji; dopełnienie: **9.** CC-200 (`cursor: ""` to `-32602`; klient, który wysyła `""`, i gateway, który traktował go jak pierwszą stronę, muszą się zmienić) oraz **10.** CC-202 (mock MSW odrzuca `%zz`, zwykła zmiana major, bez wyjątku). Pozycje 5 (CC-192) i 7 (CC-198) oraz CC-195 są zmianami oczekiwanego zachowania i oczekiwań wektorów, więc część majora; ich opisy w `CONTRACT_CHANGES.md` poprawione w 6.1.0.
- Zalecenie dla ws-01 z 6.0.0 (`proxy_next_upstream off`) było błędne; obowiązuje `error timeout` bez `non_idempotent` (W3).
- Wektory zapowiedziane w CC-192/193/204 pod innymi nazwami: `stream-open-*`, `valid-adapter`, `get-issue-adapter-without-classification`, `balancer-errors/*`.

## 6.0.0 - 2026-11-03

Major według tabeli SemVer (README, "Wersjonowanie"), bez wyjątków: nowa wartość enum (`PendingTool.source: adapter`), warunkowo wymagane `risk` i `action` we wpisie manifestu i zaostrzony kod wyjścia `PolicyLintCli`. Pakiet CC-192 ... CC-205, decyzje człowieka z 2026-11-03 (`mcp-platform-plan/m6-plan.md`, "Decyzje pakietu kontraktów").
Bajty `cedar/mcp.cedarschema` bez zmian (SHA-256 `51d71b2d...`): paczki polityk zbudowane pod 5.x zostają ważne.

### Nowe

- **`list_changed` (CC-192):** `listChanged: true` w obu postaciach protokołu, strumień `GET` sesji z kolejnością kontroli CC-184, `subscriptions/listen` w postaci bezstanowej, okno 1 s, opóźnienie do 5 s, bez limitu strumieni (strumień nie liczy się do limitu żądań w toku, jest metryka). Wektory `endpoint-aggregate/list-changed-sequence-*` (7), `endpoint-filter/stream-open-*` (7); `list-changed-*` (11) bez zmian i normatywne. Referencje `listChangedSequence`, `streamOpenDecision`.
- **Serwery obce przez adapter (CC-193):** `source: adapter` w manifeście, wpisy bez `risk`/`action` i z pustym `resourceRefs` (`AdapterToolEntry`), hash bez `risk`/`action`, klasyfikacja przy `approve` (`ApproveRequest.risk`, `.action`; `422 classification_required`, `classification_not_allowed`), `RegistryTool.classifiedBy`, `.classifiedAt`. Wektory `manifests/*-adapter-*` (6), `definition-hash/get-issue-adapter-without-classification`. Java `DefinitionHash` pomija `risk`/`action`, których wpis nie ma.
- **Wyłącznik awaryjny (CC-194, A9):** C5 `putServerKillSwitch`, `deleteServerKillSwitch`, `putToolKillSwitch`, `deleteToolKillSwitch`, `listKillSwitches`; C12 `putAdminServerKillSwitch`, `deleteAdminServerKillSwitch`, `putAdminToolKillSwitch`, `deleteAdminToolKillSwitch`, `listAdminKillSwitches`; `disabledBy` w katalogu; powody `kill_switch`, `kill_switch_set`, `kill_switch_cleared`. Włączenie bez MFA, zdjęcie po świeżym MFA, propagacja do 5 s, fail-closed. Wektory `kill-switch/` (14), `audit-events/gateway-kill-switch-*`.
- **Doprecyzowania (CC-195 ... CC-205):** `suppressedTargets` w podsumowaniu audytu i limit kluczy per (`sub`, powód); dziewięć powodów brokera w opisie `reason` (`database_unavailable`, `refresh_token_lost`, `user_offboarding` i sześć kolejnych) oraz `secret_missing`; nazwy `jwks_unavailable` i `replay_store_unavailable` obowiązują także w brokerze; `policy_forbid` w audycie przy zakazie na poziomie narzędzia, wiersz użytkownika `denied_not_granted`; `503` z `Retry-After` przy przeciążeniu i niedostępnym magazynie sesji; kursor `""` to `-32602`; claimy `vs`/`vsc` w tokenie IdP ignorowane; wektory `%zz`; `UPDATE` co najmniej raz i `502` balancera ze stałym tekstem (`BalancerError`); połączenie bez sekretu przechodzi w `error`.
- **Wektory:** `kill-switch/`, `balancer-errors/`, `idp-token-claims/` (nowe katalogi), `audit-throttle-keys-limited-per-reason`, `cursor-empty-string`, `mcp-endpoint/http-broken-escape`, `http-lone-percent`, `http-half-escape`, `gateway-authentication/overloaded`, `session-store-unavailable`, `activity-calls/aggregation-denied-policy-forbid-*`, `aggregation-denied-kill-switch`, `audit-events/broker-*` (5).
- **Java:** `PolicyLintCli.run(String[], PrintStream, PrintStream)` (testowalny kod wyjścia).

### Niezgodne wstecz względem 5.1.2

1. **`PendingTool.source`, `RegistryTool.source`:** enum `[ci, server, adapter]` (CC-193). Wygenerowane typy trzeba zregenerować; kod z wyczerpującym `switch` po `source` musi obsłużyć `adapter`.
2. **`ToolEntryFields`:** `risk` i `action` nie są już wymagane w samym `ToolEntryFields`; wymaga ich `ToolEntry`, a `AdapterToolEntry` ich zabrania. W typach TS `RegistryTool.risk`/`action` są opcjonalne (brak tylko dla oczekującego wpisu adaptera). `PendingTool.pendingEntry` to `ToolEntry` albo `AdapterToolEntry`.
3. **`server-manifest.schema.json`:** nowe pole `source`, `tools.items` to `oneOf` zależnie od `source`. Manifesty bez `source` przechodzą jak dotąd.
4. **`PolicyLintCli` i `PolicyLint.impossible`:** kończą się błędem (kod `2`, wyjątek `IllegalStateException`), gdy schemat albo polityka nie przechodzą walidacji; wcześniej kod `0` (CC-203).
5. **`listChanged`:** gateway musi deklarować `true` i wysyłać powiadomienia (CC-192); `GET` na `/mcp` przestaje być zawsze `405`.
6. **Wektory `audit-throttle-*`:** podsumowania mają `suppressedTargets`; limit kluczy jest liczony per (`sub`, powód). Wektor `audit-events/gateway-audit-suppressed-summary` ma `suppressedTargets: 4`.
7. **Odpowiedź wiersza aktywności:** `policy_forbid` z `errorCode: not_found_or_denied` to `denied_not_granted` (nie `denied_policy`); `kill_switch` to `tool_disabled`.
8. **Nazwy powodów brokera:** `key_source_unavailable` i `jti_store_unavailable` nie są zdefiniowane; wektor `invalid-broker-authentication-key-source-unavailable` je odrzuca.

### Migracja z 5.x

**ws-01 stos dev i platforma:** zależności na 6.0.0 (`MCP_CONTRACTS_REF`); nginx: `proxy_next_upstream error timeout` bez `non_idempotent` (patrz erratum w 6.1.0), strona błędu `502` i `504` w JSON z tekstem z `BalancerError` (nagłówki `nosniff` i CSP), buforowanie wyłączone i długi `proxy_read_timeout` dla `GET` strumienia SSE na `/mcp` i `/s/...`; Redis pub/sub (lub licznik wersji) dla zdarzeń rejestru, polityk i przełączników; alerty na `kill_switch_set` i `suppressedTargets`.
**ws-02 starter:** zależność 6.0.0; `ManifestExport` bez zmian (serwer na starterze nie ustawia `source`); README: operacje `UPDATE` projektować tak, by powtórzenie było nieszkodliwe (CC-204); nazwy `jwks_unavailable` i `replay_store_unavailable` są już zgodne.
**ws-03 szablon, ws-04 serwery (jira, confluence, gitlab, servicedesk, opensearch):** tylko zależność 6.0.0 i regeneracja manifestu (hashe bez zmian).
**ws-05 gateway:** (1) `listChanged: true`, strumień `GET` z kolejnością CC-184 i `405` z `Allow: POST, DELETE, GET` poza nim, `subscriptions/listen`, okno 1 s, kanał zdarzeń między instancjami, opóźnienie do 5 s, strumień poza `MCP_MAX_CONCURRENT_REQUESTS`, metryka otwartych strumieni; (2) wyłącznik awaryjny: tabela w bazie, pięć operacji C5, cache nie starszy niż 5 s, odmowa `tool_disabled` z `kill_switch`, fail-closed, `approve`/`PUT` nie zdejmują, `disabledBy` w katalogu; (3) rejestr: `source: adapter`, klasyfikacja przy `approve`, `classification_required`/`classification_not_allowed`, niesklasyfikowane to `tool_disabled`, hash bez `risk`/`action` (Java `DefinitionHash`);
(4) audyt: `policy_forbid` przy `forbid` na poziomie narzędzia (wiersz użytkownika `denied_not_granted`), `suppressedTargets`, limit kluczy per (`sub`, powód), `503` z `Retry-After` przy shed (2 s) i przy magazynie sesji (10 s, nie `404`); (5) kursor `""` to `-32602`; claimy IdP ignorowane i niekopiowane; (6) brak automatycznego ponowienia `tools/call` `UPDATE`/`DESTRUCTIVE`.
**ws-06 broker:** zmienić `key_source_unavailable` na `jwks_unavailable` i `jti_store_unavailable` na `replay_store_unavailable`, w zdarzeniu `authentication` z wynikiem `denied` i `errorCode: upstream_unavailable`; po wykryciu braku sekretu stan `error` i zdarzenie `secret_missing` (wiersz wypada z batcha sweepu); sprawdzić zdarzenia 9 powodów z opisu `reason` na wektorach `audit-events/broker-*`.
**ws-07 BFF:** operacje C12 wyłącznika (zdjęcie ze step-up jak `acceptRiskLowering`, włączenie bez), `approveAdminTool` z `risk` i `action`, `disabledBy`; `%zz` jako `invalid_filter` (już tak jest, wektory `http-broken-escape`).
**ws-08 web:** ekran wyłącznika (lista aktywnych, włącz, zdejmij ze step-up), dialog klasyfikacji przy zatwierdzaniu wpisu `source: adapter` (sugestie z `annotations` jako tekst niezaufany), `risk`/`action` opcjonalne w `RegistryTool`, stan `error` połączenia z prośbą o ponowne połączenie; mock MSW z nowymi operacjami.
**ws-09 polityki:** `PolicyLintCli` na 6.0.0 zwraca `2` dla polityk niezgodnych ze schematem (krok potoku musi to uznać za błąd); bajty schematu Cedar bez zmian, paczki 5.x ważne.
**ws-10 e2e:** scenariusze: zatwierdzenie narzędzia w trakcie sesji daje `list_changed` (obie postaci, drugi klient), wygaśnięcie tokenu zamyka strumień; wyłącznik (efekt na dwóch instancjach w <= 5 s, restart, awaria bazy, zdjęcie po MFA); kursor `""`; token IdP z `vs`; zabicie instancji w trakcie `UPDATE` daje `502` z tekstem stałym; klasyfikacja narzędzia adaptera.
**ws-11 dokumentacja:** sekcje: A9 (wyłącznik), semantyka dostarczenia `UPDATE`, `list_changed` dla klientów, klasyfikacja obcych narzędzi.
**ws-12 testy obciążeniowe:** zdarzenia strumieni nie wchodzą do pomiaru limitu żądań w toku; `suppressedTargets` w analizie audytu.
**ws-13 adapter (nowy):** manifest z `source: adapter`, bez `risk`/`action`, `resourceRefs: []`, definicje zamknięte i ograniczone, hash bez `risk`/`action` (Java `DefinitionHash.ofManifestTool`), walidacja argumentów przed przekazaniem, nazwy powodów uwierzytelnienia jak starter.

## 5.1.2 - 2026-11-01

Patch z opisanym wyjątkiem SemVer (README, "Wersjonowanie"): CC-191, poprawka CC-190 po przeglądzie. Bajty `cedar/mcp.cedarschema` bez zmian.

- **Klucz ograniczania audytu (CC-191):** (`sub`, powód, cel) zamiast (`sub`, powód): wywołanie innego narzędzia, inny zły filtr albo inny kursor nie są wyciszane przez wabik. Limit 50 kluczy na użytkownika (`MCP_AUDIT_THROTTLE_MAX_TARGETS_PER_USER`), nadmiar dzieli klucz zbiorczy.
- **Zdarzenie podsumowujące:** po zamknięciu okna para (`sub`, powód) dostaje jedno zdarzenie z nowym opcjonalnym polem `suppressedCount` (schemat audytu). Licznik `mcp_audit_endpoint_suppressed_total{reason}` zostaje.
- Wektory `endpoint-aggregate/audit-throttle-*` przepisane (10), nowy `audit-events/gateway-audit-suppressed-summary`.

Migracja:
**ws-05 gateway:** kod trzeba dostosować: `RateLimitAuditThrottle` ma klucz (`sub`, powód) i tylko licznik; potrzebne: cel w kluczu (nazwa narzędzia albo skrót filtra, surowego query lub kursora), limit kluczy na `sub` z kluczem zbiorczym, zdarzenie podsumowujące z `suppressedCount` po oknie (czasomierz albo sprawdzenie przy kolejnym zdarzeniu grupy), konfiguracja limitu.
**ws-10 e2e:** scenariusz: wabik na niewinne narzędzie nie ukrywa wywołania `jira__delete_issue`; po oknie jest zdarzenie z `suppressedCount`; ponad 50 wymyślonych narzędzi nie powiększa pamięci.
**ws-01 stos dev:** alert na `suppressedCount`. **Pozostali:** bez zmian.

## 5.1.1 - 2026-11-01

Patch z opisanym wyjątkiem SemVer (README, "Wersjonowanie"): CC-189 i CC-190, decyzje człowieka z 2026-11-01. Bajty `cedar/mcp.cedarschema` bez zmian.

- **Query ponad limit transportu (CC-189):** `400` albo `414` w JSON `{"error":"invalid_request"}`, bez `reason`; nowy schemat `TransportLimitError` w `common.schema.json`; `invalid_filter` obowiązuje do limitu transportu (około 15 KB). Wektor `endpoint-filter/error-response-over-transport-limit`.
- **Audyt odrzuceń (CC-190):** `invalid_filter`, `filter_mismatch`, `invalid_cursor` i `tools/call` z `not_found_or_denied` (`not_granted`, `filter_scope`) najwyżej raz na użytkownika i powód w interwale (`MCP_RATE_LIMIT_AUDIT_INTERVAL`, 10 s, pamięć instancji); nadmiar w `mcp_audit_endpoint_suppressed_total{reason}`; odrzucenie zawsze działa. Referencja `auditThrottle`, wektory `endpoint-aggregate/audit-throttle-*` (6).

Migracja:
**ws-05 gateway (dokumentacja i kod):** ten sam mechanizm co `RateLimitAuditThrottle` dla czterech powodów (jeden licznik `mcp_audit_endpoint_suppressed_total{reason}`, nazwa do potwierdzenia); limit nagłówka serwera HTTP i odpowiedź `400`/`414` w JSON bez `reason` zbudowana poza filtrem.
**ws-01 stos dev:** nginx: `large_client_header_buffers` i strona błędu `414`/`400` w JSON (z `nosniff` i CSP); alert na licznik pominięć.
**ws-10 e2e (luki G3, G5, G12 z raportu ws-10; numeracja według raportu, kontrakt jej nie zna):** scenariusze: query 20 KB (`400`/`414`, bez `reason`, bez obsługi bez filtra), pętla złych filtrów, cudzych kursorów, sesji z innym filtrem i wywołań narzędzia spoza listy (jedno zdarzenie na użytkownika i powód w 10 s, wszystkie żądania odrzucone, licznik rośnie), drugi użytkownik nie jest wyciszony.
**ws-02, ws-03, ws-04, ws-06, ws-07, ws-08, ws-09:** bez zmian.

## 5.1.0 - 2026-10-31

Przegląd 5.0.0 (Opus, 2026-10-31) znalazł sprzeczności i luki w CC-169 ... CC-177; decyzje człowieka z tego samego dnia dały CC-178 ... CC-188. Nikt jeszcze 5.0.0 nie wdrożył, ale artefakty `5.0.0` są w `~/.m2` i w `release/` i są niezmienne.
Bajty `cedar/mcp.cedarschema` bez zmian (SHA-256 jak w 5.0.0, `51d71b2d...`): paczki polityk zbudowane pod 5.0.0 zostają ważne. Wydanie minor z opisanym wyjątkiem SemVer (README, "Wersjonowanie"): część zmian jest według tabeli zaostrzeniem walidacji albo zmianą oczekiwań, czyli major (lista niżej); człowiek zdecydował (2026-10-31), że wydajemy 5.1.0, bo 5.0.0 nikt nie wdrożył. Nowe CC: CC-178 ... CC-188.

### Nowe (addytywne)

- **Stronicowanie `tools/list` (CC-181):** 100 narzędzi na stronę, `nextCursor`, kursor nieprzezroczysty, uwierzytelniony HMAC, związany z `sub` i filtrem, ważny 15 minut; zły kursor to zawsze `-32602` i powód audytu `invalid_cursor`. Listy do 100 narzędzi wyglądają jak w 5.0.0.
- **Limit czasu `tools/list` na serwer (CC-180):** `MCP_TOOLS_LIST_TIMEOUT`, domyślnie 3 s; serwer po limicie jest pomijany jak niedostępny; definicja "niedostępny".
- **Wektory:** `endpoint-filter/call-state-*` (14), `session-order-*` (7), `apply-*-risk-outside-the-set` (3); `endpoint-aggregate/availability-*`, `page-*`, `cursor-*`, `list-slow-server-skipped`, `list-changed-definition-changed-and-approved`; `mcp-endpoint/http-*` (4); nowy katalog `oauth-metadata/` (6).
- **Referencje JS:** `callDecision(filter, tool, mayCall, state)`, `sessionDecision`, `serverAvailable`, `page`, `issueCursor`, `readCursor`, `composeQuery`, `protectedResourceMetadata`.
- **Java:** `PolicyLint.impossible(Schema, PolicySet)`, opcja `--schema` w `PolicyLintCli`; `guava` w zakresie `provided` w `mcp-policy-bundle` (tylko do odczytu ostrzeżeń walidatora; konsument nie dostaje nowego artefaktu).

### Doprecyzowania i poprawki

1. **`tools/call` na `/mcp` (CC-178):** najpierw `mayCall` (rejestr plus decyzja Cedar na poziomie narzędzia, niezależna od dostępności), potem filtr (`not_found_or_denied`, audyt `filter_scope`, bez względu na stan serwera), dopiero potem `tool_disabled`, `upstream_unavailable`, `credential_required`. Filtr poprzedza bramkę potwierdzenia `DESTRUCTIVE`;
   wywołanie wycięte nie unieważnia oczekującego potwierdzenia. W 5.0.0 README i CC-169 przeczyły CC-170 i referencji.
2. **`list_changed` przesunięte na M6 (CC-179):** gateway deklaruje `listChanged: false`, nie wysyła powiadomień, `GET` na `/mcp` to `405` (`Allow: POST, DELETE`). Referencja i wektory `list-changed-*` zostają jako materiał dla M6.
3. **Sesja (CC-184):** kolejność token, składnia (`400`), `sub` sesji (cudza albo nieznana: `404` bez `filter_mismatch`), trasa (`404`, `filter_mismatch`), filtr (`404`, `filter_mismatch`); `Mcp-Session-Id` z `_meta` to żądanie sesyjne; wiązanie porządkuje audyt i nie jest barierą.
4. **BFF (CC-182):** `getMcpEndpoint` dostaje wartości typowane w OpenAPI, zdekodowane przez HTTP, i sam składa query; `%2C` jest poprawny, zdekodowane `%`, `&`, `=` w wartości to zły filtr; mock MSW odrzuca `%` i powtórzone parametry.
5. **Lint (CC-183):** `PolicyLintCli` i `PolicyLint.impossible` kończą się błędem przy "policy is impossible"; odbiorca paczki bez zaostrzenia.
6. **Limit 512 bajtów (CC-185):** to on ogranicza `tools=`, nie 100 narzędzi (16 nazw po 30 znaków).
7. **Filtr (CC-186):** Java `EndpointFilter.allows` nie przepuszcza ryzyka spoza zbioru przy `access=write`; ścisły wzorzec `EndpointFilterQuery`; pole `filter` w audycie tylko na gatewayu i czterech zdarzeniach, nie przy `invalid_filter`; opis pola nie twierdzi już, że to wyłącznie nazwy istniejących systemów.
8. **Tekst i wektory (CC-187):** `denied_link_scope` w opisie `ActivityCall.result`, `filter_scope` w aktywności użytkownika, wektor `list-changed-definition-approved-outside-filter`, klient gubiący query dostaje pełną listę bez błędu (ciche poszerzenie widoku, nie uprawnień), metadane `oauth-protected-resource/mcp`, cztery sprzeczności wewnątrz CC.

### Niezgodne wstecz względem 5.0.0 według tabeli SemVer (wyjątek 5.1.0)

Zaostrzenie walidacji albo zmiana oczekiwanego zachowania: CC-179 (`listChanged` z `true` na `false`, usunięty wymóg powiadomień), CC-178 i CC-184 (inny wynik w scenariuszach, które 5.0.0 zostawiało sprzeczne albo otwarte), CC-182 (mock MSW odrzuca teraz `%` i powtórzony parametr),
CC-183 (`PolicyLintCli` kończy się błędem tam, gdzie kończył się sukcesem), CC-186 (wzorzec `EndpointFilterQuery`, warunki schematu audytu, wynik `EndpointFilter.allows` dla ryzyka spoza zbioru), CC-187 (zmiana wejścia wektora `list-changed-definition-approved-outside-filter`).
Oczekiwania istniejących wektorów `endpoint-filter/`, `endpoint-aggregate/list-*` i `mcp-endpoint/` bez zmian poza ostatnim wektorem i opisem `invalid-percent-encoding`. Paczka polityk, JWT i bajty schematu Cedar bez zmian.

### Migracja

**ws-05 gateway:** (a) kolejność `tools/call` z CC-178 w `McpGatewayService` (dziś `link_scope` po samym istnieniu narzędzia, `McpGatewayService.java:331-332`); (b) limit czasu odczytu `tools/list` i równoległy fan-out (CC-180); (c) stronicowanie i kursor (CC-181), klucz kursora współdzielony przez instancje;
(d) kolejność kontroli sesji (CC-184), sesja z `Mcp-Session-Id` i `_meta` jako sesyjna, `filter_mismatch` także dla trasy; (e) `listChanged: false`, `GET` to `405` z `Allow`, bez `subscriptions/listen` i kanału zdarzeń; (f) metadane `oauth-protected-resource/mcp` ignorują query;
(g) **migracja aktywności** (luka 5.0.0, CC-188): `ActivityAggregator.java:31` mapuje `link_scope` na `denied_link_scope`, a `ActivityService.java:22` ma `denied_link_scope` w zbiorze `denied`; po 5.0.0 obowiązują `filter_scope` i `denied_filter_scope` (CC-174). Wiersze sprzed aktualizacji z `link_scope` / `denied_link_scope` są mapowane przy odczycie na `denied_filter_scope`, bez przepisywania danych; zdarzenia audytu zostają nietknięte;
(h) **sesje 4.x w Redisie** (luka 5.0.0): nie mają zapisanej trasy ani filtra, a CC-172 i CC-184 wymagają wiązania od `initialize`. Takie sesje nie są uznawane: `404` jak dla nieznanej sesji, klient inicjuje nową (CC-188).
**ws-07 BFF:** (a) wartości typowane i `composeQuery` zamiast przekazywania surowego query (CC-182); (b) katalog dla `toolCount` to **płaska lista** zbudowana z `servers[].tools[]` odpowiedzi `GET /admin/v1/catalog` (C5), a wektory `mcp-endpoint/` pokazują płaską listę (luka 5.0.0).
**ws-08 web:** licznik bajtów query w kreatorze zamiast limitu 100 narzędzi (CC-185); kreator nie wysyła zapytania, którego nie da się złożyć; próg ostrzeżenia o rozmiarze listy nadal nieustalony (pomiar M5), a powyżej 100 narzędzi klient musi iść za `nextCursor` (CC-181).
**ws-09 polityki:** krok `PolicyLintCli` w potoku (CC-183). Do usunięcia z 5.0.0 (luka: CHANGELOG 5.0.0 mówił tylko o `virtual-server.cedar`): `.ci/java/src/main/java/pl/aiwcorpo/mcp/policies/PolicyChecks.java:117` woła usuniętą `PolicyLint.linkContextOutsideForbid` (błąd kompilacji po przejściu na 5.x), a `:167-222` (`linkLiftsForbid`, `readsLinkContext`, `presenceTest`) czytają usunięte `vsScopes` / `virtualServer`;
testy `.ci/java/src/test/java/pl/aiwcorpo/mcp/policies/{ScopeScenarioTest,BundleTest,PolicyChecksTest,DecisionSuite}.java`, `tests/decisions/virtual-server.json`, `tests/decisions/{server-tools,credential-type}.json`, `tests/scopes/{jira,gitlab,confluence,opensearch,servicedesk}.json` i `tests/mutation-equivalents.txt` odwołują się do tych pól i trzeba je poprawić razem z regułami.
**ws-10 e2e:** scenariusze z CC-178 (serwer leży przy filtrze, który wycina i który zostawia narzędzie; wyłączone narzędzie; brak połączenia; wycięte wywołanie `DESTRUCTIVE` przy oczekującym potwierdzeniu), CC-181 (ponad 100 narzędzi, obcy kursor, kursor z innym filtrem), CC-184 (trzy scenariusze kolejności, sesja na innej trasie), wolny serwer (CC-180); bez scenariusza `list_changed` (CC-179).
Nadużycia z CC-170 (luka 5.0.0, nie były w migracji): filtr z 1000 wpisów (`400`, nie obcinanie), `exclude` narzędzia `DESTRUCTIVE` (nie zdejmuje bramki TOTP), filtr wskazujący system bez uprawnień użytkownika (ta sama odpowiedź co dla nieistniejącego, niezmiennik 8), `%` i `%2c` w query, kursor innego użytkownika.
**ws-01 stos dev:** zmienna `MCP_TOOLS_LIST_TIMEOUT` w konfiguracji gateway'a; Redis pub/sub do powiadomień nie jest potrzebny (CC-179).
**ws-02, ws-03, ws-04, ws-06:** bez zmian względem 5.0.0.

## 5.0.0 - 2026-10-31

Wydanie major M5, punkt A (`mcp-platform-plan/m5-plan.md`): jeden adres `/mcp` do całej platformy i filtr w query zamiast zapisanych linków. Wszystkie zmiany łamiące według tabeli SemVer z README, wydane razem, bo CC-169 ... CC-177 odwołują się do siebie.
Decyzje człowieka z 2026-10-31 po PoC OAuth z query w Claude Code (V2, `access=write` rozłączne z `read`, filtr jawny, `filter_scope`, operacja BFF, `/v/` usunięte od razu). Zmieniają się bajty `cedar/mcp.cedarschema`
(SHA-256 `51d71b2dbb7f61fd2593cf4c2f1a2373dea06e8b4431425a3f1aa24fa10a0ba5`, poprzednio `902b2540...`): biblioteki, paczki polityk i serwery przechodzą razem. Nowe CC: CC-169 ... CC-177.

### Zmiany łamiące (względem 4.1.0)

1. **Schemat Cedar (CC-173):** `context.virtualServer`, `context.vsScopes` i typ `VsScopes` znikają. Paczki zbudowane pod 4.x dają `schema_mismatch`. Polityka, która czyta te pola bez ochrony `has`, nie przechodzi walidacji (`policy_invalid`);
   `cedar/examples/virtual-server.cedar` zostaje usunięty (paczki zbudowane z przykładów mają inne bajty i inny skrót).
2. **Wewnętrzny JWT (CC-173):** claimy `vs` i `vsc` nie istnieją (`unevaluatedProperties: false`), token z którymkolwiek to `401 invalid_claims`. `VirtualServerSlug` znika z `common.schema.json`.
3. **Java (CC-173):** `mcp-cedar-entities`: znikają `VirtualServerScope`, `Caller.withVirtualServer` i składnik `virtualServer` rekordu `Caller` (konstruktor kanoniczny ma o jeden argument mniej), `QueryConstraint(resourceType, granted)`, `ScopeGroups.typeOfScopeField`,
   `ScopeGroups.vsScopeField` zmienia nazwę na `scopeField`. `mcp-policy-bundle`: znikają `PolicyLint.linkContextOutsideForbid`, `PolicyLint.LINK_CONTEXT` i `BundleRejectedException.Reason.LINK_CONTEXT_IN_PERMIT`; nowa `PolicyLint.templates`.
4. **C5 (CC-175):** znikają `GET|POST /admin/v1/virtual-servers`, `DELETE /admin/v1/virtual-servers/{slug}`, schematy `VirtualServer*`, `ResourceDefaults` (i pomocnicze `JiraProjectKeys` itd.), tag `virtual-servers`, kody `slug_taken`, `virtual_server_limit_reached`
   i `resource_defaults_unsupported`. `ActivityCall.virtualServer` zastąpione przez `filter`. `POST /admin/v1/users/{sub}/purge` zostaje, bez części "linki".
5. **C12 (CC-175):** znikają `GET|POST /api/v1/virtual-servers`, `DELETE /api/v1/virtual-servers/{slug}`, `PortalVirtualServer*`, `VirtualServerFields`; nowa operacja `getMcpEndpoint` (`GET /api/v1/me/mcp-endpoint`) i schematy `McpEndpoint`, `InvalidFilter`. `ActivityCall.virtualServer` -> `filter`.
6. **Audyt C8 (CC-174):** znika pole `virtualServer` i `event: virtual_server_change` z powodami `vs_created`, `vs_deleted`, `slug_taken`, `virtual_server_limit`; powód `link_scope` zastąpiony przez `filter_scope`; nowe powody `invalid_filter`, `filter_mismatch`;
   nowe pole `filter` (`EndpointFilterQuery`). Wynik aktywności `denied_link_scope` -> `denied_filter_scope`. Zdarzenia brokera nie niosą już `virtualServer`.
7. **`ReturnPath` (CC-169):** `/mcp` jest zarezerwowane obok `/api`, `/s`, `/v`, `/.well-known`; `/f/` nie jest.
8. **Wektory:** usunięte `jwt/valid-virtual-server-*`, `jwt/vs-*` i `vsc-*` (zastąpione przez `valid-mfa` i `removed-vs*`), `entity-builder/` (6 plików), `policy-decisions/gw-vs-*` i `srv-vs-*` (16), `result-filter/*-through-link` i pochodne (przepisane bez linku), `audit-events/` (7 plików linków),
   `activity-calls/aggregation-denied-link-scope`, `bundles/main-permit-reads-*` (zastąpione przez `main-policy-reads-removed-virtual-server`, `main-forbid-reads-removed-vsscopes` i `main-forbid-guarded-by-has-removed-vsscopes-accepted`),
   `gateway-authentication/rejected-on-virtual-server-route`. Wszystkie `bundles/files/*` mają nowe bajty (nowy schemat i zestaw przykładów); `policy-store/*` ma nowe `archiveSha256`; `return-paths/invalid-gateway-v` ma nowy opis.

### Nowe w 5.0.0

- **Adres `/mcp` (CC-169):** wszystkie narzędzia, które użytkownik może teraz wywołać; stała kolejność; system bez połączenia widoczny (`credential_required` przy wywołaniu); serwer niedostępny pominięty. `/v/` to `404 not_found_or_denied` bez audytu (CC-177).
- **Filtr w query (CC-170):** `systems`, `tools`, `access=read|write` (rozłączne), `exclude`; jedna postać kanoniczna, limity (512 B, 5/100/100), `400 invalid_request` z `reason: invalid_filter` (`EndpointFilterError`); referencja `scripts/lib/endpoint-filter.mjs`, Java `EndpointFilter` w `mcp-manifest`.
- **OAuth (CC-171, V2):** zasób `<publicBaseUrl>/mcp` bez query, `resource_metadata` bez query, `aud = mcp-gateway`. Przyjęte ryzyko: potwierdzone tylko dla Claude Code (README).
- **Sesja (CC-172):** filtr związany z sesją MCP, inny filtr to `404` i `filter_mismatch`.
- **Powiadomienia (CC-176):** `notifications/tools/list_changed`; zmiana połączenia konta nie jest wyzwalaczem.
- **Wektory:** `endpoint-filter/` (82), `endpoint-aggregate/` (25), `mcp-endpoint/` (11), `gateway-authentication/rejected-on-aggregate-endpoint*`, `audit-events/` z `filter`, `activity-calls/aggregation-denied-filter-scope`.

Migracja:
**ws-05 gateway:** trasa `/mcp` i filtr (parser według wektorów albo klasa `EndpointFilter`), agregacja list i routing po prefiksie, `400 invalid_filter` po sprawdzeniu tokenu, wiązanie filtra z sesją w Redisie (`filter_mismatch`), `list_changed`, metadane `oauth-protected-resource/mcp` bez query;
usunąć trasę `/v/` (odpowiedź `404`), kontroler, repozytorium i tabelę `virtual_servers` (migracja Flyway), limit `MCP_VIRTUAL_SERVERS_MAX_PER_USER` i część "linki" w `purge`; przestać wystawiać `vs` i `vsc`; zdarzenia z polem `filter` i powodami `filter_scope`, `invalid_filter`, `filter_mismatch`;
`EntityBuilder` bez `withVirtualServer`; nowe bajty schematu Cedar. Wejść razem z ws-02, bo serwery odrzucają token z `vs` i `vsc`, a stary gateway je wystawia.
**ws-02 starter / ws-03 szablon / ws-04 serwery:** zależność `5.0.0`; odbiornik JWT bez `vs`/`vsc`; `Caller` bez składnika `virtualServer`, `QueryConstraint(resourceType, granted)` (zapytania serwera bez zawężenia linku); nowe bajty schematu Cedar (test skrótu); zdarzenia startera bez `virtualServer`.
**ws-06 broker:** zależność `5.0.0`; zdarzenia `authenticator` bez `virtualServer`; `purge` bez zmian po stronie brokera.
**ws-07 BFF:** usunąć proxy linków (`/api/v1/virtual-servers*`), dodać `GET /api/v1/me/mcp-endpoint` (filtr normalizowany regułami gatewaya, `toolCount` z katalogu C5, `clientConfigs` z `publicBaseUrl`, adres w cudzysłowie w poleceniu `claude mcp add`); aktywność z polem `filter` i wynikiem `denied_filter_scope`.
**ws-08 web:** kreator bez zapisu (adres z `getMcpEndpoint`), lista "moje linki" znika; kolumna `filter` w aktywności, etykieta dla `denied_filter_scope`; ostrzeżenie o rozmiarze listy z `toolCount`; trasy SPA nie mogą zaczynać się od `/mcp`.
**ws-09 polityki:** usunąć `virtual-server.cedar` i reguły czytające `virtualServer` / `vsScopes` (także z ochroną `has`, które niczego już nie zawężają); przebudować paczki pod nowy schemat.
**ws-10 e2e:** scenariusze: jedna sesja z narzędziami dwóch systemów, OAuth z filtrem i bez, odświeżenie tokenu, zmiana filtra w sesji, `/v/` = 404, `list_changed` po zatwierdzeniu narzędzia, prompt injection między systemami; asercje audytu z `filter`.
**ws-01 stos dev:** nginx: `/mcp` do gatewaya z nagłówkami `nosniff` i CSP, `/.well-known/oauth-protected-resource/mcp`; Keycloak: mapper audience `mcp-gateway`; Redis współdzielony przez instancje (wiązanie sesji); `mcpdev.py` i seed bez linków.

## 4.1.0 - 2026-10-29

Wydanie minor z opisanym wyjątkiem SemVer (README, "Wersjonowanie"): podłoga ryzyka liczy wpis oczekujący (CC-167). Bajty `mcp.cedarschema` bez zmian (SHA-256 jak w 4.0.0). Nowe CC: CC-165 ... CC-168.

- **Aktywność (CC-165):** zmiana wyniku istniejących wierszy, nie nowe powody (te były znane w 4.0.x): `rate_limited_user|client|tool` -> `rate_limited`, `definition_changed` i `tool_not_served` -> `tool_disabled`,
  `exchange_denied` -> `denied_not_granted`, wszystko w grupie `denied`. Dla `tool_call` z `outcome` innym niż `ok` obowiązuje cała mapa, więc wiersze z `not_granted`, `link_scope`, `policy_forbid`, `step_up_required`
  zmieniają wynik z `error` na `denied_*`. Normatywny kształt `exchange_denied`: `tool_call` allow z `outcome: denied`. Wektory `activity-calls/aggregation-denied-*` i `aggregation-tool-call-denied-*`.
- **Typ poświadczenia (CC-166):** konfiguracja to zbiór typów systemu. Nagłówek `X-MCP-Credential-Type` (istniejący w C3) niesie typ zwrócony przez broker; gateway odmawia, gdy nie należy do zbioru z konfiguracji
  systemu; serwer odmawia przed Cedar, sondą i resolverami, gdy nagłówek nie należy do jego zbioru, brak go albo jest nieznany, ale tylko dla żądań z `X-MCP-Credential` (serwer bez skonfigurowanego typu też odmawia).
  `context.credentialType` w Cedar to typ domyślny systemu z konfiguracji. Wektory `credential-type-header/` (13, w tym GitLab z dwoma typami).
- **Rejestr (CC-167):** podłoga ryzyka (najwyższe zgłoszone, także oczekujące). `PUT` z niższym ryzykiem nie odrzuca manifestu: to narzędzie jest `pending_approval` z `riskLowered: true`, ukryte; jedyna droga w dół
  to `approve` z `acceptRiskLowering: true` (`mcp-platform-admin`, świeże MFA w BFF), jedno zdarzenie `risk_lowered_by_admin` z polem `risk`. Limity fail-closed
  przy niedostępnym Redisie (503 w kształcie C10). `context.credentialType` z konfiguracji systemu.

- **Zbiór typów (CC-168):** `acceptedTypes` nie miesza `service-account` z typami użytkownika (odmowa startu, `422 credential_type_mismatch`, reguła manifestu `credential-types-not-mixed`). Typ domyślny serwera: pierwszy z `accepted-credential-types`.

Migracja: **ws-05 gateway:** podłoga ryzyka i `acceptRiskLowering`, odmowa przy typie brokera różnym od konfiguracji, mapowanie powodów na wyniki, limity fail-closed (503 z `Retry-After`).
**ws-02 starter / ws-04 serwery:** sprawdzenie nagłówka przed Cedar, sondą i resolverami, tylko przy `X-MCP-Credential`. **ws-07 BFF / ws-08 web:** pole `acceptRiskLowering` w `approve` dla admina, wysyłane tylko przy `true` (starszy gateway odrzuca nieznane pole, więc gateway wchodzi pierwszy), ze step-up MFA (`401 step_up_required`); pole `riskLowered` w diffie; wyniki aktywności bez nowych
etykiet; nie proponować `request_access` na podstawie samego `result`. **Krok rejestracji w CI (ws-01/ws-05):** `PUT`, który w 4.0.x kończył się `422`, gdy obniżał ryzyko, teraz zwraca `200`; krok powinien pokazać `riskLowered: true` z odpowiedzi (ostrzeżenie albo błąd kroku), bo narzędzie znika z `tools/list` do decyzji admina. **Gateway i BFF wchodzą razem:** `RegistryTool` i `PendingTool` mają `additionalProperties: false`, więc BFF 4.0.x odrzuci `riskLowered`, a gateway 4.0.x odrzuci `acceptRiskLowering` z nowego BFF. **ws-10:** rozjazd typu, `tool_call` z odmowami, Redis niedostępny, obniżenie ryzyka przez admina.

## 4.0.1 - 2026-10-29

Naprawa sprzeczności wydania 4.0.0 (zgłoszenia ws-09 CC-I i CC-J). Formalnie zmiany łamiące według tabeli SemVer (usunięty tryb, zmieniony wektor, zaostrzona reguła
przykładowa), wydane jako patch na decyzję człowieka z 2026-10-29, z wyjątkiem opisanym w README ("Wersjonowanie"). Bajty `mcp.cedarschema` bez zmian.

- **CC-163:** tryb `serverConfiguredQueues` (kolejki konta serwisowego z konfiguracji serwera) usunięty; grant kolejki tylko z paczki polityk. Wektor
  `srv-servicedesk-service-account-granted-in-server-config` zastąpiony przez `...-server-config-is-not-a-grant` (`deny`, `not_found_or_denied`). Migracja: ws-04 przestaje
  traktować `MCP_SERVICEDESK_ALLOWED_QUEUES` jako grant; ws-09 daje granty kolejek w `static.json`.
- **CC-164:** `credential-type.cedar` rozpoznaje poświadczenie użytkownika listą dozwoloną (`user-oauth`, `user-secret`, `token-exchange`); brak albo nieznany typ to odmowa
  poza grantem. Nowy wektor `srv-servicedesk-unknown-credential-type-ticket-outside-scope-denied`. Bajty `mcp.cedarschema` bez zmian. Migracja: ws-09 przebudowuje paczki.

## 4.0.0 - 2026-10-29

Wydanie major: pakiet kontraktowy M4 (decyzje człowieka z 2026-10-29, `mcp-platform-plan/cc-pakiet-m4.md`) po przeglądzie, który wykazał zmiany łamiące
według tabeli SemVer z README. Człowiek zdecydował o numerze 4.0.0 i zostawił zmiany łamiące. Zmieniają się bajty `cedar/mcp.cedarschema`
(SHA-256 `902b254090cc7bd5b8f4ff3fa26b76850f516e9d07da0f9faed1729deb1412f7`, poprzednio `cf79068b...`); biblioteki, paczki polityk i serwery przechodzą razem.

Nowe CC: CC-133 ... CC-162 (CC-153 odrzucone). Wdrożone wcześniejsze: CC-096, CC-097, CC-113.

### Zmiany łamiące (względem 3.1.1)

1. **Schemat Cedar (CC-136):** nowe bajty `mcp.cedarschema` (opcjonalny `context.credentialType`); paczki 3.1.x dają `schema_mismatch`.
2. **`PUT` rejestru zmienia zachowanie (CC-133):** dotąd nowa albo zmieniona definicja była `pending_approval`, a w M3 gateway zatwierdzał wszystko; teraz zatwierdzane są tylko
   narzędzia `READ_ONLY` z artefaktu budowy przeglądanego commitu, nowe i zmienione `UPDATE`/`DESTRUCTIVE` czekają na `approve`, manifest pobrany od serwera nie jest
   zatwierdzany poza trybem dev.
3. **`PendingTool.pendingVersion`** jest polem wymaganym odpowiedzi (CC-097); odpowiedzi gateway'a 3.1 i stuby 3.1 nie przechodzą walidacji BFF 4.0.
4. **Nowe odrzucenia manifestu (CC-133, CC-138, CC-159):** `422 manifest_rejected` z `reason` `risk_lowered`, `environment_mismatch`, `credential_type_mismatch`; manifest OpenSearch
   z `acceptedTypes: [user-secret]` jest odrzucany, a trzymany manifest, który nie przechodzi przy starcie, wyłącza serwer.
5. **`OAuthCompleteError.error` (CC-158):** nowa wartość `system_not_configured` w enumie; system nieskonfigurowany w brokerze to `422` zamiast `400 invalid_request`.
6. **`ResolvedCredential.expiresAt` (CC-157):** wymagane (niepuste) dla `token-exchange`; broker odrzuca `subjectToken` o złym `aud`, wygasły albo z innym `sub` (`400`).
7. **`not_found_or_denied` (CC-146):** `message` jest stałą (`The resource does not exist or you do not have access to it.`); kolejka service desku poza linkiem daje `not_found_or_denied`,
   nie `access_denied`; wektor `tool-errors/not-found-or-denied` zmieniony.
8. **Klucze `dev-` (CC-137):** odbiorcy odrzucają `kid` i identyfikator z prefiksem `dev-` poza trybem dev (profil `devstack` i jawne `allowTestKeys` razem); klucze `test-` wymagają, jak dotąd, samego `allowTestKeys`. `BundleVerifier.withDevstackProfile`.
9. **Tabela akcji katalogu (CC-113):** `no_access` i `connected` z odmówionym narzędziem bez `requiredEntitlements` nie dają `request_access`; oczekujący wniosek daje `view_request` także przy `connected`.
10. **Wektory ze zmienionym oczekiwaniem:** `tool-errors/not-found-or-denied`, pięć `policy-store/*` (`archiveSha256`), `policy-decisions/srv-vs-narrows-servicedesk-ticket` (dodane `credentialType`, bo nowa reguła przykładu dokłada drugą politykę decydującą) i wszystkie `bundles/files/*` (nowy schemat).
11. **`ManifestRejected`** zamiast `Error` w `422` rejestracji i `approve` (nowe pole `reason`, schemat zamknięty).
12. **Certyfikat potoku i narzędzia nieobecne na serwerze (CC-161):** `PUT` rejestru przyjmuje tylko CN `mcp-registry-ci-<serverId>` dokładnie równy dla `serverId` ze ścieżki;
    dawny `mcp-registry-ci` to `403`. Zatwierdzone narzędzie, którego serwer nie podaje w `tools/list`, jest ukryte (`tool_disabled`, powód `tool_not_served`), a TTL odczytu
    `tools/list` serwera ma górną granicę 60 s (dotąd "zalecane"; konfiguracja gateway'a).
13. **`source` w rejestrze (CC-162):** `PendingTool.source` (`ci` | `server`) jest wymagane w odpowiedzi, a `RegistryTool.source` występuje przy `pending_approval`; odczyt z serwera
    nie zastępuje wpisu ze `source: ci`.

Nowe kody odpowiedzi w istniejących operacjach (`429` w brokerze i BFF, `503` i `422` we wnioskach, `422` w `approve`) są addytywne i nie są tu liczone osobno.

### Nowe w 4.0.0

- **Rejestr (CC-097, CC-133):** `RegistryTool.change`, `approvedInVersion`, `PendingTool.pendingVersion`; zmiana definicji poza wdrożeniem blokuje narzędzie (`tool_disabled`, powód
  `definition_changed`) do `approve`; obniżenie `risk` zawsze `422` (`risk_lowered`); audyt `admin_change` z `definition_registered|definition_submitted|definition_approved|tool_removed`
  i `definitionHash`. Ryzyko rezydualne przyjęte: zmiana nazwy z obniżeniem ryzyka w jednym `PUT`.
- **IGA (CC-096, CC-113, CC-154):** `503`, idempotentny duplikat, `422 not_requestable`; `GET /api/v1/access-requests/entitlements`; `AccessRequest.decidedAt`.
- **Offboarding i retencja (CC-134, CC-155):** `purge` brokera w pełnym zakresie, `POST /admin/v1/users/{sub}/purge` (CN `mcp-offboarding`), powody `user_purged` i `unused_cleanup`, zdarzenie
  zbiorcze `admin_change` przy każdym `purge`; po `purge` `sub` nie jest blokowany (okno do 60 min przyjęte); retencja aktywności to konfiguracja (domyślnie 30 dni), audyt w SIEM 365 dni.
- **Limity (CC-135, CC-156):** `429` z `Retry-After` dla żądań MCP innych niż `tools/call`, powody `rate_limited_user|client|tool`, `429` w brokerze i BFF; bez `X-RateLimit-*`.
- **Poświadczenia (CC-157, CC-158, CC-159):** semantyka `token-exchange` i `service-account` w `resolve`, `403 exchange_denied`, `422 system_not_configured`, `credential_type_mismatch`.
- **Cedar (CC-136, CC-148, CC-149):** `context.credentialType` (gateway podaje zawsze z konfiguracji systemu), przykład fail-closed dla konta serwisowego Service Desku, reguły zapisu
  Confluence, Service Desk i OpenSearch.
- **Środowisko dev (CC-137, CC-138):** tryb produkcyjny domyślny, tryb dev = profil `devstack` plus jawne ustawienie; opcjonalne `environment` w manifeście.
- **Zapytania serwera (CC-160):** `scripts/lib/query-rendering.mjs` (listy pól i operatorów normatywne) i `test-vectors/query-rendering/` (także argumenty indeksu OpenSearch).
- **Doprecyzowania:** CC-139 (`OpenSearchIndexPrefix` bez alternacji), CC-140, CC-141, CC-142 (słownik `reason`, grupy filtra), CC-143, CC-144, CC-145, CC-147, CC-150, CC-151, CC-152.

### Migracja per komponent

- **mcp-starter-lib (ws-02):** biblioteki 4.0.0; wejście buildera z `credentialType` z konfiguracji serwera, zawsze; odrzucanie `kid` `dev-` poza trybem dev; stały `message` dla
  `not_found_or_denied` i kolejność "grant przed budową encji"; `upstream_unavailable` i powód `policy_unavailable` przy braku paczki; budżet zdarzeń `authentication` i licznik
  `mcp_audit_authentication_suppressed_total{component,reason}`, bez zdarzenia dla `400`/`413` przed JWT; manifest jako artefakt budowy do `PUT`, `environment: dev` w profilu dev;
  `contractPattern` z `OpenSearchIndexPrefix` działa bez obejścia.
- **mcp-server-template / serwery (ws-03, ws-04):** `nothingToQuery()` daje pusty wynik, a po id `not_found_or_denied`; zapytania ze struktury (`query-rendering`, listy normatywne);
  OpenSearch: manifest z `acceptedTypes` zawierającym `token-exchange` zarejestrowany **przed** gatewayem 4.0.0, rozwiązywanie wzorców do nazw bez aliasów, potem `aggregate_logs`
  może wrócić; kolejka poza linkiem to `not_found_or_denied`; źródła klasyfikacji (CC-149); Service Desk: `service-account`.
- **mcp-gateway (ws-05):** certyfikat potoku `mcp-registry-ci-<serverId>` związany ze ścieżką (inaczej `403` i audyt); `PendingTool.source` i pierwszeństwo wpisu z `PUT`; zatwierdzone narzędzie nieobecne na serwerze ukryte (`tool_not_served`); TTL odczytu `tools/list` najwyżej 60 s; `PUT` zatwierdza tylko `READ_ONLY` z artefaktu budowy, reszta `pending_approval`; brak bootstrapu poza `devstack`; porównanie definicji z serwera z zatwierdzoną
  (`definition_changed`); `approve` z audytem i `422` dla `risk_lowered`; `422` dla `environment_mismatch` i `credential_type_mismatch` (także przy starcie: serwer wyłączony);
  `POST /admin/v1/users/{sub}/purge` ze zdarzeniem zbiorczym; limity z `429` i powodami `rate_limited_*`; `token-exchange`/`service-account` w `resolve` (`exchange_denied` na `access_denied`,
  `system_not_configured` na `internal_error`); `credentialType` z konfiguracji do buildera przed Cedar; nowe powody C8.
- **mcp-credential-broker (ws-06):** pełny `purge` ze zdarzeniem zbiorczym, `unused_cleanup`, `token-exchange` ze sprawdzeniem `subjectToken` i `service-account`, `403 exchange_denied`,
  `422 system_not_configured` (także w `oauth/*`), `429` dla OAuth i domyślnie 10 startów rejestracji na godzinę, powody `provider_revoke_failed`, `authenticator_seed_missing`, `user_purged`, `subject_token_invalid`.
- **mcp-portal BFF (ws-07):** `503`/`422`/idempotencja wniosków, `GET /api/v1/access-requests/entitlements`, `decidedAt`, `429` z `Retry-After`, `422` w `approve`, `pendingVersion` wymagane,
  `422 system_not_configured` w `oauth/*` i nowa wartość enum, reguły `request_access`/`view_request`.
- **mcp-portal web (ws-08):** widok diffu z wersjami i polem `source` (wpis z serwera oznaczony, jego wersja zgłoszona przez serwer); po wdrożeniu przez `PUT` oczekują tylko narzędzia zapisu; wybór uprawnienia przy wniosku z serwera; komunikat "Zbyt wiele wywołań";
  grupy filtra `result`; "ostatnie użycie" konta serwisowego z `activity/calls` (CC-150).
- **mcp-policies (ws-09):** przebudowa paczek na schemacie 4.0.0; reguły zapisu z przykładów (CC-148); reguły z `credential-type.cedar` dla konta serwisowego; reguła wyłączająca
  `aggregate_logs` zdejmowana dopiero po wdrożeniu CC-160 w serwerze OpenSearch.
- **mcp-platform-dev (ws-01):** potoki rejestru dostają certyfikaty `mcp-registry-ci-<serverId>` (jeden na serwer); klucze generowane lokalnie z `kid` `dev-`, tryb dev tylko ze stosem `devstack` i jawnym ustawieniem; bootstrap manifestu tylko w dev; serwery `devstack`
  wysyłają `environment: dev`; wywołanie obu `purge` w offboardingu (powtórzone po wylogowaniu).
- **mcp-e2e (ws-10):** trzymany manifest nie przechodzi przy starcie (`credential_type_mismatch`) -> `enabled: false` i `tool_disabled`; `PUT` innym CN dla cudzego serwera -> `403`; odczyt z serwera nie zastępuje wpisu z `PUT`; zatwierdzone narzędzie, którego serwer nie podaje, jest ukryte; `dev-` z samym `allowTestKeys` odrzucony; blokada po zmianie definicji i ręczne `approve`, `PUT` z manifestem X przy serwerze serwującym Y (Y ukryte), `429`, offboarding (oba `purge`, zdarzenia zbiorcze),
  `token-exchange` i `service-account`, `dev-` odrzucony w trybie produkcyjnym, `environment_mismatch`, odczyt kolejki poza zakresem kontem serwisowym.

## 3.1.1 - 2026-10-28

Doprecyzowania bez zmiany schematu Cedar (skrót SHA-256 jak w 3.1.0).

- Doprecyzowanie: wyjątek SemVer w 3.1.0 wynika z błędu koordynatora, przyjęty przez człowieka; zmiana jest łamiąca dla paczek polityk 3.0.x.
  Człowiek zdecydował (2026-10-28), że 3.1.0 zostaje z wyjątkiem opisanym jak przy 2.1.0 (README, "Wersjonowanie").
- **Klasyfikujemy projekty GitLaba, nie grupy (decyzja człowieka 2026-10-28):** GitLab API v4 nie ma `topics` dla grup, więc założenie z
  3.1.0 ("topics samej grupy") było błędne. `classification` grupy jest zawsze pusty (brak źródła), a serwer podaje
  `ancestorClassifications` ze ścieżki z pustymi listami; `inheritedClassification` zostaje w schemacie dla zgodności z 3.1.0 i w praktyce jest pusty.
  Ochrona poddrzewa przez oznaczenie grupy nie działa, bo grupy nie da się oznaczyć; `restricted` działa na projekcie (`classification`).
  Wektory `srv-gitlab-group-unclassified-allowed` i `srv-gitlab-project-topic-in-unclassified-group-denied`. Migracja: ws-04 nie czyta topics grup.

## 3.1.0 - 2026-10-28

Wydanie minor (CC-129), ale ze zmianą bajtów `cedar/mcp.cedarschema` (skrót SHA-256 `cf79068b...`): biblioteki i paczki polityk muszą przejść razem.

- **`inheritedClassification` (CC-129):** wymagany atrybut zbioru napisów na `GitLab::Group` i `GitLab::Project` z klasyfikacją wszystkich
  grup-przodków; oznaczenie grupy `restricted` obejmuje całe poddrzewo (podgrupy i projekty na każdym poziomie). Serwer GitLaba podaje
  w `ResolvedResource` `attrs.ancestorClassifications` (mapa ścieżka grupy -> topics, dokładnie dla grup przodków, `{}` dla grupy
  najwyższego poziomu); builder liczy atrybut, a brak lub niezgodność danych to `internal_error` (fail-closed).
  Przykładowa reguła `forbid` sprawdza atrybut.
- **Wyjątek SemVer:** według tabeli w README to zmiana major (nowy wymagany atrybut encji i nowe wymagane wejście buildera), łamiąca dla paczek polityk 3.0.x; wydana jako 3.1.0 (minor), patrz 3.1.1.
- **Migracja:** ws-04 (serwer GitLab) pobiera topics każdej grupy-przodka i podaje `ancestorClassifications`; ws-02/ws-05 używają bibliotek 3.1.0;
  ws-09 przebudowuje paczki na schemacie 3.1.0 i dodaje do `classification.cedar` `forbid ... resource.inheritedClassification.contains("restricted")`;
  ws-10 testuje projekt trzy poziomy pod grupą `restricted`. Paczki zbudowane na schemacie 3.0.x przestaną przechodzić (`schema_mismatch`).
- Decyzje przeglądu polityk M3 bez zmiany kontraktu: CC-130 (delete/admin jako DESTRUCTIVE w manifeście) odrzucone, CC-131 (wymagana klasyfikacja
  GitLab i service desk) odrzucone, CC-132 (`BundleFetcher`, powód `upstream_unavailable`) odłożone.

## 3.0.2 - 2026-10-28

Poprawka wydania i zaostrzenie walidacji audytu (patch jako poprawka bezpieczeństwa; komponenty zależą od 3.0.2).

- **Usterka wydania 3.0.0 i 3.0.1:** jary zostały zbudowane z niewyczyszczonego `target/`. `mcp-contracts-3.0.0-test-vectors.jar` i
  `mcp-contracts-3.0.1-test-vectors.jar` zawierają po 49 plików usuniętych w 3.0.0 (m.in. cały `whoami-identity/` w 2.2.x, wektor
  `audit-events/gateway-authentication-denied-replay-store-unavailable.json` sprzeczny ze schematem, stare `confirmation-binding/`), a
  `mcp-contracts-3.0.0.jar` i `-3.0.1.jar` stary stub `mocks/wiremock/gateway-admin/mappings/decideConfirmation.json`. Wcześniejsze jary:
  `test-vectors` 1.1.0 (2 nadmiarowe pliki) i 2.2.1 ... 2.2.5 (5 plików `secret-expiry/`); pozostałe zgodne z drzewem tagu. Tarballe npm
  3.0.0 i 3.0.1 są zgodne z drzewem. Wydane wersje są niezmienne, więc poprawką jest 3.0.2.
- **Proces wydania:** `verify-all.sh` robi `./mvnw clean verify`, a `scripts/check-jar-contents.mjs` porównuje zawartość jarów
  (`mcp-contracts` i `-test-vectors`) z drzewem źródeł i kończy się błędem przy każdej różnicy.
- **Zaostrzenie C8:** wzorzec dla `resource.id`, `resource.parent` (część id) i `backendUser` wyklucza teraz wszystkie znaki `\p{Cf}`
  (zero-width U+200B..U+200F, U+2060, U+FEFF, kontrolki dwukierunkowości, U+061C, znaki tagów U+E0000..U+E007F), `\p{Cc}`, surogaty,
  nieznaki, U+2028/2029, U+034F, U+115F, U+1160, U+3164, U+FFA0, U+2800 i selektory wariantów U+FE00..U+FE0F, spójnie ze wspólną definicją
  higieny tekstu (CC-121; dla pól logu surowiej: także ZWJ/ZWNJ i LRM/RLM). Wektory `invalid-resource-id-*`, `invalid-resource-parent-*`,
  `invalid-backend-user-zero-width`. Wzorzec używa `\p{..}` (JSON Schema w trybie Unicode); Spectral nie ma trybu Unicode, więc jego
  walidację przykładów zastępuje test Node z ajv (`test/openapi-examples.test.mjs`).
- `markConfirmationViewed` (C5): odpowiedź `503` (stan gateway'a niedostępny; strona podglądu pokazuje, że ochrona "pierwsza wygrywa"
  nie jest aktywna).

## 3.0.1 - 2026-10-28

Poprawka bezpieczeństwa wydania 3.0.0 (komponenty M3 startują od 3.0.1). Schematy i OpenAPI bez zmian kształtu; zmienia się reguła
gateway'a i wektory.

- **Luka w 3.0.0 (CC-127, G-H1):** po potwierdzonym, obejrzanym A powtórzenie tej samej operacji (A') nie wołało `invalidate-codes`, więc drugi kod
  wpisany przez człowieka "dla A" potwierdzał A'. Od 3.0.1 tworzenie nowej oczekującej DESTRUCTIVE po potwierdzonym, obejrzanym A (do
  `A.expiresAt + 90 s`) zawsze najpierw spala kody, także dla tej samej operacji (wyjątek tej samej operacji tylko dla A niewykonanego).
  Wektor `first-call-preview-viewed-confirmed-same-operation-burns`. Gateway z 3.0.0 powinien przejść na 3.0.1.
- Doprecyzowania: `GET`/`viewed` dla wyczerpanego, nieoglądanego A to `404` (oglądane: idempotentne), anulowanie do `expiresAt`, zegary
  (NTP, rozjazd do 5 s), wymagania strony podglądu, agregacja `authenticator_disabled`/`authenticator_not_registered` jako oczekujące
  (po TTL `expired`), kursor bez "for example", wektory "przy anulowaniu broker niedostępny: 503" i podglądu wyczerpanego A.
- Zostaje w planie: 503 w `markConfirmationViewed` (C5), decyzja o eskalacji z potwierdzeń o innym ryzyku (G-L8).

## 3.0.0 - 2026-10-28

Wydanie major, ścisły SemVer. Wersja robocza przed wydaniem miała numer `3.0.0-SNAPSHOT` (Maven: artefakt mutowalny, nie
koliduje z niezmiennymi wydaniami w `~/.m2`; repo nie używało przyrostków `-rc`); po wydaniu praca idzie na `3.0.1-SNAPSHOT`.
`cedar/mcp.cedarschema` bez zmian (skrót SHA-256 jak w 2.0.0), więc istniejące paczki polityk działają.

### Zmiany niezgodne z 2.2.5

1. **Potwierdzenia kodem TOTP (CC-091, CC-092, CC-093, CC-094, CC-098, CC-126, CC-127).**
   - C11: kod z Authenticatora (RFC 6238) wpisuje człowiek w kliencie; weryfikuje broker. Kod nie jest wydawany przez
     platformę. Podgląd opcjonalny. Limity: 5 błędnych / 15 min -> blokada 15 min (zdejmuje ją tylko czas), 20
     błędnych / 24 h -> Authenticator wyłączony do ponownej rejestracji (`state: disabled`), 3 próby na wywołanie,
     rejestracja ważna 10 min, TTL 120 s, jedna oczekująca operacja `DESTRUCTIVE` na użytkownika.
   - Usunięte: `POST /admin/v1/confirmations/{id}` i `POST /api/v1/confirmations/{id}`, schematy `ConfirmationDecision` i
     `ConfirmationOutcome`, `StepUpRequired`/`StepUpOrUnauthenticated` w C5, pole `confirmUrl`, kod błędu
     `confirmation_declined` (C10 i `ErrorCode`), powód audytu `user_declined` (nie jest emitowany).
   - `confirmation_required` (C10): wariant z oczekującym wywołaniem ma `confirmationId`, `description`, `previewUrl`,
     `expiresAt` (wszystkie wymagane); wariant bez rejestracji ma tylko `registerUrl`.
   - Nowe w C10: `confirmation_superseded`, `confirmation_cancelled` (właściciel anulował oczekującą operację, CC-128), `confirmation_blocked` (odrzucona operacja DESTRUCTIVE, gdy podgląd oczekującej jest otwarty; blokada do `max(wygaśnięcie, podgląd + 90 s)`). Nowe w C8: `event: "authenticator"` (wymaga `outcome` i `reason`),
     powody `pending_exists`, `user_confirmed_no_preview`, `attempts_exhausted`, `authenticator_not_registered`,
     `authenticator_disabled`, `superseded`, `totp_*`.
   - Nowe w C4: grupa `/v1/authenticator` (status, usunięcie, `enrollment`, `enrollment/confirm`, `verify`) i
     `POST /v1/admin/users/{sub}/authenticator/reset` (CN `mcp-offboarding`); `purge` usuwa też rejestrację. Nowe w
     C12: `/api/v1/authenticator` (GET, DELETE) i `/enrollment`, `/enrollment/confirm`. Ziarno TOTP wychodzi tylko w `201`
     rejestracji (wyjątek w niezmienniku 4). `GET /api/v1/confirmations/{id}`: bez step-up, `ConfirmationView.resource`
     (CC-098); `401` to zwykłe `Unauthenticated`; unieważnione i wygasłe wywołanie to `404`.
   - Atomowość (normatywna): liczniki 5/15 min i 20/24 h w brokerze, rezerwacja próby w gateway'u przed pytaniem brokera i jedna oczekująca DESTRUCTIVE to kroki atomowe na użytkownika; ślad po unieważnionym wywołaniu nie jest oczekującym (ponowne wywołanie tworzy nowe); po otwarciu podglądu pierwsza operacja DESTRUCTIVE wygrywa, inna dostaje `confirmation_blocked` z `retryAfterSeconds` (CC-127); ziarno TOTP tylko w Transit pod `mcp/authenticators/<sha256(sub)>`. Wektory współbieżności `totp/concurrent-*`, `confirmation-binding/*-parallel-*`.
   - `test-vectors/confirmation-binding/` przepisane (usunięte `issued.code`, nowy format `first-call`/`retry`);
     nowe `test-vectors/totp/`; wektor `tool-errors/confirmation-declined` zastąpiony negatywnym.
   - Reguła `destructive-requires-fresh-mfa` zostaje w `cedar/examples/`, ale nie wchodzi do paczki produkcyjnej.
2. **`returnPath` bez zarezerwowanych prefiksów (CC-099):** `/api`, `/s`, `/v`, `/.well-known` jako całe segmenty, oraz
   segmenty `.` i `..` (przed `?`) i średnik są odrzucane (`ReturnPath`, C4 `oauth/start`, C12 `login`, `startConnectOAuth`).
3. **Usunięcia zapowiedziane w 2.x:** `identity_mismatch` z `PutSecretError`, `OAuthCompleteError` i `ConnectErrorCode`
   (CC-101); katalog `test-vectors/whoami-identity/`; wektory `connect-redirects/*identity-mismatch*` są teraz
   negatywne. Poza tym w 2.x nic więcej nie było oznaczone jako deprecated.
4. **Manifest C6:** `definition.title` wymagane (CC-115); `inputSchema` zamknięty i ograniczony (CC-078, CC-123), nowe
   reguły semantyczne `input-schema-closed`, `input-schema-bounded`, `input-schema-no-combinators` (Node i Java).
   Hashe wektorów `definition-hash/` i przykładów rejestru zmieniły się (dodany `title`, `maxLength`, `maxItems`).
5. **Higiena tekstu (CC-121, CC-122):** wspólny zbiór znaków zakazanych, zastępowanie ciągu jedną spacją w tekście z
   systemu, odrzucanie pełnej szerokości ASCII w filtrach wzmianek, brak NFKC; wektory `text-hygiene/` (79).
6. **Audyt C8 (CC-116, CC-125):** nowa wartość `event: "virtual_server_change"` dla zmian linków (powody z CC-107,
   wymagane `outcome` i `reason`); `replay_store_unavailable` tylko z `component` `server` albo `broker`
   (wektor z `gateway` jest teraz negatywny); gateway audytuje odrzucenia na porcie C5.
7. **Gateway przy niedostępnym JWKS IdP (CC-124):** `503 upstream_unavailable` zamiast `401`, bez `WWW-Authenticate`, z
   `Retry-After` (domyślnie 10 s) i `Cache-Control: no-store`; wektory `gateway-authentication/`.

### Zmiany zgodne (minor)

- `resource.parent` w C8 (a z nim `ActivityCall`, `ConfirmationView`) bez znaków sterujących i bidi w części id (CC-031).

- `$defs` używane przez serwery wymienione jako stabilne API (CC-079), test pilnuje listy.
- `ConfirmationView.resource`, `AuthenticatorStatus.disabledAt`/`disabledReason`, wektory JWT dla wywołań
  `authenticator` brokera (z `tool`), przykłady `disabled` w C4 i C12.
- CC-095: `GET /admin/v1/activity/calls` (C5) i `GET /api/v1/activity/calls` (C12), `ActivityCall` (jedno wywołanie = jeden wiersz, wynik końcowy, `wrongCodeCount`, filtry `from`, `to`, `result`, `q`, kursor `X-Next-Cursor`); wektory `activity-calls/` (38). Stary `/activity` bez zmian.
- Nie wchodzą do 3.0.0: CC-097 (przyjęte, kamień M4), CC-096, CC-113, CC-114.

### Migracja

**gateway (ws-05)**
- Rezerwacja próby przed pytaniem brokera i zwrot rezerwacji, compare-and-delete przy `ok`, atomowe "utwórz i unieważnij" per użytkownik, ślad unieważnionego wywołania nie jest oczekującym, blokada `confirmation_blocked` po zapisanym podglądzie do `max(wygaśnięcie, podgląd + 90 s)` (także po wyczerpaniu prób i wygaśnięciu), reason `pending_exists`; kursor `/activity/calls` uwierzytelniony (HMAC związany z `sub`, zmieniony -> 400), agregacja z bieżącym czasem.
- Stan potwierdzeń w trwałym magazynie, ślad obejrzanego A (w dowolnym stanie, także potwierdzony) co najmniej do `A.expiresAt + 90 s`; utrata stanu to brak potwierdzenia, niedostępny magazyn to 503.
- Tworzenie DESTRUCTIVE B po obejrzanym śladzie A (także potwierdzonym): najpierw `invalidate-codes` (błąd = 503 dla B), ślad blokujący na `sub`, `retryAfterSeconds` >= 1; wynik brokera `burned` bez zużycia próby (`code_burned`).
- `POST /admin/v1/confirmations/{id}/viewed` i `.../cancel` (anulowanie najpierw woła `invalidate-codes` u brokera, błąd to 503 bez anulowania; anulowanie atomowo z weryfikacją kodu, ślad do końca TTL, `confirmation_cancelled`, audyt `cancelled_by_owner`); `GET` podglądu bez skutków ubocznych.
- Zaimplementować `listActivityCalls` (agregacja wywołania i ponowień, licznik błędnych kodów, filtry, kursor, `sub` z tokenu BFF); wektory `activity-calls/`.
- Usunąć ścieżkę decyzji (`decideConfirmation`) i wydawanie kodu. Wdrożyć oczekujące wywołanie: klucz (`sub`, `serverId`,
  `tool`, SHA-256 argumentów bez `confirmation_code`), TTL 120 s, 3 próby, jednorazowość; `description` liczony z
  argumentów otrzymanych przez gateway; `previewViewedAt` zapisywany jawnym wywołaniem `markConfirmationViewed` (nie skutkiem `GET`).
- Wołać brokera: `GET /v1/authenticator` (pierwsze wywołanie), `POST /v1/authenticator/verify` (ponowienie), oba z JWT
  użytkownika z `tool`; mapować wynik według README "Potwierdzenia kodem TOTP" (`ok`, `invalid`/`replayed`, `locked`,
  `disabled`, `not_registered`, błąd = `upstream_unavailable`). Jedna oczekująca operacja `DESTRUCTIVE` na użytkownika,
  ślad unieważnionego do końca TTL, `confirmation_superseded`; limit 3 tylko dla innego ryzyka.
- `ConfirmationView.resource`; `getConfirmation` bez step-up, `404` dla wygasłego i unieważnionego.
- Audyt: `event: confirmation` z nowymi powodami, `virtual_server_change` zamiast `admin_change` dla linków,
  `authentication` na porcie C5, `replay_store_unavailable` nie z gateway'a.
- JWKS IdP niedostępny: `503` bez `WWW-Authenticate`, `Retry-After` (konfiguracja 1..60 s).
- Manifest: wymagać `title` i zamkniętego, ograniczonego `inputSchema` (reguły semantyczne z `mcp-manifest` 3.0.0).
- Higiena tekstu argumentów i `returnPath` bez zarezerwowanych prefiksów (po stronie gateway'a przy walidacji linków).

**broker (ws-06)**
- `POST /v1/authenticator/invalidate-codes` (CC-128): `burnedThrough`, kody spalonych kroków mają wynik `burned` bez liczenia do limitów 5/15 i 20/24 h, audyt `totp_steps_burned`.
- Ziarno TOTP (aktywne i w toku) tylko w Transit pod `mcp/authenticators/<sha256(sub)>`, rekord z `sub`, ziarno w toku usuwane po aktywacji, TTL i trzecim błędzie, baza tylko metadane; liczniki 5/15 min i 20/24 h oraz blokada jako krok atomowy na `sub` (test: 50 równoległych błędów -> 5 sprawdzeń).
- Zaimplementować `/v1/authenticator*` i reset (RFC 6238, SHA-1, 6 cyfr, 30 s, okno +-1, jednorazowość kroku warunkowym
  zapisem, ziarno tylko w Transit, patrz niżej, metadane w bazie). Limity: 5 błędów / 15 min -> blokada 15 min (własność użytkownika,
  przeżywa usunięcie, zdejmuje ją tylko czas), 20 błędów / 24 h -> `state: disabled`, enrollment 10 min i 3 błędne kody.
  `enrollment` dozwolone ze stanu `disabled`, aktywacja zeruje licznik dzienny. `purge` usuwa też rejestrację.
- Wykonać `test-vectors/totp/` (format kroków w `scripts/lib/totp.mjs`). Ziarna, kodu ani `otpauthUri` nie logować.
- Zdarzenia `event: "authenticator"`; `replay_store_unavailable` z `component: broker`.
- Usunąć `identity_mismatch` z odpowiedzi 422 (enum ma już tylko `secret_invalid` i `flow_invalid`). `ReturnPath` w
  `oauth/start` bez zarezerwowanych prefiksów.

**BFF (ws-07)**
- `POST /api/v1/confirmations/{id}/viewed` i `/cancel` (CSRF, cancel bez MFA; viewed bez przekazywania żądań `Sec-Purpose: prefetch`); kursor `X-Next-Cursor` przekazywany bez zmian.
- Proxy `GET /api/v1/activity/calls` z nagłówkiem `X-Next-Cursor`.
- Usunąć `decideMyConfirmation`; `getMyConfirmation` z samą sesją, `resource` w odpowiedzi.
- Dodać proxy `/api/v1/authenticator` (GET, DELETE), `/enrollment` (POST), `/enrollment/confirm`: step-up MFA Entra przy
  starcie rejestracji i usunięciu, `enrollmentId` tylko w sesji, ciało `201` tylko z `no-store`, bez logowania ciał;
  przekazać `disabled`. Przy starcie ze stanu `disabled` nie wołać najpierw `DELETE`.
- `ReturnPath` w `login` i `startConnectOAuth` odrzuca `/api`, `/s`, `/v`, `/.well-known` i segmenty `.`/`..`.
- `ConnectErrorCode` bez `identity_mismatch`; zdarzenie `authenticator` (`authenticator_removed`, rejestracja).

**web (ws-08)**
- Przycisk "Anuluj" w podglądzie (`cancel`, bez MFA) i etykieta "Anulowane". Podgląd wywołuje `viewed` raz, po wyrenderowaniu i gdy `document.prerendering` jest false i `document.visibilityState` to `visible`; odpytuje podgląd (np. co 5 s i po powrocie na kartę) i po `404` pokazuje "link nieaktualny"; etykieta `blocked_by_pending`; po `404` na `cancel` komunikat "Nie udało się anulować: operacja mogła zostać wykonana albo wygasła" z linkiem do logów aktywności; przy `confirmation_blocked` (po stronie klienta MCP) nie prosić o kod.
- Ekran logów na `listMyActivityCalls`: filtry, etykiety `result`, szczegół z liczbą błędnych kodów, nieznana wartość jako etykieta ogólna.
- Klient i mock MSW z 3.0.0: usunąć wywołania `POST /api/v1/confirmations/{id}` i ekran decyzji; podgląd tylko do
  odczytu z `resource`; stany "Czas minął" i "Ten link jest nieaktualny" (także dla unieważnionego).
- Nowe ekrany: rejestracja Authenticatora (QR rysowany lokalnie z `otpauthUri`, klucz tylko w pamięci komponentu),
  status z `lockedUntil` bez odblokowania, baner z powodem i akcją "Zarejestruj ponownie" dla `disabled`, usunięcie
  rejestracji, baner o braku rejestracji przy narzędziach `requiresConfirmation`.
- Kod `identity_mismatch` nie istnieje; ścieżki powrotu nie zaczynają się od zarezerwowanych prefiksów.

**starter i serwery (ws-02, ws-03, ws-04)**
- Manifest: `title` w każdym narzędziu, `inputSchema` zamknięty i ograniczony (startery generujące schemat z adnotacji
  dodają `maxLength`, `maxItems`, `minimum`/`maximum`, kotwice wzorców); przeliczyć `definitionHash` z `mcp-manifest`.
- Higiena tekstu: odrzucać argumenty ze zbioru zakazanego (`invalid_argument`), w wynikach zamieniać ciągi znaków
  zakazanych jedną spacją, nie stosować NFKC; filtr wzmianek odrzuca U+FF01..U+FF5E.
- `invalid_argument` przy naruszeniu schematu nazywa tylko zadeklarowany argument i regułę. `replay_store_unavailable` z
  `component: server`. `confirmation_declined` usunięte z `ErrorCode`; zależność `mcp-contracts` 3.0.0 (jar), nazwy `$defs`
  z listy w README.

**polityki (ws-09)**
- Z paczki produkcyjnej usunąć regułę `destructive-requires-fresh-mfa` (zostaje w przykładach kontraktu); schemat Cedar bez
  zmian, paczki 2.x działają. Zależność `mcp-contracts` 3.0.0 w testach decyzji.

**e2e (ws-10) i środowisko (ws-01)**
- Dodatkowo: 50 równoległych błędów -> 5 wywołań `verify`, N równoległych ponowień -> najwyżej `attemptsLeft` pytań do brokera, wyścig podglądu z drugą operacją, obejścia blokady po wyczerpaniu prób i po TTL A, brak ziarna w Redis i w bazie brokera.
- Testy: powtórzenie kodu (`replayed`), blokada 5/15 min i brak odblokowania, 20 błędów na dobę -> `disabled` i ponowna
  rejestracja, druga operacja `DESTRUCTIVE` unieważnia pierwszą, brak rejestracji (`registerUrl`), podgląd opcjonalny, brak
  ziarna i kodu w logach i audycie (jeden `requestId` w BFF, brokerze i gateway'u), rejestracja bez świeżego MFA odrzucona,
  JWKS niedostępny daje 503 bez `WWW-Authenticate`. Generator kodów TOTP dla dev (`make totp`) z `scripts/lib/totp.mjs`
  jako referencją.

## 2.2.5 - 2026-10-28

Grupa A pakietu M2 (decyzje człowieka 2026-10-28): CC-117 ... CC-120 w tym wydaniu; CC-078, CC-079 i CC-121 ... CC-123
(higiena tekstu, pełna szerokość, zamknięty `inputSchema`, stabilne `$defs`) `accepted-for-3.0.0`, nie implementowane.
`cedar/mcp.cedarschema` bez zmian. Wszystkie zmiany minor; żaden istniejący wektor nie zmienił oczekiwania.

- CC-117: opcjonalne `backendUser` w C8 (`connection_change`).
- CC-118: narzędzie spoza linku to `not_found_or_denied`, `tool_disabled` tylko przy wyłączeniu przez administratora (opisy C10).
- CC-119: `409 virtual_server_limit_reached` w C5 i C12 (limit konfigurowalny, domyślnie 50).
- CC-120: zdarzenie `authentication` także z `component: gateway` dla tokenów C1; nowe powody `client_certificate_rejected`,
  `jwks_unavailable`, `replay_store_unavailable` (dla dwóch ostatnich `errorCode: upstream_unavailable`).
- Wpływ: ws-05 (kody, `authentication` na gateway'u, limit), ws-06 (`backendUser` w audycie), ws-07 (przekazanie 409 limitu),
  ws-08 (komunikat "usuń nieużywany link"), starter (powody `authentication`).

## 2.2.4 - 2026-10-28

Grupa B pakietu M2 (CC-102 ... CC-112, decyzja człowieka 2026-10-28): doprecyzowania, przykłady i wektory; schematy bez
zmian strukturalnych, `cedar/mcp.cedarschema` bez zmian. Grupa C (CC-113 ... CC-116) `deferred`; grupa A (w tym CC-078,
CC-079) nie ruszona.

- CC-102 C4 `completeOAuth`: `400` dla systemu bez `user-oauth`; BFF mapuje `503` brokera na `provider_error`; usunięty
  nieaktualny opis porównania tożsamości.
- CC-103 `expiring`/`expiresAt` tylko dla `user-secret`; poprawiony przykład `two_connections`.
- CC-104 miejsce `client_secret` OAuth w OpenBao; CC-105 `connectUrl` informacyjne; CC-106 jeden port TLS i sprawdzanie
  certyfikatu klienta w aplikacji; CC-108 CN `mcp-prometheus`.
- CC-107 słownik `reason` dla `admin_change` (opis w C8; lista narzędzi linku wymaga pola w schemacie, grupa A).
- CC-109 `400` w `deleteMyVirtualServer`, `provider_error` przy błędzie brokera w `oauthCallback`.
- CC-110 wektory `catalog-actions/` (4 nowe); CC-111 `system=<system>` w przekierowaniu po błędzie OAuth (wektory
  `connect-redirects/`); CC-112 `structuredContent` i `UntrustedText` (opis).
- Wpływ: ws-05 (`publicBaseUrl` w `connectUrl`, port TLS, scraper), ws-06 (400 w `completeOAuth`, `expiresAt` null dla
  OAuth, ścieżka `client_secret`), ws-07 (400 w `deleteMyVirtualServer`, `provider_error`, `system=` w przekierowaniu), ws-08
  (`system` w komunikacie błędu OAuth), starter (`structuredContent`).

## 2.2.3 - 2026-10-28

CC-101 (decyzja człowieka 2026-10-28): brak sprawdzania tożsamości w whoami. `cedar/mcp.cedarschema` bez zmian.

- Broker wywołuje whoami tylko dla ważności poświadczenia (`422 secret_invalid`) i odczytu `backendUser`; nie
  porównuje z tożsamością SSO. `identity_mismatch` nie jest już zwracane; wartość zostaje w enum `PutSecretError`,
  `OAuthCompleteError` i `ConnectErrorCode` jako deprecated, usunięcie w 3.0.0.
- Przykłady `identity_mismatch` usunięte z C4 i C12 (mocki MSW i WireMock bez nich). `backendUser` już był wymagany
  w `Connection`, `PutSecretResponse` i odpowiedzi `oauth/complete`, więc SemVer się nie zmienia z tego powodu.
- Wektory `whoami-identity/` wycofane (`deprecated`), testy ich nie używają. CC-100 `superseded`; CC-090 uzupełnione o
  ryzyko rezydualne świadomie przyjęte przez człowieka.
- Wyjątek SemVer: zmiana udokumentowanego zachowania brokera (kod 422 nie jest zwracany) wydana jako patch; jedynym
  konsumentem jest broker w trakcie M2. Wyjątek jak CC-085.
- Wpływ: ws-06 (usunąć porównanie, zostawić `secret_invalid`), ws-07 (nie mapować `identity_mismatch`, przekazywać
  `backendUser`), ws-08 (komunikat "Połączono jako <backendUser>", bez ekranu błędu `identity_mismatch`).

## 2.2.2 - 2026-10-28

Poprawka reguły tożsamości z C4.1 po przeglądzie bezpieczeństwa brokera (CC-100). `cedar/mcp.cedarschema` bez zmian.

- Porównanie: obie surowe wartości ASCII -> bez wielkości liter ASCII; w przeciwnym razie dokładna równość po NFC
  bez zmiany wielkości liter. Test ASCII jest przed NFC (NFC zamienia U+212A na ASCII `K`; kelwin w tej samej wielkości
  liter jest kanonicznie równoważny i pasuje, inna wielkość liter nie). Zamyka kolizje typu U+212A KELVIN SIGN -> `k`, U+017F -> `s`, U+0130 -> `i`.
- Wektory `whoami-identity/`: dodane kelvin, długie s, tureckie İ, fullwidth, `Łukasz` vs `łukasz` (mismatch),
  `łukasz` exact (match), e-mail ASCII; NFC vs NFD tej samej nazwy nadal pasuje.
- Wyjątek SemVer: zaostrzenie reguły z 2.2.1 (formalnie major); jedynym konsumentem jest broker w trakcie M2. Wyjątek
  jak CC-085.
- Broker musi: zastąpić `toLowerCase`/`equalsIgnoreCase` Unicode tą regułą (NFC, ASCII-only -> ASCII lowercase,
  inaczej `equals`), przejść wektory `whoami-identity/`.

## 2.2.1 - 2026-10-28

Poprawki po przeglądzie 2.2.0 (0 CRITICAL/HIGH, 6 MEDIUM, 11 LOW) i decyzje człowieka z 2026-10-28.
`cedar/mcp.cedarschema` bez zmian. Pivot (CC-091 ... CC-094, CC-098) i CC-099 (`ReturnPath` bez zarezerwowanych
prefiksów) są `accepted-for-3.0.0` i nie wchodzą do tego wydania.

### Zmiany

- CC-084 (zmienione decyzją człowieka): z `putMySecret` (BFF i broker) znika odpowiedź `400 expires_at_invalid` i
  walidacja daty (przyszłość, limit 366 dni) dodane w 2.2.0; `expiresAt` to opcjonalna informacja, broker przyjmuje
  każdą poprawną datę albo brak pola, `expiring` działa tylko przy podanej dacie. Wektory `secret-expiry/` usunięte.
  400 w C4 wróciło do wspólnej odpowiedzi `BadRequest` z `X-Request-Id` (przegląd M-2).
- C4.1 (przegląd M-6): reguła porównania tożsamości jest w kontrakcie: dokładna równość po NFC i zamianie na małe
  litery, bez przycinania, podciągu i odcinania domeny; e-mail tylko przy `email_verified=true`; GitLab
  (`/api/v4/user`, `username`) w tabeli whoami. Opis w C4 `putSecret`. Nowe wektory `whoami-identity/`.
- Przykłady C12 (M-1, L-2, L-3, L-4): przykład `states` katalogu z `expiring`, `reconnect_required`, `no_access`,
  serwerem `service-account` i `token-exchange` (`connection: null`), narzędzie `disabled`; test sprawdza wszystkie
  przykłady katalogu względem tabeli akcji (wspólna funkcja z wektorami), spójność `connection` ze statusem i
  `requiresConfirmation` dla `DESTRUCTIVE`. Opis tabeli: typ z `connection.type`, `disconnect` tylko przy `connection`.
  Wektory `catalog-actions/` dostały `hasConnection` i wektor mieszany. Przykład `supportedTypes` Confluence wyrównany z C4.
- CC-088 (M-4): przykład rejestru z serwerem `enabled: false` (C5 i C12); typy TS nie czynią już pól z `default`
  (`enabled`, `disabled`, `requiresConfirmation`) wymaganymi (`defaultNonNullable: false`): brak `enabled` znaczy `true`.
- CC-089 (M-5, L-8): reguły nagłówków ochronnych na każdej trasie gateway'a (także `/.well-known/...`), na każdej
  odpowiedzi, błędy gateway'a zawsze w JSON niezależnie od `Accept`, brak `Set-Cookie` z tras gateway'a, brak CORS w BFF,
  normalizacja ścieżek i osobny listener dla C5/JWKS.
- CC-085/CC-087 (L-5, L-6): kolejność kontroli `resourceDefaults` (najpierw niepusty obiekt, potem zawartość; nie-obiekt to
  `invalid_request`), mock MSW zwraca `X-Request-Id` także w błędach generowanych samodzielnie; opis, że odpowiedzi
  proxy (502/504) go nie mają; README (Korelacja, Wersjonowanie) uzupełnione.
- `CONTRACT_CHANGES.md`: poprawione zdanie o `X-Request-Id` klienta w CC-089 (L-7); CC-099.

### Wyjątek SemVer

Usunięcie odpowiedzi `400 expires_at_invalid` i walidacji z CC-084 jest według tabeli zmianą niezgodną dla klienta,
który ją obsługuje, wydaną jako patch na decyzję człowieka (brak konsumentów: broker i BFF nie wdrożyły jej, ws-08 nie
zbudował ekranu), jak CC-085 w 2.2.0.

### Wpływ na konsumentów względem 2.2.0

- ws-06 (broker): bez walidacji `expiresAt` (każda poprawna data lub brak); reguła porównania tożsamości z wektorami
  `whoami-identity/`; GitLab `username`.
- ws-07 (BFF): bez `expires_at_invalid`; `X-Request-Id` także na 400 `putSecret`; kolejność kontroli `resourceDefaults`.
- ws-08 (web): bez błędu daty w formularzu tokenu; typy TS: pola z `default` opcjonalne; mock `Prefer: example=states`.
- ws-01/ws-05: reguły tras gateway'a z README ("Jedna domena").

## 2.2.0 - 2026-10-27

Wydanie dla M2: CC-080 ... CC-090 (decyzje człowieka z 2026-10-27). `cedar/mcp.cedarschema` bez zmian (bajtowo jak w
2.0.0). Pivot potwierdzeń (CC-091 ... CC-094, CC-098) jest `accepted-for-3.0.0` i nie wchodzi do tego wydania;
C11, `ConfirmationView`, `ConfirmationOutcome` i `confirmation-binding/` bez zmian.

### Zmiany

- CC-080 (minor): `PortalCatalogServer.credential` (`CatalogCredential`) i `connection` (`Connection` albo `null`).
- CC-081 (minor): `CatalogTool.disabled`, `CatalogTool.requiresConfirmation`.
- CC-082 (minor): `CatalogTool.title`.
- CC-083 (patch): tabela status -> `actions[]` w opisie `getPortalCatalog`; wektory `catalog-actions/`.
- CC-084 (minor): `400 expires_at_invalid` w `putMySecret` (BFF i broker); wektory `secret-expiry/`.
- CC-085 (formalnie major, patrz niżej): `resourceDefaults` uśpione, `400 resource_defaults_unsupported` w C5 i C12.
- CC-086 (minor): schemat `ConnectErrorCode` (+ `cancelled`), `oauthCallback` bez sesji przekierowuje na
  `/?loginError=session_expired` (`security: []`); wektory `connect-redirects/`.
- CC-087 (minor): nagłówek `X-Request-Id` na każdej odpowiedzi C12, `Error.requestId`.
- CC-088 (minor): `RegistryServer.enabled`.
- CC-089 (patch): jedna domena (opisy, README, przykłady z hostem `mcp.aiwcorpo.pl`); `Cookie` dochodzi do nagłówków
  usuwanych przez gateway (C3), piąta trasa proxy `/.well-known/oauth-protected-resource*`.
- CC-090 (minor, łagodzenie): `putMySecret` nie wymaga step-up MFA; z odpowiedzi znika `step_up_required`.

### Wyjątek SemVer

CC-085 jest według tabeli w README zaostrzeniem walidacji (major). Wydane jako 2.2.0 na decyzję człowieka: żaden
komponent nie implementuje jeszcze CRUD linków (gateway M2), a BFF i web na M1 nie wysyłają pola.

### Wpływ na konsumentów

- ws-05 (gateway): odrzucenie niepustego `resourceDefaults`; `disabled`, `requiresConfirmation`, `title`, `enabled`;
  `publicBaseUrl`, bez przekazywania `Cookie`, tylko JSON i SSE, metadane RFC 9728 pod `/.well-known/...`.
- ws-06 (broker): `400 expires_at_invalid` (limit domyślnie 366 dni).
- ws-07 (BFF): `credential`/`connection` w katalogu, tabela akcji, `ConnectErrorCode`, callback bez sesji, nagłówek
  `X-Request-Id` i `Error.requestId`, zapis PAT bez step-up, własna walidacja `resourceDefaults`, callback OIDC pod `/api`.
- ws-08 (web): mocki MSW z nowymi polami; kreator bez kroku zawężenia; brak przekierowania do MFA przy zapisie tokenu.
- ws-01: nginx z pięcioma trasami i regułami z README ("Jedna domena").

## 2.1.1 - 2026-10-27

Wydanie poprawkowe po automatycznym przeglądzie bezpieczeństwa 2.1.0 (2 x MEDIUM). `cedar/mcp.cedarschema` bez zmian.

- `decideConfirmation` i `decideMyConfirmation` (200 z jednorazowym kodem) oraz `getConfirmation` i
  `getMyConfirmation` (argumenty oczekującego wywołania) deklarują nagłówki `Cache-Control: no-store` i
  `Pragma: no-cache`, jak broker dla sekretów; bundled OpenAPI, mocki MSW i WireMock zwracają je w przykładach.
- `audit-event.schema.json`: zdarzenie `authentication` ma zamkniętą listę pól (`ts`, `requestId`,
  `clientRequestId`, `component`, `componentId`, `event`, `server`, `decision`, `reason`, `outcome`, `errorCode`,
  `latencyMs`); żadne pole z claimów niezweryfikowanego tokenu (`sub`, `username`, `client`, `tool`, `risk`,
  `resource`, `virtualServer`, `policyRevision`, `credentialType`) nie jest dozwolone. Nowe wektory odrzucane
  `invalid-authentication-with-client`, `-tool`, `-username`, `-policy-revision`, `-virtual-server`.
- `CONTRACT_CHANGES.md`: CC-078 i CC-079 (zgłoszenia ws-02, status open).
- Wpływ: ws-05 (gateway) i ws-07 (BFF) ustawiają oba nagłówki na odpowiedziach potwierdzeń; ws-02 (starter) emituje
  `authentication` tylko z pól z listy (bez `client` i `tool` z niezweryfikowanego tokenu).

## 2.1.0 - 2026-10-27

Decyzje człowieka z 2026-10-27: CC-068 ... CC-077 `accepted` (CC-070 w zmienionej formie). Zmiany minor i patch
razem. `cedar/mcp.cedarschema` jest bajtowo taki jak w 2.0.0 (test skrótu w Node i Javie przechodzi); polityki
przykładowe, wektory decyzji Cedar i `static-entities.json` bez zmian.

### Zmiany

- CC-068 (patch): opis `prv` i `PolicyRevision`: `00000000000000-0000000` = gateway bez załadowanej paczki, bez
  wniosków o polityce; od M2 gateway bez paczki nie wstaje.
- CC-069 (minor): `server/discover` jak `initialize` (wariant serwisowy dozwolony, `tool` zabroniony);
  `subscriptions/listen` bez `tool`, tylko wariant użytkownika; ponowienie `tools/call` z `inputResponses` (MRTR)
  jak każde `tools/call`. Nowe wektory JWT (9): `valid-service-discover`, `valid-user-variant-discover`,
  `user-variant-discover-with-tool`, `valid-user-variant-subscriptions-listen`,
  `user-variant-subscriptions-listen-with-tool`, `service-variant-subscriptions-listen`,
  `valid-tools-call-input-responses`; C11: kanał "elicitation URL" w erze 2026-07-28 to `InputRequiredResult`
  (README, sekcja "Metody MCP i JWT"). Istniejące tokeny JWT nie zostały przegenerowane.
- CC-070 (minor, zmieniona forma): lista metod wariantu serwisowego bez zmian; wariant serwisowy tylko bez sesji,
  żądania w sesji (`notifications/*`, `GET`/`DELETE`, odpowiedzi JSON-RPC) wariantem użytkownika; wektor
  `service-variant-other-notification`.
- CC-071 (minor): C8 `event: "authentication"` (`outcome: denied`, `reason` = kod odrzucenia JWT, bez `sub` i
  `username`); `audit-event.schema.json` wymusza to warunkiem `if/then`; wektory `server-authentication-denied` i
  trzy odrzucane.
- CC-072 (minor): `UntrustedText` w `common.schema.json`, zalecenie `outputSchema` dla narzędzi zwracających treść
  swobodną z systemu; wektory `untrusted-text/` (8).
- CC-073 (patch): whoami Confluence DC `GET /rest/api/user/current`, porównanie po `username`; Jira bez zmian.
  Opis w `credential-broker.v1.yaml` i README.
- CC-074 (zawężenie wzorca): `OpenSearchIndexName` = `^[a-z0-9][a-z0-9._-]{0,254}$`, `OpenSearchIndexPrefix`
  zaczyna się od `[a-z0-9]`; schemat, `ResourceIds`, `entity-builder.md`, bundled OpenAPI. Wektory
  `resource-ids/opensearch-*` (`.security`, `.ds-logs-000001`, `.ds-logs` niepoprawne),
  `entity-builder/resolved-resource-invalid-id-security`, `-data-stream`, `refs-opensearch-index-leading-dot`.
  Strumienie danych: osobna decyzja w M2.
- CC-075 (patch): `valid-servicedesk-service-account`: `ticketId` jako string ze wzorcem `ServiceDeskTicketId`,
  `internalUrl` `https://mcp-servicedesk.internal:8443/mcp`, przeliczony `definitionHash`
  (`sha256:7601e0f8...7031a`).
- CC-076 (minor): w C7 reguła kolejek dla `service-account`; wektory `servicedesk-service-account/` (6), w tym
  `srv-servicedesk-service-account-no-queue-grant` i `srv-servicedesk-ticket-moved-out-of-granted-queue` (deny).
  Poza `policy-decisions/`, bo decyzja Cedar nie odróżni konta serwisowego bez zmiany zamrożonego schematu (opis w
  `CONTRACT_CHANGES.md`).

- CC-077 (minor): C11 kanał kodu domyślny dla wszystkich klientów. `ConfirmationView.system` (wymagane),
  `POST /api/v1/confirmations/{id}` i `POST /admin/v1/confirmations/{confirmationId}` zwracają `200
  ConfirmationOutcome` (`code`, `codeExpiresAt`, `attemptsLeft`) zamiast `204`; `ConfirmationCode` w
  `common.schema.json`; wektory `confirmation-binding/` (12). Elicitation URL tylko otwiera `confirmUrl`.

### Uwaga SemVer

Według tabeli w README CC-071 (nowa wartość enum), CC-074 (zaostrzenie walidacji) i CC-077 (204 -> 200, nowe pole wymagane) są zmianami major. Wydanie jako
2.1.0 jest wyraźną decyzją człowieka z 2026-10-27. Skutki: producent zdarzenia `authentication` nie przejdzie
walidacji u odbiorcy audytu na 2.0.x; konfiguracja i `vsc`/`resourceDefaults`/`static.json` z prefiksem indeksu
zaczynającym się od kropki przestają przechodzić walidację. Dlatego wszystkie komponenty przechodzą na 2.1.0
razem (schematy audytu u konsumentów też).

### Wpływ na konsumentów

- Wszyscy: aktualizacja z 2.0.2 do 2.1.0 bez zmian schematu Cedar i bez zmian API bibliotek Java.
- ws-02 (starter): emitować zdarzenie audytu `authentication` zamiast samej linii logu przy odrzuceniu JWT
  (`reason` = kod odrzucenia, bez `sub`, `username` i treści tokenu); odbiornik wariantu serwisowego rozpoznaje
  także `server/discover`, a `subscriptions/listen`, `notifications/*`, `GET`/`DELETE` przyjmuje tylko z wariantem
  użytkownika; `UntrustedText` jako wspólny typ treści z systemu (pomocnik/typ w starterze) i `outputSchema` w
  `definitionHash`; wzorce `ResourceIds` z OpenSearch bez kropki; reguła kolejek konta serwisowego do wspólnego
  kodu serwerów (CC-076).
- ws-05 (gateway): `prv` `00000000000000-0000000` bez załadowanej paczki (M1) jest opisanym wzorcem, nie
  specjalnym przypadkiem; metody 2026-07-28: `server/discover` wariantem serwisowym lub użytkownika bez `tool`,
  `subscriptions/listen` wariantem użytkownika, ponowienie `tools/call` z `inputResponses` z nowym JWT i
  `tool` == `params.name`; wariant serwisowy tylko bez sesji (żadnego w ramach sesji); nowe wzorce OpenSearch w
  walidacji `ResourceDefaults` i `vsc`.
- ws-06 (broker): whoami Confluence `GET /rest/api/user/current` (porównanie po `username`) zamiast
  `/rest/api/2/myself`; Jira bez zmian.
- ws-04 (serwery): mcp-confluence i pozostałe zwracają treść z systemu jako `UntrustedText` z `outputSchema`;
  mcp-opensearch odrzuca nazwy z wiodącą kropką zgodnie z kontraktem (można usunąć ręczny filtr); mcp-servicedesk
  przyjmuje `ticketId` jako string ze wzorcem `ServiceDeskTicketId`, endpoint `/mcp`, reguła kolejek konta
  serwisowego (lista z konfiguracji lub grant w paczce, kolejka z odpowiedzi systemu, pusta = odmowa).
- ws-09 (polityki): bez zmian w schemacie i w paczce; service desk dla konta serwisowego deny gdy kolejka bez
  grantu: egzekwuje to serwer przed Cedar, polityki muszą tylko dalej wydawać granty `mcp-servicedesk-queue-<id>`
  w `static.json`; prefiksy indeksów OpenSearch w mapowaniu nie mogą zaczynać się od kropki.
- ws-10 (e2e): scenariusze nadużyć: indeksy ukryte OpenSearch (`.security`), treść z systemu oznaczona
  `UntrustedText`, odrzucone JWT widoczne w audycie jako `authentication`, konto serwisowe service desku bez
  grantu kolejki i zgłoszenie przeniesione poza kolejkę z grantem.
- CC-077: ws-05 (gateway, M3) trzyma rekord oczekującego wywołania (`confirmationId`, `sub`, `serverId`, `tool`,
  system, argumenty), odpowiada `confirmation_required`, wydaje kod po `decideConfirmation` z approve, wiąże go z
  (`sub`, `serverId`, `tool`, SHA-256 kanonicznych argumentów bez `confirmation_code`), TTL 120 s, 3 próby,
  jednorazowo; ws-07 (BFF) przekazuje `ConfirmationView` z gateway'a, wymaga step-up przed GET i POST i zwraca
  `200 ConfirmationOutcome` zamiast `204` (regeneracja klienta); ws-08 (web) ekran `/confirm/<id>` pokazuje
  narzędzie, system i argumenty (z oznaczeniem obciętych), przycisk "Zatwierdź" prowadzi przez step-up i pokazuje
  kod z odliczaniem (nie zatwierdza samym MFA); ws-02 (starter) bez zmian w kontrakcie, ale kod wraca do serwera
  tylko jako `confirmation_code` zdjęty przez gateway; ws-10: scenariusze podmiany argumentów po zatwierdzeniu,
  ponownego użycia i wygaśnięcia kodu.
- ws-01 (środowisko): bez zmian. ws-07/ws-08: poza CC-077 regeneracja klientów z bundled OpenAPI (wzorzec
  `OpenSearchIndexPrefix` w `ResourceDefaults`).

### Dystrybucja

- `release/aiwcorpo-mcp-contracts-2.1.0.tgz` obok tarballi 1.0.0 ... 2.0.2.

## 2.0.2 - 2026-10-27

Wydanie poprawkowe po automatycznym przeglądzie bezpieczeństwa 2.0.1 (realizacja CC-061, bez zmiany kontraktu;
`cedar/mcp.cedarschema` i `test-vectors/` bez zmian).

- `ResultFilter.checkAll` było fail-open: narzędzie z zadeklarowanymi `resourceRefs`, wywołane bez wartości
  zasobu (brak argumentu, pusta tablica) i bez kontenera, przechodziło bez decyzji polityki. Teraz odmowa z
  powodem `no_resource`. Narzędzie bez `resourceRefs` bez zmian (decyzję `call` podejmuje gateway; javadoc).
- `checkAll` odrzuca zasób z resolvera innego typu niż `resourceRef` (`resource_type_mismatch`), z id niezgodnym
  ze wzorcem (`resource_id_invalid`, także kontener) i brak zasobu (`not_resolved`).
- `allAllowed`: pusta lista nadal daje `false`; javadoc mówi, że kompletność listy to obowiązek wywołującego.
- Testy modułu `CheckAllFailClosedTest`; opis w `cedar/entity-builder.md` sekcja 10.
- Wpływ: ws-02 (starter) i ws-05 (gateway) używające `checkAll` dla narzędzi listujących bez identyfikatorów
  muszą przejść na `queryConstraint` i `ResultFilter.allowed` (sekcja 8 specyfikacji).

## 2.0.1 - 2026-10-27

Wydanie poprawkowe po przeglądzie 2.0.0 (punkty kategorii (a)). Bez zmian kontraktu: `cedar/mcp.cedarschema` i
`test-vectors/` są bajtowo takie jak w 2.0.0; API bibliotek tylko rozszerzone.

### Zmiany

- H1: `cedar/mcp.cedarschema` bajtowo zamrożony w linii 2.x (z nagłówkiem `2.0.0`, LF); testy skrótu w Node i
  Javie; opis w README i w "Wpływie na konsumentów" 2.0.0.
- M1: `entity-builder.md`: klasyfikacja grupy i projektu GitLab to suma topics wszystkich grup przodków.
- M2: `mcp-manifest` `CanonicalJson`: liczby na granicy potęg dwójki jak w ECMAScript (np. 2^122 ->
  `5.316911983139664e+36`); test na wszystkich potęgach dwójki i 5000 losowych liczbach wygenerowanych przez Node
  (`java/mcp-manifest/src/test/resources/ecmascript-numbers.json`, `scripts/generate-number-cases.mjs`).
- M3: `PolicyStore.awaitingOverrides()` i `isReady()`: po restarcie gotowość dopiero po ponownym załadowaniu
  `overrides`, jeśli były aktywne.
- M4: `PolicyStore` czyta plik stanu przed każdą decyzją (nowsza z wartości pamięci i dysku), zapisuje z `fsync`
  pliku i katalogu, sprząta pliki tymczasowe; nowy powód `STATE_WRITE_FAILED` (`state_write_failed`) zamiast
  `policy_invalid` przy błędzie zapisu; README: katalog stanu na instancję.
- M5: `ResultFilter.checkAll(caller, tool, arguments, resolver, creationContainer)`: sam wylicza wartości z
  `resourceRefs`, rozwiązuje je i zwraca `CheckResult` z powodem odmowy (`allAllowed` bez zmian).
- M6: CHANGELOG 2.0.0: lista niezgodności względem 1.1.0 bez zmian, które były już w 1.1.0; uzupełniony
  "Wpływ na konsumentów".
- M7: `entity-builder.md`: id i rodzic zasobu to kanoniczne wartości z systemu, nigdy argument.
- L1: README: `ResourceIds.isValid` przy zapisie `ResourceDefaults` i `vsc` (walidatory z `find()` przepuszczają
  końcowe `\n`).
- L2: nieaktualne opisy w README, `CONTRACT_CHANGES.md`, `ResolvedResource`, `BundleVerifier`.
- L4: wpływ `__Host-XSRF-TOKEN` na ws-07 (Secure za proxy) i ws-08 (Safari na localhost).
- L5: `entity-builder.md` sekcja 9a: zachowanie wzorców na danych zastanych.
- L6: `mcp-manifest` odrzuca duplikaty kluczy i nadmiarowe tokeny JSON.
- Nowe: `PublishedTestKeys` (mcp-cedar-entities) i `mcp-contracts/security/published-test-keys.json` (jar
  `mcp-contracts`, paczka npm `./security/*`): skróty SPKI wszystkich opublikowanych kluczy testowych (EC i
  Ed25519), z testem zgodności z `test-vectors/keys`; `BundleVerifier` z nich korzysta.
- Generator wektorów paczek używa stałej `schemaVersion` `2.0.0` (schemat zamrożony), więc ponowne generowanie
  nie zmienia wektorów.

### Odłożone do decyzji (kategoria (b) przeglądu 2.0.0)

- H1(b) lista znanych skrótów schematu / postać znormalizowana; H2 agregaty OpenSearch obejmujące indeksy
  zakazane; wymagalność `classification` dla GitLaba i service desku (M1); L3 znacznik narzędzia listującego.

## 2.0.0 - 2026-10-27

Pierwsze wydanie ze ścisłym SemVer. Zawiera niewydane osobno 1.2.1. Decyzje człowieka z 2026-10-27:
CC-046 ... CC-067 `accepted`; w `CONTRACT_CHANGES.md` nie ma otwartych pozycji. Broker (ws-06), BFF (ws-07) i
frontend (ws-08) zależą od 1.1.0, dlatego lista niżej obejmuje wszystkie zmiany niezgodne z 1.1.0
(1.2.0 + 2.0.0). Zmiany, które były już w 1.1.0 (CC-005, CC-010, CC-014, CC-015, CC-026, CC-027, CC-028,
podstawowe CC-031, CC-032, CC-033, CC-034), nie wymagają migracji z 1.1.0 i nie ma ich na liście (poprawione w
2.0.1).

### Niezgodne z 1.1.0

Model Cedar i polityki:
- `ResourceScope`, `UserGroup in [ResourceScope]`; `principal.scopes`, `context.vsScopes` i pola `refs` typów
  płaskich to zbiory `ResourceScope`; każdy zasób ma wymagany `scopes`; usunięte `OpenSearch::Index.namePrefixes`;
  dodane `Confluence::Page.ancestorIds` (CC-037).
- `Jira::Project.category` wymagany (`""` gdy brak, CC-062); nowe opcjonalne `classification` na
  `GitLab::Group`, `GitLab::Project`, `ServiceDesk::Queue` (CC-057); klasyfikacja normalizowana, jedna wartość
  `restricted` (CC-067) - polityki porównujące z `Restricted` przestają działać.
- Zakresy wyłącznie z `entities/static.json`; nazwy grup C9 nie dają zakresu; `new EntityBuilder()` bez mapowania
  nie przyznaje żadnego zakresu (CC-037).
- Polityki przykładowe: usunięte `gitlab-call-write-outside-scope` i `vs-narrow-call-gitlab-group`; nowe
  `gitlab-update-group-in-scope`, `confluence-update-page-in-scope`, `confluence-read`, `servicedesk-read`,
  `confluence-call-read`, `servicedesk-call-read`, `opensearch-forbid-restricted-index`,
  `gitlab-forbid-restricted-*`, `servicedesk-forbid-restricted-*`; zawężanie na serwerze przez `resource.scopes`.
  Wektor `gw-gitlab-write-outside-scope` zastąpiony przez `gw-gitlab-write-outside-scope-passes-gateway`
  (deny -> allow na gateway'u; odmowa przechodzi na serwer).
- `context.vsScopes` i `context.virtualServer` tylko w `forbid` (CC-041, CC-058); szablony w paczkach odrzucane.

C2 (wewnętrzny JWT):
- `vsc` maks. 50 identyfikatorów na pole, według wzorców per system (CC-056).
- `tool` wyłącznie dla `tools/call` (wymagany, równy `params.name`) i `resolve` (wymagany); zabroniony dla
  `initialize`, `tools/list`, `ping`, `GET /mcp-manifest` (CC-038).
- Klucze `test-*` i opublikowane klucze testowe odrzucane bez `allowTestKeys` (CC-044).
- Nowe kody w wektorach: `tool_missing`, `tool_not_allowed`, `test_key_not_allowed`, `request_id_mismatch`;
  harness czyta `verifier.allowTestKeys`.

C4 (broker):
- Nagłówek odpowiedzi `X-Request-Id` wymagany w każdej odpowiedzi (CC-047); `credential.invalidated` także po
  zastąpieniu poświadczenia (CC-046); `user-secret` to zawsze jeden token (CC-049).

C5 (gateway admin):
- `ResourceDefaults`: maks. 5 typów, 1..50 identyfikatorów na typ, wzorce per system (CC-056).

C6 (manifest):
- `title` dozwolony i hashowany, `icons`/`_meta` niedozwolone (CC-042);
  `resourceRefs[].argument` musi być zadeklarowanym argumentem typu identyfikatora (CC-043).

C7 (paczki):
- `overrides` walidowane schematem paczki głównej (CC-040).
- Paczka główna: schemat bajtowo równy `cedar/mcp.cedarschema` tej wersji, `static.json` tylko encje
  `UserGroup` (CC-059); `PolicyBundle` nie wystawia encji statycznych.
- Tar tylko ścisły ustar, bez dodatkowych plików, unikalne `@id`; powody odrzucenia: `archive_invalid`,
  `archive_unexpected_file`, `link_context_in_permit` (zastępuje `vs_scopes_in_permit` z 1.2.0),
  `schema_mismatch`, `static_entities_invalid`, `test_key_not_allowed`, `main_not_loaded`, `id_conflict`,
  `below_minimum`.

C8 (audyt):
- `resource.id` bez znaków bidi (uzupełnienie CC-031 w 1.2.0).

C12 (BFF):
- Ciasteczko CSRF `__Host-XSRF-TOKEN` zamiast `XSRF-TOKEN` (CC-055).
- Po nieudanym logowaniu `/?loginError=<kod>` tylko z listy `LoginErrorCode` (CC-051).

Biblioteki Java i format wektorów:
- `mcp-cedar-entities`: `EntityBuilder(ScopeMapping)`, usunięte `ScopeGroups.scopesFromGroups`,
  `QueryConstraint.virtualServerType`, walidacja identyfikatorów (CC-056), klasyfikacji (CC-062, CC-067) i wieku
  MFA (CC-065).
- `mcp-policy-bundle`: `PolicyBundle` bez `schemaText` i `staticEntities`; `PolicyLint.linkContextOutsideForbid`
  zamiast `vsScopesOutsideForbid`.
- Wektory: pola `staticEntities`, `builder`, `publicKeyId`, `allowTestKeys`, `mainBundle`, `persistence`; nowe
  katalogi `result-filter/`, `resource-checks/`, `resource-ids/`, `return-paths/`, `login-redirects/`,
  `policy-store/`, `canonical-json/`.

### Zmiany kontraktu (addytywne)

- CC-046 ... CC-053: `credential.invalidated` po zastąpieniu poświadczenia, `X-Request-Id` w C4, `returnPath` w
  `stepUpUrl`, tylko token w `PutSecretRequest`, `503 upstream_unavailable` w C12, kody `loginError`, port C13 z
  `Requester`, `Me.mfaFreshUntil`.
- CC-054: 400 dla nieznanego systemu w `DELETE /api/v1/connections/{system}`.
- CC-056: wzorce identyfikatorów per system i obowiązki serwera przy zapytaniach.
- CC-060, CC-066: `PolicyStore` z atomową podmianą i ochroną przed cofnięciem po restarcie.
- CC-061: serwer ocenia każdą wartość każdego `resourceRef` (`ResultFilter.allAllowed`).
- CC-063: moduł `mcp-manifest` (RFC 8785, `definitionHash`, reguły manifestu w Javie).
- CC-064: 503 we wszystkich operacjach C4.

### Nowe artefakty

- `pl.aiwcorpo.mcp:mcp-manifest:2.0.0`.

### Poprawki bez zmiany kontraktu (przegląd 1.2.0)

- M4: klucze testowe rozpoznawane po SPKI (`bundles/test-key-under-production-id`).
- L1: opis prefiksów OpenSearch poprawiony, `ResourceScopes.typeOf` sprawdza wzorce.
- L2: README: paczki w ustar (instrukcja dla ws-09), limit rozmiaru archiwum po stronie komponentu; wektor limitu
  łącznego 16 MiB.
- L3: `ResultFilter.cedarAuthorizer` traktuje błędy oceny jako odmowę.
- L4: ta lista niezgodności.
- L5: README (`Optional`), opis `GET /api/v1/auth/login`.
- L6: wektor `main-static-entities-scope-id-invalid`.
- L7: MSW 400 na niepoprawny JSON.
- M3: README bez wyjątku SemVer.

### Wpływ na konsumentów

- Wszyscy: `cedar/mcp.cedarschema` jest bajtowo zamrożony w linii 2.x (z nagłówkiem, LF); paczka polityk i
  komponenty muszą używać tego samego pliku (2.0.1).
- ws-02 (starter): `mcp-cedar-entities` z `ScopeMapping` z `PolicyStore` (zamiast nazw grup), `ResourceIds`,
  wymagana i normalizowana klasyfikacja w resolverach (`category`, `labels`, `tags`, `classification`),
  `ResultFilter.allowed` dla wyników i `allAllowed` dla każdej wartości `resourceRefs` (także kontener przy
  tworzeniu), `queryConstraint` z cytowaniem w JQL/CQL i wzorcem `p,p-*`; `mcp-policy-bundle` z `PolicyStore` i
  `Persistence`; `mcp-manifest` do generowania manifestu (`definition`, `title`, hash); `vsc` w JWT; `tool`
  obecny tylko przy `tools/call`; odrzucanie kluczy testowych (`PublishedTestKeys`, 2.0.1);
  `ResultFilter.cedarAuthorizer` (błędy diagnostyki Cedar = odmowa); mock i resolver Jiry zwracają `category`
  (choćby `""`), inaczej `internal_error`; katalog stanu `PolicyStore` na instancję i gotowość dopiero po
  `overrides` (`isReady`, 2.0.1); `invalid_argument` dla ujemnego wieku MFA; `checkAll` z resolverem (2.0.1).
- ws-05 (gateway): wystawia `vsc` z `resourceDefaults` (`VirtualServerScope.fromResourceDefaults`), wariant
  serwisowy JWT na `GET /v1/systems`, `tool` tylko przy `tools/call`/`resolve`; `PolicyStore` (schemat przypięty,
  `static.json` tylko mapowanie, ochrona po restarcie); reguły manifestu i hash przez `mcp-manifest` przy
  rejestracji (422 `manifest_rejected`); wzorce `ResourceDefaults`; `description`/`title` w katalogu i diffie;
  `expiresAt` i step-up w potwierdzeniach; `ResultFilter.cedarAuthorizer`; katalog stanu na instancję i
  `isReady()` przed obsługą ruchu (2.0.1); `ResourceIds.isValid` przy zapisie `ResourceDefaults` (walidatory JSON
  Schema z `find()` przepuszczają końcowe `\n`, 2.0.1); ujemny wiek MFA odrzucany.
- ws-06 (broker): reguły `tool` per metoda; kod `test_key_not_allowed` (w brokerze `test_kid_not_allowed` do
  ujednolicenia); harness czyta `verifier.allowTestKeys`; `vsc` maks. 50 i wzorce; `resource.id` bez bidi;
  `X-Request-Id` w każdej odpowiedzi i przyjmowanie go od BFF; `credential.invalidated` po zastąpieniu
  poświadczenia; tylko token w `PUT secret`; 503 `upstream_unavailable` we wszystkich operacjach.
- ws-07 (BFF): `state`/`nonce`/PKCE związane z sesją, nowy identyfikator sesji po logowaniu, `stepUp=true` z tym
  samym `sub`; `&` w callbacku przy query w `returnPath`; `/?loginError=<kod>` z listy; `stepUpUrl`;
  `503 upstream_unavailable`; `mfaFreshUntil`; przekazywanie `X-Request-Id`; `Requester` w porcie C13; 400 dla
  nieznanego systemu przy `DELETE`; ciasteczko `__Host-XSRF-TOKEN` (`CookieCsrfTokenRepository` z tą nazwą,
  Path=/, Secure, bez Domain; `CookieCsrfTokenRepository` ustawia `Secure` według `request.isSecure()`, więc za
  proxy bez nagłówków forwarded trzeba `setCookieCustomizer(c -> c.secure(true).path("/"))`, inaczej przeglądarka
  odrzuci ciasteczko `__Host-`); limity i wzorce `ResourceDefaults`; regeneracja klientów.
- ws-08 (frontend): `withXsrfConfiguration({cookieName: '__Host-XSRF-TOKEN', headerName: 'X-XSRF-TOKEN'})`
  (Safari nie przyjmuje ciasteczka `Secure` na `http://localhost`: w dev serwować po HTTPS albo używać innej
  przeglądarki);
  MSW: 400 na zły `returnPath`, zły JSON i nieznany system, eksport `RETURN_PATH_PATTERN`, `LOGIN_ERROR_CODES`,
  `XSRF_COOKIE`, handlery asynchroniczne; `stepUpUrl` (można zastąpić `returnPath`); `mfaFreshUntil` przed polem
  na sekret; obsługa `loginError`; limity i wzorce `ResourceDefaults`; `title` w diffie; regeneracja klienta.
- ws-09 (polityki): `static.json` tylko z encji `UserGroup` (mapowanie zakresów, identyfikatory według wzorców);
  schemat paczki = `cedar/mcp.cedarschema` 2.0.0; klasyfikacja porównywana tylko z `restricted`, reguły
  `restricted` także dla GitLaba i service desku; zawężanie dla wszystkich typów; `vsScopes` i `virtualServer`
  tylko w `forbid` (`PolicyLintCli`); unikalne `@id` między kanałami; paczki w ustar; nigdy ta sama rewizja z
  innymi bajtami archiwum (odbiorca po restarcie odrzuca ją jako `not_newer`); nowa nazwa powodu
  `link_context_in_permit` w narzędziach.

### Dystrybucja

- `release/` trzyma tarballe wszystkich wydań (1.0.0, 1.1.0, 1.2.0, 2.0.0); `npm run pack` nie nadpisuje
  tarballa wersji z tagiem.

## 1.2.0 - 2026-10-27

Decyzje człowieka z 2026-10-27: CC-036 ... CC-045 `accepted`; CC-035 `rejected`. Zgłoszenia ws-06 dostały numery
CC-046 i CC-047 (`open`).

### Niezgodne z poprzednią wersją

- Model Cedar (CC-037): nowa encja `ResourceScope`, `UserGroup in [ResourceScope]`; `principal.scopes`,
  `context.vsScopes` i pola `refs` typów płaskich (`jiraProject`, `confluenceSpace`, `gitlabGroup`,
  `servicedeskQueue`) są zbiorami `ResourceScope` zamiast napisów; każdy zasób systemu ma wymagany atrybut
  `scopes`; `OpenSearch::Index.namePrefixes` usunięte; `Confluence::Page.ancestorIds` dodane. Polityki z 1.1.0
  porównujące napisy (`principal.scopes.jiraProjects.contains(resource.key)`) nie przechodzą walidacji.
- Zakresy nie są już wyprowadzane z nazw grup C9: bez wpisu w `entities/static.json` grupa nie daje zakresu.
- Polityki przykładowe: usunięte `gitlab-call-write-outside-scope` i `vs-narrow-call-gitlab-group` (zakres
  GitLaba jest hierarchiczny, sprawdza go serwer); nowe `gitlab-update-group-in-scope`,
  `confluence-update-page-in-scope`; reguły zawężania na serwerze przez `resource.scopes`.
- C2 (CC-038): `tool` nie jest wymagany w schemacie; odbiorca odrzuca token z `tool` dla `initialize`,
  `tools/list`, `ping`, `GET /mcp-manifest` i bez `tool` dla `tools/call` i `resolve`. `vsc`: maks. 50 na pole.
- C2/C7 (CC-044): klucze `test-*` domyślnie odrzucane; wektory mają `allowTestKeys: true`.
- C6 (CC-042, CC-043): `definition.icons` i `_meta` odrzucane; `title` wchodzi do hasha; `resourceRefs[].argument`
  musi być zadeklarowanym argumentem typu identyfikatora.
- C7: paczka `overrides` walidowana schematem paczki głównej (CC-040); szablony w paczkach odrzucane;
  `permit` czytający `vsScopes` odrzucany (CC-041); `entities/static.json` walidowane schematem i mapowaniem.
- C5: `ResourceDefaults` maks. 5 typów i 50 identyfikatorów na typ.
- C8 (CC-031 uzupełnienie): `resource.id` wyklucza też znaki bidi (U+202A..U+202E, U+2066..U+2069).
- `mcp-cedar-entities`: `EntityBuilder(ScopeMapping)`, usunięte `ScopeGroups.scopesFromGroups`;
  `VirtualServerScope` odrzuca puste pola i ponad 50 identyfikatorów; `ResolvedResource` traktuje `null` jako brak
  atrybutu; nieznany typ w `ResourceRef` -> `EntityBuilderException`.
- Referencyjny odbiorca paczek przeniesiony z testów `mcp-cedar-entities` do modułu `mcp-policy-bundle`;
  nowe powody odrzucenia (`archive_invalid`, `vs_scopes_in_permit`, `static_entities_invalid`,
  `test_key_not_allowed`, `archive_unexpected_file`).

### Zmiany kontraktu

- CC-036: obowiązek serwera przy wyszukiwaniu i listach (ograniczenie zapytania + filtrowanie wyników);
  `EntityBuilder.queryConstraint`, `QueryConstraint`, `ResultFilter`; wektory `result-filter/`.
- CC-037: zakresy jako dane (`cedar/examples/static-entities.json`), hierarchia GitLab/Confluence/OpenSearch.
- CC-038 ... CC-045 jak w sekcji wyżej.

### Nowe artefakty

- `pl.aiwcorpo.mcp:mcp-policy-bundle:1.2.0`: `BundleVerifier`, `BundlePointer`, `PolicyBundle`, `TarReader`,
  `PolicyLint`, `PolicyLintCli`.

### Poprawki bez zmiany kontraktu (przegląd 1.1.0)

- L1: callback OAuth dokleja `connected=`/`connectError=` przez `&`, gdy `returnPath` ma query.
- L2: opis logowania: `state`/`nonce`/PKCE związane z sesją, nowy identyfikator sesji po logowaniu, przy
  `stepUp=true` ten sam `sub`.
- L3: znaki bidi w `resource.id`; limit długości liczony w jednostkach UTF-16 (opisane).
- L5: limity `ResourceDefaults` i `vsc`.
- L6: `listSystems`: para alternatywa bezpieczeństwa <-> CN opisana.
- L7: MSW odpowiada 400 na zły `returnPath` (`login`, `startConnectOAuth`); wektory JWT pozostają
  niedeterministyczne (podpis ES256 w Node nie ma trybu RFC 6979), testy weryfikują zapisane tokeny.
- L8: zachowania mapowania (dokładne nazwy grup, brak normalizacji argumentów, prefiks OpenSearch zakończony
  `-`) opisane w `cedar/entity-builder.md`, wektor `scopes-from-mapping`.
- L9: README: Spring Boot 4.1.0 nadpisuje jackson-databind 2.x do 2.21.4 (testy przechodzą), brak bibliotek
  natywnych cedar-java dla musl (Alpine).
- M1: ta sekcja "Niezgodne z poprzednią wersją" i wyjątek od tabeli SemVer w README.

## 1.1.0 - 2026-10-26

Decyzje człowieka z 2026-10-26: wszystkie pozycje CC-001 ... CC-026 (poza CC-020, rozstrzygniętą wcześniej)
i nowe CC-027 ... CC-034 z przeglądu 1.0.0 mają status `accepted`. CC-035 (zgłoszenie ws-01) jest `open`.

### Niezgodne z poprzednią wersją (uzupełnione w 1.2.0)

- C12: `step_up_required` niesie `stepUpUrl` zamiast `url` (CC-010).
- C5/C12: wymagane `ConfirmationView.expiresAt` (CC-015) i `CatalogTool.description` (CC-014); podgląd
  potwierdzenia odpowiada 401 bez świeżego MFA (CC-034).
- C6: wymagane `definition` w każdym wpisie narzędzia (CC-005).
- C2: `vs` wymaga `vsc` (CC-027); `rid` musi równać się `X-Request-Id` (CC-033); reguła kluczy `test-*` w opisie
  (bez pozycji CC; od 1.2.0 jako CC-044).
- C4/C12: `returnPath` bez `%` i `\` (CC-032).
- C8: wzorce `clientRequestId` i `resource.id` (CC-031).
- C7: paczka `overrides` tylko z `manifest.json` i `policies/**` (CC-028).
- Wektory i przykłady: zmienione wektory JWT, manifestów, paczek; nowe przykłady i stuby WireMock (403 dla złego
  CN); tarball 1.0.0 usunięty z `release/` (dostępny pod tagiem `v1.0.0`).
- Poluzowania (zgodne wstecz dla klientów, ale zmieniają zachowanie odbiorców): wariant serwisowy na
  `GET /v1/systems` (CC-030), wariant użytkownika dla metod protokołu (CC-033).

### Zmiany kontraktu

- **C6 manifest (CC-005):** wymagane pole `definition` w każdym wpisie narzędzia; `definitionHash` liczony
  z `definition` (CC-004). Nowe reguły manifestu: `definition.name == name`, brak `confirmation_code`,
  przeliczony hash == zadeklarowany. Manifest 1.0.0 nie przechodzi walidacji 1.1.0 (pole wymagane); wydanie
  minor, bo żaden producent manifestu jeszcze nie istnieje.
- **C2 (CC-027):** claim `vsc` z zawężeniem linku, obecny dokładnie wtedy, gdy `vs`.
- **C2 (CC-030, CC-033):** broker przyjmuje wariant serwisowy dla `GET /v1/systems`; serwer przyjmuje
  wariant użytkownika także dla `initialize`, `tools/list`, `ping`, `GET /mcp-manifest`; `rid` musi równać się
  `X-Request-Id`; produkcyjni odbiorcy odrzucają `kid` z prefiksem `test-`.
- **C5:** katalog ma `description` narzędzia (CC-014); `ConfirmationView.expiresAt` (CC-015); podgląd i decyzja
  potwierdzenia wymagają świeżego MFA, `401 {error, stepUpUrl}` (CC-034, CC-010); `pending` i rejestr niosą
  pełną definicję (CC-005).
- **C12:** `step_up_required` niesie `stepUpUrl` zamiast `url` (CC-010); nowe `GET /api/v1/auth/login` i
  `POST /api/v1/auth/logout` (CC-023); `expiresAt` i step-up przy podglądzie potwierdzenia.
- **C4/C12 `returnPath` (CC-032):** bez `%` i `\`, opcjonalne query.
- **C7 (CC-028):** paczka `overrides` tylko z `manifest.json` i `policies/**`; rewizje monotoniczne per kanał.
- **C8 (CC-031):** wzorzec `clientRequestId`; `resource.id` bez znaków sterujących C0/C1, DEL, U+2028, U+2029;
  wymóg escapowania w serializerze.
- **Polityki przykładowe (CC-029):** zawężanie linku dla wszystkich pięciu typów i ich typów podrzędnych,
  reguły odczytu dla Confluence i service desk.

### Nowe artefakty

- `pl.aiwcorpo.mcp:mcp-cedar-entities:1.1.0` (CC-019): wspólny entity builder dla gateway'a i startera.
- Build Maven jest wielomodułowy: rodzic `pl.aiwcorpo.mcp:mcp-contracts-parent:1.1.0`; współrzędne
  `pl.aiwcorpo.mcp:mcp-contracts` (i klasyfikator `test-vectors`) bez zmian.

### Poprawki bez zmiany kontraktu (przegląd 1.0.0 i przegląd bezpieczeństwa)

- OpenAPI C4/C5: rozszerzenie `x-allowed-client-cn` na każdej operacji z mTLS, odpowiedź 403 dla innego CN,
  reguła Spectral `mtls-allowed-client-cn` (przegląd #2).
- `Cache-Control: no-store` wymagany w odpowiedzi `resolve` (#9).
- Referencyjny odbiorca paczek polityk w Javie (`PolicyBundleVectorTest`): `permit` w `overrides` wykrywany
  parserem Cedar; test JS paczek nie jest już referencyjny (#3).
- `mcp-cedar-entities` odrzuca `risk` i `action` spoza dozwolonych wartości (#11).
- Encje wektorów decyzji walidowane schematem Cedar (#12); drugi przebieg wektorów `forbid_overrides_permit`
  bez polityk `forbid` musi dać `allow`.
- Nowe wektory JWT: `request-id-mismatch`, `server-token-at-broker`, `vs-without-vsc`, `vsc-without-vs`,
  `valid-user-variant-*`, `valid-service-broker-systems`, `valid-virtual-server-without-narrowing` (#13).
- Wektory paczek generowane z `schemaVersion` 1.1.0; nowe wektory `overrides-*`, `return-paths/`,
  `audit-events/invalid-*`.

## 1.0.0 - 2026-10-26

Pierwsze wydanie: OpenAPI 3.1 dla C4, C5, C12; JSON Schema dla C2, C6, C7, C8, C10; schemat Cedar w trybie
strict z politykami przykładowymi; specyfikacja entity buildera; testowe klucze ES256 i Ed25519; wektory
JWT, manifestów, `definitionHash`, audytu, błędów, paczek polityk, entity buildera i decyzji Cedar; stuby
WireMock dla C4 i C5, handlery MSW dla C12; jar z zasobami i jar `test-vectors`; paczka npm z typami TS.
