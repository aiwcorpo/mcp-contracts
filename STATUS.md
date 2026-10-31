# Status ws-00 (mcp-contracts)

Wersja **5.0.0**, tag `v5.0.0` (CC-169 ... CC-177, M5 punkt A; praca dalej na `5.0.1-SNAPSHOT`); wcześniej **4.1.0**, tag `v4.1.0` (CC-165 ... CC-168); **4.0.1**, tag `v4.0.1`; **4.0.0**, tag `v4.0.0` (pakiet M4); wcześniej **3.1.1**, tag `v3.1.1`; wcześniej **3.1.0**, **3.0.2**, **3.0.1**, **3.0.0**, tag `v3.0.0`, i **2.2.5**, tag `v2.2.5` (grupa A pakietu M2, CC-117 ... CC-120; wcześniej `v2.2.4`, `v2.2.3`, `v2.2.2`, `v2.2.1`, `v2.2.0` (CC-080 ... CC-090 dla M2), `v2.1.1`, `v2.1.0`, `v2.0.2`, `v2.0.1`, `v2.0.0`, `v1.2.0`, `v1.1.0`, `v1.0.0`). Od 2.0.0 ścisły
SemVer; `cedar/mcp.cedarschema` jest w 2.1.0 bajtowo taki jak w 2.0.0 (także w 2.1.1 i 2.2.0) (test skrótu przechodzi). Zmiany względem
1.1.0, na której są broker, BFF i frontend, i wpływ na każdego konsumenta: `CHANGELOG.md`.

Walidacja 5.0.0: `./scripts/verify-all.sh` zielony (`npm test`: 267 testów Node; `./mvnw clean verify`: 543 testy JUnit,
w tym 327 mcp-cedar-entities, 59 mcp-policy-bundle, 157 mcp-manifest).

## 5.0.0 (wydane 2026-10-31)

- CC-169 ... CC-177 `accepted` (decyzje człowieka 2026-10-31 po PoC OAuth z query w Claude Code): zbiorczy `/mcp`, filtr w query (`access=write` rozłączne z `read`), OAuth wariant V2 (zasób bez query, `aud = mcp-gateway`),
  filtr związany z sesją, koniec `vs`/`vsc`/`virtualServer`/`vsScopes`/`resourceDefaults` (zmiana `mcp.cedarschema`), audyt z jawnym `filter` i powodem `filter_scope`, operacja BFF `GET /api/v1/me/mcp-endpoint`, `list_changed`
  (zmiana połączenia nie jest wyzwalaczem), `/v/` usunięte od razu. Zakres i migracja per komponent: `CHANGELOG.md` ("5.0.0"). Przyjęte ryzyko V2 (tylko Claude Code): README, "Jeden adres do całej platformy".
- Nowe katalogi wektorów: `endpoint-filter/` (82), `endpoint-aggregate/` (25), `mcp-endpoint/` (11); referencje `scripts/lib/endpoint-filter.mjs`, `endpoint-aggregate.mjs`, `mcp-endpoint.mjs`; klasa Java `EndpointFilter` w `mcp-manifest`.
- Zmieniają się bajty `cedar/mcp.cedarschema` (SHA-256 `51d71b2d...`) i wszystkie `bundles/files/*`.
- Odstępstwa od tekstu CC (do wiadomości): ciało `400` filtra to nowy `EndpointFilterError` poza C10 (C10 nie miał `invalid_request` ani `reason`); ścieżka BFF to `/api/v1/me/mcp-endpoint` (prefiks `/api/v1` jak reszta C12);
  forbid chroniony `has` czytający usunięte pola przechodzi walidację (nie "nawet w forbid nie przechodzi"); `GET /api/v1/activity*` nie miał parametru `virtualServer`, więc nic nie znika ani nie dochodzi; wpis `systems` to składnia, nie wyliczenie systemów.
- Wydane: artefakty `pl.aiwcorpo.mcp:*:5.0.0` w `~/.m2`, `release/aiwcorpo-mcp-contracts-5.0.0.tgz`, tag `v5.0.0`.

## 4.1.0 (wydane 2026-10-29)

- CC-165 ... CC-168 (wyniki aktywności, kontrola typu poświadczenia, podłoga ryzyka i `acceptRiskLowering`, zbiór typów); wyjątek SemVer w README; migracja w `CHANGELOG.md` ("4.1.0").
- Wydane: artefakty `pl.aiwcorpo.mcp:*:4.1.0` w `~/.m2`, `release/aiwcorpo-mcp-contracts-4.1.0.tgz`, tag `v4.1.0`.

## 4.0.1 (wydane 2026-10-29)

- CC-163 i CC-164 (kolejki konta serwisowego tylko z paczki, lista dozwolona typów poświadczeń); wyjątek SemVer w README; migracja w `CHANGELOG.md` ("4.0.1").
- Wydane: artefakty `pl.aiwcorpo.mcp:*:4.0.1` w `~/.m2`, `release/aiwcorpo-mcp-contracts-4.0.1.tgz`, tag `v4.0.1`.

## 4.0.0 (wydane 2026-10-29)

- Zakres i migracja per komponent: `CHANGELOG.md` ("4.0.0"). Nowe CC-133 ... CC-162 (CC-153 odrzucone); CC-096, CC-097, CC-113 wdrożone.
- Zmieniają się bajty `cedar/mcp.cedarschema` (CC-136).
- Wydane: artefakty `pl.aiwcorpo.mcp:*:4.0.0` w `~/.m2`, `release/aiwcorpo-mcp-contracts-4.0.0.tgz`, tag `v4.0.0`.

## Plan 3.1.2 (zostało)

- G-L8: decyzja człowieka o eskalacji z potwierdzeń o innym ryzyku do DESTRUCTIVE (przyjąć wprost albo spalać kody także po
  obejrzanym potwierdzeniu innego ryzyka).
- Pozostałe LOW z kolejnych przeglądów, jeśli się pojawią.

## 3.0.0 (wydane 2026-10-28)

- Zakres i migracja per komponent: `CHANGELOG.md` ("3.0.0"). Nowe CC: CC-124 (503 przy niedostępnym JWKS), CC-125
  (audyt C5, `replay_store_unavailable` u odbiorców), CC-126 (dzienny limit błędnych kodów), CC-127 (jedna oczekująca
  operacja DESTRUCTIVE).
- CC-095 przyjęte i wdrożone w wersji roboczej; CC-097 przyjęte, kamień M4 (poza 3.0.0).
- Wydane jako 3.0.0: artefakty `pl.aiwcorpo.mcp:*:3.0.0` w `~/.m2`, `release/aiwcorpo-mcp-contracts-3.0.0.tgz`, tag `v3.0.0`.
- Pytania do człowieka: raport koordynatora (`CONTRACT_CHANGES.md`, statusy CC-099 i CC-116).

## Artefakty 2.2.5 (poprzednie wydanie)

- `pl.aiwcorpo.mcp:mcp-contracts:2.2.5` (+ klasyfikator `test-vectors`), `mcp-cedar-entities:2.2.5`,
  `mcp-policy-bundle:2.2.5`, `mcp-manifest:2.2.5`, `mcp-contracts-parent:2.2.5` (w `~/.m2` po `./mvnw install`).
- `release/aiwcorpo-mcp-contracts-2.2.5.tgz` obok tarballi 1.0.0 ... 2.2.4.

## Zrobione w 2.2.1

- Poprawki z przeglądu 2.2.0 (CHANGELOG 2.2.1): CC-084 zmienione (brak walidacji daty), reguła tożsamości C4.1 z wektorami,
  przykłady katalogu dla wszystkich statusów, typy TS z opcjonalnymi polami z `default`, reguły tras gateway'a. CC-099
  (`ReturnPath` bez zarezerwowanych prefiksów) `accepted-for-3.0.0`.

## Zrobione w 2.2.0

- CC-080 ... CC-090 (decyzje człowieka 2026-10-27), patrz `CHANGELOG.md`. CC-091 ... CC-094 i CC-098 `accepted-for-3.0.0` (pivot potwierdzeń, osobne wydanie przed M3); CC-095 ... CC-097 `proposed`.

## Zrobione w 2.1.0

- CC-068 ... CC-077 (decyzje człowieka 2026-10-27): `prv` bez paczki, metody MCP 2026-07-28, wariant serwisowy
  tylko bez sesji, audyt `authentication`, `UntrustedText`, whoami Confluence, OpenSearch bez wiodącej kropki,
  wektor service desku, reguła kolejek konta serwisowego, kanał kodu C11 (CC-077).
- Nowe katalogi wektorów: `untrusted-text/`, `servicedesk-service-account/`, `confirmation-binding/`; nowe wektory
  JWT, audytu i entity buildera. Istniejące tokeny JWT nie zostały przegenerowane.

## Odstępstwa i decyzje do wiadomości

- CC-071, CC-074 i CC-077 są według tabeli SemVer w README zmianami major; wydane jako 2.1.0 na decyzję człowieka.
- CC-076: wektory `srv-servicedesk-service-account-no-queue-grant` i
  `srv-servicedesk-ticket-moved-out-of-granted-queue` nie są w `policy-decisions/`. Model Cedar nie niesie typu
  poświadczenia, a polityka `servicedesk-read` nie wymaga grantu kolejki, więc decyzja Cedar nie odróżni konta
  serwisowego bez zmiany `mcp.cedarschema` (zamrożony w 2.x). Wektory są w `servicedesk-service-account/` z
  referencyjną regułą w testach Node; do rozważenia przy 3.0.0: typ poświadczenia w kontekście Cedar.
- CC-077: format kodu to 6 cyfr (`ConfirmationCode`), jak w istniejących wektorach audytu.
- Encja grup użytkownika w Cedar nazywa się `UserGroup` (CC-001); walidacja Cedar przez cedar-java w JUnit;
  klucze testowe w Mavenie tylko w jarze `test-vectors`; tarballe npm w `release/` (wszystkie wydania).

## Niedokończone / niesprawdzone

- Pipeline GitLab CI nieuruchomiony na runnerze (lokalnie `verify-all.sh`).
- Generator `java`/`restclient` i serwerowy `spring` niesprawdzone.
- Test paczek w Node nie jest referencyjny (tylko schematy JSON); referencja to `mcp-policy-bundle`.
- Wektory JWT niedeterministyczne (losowe podpisy ES256).
- Wzorce identyfikatorów service desku są zachowawcze i stałe; konfigurowalność per adapter to przyszła wersja.

## Otwarte pytania

- CC-078 i CC-079 zamknięte w 3.0.0 (wdrożone w wersji roboczej).
- Czy lista kolejek z konfiguracji serwera service desku zostaje po M3 jako dodatkowe zawężenie, czy znika na rzecz
  paczki (CC-076, do planowania M3). Strumienie danych OpenSearch jako zasób: decyzja w M2 (CC-074).
- Przegląd 2.0.0, kategoria (b), czeka na decyzję człowieka przy planowaniu M2: H1(b) lista znanych skrótów
  schematu lub postać znormalizowana zamiast bajtowego przypięcia; H2 agregaty/`hits.total`/`_count` OpenSearch
  obejmujące indeksy zakazane wewnątrz `p,p-*`; wymagalność `classification` dla GitLaba i service desku (M1);
  L3 znacznik narzędzia listującego w manifeście.
