# Klucze testowe - NOT FOR PRODUCTION

**Wszystkie klucze prywatne w tym katalogu są publiczne** (repozytorium, jar `test-vectors`, paczka npm).
Służą wyłącznie do podpisywania i weryfikacji wektorów testowych. Konfiguracja produkcyjna ani
lokalne środowisko deweloperskie poza testami nie mogą ich używać. Pliki prywatne mają w nazwie
`NOT-FOR-PRODUCTION`.

| Klucz | Algorytm | `kid` | Do czego |
| --- | --- | --- | --- |
| `test-gateway-jwt-a` | ES256 (P-256) | `test-gw-2026-10-a` | wewnętrzny JWT (C2), aktywny klucz A |
| `test-gateway-jwt-b` | ES256 (P-256) | `test-gw-2026-10-b` | wewnętrzny JWT (C2), aktywny klucz B (rotacja: dwa aktywne `kid`) |
| `test-attacker-jwt` | ES256 (P-256) | `test-attacker` | nie ma go w żadnym JWKS; wektory złego podpisu |
| `test-idp-corp` | ES256 (P-256) | `test-idp-corp` | udaje IdP (C1) w wektorze przekazania tokenu użytkownika do serwera |

Formaty: `*.private.jwk.json` / `*.public.jwk.json` (JWK), `*.private.pem` (PKCS#8), `*.public.pem` (SPKI).
`test-gateway-jwks.json` to JWKS gateway'a (klucze A i B) do podstawienia pod
`https://<gateway-internal>/.well-known/jwks.json` w testach; `test-idp-jwks.json` to JWKS testowego IdP.

`dev-gateway-jwks.json` (klucz publiczny pod `kid` `dev-gw-2026-10-a`; klucz prywatny został po wygenerowaniu wektorów odrzucony) modeluje klucz stosu dev (CC-137). Używać go wolno wyłącznie do wektorów:
właśnie dlatego odbiorca poza trybem dev odrzuca klucz `dev-` po samym prefiksie, a nie po odcisku. Nie jest opublikowanym kluczem testowym: jego
SPKI nie ma w `security/published-test-keys.json`, więc wektory `dev-*` odrzuca wyłącznie reguła prefiksu `dev-`. Od 7.0.0 nie ma kluczy do podpisu paczek polityk
(`test-policy-bundle`, `test-policy-overrides`, `dev-policy-bundle.pub.pem`): paczek już nie ma.

Klucze wygenerował `scripts/generate-test-keys.mjs`. Ponowne wygenerowanie unieważnia wszystkie podpisane
wektory (`jwt/`), więc skrypt odmawia nadpisania istniejących plików.
