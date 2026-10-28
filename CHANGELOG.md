# Changelog

Format: wersje SemVer (README, "Wersjonowanie"). Numery CC odnoszą się do `CONTRACT_CHANGES.md`.
Od 2.0.0 ścisły SemVer. Wydania 1.1.0 i 1.2.0 zawierały zmiany niezgodne oznaczone jako minor; są wymienione w
ich sekcjach "Niezgodne z poprzednią wersją" i zebrane względem 1.1.0 w sekcji 2.0.0.

## 3.0.0 - w przygotowaniu (wersja robocza 3.0.0-SNAPSHOT, bez tagu)

Wydanie major, ścisły SemVer. Wersja robocza w pomach i `package.json` to `3.0.0-SNAPSHOT` (Maven: artefakt mutowalny, nie
koliduje z niezmiennymi wydaniami w `~/.m2`; ten sam numer w `package.json` i `info.version` OpenAPI, bo jar, npm i tag
mają jeden numer). Repo nie używało dotąd przyrostków `-rc`, a starter ma własną konwencję `-alpha-N`. Tag `v3.0.0`,
`release/aiwcorpo-mcp-contracts-3.0.0.tgz` i `./mvnw install` powstaną dopiero po przeglądzie i zgodzie koordynatora.
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
- CC-095: `GET /admin/v1/activity/calls` (C5) i `GET /api/v1/activity/calls` (C12), `ActivityCall` (jedno wywołanie = jeden wiersz, wynik końcowy, `wrongCodeCount`, filtry `from`, `to`, `result`, `q`, kursor `X-Next-Cursor`); wektory `activity-calls/` (33). Stary `/activity` bez zmian.
- Nie wchodzą do 3.0.0: CC-097 (przyjęte, kamień M4), CC-096, CC-113, CC-114.

### Migracja

**gateway (ws-05)**
- Rezerwacja próby przed pytaniem brokera i zwrot rezerwacji, compare-and-delete przy `ok`, atomowe "utwórz i unieważnij" per użytkownik, ślad unieważnionego wywołania nie jest oczekującym, blokada `confirmation_blocked` po zapisanym podglądzie do `max(wygaśnięcie, podgląd + 90 s)` (także po wyczerpaniu prób i wygaśnięciu), reason `pending_exists`; kursor `/activity/calls` uwierzytelniony (HMAC związany z `sub`, zmieniony -> 400), agregacja z bieżącym czasem.
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
- `POST /v1/authenticator/invalidate-codes` (CC-128): `burnedThrough`, kody spalonych kroków to `replayed` bez liczenia do limitów 5/15 i 20/24 h, audyt `totp_steps_burned`.
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
- Przycisk "Anuluj" w podglądzie (`cancel`, bez MFA) i etykieta "Anulowane". Podgląd wywołuje `viewed` raz, po wyrenderowaniu i gdy `document.prerendering` jest false i `document.visibilityState` to `visible`; odpytuje podgląd (np. co 5 s i po powrocie na kartę) i po `404` pokazuje "link nieaktualny"; etykieta `blocked_by_pending`; przy `confirmation_blocked` (po stronie klienta MCP) nie prosić o kod.
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
