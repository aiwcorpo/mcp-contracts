# Klucze testowe - NOT FOR PRODUCTION

**Wszystkie klucze prywatne w tym katalogu są publiczne** (repozytorium, jar `test-vectors`, paczka npm).
Służą wyłącznie do podpisywania i weryfikacji wektorów testowych. Konfiguracja produkcyjna ani
środowisko `mcp-platform-dev` poza testami nie mogą ich używać. Pliki prywatne mają w nazwie
`NOT-FOR-PRODUCTION`.

| Klucz | Algorytm | `kid` | Do czego |
| --- | --- | --- | --- |
| `test-gateway-jwt-a` | ES256 (P-256) | `test-gw-2026-10-a` | wewnętrzny JWT (C2), aktywny klucz A |
| `test-gateway-jwt-b` | ES256 (P-256) | `test-gw-2026-10-b` | wewnętrzny JWT (C2), aktywny klucz B (rotacja: dwa aktywne `kid`) |
| `test-attacker-jwt` | ES256 (P-256) | `test-attacker` | nie ma go w żadnym JWKS; wektory złego podpisu |
| `test-idp-corp` | ES256 (P-256) | `test-idp-corp` | udaje IdP (C1) w wektorze przekazania tokenu użytkownika do serwera |
| `test-policy-bundle` | Ed25519 | `test-policy-bundle` | podpis paczek polityk (C7) |
| `test-policy-overrides` | Ed25519 | `test-policy-overrides` | podpis paczek `overrides` (C7, osobny klucz) |

Formaty: `*.private.jwk.json` / `*.public.jwk.json` (JWK), `*.private.pem` (PKCS#8), `*.public.pem` (SPKI).
`test-gateway-jwks.json` to JWKS gateway'a (klucze A i B) do podstawienia pod
`https://<gateway-internal>/.well-known/jwks.json` w testach; `test-idp-jwks.json` to JWKS testowego IdP.

`dev-gateway-jwks.json` (klucz publiczny pod `kid` `dev-gw-2026-10-a`; klucz prywatny został po wygenerowaniu wektorów odrzucony) i `dev-policy-bundle.pub.pem`
(klucz Ed25519 z ustalonego, jawnego ziarna w generatorze, więc jego część prywatna jest odtwarzalna) modelują klucze stosu dev (CC-137). Używać ich wolno wyłącznie do wektorów:
właśnie dlatego odbiorca poza trybem dev odrzuca klucz `dev-` po samym prefiksie, a nie po odcisku. Nie są opublikowanymi kluczami testowymi: ich
SPKI nie ma w `security/published-test-keys.json`, więc wektory `dev-*` odrzuca wyłącznie reguła prefiksu `dev-`.

Klucze wygenerował `scripts/generate-test-keys.mjs`. Ponowne wygenerowanie unieważnia wszystkie podpisane
wektory (`jwt/`, `bundles/`), więc skrypt odmawia nadpisania istniejących plików.
