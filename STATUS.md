# Status ws-00 (mcp-contracts)

Wersja **2.0.2**, tag `v2.0.2` (poprawki do 2.0.0 bez zmiany kontraktu; wcześniej `v2.0.1`, `v2.0.0`, `v1.2.0`,
`v1.1.0`, `v1.0.0`). Od 2.0.0 ścisły SemVer; `cedar/mcp.cedarschema` i `test-vectors/` są w 2.0.2 bajtowo takie jak
w 2.0.0. Zmiany względem 1.1.0, na której są broker, BFF i frontend, i wpływ na każdego konsumenta:
`CHANGELOG.md`.

Walidacja: `./scripts/verify-all.sh` zielony (`npm test`, `./mvnw verify` w czterech modułach Java),
`npm run smoke:wiremock` zielony lokalnie.

## Artefakty 2.0.2

- `pl.aiwcorpo.mcp:mcp-contracts:2.0.2` (+ klasyfikator `test-vectors`), `mcp-cedar-entities:2.0.2`,
  `mcp-policy-bundle:2.0.2`, `mcp-manifest:2.0.2`, `mcp-contracts-parent:2.0.2` (w `~/.m2` po `./mvnw install`).
- `release/aiwcorpo-mcp-contracts-2.0.2.tgz` obok tarballi 1.0.0, 1.1.0, 1.2.0, 2.0.0, 2.0.1.

## Zrobione w 2.0.2

- `ResultFilter.checkAll` fail-closed: `no_resource`, `resource_type_mismatch`, `resource_id_invalid`,
  `not_resolved` (przegląd bezpieczeństwa 2.0.1).

## Zrobione w 2.0.1

- Przegląd 2.0.0, kategoria (a): H1(a) (schemat zamrożony w 2.x, test skrótu), M1(a) (dziedziczenie
  klasyfikacji GitLab), M2 (liczby RFC 8785 przy potęgach dwójki), M3 (`isReady`/`awaitingOverrides`), M4 (stan z
  dysku, fsync, `state_write_failed`), M5 (`ResultFilter.checkAll`), M6 (CHANGELOG), M7, L1, L2, L4, L5, L6.
- `PublishedTestKeys` i `security/published-test-keys.json`: skróty SPKI wszystkich kluczy testowych.

## Zrobione w 2.0.0

- CC-046 ... CC-053 (przygotowane jako 1.2.1), CC-054 (400 przy `DELETE` nieznanego systemu), CC-055
  (`__Host-XSRF-TOKEN`), CC-056 (wzorce identyfikatorów per system, obowiązki zapytań), CC-057 (klasyfikacja
  GitLab i service desk), CC-058 (lint `virtualServer`), CC-059 (przypięty schemat, `static.json` tylko
  mapowanie), CC-060 (`PolicyStore`), CC-061 (każda wartość `resourceRefs`), CC-062 (wymagana klasyfikacja),
  CC-063 (`mcp-manifest`), CC-064 (503 w C4), CC-065 (ujemny wiek MFA), CC-066 (ochrona po restarcie),
  CC-067 (normalizacja klasyfikacji, wartość `restricted`).
- Przegląd 1.2.0: wszystkie punkty (H1 ... H4, M1 ... M7, L1 ... L7); przegląd 2.0.0: punkty (a) w 2.0.1,
  punkty (b) otwarte (niżej).
- W `CONTRACT_CHANGES.md` nie ma otwartych pozycji (CC-035 odrzucone).

## Odstępstwa od briefu

- Encja grup użytkownika w Cedar nazywa się `UserGroup` (CC-001).
- Walidacja Cedar przez cedar-java w JUnit zamiast `cedar validate` (decyzja koordynatora).
- Klucze testowe w Mavenie tylko w jarze `test-vectors`; paczka npm je zawiera.
- Pliki ponad listę briefu: dodatkowe schematy, `openapi/bundled/`, `spectral-functions/`,
  `cedar/examples/static-entities.json`, dodatkowe katalogi wektorów, cztery moduły Java.
- Tarballe npm w `release/` (w repozytorium, wszystkie wydania).

## Niedokończone / niesprawdzone

- Pipeline GitLab CI nieuruchomiony na runnerze (lokalnie `verify-all.sh`).
- Generator `java`/`restclient` i serwerowy `spring` niesprawdzone.
- Test paczek w Node nie jest referencyjny (tylko schematy JSON); referencja to `mcp-policy-bundle`.
- Wektory JWT niedeterministyczne (losowe podpisy ES256).
- Wzorce identyfikatorów service desku są zachowawcze i stałe; konfigurowalność per adapter to przyszła wersja.

## Otwarte pytania

- Brak otwartych pozycji w `CONTRACT_CHANGES.md`.
- Przegląd 2.0.0, kategoria (b), czeka na decyzję człowieka przy planowaniu M2: H1(b) lista znanych skrótów
  schematu lub postać znormalizowana zamiast bajtowego przypięcia; H2 agregaty/`hits.total`/`_count` OpenSearch
  obejmujące indeksy zakazane wewnątrz `p,p-*`; wymagalność `classification` dla GitLaba i service desku (M1);
  L3 znacznik narzędzia listującego w manifeście.
