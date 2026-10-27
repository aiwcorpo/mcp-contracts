# Status ws-00 (mcp-contracts)

Wersja **2.0.0**, tag `v2.0.0` (wcześniej `v1.2.0`, `v1.1.0`, `v1.0.0`; 1.2.1 nie zostało wydane osobno). Od 2.0.0
ścisły SemVer. Zmiany względem 1.1.0, na której są broker, BFF i frontend, i wpływ na każdego konsumenta:
`CHANGELOG.md`.

Walidacja: `./scripts/verify-all.sh` zielony (`npm test`, `./mvnw verify` w czterech modułach Java),
`npm run smoke:wiremock` zielony lokalnie.

## Artefakty 2.0.0

- `pl.aiwcorpo.mcp:mcp-contracts:2.0.0` (+ klasyfikator `test-vectors`), `mcp-cedar-entities:2.0.0`,
  `mcp-policy-bundle:2.0.0`, `mcp-manifest:2.0.0`, `mcp-contracts-parent:2.0.0` (w `~/.m2` po `./mvnw install`).
- `release/aiwcorpo-mcp-contracts-2.0.0.tgz` obok tarballi 1.0.0, 1.1.0, 1.2.0.

## Zrobione w 2.0.0

- CC-046 ... CC-053 (przygotowane jako 1.2.1), CC-054 (400 przy `DELETE` nieznanego systemu), CC-055
  (`__Host-XSRF-TOKEN`), CC-056 (wzorce identyfikatorów per system, obowiązki zapytań), CC-057 (klasyfikacja
  GitLab i service desk), CC-058 (lint `virtualServer`), CC-059 (przypięty schemat, `static.json` tylko
  mapowanie), CC-060 (`PolicyStore`), CC-061 (każda wartość `resourceRefs`), CC-062 (wymagana klasyfikacja),
  CC-063 (`mcp-manifest`), CC-064 (503 w C4), CC-065 (ujemny wiek MFA), CC-066 (ochrona po restarcie),
  CC-067 (normalizacja klasyfikacji, wartość `restricted`).
- Przegląd 1.2.0: wszystkie punkty (H1 ... H4, M1 ... M7, L1 ... L7).
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
