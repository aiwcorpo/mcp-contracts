# Entity builder: specyfikacja (C7, C9)

Entity builder zamienia tożsamość wywołującego, wpis narzędzia, argumenty i mapowanie zakresów z paczki
polityk na żądanie Cedar (`principal`, `action`, `resource`, `context`) i listę encji. Gateway i starter muszą
robić to identycznie, bo oceniają te same polityki z tej samej paczki. Zgodność sprawdzają wektory w
`test-vectors/entity-builder/` (wejście -> oczekiwane wyjście), `test-vectors/policy-decisions/` (żądanie ->
decyzja) i `test-vectors/result-filter/` (filtrowanie wyników). Implementacja dla gateway'a i startera:
biblioteka `pl.aiwcorpo.mcp:mcp-cedar-entities` (`java/mcp-cedar-entities`, CC-019), której testy wykonują
wszystkie wektory. `scripts/lib/entity-builder.mjs` to druga, niezależna implementacja, z której generowane są
wektory.

Model encji: `mcp.cedarschema`. Decyzje: CC-001, CC-006, CC-027, CC-036, CC-037, CC-038, CC-056.

## 1. Wejście

| Pole | Skąd | Uwagi |
| --- | --- | --- |
| `caller.sub`, `usr`, `grp`, `azp`, `vs?`, `vsc?`, `mfa?` | claimy C2 | nazwy jak w C2 także na gateway'u; `vs` i `vsc` zawsze razem (CC-027) |
| `tool.serverId`, `system`, `name`, `risk`, `action`, `resourceRefs` | zatwierdzony wpis rejestru (C5/C6) | gateway: z rejestru; starter: z własnego manifestu |
| `arguments` | `params.arguments` z `tools/call` | bez `confirmation_code` (C11) |
| mapowanie zakresów | `entities/static.json` załadowanej paczki głównej | `ScopeMapping.fromStaticEntities`, CC-037 |
| `resource` | resolver serwera (`@ResourceRef`) albo element wyniku wyszukiwania | tylko ocena na serwerze |

Gateway buduje `caller` z tokenu C1 tak samo, jak buduje claimy C2: `usr` = `preferred_username`,
`azp` = `azp`, `grp` = `groups` z prefiksem `mcp-`, `mfa` = sekundy od `auth_time`, gdy `acr` jest na
poziomie MFA (inaczej brak). Dla wywołania przez link gateway ustawia `vs` = slug i `vsc` = `resourceDefaults`
linku przemapowane na pola `vsScopes` (tabela w sekcji 4; `{}`, gdy link nie zawęża zasobów; maks. 50
identyfikatorów na pole; `VirtualServerScope.fromResourceDefaults`). Serwer czyta zawężenie wyłącznie z `vsc`
(`VirtualServerScope.fromClaims`). Grupy muszą przychodzić bez ścieżki (Keycloak: mapper grup z
`full.path=false`).

## 2. Mapowanie zakresów (dane paczki, CC-037)

`entities/static.json` paczki głównej zawiera encje `UserGroup`, których rodzicami są encje `ResourceScope`.
Id zakresu: `<Typ>/<id>`.

| Id zakresu | Co obejmuje |
| --- | --- |
| `Jira::Project/ABC` | projekt ABC i jego zgłoszenia |
| `Confluence::Space/ENG` | przestrzeń ENG i jej strony |
| `Confluence::Page/1000` | strona 1000 i całe drzewo stron pod nią |
| `GitLab::Group/team-a` | grupa `team-a`, wszystkie jej podgrupy (`team-a/sub`) i projekty; nie `team-ab` |
| `OpenSearch::Index/logs-team-a` | indeksy `logs-team-a` i `logs-team-a-*`; nie `logs-team-ab` |
| `ServiceDesk::Queue/42` | kolejka 42 i jej zgłoszenia |

Przykład (`cedar/examples/static-entities.json`):

```json
[
  {"uid": {"type": "UserGroup", "id": "mcp-gitlab-grp-team-a"}, "attrs": {},
   "parents": [{"type": "ResourceScope", "id": "GitLab::Group/team-a"}]},
  {"uid": {"type": "UserGroup", "id": "mcp-team-platform"}, "attrs": {},
   "parents": [{"type": "ResourceScope", "id": "Jira::Project/PLAT"},
               {"type": "ResourceScope", "id": "GitLab::Group/platform"},
               {"type": "ResourceScope", "id": "OpenSearch::Index/logs-platform"}]}
]
```

Reguły:

- Grupa bez wpisu nie daje żadnego zakresu (fail-closed). Nazwa grupy nie musi kodować ścieżki
  (`mcp-team-platform`); konwencja C9 (`mcp-<system>-<rodzaj>-<id>`) zostaje jako zalecenie i może służyć
  potokowi ws-09 do generowania wpisów, ale builder nie wyprowadza niczego z nazwy.
- Dopasowanie nazwy grupy jest dokładne: wielkość liter, separatory i spacje mają znaczenie
  (`mcp-jira-proj-abc` to inna grupa niż `mcp-jira-proj-ABC`).
- Rodzic inny niż `ResourceScope`, id bez `/`, z pustą częścią po `/`, z typem spoza tabeli albo grupa podana
  dwa razy -> paczka odrzucona (`static_entities_invalid`).
- Lokalna część id zakresu musi pasować do wzorca typu (sekcja 9); prefiks OpenSearch nie może kończyć się na
  `-` ani `.`, więc `logs-` nie jest poprawnym zakresem (gdyby był, objąłby np. `logs--x`).

## 3. Principal

- UID: `User::"<sub>"`; atrybuty: `username` = `usr`, `client` = `azp`, `mfaAge` = `mfa` (tylko gdy jest),
  `scopes`.
- Rodzice: `UserGroup::"<g>"` dla każdej grupy z `grp` zaczynającej się od `mcp-`. Każda taka grupa jest
  osobną encją z rodzicami `ResourceScope` z mapowania (bez rodziców, gdy grupa nie jest zmapowana). Dlatego
  `principal in ResourceScope::"GitLab::Group/team-a"` jest prawdą dla członka zmapowanej grupy.
- `principal.scopes`: pięć pól (`jiraProjects`, `confluenceSpaces`, `gitlabGroups`, `opensearchIndexPrefixes`,
  `servicedeskQueues`), każde to zbiór `ResourceScope` danego typu przyznanych przez grupy użytkownika (tylko
  same korzenie, bez hierarchii). Zakresy `Confluence::Page` działają wyłącznie przez `in`.

## 4. Akcja, zasób i kontekst

**Gateway:** `Action::"call"`, zasób `Tool::"<system>__<name>"` z atrybutami `server` = `serverId`,
`name` = nazwa po stronie serwera, `risk`. Narzędzie spoza rejestru nie ma encji `Tool`; gateway odmawia
przed Cedar, a wektor `gw-unknown-tool` pokazuje, że polityki też dają `deny`.

**Serwer:** `Action::"<tool.action>"`, zasób = encja rozwiązana przez resolver z atrybutami z systemu. Builder
dokłada referencję do rodzica (`Jira::Issue.project`, `Confluence::Page.space`, `GitLab::Project.group`,
`ServiceDesk::Ticket.queue`; rodzic jest też w `parents` i jest osobną encją) oraz `scopes`:

| Typ | `scopes` |
| --- | --- |
| `Jira::Project` / `Jira::Issue` | `Jira::Project/<klucz projektu>` |
| `Confluence::Space` | `Confluence::Space/<klucz>` |
| `Confluence::Page` | `Confluence::Space/<klucz przestrzeni>`, `Confluence::Page/<a>` dla każdego `ancestorIds`, `Confluence::Page/<id>` |
| `GitLab::Group` | `GitLab::Group/<p>` dla każdego prefiksu ścieżki po `/` (`team-a`, `team-a/sub`) |
| `GitLab::Project` | jak grupa-rodzic |
| `OpenSearch::Index` | `OpenSearch::Index/<p>` dla każdego prefiksu nazwy kończącego się przed `-` i pełnej nazwy |
| `ServiceDesk::Queue` / `ServiceDesk::Ticket` | `ServiceDesk::Queue/<id kolejki>` |

Resolver Confluence podaje `ancestorIds` (identyfikatory stron-przodków). Atrybut o wartości `null` oznacza
brak atrybutu. Projekt zgłoszenia pochodzi z systemu, nigdy z klucza zgłoszenia (wektor
`srv-moved-issue-restricted`).

**Kontekst:**

| Pole | Wartość |
| --- | --- |
| `client` | `azp` (zawsze) |
| `virtualServer` | `vs`, tylko przy wywołaniu przez link |
| `vsScopes` | z `vsc`, tylko gdy jest niepusty; każde pole to zbiór `ResourceScope` (`jiraProjects` -> `Jira::Project/<id>` itd.) |
| `mfaAge` | `mfa`, tylko gdy claim jest |
| `refs` | zawsze (może być `{}`) |

`resourceDefaults` -> `vsc`: `Jira::Project` -> `jiraProjects`, `Confluence::Space` -> `confluenceSpaces`,
`GitLab::Group` -> `gitlabGroups`, `OpenSearch::Index` -> `opensearchIndexPrefixes`, `ServiceDesk::Queue` ->
`servicedeskQueues`. Brak pola znaczy, że link tego typu nie zawęża.

`context.vsScopes` wolno czytać wyłącznie w regułach `forbid` (CC-041); paczka z `permit` czytającym `vsScopes`
jest odrzucana. Paczka (ws-09) musi zawężać linki dla **każdego** z pięciu typów i ich typów podrzędnych
(wzór: `cedar/examples/virtual-server.cedar`, `!context.vsScopes.<pole>.containsAny(resource.scopes)`);
brak reguły cicho poszerza link.

### `context.refs`

Dla każdego `resourceRef {argument, type}` narzędzia pole `refs.<namespace małymi literami><Typ>`
(`Jira::Project` -> `jiraProject`, `GitLab::Group` -> `gitlabGroup`, `OpenSearch::Index` -> `opensearchIndex`)
dostaje identyfikatory z argumentu. Dla typów płaskich zakresów (`Jira::Project`, `Confluence::Space`,
`GitLab::Group`, `ServiceDesk::Queue`) to zbiór `ResourceScope` (`Jira::Project/ABC`), dla pozostałych zbiór
napisów.

| Wartość argumentu | Identyfikatory |
| --- | --- |
| brak lub `null` | żadne (pole i tak jest obecne, pusty zbiór) |
| napis | ten napis, bez normalizacji (wielkość liter, spacje zostają) |
| liczba o wartości całkowitej | zapis dziesiętny (`4711` i `4711.0` -> `"4711"`) |
| tablica napisów / liczb całkowitych | każdy element jak wyżej |
| cokolwiek innego | błąd `invalid_argument`, wywołanie odrzucone |

Kilka argumentów tego samego typu trafia do jednego zbioru. Argument jest szukany tylko na najwyższym poziomie
`arguments`; manifest musi go deklarować w `inputSchema` (CC-043). Gateway sprawdza zakres wcześnie tylko dla
typów płaskich; typy hierarchiczne i identyfikatory, których kontener znany jest dopiero po rozwiązaniu
(klucz zgłoszenia, ścieżka projektu), sprawdza serwer.

## 5. Format wyjścia i kolejność

JSON w formacie Cedar: UID `{"type", "id"}`, encje `{"uid", "attrs", "parents"}`, referencje w atrybutach
`{"__entity": {"type", "id"}}`, zbiory jako tablice. Zbiory posortowane bez duplikatów (zbiory encji po `id`),
encje posortowane po `type`, potem po `id` (porównanie po jednostkach UTF-16). Encje akcji i `ResourceScope`
nie są dołączane (wystarczą krawędzie `parents`).

## 6. Błędy

Każdy błąd buildera kończy się odmową wywołania: `invalid_argument` dla złego argumentu-identyfikatora (C10),
`internal_error` dla niespójnych danych platformy: `vs` bez `vsc` lub odwrotnie, nieznane pole `vsc` albo pole
z 0 lub ponad 50 identyfikatorami, nieobsługiwany typ w `resourceDefaults` lub `resourceRefs`, `risk` spoza
`READ_ONLY`/`UPDATE`/`DESTRUCTIVE`, `action` spoza `read`/`update`/`delete`/`admin`, liczba poza zakresem
Cedar `Long`, brak rodzica przy encji, która go wymaga.

## 7. Wektory

`test-vectors/resource-ids/*.json`: identyfikatory poprawne i niepoprawne dla wzorców z sekcji 9.


`test-vectors/entity-builder/*.json`: `{description, level, staticEntities, input, expected}`; `expected` to
wyjście buildera albo `{"error": "<kod>"}`. `staticEntities` to ścieżka pliku mapowania względem korzenia
repozytorium.

`test-vectors/policy-decisions/*.json`: gotowe `request` i `entities`, wejście buildera w `builder` (`level`,
`staticEntities`, `input`, ewentualnie `adjustment: remove-tool-entity`) i `expected: {decision,
determiningPolicies}`. Polityki: wszystkie pliki `cedar/examples/*.cedar` (id z adnotacji `@id`). `covers`
oznacza przypadki wymagane przez DoD i przeglądy.

`test-vectors/result-filter/*.json`: wejście wywołania, elementy zwrócone przez system (`items`), oczekiwane
zachowane elementy i ograniczenia zapytania (`queryConstraints`).

## 8. Wyszukiwanie i listy (CC-036)

Narzędzie zwracające wiele elementów (wyszukiwanie, lista) nie może polegać na ocenie bramki, bo bez
argumentu-identyfikatora `refs` są puste. Serwer:

1. Ogranicza zapytanie do systemu: `EntityBuilder.queryConstraint(caller, typ)` daje identyfikatory zawężenia
   linku (`virtualServer`, typu `virtualServerType`) i identyfikatory przyznane przez mapowanie (`granted`).
   Zawężenie linku trafia do zapytania zawsze; przyznane zakresy także tam, gdzie system nie egzekwuje uprawnień
   użytkownika (OpenSearch). Oba warunki łączy AND.
   - `virtualServer` puste: link nie zawęża tego typu (albo brak linku), bez warunku zawężenia. Dla
     `Confluence::Page` zawężenie pochodzi z przestrzeni linku (`virtualServerType = Confluence::Space`).
   - `granted` puste: użytkownik nie ma żadnego zakresu tego typu. Tam, gdzie zapytanie jest ograniczane do
     zakresów (OpenSearch), serwer **nie wykonuje zapytania** i zwraca pustą listę; puste `granted` nigdy nie
     znaczy "bez filtra".
   - Identyfikatory pasują do wzorców z sekcji 9, ale serwer i tak je cytuje: JQL `project in ("ABC", "DEF")`
     i CQL `space in ("ENG")` z każdym identyfikatorem w cudzysłowach, z `\` przed `"` i `\`; nigdy przez
     sklejanie bez cudzysłowów.
   - OpenSearch: dla każdego prefiksu `p` kanoniczny wzorzec indeksów to `p,p-*` (indeks o nazwie `p` i indeksy
     zaczynające się od `p-`); nigdy `p*` (obejmowałoby `p` z innym ciągiem dalej, np. `logs-team-ab` dla
     `logs-team-a`). Lista dla wielu prefiksów to suma takich par; agregacje, `hits.total` i `_count` liczone są
     tylko na tym wzorcu, bo filtrowanie wyników nie poprawia agregatów.
2. Ocenia każdy zwrócony element przez `forResource` (`ResultFilter.allowed`); element niedozwolony, którego
   nie da się rozwiązać albo ocenić, jest pomijany. Pominięcie nie jest błędem wywołania.

Ograniczenie zapytania nie zastępuje filtrowania: filtrowanie jest kontrolą, zapytanie tylko oszczędza
ruch i nie ujawnia liczby elementów spoza zakresu.

## 9. Wzorce identyfikatorów (CC-056)

Każdy identyfikator zasobu ma wzorzec zgodny z dokumentacją systemu (`schemas/common.schema.json`,
`ResourceIdPatterns`; w Javie `ResourceIds`). Wzorzec obowiązuje w: argumentach narzędzi (`refs`, błąd
`invalid_argument`), zasobach z resolvera (`internal_error`), `resourceDefaults` (C5, walidacja schematu),
claimie `vsc` (C2, 401) i id zakresów w `static.json` (odrzucenie paczki).

| Typ | Wzorzec | Źródło |
| --- | --- | --- |
| `Jira::Project` | `^[A-Z][A-Z0-9_]{1,9}$` | Jira DC "Changing the project key format": pierwsza litera, wielkie litery, cyfry, `_`; domyślny maks. rozmiar klucza 10 |
| `Jira::Issue` | `^[A-Z][A-Z0-9_]{1,9}-[1-9][0-9]{0,9}$` | klucz projektu + `-` + numer zgłoszenia |
| `Confluence::Space` | `^[A-Za-z0-9]{1,255}$` | Confluence DC "Space keys": tylko znaki alfanumeryczne, do 255; przestrzenie osobiste (`~user`) wyłączone |
| `Confluence::Page` | `^[1-9][0-9]{0,18}$` | id treści Confluence (liczba 64-bitowa) |
| `GitLab::Group` | segmenty `[A-Za-z0-9](?:[._-]?[A-Za-z0-9])*` rozdzielone `/`, 1..20, bez końcówki `.git`/`.atom`, maks. 1024 | GitLab "Reserved project and group names" (litery, cyfry, `_`, `.`, `-`; początek i koniec litera/cyfra; bez kolejnych znaków specjalnych; bez `.git`/`.atom`), "Subgroups": do 20 poziomów |
| `GitLab::Project` | jak grupa, 2..21 segmentów | ścieżka grupy + ścieżka projektu |
| `OpenSearch::Index` | `^(?!\.{1,2}$)[a-z0-9.][a-z0-9._-]{0,254}$` | OpenSearch "Create index": małe litery, bez spacji, przecinków i `: " * + / \ \| ? # > <`, nie zaczyna się od `_` ani `-`; dodatkowo tylko ASCII i maks. 255 (konkretna nazwa: bez aliasów-wzorców, wildcardów, list, date math) |
| `OpenSearch::Index` (zakres) | jak wyżej, bez końcowego `-` i `.` | prefiks nazwy |
| `ServiceDesk::Queue`, `ServiceDesk::Ticket` | `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$` | adapter generyczny (D10): alfabet zachowawczy; w kolejnych wersjach konfigurowalny per adapter |
