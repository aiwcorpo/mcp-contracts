# Zmiany kontraktów (propozycje i pytania)

Plik zbiera miejsca, w których `01-contracts.md` jest nieprecyzyjny albo sprzeczny, oraz propozycje zmian
od agentów. Każda pozycja ma przyjęty wariant, który **już jest** zaimplementowany w `mcp-contracts` 1.0.0,
i status. Zmianę statusu na `accepted`/`rejected` robi człowiek; odrzucenie wariantu oznacza nowe wydanie
kontraktów (patrz SemVer w `README.md`).

Format pozycji: numer `CC-NNN`, kontrakt `Cx`, problem, przyjęty wariant, alternatywy, status.

---

## CC-001 · C7 · Nazwa encji `Group` koliduje z `GitLab::Group`

- **Problem:** C7 nazywa encję grup użytkownika `Group` i jednocześnie wymaga `GitLab::Group`. Cedar 4
  (cedar-java 4.10.0) odrzuca taki schemat: `definition of GitLab::Group illegally shadows the existing
  definition of Group`.
- **Przyjęty wariant:** encja grup użytkownika nazywa się `UserGroup` (`User in [UserGroup]`), polityki
  piszą `principal in UserGroup::"mcp-jira-read"`. Typy zasobów systemów bez zmian.
- **Alternatywy:** (a) przenieść encje platformy do przestrzeni `Mcp::` (`Mcp::User`, `Mcp::Group`,
  `Mcp::Tool`, `Mcp::Action::"call"`), większa zmiana w politykach; (b) zmienić `GitLab::Group` na
  `GitLab::Namespace`, co dotyka manifestów serwerów (C6) i `resourceDefaults` (C5).
- **Status:** open

## CC-002 · C2 · Który wariant JWT dla `initialize`/`tools/list` w kontekście użytkownika

- **Problem:** w tabeli C2 `tool` jest wymagany, a wariant serwisowy jest opisany jako „wywołania bez
  użytkownika”. Nie wiadomo, jaki JWT gateway wysyła do serwera dla `initialize`, `tools/list` i `ping`
  w ramach sesji konkretnego użytkownika: wariant użytkownika nie ma wtedy sensownej wartości `tool`.
- **Przyjęty wariant:** wariant użytkownika ma `tool` wymagany i służy tylko do `tools/call` (oraz do
  `resolve` w brokerze). `initialize`, `tools/list`, `ping` i `GET /mcp-manifest` gateway zawsze wysyła
  z wariantem serwisowym. Schemat: `schemas/internal-jwt.schema.json` (`oneOf` dwóch wariantów).
- **Alternatywy:** (a) `tool` opcjonalny w wariancie użytkownika i wymagany tylko przy `tools/call`;
  (b) osobna wartość `tool` dla metod protokołu (np. `-`).
- **Status:** open

## CC-003 · C2 · Kto pilnuje `exp - iat <= 60 s` i granicy tolerancji zegara

- **Problem:** C2 podaje `exp - iat <= 60 s`, ale w liście kontroli odbiorcy wymienia tylko podpis, `iss`,
  `aud`, `exp` (skew <= 30 s), `jti`, `tool`. Nie wiadomo, czy odbiorca ma odrzucać token o dłuższym życiu.
  Nie jest też powiedziane, czy granica 30 s jest włącznie.
- **Przyjęty wariant:** odbiorca odrzuca token z `exp - iat > 60` (wektor `jwt/lifetime-too-long.json`).
  Token jest ważny, gdy `now <= exp + 30 s`; wektory leżą po obu stronach granicy (29 s ważny, 31 s
  odrzucony), sama granica nie jest testowana. `iat` z przyszłości większe niż skew też jest odrzucane
  (`jwt/issued-in-future.json`), bo inaczej limit 60 s można obejść.
- **Alternatywy:** sprawdzać tylko `exp` (zgodnie z dosłowną listą); wtedy wektory `lifetime-too-long`
  i `issued-in-future` zmieniają oczekiwanie na `valid`.
- **Status:** open

## CC-004 · C6 · Kształt obiektu liczonego do `definitionHash`

- **Problem:** C6 wymienia pola wchodzące do hasha (definicja MCP + wpis manifestu + `system`,
  `credential`), ale nie układ obiektu. Starter (generuje) i gateway (weryfikuje) muszą liczyć bit w bit
  to samo.
- **Przyjęty wariant:** płaski obiekt JSON z polami `name`, `description`, `inputSchema`, `outputSchema`,
  `annotations` (definicja MCP), `risk`, `action`, `resourceRefs` (manifest), `system`, `credential`
  (serwer); pole nieobecne w źródle jest pomijane (nie `null`); `resourceRefs` zawsze obecne (pusta
  tablica, gdy brak); `confirmation_code` dokładany przez gateway (C11) nigdy nie wchodzi. Kanonizacja
  RFC 8785, SHA-256, zapis `sha256:<hex>`. Wektory: `test-vectors/definition-hash/`.
- **Alternatywy:** obiekt zagnieżdżony `{tool: {...}, manifest: {...}, server: {...}}`.
- **Status:** open

## CC-005 · C6/C5 · Manifest nie zawiera definicji narzędzia MCP

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
- **Status:** open

## CC-006 · C7 · Uzupełnienia modelu Cedar względem skrótu w C7

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
  nazw z argumentów, Cedar nie ma kwantyfikatora „dla każdego”); robi to serwer na rozwiązanym indeksie.
- **Alternatywy:** hierarchia `OpenSearch::Index in [OpenSearch::IndexPrefix]` zamiast `namePrefixes`;
  dla zakresów na gateway'u builder mógłby liczyć gotową flagę, ale to przenosi decyzję poza Cedar.
- **Status:** open

## CC-007 · C9 · Skróty typów zasobów w grupach zakresu i reguły parsowania

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
- **Status:** open

## CC-008 · C7/C8 · Format `policyRevision` i porządek rewizji

- **Problem:** przykład w C8 ma `"policyRevision": "2026.10.26-a1b2c3"`, a C7 definiuje rewizję jako
  `YYYYMMDDHHMMSS-<sha7>`. C7 nie mówi też, co z dwiema rewizjami z tej samej sekundy.
- **Przyjęty wariant:** wszędzie (C2 `prv`, C7, C8) format C7, wzorzec `^[0-9]{14}-[0-9a-f]{7}$`.
  Porządek wyznacza tylko część czasowa; rewizja o tej samej części czasowej co załadowana nie jest „wyższa”
  i jest odrzucana (wektor `bundles/same-second-revision.json`).
- **Alternatywy:** porządek leksykograficzny całego napisu (wtedy sha decyduje przy remisie, co jest
  przypadkowe).
- **Status:** open

## CC-009 · C8 · Pola zdarzenia audytu

- **Problem:** C8 nie mówi, które pola są wymagane; nie ma pola na system docelowy zdarzeń brokera
  (`credential_resolve`, `connection_change`); format `resource.parent` (`Jira::Project::ABC`) różni się
  od zapisu UID Cedar (`Jira::Project::"ABC"`); C3 wspomina `clientRequestId`, którego nie ma w C8.
- **Przyjęty wariant:** wymagane `ts`, `requestId`, `component`, `componentId`, `event`, reszta
  opcjonalna; `additionalProperties: false` (żeby nie dało się dopisać argumentów ani sekretów); system
  zdarzeń brokera w polu `server` (`mcp-<system>`, bo jeden serwer na system); `resource.parent` w formacie
  z przykładu C8; `clientRequestId` dodane jako opcjonalne (z C3); `errorCode` to kod C10 albo `null`.
- **Alternatywy:** osobne pole `system`; `resource.parent` jako obiekt `{type, id}`.
- **Status:** open

## CC-010 · C10/C11/C12 · Pola błędów `confirmation_required` i `step_up_required`

- **Problem:** C10 podaje dla `confirmation_required` tylko `confirmationId`, C11 także `confirmUrl`.
  C10 nazywa link step-up `stepUpUrl`, C12 w odpowiedzi BFF `url`.
- **Przyjęty wariant:** `tool-error.schema.json`: `confirmationId` wymagane, `confirmUrl` opcjonalne;
  `step_up_required` ma `stepUpUrl`. BFF (C12) zwraca dosłownie `{error: "step_up_required", url}`.
- **Alternatywy (propozycja):** jedna nazwa `stepUpUrl` w obu miejscach; `confirmUrl` wymagane.
- **Status:** open

## CC-011 · C7 · Format podpisu paczki, `schemaVersion`, porównanie wersji schematu

- **Problem:** C7 nie mówi, czy `.sig` to surowe bajty czy base64, ani czym jest `schemaVersion`.
- **Przyjęty wariant:** `.sig` = surowe 64 bajty podpisu Ed25519 nad dokładnymi bajtami `.tar.gz`
  (tak jak `openssl pkeyutl -sign -rawin`); `schemaVersion` = wersja `mcp-contracts`, z której pochodzi
  `schema.cedarschema` (SemVer). Klucze publiczne odbiorców w formacie SPKI PEM lub JWK (OKP).
- **Alternatywy:** podpis base64 w pliku tekstowym; podpis nad `manifest.json` z sumami plików.
- **Status:** open

## CC-012 · C4/C5/C12 · Ciała błędów dla statusów, których kontrakt nie opisuje

- **Problem:** kontrakty opisują ciała tylko części błędów (409/422 w C4, `step_up_required` w C12).
  Klienci generowani z OpenAPI potrzebują kształtu dla 400/401/403/404/409/503.
- **Przyjęty wariant:** wspólny kształt `Error {error: <snake_case>, message?}` i kody: `invalid_request`
  (400), `unauthenticated` (401), `forbidden` (403, zły CN certyfikatu w C4), `access_denied` (403 w C5/C12),
  `not_found_or_denied` (404, także „nie właściciel”), `slug_taken` (409 przy tworzeniu linku),
  `hash_mismatch` (409 przy approve), `manifest_rejected` (422 przy rejestracji manifestu niezgodnego
  z konfiguracją), `csrf_invalid` (403 w C12), `upstream_unavailable` (503 w `resolve`, gdy magazyn
  sekretów/IdP/system nie odpowiada). `DELETE` i `purge` zwracają 204, `approve` i decyzja potwierdzenia 204.
- **Alternatywy:** RFC 9457 `application/problem+json`.
- **Status:** open

## CC-013 · C4 · Wartości puste i zdarzenie unieważnienia

- **Problem:** C4 wymienia `expiresAt` i `lastUsedAt` jako pola odpowiedzi, ale PAT bez daty ważności
  i nieużyte połączenie nie mają wartości. C4.3 nie podaje nazwy kanału Redis ani kształtu zdarzenia dla
  `purge` (wiele systemów naraz).
- **Przyjęty wariant:** pola obecne zawsze, wartość `null`, gdy brak (`expiresAt` w `resolve`,
  `connections`, `secret`; `lastUsedAt`). Kanał Redis `credential.invalidated`, treść
  `{sub, system}` (`schemas/credential-invalidated-event.schema.json`); `purge` publikuje jedno zdarzenie na
  każdy usunięty system.
- **Alternatywy:** pominięcie pola zamiast `null`; zdarzenie `purge` z `system` pominiętym = wszystkie.
- **Status:** open

## CC-014 · C5 · Zawartość katalogu i `requiredEntitlements`

- **Problem:** C5 nie wymienia pól serwera i narzędzia w katalogu poza `access` i `requiredEntitlements`;
  nie mówi też, czy `requiredEntitlements` jest wypełniane dla narzędzi już dostępnych.
- **Przyjęty wariant:** serwer: `serverId`, `system`, `version` (z manifestu); narzędzie: `name`
  (`<system>__<tool>`), `risk`, `action`, `access`, `requiredEntitlements` (zawsze obecne; grupy, które wg
  polityki dają narzędzie, także gdy `granted`). Tylko narzędzia `approved`. Brak opisu narzędzia (patrz CC-005).
- **Alternatywy:** `requiredEntitlements` tylko dla `denied`.
- **Status:** open

## CC-015 · C5 · Podgląd i decyzja potwierdzenia

- **Problem:** C5 mówi „argumenty w ustalonej kolejności, ewentualnie obcięte z oznaczeniem”, bez formatu.
- **Przyjęty wariant:** `{confirmationId, tool, arguments: [{name, value, truncated}]}`, argumenty
  posortowane po nazwie, `value` to serializacja JSON wartości (napis, obcięty przy `truncated: true`),
  bez `confirmation_code`. Decyzja `POST {decision}` → 204; brak świeżego MFA → 401
  `{error: "step_up_required"}`; cudze, wygasłe lub zużyte → 404.
- **Alternatywy:** dodać `expiresAt` (TTL 120 s), żeby portal pokazał odliczanie; 410 dla wygasłych.
- **Status:** open

## CC-016 · C5/C12 · Aktywność: limit i kształt

- **Problem:** `?limit=50` bez maksimum; kształt pozycji nieopisany.
- **Przyjęty wariant:** `limit` 1..200, domyślnie 50, od najnowszych; pozycje to zdarzenia C8
  (`audit-event.schema.json`), które z definicji nie zawierają argumentów.
- **Alternatywy:** węższy widok (tylko `ts`, `tool`, `decision`, `outcome`, `errorCode`).
- **Status:** open

## CC-017 · C5 · Wirtualny serwer: klucze `resourceDefaults` i slug

- **Problem:** `resourceDefaults: {<resourceType>: [ids]}` nie mówi, które typy są dozwolone, a zawężenie
  musi trafić do `context.vsScopes`, które ma tylko 5 pól (C7). Brak reguł dla `slug` (część URL).
- **Przyjęty wariant:** klucze tylko `Jira::Project`, `Confluence::Space`, `GitLab::Group`,
  `OpenSearch::Index` (wartości to prefiksy, jak w C9), `ServiceDesk::Queue`; każda lista niepusta.
  Slug: `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`. Narzędzie niedostępne → 403 `access_denied`, zajęty
  slug → 409 `slug_taken`.
- **Alternatywy:** dopuścić zawężanie do pojedynczych zgłoszeń/stron (wymaga nowych pól `vsScopes`).
- **Status:** open

## CC-018 · C6 · Reguły manifestu poza JSON Schema

- **Problem:** część reguł C5/C6 nie da się wyrazić w JSON Schema.
- **Przyjęty wariant:** opisane w `README.md` („Reguły semantyczne manifestu”) i sprawdzane w testach
  wektorów: `serverId == "mcp-" + system`; unikalne nazwy narzędzi; typy z `resourceRefs` i `parent`
  zadeklarowane w `resourceTypes`; nazwa narzędzia bez `__` (wzorzec w schemacie);
  `credential.required: true` wymaga niepustego `acceptedTypes`.
- **Alternatywy:** brak.
- **Status:** open

## CC-019 · C7 · Publikacja referencyjnego entity buildera

- **Problem:** C7 mówi, że entity builder ma implementację w Javie „współdzieloną przez gateway i starter”,
  ale nie mówi, gdzie ona żyje. W `mcp-contracts` jest specyfikacja, wektory i referencyjna implementacja
  w testach (`src/test/java/.../cedar/ReferenceEntityBuilder.java`), niepublikowana.
- **Propozycja:** wydać ją jako osobny artefakt `pl.aiwcorpo.mcp:mcp-cedar-entities` (bez zależności od
  Springa, zależność tylko od cedar-java), z tymi samymi wektorami jako testem. Gateway (ws-05) i starter
  (ws-02) dostaną jedną implementację zamiast dwóch zgodnych z wektorami.
- **Alternatywy:** każdy strumień implementuje sam i przechodzi wektory z `test-vectors/entity-builder`.
- **Status:** open (decyzja człowieka; w 1.0.0 nic nie jest publikowane poza zasobami)

## CC-020 · C12 · Mechanizm CSRF

- **Problem:** pierwsza wersja C12 wymagała nagłówka `X-CSRF-Token` bez opisu, skąd frontend bierze token.
- **Przyjęty wariant:** zaktualizowany C12 (plan z 2026-10-26 21:58): konwencja Angulara, ciasteczko
  `XSRF-TOKEN` (nie HttpOnly, Secure, SameSite=Strict), nagłówek `X-XSRF-TOKEN` dla POST/PUT/DELETE.
  `portal-bff.v1.yaml` i handlery MSW są z tym zgodne.
- **Status:** resolved (rozstrzygnięte w `01-contracts.md` C12)

## CC-021 · C12 · Status i akcje serwera w katalogu portalu

- **Problem:** C12 podaje statusy i akcje, ale nie poziom (serwer czy narzędzie), kolejność reguł ani
  status dla systemów, do których użytkownik niczego nie podłącza (`service-account`, `token-exchange`).
  Akcja `copy_link` wymaga adresu, którego żadne pole nie niesie.
- **Przyjęty wariant:** status i `actions[]` na poziomie serwera; narzędzia mają pola z C5 (`access`,
  `requiredEntitlements`). Kolejność reguł w opisie `GET /api/v1/catalog`; dla `service-account` /
  `token-exchange` status `connected`. Dodane pole serwera `url` (`https://<gateway>/s/<serverId>/mcp`).
- **Alternatywy:** frontend składa URL z konfiguracji; status per narzędzie.
- **Status:** open (pole `url` to dodatek względem C12, wymaga akceptacji)

## CC-022 · C12 · `returnPath` przy OAuth i błędy w callbacku

- **Problem:** C4 `oauth/start` wymaga `returnPath`, a C12 `POST /connections/{system}/oauth` nie ma body.
  Callback opisuje tylko sukces (`returnPath?connected=<system>`).
- **Przyjęty wariant:** opcjonalne body `{returnPath}` (domyślnie `/`); przy błędzie przekierowanie na
  `returnPath?connectError=<kod>`, kod ∈ `identity_mismatch`, `flow_invalid`, `provider_error`.
- **Alternatywy:** `returnPath` w query; strona błędu w BFF.
- **Status:** open

## CC-023 · C12 · Brak endpointów logowania i wylogowania

- **Problem:** „logowanie OIDC po stronie BFF”, ale C12 nie podaje, dokąd frontend przekierowuje po 401
  ani jak się wylogować.
- **Przyjęty wariant:** nic nie dodano; 401 `{error: "unauthenticated"}`. ws-07/ws-08 muszą uzgodnić
  ścieżki (domyślne Spring Security: `/oauth2/authorization/<rejestracja>` i `POST /logout`).
- **Propozycja:** dopisać do C12 `GET /api/v1/auth/login?returnPath=` (302 do IdP) i
  `POST /api/v1/auth/logout` (204, CSRF).
- **Status:** open

## CC-024 · C13 · Kształt `AccessRequest` i `RequestResult`

- **Problem:** C13 nazywa typy `Entitlement`, `AccessRequest`, `RequestResult` bez pól; C12 nie wystawia
  katalogu uprawnień (`catalog(system)`).
- **Przyjęty wariant:** `AccessRequest {requestId, entitlement, status ∈ pending|approved|rejected|cancelled,
  createdAt, requestUrl?}`; `RequestResult` = `{requestUrl}` albo `{requestId}`. Katalog uprawnień nie jest
  wystawiany; portal zamawia grupy z `requiredEntitlements` katalogu C5.
- **Alternatywy:** dodać `GET /api/v1/entitlements?system=` z C13 `catalog`.
- **Status:** open

## CC-025 · C12 · Ścieżki skrócone w tabeli

- **Problem:** `GET/POST/DELETE /api/v1/virtual-servers` (DELETE bez identyfikatora) i
  `GET …/pending · POST …/approve` bez pełnej ścieżki.
- **Przyjęty wariant:** `DELETE /api/v1/virtual-servers/{slug}`;
  `/api/v1/admin/registry/servers/{serverId}/tools/{tool}/pending` i `.../approve` (jak w C5).
  `GET /admin/v1/policy/status` nie ma odpowiednika w BFF (C12 go nie wymienia).
- **Status:** open
