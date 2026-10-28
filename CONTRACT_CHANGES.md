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
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-27; wydanie 3.0.0 przed M3, nie w 2.2.0). Wdrożone w 3.0.0 (wersja robocza 3.0.0-SNAPSHOT, bez tagu). Dodatkowe decyzje człowieka 2026-10-28: blokada zdejmuje się tylko po 15 minutach, w portalu nie ma odblokowania; dzienny limit błędnych kodów (CC-126); jedna oczekująca operacja DESTRUCTIVE (CC-127). Rozstrzygnięcia: podgląd OPCJONALNY, bez `previewRequired`; ryzyko rezydualne (opis operacji widziany tylko w niezaufanym kliencie, gdy człowiek nie otworzy podglądu) jest świadomie przyjęte przez człowieka; step-up Entra tylko przy rejestracji i usunięciu; weryfikuje broker; limity 5 błędnych / 15 min, blokada 15 min, 3 próby na wywołanie, rejestracja 10 min; reguła `destructive-requires-fresh-mfa` wypada z paczki produkcyjnej (przykład zostaje); `confirmation_declined` usunięte; reset cudzej rejestracji przez CN `mcp-offboarding`; CC-094 wariant B (nowy `event: "authenticator"`); wyjątek w niezmienniku 4 na jednorazowy pokaz ziarna TOTP (`no-store`, tylko właściciel po MFA Entra, nigdy w logach ani audycie)

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
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-27; wydanie 3.0.0 przed M3, nie w 2.2.0). Wdrożone w 3.0.0 (wersja robocza 3.0.0-SNAPSHOT, bez tagu). Dodatkowe decyzje człowieka 2026-10-28: blokada zdejmuje się tylko po 15 minutach, w portalu nie ma odblokowania; dzienny limit błędnych kodów (CC-126); jedna oczekująca operacja DESTRUCTIVE (CC-127). Rozstrzygnięcia: podgląd OPCJONALNY, bez `previewRequired`; ryzyko rezydualne (opis operacji widziany tylko w niezaufanym kliencie, gdy człowiek nie otworzy podglądu) jest świadomie przyjęte przez człowieka; step-up Entra tylko przy rejestracji i usunięciu; weryfikuje broker; limity 5 błędnych / 15 min, blokada 15 min, 3 próby na wywołanie, rejestracja 10 min; reguła `destructive-requires-fresh-mfa` wypada z paczki produkcyjnej (przykład zostaje); `confirmation_declined` usunięte; reset cudzej rejestracji przez CN `mcp-offboarding`; CC-094 wariant B (nowy `event: "authenticator"`); wyjątek w niezmienniku 4 na jednorazowy pokaz ziarna TOTP (`no-store`, tylko właściciel po MFA Entra, nigdy w logach ani audycie)

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
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-27; wydanie 3.0.0 przed M3, nie w 2.2.0). Wdrożone w 3.0.0 (wersja robocza 3.0.0-SNAPSHOT, bez tagu). Dodatkowe decyzje człowieka 2026-10-28: blokada zdejmuje się tylko po 15 minutach, w portalu nie ma odblokowania; dzienny limit błędnych kodów (CC-126); jedna oczekująca operacja DESTRUCTIVE (CC-127). Rozstrzygnięcia: podgląd OPCJONALNY, bez `previewRequired`; ryzyko rezydualne (opis operacji widziany tylko w niezaufanym kliencie, gdy człowiek nie otworzy podglądu) jest świadomie przyjęte przez człowieka; step-up Entra tylko przy rejestracji i usunięciu; weryfikuje broker; limity 5 błędnych / 15 min, blokada 15 min, 3 próby na wywołanie, rejestracja 10 min; reguła `destructive-requires-fresh-mfa` wypada z paczki produkcyjnej (przykład zostaje); `confirmation_declined` usunięte; reset cudzej rejestracji przez CN `mcp-offboarding`; CC-094 wariant B (nowy `event: "authenticator"`); wyjątek w niezmienniku 4 na jednorazowy pokaz ziarna TOTP (`no-store`, tylko właściciel po MFA Entra, nigdy w logach ani audycie)

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
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-27; wydanie 3.0.0 przed M3, nie w 2.2.0). Wdrożone w 3.0.0 (wersja robocza 3.0.0-SNAPSHOT, bez tagu). Dodatkowe decyzje człowieka 2026-10-28: blokada zdejmuje się tylko po 15 minutach, w portalu nie ma odblokowania; dzienny limit błędnych kodów (CC-126); jedna oczekująca operacja DESTRUCTIVE (CC-127). Rozstrzygnięcia: podgląd OPCJONALNY, bez `previewRequired`; ryzyko rezydualne (opis operacji widziany tylko w niezaufanym kliencie, gdy człowiek nie otworzy podglądu) jest świadomie przyjęte przez człowieka; step-up Entra tylko przy rejestracji i usunięciu; weryfikuje broker; limity 5 błędnych / 15 min, blokada 15 min, 3 próby na wywołanie, rejestracja 10 min; reguła `destructive-requires-fresh-mfa` wypada z paczki produkcyjnej (przykład zostaje); `confirmation_declined` usunięte; reset cudzej rejestracji przez CN `mcp-offboarding`; CC-094 wariant B (nowy `event: "authenticator"`); wyjątek w niezmienniku 4 na jednorazowy pokaz ziarna TOTP (`no-store`, tylko właściciel po MFA Entra, nigdy w logach ani audycie)

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
- **Status:** proposed - zatwierdzone co do kierunku (decyzja: człowiek, 2026-10-27), tekst do akceptacji

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
- **SemVer:** minor (nowe pola opcjonalne; `pendingVersion` w `required` odpowiedzi to dodatek po stronie producenta, nie
  zmiana żądania).
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
- **Status:** accepted (decyzja: człowiek, 2026-10-28; tekst przyjęty), kamień M4, poza 3.0.0 (nie zaimplementowane w OpenAPI; wydanie z kamieniem M4).

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
- **Status:** accepted-for-3.0.0 (decyzja: człowiek, 2026-10-27; wydanie 3.0.0 przed M3, nie w 2.2.0). Wdrożone w 3.0.0 (wersja robocza 3.0.0-SNAPSHOT, bez tagu). Dodatkowe decyzje człowieka 2026-10-28: blokada zdejmuje się tylko po 15 minutach, w portalu nie ma odblokowania; dzienny limit błędnych kodów (CC-126); jedna oczekująca operacja DESTRUCTIVE (CC-127). Rozstrzygnięcia: podgląd OPCJONALNY, bez `previewRequired`; ryzyko rezydualne (opis operacji widziany tylko w niezaufanym kliencie, gdy człowiek nie otworzy podglądu) jest świadomie przyjęte przez człowieka; step-up Entra tylko przy rejestracji i usunięciu; weryfikuje broker; limity 5 błędnych / 15 min, blokada 15 min, 3 próby na wywołanie, rejestracja 10 min; reguła `destructive-requires-fresh-mfa` wypada z paczki produkcyjnej (przykład zostaje); `confirmation_declined` usunięte; reset cudzej rejestracji przez CN `mcp-offboarding`; CC-094 wariant B (nowy `event: "authenticator"`); wyjątek w niezmienniku 4 na jednorazowy pokaz ziarna TOTP (`no-store`, tylko właściciel po MFA Entra, nigdy w logach ani audycie)

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
- **Status:** deferred (decyzja: człowiek, 2026-10-28; grupa C pakietu M2, kamień: M4)

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
    licznikami `verify`). Kod z kroku `<= burnedThrough` to `replayed`, ale **nie liczy się** do limitów 5/15 min i 20/24 h
    (inaczej trzymany kod służyłby do zablokowania użytkownika); kod z kroku o dwa dalej działa (po 30-60 s). Gateway woła
    broker PRZED usunięciem oczekującego wywołania: błąd brokera to `503` na anulowaniu i nic nie jest anulowane
    (fail-closed); użytkownik bez aktywnej rejestracji: `204`, nic do unieważnienia. Audyt brokera: `event: authenticator`,
    `reason: totp_steps_burned`. Wektory: `totp/burn-*` (5: trzymany kod `replayed` bez wpływu na limity, kod następnego
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
