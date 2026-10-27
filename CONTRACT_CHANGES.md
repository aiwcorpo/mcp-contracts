# Zmiany kontraktów (propozycje i pytania)

Plik zbiera miejsca, w których `01-contracts.md` jest nieprecyzyjny albo sprzeczny, oraz propozycje zmian
od agentów. Każda pozycja ma przyjęty wariant, który **już jest** zaimplementowany w `mcp-contracts` 1.0.0,
i status. Zmianę statusu na `accepted`/`rejected` robi człowiek (wszystkie pozycje CC-001 ... CC-034 zostały rozstrzygnięte 2026-10-26, wydanie 1.1.0); odrzucenie wariantu oznacza nowe wydanie
kontraktów (patrz SemVer w `README.md`).

Format pozycji: numer `CC-NNN`, kontrakt `Cx`, problem, przyjęty wariant, alternatywy, status.

---

## CC-001 | C7 | Nazwa encji `Group` koliduje z `GitLab::Group`

- **Problem:** C7 nazywa encję grup użytkownika `Group` i jednocześnie wymaga `GitLab::Group`. Cedar 4
  (cedar-java 4.10.0) odrzuca taki schemat: `definition of GitLab::Group illegally shadows the existing
  definition of Group`.
- **Przyjęty wariant:** encja grup użytkownika nazywa się `UserGroup` (`User in [UserGroup]`), polityki
  piszą `principal in UserGroup::"mcp-jira-read"`. Typy zasobów systemów bez zmian.
- **Alternatywy:** (a) przenieść encje platformy do przestrzeni `Mcp::` (`Mcp::User`, `Mcp::Group`,
  `Mcp::Tool`, `Mcp::Action::"call"`), większa zmiana w politykach; (b) zmienić `GitLab::Group` na
  `GitLab::Namespace`, co dotyka manifestów serwerów (C6) i `resourceDefaults` (C5).
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-002 | C2 | Który wariant JWT dla `initialize`/`tools/list` w kontekście użytkownika

- **Problem:** w tabeli C2 `tool` jest wymagany, a wariant serwisowy jest opisany jako "wywołania bez
  użytkownika". Nie wiadomo, jaki JWT gateway wysyła do serwera dla `initialize`, `tools/list` i `ping`
  w ramach sesji konkretnego użytkownika: wariant użytkownika nie ma wtedy sensownej wartości `tool`.
- **Przyjęty wariant:** wariant użytkownika ma `tool` wymagany i służy tylko do `tools/call` (oraz do
  `resolve` w brokerze). `initialize`, `tools/list`, `ping` i `GET /mcp-manifest` gateway zawsze wysyła
  z wariantem serwisowym. Schemat: `schemas/internal-jwt.schema.json` (`oneOf` dwóch wariantów).
- **Alternatywy:** (a) `tool` opcjonalny w wariancie użytkownika i wymagany tylko przy `tools/call`;
  (b) osobna wartość `tool` dla metod protokołu (np. `-`).
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-003 | C2 | Kto pilnuje `exp - iat <= 60 s` i granicy tolerancji zegara

- **Problem:** C2 podaje `exp - iat <= 60 s`, ale w liście kontroli odbiorcy wymienia tylko podpis, `iss`,
  `aud`, `exp` (skew <= 30 s), `jti`, `tool`. Nie wiadomo, czy odbiorca ma odrzucać token o dłuższym życiu.
  Nie jest też powiedziane, czy granica 30 s jest włącznie.
- **Przyjęty wariant:** odbiorca odrzuca token z `exp - iat > 60` (wektor `jwt/lifetime-too-long.json`).
  Token jest ważny, gdy `now <= exp + 30 s`; wektory leżą po obu stronach granicy (29 s ważny, 31 s
  odrzucony), sama granica nie jest testowana. `iat` z przyszłości większe niż skew też jest odrzucane
  (`jwt/issued-in-future.json`), bo inaczej limit 60 s można obejść.
- **Alternatywy:** sprawdzać tylko `exp` (zgodnie z dosłowną listą); wtedy wektory `lifetime-too-long`
  i `issued-in-future` zmieniają oczekiwanie na `valid`.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-004 | C6 | Kształt obiektu liczonego do `definitionHash`

- **Problem:** C6 wymienia pola wchodzące do hasha (definicja MCP + wpis manifestu + `system`,
  `credential`), ale nie układ obiektu. Starter (generuje) i gateway (weryfikuje) muszą liczyć bit w bit
  to samo.
- **Przyjęty wariant:** płaski obiekt JSON z polami `name`, `description`, `inputSchema`, `outputSchema`,
  `annotations` (definicja MCP), `risk`, `action`, `resourceRefs` (manifest), `system`, `credential`
  (serwer); pole nieobecne w źródle jest pomijane (nie `null`); `resourceRefs` zawsze obecne (pusta
  tablica, gdy brak); `confirmation_code` dokładany przez gateway (C11) nigdy nie wchodzi. Kanonizacja
  RFC 8785, SHA-256, zapis `sha256:<hex>`. Wektory: `test-vectors/definition-hash/`.
- **Alternatywy:** obiekt zagnieżdżony `{tool: {...}, manifest: {...}, server: {...}}`.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-005 | C6/C5 | Manifest nie zawiera definicji narzędzia MCP

- **Problem:** `definitionHash` obejmuje `description`, `inputSchema` itd., ale manifest ich nie niesie.
  Przy `PUT /admin/v1/registry/servers/{serverId}` (CI, serwer nie musi działać) gateway nie ma z czego
  przeliczyć hasha, a widok `pending` (diff dla admina) nie pokaże zmiany samego `description`, choć ta
  zmiana wymaga ponownego zatwierdzenia. Katalog (C5, C12) nie ma też opisu narzędzia do pokazania w portalu.
- **Przyjęty wariant:** bez zmian w 1.0.0: wpis manifestu ma tylko `name`, `risk`, `action`,
  `resourceRefs`, `definitionHash`; gateway porównuje hash z definicją pobraną przez `tools/list`
  (wariant serwisowy JWT) w czasie działania.
- **Alternatywy (propozycja):** dodać do wpisu narzędzia w manifeście obiekt `definition`
  `{description, inputSchema, outputSchema?, annotations?}`; gateway liczy hash już przy rejestracji,
  `pending` pokazuje pełny diff, katalog może pokazać `description`. Zmiana addytywna (minor 1.1.0).
- **Weszło w 1.1.0:** wpis narzędzia w manifeście ma wymagane pole `definition` (`name`, `description`, `inputSchema`, `outputSchema?`, `annotations?`); `definitionHash` liczony jak w CC-004 z `definition` + `risk`/`action`/`resourceRefs` + `system`/`credential`. Nowe reguły manifestu: `definition.name == name`, brak `confirmation_code` w `inputSchema`, przeliczony hash == zadeklarowany. C5: `pending` i rejestr pokazują pełną definicję, katalog C5/C12 ma `description` narzędzia (CC-014). Wektory negatywne: `manifests/invalid-definition-hash-mismatch`, `invalid-description-changed`, `invalid-risk-changed-stale-hash`, `invalid-definition-name-mismatch`, `invalid-missing-definition`, `invalid-confirmation-code-in-definition`. Uwaga: pole jest wymagane, więc manifest 1.0.0 nie przechodzi walidacji 1.1.0; wydanie minor, bo żaden producent manifestu (starter 3.x) jeszcze nie istnieje.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-006 | C7 | Uzupełnienia modelu Cedar względem skrótu w C7

- **Problem:** skrót modelu w C7 nie wystarcza do napisania polityk zakresów: Cedar nie odczyta atrybutu
  rodzica przez `in`, nie dopasuje prefiksu napisu do wartości ze zbioru i nie ma `null`.
- **Przyjęty wariant** (`cedar/mcp.cedarschema`):
  - encje podrzędne mają atrybut-referencję do rodzica obok krawędzi `in`: `Jira::Issue{key, project}`,
    `Confluence::Page{id, space}`, `GitLab::Project{path, group}`, `ServiceDesk::Ticket{id, queue}`;
  - `Jira::Project.category` jest opcjonalne (projekt bez kategorii);
  - `OpenSearch::Index` ma dodatkowo `namePrefixes: Set<String>` (wszystkie prefiksy nazwy kończące się
    przed `-`, liczone przez entity builder), bo `opensearchIndexPrefixes` z C9 to prefiksy;
  - `context.vsScopes` ma osobny typ `VsScopes` z polami opcjonalnymi (brak pola = link nie zawęża tego
    typu), `principal.scopes` ma wszystkie pola wymagane (pusty zbiór = brak zakresu);
  - `context.refs` ma pole dla każdego z 9 typów zasobów (`jiraProject`, `jiraIssue`, `confluenceSpace`,
    `confluencePage`, `gitlabGroup`, `gitlabProject`, `opensearchIndex`, `servicedeskQueue`,
    `servicedeskTicket`), obecne dokładnie wtedy, gdy narzędzie deklaruje taki `resourceRef`;
  - id encji `Tool` = nazwa widziana przez klienta `<system>__<tool>`, atrybut `name` = nazwa po stronie
    serwera, `server` = `serverId`.
- **Konsekwencja:** na poziomie gateway'a nie da się sprawdzić zakresu OpenSearch (prefiks względem listy
  nazw z argumentów, Cedar nie ma kwantyfikatora "dla każdego"); robi to serwer na rozwiązanym indeksie.
- **Alternatywy:** hierarchia `OpenSearch::Index in [OpenSearch::IndexPrefix]` zamiast `namePrefixes`;
  dla zakresów na gateway'u builder mógłby liczyć gotową flagę, ale to przenosi decyzję poza Cedar.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-007 | C9 | Skróty typów zasobów w grupach zakresu i reguły parsowania

- **Problem:** C9 podaje przykłady `proj` (Jira), `grp` (GitLab), `idx` (OpenSearch), ale nie skróty dla
  Confluence i service desk ani reguł parsowania (identyfikatory zawierają `-`, np. `team-a`).
- **Przyjęty wariant** (`cedar/entity-builder.md`): `mcp-jira-proj-<key>`, `mcp-confluence-space-<key>`,
  `mcp-gitlab-grp-<path>`, `mcp-opensearch-idx-<prefix>`, `mcp-servicedesk-queue-<id>`. Parsowanie:
  `mcp-<system>-<restype>-<id>`, gdzie `<id>` to cała reszta napisu (może zawierać `-`), wielkość liter
  zachowana. Grupy o nieznanym systemie lub skrócie są ignorowane przy budowie `scopes` (zostają jako
  `UserGroup`). Grupy muszą przychodzić bez ścieżki (`mcp-jira-read`, nie `/mcp-jira-read`), więc mapper
  grup w Keycloak ma `full.path=false`. Prefiks OpenSearch dopasowuje indeks, gdy nazwa indeksu jest równa
  prefiksowi albo zaczyna się od `<prefix>-` (`logs-team-a` pasuje do `logs-team-a-2026.10`, nie do
  `logs-team-ab`).
- **Alternatywy:** pełne nazwy typów w grupach (`mcp-confluence-space-`, `mcp-servicedesk-queue-` już są
  pełne); dopasowanie prefiksu bez granicy `-`.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-008 | C7/C8 | Format `policyRevision` i porządek rewizji

- **Problem:** przykład w C8 ma `"policyRevision": "2026.10.26-a1b2c3"`, a C7 definiuje rewizję jako
  `YYYYMMDDHHMMSS-<sha7>`. C7 nie mówi też, co z dwiema rewizjami z tej samej sekundy.
- **Przyjęty wariant:** wszędzie (C2 `prv`, C7, C8) format C7, wzorzec `^[0-9]{14}-[0-9a-f]{7}$`.
  Porządek wyznacza tylko część czasowa; rewizja o tej samej części czasowej co załadowana nie jest "wyższa"
  i jest odrzucana (wektor `bundles/same-second-revision.json`).
- **Alternatywy:** porządek leksykograficzny całego napisu (wtedy sha decyduje przy remisie, co jest
  przypadkowe).
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-009 | C8 | Pola zdarzenia audytu

- **Problem:** C8 nie mówi, które pola są wymagane; nie ma pola na system docelowy zdarzeń brokera
  (`credential_resolve`, `connection_change`); format `resource.parent` (`Jira::Project::ABC`) różni się
  od zapisu UID Cedar (`Jira::Project::"ABC"`); C3 wspomina `clientRequestId`, którego nie ma w C8.
- **Przyjęty wariant:** wymagane `ts`, `requestId`, `component`, `componentId`, `event`, reszta
  opcjonalna; `additionalProperties: false` (żeby nie dało się dopisać argumentów ani sekretów); system
  zdarzeń brokera w polu `server` (`mcp-<system>`, bo jeden serwer na system); `resource.parent` w formacie
  z przykładu C8; `clientRequestId` dodane jako opcjonalne (z C3); `errorCode` to kod C10 albo `null`.
- **Alternatywy:** osobne pole `system`; `resource.parent` jako obiekt `{type, id}`.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-010 | C10/C11/C12 | Pola błędów `confirmation_required` i `step_up_required`

- **Problem:** C10 podaje dla `confirmation_required` tylko `confirmationId`, C11 także `confirmUrl`.
  C10 nazywa link step-up `stepUpUrl`, C12 w odpowiedzi BFF `url`.
- **Przyjęty wariant:** `tool-error.schema.json`: `confirmationId` wymagane, `confirmUrl` opcjonalne;
  `step_up_required` ma `stepUpUrl`. BFF (C12) zwraca dosłownie `{error: "step_up_required", url}`.
- **Alternatywy (propozycja):** jedna nazwa `stepUpUrl` w obu miejscach; `confirmUrl` wymagane.
- **Weszło w 1.1.0:** wszędzie `stepUpUrl`: C10 (bez zmian), C12 `401 {error: "step_up_required", stepUpUrl}` (wcześniej `url`), C5 `StepUpRequired {error, stepUpUrl}` dla podglądu i decyzji potwierdzenia; handlery MSW i wektory zgodne.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-011 | C7 | Format podpisu paczki, `schemaVersion`, porównanie wersji schematu

- **Problem:** C7 nie mówi, czy `.sig` to surowe bajty czy base64, ani czym jest `schemaVersion`.
- **Przyjęty wariant:** `.sig` = surowe 64 bajty podpisu Ed25519 nad dokładnymi bajtami `.tar.gz`
  (tak jak `openssl pkeyutl -sign -rawin`); `schemaVersion` = wersja `mcp-contracts`, z której pochodzi
  `schema.cedarschema` (SemVer). Klucze publiczne odbiorców w formacie SPKI PEM lub JWK (OKP).
- **Alternatywy:** podpis base64 w pliku tekstowym; podpis nad `manifest.json` z sumami plików.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-012 | C4/C5/C12 | Ciała błędów dla statusów, których kontrakt nie opisuje

- **Problem:** kontrakty opisują ciała tylko części błędów (409/422 w C4, `step_up_required` w C12).
  Klienci generowani z OpenAPI potrzebują kształtu dla 400/401/403/404/409/503.
- **Przyjęty wariant:** wspólny kształt `Error {error: <snake_case>, message?}` i kody: `invalid_request`
  (400), `unauthenticated` (401), `forbidden` (403, zły CN certyfikatu w C4), `access_denied` (403 w C5/C12),
  `not_found_or_denied` (404, także "nie właściciel"), `slug_taken` (409 przy tworzeniu linku),
  `hash_mismatch` (409 przy approve), `manifest_rejected` (422 przy rejestracji manifestu niezgodnego
  z konfiguracją), `csrf_invalid` (403 w C12), `upstream_unavailable` (503 w `resolve`, gdy magazyn
  sekretów/IdP/system nie odpowiada). `DELETE` i `purge` zwracają 204, `approve` i decyzja potwierdzenia 204.
- **Alternatywy:** RFC 9457 `application/problem+json`.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-013 | C4 | Wartości puste i zdarzenie unieważnienia

- **Problem:** C4 wymienia `expiresAt` i `lastUsedAt` jako pola odpowiedzi, ale PAT bez daty ważności
  i nieużyte połączenie nie mają wartości. C4.3 nie podaje nazwy kanału Redis ani kształtu zdarzenia dla
  `purge` (wiele systemów naraz).
- **Przyjęty wariant:** pola obecne zawsze, wartość `null`, gdy brak (`expiresAt` w `resolve`,
  `connections`, `secret`; `lastUsedAt`). Kanał Redis `credential.invalidated`, treść
  `{sub, system}` (`schemas/credential-invalidated-event.schema.json`); `purge` publikuje jedno zdarzenie na
  każdy usunięty system.
- **Alternatywy:** pominięcie pola zamiast `null`; zdarzenie `purge` z `system` pominiętym = wszystkie.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-014 | C5 | Zawartość katalogu i `requiredEntitlements`

- **Problem:** C5 nie wymienia pól serwera i narzędzia w katalogu poza `access` i `requiredEntitlements`;
  nie mówi też, czy `requiredEntitlements` jest wypełniane dla narzędzi już dostępnych.
- **Przyjęty wariant:** serwer: `serverId`, `system`, `version` (z manifestu); narzędzie: `name`
  (`<system>__<tool>`), `risk`, `action`, `access`, `requiredEntitlements` (zawsze obecne; grupy, które wg
  polityki dają narzędzie, także gdy `granted`). Tylko narzędzia `approved`. Brak opisu narzędzia (patrz CC-005).
- **Alternatywy:** `requiredEntitlements` tylko dla `denied`.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-015 | C5 | Podgląd i decyzja potwierdzenia

- **Problem:** C5 mówi "argumenty w ustalonej kolejności, ewentualnie obcięte z oznaczeniem", bez formatu.
- **Przyjęty wariant:** `{confirmationId, tool, arguments: [{name, value, truncated}]}`, argumenty
  posortowane po nazwie, `value` to serializacja JSON wartości (napis, obcięty przy `truncated: true`),
  bez `confirmation_code`. Decyzja `POST {decision}` -> 204; brak świeżego MFA -> 401
  `{error: "step_up_required"}`; cudze, wygasłe lub zużyte -> 404.
- **Alternatywy:** dodać `expiresAt` (TTL 120 s), żeby portal pokazał odliczanie; 410 dla wygasłych.
- **Weszło w 1.1.0:** `ConfirmationView` ma wymagane `expiresAt` (koniec TTL z C11) w C5 i C12; reszta jak w przyjętym wariancie.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-016 | C5/C12 | Aktywność: limit i kształt

- **Problem:** `?limit=50` bez maksimum; kształt pozycji nieopisany.
- **Przyjęty wariant:** `limit` 1..200, domyślnie 50, od najnowszych; pozycje to zdarzenia C8
  (`audit-event.schema.json`), które z definicji nie zawierają argumentów.
- **Alternatywy:** węższy widok (tylko `ts`, `tool`, `decision`, `outcome`, `errorCode`).
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-017 | C5 | Wirtualny serwer: klucze `resourceDefaults` i slug

- **Problem:** `resourceDefaults: {<resourceType>: [ids]}` nie mówi, które typy są dozwolone, a zawężenie
  musi trafić do `context.vsScopes`, które ma tylko 5 pól (C7). Brak reguł dla `slug` (część URL).
- **Przyjęty wariant:** klucze tylko `Jira::Project`, `Confluence::Space`, `GitLab::Group`,
  `OpenSearch::Index` (wartości to prefiksy, jak w C9), `ServiceDesk::Queue`; każda lista niepusta.
  Slug: `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`. Narzędzie niedostępne -> 403 `access_denied`, zajęty
  slug -> 409 `slug_taken`.
- **Alternatywy:** dopuścić zawężanie do pojedynczych zgłoszeń/stron (wymaga nowych pól `vsScopes`).
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-018 | C6 | Reguły manifestu poza JSON Schema

- **Problem:** część reguł C5/C6 nie da się wyrazić w JSON Schema.
- **Przyjęty wariant:** opisane w `README.md` ("Reguły semantyczne manifestu") i sprawdzane w testach
  wektorów: `serverId == "mcp-" + system`; unikalne nazwy narzędzi; typy z `resourceRefs` i `parent`
  zadeklarowane w `resourceTypes`; nazwa narzędzia bez `__` (wzorzec w schemacie);
  `credential.required: true` wymaga niepustego `acceptedTypes`.
- **Alternatywy:** brak.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-019 | C7 | Publikacja referencyjnego entity buildera

- **Problem:** C7 mówi, że entity builder ma implementację w Javie "współdzieloną przez gateway i starter",
  ale nie mówi, gdzie ona żyje. W `mcp-contracts` jest specyfikacja, wektory i referencyjna implementacja
  w testach (`src/test/java/.../cedar/ReferenceEntityBuilder.java`), niepublikowana.
- **Propozycja:** wydać ją jako osobny artefakt `pl.aiwcorpo.mcp:mcp-cedar-entities` (bez zależności od
  Springa, zależność tylko od cedar-java), z tymi samymi wektorami jako testem. Gateway (ws-05) i starter
  (ws-02) dostaną jedną implementację zamiast dwóch zgodnych z wektorami.
- **Alternatywy:** każdy strumień implementuje sam i przechodzi wektory z `test-vectors/entity-builder`.
- **Weszło w 1.1.0:** moduł Maven `pl.aiwcorpo.mcp:mcp-cedar-entities:1.1.0` (`java/mcp-cedar-entities`), zależności: cedar-java 4.10.0 (`uber`), jackson-databind 2.20 (i tak wymagany przez cedar-java), `mcp-contracts` (schemat Cedar z classpath). Publiczne API: `EntityBuilder.forToolCall`, `EntityBuilder.forResource`, `Caller`, `ToolDescriptor`, `ResourceRef`, `VirtualServerScope`, `ResolvedResource`, `CedarRequest`, `ScopeGroups`, `McpCedarSchema`, `EntityBuilderException`. Testy modułu wykonują wszystkie wektory `entity-builder`, `policy-decisions` i `bundles`. Referencyjna implementacja z testów została usunięta.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-020 | C12 | Mechanizm CSRF

- **Problem:** pierwsza wersja C12 wymagała nagłówka `X-CSRF-Token` bez opisu, skąd frontend bierze token.
- **Przyjęty wariant:** zaktualizowany C12 (plan z 2026-10-26 21:58): konwencja Angulara, ciasteczko
  `XSRF-TOKEN` (nie HttpOnly, Secure, SameSite=Strict), nagłówek `X-XSRF-TOKEN` dla POST/PUT/DELETE.
  `portal-bff.v1.yaml` i handlery MSW są z tym zgodne.
- **Status:** resolved (rozstrzygnięte w `01-contracts.md` C12)

## CC-021 | C12 | Status i akcje serwera w katalogu portalu

- **Problem:** C12 podaje statusy i akcje, ale nie poziom (serwer czy narzędzie), kolejność reguł ani
  status dla systemów, do których użytkownik niczego nie podłącza (`service-account`, `token-exchange`).
  Akcja `copy_link` wymaga adresu, którego żadne pole nie niesie.
- **Przyjęty wariant:** status i `actions[]` na poziomie serwera; narzędzia mają pola z C5 (`access`,
  `requiredEntitlements`). Kolejność reguł w opisie `GET /api/v1/catalog`; dla `service-account` /
  `token-exchange` status `connected`. Dodane pole serwera `url` (`https://<gateway>/s/<serverId>/mcp`).
- **Alternatywy:** frontend składa URL z konfiguracji; status per narzędzie.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-022 | C12 | `returnPath` przy OAuth i błędy w callbacku

- **Problem:** C4 `oauth/start` wymaga `returnPath`, a C12 `POST /connections/{system}/oauth` nie ma body.
  Callback opisuje tylko sukces (`returnPath?connected=<system>`).
- **Przyjęty wariant:** opcjonalne body `{returnPath}` (domyślnie `/`); przy błędzie przekierowanie na
  `returnPath?connectError=<kod>`, kod in `identity_mismatch`, `flow_invalid`, `provider_error`.
- **Alternatywy:** `returnPath` w query; strona błędu w BFF.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-023 | C12 | Brak endpointów logowania i wylogowania

- **Problem:** "logowanie OIDC po stronie BFF", ale C12 nie podaje, dokąd frontend przekierowuje po 401
  ani jak się wylogować.
- **Przyjęty wariant:** nic nie dodano; 401 `{error: "unauthenticated"}`. ws-07/ws-08 muszą uzgodnić
  ścieżki (domyślne Spring Security: `/oauth2/authorization/<rejestracja>` i `POST /logout`).
- **Propozycja:** dopisać do C12 `GET /api/v1/auth/login?returnPath=` (302 do IdP) i
  `POST /api/v1/auth/logout` (204, CSRF).
- **Weszło w 1.1.0:** `GET /api/v1/auth/login?returnPath=&stepUp=` (302 do IdP, bez sesji; `stepUp=true` wymusza świeże MFA i jest celem `stepUpUrl`) i `POST /api/v1/auth/logout` (204, sesja + `X-XSRF-TOKEN`); handlery MSW.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-024 | C13 | Kształt `AccessRequest` i `RequestResult`

- **Problem:** C13 nazywa typy `Entitlement`, `AccessRequest`, `RequestResult` bez pól; C12 nie wystawia
  katalogu uprawnień (`catalog(system)`).
- **Przyjęty wariant:** `AccessRequest {requestId, entitlement, status in pending|approved|rejected|cancelled,
  createdAt, requestUrl?}`; `RequestResult` = `{requestUrl}` albo `{requestId}`. Katalog uprawnień nie jest
  wystawiany; portal zamawia grupy z `requiredEntitlements` katalogu C5.
- **Alternatywy:** dodać `GET /api/v1/entitlements?system=` z C13 `catalog`.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-025 | C12 | Ścieżki skrócone w tabeli

- **Problem:** `GET/POST/DELETE /api/v1/virtual-servers` (DELETE bez identyfikatora) i
  `GET .../pending | POST .../approve` bez pełnej ścieżki.
- **Przyjęty wariant:** `DELETE /api/v1/virtual-servers/{slug}`;
  `/api/v1/admin/registry/servers/{serverId}/tools/{tool}/pending` i `.../approve` (jak w C5).
  `GET /admin/v1/policy/status` nie ma odpowiednika w BFF (C12 go nie wymienia).
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-026 | C7 | `latest.json`: tylko nazwy plików względne i reguły spójności rewizji

- **Problem:** C7 opisuje `latest.json {revision, url, sigUrl}`, ale nie mówi, czy `url` może wskazywać
  dowolny host i ścieżkę, ani że rewizja w nazwie pliku, w `latest.json` i w `manifest.json` w paczce
  muszą się zgadzać. Bez tego podstawiony `latest.json` może skierować odbiorcę na obcy host albo podsunąć
  starą, poprawnie podpisaną paczkę pod nową rewizją (rollback mimo kontroli monotoniczności).
  Pierwsza wersja schematu miała wzorce niezakotwiczone na początku (uwaga z przeglądu bezpieczeństwa).
- **Przyjęty wariant:** `url` i `sigUrl` to wyłącznie nazwy plików w katalogu `latest.json`:
  `^policies-[0-9]{14}-[0-9a-f]{7}\.tar\.gz$` i to samo z `.sig` (bez hosta, ścieżki i `..`). Odbiorca MUSI:
  (1) sprawdzić, że rewizja w `url` i `sigUrl` == `revision`; (2) po weryfikacji podpisu sprawdzić, że
  `manifest.json` z paczki ma `revision` == `revision` z `latest.json` i `gitSha` zaczynający się od części
  sha rewizji; (3) przyjąć tylko rewizję ściśle wyższą od załadowanej (równa i niższa odrzucone, CC-008).
  Wektory: `test-vectors/bundles/latest-*.json` i przypadki paczek.
- **Alternatywy:** absolutne URL z listą dozwolonych hostów w konfiguracji odbiorcy.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-027 | C2/C7 | Zawężenie wirtualnego serwera dostępne dla serwera MCP (claim `vsc`)

- **Problem (przegląd 1.0.0, HIGH):** serwer MCP miał budować `context.vsScopes` z `resourceDefaults` linku,
  których nie zna (C2 niesie tylko slug `vs`). Zawężenie zgłoszeń, stron, projektów GitLaba i indeksów,
  sprawdzalne dopiero na serwerze, nie działało.
- **Przyjęty wariant:** opcjonalny claim `vsc` (kształt `VsScopes`: `jiraProjects`, `confluenceSpaces`,
  `gitlabGroups`, `opensearchIndexPrefixes`, `servicedeskQueues`, każde pole niepustą listą), obecny
  wtedy i tylko wtedy, gdy jest `vs` (`{}` dla linku bez zawężeń). Gateway wypełnia go z `resourceDefaults`
  linku, serwer buduje z niego `context.vsScopes`. `vs` bez `vsc` lub odwrotnie -> 401. Wektory:
  `jwt/valid-virtual-server-*`, `jwt/vs-without-vsc`, `jwt/vsc-without-vs`, `entity-builder/server-virtual-server`.
- **Status:** accepted (decyzja: człowiek, 2026-10-26, wydanie 1.1.0)

## CC-028 | C7 | Zawartość paczki `overrides` i rewizje per kanał

- **Problem (przegląd #4):** C7 nie ograniczał zawartości paczki `overrides`; skradziony klucz `overrides`
  pozwoliłby dodać encje statyczne albo podmienić schemat bez reguły `permit`. Nie było powiedziane, czy
  monotoniczność rewizji jest wspólna dla obu kanałów.
- **Przyjęty wariant:** paczka `overrides` zawiera wyłącznie `manifest.json` i `policies/**/*.cedar`
  (tylko `forbid`); `schema.cedarschema` lub `entities/static.json` w niej -> odrzucenie; schemat i encje
  statyczne zawsze z paczki głównej. Rewizje monotoniczne osobno dla kanału głównego i `overrides`.
  Wykrywanie `permit` przez parser Cedar (efekt każdej polityki), nie przez wyszukiwanie tekstu.
  Wektory: `bundles/overrides-with-static-entities`, `overrides-with-schema`,
  `overrides-permit-after-string-with-slashes`, `overrides-revision-independent-of-main`.
- **Status:** accepted (decyzja: człowiek, 2026-10-26)

## CC-029 | C5/C7 | Egzekwowanie wszystkich typów zawężalnych

- **Problem (przegląd #5):** `resourceDefaults` przyjmuje 5 typów, a polityki przykładowe zawężały tylko
  część; dla Confluence i service desk nie było nawet reguł odczytu.
- **Przyjęty wariant:** enum bez zmian; `cedar/examples/virtual-server.cedar` ma reguły dla każdego typu
  i jego typów podrzędnych (gateway: argumenty nazywające sam typ; serwer: zasób i rodzic), `read.cedar`
  i `call-tool.cedar` mają reguły odczytu dla Confluence i service desk. README i `cedar/entity-builder.md`
  zapisują, że paczka ws-09 musi pokryć wszystkie typy. Nowe wektory decyzji `*-vs-narrows-*`.
- **Status:** accepted (decyzja: człowiek, 2026-10-26)

## CC-030 | C2/C4 | Wariant serwisowy JWT na brokerze dla `GET /v1/systems`

- **Problem (przegląd #6):** gateway pobiera listę systemów przy starcie, bez użytkownika, a broker
  przyjmował tylko wariant użytkownika.
- **Przyjęty wariant:** broker przyjmuje wariant serwisowy wyłącznie dla `GET /v1/systems`; `resolve` i
  pozostałe operacje go odrzucają. Wektory `jwt/valid-service-broker-systems`, `jwt/service-variant-broker`.
- **Status:** accepted (decyzja: człowiek, 2026-10-26)

## CC-031 | C8 | `clientRequestId` i `resource.id` w audycie

- **Problem (przegląd #8):** `clientRequestId` to dowolny tekst od niezaufanego klienta; `resource.id` bez
  ograniczeń mógł złamać format linii w SIEM.
- **Przyjęty wariant:** `clientRequestId` pasuje do `^[A-Za-z0-9._:-]{1,128}$` (gateway pomija wartość
  niepasującą, nie odrzuca wywołania). `resource.id` zostaje dowolny (identyfikatory pięciu systemów mają
  różne alfabety: `/`, `.`, spacje), ale bez znaków sterujących C0 i C1, DEL, U+2028 i U+2029, maks. 512;
  serializer audytu escapuje znaki sterujące i U+2028/U+2029 w każdym napisie. Wektory `audit-events/invalid-*`.
- **Status:** accepted (decyzja: człowiek, 2026-10-26)

## CC-032 | C4/C12 | `returnPath` bez kodowania procentowego

- **Problem (przegląd #10 i przegląd bezpieczeństwa):** wzorzec dopuszczał `%`, więc `/%2F%2Fhost` albo
  podwójnie kodowane `/%252F%252Fhost` mogło po dekodowaniu dać `//host` (open redirect).
- **Przyjęty wariant:** `returnPath` w ogóle nie może zawierać `%` ani `\`; dozwolona ścieżka portalu
  z opcjonalnym query. BFF przekierowuje wyłącznie na zwalidowaną wartość bez dekodowania. Wektory
  `test-vectors/return-paths/`.
- **Status:** accepted (decyzja: człowiek, 2026-10-26)

## CC-033 | C2 | Wariant użytkownika dla metod protokołu

- **Problem (przegląd #13):** nie było powiedziane, czy serwer przyjmuje wariant użytkownika dla
  `initialize`, `tools/list`, `ping` i `GET /mcp-manifest`.
- **Przyjęty wariant:** tak; wariant serwisowy jest dozwolony tylko dla tych metod, wariant użytkownika dla
  wszystkich (CC-002 dalej obowiązuje dla `tools/call`). Dodatkowo odbiorca odrzuca token, którego `rid`
  różni się od nagłówka `X-Request-Id`. Wektory `jwt/valid-user-variant-*`, `jwt/request-id-mismatch`.
- **Status:** accepted (decyzja: człowiek, 2026-10-26)

## CC-034 | C5/C12 | Świeże MFA także dla podglądu potwierdzenia

- **Problem (przegląd #7):** C5 mówi "wymaga świeżego MFA" dla `GET/POST`, a 1.0.0 wymagało go tylko przy
  decyzji; podgląd pokazuje argumenty akcji destrukcyjnej.
- **Przyjęty wariant:** `GET` i `POST` `/admin/v1/confirmations/{id}` i `/api/v1/confirmations/{id}`
  odpowiadają `401 {error: "step_up_required", stepUpUrl}` bez świeżego MFA.
- **Status:** accepted (decyzja: człowiek, 2026-10-26)

## CC-035 | C2/C4/C5 | Tożsamość TLS brokera i wewnętrznego endpointu gateway'a

- **Zgłasza:** ws-01
- **Problem:** C5 ustala tożsamość serwerów MCP (SAN `<serverId>.internal`), a C4 tożsamość klientów
  brokera (CN `mcp-gateway`, `mcp-portal-bff`, `mcp-offboarding`). Nie ma odpowiednika dla serwerów
  wywoływanych przez inne komponenty: brokera (wołają go gateway i BFF) i wewnętrznego endpointu gateway'a
  (JWKS z C2 `https://<gateway-internal>/.well-known/jwks.json`, admin API C5 wołane przez BFF i CI).
  Bez ustalonej nazwy wystawca certyfikatów nie wie, jaką nazwę nadać, a klienci, którzy łączą się przez
  inny adres niż SAN, wyłączają weryfikację nazwy hosta. Wtedy zostaje tylko "certyfikat od wewnętrznego CA"
  i każdy komponent z certyfikatem tego CA (np. serwer MCP) może udawać brokera i odbierać PAT-y z
  `PUT .../secret` albo podsunąć własny JWKS.
- **Wariant przyjęty w `mcp-platform-dev`** (bez zmiany kontraktu): każdy certyfikat ma `CN=<nazwa>` i SAN
  `DNS:<nazwa>.internal`; broker `mcp-credential-broker.internal`, gateway `mcp-gateway.internal` (zgodne z
  domyślnym `iss` z C2 `https://mcp-gateway.internal`). Certyfikaty dev mają dodatkowo `localhost`.
- **Propozycja:** dopisać do C4: "klient (gateway, BFF) sprawdza, że SAN certyfikatu brokera ==
  `mcp-credential-broker.internal` (konfigurowalne)", a do C2/C5: "wewnętrzny endpoint gateway'a (JWKS,
  `/admin/v1`) ma SAN `mcp-gateway.internal` (konfigurowalne); odbiorcy JWKS i BFF to sprawdzają".
  Zmiana opisowa, bez wpływu na OpenAPI i schematy (patch).
- **Status:** open

## CC-??? | C4 | `credential.invalidated` także po zastąpieniu sekretu

- **Zgłasza:** ws-06
- **Problem:** C4.3 wymienia publikację `credential.invalidated` po `DELETE`, `purge` i `revoked`. Ponowny
  `PUT /v1/connections/{system}/secret` (użytkownik podmienia PAT, np. po wycieku starego) albo ponowne
  `oauth/complete` zastępuje poświadczenie, ale kontrakt nie mówi, czy gateway ma o tym wiedzieć. Bez
  zdarzenia gateway używa starego PAT do `cacheTtlSeconds` (do 60 s).
- **Wariant przyjęty w `mcp-credential-broker` M1** (bez zmiany schematu): broker publikuje
  `credential.invalidated {sub, system}` także wtedy, gdy zapis zastępuje istniejące połączenie (pierwsze
  połączenie nie publikuje niczego). Treść zdarzenia bez zmian.
- **Propozycja:** dopisać w C4.3 i w opisie `credential-invalidated-event.schema.json`: "także po zastąpieniu
  poświadczenia (`PUT secret`, `oauth/complete`) dla istniejącego połączenia". Zmiana opisowa (patch).
- **Status:** open

## CC-??? | C4/C8 | `X-Request-Id` w wywołaniach BFF -> broker

- **Zgłasza:** ws-06
- **Problem:** C8 wymaga `requestId` (UUIDv7) w każdym zdarzeniu, a C4 definiuje `X-Request-Id` tylko pośrednio
  przez `rid` wewnętrznego JWT gateway'a. Wywołania BFF (`PUT secret`, później `oauth/*`, `DELETE`) nie niosą
  identyfikatora, więc zdarzenia `connection_change` brokera i portalu nie dają się połączyć jednym
  `requestId`.
- **Wariant przyjęty w `mcp-credential-broker` M1:** broker przyjmuje od BFF opcjonalny nagłówek
  `X-Request-Id`; wartość pasująca do `RequestId` (UUIDv7) staje się `requestId` zdarzeń audytu, inna albo
  brak -> broker generuje UUIDv7. Broker zawsze odsyła użyty identyfikator w nagłówku odpowiedzi
  `X-Request-Id`. Dla gateway'a bez zmian (`X-Request-Id` == `rid`, inaczej 401).
- **Propozycja:** w `credential-broker.v1.yaml` dodać opcjonalny parametr nagłówka `X-Request-Id`
  (`common.schema.json#/$defs/RequestId`) dla operacji BFF i nagłówek odpowiedzi `X-Request-Id` dla wszystkich
  operacji; w C12 zapisać, że BFF przekazuje swój `requestId` do brokera. Nowe pole opcjonalne (minor).
- **Status:** open
