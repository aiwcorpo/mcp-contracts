# Changelog

Format: wersje SemVer (README, "Wersjonowanie"). Numery CC odnoszą się do `CONTRACT_CHANGES.md`.
Od 2.0.0 ścisły SemVer. Wydania 1.1.0 i 1.2.0 zawierały zmiany niezgodne oznaczone jako minor; są wymienione w
ich sekcjach "Niezgodne z poprzednią wersją" i zebrane względem 1.1.0 w sekcji 2.0.0.

## 2.0.0 - w przygotowaniu (bez tagu)

Decyzje człowieka z 2026-10-27: następne wydanie to 2.0.0 (zawiera niewydane 1.2.1), od 2.0.0 ścisły SemVer.
CC-046 ... CC-053 i CC-056 `accepted`; CC-054, CC-055, CC-057, CC-058 `open`. Broker (ws-06), BFF (ws-07) i
frontend (ws-08) zależą od 1.1.0, dlatego lista niżej obejmuje wszystkie zmiany niezgodne z 1.1.0
(1.2.0 + 2.0.0).

### Niezgodne z 1.1.0

Model Cedar i polityki:
- `ResourceScope`, `UserGroup in [ResourceScope]`; `principal.scopes`, `context.vsScopes` i pola `refs` typów
  płaskich to zbiory `ResourceScope`; każdy zasób ma wymagany `scopes`; usunięte `OpenSearch::Index.namePrefixes`;
  dodane `Confluence::Page.ancestorIds` (CC-037).
- Zakresy wyłącznie z `entities/static.json` (mapowanie grupa -> zakresy); nazwy grup C9 nie dają zakresu.
  `new EntityBuilder()` bez mapowania nie przyznaje żadnego zakresu (CC-037).
- Polityki przykładowe: usunięte `gitlab-call-write-outside-scope` i `vs-narrow-call-gitlab-group`; nowe
  `gitlab-update-group-in-scope`, `confluence-update-page-in-scope`, `confluence-read`, `servicedesk-read`,
  `confluence-call-read`, `servicedesk-call-read`; zawężanie na serwerze przez `resource.scopes`. Wektor decyzji
  `gw-gitlab-write-outside-scope` zastąpiony przez `gw-gitlab-write-outside-scope-passes-gateway` (deny -> allow
  na gateway'u; deny przenosi się na serwer: `srv-gitlab-create-in-sibling-group`).
- `context.vsScopes` tylko w `forbid` (CC-041); szablony w paczkach odrzucane.

C2 (wewnętrzny JWT):
- `vs` wymaga `vsc` (CC-027); `vsc` maks. 50 identyfikatorów na pole, identyfikatory według wzorców (CC-056).
- `tool` wyłącznie dla `tools/call` (wymagany i równy `params.name`) i `resolve` (wymagany); dla `initialize`,
  `tools/list`, `ping`, `GET /mcp-manifest` zabroniony (CC-038).
- `rid` == `X-Request-Id` (CC-033).
- Klucze `test-*` (i opublikowane klucze testowe po SPKI) odrzucane bez `allowTestKeys` (CC-044).
- Nowe kody odrzucenia w wektorach: `tool_missing`, `tool_not_allowed`, `test_key_not_allowed`,
  `request_id_mismatch`; harness czyta `verifier.allowTestKeys`.

C4 (broker):
- `returnPath` bez `%` i `\` (CC-032).
- Nagłówek odpowiedzi `X-Request-Id` wymagany w każdej odpowiedzi (CC-047).
- Zdarzenie `credential.invalidated` także po zastąpieniu poświadczenia (CC-046).

C5 (gateway admin):
- `CatalogTool.description` i `ConfirmationView.expiresAt` wymagane (CC-014, CC-015); podgląd potwierdzenia
  wymaga świeżego MFA (CC-034); `ResourceDefaults`: maks. 5 typów, 1..50 identyfikatorów na typ, identyfikatory
  według wzorców per system (CC-056).

C6 (manifest):
- Wymagane `definition` (CC-005); `title` w hashu, `icons`/`_meta` niedozwolone (CC-042) - zmiana faktyczna:
  `title` jest dozwolony i hashowany; `resourceRefs[].argument` musi być zadeklarowanym argumentem typu
  identyfikatora (CC-043).

C7 (paczki):
- `overrides` tylko z `manifest.json` i `policies/**`, walidowane schematem paczki głównej (CC-028, CC-040).
- Tar tylko ścisły ustar, bez dodatkowych plików, unikalne `@id`; nowe powody odrzucenia `archive_invalid`,
  `archive_unexpected_file`, `vs_scopes_in_permit`, `static_entities_invalid`, `test_key_not_allowed`.
- `latest.json`: `url`/`sigUrl` tylko nazwy plików (CC-026).

C8 (audyt):
- `clientRequestId` według wzorca, `resource.id` bez znaków sterujących C0/C1, U+2028/2029 i bidi (CC-031).

C12 (BFF):
- `step_up_required` niesie `stepUpUrl` zamiast `url` (CC-010).
- Po nieudanym logowaniu `/?loginError=<kod>` tylko z listy `LoginErrorCode` (CC-051); `/?loginError=true` jest
  niezgodne.

Biblioteki Java i format wektorów:
- `mcp-cedar-entities`: `EntityBuilder(ScopeMapping)`, usunięte `ScopeGroups.scopesFromGroups`,
  `QueryConstraint` z nowym składnikiem `virtualServerType`, walidacja identyfikatorów (CC-056).
- Wektory: pola `staticEntities` (entity-builder, policy-decisions), `publicKeyId`, `allowTestKeys`,
  `mainBundle` (bundles), nowe katalogi `result-filter/`, `resource-ids/`, `return-paths/`, `login-redirects/`.

### Zmiany kontraktu (addytywne, od 1.2.0)

- CC-046 ... CC-053 (wcześniej przygotowane jako 1.2.1): `credential.invalidated` po zastąpieniu poświadczenia,
  `X-Request-Id` w C4, `returnPath` w `stepUpUrl`, tylko token w `PutSecretRequest`, `503 upstream_unavailable`
  w C12, kody `loginError`, port C13 z `Requester`, `Me.mfaFreshUntil`.
- CC-056: wzorce identyfikatorów per system, obowiązki serwera przy zapytaniach (cytowanie, `p,p-*`, puste
  `granted`), `queryConstraint` dla stron Confluence, `ResultFilter.cedarAuthorizer`.

### Poprawki bez zmiany kontraktu (przegląd 1.2.0)

- M4: `mcp-policy-bundle` odrzuca opublikowane klucze testowe po skrócie SPKI, niezależnie od identyfikatora;
  wektor `bundles/test-key-under-production-id`.
- L1: `entity-builder.md` poprawione (prefiks `logs-` nie jest poprawnym zakresem); `ResourceScopes.typeOf`
  sprawdza wzorce.
- L2: README: paczki tylko w ustar (instrukcja dla ws-09), limit rozmiaru archiwum przed dekompresją po stronie
  komponentu; wektor limitu łącznego 16 MiB (`tar-total-size-limit`).
- L3: `ResultFilter.cedarAuthorizer` traktuje błędy oceny jako odmowę; test wektorowy go używa.
- L4: ta lista niezgodności.
- L5: README (`Optional` w `verifyOverrides`), opis `GET /api/v1/auth/login` (400 to JSON).
- L6: wektor `main-static-entities-scope-id-invalid` (ścieżka `ScopeMapping` za walidacją schematu).
- L7: MSW odpowiada 400 na niepoprawny JSON w `startConnectOAuth`.
- M3: README bez wyjątku SemVer.

### Wpływ na konsumentów

- ws-06 (broker): reguły `tool` per metoda (wymagany dla `tools/call` i `resolve`, zabroniony dla reszty); kod
  `test_key_not_allowed` (w brokerze `test_kid_not_allowed` do ujednolicenia); harness czyta
  `verifier.allowTestKeys`; `vsc` maks. 50 i wzorce identyfikatorów; `resource.id` bez bidi; nagłówek
  `X-Request-Id` w każdej odpowiedzi; `credential.invalidated` po zastąpieniu poświadczenia; tylko token w
  `PUT secret`.
- ws-07 (BFF): `state`/`nonce`/PKCE związane z sesją, nowy identyfikator sesji po logowaniu, `stepUp=true` wymaga
  tego samego `sub`; `&` w callbacku, gdy `returnPath` ma query; `/?loginError=<kod>` z listy; `stepUpUrl`;
  `503 upstream_unavailable`; `mfaFreshUntil`; przekazywanie `X-Request-Id`; `Requester` w porcie C13; limity i
  wzorce `ResourceDefaults`; `title` w rejestrze; regeneracja klientów.
- ws-08 (frontend): MSW 400 na zły `returnPath` i zły JSON; eksport `RETURN_PATH_PATTERN`, `LOGIN_ERROR_CODES`;
  handlery asynchroniczne; `stepUpUrl` (może zastąpić `returnPath`); `mfaFreshUntil` przed polem na sekret;
  obsługa `loginError`; limity i wzorce `ResourceDefaults`; `title` w diffie; regeneracja klienta.
- ws-02/ws-05 (starter, gateway): `mcp-cedar-entities` z `ScopeMapping`, `ResultFilter`, `queryConstraint`,
  `ResourceIds`; `mcp-policy-bundle`; reguły manifestu (CC-018, CC-043) i `definitionHash` z `title` trzeba
  zaimplementować w Javie wg wektorów.
- ws-09 (polityki): `static.json` z mapowaniem zakresów i identyfikatorami według wzorców; reguły zawężania dla
  wszystkich typów; `vsScopes` tylko w `forbid`; paczki w ustar.

### Dystrybucja

- `release/` trzyma tarballe wszystkich wydań (1.0.0, 1.1.0, 1.2.0 i kolejne); `npm run pack` nie nadpisuje
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
