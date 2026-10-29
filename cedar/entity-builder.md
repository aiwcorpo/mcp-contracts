# Entity builder: specyfikacja (C7, C9)

Entity builder zamienia tożsamość wywołującego, wpis narzędzia, argumenty i mapowanie zakresów z paczki
polityk na żądanie Cedar (`principal`, `action`, `resource`, `context`) i listę encji. Gateway i starter muszą
robić to identycznie, bo oceniają te same polityki z tej samej paczki. Zgodność sprawdzają wektory w
`test-vectors/entity-builder/` (wejście -> oczekiwane wyjście), `test-vectors/policy-decisions/` (żądanie ->
decyzja) i `test-vectors/result-filter/` (filtrowanie wyników). Implementacja dla gateway'a i startera:
biblioteka `pl.aiwcorpo.mcp:mcp-cedar-entities` (`java/mcp-cedar-entities`, CC-019), której testy wykonują
wszystkie wektory. `scripts/lib/entity-builder.mjs` to druga, niezależna implementacja, z której generowane są
wektory.

Model encji: `mcp.cedarschema`. Decyzje: CC-001, CC-006, CC-027, CC-036, CC-037, CC-038, CC-056, CC-059, CC-061, CC-062, CC-065, CC-136, CC-146, CC-147, CC-149, CC-160.

## 1. Wejście

| Pole | Skąd | Uwagi |
| --- | --- | --- |
| `caller.sub`, `usr`, `grp`, `azp`, `vs?`, `vsc?`, `mfa?` | claimy C2 | nazwy jak w C2 także na gateway'u; `vs` i `vsc` zawsze razem (CC-027) |
| `tool.serverId`, `system`, `name`, `risk`, `action`, `resourceRefs` | zatwierdzony wpis rejestru (C5/C6) | gateway: z rejestru; starter: z własnego manifestu |
| `arguments` | `params.arguments` z `tools/call` | bez `confirmation_code` (C11) |
| `credentialType?` | gateway: odpowiedź brokera na `resolve`; serwer: z własnej konfiguracji, kontrakt nie dodaje nagłówka | `user-oauth`, `user-secret`, `token-exchange` albo `service-account`; opcjonalne, `EntityBuilder.withCredentialType`, CC-136 |
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
- `static.json` zawiera wyłącznie encje `UserGroup` z pustymi `attrs` (CC-059); paczka z innymi encjami jest
  odrzucana, a schemat paczki musi być schematem tej wersji kontraktów.
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

Identyfikator i rodzic zasobu to zawsze kanoniczne wartości zwrócone przez system (klucz projektu i zgłoszenia
Jiry, `path_with_namespace` GitLaba, klucz przestrzeni, nazwa indeksu, id kolejki), nigdy argument narzędzia:
argument mógł mieć inną wielkość liter (ścieżki GitLaba są nieczułe na wielkość liter) albo wskazywać zasób
przeniesiony. Resolver Confluence podaje `ancestorIds` (identyfikatory stron-przodków). Atrybut o wartości `null` oznacza
brak atrybutu.

Klasyfikacja (CC-057, CC-062, CC-067):

| Typ | Atrybut | Wymagany | Źródło w systemie |
| --- | --- | --- | --- |
| `Jira::Project` | `category` (napis, `""` gdy brak) | tak | kategoria projektu Jira |
| `Confluence::Space` | `labels` (zbiór) | tak | etykiety przestrzeni, pobrane z systemu (CC-149) |
| `OpenSearch::Index` | `tags` (zbiór) | tak | tagi indeksu: z systemu (metadane indeksu) albo z konfiguracji serwera OpenSearch MCP (CC-149) |
| `GitLab::Project` | `classification` (zbiór) | nie | topics projektu (GitLab API v4) |
| `GitLab::Group` | `classification` (zbiór) | nie | zawsze pusty zbiór albo brak: GitLab API v4 nie ma topics dla grup (decyzja 2026-10-28, klasyfikujemy projekty, nie grupy) |
| `GitLab::Group`, `GitLab::Project` | `ancestorClassifications` (mapa ścieżka grupy -> topics; wejście) -> `inheritedClassification` (zbiór; atrybut encji) | tak | topics grup-przodków, podane przez serwer ze ścieżki; w praktyce puste listy, bo grupy nie mają klasyfikacji (CC-129) |
| `ServiceDesk::Queue` | `classification` (zbiór) | nie | kategoria kolejki w adapterze service desku, jako lista napisów (CC-149) |

Źródło klasyfikacji podaje adapter, nie builder (CC-149). Etykiety, których system nie zwrócił w całości (lista dłuższa niż jedna odpowiedź, strona kolejna istnieje), są niepełne: adapter odrzuca taki zasób (fail-closed, `internal_error`), zamiast budować encję z częścią etykiet, bo brakująca etykieta `restricted` otworzyłaby zasób.

Zasób (także rodzic, np. projekt zgłoszenia) bez wymaganego atrybutu nie jest budowany (`internal_error`), więc
wywołanie jest odrzucane, a element wyniku pomijany. Builder normalizuje każdą wartość: `trim` (znaki <= U+0020) i
zamiana wyłącznie liter ASCII na małe; zbiory bez duplikatów. Wartość kanoniczna danych zastrzeżonych to
`restricted` we wszystkich systemach; polityki porównują tylko z nią. Zgłoszenie dziedziczy klasyfikację kolejki,
projekt GitLaba także klasyfikację grupy.

**Klasyfikacja przodków w GitLabie (CC-129, 3.1.0).** Topics w GitLabie się nie dziedziczą, a oznaczenie grupy
`restricted` ma chronić całe poddrzewo. Dlatego grupa i projekt GitLaba mają wymagany atrybut
`inheritedClassification` (zbiór): suma znormalizowanych topics **wszystkich** grup-przodków (dla grupy: grupy nad nią; dla
projektu: każda grupa na jego ścieżce, także rodzic; własne topics projektu zostają w `classification`; grupy GitLaba nie mają źródła klasyfikacji, więc `classification` grupy jest pusty, a `ancestorClassifications` serwer podaje ze ścieżki z pustymi listami. Atrybut zostaje w schemacie dla zgodności z 3.1.0). Serwer podaje je w
wejściu zasobu jako `attrs.ancestorClassifications`, mapę `<ścieżka grupy> -> [topics]` dokładnie dla grup przodków (dla
`hr/payroll/app`: klucze `hr` i `hr/payroll`; dla grupy najwyższego poziomu pusta mapa `{}`, podana jawnie). Builder
normalizuje topics jak w CC-067, liczy sumę i zapisuje `inheritedClassification`; wejście `ancestorClassifications` nie trafia do encji.
**Fail-closed:** brak mapy, klucze inne niż grupy przodków (brakująca albo nadmiarowa grupa, w tym sama grupa) albo topics, które nie
są listą napisów, to `internal_error` (zasób nie jest budowany). Dotyczy tylko tego atrybutu. Reguły `forbid` dla `restricted`
sprawdzają `inheritedClassification` (`cedar/examples/forbid-restricted.cedar`). Projekt zgłoszenia pochodzi z systemu, nigdy z klucza zgłoszenia (wektor
`srv-moved-issue-restricted`).

**Kontekst:**

| Pole | Wartość |
| --- | --- |
| `client` | `azp` (zawsze) |
| `virtualServer` | `vs`, tylko przy wywołaniu przez link |
| `vsScopes` | z `vsc`, tylko gdy jest niepusty; każde pole to zbiór `ResourceScope` (`jiraProjects` -> `Jira::Project/<id>` itd.) |
| `mfaAge` | `mfa`, tylko gdy claim jest |
| `credentialType` | typ poświadczenia użytego w wywołaniu, tylko gdy wywołujący builder go zna (CC-136); wartość spoza czterech typów to `internal_error` |
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
`invalid_argument` także dla ujemnego wieku MFA (CC-065), `internal_error` dla niespójnych danych platformy: `vs` bez `vsc` lub odwrotnie, nieznane pole `vsc` albo pole
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
   - Zakres wyklucza wszystko (`QueryConstraint.nothingToQuery()`, CC-147): wyszukiwanie i lista zwracają pusty wynik bez wołania systemu (to nie błąd), a pobranie jednego zasobu po id kończy się `not_found_or_denied`, tak samo jak zasób, którego użytkownik nie widzi.
2. Ocenia każdy zwrócony element przez `forResource` (`ResultFilter.allowed`); element niedozwolony, którego
   nie da się rozwiązać albo ocenić, jest pomijany. Pominięcie nie jest błędem wywołania.

Zapytanie buduje serwer ze struktury i rozwiązuje wzorce do nazw (CC-160):

- Serwer składa zapytanie z pól strukturalnych (pole, operator, wartość z listy dozwolonych), nigdy z surowego JQL, CQL
  ani DSL OpenSearch podanego przez model. Każda wartość jest cytowana (`\` i `"` poprzedzone `\`, znaki sterujące
  odrzucone), warunki użytkownika stoją w jednym nawiasie, a warunek zakresu dochodzi po nim przez `AND`, więc `OR`
  w wartości nie poszerza zakresu. `ORDER BY` przyjmuje tylko pole z listy i `ASC`/`DESC`. Pusty zakres to brak zapytania
  (patrz wyżej), nigdy zapytanie bez filtra. Wzorzec: `scripts/lib/query-rendering.mjs`, wektory
  `test-vectors/query-rendering/` (JQL i CQL z wrogimi wartościami, nawias, `ORDER BY`).
- OpenSearch: serwer nigdy nie wysyła do klucza wzorca typu `logs-team-a*`, bo wzorzec może objąć alias o takiej nazwie,
  który wskazuje indeksy innych zespołów (zliczenia i `hits.total` policzyłyby wtedy dane spoza zakresu). Najpierw
  rozwiązuje wzorzec `p,p-*` (`GET _resolve/index/<wzorzec>`) do konkretnych nazw indeksów, **pomijając aliasy i strumienie
  danych** (tylko wpisy `indices` odpowiedzi), zostawia nazwy równe prefiksowi albo zaczynające się od `<prefiks>-` i dopiero
  wtedy pyta po liście nazw. Alias lub strumień podany jako argument to `not_found_or_denied`. Dzięki temu agregaty
  i liczniki są policzone tylko na indeksach zakresu, a reguła wyłączająca `aggregate_logs` w paczce polityk może zniknąć
  dopiero po wdrożeniu tego w serwerze OpenSearch (ws-09 zdejmuje ją wtedy, nie wcześniej).

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
| `OpenSearch::Index` | `^[a-z0-9][a-z0-9._-]{0,254}$` | OpenSearch "Create index": małe litery, bez spacji, przecinków i `: " * + / \ \| ? # > <`, nie zaczyna się od `_` ani `-`; dodatkowo tylko ASCII, maks. 255 i początek litera lub cyfra, więc indeksy ukryte i systemowe (`.security`, `.kibana`, `.ds-*`) są poza wzorcem (CC-074); konkretna nazwa: bez aliasów-wzorców, wildcardów, list, date math) |
| `OpenSearch::Index` (zakres) | jak wyżej, bez końcowego `-` i `.` | prefiks nazwy |
| `ServiceDesk::Queue`, `ServiceDesk::Ticket` | `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$` | adapter generyczny (D10): alfabet zachowawczy; w kolejnych wersjach konfigurowalny per adapter |

## 9a. Dane zastane a wzorce

Wzorce są zachowawcze, więc część istniejących zasobów jest niedostępna przez MCP (fail-closed, odmowa jak dla
zasobu bez uprawnień): starsze ścieżki GitLaba ze znakiem `_` lub `.` na początku albo końcu segmentu, klucze
projektów Jiry dłuższe niż 10 znaków (przy zmienionym limicie w Jirze), przestrzenie osobiste Confluence (`~user`).
Ukryte i systemowe indeksy OpenSearch (`.nazwa`, w tym `.ds-*` strumieni danych) nie pasują do wzorca od 2.1.0 (CC-074): argument z taką nazwą to `invalid_argument`, zasób z resolvera to `internal_error`, prefiks z wiodącą kropką w mapowaniu zakresów odrzuca paczka. Strumienie danych jako zasób (nazwa strumienia, nie indeks zapasowy) to osobna decyzja w M2.

## 9b. Kolejność ocen i jedna odmowa dla zasobów (CC-146)

Odmowa dla zasobu ma jeden kod i jeden tekst, żeby jej treść ani moment nie zdradzały, czy zasób istnieje:

1. `not_found_or_denied` ma w C10 jeden stały `message`: `The resource does not exist or you do not have access to it.`
   Gateway używa tego samego tekstu dla narzędzia spoza linku (CC-118) i dla zasobu poza zakresem.
2. Kolejność: najpierw grant. Użytkownik bez grantu na typ zasobu (żadna grupa nie daje zakresu tego typu i polityka nie
   przyznaje dostępu) dostaje `not_found_or_denied` **przed** budową encji, przed odczytem klasyfikacji i przed każdym
   wywołaniem systemu, które mogłoby się nie udać. Dzięki temu `internal_error` (np. brak wymaganej klasyfikacji) nie
   ujawnia istnienia zasobu osobie, która i tak go nie widzi.
3. Kolejka service desku poza zakresem linku (argument `queueId` spoza `vsScopes`) to też `not_found_or_denied`,
   nie `access_denied`; w kontrakcie `access_denied` zostaje dla narzędzi, nie dla zasobów.

## 10. Każda wartość każdego `resourceRef` (CC-061)

Ocena na bramce sprawdza tylko typy płaskie, więc o zasobach hierarchicznych i o kontenerach decyduje serwer.
Serwer przed wykonaniem narzędzia:

1. Dla każdego argumentu z `resourceRefs` i dla każdej jego wartości (każdy element tablicy; źródło i cel, np.
   `projectPath` i `targetGroup` przy transferze lub forku) rozwiązuje zasób i ocenia go przez `forResource`.
2. Przy tworzeniu zasobu ocenia także kontener docelowy (grupę, projekt, przestrzeń, kolejkę), w którym zasób
   powstaje.
3. Wykonuje narzędzie tylko, gdy wszystkie oceny dały `allow`; jedna odmowa, błąd rozwiązania albo błąd oceny
   kończy wywołanie odmową (`not_found_or_denied` dla zasobów, C10). `ResultFilter.checkAll` sam wylicza wartości
   z `resourceRefs` i argumentów, rozwiązuje je przez resolver `(typ, id)` i zwraca powód odmowy;
   `ResultFilter.allAllowed` przyjmuje gotową listę zasobów (wywołujący odpowiada za jej kompletność).
4. Fail-closed (2.0.2): narzędzie z zadeklarowanymi `resourceRefs`, dla którego nie ma żadnej wartości zasobu
   (brak argumentu, pusta tablica) ani kontenera, jest odrzucane (`no_resource`); narzędzie listujące bez
   identyfikatorów korzysta z sekcji 8 (`queryConstraint` i filtrowanie wyników), nie z tej kontroli. Zasób z
   resolvera innego typu niż `resourceRef` (`resource_type_mismatch`), z id niezgodnym ze wzorcem
   (`resource_id_invalid`) albo brak zasobu (`not_resolved`) też dają odmowę. `allAllowed` z pustą listą zwraca
   `false`. Narzędzie bez `resourceRefs` nie ma tu czego oceniać: decyzję `call` podjął gateway.

Wektory: `test-vectors/resource-checks/`, decyzje `srv-transfer-target-outside-scope`, `srv-transfer-source-in-scope`.
