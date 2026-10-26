# Entity builder: specyfikacja (C7, C9)

Entity builder zamienia tożsamość wywołującego, wpis narzędzia i argumenty na żądanie Cedar
(`principal`, `action`, `resource`, `context`) i listę encji. Gateway i starter muszą robić to identycznie,
bo oceniają te same polityki z tej samej paczki. Zgodność sprawdzają wektory w
`test-vectors/entity-builder/` (wejście -> oczekiwane wyjście) i `test-vectors/policy-decisions/`
(żądanie -> decyzja). Implementacje referencyjne: `scripts/lib/entity-builder.mjs` (generuje wektory)
i `src/test/java/pl/aiwcorpo/mcp/contracts/cedar/ReferenceEntityBuilder.java` (wykonuje je w JUnit).
Propozycja publikacji implementacji Javy jako wspólnego artefaktu: CC-019.

Model encji: `mcp.cedarschema`. Uzupełnienia względem skrótu C7: CC-001, CC-006, CC-007.

## 1. Wejście

| Pole | Skąd | Uwagi |
| --- | --- | --- |
| `caller.sub`, `usr`, `grp`, `azp`, `vs?`, `mfa?` | claimy C2 | nazwy jak w C2 także na gateway'u |
| `tool.serverId`, `system`, `name`, `risk`, `action`, `resourceRefs` | zatwierdzony wpis rejestru (C5/C6) | gateway: z rejestru; starter: z własnego manifestu |
| `arguments` | `params.arguments` z `tools/call` | bez `confirmation_code` (C11) |
| `virtualServer.slug`, `resourceDefaults?` | baza wirtualnych serwerów gateway'a | tylko gdy jest `vs` |
| `resource` | resolver serwera (`@ResourceRef`) | tylko ocena na serwerze |

Gateway buduje `caller` z tokenu C1 tak samo, jak buduje claimy C2: `usr` = `preferred_username`,
`azp` = `azp`, `grp` = `groups` z prefiksem `mcp-`, `mfa` = sekundy od `auth_time`, gdy `acr` jest na
poziomie MFA (inaczej brak). Grupy muszą przychodzić bez ścieżki (Keycloak: mapper grup z
`full.path=false`); `/mcp-jira-read` nie jest rozpoznawane.

## 2. Principal

- UID: `User::"<sub>"`.
- Atrybuty: `username` = `usr`, `client` = `azp`, `mfaAge` = `mfa` (tylko gdy jest), `scopes` (niżej).
- Rodzice: `UserGroup::"<g>"` dla każdej grupy z `grp` zaczynającej się od `mcp-`; każda taka grupa jest też
  osobną encją bez atrybutów. Inne grupy są pomijane.

### `principal.scopes`

Grupa pasuje do wzorca `mcp-<system>-<rodzaj>-<id>`, gdzie `<system>` i `<rodzaj>` to małe litery,
a `<id>` to **cała reszta** napisu (może zawierać `-`, wielkość liter zachowana).

| Grupa | Pole `scopes` | Przykład |
| --- | --- | --- |
| `mcp-jira-proj-<key>` | `jiraProjects` | `mcp-jira-proj-ABC` -> `"ABC"` |
| `mcp-confluence-space-<key>` | `confluenceSpaces` | `mcp-confluence-space-ENG` -> `"ENG"` |
| `mcp-gitlab-grp-<path>` | `gitlabGroups` | `mcp-gitlab-grp-team-a` -> `"team-a"` |
| `mcp-opensearch-idx-<prefix>` | `opensearchIndexPrefixes` | `mcp-opensearch-idx-logs-team-a` -> `"logs-team-a"` |
| `mcp-servicedesk-queue-<id>` | `servicedeskQueues` | `mcp-servicedesk-queue-42` -> `"42"` |

Wszystkie pięć pól jest zawsze obecnych (pusty zbiór = brak zakresu). Grupy uprawnień
(`mcp-jira-read`), `mcp-client-*`, `mcp-platform-admin` i grupy o nieznanym systemie lub rodzaju nie
dodają zakresu.

## 3. Akcja i zasób

**Gateway:** `Action::"call"`, zasób `Tool::"<system>__<name>"` z atrybutami `server` = `serverId`,
`name` = nazwa po stronie serwera, `risk`. Narzędzie spoza rejestru nie ma encji `Tool`; gateway i tak
odmawia przed Cedar (fail-closed), a wektor `gw-unknown-tool` pokazuje, że polityki też dają `deny`.

**Serwer:** `Action::"<tool.action>"` (`read`, `update`, `delete`, `admin`), zasób = encja rozwiązana przez
resolver z atrybutami pobranymi z systemu. Builder dokłada:

| Typ | Atrybut dodany przez builder |
| --- | --- |
| `Jira::Issue` | `project` = referencja do rodzica `Jira::Project` |
| `Confluence::Page` | `space` = referencja do rodzica `Confluence::Space` |
| `GitLab::Project` | `group` = referencja do rodzica `GitLab::Group` |
| `ServiceDesk::Ticket` | `queue` = referencja do rodzica `ServiceDesk::Queue` |
| `OpenSearch::Index` | `namePrefixes` = prefiksy nazwy kończące się przed `-` i pełna nazwa |

Rodzic jest też w `parents` i jest osobną encją (z atrybutami z systemu). Przykład `namePrefixes` dla
`logs-team-a-2026.10`: `logs`, `logs-team`, `logs-team-a`, `logs-team-a-2026.10`.

Projekt, do którego należy zgłoszenie, pochodzi z systemu, nigdy z klucza zgłoszenia (`ABC-123`
przeniesione do `HR` jest w `HR`, wektor `srv-moved-issue-restricted`).

## 4. Kontekst

| Pole | Wartość |
| --- | --- |
| `client` | `azp` (zawsze) |
| `virtualServer` | `vs`, tylko przy wywołaniu przez link |
| `vsScopes` | tylko przy linku z niepustym `resourceDefaults`; klucz typu -> pole jak w tabeli niżej |
| `mfaAge` | `mfa`, tylko gdy claim jest |
| `refs` | zawsze (może być `{}`) |

`resourceDefaults` -> `vsScopes`: `Jira::Project` -> `jiraProjects`, `Confluence::Space` -> `confluenceSpaces`,
`GitLab::Group` -> `gitlabGroups`, `OpenSearch::Index` -> `opensearchIndexPrefixes`, `ServiceDesk::Queue` ->
`servicedeskQueues`. Inny klucz to błąd konfiguracji linku (`internal_error`, odmowa). Brak pola w
`vsScopes` znaczy, że link tego typu nie zawęża.

### `context.refs`

Dla każdego `resourceRef {argument, type}` narzędzia pole `refs.<namespace małymi literami><Typ>`
(`Jira::Project` -> `jiraProject`, `GitLab::Group` -> `gitlabGroup`, `OpenSearch::Index` ->
`opensearchIndex`, `ServiceDesk::Ticket` -> `servicedeskTicket`) dostaje identyfikatory z argumentu:

| Wartość argumentu | Identyfikatory |
| --- | --- |
| brak lub `null` | żadne (pole i tak jest obecne, pusty zbiór) |
| napis | ten napis |
| liczba całkowita | zapis dziesiętny (`4711` -> `"4711"`) |
| tablica napisów / liczb całkowitych | każdy element jak wyżej |
| cokolwiek innego | błąd `invalid_argument`, wywołanie odrzucone |

Kilka argumentów tego samego typu trafia do jednego zbioru. Argument jest szukany tylko na najwyższym
poziomie `arguments` (nazwa z `resourceRefs`). Builder nie przenosi do kontekstu żadnych innych
argumentów. Gateway nie wyprowadza projektu z klucza zgłoszenia.

## 5. Format wyjścia i kolejność

Wyjście to JSON w formacie Cedar: UID jako `{"type", "id"}`, encje jako `{"uid", "attrs", "parents"}`,
referencje w atrybutach jako `{"__entity": {"type", "id"}}`, zbiory jako tablice. Żeby wynik dało się
porównać tekstowo, zbiory są posortowane bez duplikatów, a encje posortowane po `type`, potem po `id`
(porównanie po jednostkach UTF-16, jak `String.compareTo` w Javie i `<` w JavaScript). Encje akcji nie są
dołączane.

## 6. Błędy

Każdy błąd buildera kończy się odmową wywołania, nigdy oceną z niepełnym kontekstem:
`invalid_argument` dla złego argumentu-identyfikatora (C10), `internal_error` dla niespójnej konfiguracji
(brak definicji linku dla `vs`, nieobsługiwany typ w `resourceDefaults`, brak rodzica przy encji, która go
wymaga).

## 7. Wektory

`test-vectors/entity-builder/*.json`:

```json
{
  "description": "...",
  "level": "gateway | server",
  "input": { "caller": {}, "tool": {}, "arguments": {}, "virtualServer": {}, "resource": {} },
  "expected": { "principal": {}, "action": {}, "resource": {}, "context": {}, "entities": [] }
}
```

albo `"expected": {"error": "invalid_argument"}`. Test implementacji: zbuduj wynik z `input` i porównaj
z `expected` jako JSON.

`test-vectors/policy-decisions/*.json` mają gotowe `request` i `entities` (wyjście buildera) oraz
`expected: {decision: "allow" | "deny", determiningPolicies: [@id ...]}`. Polityki: wszystkie pliki
`cedar/examples/*.cedar`, każda polityka identyfikowana adnotacją `@id`. `covers` oznacza przypadki
wymagane przez DoD ws-00.
