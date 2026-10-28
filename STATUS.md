# Status ws-00 (mcp-contracts)

Wersja **3.0.1**, tag `v3.0.1` (poprawka bezpieczeństwa 3.0.0; praca dalej na `3.0.2-SNAPSHOT`); wcześniej **3.0.0**, tag `v3.0.0`, i **2.2.5**, tag `v2.2.5` (grupa A pakietu M2, CC-117 ... CC-120; wcześniej `v2.2.4`, `v2.2.3`, `v2.2.2`, `v2.2.1`, `v2.2.0` (CC-080 ... CC-090 dla M2), `v2.1.1`, `v2.1.0`, `v2.0.2`, `v2.0.1`, `v2.0.0`, `v1.2.0`, `v1.1.0`, `v1.0.0`). Od 2.0.0 ścisły
SemVer; `cedar/mcp.cedarschema` jest w 2.1.0 bajtowo taki jak w 2.0.0 (także w 2.1.1 i 2.2.0) (test skrótu przechodzi). Zmiany względem
1.1.0, na której są broker, BFF i frontend, i wpływ na każdego konsumenta: `CHANGELOG.md`.

Walidacja 3.0.0: `./scripts/verify-all.sh` zielony (`npm test`: 253 testy Node; `./mvnw verify`: 418 testów JUnit,
w tym 293 mcp-cedar-entities, 56 mcp-policy-bundle, 69 mcp-manifest).

## Plan 3.0.2 (zostało z przeglądu końcowego)

- G-L7 (część): odpowiedź `503` w `markConfirmationViewed` (C5), dodatek do opisu operacji.
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
