# Status ws-00 (mcp-contracts)

Wersja **2.1.0**, tag `v2.1.0` (wcześniej `v2.0.2`, `v2.0.1`, `v2.0.0`, `v1.2.0`, `v1.1.0`, `v1.0.0`). Od 2.0.0 ścisły
SemVer; `cedar/mcp.cedarschema` jest w 2.1.0 bajtowo taki jak w 2.0.0 (test skrótu przechodzi). Zmiany względem
1.1.0, na której są broker, BFF i frontend, i wpływ na każdego konsumenta: `CHANGELOG.md`.

Walidacja: `./scripts/verify-all.sh` zielony (`npm test`: 95 testów Node; `./mvnw verify`: 391 testów JUnit,
w tym 293 mcp-cedar-entities, 56 mcp-policy-bundle, 42 mcp-manifest).

## Artefakty 2.1.0

- `pl.aiwcorpo.mcp:mcp-contracts:2.1.0` (+ klasyfikator `test-vectors`), `mcp-cedar-entities:2.1.0`,
  `mcp-policy-bundle:2.1.0`, `mcp-manifest:2.1.0`, `mcp-contracts-parent:2.1.0` (w `~/.m2` po `./mvnw install`).
- `release/aiwcorpo-mcp-contracts-2.1.0.tgz` obok tarballi 1.0.0, 1.1.0, 1.2.0, 2.0.0, 2.0.1, 2.0.2.

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

- W `CONTRACT_CHANGES.md` nie ma otwartych pozycji.
- Czy lista kolejek z konfiguracji serwera service desku zostaje po M3 jako dodatkowe zawężenie, czy znika na rzecz
  paczki (CC-076, do planowania M3). Strumienie danych OpenSearch jako zasób: decyzja w M2 (CC-074).
- Przegląd 2.0.0, kategoria (b), czeka na decyzję człowieka przy planowaniu M2: H1(b) lista znanych skrótów
  schematu lub postać znormalizowana zamiast bajtowego przypięcia; H2 agregaty/`hits.total`/`_count` OpenSearch
  obejmujące indeksy zakazane wewnątrz `p,p-*`; wymagalność `classification` dla GitLaba i service desku (M1);
  L3 znacznik narzędzia listującego w manifeście.
