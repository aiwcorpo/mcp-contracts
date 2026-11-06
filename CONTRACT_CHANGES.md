# Zmiany kontraktów (propozycje i pytania)

Plik zbiera miejsca, w których `01-contracts.md` jest nieprecyzyjny albo sprzeczny, oraz propozycje zmian
od agentów. Każda pozycja ma przyjęty wariant, który **już jest** zaimplementowany w `mcp-contracts` 1.0.0,
i status. Zmianę statusu na `accepted`/`rejected` robi człowiek (CC-001 ... CC-034 rozstrzygnięte 2026-10-26, wydanie 1.1.0; CC-035 odrzucone; CC-036 ... CC-045 rozstrzygnięte 2026-10-27, wydanie 1.2.0; CC-046 ... CC-067 rozstrzygnięte 2026-10-27, wydanie 2.0.0 (1.2.1 nie zostało wydane osobno); CC-068 ... CC-077 rozstrzygnięte 2026-10-27, wydanie 2.1.0); odrzucenie wariantu oznacza nowe wydanie
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
- **Status:** rejected (decyzja: człowiek, 2026-10-26 - SAN brokera i wewnętrznego gateway'a to konfiguracja komponentu, nie konwencja kontraktu)

## CC-036 | C7 | Wirtualny serwer a narzędzia wyszukiwania i list

- **Problem (przegląd 1.1.0, H1):** narzędzie wyszukujące bez argumentu-identyfikatora (np. `search_issues`
  bez `projectKeys`) ma puste `refs`, więc gateway nie ma czego zawęzić, a serwer oceniał Cedar tylko dla
  jednego rozwiązanego zasobu. Link ograniczony do ABC zwracał wyniki z DEF (łamie niezmiennik 5).
- **Przyjęty wariant:** obowiązek serwera (C7, `cedar/entity-builder.md` sekcja 8): (1) zapytanie do systemu
  jest ograniczone do `vsScopes` linku (JQL/CQL/wzorzec indeksu/filtr grupy), a tam, gdzie system nie
  egzekwuje uprawnień użytkownika (OpenSearch), także do zakresów przyznanych; (2) każdy zwrócony element
  jest oceniany przez `forResource`; element niedozwolony lub nieoceniany jest pomijany bez błędu wywołania.
  API: `EntityBuilder.queryConstraint`, `QueryConstraint`, `ResultFilter`. Wektory:
  `policy-decisions/gw-vs-search-without-project-passes-gateway`, `srv-vs-search-result-*`, `result-filter/`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.0)

## CC-037 | C7/C9 | Zakresy zasobów jako dane paczki polityk

- **Problem (M8):** zakres wyprowadzany z nazwy grupy (`mcp-gitlab-grp-team-a` -> `team-a`) nie obejmował
  podgrup GitLaba, drzew stron Confluence ani nie pozwalał nazwać grupy niezależnie od ścieżki.
- **Przyjęty wariant:** mapowanie grupa -> zakresy jest danymi w `entities/static.json` paczki głównej: encja
  `UserGroup` ma rodziców `ResourceScope` o id `<Typ>/<id>` (`Jira::Project/ABC`, `Confluence::Space/ENG`,
  `Confluence::Page/1000` = drzewo stron, `GitLab::Group/team-a` = grupa z podgrupami,
  `OpenSearch::Index/logs-team-a` = prefiks, `ServiceDesk::Queue/42`). Każdy zasób niesie `scopes`: zbiór
  `ResourceScope` siebie i wszystkich kontenerów (wszystkie prefiksy ścieżki grupy po `/`, prefiksy nazwy
  indeksu po `-`, przestrzeń i strony-przodkowie z `ancestorIds`), więc polityka sprawdza
  `principal in resource.scopes`. Grupa bez wpisu nie daje zakresu (fail-closed); dopasowanie nazw grup jest
  dokładne (wielkość liter). Wyprowadzanie zakresu z nazwy C9 **znika** z buildera (wariant prostszy: jedno
  źródło prawdy); konwencja nazw C9 zostaje jako zalecenie dla czytelności, a potok ws-09 może z niej
  generować `static.json`. `principal.scopes`, `context.vsScopes` i pola `refs` typów płaskich są zbiorami
  `ResourceScope`; gateway sprawdza wcześnie tylko typy płaskie (projekt Jira, przestrzeń, kolejka), typy
  hierarchiczne sprawdza serwer. `OpenSearch::Index.namePrefixes` usunięte (zastąpione `scopes`). Przykład:
  `cedar/examples/static-entities.json`. Wektory: `srv-gitlab-subgroup-covered`, `srv-gitlab-sibling-not-covered`,
  `srv-gitlab-group-without-mapping`, `srv-gitlab-similar-prefix-not-covered`, `srv-confluence-page-*`,
  `entity-builder/scopes-from-mapping`, `bundles/main-static-entities-invalid-mapping`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.0)

## CC-038 | C2 | Claim `tool` tylko dla `tools/call` i `resolve`

- **Problem (M2):** w 1.1.0 `tool` był wymagany w wariancie użytkownika także dla `tools/list` itd., bez
  określonej wartości.
- **Przyjęty wariant:** `tool` opcjonalny w schemacie; odbiorca wymaga go i porównuje z `params.name` dla
  `tools/call`, wymaga go dla `resolve` w brokerze, a odrzuca token z `tool` dla `initialize`, `tools/list`,
  `ping` i `GET /mcp-manifest`. Wektory `jwt/user-variant-tools-list-with-tool`, `tools-call-without-tool`,
  `broker-resolve-without-tool`, `valid-user-variant-*`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.0)

## CC-039 | C7 | Stabilność API `mcp-cedar-entities`

- **Problem (M7):** publiczne rekordy i typy cedar-java w sygnaturach.
- **Przyjęty wariant:** API zostaje w obecnym kształcie; README i javadoc mówią, że dodanie składnika rekordu
  albo zmiana major cedar-java to wydanie major biblioteki. Poprawki L4: `null` w atrybutach = brak atrybutu,
  `EntityBuilderException` zamiast `NumberFormatException`, odrzucanie nieznanego typu w `ResourceRef`,
  1..50 identyfikatorów na pole w `VirtualServerScope`, fabryka `VirtualServerScope.fromClaims`, rzetelny opis
  niezmienności (`CedarRequest` zawiera mutowalne obiekty cedar-java).
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.0)

## CC-040 | C7 | Paczka `overrides` walidowana schematem paczki głównej

- **Problem (M3):** Cedar pomija politykę z błędem oceny, więc literówka w awaryjnym `forbid` cicho go wyłącza.
- **Przyjęty wariant:** odbiorca waliduje politykę `overrides` w trybie strict schematem załadowanej paczki
  głównej; błąd = odrzucenie całej paczki `overrides` (zostaje poprzednia). Szablony w paczkach są odrzucane.
  Wektor `bundles/overrides-invalid-for-main-schema`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.0)

## CC-041 | C7 | `context.vsScopes` tylko w regułach `forbid`

- **Problem (M6):** `permit` czytający `vsScopes` pozwoliłby linkowi nadać uprawnienie.
- **Przyjęty wariant:** reguła kontraktu; lint na sparsowanej polityce (postać JSON z parsera Cedar, nie tekst)
  w odbiorcy (`mcp-policy-bundle`, powód `vs_scopes_in_permit`, od 2.0.0 `link_context_in_permit`, CC-058) i jako narzędzie potoku ws-09
  (`PolicyLintCli`). Wektor `bundles/main-permit-reads-vsscopes`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.0)

## CC-042 | C6 | `title` w definicji i w hashu; bez `icons` i `_meta`

- **Problem (M4):** pole `title` (MCP 2025-06-18) trafiało do klienta nieprzypięte.
- **Przyjęty wariant:** `definition.title` opcjonalne i wchodzi do obiektu hashowanego (CC-004) zaraz po
  `name`; `icons` i `_meta` w v1 odrzucane przez schemat. Wektory `definition-hash/search-issues-with-title`,
  `manifests/invalid-title-changed`, `invalid-definition-icons`, `invalid-definition-meta`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.0)

## CC-043 | C5/C6 | `resourceRefs[].argument` musi istnieć w `inputSchema`

- **Problem (M5):** literówka w nazwie argumentu daje puste `refs`, a reguły gateway'a cicho przepuszczają.
- **Przyjęty wariant:** reguła manifestu (CC-018): argument istnieje w `definition.inputSchema.properties` i ma
  typ `string`, `integer` albo `array` z `items` typu `string`/`integer`; inaczej `PUT` rejestru -> 422
  `manifest_rejected`. Reguła w `scripts/lib/manifest-rules.mjs` (w Javie nie ma reguł manifestu).
  Wektory `manifests/invalid-resource-ref-argument-case`, `-object`, `-array-of-object`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.0)

## CC-044 | C2/C7 | Odrzucanie testowych kluczy (`kid` z prefiksem `test-`)

- **Problem (M9):** w 1.1.0 reguła była tylko w opisie, bez pozycji CC i wektorów.
- **Przyjęty wariant:** odbiorcy wewnętrznego JWT (serwery, broker) domyślnie odrzucają `kid` zaczynający się
  od `test-`; wyłączenie tylko jawnym ustawieniem (zalecana nazwa `allowTestKeys`, wyłącznie dev/test).
  Paczki polityk: klucze Ed25519 nie mają `kid` w podpisie, więc odbiorca dostaje identyfikator klucza z
  konfiguracji (`BundleVerifier.of(channel, key, keyId, allowTestKeys)`); opublikowane klucze testowe mają
  identyfikatory `test-policy-bundle` i `test-policy-overrides` (pole `kid` w ich JWK) i są odrzucane bez
  `allowTestKeys`. Wektory `jwt/test-kid-rejected-by-default`, `bundles/test-key-rejected-by-default`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.0)

## CC-045 | C7 | Referencyjny odbiorca paczek `mcp-policy-bundle`

- **Problem (M10):** odbiorca był tylko w testach, parser tar ignorował prefiks ustar, nadpisywał duplikaty,
  nie odrzucał `..`, nie miał limitów, efekt badał tylko w politykach statycznych.
- **Przyjęty wariant:** moduł `pl.aiwcorpo.mcp:mcp-policy-bundle:1.2.0` (bez Springa): podpis Ed25519 z kluczem
  per kanał, monotoniczna rewizja per kanał, zgodność rewizji nazwa/`latest.json`/manifest, zawartość
  `overrides`, brak `permit` (także w szablonach), lint `vsScopes`, walidacja strict, encje statyczne i
  mapowanie zakresów; tar: prefiks ustar, sumy kontrolne, tylko pliki zwykłe i katalogi, bez nazw absolutnych,
  `.`/`..` i duplikatów, limity 1000 wpisów, 4 MiB na plik, 16 MiB po rozpakowaniu. Wektory `bundles/tar-*`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.0)

## CC-046 | C4 | `credential.invalidated` także po zastąpieniu sekretu

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
- **Weszło w 1.2.1:** opis C4 (`info`, `putSecret`, `completeOAuth`) i `credential-invalidated-event.schema.json`: zdarzenie także po zastąpieniu poświadczenia istniejącego połączenia; pierwsze połączenie nic nie publikuje.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.1, wchodzi w 2.0.0)

## CC-047 | C4/C8 | `X-Request-Id` w wywołaniach BFF -> broker

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
- **Weszło w 1.2.1:** opcjonalny parametr nagłówka `X-Request-Id` (`RequestId`) w operacjach BFF->broker, nagłówek odpowiedzi `X-Request-Id` we wszystkich odpowiedziach C4 (także stuby WireMock); w C12 zapis, że BFF przekazuje swój requestId do brokera i gateway'a.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.1, wchodzi w 2.0.0)

## CC-048 | C12 | `returnPath` w `stepUpUrl` dla operacji wywoływanych z formularza

- **Zgłasza:** ws-08
- **Problem:** `PUT /api/v1/connections/{system}/secret` (i `GET/POST /api/v1/confirmations/{id}`) wywołuje
  `HttpClient`, więc BFF nie wie, z którego ekranu przyszło żądanie; przykład `stepUpUrl` ma
  `returnPath=/catalog`. Po ponownym MFA użytkownik ląduje w katalogu zamiast w formularzu, a sekret i tak
  trzeba wpisać ponownie (frontend go nie przechowuje).
- **Wariant przyjęty w `mcp-portal/web` M1** (bez zmiany kontraktu): frontend przyjmuje `stepUpUrl` tylko
  wtedy, gdy wskazuje ten sam origin i ścieżkę `/api/v1/auth/login`; ustawia w nim `stepUp=true` i własny
  `returnPath` (np. `/connect/gitlab?stepUp=done&expiresAt=2027-01-31`, bez sekretu). Każda inna wartość jest
  pomijana i frontend buduje `GET /api/v1/auth/login?returnPath=...&stepUp=true` sam. BFF waliduje
  `returnPath` jak dotąd (CC-032), więc nie powstaje open redirect.
- **Propozycja:** dopisać w opisie `StepUpRequired.stepUpUrl` w `portal-bff.v1.yaml`: "`returnPath` w
  `stepUpUrl` jest wartością domyślną; frontend może go zastąpić ścieżką portalu zgodną z `ReturnPath`".
  Zmiana opisowa (patch).
- **Weszło w 1.2.1:** opis `StepUpRequired.stepUpUrl`: `returnPath` w `stepUpUrl` jest wartością domyślną; frontend może go zastąpić ścieżką portalu zgodną z `ReturnPath` (z `stepUp=true`).
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.1, wchodzi w 2.0.0)

## CC-049 | C4/C12 | Poświadczenie typu Basic w `PutSecretRequest`

- **Zgłasza:** ws-08
- **Problem:** brief ws-08 mówi o formularzu "Token (PAT/Basic)", a `PutSecretRequest` ma jedno pole `secret`.
  Nie wiadomo, czy dla systemu z uwierzytelnieniem Basic (np. service desk bez PAT) frontend ma wysłać
  `login:hasło`, samo hasło (login z `backendUser`?), czy taki system w ogóle nie jest obsługiwany. C12 nie
  mówi też, którego wariantu oczekuje dany system.
- **Wariant przyjęty w `mcp-portal/web` M1:** jedno pole na token, wysyłane jako `secret`; brak formularza
  login + hasło.
- **Propozycja:** albo zapisać w C4, że `user-secret` to zawsze pojedynczy token (PAT, klucz API) i Basic nie
  jest obsługiwany, albo dodać do `PortalCatalogServer` opcjonalne pole `secretFormat` (`token` | `basic`) i do
  `PutSecretRequest` opcjonalne `username` dla `basic` (minor).
- **Weszło w 1.2.1 (wariant "tylko token"):** `user-secret` dla użytkowników to zawsze pojedynczy token (PAT, klucz API) w polu `secret`; Basic dla użytkowników nie jest obsługiwany w v1, system tylko z Basic (np. service desk) łączy się przez `service-account` (D10). Zapis w opisie C4 i `PutSecretRequest.secret`; bez nowych pól.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.1, wchodzi w 2.0.0)

## CC-050 | C12 | `503 upstream_unavailable` w operacjach BFF opartych na C4/C5

- **Zgłasza:** ws-07
- **Problem:** `GET /api/v1/catalog`, `GET /api/v1/connections`, `PUT .../secret` i `DELETE /api/v1/connections/{system}`
  zależą od brokera, gateway'a i wymiany tokenu w IdP. C12 nie opisuje odpowiedzi, gdy któryś z nich nie
  odpowiada albo zwraca błąd inny niż opisany (np. 401/5xx brokera). Klient wygenerowany z C12 nie zna tego
  statusu, a test kontraktowy BFF musi go pomijać.
- **Wariant przyjęty w `mcp-portal/bff` M1:** `503 {error: "upstream_unavailable"}` (kształt `Error`, kod jak w
  CC-012 dla `resolve`); katalog jest wtedy w całości 503, bez częściowej odpowiedzi. Treść odpowiedzi
  upstream nie jest przekazywana.
- **Propozycja:** dodać w `portal-bff.v1.yaml` odpowiedź `503` (`#/components/responses/UpstreamUnavailable`,
  przykład `upstream_unavailable`) do operacji proxy do C4/C5 (także przyszłych: wirtualne serwery,
  aktywność, potwierdzenia, admin). Nowa odpowiedź opcjonalna (minor).
- **Weszło w 1.2.1:** `components/responses/UpstreamUnavailable` (503, `Error`, przykład `upstream_unavailable`) w 14 operacjach C12 opartych na C4/C5 (katalog, połączenia, OAuth start, sekret, odłączenie, potwierdzenia, wirtualne serwery, aktywność, admin); zasada w opisie API: także przyszłe operacje, katalog w całości 503, bez treści upstream. Stuby MSW (wybór `Prefer: example=upstream_unavailable`).
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.1, wchodzi w 2.0.0)

## CC-051 | C12 | Callback logowania OIDC i błąd logowania

- **Zgłasza:** ws-07
- **Problem:** CC-023 dodało `GET /api/v1/auth/login`, ale C12 nie mówi, gdzie IdP wraca po logowaniu ani dokąd
  trafia przeglądarka, gdy logowanie się nie uda (anulowanie, błąd IdP, zła odpowiedź tokenu). Frontend
  (ws-08) nie ma czego obsłużyć.
- **Wariant przyjęty w `mcp-portal/bff` M1:** `redirect_uri` u IdP to `/login/oauth2/code/keycloak` (wewnętrzny
  endpoint BFF, nie część API dla frontendu; w realmie `corp` już zarejestrowany). Sukces: 302 na zwalidowany
  `returnPath`. Porażka: 302 na `/?loginError=true`, bez kodu błędu IdP.
- **Propozycja:** dopisać to w opisie `GET /api/v1/auth/login` (zmiana opisowa, patch); ewentualnie
  `loginError=<kod>` z zamkniętą listą kodów, jeśli frontend ma rozróżniać przyczyny.
- **Weszło w 1.2.1 (wariant z zamkniętą listą kodów):** opis `GET /api/v1/auth/login`: `redirect_uri` IdP to wewnętrzny endpoint BFF (poza API frontendu); sukces -> zwalidowany `returnPath`; porażka -> `/?loginError=<kod>`, enum `LoginErrorCode` = `cancelled`, `idp_error`, `session_expired`, `step_up_failed`; szczegóły IdP nigdy w URL. Wektory `test-vectors/login-redirects/`, stała `LOGIN_ERROR_CODES` w paczce MSW.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.1, wchodzi w 2.0.0)

## CC-052 | C13 | Tożsamość w `requestsOf` i `request`

- **Zgłasza:** ws-07
- **Problem:** C13 ma `requestsOf(String sub)` i `request(String sub, ...)`. Produkty IGA (i adapter `mock`)
  identyfikują wnioskodawcę zwykle loginem lub e-mailem, a w środowisku dev `sub` zmienia się przy każdym
  imporcie realmu, więc dane `mock` nie mogą być kluczowane po `sub`.
- **Wariant przyjęty w `mcp-portal/bff` M1:** port przyjmuje `Requester(sub, username)`; adapter `mock` dopasowuje
  wpis po `sub` albo po `preferred_username`. Obie wartości pochodzą z logowania OIDC, nigdy z przeglądarki.
- **Propozycja:** zapisać w C13 sygnatury z `Requester {sub, username}` (zmiana opisowa portu wewnętrznego BFF,
  bez wpływu na OpenAPI).
- **Weszło w 1.2.1 (wariant C):** port przyjmuje `Requester` ze wszystkimi atrybutami tożsamości z tokenu OIDC (`sub`, `username`, `email`, mapa pozostałych claimów), wyłącznie z sesji BFF, nigdy z przeglądarki; każdy adapter IGA wybiera identyfikator wnioskodawcy z konfiguracji (np. `requester-id-claim`, domyślnie `preferred_username`); brak claimu -> błąd adaptera (fail-closed). Opis w README (sekcja "Port IGA (C13)"); bez wpływu na OpenAPI.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.1, wchodzi w 2.0.0)

## CC-053 | C12 | `mfaFreshUntil` w `GET /api/v1/me`

- **Problem (recenzja web):** frontend dowiaduje się o potrzebie step-up dopiero po wysłaniu sekretu (401), więc
  użytkownik wpisuje sekret dwa razy.
- **Przyjęty wariant:** `Me.mfaFreshUntil` (opcjonalne, date-time UTC; brak = MFA nieświeże albo nieznane).
  Frontend przed pokazaniem pola na sekret sprawdza świeżość i w razie potrzeby najpierw prowadzi na step-up.
  Pole jest informacyjne: BFF nadal egzekwuje step-up przy `PUT .../secret` i potwierdzeniach. Przykład MSW
  `mfa_fresh` (`Prefer: example=mfa_fresh`).
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 1.2.1, wchodzi w 2.0.0)

## CC-054 | C12 | `400 invalid_request` dla `DELETE /api/v1/connections/{system}`

- **Zgłasza:** ws-07
- **Problem:** parametr `system` ma enum `SystemId`, a `DELETE /api/v1/connections/{system}` nie ma odpowiedzi `400`
  (ma ją `PUT .../secret`). Dla nieznanego systemu BFF odpowiada `400 {error: "invalid_request"}`, czego kontrakt
  nie opisuje; wygenerowany klient nie zna tego statusu.
- **Wariant przyjęty w `mcp-portal/bff`:** 400 `invalid_request` (kształt `Error`), broker nie jest wołany, zdarzenie
  audytu `connection_change` z `decision: deny`, `reason: invalid_request`.
- **Propozycja:** dodać `'400': $ref: '#/components/responses/BadRequest'` do `DELETE /api/v1/connections/{system}`
  (i analogicznie do innych operacji z parametrem ścieżki o zamkniętym wzorcu). Nowa odpowiedź (minor).
- **Weszło w 2.0.0:** `400 BadRequest` przy `DELETE /api/v1/connections/{system}` (nieznany system, broker nie jest wołany); MSW odpowiada 400 `invalid_request` dla nieznanego `{system}` we wszystkich operacjach z tym parametrem.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.0.0)

## CC-055 | C12 | Nazwa ciasteczka CSRF z prefiksem `__Host-`

- **Zgłasza:** ws-07
- **Problem (przegląd M1 BFF):** `XSRF-TOKEN` nie ma prefiksu `__Host-`, więc sąsiednia subdomena może ustawić
  własne ciasteczko o tej nazwie (cookie tossing) i znać jego wartość; double-submit CSRF chroni wtedy słabiej.
  Sesja ma `__Host-session`, CSRF nie.
- **Wariant przyjęty w `mcp-portal/bff`:** bez zmiany kontraktu: `XSRF-TOKEN` (Secure, SameSite=Strict, Path=/),
  token przyjmowany wyłącznie z nagłówka `X-XSRF-TOKEN` (nie z parametru `_csrf`).
- **Propozycja:** C12: ciasteczko `__Host-XSRF-TOKEN`; Angular ustawia
  `withXsrfConfiguration({cookieName: '__Host-XSRF-TOKEN', headerName: 'X-XSRF-TOKEN'})`. Zmiana nazwy (major,
  można połączyć z 2.0.0).
- **Weszło w 2.0.0:** ciasteczko CSRF `__Host-XSRF-TOKEN` (Secure, Path=/, bez Domain, SameSite=Strict, nie HttpOnly), nagłówek bez zmian `X-XSRF-TOKEN`; opis C12, MSW (`XSRF_COOKIE`), README (konfiguracja Angulara).
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.0.0)

## CC-056 | C2/C5/C7 | Wzorce identyfikatorów per system

- **Problem (przegląd 1.2.0, H1 i H2):** identyfikatory zasobów nie miały gramatyki: indeks OpenSearch
  `logs-team-a-x,secret-y` albo `logs-team-a-*,*` przechodził ocenę zakresu `logs-team-a`, a klucz projektu
  `ABC) OR project in (HR` wracał z `queryConstraint` bez zmian i mógł trafić do JQL. Nie było też powiedziane,
  co znaczy puste `granted` i puste zawężenie oraz jak zawęzić zapytanie o strony Confluence.
- **Przyjęty wariant (decyzja człowieka: wzorce per system, nie wspólny alfabet):** wzorce w
  `schemas/common.schema.json` (`JiraProjectKey`, `JiraIssueKey`, `ConfluenceSpaceKey`, `ConfluencePageId`,
  `GitLabGroupPath`, `GitLabProjectPath`, `OpenSearchIndexName`, `OpenSearchIndexPrefix`, `ServiceDeskQueueId`,
  `ServiceDeskTicketId`, mapa `ResourceIdPatterns`), zgodne z dokumentacją systemów (tabela w
  `cedar/entity-builder.md` sekcja 9; service desk zachowawczo, konfigurowalny w przyszłości). Stosowane w
  `ResourceDefaults` (C5, schemat per typ), `vsc` (C2), `refs` (`invalid_argument`), zasobach z resolvera i
  `static.json`. Specyfikacja (sekcja 8): obowiązek cytowania identyfikatorów w JQL/CQL, kanoniczny wzorzec
  OpenSearch `p,p-*`, puste `granted` = brak zapytania, puste `virtualServer` = brak zawężenia,
  `queryConstraint("Confluence::Page")` zwraca zawężenie przestrzeni linku (`virtualServerType`). Wektory
  `resource-ids/`, `entity-builder/refs-*`, `vsc-invalid-id`, `jwt/vsc-invalid-id`, `result-filter/` (GitLab,
  Confluence, service desk, brak zakresów).
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.0.0)

## CC-057 | C7 | Klasyfikacja `Restricted` dla GitLaba i service desku

- **Zgłasza:** ws-09
- **Problem:** brief ws-09 wymaga `forbid` dla danych `Restricted` we wszystkich systemach, ale model Cedar 1.2.0 ma
  atrybut klasyfikacji tylko dla Jiry (`Jira::Project.category`), Confluence (`Confluence::Space.labels`) i
  OpenSearch (`OpenSearch::Index.tags`). `GitLab::Group`, `GitLab::Project`, `ServiceDesk::Queue` i
  `ServiceDesk::Ticket` nie mają żadnego atrybutu, na którym polityka mogłaby oprzeć taką regułę, więc paczka
  `mcp-policies` nie zamyka danych `Restricted` w tych dwóch systemach.
- **Wariant przyjęty w `mcp-policies` (1.2.0):** reguły `Restricted` dla Jiry, Confluence i OpenSearch
  (`tags.contains("restricted")`); GitLab i service desk bez reguły, opisane w `STATUS.md`.
- **Propozycja:** opcjonalny atrybut `classification?: String` na `GitLab::Group`, `GitLab::Project` (wartość z
  tematu/etykiety grupy lub projektu, np. topic `restricted`) i `ServiceDesk::Queue` (kategoria kolejki); resolver
  serwera wypełnia go z systemu, a `GitLab::Project.group` i `ServiceDesk::Ticket.queue` pozwalają sprawdzić
  kontener. Encje `Restricted` w wektorach `srv-gitlab-*` i `srv-servicedesk-*`. Zmiana schematu Cedar (nowe
  pole opcjonalne, istniejące polityki dalej przechodzą walidację), więc minor; można połączyć z 2.0.0.
- **Weszło w 2.0.0:** opcjonalny atrybut `classification: Set<String>` na `GitLab::Group`, `GitLab::Project` (źródło: topics grupy i projektu w GitLabie) i `ServiceDesk::Queue` (źródło: kategoria kolejki w adapterze service desku); `ServiceDesk::Ticket` dziedziczy klasyfikację przez `queue`, `GitLab::Project` także przez `group`. Reguły `gitlab-forbid-restricted-*`, `servicedesk-forbid-restricted-*` w `cedar/examples/forbid-restricted.cedar`, wektory `srv-gitlab-restricted-project-topic`, `srv-gitlab-project-in-restricted-group`, `srv-servicedesk-ticket-in-restricted-queue`. Wartości normalizowane jak w CC-067.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.0.0)

## CC-058 | C7 | `context.virtualServer` w `permit` odrzucany przez odbiorcę

- **Zgłasza:** ws-09
- **Problem:** CC-041 zabrania czytania `context.vsScopes` w `permit`, ale `context.virtualServer` (slug linku)
  w `permit` też pozwala linkowi nadać uprawnienie (`permit ... when { context.virtualServer == "x" }`).
  `PolicyLint` i `BundleVerifier` 1.2.0 sprawdzają tylko `vsScopes`.
- **Wariant przyjęty w `mcp-policies`:** `policy-tool check` odrzuca `permit` czytający `context.virtualServer`
  (ta sama metoda co `PolicyLint`: postać JSON z parsera Cedar); test w `PolicyChecksTest`.
- **Propozycja:** jeśli nie weszło do 2.0.0: `PolicyLint` i odbiorca odrzucają `permit` czytający którekolwiek z
  `vsScopes` i `virtualServer` (powód `vs_scopes_in_permit` albo nowy `link_context_in_permit`), wektor
  `bundles/main-permit-reads-virtual-server`.
- **Weszło w 2.0.0:** `PolicyLint.linkContextOutsideForbid` i odbiorca odrzucają `permit` czytający `context.vsScopes` albo `context.virtualServer`; jeden powód `link_context_in_permit` (zastępuje `vs_scopes_in_permit`); wektor `bundles/main-permit-reads-virtual-server`. Zamyka też punkt M2 przeglądu 1.2.0.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.0.0)

## CC-059 | C7 | Paczka główna: tylko mapowanie zakresów, schemat przypięty

- **Problem (przegląd 1.2.0, H3):** `static.json` mógł zawierać dowolne encje (`User`, `Tool`, `ResourceScope`),
  które po scaleniu z encjami buildera dawały konflikt (odmowa wszystkiego) albo zmieniały hierarchię; schemat
  z paczki nie był porównywany z wersją kontraktów, więc paczka mogła np. pozwolić na zagnieżdżanie
  `ResourceScope` i poszerzyć zakresy.
- **Przyjęty wariant:** `entities/static.json` zawiera wyłącznie encje `UserGroup` z `attrs: {}` i rodzicami
  `ResourceScope`; inne -> `static_entities_invalid`. `schema.cedarschema` musi być bajtowo równy
  `McpCedarSchema.text()` biblioteki (`cedar/mcp.cedarschema` tej wersji kontraktów); inaczej `schema_mismatch`.
  `PolicyBundle` nie wystawia encji statycznych, tylko `ScopeMapping` (builder sam tworzy encje `UserGroup`).
  Wektory `bundles/main-static-entities-other-type`, `main-static-entities-group-with-attrs`, `main-schema-mismatch`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.0.0)

## CC-060 | C7 | `PolicyStore`: atomowa podmiana i spójność kanałów

- **Problem (M1):** odbiorca był bezstanowy; konsumenci musieli sami robić atomową podmianę, serializację,
  rewalidację `overrides` po nowej paczce głównej; ten sam `@id` w obu kanałach psuł każdą ocenę.
- **Przyjęty wariant:** `PolicyStore` w `mcp-policy-bundle`: jedna migawka (main + overrides + schemat +
  `EntityBuilder`), aktualizacje serializowane, odczyt bez blokady. `overrides` wymaga załadowanej paczki głównej
  (`main_not_loaded`); rewizje śledzone przez magazyn per kanał; `@id` unikalne między kanałami (`id_conflict`).
  Nowa paczka główna sprzeczna z załadowanymi `overrides` jest odrzucana, a dotychczasowe main i `overrides`
  zostają (fail-closed: zwykła aktualizacja nigdy nie usuwa awaryjnego `forbid`). Wektory `test-vectors/policy-store/`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.0.0)

## CC-061 | C7 | Serwer ocenia każdą wartość każdego `resourceRef`

- **Problem (H4):** po przeniesieniu kontroli zakresów GitLaba na serwer nic nie wymagało oceny wszystkich
  zasobów wywołania (tablice, źródło i cel, kontener przy tworzeniu); serwer oceniający pierwszy argument
  poszerzałby zapis.
- **Przyjęty wariant:** obowiązek serwera (`cedar/entity-builder.md` sekcja 10): `forResource` dla każdej wartości
  każdego argumentu z `resourceRefs` (elementy tablic, źródło i cel), przy tworzeniu także dla kontenera
  docelowego; wywołanie dozwolone tylko, gdy wszystkie oceny dają `allow`. API `ResultFilter.allAllowed`.
  Wektory `test-vectors/resource-checks/` (transfer, tablica), decyzje `srv-transfer-*`. Wczesnej kontroli
  GitLaba na gateway'u nie dodano: wymaga kwantyfikatora "dla każdego" po prefiksach ścieżek, którego Cedar nie ma.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.0.0)

## CC-062 | C7 | Wymagana klasyfikacja zasobu

- **Problem (M5):** projekt Jira bez `category` (atrybut opcjonalny) przechodził `forbid` dla `Restricted`;
  `ResultFilter` przepuszczał takie elementy (fail-open).
- **Przyjęty wariant:** atrybuty klasyfikacji są wymagane: `Jira::Project.category` (`""`, gdy projekt nie ma
  kategorii; teraz wymagany w schemacie Cedar), `Confluence::Space.labels`, `OpenSearch::Index.tags`. Builder
  odmawia zbudowania zasobu (także rodzica) bez nich (`internal_error`), więc `ResultFilter` pomija element.
  GitLab i service desk dostały opcjonalną klasyfikację w CC-057. Wektory `entity-builder/resource-null-attribute`,
  `resource-missing-classification-parent`, `resource-missing-labels`, `result-filter/jira-project-without-category`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.0.0)

## CC-063 | C6 | `definitionHash` i reguły manifestu w Javie

- **Problem (M7):** hash (z `title`) i reguły CC-018/CC-043 istniały tylko w JS; ws-02 i ws-05 musiałyby napisać
  własne wersje.
- **Przyjęty wariant:** nowy moduł `pl.aiwcorpo.mcp:mcp-manifest` (tylko jackson-databind): `CanonicalJson`
  (RFC 8785, liczby jak w ECMAScript), `DefinitionHash`, `ManifestRules`. Testy na wszystkich wektorach
  `definition-hash/` i `manifests/` oraz na 322 liczbach z `test-vectors/canonical-json/numbers.json`, których
  oczekiwane postacie wygenerował silnik JavaScript.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.0.0)

## CC-064 | C4 | `503 upstream_unavailable` we wszystkich operacjach C4

- **Problem (B1):** 503 był opisany tylko przy `resolve`.
- **Przyjęty wariant:** `components/responses/UpstreamUnavailable` we wszystkich operacjach C4 (`PUT secret`,
  `GET systems`, `GET/DELETE connections`, `oauth/*`, `purge`). Stuby WireMock bez zmiany zachowania domyślnego
  (503 tylko przez `Prefer: example=upstream_unavailable`).
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.0.0)

## CC-065 | C7 | Ujemny wiek MFA

- **Problem (LOW-1 przeglądu polityk):** builder przyjmował ujemne `mfaAgeSeconds`, choć schemat JWT ma
  `minimum: 0`; ujemna wartość spełniłaby `context.mfaAge < 3600`.
- **Przyjęty wariant:** builder (JS i Java) odrzuca ujemny wiek MFA (`invalid_argument`). Wektor
  `entity-builder/mfa-negative`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.0.0)

## CC-066 | C7 | Ochrona przed cofnięciem rewizji po restarcie

- **Problem (przegląd 1.2.0, M6):** po restarcie odbiorca nie znał załadowanej rewizji, więc przyjmował dowolną
  starszą, poprawnie podpisaną paczkę.
- **Przyjęty wariant (A):** `PolicyStore` z `Persistence` zapisuje per kanał ostatnią załadowaną rewizję i SHA-256
  archiwum w pliku `policy-bundle-<kanał>.state` w konfigurowalnym katalogu (zapis do pliku tymczasowego i
  atomowe przeniesienie). Po restarcie przyjmuje tylko rewizję nowszą albo tę samą rewizję z tym samym archiwum
  (ponowne załadowanie po starcie); ta sama rewizja z inną treścią to `not_newer`. Konfigurowalna rewizja
  minimalna per kanał (np. po incydencie) nigdy nie jest przekraczana w dół (`below_minimum`). Brak lub
  uszkodzony plik stanu: obowiązuje minimum z konfiguracji, a odbiorca zgłasza ostrzeżenie do audytu
  (`Persistence.warnings`). Błąd zapisu stanu odrzuca aktualizację. Wektory `test-vectors/policy-store/restart-*`,
  `corrupt-state-uses-minimum`, `overrides-below-minimum`, `state-written-per-channel`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.0.0)

## CC-067 | C7 | Normalizacja klasyfikacji

- **Problem (recenzja `mcp-policies`, R1):** systemy zwracają klasyfikację w różnej postaci (`Restricted`,
  `restricted `, `RESTRICTED`); porównanie w Cedar jest dokładne, więc każda odmiana omijała `forbid`.
- **Przyjęty wariant:** entity builder normalizuje wartości klasyfikacji (`Jira::Project.category`,
  `Confluence::Space.labels`, `OpenSearch::Index.tags`, `classification` z CC-057): `trim` (znaki <= U+0020) i
  zamiana tylko liter ASCII na małe, zbiory bez duplikatów. Kontrakt ustala jedną wartość `restricted` dla
  wszystkich systemów; polityki porównują tylko z nią. W połączeniu z CC-062 brak wymaganej klasyfikacji to
  odmowa. Wektory `srv-jira-restricted-*` (`restricted`, `Restricted `, `RESTRICTED`),
  `srv-opensearch-restricted-index`, `entity-builder/classification-normalized`, `classification-wrong-shape`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.0.0)

## CC-068 | C2 | `prv` przed załadowaniem pierwszej paczki polityk

- **Zgłasza:** ws-05
- **Problem:** `prv` jest wymagany w wariancie użytkownika i serwisowym (wzorzec `^[0-9]{14}-[0-9a-f]{7}$`), a
  gateway w M1 nie ładuje paczki C7 (ocena Cedar od M2). Nie ma wartości, która mówi "brak paczki".
- **Wariant w `mcp-gateway` M1:** konfigurowalna wartość `MCP_POLICY_REVISION`, domyślnie
  `00000000000000-0000000` (zgodna ze wzorcem, starsza od każdej prawdziwej rewizji). Od M2 `prv` pochodzi z
  `PolicyStore`, a gateway bez załadowanej paczki nie wstaje (C7), więc wartość zniknie z ruchu.
- **Przyjęty wariant (opisowy):** `00000000000000-0000000` oznacza "gateway bez załadowanej paczki"; odbiorca nie
  może z niej wnioskować o polityce (nie jest to rewizja żadnej paczki i nie porównuje się jej z rewizją
  odbiorcy). Od M2 gateway bez paczki nie wstaje, więc wartość nie pojawia się w ruchu. Opis w
  `common.schema.json` (`PolicyRevision`) i `internal-jwt.schema.json` (`prv`). Zmiana opisowa, wzorzec bez
  zmian (patch).
- **Alternatywa odrzucona:** zakaz wywołań bez paczki także w M1 (walking skeleton wymagałby paczki).
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.1.0)

## CC-069 | C2 | Metody protokołu MCP 2026-07-28 w regułach `tool` i wariantu serwisowego

- **Zgłasza:** ws-05
- **Problem:** reguły C2 (CC-030, CC-033, CC-038) wymieniają metody ery "legacy": `initialize`, `tools/list`,
  `ping`, `GET /mcp-manifest`. Rewizja MCP 2026-07-28 usuwa `initialize` i sesje, dodaje `server/discover`
  (wymagany u serwera) i `subscriptions/listen`, a interakcje serwer -> klient (elicitation, sampling) przenosi do
  wyników `InputRequiredResult` ponawianego `tools/call` (MRTR). Serwer w nowej erze nie ma reguły dla tych
  metod: wektor `tool_not_allowed`/`service_token_not_allowed` nie mówi, czy wariant serwisowy wolno użyć dla
  `server/discover`.
- **Wariant w `mcp-gateway` M1:** po stronie klienta gateway obsługuje obie ery (2026-07-28 i 2025-03-26 ..
  2025-11-25); do serwerów mówi 2025-11-25 (starter na Spring AI 2.0 / MCP SDK 2.0.x zna wersje do 2025-11-25),
  zawsze wariantem użytkownika, `tool` tylko przy `tools/call`.
- **Przyjęty wariant (minor):**
  - `server/discover` jak `initialize`: wariant serwisowy dozwolony, `tool` zabroniony.
  - `subscriptions/listen` bez `tool`, tylko wariant użytkownika (wariant serwisowy: `service_token_not_allowed`).
  - Ponowienie `tools/call` z `inputResponses` (MRTR) jest zwykłym `tools/call`: nowy JWT, `tool` == `params.name`.
  - Wektory `jwt/valid-service-discover`, `jwt/valid-user-variant-discover`, `jwt/user-variant-discover-with-tool`,
    `jwt/valid-user-variant-subscriptions-listen`, `jwt/user-variant-subscriptions-listen-with-tool`,
    `jwt/service-variant-subscriptions-listen`, `jwt/valid-tools-call-input-responses`.
  - C11: w erze 2026-07-28 kanał "elicitation URL" to `InputRequiredResult` z żądaniem elicitation w trybie URL;
    semantyka potwierdzenia bez zmian (opis w README, sekcja "Metody MCP i JWT").
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.1.0)

## CC-070 | C2 | Wariant serwisowy a `notifications/*` i żądania transportu (GET/DELETE sesji)

- **Zgłasza:** ws-02
- **Problem:** C2 dopuszcza wariant serwisowy wyłącznie dla `initialize`, `tools/list`, `ping` i
  `GET /mcp-manifest`. Klient MCP po `initialize` wysyła `notifications/initialized`, w transporcie streamable HTTP
  otwiera `GET` (strumień SSE) i kończy sesję `DELETE`; żadne z nich nie ma metody z listy. Gateway, który zrobi
  `tools/list` wariantem serwisowym (np. przy starcie, bez użytkownika), dostanie 401 na `notifications/initialized`
  i jego klient MCP może uznać sesję za zepsutą. Nie ma wektora dla tych żądań.
- **Wariant w `mcp-starter-lib` 3.0.0-alpha-1:** dosłownie według C2: wariant serwisowy tylko dla czterech
  wymienionych żądań, wszystko inne (także `notifications/*`, odpowiedzi JSON-RPC, `GET`/`DELETE` sesji) tylko
  wariantem użytkownika, bez `tool`. Działa z wariantem ws-05 (gateway zawsze wariantem użytkownika, CC wyżej).
- **Przyjęty wariant (zmieniona forma propozycji):** lista metod wariantu serwisowego bez zmian (poza
  `server/discover` z CC-069). `notifications/*` i `GET`/`DELETE` na endpoincie MCP nie dostają wariantu
  serwisowego. Reguła: wariant serwisowy jest używany wyłącznie bez sesji (bezstanowo); wszystkie żądania w
  ramach sesji (`notifications/initialized`, `notifications/cancelled`, `GET` strumienia, `DELETE` sesji, odpowiedzi
  JSON-RPC) idą wariantem użytkownika. Wektor `jwt/service-variant-other-notification` (odrzucenie
  `service_token_not_allowed`) pilnuje, że odbiorca nie rozszerza listy.
- **Alternatywa odrzucona:** dopuszczenie wariantu serwisowego dla `notifications/initialized`,
  `notifications/cancelled`, `GET` i `DELETE`.
- **Status:** accepted w zmienionej formie (decyzja: człowiek, 2026-10-27, wydanie 2.1.0)

## CC-071 | C8 | Zdarzenie audytu dla odrzuconego uwierzytelnienia na serwerze

- **Zgłasza:** ws-02
- **Problem:** serwer odrzuca żądania bez poprawnego wewnętrznego JWT (401) i bez certyfikatu gateway'a, ale C8
  nie ma typu zdarzenia na nieudane uwierzytelnienie (`event` to `tool_call`, `policy_decision`, ...). Próby
  ominięcia gateway'a (niezmiennik 3) są ważnym sygnałem dla SIEM, a teraz trafiają tylko do zwykłego logu
  aplikacji (`event=internal_jwt_rejected reason=<kod wektora>`).
- **Wariant w `mcp-starter-lib` 3.0.0-alpha-1:** linia logu aplikacji (WARN) z powodem, metodą, ścieżką i
  `requestId`; bez zdarzenia C8. `tool_call` z `outcome: denied`, `errorCode: unauthenticated` jest emitowany
  tylko wtedy, gdy narzędzie zostało wywołane bez powiązanego wywołującego.
- **Przyjęty wariant (minor):** nowa wartość `event: "authentication"` z `outcome: "denied"`, `reason` = kod
  odrzucenia z wektorów JWT (`bad_signature`, `replayed_jti`, ...), bez `sub` (niezweryfikowany) i bez treści
  tokenu. Schemat `audit-event.schema.json` wymusza `outcome: denied`, wymaga `reason` i ogranicza zdarzenie do zamkniętej listy pól (bez `sub`, `username`, `client`, `tool` i innych pól z claimów niezweryfikowanego tokenu);
  `requestId` jest nadal wymagany (generowany przez odbiorcę, gdy żądanie go nie niesie). Wektory
  `audit-events/server-authentication-denied` oraz dwa odrzucane (`invalid-authentication-with-sub`,
  `invalid-authentication-outcome-ok`).
- **Uwaga SemVer:** nowa wartość enum jest według tabeli w README zmianą major; wydanie jako 2.1.0 to wyraźna
  decyzja człowieka. Odbiorcy walidujący `event` zamkniętą listą (SIEM, testy) muszą dodać `authentication`
  przed aktualizacją producentów.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.1.0)

## CC-072 | C10/C6 | Wspólne oznaczenie treści z systemu w wynikach narzędzi

- **Zgłasza:** ws-04 (mcp-confluence)
- **Problem:** brief ws-04 wymaga, żeby treść z systemu w wynikach była "oznaczona jako dane (nie instrukcje)",
  ale kontrakt nie ma na to kształtu. Każdy serwer wymyśli własny (pole, nazwa, wartości), więc gateway, klienci
  i testy ws-10 nie mogą tego sprawdzać jedną regułą, a różnica między serwerami nie trafia do `definitionHash`
  w przewidywalny sposób (wynik nie ma `outputSchema`).
- **Wariant w `mcp-server-confluence` M1:** `get_page` zwraca treść strony w obiekcie
  `body: {kind: "untrusted-data", format: "text/plain", text, omittedMacros, truncated}`; tytuły i pozostałe pola
  z systemu są zwykłymi polami.
- **Przyjęty wariant (minor):** w `common.schema.json` definicja `UntrustedText`: `kind` = const
  `"untrusted-data"`, `format` z zamkniętej listy `text/plain` | `text/markdown`, `text`, `truncated`; pola
  dodatkowe per system dozwolone (np. `omittedMacros`). Serwery stosują ją dla każdej treści swobodnej z systemu
  (opis strony, komentarz, treść zgłoszenia, wiersz logu). Zalecenie: narzędzie zwracające taką treść deklaruje
  `outputSchema` odwołujące się do kształtu `UntrustedText`, żeby kształt wyniku był objęty `definitionHash`
  (pole `outputSchema` już wchodzi do hasha, CC-004). Wektory `untrusted-text/`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.1.0)

## CC-073 | C4.1 | Whoami Confluence Data Center

- **Zgłasza:** ws-04 (mcp-confluence)
- **Problem:** C4.1 podaje dla Jiry i Confluence ten sam endpoint weryfikacji tożsamości `/rest/api/2/myself`.
  To endpoint REST API Jiry; Confluence Data Center nie ma `/rest/api/2/...`, a bieżącego użytkownika zwraca
  `GET /rest/api/user/current` (pola `username`, `userKey`, `displayName`; dla tokenu bez dostępu 401). Broker
  zbudowany dosłownie według C4.1 odrzuci każdy poprawny PAT Confluence jako `secret_invalid`.
- **Przyjęty wariant (patch):** C4.1: Jira `GET /rest/api/2/myself` (porównanie po `name`, bez zmian), Confluence
  `GET /rest/api/user/current` (porównanie po `username`). Opis w `credential-broker.v1.yaml` i README, sekcja
  "Whoami (C4.1)".
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.1.0)

## CC-074 | C7 | `OpenSearchIndexName` bez wiodącej kropki (indeksy ukryte i systemowe)

- **Zgłasza:** ws-04 (mcp-opensearch)
- **Problem:** `OpenSearchIndexName` (`^(?!\.{1,2}$)[a-z0-9.][a-z0-9._-]{0,254}$`) przyjmuje nazwy zaczynające
  się od `.`: `.security`, `.kibana`, `.opendistro_security`, `.ds-<strumień>-000001`. To indeksy ukryte i
  systemowe; żadne narzędzie platformy nie powinno ich adresować, a prefiks `OpenSearchIndexPrefix` z wiodącą
  kropką (np. `.ds-logs`) dałby grant na indeksy zapasowe strumieni danych z pominięciem nazwy strumienia.
- **Wariant w `mcp-server-opensearch` M1:** serwer odrzuca wiodącą kropkę w argumentach (`invalid_argument`) i w
  konfiguracji prefiksów (brak startu), mimo że wzorzec kontraktu ją przyjmuje; indeksy z atrybutem `hidden` z
  `_resolve/index` dają `not_found_or_denied`.
- **Przyjęty wariant (zawężenie wzorca):** `OpenSearchIndexName` = `^[a-z0-9][a-z0-9._-]{0,254}$`,
  `OpenSearchIndexPrefix` = `^[a-z0-9][a-z0-9._-]{0,253}[a-z0-9_]$|^[a-z0-9]$`; zmiana we wszystkich miejscach
  (schemat, `ResourceIds`, `entity-builder.md`, bundled OpenAPI). Wektory: `resource-ids/opensearch-index` i
  `opensearch-prefix` (`.security`, `.ds-logs-000001`, `.ds-logs` jako niepoprawne), `entity-builder/
  resolved-resource-invalid-id-security` i `-data-stream`, `refs-opensearch-index-leading-dot`. Strumienie danych
  jako osobna decyzja w M2 (zasób = nazwa strumienia, nie indeks zapasowy).
- **Uwaga SemVer:** zaostrzenie walidacji jest według tabeli w README zmianą major; wydanie jako 2.1.0 to wyraźna
  decyzja człowieka. Wcześniej poprawne konfiguracje z wiodącą kropką (`opensearchIndexPrefixes` w
  `resourceDefaults`, `vsc`, `static.json`) przestają przechodzić walidację.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.1.0)

## CC-075 | C6 | `ticketId` w wektorze `valid-servicedesk-service-account` niezgodny z `ServiceDeskTicketId`

- **Zgłasza:** ws-04 (mcp-servicedesk)
- **Problem:** `test-vectors/manifests/valid-servicedesk-service-account.json` deklaruje `get_ticket` z
  `ticketId: {"type": "integer", "minimum": 1}`, a `ResourceIdPatterns` każe dla `ServiceDesk::Ticket` stosować
  `ServiceDeskTicketId` (string, `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`). Serwer zbudowany według wektora przyjmie
  liczbę, której builder potem nie dopasuje do wzorca, a serwer według wzorca ma inny schemat i inny
  `definitionHash` niż wektor. Ten sam wektor ma `internalUrl` `.../mcp/servicedesk`, a serwery z template'u
  słuchają na `/mcp` (README gateway'a: `internal-url: .../mcp`).
- **Wariant w `mcp-server-servicedesk` M1:** `ticketId` i `queue` jako string ze wzorcem z `common.schema.json`,
  `minLength` 1, `maxLength` 64, `additionalProperties: false`; endpoint `/mcp`.
- **Przyjęty wariant (patch):** w wektorze `ticketId` jako `{"type": "string", "pattern": <ServiceDeskTicketId>}`,
  `internalUrl` `https://mcp-servicedesk.internal:8443/mcp`, przeliczony `definitionHash`.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.1.0)

## CC-076 | C7 | Konto serwisowe: zakres kolejek wymagany, brak zakresu = odmowa

- **Zgłasza:** ws-04 (mcp-servicedesk)
- **Problem:** przy `service-account` (D10) service desk nie zna użytkownika i zwraca wszystko, co widzi konto
  platformy. Kontrakt nie mówi, co serwer robi, gdy dla takiego wywołania nie ma zakresu kolejek (brak
  `vsc`, brak grantu w paczce, M1 bez Cedar): czy to "bez ograniczeń", czy odmowa. Gateway, polityki i serwer
  mogą to rozumieć różnie, a pomyłka otwiera wszystkie kolejki.
- **Wariant w `mcp-server-servicedesk` M1:** fail-closed. Lista kolejek z konfiguracji serwera
  (`MCP_SERVICEDESK_ALLOWED_QUEUES`); pusta lista w trybie `service-account` = `not_found_or_denied` dla
  wszystkiego bez wołania systemu. Poświadczenie z `X-MCP-Credential-Type: service-account` jest trzymane listą
  także, gdy serwer skonfigurowano na `user-secret`. Kolejka oceniana na wartości zwróconej przez system w
  chwili wywołania (zgłoszenie przeniesione = nowa kolejka), nie na argumencie.
- **Przyjęty wariant (minor):** w C7 zdanie: "Dla poświadczenia `service-account` serwer ocenia każdy zasób
  `ServiceDesk::*` względem kolejki zwróconej przez system; brak grantu kolejki w paczce i w konfiguracji
  serwera = odmowa (niezmiennik 6)". Wektory `srv-servicedesk-service-account-no-queue-grant` (deny) i
  `srv-servicedesk-ticket-moved-out-of-granted-queue` (deny) są w `test-vectors/servicedesk-service-account/`, nie
  w `policy-decisions/`: model Cedar nie niesie typu poświadczenia, a przykładowa polityka `servicedesk-read`
  (zasób czytany według własnych praw użytkownika w systemie) nie wymaga grantu kolejki, więc decyzja Cedar nie
  odróżni konta serwisowego bez zmiany `mcp.cedarschema` (zamrożony w 2.x). Reguła jest egzekwowana przez serwer
  przed Cedar; referencyjna implementacja w testach Node. Pytanie, czy lista z konfiguracji serwera zostaje po
  M3 jako dodatkowe zawężenie, czy znika na rzecz paczki, pozostaje otwarte (do planowania M3).
- **Dopisek (CC-163, 2026-10-29):** lista kolejek z konfiguracji serwera przestaje być źródłem grantów; jedynym źródłem jest paczka polityk.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.1.0)

## CC-078 | C6/C10 | `inputSchema` zamknięty i walidowany przez serwer; treść `invalid_argument` przy naruszeniu schematu

- **Zgłasza:** ws-02 (mcp-starter-lib 3.0.0-alpha-6)
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-28; rozszerzone w CC-123). Wdrożone w 3.0.0 (wersja robocza): reguły `input-schema-closed`, `input-schema-bounded`, `input-schema-no-combinators`, zdanie o `invalid_argument` w C10, wektory manifestów.
- **Problem:** MCP SDK 2.0.x waliduje argumenty względem `inputSchema` przed audytem serwera i odpowiada tekstem
  spoza C10 (`Tool (x) input validation failed`), bez zdarzenia C8. Kontrakt nie wymaga ani zamkniętego schematu
  (`additionalProperties: false`), ani określonej treści `invalid_argument` przy naruszeniu schematu, więc
  gateway (walidujący argumenty względem schematu z manifestu) i serwer mogą się rozjechać co do tego, co jest
  poprawne, a serwer bez zamkniętego schematu przepuści nieznane argumenty.
- **Wariant w starterze alpha-6:** serwer wyłącza walidację SDK i sam waliduje argumenty względem `inputSchema`
  (JSON Schema 2020-12) w opakowaniu audytu; poza profilem `dev` brak schematu albo schemat bez `type: object`
  i `additionalProperties: false` zatrzymuje start. Odpowiedź: C10 `invalid_argument`, komunikat z nazwą
  argumentu (tylko zadeklarowanego w schemacie) i regułą, bez wartości argumentu i bez nazw spoza schematu;
  zdarzenie C8 `tool_call` z `outcome=error`, `errorCode=invalid_argument`.
- **Propozycja (minor):** (1) w `server-manifest.schema.json` `definition.inputSchema` wymaga `type: object` i
  `additionalProperties: false` na poziomie głównym (reguła semantyczna lub schemat); (2) w C10 zdanie: "przy
  naruszeniu `inputSchema` serwer zwraca `invalid_argument`; komunikat może wskazać argument zadeklarowany w
  schemacie i naruszoną regułę, nigdy wartość argumentu ani nazwę niezadeklarowaną"; (3) wektor w
  `test-vectors` dla odrzuconego manifestu bez zamkniętego schematu.

## CC-079 | C6 | Nazwy `$defs` w `common.schema.json` jako stabilne API dla serwerów

- **Zgłasza:** ws-02 (mcp-starter-lib 3.0.0-alpha-6)
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-28). Wdrożone w 3.0.0 (wersja robocza): lista w README, test pilnujący kompletności; wzorce `pattern` zgodne z `ResourceIds` (wektory `resource-ids/`).
- **Problem:** serwery kopiowały wzorce identyfikatorów (`JiraIssueKey`, `GitLabProjectPath`, ...) do własnych
  stałych. Starter publikuje teraz `@ArgumentLimits(contractPattern = "<nazwa $defs>")`, które czyta `pattern` i
  `maxLength` z `common.schema.json` jara kontraktów w chwili rejestracji narzędzia. Zmiana nazwy albo usunięcie
  definicji zatrzymałoby start serwerów.
- **Propozycja:** w README kontraktów lista definicji używanych przez serwery (`Jira*`, `Confluence*`,
  `GitLab*`, `OpenSearch*`, `ServiceDesk*`) jako stabilnych w linii 2.x; zmiana nazwy lub usunięcie = major. Do
  decyzji, czy `pattern` definicji ma obejmować to, co `ResourceIds` w `mcp-cedar-entities` (patrz CC-074: różnica
  w `OpenSearchIndexName`).

## CC-077 | C11/C5/C12 | Kanał kodu domyślny dla wszystkich klientów

- **Zgłasza:** człowiek (decyzja 2026-10-27, po przeglądzie makiet portalu)
- **Problem:** C11 dopuszcza potwierdzenie przez elicitation (kanał 1) albo kod (kanał 2), a makieta portalu
  zakładała zatwierdzanie samym step-up MFA bez pokazania argumentów. Zatwierdzenie bez widocznych argumentów nie
  chroni przed podmianą wywołania, a elicitation nie jest dostępne u wszystkich klientów.
- **Przyjęty wariant (minor):** kanał kodu jest domyślny dla wszystkich klientów:
  1. Agent wywołuje narzędzie wymagające potwierdzenia, gateway odpowiada `confirmation_required`
     `{confirmationId, confirmUrl}`.
  2. Człowiek otwiera `confirmUrl`; portal pokazuje narzędzie, system i argumenty (obcięte, z oznaczeniem)
     pobrane z gateway'a po `confirmationId` (`GET /api/v1/confirmations/{id}`, `ConfirmationView` z nowym polem
     `system`), nigdy od klienta.
  3. "Zatwierdź" wymaga świeżego MFA (istniejące `stepUpUrl` i `mfaFreshUntil`).
  4. Po MFA `POST /api/v1/confirmations/{id}` (C5 `decideConfirmation`) zwraca `200 ConfirmationOutcome` z
     jednorazowym kodem (`ConfirmationCode`, 6 cyfr), `codeExpiresAt` i `attemptsLeft`; wcześniej odpowiedź to
     `204` bez treści. Odrzucenie zwraca `200` bez kodu. Kod jest związany z (`sub`, `serverId`, `tool`, SHA-256
     kanonicznych argumentów bez `confirmation_code`), TTL 120 s, 3 próby, jednorazowy.
  5. Człowiek wkleja kod w sesji klienta MCP, agent ponawia wywołanie z tymi samymi argumentami i
     `confirmation_code`, gateway sprawdza powiązanie. Zatwierdzenie samo nie wykonuje akcji.
  Elicitation URL (kanał 1) może jedynie otwierać ten sam `confirmUrl`. SPI `ConfirmationCodeSender` zostaje jako
  opcjonalny kanał dostarczenia kodu poza modelem. Odrzucone: zatwierdzanie samym MFA bez pokazania argumentów.
  Wektory `confirmation-binding/` (12), referencyjna kontrola w testach Node.
- **Uwaga SemVer:** status odpowiedzi POST zmienia się z 204 na 200 i `system` wchodzi do wymaganych pól widoku;
  według tabeli w README to zmiana niezgodna dla klientów generowanych z 2.0.x, wydana jako minor na decyzję
  człowieka (endpoint nie był jeszcze używany przez żaden komponent poza mockami).
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.1.0)

---

## CC-080 ... CC-098 (decyzje człowieka z 2026-10-27)

Decyzje człowieka z 2026-10-27: CC-080 ... CC-090 `accepted`, wydanie 2.2.0 (CC-085 formalnie major, brak
konsumentów, adnotacja w `CHANGELOG.md`); CC-091 ... CC-094 i CC-098 `accepted-for-3.0.0` (pivot potwierdzeń,
wydanie 3.0.0 przed M3, nie w 2.2.0); CC-095 ... CC-097 nadal `proposed` (kamienie M3/M4). Szkice YAML/JSON we
wpisach CC-091 ... CC-098 są projektami do wydania 3.0.0 albo późniejszego. Źródła: tabela decyzji w
`mcp-platform-plan/STATUS.md`, analiza luk `mcp-platform-plan/design/luki-api-makiety.md` (G-01 ... G-25) i pivot
potwierdzeń. Wpisy nie zmieniają tekstu CC-034, CC-048, CC-053 ani CC-077; zakres, w jakim je zastępuje pivot,
opisuje CC-091.

| CC | Tytuł | Źródło | Kamień | SemVer (wg README) |
| --- | --- | --- | --- | --- |
| CC-080 | `credential` i `connection` w wierszu katalogu | G-01 | M2 | minor |
| CC-081 | `disabled` i `requiresConfirmation` w `CatalogTool` | G-02 | M2 | minor |
| CC-082 | `title` w `CatalogTool` | G-03 | M2 | minor |
| CC-083 | Tabela status -> `actions[]` | G-04 | M2 | patch |
| CC-084 | `400 expires_at_invalid` przy zapisie tokenu | G-05 | M2 | minor |
| CC-085 | `resourceDefaults` uśpione: `400 resource_defaults_unsupported` | G-09 (zmienione) | M2 | formalnie major (zaostrzenie walidacji), skutek zerowy |
| CC-086 | `ConnectErrorCode` z `cancelled`, callback OAuth bez sesji | G-20 | M2 | minor |
| CC-087 | `X-Request-Id` na każdej odpowiedzi BFF, `Error.requestId` | G-21 | M2 | minor |
| CC-088 | `enabled` w `RegistryServer` | G-25 | M2 (decyzja człowieka; analiza: M4) | minor |
| CC-089 | Jedna domena: reverse proxy przed web, BFF i gateway'em | decyzja człowieka | M2 | patch (opisy, przykłady) |
| CC-090 | Zapis PAT bez step-up MFA | decyzja człowieka | M2 | minor (łagodzenie) |
| CC-091 | Potwierdzenia kodem TOTP z aplikacji (C11, C10, C5, C12) | pivot | M3 | major dla C11 |
| CC-092 | Broker: rejestracja i weryfikacja Authenticatora (C4) | pivot | M3 | minor (część pakietu major) |
| CC-093 | BFF: rejestracja Authenticatora ze step-up MFA (C12) | pivot | M3 (ekran rejestracji od M2/M3) | minor (część pakietu major) |
| CC-094 | Audyt C8 dla Authenticatora | pivot | M3 | major, jeśli nowy `event`; minor w wariancie bez |
| CC-095 | `GET /api/v1/activity/calls` i `ActivityCall` | G-11, G-12, G-13 | 3.0.0 | minor |
| CC-096 | Odpowiedzi błędów wniosków o dostęp | G-19 | M4 | minor |
| CC-097 | `change` i wersje w rejestrze (przed/po) | G-23 | M4 | minor |
| CC-098 | `resource` w `ConfirmationView` | G-17 | M3 | minor |
| CC-124 | 503 `upstream_unavailable` przy niedostępnym JWKS (C1) | gateway, propozycja 9 | 3.0.0 | zmiana zachowania |
| CC-125 | Audyt odrzuceń mTLS i tokenów BFF na porcie C5; `replay_store_unavailable` tylko u odbiorców JWT | gateway, propozycja 8 | 3.0.0 | major (zaostrzenie) |
| CC-126 | Dzienny limit błędnych kodów TOTP: stan `disabled` | przegląd bezpieczeństwa | 3.0.0 | major (nowa wartość enum) |
| CC-127 | Jedna oczekująca operacja DESTRUCTIVE, `confirmation_superseded`, `confirmation_blocked` | przegląd bezpieczeństwa | 3.0.0 | major (nowa wartość enum) |
| CC-128 | Anulowanie oczekującej operacji przez właściciela, `confirmation_cancelled` | N-M1 przeglądu delty | 3.0.0 | major (nowa wartość enum) |

Podział wydań (rekomendacja ws-00): **2.2.0** dla M2 = CC-080 ... CC-090 (CC-085 z udokumentowanym wyjątkiem, jak
w 2.1.0), bo ws-08 startuje na MSW od 2.2.0; **3.0.0** przed startem M3 = pakiet pivotu CC-091 ... CC-094 razem z
CC-098 (powody w CC-091); CC-095 ... CC-097 wchodzą z kamieniami M3/M4 do najbliższego wydania. Bez wpisu (decyzja
nie dotyka kontraktu): G-24 (przycisk "Odrzuć" usunięty z administracji, brak endpointu), narzędzie `delete_issue`
w `mcp-server-jira` (brief ws-04; `Jira::Issue`, `mcp-jira-destructive` i wektory z `delete_issue` istnieją już w
2.1.1, więc nic nie wymaga zmiany w kontrakcie), G-06, G-07 (pole z identyfikatorami, bez listowania), G-08, G-10,
G-15, G-16, G-18, G-22.

---

## CC-080 | C12 | `credential` i `connection` w wierszu katalogu portalu

- **Zgłasza:** analiza luk G-01; kierunek zatwierdzony przez człowieka 2026-10-27
- **Kamień:** M2, wydanie 2.2.0
- **Problem:** `GET /api/v1/catalog` nie niesie typu logowania systemu ani danych połączenia. `GET /connections`
  zwraca tylko systemy z połączeniem, więc dla "Niepołączone", "Wniosek oczekuje" i "Brak uprawnienia" nie ma
  kolumny "Sposób" (OAuth / token PAT), a baner po powrocie z OAuth ("Połączono jako anna.nowak") potrzebuje
  `backendUser`. Dwa wywołania z łączeniem we frontendzie mogą dać niespójny obraz (CC-050 wymaga całości albo 503).
- **Wariant:** BFF dokłada do `PortalCatalogServer` opcjonalne `credential` (z C4 `GET /v1/systems`) i `connection`
  (z C4 `GET /v1/connections`); obie odpowiedzi BFF już zbiera do wyliczenia `status`. Żadnego sekretu: `connection`
  ma kształt `Connection` z C4. Dla systemów bez niczego do połączenia (`service-account`, `token-exchange`)
  `connection` jest `null`.
- **Alternatywy:** (a) dwa wywołania i słownik typów we frontendzie (rozjeżdża się z konfiguracją brokera);
  (b) osobny `GET /api/v1/systems` (trzeci request na ekran, brak zalet).
- **Zmiany plików:**
  - `openapi/portal-bff.v1.yaml`, `components.schemas`:

```yaml
    CatalogCredential:
      type: object
      description: Credential types of the system (C4 GET /v1/systems).
      required: [supportedTypes, defaultType]
      properties:
        supportedTypes:
          type: array
          minItems: 1
          uniqueItems: true
          items:
            $ref: '../schemas/common.schema.json#/$defs/CredentialType'
        defaultType:
          $ref: '../schemas/common.schema.json#/$defs/CredentialType'
      additionalProperties: false
    PortalCatalogServer:
      properties:
        credential:
          $ref: '#/components/schemas/CatalogCredential'
        connection:
          description: The current user's connection to the system (C4 GET /v1/connections). null when there is none or when nothing is to be connected (service-account, token-exchange). Never contains a secret value.
          oneOf:
            - $ref: 'credential-broker.v1.yaml#/components/schemas/Connection'
            - type: 'null'
```

  - Pola poza `required`. Przykłady `getPortalCatalog` i MSW (`portal-bff.examples.ts`) dostają `credential` i
    `connection` dla każdego z sześciu statusów; `mocks/wiremock` bez zmian (C5 nie zmienia się).
  - README: zdanie w opisie katalogu, że `credential` i `connection` pochodzą z jednego, spójnego odczytu C4.
- **Wektory / testy:** brak nowych plików wektorów; test przykładów OpenAPI (`openapi-examples.test.mjs`) obejmuje
  nowe przykłady; test MSW sprawdza, że dla `service-account` `connection` jest `null`.
- **SemVer:** minor (nowe pola opcjonalne). Uczynienie ich wymaganymi kiedyś = major.
- **Wpływ na strumienie:** ws-07 (zlepia dane, które już ma), ws-08 (kolumna "Sposób", baner z `backendUser`);
  ws-05 i ws-06 bez zmian.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.2.0)

## CC-081 | C5/C12 | `disabled` i `requiresConfirmation` w `CatalogTool`

- **Zgłasza:** analiza luk G-02; kierunek zatwierdzony przez człowieka 2026-10-27
- **Kamień:** M2, wydanie 2.2.0
- **Problem:** `CatalogTool.access` ma tylko `granted` i `denied`. Kreator linków (makieta 12) pokazuje powód
  niedostępności "wyłączone przez administratora" i dopisek, że użycie wymaga potwierdzenia. Pierwszy powód nie ma
  źródła w katalogu (C10 zna `tool_disabled`), drugi wynika z `risk` tylko częściowo (ws-05 pkt 7 dopuszcza
  potwierdzenie także dla narzędzi wskazanych polityką).
- **Wariant:** dwa opcjonalne pola w C5 `CatalogTool` (C12 dziedziczy przez `$ref`), liczone przez gateway.
  Enum `Access` bez zmian (nowa wartość = major). W M2 `disabled` wynika z konfiguracji serwera i hasha
  oczekującego na zatwierdzenie; źródło `overrides` Cedar dochodzi w M3 i M4.
- **Zależność od pivotu (CC-091):** znaczenie `requiresConfirmation` jest neutralne wobec źródła kodu ("każde
  wywołanie wymaga potwierdzenia kodem wg C11"), więc pole przeżywa pivot bez zmian. Zmienia się tylko tekst
  ekranu ("kod z aplikacji Authenticator", a nie "kod z portalu") i to, że użytkownik bez zarejestrowanego
  Authenticatora nie wykona takiego narzędzia (stan rejestracji: CC-093, `GET /api/v1/authenticator`). Opis pola
  w YAML nie wymienia kanału kodu, żeby nie trzeba było go zmieniać po decyzji o CC-091.
- **Alternatywy:** (a) usunąć wiersz "wyłączone" z makiety (użytkownik nie wie, czemu narzędzie zniknęło);
  (b) `requiresConfirmation` z `risk === DESTRUCTIVE` we frontendzie (nie pokrywa potwierdzeń z polityki).
- **Zmiany plików:** `openapi/gateway-admin.v1.yaml`, `components.schemas.CatalogTool.properties`:

```yaml
        disabled:
          type: boolean
          default: false
          description: True when an administrator disabled the tool or its server (C10 tool_disabled; a hash pending approval counts). A disabled tool cannot be added to a virtual server (POST /virtual-servers answers 403 access_denied).
        requiresConfirmation:
          type: boolean
          default: false
          description: True when every call needs a confirmation (C11): risk DESTRUCTIVE or a policy requires it. Computed by the gateway.
```

  Przykłady C5, C12 (`getCatalog`, `getPortalCatalog`) i mocki (WireMock `getCatalog.json`, MSW) z `jira__delete_issue`
  jako `requiresConfirmation: true`.
- **Wektory / testy:** brak plików wektorów; test przykładów; reguła Spectral (opcjonalna): `requiresConfirmation`
  nie może być `false` przy `risk: DESTRUCTIVE` w przykładach.
- **SemVer:** minor.
- **Wpływ na strumienie:** ws-05 (źródło obu pól), ws-07 (przezroczyste), ws-08 (stany w kreatorze), ws-09
  (jeśli polityka ma wskazywać narzędzia wymagające potwierdzenia, potrzebne źródło w paczce; poza kontraktem).
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.2.0)

## CC-082 | C5/C12 | `title` w `CatalogTool`

- **Zgłasza:** analiza luk G-03; kierunek zatwierdzony przez człowieka 2026-10-27
- **Kamień:** M2, wydanie 2.2.0
- **Problem:** `CatalogTool.description` to tekst dla modelu (angielski, techniczny). Makiety mają krótkie polskie
  etykiety ("Wyszukiwanie zgłoszeń (JQL)"). Zatwierdzona definicja ma `definition.title` (wchodzi do
  `definitionHash`, CC-042), którego katalog nie przekazuje.
- **Wariant:** opcjonalne `CatalogTool.title` z `definition.title` zatwierdzonego wpisu. Serwery ws-04 wystawiają
  tytuły (po polsku, jeśli taka jest decyzja produktowa). Tytuł jest przypięty hashem, więc UI nie pokaże tekstu,
  którego nikt nie zatwierdził. Brak tytułu: UI pokazuje `description`.
- **Alternatywy:** (a) słownik etykiet we frontendzie (nowe narzędzie czeka na wydanie frontendu); (b) makieta po
  angielsku.
- **Zmiany plików:** `openapi/gateway-admin.v1.yaml`, `CatalogTool.properties`:

```yaml
        title:
          type: string
          minLength: 1
          description: definition.title of the approved manifest entry (CC-042), a short display name for the UI. Absent when the tool has no title; the UI then falls back to description.
```

  Bez `maxLength`, bo `title` w `server-manifest.schema.json` ma tylko `minLength: 1`; dopisanie limitu do
  manifestu byłoby zaostrzeniem walidacji (major), więc UI obcina długi tytuł po swojej stronie. Przykłady i
  mocki z `title`.
- **Wektory / testy:** test przykładów; test, że wartość `title` w katalogu (mock) jest identyczna z
  `definition.title` zatwierdzonego wpisu w przykładzie rejestru.
- **SemVer:** minor.
- **Wpływ na strumienie:** ws-05 (przekazanie z rejestru), ws-04 (tytuły narzędzi i test manifestu), ws-08.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.2.0)

## CC-083 | C12 | Reguła status -> `actions[]` w katalogu

- **Zgłasza:** analiza luk G-04; kierunek zatwierdzony przez człowieka 2026-10-27
- **Kamień:** M2, wydanie 2.2.0
- **Problem:** C12 podaje enum `CatalogAction`, ale nie mówi, które akcje dostaje każdy status (przykład w YAML ma
  tylko `connected`). Implementacja BFF i mock MSW mogą się rozjechać; makieta pokazuje "Odnów", "Połącz",
  "Dodaj token" i "-" przy "Wniosek oczekuje".
- **Wariant:** tabela w opisie `getPortalCatalog` plus przykład MSW dla każdego statusu. `actions[]` jest
  jedynym źródłem tego, co UI może zaoferować (ws-07 pkt 3). Dla `request_pending` akcja `view_request` (link
  "Zobacz wniosek"), nie "-". Po CC-090 `add_secret` nie wymaga step-up MFA.
- **Alternatywa:** frontend wylicza akcje ze statusu i `credential` (logika zdublowana, `actions[]` traci sens).
- **Zmiany plików:** `openapi/portal-bff.v1.yaml`, opis `getPortalCatalog` (po liście reguł statusu):

```yaml
        Actions per status (the BFF returns exactly these; `credential.supportedTypes` of CC-080 decides the type):
          connected            -> copy_link, disconnect (+ request_access when some tool of the server is denied)
          expiring             -> copy_link, add_secret (user-secret) or reconnect (user-oauth), disconnect
          reconnect_required   -> reconnect (user-oauth) or add_secret (user-secret), disconnect
          not_connected        -> connect_oauth and/or add_secret, one per type in credential.supportedTypes
          request_pending      -> view_request
          no_access            -> request_access
```

  W `connected` bez `disconnect`, gdy system nie ma niczego do rozłączenia (`service-account`, `token-exchange`).
  Przykłady MSW: po jednym serwerze na każdy status.
- **Wektory / testy:** nowy plik `test-vectors/catalog-actions/*.json` (wejście: status, `credential`, czy są
  odmowy; oczekiwanie: lista `actions`) i referencyjna kontrola w teście Node, żeby BFF i mock miały jedną tabelę.
  Wektory są nowe, więc nie zmieniają istniejących oczekiwań.
- **SemVer:** patch (opis, przykłady, nowe wektory zgodne ze schematem).
- **Wpływ na strumienie:** ws-07 (wyliczanie), ws-08 (renderowanie akcji bez własnej logiki).
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.2.0)

## CC-084 | C4/C12 | Data ważności tokenu jest opcjonalną informacją (bez walidacji)

- **Zmiana decyzją człowieka (2026-10-28, wydanie 2.2.1):** datę ważności PAT ustawia się w systemie docelowym, więc
  pole `expiresAt` w portalu jest tylko opcjonalną informacją. Walidacja (przyszłość, limit 366 dni) i odpowiedź
  `400 expires_at_invalid`, dodane w 2.2.0, są **usunięte**. Broker przyjmuje każdą poprawną datę (`Timestamp`)
  albo brak pola; status `expiring` (< 7 dni) działa tylko przy podanej dacie; tekst "Oznaczymy token jako
  wygasający 7 dni przed terminem" zostaje warunkowo (tylko gdy użytkownik podał datę). Wektory `secret-expiry/`
  usunięte. Usunięcie odpowiedzi dodanej w 2.2.0 wydane jako patch na decyzję człowieka (brak konsumentów, adnotacja w
  `CHANGELOG.md` jak przy CC-085). To zamyka uwagę M-3 z przeglądu 2.2.0 (zaostrzenie walidacji bez adnotacji).
- Poniższy opis jest zachowany jako historia wersji 2.2.0.

- **Zgłasza:** analiza luk G-05; kierunek zatwierdzony przez człowieka 2026-10-27
- **Kamień:** M2, wydanie 2.2.0
- **Problem:** `PutSecretRequest.expiresAt` istnieje, ale zła data (przeszłość, zbyt odległa) daje tylko ogólne
  `400 invalid_request`, więc pole formularza nie dostanie komunikatu. Makieta obiecuje "Przypomnimy o
  odnowieniu", a nikt nie zaplanował powiadomień (ws-06 M4: zdarzenie audytu i flaga `expiring`). Termin jest
  deklaracją użytkownika (broker nie zna prawdziwego terminu PAT), brak daty = brak `expiring`.
- **Wariant:** odpowiedź `400` z `error: expires_at_invalid` (kształt `Error`, kod to wolny ciąg wg wzorca):
  `expiresAt` musi być w przyszłości i nie dalej niż limit brokera (konfiguracja, domyślnie 366 dni). Tekst w
  formularzu zmienia się na obietnicę, którą system spełnia: "Oznaczymy token jako wygasający 7 dni przed
  terminem" (status `expiring` < 7 dni już istnieje). Kanał powiadomień (e-mail, Teams) to osobna decyzja M4.
  Frontend zamienia datę z `<input type=date>` na koniec dnia czasu lokalnego w UTC.
- **Alternatywy:** (a) jak wyżej plus kanał powiadomień (nowe SPI, infrastruktura poczty); (b) tylko walidacja
  we frontendzie (broker przyjmie datę z przeszłości, status od razu `expired`).
- **Zmiany plików:**
  - `openapi/portal-bff.v1.yaml`, `putMySecret.responses` (analogicznie `credential-broker.v1.yaml`, `putSecret`):

```yaml
        '400':
          description: Malformed request or an invalid expiry (expiresAt in the past, or later than the broker limit, default 366 days).
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                invalid_request:
                  value:
                    error: invalid_request
                expires_at_invalid:
                  value:
                    error: expires_at_invalid
```

  - README (C4): zdanie o limicie i o tym, że `expiring` zależy od deklarowanej daty.
- **Wektory / testy:** nowy `test-vectors/secret-expiry/*.json` (pola `now`, `expiresAt`, `maxDays: 366`,
  `expected.valid`): `valid-30-days`, `valid-366-days`, `invalid-past`, `invalid-equal-now`, `invalid-367-days`;
  kontrola referencyjna w teście Node. Limit 366 to wartość domyślna, wektory dotyczą domyślnej konfiguracji.
- **SemVer:** minor (nowy udokumentowany kod w istniejącym `400`).
- **Wpływ na strumienie:** ws-06 (walidacja, konfiguracja limitu), ws-07 (przekazanie kodu; BFF nie przekazuje
  ciał upstreamu, mapuje `400` brokera na własne `400` z tym samym kodem), ws-08 (komunikat pod polem).
- **Status:** accepted w wydaniu 2.2.0; zmienione decyzją człowieka 2026-10-28 (wydanie 2.2.1), patrz początek wpisu

## CC-085 | C5/C12 | `resourceDefaults` uśpione: `400 resource_defaults_unsupported`

- **Zgłasza:** analiza luk G-09 (wariant zmieniony decyzją człowieka 2026-10-27)
- **Kamień:** M2, wydanie 2.2.0
- **Problem:** C5 przyjmuje `resourceDefaults` od M2, a egzekwowanie `vsScopes` startuje w M3 (ws-05). Link zawężony
  do projektu ABC działałby bez zawężenia, a UI obiecywałoby zawężenie (fail-open obietnicy, sprzeczne z
  niezmiennikiem 6).
- **Decyzja człowieka (zamiast wariantu "do M3"):** krok "Zawężenie" znika z kreatora **na stałe** (link = nazwa +
  wybór narzędzi). Gateway odrzuca niepuste `resourceDefaults` kodem `400 resource_defaults_unsupported`. Możliwość
  zostaje w kontrakcie jako uśpiona: pole i schemat `ResourceDefaults` nie są usuwane, mechanika `vsc` (C2),
  `context.vsScopes` (Cedar) i egzekwowanie zawężeń po stronie serwerów (CC-027, CC-029, CC-036, CC-041, CC-058)
  pozostaje w kontraktach bez zmian, bo gateway i starter nadal ją znają, a wektory na niej oparte zostają ważne.
  Przywrócenie funkcji = nowa decyzja i wydanie, w którym odrzucenie znika.
- **Alternatywy:** (a) ukryć krok tylko w UI (brak ochrony przed wywołaniem API wprost); (b) usunąć pole
  (major, odrzucone przez człowieka); (c) flaga wyłączana w M3 (zastąpiona decyzją o trwałym uśpieniu).
- **Zmiany plików:**
  - `openapi/gateway-admin.v1.yaml`: opis `VirtualServerCreate.resourceDefaults` i `VirtualServer.resourceDefaults`:
    "Dormant (CC-085). The gateway answers 400 resource_defaults_unsupported for a non-empty value; absent or `{}`
    is accepted. Responses never contain it." Odpowiedź `400` operacji `createVirtualServer` z przykładem:

```yaml
        '400':
          description: Malformed request, or a non-empty resourceDefaults (resource narrowing is dormant, CC-085).
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                resource_defaults_unsupported:
                  value:
                    error: resource_defaults_unsupported
```

  - `openapi/portal-bff.v1.yaml`, `createMyVirtualServer.responses.400`: ten sam przykład; BFF sprawdza pole sam
    (nie wywołuje gateway'a) i odpowiada własnym ciałem, bo ciał upstreamu nie przekazuje (CC-050). Gateway odrzuca
    niezależnie (obrona w głąb, wywołania wprost do C5).
  - Przykłady `listMyVirtualServers`/`createMyVirtualServer` bez `resourceDefaults`; ten sam przykład w
    WireMock (`createVirtualServer.json`) i MSW; handler MSW zwraca 400 dla niepustego pola.
  - README: akapit "Zawężenie zasobów jest uśpione" z odesłaniem do CC-085.
- **Wektory / testy:** żadne istniejące wektory (Cedar `vsScopes`, `entity-builder`, JWT `vsc`) się nie zmieniają.
  Test mocków: niepuste `resourceDefaults` -> 400 z kodem; puste lub brak -> 201.
- **SemVer:** według tabeli README to **zaostrzenie walidacji, czyli formalnie major**. Skutek praktyczny zerowy:
  CRUD linków w gateway'u to M2 (jeszcze nie istnieje), a BFF/web na M1 nie wysyłają pola. Rekomendacja: 2.2.0 z
  udokumentowanym wyjątkiem w `CHANGELOG.md` (jak CC-071/074 w 2.1.0). Wariant bez wyjątku: ten wpis przechodzi do
  3.0.0 (CC-091), a gateway w M2 odrzuca pole z konfiguracji (zachowanie fail-closed nie wymaga kontraktu).
- **Wpływ na strumienie:** ws-05 (odrzucenie, test), ws-07 (walidacja po stronie BFF), ws-08 (kreator o trzy
  kroki: nazwa, narzędzia, gotowe; bez makiet 13, bez wiersza "Zawężenie" w 08/14/27), ws-10 (test API wprost).
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.2.0)

## CC-086 | C12 | `ConnectErrorCode` z `cancelled` i callback OAuth bez sesji

- **Zgłasza:** analiza luk G-20; kierunek zatwierdzony przez człowieka 2026-10-27
- **Kamień:** M2, wydanie 2.2.0
- **Problem:** (1) kody `connectError` są wymienione tylko w opisie `oauthCallback`, nie w schemacie (w
  odróżnieniu od `LoginErrorCode`), więc wygenerowany klient nie ma typu; (2) kontrakt nie mówi, jaki kod dostaje
  użytkownik, który anulował u dostawcy (`error=access_denied`); (3) `oauthCallback` ma `security: session`, więc
  bez ważnej sesji przeglądarka dostałaby 401 JSON, choć opis mówi "Never returns JSON".
- **Wariant:** schemat `ConnectErrorCode` (zamknięta lista: `identity_mismatch`, `flow_invalid`, `provider_error`,
  `cancelled`). Mapowanie: parametr `error=access_denied` dostawcy -> `cancelled`, inny `error` -> `provider_error`.
  Bez sesji: `302` na `/?loginError=session_expired` (istniejący `LoginErrorCode`), bez JSON. Szczegóły dostawcy
  nigdy w URL. Nazwa konta (`backendUser`) nie trafia do adresu, baner czyta ją z `connection` (CC-080).
- **Alternatywa:** anulowanie jako `provider_error` (mylący komunikat po świadomym anulowaniu).
- **Zmiany plików:** `openapi/portal-bff.v1.yaml`:

```yaml
    ConnectErrorCode:
      type: string
      description: Value of `connectError` appended to returnPath after a failed OAuth connection (CC-022). Closed list. cancelled = the user cancelled at the provider (error=access_denied).
      enum: [identity_mismatch, flow_invalid, provider_error, cancelled]
```

  `oauthCallback`: `security: []` (sesję sprawdza BFF ręcznie), opis zdania o braku sesji, `x-connect-error-code`
  wskazujące na schemat (jak `x-login-error-code`), odpowiedź `302` z dwoma przykładami `Location`
  (`/catalog?connectError=cancelled`, `/?loginError=session_expired`). MSW `oauthCallback` analogicznie.
- **Wektory / testy:** nowy `test-vectors/connect-redirects/*.json` w formacie `login-redirects`
  (`location`, `expected.valid`): `valid-cancelled`, `valid-identity-mismatch`, `valid-flow-invalid`,
  `valid-provider-error`, `valid-no-session` (`/?loginError=session_expired`), `invalid-unknown-code`,
  `invalid-provider-details` (np. `...&error_description=...`). Kontrola w teście Node.
- **SemVer:** minor (nowy schemat; istniejące wartości w opisie bez zmian). Zmiana `security` operacji na `[]`
  to zmiana opisu: klient generowany nie ma już założenia, że callback zwraca 401 JSON.
- **Wpływ na strumienie:** ws-07 (mapowanie, przekierowanie bez sesji), ws-08 (komunikat "Połączenie anulowane.").
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.2.0)

## CC-087 | C12 | `X-Request-Id` na każdej odpowiedzi BFF i `Error.requestId`

- **Zgłasza:** analiza luk G-21; kierunek zatwierdzony przez człowieka 2026-10-27
- **Kamień:** M2, wydanie 2.2.0
- **Problem:** BFF tworzy `requestId` na każde żądanie (CC-047) i wysyła go do brokera i gateway'a, ale nie zwraca
  go przeglądarce. Makieta pokazuje "Identyfikator do zgłoszenia" pod komunikatem 503; użytkownik nie ma co podać
  helpdeskowi, a administrator nie znajdzie zdarzeń w SIEM po wartości z ekranu (niezmiennik 10).
- **Wariant:** nagłówek `X-Request-Id` (UUIDv7) na każdej odpowiedzi `/api/v1/*`, także 302, 401, 4xx i 5xx, oraz
  opcjonalne `Error.requestId`. `requestId` to nie sekret (zawiera czas). Wartość z żądania klienta BFF ignoruje
  (generuje własną); zapis jej w audycie jako `clientRequestId` jest tylko w gateway'u (C3). Frontend pokazuje
  pierwsze 8 znaków drobnym drukiem.
- **Alternatywa:** usunąć wiersz z makiety (brak korelacji ekranu z audytem).
- **Zmiany plików:** `openapi/portal-bff.v1.yaml`:

```yaml
  components:
    headers:
      RequestId:
        description: requestId (UUIDv7) of this request, the same value as in the audit events of the BFF, broker and gateway (CC-047). Not a secret; the UI shows its first 8 characters next to an error.
        required: true
        schema:
          type: string
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    schemas:
      Error:
        properties:
          requestId:
            $ref: '../schemas/common.schema.json#/$defs/RequestId'
```

  Nagłówek dopisany przez `$ref` do każdej odpowiedzi (najpierw `components.responses`: `BadRequest`,
  `Unauthenticated`, `StepUpOrUnauthenticated`, `CsrfInvalid`, `Forbidden`, `NotFound`, `UpstreamUnavailable`).
  Opis `info.description`: akapit o korelacji uzupełniony o odpowiedź do przeglądarki. Reguła Spectral
  (`spectral-functions`): każda odpowiedź operacji C12 ma nagłówek `X-Request-Id`.
- **Wektory / testy:** bez nowych wektorów; test mocków MSW/WireMock: każda odpowiedź ma nagłówek zgodny ze wzorcem.
- **SemVer:** minor (nowy nagłówek odpowiedzi, nowe pole opcjonalne).
- **Wpływ na strumienie:** ws-07 (filtr serwletowy ustawiający nagłówek także na odpowiedziach błędów i
  przekierowaniach), ws-08 (wyświetlanie), ws-01/reverse proxy (nie nadpisywać i nie usuwać nagłówka, CC-089).
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.2.0)

## CC-088 | C5 | `enabled` w `RegistryServer`

- **Zgłasza:** analiza luk G-25; człowiek umieścił w 2.2.0 (analiza: M4)
- **Kamień:** M2, wydanie 2.2.0
- **Problem:** widok administracji (makieta 07) pokazuje stan serwera "Wyłączony"; `RegistryServer` nie ma stanu
  włączenia. Jedyne mechanizmy wyłączenia w planie to `overrides` (zakazy Cedar), niezatwierdzony hash i
  konfiguracja serwera w gateway'u (IaC).
- **Wariant:** opcjonalne `RegistryServer.enabled` (domyślnie `true`), wyliczane przez gateway z konfiguracji i z
  `overrides`; ten sam mechanizm daje `disabled` w CC-081 (wszystkie narzędzia wyłączonego serwera mają
  `disabled: true`). Tylko odczyt: w portalu nie ma przełącznika (brak nowej powierzchni zmian).
- **Alternatywy:** (a) usunąć stan z makiety; (b) akcja wyłącz/włącz w portalu (nowa operacja administracyjna z
  audytem i MFA, poza zakresem makiet).
- **Zmiany plików:** `openapi/gateway-admin.v1.yaml`, `RegistryServer.properties`:

```yaml
        enabled:
          type: boolean
          default: true
          description: False when the server is disabled in gateway configuration or by an overrides policy. All tools of a disabled server report disabled=true in the catalog (CC-081). Read only; the portal has no switch.
```

  `RegistryServer` ma `additionalProperties: false`, więc pole dopisane w `properties`. Przykład z serwerem
  wyłączonym w `listRegistryServers` (C5, C12) i w mockach.
- **Wektory / testy:** test przykładów; test spójności przykładów katalogu i rejestru (`enabled: false` -> wszystkie
  narzędzia `disabled: true`).
- **SemVer:** minor.
- **Wpływ na strumienie:** ws-05 (wyliczenie), ws-07 (przezroczyste), ws-08 (administracja, tylko etykieta), ws-09
  (jeśli `overrides` ma wyłączać serwer, konwencja identyfikatora reguły; poza kontraktem).
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.2.0)

## CC-089 | C1/C3/C5/C12 | Jedna domena: reverse proxy przed web, BFF i gateway'em

- **Zgłasza:** człowiek (decyzja 2026-10-27, STATUS koordynatora)
- **Kamień:** M2, wydanie 2.2.0
- **Problem:** od M2 portal i gateway mają być pod jedną domeną: `/` -> web, `/api` -> BFF, `/s/` i `/v/` ->
  gateway, serwery MCP tylko za gateway'em. Sprawdzono, co to zmienia w kontraktach. **Schematów ani ścieżek nie
  zmienia nic**, ale cztery rzeczy wymagają zapisu, a jedna założona w decyzji nie zadziała.
- **Wynik przeglądu:**
  1. **Adres publiczny.** `PortalCatalogServer.url`, `VirtualServer.url`, `VirtualServerCreated.url` i
     `clientConfigs` zawierają dziś w przykładach host `mcp-gateway.internal`, a opis mówi `https://<gateway>/...`.
     Kontrakt nie określa, skąd BFF i gateway biorą host. Zapis: adres publiczny pochodzi wyłącznie z konfiguracji
     (`publicBaseUrl`, np. `https://mcp.aiwcorpo.pl`), nigdy z nagłówka `Host`/`X-Forwarded-Host` żądania (host
     header injection w `resource_metadata` i w `url`); gateway ufa `X-Forwarded-*` tylko od proxy. Przykłady w YAML,
     MSW i WireMock zmieniają host na publiczny z makiet.
  2. **Metadane chronionego zasobu (RFC 9728, C1).** Wariant ze ścieżką ma postać
     `/.well-known/oauth-protected-resource/s/<serverId>/mcp`, czyli leży **w korzeniu domeny**, poza czterema
     prefiksami z decyzji. Bez piątej reguły proxy `/.well-known/oauth-protected-resource*` -> gateway aplikacja web
     (fallback SPA na `index.html`) odpowiedziałaby 200 z HTML-em, a klient MCP nie znalazłby metadanych.
     `WWW-Authenticate: Bearer resource_metadata="..."` i pole `resource` w metadanych używają `publicBaseUrl`.
     Reszta C1 bez zmian: `aud` = `mcp-gateway` (stała, jak dotąd), serwer autoryzacji = IdP.
  3. **Ciasteczko sesji ograniczone do `/api` nie jest możliwe przy obecnych nazwach.** Prefiks `__Host-` wymaga
     `Path=/` (CC-055 wybrał go przeciwko cookie tossing), a `__Host-XSRF-TOKEN` musi mieć `Path=/`, żeby kod SPA
     na dowolnej trasie mógł go odczytać (`document.cookie` widzi tylko ciasteczka pasujące do ścieżki dokumentu).
     Skutek: przeglądarka wyśle `__Host-session` także na `/s/` i `/v/`. Wariant rekomendowany (A): nazwy bez zmian,
     proxy usuwa nagłówek `Cookie` na `/s/`, `/v/` i `/.well-known/oauth-protected-resource*`, a gateway dodatkowo
     nie przekazuje `Cookie` dalej (do listy nagłówków usuwanych w C3: `X-MCP-*`, `X-PAT-*`, `Authorization`,
     `X-Request-Id` dochodzi `Cookie`). Wariant B: zmienić `__Host-session` na `__Secure-session` z `Path=/api`;
     traci ochronę przed cookie tossing z CC-055, więc odradzany. Wariant C: osobna subdomena gateway'a (odrzucona
     przez człowieka).
  4. **Jedna domena = jeden origin dla odpowiedzi gateway'a.** Odpowiedź z `/s/` lub `/v/` renderowana w
     przeglądarce wykonywałaby się z uprawnieniami portalu (ciasteczko XSRF jest czytelne dla JS). Gateway odpowiada
     wyłącznie `application/json` i `text/event-stream`; proxy dokłada na `/s/` i `/v/` `X-Content-Type-Options:
     nosniff` oraz `Content-Security-Policy: default-src 'none'; sandbox`, również do własnych stron błędów.
  5. **Callback OIDC BFF musi leżeć pod `/api`.** C12 opisuje go jako wewnętrzny endpoint poza API. Proxy kieruje
     do BFF tylko `/api`, więc domyślna ścieżka Spring Security (`/login/oauth2/code/<id>`, jeśli ws-07 jej
     używa) trafiłaby do aplikacji web. Zapis w opisie `login`: `redirect_uri` IdP = `<publicBaseUrl>/api/v1/auth/callback`
     (nazwa do uzgodnienia z ws-07; nie jest to operacja kontraktu). To samo dotyczy URL-i wylogowania w IdP.
  6. **Trasy zarezerwowane.** Angular Router nie definiuje tras zaczynających się od `/api`, `/s/`, `/v/`,
     `/.well-known/`; `VirtualServerSlug` nie koliduje, bo slug leży pod `/v/`. `X-Request-Id` z BFF przechodzi
     przez proxy bez zmian (CC-087); proxy nie wstawia własnego, bo BFF zawsze generuje własny i ignoruje wartość klienta.
  7. **Opis C12:** "serwowany przez BFF z tego samego originu" zmienia się na "serwowany spod tego samego origin
     przez reverse proxy (aplikacja web może być osobnym serwerem statycznym)". Brief ws-07 pkt 1a (BFF
     serwuje SPA) pozostaje dopuszczalną opcją dev.
- **Zmiany plików:** `openapi/portal-bff.v1.yaml` (`info.description`: origin, opis `login`, opisy `url`, przykłady),
  `openapi/gateway-admin.v1.yaml` (opisy `url`, przykłady), `README.md` (nowa sekcja "Jedna domena" z tabelą
  tras: `/` -> web, `/api` -> BFF, `/s/`, `/v/`, `/.well-known/oauth-protected-resource*` -> gateway, nagłówki z
  punktu 4, usuwanie `Cookie`), akapit C3 o `Cookie`, mocki (host w przykładach). Schematy JSON i Cedar bez zmian.
- **Wektory / testy:** brak zmian w istniejących wektorach. Nowy test w ws-05/ws-10 (poza kontraktem): żądanie z
  `Cookie` na `/s/` nie dociera do serwera MCP; `GET /.well-known/oauth-protected-resource/s/mcp-jira/mcp` zwraca
  JSON metadanych, nie HTML; żądanie z fałszywym `X-Forwarded-Host` nie zmienia `resource_metadata`.
- **SemVer:** patch (opisy i przykłady). Dopisanie `Cookie` do nagłówków usuwanych w C3 doprecyzowuje zachowanie
  gateway'a, nie zmienia schematu; jeśli człowiek woli traktować to jako zaostrzenie, wchodzi z CC-091 w 3.0.0.
- **Wpływ na strumienie:** ws-01 (nginx w compose, 5 tras, nagłówki, TLS z jednym certyfikatem, `redirect_uri`
  Keycloaka), ws-05 (`publicBaseUrl`, zaufanie do `X-Forwarded-*`, usuwanie `Cookie`, tylko JSON/SSE), ws-07
  (callback pod `/api`, `publicBaseUrl` w `clientConfigs`), ws-08 (zarezerwowane prefiksy tras), ws-10 (testy
  powyżej). Pytanie do człowieka: czy piąta trasa (`/.well-known/oauth-protected-resource*`) jest akceptowana.
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.2.0)

## CC-090 | C12 | Zapis PAT bez step-up MFA

- **Zgłasza:** człowiek (decyzja 2026-10-27: MFA przy `PUT /connections/{system}/secret` uznane za nadmiarowe)
- **Kamień:** M2, wydanie 2.2.0
- **Problem:** C12 wymaga świeżego MFA przy zapisie sekretu (`401 step_up_required`, `Me.mfaFreshUntil` z CC-053,
  `returnPath` w `stepUpUrl` z CC-048). Człowiek uznał to za nadmiarowe dla użytkownika, który wkleja własny token.
- **Wariant:** `PUT /api/v1/connections/{system}/secret` wymaga ważnej sesji i nagłówka `X-XSRF-TOKEN`; bez
  step-up. Główną ochroną jest `identity_mismatch` (C4.1): broker wywołuje whoami systemu z nowym sekretem i
  odrzuca token, którego tożsamość nie zgadza się z użytkownikiem SSO; nic się nie zapisuje.
  - **Co zostaje:** `Me.mfaFreshUntil` i `stepUpUrl` z `returnPath` (CC-053, CC-048) służą dalej rejestracji i
    usunięciu Authenticatora (CC-093) oraz ewentualnym przyszłym operacjom wrażliwym. `step_up_required` w C10
    zostaje dla polityk (reguła `destructive-requires-fresh-mfa` jest przykładem, patrz CC-091).
  - **Co znika:** `401 StepUpOrUnauthenticated` w `putMySecret` (zostaje `Unauthenticated`), przykład MSW
    `step_up_required` dla tej operacji, test "zapis sekretu bez świeżego MFA -> step_up_required" z briefu ws-07,
    ekran "Wymagane ponowne MFA przed zapisem" (makieta 05, stan "Powrót z MFA"), sprawdzanie `mfaFreshUntil` przed
    pokazaniem pola na token w ws-08.
- **Aktualizacja 2026-10-28 (CC-101):** ochrona `identity_mismatch` **zniknęła**: broker nie porównuje już tożsamości
  z systemu z tożsamością SSO (ta sama osoba ma różne loginy w różnych systemach). Poniższa ocena ryzyka, oparta na
  `identity_mismatch`, nie obowiązuje. Ryzyko rezydualne **świadomie przyjęte przez człowieka 2026-10-28**: przejęta
  sesja portalu może podpiąć PAT lub konto OAuth atakującego; agent ofiary czyta i zapisuje wtedy w koncie atakującego
  (w tym treści z prompt injection) i zapisuje tam dane ofiary. Zalecenia: audyt `connection_change` z `backendUser`
  i widoczność konta w portalu ("Połączono jako <backendUser>" po zapisie i w Połączeniach), krótkie sesje.
- **Ryzyko (jawnie, stan do 2.2.2):** kradzież sesji portalu (cookie `__Host-session` jest HttpOnly, więc w praktyce: przejęty
  komputer, rozszerzenie przeglądarki, XSS) pozwala atakującemu zapisać sekret. Ocena:
  - Atakujący musi mieć token **tego samego konta** w systemie docelowym. Token innego konta kończy się
    `identity_mismatch`, także przy OAuth (podrzucony link autoryzacji). Kto ma taki token, miał już dostęp do
    konta w Jirze/GitLabie, więc zapis do portalu niczego mu nie poszerza.
  - Realny skutek kradzieży sesji to zerwanie lub podmiana własnego połączenia ofiary (DoS). `DELETE
    /connections/{system}` już dziś nie wymaga MFA, więc ten wariant wyrównuje oba kierunki.
  - Czego MFA przy zapisie by nie zatrzymało: atakujący z sesją i tak może wywołać operacje tylko-sesyjne
    (tworzenie linków, odczyt aktywności, usunięcie połączeń).
  - Warunek utrzymania oceny: mapowanie tożsamości w C4.1 to dokładne porównanie (bez dopasowania podciągu),
    a e-mail liczy się tylko przy `email_verified` (uwaga z recenzji brokera M1). Krótkie sesje (8 h, bezczynność
    30 min) i audyt `connection_change` zostają.
  - Wartość użytkownika: zapis PAT przestaje wymagać push z telefonu; sekret nadal przechodzi tylko
    przeglądarka -> BFF -> broker (niezmiennik 4).
- **Alternatywy:** (a) status quo (MFA przy każdym zapisie); (b) MFA tylko przy zapisie, gdy połączenie już
  istnieje (podmiana); (c) powiadomienie użytkownika o zmianie połączenia (kanał nie istnieje, M4).
- **Zmiany plików:** `openapi/portal-bff.v1.yaml`: `putMySecret` -> `summary: Store a PAT / API key.`,
  `'401': $ref: '#/components/responses/Unauthenticated'`; opis `Me.mfaFreshUntil`: "...step-up protected
  operations (authenticator registration and removal, CC-093)", bez wzmianki o `PUT secret` i potwierdzeniach.
  MSW: usunięcie przykładu `step_up_required` z `putMySecret`. README: jedno zdanie o `identity_mismatch` jako
  ochronie zapisu.
- **Wektory / testy:** bez zmian w wektorach; `test/mocks.test.mjs` traci przypadek step-up dla `putMySecret`.
- **SemVer:** minor (łagodzenie: z odpowiedzi znika wariant 401, istniejący klient obsługujący `step_up_required`
  dalej działa). Tabela w README nie opisuje wprost zawężenia zestawu odpowiedzi; rekomendacja ws-00: minor.
- **Wpływ na strumienie:** ws-07 (zdjęcie wymogu step-up z `PUT secret`, zostaje dla CC-093), ws-08 (formularz bez
  przekierowania do MFA, uproszczenie stanu "Powrót z MFA"), ws-10 (test: zapis PAT innego konta -> 422
  `identity_mismatch` bez MFA).
- **Status:** accepted (decyzja: człowiek, 2026-10-27, wydanie 2.2.0)

## CC-091 | C11/C10/C5/C12 | Potwierdzenia akcji destrukcyjnych kodem TOTP z aplikacji (pivot)

- **Zgłasza:** człowiek (decyzja 2026-10-27: "kod z Authenticatora + link podglądu")
- **Kamień:** M3 (gateway C11 powstaje w M3; wydanie rekomendowane 3.0.0, patrz SemVer)
- **Problem:** przepływ z CC-077 (portal -> świeże MFA Entra -> kod wydany przez gateway -> wklejenie w kliencie)
  wymaga od użytkownika MFA na każde potwierdzenie i jest ciężki. Człowiek chce prostszej ścieżki: stałe,
  osobne konto "MCP Platform" w aplikacji TOTP (Microsoft Authenticator), kod wpisywany w kliencie, a portal tylko
  jako opcjonalny podgląd operacji. Kodów konta Entra nie da się weryfikować poza logowaniem Entra, dlatego
  potrzebne jest osobne konto TOTP, którego sekret zna platforma (CC-092).
- **Wariant (przepływ):**
  1. Agent wywołuje narzędzie wymagające potwierdzenia (`DESTRUCTIVE` albo wskazane polityką). Gateway po decyzji
     `allow` i pomyślnym `resolve` pyta brokera o stan Authenticatora użytkownika (`GET /v1/authenticator`, CC-092).
  2. **Brak rejestracji (`none`):** fail-closed. Gateway nie tworzy oczekującego wywołania i odpowiada
     `confirmation_required` z `registerUrl` (strona rejestracji w portalu, CC-093). Żaden kod nie zostanie
     przyjęty. Broker niedostępny: `upstream_unavailable`.
  3. **Rejestracja aktywna:** gateway zapisuje w Redis oczekujące wywołanie pod kluczem
     `(sub, serverId, tool, sha256(argumenty kanonicznie, BEZ confirmation_code))`: `confirmationId` (losowy,
     nieprzewidywalny), `system`, `createdAt`, `expiresAt` (TTL 120 s), `attemptsLeft` (3), `previewViewedAt` (puste).
     Powtórzone pierwsze wywołanie z tymi samymi argumentami zwraca ten sam rekord (TTL nie jest przedłużany).
     Limit oczekujących na `sub` (konfiguracja, domyślnie 3); powyżej `rate_limited`.
  4. Odpowiedź `confirmation_required` niesie: `confirmationId`, `description` (opis operacji liczony przez
     gateway: nazwa kwalifikowana narzędzia, system, argumenty posortowane po nazwie, serializowane do JSON i
     obcięte tymi samymi limitami co `ConfirmationView`), `previewUrl` (`/confirm/<confirmationId>`) i `expiresAt`.
     Treść `message` jest stała i mówi, co zrobić ("Wpisz bieżący 6-cyfrowy kod z konta MCP Platform w aplikacji
     Authenticator i ponów wywołanie z `confirmation_code`").
  5. **Podgląd (opcjonalny):** człowiek otwiera `previewUrl`. Portal pokazuje system, narzędzie i argumenty z
     gateway'a (`GET /api/v1/confirmations/{id}`): tylko odczyt, tylko właściciel, sesja bez świeżego MFA,
     `Cache-Control: no-store`, bez przycisków decyzji. Gateway zapisuje `previewViewedAt` (w 3.0.0 jawnym wywołaniem `viewed`, nie skutkiem `GET`; patrz CC-127
     opisany w kontrakcie).
  6. Człowiek wpisuje bieżący kod z aplikacji w kliencie; agent ponawia wywołanie z tymi samymi argumentami i
     `confirmation_code` (kształt jak dotąd: 6 cyfr, pole dokładane do `inputSchema` w `tools/list` poza
     `definitionHash`, usuwane przed hashem i przed serwerem). Gateway liczy hash argumentów, odnajduje oczekujące
     wywołanie po kluczu z punktu 3 i woła brokera `POST /v1/authenticator/verify {code}`. Weryfikacja TOTP
     (RFC 6238: SHA-1, 6 cyfr, 30 s, okno +-1 krok, jednorazowość kroku czasowego, limity i blokada) jest w brokerze;
     gateway dostaje tylko wynik.
  7. Wynik `ok`: gateway atomowo zużywa oczekujące wywołanie (nie da się go użyć dwa razy) i wykonuje narzędzie;
     audyt `reason: user_confirmed`. Inne wyniki wg tabeli:

| Sytuacja przy ponowieniu | Odpowiedź klientowi |
| --- | --- |
| brak oczekującego wywołania, wygasło, argumenty inne niż w pierwszym wywołaniu | `confirmation_failed` |
| podgląd wymagany (konfiguracja), a właściciel go nie otworzył | `confirmation_required` z tym samym `confirmationId`; kod nie jest sprawdzany i nie zużywa próby ani kroku czasowego |
| kod błędny (`invalid`) | `confirmation_failed`, `attemptsLeft` -1; przy 0 oczekujące wywołanie jest usuwane |
| kod już użyty w tym kroku lub starszym (`replayed`) | `confirmation_failed`, `attemptsLeft` -1 |
| blokada użytkownika w brokerze (`locked`) | `rate_limited` z `retryAfterSeconds` |
| rejestracja zniknęła w międzyczasie (`not_registered`) | `confirmation_required` z `registerUrl` |
| broker niedostępny | `upstream_unavailable` (fail-closed, kod nie jest "oddawany") |

  8. Kanał elicitation URL (C11, kanał 1) może tylko otworzyć `previewUrl`; kod nigdy nie idzie przez elicitation
     w trybie form. Kod i tak wpisuje człowiek w kliencie, a klient jest niezaufany.
- **Co znika, co zostaje:**

| Element | Los |
| --- | --- |
| CC-034 (świeże MFA także dla podglądu) | **zastąpione**: podgląd wymaga tylko sesji właściciela (ta sama zmiana co G-14, wariant B). `GET /admin/v1/confirmations/{id}` i `GET /api/v1/confirmations/{id}` nie zwracają już `step_up_required`. Reszta CC-034 (tylko właściciel, `no-store`) zostaje |
| CC-077 pkt 1-2 (`confirmation_required`, ekran z narzędziem, systemem i argumentami z gateway'a, `ConfirmationView.system`) | **zostają** (zmiana nazwy pola `confirmUrl` -> `previewUrl`, dodatki `description`, `registerUrl`, `expiresAt`) |
| CC-077 pkt 3-4 (MFA przy "Zatwierdź", `POST .../confirmations/{id}`, `ConfirmationOutcome` z kodem wydanym przez gateway, `codeExpiresAt`, `attemptsLeft`) | **znikają**: kod nie jest wydawany przez platformę; brak endpointu decyzji; brak "Odrzuć" (odmowa = nie wpisać kodu, wygaśnięcie 120 s) |
| CC-077 pkt 5 (agent ponawia z `confirmation_code`, związanie z `(sub, serverId, tool, sha256 argumentów)`, TTL 120 s, 3 próby, jednorazowość) | **zostaje**, ale rekord wiąże się z oczekującym wywołaniem w gateway'u, nie z wydanym kodem; kod to TOTP |
| `ConfirmationCodeSender` (SPI, D8) | **bezprzedmiotowe**: platforma nie wysyła kodów. D8 do aktualizacji w `02-decisions.md` (człowiek) |
| `confirmation_declined` (C10) | bez emitującego; rekomendacja: usunąć z `tool-error.schema.json` w 3.0.0 |
| CC-053 `Me.mfaFreshUntil`, CC-048 `returnPath` w `stepUpUrl` | **zostają**, ale służą rejestracji i usunięciu Authenticatora (CC-093), nie potwierdzeniom ani PAT (CC-090) |
| `definitionHash`, pole `confirmation_code` poza hashem, wektory `definition-hash/`, `manifests/invalid-confirmation-code-in-definition` | **bez zmian** |
| `test-vectors/confirmation-binding/` (12) | **przepisane**: znika `issued.code` jako kod wydany; wektory sprawdzają związanie oczekującego wywołania (sub, serwer, narzędzie, hash, TTL, próby, jednorazowość), a wynik weryfikacji TOTP wchodzi jako dana wejściowa. Nowe: `test-vectors/totp/` (CC-092) |
| polityka Cedar `destructive-requires-fresh-mfa` (`cedar/examples/step-up.cedar`, wektory `gw-destructive-*-mfa`) | **przykład i wektory bez zmian**. Uwaga: wdrożenie tej reguły w paczce produkcyjnej (ws-09) wymusza świeże MFA w tokenie klienta (`step_up_required`) **oprócz** kodu TOTP. Do decyzji człowieka, czy dla narzędzi objętych kodem TOTP reguła ma wypaść z paczki produkcyjnej (zmiana w ws-09, nie w kontrakcie) |

- **Zmiany plików (szkic):**
  - `schemas/tool-error.schema.json`, definicja `ConfirmationRequired` (wariant 3.0.0):

```json
    "ConfirmationRequired": {
      "type": "object",
      "required": ["error", "message"],
      "properties": {
        "error": { "const": "confirmation_required" },
        "message": { "$ref": "#/$defs/Message" },
        "confirmationId": { "$ref": "common.schema.json#/$defs/ConfirmationId" },
        "description": {
          "description": "Operation as the gateway computed it from the arguments it received: qualified tool name, system and arguments sorted by name, JSON-serialized, truncated like ConfirmationView. Not model text. Unlike message it carries argument values (the client already has them). A client shows it to the user, but a client is untrusted: the portal preview is the reference.",
          "type": "string", "minLength": 1, "maxLength": 1000
        },
        "previewUrl": {
          "description": "Read-only portal page /confirm/<confirmationId> (owner only, session without fresh MFA).",
          "type": "string", "format": "uri"
        },
        "registerUrl": {
          "description": "Portal page where the user registers the authenticator. Present exactly when the user has no active authenticator; no pending call exists then.",
          "type": "string", "format": "uri"
        },
        "expiresAt": { "$ref": "common.schema.json#/$defs/Timestamp" }
      },
      "oneOf": [
        { "required": ["confirmationId", "description", "previewUrl", "expiresAt"] },
        {
          "required": ["registerUrl"],
          "not": {
            "anyOf": [
              { "required": ["confirmationId"] },
              { "required": ["description"] },
              { "required": ["previewUrl"] },
              { "required": ["expiresAt"] }
            ]
          }
        }
      ],
      "additionalProperties": false
    }
```

    `Message` zachowuje zakaz wartości argumentów; wyjątek dotyczy wyłącznie pola `description`. Dwie
    gałęzie `oneOf` wykluczają się: albo pełny zestaw oczekującego wywołania, albo samo `registerUrl` (wektory
    poniżej sprawdzają obie strony).
  - `openapi/gateway-admin.v1.yaml`: usunięcie `post` z `/admin/v1/confirmations/{confirmationId}` oraz schematów
    `ConfirmationDecision` i `ConfirmationOutcome`; `getConfirmation`: `summary: Read-only preview of a pending
    confirmation; owner only, valid session, no fresh MFA`, odpowiedzi `401` -> `Unauthenticated`, opis skutku
    ubocznego ("a successful call records that the owner viewed the preview"), `no-store` zostaje.
    `ConfirmationView` bez zmian w polach (dodatek `resource`: CC-098).
  - `openapi/portal-bff.v1.yaml`: usunięcie `post` (`decideMyConfirmation`) z `/api/v1/confirmations/{id}`;
    `getMyConfirmation`: `security: [session]`, `401` -> `Unauthenticated`; opis o braku wymogu MFA.
  - `schemas/common.schema.json`: `ConfirmationCode` zostaje (6 cyfr), opis: "Code typed by the user from the
    authenticator app (RFC 6238), sent by the agent as confirmation_code; not issued by the platform".
  - `README.md`: sekcja "Potwierdzenia (C11, kanał kodu)" przepisana wg powyższego przepływu; tabela C2 (CC-092):
    wywołania `GET /v1/authenticator` i `POST /v1/authenticator/verify` z gateway'a niosą wariant użytkownika z
    `tool`.
  - Mocki: WireMock `decideConfirmation.json` usunięty, `getConfirmation.json` bez MFA; MSW bez handlera POST,
    przykłady `confirmation_required` z `previewUrl`/`registerUrl`.
- **Wektory (nowe i zmienione):** `test-vectors/tool-errors/confirmation-required.json` (z `description`,
  `previewUrl`, `expiresAt`), `confirmation-required-register.json` (z samym `registerUrl`),
  `invalid-confirmation-required-both.json` (`previewUrl` i `registerUrl` razem),
  `invalid-confirmation-required-register-with-id.json`; usunięte `confirmation-declined.json`;
  `confirmation-binding/` przepisane (opis wyżej); `audit-events/` patrz CC-094.
- **SemVer (uczciwie):** pivot zawiera zmiany niezgodne według tabeli README: usunięcie endpointów i schematów
  (`POST` decyzji, `ConfirmationDecision`, `ConfirmationOutcome`), usunięcie pola `confirmUrl` i kodu błędu
  `confirmation_declined`, zmiana wymaganych pól `confirmation_required`, zmiana oczekiwań w istniejących
  wektorach (`confirmation-binding/`), zmiana semantyki C11 (kod nie jest wydawany przez platformę). Zmiany
  łagodzące (podgląd bez MFA) i nowe pola są minor. **Razem: major dla C11.** Dwie opcje, wybiera człowiek:
  - **A. 2.2.0 z udokumentowanym wyjątkiem** jak w 2.1.0 (CC-071/074/077). Za: jedno wydanie, ws-08 dostaje
    wszystko na MSW od razu; według STATUS żaden komponent poza mockami nie używa C11 (gateway M3 nie istnieje, BFF i
    web są na M1). Przeciw: od 2.0.0 obowiązuje ścisły SemVer, a to byłby drugi kolejny wyjątek dotykający tej samej
    operacji (`POST` decyzji zmienił się z 204 na 200 w 2.1.0 i znika w 2.2.0); klient wygenerowany z 2.1.x
    dalej wołałby usunięty endpoint, bez ostrzeżenia w typach.
  - **B. 3.0.0 (rekomendacja ws-00).** 2.2.0 zawiera wtedy tylko CC-080 ... CC-090 (po decyzji o CC-085), a pivot
    wychodzi jako 3.0.0 przed startem M3, bo C11 nie jest potrzebne w M2. Koszt: broker, BFF, web, gateway i ws-09
    podnoszą zależność o jeszcze jeden major (nic z C11 nie jest zaimplementowane, więc migracja jest mechaniczna).
    Paczki polityk: `cedar/mcp.cedarschema` bez zmian bajtowo, a `BundleVerifier` sprawdza tylko format
    `schemaVersion` i bajty schematu, więc istniejące paczki działają. W 3.0.0 mieszczą się też bez wyjątku CC-094
    (nowy `event`) i CC-085, gdyby człowiek wolał nie robić wyjątku w 2.2.0.
- **Ryzyko rezydualne (do zapisania w planie):**
  1. **Kod TOTP uwierzytelnia obecność człowieka, nie operację.** W CC-077 człowiek zatwierdzał w portalu
     konkretne argumenty i dopiero wtedy powstawał kod związany z ich hashem. Teraz kod nie zależy od operacji:
     każde oczekujące wywołanie tego użytkownika może go zużyć w ciągu okna. Jeśli człowiek nie otworzy podglądu,
     jego wiedza o tym, co zatwierdza, pochodzi z opisu pokazanego w **niezaufanym kliencie**; zmanipulowany
     agent (prompt injection) może pokazać opis operacji A, mając oczekujące wywołanie B, i użyć kodu wpisanego
     przez człowieka dla B.
  2. Kod wpisany w kliencie widzi agent. Okno +-1 krok (do ok. 90 s) i jednorazowość kroku (CC-092) ograniczają
     jego użycie do jednego wywołania, ale nie do tego, które człowiek miał na myśli.
  3. Niezmiennik 9 (potwierdzenie związane z `(user, narzędzie, argumenty)`, jednorazowe, z TTL) jest spełniony
     w sensie formalnym (związane jest oczekujące wywołanie), a **intencja** niezmiennika (człowiek zatwierdza
     te argumenty) zachodzi tylko wtedy, gdy człowiek je przeczytał w zaufanym kanale (podgląd) albo w surowym
     widoku wywołania narzędzia, który pokazuje klient.
  4. Blokada po błędnych kodach (CC-092) daje zmanipulowanemu agentowi możliwość zablokowania potwierdzeń
     destrukcyjnych użytkownika (DoS fail-closed; odczyty i zapisy bez potwierdzenia działają).
  5. Seed TOTP jest sekretem współdzielonym i jednorazowo widocznym w przeglądarce przy rejestracji (CC-093);
     agent z kontrolą przeglądarki zalogowanego użytkownika mógłby go odczytać, dlatego rejestracja wymaga
     świeżego MFA Entra.
- **Środki ograniczające (propozycje):** (a) konfiguracja gateway'a `confirmation.previewRequired` (per ryzyko
  lub per narzędzie): kod jest przyjmowany dopiero po tym, jak właściciel załadował podgląd danego
  `confirmationId` z sesji portalu. Agent nie ma sesji portalu, więc przy włączeniu człowiek co najmniej widział
  prawdziwą operację w zaufanym kanale. **Rekomendacja ws-00: włączone dla `DESTRUCTIVE`**, bo bez tego
  potwierdzenie chroni przed działaniem agenta bez człowieka, ale nie przed agentem zmanipulowanym w trakcie
  żywej sesji; (b) jedno aktywne oczekujące wywołanie na (sub, tool); (c) opis operacji i audyt zawierają to samo
  `confirmationId`, a audyt rejestruje, czy podgląd był otwarty (CC-094); (d) wiele klientów pokazuje surowe
  argumenty wywołania narzędzia niezależnie od modelu (nie gwarancja kontraktu); (e) rozważenie w przyszłości
  WebAuthn z wyzwaniem równym hashowi operacji, który wiąże zatwierdzenie z operacją (poza decyzją o
  Authenticatorze).
- **Wpływ na strumienie:** ws-05 (oczekujące wywołania, opis, flaga podglądu, wołanie brokera, tabela odpowiedzi,
  usunięcie ścieżki decyzji), ws-06 (CC-092), ws-07 (podgląd bez MFA, brak POST, CC-093), ws-08 (patrz CC-093 i
  lista ekranów), ws-09 (decyzja o regule `destructive-requires-fresh-mfa`), ws-10 (testy: powtórzenie kodu,
  blokada, inne argumenty, brak rejestracji, podgląd wymagany), ws-01 (generator TOTP do dev, np. `make totp`).
  Plan do aktualizacji przez człowieka: niezmienniki 4 i 9 w `00-overview.md`, C4/C5/C10/C11/C12 w
  `01-contracts.md`, D8 w `02-decisions.md`, briefy ws-05/06/07/08.
- **Pytania do człowieka:** (1) 2.2.0 z wyjątkiem czy 3.0.0 (rekomendacja: 3.0.0); (2) czy `previewRequired` ma
  być domyślnie włączone dla `DESTRUCTIVE` (rekomendacja: tak) i czy przy włączeniu zostaje to konfiguracją
  gateway'a, czy ma wejść do kontraktu (rekomendacja: konfiguracja); (3) czy reguła
  `destructive-requires-fresh-mfa` wypada z paczki produkcyjnej (rekomendacja: tak, żeby użytkownik nie miał dwóch
  mechanizmów); (4) czy `confirmation_declined` ma zniknąć ze schematu (rekomendacja: tak).
- **Aktualizacja przy wdrożeniu w 3.0.0:** (1) ciało `confirmation_required` ma dwie wykluczające się gałęzie, a pierwsza
  dodatkowo zabrania `registerUrl` (bez tego zestaw pending + `registerUrl` przechodziłby przez `oneOf`); (2) kod o złym
  formacie to `invalid_argument` na gateway'u, bez pytania brokera i bez zużycia próby (broker odpowiada `400`);
  (3) limit oczekujących na `sub` (domyślnie 3) dotyczy odtąd tylko potwierdzeń o ryzyku innym niż `DESTRUCTIVE`:
  operacji `DESTRUCTIVE` może czekać jedna, nowa unieważnia starą (CC-127, `confirmation_superseded`); (4) po
  rozstrzygnięciu człowieka (podgląd opcjonalny) wiersz tabeli "podgląd wymagany (konfiguracja)" nie obowiązuje, a
  audyt rozróżnia `user_confirmed` i `user_confirmed_no_preview`; (5) dzienny limit błędnych kodów wyłącza
  Authenticator (CC-126); (6) blokada 5/15 min zdejmuje się wyłącznie upływem czasu, w portalu nie ma odblokowania
  (decyzja człowieka 2026-10-28), opis w CC-092; (7) wektory: `confirmation-binding/` (32), `totp/` (39).
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-27; wydanie 3.0.0 przed M3, nie w 2.2.0). Wdrożone i wydane w 3.0.0. Dodatkowe decyzje człowieka 2026-10-28: blokada zdejmuje się tylko po 15 minutach, w portalu nie ma odblokowania; dzienny limit błędnych kodów (CC-126); jedna oczekująca operacja DESTRUCTIVE (CC-127). Rozstrzygnięcia: podgląd OPCJONALNY, bez `previewRequired`; ryzyko rezydualne (opis operacji widziany tylko w niezaufanym kliencie, gdy człowiek nie otworzy podglądu) jest świadomie przyjęte przez człowieka; step-up Entra tylko przy rejestracji i usunięciu; weryfikuje broker; limity 5 błędnych / 15 min, blokada 15 min, 3 próby na wywołanie, rejestracja 10 min; reguła `destructive-requires-fresh-mfa` wypada z paczki produkcyjnej (przykład zostaje); `confirmation_declined` usunięte; reset cudzej rejestracji przez CN `mcp-offboarding`; CC-094 wariant B (nowy `event: "authenticator"`); wyjątek w niezmienniku 4 na jednorazowy pokaz ziarna TOTP (`no-store`, tylko właściciel po MFA Entra, nigdy w logach ani audycie)

## CC-092 | C4 | Broker: rejestracja i weryfikacja Authenticatora (TOTP)

- **Zgłasza:** człowiek (pivot, decyzja 2026-10-27); część pakietu CC-091
- **Kamień:** M3 (gateway weryfikuje w M3; rejestracja może powstać wcześniej, bo ekran jest niezależny od C11)
- **Problem:** kod TOTP musi być zweryfikowany przez komponent, który zna sekret konta "MCP Platform". Sekret nie
  może trafić do gateway'a, logów ani odpowiedzi poza jednym pokazem przy rejestracji. Użytkownik musi móc
  zarejestrować, sprawdzić i usunąć swoją rejestrację; admin musi móc ją zresetować.
- **Wariant (rekomendowany): weryfikuje broker, zwraca tylko wynik.** Nowa grupa operacji `/v1/authenticator`
  w C4. Sekret (ziarno) nie opuszcza brokera po rejestracji; gateway dostaje `ok` albo powód odmowy. Ziarno
  zapisuje się tak jak poświadczenia: w `SecretStore` (OpenBao, Transit; ścieżka np.
  `mcp/authenticators/<sha256(sub)>`, odszyfrowany rekord zawiera `sub` porównywany z żądaniem), a w bazie
  brokera tylko metadane (stan, `registeredAt`, `lastUsedAt`, `lastAcceptedStep`, licznik niepowodzeń,
  `lockedUntil`). Zegar: czas serwera brokera (NTP); czas klienta nie bierze udziału.
- **Parametry TOTP:** RFC 6238 z HMAC-SHA-1, 6 cyfr, krok 30 s, ziarno 20 losowych bajtów z CSPRNG (160 bit,
  zalecenie RFC 4226), kod porównywany jako napis w stałym czasie (kod z zerem wiodącym `081804` to nie liczba).
  **SHA-1 a zgodność:** aplikacje (w tym Microsoft Authenticator dla kont dodanych kodem QR) w praktyce respektują
  tylko wartości domyślne SHA-1, 6 cyfr, 30 s; parametry `algorithm`, `digits`, `period` w URI bywają ignorowane,
  więc inne wartości dałyby kody, które aplikacja liczy inaczej. HMAC-SHA-1 nie jest podatny na znane ataki
  kolizyjne na SHA-1 (HMAC nie opiera się na odporności na kolizje), więc ryzykiem nie jest SHA-1, tylko 6 cyfr i
  wspólny sekret, ograniczane limitami poniżej. Zgodność z konkretną wersją Microsoft Authenticator wynika z mojej
  wiedzy, nie z testu; **ws-08 lub człowiek potwierdza ją na prawdziwej aplikacji przed zatwierdzeniem wpisu**.
- **Reguły weryfikacji (`verify`):**
  - Okno: kroki `t-1`, `t`, `t+1` (do ok. 90 s ważności fizycznej jednego kodu). Brak resynchronizacji zegara
    telefonu poza oknem; dryf większy niż 30 s kończy się `invalid` (użytkownik poprawia czas w telefonie).
  - Jednorazowość: broker trzyma `lastAcceptedStep`; kod z kroku `s` jest przyjęty tylko gdy `s >
    lastAcceptedStep`, a przyjęcie ustawia `lastAcceptedStep = s` jednym atomowym, warunkowym zapisem
    (`UPDATE ... WHERE last_accepted_step < :s`). Kod z kroku równego lub starszego niż ostatnio przyjęty to
    `replayed`. Skutek: dwa potwierdzenia w tym samym kroku wymagają dwóch różnych kodów (użytkownik czeka do
    następnego kroku, najwyżej 30 s). Stan przeżywa restart (baza, nie pamięć), więc restart brokera nie otwiera
    okna na powtórzenie.
  - Limity: 5 kolejnych niepowodzeń (`invalid` lub `replayed`) w 15 minut blokują weryfikację użytkownika na 15
    minut (konfiguracja). W blokadzie `verify` zwraca `locked` bez sprawdzania kodu (nie zdradza, czy był dobry).
    Sukces zeruje licznik. Limit 3 prób na oczekujące wywołanie jest w gateway'u (CC-091).
  - `verify` dla użytkownika bez aktywnej rejestracji: `not_registered`.
- **Rejestracja:**
  - `POST /v1/authenticator/enrollment` (BFF): tworzy ziarno i zwraca `otpauthUri` oraz `secret` (Base32) **jeden
    raz**; TTL rejestracji w toku 10 min; ponowne wywołanie zastępuje poprzednią rejestrację w toku. Przy aktywnej
    rejestracji `409 already_registered` (najpierw trzeba ją usunąć). Odpowiedź ma `Cache-Control: no-store`.
  - `POST /v1/authenticator/enrollment/confirm` (BFF): kod z aplikacji musi być poprawnym TOTP nowego ziarna
    (okno +-1); sukces aktywuje rejestrację i ustawia `lastAcceptedStep` na krok tego kodu, więc ten sam kod nie
    zadziała zaraz potem jako potwierdzenie operacji. Trzy błędne kody niszczą rejestrację w toku
    (`enrollment_invalid`).
  - `otpauthUri` ma stałą postać `otpauth://totp/MCP%20Platform:<username>?secret=<Base32>&issuer=MCP%20Platform&algorithm=SHA1&digits=6&period=30`
    (`username` kodowany procentowo). QR rysuje frontend lokalnie; URI nigdy nie trafia do zewnętrznego
    generatora QR.
- **Zmiany plików (szkic `openapi/credential-broker.v1.yaml`):**

```yaml
  /v1/authenticator:
    get:
      tags: [authenticator]
      operationId: getAuthenticator
      x-allowed-client-cn: [mcp-portal-bff, mcp-gateway]
      summary: State of the current user's authenticator registration (no secret).
      security:
        - mtls: []
          bffUserToken: []
        - mtls: []
          gatewayInternalJwt: []
      responses:
        '200':
          description: State of the registration of the calling user.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthenticatorStatus'
              examples:
                none:
                  value:
                    state: none
                active:
                  value:
                    state: active
                    registeredAt: '2026-10-27T09:00:00Z'
                    lastUsedAt: '2026-10-27T09:30:00Z'
                locked:
                  value:
                    state: active
                    registeredAt: '2026-10-27T09:00:00Z'
                    lockedUntil: '2026-10-27T10:00:00Z'
        '401':
          $ref: '#/components/responses/Unauthenticated'
        '503':
          $ref: '#/components/responses/UpstreamUnavailable'
    delete:
      tags: [authenticator]
      operationId: deleteAuthenticator
      x-allowed-client-cn: [mcp-portal-bff]
      summary: Remove the current user's registration. Idempotent.
      security:
        - mtls: []
          bffUserToken: []
      responses:
        '204':
          description: Removed (or there was none).
        '401':
          $ref: '#/components/responses/Unauthenticated'
        '503':
          $ref: '#/components/responses/UpstreamUnavailable'
  /v1/authenticator/enrollment:
    post:
      tags: [authenticator]
      operationId: startAuthenticatorEnrollment
      x-allowed-client-cn: [mcp-portal-bff]
      summary: Create a seed and show it once. The only response of C4 besides resolve that carries a secret.
      security:
        - mtls: []
          bffUserToken: []
      responses:
        '201':
          description: Seed shown once; it cannot be read again.
          headers:
            Cache-Control:
              $ref: '#/components/headers/NoStore'
            Pragma:
              $ref: '#/components/headers/PragmaNoCache'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthenticatorEnrollment'
        '409':
          description: A registration is already active; remove it first.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                already_registered:
                  value:
                    error: already_registered
        '429':
          description: Too many enrollment starts for this user (broker limit).
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                rate_limited:
                  value:
                    error: rate_limited
        '401':
          $ref: '#/components/responses/Unauthenticated'
        '503':
          $ref: '#/components/responses/UpstreamUnavailable'
  /v1/authenticator/enrollment/confirm:
    post:
      tags: [authenticator]
      operationId: confirmAuthenticatorEnrollment
      x-allowed-client-cn: [mcp-portal-bff]
      summary: Activate the registration with the first code from the app.
      security:
        - mtls: []
          bffUserToken: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AuthenticatorEnrollmentConfirm'
      responses:
        '200':
          description: Registration active.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthenticatorStatus'
        '422':
          description: invalid_code (try again) or enrollment_invalid (expired, unknown, destroyed after three wrong codes).
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthenticatorEnrollmentError'
        '401':
          $ref: '#/components/responses/Unauthenticated'
        '503':
          $ref: '#/components/responses/UpstreamUnavailable'
  /v1/authenticator/verify:
    post:
      tags: [authenticator]
      operationId: verifyAuthenticatorCode
      x-allowed-client-cn: [mcp-gateway]
      summary: Verify a code of the calling user (internal JWT user variant with tool). Returns only the result.
      security:
        - mtls: []
          gatewayInternalJwt: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AuthenticatorVerifyRequest'
      responses:
        '200':
          description: Result of the check; the seed never appears. Any other status is a failure for the caller (fail-closed).
          headers:
            Cache-Control:
              $ref: '#/components/headers/NoStore'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthenticatorVerifyResult'
              examples:
                ok:
                  value:
                    result: ok
                locked:
                  value:
                    result: locked
                    retryAfterSeconds: 840
        '401':
          $ref: '#/components/responses/Unauthenticated'
        '503':
          $ref: '#/components/responses/UpstreamUnavailable'
  /v1/admin/users/{sub}/authenticator/reset:
    parameters:
      - name: sub
        in: path
        required: true
        schema:
          type: string
          minLength: 1
          maxLength: 255
    post:
      tags: [admin]
      operationId: resetUserAuthenticator
      x-allowed-client-cn: [mcp-offboarding]
      summary: Remove the registration of a user (lost phone after Entra MFA was lost too). Idempotent.
      security:
        - mtls: []
      responses:
        '204':
          description: Removed (or there was none).
        '503':
          $ref: '#/components/responses/UpstreamUnavailable'
```

```yaml
    AuthenticatorStatus:
      type: object
      required: [state]
      properties:
        state:
          type: string
          enum: [none, active]
        registeredAt:
          $ref: '../schemas/common.schema.json#/$defs/Timestamp'
        lastUsedAt:
          $ref: '../schemas/common.schema.json#/$defs/Timestamp'
        lockedUntil:
          description: Present while verification is blocked after repeated wrong codes.
          $ref: '../schemas/common.schema.json#/$defs/Timestamp'
      additionalProperties: false
    AuthenticatorEnrollment:
      type: object
      required: [enrollmentId, otpauthUri, secret, expiresAt]
      properties:
        enrollmentId:
          type: string
          pattern: '^[A-Za-z0-9_-]{16,128}$'
        otpauthUri:
          type: string
          format: uri
          pattern: '^otpauth://totp/'
        secret:
          description: Seed, Base32 without padding, shown once for manual entry. Never logged, audited or stored by the BFF or the browser.
          type: string
          pattern: '^[A-Z2-7]{32}$'
        expiresAt:
          $ref: '../schemas/common.schema.json#/$defs/Timestamp'
      additionalProperties: false
    AuthenticatorEnrollmentConfirm:
      type: object
      required: [enrollmentId, code]
      properties:
        enrollmentId:
          type: string
          pattern: '^[A-Za-z0-9_-]{16,128}$'
        code:
          $ref: '../schemas/common.schema.json#/$defs/ConfirmationCode'
      additionalProperties: false
    AuthenticatorEnrollmentError:
      type: object
      required: [error]
      properties:
        error:
          type: string
          enum: [invalid_code, enrollment_invalid]
      additionalProperties: false
    AuthenticatorVerifyRequest:
      type: object
      required: [code]
      properties:
        code:
          $ref: '../schemas/common.schema.json#/$defs/ConfirmationCode'
      additionalProperties: false
    AuthenticatorVerifyResult:
      type: object
      required: [result]
      properties:
        result:
          type: string
          enum: [ok, invalid, replayed, locked, not_registered]
        retryAfterSeconds:
          description: Present with locked.
          type: integer
          minimum: 1
      additionalProperties: false
      if:
        properties:
          result:
            const: locked
        required: [result]
      then:
        required: [retryAfterSeconds]
```

  Dodatkowo: `POST /v1/admin/users/{sub}/purge` usuwa także rejestrację Authenticatora; README, tabela C2: nowe wiersze
  "broker `GET /v1/authenticator` i `POST /v1/authenticator/verify` z gateway'a: tylko wariant użytkownika, `tool`
  wymagany (narzędzie, które jest potwierdzane)"; opis `info`: ziarno Authenticatora wychodzi z brokera tylko
  w `201` rejestracji do właściciela. `ConfirmationCode` w opisach C4 jako "kod 6 cyfr z aplikacji".
  Wszystkie nowe operacje dziedziczą `503 upstream_unavailable` (CC-064) i `X-Request-Id` (CC-047).
- **Alternatywy dla miejsca weryfikacji:**
  - A. Weryfikuje broker (rekomendowane, jak wyżej).
  - B. Gateway pobiera ziarno z brokera i liczy sam. Odrzucone: ziarno opuszcza broker i trafia do pamięci
    gateway'a, `resolve` musiałby je zwracać (rozszerzenie niezmiennika 4), a cache złamałby jednorazowość kroku
    między instancjami.
  - C. Silnik TOTP w OpenBao (ziarno nie trafia nawet do pamięci brokera). Jeśli używana wersja OpenBao go ma
    (do sprawdzenia przez ws-06), jest dopuszczalną implementacją wariantu A, o ile zachowuje reguły
    jednorazowości (krok, nie czas), okna +-1 i blokady z powyższej listy; kontrakt się nie zmienia.
- **Wektory (nowe, `test-vectors/totp/`):** ziarno testowe z RFC 6238 (`12345678901234567890`, Base32
  `GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ`, oznaczone NOT FOR PRODUCTION jak klucze w `keys/`). Wartości policzone i
  sprawdzone skryptem, 6 cyfr to ostatnie 6 z 8-cyfrowych wartości z RFC 6238, dodatek B:
  - `rfc6238-sha1.json`: `t=59 -> 287082`, `1111111109 -> 081804`, `1111111111 -> 050471`, `1234567890 -> 005924`,
    `2000000000 -> 279037`, `20000000000 -> 353130`.
  - `verify-*.json` (stały czas `at` = 1792000030, 2026-10-14T17:47:10Z, krok 59733334; kody kroków: 59733332
    `738171`, 59733333 `405874`, 59733334 `705202`, 59733335 `165886`, 59733336 `129711`; pola: `secret`, `at`,
    `lastAcceptedStep`, `code`, `expected.result`):
    `valid-current` (`705202`, brak historii -> ok, nowy `lastAcceptedStep` 59733334), `valid-previous-step`
    (`405874` -> ok), `valid-next-step` (`165886` -> ok), `invalid-two-steps-back` (`738171` -> invalid),
    `invalid-two-steps-ahead` (`129711` -> invalid), `replayed-same-step` (`705202`, last 59733334 -> replayed),
    `replayed-older-step` (`405874`, last 59733334 -> replayed), `valid-next-step-after-use` (`165886`, last
    59733334 -> ok), `invalid-format-5-digits`, `invalid-format-7-digits`, `invalid-format-letter`,
    `invalid-format-leading-space`, `leading-zero-is-text` (`081804` przy `at`=1111111109 -> ok; `81804` ->
    invalid format).
  - `lockout-*.json`: sekwencja (czas, kod, wynik): 5 błędnych w 15 minut -> szósty (nawet poprawny) `locked`;
    po 15 minutach poprawny -> ok; sukces między błędnymi zeruje licznik; 4 błędne + poprawny -> ok.
  - `enrollment-*.json`: poprawny kod aktywuje i ustawia `lastAcceptedStep`; kod użyty przy rejestracji jest po
    chwili `replayed`; trzy błędne niszczą rejestrację w toku; po TTL 10 min `enrollment_invalid`.
  - `otpauth-uri.json`: `username=jkowalski` -> dokładny URI; `username=a b` (spacja) -> `a%20b`.
  - Kontrola referencyjna w `test/` (Node, `node:crypto`) i w teście Javy; broker (ws-06) i gateway (stub brokera)
    używają tych samych plików.
  - Audyt: wektory w CC-094.
- **SemVer:** nowe endpointy, schematy i wektory = minor. Pakiet pivotu jako całość: patrz CC-091.
- **Wpływ na strumienie:** ws-06 (całość: endpointy, SecretStore, metadane, blokada, zegar, audyt, `purge`), ws-05
  (klient brokera, fail-closed), ws-07 (CC-093), ws-01 (OpenBao: ścieżka, polityka dla brokera; NTP; generator
  kodów dla dev i testów e2e), ws-10 (testy z wektorów, brak ziarna w logach).
  **Niezmiennik 4** (`00-overview.md`: "Żaden endpoint nie zwraca sekretu do przeglądarki") wymaga zapisu wyjątku:
  ziarno TOTP jest widoczne dla właściciela raz, przy rejestracji (człowiek aktualizuje plan).
- **Pytania do człowieka:** (1) kto może resetować cudzą rejestrację: ten sam CN `mcp-offboarding` co `purge`
  (rekomendacja: tak, jeden kanał helpdesk/IGA, osobny CN dopiero gdy pojawi się inny proces); (2) czy limity
  (5 błędnych, 15 min) i TTL rejestracji (10 min) są akceptowalne jako wartości domyślne.
- **Aktualizacja przy wdrożeniu w 3.0.0:** blokada jest własnością użytkownika, nie rejestracji: usunięcie, ponowna
  rejestracja i reset (`mcp-offboarding`) jej nie zdejmują, zdejmuje ją tylko upływ 15 minut (decyzja człowieka
  2026-10-28), więc `state: none` może mieć `lockedUntil`. Okno weryfikacji i jednorazowość kroku jak w szkicu;
  `verify` z kodem o złym formacie to `400`, bez wpływu na liczniki. Wektory TOTP mają format sekwencji kroków
  (`initial`, `steps`) i referencję w `scripts/lib/totp.mjs`; test Javy z szkicu nie powstał (broker wykonuje wektory
  we własnym teście). Pytanie otwarte człowieka (zgłoszenie z przeglądu): czy reset przez CN `mcp-offboarding` zostaje;
  w tym wydaniu bez zmian (jak w rozstrzygnięciu CC-091).
- **Doprecyzowania po przeglądzie 3.0.0:** (1) atomowość: sprawdzenie blokady/wyłączenia, liczniki 5/15 min i 20/24 h
  oraz blokada to jeden krok atomowy na `sub` (serializacja albo rezerwacja próby warunkowym zapisem przed obliczeniem
  TOTP); wektory `totp/concurrent-*` (50 równoległych błędnych kodów dają dokładnie 5 sprawdzeń); (2) przechowywanie
  ziarna: Transit bez envelope, ścieżka `mcp/authenticators/<sha256(sub)>`, `sub` w odszyfrowanym rekordzie, ziarno
  rejestracji w toku tylko zaszyfrowane, TTL 10 min i usunięcie po aktywacji, po TTL i po trzecim błędzie, baza tylko
  metadane, nigdy jawnie w Redis ani w bazie; (3) broker ufa BFF (mTLS CN `mcp-portal-bff`) co do świeżości MFA przy
  rejestracji i usunięciu: świadome założenie, broker nie sprawdza `auth_time`/`acr` sam (możliwa druga kontrola, jeśli
  IdP przeniesie claimy przez token exchange; nie wprowadzona); (4) aktywacja nowej rejestracji zeruje liczniki i stan
  `disabled`, nie zeruje blokady użytkownika (decyzja człowieka 2026-10-28, `activate` w `scripts/lib/totp.mjs`).
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-27; wydanie 3.0.0 przed M3, nie w 2.2.0). Wdrożone i wydane w 3.0.0. Dodatkowe decyzje człowieka 2026-10-28: blokada zdejmuje się tylko po 15 minutach, w portalu nie ma odblokowania; dzienny limit błędnych kodów (CC-126); jedna oczekująca operacja DESTRUCTIVE (CC-127). Rozstrzygnięcia: podgląd OPCJONALNY, bez `previewRequired`; ryzyko rezydualne (opis operacji widziany tylko w niezaufanym kliencie, gdy człowiek nie otworzy podglądu) jest świadomie przyjęte przez człowieka; step-up Entra tylko przy rejestracji i usunięciu; weryfikuje broker; limity 5 błędnych / 15 min, blokada 15 min, 3 próby na wywołanie, rejestracja 10 min; reguła `destructive-requires-fresh-mfa` wypada z paczki produkcyjnej (przykład zostaje); `confirmation_declined` usunięte; reset cudzej rejestracji przez CN `mcp-offboarding`; CC-094 wariant B (nowy `event: "authenticator"`); wyjątek w niezmienniku 4 na jednorazowy pokaz ziarna TOTP (`no-store`, tylko właściciel po MFA Entra, nigdy w logach ani audycie)

## CC-093 | C12 | BFF: rejestracja Authenticatora ze step-up MFA Entra

- **Zgłasza:** człowiek (pivot, decyzja 2026-10-27); część pakietu CC-091
- **Kamień:** M3 (ekran rejestracji może wejść w M2, jeśli broker ma endpointy wcześniej)
- **Problem:** użytkownik rejestruje w portalu osobne konto "MCP Platform" w aplikacji TOTP, przez kod QR
  (`otpauth` URI). Portal musi też pokazać stan rejestracji, pozwolić ją usunąć i obsłużyć brak rejestracji przy
  próbie potwierdzenia (link `registerUrl` z CC-091).
- **Wariant:** endpointy C12 jako cienkie proxy do CC-092 (sub zawsze z sesji, ziarno nie jest zapisywane w
  sesji ani logowane):

| Metoda i ścieżka | Opis | Step-up MFA |
| --- | --- | --- |
| `GET /api/v1/authenticator` | `AuthenticatorStatus` (`none` / `active`, `registeredAt`, `lastUsedAt`, `lockedUntil`) | nie |
| `POST /api/v1/authenticator/enrollment` | `201 AuthenticatorEnrollment` (`otpauthUri`, `secret`, `expiresAt`), `no-store`; BFF zapisuje w sesji tylko `enrollmentId` | **tak** |
| `POST /api/v1/authenticator/enrollment/confirm` | body `{enrollmentId, code}`; `200 AuthenticatorStatus` albo `422 invalid_code` / `enrollment_invalid`; `enrollmentId` musi należeć do bieżącej sesji | nie (rejestracja w toku powstała pod świeżym MFA) |
| `DELETE /api/v1/authenticator` | usuwa własną rejestrację, `204` | **tak** |

  Wszystkie modyfikujące wymagają `X-XSRF-TOKEN`. Brak świeżego MFA: `401 StepUpOrUnauthenticated` z `stepUpUrl`
  (`returnPath` = strona rejestracji, CC-048). `409 already_registered` przy starcie, gdy rejestracja jest aktywna
  (użytkownik najpierw ją usuwa, ze step-up). `429 rate_limited` z limitu brokera. `503` jak w CC-050.
- **Dlaczego rejestracja i reset wymagają MFA Entra, a każde potwierdzenie nie:** rejestracja jest
  **korzeniem zaufania** całego mechanizmu. Kto potrafi zarejestrować własną aplikację, może potem zatwierdzać
  akcje destrukcyjne. Bez step-up wystarczy przejęta sesja portalu albo agent sterujący przeglądarką zalogowanego
  użytkownika (computer use): zarejestrowałby własny sekret, odczytałby go z ekranu i sam zatwierdzał swoje
  wywołania. Świeże MFA Entra (push z numerem na telefonie użytkownika) to niezależny czynnik, którego taki
  napastnik nie ma. Rejestracja i usunięcie zdarzają się rzadko, więc koszt dla użytkownika jest znikomy, a
  codzienne potwierdzenia pozostają szybkie (sam kod). Utrata telefonu: użytkownik loguje się z MFA Entra,
  usuwa rejestrację i rejestruje nową; utrata także czynnika Entra: reset przez helpdesk/IGA (CC-092) i ponowna
  rejestracja ze step-up.
- **Wymagania dla ekranu (do briefu ws-08):** QR rysowany lokalnie z `otpauthUri` (bez zewnętrznych usług QR),
  `secret` do ręcznego wpisania, wartości tylko w pamięci komponentu (bez `localStorage`, adresu, tytułu karty,
  historii), `autocomplete=off`, czyszczenie po zakończeniu i przy opuszczeniu strony; zgodność z konkretną
  aplikacją Authenticator (CC-092).
- **Zmiany plików (szkic `openapi/portal-bff.v1.yaml`):** tag `authenticator`; cztery operacje z tabeli
  (`getMyAuthenticator`, `startMyAuthenticatorEnrollment`, `confirmMyAuthenticatorEnrollment`,
  `deleteMyAuthenticator`) z `$ref` do schematów C4 (`credential-broker.v1.yaml#/components/schemas/Authenticator*`),
  nagłówkami `NoStore` na `201` oraz odpowiedziami `StepUpOrUnauthenticated`, `CsrfInvalid`,
  `UpstreamUnavailable`; `info.description`: zdanie "Secrets go only from the browser to the BFF" uzupełnione o
  wyjątek "oraz jednorazowy pokaz ziarna Authenticatora przy rejestracji (CC-093)"; `Me.mfaFreshUntil` (opis z
  CC-090). `getMyConfirmation`: link do rejestracji nie jest w tym widoku (jest w `registerUrl` błędu C10).
- **Wektory / testy:** przykłady OpenAPI i MSW (`Prefer: example=...`: `none`, `active`, `locked`,
  `step_up_required`, `already_registered`, `invalid_code`, `enrollment_invalid`); test mocków: odpowiedź `201`
  ma `Cache-Control: no-store`, a żadna inna odpowiedź C12 nie zawiera pola `secret` ani `otpauthUri`.
- **SemVer:** nowe endpointy i schematy = minor. Pakiet pivotu: CC-091.
- **Wpływ na strumienie:** ws-07 (proxy, step-up przez istniejący mechanizm, `enrollmentId` w sesji, bez logowania
  ciał), ws-08 (nowa strona rejestracji Authenticatora z kreatorem QR / klucz ręczny / pierwszy kod, stan i usunięcie rejestracji, baner o braku rejestracji przy narzędziach z `requiresConfirmation`, strona podglądu tylko do odczytu; lista pełna w raporcie koordynatora), ws-06 (CC-092), ws-10 (test: żadne logi BFF ani brokera nie zawierają
  ziarna ani `otpauthUri`; rejestracja bez świeżego MFA odrzucona).
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-27; wydanie 3.0.0 przed M3, nie w 2.2.0). Wdrożone i wydane w 3.0.0. Dodatkowe decyzje człowieka 2026-10-28: blokada zdejmuje się tylko po 15 minutach, w portalu nie ma odblokowania; dzienny limit błędnych kodów (CC-126); jedna oczekująca operacja DESTRUCTIVE (CC-127). Rozstrzygnięcia: podgląd OPCJONALNY, bez `previewRequired`; ryzyko rezydualne (opis operacji widziany tylko w niezaufanym kliencie, gdy człowiek nie otworzy podglądu) jest świadomie przyjęte przez człowieka; step-up Entra tylko przy rejestracji i usunięciu; weryfikuje broker; limity 5 błędnych / 15 min, blokada 15 min, 3 próby na wywołanie, rejestracja 10 min; reguła `destructive-requires-fresh-mfa` wypada z paczki produkcyjnej (przykład zostaje); `confirmation_declined` usunięte; reset cudzej rejestracji przez CN `mcp-offboarding`; CC-094 wariant B (nowy `event: "authenticator"`); wyjątek w niezmienniku 4 na jednorazowy pokaz ziarna TOTP (`no-store`, tylko właściciel po MFA Entra, nigdy w logach ani audycie)

## CC-094 | C8 | Zdarzenia audytu dla Authenticatora i potwierdzeń kodem

- **Zgłasza:** człowiek (pivot); część pakietu CC-091
- **Kamień:** M3
- **Problem:** rejestracja, reset, weryfikacja kodu (ok, błąd, powtórzenie, blokada) i potwierdzenia kodem muszą
  być w audycie jednym `requestId` z wywołaniem narzędzia (niezmiennik 10), bez kodu, ziarna i `otpauthUri`
  (niezmiennik 7). Dziś `event: confirmation` ma znane powody `user_confirmed`, `user_declined`,
  `confirmation_expired`.
- **Wariant B (rekomendowany z wydaniem 3.0.0): nowa wartość `event: "authenticator"`.** Jedno zdarzenie dla cyklu
  życia rejestracji i weryfikacji kodu; SIEM filtruje po `event`. Znane wartości `reason` (wzorzec, nie enum):
  - rejestracja (broker i BFF, `outcome: ok|denied`): `authenticator_enrollment_started`, `authenticator_registered`,
    `authenticator_enrollment_failed`, `authenticator_removed`, `authenticator_reset_by_admin` (broker, `sub`
    celu; aktor to CN klienta mTLS, bez pola `actor` w C8);
  - weryfikacja (broker, `decision: allow|deny`): `totp_verified`, `totp_invalid`, `totp_replayed`,
    `totp_locked`, `totp_not_registered`; zdarzenie niesie `tool` i `virtualServer`/`client` z JWT od gateway'a;
  - gateway zostaje przy `event: confirmation` (powstanie oczekującego: `decision: confirmation_pending`; skutek:
    `user_confirmed`, `user_confirmed_no_preview` gdy podgląd nie był otwarty, `confirmation_expired`,
    `attempts_exhausted`, `preview_not_viewed`, `authenticator_not_registered`), a wykonane narzędzie to `tool_call`
    z tym samym `requestId` ponowienia. `user_declined` nie jest już emitowane.
  Schemat: `event` dostaje `"authenticator"`; reguła `allOf` wymaga dla niego `outcome` i `reason`; opis `reason`
  uzupełniony o nowe znane wartości; opis pliku: "Never ... confirmation codes, TOTP codes, authenticator seeds or
  otpauth URIs". Pola bez zmian (`additionalProperties: false` nadal blokuje pole `code`).
- **Wariant A (bez zmiany enum, minor):** weryfikacja jako `confirmation` (`decision` allow/deny, te same
  `reason`), cykl życia rejestracji jako `admin_change`. Wada: zdarzenia rejestracji mieszają się z zatwierdzaniem
  definicji narzędzi przez adminów w tym samym `event`.
- **Wektory:** `audit-events/broker-authenticator-registered.json`, `broker-authenticator-verify-ok.json`,
  `broker-authenticator-verify-replayed.json`, `broker-authenticator-verify-locked.json`,
  `portal-authenticator-removed.json`, `broker-authenticator-reset-by-admin.json`,
  `gateway-confirmation-user-confirmed.json`, `gateway-confirmation-preview-not-viewed.json`; odrzucane:
  `invalid-authenticator-with-code.json` (pole `code`), `invalid-authenticator-with-secret.json`,
  `invalid-authenticator-without-reason.json`, `invalid-authenticator-outcome-missing.json`. Istniejący
  `audit-events/invalid-confirmation-code.json` zostaje.
- **SemVer:** wariant B: nowa wartość enum, według README **major** (SIEM i testy walidujące `event` zamkniętą listą
  muszą dodać `authenticator` przed aktualizacją producentów, jak przy CC-071); mieści się w 3.0.0 bez wyjątku.
  Wariant A: minor (nowe znane wartości `reason`). Rekomendacja ws-00: B przy 3.0.0, A przy wyjątku w 2.2.0.
- **Wpływ na strumienie:** ws-06, ws-05, ws-07 (emisja), ws-10 (test: ani kod, ani ziarno nie występują w logach i
  audycie; jeden `requestId` obejmuje BFF, broker i gateway), operator SIEM (nowa wartość `event`).
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-27; wydanie 3.0.0 przed M3, nie w 2.2.0). Wdrożone i wydane w 3.0.0. Dodatkowe decyzje człowieka 2026-10-28: blokada zdejmuje się tylko po 15 minutach, w portalu nie ma odblokowania; dzienny limit błędnych kodów (CC-126); jedna oczekująca operacja DESTRUCTIVE (CC-127). Rozstrzygnięcia: podgląd OPCJONALNY, bez `previewRequired`; ryzyko rezydualne (opis operacji widziany tylko w niezaufanym kliencie, gdy człowiek nie otworzy podglądu) jest świadomie przyjęte przez człowieka; step-up Entra tylko przy rejestracji i usunięciu; weryfikuje broker; limity 5 błędnych / 15 min, blokada 15 min, 3 próby na wywołanie, rejestracja 10 min; reguła `destructive-requires-fresh-mfa` wypada z paczki produkcyjnej (przykład zostaje); `confirmation_declined` usunięte; reset cudzej rejestracji przez CN `mcp-offboarding`; CC-094 wariant B (nowy `event: "authenticator"`); wyjątek w niezmienniku 4 na jednorazowy pokaz ziarna TOTP (`no-store`, tylko właściciel po MFA Entra, nigdy w logach ani audycie)

## CC-095 | C5/C12 | `GET /api/v1/activity/calls` i rzut `ActivityCall`

- **Zgłasza:** analiza luk G-11, G-12, G-13; kierunek zatwierdzony przez człowieka 2026-10-27; jedno wywołanie = jeden
  wiersz z wynikiem końcowym i liczbą błędnych kodów (decyzja człowieka 2026-10-28)
- **Kamień:** M3 (ekran logów od M2 jako lista na starym `GET /activity`; filtry i stany od M3), wydanie z kamieniem M3
- **Problem:** `GET /api/v1/activity` zwraca surowe zdarzenia C8 z samym `limit`. (G-11) Brak filtrów
  (szukaj, okres, wynik) i stronicowania; filtrowanie w przeglądarce na 200 rekordach daje niepełny obraz bez
  ostrzeżenia, a gateway trzyma 30 dni. (G-12) Jedno wywołanie to kilka zdarzeń (`policy_decision`,
  `confirmation`, `tool_call`), a pierwsze wywołanie i ponowienia z kodem mają różne `requestId`; C8 nie ma
  `confirmationId`, więc tylko gateway powiąże "czeka na potwierdzenie" z rozstrzygnięciem i policzy błędne kody.
  (G-13) Kolumna "Zasób" i pełna nazwa narzędzia (`<system>__<tool>`) powinny być liczone w jednym miejscu.
- **Wariant:** nowy endpoint `GET /api/v1/activity/calls` (proxy do C5 `GET /admin/v1/activity/calls`).
  **Jedno wywołanie narzędzia to jeden wiersz** `ActivityCall`, liczony w gateway'u ze zdarzeń wywołania i jego
  ponowień oraz z wewnętrznego powiązania z `confirmationId` (które nie wychodzi poza gateway: ani do C8, ani do
  przeglądarki). Wiersz niesie **wynik końcowy** (`result`) i **liczbę błędnych kodów** (`wrongCodeCount`, szczegół
  wiersza). `requestId` i `ts` wiersza to `requestId` i czas pierwszego żądania (tego, które utworzyło oczekujące
  wywołanie); ponowienia z kodem nie tworzą własnych wierszy. Filtry `from`, `to`, `result` (grupa), `q`, kursor w
  nagłówku `X-Next-Cursor`. Stary `GET /api/v1/activity` zostaje bez zmian (odpowiedź tablicą zdarzeń C8). `sub`
  zawsze z tokenu BFF, nigdy z parametru; `q` dopasowuje tylko nazwę narzędzia i `resource.id` (argumentów nie ma w
  danych), długość ograniczona, zapytanie parametryzowane. Ograniczenie: gateway widzi tylko swoje zdarzenia
  (`component: gateway`); odmowa serwera MCP na zasobie (`not_found_or_denied`) jest widoczna tylko jako `result: error`,
  `errorCode: not_found_or_denied` w wywołaniu, które przeszło przez gateway.
- **Wyniki** (lista z `design/ekrany-authenticator-i-poprawki.txt`; "Odrzucone przez Ciebie" usunięte, bo po pivocie
  nie ma decyzji w portalu, a odmowa to niewpisanie kodu):

| Etykieta w portalu | `result` | Grupa filtra `result` |
| --- | --- | --- |
| Wykonano | `ok` | `ok` |
| Odmowa (brak uprawnienia) | `denied_not_granted` | `denied` |
| Odmowa (poza zakresem linku) | `denied_link_scope` | `denied` |
| Odmowa (polityka) | `denied_policy` | `denied` |
| Czeka na potwierdzenie | `confirmation_pending` | `confirmation` |
| Potwierdzone kodem | `confirmed` | `confirmation` |
| Wygasło | `expired` | `confirmation` |
| Błędny kod | `confirmation_failed` | `confirmation` |
| Zastąpione nowszą operacją (CC-127) | `superseded` | `confirmation` |
| Anulowane (CC-128) | `cancelled` | `confirmation` |
| Odrzucone, bo oczekuje inna operacja z otwartym podglądem (CC-127) | `blocked_by_pending` | `confirmation` |
| Błąd | `error` (z `errorCode`) | `error` |

  Wyniki pomocnicze spoza listy etykiet makiet, które gateway już zna z C10: `tool_disabled`, `credential_required`,
  `rate_limited`, `step_up_required` (grupa `denied` dla pierwszych trzech i `error` dla ostatniego; frontend pokazuje
  nieznaną wartość jako etykietę ogólną). Reguły wyniku końcowego wywołania z potwierdzeniem: wykonane po poprawnym
  kodzie to `confirmed` (nie `ok`; `wrongCodeCount` mówi, ile błędnych kodów było wcześniej); trzy błędne kody to
  `confirmation_failed`; brak poprawnego kodu przez 120 s to `expired`; unieważnienie przez nowszą operację to
  `superseded`; do rozstrzygnięcia to `confirmation_pending`. `wrongCodeCount` liczy odpowiedzi brokera `invalid` i `replayed`
  tego wywołania (0..3); nie liczy `locked`, ponowienia po upływie TTL (`confirmation_expired`), ponowień po wyczerpaniu prób
  ani wywołania odrzuconego jako `blocked_by_pending` (tam pola nie ma). Agregacja dostaje bieżący czas: wywołanie bez
  ponowienia, starsze niż 120 s, to `expired` (gateway nie emituje zdarzenia przy upływie TTL); zdarzenia po pierwszym
  końcowym (np. dalsze ponowienia po `attempts_exhausted`) nie zmieniają wiersza.
  Kursor `X-Next-Cursor` jest nieprzezroczysty, niesie tylko pozycję i jest uwierzytelniony przez gateway (np. HMAC
  związany z `sub`); zmieniony, cudzy lub przeterminowany kursor to `400`, a `sub`, filtry i okno 30 dni zawsze pochodzą z
  bieżącego żądania. Widok to tylko własne wywołania, także dla administratora (widoku cudzych wywołań w 3.0.0 nie ma).
  `resource` w wierszu ma te same ograniczenia co C8 (bez znaków sterujących i bidi w `id`).
- **Zmiany plików:** `openapi/portal-bff.v1.yaml` i `openapi/gateway-admin.v1.yaml`:

```yaml
  /api/v1/activity/calls:
    get:
      tags: [activity]
      operationId: listMyActivityCalls
      summary: My tool calls, one row per call, with filters (from gateway audit, without arguments).
      security:
        - session: []
      parameters:
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 200
            default: 50
        - name: from
          in: query
          required: false
          schema:
            $ref: '../schemas/common.schema.json#/$defs/Timestamp'
        - name: to
          in: query
          required: false
          schema:
            $ref: '../schemas/common.schema.json#/$defs/Timestamp'
        - name: result
          in: query
          required: false
          description: Result group. confirmation covers pending, confirmed, expired, failed and superseded confirmations.
          schema:
            type: string
            enum: [ok, denied, error, confirmation]
        - name: q
          in: query
          required: false
          description: Case-insensitive substring of the qualified tool name or of resource.id. Never matches argument values (they are not stored).
          schema:
            type: string
            minLength: 1
            maxLength: 64
        - name: cursor
          in: query
          required: false
          description: Opaque value of the X-Next-Cursor header of the previous page.
          schema:
            type: string
            maxLength: 256
      responses:
        '200':
          description: Newest first; at most 30 days back. X-Next-Cursor is present when more rows exist.
          headers:
            X-Next-Cursor:
              required: false
              schema:
                type: string
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ActivityCall'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthenticated'
        '503':
          $ref: '#/components/responses/UpstreamUnavailable'
```

```yaml
    ActivityCall:
      type: object
      required: [requestId, ts, tool, result]
      properties:
        requestId:
          description: requestId of the first request of the call (the one that created a pending confirmation, if any).
          $ref: '../schemas/common.schema.json#/$defs/RequestId'
        ts:
          description: Time of that first request.
          $ref: '../schemas/common.schema.json#/$defs/Timestamp'
        client:
          type: string
          maxLength: 255
          description: Client id (azp), e.g. claude-code; the UI maps it to a display name.
        virtualServer:
          $ref: '../schemas/common.schema.json#/$defs/VirtualServerSlug'
        tool:
          $ref: '../schemas/common.schema.json#/$defs/QualifiedToolName'
        risk:
          $ref: '../schemas/common.schema.json#/$defs/Risk'
        resource:
          type: object
          required: [type, id]
          properties:
            type:
              $ref: '../schemas/common.schema.json#/$defs/ResourceType'
            id:
              type: string
              maxLength: 512
            parent:
              type: string
              maxLength: 600
          additionalProperties: false
        result:
          type: string
          pattern: '^[a-z][a-z0-9_]*$'
          maxLength: 64
          description: |
            Final state of the call. Known values: ok, error, denied_not_granted, denied_link_scope, denied_policy,
            tool_disabled, credential_required, rate_limited, step_up_required, confirmation_pending, confirmed,
            expired, confirmation_failed, superseded, blocked_by_pending, cancelled. A client must show an unknown value as a generic label.
        wrongCodeCount:
          description: Number of wrong confirmation codes (invalid or replayed) given for this call; only for calls that needed a confirmation.
          type: integer
          minimum: 0
          maximum: 3
        errorCode:
          oneOf:
            - $ref: '../schemas/common.schema.json#/$defs/ErrorCode'
            - type: 'null'
      additionalProperties: false
```

  `result` jest otwartym ciągiem ze znanymi wartościami (jak `reason` w C8), bo zamknięty enum wymagałby wydania
  major przy każdej nowej wartości. Odpowiednik C5 z `x-allowed-client-cn: [mcp-portal-bff]`. Stronicowanie
  nagłówkiem zamiast `{items, next}` utrzymuje odpowiedź tablicą. Do opisu `reason` w `audit-event.schema.json`
  dopisana znana wartość `link_scope` (odmowa przez regułę zawężenia linku; patch, bo `reason` ma wzorzec).
  Poprawić dane makiet: `logs-app-*` (gwiazdka zabroniona w `OpenSearchIndexName`) na prefiks `logs-app`,
  `payments/api !412` (MR nie jest typem zasobu) na `payments/api`, `GitLab: payments/*` na `payments` z dopiskiem
  "z podgrupami"; kolejność argumentów w makietach potwierdzenia wg nazwy (`pageId`, `spaceKey`, ...); na planszy 06
  scalić wiersze pierwszego wywołania i ponowień (R-5).
- **Wektory / testy:** `test-vectors/activity-calls/`: przykłady `ActivityCall` (`valid-ok`, `valid-confirmed-with-wrong-codes`,
  `valid-confirmation-pending`, `valid-expired`, `valid-superseded`, `valid-unknown-result`, `valid-no-resource`),
  odrzucane (`invalid-result-uppercase`, `invalid-contains-arguments`, `invalid-contains-code`,
  `invalid-wrong-code-count-4`, `invalid-resource-extra-field`) oraz `aggregation-*.json` (wejście: zdarzenia C8
  pierwszego wywołania i ponowień jednego wywołania; oczekiwanie: jeden `ActivityCall`, m.in. 2 błędne kody i
  potwierdzenie, 3 błędne kody, wygaśnięcie, unieważnienie, odmowa bez potwierdzenia), z referencyjną kontrolą w teście
  Node, żeby gateway i mock liczyły tak samo. Wektory są nowe, istniejące oczekiwania się nie zmieniają.
- **SemVer:** minor (nowy endpoint, nowe schematy, nowe wektory).
- **Wpływ na strumienie:** ws-05 (agregacja wywołania i ponowień, licznik błędnych kodów, indeksy po `sub` i `ts`,
  zapytanie parametryzowane, limit 30 dni), ws-07 (proxy), ws-08 (filtry, słownik etykiet `result`, szczegół z liczbą
  błędnych kodów, obsługa nieznanej wartości), ws-10 (test: filtr `q` nie dopasowuje argumentów; `sub` z parametru
  ignorowany).
- **Do akceptacji człowieka (3-6 punktów):**
  1. Jedno wywołanie = jeden wiersz; `requestId` i `ts` pochodzą z pierwszego żądania, ponowienia z kodem nie mają
     własnych wierszy.
  2. Wiersz ma wynik końcowy (`ok`, `denied_*`, `confirmation_pending`, `confirmed`, `expired`, `confirmation_failed`,
     `superseded`, `error`) i `wrongCodeCount` 0..3 w szczegółach.
  3. Wyniki według listy z `design/ekrany-authenticator-i-poprawki.txt`; stanu "Odrzucone przez Ciebie" nie ma (po
     pivocie nie ma decyzji w portalu).
  4. `result` to otwarty ciąg ze znanymi wartościami (nowa wartość nie wymaga major); filtr `result` ma 4 grupy: `ok`,
     `denied`, `error`, `confirmation`.
  5. `q` dopasowuje tylko nazwę narzędzia i `resource.id`; stary `GET /api/v1/activity` zostaje.
  6. Dodana wartość `superseded` wynika z CC-127 (jedna oczekująca operacja DESTRUCTIVE).
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-28; tekst przyjęty). Wdrożone w 3.0.0 (wersja robocza): `listActivityCalls` (C5) i `listMyActivityCalls` (C12), schemat `ActivityCall` w C5 (C12 odwołuje się do niego), 38 wektory `activity-calls/` (w tym agregacja zdarzeń jednego wywołania, `scripts/lib/activity-calls.mjs`), mocki WireMock i MSW.

## CC-096 | C12 | Odpowiedzi błędów wniosków o dostęp

- **Zgłasza:** analiza luk G-19; kierunek zatwierdzony przez człowieka 2026-10-27
- **Kamień:** M4 (IGA, C13), wydanie z kamieniem M4
- **Problem:** `GET/POST /api/v1/access-requests` nie mają `503 upstream_unavailable` (IGA to nowy upstream wobec
  CC-050). `POST` nie opisuje: wniosek już istnieje, adapter bez obiegu wniosków (`keycloak-groups`: katalog bez
  wniosków), nieznane uprawnienie.
- **Wariant:** `503` dla obu operacji; `POST`: duplikat zwraca idempotentnie `200` z `requestId` istniejącego
  wniosku bieżącego użytkownika (użytkownik chce przejść do wniosku, nie czytać błędu), adapter bez obiegu lub
  nieznane uprawnienie to `422 not_requestable`.
- **Alternatywa:** `409 request_exists` z `requestId` (UI musi obsłużyć błąd, który jest sukcesem z punktu widzenia
  użytkownika).
- **Zmiany plików:** `openapi/portal-bff.v1.yaml`, `createAccessRequest.responses` i `listAccessRequests.responses`:

```yaml
        '422':
          description: The IGA adapter has no request flow (keycloak-groups) or does not know the entitlement.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                not_requestable:
                  value:
                    error: not_requestable
        '503':
          $ref: '#/components/responses/UpstreamUnavailable'
```

  Opis `POST`: "When a request for the entitlement is already pending, the BFF answers 200 with the requestId of
  that request." Opis `UpstreamUnavailable` rozszerzony o IGA. Mocki MSW: przykłady `not_requestable` i duplikat.
- **Wektory / testy:** test przykładów i mocków; bez nowych wektorów.
- **SemVer:** minor (nowe odpowiedzi).
- **Wpływ na strumienie:** ws-07 (idempotencja duplikatu, mapowanie błędów adaptera), ws-08 (komunikaty).
- **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0 (kierunek 2026-10-27; tekst wdrożony bez zmian: `503` dla obu operacji, idempotentny duplikat, `422 not_requestable`)

## CC-097 | C5/C12 | `change` i wersje definicji w rejestrze (przed/po)

- **Zgłasza:** analiza luk G-23; kierunek zatwierdzony przez człowieka 2026-10-27
- **Kamień:** M4 (przypinanie definicji i widok administracji), wydanie z kamieniem M4
- **Problem:** `RegistryTool.status` to `approved` albo `pending_approval`; makieta 07 rozróżnia "nowe" i "zmienione"
  (bez N+1 wywołań `/pending`) i pokazuje wersje serwera "Przed (1.4.2) / Po (1.5.0)". `PendingTool` nie ma wersji.
- **Wariant:** `RegistryTool.change` (`new` | `changed`, tylko przy `pending_approval`), `RegistryTool.approvedInVersion`
  (wersja manifestu serwera, przy której zatwierdzono obowiązujący wpis, albo `null` dla nowego narzędzia),
  `PendingTool.approvedInVersion` i `pendingVersion` (wersja manifestu, w którym pojawił się oczekujący wpis). Pola
  informacyjne; decyzja nadal wiąże `definitionHash`. Gateway zapisuje wersję manifestu przy rejestracji i przy
  zatwierdzeniu. Przycisk "Odrzuć" (G-24) jest usunięty z makiety i **nie ma endpointu** (brak zatwierdzenia = narzędzie
  zostaje `pending_approval` i ukryte, fail-closed); "Zatwierdź zmiany" na poziomie serwera to seria `approve` w
  frontendzie z raportem, które się nie udały. Frontend pokazuje pełny diff `ToolEntry` (od CC-115 z `title`) z
  wyróżnieniem `risk`, `action`, `resourceRefs`, `annotations` (N-7).
- **Alternatywa:** liczyć "nowe/zmienione" jednym `/pending` na narzędzie oczekujące i pominąć wersje.
- **Zmiany plików:** `openapi/gateway-admin.v1.yaml` (typy `RegistryTool` i `PendingTool`):

```yaml
    RegistryTool:
      properties:
        change:
          type: string
          enum: [new, changed]
          description: Present exactly when status is pending_approval. new = no approved entry exists; changed = an approved entry exists and differs.
        approvedInVersion:
          description: Server version (manifest version) at which the approved entry was approved; null for a new tool. Absent only for an approved tool whose version was not recorded before this field existed.
          oneOf:
            - $ref: '../schemas/common.schema.json#/$defs/SemVer'
            - type: 'null'
    PendingTool:
      properties:
        approvedInVersion:
          oneOf:
            - $ref: '../schemas/common.schema.json#/$defs/SemVer'
            - type: 'null'
        pendingVersion:
          $ref: '../schemas/common.schema.json#/$defs/SemVer'
```

  `RegistryTool` ma `unevaluatedProperties: false` i składa się z `ToolEntryFields`; nowe pola dopisać w `properties`
  obok `status`. `PendingTool` ma `additionalProperties: false` i `required: [approvedEntry, pendingEntry,
  pendingHash]`; `pendingVersion` dopisać do `required` (gateway zawsze zna wersję oczekującego manifestu), a
  `approvedInVersion` zostaje opcjonalne. Przykłady `listRegistryServers`, `getPendingTool` i mocki z nowymi polami
  (`pending_approval` z `change: new` i z `change: changed`).
- **Wektory / testy:** test przykładów; reguła spójności w teście Node: `change` obecne wtedy i tylko wtedy, gdy
  `status: pending_approval`; `change: new` wymaga `approvedInVersion: null` (albo braku), `change: changed` wymaga
  semantycznej wersji; w `PendingTool` `approvedEntry: null` wymaga `approvedInVersion: null`.
- **SemVer:** `pendingVersion` i `source` (CC-162) są wymagane w odpowiedzi `PendingTool`, więc według tabeli README to major (4.0.0); pozostałe pola opcjonalne.
- **Wpływ na strumienie:** ws-05 (rejestr zapisuje wersję manifestu przy rejestracji i zatwierdzeniu), ws-07
  (przezroczyste), ws-08 (widok diffu).
- **Do akceptacji człowieka (3-6 punktów):**
  1. `RegistryTool.change` (`new` | `changed`) tylko przy `pending_approval`, bez dodatkowych wywołań `/pending`.
  2. `approvedInVersion` (wersja manifestu przy zatwierdzeniu, `null` dla nowego) w `RegistryTool` i `PendingTool`,
     `pendingVersion` w `PendingTool`: pola informacyjne, decyzja nadal wiąże `definitionHash`.
  3. Brak endpointu "odrzuć": brak zatwierdzenia to narzędzie ukryte (`pending_approval`, fail-closed);
     "Zatwierdź zmiany" serwera to seria `approve` po stronie frontendu.
  4. Pełny diff pokazuje frontend z istniejących `approvedEntry` i `pendingEntry` (od CC-115 także `title`).
  5. Kamień M4, wydanie z kamieniem (nie 3.0.0).
- **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0 (tekst przyjęty 2026-10-28; wdrożony w OpenAPI C5 i C12, reguły zachowania w CC-133)

## CC-098 | C5/C12 | `resource` w `ConfirmationView`

- **Zgłasza:** analiza luk G-17; **nie jest na liście decyzji człowieka z 2026-10-27**, dopisane przez ws-00, bo
  `ConfirmationView` zmienia się przy pivocie i jest to ta sama operacja (usunąć z pakietu, jeśli człowiek woli)
- **Kamień:** M3, razem z pakietem CC-091
- **Problem:** makieta potwierdzenia pokazuje zasób ("DEV / 48213"), a `ConfirmationView` ma `tool`, `system`,
  `arguments[]`, `expiresAt`. Frontend nie wie, które argumenty są zasobem. Po pivocie ekran podglądu jest jedynym
  zaufanym miejscem, w którym człowiek widzi operację (CC-091, ryzyko rezydualne), więc czytelne wskazanie zasobu
  ma większe znaczenie niż w CC-077.
- **Wariant:** opcjonalne `ConfirmationView.resource` (`type`, `id`, `parent`) liczone przez gateway z
  `resourceRefs` (to samo, co trafia do audytu C8); brak pola, gdy narzędzie nie przyjmuje identyfikatora zasobu.
  Argumenty pozostają posortowane po nazwie (kontrakt), makieta do poprawy.
- **Alternatywa:** ekran bez wydzielonego zasobu, tylko lista argumentów.
- **Zmiany plików:** `openapi/gateway-admin.v1.yaml`, `ConfirmationView.properties`:

```yaml
        resource:
          description: Main resource of the call from resourceRefs (type, id, parent), computed by the gateway; absent when the tool takes no resource identifier.
          type: object
          required: [type, id]
          properties:
            type:
              $ref: '../schemas/common.schema.json#/$defs/ResourceType'
            id:
              type: string
              maxLength: 512
            parent:
              type: string
              maxLength: 600
          additionalProperties: false
```

  Nie robić pola wymaganego (zmiana wymaganych pól byłaby kolejnym major).
- **Wektory / testy:** test przykładów (`delete_issue` z `resource: {type: Jira::Issue, id: ABC-123, parent: Jira::Project::ABC}`).
- **SemVer:** minor. Jeśli pivot wychodzi w 3.0.0, wchodzi razem z nim.
- **Wpływ na strumienie:** ws-05 (wyliczenie), ws-07 (przezroczyste), ws-08 (wiersz zasobu na podglądzie).
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-27; wydanie 3.0.0 przed M3, nie w 2.2.0). Wdrożone i wydane w 3.0.0. Dodatkowe decyzje człowieka 2026-10-28: blokada zdejmuje się tylko po 15 minutach, w portalu nie ma odblokowania; dzienny limit błędnych kodów (CC-126); jedna oczekująca operacja DESTRUCTIVE (CC-127). Rozstrzygnięcia: podgląd OPCJONALNY, bez `previewRequired`; ryzyko rezydualne (opis operacji widziany tylko w niezaufanym kliencie, gdy człowiek nie otworzy podglądu) jest świadomie przyjęte przez człowieka; step-up Entra tylko przy rejestracji i usunięciu; weryfikuje broker; limity 5 błędnych / 15 min, blokada 15 min, 3 próby na wywołanie, rejestracja 10 min; reguła `destructive-requires-fresh-mfa` wypada z paczki produkcyjnej (przykład zostaje); `confirmation_declined` usunięte; reset cudzej rejestracji przez CN `mcp-offboarding`; CC-094 wariant B (nowy `event: "authenticator"`); wyjątek w niezmienniku 4 na jednorazowy pokaz ziarna TOTP (`no-store`, tylko właściciel po MFA Entra, nigdy w logach ani audycie)

## CC-099 | C4/C12 | `ReturnPath` bez zarezerwowanych prefiksów

- **Zgłasza:** przegląd 2.2.0 (L-9); decyzja człowieka 2026-10-28: do 3.0.0 razem z pivotem
- **Kamień:** wydanie 3.0.0 (przed M3)
- **Problem:** po CC-089 ścieżki `/api`, `/s/`, `/v/`, `/.well-known/` w tym samym originie trafiają do BFF lub
  gateway'a, a wzorzec `ReturnPath` (`credential-broker.v1.yaml`, `components.schemas.ReturnPath`, używany w
  `login`, `startConnectOAuth`, C4 `oauth/start`) je dopuszcza. Przekierowanie po logowaniu lub OAuth może wylądować
  na endpoincie API (np. `/api/v1/auth/login?...`, łańcuch przekierowań) zamiast w SPA. Poza domenę przekierować się
  nie da (CC-032).
- **Wariant:** wzorzec `ReturnPath` z negatywnym lookahead na `^/(api|s|v|\.well-known)(/|$)`; wektory
  `return-paths/` (`invalid-api`, `invalid-gateway-s`, `invalid-gateway-v`, `invalid-well-known`, `valid-apiary`
  dla `/apiary`, który nie jest prefiksem); `login-redirects` bez zmian. W 2.2.x BFF może odrzucać takie wartości
  z konfiguracji (`400 invalid_request`), bez zmiany kontraktu.
- **SemVer:** zaostrzenie walidacji, **major**; wchodzi do 3.0.0 razem z CC-091 ... CC-094 i CC-098.
- **Wpływ na strumienie:** ws-06 (C4 `oauth/start`), ws-07 (login, `startConnectOAuth`), ws-08 (generowane ścieżki
  powrotu nie zaczynają się od zarezerwowanych prefiksów).
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-28). Wdrożone w 3.0.0 (wersja robocza): wzorzec rozszerzony o segmenty `.` i `..` (przed `?`), o `?` po prefiksie (`/api?x`) i o zakaz średnika (parametry ścieżki `/api;x`, `/..;/` serwery czytają jak `/api` i `/..`); rozszerzenie o `.` i `..` potwierdzone przez człowieka 2026-10-28, a zakaz `;` jest tego samego ducha (przegląd 3.0.0, L3).

## CC-100 | C4.1 | Porównanie tożsamości bez zmiany wielkości liter dla całego Unicode

- **Zgłasza:** automatyczny przegląd bezpieczeństwa brokera; decyzja człowieka 2026-10-28
- **Kamień:** M2, wydanie 2.2.2
- **Problem:** reguła z 2.2.1 (NFC + zamiana na małe litery) zlewa znaki Unicode ze zwykłymi literami: U+212A KELVIN
  SIGN -> `k`, U+017F LATIN SMALL LETTER LONG S -> `s`, U+0130 -> `i` (w zależności od implementacji). Konto
  "Karen" z kelwinem w systemie docelowym byłoby równe `karen` w portalu. `identity_mismatch` jest główną ochroną
  zapisu tokenu bez MFA (CC-090), więc taka kolizja ją osłabia.
- **Przyjęty wariant:** jeśli obie surowe wartości są w całości ASCII, porównanie bez wielkości liter (zamiana tylko
  liter ASCII); w przeciwnym razie dokładna równość po NFC, bez zmiany wielkości liter. Test ASCII jest na wartościach
  **przed** NFC, bo NFC zamienia U+212A KELVIN SIGN na ASCII `K` (singleton kanoniczny); przy teście po NFC kelwin
  przeszedłby ścieżką bez wielkości liter. Znane, zamierzone: kelwin w wielkości zgodnej (`Karen` z U+212A vs `Karen`
  ASCII) jest kanonicznie równoważny i pasuje. Bez przycinania,
  podciągu, odcinania domeny; e-mail tylko przy `email_verified=true`; domyślny claim `preferred_username`.
  Skutek uboczny: nazwy nie-ASCII różniące się wielkością liter (`Łukasz` vs `łukasz`) nie pasują; administrator
  poprawia nazwę w systemie albo konfiguracji mapowania.
- **Zmiany plików:** `README.md` (C4.1), opis `putSecret` w `credential-broker.v1.yaml`, wektory `whoami-identity/`
  (nowe: `invalid-kelvin-sign`, `invalid-long-s`, `invalid-turkish-dotted-i`, `invalid-fullwidth`,
  `valid-kelvin-canonically-equivalent`, `invalid-polish-case-difference`, `valid-polish-exact`, `valid-ascii-case-difference-email`; opisy istniejących
  poprawione, ich oczekiwania nie zmieniły się), referencja w `test/vectors.test.mjs`.
- **SemVer:** zaostrzenie reguły z 2.2.1, formalnie major. Jedynym konsumentem jest broker w trakcie M2; wydane
  jako 2.2.2 z wyjątkiem jak CC-085 (adnotacja w `CHANGELOG.md`).
- **Wpływ na strumienie:** ws-06 (broker: nowa funkcja porównania, bez `toLowerCase` Unicode), ws-10 (testy z wektorów).
- **Status:** superseded przez CC-101 (decyzja: człowiek, 2026-10-28; reguła wydana w 2.2.2, wycofana w 2.2.3)

## CC-101 | C4/C12 | Brak sprawdzania tożsamości w whoami: portal pokazuje konto

- **Zgłasza:** człowiek (decyzja 2026-10-28)
- **Kamień:** M2, wydanie 2.2.3
- **Problem:** reguła C4.1 (CC-090, CC-100) odrzucałaby uczciwych użytkowników: ta sama osoba ma różne loginy w
  systemach (`asmith` w Jirze, `alice.smith` w GitLabie, `smith8` w Confluence), a e-mail jest niepewny.
- **Wariant (wybór człowieka):** brak sprawdzania tożsamości. Broker wywołuje whoami tylko dla ważności poświadczenia
  (`422 secret_invalid`) i odczytu `backendUser`; nie porównuje z tożsamością użytkownika. `identity_mismatch` nie jest
  zwracane; kod zostaje w enum (`PutSecretError`, `OAuthCompleteError`, `ConnectErrorCode`) jako deprecated z opisem,
  usunięcie w 3.0.0 (żeby nie mnożyć wyjątków SemVer). Portal pokazuje "Połączono jako <backendUser>" po zapisie i w
  Połączeniach. `backendUser` jest już wymagane w `Connection`, `PutSecretResponse` i odpowiedzi `oauth/complete`
  (bez zmiany SemVer z tego powodu). Wektory `whoami-identity/` wycofane (pole `deprecated`, poza testami);
  CC-100 `superseded`.
- **Ryzyko rezydualne:** patrz CC-090 (aktualizacja 2026-10-28): świadomie przyjęte przez człowieka. Zalecenie: audyt
  `connection_change` z `backendUser`, widoczność konta w portalu.
- **Zmiany plików:** `credential-broker.v1.yaml` (opisy `putSecret`, `oauth/complete`, `backendUser`, enumy
  deprecated, usunięte przykłady `identity_mismatch`), `portal-bff.v1.yaml` (opisy `putMySecret`, `oauthCallback`,
  `ConnectErrorCode`, usunięty przykład), README (C4.1), wektory, mocki.
- **SemVer:** formalnie zmiana zachowania (broker nie zwraca już udokumentowanego kodu), enum bez zmian; 2.2.3 jako
  patch, wyjątek jak CC-085 (brak konsumentów zależnych od tego kodu). Usunięcie wartości z enum: 3.0.0.
- **Wpływ na strumienie:** ws-06 (bez porównania; `secret_invalid` dla niepoprawnego poświadczenia), ws-07 (bez
  mapowania `identity_mismatch`; zwraca `backendUser`), ws-08 (komunikat "Połączono jako <backendUser>", usunięcie
  ekranów błędu `identity_mismatch`).
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.3)

## CC-102 | C4/C12 | `completeOAuth`: 400 dla systemu bez `user-oauth`, `503` -> `provider_error`

- **Zgłasza:** B1 (ws-06); pakiet M2, grupa B (`mcp-platform-plan/cc-pakiet-m2.md`)
- **Kamień:** M2, wydanie 2.2.4
- **Zmiana:** opis i odpowiedź `400 BadRequest` w `completeOAuth` (jak `oauth/start`); opis, że BFF mapuje `503` brokera na `connectError=provider_error`. Usunięty też nieaktualny opis porównania tożsamości z CC-101.
- **Pliki:** `credential-broker.v1.yaml`.
- **SemVer:** patch (opisy, przykłady, wektory zgodne ze schematem)
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.4)

## CC-103 | C4 | `expiring` i `expiresAt` tylko dla `user-secret`

- **Zgłasza:** B2 (ws-06); pakiet M2, grupa B (`mcp-platform-plan/cc-pakiet-m2.md`)
- **Kamień:** M2, wydanie 2.2.4
- **Zmiana:** opis `ConnectionStatus`; przykład `two_connections`: połączenie GitLab OAuth ma `status: connected`, `expiresAt: null`.
- **Pliki:** `credential-broker.v1.yaml`, mocki.
- **SemVer:** patch (opisy, przykłady, wektory zgodne ze schematem)
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.4)

## CC-104 | D6/C4 | Miejsce `client_secret` klienta OAuth w OpenBao

- **Zgłasza:** B3 (ws-06); pakiet M2, grupa B (`mcp-platform-plan/cc-pakiet-m2.md`)
- **Kamień:** M2, wydanie 2.2.4
- **Zmiana:** README ("Doprecyzowania z fali M2"): `secret/data/mcp/oauth-clients/<system>`, osobno od połączeń użytkowników. Aktualizacja D6 w `02-decisions.md` należy do człowieka.
- **Pliki:** `README.md`.
- **SemVer:** patch (opisy, przykłady, wektory zgodne ze schematem)
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.4)

## CC-105 | C4 | `CredentialRequired.connectUrl` jest informacyjne

- **Zgłasza:** B4 (ws-05); pakiet M2, grupa B (`mcp-platform-plan/cc-pakiet-m2.md`)
- **Kamień:** M2, wydanie 2.2.4
- **Zmiana:** opis pola: gateway buduje link z własnego `publicBaseUrl` i ignoruje wartość brokera.
- **Pliki:** `credential-broker.v1.yaml`.
- **SemVer:** patch (opisy, przykłady, wektory zgodne ze schematem)
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.4)

## CC-106 | C5/C2 | Jeden port TLS dla `/admin/v1` i JWKS

- **Zgłasza:** B5 (ws-05); pakiet M2, grupa B (`mcp-platform-plan/cc-pakiet-m2.md`)
- **Kamień:** M2, wydanie 2.2.4
- **Zmiana:** README: cel certyfikatu klienta (clientAuth) sprawdzany w aplikacji dla `/admin/v1`, nie w handshake, bo klienci JWKS mogą go nie przedstawić.
- **Pliki:** `README.md`.
- **SemVer:** patch (opisy, przykłady, wektory zgodne ze schematem)
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.4)

## CC-107 | C8 | Słownik `reason` dla `admin_change` (zmiany linków)

- **Zgłasza:** B6 (ws-05); pakiet M2, grupa B (`mcp-platform-plan/cc-pakiet-m2.md`)
- **Kamień:** M2, wydanie 2.2.4
- **Zmiana:** opis pola `reason` w `audit-event.schema.json`: `vs_created`, `vs_deleted`, `slug_taken`, `not_granted`, `invalid_request`, `virtual_server_limit`, `not_found_or_denied`. Lista narzędzi linku w zdarzeniu wymaga nowego pola w schemacie C8, więc zostaje poza 2.2.4 (grupa A).
- **Pliki:** `schemas/audit-event.schema.json`, `README.md`.
- **SemVer:** patch (opisy, przykłady, wektory zgodne ze schematem)
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.4)

## CC-108 | C5 | Tożsamość scrapera metryk (`mcp-prometheus`)

- **Zgłasza:** B7 (ws-05); pakiet M2, grupa B (`mcp-platform-plan/cc-pakiet-m2.md`)
- **Kamień:** M2, wydanie 2.2.4
- **Zmiana:** README: scraper `/actuator/prometheus` z certyfikatem clientAuth z CA wewnętrznego i CN `mcp-prometheus`; certyfikat z `gen-certs.sh` (ws-01).
- **Pliki:** `README.md`.
- **SemVer:** patch (opisy, przykłady, wektory zgodne ze schematem)
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.4)

## CC-109 | C12 | 400 dla zakodowanych ścieżek, `provider_error` przy błędzie brokera

- **Zgłasza:** B8 (ws-07); pakiet M2, grupa B (`mcp-platform-plan/cc-pakiet-m2.md`)
- **Kamień:** M2, wydanie 2.2.4
- **Zmiana:** `deleteMyVirtualServer` dostaje `400 BadRequest` (`disconnect` już go ma, CC-054); opis `oauthCallback`: błąd lub `503` brokera daje `connectError=provider_error`.
- **Pliki:** `portal-bff.v1.yaml`, mocki.
- **SemVer:** patch (opisy, przykłady, wektory zgodne ze schematem)
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.4)

## CC-110 | C12 | Wektory `catalog-actions/` dla odmówionego narzędzia i konta serwisowego

- **Zgłasza:** B9 (ws-07); pakiet M2, grupa B (`mcp-platform-plan/cc-pakiet-m2.md`)
- **Kamień:** M2, wydanie 2.2.4
- **Zmiana:** nowe wektory: odmówione narzędzie przy `expiring`, `reconnect_required` i `not_connected` nie dodaje `request_access` (tylko `connected` je dodaje); konto serwisowe z odmówionym narzędziem: `copy_link` + `request_access`. Reguła zapisana w opisie `getPortalCatalog`.
- **Pliki:** `test-vectors/catalog-actions/`, `portal-bff.v1.yaml`.
- **SemVer:** patch (opisy, przykłady, wektory zgodne ze schematem)
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.4)

## CC-111 | C12 | Przekierowanie po błędzie OAuth niesie `system=<system>`

- **Zgłasza:** B10 (ws-08); pakiet M2, grupa B (`mcp-platform-plan/cc-pakiet-m2.md`)
- **Kamień:** M2, wydanie 2.2.4
- **Zmiana:** błąd w `oauthCallback` dokleja `system=<system>` obok `connectError` (frontend toleruje brak). Wektory `connect-redirects/`: `valid-*-with-system`, `invalid-unknown-system`.
- **Pliki:** `portal-bff.v1.yaml`, wektory, test Node.
- **SemVer:** patch (opisy, przykłady, wektory zgodne ze schematem)
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.4)

## CC-112 | C10/C6 | `structuredContent` zgodny z `outputSchema`, pola systemu obok `UntrustedText`

- **Zgłasza:** B11 (starter; uzupełnienie CC-072); pakiet M2, grupa B (`mcp-platform-plan/cc-pakiet-m2.md`)
- **Kamień:** M2, wydanie 2.2.4
- **Zmiana:** opis `UntrustedText` w `common.schema.json`: wynik z `outputSchema` jest zgodny ze schematem, `UntrustedText` to rekord wyniku, pola systemu leżą obok, wiki markup konwertuje serwer (w `format` nie ma wartości wiki).
- **Pliki:** `schemas/common.schema.json`.
- **SemVer:** patch (opisy, przykłady, wektory zgodne ze schematem)
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.4)

## CC-113 | C12 | Tabela CC-083: `request_access` bez `requiredEntitlements`, `view_request` przy oczekującym wniosku

- **Zgłasza:** C1 (ws-07)
- **Propozycja:** rozstrzygnąć `request_access` przy `no_access` bez `requiredEntitlements` i `view_request` przy `connected` z oczekującym wnioskiem na odmówione narzędzie. Razem z wnioskami IGA.
- **Propozycja przyjęta 2026-10-29:** `request_access` przy `no_access` (i `connected` z odmówionym narzędziem) tylko gdy znane jest `requiredEntitlements`; `view_request` także przy `connected`, gdy użytkownik ma oczekujący wniosek na uprawnienie wymagane przez odmówione narzędzie (zamiast `request_access`). Referencja `scripts/lib/catalog-actions.mjs` (wejścia `entitlementsKnown`, `pendingRequestForDeniedTool`), wektory `catalog-actions/no-access-unknown-entitlements`, `connected-denied-tool-unknown-entitlements`, `connected-denied-tool-request-pending`, opis `getPortalCatalog`.
- **SemVer:** minor (nowe wektory, doprecyzowanie tabeli).
- **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0 (poprzednio deferred, 2026-10-28)

## CC-114 | C4/C12 | Format poświadczenia Basic w `PutSecretRequest`

- **Zgłasza:** C2 (ws-08)
- **Propozycja:** format dla Basic, gdy pojawi się system, który go wymaga (dziś `user-secret` to pojedynczy token, CC-049).
- **Status:** deferred (decyzja: człowiek, 2026-10-28; grupa C pakietu M2, kamień: gdy pojawi się taki system)

## CC-115 | C6 | Wymagane `title` narzędzia w manifeście

- **Zgłasza:** C3 (ws-08)
- **Propozycja:** wymagać `title` (zaostrzenie manifestu, major). Razem z rejestrem definicji.
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-28, przyjęte do 3.0.0; wcześniej deferred, grupa C pakietu M2). Wdrożone w 3.0.0 (wersja robocza): `title` w `required` definicji narzędzia, wektory `invalid-missing-title`, `invalid-empty-title`; hashe wektorów `definition-hash/` i przykładów OpenAPI przeliczone.

## CC-116 | C8 | Osobna wartość `event` dla zmian linków

- **Zgłasza:** C4 (ws-07)
- **Propozycja:** osobny `event` dla zmian wirtualnych serwerów zamiast `admin_change` (nowa wartość enum, major). Razem z CC-107 i listą narzędzi linku (grupa A).
- **Decyzja człowieka 2026-10-28:** nazwa `virtual_server_change` zostaje.
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-28, przyjęte do 3.0.0; wcześniej deferred, grupa C pakietu M2). Wdrożone w 3.0.0 (wersja robocza): nowa wartość `event: "virtual_server_change"` (powody z CC-107: `vs_created`, `vs_deleted`, `slug_taken`, `not_granted`, `invalid_request`, `virtual_server_limit`, `not_found_or_denied`), wymagane `outcome` i `reason`; `admin_change` zostaje dla pozostałych zmian administracyjnych. Lista narzędzi linku w zdarzeniu nie weszła (poza zakresem).

## CC-117 | C8 | `backendUser` w zdarzeniu `connection_change`

- **Zgłasza:** A1 (broker); grupa A pakietu M2 (`mcp-platform-plan/cc-pakiet-m2.md`)
- **Kamień:** M2, wydanie 2.2.5
- **Problem:** po CC-101 broker nie porównuje tożsamości, więc zdarzenie audytu jest jedynym śladem, kto podpiął które konto.
- **Zmiana:** opcjonalne `backendUser` (string, 1..255 znaków, te same wykluczone znaki sterujące co `resource.id`) w `audit-event.schema.json`; nigdy sekret. Zdarzenie `authentication` ma zamkniętą listę pól, więc pola nie przyjmuje. Wektory `broker-connection-change-backend-user`, `invalid-backend-user-control-char`, `invalid-backend-user-too-long`.
- **Pliki:** `schemas/audit-event.schema.json`, wektory audytu.
- **SemVer:** minor (nowe pole opcjonalne)
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.5)

## CC-118 | C10/C5 | Narzędzie spoza linku: `not_found_or_denied`

- **Zgłasza:** A5 (gateway); grupa A pakietu M2 (`mcp-platform-plan/cc-pakiet-m2.md`)
- **Kamień:** M2, wydanie 2.2.5
- **Problem:** gateway używał `tool_disabled` ("wyłączył administrator") dla narzędzia spoza linku, co jest mylące w audycie i ujawnia, że narzędzie istnieje (niezmiennik 8).
- **Zmiana:** opis w C10: narzędzie spoza listy narzędzi linku to `not_found_or_denied`; `tool_disabled` tylko przy wyłączeniu przez administratora (lub definicji czekającej na zatwierdzenie). Żaden istniejący wektor nie zmienia oczekiwań (nie było wektora tego przypadku).
- **Pliki:** `schemas/tool-error.schema.json` (opisy).
- **SemVer:** minor (doprecyzowanie zachowania, bez zmiany schematu)
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.5)

## CC-119 | C5/C12 | `409 virtual_server_limit_reached`

- **Zgłasza:** A6 (gateway); grupa A pakietu M2 (`mcp-platform-plan/cc-pakiet-m2.md`)
- **Kamień:** M2, wydanie 2.2.5
- **Problem:** przekroczenie limitu linków dawało ogólne `400 invalid_request`; `409 slug_taken` kazałby kreatorowi szukać sluga w nieskończoność.
- **Zmiana:** `409` z `error: virtual_server_limit_reached` w `POST /admin/v1/virtual-servers` i `POST /api/v1/virtual-servers`; limit na użytkownika konfigurowalny, domyślnie 50; kreator pokazuje "usuń nieużywany link". Przykłady i mocki.
- **Pliki:** `gateway-admin.v1.yaml`, `portal-bff.v1.yaml`, mocki.
- **SemVer:** minor (nowy kod w istniejącym `409`)
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.5)

## CC-120 | C8 | `authentication` na gateway'u dla tokenów C1 i nowe powody

- **Zgłasza:** A7 (gateway, starter); grupa A pakietu M2 (`mcp-platform-plan/cc-pakiet-m2.md`)
- **Kamień:** M2, wydanie 2.2.5
- **Zmiana:** zdarzenie `authentication` emituje też gateway (`component: gateway`) dla odrzuconych tokenów klienta (C1); słownik `reason`: `missing_token`, `malformed`, `bad_signature`, `unknown_kid`, `alg_not_allowed`, `wrong_issuer`, `wrong_audience`, `expired`, `not_yet_valid`, `invalid_claims` oraz `client_certificate_rejected`, `jwks_unavailable`, `replay_store_unavailable`. Dla dwóch ostatnich `errorCode` musi być `upstream_unavailable` (reguła w schemacie), dla pozostałych `unauthenticated`. Lista pól zamknięta jak w CC-071: żadnych pól z niezweryfikowanego tokenu (`backendUser` też zabronione). Wektory `gateway-authentication-denied-*` (4), `server-authentication-denied-client-certificate`, odrzucane `invalid-authentication-jwks-unavailable-*` (2), `invalid-authentication-with-backend-user`.
- **Pliki:** `schemas/audit-event.schema.json`, wektory.
- **SemVer:** minor (nowe znane wartości `reason`, nowa reguła tylko dla nowych powodów; istniejące wektory bez zmian)
- **Status:** accepted (decyzja: człowiek, 2026-10-28, wydanie 2.2.5)

## CC-121 | C10/C8 | Wspólna higiena tekstu (`text-hygiene/`)

- **Zgłasza:** A2 (starter, gateway); grupa A pakietu M2
- **Propozycja:** wspólna definicja znaków zakazanych w argumentach i w tekście z systemu (C0/C1/DEL, U+2028/U+2029, niesparowane surogaty, nieznaki, `\p{Cf}` poza U+200C..U+200F; w wartości z `pattern` także `\n\r\t`), zastępowanie usuniętego ciągu znaków niewidocznych jedną spacją, znaki niewidoczne poza `\p{Cf}` (selektory wariantu poza pojedynczym U+FE0F po emoji, U+034F, U+115F, U+1160, U+3164, U+FFA0, U+2800); wektory `test-vectors/text-hygiene/`. Wydanie 3.0.0 (nie implementowane w 2.2.5).
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-28). Wdrożone w 3.0.0 (wersja robocza): README "Higiena tekstu", `scripts/lib/text-hygiene.mjs`, 79 wektorów `text-hygiene/`.

## CC-122 | C10/C8 | Znaki pełnej szerokości ASCII w filtrach wzmianek (bez NFKC)

- **Zgłasza:** A3 (starter); grupa A pakietu M2
- **Propozycja:** nie normalizować NFKC; odrzucać lub oznaczać znaki pełnej szerokości ASCII (U+FF01..U+FF5E) w filtrach wzmianek (`＠ａｌｌ`), wektory w `text-hygiene/`. Wydanie 3.0.0.
- **Decyzja człowieka 2026-10-28:** zakres higieny tekstu jak w szkicu: pełna szerokość odrzucana tylko w argumentach filtrowanych pod kątem wzmianek, tekst z systemu bez zmian, U+FE0F tylko po `Extended_Pictographic` (dotyczy też CC-121).
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-28). Wdrożone w 3.0.0 (wersja robocza): tryb `argument-mention-filtered`, brak NFKC.

## CC-123 | C6/C10 | Zamknięty i ograniczony `inputSchema` (rozszerzenie CC-078)

- **Zgłasza:** A4 (starter); grupa A pakietu M2
- **Propozycja:** CC-078 rozszerzone o reguły startera: `additionalProperties: false`, tekst `maxLength`, lista `maxItems` i `items`, liczba `minimum`/`maximum`, wzorzec z kotwicami, bez `allOf/anyOf/oneOf/not/if`, bez map otwartych; reguła semantyczna w manifeście i wektory odrzuconych manifestów (mapa otwarta, lista bez `maxItems`, liczba bez zakresu, `prefixItems` bez `items`). Dla nowych manifestów; wydanie 3.0.0 razem z CC-078 i CC-079 (nazwy `$defs` jako stabilne API, A8).
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-28). Wdrożone w 3.0.0 (wersja robocza) razem z CC-078.

## CC-124 | C1 | Gateway odpowiada 503 `upstream_unavailable`, gdy JWKS IdP jest niedostępny

- **Zgłasza:** gateway (propozycja 9 w `mcp-gateway/STATUS.md`); decyzja człowieka 2026-10-28
- **Kamień:** wydanie 3.0.0
- **Problem:** gdy gateway nie może pobrać kluczy IdP (JWKS), odpowiadał `401` z `WWW-Authenticate: Bearer
  resource_metadata=...`, jak przy każdym odrzuconym tokenie. Klient OAuth czyta takie `401` jako "zaloguj się ponownie" i
  uruchamia nowy przepływ logowania, który przy awarii IdP nie pomoże, a zalogowanemu użytkownikowi psuje sesję.
- **Zmiana:** gdy decyzja o tokenie zależy od zestawu kluczy, którego gateway nie ma (JWKS niedostępny i brak użytecznej
  kopii; także token z nieznanym `kid` przy nieudanym odświeżeniu, bo nie da się odróżnić rotacji od podróbki):
  - status `503`, ciało `upstream_unavailable` (kształt C10, `tool-error.schema.json#/$defs/UpstreamUnavailable`),
    `Content-Type: application/json; charset=utf-8`;
  - **bez** nagłówka `WWW-Authenticate` (ani z `error="invalid_token"`, ani z samym `resource_metadata`): klient nie ma
    zaczynać logowania;
  - `Cache-Control: no-store`, bez `Set-Cookie`;
  - **`Retry-After`: tak.** Liczba całkowita sekund (RFC 9110, dozwolone przy 503), równa konfigurowanemu odstępowi
    ponowienia pobrania kluczy, zakres 1..60, domyślnie 10. Za: klienty i biblioteki HTTP dostają standardowy sygnał
    "poczekaj" i nie dobijają niedostępnego IdP pętlą ponowień; koszt: jedna wartość konfiguracji. Przeciw: klient, który
    ignoruje nagłówek, i tak ponowi, więc sama obecność nie wystarcza jako ochrona IdP (limit po stronie gateway'a
    zostaje w jego konfiguracji);
  - fail-closed bez zmian: żądanie nie jest wykonywane, token nie jest akceptowany z cache po wygaśnięciu kopii;
  - zdarzenie `authentication` z `reason: jwks_unavailable` i `errorCode: upstream_unavailable` zostaje (CC-120, schemat
    już wiąże oba).
  Odrzucenie sprawdzonego tokenu (10 powodów C1 z CC-120) zostaje `401` z `resource_metadata` i bez powodu.
- **Kolejność decyzji (przegląd 3.0.0, L2):** najpierw kontrole niezależne od kluczy (brak tokenu, format, `alg`), więc
  `missing_token`, `malformed`, `alg_not_allowed` to zawsze 401, także przy awarii IdP; potem wybór klucza. Nieznany `kid`
  wyzwala najwyżej jedno pobranie na minimalny odstęp: po udanym pobraniu w tym odstępie 401 `unknown_kid` bez ponownego
  pobrania, po nieudanym 503. Wektory decyzji `gateway-authentication-decision/` (12), referencja `keyDecision`.
- **Pliki:** `README.md` (sekcja "Odpowiedzi gateway'a na odrzucone i niedostępne uwierzytelnienie"),
  `scripts/lib/gateway-authentication.mjs` (referencja), wektory `test-vectors/gateway-authentication/` (13: 10 powodów
  401, trasa `/v/`, 503 z `Retry-After` 10 i 30), test sprawdza ciało względem `tool-error.schema.json`, brak
  `WWW-Authenticate` przy 503 i spójność z audytem.
- **SemVer:** zmiana zachowania gateway'a dla klientów (status 401 -> 503) w obszarze nieopisanym w OpenAPI; według
  README zmiana oczekiwanego zachowania, wydana z 3.0.0.
- **Wpływ:** ws-05 (obsługa błędu JWKS, `Retry-After`, konfiguracja odstępu), ws-10 (test: awaria IdP daje 503 bez
  `WWW-Authenticate`), klienty MCP (nie logują się ponownie przy 503).
- **Decyzja człowieka 2026-10-28:** nieznany `kid` przy nieudanym pobraniu JWKS to `503` (potwierdzone).
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-28)

## CC-125 | C8 | Audyt odrzuceń mTLS i tokenów BFF na porcie C5; `replay_store_unavailable` tylko u odbiorców JWT

- **Zgłasza:** gateway (propozycja 8 w `mcp-gateway/STATUS.md`); decyzja człowieka 2026-10-28
- **Kamień:** wydanie 3.0.0
- **Problem:** CC-120 opisało `client_certificate_rejected` jako powód zdarzenia `authentication`, ale gateway nie
  audytował odrzuceń na własnym porcie administracyjnym (`/admin/v1`, `/actuator/prometheus`), a wektor
  `gateway-authentication-denied-replay-store-unavailable` miał `component: gateway`, choć gateway nie ma magazynu
  `jti` dla tokenów klienta.
- **Zmiana:**
  1. gateway emituje `authentication` (`component: gateway`, `componentId: mcp-gateway`) dla odrzuceń na porcie C5:
     `client_certificate_rejected` (brak certyfikatu, certyfikat spoza CA wewnętrznego, bez celu `clientAuth`, CN spoza
     `x-allowed-client-cn` operacji) oraz powody tokenu (`missing_token`, `malformed`, `bad_signature`, `unknown_kid`,
     `wrong_issuer`, `wrong_audience` dla `aud` != `mcp-gateway-admin`, `expired`, ...) dla odrzuconego tokenu BFF;
     lista pól zdarzenia zostaje zamknięta (bez `tool`, `sub`, ścieżki ani CN; patrz pytanie w raporcie);
  2. `replay_store_unavailable` emitują **tylko odbiorcy wewnętrznego JWT**: serwery MCP (przez starter) i broker.
     Schemat wymusza: dla tego powodu `component` jest `server` albo `broker`. Wektor z `component: gateway` jest teraz
     negatywny (`invalid-authentication-replay-store-unavailable-gateway`), poprawne to
     `server-authentication-denied-replay-store-unavailable` i `broker-authentication-denied-replay-store-unavailable`;
  3. `jwks_unavailable` zostaje dla obu stron (JWKS IdP u gateway'a, JWKS gateway'a u odbiorców JWT).
- **Ilość zdarzeń (przegląd 3.0.0, L9):** gateway może agregować lub próbkować `client_certificate_rejected` na porcie
  administracyjnym (np. jedno zdarzenie na adres źródłowy na minutę albo licznik w metrykach), żeby skaner w sieci
  wewnętrznej nie zalał SIEM; lista pól zdarzenia zostaje zamknięta.
- **Pliki:** `schemas/audit-event.schema.json` (reguła `component` dla `replay_store_unavailable`, opis `reason`),
  wektory `gateway-authentication-denied-admin-client-certificate`, `gateway-authentication-denied-admin-bff-token`.
- **SemVer:** zaostrzenie walidacji (wektor `gateway`/`replay_store_unavailable` przestaje być poprawny), major; wchodzi do
  3.0.0.
- **Wpływ:** ws-05 (emisja na porcie C5), ws-02 i ws-06 (`replay_store_unavailable` z `component` serwera/brokera).
- **Decyzja człowieka 2026-10-28:** audyt odrzuceń mTLS na porcie C5 bez CN ani innych danych z certyfikatu; lista pól zdarzenia zostaje zamknięta.
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-28)

## CC-126 | C4/C11/C12/C8 | Dzienny limit błędnych kodów TOTP wyłącza Authenticator

- **Zgłasza:** automatyczny przegląd bezpieczeństwa commitów 3.0.0; decyzja człowieka 2026-10-28
- **Kamień:** wydanie 3.0.0 (część pivotu, CC-091 ... CC-094)
- **Problem:** blokada 5 błędów / 15 min (CC-092) ogranicza tempo zgadywania kodu do ok. 480 prób na dobę (5 na 15 min
  bez końca), a kod ma 6 cyfr i okno 3 kroków; agent próbujący bez przerwy nie napotyka górnej granicy.
- **Zmiana:**
  - **20 błędnych kodów (`invalid` lub `replayed`) w oknie kroczącym 24 h wyłącza Authenticator użytkownika do ponownej
    rejestracji.** Nie liczą się: odpowiedzi `locked`, `malformed` (400), błędne kody przy potwierdzaniu rejestracji
    (mają własne 3 próby). Sukces **nie** zeruje licznika dziennego (zeruje tylko licznik 5/15 min). Limit konfigurowalny,
    domyślnie 20 / 24 h.
  - Broker: `AuthenticatorStatus.state` ma nową wartość `disabled` z `disabledAt` i `disabledReason`
    (`daily_failure_limit`), wymagane razem; `AuthenticatorVerifyResult.result` ma `disabled` (broker nie sprawdza kodu).
    `POST /v1/authenticator/enrollment` jest dozwolone ze stanu `disabled` (nie `409`); aktywacja nowej rejestracji
    zeruje licznik dzienny i stan `disabled`. `DELETE` i reset (`mcp-offboarding`) usuwają także rejestrację `disabled`.
  - Gateway (C11): `disabled` z `GET /v1/authenticator` przy pierwszym wywołaniu i `disabled` z `verify` przy ponowieniu
    dają `confirmation_required` z samym `registerUrl` (jak brak rejestracji), pending nie jest tworzone, a przy ponowieniu
    zostaje nietknięte i nie zużywa próby.
  - Portal (C12): `GET /api/v1/authenticator` zwraca `disabled` (przykład dla MSW); portal pokazuje baner z powodem i
    jedną akcję "Zarejestruj ponownie" (step-up MFA Entra jak zwykle). Brak akcji odblokowania.
  - Audyt (C8, `event: "authenticator"`): `authenticator_disabled` (broker, `outcome: denied`, w chwili wyłączenia),
    `totp_disabled` (próba weryfikacji przy wyłączonym); zdarzenie `confirmation` gateway'a z powodem
    `authenticator_disabled`.
- **Relacja z decyzją "blokada tylko czasem, bez odblokowania w portalu" (2026-10-28):** nic się nie zmienia w blokadzie
  5/15 min: zdejmuje ją tylko upływ 15 minut, żaden endpoint, usunięcie, rejestracja ani reset jej nie skraca. Wyłączenie
  dzienne **nie jest odblokowaniem**: nie cofa żadnego ograniczenia, tylko unieważnia samą rejestrację i wymusza nową
  (ze świeżym MFA Entra, czyli czynnikiem, którego agent nie ma). Blokada użytkownika trwa niezależnie od rejestracji
  (może wystąpić `state: active` z `lockedUntil` albo, po usunięciu, `state: none` z `lockedUntil`), a nowa rejestracja
  jej nie kasuje.
- **Skutek uboczny (przegląd 3.0.0, L1):** zmanipulowany agent może sam wyłączyć Authenticator ok. 20 błędnymi kodami
  (5 błędów, 15 min blokady, cztery razy, ok. godziny), bez udziału człowieka. Skutek to odmowa usługi dla potwierdzeń
  DESTRUCTIVE do ponownej rejestracji ze step-up MFA Entra (wcześniej DoS kończył się po 15 minutach). Zdarzenie
  `authenticator_disabled` nadaje się na alert SIEM; powiadomienie użytkownika poza klientem AI nie jest częścią kontraktu.
- **Atomowość:** licznik dzienny podlega tej samej regule atomowości co licznik 5/15 min (CC-092); wektor
  `totp/concurrent-wrong-codes-hit-the-daily-limit-once`.
- **Pliki:** `credential-broker.v1.yaml` (`AuthenticatorStatus`, `AuthenticatorVerifyResult`, opisy, przykłady),
  `portal-bff.v1.yaml` (przykład, opisy), `audit-event.schema.json` (opis `reason`), `tool-error.schema.json` (opis
  `registerUrl`), wektory `totp/daily-limit-*` (7) i `enrollment-replaces-disabled-registration`,
  `confirmation-binding/first-call-authenticator-disabled`, `retry-authenticator-disabled`, wektory audytu i błędów.
- **SemVer:** nowa wartość enum (`state`, `result`) to major; wchodzi do 3.0.0 razem z pivotem.
- **Wpływ:** ws-06 (licznik dzienny, stan `disabled`, enrollment ze stanu `disabled`), ws-05 (mapowanie `disabled`),
  ws-07 (przezroczyste), ws-08 (baner i akcja ponownej rejestracji, brak odblokowania), ws-10 (test 20 błędów).
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-28)

## CC-127 | C11/C10/C8 | Najwyżej jedna oczekująca operacja DESTRUCTIVE na użytkownika

- **Zgłasza:** automatyczny przegląd bezpieczeństwa commitów 3.0.0; decyzja człowieka 2026-10-28
- **Kamień:** wydanie 3.0.0 (część pivotu)
- **Problem:** kod TOTP nie jest związany z operacją (CC-091, ryzyko rezydualne przyjęte przez człowieka). Przy kilku
  jednocześnie oczekujących operacjach `DESTRUCTIVE` wpisany kod mógłby potwierdzić dowolną z nich.
- **Zmiana:** nowe żądanie `DESTRUCTIVE`, które jest **inną operacją** (inne narzędzie, serwer albo argumenty) niż
  oczekująca, unieważnia poprzednią oczekującą `DESTRUCTIVE` tego użytkownika. Powtórzone pierwsze wywołanie tej samej
  operacji zwraca ten sam rekord (TTL bez przedłużenia) i niczego nie unieważnia. Oczekujące potwierdzenia o innym
  ryzyku (wymagane przez politykę) nie są ani unieważniane, ani liczone; dla nich zostaje limit oczekujących na `sub`
  (domyślnie 3, `rate_limited`).
  - **Kod błędu C10:** `confirmation_superseded` (nowy kod; ciało `{error, message}`, bez `confirmationId`). Dostaje go
    ponowienie z kodem dla unieważnionego wywołania: bez pytania brokera, bez zużycia próby i kroku TOTP. Gateway trzyma
    ślad po unieważnionym wywołaniu do końca jego pierwotnego TTL (120 s); potem odpowiedź to zwykłe
    `confirmation_failed`. Podgląd unieważnionego wywołania (`GET /admin/v1/confirmations/{id}`, C12) to `404`
    `not_found_or_denied` ("ten link jest nieaktualny").
  - **Audyt:** zdarzenie `confirmation` starego wywołania z `decision: deny`, `outcome: denied`, `reason: superseded`,
    `errorCode: confirmation_superseded`, emitowane w chwili utworzenia nowego pending (i ponownie przy ponowieniu
    starego). W `GET /api/v1/activity/calls` (CC-095, tekst do akceptacji) wynik końcowy `superseded`.
  - **Co to daje i czego nie daje:** kod może potwierdzić najwyżej najnowszą oczekującą operację `DESTRUCTIVE` i tylko
    raz; unieważnienie starszej jest jawne i widoczne w audycie. Nie zapobiega podmianie: zmanipulowany agent może
    unieważnić operację A swoją B i dopiero B potwierdzić kodem wpisanym dla A. Podgląd pozostaje opcjonalny (ryzyko
    rezydualne przyjęte, opisane w README, "Potwierdzenia kodem TOTP", pkt 7).
- **ZMIANA po decyzji człowieka 2026-10-28 (przegląd M1): "pierwsza wygrywa po otwarciu podglądu".** Jeśli właściciel
  otworzył podgląd oczekującej operacji `DESTRUCTIVE` A (`previewViewedAt` ustawione), nowa, inna operacja `DESTRUCTIVE` B
  **nie** unieważnia A: B dostaje błąd C10 **`confirmation_blocked`** (nowy kod, wybór koordynatora: nie koliduje z
  `decision`/`result` `confirmation_pending`; `{error, message, retryAfterSeconds}`, bez `confirmationId`, `message` mówi
  klientowi, że ma NIE prosić użytkownika o kod dla tego wywołania). Blokada trwa **do potwierdzenia A albo do
  `max(A.expiresAt, previewViewedAt + 90 s)`**, niezależnie od wyczerpania prób A i jego wygaśnięcia (przegląd delty, N-H1:
  inaczej agent obchodził zasadę, wyczerpując próby A trzema błędnymi kodami albo czekając do końca TTL, i potwierdzał B
  kodem wpisanym dla A; 90 s to najdłuższa ważność kodu przy kroku 30 s i oknie +-1). Wyczerpany lub wygasły A z
  `previewViewedAt` zostaje jako ślad blokujący; potwierdzony A blokady nie daje. `retryAfterSeconds` = czas do końca
  blokady. Ta sama operacja co A nie jest "inna": dostaje rekord A, a po jego wyczerpaniu nowe oczekujące wywołanie. Bez
  zapisanego podglądu działa jak wyżej (nowa unieważnia starą). Dotyczy tylko `DESTRUCTIVE`.
  **`previewViewedAt` ustawia jawne wywołanie** z wyrenderowanej, widocznej strony (C12 `POST
  /api/v1/confirmations/{id}/viewed` z XSRF, SPA po załadowaniu i przy `document.visibilityState = visible`, nie w
  prerenderze; C5 `markConfirmationViewed`), **nie sam GET** (prerender lub prefetch nie może zablokować operacji;
  przegląd delty, N-L5); `GET` podglądu nie ma skutków ubocznych. Zapis widoku i sprawdzenie go przy B są atomowe względem
  siebie (jedna operacja na użytkownika, jak w H1): wyścig kończy się odrzuceniem B (widok pierwszy) albo unieważnieniem
  A i `404` na wywołanie widoku (B pierwsze). Audyt: `event: confirmation` dla B z `decision: deny`, `reason:
  pending_exists`, `errorCode: confirmation_blocked`. W `/activity/calls` wynik `blocked_by_pending` (grupa
  `confirmation`; `result` liczy się z `reason`, nigdy z `errorCode`, bo `confirmation_pending` jako `decision` znaczy
  "czeka"). Wektory: `confirmation-binding/first-call-preview-viewed-*` (w tym `exhausted-still-blocks`,
  `late-expired-still-blocks`, `block-ends-after-code-validity`, `confirmed-does-not-block`), `first-calls-race-*`,
  `tool-errors/confirmation-blocked*`, `audit-events/gateway-confirmation-pending-exists`, `activity-calls/*blocked-by-pending`.
- **N-M1 rozstrzygnięte decyzją człowieka 2026-10-28:** obejrzaną i niechcianą operację A właściciel może anulować w
  podglądzie (CC-128), co zdejmuje blokadę.
- **Limit 3 oczekujących potwierdzeń o ryzyku innym niż DESTRUCTIVE: potwierdzone przez człowieka 2026-10-28.**
- **Uczciwy opis ograniczeń (przegląd 3.0.0, M1):** unieważnienie następuje przed wpisaniem kodu i zostawia ślad w
  audycie, ale użytkownik nie dostaje sygnału: strona podglądu pokazuje stan z chwili otwarcia i się nie odświeża (frontend
  powinien ją odpytywać i po `404` pokazać "link nieaktualny"); podmiana jest możliwa także po obejrzeniu podglądu; kod może
  też potwierdzić jedno z oczekujących potwierdzeń o innym ryzyku (do 3, nie są unieważniane). Zasada "pierwsza wygrywa po podglądzie"
  weszła decyzją człowieka (zob. wyżej); jedno oczekujące potwierdzenie na wszystkie ryzyka nie weszło.
- **Ślad (przegląd 3.0.0, M2):** ślad po unieważnionym wywołaniu nie jest oczekującym wywołaniem: ponowne wywołanie tej
  samej operacji tworzy nowe oczekujące wywołanie (nowy `confirmationId`, nowy TTL), unieważnia bieżące DESTRUCTIVE i
  zastępuje ślad pod tym samym kluczem; ślady nie liczą się do limitu. Wektory `first-call-after-superseded-same-operation`,
  `first-call-tombstone-does-not-count-toward-limit`, `retry-after-reissue`.
- **Atomowość (przegląd 3.0.0, H1):** utworzenie oczekującego DESTRUCTIVE i unieważnienie poprzedniego to jedna operacja
  atomowa na `sub`; gateway rezerwuje próbę (dekrement `attemptsLeft`) przed pytaniem brokera i zwraca ją przy `locked`,
  `disabled`, `not_registered` i błędzie brokera; zużycie oczekującego przy `ok` to compare-and-delete. Wektory
  `first-calls-parallel-*` i `retries-parallel-*`.
- **Limit innego ryzyka (L8):** `rate_limited` ma `retryAfterSeconds` równe czasowi do wygaśnięcia najstarszego z nich.
- **Pliki:** `tool-error.schema.json` (`ConfirmationSuperseded`), `common.schema.json` (`ErrorCode`),
  `gateway-admin.v1.yaml` (404 podglądu), `audit-event.schema.json` (opis `reason`), `scripts/lib/confirmation.mjs`,
  wektory `confirmation-binding/first-call-*` (m.in. nowa operacja unieważnia starą, inne narzędzie, inne ryzyko),
  `retry-superseded*`, `tool-errors/confirmation-superseded` i negatywny, audyt `gateway-confirmation-superseded`.
- **SemVer:** nowa wartość enum (`ErrorCode`), major; wchodzi do 3.0.0.
- **Wpływ:** ws-05 (jedna oczekująca DESTRUCTIVE, ślad do końca TTL, mapowanie), ws-08 (stan podglądu "nieaktualny"),
  ws-10 (test: druga operacja unieważnia pierwszą), klienty (obsługa `confirmation_superseded`: wywołać operację od nowa).
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-28)

## CC-128 | C5/C12/C10/C8 | Anulowanie oczekującej operacji przez właściciela

- **Zgłasza:** przegląd delty 3.0.0 (N-M1); decyzja człowieka 2026-10-28
- **Kamień:** wydanie 3.0.0 (część pivotu, uzupełnia CC-127)
- **Problem:** po CC-127 obejrzana, a potem niechciana operacja A blokuje inną operację B do końca blokady, a człowiek nie ma jak
  jej odrzucić (odmowa to niewpisanie kodu).
- **Zmiana:** właściciel może anulować oczekującą operację z podglądu:
  - C12 `POST /api/v1/confirmations/{id}/cancel` (`cancelMyConfirmation`: sesja i XSRF, **bez MFA**, bo niczego nie
    zatwierdza) -> C5 `POST /admin/v1/confirmations/{confirmationId}/cancel` (`cancelConfirmation`), `204`; idempotentne,
    dopóki żyje ślad (drugie anulowanie to `204`); `404 not_found_or_denied` dla cudzego, nieistniejącego, wygasłego,
    unieważnionego i już wykonanego;
  - skutek: oczekujące wywołanie usunięte compare-and-delete **uporządkowanym z weryfikacją kodu na tym samym rekordzie**
    (kod sprawdzany równolegle z anulowaniem nie wykonuje wywołania: odpowiedź `confirmation_cancelled`; krok TOTP w brokerze
    jest zużyty, co jest akceptowalne), blokada "pierwsza wygrywa" zdjęta, ślad po anulowanym wywołaniu do końca jego TTL
    (potem `confirmation_failed`), ponowne wywołanie tej samej operacji tworzy nowe oczekujące;
  - C10: nowy kod **`confirmation_cancelled`** (`{error, message}`) dla ponowienia anulowanego wywołania, bez pytania
    brokera i bez zużycia próby;
  - C8: `event: confirmation`, `decision: deny`, `reason: cancelled_by_owner`, `errorCode: confirmation_cancelled`
    (przy przyjęciu anulowania i przy ponowieniu); `/activity/calls`: wynik `cancelled` (etykieta "Anulowane", grupa
    `confirmation`).
  - **Unieważnienie bieżących kodów (przegląd bezpieczeństwa fd930f9, decyzja koordynatora):** bez tego agent trzymający kod
    wpisany przez człowieka dla A mógłby po anulowaniu A (zdejmującym blokadę CC-127) utworzyć B i potwierdzić je tym kodem.
    Nowa operacja C4 `POST /v1/authenticator/invalidate-codes` (`invalidateAuthenticatorCodes`, tylko gateway, wariant
    użytkownika JWT z `tool` anulowanej operacji, `204`, idempotentna): broker ustawia `burnedThrough = max(burnedThrough,
    krok zegara brokera + 1)` i `lastAcceptedStep = max(lastAcceptedStep, burnedThrough)` atomowo na `sub` (razem z
    licznikami `verify`). Kod z kroku `<= burnedThrough` ma wynik `burned` (gateway pokazuje go klientowi jak `replayed`), **nie liczy się** do limitów 5/15 min i 20/24 h
    (inaczej trzymany kod służyłby do zablokowania użytkownika); kod z kroku o dwa dalej działa (po 30-60 s). Gateway woła
    broker PRZED usunięciem oczekującego wywołania: błąd brokera to `503` na anulowaniu i nic nie jest anulowane
    (fail-closed); użytkownik bez aktywnej rejestracji: `204`, nic do unieważnienia. Audyt brokera: `event: authenticator`,
    `reason: totp_steps_burned`. Wektory: `totp/burn-*` (5: trzymany kod `burned` bez wpływu na limity, kod następnego
    kroku działa, kod o krok do przodu też spalony, brak zasilania blokady 5/15 i limitu dziennego, idempotencja), JWT
    `valid-broker-authenticator-invalidate-codes` i `...-without-tool`, audyt `broker-authenticator-steps-burned`.
  - To **nie** przywraca `confirmation_declined`: w portalu nie ma decyzji pozytywnej, potwierdzenie nadal tylko kodem TOTP.
- **Pliki:** `credential-broker.v1.yaml` (`invalidateAuthenticatorCodes`), `gateway-admin.v1.yaml` (`cancelConfirmation`, dodane `503`), `portal-bff.v1.yaml` (`cancelMyConfirmation`),
  `tool-error.schema.json`, `common.schema.json` (`ErrorCode`), `audit-event.schema.json` (opis `reason`), przykłady i mocki
  (WireMock, MSW), wektory `confirmation-binding/` (`retry-cancelled*`, `first-call-cancelled-*`,
  `first-calls-race-view-cancel-*`, `retries-parallel-cancel-*`, `retries-parallel-code-typed-after-cancel-*`),
  `tool-errors/confirmation-cancelled*`, `audit-events/gateway-confirmation-cancelled-by-owner`, `activity-calls/*cancelled*`.
- **SemVer:** nowa wartość enum (`ErrorCode`) i nowe endpointy: major (3.0.0).
- **Wpływ:** ws-06 (`invalidate-codes`, `burnedThrough`, replay bez liczenia do limitów), ws-05 (anulowanie atomowo z weryfikacją, wołanie brokera przed usunięciem, ślad, audyt), ws-07 (proxy), ws-08 (przycisk "Anuluj" w podglądzie, etykieta
  "Anulowane"), ws-10 (test wyścigu anulowania z kodem), klienty MCP (obsługa `confirmation_cancelled`).
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-28)

- **Poprawka pola `resource.parent` (przegląd bezpieczeństwa fd930f9, CC-031):** `parent` w `audit-event.schema.json` (stąd też w
  `ActivityCall` i `ConfirmationView`) ma to samo wykluczenie znaków co `resource.id`: C0, C1, DEL, U+2028, U+2029,
  U+202A..U+202E i U+2066..U+2069 w części `<id>`; wektory negatywne `invalid-resource-parent-*`, pozytywny z ukośnikiem.

- **Poprawki po przeglądzie fd930f9+1308e68 (F-H1, F-M1, F-M3 i drobne):** (1) F-H1: po końcu blokady kod wpisany dla obejrzanego A
  może być jeszcze ważny (do 90 s po wygaśnięciu A), więc tworzenie B po obejrzanym, niepotwierdzonym śladzie A (oczekującym,
  wyczerpanym, wygasłym; nie anulowanym ani potwierdzonym, nie dotyczy tej samej operacji) najpierw woła `invalidate-codes`
  w tej samej sekcji per użytkownik; błąd brokera to `upstream_unavailable` dla B i nic nie powstaje; blokada
  `max(A.expiresAt, previewViewedAt + 90 s)` zostaje; `retryAfterSeconds` >= 1. (2) F-M1: ślad blokujący jest
  przechowywany na `sub`, osobno od oczekujących i nie jest zastępowany przez A'; "zastępuje ślad" dotyczy tylko śladów
  `superseded`. (3) F-M3: w `/activity/calls` błędny kod z pozostałymi próbami to `confirmation_pending`, a po TTL (liczonym od
  pierwszego zdarzenia, nie od ostatniego) `expired` ze zachowanym `wrongCodeCount`; `confirmation_failed` tylko po wyczerpaniu
  prób; `expired` zawsze z `errorCode: null`. (4) Kod ze spalonego kroku: wynik brokera `burned` (nie `replayed`), gateway
  nie zużywa próby i nie liczy błędnego kodu (`code_burned`), na zewnątrz `confirmation_failed`; audyt brokera `totp_burned`.
  (5) Powtórzone anulowanie nie pali kodów ponownie. (6) Kursor `/activity/calls`: HMAC-SHA-256 kluczem gateway'a po (`sub`,
  pozycja, `iat`), znacznik >= 128 bitów, porównanie w stałym czasie, ważność 15 min (`activity-cursor/`).
- **Poprawki po przeglądzie końcowym e154309 (G-H1, G-M1, G-L1, G-L2, G-L3):** (1) G-H1: spalanie przy tworzeniu B dotyczy też
  obejrzanego A **potwierdzonego** (drugi kod wpisany "dla A" mógłby potwierdzić B); wyjątek zostaje tylko dla tej samej operacji i
  anulowanego A; blokada bez zmian (potwierdzone A nie blokuje); wektory `first-call-preview-viewed-confirmed-burns-before-b`,
  `-confirmed-long-ago-no-burn`, `-confirmed-burn-failed`. (2) G-M1: ślad obejrzanego A, w dowolnym stanie, jest przechowywany co
  najmniej do `A.expiresAt + 90 s` (210 s od utworzenia), niezależnie od końca blokady; wcześniejsze usunięcie jest niezgodne z
  kontraktem. (3) G-L1: stan potwierdzeń w trwałym magazynie, brak rekordu to brak potwierdzenia, niedostępny magazyn to 503 dla
  tworzenia DESTRUCTIVE, po niepewnej ciągłości stanu przez 210 s `invalidate-codes` przed utworzeniem. (4) G-L2: wynik `burned`
  (nie `replayed`) w tekście CC-128 i migracji. (5) G-L3: `invalidate-codes` wołane przy anulowaniu (`tool` = anulowana operacja)
  i przy tworzeniu DESTRUCTIVE B po obejrzanym śladzie A (`tool` = B).
- **Poprawka bezpieczeństwa 3.0.1 (wydanie 3.0.0 miało tę lukę):** wyjątek "ta sama operacja" w warunku spalania obowiązuje tylko dla A,
  które nie zostało wykonane. Po potwierdzonym, obejrzanym A agent wywołujący ponownie tę samą operację (A') nie mógł być
  powstrzymany: człowiek wpisywał drugi kod "dla A" i potwierdzał A' bez spalenia. Teraz tworzenie nowej oczekującej DESTRUCTIVE
  po potwierdzonym, obejrzanym A (do `A.expiresAt + 90 s`) zawsze woła najpierw `invalidate-codes`, także dla tej samej
  operacji. Wektor `first-call-preview-viewed-confirmed-same-operation-burns`. Razem z doprecyzowaniami tekstowymi z planu 3.0.1
  (G-L4 `GET`/`viewed`/`cancel` przy wyczerpanym A, G-L5 anulowanie do `expiresAt`, G-L6 zegary, G-L7 wymagania ws-08, G-L9
  agregacja `authenticator_disabled`/`authenticator_not_registered`, G-L10 kursor, wektor "broker niedostępny przy anulowaniu").

## CC-129 | C7 | `inheritedClassification` na `GitLab::Group` i `GitLab::Project`

- **Zgłasza:** przegląd paczki polityk M3 (HIGH-1) i propozycja CC-C w STATUS `mcp-policies`; decyzja człowieka 2026-10-28
- **Kamień:** wydanie 3.1.0 (zmiana addytywna: minor, ale zmienia bajty `cedar/mcp.cedarschema`, więc paczki polityk i biblioteki muszą przejść razem)
- **Problem:** topics w GitLabie się nie dziedziczą. Oznaczenie grupy `hr` jako `restricted` nie obejmowało projektu `hr/payroll/app`:
  reguła sprawdzała klasyfikację projektu i jego bezpośredniej grupy (`hr/payroll`). Zasada "restricted zawsze zabrania" miała
  lukę dla poddrzewa głębszego niż jeden poziom.
- **Zmiana:** wymagany atrybut `inheritedClassification: Set<String>` na `GitLab::Group` i `GitLab::Project` (schemat Cedar):
  suma znormalizowanych (CC-067) topics wszystkich grup-przodków (grupa: grupy nad nią; projekt: wszystkie grupy na ścieżce, także
  rodzic). Własne topics zostają w `classification`. Serwer podaje je w wejściu buildera jako `attrs.ancestorClassifications`
  (mapa ścieżka grupy -> topics, dokładnie dla grup przodków; `{}` jawnie dla grupy najwyższego poziomu); builder (Java i
  referencja Node) liczy sumę, a wejście nie trafia do encji. **Fail-closed tylko dla tego atrybutu:** brak mapy, brakująca lub
  nadmiarowa grupa (w tym sama grupa) albo topics inne niż lista napisów to `internal_error`, zasób nie jest budowany.
  Przykładowa polityka `forbid-restricted.cedar` sprawdza `inheritedClassification` w regułach grupy i projektu.
- **Pliki:** `cedar/mcp.cedarschema` (skrót SHA-256 `cf79068b...`), `cedar/entity-builder.md`, `cedar/examples/forbid-restricted.cedar`,
  `EntityBuilder.java`, `scripts/lib/entity-builder.mjs`, wektory `entity-builder/server-gitlab-*` (9 nowych), `policy-decisions/srv-gitlab-*`
  (4 nowe: dwa poziomy pod restricted, podgrupa restricted, normalizacja pisowni, kontrola pozytywna), `result-filter/gitlab-projects-in-restricted-subtree`;
  istniejące wektory GitLaba dostały `ancestorClassifications`; paczki testowe przebudowane.
- **SemVer:** nowy wymagany atrybut encji i nowe wejście buildera: addytywne dla polityk, ale serwer GitLaba musi podawać
  `ancestorClassifications`, a paczki muszą zawierać nowy schemat. Według tabeli SemVer to zmiana major, łamiąca dla paczek polityk 3.0.x. Wydane jako 3.1.0 (minor) z powodu błędu koordynatora (nazwał zmianę addytywną); człowiek zdecydował (2026-10-28), że 3.1.0 zostaje z opisanym wyjątkiem SemVer, jak 2.1.0.
- **Wpływ:** ws-04 (serwer GitLab: ścieżki grup i ich topics), ws-02/ws-05 (biblioteki 3.1.0), ws-09 (reguły `forbid` na `inheritedClassification`, przebudowa
  paczek), ws-10 (test: projekt trzy poziomy pod restricted).
- **Dopisek (decyzja człowieka 2026-10-28, 3.1.1):** GitLab API v4 nie ma `topics` dla grup (tylko dla projektów), więc założenie "topics samej grupy" było błędne. Klasyfikujemy tylko projekty, grup nie: `classification` grupy jest zawsze pusty, a `ancestorClassifications` serwer podaje ze ścieżki z pustymi listami; `inheritedClassification` zostaje w schemacie dla zgodności z 3.1.0 i w praktyce jest pusty. Bez zmiany schematu. Wektory: `srv-gitlab-group-unclassified-allowed` i `srv-gitlab-project-topic-in-unclassified-group-denied`.
- **Status:** accepted (decyzja: człowiek, 2026-10-28), wydanie 3.1.0

## CC-130 | C6 | `delete`/`admin` jako `DESTRUCTIVE` w manifeście (propozycja CC-E przeglądu polityk M3)

- **Propozycja:** wymusić w regułach manifestu, że narzędzie z `action` `delete` lub `admin` ma `risk: DESTRUCTIVE`.
- **Status:** rejected (decyzja: człowiek, 2026-10-28). Odpowiedzialność autora serwera i przeglądu definicji (zatwierdzanie `definitionHash`).

## CC-131 | C7 | Wymagana klasyfikacja GitLab i service desk (propozycja CC-D)

- **Propozycja:** uczynić `classification` wymaganą dla `GitLab::*` i `ServiceDesk::Queue`, jak `category`, `labels`, `tags` (CC-062).
- **Status:** rejected (decyzja: człowiek, 2026-10-28). Brak klasyfikacji znaczy "nie tajne"; dla GitLaba tajność przodków wynika z CC-129.

## CC-132 | C7/C8 | `BundleFetcher` i powód `upstream_unavailable` w słowniku (propozycja CC-A)

- **Propozycja:** klient pobierania paczek w `mcp-policy-bundle` (`latest.json` z `ETag`, limit 16 MiB, kolejność pobrań) oraz powód `upstream_unavailable` w słowniku odrzuceń.
- **Status:** deferred (decyzja: człowiek, 2026-10-28). Powód `upstream_unavailable` w słowniku odrzuceń zamyka CC-142 (4.0.0); `BundleFetcher` zostaje odłożony.


---

## Pakiet M4 (4.0.0) - decyzje człowieka z 2026-10-29

Pozycje A1-A7, B1-B11, B13-B15 przyjęte; B12 odrzucona; pozycje C odłożone. Wydanie 4.0.0 (major): po przeglądzie Opus człowiek zdecydował (2026-10-29) o numerze 4.0.0 i o zachowaniu zmian łamiących (lista w `CHANGELOG.md`). Źródło: `mcp-platform-plan/cc-pakiet-m4.md`
(kolumna "Decyzja"). Wszystkie wpisy poniżej: accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0.

| CC | Pozycja pakietu | Tytuł | SemVer (wg README) |
| --- | --- | --- | --- |
| CC-096, CC-097, CC-113 | A2a, A1a, A2b | wcześniejsze wpisy, wdrożone | CC-097 i CC-113 major (pole wymagane, zmiana tabeli akcji), CC-096 minor |
| CC-133 | A1b-A1d | Reguły rejestru: pochodzenie manifestu, wdrożenie zatwierdza tylko `READ_ONLY`, zmiana poza wdrożeniem blokuje, obniżenie `risk` zawsze 422, audyt | major |
| CC-134 | A3 (retencja) | Retencja aktywności (konfiguracja, domyślnie 30 dni) i audytu (SIEM 365 dni) | patch (opis) |
| CC-135 | A4a | Wymiary limitów i limit DESTRUCTIVE jako konfiguracja | patch (opis) |
| CC-136 | A5d | `context.credentialType` w modelu Cedar | major (zmiana bajtów schematu) |
| CC-137 | A7a | Klucze z prefiksem `dev-` odrzucane poza trybem dev | major (zaostrzenie odbiorcy) |
| CC-138 | A7b | `environment` w manifeście | minor |
| CC-139 ... CC-152 | B1-B11, B13-B15 | doprecyzowania, patrz niżej | CC-146 major, reszta minor / patch |
| CC-153 | B12 | `neutralized` i limity argumentów w `ConfirmationArgument` | rejected |
| CC-154 | A2c, A2d | `GET /api/v1/access-requests/entitlements`, `decidedAt` | minor |
| CC-155 | A3a, A3b, A3c, A3d, A3e | Offboarding: `purge` brokera i gateway'a, `user_purged`, `unused_cleanup` | minor |
| CC-156 | A4b-A4f | Odpowiedzi przy przekroczeniu limitu i powody `rate_limited_*` | minor |
| CC-157 | A5a-A5c | `token-exchange` i `service-account` w `resolve` | major (`expiresAt` wymagane) |
| CC-158 | A5e | `422 system_not_configured` | major (zmiana kodu, nowa wartość enum) |
| CC-159 | A5f | `credential_type_mismatch` przy rejestracji | major (odrzuca dzisiejszy manifest OpenSearch) |
| CC-160 | A6a, A6b | Zapytania serwera ze struktury, nazwy indeksów zamiast wzorców | minor (opis i wektory) |
| CC-161 | po przeglądzie 4.0.0 | Certyfikat potoku związany z `serverId`; zatwierdzone narzędzie nieobecne na serwerze ukryte | major (zmiana CN dla `PUT`) |
| CC-162 | po przeglądzie 4.0.0 | `PendingTool.source` i pierwszeństwo wpisu z `PUT` | major (pole wymagane) |

## CC-133 | C5/C8 | Reguły rejestru: pochodzenie manifestu, zatwierdzanie, blokada, obniżenie `risk`, ślad w audycie (A1b-A1d)

- **Zgłasza:** gateway (G-13), ws-00; decyzja człowieka 2026-10-29, z korektą po przeglądzie (H1, M1) tego samego dnia
- **Problem:** CC-097 dodaje pola, ale nie mówi, co robi gateway przy zmianie definicji ani kto zatwierdza wdrożenie. Zatwierdzanie
  wszystkiego przez `PUT` bez wskazania, skąd jest manifest, pozwalało obejść przypinanie manifestem pobranym z podmienionego serwera.
- **Wariant:** (1) ciało `PUT` z `mcp-registry-ci` to artefakt budowy przeglądanego commitu, nigdy manifest z działającego serwera; poza `devstack` gateway
  nie pobiera manifestu od serwera i go nie zatwierdza (bootstrap tylko dev, objęty sprawdzeniem `environment`); (2) wdrożenie zatwierdza same narzędzia
  `READ_ONLY`; nowe albo zmienione `UPDATE`/`DESTRUCTIVE` to `pending_approval` (`change`, `pendingVersion`) i czekają na `approve` administratora; usunięte
  z manifestu są usuwane; (3) definicja podana przez serwer, różna od zatwierdzonej, jest ukryta (`tool_disabled`, powód audytu `definition_changed`) do `approve`;
  mechanizm: gateway buduje `tools/list` klienta z zatwierdzonych wpisów, porównuje ostatnio widzianą definicję z serwera (odczyt odświeżany najpóźniej co TTL)
  przy `tools/list` i przed `tools/call`, `risk`/`action`/`resourceRefs` bierze z zatwierdzonego wpisu, narzędzia niezarejestrowanego nie pokazuje;
  (4) obniżenie `risk` zawsze `422 manifest_rejected` (`reason: risk_lowered`), także przy `approve` i po usunięciu i ponownym dodaniu; (5) audyt `admin_change` z powodami
  `definition_registered`, `definition_submitted`, `definition_approved`, `tool_removed` i opcjonalnym polem `definitionHash`.
- **Ryzyko rezydualne przyjęte przez człowieka (2026-10-29):** zmiana nazwy z obniżeniem ryzyka w jednym `PUT` (narzędzie zapisu usunięte, nowe `READ_ONLY`).
- **Pliki:** `openapi/gateway-admin.v1.yaml` (opis `registerServer` i `approveTool`, `ManifestRejected`, `422`, przykłady), `openapi/portal-bff.v1.yaml` (`422` w `approveAdminTool`),
  `schemas/audit-event.schema.json` (`definitionHash`, opis `reason`), wektory `audit-events/gateway-registry-*`, `gateway-definition-changed`, README ("Rejestr i przypinanie definicji").
- **SemVer:** major: zmiana zachowania istniejącej operacji (`PUT` nie zatwierdza już wszystkiego), nowy powód odrzucenia w `422`, nowe pole wymagane `pendingVersion` w odpowiedzi.
- **Wpływ:** ws-05 (zachowanie, audyt), ws-04 i ws-02 (artefakt budowy, serwery przy zmianie definicji), ws-08 (widok diffu, oczekujące po wdrożeniu), ws-10, ws-01 (bootstrap tylko dev).
- **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-134 | README | Retencja aktywności i audytu (A3, zasada)

- **Wariant:** retencja tabeli aktywności portalu (`/activity`, `/activity/calls`) jest konfiguracją komponentu, domyślnie 30 dni, nie stałą kontraktu; aktywność odchodzącego użytkownika zostaje do końca retencji; pełny audyt C8 idzie na stdout do SIEM, retencja 365 dni po stronie SIEM.
- **Pliki:** README ("Retencja i offboarding"), opisy `listActivity` i `listActivityCalls`, `listMyActivityCalls`.
- **SemVer:** patch (opis). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-135 | README | Wymiary limitów i osobny limit DESTRUCTIVE (A4a)

- **Wariant:** trzy liczniki w gateway'u (użytkownik; użytkownik i klient AI; użytkownik i narzędzie); wartości to konfiguracja. Osobny, niższy limit dla DESTRUCTIVE to konfiguracja per narzędzie; kontrakt się nie zmienia poza opisem.
- **Pliki:** README ("Limity zapytań"), opis C4 (limity brokera są konfiguracją).
- **SemVer:** patch (opis). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-136 | C7 | `context.credentialType` (A5d)

- **Wariant:** opcjonalny napis w `RequestContext` (jeden z czterech typów z C4). Gateway bierze typ z własnej konfiguracji systemu (tej samej, której używa CC-159) i podaje go
  zawsze przed decyzją Cedar; serwer z własnej konfiguracji (kontrakt nie dodaje nagłówka). Atrybut zostaje opcjonalny w modelu, a przykład jest fail-closed:
  `cedar/examples/credential-type.cedar` zabrania odczytu kolejki i zgłoszenia Service Desku poza przyznanym zakresem przy koncie serwisowym, także gdy atrybutu brak (cel A5d).
- **Bajty `mcp.cedarschema`:** zmieniają się (atrybut i komentarz nagłówka), SHA-256 `902b254090cc7bd5b8f4ff3fa26b76850f516e9d07da0f9faed1729deb1412f7` (3.1.x: `cf79068b...`). Biblioteki, paczki polityk i serwery przechodzą na 4.0.0 razem; paczka na schemacie 3.1.x daje `schema_mismatch`.
- **Pliki:** `cedar/mcp.cedarschema`, `cedar/entity-builder.md`, `EntityBuilder.withCredentialType`, `scripts/lib/entity-builder.mjs`, wektory `entity-builder/credential-type-*`, `policy-decisions/srv-servicedesk-*`, testy skrótu.
- **SemVer:** major (zmiana bajtów schematu, po której paczki 3.1.x przestają przechodzić). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-137 | C2/C7 | Klucze z prefiksem `dev-` (A7a)

- **Wariant:** rozszerzenie CC-044: odbiorcy (serwery, broker, gateway, odbiorcy paczek) odrzucają `kid`/identyfikator klucza zaczynający się od `dev-` z powodem `test_key_not_allowed`, chyba że jawnie włączono tryb dev (to samo ustawienie co `allowTestKeys`). Lista odcisków kluczy testowych bez zmian.
- **Pliki:** `BundleVerifier`, `schemas/internal-jwt.schema.json`, README, wektory `jwt/dev-kid-rejected-by-default`, `jwt/valid-dev-kid-in-dev-mode`, `bundles/dev-key-id-rejected-by-default`, `keys/dev-gateway-jwks.json`.
- **SemVer:** major (zaostrzenie odbiorcy: odrzuca klucze, które dotąd przechodziły). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-138 | C6 | `environment` w manifeście (A7b)

- **Wariant:** opcjonalne `environment` (`production` | `dev`, brak = `production`, poza `definitionHash`); gateway w trybie produkcyjnym odrzuca `dev`: `422 manifest_rejected`, `reason: environment_mismatch`.
- **Pliki:** `schemas/server-manifest.schema.json`, opis `registerServer`, wektory `manifests/*environment*`.
- **SemVer:** minor. **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-139 | C6/common | `OpenSearchIndexPrefix` jako jedna zakotwiczona postać (B1)

- **Zmiana:** `^(?:[a-z0-9][a-z0-9._-]{0,253}[a-z0-9_]|[a-z0-9])$` zamiast alternacji na najwyższym poziomie; ten sam język, więc patch. Naprawia użycie jako `contractPattern` przy regule `input-schema-bounded` (CC-123). `ResourceIds.java` zgodnie.
- **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-140 | README/C6 | Manifest powstaje przy starcie lub w budowie (B2)

- **Zmiana:** opis w README i w schemacie manifestu (patch). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-141 | C10/C8 | Niedostępna polityka na serwerze, `policy_forbid` i `not_granted` na serwerze (B3)

- **Zmiana:** `upstream_unavailable` także dla braku paczki polityk po restarcie lub własnego błędu silnika polityk (powód audytu `policy_unavailable`); w C8 na serwerze `policy_forbid` to odmowa polityki, `not_granted` zasób nierozwiązany albo bez grantu (patch). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-142 | C8 | Słownik `reason` i grupy filtra `result` (B4)

- **Zmiana:** znane wartości `link_scope`, `policy_unavailable`, `policy_error`, `upstream_unavailable` (dla `virtual_server_change` i `authenticator`), `provider_revoke_failed`, `authenticator_seed_missing`; `ActivityCall.result` dla `tool_call` z powodem `credential_required` i `rate_limited` (referencja `aggregateCall`, wektory); grupy filtra `result` (ok = ok; denied = `denied_*`, `tool_disabled`, `step_up_required`, `rate_limited`; error = `error`, `credential_required`; confirmation = reszta) w opisie `listActivityCalls` i `listMyActivityCalls`. Zamyka część CC-132 (powód `upstream_unavailable`). minor. **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-143 | README/C8 | Budżet zdarzeń `authentication` i nazwa licznika (B5)

- **Zmiana:** osobny budżet na powód dla `missing_token` i `malformed`, nadmiar tylko w liczniku `mcp_audit_authentication_suppressed_total{component,reason}` (README, patch). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-144 | README | `resourcePath` w wektorach `gateway-authentication/` (B6)

- **Zmiana:** `resourcePath` to trasa, metadane zasobu (RFC 9728) wskazują adres endpointu (README, patch). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-145 | README/C11 | Znacznik epoki stanu potwierdzeń (B7)

- **Zmiana:** nazwa "znacznik epoki stanu potwierdzeń" (w jednym magazynie ze stanem, ważny 210 s po utracie) i zachowanie wielu instancji (README, patch). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-146 | C10/entity-builder | Jedna odmowa `not_found_or_denied` (B8)

- **Zmiana:** (a) jeden stały `message` (`The resource does not exist or you do not have access to it.`, `const` w schemacie); (b) najpierw grant, potem budowa encji i klasyfikacja; (c) kolejka service desku poza linkiem w argumencie to `not_found_or_denied`, nie `access_denied`. Zaostrzenie `message` i zmiana kodu w (c) to zmiana major według tabeli SemVer. Wektory `tool-errors/*not-found-or-denied*`. **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-147 | entity-builder | `nothingToQuery()` (B9)

- **Zmiana:** zakres wykluczający wszystko: wyszukiwanie zwraca pusty wynik, pobranie po id `not_found_or_denied` (sekcja 8, patch). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-148 | cedar/examples | Reguły zapisu Confluence, Service Desk i OpenSearch (B10)

- **Zmiana:** `call` dla `mcp-confluence-write`, `mcp-servicedesk-write`, `mcp-opensearch-write`; `update` na `Confluence::Space`, `ServiceDesk::Queue`/`Ticket`, `OpenSearch::Index`; wektory `policy-decisions/*confluence-update*`, `*servicedesk-add-note*`, `*opensearch-update*`, `srv-confluence-create-page-under-parent-*` (minor). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-149 | entity-builder | Źródła klasyfikacji (B11)

- **Zmiana:** etykiety przestrzeni Confluence i tagi indeksu OpenSearch z systemu albo z konfiguracji serwera, kategoria kolejki z adaptera (lista napisów); etykiety niepełne powodują odrzucenie zasobu (patch). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-150 | README | "Ostatnie użycie" konta serwisowego (B13)

- **Zmiana:** liczone z wierszy `activity/calls` o wyniku `ok` lub `confirmed` (i `error`, jeśli dotarło do systemu); bez nowego pola (patch). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-151 | C4 | Domyślny limit startów rejestracji Authenticatora (B14)

- **Zmiana:** 10 startów na godzinę na `sub`, `429 rate_limited` z `Retry-After`, wartość domyślna w opisie (patch). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-152 | README | `400`/`413` przed weryfikacją JWT (B15)

- **Zmiana:** żądania odrzucone `400` lub `413` przed weryfikacją tokenu nie są zdarzeniami `authentication` (tylko licznik) (patch). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-153 | C5/C12 | `neutralized` i limity argumentów w `ConfirmationArgument` (B12)

- **Propozycja:** opcjonalne `neutralized: boolean`, limit długości `value` (8192) i liczby argumentów (64), wzorzec `name`.
- **Status:** rejected (decyzja: człowiek, 2026-10-29).

## CC-154 | C12 | Lista uprawnień do zamówienia i `decidedAt` (A2c, A2d)

- **Zmiana:** `GET /api/v1/access-requests/entitlements?system=` (`RequestableEntitlement`: `entitlement`, opcjonalne `description` jako tekst nieufny), opcjonalne `AccessRequest.decidedAt`; `AccessRequestStatus` bez zmian; anulowanie wniosku z portalu dopiero po M4 (poza 4.0.0). Wnioskodawca jak w CC-052 (A2e, bez zmian). minor. **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-155 | C4/C5/C8 | Offboarding (A3a, A3b, A3c, A3d, A3e)

- **Zmiana:** broker `purge` usuwa połączenia i sekrety (wszystkie wersje), przepływy OAuth, rejestrację Authenticatora i wiersz blokady; nowy `POST /admin/v1/users/{sub}/purge` w C5 (CN `mcp-offboarding`): linki, oczekujące potwierdzenia, sesje MCP, cache poświadczeń; aktywność zostaje do końca retencji (CC-134); sesje portalu kończy back-channel logout; trzy wywołania offboardingu są niezależne i idempotentne; audyt `user_purged` (`connection_change`, `virtual_server_change`) i `unused_cleanup` (domyślnie 180 dni, konfiguracja brokera); każde wywołanie `purge` zostawia też jedno zdarzenie zbiorcze `admin_change`/`user_purged`, także gdy nic nie było do usunięcia; po `purge` `sub` nie jest blokowany (okno do wygaśnięcia tokenu C1, do 60 min, przyjęte przez człowieka 2026-10-29). minor. **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-156 | C10/C1/C8/C4/C12 | Przekroczenie limitu (A4b-A4f)

- **Zmiana:** `tools/call` ponad limit: C10 `rate_limited` z `retryAfterSeconds` >= 1; inne żądania MCP: HTTP `429` z `Retry-After`, ciałem C10 i bez `WWW-Authenticate`; bez nagłówków `X-RateLimit-*`; audyt z powodami `rate_limited_user|client|tool`; `ActivityCall.result` `rate_limited` w grupie `denied`; `429` z `Retry-After` w brokerze (start i zakończenie OAuth) i w BFF (zapis tokenu, operacje Authenticatora). Wektory `gateway-authentication/rate-limited*`. minor. **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-157 | C4 | `token-exchange` i `service-account` w `resolve` (A5a, A5b, A5c)

- **Zmiana:** `token-exchange`: `expiresAt` zawsze podane, `cacheTtlSeconds` <= 60 i <= czas do `expiresAt`, nic w OpenBao, `403 exchange_denied` (C10 `access_denied` bez `requiredEntitlements`, audyt `exchange_denied`); broker sprawdza `subjectToken` (`aud`, `exp`, `sub` równe `sub` wewnętrznego JWT, inaczej `400 invalid_request`, audyt `subject_token_invalid`); `service-account`: klucz z OpenBao (`secret/data/mcp/service-accounts/<system>`), schemat zgodny z systemem (też `Basic`). Schemat `ResolvedCredential` wymaga niepustego `expiresAt` dla `token-exchange`. major (zaostrzenie). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-158 | C4/C8 | `422 system_not_configured` (A5e)

- **Zmiana:** system bez konfiguracji w brokerze: `422 system_not_configured` zamiast `400`; gateway odpowiada `internal_error`, loguje przyczynę, audyt `credential_resolve` z powodem `system_not_configured`. major (zmiana kodu istniejącego wejścia, nowa wartość enum `OAuthCompleteError`). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-159 | C5 | `credential_type_mismatch` (A5f)

- **Zmiana:** przy rejestracji i starcie gateway sprawdza, że typ poświadczenia, o który poprosi broker, jest w `credential.acceptedTypes`; inaczej `422 manifest_rejected`, `reason: credential_type_mismatch`; trzymany manifest, który nie przechodzi przy starcie, wyłącza serwer (`enabled: false`), nie jest usuwany. major (odrzuca manifest OpenSearch z `acceptedTypes: [user-secret]`). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-160 | entity-builder | Zapytania serwera i nazwy indeksów (A6a, A6b)

- **Zmiana:** serwer składa zapytanie ze struktury (nie przyjmuje surowego JQL/CQL), cytuje wartości, warunki użytkownika w nawiasie, `ORDER BY` z listy; OpenSearch rozwiązuje wzorzec `p,p-*` do konkretnych nazw indeksów z pominięciem aliasów i strumieni danych i pyta po liście nazw; alias w argumencie to `not_found_or_denied`. Referencja `scripts/lib/query-rendering.mjs`, wektory `query-rendering/`. `aggregate_logs` wraca po wdrożeniu w serwerze OpenSearch; ws-09 zdejmuje regułę wyłączającą dopiero wtedy. minor (opis i wektory). **Status:** accepted (decyzja: człowiek, 2026-10-29, pakiet M4), wydanie 4.0.0

## CC-161 | C5 | Certyfikat potoku związany z `serverId`; narzędzie nieobecne na serwerze (po przeglądzie 4.0.0)

- **Problem:** jeden CN `mcp-registry-ci` dla wszystkich potoków pozwalał potokowi jednego repozytorium zmienić wpis cudzego serwera (usunąć jego narzędzia albo zatwierdzić `READ_ONLY` z wybranym opisem).
- **Wariant:** CN `mcp-registry-ci-<serverId>`; gateway przyjmuje go tylko dla `PUT` ze ścieżką o tym `serverId`, inny CN (także dawny `mcp-registry-ci`) to `403`, nic nie jest zapisywane, audyt `authentication`/`client_certificate_rejected`.
  Wybrano CN, nie SAN, bo kontrakt już autoryzuje po CN (`x-allowed-client-cn`). Zatwierdzone narzędzie, którego serwer nie podaje w `tools/list`, jest ukryte (`tool_disabled`, powód audytu `tool_not_served`), fail-closed.
- **Pliki:** `openapi/gateway-admin.v1.yaml`, `spectral-functions/mtlsClientCn.js`, `schemas/audit-event.schema.json`, README ("Rejestr i przypinanie definicji").
- **SemVer:** major (zmiana CN dla istniejącej operacji). **Status:** accepted (decyzja: człowiek, 2026-10-29, po drugim przeglądzie), wydanie 4.0.0

## CC-162 | C5/C12 | `PendingTool.source` i pierwszeństwo wpisu z `PUT` (po przeglądzie 4.0.0)

- **Problem:** wpis oczekujący z `PUT` i z odczytu serwera nie były rozróżnione; przejęty serwer mógł podać wersję i definicję, które administrator zatwierdziłby jako zmianę z wdrożenia.
- **Wariant:** `PendingTool.source` (`ci` | `server`, wymagane) i `RegistryTool.source` (przy `pending_approval`); odczyt z serwera nigdy nie zastępuje wpisu ze `source: ci` (tylko blokuje narzędzie i jest logowany); wpis ze `source: server` znika, gdy serwer wraca do zatwierdzonej definicji, i jest zastępowany przez `PUT`; `pendingVersion` dla `server` to wersja zgłoszona przez serwer (widoczna razem ze `source`).
- **Pliki:** `openapi/gateway-admin.v1.yaml`, `openapi/portal-bff.v1.yaml` (przykłady), README. Manifest nie niesie commitu budowy (decyzja człowieka).
- **SemVer:** major (pole wymagane w odpowiedzi). **Status:** accepted (decyzja: człowiek, 2026-10-29, po drugim przeglądzie), wydanie 4.0.0

## CC-163 | C7 | Kolejki konta serwisowego: tylko z paczki polityk (zgłoszenie ws-09 CC-I)

- **Problem:** wektor `servicedesk-service-account/srv-servicedesk-service-account-granted-in-server-config` oczekiwał `continue` dla kolejki przyznanej tylko w `serverConfiguredQueues` (CC-076), a przykład `credential-type.cedar` (CC-136) zabrania zasobu poza `principal in resource.scopes`, który pochodzi wyłącznie z paczki. Kontrakt 4.0.0 był więc sprzeczny.
- **Decyzja (wariant a):** tryb `serverConfiguredQueues` znika; dostęp do kolejek konta serwisowego wynika tylko z grantów w paczce. Wektor zastąpiony przez `srv-servicedesk-service-account-server-config-is-not-a-grant` (`deny`, `not_found_or_denied`); pole `serverConfiguredQueues` zostaje tylko w nim, jako ignorowane, a referencja je pomija.
- **Pliki:** `scripts/generate-vectors.mjs`, `test/vectors.test.mjs`, `test-vectors/servicedesk-service-account/*`, README ("Konto serwisowe service desku"), CC-076 (dopisek).
- **Wpływ:** ws-04 (serwer Service Desku: `MCP_SERVICEDESK_ALLOWED_QUEUES` nie otwiera kolejek; grant w paczce), ws-09 (grant kolejek w `static.json`), ws-10.
- **SemVer:** usunięcie trybu i zmiana oczekiwania istniejącego wektora: według tabeli README major; wydane jako patch 4.0.1 na decyzję człowieka (naprawa sprzeczności 4.0.0). **Status:** accepted (decyzja: człowiek, 2026-10-29), wydanie 4.0.1 (wyjątek SemVer opisany w README, decyzja człowieka 2026-10-29)

## CC-164 | C7 | Lista dozwolonych typów poświadczeń w `credential-type.cedar` (zgłoszenie ws-09 CC-J)

- **Problem:** warunek `context.credentialType != "service-account"` traktował nieznaną wartość (literówka, piąty typ) jak poświadczenie użytkownika i otwierał kolejki poza grantem.
- **Decyzja:** warunek z listą dozwoloną `["user-oauth", "user-secret", "token-exchange"].contains(...)`; brak albo nieznany typ daje odmowę poza grantem. Wektory `policy-decisions/srv-servicedesk-unknown-credential-type-ticket-outside-scope-denied` (żądanie z `api-key`; builder odrzuca taką wartość, więc wektor zapisuje wejście z odrzuconą wartością i test Java sprawdza odrzucenie przez builder) oraz dotychczasowe.
- **Pliki:** `cedar/examples/credential-type.cedar`, `PolicyDecisionVectorTest`, `scripts/generate-cedar-vectors.mjs`, README.
- **SemVer:** zaostrzenie reguły przykładowej: nie zmienia schematu ani bajtów `mcp.cedarschema`; paczki zbudowane na przykładzie 4.0.0 trzeba przebudować; wydane jako patch 4.0.1 na decyzję człowieka (wyjątek w README). **Status:** accepted (decyzja: człowiek, 2026-10-29), wydanie 4.0.1 (wyjątek SemVer opisany w README, decyzja człowieka 2026-10-29)

## CC-165 | C8/C5/C12 | Wynik wiersza aktywności z powodu ostatniego zdarzenia (zmiana wyniku istniejących wierszy)

- **Zmiana:** powody `rate_limited_user|client|tool`, `definition_changed`, `tool_not_served` i `exchange_denied` były już znane w 4.0.x, ale wiersz z takim powodem miał wynik `error`. Teraz: `rate_limited_*` -> `rate_limited`,
  `definition_changed` i `tool_not_served` -> `tool_disabled`, `exchange_denied` -> `denied_not_granted`; wszystkie w grupie filtra `denied`. Dla `tool_call` z `outcome` innym niż `ok` obowiązuje teraz cała mapa powodów, więc zmieniają się też
  wiersze z powodami `not_granted` (`denied_not_granted`), `link_scope` (`denied_link_scope`), `policy_forbid` (`denied_policy`), `tool_disabled` i `step_up_required`: wcześniej `error`.
- **Normatywny kształt `exchange_denied`:** `tool_call` z `decision: allow`, `outcome: denied`, `errorCode: access_denied` (gateway zdążył dopuścić wywołanie, IdP odmówił wymiany). Portal nie proponuje `request_access` na podstawie samego `result`.
- **Pliki:** `scripts/lib/activity-calls.mjs`, wektory `activity-calls/aggregation-denied-*` (`policy_decision`) i `aggregation-tool-call-denied-*` (`tool_call`), opis filtra `result` w OpenAPI.
- **SemVer:** `result` to otwarty napis, żadna wartość nie znika; zmiana wyniku istniejących wierszy jest minor. **Status:** accepted (decyzja: człowiek, 2026-10-29), wydanie 4.1.0

## CC-166 | C3/C8/C10 | Typ poświadczenia: nagłówek `X-MCP-Credential-Type` a zbiór typów z konfiguracji

- **Zmiana:** konfiguracja systemu to zbiór dozwolonych typów (GitLab: `user-oauth`, `user-secret`). Nagłówek (istniejący w C3) niesie typ zwrócony przez broker. Gateway odmawia (`internal_error`, audyt `credential_resolve`
  z powodem `credential_type_mismatch`), gdy typ z brokera nie należy do zbioru. Serwer sprawdza, że nagłówek należy do jego zbioru typów, przed Cedar, sondą grantu i resolverami; dotyczy tylko żądań z `X-MCP-Credential`
  (brak nagłówka, nieznana wartość, wartość spoza zbioru albo brak skonfigurowanego typu = odmowa `internal_error`, audyt `credential_type_mismatch`). `context.credentialType` w Cedar to typ domyślny systemu z konfiguracji gateway'a
  (Cedar jest oceniany przed pytaniem brokera). Założenie modelu zagrożeń: mTLS + JWT między gateway'em a serwerem wystarcza, bez claimu typu.
- **Pliki:** `scripts/lib/credential-type-check.mjs`, wektory `credential-type-header/` (13, w tym GitLab z dwoma typami), audyt `server-credential-type-mismatch` i `gateway-credential-type-mismatch`, README.
- **SemVer:** serwer bez sprawdzenia dalej działa (traci ochronę); nowy serwer ze starym gateway'em działa, bo stary gateway już wysyła nagłówek (typ brokera), o ile należy do zbioru serwera; wdrażać razem. Żaden istniejący przepływ (PAT w GitLabie) nie jest odrzucany. minor. **Status:** accepted (decyzja: człowiek, 2026-10-29), wydanie 4.1.0

## CC-167 | C5/C12/README | Limity fail-closed, podłoga ryzyka, `acceptRiskLowering`

- **Zmiana:** limity przy niedostępnym Redisie odmawiają (`upstream_unavailable`, HTTP `503` w kształcie C10 z `Retry-After`, bez `WWW-Authenticate`; wektor i zdarzenie `gateway-limit-store-unavailable`). Podłoga ryzyka to najwyższe ryzyko kiedykolwiek zgłoszone dla narzędzia, także oczekujące.
  `PUT` z ryzykiem niższym od podłogi nie odrzuca manifestu: to jedno narzędzie jest `pending_approval` (`source: ci`, `change: changed`, `riskLowered: true`), ukryte i odmawiane jako `tool_disabled`; reszta manifestu przechodzi. `422` przy `PUT`
  zostaje dla pozostałych odrzuceń. `ApproveRequest.acceptRiskLowering` (tylko `mcp-platform-admin`, nigdy potok; BFF wymaga świeżego MFA, `401 step_up_required`, wysyła pole tylko przy `true`): jedyna droga w dół; podłoga spada
  do zatwierdzonego ryzyka, jedno zdarzenie `admin_change`/`risk_lowered_by_admin` z polem `risk`; bez flagi `422 risk_lowered`; flaga przy wpisie, który niczego nie obniża, jest ignorowana. Wpisy `source: server` nie podnoszą podłogi.
  `context.credentialType` to typ domyślny systemu z konfiguracji gateway'a.
- **SemVer:** liczenie wpisu oczekującego w podłodze (dawniej przechodzący `PUT` czeka teraz na administratora) jest według tabeli zaostrzeniem (major); wydane jako minor na decyzję człowieka 2026-10-29 (wyjątek w README). **Status:** accepted (decyzja: człowiek, 2026-10-29), wydanie 4.1.0

## CC-168 | C6/C5 | Zbiór typów systemu nie miesza `service-account` z typami użytkownika

- **Zmiana (norma):** `credential.acceptedTypes` to samo `service-account` albo same typy użytkownika. Gateway odmawia startu przy takiej konfiguracji systemu, serwer odmawia startu, gdy `accepted-credential-types` miesza oba rodzaje;
  rejestracja takiego manifestu to `422 manifest_rejected`, `reason: credential_type_mismatch`; reguła manifestu `credential-types-not-mixed` (Node i Java), wektor `manifests/invalid-credential-types-mixed`.
  Powód: `context.credentialType` w Cedar to typ domyślny systemu, więc mieszany zbiór ukryłby konto serwisowe przed regułami `credential-type.cedar`. Typ domyślny po stronie serwera to pierwszy z `accepted-credential-types`.
- **Dopisek do CC-159:** sprawdzenie dotyczy każdego typu ze zbioru systemu, nie tylko typu domyślnego.
- **SemVer:** nowa reguła odrzucenia manifestu, który wcześniej przechodził (tylko błędna konfiguracja); w ramach wyjątku 4.1.0. **Status:** accepted (decyzja: człowiek, 2026-10-29), wydanie 4.1.0

---

Propozycje M5, punkt A (jeden adres `/mcp`, filtr w query, bez zapisanych linków). Źródło: `mcp-platform-plan/m5-plan.md` (punkt A, decyzja M5-1). CC-169 ... CC-177 tworzą jeden pakiet:
całość to wydanie 5.0.0 i wchodzi tylko razem, bo wpisy odwołują się do siebie. Decyzje człowieka z 2026-10-31 (po PoC OAuth z query w Claude Code, gałąź `poc/mcp-query`) zamknęły wszystkie pytania poniżej;
warianty odrzucone zostają w tekście z adnotacją "odrzucony". Wydanie 5.0.0 wdraża cały pakiet (schematy, wektory, mocki, Cedar, klasy Java, README, CHANGELOG).

## CC-169 | C1/C5/README | Zbiorczy endpoint `/mcp` (wszystkie narzędzia użytkownika)

- **Problem:** nie ma adresu "do wszystkiego": gateway wystawia `/s/<serverId>/mcp` (jeden system) i `/v/<slug>/mcp` (zapisany link ze stałą listą narzędzi, bez narzędzi dodanych później).
- **Zmiana:** `<publicBaseUrl>/mcp` bez parametrów zwraca w `tools/list` wszystkie narzędzia, które użytkownik może teraz wywołać, ze wszystkich systemów: część wspólna zatwierdzonych, włączonych i obsługiwanych narzędzi z decyzją Cedar dla bieżącego tokenu
  (niezmiennik 5 bez zmian; lista liczona przy każdym `tools/list`, nie zapisana). Nazwy `<system>__<narzędzie>` (`QualifiedToolName`), `tools/call` gateway kieruje po prefiksie do serwera `mcp-<system>`; bez routera opartego na modelu.
  `/s/<serverId>/mcp` zostaje (filtr z CC-170 działa też tam, ale `systems` na tej trasie musi być pusty albo równy systemowi trasy, czyli `serverId` bez prefiksu `mcp-` (`jira` dla `mcp-jira`); inny `systems` to `400 invalid_request`, `reason: invalid_filter`).
  Zasady jak dziś w linkach: system bez połączenia konta ma narzędzia widoczne, a wywołanie daje `credential_required` z `connectUrl`; serwer niedostępny albo z niezgodną definicją jest pomijany na liście (`upstream_unavailable` / `tool_disabled` przy wywołaniu, o ile filtr narzędzia nie wycina: kolejność w CC-178; limit czasu i definicja niedostępności w CC-180; stronicowanie długiej listy w CC-181);
  jedna uszkodzona lista jednego serwera nie unieważnia pozostałych. Kolejność listy: stała (system według `ServerId`, w systemie nazwa narzędzia), żeby klient nie widział przetasowań.
  `initialize` zwraca ten sam `serverInfo` dla każdej postaci adresu; wariant serwisowy JWT (CC-002) dla `initialize` / `tools/list` do serwerów bez zmian.
- **README:** nowa sekcja "Jeden adres do całej platformy" (rozmiar listy: 5 systemów to kilkadziesiąt narzędzi, 20 systemów kilkaset; opisy narzędzi zużywają kontekst modelu; zalecenie filtra `systems=` i `access=read` powyżej progu, który wyznaczy pomiar M5)
  oraz akapit o zasięgu prompt injection: jedna sesja sięga do wszystkich systemów użytkownika, więc tekst z jednego systemu (np. strona Confluence) może skłonić model do zapisu w innym. Uprawnienia się nie zmieniają (per użytkownik, DESTRUCTIVE z kodem TOTP, `UntrustedText`),
  ale zasięg rośnie; filtr to środek ograniczenia zasięgu, nie granica bezpieczeństwa (CC-170). Tabela jednej domeny (CC-089): `/mcp` dochodzi do tras gateway'a; `/mcp` jest zarezerwowane w `ReturnPath` obok `/api`, `/s`, `/v`, `/.well-known`
  (wektory `return-paths/`), a SPA nie definiuje trasy `/mcp`.
- **Pliki:** README (jedna domena, nowa sekcja, tabele wektorów), `openapi/gateway-admin.v1.yaml` (opis i tagi tras klienta, brak nowej operacji: trasy MCP nie są w OpenAPI), `schemas/common.schema.json` (opis `ReturnPath` / `QualifiedToolName`),
  nowy katalog wektorów `test-vectors/endpoint-aggregate/` (lista = część wspólna; pominięcie niedostępnego serwera; kolejność), `test-vectors/return-paths/` (`/mcp` zarezerwowane), `scripts/lib/contracts.mjs`.
- **Czego nie zmienia:** C3 (nagłówki do serwerów), C6 (manifest), Cedar poza CC-173, kody C10.
- **SemVer:** nowa trasa to minor; razem z CC-173/CC-175 pakiet jest major (5.0.0).
- **Wpływ:** ws-05 (trasa, agregacja list, routing po prefiksie, pomijanie padniętych serwerów, cache listy), ws-02 (brak zmian z samego CC-169), ws-07/08 (kreator pokazuje `/mcp` jako adres domyślny; ostrzeżenie o rozmiarze listy), ws-09 (brak), ws-10 (scenariusz: jedna sesja, narzędzia dwóch systemów; scenariusz prompt injection między systemami), ws-01 (proxy: trasa `/mcp` w nginx, nagłówki `nosniff` i CSP także na niej; konfiguracja klienta w `mcp-platform-dev`).
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.0.0

## CC-170 | C5/C10/README | Filtr w query: `systems`, `tools`, `access`, `exclude` (składnia, normalizacja, semantyka)

- **Zmiana:** `/mcp` i `/s/<serverId>/mcp` przyjmują cztery parametry query (wartości po przecinku, wielokrotny parametr tej samej nazwy to `400`):
  `systems=` (id systemu bez prefiksu `mcp-`: `jira`, `gitlab`, ...), `tools=` (`QualifiedToolName`), `access=read|write`, `exclude=` (wpisy jak w `systems` albo `tools`; wpis zawierający `__` to narzędzie, w przeciwnym razie system).
  Wynik widoczny dla modelu = (zbiór z CC-169) przecięty z filtrem: `systems` (gdy podane) AND `tools` (gdy podane) AND `access` AND NOT `exclude`. `tools` zawęża, nie dodaje: narzędzie spoza `systems` odpada, nawet gdy jest w `tools`.
  `access=read` = narzędzia o ryzyku zatwierdzonego wpisu `READ_ONLY`; `access=write` = narzędzia `UPDATE` i `DESTRUCTIVE` (rozłączne zbiory; brak parametru = oba). Decyzja człowieka: `write` jest rozłączne z `read`; wariant "`write` = także odczyt" (zbiór łączny, równy brakowi parametru) odrzucony.
  Parser w PoC robił `access=write` jako `READ_ONLY` + `UPDATE`; to błąd PoC, kontrakt jest jak wyżej.
  Filtr działa na `risk` z rejestru (C5), nie na `action` z manifestu serwera; zmiana ryzyka narzędzia zmienia wynik filtra bez zmiany adresu.
- **Normalizacja (jedna postać kanoniczna; referencja `scripts/lib/endpoint-filter.mjs`, ta sama w Javie):**
  nazwy parametrów i wartości małymi literami po porównaniu wielkości liter przy parsowaniu (wartość z wielką literą to nie błąd: sprowadzana do małych; `access=READ` = `access=read`); biały znak i pusta wartość to `400`;
  duplikaty wewnątrz listy usuwane; listy sortowane leksykograficznie (bajtowo, ASCII); parametry w stałej kolejności `systems`, `tools`, `access`, `exclude`; brak parametru zamiast pustej wartości (`systems=` bez wartości to `400`, nie "wszystkie");
  postać kanoniczna to `systems=gitlab,jira&access=read` (RFC 3986, przecinek niekodowany, bez `%`-kodowania znaków z `[a-z0-9_,=&]`; zakodowany przecinek `%2c` to `400`, żeby jedna postać odpowiadała jednemu adresowi).
  Limity: całe query najwyżej 512 bajtów, najwyżej 5 wpisów w `systems`, 100 w `tools`, 100 w `exclude` (przekroczenie to `400`). Wpis niezgodny ze składnią (nie `ServerId` bez prefiksu, nie `QualifiedToolName`) to `400`.
  Nieznany parametr (np. literówka `system=`) to `400` (fail-closed: cicha utrata filtra poszerzyłaby zakres). Dotyczy to każdego parametru spoza czterech (kontrakt nie przewiduje innych). Kolejność / wielkość liter / duplikaty nie zmieniają wyniku ani audytu (CC-174).
  Błąd: `400` z ciałem `{"error": "invalid_request", "reason": "invalid_filter"}` (nowy schemat `EndpointFilterError` w `common.schema.json`: to odpowiedź HTTP, nie wynik narzędzia, więc `invalid_request` nie wchodzi do `ErrorCode` C10 ani do `tool-error.schema.json`; nie ujawnia stanu systemów, bo zależy wyłącznie od składni żądania), bez `WWW-Authenticate`, zdarzenie `policy_decision` deny / `outcome: error`, `reason: invalid_filter` (bez `errorCode` i bez pola `filter`: nie było czego znormalizować). `400` przed weryfikacją tokenu nie istnieje: najpierw token (CC-152 bez zmian), potem filtr.
- **Nieznany system, nieznane lub niedostępne narzędzie w filtrze (niezmiennik 8):** wpis składniowo poprawny, ale nieistniejący, bez uprawnień, wyłączony, oczekujący na zatwierdzenie albo z serwera pominiętego jako niedostępny jest pomijany tak samo jak narzędzie bez dostępu:
  ani `400`, ani różnica w odpowiedzi (kształt, kolejność, liczba pozycji nie zdradzają, który powód zadziałał). `tools/call` na narzędzie spoza wyniku to `not_found_or_denied` (jak CC-118), audyt `reason: filter_scope` gdy narzędzie istnieje i użytkownik ma do niego prawo, a wycina je filtr, w pozostałych przypadkach powody dzisiejsze (`not_granted` itd.).
  Odróżnienie `filter_scope` od `not_granted` jest widoczne w SIEM i w wierszu aktywności samego użytkownika (`denied_filter_scope`, CC-174), nie dla klienta MCP, który w obu przypadkach dostaje to samo `not_found_or_denied` (CC-187). Kolejność względem stanu narzędzia, serwera i konta: CC-178.
- **Pusta część wspólna:** `initialize` działa, `tools/list` zwraca `{"tools": []}` (bez błędu i bez wskazówki, który powód zadziałał); `tools/call` zawsze `not_found_or_denied`. Portal w kreatorze może policzyć pustą część wspólną po swojej stronie (z własnej listy narzędzi), gateway tego nie ujawnia.
- **Filtr to zawężenie:** nigdy nie przyznaje (niezmiennik 5); klient może go pominąć (zostaje `/mcp`) lub zmienić, więc nie jest granicą bezpieczeństwa; to samo uprawnienie wyznacza Cedar przy każdym wywołaniu z bieżącego tokenu. Konsekwencja dla polityk: brak reguł zależnych od filtra (CC-173).
- **Pliki:** `scripts/lib/endpoint-filter.mjs` (referencja: parsowanie, normalizacja, przecięcie), nowy katalog wektorów `test-vectors/endpoint-filter/` (normalizacja: kolejność, duplikaty, wielkość liter, limity, `%2c`, nieznany parametr; semantyka: nieznany system, nieznane narzędzie, `exclude`, `access`, pusta część wspólna, `/s/` z `systems`),
  `schemas/common.schema.json` (`EndpointFilterQuery`, `EndpointFilterError`), `schemas/audit-event.schema.json` (reason `filter_scope`, `invalid_filter`, `filter_mismatch`), README, klasa Java `EndpointFilter` w `mcp-manifest`, `scripts/generate-endpoint-vectors.mjs`, `test/vectors.test.mjs`, `EndpointFilterVectorTest`. Funkcji normalizującej w `types/` nie ma: kreator dostaje znormalizowany adres z BFF (CC-175).
- **Interpretacje przy wdrożeniu (pinned w wektorach):** nazwy parametrów i wartości są porównywane bez względu na wielkość liter; wpis `systems` musi pasować do `^[a-z][a-z0-9]*$` (do 32 znaków; nie jest wyliczeniem pięciu systemów, więc nieznany system jest składniowo poprawny i pomijany), wpis `tools` do `<system>__<narzędzie>` (do 80 znaków); limity 5/100/100 liczone po usunięciu duplikatów; limit 100 narzędzi jest w praktyce wtórny wobec 512 bajtów całego query; każdy znak `%` w query to `400`; znaki poza `[A-Za-z0-9_,=&]` to `400`.
- **SemVer:** nowe parametry to minor; pakiet jest major.
- **Wpływ:** ws-05 (parser i normalizacja po wektorach, `400 invalid_filter`, filtrowanie listy i wywołania), ws-07/08 (kreator generuje adres przez tę samą normalizację z pakietu `types` albo przez BFF, patrz CC-175), ws-09 (brak), ws-10 (wektory jako dane testu; scenariusze nadużyć: filtr zawiera system bez uprawnień, filtr z 1000 wpisów, `exclude` narzędzia DESTRUCTIVE), ws-02/ws-01 (brak).
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.0.0

## CC-171 | C1/C5/README | OAuth z query: identyfikator zasobu (RFC 9728), `resource` (RFC 8707), `aud` tokenu

- **Problem:** RFC 9728 buduje adres metadanych z identyfikatora zasobu i wymaga, by pole `resource` metadanych było identyczne z identyfikatorem, z którego adres zbudowano; identyfikator może mieć query. Klient MCP może (a) zachować query w adresie metadanych i w `resource`,
  (b) obciąć query, (c) zbudować inny adres. Dziś `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource<ścieżka trasy>"` i `aud` tokenu = `mcp-gateway` jedno dla wszystkich tras (`01-contracts.md`, C1); IdP nie dostaje `resource` od klienta w sposób, na którym gateway polega.
- **Decyzja człowieka (2026-10-31): wariant V2.** Identyfikator zasobu to `<publicBaseUrl>/mcp` bez query; `WWW-Authenticate: Bearer resource_metadata="<publicBaseUrl>/.well-known/oauth-protected-resource/mcp"` bez query; dokument metadanych ma `resource: <publicBaseUrl>/mcp`; filtr jest tylko w adresie żądania MCP.
  Gateway przyjmuje dowolny poprawny filtr na `/mcp` (jeden dokument metadanych, jedna rejestracja klienta OAuth). Zapytanie o metadane z query zwraca ten sam dokument (query jest ignorowane; wektory `oauth-metadata/`, CC-187). Podstawa: test człowieka 2026-10-31. Keycloak 26.8.1 odrzuca `resource` z query, a Claude Code z V2 zalogował się,
  odświeżył token po 27 minutach i zachował filtr (`initialize` i `tools/list` po odświeżeniu z tym samym filtrem).
  - **V1 (query w identyfikatorze, znak w znak): odrzucony.** Keycloak 26.8.1 nie przyjmuje `resource` z query, więc klient trzymający query w `resource` nie dostałby tokenu.
  - **V3 (filtr w ścieżce `/f/...`): odrzucony.** Trasa `/f/` nie istnieje i nie jest zarezerwowana (`/f/...` jest zwykłą ścieżką portalu, wektor `return-paths/valid-f-prefix`).
- **Przyjęte ryzyko (do README, "Jeden adres do całej platformy"):** V2 jest potwierdzone tylko dla Claude Code. Klient, który odrzuca `resource` bez query albo nie zachowuje query przy odświeżeniu tokenu, nie zadziała z filtrem do czasu dodania trasy `/f/` (wtedy nowy CC i nowa wersja; `/mcp` bez filtra działa z każdym klientem zgodnym z RFC 9728). Klient, który po prostu gubi query, łączy się z `/mcp` bez filtra i dostaje pełną listę bez błędu: to ciche poszerzenie widoku, nie uprawnień (CC-187).
- **`resource` / `aud` w tokenie:** `aud` pozostaje `mcp-gateway` (mapper audience w Keycloak) niezależnie od adresu; gateway nie porównuje `aud` z adresem żądania. Filtr nie jest granicą bezpieczeństwa (CC-170), więc brak wiązania tokenu z filtrem niczego nie osłabia.
  Wariant `aud` = identyfikator zasobu (RFC 8707) odrzucony: wymagałby od IdP przyjęcia dowolnego `resource`. `01-contracts.md` (C1) nie wymaga zmiany: `aud` jest tam już `mcp-gateway`.
- **Odpowiedzi `401`:** `resource_metadata` wskazuje metadane trasy bez query (dla `/mcp`: `.../oauth-protected-resource/mcp`; dla `/s/...` jak dotąd). Kolejność: najpierw token, potem filtr (żądanie bez ważnego tokenu dostaje `401` także przy złym filtrze, więc klient zawsze dostaje metadane i nieuwierzytelniony nie bada składni).
- **Pliki:** README (sekcja "Odpowiedzi gateway'a na odrzucone i niedostępne uwierzytelnienie", "Jeden adres do całej platformy"), `scripts/lib/gateway-authentication.mjs` (komentarz: `resourcePath` bez query), wektory `gateway-authentication/rejected-on-aggregate-endpoint*` (z filtrem i ze złym filtrem bez tokenu), `rate-limited-at-least-one-second` i `jwks-unavailable-configured-retry-after` na `/mcp`.
  Wektor `rejected-on-virtual-server-route` usunięty (CC-177).
- **SemVer:** metadane i `resource_metadata` dla nowej trasy: minor; razem z pakietem major.
- **Wpływ:** ws-05 (endpoint metadanych `/mcp`, filtr tylko w żądaniu MCP), ws-01 (nginx: `/.well-known/oauth-protected-resource/mcp`, brak potrzeby przekazywania query; Keycloak: mapper audience, rejestracja klienta), ws-07/08 (kreator pokazuje adres z filtrem z BFF), ws-10 (scenariusz OAuth z obiema postaciami adresu: bez filtra i z filtrem; odświeżenie tokenu), ws-02/09 (brak).
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.0.0

## CC-172 | C1/C5 | Filtr związany z sesją MCP

- **Zmiana:** gdy protokół ma sesję (`Mcp-Session-Id`), znormalizowany filtr z żądania `initialize` jest zapisany przy sesji, a każde następne żądanie sesji (w tym `DELETE`; `GET` strumienia gateway nie wystawia, CC-179) musi mieć ten sam znormalizowany filtr (porównanie po normalizacji z CC-170,
  nie surowego tekstu); inny filtr, brak filtra przy sesji z filtrem albo filtr przy sesji bez to `404` z ciałem jak dla nieznanej sesji (bez ujawniania, że sesja istnieje), zdarzenie `policy_decision` deny, `reason: filter_mismatch`.
  Sesja nie przechodzi między użytkownikami (`sub` w sesji, jak dziś) ani między trasami (`/mcp` vs `/s/...`). Powód: klient albo pośrednik w jednym połączeniu nie zmienia zasięgu bez nowego `initialize`, a audyt jednej sesji ma jeden filtr.
  Dla protokołu bez sesji (MCP 2026-07-28, wariant bezstanowy, CC-070) nie ma co wiązać: filtr obowiązuje per żądanie, każde żądanie niesie adres, a gateway nie trzyma stanu; reguła sesji nie dotyczy.
  HA (M5-B): wiązanie trzymane w tym samym magazynie co sesje (Redis), nie w pamięci instancji; utrata wpisu sesji (restart, wygaśnięcie) to `404` jak dziś i klient inicjuje nową sesję. Kolejność kontroli (token, składnia, `sub` sesji, trasa, filtr), sesja na innej trasie i `Mcp-Session-Id` z `_meta`: CC-184; wiązanie porządkuje audyt i nie jest barierą bezpieczeństwa.
- **Pliki:** README (sekcja o `/mcp`), `schemas/audit-event.schema.json` (reason `filter_mismatch`), wektory `test-vectors/endpoint-filter/session-*` (ten sam filtr w innej kolejności = zgodny; inny, dodany i usunięty filtr = odrzucenie; filtr jest porównywany po normalizacji), ciało `404` takie jak dziś dla nieznanej sesji (ws-05 potwierdza kod przy wdrożeniu).
- **SemVer:** nowa kontrola dla nowej trasy: minor w pakiecie major.
- **Wpływ:** ws-05 (sesje i magazyn, kod `filter_mismatch`), ws-01 (Redis współdzielony przez 2 instancje), ws-10 (scenariusz: zmiana filtra w sesji), ws-07/08, ws-09, ws-02 (brak).
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.0.0

## CC-173 | C2/C7/Cedar | Koniec `vs`, `vsc`, `context.virtualServer`, `context.vsScopes`; los `resourceDefaults`

- **Problem:** claimy `vs` / `vsc` (CC-027), kontekst Cedar `virtualServer` / `vsScopes` (CC-041, CC-058) i pole `resourceDefaults` (CC-085, uśpione: `400 resource_defaults_unsupported`) istnieją tylko dla zapisanych linków. Po CC-175 nie ma skąd wziąć slugu ani zawężenia.
- **Decyzja człowieka (2026-10-31): wariant usunięcia.** Usunąć wszystko, co jest zbudowane na linkach, razem (nie zostawiać martwych pól):
  - C2: `vs` i `vsc` znikają ze schematu `internal-jwt.schema.json` (`additionalProperties: false` na claimach: token z `vs` / `vsc` to `401 invalid_claims`); znika `VirtualServerSlug` i `VsScopes` z `common.schema.json`. Serwer nie dostaje filtra (nie potrzebuje: widzi wywołania, które gateway już dopuścił; decyzje serwera zależą tylko od użytkownika, zasobów i grantów).
  - Cedar: `virtualServer` i `vsScopes` znikają z `context` w `cedar/mcp.cedarschema` (bajty schematu się zmieniają, test skrótu SHA-256 dostaje nowy skrót w 5.0.0 jak w 4.0.0 przy CC-136). Paczka polityk, która czyta któreś z nich bez ochrony `has` (także w `forbid`), nie przechodzi walidacji schematu (`policy_invalid`; to zastępuje regułę lintu `link_context_in_permit` / CC-058 regułą "pole nie istnieje"). `forbid` chroniony przez `context has vsScopes` przechodzi walidację i nigdy nie pasuje, więc niczego nie zawęża (wektor `main-forbid-guarded-by-has-removed-vsscopes-accepted`); paczka zbudowana pod schemat 4.x odpada i tak jako `schema_mismatch`, bo schemat w paczce musi być bajtowo równy schematowi kontraktów, a ws-09 i tak usuwa te reguły.
    `cedar/examples/virtual-server.cedar` znika; `PolicyLint` traci regułę `vsScopes` / `virtualServer` w `permit` (metoda `linkContextOutsideForbid`, stała `LINK_CONTEXT` i powód `LINK_CONTEXT_IN_PERMIT` w `BundleRejectedException` znikają), zostaje ogólna walidacja schematu i odrzucenie szablonów. Starsza paczka podpisana dla 4.x z takimi regułami musi zostać przebudowana (odbiorca odrzuca ją przy walidacji, fail-closed; nadużycie 13 ws-10 pozostaje osobnym zagadnieniem).
  - `resourceDefaults`: pole znika z kontraktów (`VirtualServerCreate`, `VirtualServer`, README "Zawężenie zasobów jest uśpione" zastąpione akapitem "Zawężenie zasobów w adresie nie istnieje"). Kod `400 resource_defaults_unsupported` znika razem z operacją tworzenia linku (CC-175). `QueryConstraint` / zawężenie zakresu po argumentach (osobny temat z `cc-m4-round2.md`) nie zależy od tego CC.
  - `VirtualServerScope` (`mcp-cedar-entities`) i `ScopeGroups.fromResourceDefaults` znikają; budowanie `vsScopes` w `EntityBuilder` znika; zostaje `principal.scopes`, `context.refs`, `resource.scopes`.
- **Wariant odrzucony A (zachować uśpione):** zostawić `vs` / `vsc` / `context.vsScopes` w schematach "na przyszłe zawężanie zasobów w adresie" (np. `jira.project=ABC`). Odrzucony: martwy kod w czterech modułach, każdy odbiorca JWT i Cedar nadal musi go walidować; zawężanie zasobów w query wymagałoby osobnego kontraktu (składnia, normalizacja, wektory dla pięciu typów zasobów, claim niesiący zawężenie do serwerów), więc nie oszczędzamy pracy, a pole `vsc` dziś nie ma nadawcy.
  Jeśli takie zawężenie wróci, wraca jako nowy CC z nowym claimem (np. `rsc`), nie ze starego `vsc`.
- **Wariant odrzucony B (kontekst filtra w Cedar):** `context.filter` (hash albo lista systemów) dostępny w `forbid`. Odrzucony: pozwala politykom zależeć od wartości sterowanej przez klienta (zawsze może go pominąć), co jest złudzeniem kontroli; reguły `forbid` zależne od filtra nie dają niczego ponad zwykłe `forbid` na zasobie.
- **Pliki:** `schemas/internal-jwt.schema.json`, `schemas/common.schema.json`, `cedar/mcp.cedarschema`, `cedar/examples/virtual-server.cedar` (usunięcie), `cedar/entity-builder.md`, `java/mcp-cedar-entities/*` (`VirtualServerScope`, `ScopeGroups`, `Caller`, `CedarRequest`, `EntityBuilder`, `QueryConstraint` – usunięcie pól), `java/mcp-policy-bundle/*` (`PolicyLint`, `BundleVerifier`, `PolicyLintCli`),
  wektory: `jwt/` (5 plików z `vs`/`vsc`: usunięcie albo zamiana w odrzucenie `invalid_claims`), `entity-builder/` (6 plików), `policy-decisions/` (16 plików `gw-vs-*` / `srv-vs-*`: usunięcie; nie ma czego przenosić do ws-09, bo link nie zawężał zasobów: `resourceDefaults` było uśpione od CC-085, a `vsc` nie miało nadawcy), `result-filter/` (8 plików "through-link" i pochodne: przepisanie bez `vsScopes`; filtr wyników zostaje, odpada tylko wejście linku),
  `bundles/` (3 pliki; `main-permit-reads-*` stają się wektorami "schemat odrzuca pole"), `README` (tabele wektorów i liczności), `types/`, `test/*.test.mjs`, testy Java (`EntityBuilderVectorTest`, `PolicyBundleVectorTest`, `ResultFilterVectorTest`).
- **SemVer:** usunięcie claimów i atrybutów kontekstu: major.
- **Wpływ:** ws-02 (starter: odbiornik JWT bez `vs`/`vsc`, `EntityBuilder` bez `withVirtualServer`, nowe bajty schematu Cedar, odrzucenie tokenu z `vs`/`vsc`), ws-05 (gateway przestaje wystawiać `vs`/`vsc`), ws-09 (usunąć reguły `forbid` czytające `virtualServer` / `vsScopes`, przebudować paczki pod nowy schemat; zawężenia zasobów, które dziś robi link, nie istnieją, więc nie ma czego przenosić),
  ws-03/04 (szablon i serwery: nowe zależności startera, usunięcie obsługi `vsc` jeśli jest), ws-10 (wektory), ws-07/08 (brak), ws-01 (klucze/podpis paczek bez zmian; przebudowa paczki dev).
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.0.0

## CC-174 | C8/C12 | Audyt i aktywność: `virtualServer` zastąpiony przez znormalizowany filtr

- **Zmiana:** pole `virtualServer` w `audit-event.schema.json` znika (i z zapytań / odpowiedzi C12). W jego miejsce gateway dodaje opcjonalne `filter`: znormalizowane query z CC-170 (najwyżej 512 znaków, wzorzec `EndpointFilterQuery`), tylko gdy żądanie niosło filtr; brak filtra = brak pola. Wartość składa się wyłącznie z wpisów o składni nazw systemów i narzędzi (wybiera je klient, parser nie sprawdza ich z listą platformy: CC-186), więc nie jest sekretem ani danymi osobowymi
  (niezmiennik 7 bez zmian: nic poza takimi wpisami). Decyzja człowieka (2026-10-31): filtr jawny. Pozwala agregować w SIEM po systemie, pokazać wiersz w aktywności i porównać sesje; skrót (`filterHash`, np. 16 znaków SHA-256 znormalizowanego query) odrzucony jako nieczytelny.
  Pole `filter` niesie tylko gateway (zdarzenia `tool_call`, `policy_decision`, `confirmation`, `credential_resolve`; `authentication` NIE: zamknięta lista pól odrzuconego uwierzytelnienia zostaje, tam nic z niezweryfikowanego żądania). Serwery i broker nie dostają filtra (CC-173), więc ich zdarzenia go nie mają; korelacja po `requestId`.
  Zdarzenia broker `authenticator` / TOTP, które dziś kopiują `virtualServer` z JWT, tracą pole bez zastąpienia.
- **Słownik:** `event: virtual_server_change` i jego powody `vs_created`, `vs_deleted`, `slug_taken`, `virtual_server_limit` znikają (CC-175; `not_granted` i `invalid_request` zostają jako powody innych zdarzeń); `link_scope` zastąpiony przez `filter_scope` (CC-170), nowe `invalid_filter`, `filter_mismatch` (CC-172).
  Decyzja człowieka (2026-10-31): powód nazywa się `filter_scope`. Reguła SIEM na starą nazwę przestanie pasować po aktualizacji i trzeba o tym wiedzieć wprost; zostawienie `link_scope` jako nazwy historycznej odrzucone (mylące).
  Offboarding (CC-155): `user_purged` dla linków znika wraz z linkami; `admin_change` `user_purged` zostaje (broker, połączenia).
- **Aktywność C12:** wynik `denied_link_scope` -> `denied_filter_scope` (zbiór wyników to otwarty napis; grupa `denied` bez zmian; mapa w `scripts/lib/activity-calls.mjs`); wiersz aktywności pokazuje `filter` zamiast nazwy linku. W 4.x zapytanie `GET /api/v1/activity*` nie miało parametru `virtualServer`, więc nic w zapytaniu nie znika i nie dodano parametru `systems`. Nazwy linków w aktywności zniknęły (utrata funkcji, opisana w m5-plan). Powody `invalid_filter` i `filter_mismatch` nie mają osobnych wyników wiersza (mapowanie domyślne: `error`).
- **Pliki:** `schemas/audit-event.schema.json` (pole, opisy `reason`, `event`, `authentication`), `openapi/gateway-admin.v1.yaml` i `openapi/portal-bff.v1.yaml` (pole `virtualServer` w `ActivityRow` / `AuditEvent` przykłady -> `filter`; `bundled`), `scripts/lib/activity-calls.mjs`, wektory `audit-events/` (8 plików: `gateway-virtual-server-created` usunięty, pozostałe z nowym polem, `invalid-authentication-with-virtual-server` -> `...-with-filter`), `activity-calls/aggregation-denied-link-scope` (-> `filter-scope`), `mocks/wiremock/gateway-admin/mappings/listActivity*.json`, `mocks/msw/*`, README, `test/mocks.test.mjs`.
- **SemVer:** usunięcie pola z odpowiedzi i wartości `event`: major.
- **Wpływ:** ws-05 (zdarzenia z `filter`, reason `filter_scope`), ws-06 (broker: zdarzenia bez `virtualServer`), ws-02 (zdarzenia startera bez `virtualServer`, odbiorca JWT bez `vs`), ws-07 (BFF: aktywność z `filter`), ws-08 (kolumna filtra zamiast nazwy linku), ws-09 (brak), ws-10 (asercje audytu: nowe pole i powody), ws-01 (dashboardy / zapytania do logów dev, jeśli filtrują po `virtualServer`).
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.0.0

## CC-175 | C5/C12/README | Usunięcie API zapisanych linków; kreator jako generator adresu

- **Zmiana:** znikają `GET|POST /admin/v1/virtual-servers`, `DELETE /admin/v1/virtual-servers/{slug}` (C5) oraz `GET|POST|DELETE /api/me/virtual-servers*` (C12), schematy `VirtualServer*`, `PortalVirtualServer*`, tag `virtual-servers`, kody `slug_taken` / `virtual_server_limit`, limit `MCP_VIRTUAL_SERVERS_MAX_PER_USER`, tabela `virtual_servers`,
  sprzątanie linków w offboardingu (`POST /admin/v1/users/{sub}/purge` gatewaya zostaje: poza linkami usuwa oczekujące potwierdzenia, ślady kodów, sesje MCP w Redisie i cache poświadczeń; traci tylko część "linki" i zdarzenia `virtual_server_change`, a `admin_change` z `reason: user_purged` zostaje; CN `mcp-offboarding` bez zmian),
  `404` cudzego linku bez audytu (uwaga z testu M4) przestaje istnieć.
  Kreator w portalu zostaje bez zapisu w bazie: użytkownik wybiera systemy, narzędzia, `read`/`write`, wykluczenia; kreator pokazuje adres i gotowe konfiguracje klientów (`clientConfigs`: klucze `claudeCode`, `copilot`, `codex`). Adres budowany przez jedną normalizację (CC-170): 
  decyzja człowieka (2026-10-31): operacja BFF `GET /api/v1/me/mcp-endpoint?<filtr>` (id `getMcpEndpoint`; ścieżka z prefiksem `/api/v1` jak reszta C12) zwraca znormalizowany adres, `clientConfigs` zbudowane z `publicBaseUrl` (nigdy z żądania) i liczbę narzędzi (`toolCount`, liczoną z katalogu użytkownika z C5: `granted` i nie `disabled`, po filtrze).
  To daje jedno źródło normalizacji (BFF używa reguł gatewaya) i licznik do ostrzeżenia o rozmiarze listy. Wariant "czysto kliencka funkcja w pakiecie `types`" odrzucony. Zły filtr to `400 invalid_request`, `reason: invalid_filter` (schemat `InvalidFilter`); brak nowej operacji gatewaya. Wektory `test-vectors/mcp-endpoint/`.
  Katalog narzędzi dla kreatora: istniejące operacje katalogu C12 (bez zmian).
- **Pliki:** `openapi/gateway-admin.v1.yaml`, `openapi/portal-bff.v1.yaml`, `openapi/bundled/portal-bff.v1.bundled.yaml`, `mocks/wiremock/gateway-admin/mappings/{create,delete,list}VirtualServer*.json` (usunięcie), `mocks/msw/portal-bff.{handlers,examples}.ts`, README (sekcje o linkach, `clientConfigs`, offboarding, tabela wektorów), `test/mocks.test.mjs`, `scripts/lib/mcp-endpoint.mjs` (referencja), `scripts/smoke-wiremock.sh`; `types/` i `dist` powstają z OpenAPI.
- **SemVer:** usunięcie operacji i schematów: major.
- **Wpływ:** ws-05 (usunięcie kontrolera, repozytorium, migracji w Flyway: nowa migracja usuwa tabelę od razu, bez okresu przejściowego: CC-177), ws-07 (BFF: usunięcie proxy linków, ewentualna operacja `mcp-endpoint`, aktywność), ws-08 (kreator bez zapisu, lista "moje linki" znika; bez ekranu migracji linków: CC-177 usuwa je od razu), ws-10 (testy linków -> scenariusze filtra), ws-01 (`mcpdev.py`, seed linków, jeśli istnieje), ws-02/09 (brak).
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.0.0

## CC-176 | C5/C10 | `notifications/tools/list_changed` dla `/mcp`

- **Zmiana:** gateway deklaruje `capabilities.tools.listChanged: true` w `initialize` dla `/mcp` (i `/s/...`) i wysyła `notifications/tools/list_changed` do otwartych strumieni serwera (GET SSE sesji; w wariancie bezstanowym 2026-07-28 przez kanał `subscriptions/listen`), gdy zmienia się wynik `tools/list` tej sesji. Powiadomienie jest puste (bez nazw ani liczb, nic do ujawnienia); klient pobiera `tools/list`, który i tak liczy część wspólną filtra i bieżących uprawnień.
  Wyzwalacze: (1) zatwierdzenie, wyłączenie, włączenie, zmiana definicji lub usunięcie narzędzia w rejestrze (`definition_approved`, `tool_disabled`, `tool_removed`, `risk_lowered_by_admin`) dla narzędzi dostępnych w sesji; (2) zmiana grup użytkownika albo paczki polityk: gateway wykrywa ją przy kolejnym tokenie sesji z innym `grp` i przy zmianie `policyRevision` (wykrycie tylko wtedy, gdy token się odświeża lub przychodzi żądanie; brak odpytywania IdP);
  (3) zmiana dostępności serwera (wejście / wyjście ze stanu "pomijany na liście"). Zmiana połączenia konta NIE jest wyzwalaczem: narzędzia systemu bez połączenia są widoczne (CC-169), więc lista się nie zmienia, zmienia się tylko wynik wywołania (`credential_required` -> sukces). Decyzja człowieka (2026-10-31): zmiana połączenia konta nie jest wyzwalaczem.
  Ograniczenia: najwyżej jedno powiadomienie na sesję na 1 s (łączenie zdarzeń); powiadomienie nie trafia do sesji, której filtr wycina zmienione narzędzie (porównanie z listą sesji); powiadomienia nie są audytowane (nie niosą danych i nie zmieniają uprawnień).
  HA: zdarzenia rejestru i polityk idą do wszystkich instancji przez wspólny kanał (Redis pub/sub albo licznik wersji odpytywany co kilka sekund), instancja trzymająca strumień rozsyła; utrata kanału nie psuje bezpieczeństwa, bo każde `tools/call` jest sprawdzane na bieżąco.
- **Pliki:** README (sekcja o `/mcp`), wektory `test-vectors/endpoint-aggregate/list-changed-*` (zdarzenie -> czy powiadomienie), `schemas/tool-error.schema.json` bez zmian; opisy w `01-contracts.md` (C1 / C5).
- **SemVer:** nowa zdolność (minor) w pakiecie major.
- **Wpływ:** ws-05 (emisja, kanał między instancjami, łączenie zdarzeń), ws-01 (Redis w HA; klient testowy), ws-10 (scenariusz: zatwierdzenie narzędzia w trakcie sesji -> klient dostaje powiadomienie i nowe narzędzie), ws-07/08 (brak; opcjonalnie komunikat "odśwież klienta"), ws-02/09 (brak).
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.0.0; wymóg `listChanged: true` i powiadomień przesunięty na M6 przez CC-179

## CC-177 | C5/C12 | Migracja zapisanych linków `/v/<slug>/mcp`: usunięcie od razu

- **Problem:** po CC-175 zapisane linki nie mają funkcji. Klienci AI mają je wpisane w konfiguracji; usunięcie od razu przerywa im połączenie bez ostrzeżenia, a trzymanie ich bez końca zachowuje całą tabelę, API i `vs`/`vsc` (CC-173).
- **Wariant A (usunięcie od razu w 5.0.0), przyjęty decyzją człowieka (2026-10-31):** `/v/` odpowiada `404 not_found_or_denied` (ten sam kształt, brak audytu); tabela `virtual_servers` usuwana migracją; przy aktualizacji nie ma kodu przejściowego. Zalety: najmniej kodu, brak wyjątków w CC-173; wada: awaria u każdego użytkownika z zapisanym linkiem. Rozsądny, jeśli linków poza dev nie ma (platforma przed wdrożeniem produkcyjnym: M6 dopiero przygotowuje instalację).
- **Wariant B (deprecjacja przez jedno wydanie minor 5.x): odrzucony.** `/v/<slug>/mcp` dalej działa jako zawężenie tylko-do-odczytu zapisanej listy (jak dziś, ale tylko dla istniejących linków; `POST` zakazany; sama lista narzędzi linku = `tools=` w CC-170), odpowiedzi niosą `Deprecation: true` i `Sunset: <data>` (RFC 8594 / 9745),
  `claim vs/vsc` jest nadal wystawiany (więc CC-173 wchodzi dopiero w kolejnym major) albo gateway przestaje je wystawiać, a linki liczą zawężenie po stronie gatewaya (wtedy `vsc` i `resourceDefaults` znikają od razu: linki bez `resourceDefaults`, bo zawężanie zasobów jest uśpione od CC-085, więc konwersja jest bezstratna).
  Portal pokazuje "Twoje stare linki" z adresem zastępczym (`/mcp?tools=...`), usunięcie linku zostaje. Koszt: dwa tryby w gatewayu przez jedno wydanie i testy dla obu. Wariant B bez wystawiania `vs`/`vsc` jest zalecany, gdy w jakimkolwiek środowisku są linki w użyciu.
- **Ręczne przeniesienie linku (bez kodu migracji, do instrukcji):** link o liście narzędzi T odpowiada adresowi `/mcp?tools=<T posortowane>` (w praktyce rządzi limit 512 bajtów całego query, około 16 nazw po 30 znaków, CC-185; dłuższą listę trzeba zastąpić przez `systems` i `exclude`). Filtr jest równoważny linkowi tylko co do listy narzędzi; nazwa linku nie ma odpowiednika (utrata funkcji, wymieniona w planie M5).
- **Pliki:** README (tabela jednej domeny, sekcja o migracji), `CHANGELOG.md` (migracja 5.0.0 per komponent), `openapi/gateway-admin.v1.yaml` (opis tras klienta), wektor `endpoint-aggregate/legacy-link-route-gone` (404 `not_found_or_denied`, bez audytu, bez względu na token); wektor `gateway-authentication/rejected-on-virtual-server-route` usunięty.
- **SemVer:** major (pakiet).
- **Wpływ:** ws-05 (usunięcie trasy i tabeli `virtual_servers`: `/v/` odpowiada 404), ws-07/08 (brak ekranu starych linków), ws-01 (seed i dokumentacja klienta), ws-10 (test `/v/` = 404), ws-09/ws-02 (brak poza CC-173).
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.0.0

---

Poprawki po przeglądzie wydania 5.0.0 (Opus, 2026-10-31; nikt jeszcze 5.0.0 nie wdrożył). CC-178 ... CC-188 doprecyzowują i poprawiają CC-169 ... CC-177, zakres według decyzji człowieka z 2026-10-31.
Wydanie 5.1.0 z wyjątkiem SemVer: część zmian jest według tabeli (README, "Wersjonowanie") zaostrzeniem, czyli majorem, ale poprawia wersję, której nikt nie wdrożył (README, wyjątek 5.1.0).

## CC-178 | C5/C10/README | `tools/call` na `/mcp`: filtr przed stanem narzędzia, serwera i konta

- **Problem:** CC-169 i README mówią, że niedostępny serwer albo niezgodna definicja daje przy wywołaniu `upstream_unavailable` / `tool_disabled`, a CC-170 i referencja `callDecision` mówią, że każde wywołanie narzędzia spoza listy to `not_found_or_denied`. Referencja liczyła zbiór `mayCall` z listy, która pomija niedostępne
  serwery i wyłączone narzędzia, więc przy awarii serwera wywołanie dawało `not_found_or_denied` z powodem audytu `not_granted` (a przy filtrze, który i tak wycina narzędzie, `not_granted` zamiast `filter_scope`). Dwie implementacje (ws-05 i ws-10) zrobiłyby dwa różne zachowania.
- **Decyzja człowieka (2026-10-31):** kolejność sprawdzeń `tools/call` od nazwy narzędzia:
  1. nazwa nie wskazuje znanego systemu (`routeCall`) albo `mayCall` nie zawiera narzędzia: `not_found_or_denied`, powód audytu `not_granted`;
  2. filtr: narzędzie poza wynikiem filtra to `not_found_or_denied`, powód `filter_scope` (użytkownik ma prawo, wycina je filtr);
  3. tylko narzędzie, które filtr zostawia, dochodzi do kontroli stanu, w tej kolejności: `tool_disabled`, `upstream_unavailable`, `credential_required` (z `connectUrl`). Kolejność trzech kodów wynika z kolejności zapisu w decyzji, przypięta wektorami `call-state-order-*`;
  4. dopiero potem decyzja Cedar z argumentami (zasoby: `policy_forbid`, `step_up_required`), bramka potwierdzenia `DESTRUCTIVE` i wywołanie serwera, w kolejności jak dotąd.
- **`mayCall`:** zbiór narzędzi, dla których rejestr ma wpis (zatwierdzony, wyłączony, oczekujący albo zmieniony: stan nie ma znaczenia) i decyzja Cedar **na poziomie narzędzia** jest `allow`, czyli ta sama decyzja, która kwalifikuje narzędzie do `tools/list` (bez argumentów wywołania i bez zasobu). Nie zależy od dostępności serwera,
  od tego, czy narzędzie jest włączone, ani od połączenia konta. Decyzja z argumentami (zasób, `refs`) zapada w kroku 4 i nie należy do `mayCall`. Dzięki temu stan serwera nie zmienia odpowiedzi dla narzędzia, które i tak jest poza filtrem ani dla narzędzia, do którego użytkownik nie ma prawa.
- **Cztery kombinacje (wektory `call-state-*`):** filtr zostawia i serwer działa (`allowed`); filtr zostawia i serwer leży (`upstream_unavailable`); filtr wycina i serwer działa (`not_found_or_denied`, `filter_scope`); filtr wycina i serwer leży (to samo `not_found_or_denied`, `filter_scope`: stan serwera się nie ujawnia).
  Dodatkowo: wyłączone narzędzie (przepuszczone i wycięte), brak połączenia konta (przepuszczone i wycięte), kolejność `tool_disabled` > `upstream_unavailable` > `credential_required`, brak prawa przy niedostępnym serwerze (`not_granted`), wywołanie `DESTRUCTIVE` wycięte przy oczekującym potwierdzeniu.
- **Filtr poprzedza bramkę potwierdzenia `DESTRUCTIVE`:** wywołanie wycięte filtrem kończy się w kroku 2, więc nie tworzy, nie zużywa i nie unieważnia oczekującego potwierdzenia użytkownika (wektor `call-state-destructive-cut-keeps-pending-confirmation`). Klucz potwierdzenia (`sub`, `serverId`, narzędzie, skrót argumentów) nie zawiera filtra, więc to samo wywołanie przez adres bez filtra potwierdza się tym samym kodem.
- **Pliki:** `scripts/lib/endpoint-filter.mjs` (`callDecision(filter, tool, mayCall, state)`), `scripts/generate-endpoint-vectors.mjs`, wektory `endpoint-filter/call-state-*` (14, Java ich nie wykonuje: to decyzja gateway'a), README ("Filtr w query"), `schemas/audit-event.schema.json` (opis `filter_scope`), poprawka zdań w CC-169 i CC-170.
- **SemVer:** w 5.0.0 teksty były sprzeczne; wybór jednej wersji zmienia wynik referencji w scenariuszu niedostępnego lub wyłączonego narzędzia (wcześniej `not_found_or_denied`, teraz `upstream_unavailable` / `tool_disabled`). Wcześniejsze wektory `call-*` zachowują oczekiwania. Formalnie zmiana oczekiwanego zachowania; wyjątek SemVer w README.
- **Wpływ:** ws-05 (kolejność w `McpGatewayService`; PoC ustawia dziś `link_scope` po samym istnieniu narzędzia), ws-10 (scenariusze: serwer leży przy filtrze, który wycina i który zostawia narzędzie; wyłączone narzędzie; brak połączenia; pending DESTRUCTIVE i wywołanie wycięte), ws-02/07/08/09 (brak).
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.1.0

## CC-179 | C5/C10 | `list_changed` przesunięte na M6; `GET` na `/mcp` to `405`

- **Problem:** CC-176 wymagało nowej infrastruktury, której gateway nie ma (strumień `GET`, `subscriptions/listen`, punkt odniesienia listy w wariancie bezstanowym, los strumienia po wygaśnięciu tokenu), a CC-172 kazało sprawdzać filtr na `GET`, który dla klienta 2026-07-28 jest `405`.
- **Decyzja człowieka (2026-10-31):** powiadomienia `notifications/tools/list_changed` przesunięte na M6. W tej wersji gateway deklaruje `capabilities.tools.listChanged: false` i nie wysyła powiadomień; klient odświeża listę przez `tools/list`. Kontrakt nie wymaga strumienia serwera ani `subscriptions/listen`.
  CC-176 zostaje jako opis docelowy dla M6 (wyzwalacze, ograniczenia, HA) bez statusu wymagania w tej wersji.
- **`GET`:** na `/mcp` i `/s/<serverId>/mcp` `GET` to `405 Method Not Allowed` z `Allow: POST, DELETE`, dla obu postaci protokołu. Jak każda odpowiedź tej trasy, `405` pada po sprawdzeniu tokenu (bez ważnego tokenu `401`). Reguła CC-172 o wiązaniu filtra dotyczy więc `POST` i `DELETE`;
  sprawdzenie filtra na strumieniu `GET` jest wymaganiem M6 razem z `list_changed`. Referencja `listChangedNotification` i wektory `endpoint-aggregate/list-changed-*` zostają jako materiał dla M6 i nie są wymagane od gateway'a.
- **Pliki:** README ("Powiadomienia"), CC-172 i CC-176 (adnotacje), CHANGELOG.
- **SemVer:** zdolność wymagana w 5.0.0 przestaje być wymagana, a deklarowana wartość `listChanged` zmienia się z `true` na `false`: według tabeli usunięcie; wyjątek SemVer w README.
- **Wpływ:** ws-05 (bez `GET` SSE, `subscriptions/listen`, kanału zdarzeń między instancjami), ws-10 (brak scenariusza `list_changed`: klient po zatwierdzeniu narzędzia odświeża listę sam), ws-01 (Redis pub/sub nie jest potrzebny do tego), ws-02/07/08/09 (brak).
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.1.0

## CC-180 | C5/README | Limit czasu `tools/list` na serwer; definicja "serwer niedostępny"

- **Problem:** nie było limitu czasu odczytu `tools/list` serwera przy agregacji, więc jeden wolny serwer wstrzymywał całą listę `/mcp`, a "niedostępny" nie miało definicji.
- **Decyzja człowieka (2026-10-31):** limit czasu na serwer, konfigurowalny, domyślnie **3 s** (`MCP_TOOLS_LIST_TIMEOUT`, w milisekundach, domyślnie `3000`; wartość niedodatnia zatrzymuje start gateway'a). Gateway odczytuje listy serwerów równolegle, więc czas odpowiedzi `tools/list` klienta to najwyżej limit plus narzut gateway'a, nie suma serwerów.
  Serwer, który nie odpowie w limicie, jest pomijany jak niedostępny.
- **Definicja "niedostępny" (dla jednego `tools/list`):** odczyt `tools/list` serwera, który to wywołanie musi wykonać (odświeżenie po TTL, najwyżej 60 s, README "Rejestr narzędzi", reguła 3), nie zakończył się poprawnym wynikiem w limicie: przekroczenie limitu, błąd połączenia lub TLS, status inny niż `200`,
  treść niebędąca wynikiem JSON-RPC `tools/list` albo niezgodna ze schematem. Odczyt z pamięci podręcznej w granicach TTL nie wymaga wywołania, więc limit go nie dotyczy i serwer jest dostępny. Pominięcie dotyczy tylko tej listy: nie jest dowodem zmiany ani braku narzędzi, więc nie powstają `definition_changed` ani `tool_not_served`,
  a rejestr się nie zmienia (reguła 3 rejestru bez zmian). Wywołanie narzędzia takiego serwera, które przechodzi filtr, daje `upstream_unavailable` (CC-178).
- **Pliki:** `scripts/lib/endpoint-aggregate.mjs` (`serverAvailable`, `DEFAULT_TOOLS_LIST_TIMEOUT_MS`), wektory `endpoint-aggregate/availability-*` (7) i `list-slow-server-skipped`, README ("Adresy").
- **SemVer:** nowy wymagany parametr konfiguracji gateway'a z wartością domyślną i doprecyzowana reguła pomijania: minor.
- **Wpływ:** ws-05 (limit, równoległy odczyt, metryka pominięć), ws-01 (zmienna w konfiguracji stosu dev), ws-10 (scenariusz: wolny serwer nie wstrzymuje listy), pozostali bez zmian.
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.1.0

## CC-181 | C5/README | Stronicowanie `tools/list`: `nextCursor`

- **Problem:** brak reguły `nextCursor` przy kilkuset narzędziach (20 systemów); kontrakt nie mówił, jak dzielić długą listę.
- **Zmiana:** `tools/list` na `/mcp` i `/s/<serverId>/mcp` zwraca najwyżej **100** narzędzi na stronę (`PAGE_SIZE`). Gdy po tej stronie są kolejne, odpowiedź ma `nextCursor`; ostatnia strona go nie ma (lista będąca wielokrotnością 100 kończy się stroną bez kursora, pusta lista to jedna strona `{"tools": []}`).
  - **Kolejność:** stała z CC-169 (system według `ServerId`, w systemie nazwa narzędzia, bajtowo), liczona po zastosowaniu filtra i uprawnień przy każdym żądaniu. Kursor nazywa **ostatnie narzędzie poprzedniej strony**; następna strona to narzędzia ściśle po jego pozycji. Dzięki temu narzędzie dodane lub usunięte między stronami
    niczego nie powtarza i nie pomija narzędzi, które zostają; zniknięcie narzędzia z kursora nie psuje kursora. Pozycja to para (`ServerId`, nazwa), nie samo porównanie nazw kwalifikowanych (`a1__x` < `a__x`, a system `a` jest przed `a1`: wektor `page-order-is-by-server-id`).
  - **Kursor nieprzezroczysty i uwierzytelniony:** klient go nie interpretuje. Gateway wiąże go z `sub` użytkownika i ze znormalizowanym filtrem (porównanie po normalizacji), uwierzytelnia (HMAC-SHA-256 kluczem współdzielonym przez instancje, znacznik co najmniej 128 bitów, porównanie w stałym czasie) i honoruje 15 minut, jak kursor aktywności (CC-095).
    Format w referencji (`issueCursor`, `readCursor`) to model: wektory przypinają tylko wynik.
  - **Zły kursor:** kursor uszkodzony, zmieniony, przeterminowany, wydany innemu użytkownikowi albo dla innego filtra to zawsze ta sama odpowiedź JSON-RPC `-32602` (`Invalid cursor`), bez wskazania przyczyny i bez stanu systemów. Zdarzenie `policy_decision` deny, `outcome: error`, `reason: invalid_cursor` (nowy powód), bez `errorCode`.
    Kursor niebędący napisem to ten sam błąd.
  - **Kolejność względem CC-184:** kursor sprawdza się na końcu, po tokenie, składni, sesji, trasie i filtrze.
- **Ryzyko:** klient, który nie idzie za `nextCursor`, widzi tylko pierwszą stronę. Dla takich klientów zalecany jest `systems=` i `access=read` (README, "Rozmiar listy"). Rozmiar strony jest stały w kontrakcie (nie jest konfigurowalny), żeby wektory i klienci zachowywali się tak samo.
- **Pliki:** `scripts/lib/endpoint-aggregate.mjs` (`page`, `issueCursor`, `readCursor`), wektory `endpoint-aggregate/page-*` (10) i `cursor-*` (10), `schemas/audit-event.schema.json` (`invalid_cursor`), README.
- **SemVer:** nowa zdolność odpowiedzi (`nextCursor`) dla listy, która ma ponad 100 narzędzi: minor. Dla list do 100 narzędzi odpowiedź jest taka jak w 5.0.0.
- **Wpływ:** ws-05 (stronicowanie, klucz kursora wspólny dla instancji, audyt), ws-10 (scenariusz: ponad 100 narzędzi, obcy kursor, kursor z innym filtrem), ws-01 (klucz kursora w konfiguracji), pozostali bez zmian.
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.1.0

## CC-182 | C12/mock | Operacja `getMcpEndpoint`: wartości typowane w OpenAPI, BFF sam składa query

- **Problem:** wygenerowany klient Angulara koduje przecinek (`systems=jira%2Cgitlab`), a wektor `mcp-endpoint/invalid-percent-encoding` i parser wymagają `400` dla każdego `%`. Kontrakt nie mówił, czy BFF dostaje surowe query, czy wartości; mock sprawdzał tylko nazwy parametrów.
- **Decyzja człowieka (2026-10-31):** BFF dostaje cztery parametry jako **wartości typowane w operacji OpenAPI**, już zdekodowane przez warstwę HTTP (`jira%2Cgitlab` przychodzi jako `jira,gitlab`), i **sam składa query**: `nazwa=wartość` łączone `&`, bez ponownego kodowania. Złożone query przechodzi przez ten sam parser co na gateway'u (CC-170).
  Skutki: (a) przecinek zakodowany przez klienta jest poprawny; (b) wartość, która po zdekodowaniu nadal ma `%` (klient wysłał `%25`), jest zły filtr, jak na gateway'u; (c) wartość z `&` lub `=` (`%26`, `%3D`) nie dodaje parametru, tylko jest błędną wartością (`composeQuery` zapisuje je jako `%26` i `%3D`, które parser odrzuca);
  (d) parametr spoza czterech i parametr powtórzony to `400 invalid_filter`, jak dotąd.
- **Sprzeczność z wektorem `invalid-percent-encoding`:** rozstrzygnięta. Wektor opisuje wartość zdekodowaną z `%` (wejście `rawQuery` to złożone query), więc oczekiwanie `400` zostaje; zmienia się tylko opis. Nowe wektory z polem `httpQuery` (query tak, jak je wysłał klient) pokazują, że `%2C` jest poprawny, a `%252C`, `%26` i `+` (spacja) nie.
- **Mock MSW:** zwraca `400 invalid_filter` dla nazwy spoza czterech, powtórzonej nazwy i wartości zdekodowanej z `%`, `&` lub `=`; `%2C` w wartości przechodzi (test `mocks.test.mjs`).
- **Pliki:** `scripts/lib/mcp-endpoint.mjs` (`composeQuery`), `mocks/msw/portal-bff.handlers.ts`, `openapi/portal-bff.v1.yaml` (opis operacji), wektory `mcp-endpoint/http-*` (4), opis `invalid-percent-encoding`, `test/vectors.test.mjs`, `test/mocks.test.mjs`.
- **SemVer:** nowe wektory i opis to patch/minor, ale mock odrzuca teraz to, co wcześniej przepuszczał (`%`, powtórzony parametr), a to według tabeli zaostrzenie walidacji; wyjątek SemVer w README.
- **Wpływ:** ws-07 (BFF: typowane parametry, `composeQuery`, brak ponownego kodowania), ws-08 (klient generowany bez zmian, przecinek może być kodowany), pozostali bez zmian.
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.1.0

## CC-183 | Cedar/potok ws-09 | Lint: polityka niemożliwa do spełnienia to błąd

- **Problem:** `forbid` ochroniony `context has vsScopes && ...` przechodzi walidację schematu z ostrzeżeniem Cedar "policy is impossible", które weryfikator ignoruje (`validationPassed=true`). Dotyczy to klasy błędów: literówka w ochronie (`context has mfaAge_typo && ...`) wyłącza `forbid` równie cicho, a wyłączony `forbid` to cichy fail-open.
- **Decyzja człowieka (2026-10-31):** `PolicyLintCli` i nowa metoda `PolicyLint.impossible(Schema, PolicySet)` kończą się błędem (kod wyjścia `1`) przy ostrzeżeniu "policy is impossible". Bramka jest w potoku ws-09. **Weryfikator odbiorcy (`BundleVerifier`) nie jest zaostrzany**: wektor `bundles/main-forbid-guarded-by-has-removed-vsscopes-accepted` zostaje (`accept: true`).
  `PolicyLintCli` dostaje opcję `--schema <plik>`; bez niej używa `cedar/mcp.cedarschema` tej wersji.
- **Ograniczenie:** Cedar ostrzega tylko wtedy, gdy walidator dowodzi, że warunek jest fałszywy dla każdego żądania zgodnego ze schematem. Warunek `(context has virtualServer) || principal has username` nie daje ostrzeżenia (jedna gałąź jest możliwa), więc lint go nie wyłapie; pełne pokrycie wymagałoby przejścia po drzewie składni
  i sprawdzenia każdego `has` na atrybucie spoza schematu. `forbid ... unless { context has x }` z nieistniejącym atrybutem pasuje do wszystkiego i blokuje wszystko, więc to fail-closed i nie jest zgłaszane. Test `PolicyLintImpossibleTest` przypina oba zachowania.
- **Sprawdzone:** przykłady `cedar/examples/*.cedar` nie dają ostrzeżeń (test). Wg przeglądu `mcp-policies/policies/platform/virtual-server.cedar` daje je i ws-09 ma go usunąć (CC-173); pozostałe pliki i przykłady kontraktów były bez ostrzeżeń.
- **Pliki:** `PolicyLint.java` (`impossible`), `PolicyLintCli.java`, `PolicyLintImpossibleTest.java`, `pom.xml` (guava w zakresie `provided`, wersja jak zależność uruchomieniowa cedar-java, tylko do odczytu ostrzeżeń; konsument nie dostaje nowego artefaktu).
- **SemVer:** nowa metoda (minor), ale `PolicyLintCli` kończy się błędem tam, gdzie w 5.0.0 kończył się sukcesem: według tabeli zaostrzenie walidacji (wyjątek SemVer w README).
- **Wpływ:** ws-09 (krok potoku: `PolicyLintCli` na `policies/` i `overrides/`; usunięcie reguł z ochroną `has`), odbiorcy paczek bez zmian.
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.1.0

## CC-184 | C1/C5 | Kolejność kontroli żądania z sesją MCP; wiązanie porządkuje audyt

- **Problem:** CC-172 mówiło "inny filtr to `404`", README "token, potem filtr, `400`"; brak wektora ze złym filtrem w sesji. Niedopowiedziane: sesja z `/mcp` użyta na `/s/...` oraz `Mcp-Session-Id` razem z `_meta`.
- **Decyzja człowieka (2026-10-31), kolejność (token jest pierwszy, `401` bez ważnego tokenu):**

  | Krok | Kontrola | Odpowiedź |
  | --- | --- | --- |
  | 1 | token (CC-152, CC-124) | `401` z wyzwaniem albo `503` |
  | 2 | składnia query (CC-170) | `400 invalid_filter`; zależy tylko od bajtów żądania, sesja nie jest czytana, więc odpowiedź nie jest wyrocznią istnienia sesji |
  | 3 | `sub` sesji | sesja cudza albo nieznana: `404` jak dla nieznanej sesji, **bez** `filter_mismatch` |
  | 4 | trasa sesji (`/mcp` albo `/s/<serverId>/mcp`) | `404`, `filter_mismatch` |
  | 5 | filtr znormalizowany równy filtrowi `initialize` | `404`, `filter_mismatch` |

  Odwrotna kolejność (sesja przed składnią) wymagałaby odczytu sesji przy śmieciowym żądaniu i nic by nie dawała.
- **Trasa:** sesja użyta na innej trasie niż ta, na której powstała, to `404` z powodem audytu `filter_mismatch` (adres sesji to trasa i filtr; osobny powód nie powstaje). Opis powodu w `audit-event.schema.json` obejmuje trasę.
- **`Mcp-Session-Id` razem z `_meta`:** żądanie z nagłówkiem sesji jest żądaniem sesyjnym i podlega krokom 2 do 5, bez względu na `_meta` (PoC szło wtedy ścieżką bezstanową i pomijało wiązanie). Powód: klient, który wysyła identyfikator sesji, oczekuje semantyki sesji; pominięcie wiązania zależałoby od pola, które klient dobiera.
- **Audyt sesji cudzej i nieznanej:** `404` jak dla nieznanej sesji, bez nowego powodu; kontrakt nie nazywa powodu audytu dla nieznanej sesji (nie nazwano nowego powodu).
- **Wiązanie nie jest barierą bezpieczeństwa:** porządkuje audyt (jedna sesja, jeden filtr) i pilnuje, żeby pośrednik w jednym połączeniu nie zmieniał zasięgu bez nowego `initialize`. Klient po `404` i tak inicjuje nową sesję z innym filtrem albo bez, a uprawnienia wyznacza Cedar przy każdym wywołaniu (CC-170).
- **Pliki:** `scripts/lib/endpoint-filter.mjs` (`sessionDecision`), wektory `endpoint-filter/session-order-*` (7), README ("Sesja"), `audit-event.schema.json`, CC-172 (adnotacja).
- **SemVer:** reguła kolejności dla nowej trasy; zmienia odpowiedź w scenariuszach, które 5.0.0 zostawiało otwarte (cudza sesja z innym filtrem wcześniej mogła dać `filter_mismatch`): wyjątek SemVer w README.
- **Wpływ:** ws-05 (kolejność w `McpEndpoint`; `filter_mismatch` tylko dla własnej sesji), ws-10 (trzy scenariusze: zły filtr w cudzej sesji, cudza sesja z innym filtrem, własna sesja z innym filtrem; sesja na innej trasie; nagłówek sesji z `_meta`), pozostali bez zmian.
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.1.0

## CC-185 | C5/C12/README | Limit 512 bajtów jest ograniczeniem wiążącym, nie 100 narzędzi

- **Problem:** CC-177 ("limit 100") i kreator zakładały, że do 100 narzędzi mieści się w adresie. Limit 512 bajtów całego query zadziała wcześniej: po `tools=` zostaje 506 bajtów, czyli 16 nazw po 30 znaków (31 nazw po 15). Kreator, który pozwala zaznaczyć więcej, dostaje `400` bez wyjaśnienia, a przeniesienie linku wg CC-177 pada tak samo.
- **Zmiana (tekst, bez zmiany reguł parsera):** limit 100 wpisów w `tools` i `exclude` zostaje (górne ograniczenie po usunięciu duplikatów), ale praktyczną granicą są 512 bajtów. Opisy `getMcpEndpoint` (parametry `systems`, `tools`, `exclude`, odpowiedź `400`), CC-177 (ręczne przeniesienie linku) i README mówią o bajtach. Kreator (ws-08) pokazuje licznik bajtów
  złożonego query i nie wysyła zapytania, którego nie da się złożyć; dłuższą listę narzędzi zastępuje się przez `systems` i `exclude`. Komentarz w referencji liczy to wprost.
- **Pliki:** `openapi/portal-bff.v1.yaml` (opis), CC-177 (zdanie o przeniesieniu), README, `scripts/lib/endpoint-filter.mjs` (komentarz), test `the filter limits ... are reachable` bez zmian.
- **SemVer:** poprawka opisu: patch.
- **Wpływ:** ws-08 (licznik bajtów w kreatorze), ws-07 (komunikat `400` bez zmian), pozostali bez zmian.
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.1.0

## CC-186 | C2/C8/Java | Filtr: ryzyko spoza zbioru, wzorzec `EndpointFilterQuery`, warunki pola `filter`, opis pola

- **Zmiana:**
  - **L1:** `EndpointFilter.allows` w Javie przepuszczała przy `access=write` narzędzie o ryzyku spoza zbioru `READ_ONLY`, `UPDATE`, `DESTRUCTIVE` (`UNKNOWN`, `read_only`, puste, `null`), a referencja JS nie. Teraz Java zachowuje się jak referencja: ryzyko spoza zbioru nie należy do żadnej grupy, więc ani `access=read`, ani `access=write` go nie zostawia
    (bez `access` zostaje widoczne). Wektory `apply-*-risk-outside-the-set` (3) i test Javy.
  - **L5:** wzorzec `EndpointFilterQuery` jest ścisły: parametry w stałej kolejności, bez początkowego i końcowego `&`, wpisy `tools` w postaci `<system>__<narzędzie>` (jeden `__`), wpisy `exclude` jako system albo narzędzie. Kolejność, brak duplikatów i limity nie wyrażają się wzorcem (sprawdza je referencja i wektory), co jest w opisie.
    Schemat zdarzenia audytu zabrania pola `filter` poza gatewayem, poza zdarzeniami `tool_call`, `policy_decision`, `confirmation`, `credential_resolve` oraz przy `reason: invalid_filter`.
  - **L4:** zdanie "wyłącznie nazwy systemów i narzędzi" (CC-174) było nieprawdziwe: parser przepuszcza dowolny token o składni nazwy, np. `systems=ghpabc123def456`, i trafia on do audytu i aktywności. Opis pól `filter` mówi teraz, że wpisy mają składnię nazw, ale wybiera je klient i nie są sprawdzane z listą systemów platformy.
    Niezmiennik 7 trzyma, bo alfabet (małe litery, cyfry, `_`) i 512 bajtów ograniczają zawartość; opis przestaje twierdzić więcej.
- **Pliki:** `EndpointFilter.java`, `EndpointFilterVectorTest.java`, `schemas/common.schema.json`, `schemas/audit-event.schema.json`, `openapi/gateway-admin.v1.yaml` (opis `filter` w `ActivityCall`), wektory, `test/vectors.test.mjs`.
- **SemVer:** zaostrzenie walidacji (wzorzec, warunki schematu) i zmiana wyniku metody Javy dla ryzyka spoza zbioru: według tabeli major; wyjątek SemVer w README.
- **Wpływ:** ws-05 (zdarzenia ze `filter` tylko tam, gdzie wolno; zgodność z wzorcem), ws-07/08 (opis pola), pozostali bez zmian.
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.1.0

## CC-187 | README/OpenAPI/wektory | Poprawki tekstu i wektorów po przeglądzie (L2, L3, L6, L7, L8, L9)

- **L2:** opis `ActivityCall.result` w `portal-bff.v1.yaml` (i `bundled`) wymieniał `denied_link_scope`; teraz `denied_filter_scope`. Pozostałe trafienia `link_scope` w kontraktach to historia i wektory negatywne.
- **L3:** `filter_scope` jest widoczny poza SIEM: wiersz aktywności użytkownika (`listMyActivityCalls`) ma wynik `denied_filter_scope`. Zdanie "widoczne tylko w SIEM" w CC-170 było nieścisłe. Niezmiennik 8 trzyma: wynik mówi tylko "masz prawo, filtr wyciął", a brak prawa i brak narzędzia dają to samo `denied_not_granted`,
  więc wiersz nie zdradza istnienia cudzych narzędzi, a klient MCP dostaje w obu przypadkach identyczne `not_found_or_denied`.
- **L6:** wektor `list-changed-definition-approved-outside-filter` miał identyczne `before` i `after`, więc niczego nie sprawdzał; `after` dostaje narzędzie spoza filtra. `listChangedNotification` porównuje nazwę, ryzyko i `definitionHash` (gdy podany), więc zmiana definicji przy tej samej nazwie daje powiadomienie
  (wektor `list-changed-definition-changed-and-approved`). Funkcja i wektory to materiał dla M6 (CC-179).
- **L7:** klient, który gubi query, łączy się z `/mcp` bez filtra i dostaje pełną listę bez błędu. To ciche poszerzenie **widoku**, nie uprawnień (Cedar rozstrzyga przy każdym wywołaniu). Poprawione zdanie "nie zadziała z filtrem" w README i CC-171; scenariusz z takim klientem nie był testowany na żywo.
- **L8:** nowy katalog wektorów `oauth-metadata/` (6): dokument metadanych `/.well-known/oauth-protected-resource/mcp` ma `resource` równe `<publicBaseUrl>/mcp` bez query; zapytanie o dokument z query (także błędnym filtrem) dostaje ten sam dokument; trasa systemowa; `/v/` i nieznana trasa to `404`. Referencja `protectedResourceMetadata`.
- **L9:** sprzeczności w tekście CC poprawione na miejscu: (a) CC-169: `systems` na trasie `/s/` ma być równy systemowi trasy (`jira` dla `mcp-jira`), nie "równy `serverId`"; (b) CC-173: "pokrycie przenosi ws-09" zastąpione "nie ma czego przenosić" (zgodnie z resztą wpisu i CC-177: link nie zawężał zasobów, `resourceDefaults` było uśpione od CC-085);
  (c) CC-175: `clientConfigs` ma klucze `claudeCode`, `copilot`, `codex` (nie "Claude Desktop, VS Code"); klucze zostają; (d) CC-175: "okres z CC-177" i "strona z migracją" zastąpione zgodnie z CC-177 (usunięcie od razu, bez ekranu migracji).
- **Pliki:** `openapi/portal-bff.v1.yaml` i `bundled`, `scripts/lib/endpoint-aggregate.mjs`, `scripts/lib/gateway-authentication.mjs`, `scripts/generate-endpoint-vectors.mjs`, wektory, README, CONTRACT_CHANGES.md (CC-169, CC-170, CC-171, CC-173, CC-175).
- **SemVer:** poprawki opisów: patch; zmiana oczekiwania istniejącego wektora `list-changed-*` (L6) według tabeli to major; wyjątek SemVer w README.
- **Wpływ:** ws-05 (metadane `/mcp` ignorują query), ws-10 (brak), pozostali bez zmian.
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.1.0

## CC-188 | C5/C12 | Migracja po 5.0.0: sesje 4.x i wiersze aktywności sprzed aktualizacji

- **Sesje 4.x w Redisie nie są uznawane (decyzja człowieka, 2026-10-31):** sesja zapisana przed aktualizacją nie ma trasy ani filtra, a CC-172 i CC-184 wymagają wiązania od `initialize`. Gateway traktuje ją jak nieznaną: `404` jak dla nieznanej sesji, bez `filter_mismatch`, klient inicjuje nową sesję. Nie ma migracji wpisów sesji.
- **Wiersze aktywności z `link_scope` / `denied_link_scope` (decyzja człowieka, 2026-10-31):** przy odczycie (agregacja `activity/calls`) powód `link_scope` zdarzeń sprzed aktualizacji jest mapowany na wynik `denied_filter_scope`, a zapisany wynik `denied_link_scope` także czytany jako `denied_filter_scope` (grupa `denied`).
  Dane nie są przepisywane, a zdarzenia audytu zostają nietknięte (w SIEM stara nazwa powodu zostaje w starych zdarzeniach). Mapowanie jest po stronie odczytu gateway'a (`ActivityAggregator`, `ActivityService`).
- **Potwierdzone wartości domyślne:** strona `tools/list` 100 (CC-181), ważność kursora 15 minut, `MCP_TOOLS_LIST_TIMEOUT` w milisekundach (3000, CC-180), kolejność `tool_disabled`, `upstream_unavailable`, `credential_required` oraz `tool_disabled` dla narzędzia oczekującego (CC-178), `filter_mismatch` dla sesji na innej trasie (CC-184), CC-173 "nie ma czego przenosić" (CC-187).
- **SemVer:** bez zmian schematów i wektorów; reguły dla wdrażających. **Wpływ:** ws-05 (odczyt sesji i aktywności), ws-10 (scenariusz: sesja 4.x po aktualizacji to `404` i nowa sesja; stary wiersz `link_scope` w aktywności), pozostali bez zmian.
- **Status:** accepted (decyzja: człowiek, 2026-10-31), wydanie 5.1.0

---

Poprawki 5.1.1 (decyzje człowieka, 2026-11-01, po przeglądzie ws-05 i ws-10): CC-189 i CC-190.

## CC-189 | C5/C10 | Query ponad limit transportu: `400` albo `414` bez `reason`

- **Problem:** CC-170 mówi, że query dłuższe niż 512 bajtów to `400 invalid_request`, `reason: invalid_filter`. Warstwa przed gatewayem (proxy, serwer HTTP) odrzuca jednak wcześniej zbyt długą linię żądania albo nagłówki (około 15 KB, zależnie od wdrożenia) i filtr nigdy nie widzi takiego query.
- **Decyzja człowieka (2026-11-01):** query ponad limit transportu to `400` albo `414` (wybiera wdrożenie) z ciałem JSON `{"error": "invalid_request"}` (nowy schemat `TransportLimitError` w `common.schema.json`, `reason` zabronione), bez `reason: invalid_filter`. Fail-closed zachowany: żądanie jest odrzucone, nigdy obsłużone bez filtra.
  `invalid_filter` obowiązuje do tego limitu (od 513 bajtów w górę aż do limitu transportu). Odpowiedź nadal bez `WWW-Authenticate`. Zdarzenie audytu z tej warstwy nie jest wymagane (gateway go nie widzi); jeśli powstaje, to `policy_decision` deny bez pola `filter`.
- **Pliki:** `schemas/common.schema.json` (`TransportLimitError`), wektor `endpoint-filter/error-response-over-transport-limit`, README, `test/vectors.test.mjs`.
- **SemVer:** nowa odpowiedź dla zakresu, który 5.1.0 opisywało jako `invalid_filter`, ale którego żaden gateway nie mógł obsłużyć; według tabeli zmiana oczekiwanej odpowiedzi, wydana jako patch na decyzję człowieka (wyjątek w README).
- **Wpływ:** ws-05 (limit nagłówka i odpowiedź zbudowana na poziomie serwera), ws-01 (nginx: `large_client_header_buffers` i strona błędu `414`/`400` w JSON, z nagłówkami `nosniff` i CSP), ws-10 (scenariusz: query 20 KB), pozostali bez zmian.
- **Status:** accepted (decyzja: człowiek, 2026-11-01), wydanie 5.1.1

## CC-190 | C8/C5 | Ograniczanie częstotliwości zdarzeń audytu odrzuceń, które klient może powtarzać

- **Problem:** klient może w pętli wysyłać zły filtr, cudzy kursor, sesję z innym filtrem albo `tools/call` na narzędzie spoza listy, a każde odrzucenie to zdarzenie audytu (CC-170, CC-172, CC-181, CC-184). To zalewa audyt (jak przy limitach, CC-125 i CC-156).
- **Decyzja człowieka (2026-11-01):** zdarzenia `invalid_filter`, `filter_mismatch`, `invalid_cursor` oraz niepoprawnego `tools/call` (`not_found_or_denied` z powodami `not_granted` i `filter_scope`) są ograniczane częstotliwością **per użytkownik i powód**: jedno zdarzenie w każdym interwale, resztę liczy tylko licznik `mcp_audit_endpoint_suppressed_total{reason}`
  (jak `mcp_audit_rate_limited_suppressed_total` i `mcp_audit_authentication_suppressed_total`). **Odrzucenie żądania działa zawsze**, niezależnie od tego, czy zdarzenie zapisano.
- **Interwał (zgodnie z `RateLimitAuditThrottle` w `mcp-gateway`, odczyt):** jedno zdarzenie na parę (`sub`, powód) w interwale; interwał konfigurowalny `MCP_RATE_LIMIT_AUDIT_INTERVAL`, domyślnie **10 s**; stan w pamięci instancji (nie współdzielony, więc przy N instancjach najwyżej N zdarzeń na interwał); gdy mapa przekroczy 10 000 wpisów, wygasłe wpisy są usuwane; zdarzenie jest "należne", gdy pary nie było albo od ostatniego zapisu minął cały interwał (`>=`).
  Nazwa licznika `mcp_audit_endpoint_suppressed_total` jest propozycją (gateway ma dziś licznik tylko dla limitów żądań); do potwierdzenia w ws-05.
- **Pliki:** `scripts/lib/endpoint-aggregate.mjs` (`auditThrottle`), wektory `endpoint-aggregate/audit-throttle-*` (6), `schemas/audit-event.schema.json` (opis `reason`), README.
- **SemVer:** audyt rejestruje mniej zdarzeń niż w 5.1.0 opisano; według tabeli zmiana zachowania, wydana jako patch na decyzję człowieka (wyjątek w README).
- **Wpływ:** ws-05 (ten sam mechanizm co `RateLimitAuditThrottle` dla czterech powodów, licznik), ws-10 (asercje audytu: pętla złych filtrów daje jedno zdarzenie na 10 s i wszystkie odrzucenia), ws-01 (alert na licznik), pozostali bez zmian.
- **Status:** accepted (decyzja: człowiek, 2026-11-01), wydanie 5.1.1

## CC-191 | C8/C5 | Klucz ograniczania audytu obejmuje cel; zdarzenie podsumowujące; limit kluczy

- **Problem (przegląd CC-190):** klucz (`sub`, powód) pozwala jednemu wabikowi uciszyć inne cele: kto powtarza `tools/call` na niewinne narzędzie, przez 10 s ukrywa w audycie próbę wywołania innego (`jira__delete_issue`), a licznik samego powodu nie mówi, kto ani czego dotyczył.
- **Decyzja człowieka (2026-11-01), poprawka CC-190:**
  - **Klucz:** (`sub`, powód, cel). Cel to nazwa narzędzia dla odmów narzędzia (`not_granted`, `filter_scope`), a dla pozostałych skrót kanonicznego filtra (`filter_mismatch`), surowego query (`invalid_filter`: nie ma co normalizować) albo kursora (`invalid_cursor`). Skrót służy tylko jako klucz w pamięci i nie trafia do zdarzenia.
  - **Limit kluczy na `sub`:** `MCP_AUDIT_THROTTLE_MAX_TARGETS_PER_USER`, domyślnie 50 aktywnych kluczy (zapisanych w ostatnim interwale). Nowy cel ponad limit dzieli jeden klucz zbiorczy `*` (jedno zdarzenie na interwał dla wszystkich takich celów razem), więc pamięć nie rośnie z wymyślanych nazw, a odmowa nadal działa.
  - **Zdarzenie podsumowujące:** gdy okno pary (`sub`, powód) się zamyka (interwał po pierwszym zdarzeniu okna), gateway zapisuje jedno zdarzenie tego powodu z nowym polem `suppressedCount` (liczba pominiętych w oknie, wszystkie cele razem), jeśli coś pominięto. Licznik `mcp_audit_endpoint_suppressed_total{reason}` zostaje.
  - Reszta CC-190 bez zmian: odrzucenie działa zawsze, interwał `MCP_RATE_LIMIT_AUDIT_INTERVAL` (10 s), pamięć instancji.
- **Pliki:** `scripts/lib/endpoint-aggregate.mjs` (`auditThrottle` z celem, limitem i podsumowaniami), wektory `endpoint-aggregate/audit-throttle-*` (10, przepisane; w tym `other-tool-is-not-silenced`, `other-filter-is-not-silenced`, `number-of-keys-is-limited`, `summary-after-the-interval`), `schemas/audit-event.schema.json` (`suppressedCount`), wektor `audit-events/gateway-audit-suppressed-summary`, README.
- **SemVer:** nowe pole opcjonalne i doprecyzowanie CC-190; wektory `audit-throttle-*` z 5.1.1 zmieniają wejście (cel) i oczekiwania; wyjątek w README.
- **Wpływ:** ws-05 (kod gatewaya trzeba dostosować: `RateLimitAuditThrottle` ma dziś klucz (`sub`, powód), brak celu, limitu kluczy i podsumowania), ws-10 (wywołanie innego narzędzia nie jest wyciszane; podsumowanie po oknie), ws-01 (alert na licznik i na `suppressedCount`), pozostali bez zmian.
- **Status:** accepted (decyzja: człowiek, 2026-11-01), wydanie 5.1.2

---

Pakiet M6 (etap 2 planu M6; propozycje ws-00 z 2026-11-03, decyzje człowieka z 2026-11-03 w `mcp-platform-plan/m6-plan.md`, "Decyzje pakietu kontraktów"; wydanie 6.0.0): CC-192 ... CC-205. Źródła faktów: `STATUS.md` repozytoriów strumieni, `mcp-platform-plan/STATUS.md`, `m5-plan.md` (pkt D, G), `m6-plan.md`, `pytania-eksploatacja.md` (A9), przegląd kodu `mcp-contracts` w HEAD (5.1.3-SNAPSHOT). Liczby oznaczone jako "propozycja" są wyborem ws-00, nie danymi z komponentu.

Numer wersji pakietu (ścisły SemVer, tabela w README): CC-193 dodaje wartość enum (`adapter` w `PendingTool.source`) i warunkowo wymagane `risk`/`action` we wpisie manifestu, a CC-203 zaostrza kod wyjścia `PolicyLintCli`; według tabeli to **major, czyli 6.0.0** (decyzja człowieka, 2026-11-03). Pozostałe pozycje są minor lub patch.

## CC-192 | C5/C10/README | Włączenie `list_changed`: zasady, `GET /mcp`, wektory `list-changed-*`

- **Kontrakt:** C5/C10, README ("Powiadomienia"); dotyczy CC-176 (opis docelowy) i CC-179 (przesunięcie na M6). Kryterium 3 planu M6: klient widzi zmianę listy bez ponownego łączenia.
- **Stan dziś:** `capabilities.tools.listChanged: false`, `GET` na `/mcp` i `/s/<serverId>/mcp` to `405` z `Allow: POST, DELETE` (po sprawdzeniu tokenu), referencja `listChangedNotification` i 11 wektorów `endpoint-aggregate/list-changed-*` są "materiałem dla M6". Wektorów dla `listChanged: false` ani dla `405` na `GET` nie ma (tylko tekst README), więc zmiana nie przestawia żadnego wektora.
- **Zmiana (proponowana):**
  - Gateway deklaruje `listChanged: true` na `/mcp` i `/s/<serverId>/mcp` dla protokołu z sesją i wysyła puste `notifications/tools/list_changed` na otwarty strumień `GET` sesji. Wyzwalacze, ograniczenia (najwyżej jedno powiadomienie na sesję na 1 s, porównanie z listą sesji po filtrze, brak audytu powiadomień) i zasada "zmiana połączenia konta nie jest wyzwalaczem" zostają jak w CC-176 i stają się wymaganiem.
  - **`GET`** z `Accept: text/event-stream` i `Mcp-Session-Id` otwiera strumień. Kolejność kontroli jak w CC-184: (1) token, `401`/`503`; (2) składnia query, `400 invalid_filter`; (3) `sub` sesji, cudza albo nieznana sesja to `404` bez `filter_mismatch`; (4) trasa sesji; (5) filtr równy filtrowi `initialize`, inaczej `404` i `filter_mismatch`. To domyka zdanie CC-179: "sprawdzenie filtra na strumieniu `GET` jest wymaganiem M6". `GET` bez sesji albo bez `Accept: text/event-stream` zostaje `405` (`Allow: POST, DELETE, GET`; w wariancie bezstanowym strumień otwiera `subscriptions/listen`); zdarzenia odrzuceń `GET` podlegają ograniczaniu z CC-190/CC-191.
  - **Życie strumienia (propozycja):** strumień kończy się, gdy wygasa token, którym go otwarto (klient otwiera nowy z nowym tokenem), gdy sesja zostaje usunięta (`DELETE`) i przy `purge` użytkownika. Brak odtwarzania zdarzeń (`Last-Event-ID` ignorowane): po ponownym połączeniu klient i tak wywołuje `tools/list`, więc utrata powiadomienia nie psuje bezpieczeństwa (`tools/call` jest sprawdzane przy każdym wywołaniu). Limitu strumieni na użytkownika nie ma (decyzja niżej); strumień nie zajmuje miejsca w limicie żądań w toku, a liczba otwartych strumieni jest metryką.
  - **HA:** zdarzenia rejestru i polityk trafiają do wszystkich instancji (Redis pub/sub albo licznik wersji), instancja trzymająca strumień rozsyła. Opóźnienie do powiadomienia: propozycja najwyżej 5 s od zdarzenia (precedens: okno do 60 s przy `purge` i TTL rejestru do 60 s są za długie dla "lista zmienia się na żywo"). Zmiana grup wykrywana tylko przy odświeżeniu tokenu albo żądaniu (CC-176), więc sesja bezczynna może dostać powiadomienie z opóźnieniem; README to mówi.
  - **Wariant bezstanowy (MCP 2026-07-28, `subscriptions/listen`):** obowiązuje te same wyzwalacze i ograniczenia; punkt odniesienia listy opisany w decyzji niżej (CC-179 przesuwało `list_changed` m.in. dlatego, że go brakowało).
- **Wektory `list-changed-*` (11):** zostają bez zmian i stają się normatywne (README: "materiał dla M6" zastąpione wymaganiem). Trzy kluczowe: `connection-changed` (brak powiadomienia), `definition-changed-and-approved` i `definition-approved-outside-filter` (poprawione w CC-187). Nowe (minor): `list-changed-sequence-*` (łączenie zdarzeń w oknie 1 s, nowy `kind` z migawkami listy w czasie), `endpoint-filter/stream-open-*` (kolejność kontroli i `filter_mismatch` na `GET`; po wydaniu nazwa zamiast zapowiedzianej `session-order-get-*`). Zakończenie strumienia przy wygaśnięciu tokenu i brak limitu strumieni i wyłączenie strumienia z limitu żądań nie mają wektorów (zachowanie transportu): scenariusze ws-10.
- **Zgodność wstecz:** `listChanged` z `false` na `true` i `GET`, który był `405`, to zmiana oczekiwanego zachowania gatewaya (README, wymaganie CC-192); według tabeli w wydaniu 6.0.0 to część majora, nie samodzielny minor. Klient, który nie otwiera `GET`, działa jak dotąd; wektory `list-changed-*` (11) bez zmian.
- **Kogo dotyka:** ws-05 (strumień `GET` i `subscriptions/listen`, emisja, kanał między instancjami, łączenie zdarzeń, wyłączenie strumienia z limitu żądań, metryka otwartych strumieni), ws-01 (Redis pub/sub w HA, nginx: buforowanie i `proxy_read_timeout` dla SSE; nie sprawdzono, czy obecna konfiguracja proxy to znosi), ws-10 (zatwierdzenie narzędzia w trakcie sesji daje powiadomienie i nowe narzędzie w drugim kliencie; wygaśnięcie tokenu zamyka strumień), ws-07/08 (brak), ws-02/03/04/09 (brak).
- **Decyzja człowieka (2026-11-03):** `list_changed` w obu wariantach (sesja i bezstanowy); bez limitu strumieni na użytkownika, ale strumień `GET` nie liczy się do limitu żądań w toku (`MCP_MAX_CONCURRENT_REQUESTS`, CC-199) i gateway wystawia metrykę liczby otwartych strumieni (nazwa do potwierdzenia w ws-05, propozycja `mcp_gateway_open_streams`). Opóźnienie do powiadomienia 5 s (górna granica). Wariant bezstanowy (`subscriptions/listen`): gateway deklaruje `listChanged: true` także tam; punktem odniesienia listy jest lista z chwili otwarcia strumienia (CC-207; w tekście 6.0.0 stało tu "ostatni `tools/list` w połączeniu", co nie daje się wdrożyć za balancerem). Zamknięcie strumienia przy wygaśnięciu tokenu sprawdza ws-10 przy drugim kliencie (M6-5).
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.0.0

## CC-193 | C6/C5/C12 | Manifest obcego serwera bez adnotacji: `source: adapter`, ryzyko i akcja nadawane przez admina

- **Kontrakt:** C6 (`server-manifest.schema.json`), C5 (`PendingTool`, `ApproveRequest`), C12 (zatwierdzanie w portalu). Źródło: `m5-plan.md` pkt D: adapter (`mcp-server-adapter`, ws-13) buduje manifest z `tools/list` obcego serwera; "ryzyko i akcję nadaje admin przy zatwierdzaniu (brak `@ToolRisk`)"; polityki tylko na poziomie narzędzia (brak `@ResourceRef`).
- **Stan dziś (z kodu kontraktu):** `ToolEntryFields` wymaga `name`, `risk`, `action`, `resourceRefs`, `definition`, `definitionHash`; `risk` i `action` wchodzą do `definitionHash`; `PendingTool.source` ma enum `[ci, server]`; `McpToolDefinition.annotations` to opcjonalny obiekt, a `title` i zamknięty `inputSchema` (CC-078, CC-115, CC-123) są wymagane. Obcy serwer nie dostarcza `risk`/`action`, a część jego narzędzi może nie mieć `title` ani zamkniętego schematu.
- **Zmiana (proponowana):**
  1. **Pole `source` na poziomie manifestu:** opcjonalne, jedyna wartość `adapter`; brak pola oznacza serwer zbudowany na starterze (jak dziś). `PendingTool.source` dostaje wartość `adapter` (wpis przedstawiony przez adapter, nigdy nie zatwierdzany automatycznie, także gdy narzędzie wygląda na odczyt).
  2. **`risk` i `action` w manifeście adaptera zabronione** (adapter nie klasyfikuje), `resourceRefs` musi być `[]`. Dla manifestu bez `source` oba pola zostają wymagane. Reguła warunkowa w schemacie (`if source = adapter`).
  3. **Klasyfikacja przy zatwierdzeniu:** `ApproveRequest` dostaje opcjonalne `risk` i `action`; dla wpisu `source: adapter` są wymagane (brak: `422 manifest_rejected`, `reason: classification_required`), dla pozostałych zabronione. Zatwierdzenie z klasyfikacją to `admin_change` z powodem `definition_approved` i polami `risk`; obniżenie względem wcześniejszej klasyfikacji podlega podłodze ryzyka i `acceptRiskLowering` (CC-167). Niesklasyfikowane narzędzie jest ukryte i odmawiane jako `tool_disabled` (fail-closed). Cedar i `context.risk` biorą klasyfikację z rejestru; `mcp.cedarschema` bez zmian.
  4. **`definitionHash` adaptera:** propozycja: hash liczony z `definition`, `resourceRefs`, `system`, `credential` bez `risk`/`action` (adapter ich nie zna); klasyfikacja jest daną rejestru, zapisaną z `sub` admina i czasem, widoczną w katalogu C5 i audytowaną. Zmiana definicji obcego serwera zmienia hash i wpis wraca do oczekujących jak w CC-133/CC-161; klasyfikacja poprzedniego zatwierdzenia jest pokazywana adminowi jako sugestia, nie stosowana automatycznie.
  5. **`annotations` obcego serwera** (np. `readOnlyHint`) są niezaufanymi podpowiedziami: zostają częścią definicji i hasha, ale gateway nigdy nie czyta ich jako ryzyka. Portal może je pokazać adminowi jako sugestię.
  6. **Definicje niespełniające CC-078/CC-115/CC-123:** to adapter (jedyny, który przekazuje wywołania obcemu serwerowi) publikuje definicję zamkniętą i sprawdza argumenty względem niej przed przekazaniem; kontrakt nie zmienia wymagań wobec definicji.
- **Zgodność wstecz:** nowa wartość enum (`PendingTool.source`, `ManifestRejected.reason`) oraz `risk`/`action` warunkowo wymagane we wpisie: według tabeli README **major**. Manifesty bez `source` i bez nowych pól przechodzą bez zmian, wygenerowane typy (TS, Java) wymagają regeneracji u odbiorców enum. Wariant bez zmiany enum nie istnieje: wpis adaptera nie jest ani `ci`, ani `server` (nikt go nie przejrzał w commicie, a nie jest to definicja prezentowana przez serwer zbudowany na starterze). To główny powód rekomendacji 6.0.0.
- **Kogo dotyka:** ws-13 (manifest bez `risk`/`action`, `source`), ws-05 (rejestr: klasyfikacja, `approve`, `tool_disabled` dla niesklasyfikowanych), ws-07 (operacja zatwierdzenia z `risk`/`action`, step-up jak dla obniżenia ryzyka), ws-08 (dialog klasyfikacji, pokazanie `annotations` jako sugestii), ws-10 (scenariusz: obcy serwer, klasyfikacja, wywołanie), ws-09 (polityki per narzędzie bez zmian), ws-02/03/04 (brak).
- **Wektory (nowe, minor w pakiecie major):** `manifests/valid-adapter` (zapowiadane jako `valid-adapter-unclassified`), `manifests/invalid-adapter-*`, `definition-hash/get-issue-adapter-without-classification` (zapowiadane jako `adapter-without-risk`); wektory zatwierdzenia (`classification_required` itd.) dochodzą w 6.1.0 jako `registry-approval/`. Istniejące wektory manifestów bez `source` bez zmian.
- **Decyzja człowieka (2026-11-03):** klasyfikacja admina jest daną rejestru poza `definitionHash`; manifest adaptera wysyła adapter przy starcie (`PendingTool.source: adapter`); 6.0.0.
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.0.0

## CC-194 | C5/C12/C8 | Wyłącznik awaryjny narzędzia i systemu dla admina (A9)

- **Kontrakt:** C5 (nowe operacje rejestru), C12 (operacje BFF), C8 (powody audytu). Źródło: `pytania-eksploatacja.md` A9 ("Jak zablokować narzędzie albo cały system natychmiast", stan: brak), `m5-plan.md` pkt G, decyzja M6-6 (A9 przez pakiet kontraktów).
- **Stan dziś:** opis `ServerSummary.enabled` mówi, że serwer bywa wyłączony konfiguracją gatewaya albo polityką `overrides` i "the portal has no switch"; `disabled` w katalogu (CC-081) jest odczytem. Najszybsza droga to paczka `overrides` przez potok ws-09, co wymaga commita, przeglądu i odświeżenia paczki u gateway'a. To nie jest "natychmiast". (Cedar `forbid` z `overrides` zostaje jako druga, niezależna ścieżka.)
- **Zmiana (proponowana):**
  - **API (C5, `x-allowed-client-cn: [mcp-portal-bff]`, token użytkownika z grupy `mcp-platform-admin`):** `PUT` i `DELETE` na `/admin/v1/registry/servers/{serverId}/kill-switch` (system; w tej wersji system = serwer `mcp-<system>`, 1:1) oraz `/admin/v1/registry/servers/{serverId}/tools/{tool}/kill-switch` (narzędzie). `PUT` z ciałem `{ "reason": "<1..200 znaków, UntrustedText>" }`, `204`; ponowne `PUT` i `DELETE` bez przełącznika są idempotentne. `GET /admin/v1/kill-switches` zwraca aktywne przełączniki: zakres, `serverId`, `tool`, `setBy` (sub admina), `setAt`, `reason`. Katalog C5 pokazuje `disabled: true` i nowe pole `disabledBy: kill_switch | approval | configuration` (opcjonalne).
  - **Skutek:** wywołanie dostaje `tool_disabled` (C10, kod jak dziś), narzędzie znika z `tools/list` i katalogu jako dostępne, system wyłącza wszystkie swoje narzędzia. `approve`, ponowny `PUT` manifestu i rejestracja nie zdejmują przełącznika; zdejmuje go tylko `DELETE`. Wywołanie już przyjęte nie jest przerywane; oczekujące potwierdzenie `DESTRUCTIVE` na wyłączone narzędzie kończy się przy potwierdzeniu `tool_disabled` (bramka jest sprawdzana ponownie przed wykonaniem).
  - **Audyt (C8):** `admin_change` z powodami `kill_switch_set` i `kill_switch_cleared` (sub admina, `system`, `tool` jeśli dotyczy; tekst `reason` z żądania zostaje w rejestrze i w portalu, nie trafia do pól zdarzenia audytu); odmowy wywołań to `tool_call` deny z `reason: kill_switch` (osobno od `tool_disabled` z oczekiwania na zatwierdzenie, żeby SIEM odróżnił incydent) i `errorCode: tool_disabled`. Wynik wiersza aktywności: istniejące mapowanie `tool_disabled -> tool_disabled` (CC-165), bez nowej grupy wyniku.
  - **Fail-closed:** przełącznik jest zapisany trwale (baza rejestru, nie pamięć), więc przeżywa restart. Gateway, który nie potrafi odczytać stanu przełączników (baza niedostępna), odmawia wywołania (`upstream_unavailable`, jak przy niedostępnym sklepie stanu) i nie jest gotowy po starcie. Błąd zapisu przełącznika to `503`, nigdy `204`.
  - **Propagacja:** zapis do bazy, potem publikacja unieważnienia (Redis pub/sub, ten sam kanał co zdarzenia rejestru z CC-192); instancja sprawdza stan przy każdym `tools/call` z cache nie starszym niż N s. Propozycja N = 5 s (górna granica skutku po `204` na każdej instancji; precedens okna 60 s przy `purge` jest za długi dla wyłącznika awaryjnego). Cache nie jest przedłużany, gdy odczyt zawiedzie.
  - **BFF (C12):** operacje `POST /api/v1/admin/kill-switches` i `DELETE ...` (nazwy do ustalenia z ws-07), audyt `admin_change` także po stronie BFF przy odmowie; włączenie bez step-up (incydent), zdjęcie ze step-up MFA (jak `acceptRiskLowering`).
- **Zgodność wstecz:** nowe operacje, nowe opcjonalne pole `disabledBy`, nowe wartości `reason` (pole to wzorzec, nie enum): **minor**. Opis `enabled`/`disabled` poprawiony (patch).
- **Kogo dotyka:** ws-05 (tabela, cache z TTL, kanał unieważnień, brama w `tools/call`, `tools/list`, potwierdzenia), ws-07 (operacje BFF, grupa admina, step-up), ws-08 (przełącznik w ekranie admina, lista aktywnych), ws-01 (Redis pub/sub, alert na `kill_switch_set`), ws-10 (scenariusze: włączenie, skutek na dwóch instancjach w <= N s, restart, awaria bazy, zdjęcie), ws-11 (instrukcja A9), ws-09 (bez zmian).
- **Wektory (nowe):** `kill-switch/` (stan przełącznika i wywołanie -> `tool_disabled`; `approve`/`PUT` nie zdejmują; system obejmuje narzędzia), `audit-events/gateway-kill-switch-*`, wektory `activity-calls/` dla `reason: kill_switch`.
- **Decyzja człowieka (2026-11-03):** wyłącznik włączany bez MFA, zdejmowany po świeżym MFA, bez wygasania, system = jeden serwer (`mcp-<system>`), propagacja do 5 s.
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.0.0

## CC-195 | C8/C5 | Doprecyzowanie CC-191: klucz limitu kluczy, zamykanie okna, liczba pominiętych celów

- **Kontrakt:** C8/C5, CC-191 (klucz ograniczania audytu), `scripts/lib/endpoint-aggregate.mjs` (`auditThrottle`), `audit-event.schema.json`. Źródło: `mcp-gateway/STATUS.md`, "Propozycje CC (M5)", punkt 0 (zaimplementowane tak w `EndpointAuditThrottle`).
- **Rozbieżność:** CC-191 liczy limit kluczy `MCP_AUDIT_THROTTLE_MAX_TARGETS_PER_USER` na `sub`; referencja robi to samo (`startsWith(sub)`), a gateway liczy per (`sub`, powód), żeby tanie `invalid_filter` nie wyczerpywały budżetu odmów narzędzi. Istniejące wektory (jeden powód na wektor) nie rozróżniają obu wersji.
- **Zmiana (proponowana):**
  1. Limit kluczy jest liczony per (`sub`, powód) (z domyślnymi 50 na parę). Referencja `auditThrottle` jest dostosowana, a nowy wektor `audit-throttle-keys-limited-per-reason` (użytkownik z pełnym budżetem `invalid_filter` nadal dostaje zdarzenie `not_granted` dla nowego narzędzia) pokazuje różnicę.
  2. Okno (`sub`, powód) zamyka się po interwale od pierwszego zdarzenia okna niezależnie od ruchu (timer), a kontrolowane zamknięcie procesu zapisuje podsumowania otwartych okien. Tekst CC-191 mówił tylko o "zamknięciu okna"; referencja modeluje to parametrem `flushAt`. Przy N instancjach okna są osobne (stan w pamięci instancji; już w CC-190).
  3. Opcjonalne pole `suppressedTargets` (liczba różnych pominiętych celów w oknie) w zdarzeniu podsumowującym, obok `suppressedCount`. Dziś gateway wystawia ją tylko w metryce `mcp_audit_endpoint_summary_targets`, bo schemat 5.1.2 ma `additionalProperties: false`.
- **Zgodność wstecz:** nowe pole opcjonalne `suppressedTargets`, ale 11 wektorów `audit-throttle-*` zmieniło oczekiwania (podsumowania mają `suppressedTargets`), a limit kluczy liczy się per (`sub`, powód): według tabeli zmiana oczekiwania istniejącego wektora, czyli major (pakiet 6.0.0).
- **Kogo dotyka:** ws-05 (zgodność już jest; pole `suppressedTargets` w zdarzeniu), ws-10 (asercje podsumowań), ws-01 (alert na `suppressedCount`/`suppressedTargets`), pozostali bez zmian.
- **Decyzja człowieka (2026-11-03):** limit kluczy per (`sub`, powód).
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.0.0

## CC-196 | C8 | Powody audytu brokera spoza opisu: `database_unavailable`, `refresh_token_lost`, `user_offboarding` i pozostałe

- **Kontrakt:** `audit-event.schema.json`, opis pola `reason` ("Known values: ..."). Źródło: `mcp-credential-broker/STATUS.md`, Propozycje CC (status `open`): pole ma wzorzec, nie enum, więc to doprecyzowanie opisu.
- **Stan:** broker emituje wartości, których lista znanych powodów nie zawiera:
  - `database_unavailable`: baza nie odpowiedziała (`TransactionException` i wyjątki dostępu do danych -> `503`, zdarzenie z wynikiem `error`, `errorCode: upstream_unavailable`), także w Authenticatorze;
  - `refresh_token_lost`: dostawca zrotował refresh token, a broker go nie zapisał (po ponowieniu zapisu); nowe tokeny odwołane u dostawcy, połączenie przechodzi w `error` (nie `revoked`);
  - `user_offboarding`: zapis odmówiony, bo trwa albo przed chwilą był `purge` użytkownika (CC-155);
  - oraz, z tej samej propozycji brokera: `secret_store_unavailable`, `token_refreshed`, `oauth_grant_revoked`, `connection_changed_during_refresh`, `provider_unavailable`, `connection_busy`. (`jti_store_unavailable` jest w CC-197.)
- **Zmiana (proponowana):** dopisać wszystkie do opisu `reason` z jednozdaniowym znaczeniem i zdarzeniem (`connection_change`/`credential_resolve`), wynikiem i `errorCode`, jak wyżej; bez zmiany reguł walidacji. Precyzyjne zdarzenia i wyniki każdego powodu potwierdza ws-06 (zestawienie powyżej pochodzi z jego STATUS, nie z kodu).
- **Zgodność wstecz:** poprawka opisu: **patch**. Nowe wektory `audit-events/broker-*` (po jednym na powód) byłyby minor; nie są wymagane.
- **Kogo dotyka:** ws-06 (potwierdzenie listy i znaczeń), ws-01 (reguły SIEM), pozostali bez zmian.
- **Decyzja człowieka (2026-11-03):** dopisujemy wszystkie dziewięć powodów (plus `secret_missing` z CC-205).
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.0.0

## CC-197 | C8/C2 | Nazwa powodu niedostępnego źródła kluczy: `jwks_unavailable` czy `key_source_unavailable` (i `jti_store_unavailable`)

- **Kontrakt:** `audit-event.schema.json` (zdarzenie `authentication`: `jwks_unavailable`, `replay_store_unavailable`, wynik `denied`, `errorCode: upstream_unavailable`), README (kolejność decyzji dla awarii IdP).
- **Rozbieżność (odczyt kodu):** `CallerAuthenticationFilter` brokera zapisuje przy `KeySourceUnavailableException` powód `key_source_unavailable`, a przy `ReplayGuardUnavailableException` powód `jti_store_unavailable`, jako zdarzenie operacji (`operation.auditEvent()`) z wynikiem `error`. Kontrakt i starter (`mcp-starter-lib/README.md`) używają `jwks_unavailable` i `replay_store_unavailable` w zdarzeniu `authentication` z wynikiem `denied`. Oba rozjazdy (nazwa, zdarzenie i wynik) nie były sprawdzone na działającym brokerze; opis wyżej to odczyt filtra.
- **Zmiana (proponowana, wariant A):** obowiązują nazwy kontraktu. Opis `reason` mówi, że `jwks_unavailable` i `replay_store_unavailable` dotyczą każdego odbiorcy JWT wewnętrznego (serwery i broker), zdarzenie to `authentication`, wynik `denied`. Broker zmienia nazwy i kształt zdarzenia. Kontrakt się nie zmienia poza opisem.
- **Alternatywa (B):** kontrakt dodaje `key_source_unavailable` i `jti_store_unavailable` jako powody brokera, bo broker może czytać klucze także z pliku (tryb dev), a "JWKS" jest wtedy nieścisłe. Odradzane: dwa powody tego samego zjawiska rozbijają reguły SIEM, a w trybie pliku źródło nie bywa niedostępne (STATUS brokera: `fromFile` nie wygasa).
- **Zgodność wstecz:** wariant A: opis (patch); zmiana nazw w brokerze to zmiana zdarzeń audytu u wdrożonego komponentu, nie kontraktu. Wariant B: nowe wartości w opisie, patch.
- **Kogo dotyka:** ws-06 (zmiana nazw i kształtu zdarzenia), ws-01 (reguły SIEM), pozostali bez zmian. Wektory: istniejące `audit-events/*-jwks-unavailable-*` dotyczą zdarzenia `authentication`; broker powinien być sprawdzony na nich (zakres ws-06).
- **Decyzja człowieka (2026-11-03):** wariant A, nazwy z kontraktu, broker się dostosowuje.
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.0.0

## CC-198 | C8/C5 | Powód `policy_forbid` dla zakazu na poziomie narzędzia

- **Kontrakt:** CC-178 (krok 1 `mayCall`: odmowa narzędzia to `not_found_or_denied`, powód `not_granted`), opis `reason` w `audit-event.schema.json` (`policy_forbid` jest na liście znanych powodów), mapowanie wyniku wiersza (`policy_forbid -> denied_policy`, `not_granted -> denied_not_granted`, `scripts/lib/activity-calls.mjs`). Źródło: `mcp-gateway/STATUS.md`, Propozycje CC (M5), punkt 1.
- **Problem:** zakaz z paczki `overrides` (awaryjny `forbid`) daje dziś `not_granted` tak samo jak brak grupy. SIEM nie odróżnia incydentowego zakazu od braku uprawnienia. Poprzednio (M4) było `access_denied` z powodem `policy_forbid`.
- **Zmiana (proponowana):** przy tym samym kodzie klienta (`not_found_or_denied`) zdarzenie audytu dostaje `reason: policy_forbid`, gdy odmowę dał `forbid` (na poziomie narzędzia), a `not_granted`, gdy nie było żadnego `permit`. **Wiersz aktywności użytkownika zostaje `denied_not_granted`**: mapowanie `policy_forbid -> denied_policy` dotyczy odmów z argumentami (`access_denied`), a użycie go tu odsłoniłoby użytkownikowi, że narzędzie istnieje i jest objęte zakazem (niezmiennik 8). Mapowanie rozróżnia więc po `errorCode` (`not_found_or_denied` kontra `access_denied`), nie po samym powodzie.
- **Zgodność wstecz:** zmienia się zasada ustalania powodu przy `not_found_or_denied` (CC-178 mówiło `not_granted` także dla `forbid`) i mapowanie wiersza aktywności po `errorCode`: zmiana oczekiwanego zachowania gatewaya, w pakiecie major 6.0.0.
- **Kogo dotyka:** ws-05 (powód przy odmowie narzędzia, mapowanie wiersza), ws-01 (reguły SIEM), ws-10 (asercja: awaryjny `forbid` daje `policy_forbid` w audycie i `denied_not_granted` w wierszu użytkownika), pozostali bez zmian.
- **Decyzja człowieka (2026-11-03):** `policy_forbid` tylko w audycie, wiersz użytkownika `denied_not_granted`.
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.0.0

## CC-199 | C5/C10/README | `Retry-After` przy `503` z ograniczenia współbieżności (shed) i z niedostępnego magazynu sesji

- **Kontrakt:** README i opisy odpowiedzi C5 (`503` z `Retry-After` jest opisane dla niedostępnego JWKS, CC-124, i dla limitów przy niedostępnym Redisie, CC-167, `Retry-After: 10`). Źródło: `mcp-gateway/STATUS.md` ("Przeciążenie") i README gateway'a. Nie znalazłem w źródłach jawnej treści pozycji "`Retry-After`" z `m6-plan.md`; poniżej jedyny przypadek z lukami w kontrakcie, jaki znalazłem. Pytanie, czy o to chodziło, jest niżej.
- **Stan:** `ConcurrencyLimitFilter` gateway'a (domyślnie 128 żądań `POST`/`DELETE` w toku) odmawia `503` z `Retry-After` (`MCP_SHED_RETRY_AFTER_SECONDS`, domyślnie 2 s) i ciałem `{"error":"upstream_unavailable"}` (kod C10), bez wywołania czegokolwiek za bramą, po uwierzytelnieniu. Kontrakt tego `503` nie opisuje (grep po README i CONTRACT_CHANGES: brak przeciążenia), więc klient i test nie mają wektora.
- **Zmiana (proponowana):** README opisuje trzecie i czwarte źródło `503` z `Retry-After`: przeciążenie gateway'a i niedostępny magazyn sesji. `Retry-After` w sekundach (liczba całkowita, >= 1), bez `WWW-Authenticate`, ciało jak C10 `upstream_unavailable`, brak nagłówka ujawniającego limit lub ustawienie (jak CC-156). Wektor odpowiedzi w `gateway-authentication-decision/` nie pasuje (to nie uwierzytelnienie); proponuję `tool-errors/` albo krótki wektor `endpoint-aggregate/shed-503` z oczekiwanym kształtem. Audyt: zdarzenie `policy_decision` deny z `errorCode: upstream_unavailable`, ograniczane jak CC-125 (częstość zdarzeń z przeciążenia byłaby sama zalewem); powód do ustalenia z ws-05.
- **Zgodność wstecz:** opis istniejącego zachowania i nowy wektor: **patch/minor**.
- **Kogo dotyka:** ws-05 (zgodność już jest; powód audytu), ws-01 (nginx nie może gubić `Retry-After`), ws-10 (scenariusz przeciążenia już istnieje w `mcp-load-tests`), klienci MCP (zalecenie ponowienia).
- **Decyzja człowieka (2026-11-03):** `Retry-After` przy `503` z shed i z magazynu sesji. Magazyn sesji (Redis): gdy gateway nie potrafi odczytać ani zapisać sesji MCP, żądanie sesyjne dostaje `503`, ciało C10 `upstream_unavailable` i `Retry-After` (domyślnie 10 s, jak przy niedostępnym Redisie w CC-167), bez `WWW-Authenticate`; nie jest to `404` (sesja nie jest "nieznana", tylko nieczytelna). `503` brokera (C4) poza zakresem tego wpisu.
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.0.0

## CC-200 | C5/README | `tools/list` z `cursor: ""`

- **Kontrakt:** CC-181 (kursor; "kursor niebędący napisem to ten sam błąd", `-32602`, `invalid_cursor`). Źródło: `mcp-e2e/STATUS.md`, Propozycje CC: zestaw nie sprawdza, czy `cursor: ""` to brak kursora czy `-32602`.
- **Luka:** pusty napis jest napisem, więc nie wpada w "niebędący napisem", ale nie ma pozycji ani podpisu. CC-181 nie rozstrzyga.
- **Zmiana (proponowana):** `cursor: ""` jest kursorem niepoprawnym: `-32602`, `Invalid cursor`, ta sama odpowiedź i zdarzenie `invalid_cursor` co dla każdego innego złego kursora. Pierwsza strona to brak pola (albo `null`, jeśli klient go tak wysyła, do potwierdzenia przez ws-05, bo `null` też nie jest w CC-181). Wektor `endpoint-aggregate/cursor-empty-string`.
- **Alternatywa:** `""` jak brak kursora (pierwsza strona). Łagodniejsze dla klientów, które wysyłają puste pole, ale tworzy drugą ścieżkę wejścia bez uwierzytelnienia kursora; odradzane.
- **Zgodność wstecz:** nowy wektor, doprecyzowanie: **minor**. Jeśli gateway dziś traktuje `""` jak brak kursora, jego zachowanie się zmienia (poprawka u ws-05). Nie sprawdzano kodu gatewaya.
- **Kogo dotyka:** ws-05 (obsługa `""`), ws-10 (G9: dopisać pusty kursor do zestawu błędnych), ws-08/07 (brak).
- **Decyzja człowieka (2026-11-03):** `-32602`.
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.0.0

## CC-201 | C1/C2 | Token IdP z claimami `vs`/`vsc` na `/mcp`

- **Kontrakt:** CC-173 (koniec `vs`, `vsc`; JWT wewnętrzny C2 z `vs` lub `vsc` to `401 invalid_claims` przez `unevaluatedProperties`), C1 (token klienta AI od IdP). Źródło: `mcp-e2e/STATUS.md`, Propozycje CC.
- **Luka:** `invalid_claims` dotyczy tokenu C2. Dla poprawnie podpisanego tokenu IdP z takimi claimami na `/mcp` kontrakt nic nie mówi; zestaw ws-10 sprawdza tylko odrzucenie tokenów podrobionych.
- **Zmiana (proponowana):** weryfikacja tokenu C1 nie stosuje `unevaluatedProperties`: nieznane claimy są ignorowane, w tym `vs` i `vsc` (nic ich nie czyta od CC-173). Właściwością bezpieczeństwa jest druga strona: JWT wewnętrzny C2 buduje gateway wyłącznie ze znanych pól i nigdy nie kopiuje claimów tokenu IdP, więc `vs`/`vsc` z IdP nie trafiają do serwerów i brokera. Wektor `gateway-authentication/valid-token-with-removed-claims` (decyzja: przyjęty, brak `vs` w wygenerowanym C2) i test ws-10.
- **Alternatywa:** odrzucać token IdP z `vs`/`vsc` (`401`). Daje twardszy sygnał, ale psuje logowanie, gdy IdP dopisze claim o tej nazwie z innego powodu; odradzane.
- **Zgodność wstecz:** doprecyzowanie, nowy wektor: **minor** (nie zmienia żadnego istniejącego oczekiwania; zachowanie "ignoruj" jest typowe dla biblioteki JWT).
- **Kogo dotyka:** ws-05 (potwierdzenie, że C2 nie kopiuje claimów), ws-10 (scenariusz), pozostali bez zmian.
- **Decyzja człowieka (2026-11-03):** claim ignorowany.
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.0.0

## CC-202 | C12/wektory | Wektor `%zz` (niepoprawny escape w query)

- **Kontrakt:** CC-182 (`getMcpEndpoint`; wartości po dekodowaniu przez warstwę HTTP), wektory `mcp-endpoint/`. Źródło: `mcp-portal/bff/STATUS.md` (kontrakt nie mówi, co z `%zz`; BFF traktuje to jako `invalid_filter`), `mcp-platform-plan/STATUS.md` (2026-10-31: "Proponowane CC: wektor %zz do CC-182").
- **Stan:** wektor `invalid-percent-encoding` dotyczy wartości zdekodowanej, w której został `%`. Niepoprawny escape (`%zz`, `%`, `%4`) w query wysłanym przez klienta nie ma wektora; kontener (Tomcat) odrzuca taki parametr wyjątkiem, który BFF łapie i zamienia na `400 invalid_filter` (nie `500`). Mock MSW: zachowanie nie sprawdzone.
- **Zmiana (proponowana):** opis CC-182 mówi, że niepoprawny escape to `400 invalid_request`, `reason: invalid_filter` (jak każde `%` po dekodowaniu). Nowy wektor `mcp-endpoint/http-broken-escape` (`httpQuery: "systems=%zz"`, `rawQuery` pominięte, oczekiwane `400 invalid_filter`) i, jeśli generator na to pozwala, wariant `systems=%` i `systems=%4`. Mock MSW zwraca to samo.
- **Zgodność wstecz:** nowe wektory i opis: **minor**. Mock odrzucający `%zz`, jeśli dziś przepuszcza, to zaostrzenie walidacji mocka (wyjątek jak w CC-182).
- **Kogo dotyka:** ws-07 (już zgodne według STATUS), ws-08 (mock), ws-05 (gateway odrzuca każde `%` w query: `endpoint-filter/parse-percent-encoded-*`; wariant surowy `%zz` do dopisania w tym samym wektorze).
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.0.0

## CC-203 | Java | Kod wyjścia `PolicyLintCli` przy uszkodzonym schemacie lub błędzie walidacji

- **Kontrakt:** CC-183 (lint niemożliwych polityk kończy się kodem `1`), Javadoc `PolicyLintCli`: "0 when clean, 1 on violations, 2 on usage or parse errors". Źródło: `mcp-platform-plan/STATUS.md` (2026-10-31, ws-09, LOW-3: `PolicyLintCli` daje `rc=0` przy uszkodzonym schemacie; "do następnego wydania kontraktów").
- **Przyczyna (odczyt kodu, bez uruchomienia):** `PolicyLint.impossible` zwraca pustą listę, gdy `ValidationResponse.success` jest puste, czyli gdy Cedar nie zwrócił wyniku walidacji (schemat lub polityki nie przeszły walidacji). `PolicyLintCli` traktuje pustą listę jako "czysto" i kończy `0`.
- **Zmiana (proponowana):** brak wyniku walidacji to błąd: `impossible` rzuca wyjątek z komunikatem walidatora (lub zwraca go jako naruszenie), a `PolicyLintCli` kończy kodem `2` ("cannot lint"), nie `0`. Test: uszkodzony `--schema` i polityka niezgodna ze schematem -> `2`. `BundleVerifier` bez zmian (jak w CC-183).
- **Zgodność wstecz:** metoda i CLI kończą się błędem tam, gdzie wcześniej kończyły się sukcesem: według tabeli zaostrzenie walidacji, **major** (precedens: CC-183 w 5.1.0, wyjątek SemVer). Praktycznie to naprawa błędu; w potoku ws-09 uszkodzony schemat i tak łapie `policy-tool check`.
- **Kogo dotyka:** ws-09 (krok `PolicyLintCli`: polityki, które nie przechodzą walidacji, kończą krok kodem `2`), odbiorcy paczek bez zmian.
- **Decyzja człowieka (2026-11-03):** wydane z pakietem jako major 6.0.0.
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.0.0

## CC-204 | C5/C10/README | `UPDATE` jest dostarczane co najmniej raz; `502` z balancera ze stałym tekstem o nieznanym wyniku

- **Kontrakt:** C10 (`tools/call`), README ("Semantyka dostarczenia"), `common.schema.json`. Źródło: przegląd HA M5 (decyzja człowieka, 2026-11-03): gdy instancja gatewaya pada w trakcie `tools/call`, balancer odpowiada `502`, a klient może ponowić wywołanie, więc narzędzie o ryzyku `UPDATE` może wykonać się dwa razy.
- **Decyzja człowieka (2026-11-03):** semantyka at-least-once zapisana w kontrakcie, bez klucza idempotencji. Zamiast niego `502` z balancera ma stały, jednoznaczny tekst o nieznanym wyniku.
- **Zmiana:**
  - README, "Semantyka dostarczenia": `tools/call` o ryzyku `READ_ONLY` jest bezpieczne do ponowienia; `UPDATE` jest dostarczane co najmniej raz (po błędzie o nieznanym wyniku: `502`, reset połączenia, limit czasu klienta, ponowienie przez klienta może wykonać operację drugi raz); `DESTRUCTIVE` wymaga przy ponowieniu nowego potwierdzenia (kod potwierdzenia jest jednorazowy, C11). Platforma nie wprowadza klucza idempotencji. Gateway nie ponawia sam `tools/call` o ryzyku `UPDATE` ani `DESTRUCTIVE` do serwera (ponowienie decyduje klient albo użytkownik); autorzy narzędzi `UPDATE` powinni, gdzie system docelowy na to pozwala, projektować operację tak, by powtórzenie było nieszkodliwe (opisane w README startera, nie wymuszone).
  - Odpowiedź balancera na awarię instancji w trakcie żądania: `502` z ciałem JSON `{"error":"bad_gateway","message":"The request may or may not have been processed. Check the result before repeating a write."}` (nowy schemat `BalancerError` w `common.schema.json`, `message` jest stałą; nagłówki `nosniff` i CSP jak w CC-189). Tekst jest stały, żeby klient i model nie interpretowali go jako "nie wykonano"; nie zdradza ustawień ani instancji.
- **Pliki:** `schemas/common.schema.json` (`BalancerError`), wektory `balancer-errors/*` (zapowiadane jako `endpoint-filter/error-response-balancer-502`), README, `test/vectors.test.mjs`.
- **SemVer:** nowy schemat i wektor, opis semantyki: minor w pakiecie major.
- **Wpływ:** ws-01 (nginx: `proxy_next_upstream error timeout` bez `non_idempotent` i strona błędu `502`/`504` w JSON z nagłówkami; nginx nie przekazuje wtedy wysłanego `POST` na drugą instancję, więc nie tworzy podwójnego wykonania, a przełącza się tylko przy nieudanym połączeniu; `off` byłoby błędem, CC-206), ws-05 (brak automatycznego ponowienia `tools/call` UPDATE/DESTRUCTIVE do serwera), ws-10 (scenariusz: zabicie instancji w trakcie `tools/call` UPDATE daje `502` z tym tekstem), ws-02/03/04 (README: operacje powtarzalne tam, gdzie to możliwe), ws-11 (dokumentacja).
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.0.0

## CC-205 | C4/C12/C8 | Połączenie bez sekretu przechodzi w `error` z powodem `secret_missing`

- **Kontrakt:** C4 (`Connection`, zdarzenie `connection_change`), C8 (powód), C12 (lista połączeń). Źródło: `mcp-credential-broker/STATUS.md`, M6 etap 1 (`LostSecretSignal`) i przegląd ws-06 M6 (M4: wiersz `connected` bez sekretu zajmuje batch sweepu).
- **Stan:** gdy sekretu połączenia brakuje w OpenBao, wiersz zostaje `connected`; użytkownik nie widzi problemu, a wywołanie kończy się `credential_required`. Sygnał to metryka `broker.connection.secret_missing{system,place}` i log WARN.
- **Decyzja człowieka (2026-11-03), opcja a):** po wykryciu braku sekretu (przy `resolve` albo w sweepie) broker ustawia stan wiersza `error` i zapisuje zdarzenie `connection_change` z powodem `secret_missing`, wynikiem `error` (zdarzenie niżej). Wiersz w stanie `error` wypada z zapytania sweepu, więc nie blokuje batcha. Portal pokazuje istniejący stan błędu z prośbą o ponowne połączenie (`connectUrl`); ponowne połączenie zapisuje nowy sekret i przywraca `connected`. Bez nowej wartości enum.
  - **Zdarzenie:** `connection_change`, `reason: secret_missing`, `outcome: error`, bez `errorCode`, jeśli kontrakt zdarzenia nie wymaga go dla tego powodu (do potwierdzenia przez ws-06 z wektorem); `place` (`resolve`, `refresh_sweep`) pozostaje w metryce, nie w zdarzeniu.
  - Dotyczy wszystkich typów poświadczeń przechowywanych w OpenBao (`user-secret`, `user-oauth`); `token-exchange` i `service-account` nie mają sekretu użytkownika.
- **Pliki:** `schemas/audit-event.schema.json` (opis `reason`), wektor `audit-events/broker-connection-secret-missing`, opis `ConnectionStatus` w `credential-broker.v1.yaml` (`error` obejmuje także brak sekretu), README.
- **SemVer:** nowy powód (pole to wzorzec) i opis; zachowanie brokera zmienia stan wiersza: minor w pakiecie major.
- **Wpływ:** ws-06 (stan `error` po wykryciu, zdarzenie, sweep), ws-07/08 (pokazanie `error` z prośbą o ponowne połączenie; bez zmian w kontrakcie), ws-01 (alert na metrykę), ws-10 (scenariusz: usunięty sekret konta jednorazowego daje `error`).
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.0.0

---

Poprawki 6.1.0 (przegląd 6.0.0, decyzje człowieka 2026-11-03 w `mcp-platform-plan/m6-plan.md`, "Decyzje po przeglądzie 6.0.0"): CC-206.

## CC-206 | C5/C6/C8/C10/README | Poprawki po przeglądzie 6.0.0: kanał adaptera, wyłącznik po autoryzacji, balancer, wektory i doprecyzowania

- **Źródło:** przegląd `review-contracts-6.0.0.md` (W1 ... W3, S1 ... S6, N1 ... N9, D1). Wszystko poniżej jest addytywne albo jest poprawką tekstu i referencji; nic nie zaostrza walidacji istniejących danych, więc wydanie to **6.1.0** (ścisły SemVer). Wyjątek wymaga zgody: N1 i N2 (warunki `if/then` w `RegistryTool` i `KillSwitch`) zaostrzyłyby walidację odpowiedzi, więc zostają opisem i są odłożone do następnego majora.
- **W1, kanał adaptera:** nowa operacja C5 `submitAdapterManifest`, `PUT /admin/v1/registry/adapters/{serverId}`, `x-allowed-client-cn: mcp-adapter-{serverId}` (osobny CN adaptera, porównanie całego CN). Które `serverId` obsługuje adapter, ustala konfiguracja gatewaya, nie manifest. Dla takiego `serverId` `registerServer` odpowiada `422 manifest_rejected`, `reason: adapter_mode_mismatch`; dla innego tak odpowiada `submitAdapterManifest`; manifest bez `source: adapter` na kanale adaptera lub z nim na kanale potoku to to samo `422`.
  Wywołanie niczego nie zatwierdza: każde nowe lub zmienione narzędzie jest `pending_approval` z `source: adapter`, także wyglądające na odczyt; wpis bez zmiany hasha zostaje z klasyfikacją; brakujące narzędzie jest usuwane. Wektory `adapter-registry/` (10, referencja `submissionDecision`), przykłady OpenAPI, mock.
- **S2:** różnica znaleziona przy odczycie `tools/list` działającego serwera w trybie adaptera daje oczekujący wpis `source: adapter`, nigdy `server`; `approve` wymaga wtedy klasyfikacji, a poprzednia nie jest stosowana po cichu (wektor `adapter-registry/runtime-read-in-adapter-mode`).
- **S3:** hash wpisu adaptera liczy się zawsze z wpisu manifestu bez `risk` i `action`, także gdy wpis wzbogacono klasyfikacją z rejestru (JS `manifestEntryHash` i Java `DefinitionHash.hashOf` ignorują je dla `source: adapter`; test `AdapterHashTest`).
- **W2:** demo i pierwsze wdrożenie adaptera dotyczą pięciu znanych systemów (`SystemId`, `ServerId`, schemat Cedar). Obcy serwer na szóstym systemie wymaga nowego systemu, czyli majora; decyzja o otwarciu listy po M6 (bez zmiany enumów w 6.1.0).
- **W3, balancer:** `proxy_next_upstream error timeout` bez `non_idempotent` (jak `mcp-platform-dev/lb/gateway.conf`): nginx nie przekazuje wysłanego `POST` na drugą instancję, a przełącza się, gdy połączenie nie powstało. `proxy_next_upstream off` z 6.0.0 było błędem w drugą stronę (usuwa przełączenie bez powodu i daje `502` o nieznanym wyniku, choć nic nie wysłano); `non_idempotent` jest zabronione dla `POST /mcp`. Poprawione: README, CHANGELOG 6.0.0 (erratum), CC-204. `BalancerError` obejmuje też `504` (`gateway_timeout`, ten sam stały tekst, N5); wektory `balancer-errors/instance-did-not-answer-in-time`, `instance-down-before-connect`.
- **S1, wyłącznik po autoryzacji:** przełącznik jest stanem narzędzia jak inne (CC-178): sprawdza się go po `mayCall` i po filtrze. Użytkownik bez prawa do narzędzia albo z filtrem, który je wycina, dostaje `not_found_or_denied` (`not_granted`, `filter_scope`), nie `tool_disabled` (niezmiennik 8). Referencja `callDecision` (stan `killSwitch`, powód audytu `kill_switch`) i `killSwitchDecision` (`mayCall`, `inFilter`); wektory `endpoint-filter/call-state-kill-switch-*`, `kill-switch/call-user-without-access`, `call-outside-filter`. Nieczytelny magazyn to `upstream_unavailable` dla każdego, kto dotarł do tego kroku.
- **N3:** przełącznik należy do adresu (serwer, narzędzie), nie do manifestu: narzędzie usunięte z manifestu zachowuje przełącznik, jego `DELETE` to `204`, `PUT` dla narzędzia nieznanego rejestrowi to `404` (wektor `kill-switch/lift-switch-of-removed-tool`).
- **S4, `subscriptions/listen`:** brak sesji; strumień jest związany z filtrem tego żądania; kolejność: token, składnia filtra (`400`), bez `filter_mismatch`. Punkt odniesienia listy: patrz CC-207 (lista z chwili otwarcia strumienia; reguła "ostatni `tools/list` w połączeniu" z 6.1.0 wycofana). Wektory `endpoint-filter/stream-open-stateless-*`, `endpoint-aggregate/list-changed-sequence-stateless-*`. Zasada ws-00, nie osobna decyzja człowieka.
- **D1:** górna granica 5 s dla powiadomienia `list_changed` jest decyzją człowieka z 2026-11-03 (CC-192 i README to mówią).
- **S5:** `PolicyLint.impossible` rzuca `IllegalStateException` przy błędzie walidacji (CC-203); odbiorca musi to złapać: `PolicyChecks` w `mcp-policies/.ci` łapie dziś tylko `AuthException` (migracja ws-09 w CHANGELOG 6.1.0). `PolicyLintCli.run` jest publiczne (N8).
- **S6, wektory zatwierdzenia:** `registry-approval/` (10): `classification_required`, `classification_not_allowed`, obniżenie klasyfikacji z `acceptRiskLowering` i bez, narzędzie niesklasyfikowane ukryte jako `tool_disabled`; referencje `approveDecision`, `adapterToolState`. Zapowiedziane w CC-192/193/204 nazwy wektorów poprawione na rzeczywiste.
- **N4:** zdarzenie `admin_change` z `definition_approved` albo `risk_lowered_by_admin` dla narzędzia adaptera niesie `risk` i nowe opcjonalne `action`; to jest klasyfikacja (opis `action` w schemacie audytu).
- **N6, N7, N9:** README pisze `Retry-After` (domyślnie 10 s), referencja `idpTokenClaimsDecision` sprawdza `iss`, `aud`, `sub`, `exp` (wektory `wrong-issuer`, `wrong-audience`, `without-sub`), a opis powodów brokera mówi, że wyniki i `errorCode` potwierdza ws-06 i że wektory mają tylko trzy z nich.
- **Erratum 6.0.0 (CHANGELOG, tag bez zmian):** lista zmian niezgodnych dostaje CC-200 (`cursor: ""`, pozycja 9), CC-202 (mock MSW odrzuca `%zz`, zwykły major) i poprawione klasyfikacje CC-192, CC-195, CC-198 (patrz wyżej).
- **Zgodność wstecz:** nowa operacja, nowy powód `adapter_mode_mismatch`, opcjonalne `action` w audycie, `gateway_timeout` w `BalancerError` (poszerzenie), nowe wektory i referencje, poprawki tekstu i klasyfikacji. Referencja `idpTokenClaimsDecision` jest dokładniejsza, ale nie zmienia istniejących oczekiwań. **Minor.**
- **Kogo dotyka:** ws-05 (kanał adaptera, tryb adaptera w konfiguracji, wyłącznik po `mayCall`/filtrze, `subscriptions/listen`), ws-13 (kanał, CN, tylko pięć systemów), ws-01 (certyfikat `mcp-adapter-<serverId>`, nginx bez `non_idempotent`, `504`), ws-09 (`PolicyChecks`), ws-06 (potwierdzenie powodów), ws-07/08 (operacja adaptera niewidoczna w portalu; `RegistryTool.source: adapter` już jest), ws-10 (scenariusze), pozostali bez zmian.
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.1.0

---

Poprawki 6.2.0 (przegląd 6.1.0, decyzje człowieka 2026-11-03 w `mcp-platform-plan/m6-plan.md`, "Decyzje po przeglądzie 6.1.0"): CC-207.

## CC-207 | C5/C10/README | Poprawki po przeglądzie 6.1.0: punkt odniesienia strumienia bezstanowego, strumienie poza limitem i z heartbeatem, kolejność odpowiedzi kanału adaptera

- **Źródło:** `review-contracts-6.1.0.md` (S7, S8, N10 ... N14, SemVer). Zmieniane elementy 6.1.0 (kanał adaptera, `gateway_timeout`, bezstanowy `list_changed`) nie mają jeszcze wdrożeń, dlatego wydanie to **6.2.0** z opisanym wyjątkiem SemVer (wzór: 5.1.0; README, "Wersjonowanie").
- **S7, punkt odniesienia (decyzja człowieka, 2026-11-03):** w wariancie bezstanowym `list_changed` porównuje się z listą użytkownika z chwili otwarcia strumienia `subscriptions/listen`, którą zna instancja trzymająca strumień. `tools/list` obsłużone w międzyczasie (być może przez inną instancję) nie jest punktem odniesienia. Wcześniejsza reguła "ostatni `tools/list` w połączeniu" (CC-192, CC-206) jest wycofana; "połączenie" nie jest zdefiniowane bez sesji. Referencja `listChangedStateless`, wektory `endpoint-aggregate/list-changed-stateless-*` (4; jeden pokazuje, że odczytana lista nie jest referencją), poprzednie `list-changed-sequence-stateless-*` usunięte.
- **S8, strumienie (decyzja człowieka):** `POST subscriptions/listen` jest poza limitem żądań w toku tak samo jak `GET` (CC-192, CC-199). Heartbeat SSE: komentarz `: keepalive` co 15 s (`MCP_SSE_HEARTBEAT_INTERVAL`) na każdym strumieniu. nginx nie odróżnia `subscriptions/listen` od innego `POST /mcp`: `proxy_buffering off` i `proxy_read_timeout` co najmniej 60 s dla `/mcp` i `/s/...`, obie postaci strumienia. Migracja ws-01 i ws-05 w CHANGELOG 6.2.0.
- **N11, kolejność odpowiedzi kanału adaptera:** certyfikat (`403`), potem `serverId` w ciele względem ścieżki (`400`), potem tryb i `source` (`422`). Dopisane w OpenAPI i README; wektory `adapter-registry/adapter-wrong-cn-before-mode-mismatch`, `adapter-body-server-id-differs-from-path`.
- **N13:** odpowiedź `200` `submitAdapterManifest` to nowy schemat `AdapterRegistryServer` (`AdapterRegistryTool`) bez `classifiedBy` i `classifiedAt`.
- **N14:** `approve` sprawdza zgodność `risk` i `action` klasyfikacji (`read` tylko dla `READ_ONLY`, `update` dla `UPDATE`, `delete` dla `DESTRUCTIVE`, `admin` dla `UPDATE` albo `DESTRUCTIVE`); inaczej `422 classification_inconsistent`. Wektory `registry-approval/adapter-read-only-with-delete`, `adapter-destructive-with-read`, `adapter-update-with-admin`.
- **N10:** teksty OpenAPI, README i opis `reason` mówią o `action`; pole `action` w schemacie audytu to `$ref` do `ToolAction`.
- **Usuwanie narzędzi (decyzja człowieka):** narzędzie nieobecne w manifeście adaptera jest usuwane z rejestru wraz z klasyfikacją admina; gdy wróci, jest nowe i wymaga ponownej klasyfikacji. Wektor `adapter-registry/adapter-removed-tool-loses-classification` (pole `removed`, `classificationLost`).
- **N1, N2:** zostają do następnego majora (zaostrzenie walidacji odpowiedzi); znane, w CHANGELOG.
- **N12, D1:** sprzeczne oznaczenie reguły punktu odniesienia usunięte z CC-192 i CC-206. Górna granica 5 s dla powiadomienia jest decyzją człowieka z 2026-11-03.
- **Wyjątek SemVer:** według tabeli major byłyby: nowa wartość enum `gateway_timeout` w `BalancerError` (6.1.0), inny punkt odniesienia, kolejność odpowiedzi kanału adaptera, `classification_inconsistent`, węższa odpowiedź `200` kanału adaptera i pole `removed` w referencji. Dotyczą elementów bez wdrożeń; wydane jako minor (decyzja człowieka, 2026-11-03).
- **Kogo dotyka:** ws-05, ws-13, ws-01, ws-07/08 (nowy kod `422` przy `approve`), ws-10.
- **Status:** accepted (decyzja: człowiek, 2026-11-03), wydanie 6.2.0

## CC-208 | C8/README | Zdarzenie audytu zmiany zdolności backendu (`backend_capability`)

- **Źródło:** `research-full-servers.md` pkt 9 (starter: `CapabilityProbe` przy starcie, tryb `degraded` dla nieznanej wersji systemu), ws-02 etap 3 M6. Starter 3.0.0-beta-11 ma sondę, log, metrykę `mcp_backend_capability{probe,state}` i szczegół zdrowia; zdarzenia C8 nie mają typu na zmianę stanu, więc audytu nie wysyła.
- **Zmiana (proponowana):** nowe zdarzenie `backend_capability` w `audit-event.schema.json` (`component: server`): `probe` (nazwa systemu, snake case), `state` (`supported`, `degraded`, `unavailable`), `backendVersion` (opcjonalne, tekst oczyszczony do `[A-Za-z0-9._+ -]`, do 120 znaków), `reason` (stałe kody, na przykład `version_unknown`, `probe_failed`, `probe_timeout`). Emitowane przy zmianie stanu lub wersji, nie przy każdej sondzie. Bez `sub`, `tool` i `requestId` użytkownika (zdarzenie nie należy do żądania). Wektory `audit-events/server-backend-capability-*`.
- **Zgodność wstecz:** nowa wartość enum `event`, według tabeli SemVer **major** (jak `PendingTool.source: adapter` w 6.0.0); do wydania z następnym majorem albo z wyjątkiem opisanym jak w 5.1.0.
- **Kogo dotyka:** ws-02 (emisja), ws-05/ws-07 (jeśli aktywność ma pokazywać degradację serwera), ws-10 (scenariusz: serwer z nieznaną wersją systemu startuje i raportuje `degraded`).
- **Bez decyzji kontraktowej starter działa:** log i metryka wystarczają operatorowi; audyt jest dodatkiem.
- **Status:** proposed (ws-02, 2026-11-03)

## CC-209 | C6/C10/README | Wspólny kształt dużego wyniku: definicje `PageCursor`, `PagedResult` i limit wyniku w manifeście

- **Źródło:** `research-full-servers.md` pkt 4 i 5 (duże odpowiedzi: logi pipeline, diff MR, strony Confluence; limit `maxResultBytes` per narzędzie), ws-02 etap 3 M6. Starter 3.0.0-beta-11 ma `CursorCodec` (kursor HMAC związany z `sub`, narzędziem i zapytaniem, ważny 15 minut) i rekord `PagedResult<T>` (`items`, `nextCursor`, `truncated`, `omitted`); kształt jest zapisany w kodzie i README startera, nie w kontrakcie.
- **Zmiana (proponowana):**
  1. `common.schema.json`: `$defs/PageCursor` (string, `pattern` `^[A-Za-z0-9_.-]{1,1024}$`, `maxLength` 1024), żeby `@ArgumentLimits(contractPattern = "PageCursor")` zastąpiło stałą w starterze i żeby adapter (ws-13) i serwery miały jedną definicję.
  2. `$defs/PagedResultFields`: `nextCursor` (opcjonalne `PageCursor`), `truncated` (boolean), `omitted` (do 10 unikalnych kodów snake case do 40 znaków, bez liczników). Zasada w README: `omitted` nigdy nie liczy elementów usuniętych przez politykę; brak `total`.
  3. `server-manifest.schema.json`: opcjonalne `maxResultBytes` we wpisie narzędzia (limit wyniku deklarowany przez serwer, dziś tylko globalne `tools.max-result-size` startera, 1 MB); gateway może go używać do obcięcia i do ostrzeżeń w portalu. Wchodzi do `definitionHash` albo nie: do rozstrzygnięcia (jeśli tak, zmienia hashe wszystkich narzędzi, które je ustawią).
- **Zgodność wstecz:** nowe definicje i opcjonalne pole: **minor**; wejście `maxResultBytes` do `definitionHash` to major.
- **Pytania do człowieka:** (1) czy `maxResultBytes` wchodzi do hasha; (2) czy kontrakt ma wymuszać `PagedResultFields` w `outputSchema` narzędzi z `nextCursor` (rekomendacja: nie, tylko definicja do powołania się).
- **Kogo dotyka:** ws-02, ws-03, ws-04, ws-13 (adapter może mapować kursory obcych serwerów), ws-05 (jeśli ma użyć limitu).
- **Status:** proposed (ws-02, 2026-11-03)

**Pakiet propozycji M6 etap 3 (zebrane 2026-11-03, ws-00).** Pozycje CC-210 ... CC-226 pochodzą ze strumieni ws-02, ws-04, ws-05, ws-06, ws-07/ws-08 i ws-13; duplikaty połączono (Basic dla Cloud z Jiry i Confluence w CC-222, poświadczenie sondy w CC-215). CC-208 i CC-209 są wyżej. Kolumna SemVer liczona według tabeli w `README.md` ("Wersjonowanie"); nowa wartość enum i zmiana bajtów schematu Cedar to major, o ile człowiek nie zdecyduje o wyjątku jak w 2.1.0.

| CC | Tytuł | Autor | SemVer | Rekomendacja |
| --- | --- | --- | --- | --- |
| CC-210 | `400` dla `approveAdminTool`, powód wyłącznika | ws-07/ws-08 | patch/minor | przyjąć |
| CC-211 | Odrzucenie tokenu przez broker: `authentication` | ws-06 | patch (a) | wariant (b) |
| CC-212 | Wektory `broker-authentication-*`: `decision` | ws-06 | patch | przyjąć |
| CC-213 | Basic dla OpenSearch | ws-04 | minor | część 1 po CC-222 |
| CC-214 | `OpenSearch::Alias` | ws-04 | major | przyjąć |
| CC-215 | Poświadczenie sondy wersji | ws-04 | minor | odłożyć |
| CC-216 | `GitLab::MergeRequest` | ws-04 | major | przyjąć |
| CC-217 | Pola JQL | ws-04 Jira | major | przyjąć |
| CC-218 | CQL `ancestor`, `lastmodified` | ws-04 Confluence | major | przyjąć |
| CC-219 | CQL `type = page` | ws-04 Confluence | minor (a) | wariant (a) |
| CC-220 | `Jira::Board`, `Jira::Sprint` | ws-04 Jira | major | przyjąć |
| CC-221 | Załączniki binarne | ws-04 Jira | major | odłożyć |
| CC-222 | Basic w `user-secret`, `deployment` | ws-04 | minor | przyjąć |
| CC-223 | Limit otwartych strumieni | ws-05 | minor | decyzja człowieka 2026-11-03, do wydania |
| CC-224 | `503` katalogu przy nieczytelnych wyłącznikach | ws-05 | minor | przyjąć |
| CC-225 | `cursor: null` | ws-05 | patch | przyjąć |
| CC-226 | Klasyfikacja w wewnętrznym JWT | ws-13 | minor | przyjąć po przeglądzie |

Decyzje człowieka 2026-11-03: wydanie **6.3.0**, bez zmian niezgodnych wstecz, z dwoma wyjątkami SemVer opisanymi w CHANGELOG (CC-219: stała klauzula `type = page` zmienia dwa istniejące wektory CQL, jedynym odbiorcą jest serwer Confluence; CC-227: adapter tylko do odczytu zaostrza `approve` kanału, który nie jest wdrożony). Przyjęte: CC-210 ... CC-213 (część 1), CC-219, CC-222 ... CC-226; nowe CC-227 i CC-228. Odłożone: CC-214, CC-215, CC-216, CC-217, CC-218, CC-220, CC-221. Pierwotna rekomendacja 7.0.0 dotyczyła pakietu z nowymi typami zasobów i polami, które odłożono.


## CC-210 | C12 | `approveAdminTool` i `putAdmin*KillSwitch`: odpowiedź `400` i tekst powodu wyłącznika

- **Źródło:** ws-07 i ws-08, etap 3 M6 (kontrakty 6.2.0). BFF odpowiada `400 invalid_request` na `approve`, gdy ciało nie jest `ApproveRequest` (zły skrót, nieznana wartość `risk` albo `action`, pole spoza schematu, para `risk` bez `action`), a operacja `approveAdminTool` nie wylicza `400` w odpowiedziach. Test odpowiedzi względem kontraktu musi tę odpowiedź pomijać.
- **Zmiana (proponowana):** (1) dodać `"400": BadRequest` do `approveAdminTool` w `portal-bff.v1.yaml`. (2) `KillSwitchRequest.reason` jest `UntrustedText` (`CC-094`), ale schemat nie mówi, czy BFF odrzuca znaki ukryte w tekście administratora, czy je zapisuje i neutralizuje przy wyświetlaniu; BFF odrzuca je `400` (administrator wpisuje tekst sam, ukryty znak to prawie na pewno błąd), gateway zostaje przy swoim zakresie. Do potwierdzenia albo do opisu w `description`.
- **Uwaga bez zmiany kontraktu:** `ToolEntry` wyraża `required: [risk, action]` przez `allOf`, więc generator `typescript-angular` (openapi-generator 7.26.0) robi z `risk` i `action` pola opcjonalne także tam, gdzie kontrakt je wymaga (wpis zatwierdzony, `approvedEntry`). Web sprawdza obecność w kodzie; typy z `dist/types` pakietu tego nie mają.
- **Zgodność wstecz:** nowa odpowiedź `400` w kontrakcie opisującym zachowanie, które już istnieje: **patch** albo **minor**, bez zmiany wdrożeń.
- **Kogo dotyka:** ws-07 (test kontraktowy), ws-08 (generowany klient obsługuje `400` jako błąd ogólny).
- **Rekomendacja:** przyjąć (1) jako patch/minor; (2) opisać w `description`, że BFF odrzuca znaki ukryte `400` (potwierdzone implementacją ws-07).
- **Uwaga uczciwa (6.3.1):** odrzucanie przez BFF `reason` z ukrytymi znakami zaostrza pole C12 według tabeli SemVer; wydane bez osobnego wyjątku, bo opisuje zachowanie BFF, którego nikt jeszcze nie wdrożył.
- **Status:** accepted (decyzja: człowiek, 2026-11-03, wydanie 6.3.0); zgłosił: ws-07/ws-08, 2026-11-03

## CC-211 | C8 | Odrzucenie tokenu przez broker: zdarzenie `authentication` czy zdarzenie operacji

- **Źródło:** przegląd ws-06 M6 etap 3 (pkt 6), `mcp-credential-broker` w HEAD po migracji do 6.2.0.
- **Stan:** opis `reason` w `audit-event.schema.json` mówi, że dla zdarzenia `authentication` powodem jest kod odrzucenia, także dla odbiorcy JWT wewnętrznego "receiver: server, broker". Broker po CC-197 zapisuje jako `authentication` tylko awarie infrastruktury (`jwks_unavailable`, `replay_store_unavailable`). Odrzucenie samego tokenu (`bad_signature`, `expired`, `replayed_jti`, ...) zapisuje jako zdarzenie operacji (`credential_resolve`, `connection_change`, ...) z `server` i wynikiem `denied`, a dla operacji bez własnego zdarzenia wcale.
- **Zmiana (proponowana):** albo (a) opis mówi wprost, że broker zapisuje odrzucenia tokenu jako zdarzenie operacji i `authentication` tylko dla awarii infrastruktury, albo (b) kontrakt wymaga `authentication` także dla odrzuceń i broker się dostosowuje (jedna reguła SIEM dla serwerów i brokera). Rekomendacja: (b), bo dwa kształty w jednej fazie rozbijają reguły; koszt: zmiana w `CallerAuthenticationFilter` i wektory `broker-authentication-*` dla kilku kodów.
- **Zgodność wstecz:** (a) opis, patch; (b) zmiana zdarzeń wdrożonego komponentu, nie schematu.
- **Kogo dotyka:** ws-06, ws-01 (reguły SIEM).
- **Rekomendacja:** wariant (b): zdarzenie `authentication` także dla odrzuceń tokenu przez broker, jedna reguła SIEM; zmiana w `CallerAuthenticationFilter` i wektorach `broker-authentication-*` po stronie ws-06.
- **Status:** accepted (decyzja: człowiek, 2026-11-03, wydanie 6.3.0) (wariant b, razem z CC-212); zgłosił: ws-06, 2026-11-03

## CC-212 | C8/wektory | Wektory `broker-authentication-*`: `decision` raz jest, raz go nie ma

- **Źródło:** przegląd ws-06 M6 etap 3 (pkt 8).
- **Stan:** `audit-events/broker-authentication-denied-replay-store-unavailable.json` ma `"decision": "deny"`, a `broker-authentication-jwks-unavailable.json` nie ma pola. Oba zdarzenia to ten sam kształt (`authentication`, `denied`, `upstream_unavailable`). Broker nie emituje `decision`; schemat dopuszcza oba warianty.
- **Zmiana (proponowana):** ujednolicić wektory (rekomendacja: bez `decision`, bo zdarzenie `authentication` jest odmową z definicji) albo dopisać w opisie, że `decision` jest opcjonalne dla `authentication`.
- **Zgodność wstecz:** wektor bez zmiany oczekiwanego werdyktu: patch.
- **Kogo dotyka:** ws-02 (starter emituje `decision`?), ws-06.
- **Rekomendacja:** ujednolicić wektory bez `decision`; zdarzenie `authentication` jest odmową z definicji. Zmianę zrobić razem z CC-211.
- **Status:** accepted (decyzja: człowiek, 2026-11-03, wydanie 6.3.0); zgłosił: ws-06, 2026-11-03

## CC-213 | C3/C4/C12 | Basic dla OpenSearch bez JWT i OIDC (`user-secret` z parą login i hasło, `service-account` Basic)

- **Źródło:** `research-full-servers.md` pkt 4.2, `servers-full.md` pkt 5, mcp-server-opensearch (strumień ws-04). Serwer przyjmuje dziś wyłącznie `token-exchange` z `Authorization: Bearer`; `CredentialTypeGuard` zatrzymuje start z innym zbiorem typów. Klaster OpenSearch bez skonfigurowanego JWT albo OIDC w pluginie Security (częsty przypadek u klienta: konta wewnętrzne i LDAP) nie przyjmie tokenu od brokera, więc serwer nie jest dla niego użyteczny.
- **Zmiana (proponowana):**
  1. Serwer OpenSearch dopuszcza drugi typ: `user-secret` ze schematem `Basic` (login i hasło użytkownika w OpenSearch). Wymaga formatu pary w C4 (`PutSecretRequest`: pole `username` albo `secretFormat: basic`, CC-049 i CC-114) i przechowania pary jako jednego sekretu w brokerze; nagłówek `X-MCP-Credential` ma już schemat `Basic`.
  2. Albo `service-account` ze schematem `Basic`/`ApiKey` dla klastra bez SSO (broker: `secret/data/mcp/service-accounts/opensearch`). Konto serwisowe zastępuje DLS/FLS użytkownika uprawnieniami konta, więc serwer jest wtedy główną granicą zakresu (jak servicedesk), a polityka musi nadać zakresy indeksów (`credential-type.cedar`).
  3. Typ domyślny (`context.credentialType`) to pierwszy element `accepted-credential-types`; zbiór nie miesza `service-account` z typami użytkownika (beta-7).
- **Co serwer zrobi po decyzji:** zmieni `CredentialTypeGuard` i `OpenSearchAdapter.credential()` (dziś odrzuca wszystko poza `token-exchange` Bearer), dopisze testy typu poświadczenia i fixture z odpowiedzią 401 dla Basic. Bez decyzji nie implementuje.
- **Zgodność wstecz:** nowe wartości w zbiorze typów serwera: minor po stronie kontraktów, jeśli format pary w C4 jest opcjonalny; zmiana `PutSecretRequest` jest zależna od CC-114 i wspólna z CC-222 (Jira, Confluence).
- **Kogo dotyka:** ws-04 (OpenSearch), ws-06 (broker: para jako sekret), ws-07/08 (formularz w portalu), ws-09 (`credential-type.cedar`, zakresy dla konta serwisowego), ws-10.
- **Rekomendacja:** przyjąć część 1 (`user-secret` Basic) po CC-222, który wprowadza format pary w C4; część 2 (`service-account` Basic/ApiKey) odłożyć do realnej potrzeby klienta, bo kontrakt `service-account` już istnieje (CC-157).
- **Poprawka w 6.3.1:** część 1 jest wykonalna z portalu dzięki `userSecretScheme` w C4 i C12 (patrz CC-222); OpenSearch na własnej instalacji jest objęty (`userSecretScheme: Basic`, `deployment: dc`).
- **Status:** accepted (decyzja: człowiek, 2026-11-03, wydanie 6.3.0) (tylko część 1: Basic jako `user-secret`, wspólny format pary z CC-222; część 2, Basic dla `service-account`, odłożona); zgłosił: ws-04, 2026-11-03

## CC-214 | C6/C7/Cedar | Typ zasobu `OpenSearch::Alias` dla `list_aliases` i `resolve_alias`

- **Źródło:** `research-full-servers.md` pkt 4.4 (faza 1: `list_aliases`, `resolve_alias` w zakresie), mcp-server-opensearch (strumień ws-04). Serwer celowo nie przyjmuje aliasów: alias o nazwie z zakresu może wskazywać indeksy innego zespołu, więc `QueryScope` je odrzuca, a narzędzia pracują na konkretnych nazwach indeksów.
- **Zmiana (proponowana):** nowa encja `OpenSearch::Alias` w `mcp.cedarschema` (atrybuty `name`, `scopes`, `targets: Set<String>` z nazwami indeksów docelowych; polityka odmawia, gdy którykolwiek cel jest poza zakresem), wpis w `resourceTypes` manifestu i w `PrincipalOrResource`. Wzorzec `OpenSearchAliasName` w `common.schema.json` (taki sam jak nazwa indeksu).
- **Co serwer zrobi po decyzji:** narzędzia `list_aliases` (strona, `PagedResult`) i `resolve_alias` (`@ResourceRef` na aliasie), oba `READ_ONLY`/`read`; odpowiedź zawiera tylko aliasy, których wszystkie cele są w zakresie wywołującego. Bez typu serwer nie wystawia aliasów w żadnej postaci.
- **Zgodność wstecz:** nowa encja i nowy typ zasobu w manifeście: nie zmienia istniejących polityk, ale zmienia bajty schematu Cedar i dodaje wartość `ResourceType`, więc według tabeli w `README.md` **major** (minor tylko jako wyjątek na decyzję człowieka).
- **Kogo dotyka:** ws-04, ws-09 (reguły `read` dla aliasów), ws-05 (resourceTypes w manifeście).
- **Rekomendacja:** przyjąć; `list_aliases` jest w zakresie fazy 1, a bez typu serwer nie wystawia aliasów. Wydać razem z CC-216 jako jedną zmianę bajtów schematu Cedar.
- **Status:** deferred (decyzja: człowiek, 2026-11-03; zgłosił: ws-04, 2026-11-03): nowy typ zasobu, major

## CC-215 | C3/C4/C6 | Poświadczenie sondy wersji (`CapabilityProbe`) dla systemu, którego endpoint wersji wymaga logowania

- **Źródło:** mcp-server-opensearch (ws-04), README startera, "Wersje systemu" ("serwer nie trzyma sekretów"). Klaster OpenSearch z wtyczką Security odpowiada 401 na anonimowe `GET /`, więc sonda nie pozna wersji i serwer pracuje w trybie `degraded` (narzędzia `list_indices`, `validate_query`, `get_cluster_health` odmawiają). Obejście dziś: właściwość `MCP_OPENSEARCH_ASSUME_TESTED_VERSION=true`, czyli oświadczenie operatora, bez sekretu. To samo dotyczy `/api/v4/version` w GitLabie.
- **Zmiana (proponowana):** broker wydaje serwerowi poświadczenie serwisowe tylko do odczytu wersji (typ `service-account`, zakres "tylko endpoint wersji", rotowane w OpenBao), a gateway albo broker przekazuje je sondzie bez udziału użytkownika. Wymaga decyzji, czy serwer może w ogóle trzymać sekret (dziś nie: niezmiennik C3) i jak sonda go odbiera.
- **Zgodność wstecz:** nowy kanał poświadczenia dla sondy: minor, jeśli opcjonalny.
- **Bez decyzji serwer działa:** `assume-tested-version` albo tryb `degraded`.
- **Kogo dotyka:** ws-02 (sonda), ws-04 (wszystkie serwery z endpointem wersji za logowaniem: OpenSearch, GitLab, Confluence), ws-06 (broker), ws-01.
- **Rekomendacja:** odłożyć. Serwer działa dziś w trybie `assume-tested-version` albo `degraded`, a zmiana wymaga decyzji o niezmienniku C3 (serwer nie trzyma sekretów). Ten sam problem zgłasza Confluence (`server-information` bywa za logowaniem).
- **Status:** deferred (decyzja: człowiek, 2026-11-03; zgłosił: ws-04, 2026-11-03): serwer zostaje przy `assume-tested-version` albo `degraded`

## CC-216 | C6/C7/Cedar | Typ zasobu `GitLab::MergeRequest` dla zatwierdzania i scalania

- **Źródło:** `research-full-servers.md` pkt 5.7 i 5.8 (zasób `GitLab::MergeRequest`, polityka dla `approve` i `merge`), decyzja W-8 (merge i approve to `UPDATE`), mcp-server-gitlab (strumień ws-04). `approve_merge_request` i `merge_merge_request` sprawdzają dziś tylko projekt (`GitLab::Project`), więc polityka nie odróżni scalenia do chronionej gałęzi od scalenia do gałęzi roboczej ani merge requesta cudzego autorstwa od własnego.
- **Zmiana (proponowana):** nowa encja `GitLab::MergeRequest` w `mcp.cedarschema` z rodzicem `GitLab::Project` i atrybutami `iid`, `targetBranch`, `targetBranchProtected: Bool`, `authorUsername`, `draft: Bool`; wpis w `resourceTypes` manifestu i w `PrincipalOrResource`; identyfikator `<ścieżka projektu>!<iid>` z wzorcem `GitLabMergeRequestRef` w `common.schema.json`. Opcjonalnie to samo dla `GitLab::Pipeline` (atrybut `ref`), jeśli polityka ma odróżniać ponowienie na gałęzi chronionej.
- **Co serwer zrobi po decyzji:** `@ResourceRef(type = "GitLab::MergeRequest")` na `approve_merge_request`, `merge_merge_request` i `update_merge_request` (obok projektu); resolver czyta merge request jednym `GET`, bierze atrybuty z odpowiedzi GitLaba, nigdy z argumentu, i potwierdza `project_id`. Bez typu narzędzia zostają na projekcie, a ograniczenia (chroniona gałąź, liczba zatwierdzeń) egzekwuje sam GitLab.
- **Zgodność wstecz:** nowa encja i nowy typ zasobu w manifeście: według tabeli w `README.md` **major** (nowa wartość `ResourceType`, zmiana bajtów schematu Cedar); dodanie drugiego `@ResourceRef` do istniejących narzędzi zmienia ich `definitionHash`.
- **Kogo dotyka:** ws-04, ws-09 (reguły dla scalania do chronionej gałęzi), ws-05 (resourceTypes w manifeście).
- **Rekomendacja:** przyjąć dla `GitLab::MergeRequest` (zatwierdzanie i scalanie do chronionej gałęzi to najwyższe ryzyko w serwerze GitLab); `GitLab::Pipeline` odłożyć.
- **Status:** deferred (decyzja: człowiek, 2026-11-03; zgłosił: ws-04, 2026-11-03): nowy typ zasobu, major

## CC-217 | C7/query-rendering/Java | Dodatkowe pola warunków JQL: `labels`, `component`, `fixVersion`, `priority`, `created`, `updated`, `issuetype`

- **Źródło:** `research-full-servers.md` pkt 1.4 (rozszerzyć `jql_filter` o labels, component, fixVersion, zakresy dat, priority), mcp-server-jira etap 3 M6 (ws-04). Listy normatywne JQL (CC-160) mają dziś warunki `text`, `status`, `assignee`, `summary` i `ORDER BY` `created`, `updated`, `priority`, `key`. `issuetype` serwer Jira stosuje po odpowiedzi systemu (strona bywa krótka), a pozostałych pól model nie może dziś użyć wcale.
- **Zmiana (proponowana):** do listy warunków JQL dochodzą `labels`, `component`, `fixVersion`, `priority`, `issuetype` (operatory `EQUALS`, `NOT_EQUALS`) oraz `created` i `updated` z operatorami `GREATER_OR_EQUAL` i `LESS_OR_EQUAL` (wartość: data `YYYY-MM-DD`, bez funkcji i bez względnych zapisów). Dotyka `StructuredQuery.JQL_CONDITION_FIELDS`, `Operator`, `scripts/lib/query-rendering.mjs` i wektorów `query-rendering/` (po jednym wektorze na pole i na wartość z cudzysłowem, nawiasem i słowem `OR`).
- **Zgodność wstecz (SemVer):** nowe wartości w liście normatywnej i w enum operatorów; serwery z mniejszym podzbiorem działają bez zmian. Według tabeli w `README.md` nowa wartość enum to **major**; sama lista pól i nowe wektory to minor.
- **Kogo dotyka:** ws-02 (starter), ws-04 (Jira), ws-09 (polityki: bez zmian).
- **Rekomendacja:** przyjąć w całości; `search_issues` filtruje wtedy po etykiecie, komponencie, wersji, priorytecie i dacie bez odfiltrowywania wierszy po stronie serwera. Bez decyzji Jira zostaje przy `status`, `assignee`, `summary`, `text` i typie zgłoszenia stosowanym po odpowiedzi.
- **Status:** deferred (decyzja: człowiek, 2026-11-03; zgłosił: ws-04 Jira, 2026-11-03): nowe pola, major

## CC-218 | C7/query-rendering/Java | Warunki CQL `ancestor` i `lastmodified`

- **Źródło:** mcp-server-confluence (ws-04), M6 (zebrane przez koordynatora w `plan-wydanie.md`, "Propozycje CC zebrane od serwerów"). `StructuredQuery` dla CQL nie ma dziś warunku po drzewie stron ani po dacie zmiany, więc `search_pages` nie zawęzi wyników do poddrzewa ani do ostatnio zmienionych stron.
- **Zmiana (proponowana):** do listy warunków CQL dochodzą `ancestor` (operator `EQUALS`, wartość: identyfikator strony, 1 do 18 cyfr) i `lastmodified` (`GREATER_OR_EQUAL`, `LESS_OR_EQUAL`, wartość: data `YYYY-MM-DD`). Dotyka listy w `StructuredQuery`, `scripts/lib/query-rendering.mjs` i wektorów `query-rendering/` (po jednym wektorze na pole i na wartość z cudzysłowem).
- **Zgodność wstecz (SemVer):** nowe wartości w liście normatywnej: jak CC-217, **major** według tabeli, jeśli trafiają do enum; w przeciwnym razie minor.
- **Kogo dotyka:** ws-00, ws-02, ws-04 (Confluence), ws-06 (bez zmian po stronie brokera; wpis zachowany z uwagi na zebraną listę dotkniętych).
- **Rekomendacja:** przyjąć razem z CC-217 (ta sama zmiana w rendererze i ten sam przebieg wektorów).
- **Status:** deferred (decyzja: człowiek, 2026-11-03; zgłosił: ws-04 Confluence, 2026-11-03): nowe pola, major

## CC-219 | C7/query-rendering | `type = page` w wyszukiwaniu CQL

- **Źródło:** mcp-server-confluence STATUS (ws-04), "Do zebrania przez koordynatora". `content/search` bez `type = page` zwraca też komentarze, załączniki i blogi, które serwer odrzuca po odpowiedzi, więc okna wyników są częściej puste. `type` nie jest polem warunku `StructuredQuery`. Resolver serwera już używa `id in (...) AND type = page` (`Cql.contentIn`).
- **Zmiana (proponowana), dwa warianty:** (a) pole `type` (operator `EQUALS`, wartość `page`) w liście normatywnej CQL; (b) stała klauzula `type = page` w rendererze CQL startera.
- **Zgodność wstecz (SemVer):** (a) nowa wartość w liście: jak CC-218; (b) zmienia oczekiwane wyjście wszystkich istniejących wektorów CQL, czyli **major** (zmiana oczekiwania w istniejącym wektorze).
- **Kogo dotyka:** ws-02 (starter), ws-04 (Confluence).
- **Rekomendacja:** wariant (a): serwer wskazuje typ jawnie, istniejące wektory zostają.
- **Uwaga (6.3.1):** serwer Confluence zostaje przy filtrowaniu typów po odpowiedzi jako obronie w głąb; stała klauzula zmniejsza tylko liczbę pustych okien.
- **Status:** accepted (decyzja: człowiek, 2026-11-03, wydanie 6.3.0) (wariant b: stała klauzula `type = page` w rendererze CQL; wyjątek SemVer, patrz CHANGELOG 6.3.0); zgłosił: ws-04 Confluence, 2026-11-03

## CC-220 | C7/entity-builder | Typy zasobów `Jira::Board` i `Jira::Sprint` (Jira Software, `/rest/agile/1.0`)

- **Źródło:** `research-full-servers.md` pkt 1.4 i 5.7 (tablice, sprinty, zapis do sprintu), mcp-server-jira etap 3 M6 (ws-04).
- **Zmiana (proponowana):** `ResourceType` dostaje `Jira::Board` i `Jira::Sprint` z atrybutem `project` (klucz projektu tablicy; tablica obejmująca kilka projektów: atrybuty każdego z nich albo odmowa). Wzorce identyfikatorów w `common.schema.json` (`JiraBoardId`, `JiraSprintId`: liczby całkowite jako tekst, 1 do 10 cyfr), schemat Cedar, `entity-builder.md`, wektory `resource-checks/` i `result-filter/`. Narzędzia, które wtedy powstają w serwerze Jira: `list_boards`, `list_sprints`, `get_sprint_issues` (odczyt) oraz `add_issues_to_sprint`, `move_issues_to_backlog` (`UPDATE`).
- **Zgodność wstecz (SemVer):** nowe wartości enum i definicje; zmienia bajty schematu Cedar (jak CC-173), więc paczka polityk wymaga przebudowy (ws-09). Według tabeli **major**.
- **Kogo dotyka:** ws-02, ws-04, ws-09, ws-05 (portal pokazuje typy zasobów).
- **Rekomendacja:** przyjąć; zakres odczytu (tablice, sprinty) jest potrzebny, zapis do sprintu można wdrożyć w serwerze później bez zmiany kontraktu. Do tej decyzji narzędzi agile nie ma w serwerze.
- **Status:** deferred (decyzja: człowiek, 2026-11-03; zgłosił: ws-04 Jira, 2026-11-03): nowe typy zasobów, major

## CC-221 | C6/C10 | Załączniki: treść binarna w wyniku narzędzia i wysyłanie plików

- **Źródło:** `research-full-servers.md` pkt 1.4 i 5.4 (`download_attachment`, `add_attachment`), mcp-server-jira etap 3 M6 (ws-04).
- **Stan:** serwer Jira ma `list_attachments` (same metadane). Pobranie treści wymaga, żeby kontrakt wyniku narzędzia dopuszczał treść `text` albo `image` z limitem rozmiaru (propozycja: `maxResultBytes` z CC-209) oraz typu zasobu `Jira::Attachment` z atrybutem `project`. Wysyłanie (`add_attachment`) wymaga base64 w argumencie (limit schematu argumentów kilkaset KB) albo odrzucenia.
- **Zmiana (proponowana):** `ResourceType` `Jira::Attachment` (wzorzec `JiraAttachmentId`: 1 do 18 cyfr), reguła README dla treści `text`/`image` w wyniku (tylko `text/*` i `image/*`, do 2 MB, reszta jako metadane), decyzja, czy `add_attachment` istnieje.
- **Zgodność wstecz (SemVer):** nowy typ zasobu i definicje; zmienia bajty schematu Cedar: **major** według tabeli.
- **Kogo dotyka:** ws-02, ws-04 (Jira, Confluence), ws-09, ws-13 (adapter).
- **Rekomendacja:** odłożyć. Treść binarna w wyniku zmienia model wyniku (rozmiar, oznaczenie `UntrustedText`, obrazy) i zależy od CC-209; sensownie rozstrzygnąć po decyzji o `maxResultBytes`. Metadane zostają.
- **Status:** deferred (decyzja: człowiek, 2026-11-03; zgłosił: ws-04 Jira, 2026-11-03): bez zmiany modelu wyniku w tym wydaniu

## CC-222 | C3/C4/C12 | `Basic` w `user-secret` (Jira i Confluence Cloud) i atrybut `deployment` systemu

- **Źródło:** `research-full-servers.md` pkt 1.2 i 5.1 (Cloud: `Basic email:token`), decyzja W-7 (Cloud później), mcp-server-jira (ws-04) oraz mcp-server-confluence (ws-04); ta sama propozycja zgłoszona przez oba serwery, połączona. Dotyczy też portalu (`mcp-portal/web`: `PutSecretRequest` nie ma formatu pary) i jest warunkiem CC-213 (OpenSearch).
- **Stan:** serwery Jira i Confluence przyjmują wyłącznie `user-secret` z `Bearer` (PAT Data Center); sonda oznacza `deploymentType: Cloud` jako `degraded` (odczyty tylko). Cloud wymaga: pary `email` + token w brokerze jako jednego sekretu, whoami `GET /rest/api/2/myself` (Jira), bazy URL z `cloudId` dla tokenów z zakresami, atrybutu `deployment` (`dc`, `cloud`) w `GET /v1/systems` brokera; po stronie serwerów wyszukiwanie `POST /rest/api/3/search/jql` (kursor `nextPageToken`, bez `total`) i tekst w ADF.
- **Zmiana (proponowana):** (1) przyjęcie `Basic` w `X-MCP-Credential-Type: user-secret` dla `jira` i `confluence`; (2) format pary w C4 (`PutSecretRequest`: pole `username` albo `secretFormat: basic`, CC-049 i CC-114); (3) opcjonalny atrybut `deployment` w C4.1; (4) zmienne konfiguracji serwera `deployment` i `cloudId` (poza kontraktem).
- **Zgodność wstecz (SemVer):** nowe wartości i opcjonalne pola: minor.
- **Kogo dotyka:** ws-03/ws-06 (broker), ws-04 (Jira, Confluence, OpenSearch), ws-05/ws-07/ws-08 (portal: formularz pary), ws-00, ws-02.
- **Rekomendacja:** przyjąć warstwę kontraktową (pkt 1 do 3) w tym wydaniu, bo CC-213 potrzebuje tego samego formatu pary; obsługa Cloud w serwerach zostaje poza zakresem do decyzji W-7.
- **Poprawka w 6.3.1 (przegląd 6.3.0, W4, W5):** decyzję, kiedy portal pyta o login, niesie `SystemInfo.userSecretScheme` (`Bearer` albo `Basic`) i to samo pole w C12 `CatalogCredential`, a nie `deployment` (OpenSearch klienta to `dc` i też `Basic`). `username` jest `writeOnly`, nigdy nie jest logowany ani zwracany, a wzorzec odrzuca też C1, bidi i zero-width. Bez `username` dla systemu `Basic` i z `username` dla systemu `Bearer` to `400 invalid_request`. Przykład `resolve` ze schematem `Basic` dla `user-secret`.
- **Poprawka w 6.3.2 (N2, N3):** wzorzec `username` ze zbioru CC-121; przykłady z `userSecretScheme`, `deployment` i `username`.
- **Status:** accepted (decyzja: człowiek, 2026-11-03, wydanie 6.3.0) (tylko warstwa kontraktu: Basic jako `user-secret`, format pary w C4, `deployment` dc/cloud; obsługa Cloud w serwerach odłożona, W-7); zgłosił: ws-04, 2026-11-03

## CC-223 | C5/C10/README | Limit otwartych strumieni na instancję gatewaya i `503`

- **Źródło:** mcp-gateway STATUS (ws-05), M6 etap 3, sekcja "Decyzje i granice tego etapu"; zebrane w `plan-wydanie.md`.
- **Stan:** gateway wdrożył limit: `MCP_MAX_OPEN_STREAMS` (domyślnie 2000 na instancję, strumień `GET` sesji i `subscriptions/listen` razem, bez limitu na użytkownika). Powyżej limitu odpowiada `503` z `Retry-After` (`MCP_SHED_RETRY_AFTER_SECONDS`) i tym samym ciałem co przeciążenie z CC-199 (`upstream_unavailable`), metryka `mcp_gateway_streams_refused_total`. Otwarcie strumienia przechodzi przez limity użytkownika i klienta (CC-135). Testy: `StreamLimitTest`, `ToolStreamsTest`.
- **Zmiana (proponowana):** README i C5/C10 opisują limit otwartych strumieni na instancję (konfigurowalny, domyślnie 2000, oba rodzaje razem), odpowiedź `503` jak shed z CC-199, otwarcie strumienia jako zwykłe żądanie dla limitów użytkownika i klienta; wektor w `gateway-authentication/` dla odmowy strumienia. Nazwa metryki do potwierdzenia.
- **Zgodność wstecz (SemVer):** opis i nowy wektor, bez zmiany schematów i enum: minor.
- **Kogo dotyka:** ws-05 (zgodność z opisem), ws-01 (konfiguracja, alert na `mcp_gateway_streams_refused_total`), ws-10 (scenariusz przekroczenia limitu).
- **Rekomendacja:** decyzja człowieka 2026-11-03, do wydania.
- **Status:** accepted (decyzja: człowiek, 2026-11-03, wydanie 6.3.0) (limit strumieni); zgłosił: ws-05, 2026-11-03

## CC-224 | C5/C10 | `503 upstream_unavailable` z `Retry-After` dla katalogu przy nieczytelnych wyłącznikach

- **Źródło:** mcp-gateway STATUS (ws-05), M6 etap 3: "to moja decyzja, do potwierdzenia".
- **Stan:** kontrakt opisuje `503` dla operacji wyłączników (CC-194), ale nie dla odczytu katalogu. Gateway przy nieczytelnym stanie wyłączników odpowiada na katalog `503 upstream_unavailable` z `Retry-After`, zgodnie z regułą fail-closed.
- **Zmiana (proponowana):** dopisać odpowiedź `503` (`upstream_unavailable`, `Retry-After`) do operacji katalogu w `gateway-admin` C5 i zdanie w README o stanie wyłączników; wektor `kill-switch/` dla katalogu.
- **Zgodność wstecz (SemVer):** nowa odpowiedź w kontrakcie opisującym zachowanie, które już istnieje: minor.
- **Kogo dotyka:** ws-05, ws-07 (BFF mapuje `503` katalogu), ws-08.
- **Rekomendacja:** przyjąć; odpowiedź jest zgodna z CC-194 i CC-199, a alternatywa (pusty katalog) ukrywałaby wyłączone narzędzia.
- **Uzupełnienie w 6.3.1:** zdanie w README i wektor `kill-switch/store-unreadable-catalog`.
- **Status:** accepted (decyzja: człowiek, 2026-11-03, wydanie 6.3.0); zgłosił: ws-05, 2026-11-03

## CC-225 | C5/README | `tools/list` z `cursor: null`

- **Źródło:** mcp-gateway STATUS (ws-05), M6 etap 3; pokrewne CC-200 (`cursor: ""`).
- **Stan:** `cursor: null` jest odrzucany jak każdy kursor niebędący napisem (`-32602`); kontrakt tego nie rozstrzyga.
- **Zmiana (proponowana):** dopisać do opisu `tools/list` w C5/README, że `cursor` niebędący napisem, w tym `null`, to `-32602`; wektor `mcp-endpoint/` dla `cursor: null`.
- **Zgodność wstecz (SemVer):** doprecyzowanie opisu: patch; nowy wektor: minor.
- **Kogo dotyka:** ws-05, ws-02 (starter odpowiada tak samo?), ws-10.
- **Rekomendacja:** przyjąć (zgodnie z CC-200).
- **Status:** accepted (decyzja: człowiek, 2026-11-03, wydanie 6.3.0); zgłosił: ws-05, 2026-11-03

## CC-226 | C2/Java | Klasyfikacja administratora w wewnętrznym JWT dla sidecara adaptera

- **Źródło:** mcp-server-adapter STATUS i README, "Ryzyko lokalne a klasyfikacja administratora" (ws-13): "Docelowo lepiej, by gateway przekazywał klasyfikację z rejestru w JWT, a starter jej używał; to zmiana kontraktu, poza M6".
- **Stan:** starter wymaga ryzyka każdego narzędzia, a adapter go nie zna, więc podstawia ryzyko zastępcze z podpowiedzi obcego serwera. Lokalna kontrola Cedar `call` w sidecarze może odmówić użytkownikom, których gateway przepuścił (klasyfikacja administratora niższa niż ryzyko zastępcze).
- **Zmiana (proponowana):** opcjonalne claimy `risk` i `action` w wariancie użytkownika wewnętrznego JWT, ustawiane przez gateway z klasyfikacji w rejestrze tylko dla wpisów `source: adapter`; starter w sidecarze używa ich zamiast ryzyka zastępczego; claimy podpisane razem z tokenem, więc nie rozszerzają zaufania. Opis w `internal-jwt.schema.json` i wektory `jwt/`.
- **Zgodność wstecz (SemVer):** nowe opcjonalne claimy: minor.
- **Kogo dotyka:** ws-05 (gateway), ws-02 (starter), ws-13 (adapter), ws-09 (grupy Cedar po stronie sidecara).
- **Rekomendacja:** przyjąć w wydaniu po przeglądzie bezpieczeństwa wariantu użytkownika (nowy claim w tokenie); nie blokuje reszty pakietu, a obecna druga bariera działa.
- **Poprawka w 6.3.1 (przegląd 6.3.0, W1, W7):** 6.3.0 dodało `rsk` i `act` do wspólnego wariantu użytkownika, więc każdy odbiorca przyjmowałby claim, a `act` koliduje z RFC 8693. W 6.3.1 claimy nazywają się `mcp_risk` i `mcp_action`, mają osobny wariant schematu `AdapterUserClaims` (para zgodna, tylko z `tool`), a reguła odbiorcy mówi, że tylko sidecar adaptera je przyjmuje; serwer natywny i broker odrzucają token jako `invalid_claims`. Wektory: `jwt/valid-adapter-classification`, `classification-at-native-server`, `classification-at-broker`, `classification-pair-does-not-fit`, `idp-token-claims/with-classification-claims`. Zmiana nazw i zawężenie względem 6.3.0 to wyjątek SemVer (6.3.0 nie był wypchnięty ani wdrożony).
- **Uwaga dla sidecara:** po CC-226 i CC-227 lokalna druga bariera spada do klasyfikacji administratora; sidecar powinien logować i liczyć przypadki, w których `mcp_risk` jest niższe niż ryzyko z podpowiedzi obcego serwera.
- **Poprawka w 6.3.2 (N4):** sidecar bez `mcp_risk` i `mcp_action` przy `tools/call` odmawia (`classification_missing`); `receiverMode` opisany w formacie wektorów.
- **Status:** accepted (decyzja: człowiek, 2026-11-03, wydanie 6.3.0; po przeglądzie bezpieczeństwa 2026-11-03 ograniczone do sidecara adaptera i przemianowane w 6.3.1); zgłosił: ws-13, 2026-11-03

## CC-227 | C5/C10/README | Adapter tylko do odczytu: `approve` klasyfikuje wpis adaptera wyłącznie jako `READ_ONLY`

- **Źródło:** decyzja człowieka 2026-11-03 (`plan-wydanie.md`, "Decyzje o pakiecie CC-210..226"). Narzędzia obcego serwera nie mają `resourceRefs`, więc gateway nie ma zakresu zasobów, względem którego oceni zapis; `UPDATE` i `DESTRUCTIVE` byłyby decyzją bez zakresu.
- **Zmiana:** `approveTool` dla wpisu `source: adapter` odpowiada `422 manifest_rejected` z `reason: classification_not_allowed`, gdy `risk` jest inne niż `READ_ONLY` (po sprawdzeniu `classification_required` i `classification_inconsistent`). Zasada obowiązuje, dopóki kontrakt nie da adapterowi zakresu zasobów. Wektory `registry-approval/`: `adapter-with-classification` (teraz `READ_ONLY`, `read`), `adapter-update-refused`, `adapter-destructive-refused`; `adapter-update-with-admin` zmienia wynik na `classification_not_allowed`.
- **Zgodność wstecz (SemVer):** zaostrzenie walidacji kanału adaptera: według tabeli major. Wyjątek zatwierdzony przez człowieka (2026-11-03, wzór 5.1.0 i 6.2.0), bo kanał adaptera (CC-206) nie jest wdrożony.
- **Kogo dotyka:** ws-05 (gateway), ws-07/ws-08 (portal: dialog klasyfikacji oferuje tylko odczyt dla adaptera), ws-13 (adapter), ws-10.
- **Rekomendacja:** przyjąć.
- **Poprawka w 6.3.1 (przegląd 6.3.0, W6):** uzasadnienie wyjątku: kanał adaptera jest w gatewayu od 6.2.0, ale nie działa na żadnym stosie z użytkownikami. Klasyfikacja `UPDATE` albo `DESTRUCTIVE` zapisana wcześniej traci ważność: wpis jest jak niesklasyfikowany (ukryty, `tool_disabled`) do ponownego `approve` jako `READ_ONLY` (wektor `registry-approval/stored-update-classification-is-hidden`). Opisy `ApproveRequest.risk` i `approveAdminTool` uzupełnione.
- **Poprawka w 6.3.2 (N1):** unieważniony wpis wraca do `pending_approval` z podłogą; ponowne `approve` jako `READ_ONLY` wymaga `acceptRiskLowering` i świeżego MFA, bez wyjątku. Wektory `registry-approval/adapter-invalidated-*`.
- **Status:** accepted (decyzja: człowiek, 2026-11-03, wydanie 6.3.0, wyjątek SemVer)

## CC-228 | C5/README | `list_changed` po zmianie paczki polityk bez gwarancji 5 s

- **Źródło:** decyzja człowieka 2026-11-03; CC-192 obiecuje powiadomienie najwyżej 5 s po zdarzeniu "także przy wielu instancjach", a zmiana paczki polityk nie jest zdarzeniem, które gateway dostaje od razu na wszystkich instancjach.
- **Zmiana:** README (C5, `list_changed`): zdarzenia rejestru i wyłączników zachowują granicę 5 s; po zmianie paczki polityk instancja wysyła `list_changed` po tym, jak sama załaduje nową paczkę, bez gwarancji 5 s (zależy od jej odpytywania paczki). `tools/list` jest zawsze liczone z paczki załadowanej na odpowiadającej instancji, więc utrata albo opóźnienie powiadomienia nie osłabia bezpieczeństwa.
- **Zgodność wstecz (SemVer):** doprecyzowanie opisu: patch.
- **Kogo dotyka:** ws-05, ws-10 (scenariusz zmiany paczki: nie zakładać 5 s).
- **Rekomendacja:** przyjąć.
- **Uwaga uczciwa (6.3.1):** to osłabienie obietnicy 5 s z 6.0.0 i 6.2.0, na której mógł się opierać ws-10; opisane w CHANGELOG, nie tylko jako doprecyzowanie.
- **Status:** accepted (decyzja: człowiek, 2026-11-03, wydanie 6.3.0)

## CC-229 | C5/C6/C12 | Identyfikatory systemu, serwera, narzędzia i typu zasobu jako wzorce

- **Źródło:** decyzja właściciela platformy z 2026-11-06 ("dynamic servers", specyfikacja `dynamic-servers-spec.md`): żadna lista systemów, serwerów i typów zasobów w komponentach.
- **Stan:** `SystemId`, `ServerId` i `ResourceType` w `schemas/common.schema.json` były wyliczeniami pięciu systemów, `QualifiedToolName` miał ich listę we wzorcu, `ScopeResourceType` i dziesięć definicji wzorców identyfikatorów z `ResourceIdPatterns` opisywało po jednym systemie; filtr `/mcp` ograniczał `systems` do 5 wpisów (liczba dawnych systemów).
- **Zmiana:** `SystemId` `^[a-z][a-z0-9]{1,30}$`, `ServerId` `^mcp-<SystemId>$`, `QualifiedToolName` `^<system>__<tool>`, `ResourceType` `^[A-Z][A-Za-z0-9]{0,30}::[A-Z][A-Za-z0-9]{0,30}$`; nowa `ResourceScopeId`; usunięte `ScopeResourceType`, definicje wzorców i `ResourceIdPatterns` (wzorce są w `resourceTypes[].idPattern` manifestu, a ich dotychczasowa treść w `cedar/examples/systems/*/resource-types.json`); cztery typy poświadczeń zostają wyliczeniem; `MAX_SYSTEMS` filtra z 5 na 20 (potwierdzone przez koordynatora, 2026-11-06).
- **Zgodność wstecz (SemVer):** usunięcie definicji i zaostrzenie walidacji (`ServerId` bez `mcp-` i bez wielkich liter): major.
- **Kogo dotyka:** wszystkie składniki (generowane typy, `@ArgumentLimits(contractPattern)` startera), mock MSW (zamiast listy systemów sprawdza wzorzec `SystemId`).
- **Rekomendacja:** przyjąć.
- **Status:** accepted (decyzja: człowiek, 2026-11-06, wydanie 7.0.0)

## CC-230 | C7 | Schemat bazowy Cedar bez systemów

- **Źródło:** decyzja z 2026-11-06 (patrz CC-229).
- **Stan:** `mcp.cedarschema` zawierał przestrzenie pięciu systemów, rekordy `Scopes` i `Refs` z polami po jednym na typ i akcje `read`, `update`, `delete`, `admin` z listą typów zasobów.
- **Zmiana:** pusta przestrzeń: `ResourceScope`, `UserGroup`, `User { username, client, mfaAge?, scopes: Set<ResourceScope> }`, `Tool { server, name, risk, requiredGroup: UserGroup }`, `RequestContext { client, mfaAge?, credentialType?, refs?: Set<ResourceScope> }`, akcja `call`. `Tool.requiredGroup` to `mcp-<system>-read`, `-write` albo `-destructive` według ryzyka (konwencja C9, jedyne miejsce wyprowadzenia nazwy grupy); `User.scopes` to wszystkie zakresy zmapowanych grup (dokładne id); `context.refs` to id argumentów typów `earlyScopeCheck`, zawsze obecne na gatewayu. Akcje serwera i typy zasobów deklaruje fragment serwera w jego przestrzeni (CC-232).
- **Zgodność wstecz (SemVer):** zmiana schematu, po której istniejące polityki i encje nie przechodzą walidacji: major.
- **Kogo dotyka:** gateway, starter, serwery, `mcp-policies` (przestaje być potrzebne).
- **Rekomendacja:** przyjąć.
- **Status:** accepted (decyzja: człowiek, 2026-11-06, wydanie 7.0.0)

## CC-231 | C7 | Polityki platformy i klienci AI poza Cedar

- **Źródło:** decyzja z 2026-11-06.
- **Zmiana:** `cedar/platform/call-by-group.cedar` (`platform-call-by-group`: `permit`, gdy `principal in resource.requiredGroup`) i `call-write-outside-scope.cedar` (`platform-call-write-outside-scope`: `forbid`, gdy `risk != "READ_ONLY"`, jest `context.refs` i `principal.scopes` ich nie zawiera). Gateway decyduje o `call` na `Tool` wyłącznie nimi i nadpisaniami administratora. Lista dozwolonych klientów (`azp`, domyślnie `claude-code,claude-ai`, `MCP_ALLOWED_CLIENTS`) jest sprawdzana w kodzie przed Cedar przez gateway i starter (ten ostatni z danych polityki), nie polityką.
- **Zgodność wstecz (SemVer):** polityki przechodzą z paczki do jara kontraktów: major (część CC-230).
- **Kogo dotyka:** gateway, starter.
- **Rekomendacja:** przyjąć.
- **Status:** accepted (decyzja: człowiek, 2026-11-06, wydanie 7.0.0)

## CC-232 | C6/C7 | Fragment serwera, deklaracje typów i `policiesHash` w manifeście

- **Źródło:** decyzja z 2026-11-06 (zasady 2 i 4: polityki serwera leżą przy jego kodzie, są częścią manifestu i skrótu, który porównuje gateway).
- **Zmiana:** `resourceTypes[]`: `type`, `attributes`, `idPattern` wymagane; `parent` z `parentAttribute`, `scopePattern`, `earlyScopeCheck`, `classification {attribute, kind, required}`. Człon `policies {namespace, schema, files[{name, text}]}` i `policiesHash` (RFC 8785 + SHA-256 obiektu `{"policies": ..., "resourceTypes": ...}`) wymagane poza manifestem adaptera; w manifeście adaptera zakazane, tak samo jak `resourceTypes`. Reguły: `resource-types-valid`, `resource-types-namespace`, `policies-files-sorted-unique`, `policies-hash-matches`. Walidacja fragmentu (`PolicyFragments.validateFragment`, starter w buildzie i przy starcie, gateway przy rejestracji): złożenie ze schematem bazowym w trybie strict; dokładnie jedna przestrzeń; `scopes: Set<ResourceScope>` na każdym typie; akcje tylko `read`, `update`, `delete`, `admin`; polityki z unikalnym `@id`, bez szablonów, bez `Action::"call"` i `Tool`, bez ostrzeżeń "impossible"; typy encji fragmentu równe zadeklarowanym. Zmiana `policiesHash` wdrożonego serwera to `pending_approval` jego narzędzi do zatwierdzenia przez administratora.
- **Sprawdzone w teście (zlecenie):** cedar-java 4.10.0 rozwiązuje typy bazowe z pustej przestrzeni bez kwalifikacji w przestrzeni serwera i przyjmuje akcje tej przestrzeni; kwalifikacja nie jest potrzebna. Sam fragment (bez bazy) nie daje się sparsować do JSON, więc reguły czytamy ze złożenia.
- **Odstępstwa od specyfikacji (potwierdzone przez koordynatora, 2026-11-06):** (1) `policiesHash` pokrywa także `resourceTypes`, bo `earlyScopeCheck`, `idPattern`, `scopePattern` i `classification` osłabiają albo wzmacniają kontrole: zmiana deklaracji wymaga zatwierdzenia jak zmiana polityki. (2) Pliki w `policies.files` muszą być uporządkowane po nazwie, żeby skrót nie zależał od budowy. (3) Manifest adaptera nie ma `policies` ani `resourceTypes`.
- **Zgodność wstecz (SemVer):** wymagane nowe pola, zaostrzona walidacja: major.
- **Kogo dotyka:** starter (generacja manifestu), gateway (rejestracja, zatwierdzenie), serwery.
- **Rekomendacja:** przyjąć.
- **Status:** accepted (decyzja: człowiek, 2026-11-06, wydanie 7.0.0)

## CC-233 | C7/Java | Entity builder sterowany deklaracjami

- **Źródło:** decyzja z 2026-11-06.
- **Zmiana:** `EntityBuilder(ResourceTypes, ScopeMapping)`; `ResourceTypes`, `ResourceTypeDeclaration`, `Scopes`, `PolicyFragments`; `ScopeMapping.of`, `ofRegistered`, `fromJson`; `ResolvedResource.scopes`; zasób serwera ma `<Przestrzeń>::Action::"<action>"`, `scopes` od resolvera sprawdzone względem `scopePattern`, tylko zadeklarowane atrybuty, rodzica zadeklarowanego typu; klasyfikacja zadeklarowanego atrybutu normalizowana jak dotąd (CC-067). Wyprowadzenia specyficzne dla systemu (prefiksy ścieżek GitLaba, prefiksy po myślnikach OpenSearch, przodkowie stron Confluence, dziedziczona klasyfikacja GitLaba) przechodzą do resolvera serwera; starter daje pomocniki. Usunięte `ResourceIds`, `ResourceScopes`, `ScopeGroups`. `cedar/entity-builder.md` i wektory przepisane wokół fragmentów (Jira jako wzór z rodzicem i klasyfikacją, neutralny `Notes`).
- **Zgodność wstecz (SemVer):** zmiana API biblioteki i oczekiwań wektorów: major.
- **Kogo dotyka:** gateway, starter, serwery (resolvery), mcp-e2e.
- **Rekomendacja:** przyjąć.
- **Status:** accepted (decyzja: człowiek, 2026-11-06, wydanie 7.0.0)

## CC-234 | C5/C7/C12 | Dane polityki, administracja serwerami, mapowaniem zakresów i nadpisaniami

- **Źródło:** decyzja z 2026-11-06 (zasada 5: mapowanie i nadpisania to dane administratora serwowane serwerom po mTLS, bez podpisanych paczek).
- **Zmiana:** C5: `GET /internal/v1/policy-data` (CN certyfikatu = `serverId` zarejestrowanego serwera, `ETag`/`If-None-Match`; `{revision, scopeMapping, allowedClients, overrides}`), `GET`/`POST /admin/v1/servers`, `GET`/`PATCH`/`DELETE /admin/v1/servers/{serverId}`, `GET`/`PUT /admin/v1/policy/scope-mapping` (cały dokument, `If-Match`), `GET /admin/v1/policy/overrides` i `GET`/`PUT`/`DELETE .../overrides/{id}` (jedna polityka `forbid`, cel `gateway`, `all-servers` albo `serverId`, walidacja względem schematu bazowego i fragmentu celu), zatwierdzenie `policiesHash` (`GET .../policies/pending`, `POST .../policies/approve`) obok zatwierdzania narzędzi. `prv` w wewnętrznym JWT to rewizja danych polityki. C12: odpowiedniki pod `/api/v1/admin/...`.
- **Odstępstwa od specyfikacji (potwierdzone przez koordynatora, 2026-11-06):** dodane `GET /admin/v1/policy/overrides` (lista) i `GET .../policies/pending` (różnica do przeglądu); `PUT` nadpisania ma id w ścieżce, które staje się id polityki; ETag dokumentu mapowania jest nieprzezroczysty, a `ETag` danych polityki to cytowana rewizja.
- **Zgodność wstecz (SemVer):** nowe operacje: minor; razem z resztą wydania: major.
- **Kogo dotyka:** gateway, starter (pobieranie danych), portal, mcp-e2e.
- **Rekomendacja:** przyjąć.
- **Status:** accepted (decyzja: człowiek, 2026-11-06, wydanie 7.0.0)

## CC-235 | C4/C12 | Administracja systemami brokera

- **Źródło:** decyzja z 2026-11-06.
- **Zmiana:** C4: `GET /v1/admin/systems`, `PUT`/`DELETE /v1/admin/systems/{system}`: `baseUrl`, `adapter` (`atlassian-dc`, `gitlab`, `opensearch`, `generic-rest`), `supportedTypes`, `defaultType`, `secretScheme`, klient OAuth (`clientSecret` tylko do zapisu, widok niesie `clientSecretSet`). Ta sama autoryzacja co C5: certyfikat BFF i token administratora. `GET /v1/systems` bez zmian. C12: `/api/v1/admin/systems`.
- **Zgodność wstecz (SemVer):** nowe operacje: minor; razem z resztą wydania: major.
- **Kogo dotyka:** broker, portal.
- **Rekomendacja:** przyjąć.
- **Status:** accepted (decyzja: człowiek, 2026-11-06, wydanie 7.0.0)

## CC-236 | C7 | Koniec podpisanych paczek polityk

- **Źródło:** decyzja z 2026-11-06 (zasada 5: bez podpisanych paczek, serwera polityk, kluczy Ed25519 polityk i ustawień `MCP_POLICY_*`).
- **Zmiana:** usunięte moduł `mcp-policy-bundle` (odbiornik, `PolicyStore`, `PolicyLintCli`), schematy `policy-bundle-latest` i `policy-bundle-manifest`, wektory `bundles/`, `policy-store/` i `servicedesk-service-account/` (reguła kolejek konta serwisowego jest politykami serwera, wektory `policy-decisions/srv-notes-*`), klucze testowe `test-policy-bundle`, `test-policy-overrides`, `dev-policy-bundle.pub.pem`. Wykrywanie polityk "impossible" z `PolicyLint` przeszło do `PolicyFragments`. Jeśli kiedyś wróci podpisana dystrybucja polityk, wróci jako nowy CC.
- **Zgodność wstecz (SemVer):** usunięcie artefaktu, schematów i wektorów: major.
- **Kogo dotyka:** gateway, starter, mcp-policies.
- **Rekomendacja:** przyjąć.
- **Status:** accepted (decyzja: człowiek, 2026-11-06, wydanie 7.0.0)

## CC-237 | C5/C6/C7 | Poprawki po przeglądzie bezpieczeństwa 7.0.0 (A1 ... A12)

- **Źródło:** przegląd bezpieczeństwa commitów 7.0.0 bez kontekstu (sondy `Probe.java` i `Redos.java`) i decyzje koordynatora z 2026-11-06. Wydanie 7.0.0 nie było opublikowane, więc poprawki wchodzą do niego.
- **A1 (wysokie):** `serverId` mógł się równać CN certyfikatu komponentu (`mcp-gateway`, `mcp-offboarding`). Zarezerwowane `SystemId`: `gateway`, `offboarding`, `portal`, `broker`, `prometheus`, `platform`, `admin`, `registry`, `adapter`, `internal`, `ci`: negatywny lookahead we wzorcach `SystemId`, `ServerId` i `QualifiedToolName`, stała `ReservedSystemIds` (mcp-manifest) i reguła manifestu `system-not-reserved`; `createServer` odpowiada `422 server_rejected`, powód `system_reserved`.
- **A2 (wysokie):** nic nie wiązało polityk oceniających serwer z zatwierdzonym skrótem. `PolicyData.approvedPoliciesHash` (dla żądającego serwera; brak, dopóki nic nie zatwierdzono). Reguła wiążąca starter: liczy skrót własnych polityk i `resourceTypes` i odmawia każdego wywołania (`upstream_unavailable`), gdy się różni albo go brak; nigdy nie przyjmuje rewizji niższej lub równej; przy nowszym `prv` odświeża przed oceną albo odmawia; nadpisanie niewalidujące się względem złożonego schematu oznacza odmowę wszystkiego. `PolicyDataGate` i `scripts/lib/policy-data-gate.mjs`, wektory `policy-data-gate/` (10). Poprawiony tekst `approveServerPolicies`.
- **A3 (średnie):** cel `gateway` nadpisania musi być `action == Action::"call"` na `resource is Tool`; cel `serverId` waliduje się względem bazy i fragmentu tego serwera, `all-servers` względem fragmentu każdego serwera (`validateOverride(id, text, OverrideTarget, fragmentSchemas)`), oba bez `Tool` i `call`. `validateFragment` wymaga `principal: [User]` i `context: RequestContext` w każdej akcji. Poprawione przykłady, które niczego nie blokowały.
- **A4 (średnie):** id nadpisania `override-<nazwa>`; polityki serwera i platformy nie używają prefiksów `override-` i `platform-`; `PolicyFragments.merge` odrzuca zdublowane id (odmowa, nie scalenie).
- **A5 (średnie):** `PendingPolicies` pokazuje też zatwierdzone i oczekujące `resourceTypes` (C5 i C12).
- **A6 (średnie):** `ResourceTypes.union` odrzuca dwa rejestry z jedną przestrzenią (`namespace_conflict`); przestrzeń należy do pierwszego `serverId`; `deleteServer` usuwa z mapowania wpisy typów jego przestrzeni (audyt zawiera ich listę).
- **A7 (średnie):** `ScopeMapping.ofRegistered` i `fromJson(..., true)` pomijają nieważne zakresy osobno i zgłaszają je w `ignored()`; `of` zostaje ścisłe dla zapisu administratora. `approveServerPolicies` odpowiada `200` z listą wpisów, które zatwierdzenie unieważnia (`ignoredMappingEntries`) zamiast `204`.
- **A8 (średnie):** gramatyka `idPattern` i `scopePattern`: do 512 znaków, bez odwołań wstecznych i lookaround, bez kwantyfikatora na grupie z kwantyfikatorem, alternatywy grupy z kwantyfikatorem zaczynają się od rozłącznych znaków; identyfikator dłuższy niż 1024 znaki jest nieważny przed dopasowaniem. Reguła `resource-types-valid`, `PatternGrammar`, `ResourceTypes`. Wzorce GitLaba i folderów Notes przepisane; wzorzec GitLaba nie wyraża już limitu 20 poziomów ani zakazu `.git`/`.atom` (sprawdza je serwer).
- **A9 (średnie):** `PlatformServerPolicies` generuje z deklaracji `platform-*` polityki serwerowe (zakaz `restricted` także łańcuchem rodziców; zakaz konta serwisowego poza zakresem); Jira i Notes nie mają już własnych takich reguł. Wektory `policy-decisions/srv-*` wskazują id `platform-*`.
- **A10 (niskie):** `platform-call-write-without-refs`: zapis bez `refs` w kontekście to odmowa. Cedar nie przyjmuje `!(context has refs) || ...` w jednej polityce, więc to osobna polityka.
- **A11 (niskie/średnie):** `If-Match` (zapis i usuwanie nadpisania, `updateServer`, `putAdminSystem`; tworzenie przez `If-None-Match: *`), `ETag` na odczytach (nowa operacja `getAdminSystem`), wymuszenie świeżego MFA w BFF dla `approveAdminServerPolicies`, `putAdminScopeMapping`, `deleteAdminOverride`, `createAdminServer`, `updateAdminServer`, `putAdminSystem`; broker: `clientSecret` trzeba podać ponownie przy zmianie `baseUrl`, `authorizeUrl`, `tokenUrl` albo `clientId` (`client_secret_required`).
- **A12 (niskie):** dane polityki z mapowaniem zawężonym do przestrzeni serwera (`ScopeMapping.forNamespace`); `PolicyRevision` jest licznikiem całkowitym, który tylko rośnie (0 = brak danych), zamiast napisu; poprawiony nieaktualny tekst o wiązaniu `serverId` z konfiguracją gatewaya.
- **Zgodność wstecz (SemVer):** część wydania 7.0.0: major.
- **Status:** accepted (decyzja: człowiek/koordynator, 2026-11-06, wydanie 7.0.0)

## CC-238 | C4/C12 | Poprawki administracji systemami brokera po przeglądzie bezpieczeństwa

- **Źródło:** implementacja brokera i jego przegląd bezpieczeństwa, decyzje koordynatora z 2026-11-06. Wydanie 7.0.0 nie było opublikowane.
- **C1:** zmiana `baseUrl`, `oauth.authorizeUrl`, `oauth.tokenUrl`, `oauth.clientId` albo `revokeUrl` unieważnia wszystkie połączenia systemu: grants, sekrety i trwające przepływy OAuth są usuwane bez wysyłania do jakiegokolwiek endpointu, połączenia dostają nowy status `ConnectionStatus` `needs_reconnect` (w katalogu portalu `reconnect_required`), `credential.invalidated` idzie per połączenie, audyt `system_updated` i `connections_invalidated`. Inne zmiany połączeń nie ruszają. Dla `token-exchange` `tokenUrl` nie jest ustawialny (broker używa endpointu swojego dostawcy tożsamości; wartość to `422 token_url_not_settable`).
- **C2:** `deleteAdminSystem` wymaga `If-Match` i świeżego MFA (lista kroków w BFF); broker sam sprawdza świeżość MFA tokenu administratora (`auth_time` do 300 s, inaczej `401 step_up_required`) przy każdym zapisie administratora.
- **C3:** `SystemAdminRequest` i widok mają `revokeUrl` (https, objęty regułą C1), `timeout` (ISO 8601, do 10 minut), `exchangeAudience` (tylko `token-exchange`, tam wymagane), `userSecretScheme` (`Bearer`, `Basic`, `Token`, domyślnie z `secretScheme`). `deployment` w `SystemInfo` zostaje i jest opisane jako informacja czytana przez portal, nie ustawienie administratora.
- **C4:** `atlassian-dc` wymaga `product` (`jira` albo `confluence`), brak wykrywania; dla innych adapterów `product` jest zabronione.
- **C5:** każdy adres od administratora to `^https://`; http istnieje tylko w profilu dev brokera, produkcyjny broker go nie przyjmie. `authorizeUrl` wymagany tylko dla `user-oauth`.
- **Dodatkowo:** utworzenie systemu, którego id ma pozostałe połączenia albo przepływy po wcześniejszym usunięciu, czyści je najpierw bez wysyłania czegokolwiek (z audytem); DELETE id bez systemu to `204` i nie usuwa żadnego sekretu; powody audytu `system_created`, `system_updated`, `system_deleted`, `system_imported`, `connections_invalidated`, `not_admin` dopisane do listy.
- **Zgodność wstecz (SemVer):** część wydania 7.0.0: major.
- **Status:** accepted (decyzja: człowiek/koordynator, 2026-11-06, wydanie 7.0.0)

## CC-239 | C5/C8 | Świeże MFA sprawdzane przez gateway i powody audytu administracji serwerami i polityką

- **Źródło:** wdrożenie gatewaya, decyzja koordynatora z 2026-11-06.
- **MFA:** jak w CC-238 (broker), gateway sam sprawdza `auth_time` tokenu administratora (do 300 s, inaczej `401 step_up_required`) dla operacji poszerzających dostęp z CC-237 A11 (`approveServerPolicies`, `putScopeMapping`, `deleteOverride`, `createServer`, `updateServer` ze zmianą `internalUrl` albo `tlsName`) i dla `deleteServer`. Opis schematu `bffUserToken` (C4 i C5) nie podawał `auth_time`: dopisano, że token wymieniony dla gatewaya i brokera go niesie (mapper IdP kopiuje claim), a token bez niego jest nieświeży.
- **Audyt (C8):** powody `server_created`, `server_updated`, `server_deleted`, `scope_mapping_changed`, `scope_mapping_entry_removed`, `scope_mapping_entry_ignored`, `override_set`, `override_removed`, `override_invalid`, `override_rejected`, `policies_submitted`, `policies_approved`, `policies_changed`, `policy_data_invalid`. Nowe opcjonalne pole zdarzenia `group` (`GroupName`); zakres wpisu mapowania zapisuje się w `resource`: `type` to typ zasobu zakresu (część przed ukośnikiem, np. `Jira::Project`), `id` część po ukośniku, razem identyfikator `ResourceScope`. Wektory `audit-events/gateway-scope-mapping-entry-*`.
- **Zgodność wstecz (SemVer):** nowe pole i powody (powód to otwarty napis): część wydania 7.0.0: major.
- **Status:** accepted (decyzja: człowiek/koordynator, 2026-11-06, wydanie 7.0.0)

## CC-240 | C5/C8/C12 | Poprawki po przeglądzie bezpieczeństwa gatewaya

- **Źródło:** przegląd bezpieczeństwa implementacji gatewaya, decyzje koordynatora z 2026-11-06. Wydanie 7.0.0 nie było opublikowane.
- **C1:** `tlsName` usunięte z `ServerConfig`, `ServerConfigCreate`, `ServerConfigPatch` i z BFF; gateway przypina certyfikat serwera do SAN `<serverId>.internal` i CN liścia równego `serverId`. `adapter` tylko przy tworzeniu. Każdy `updateServer` wymaga świeżego MFA (`auth_time` do 300 s) poza ciałem, które tylko ustawia `enabled: false`; sekcja "Fresh MFA" i opis operacji w BFF poprawione.
- **C2:** przestrzeń należy do pierwszego `serverId`, którego polityki są zatwierdzone z nią; rejestracja sprawdza tylko względem zatwierdzonych właścicieli i niczego nie zajmuje; zatwierdzenie, które zmienia albo zwalnia przestrzeń, usuwa wpisy mapowania zwolnionej przestrzeni z audytem `scope_mapping_entry_removed`, jak `deleteServer`.
- **C3:** audyt: pola `overrideId`, `overrideTarget`, `textSha256`, `textSha256Before` (zdarzenia `override_*`; skrót, nigdy tekst) i `changedFields` (`server_updated`: nazwy zmienionych pól). Wektory `audit-events/gateway-override-*` i `gateway-server-updated*`.
- **C4:** progi ryzyka (CC-167) przeżywają `deleteServer`, kluczem pozostaje serverId i narzędzie; ponownie utworzony serwer nie przywróci dawnego `DESTRUCTIVE` jako `READ_ONLY` bez `acceptRiskLowering`.
- **C5:** certyfikat serwera MCP ma EKU `serverAuth` i `clientAuth`, CN = `serverId`, SAN `<serverId>.internal`.
- **C6:** `cedar/examples/overrides/step-up.cedar` zostaje (reguła `unless { context has mfaAge && context.mfaAge < 3600 }` jest zamykająca, więc działa i bez claimu `mfa`: odmawia), z id `override-destructive-requires-fresh-mfa`, które spełnia wymóg id nadpisania.
- **C7:** rewizja danych polityki to `max(poprzednia + 1, bieżący czas w ms)`; opisano, że brak podpisanych paczek odbiera kontrolę dwóch stron, a zastępują ją świeże MFA, audyt i zatwierdzenie skrótu; zalecenie operacyjne przeglądu dwóch osób dla mapowania zakresów i zatwierdzeń.
- **Zgodność wstecz (SemVer):** część wydania 7.0.0: major.
- **Status:** accepted (decyzja: człowiek/koordynator, 2026-11-06, wydanie 7.0.0)

## CC-241 | C4/C5/C12 | Świeże MFA wymaga dowodu MFA, nie samego `auth_time`

- **Źródło:** decyzja koordynatora z 2026-11-06 (poprawka CC-238 C2, CC-239, CC-240).
- **Zmiana:** świeże MFA tokenu administratora (gateway i broker, każdy sprawdza sam) to `auth_time` nie starsze niż 300 s ORAZ dowód MFA: `acr` z konfigurowanej listy poziomów MFA albo `amr` zawierające `mfa`, `otp`, `hwk` lub `totp` (lista konfigurowana u odbiorcy); token bez żadnego z dowodów nie jest świeży (`401 step_up_required`). Opis `bffUserToken` (C4, C5) wymaga `auth_time`, `acr` i `amr` od mappera IdP. `userSecretScheme` traci wartość `Token`, której broker nie obsługuje (zostają `Bearer` i `Basic`; domyślnie `Basic`, gdy `secretScheme` to `Basic`, inaczej `Bearer`). Opis `token-exchange`: endpoint tokenu dostawcy tożsamości broker bierze z własnej konfiguracji, nigdy z API.
- **Zgodność wstecz (SemVer):** część wydania 7.0.0: major.
- **Status:** accepted (decyzja: człowiek/koordynator, 2026-11-06, wydanie 7.0.0)

## CC-242 | C6/C7 | Dodatkowa grupa narzędzia (`additionalGroup`)

- **Źródło:** wdrożenie serwera OpenSearch: w 1.x narzędzia tylko dla operatorów (`get_cluster_health`, `get_backend_info`) były za grupą `mcp-opensearch-ops`; po wyprowadzaniu `requiredGroup` wyłącznie z ryzyka `mcp-opensearch-read` je otwierało.
- **Zmiana:** opcjonalne `additionalGroup` we wpisie narzędzia manifestu (serwery zbudowane na starterze), wzorzec `mcp-<system>-<przyrostek>` z systemem tego serwera i przyrostkiem innym niż `read`, `write`, `destructive` (reguła `additional-group-valid`, schemat); część `definitionHash` (zmiana wymaga zatwierdzenia); zabronione w manifeście adaptera (administrator nie ustawia grup przy zatwierdzeniu). Encja `Tool` ma opcjonalny atrybut `additionalGroup: UserGroup`; polityka platformy `platform-call-additional-group` zabrania `call`, gdy `resource has additionalGroup && !(principal in resource.additionalGroup)`: tylko zawęża, grupa z ryzyka nadal jest potrzebna. `ToolDescriptor` ma składnik `additionalGroup` (`Optional<String>`; konstruktor bez niego i `withAdditionalGroup(String)` zostają). Nowe bajty `mcp.cedarschema`. Wektory: `definition-hash/get-issue-additional-group`, `manifests/*additional-group*`, `entity-builder/gateway-additional-group*`, `policy-decisions/gw-additional-group-*`.
- **Zgodność wstecz (SemVer):** część wydania 7.0.0: major.
- **Status:** accepted (decyzja: człowiek/koordynator, 2026-11-06, wydanie 7.0.0)

## CC-243 | C4/C5/C12 | Poprawki po wdrożeniu portalu

- **Źródło:** wdrożenie portalu, decyzje koordynatora z 2026-11-06.
- **MFA:** `putOverride`, który zastępuje istniejące nadpisanie (`If-Match`), wymaga świeżego MFA według CC-241, bo słabszy tekst poszerza dostęp jak usunięcie; utworzenie (`If-None-Match: *`) nie. Lista w gateway i opisy w gateway i BFF poprawione. BFF `deleteAdminServer` (i `putAdminOverride`) odpowiada 401 ze step-upem, jak pozostałe operacje ze świeżym MFA.
- **Odczyt:** `GET /admin/v1/registry/servers/{serverId}/policies` (`getServerPolicies`, schemat `ApprovedPolicies`: `approvedHash`, `approvedPolicies`, `approvedResourceTypes`, null gdy nic nie zatwierdzono), lustro BFF `getAdminServerPolicies`; `404` tylko dla nieznanego `serverId`.
- **Błędne dane wejściowe (jedna reguła):** źle zbudowany `If-Match` albo `If-None-Match` i identyfikator ścieżki niezgodny ze wzorcem to `400 invalid_request`, nigdy `404`; poprawny identyfikator bez zasobu to `404` (DELETE systemu bez systemu `204`); poprawny, ale nieaktualny `If-Match` to `412`. Dopisane `400` w operacjach z identyfikatorem w ścieżce: gateway, broker i BFF.
- **`displayName`:** opcjonalne w `SystemAdminRequest`, zawsze obecne w `SystemAdminView` (id, gdy nie podano), opcjonalne w `SystemInfo`; 1 do 64 znaków bez znaków sterujących i formatujących.
- **Zgodność wstecz (SemVer):** część wydania 7.0.0: major.
- **Status:** accepted (decyzja: człowiek/koordynator, 2026-11-06, wydanie 7.0.0)

## CC-244 | C4/C5 | Poprawki po przeglądzie bezpieczeństwa portalu

- **Źródło:** przegląd bezpieczeństwa portalu, decyzje koordynatora z 2026-11-06.
- **Zmiana:** `exchangeAudience` w `SystemAdminRequest` musi być na liście dozwolonych odbiorców (lub wzorców) w konfiguracji brokera; inna wartość to `422 system_rejected` z powodem `audience_not_allowed` (opis `putAdminSystem`, `SystemRejected`). Wzorzec `OverrideTarget` ma negatywny lookahead zarezerwowanych id jak `ServerId` (CC-237 A1); BFF używa schematu gatewaya. README i CHANGELOG mówią, że 7.0.0 jest niewydane.
- **Zgodność wstecz (SemVer):** część wydania 7.0.0: major.
- **Status:** accepted (decyzja: człowiek/koordynator, 2026-11-06, wydanie 7.0.0)

## CC-245 | C5/C6 | Zmiana `additionalGroup` narzędzia czeka na administratora

- **Źródło:** decyzja koordynatora z 2026-11-06 (uzupełnienie CC-242 i CC-133).
- **Stan:** według CC-133 nowe albo zmienione narzędzie `READ_ONLY` jest zatwierdzane przez samą rejestrację (przegląd commita), więc usunięcie albo zmiana `additionalGroup` takiego narzędzia poszerzyłaby dostęp bez administratora.
- **Zmiana:** rejestracja, która usuwa albo zmienia `additionalGroup` już zarejestrowanego narzędzia, jest `pending_approval` (`change: changed`) niezależnie od ryzyka, jak zmiana ryzyka dla `UPDATE` i `DESTRUCTIVE`; dodanie `additionalGroup` do nowego albo istniejącego narzędzia zawęża i podlega normalnej regule. Tekst w README (rejestr i przypinanie definicji) i w opisie `registerServer`; referencja `registrationDecision` w `scripts/lib/registry-approval.mjs`, wektory `registry-approval/registration-*`.
- **Zgodność wstecz (SemVer):** część wydania 7.0.0: major.
- **Status:** accepted (decyzja: człowiek/koordynator, 2026-11-06, wydanie 7.0.0)

## CC-246 | C5/C6 | Próg grupy narzędzia przeżywa usunięcie narzędzia

- **Źródło:** decyzja koordynatora z 2026-11-06 (domknięcie CC-245).
- **Stan:** CC-245 pilnował zmiany `additionalGroup` tylko dla narzędzia, które już było zarejestrowane. Usunięcie narzędzia w jednej rejestracji i dodanie go bez grupy w następnej robiło z niego "nowe" narzędzie `READ_ONLY`, zatwierdzone przeglądem commita.
- **Zmiana:** gateway trzyma próg grupy dla narzędzia obok progów ryzyka (CC-167): ostatnią `additionalGroup`, z którą narzędzie zatwierdzono; próg zostaje po usunięciu narzędzia i po `deleteServer` (jak progi ryzyka, CC-240 C4), kluczem jest serverId i narzędzie. Rejestracja, w której narzędzie (nowe albo istniejące) nie ma `additionalGroup` albo ma inną niż próg, jest `pending_approval` niezależnie od ryzyka; zatwierdzenie ustawia próg. Dodanie grupy tam, gdzie progu nie ma, zawęża i podlega normalnej regule. Referencja: `registrationDecision` z polem `groupFloor` w `scripts/lib/registry-approval.mjs`; wektory `registry-approval/registration-*`.
- **Zgodność wstecz (SemVer):** część wydania 7.0.0: major.
- **Status:** accepted (decyzja: człowiek/koordynator, 2026-11-06, wydanie 7.0.0)

## CC-247 | C4/C12 | Adapter generic-rest z sekretami użytkowników i `whoami`

- **Źródło:** decyzja właściciela z 2026-11-06: nowy system z szablonu ma móc używać własnych tokenów użytkowników.
- **Zmiana:** adapter `generic-rest` przyjmuje `user-secret` albo `service-account`, nigdy razem i nigdy `user-oauth` (`422 system_rejected`, powód `credential_type_not_supported_by_adapter`). `SystemAdminRequest` i `SystemAdminView` mają opcjonalne `whoami` (`SystemWhoami {path, usernameField}`, tylko dla `generic-rest`): `path` względny do `baseUrl` (zaczyna się od `/`, nie `//`, bez schematu i hosta, bez `..`, bez zapytania, do 512 znaków), `usernameField` to pole najwyższego poziomu albo wskaźnik JSON RFC 6901. Z `whoami` zapis sekretu użytkownika woła `GET baseUrl+path` z sekretem (schemat według `userSecretScheme`): 2xx z polem zapisuje sekret z tą nazwą użytkownika, 401 i 403 to `secret_invalid`, inne odpowiedzi `upstream_unavailable`. Bez `whoami` sekret jest zapisany bez weryfikacji i połączenie nie ma nazwy użytkownika; powód audytu `secret_stored_unverified`. Zmiana `whoami` nie unieważnia połączeń (ten sam host), zmiana `baseUrl` nadal tak (CC-238).
- **Pola:** `Connection`, `PutSecretResponse` i `OAuthCompleteResponse` mają wymagane `verified` (boolean); `backendUser` w `Connection` i `PutSecretResponse` może być null; `SystemInfo.userSecretVerified` mówi, czy zapis sekretu systemu jest weryfikowany (portal pokazuje "not verified" przed połączeniem). Przykłady `notes` używają `user-secret` z `whoami` (wcześniej pokazywały `generic-rest` z `user-oauth`).
- **Zgodność wstecz (SemVer):** wymagane nowe pole `verified` w odpowiedziach i zaostrzenie typów generic-rest: część wydania 7.0.0: major.
- **Status:** accepted (decyzja: człowiek, 2026-11-06, wydanie 7.0.0)
