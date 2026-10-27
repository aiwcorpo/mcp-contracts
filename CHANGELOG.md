# Changelog

Format: wersje SemVer (README, "Wersjonowanie"). Numery CC odnoszą się do `CONTRACT_CHANGES.md`.
Od 2.0.0 ścisły SemVer. Wydania 1.1.0 i 1.2.0 zawierały zmiany niezgodne oznaczone jako minor; są wymienione w
ich sekcjach "Niezgodne z poprzednią wersją" i zebrane względem 1.1.0 w sekcji 2.0.0.

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
