# Entity builder: specyfikacja (C7, C9)

Entity builder zamienia tożsamość wywołującego, wpis narzędzia, argumenty, deklaracje typów zasobów i mapowanie zakresów
na żądanie Cedar (`principal`, `action`, `resource`, `context`) i listę encji. Gateway i starter muszą robić to
identycznie, bo oceniają polityki z tych samych danych. Zgodność sprawdzają wektory w `test-vectors/entity-builder/`
(wejście -> oczekiwane wyjście), `test-vectors/policy-decisions/` (żądanie -> decyzja), `test-vectors/result-filter/`
(filtrowanie wyników), `test-vectors/resource-checks/` (każda wartość każdego `resourceRef`) i `test-vectors/resource-ids/`
(wzorce deklaracji). Implementacja dla gateway'a i startera: biblioteka `pl.aiwcorpo.mcp:mcp-cedar-entities`
(`java/mcp-cedar-entities`, CC-019), której testy wykonują wszystkie wektory. `scripts/lib/entity-builder.mjs` to druga,
niezależna implementacja, z której generowane są wektory.

**Od 7.0.0 builder nie zna żadnego systemu, serwera ani typu zasobu.** Wszystko, co wie o typie zasobu, pochodzi z
deklaracji `resourceTypes` w manifeście serwera (sekcja 2). Lista systemów i serwerów jest danymi uruchomieniowymi
gatewaya i brokera, a polityki serwera są częścią jego manifestu (sekcja 6).

Model encji: `mcp.cedarschema` (schemat bazowy, bez systemów) razem z fragmentem serwera. Decyzje: CC-001, CC-006, CC-036,
CC-037, CC-038, CC-056, CC-061, CC-062, CC-065, CC-136, CC-146, CC-147, CC-149, CC-160, CC-173, CC-229 ... CC-236.

## 1. Wejście

| Pole | Skąd | Uwagi |
| --- | --- | --- |
| `caller.sub`, `usr`, `grp`, `azp`, `mfa?` | claimy C2 | nazwy jak w C2 także na gateway'u |
| `tool.serverId`, `system`, `name`, `risk`, `action`, `resourceRefs` | zatwierdzony wpis rejestru (C5/C6) | gateway: z rejestru; starter: z własnego manifestu |
| `arguments` | `params.arguments` z `tools/call` | bez `confirmation_code` (C11) |
| `credentialType?` | gateway: typ domyślny systemu z konfiguracji serwera (`credential.type`, Cedar jest oceniany przed pytaniem brokera, więc typ faktycznie użyty nie jest jeszcze znany; system nie miesza `service-account` z typami użytkownika), podawane zawsze przed decyzją Cedar; serwer: typ domyślny to pierwszy z jego `accepted-credential-types`; nagłówek `X-MCP-Credential-Type` od gateway'a musi należeć do zbioru jego dozwolonych typów (brak, nieznana wartość albo wartość spoza zbioru przy żądaniu z `X-MCP-Credential` = odmowa `internal_error` przed Cedar, sondą grantu i resolverami, CC-166) | `user-oauth`, `user-secret`, `token-exchange` albo `service-account`; opcjonalne, `EntityBuilder.withCredentialType`, CC-136 |
| deklaracje typów | `resourceTypes` zarejestrowanych manifestów | `ResourceTypes`; gateway składa je ze wszystkich serwerów (`ResourceTypes.union`), serwer buduje je z własnego manifestu |
| mapowanie zakresów | dane polityki gatewaya (`scopeMapping`, sekcja 3) | `ScopeMapping`; gateway wysyła je serwerowi (`POST /.well-known/mcp-policy-data`, C14) |
| `resource` | resolver serwera (`@ResourceRef`) albo element wyniku wyszukiwania | tylko ocena na serwerze |

Gateway buduje `caller` z tokenu C1 tak samo, jak buduje claimy C2: `usr` = `preferred_username`,
`azp` = `azp`, `grp` = `groups` z prefiksem `mcp-`, `mfa` = sekundy od `auth_time`, gdy `acr` jest na
poziomie MFA (inaczej brak). Filtr adresu (`/mcp?systems=...`, CC-170) nie jest wejściem buildera: zawęża listę i
wywołanie na gateway'u przed Cedar, a serwer go nie dostaje (CC-173). Grupy muszą przychodzić bez ścieżki (Keycloak: mapper grup z
`full.path=false`). Dozwoleni klienci AI (`azp`) nie są polityką Cedar: lista z konfiguracji gatewaya
(`MCP_ALLOWED_CLIENTS`) jest sprawdzana w kodzie przed Cedar, przez gateway i przez starter (z danych polityki).

## 2. Deklaracje typów zasobów (`resourceTypes`)

Każdy typ zasobu serwera ma wpis w `resourceTypes` manifestu (`schemas/server-manifest.schema.json`,
`$defs/ResourceTypeDeclaration`). Typ istnieje, gdy zarejestrowany serwer go zadeklarował; nie ma typów wbudowanych.

| Pole | Znaczenie |
| --- | --- |
| `type` | `<Przestrzeń>::<Nazwa>` (`^[A-Z][A-Za-z0-9]{0,30}::[A-Z][A-Za-z0-9]{0,30}$`); przestrzeń to przestrzeń Cedar serwera, wspólna dla wszystkich jego typów i równa `policies.namespace` |
| `attributes` | atrybuty, które wypełnia resolver (nazwy `^[a-z][A-Za-z0-9]*$`), bez atrybutu rodzica i bez `scopes`, które dokłada builder |
| `parent`, `parentAttribute` | typ rodzica (zadeklarowany w tym samym manifeście i tej samej przestrzeni) i atrybut Cedar, w którym leży encja rodzica; występują razem albo wcale |
| `idPattern` | wymagany; zakotwiczone wyrażenie regularne (`^...$`, bez alternatywy na najwyższym poziomie) dla identyfikatorów tego typu; obowiązuje w argumentach narzędzi (`invalid_argument`) i w zasobach z resolvera (`internal_error`) |
| `scopePattern` | zakotwiczone wyrażenie regularne lokalnej części id zakresu, który można przyznać; brak = typu nie da się przyznać w mapowaniu |
| `earlyScopeCheck` | domyślnie `false`; gdy `true`, gateway wkłada id argumentu tego typu do `context.refs` (sekcja 5); tylko dla typów, których zakres jest dokładnym id, więc wymaga `scopePattern` |
| `classification` | `{attribute, kind: "string"\|"set", required}`; atrybut, który builder normalizuje (sekcja 5) |

Wzorce piszemy we wspólnym podzbiorze wyrażeń regularnych Javy i ECMAScript (wektory generuje implementacja
JavaScript, a wykonuje Java); dopasowanie dotyczy całego identyfikatora. Wartość z `\n` na końcu (`"ABC\n"`) nie
pasuje, bo dopasowanie jest do całości. Wzorzec, który nie jest zakotwiczony, nie kompiluje się albo wykracza poza gramatykę
poniżej, odrzuca rejestracja manifestu (`resource_types_invalid`).

**Gramatyka wzorców (ochrona przed ReDoS).** Wzorzec stosuje się do identyfikatorów wybieranych przez klienta, więc dopasowanie musi
być liniowe. Wzorzec ma najwyżej 512 znaków, nie ma odwołań wstecznych (`\1`, `\k`), nie ma lookaround (`(?=`, `(?!`, `(?<=`, `(?<!`),
nie stosuje kwantyfikatora do grupy, która sama zawiera kwantyfikator (`^(.*a){12}$`, `^(a+)+$`), a grupa z kwantyfikatorem i
alternatywami ma alternatywy zaczynające się od rozłącznych znaków (`(a|aa)+` odpada, `(?:[._-][a-z]|[a-z])*` jest dobre).
Identyfikator albo lokalna część zakresu dłuższa niż 1024 znaki jest nieważna jeszcze przed dopasowaniem (`ResourceTypes.MAX_ID_LENGTH`),
więc długości nie trzeba wpisywać we wzorzec. Implementacje: `PatternGrammar` (mcp-manifest) i `grammarViolation` w
`scripts/lib/manifest-rules.mjs`; reguła `resource-types-valid`.

Reguły spójności sprawdza rejestracja (`ManifestRules`, reguły `resource-types-declared`, `resource-types-valid`,
`resource-types-namespace`): typ zadeklarowany raz; `parent` zadeklarowany; `attributes` bez `scopes` i bez atrybutu rodzica;
`earlyScopeCheck` z `scopePattern`; atrybut klasyfikacji wśród `attributes`; wszystkie typy w jednej przestrzeni, równej
`policies.namespace`. Dwa serwery nie mogą zadeklarować tego samego typu (`ResourceTypes.union` zgłasza błąd; gateway
odpowiada `namespace_conflict`). Biblioteka: `ResourceTypes.of(...)`, `ResourceTypes.fromJson(<tablica z manifestu>)`.

Wiedza o dawnych systemach wbudowanych (wzorce id, klasyfikacje) jest teraz danymi w przykładach:
`cedar/examples/systems/{jira,confluence,gitlab,opensearch,servicedesk}/resource-types.json` (z odpowiadającymi
`schema.cedarschema`; pełny fragment z politykami ma tylko Jira) i w neutralnym fixture `test-vectors/fixtures/notes/`.

## 3. Mapowanie zakresów (dane administratora)

Mapowanie grupa -> zakresy to dane administratora zapisane w gatewayu (`PUT /admin/v1/policy/scope-mapping`) i serwowane
serwerom przez `POST /.well-known/mcp-policy-data` (C14): `[{group, scopes: ["<Typ>/<id>"]}]`. Nie ma plików ani paczek.
Id zakresu: `<Typ>/<część lokalna>`; typ to wszystko przed pierwszym `/`.

| Przykładowe id zakresu | Co obejmuje (według polityk i wyprowadzenia `scopes` serwera) |
| --- | --- |
| `Jira::Project/ABC` | projekt ABC i jego zgłoszenia |
| `Confluence::Page/1000` | strona 1000 i całe drzewo stron pod nią |
| `GitLab::Group/team-a` | grupa `team-a`, wszystkie jej podgrupy (`team-a/sub`) i projekty; nie `team-ab` |
| `OpenSearch::Index/logs-team-a` | indeksy `logs-team-a` i `logs-team-a-*`; nie `logs-team-ab` |
| `Notes::Folder/team` | folder `team` i każdy folder pod nim |

Przykład: `test-vectors/fixtures/scope-mapping.json`.

Reguły:

- Grupa bez wpisu nie daje żadnego zakresu (fail-closed). Nazwa grupy nie musi kodować zakresu
  (`mcp-team-platform`); konwencja C9 (`mcp-<system>-<rodzaj>-<id>`) zostaje zaleceniem, builder niczego z nazwy nie wyprowadza.
- Dopasowanie nazwy grupy jest dokładne: wielkość liter, separatory i spacje mają znaczenie
  (`mcp-jira-proj-abc` to inna grupa niż `mcp-jira-proj-ABC`).
- Zakres musi mieć postać `<zadeklarowany typ z scopePattern>/<część lokalna zgodna ze scopePattern>`; inaczej zapis mapowania to
  `422 scope_mapping_rejected` (`ScopeMapping.of`). Przykład: prefiks indeksu nie może kończyć się na `-` ani `.`
  (wzorzec `scopePattern` takiego typu to wyklucza), więc `logs-` nie jest poprawnym zakresem (objąłby `logs--x`).
- Do oceny gateway używa `ScopeMapping.ofRegistered`: nieważny zakres (typ, którego żaden zarejestrowany serwer nie deklaruje, bo
  serwer usunięto; część lokalna niepasująca do węższego `scopePattern`) jest pomijany osobno i zgłaszany przez `ignored()`, więc
  jeden zły wpis nie odbiera grantów pozostałym. Usunięcie serwera usuwa z mapowania wpisy typów jego przestrzeni, żeby serwer
  dodany później pod tą samą przestrzenią nie odziedziczył grantów.
- `ScopeMapping.fromJson(types, json, skipUndeclared)` czyta kształt z danych polityki.

## 4. Principal

- UID: `User::"<sub>"`; atrybuty: `username` = `usr`, `client` = `azp`, `mfaAge` = `mfa` (tylko gdy jest),
  `scopes`.
- Rodzice: `UserGroup::"<g>"` dla każdej grupy z `grp` zaczynającej się od `mcp-`. Każda taka grupa jest
  osobną encją z rodzicami `ResourceScope` z mapowania (bez rodziców, gdy grupa nie jest zmapowana). Dlatego
  `principal in ResourceScope::"GitLab::Group/team-a"` jest prawdą dla członka zmapowanej grupy.
- `principal.scopes`: jeden płaski zbiór `ResourceScope`: wszystkie zakresy, na które zmapowane są grupy użytkownika
  (dokładne id, bez hierarchii; każdego typu). Służy wczesnej kontroli na gateway'u; hierarchię sprawdza serwer przez
  `principal in resource.scopes`.

## 5. Akcja, zasób i kontekst

**Gateway:** `Action::"call"`, zasób `Tool::"<system>__<name>"` z atrybutami `server` = `serverId`,
`name` = nazwa po stronie serwera, `risk`, `requiredGroup` i opcjonalnie `additionalGroup` (z wpisu manifestu, `ToolDescriptor.additionalGroup()`). `requiredGroup` to `UserGroup::"mcp-<system>-read"` dla
`READ_ONLY`, `-write` dla `UPDATE` i `-destructive` dla `DESTRUCTIVE` (konwencja C9; jedyne miejsce, w którym nazwa grupy jest
wyprowadzana; `ToolDescriptor.requiredGroup()`). `additionalGroup` to pole wpisu narzędzia w manifeście (`mcp-<system>-<przyrostek>`, system tego serwera, przyrostek inny niż `read`, `write`, `destructive`; reguła `additional-group-valid`), wchodzi do `definitionHash`, więc zmiana wymaga zatwierdzenia; w manifeście adaptera jest zabronione. Narzędzie spoza rejestru nie ma encji `Tool`; gateway odmawia
przed Cedar, a wektor `gw-unknown-tool-denied` pokazuje, że polityki też dają `deny`. O `call` decydują polityki platformy
(sekcja 7), nie polityki serwerów.

**Serwer:** `<Przestrzeń>::Action::"<tool.action>"` (przestrzeń typu zasobu, np. `Jira::Action::"update"`), zasób = encja
rozwiązana przez resolver. Builder dokłada referencję do rodzica (`parentAttribute`; rodzic jest też w `parents` i jest osobną
encją, a rodzic rodzica też) oraz `scopes`.

**`scopes` zasobu** podaje resolver serwera (`ResolvedResource.withScopes`): id zakresu zasobu i wszystkich jego kontenerów.
Builder sprawdza tylko, że każde id ma postać `<zadeklarowany typ z scopePattern>/<część lokalna zgodna ze scopePattern>`.
Wyprowadzenia zależne od systemu są sprawą serwera; starter daje pomocniki (`Scopes.pathPrefixes`, `Scopes.dashPrefixes`
w `mcp-cedar-entities`), żeby nie powtarzać ich w każdym serwerze. Wiedza z dawnych systemów wbudowanych:

| Dawny typ | `scopes` zasobu |
| --- | --- |
| `Jira::Project` / `Jira::Issue` | `Jira::Project/<klucz projektu>` |
| `Confluence::Space` | `Confluence::Space/<klucz>` |
| `Confluence::Page` | `Confluence::Space/<klucz przestrzeni>`, `Confluence::Page/<a>` dla każdego `ancestorIds` (id stron-przodków z Confluence), `Confluence::Page/<id>` |
| `GitLab::Group` | `GitLab::Group/<p>` dla każdego prefiksu ścieżki po `/` (`team-a`, `team-a/sub`) |
| `GitLab::Project` | jak grupa-rodzic |
| `OpenSearch::Index` | `OpenSearch::Index/<p>` dla każdego prefiksu nazwy kończącego się przed `-` i pełnej nazwy |
| `ServiceDesk::Queue` / `ServiceDesk::Ticket` | `ServiceDesk::Queue/<id kolejki>` |

Wektory `server-gitlab-project-path-prefixes`, `server-opensearch-index-dash-prefixes`, `server-confluence-page-tree` i
`server-notes-folder-path-scopes` pokazują te wyprowadzenia jako dane.

Identyfikator i rodzic zasobu to zawsze kanoniczne wartości zwrócone przez system (klucz projektu i zgłoszenia
Jiry, `path_with_namespace` GitLaba, klucz przestrzeni, nazwa indeksu, id kolejki), nigdy argument narzędzia:
argument mógł mieć inną wielkość liter (ścieżki GitLaba są nieczułe na wielkość liter) albo wskazywać zasób
przeniesiony. Atrybut o wartości `null` oznacza brak atrybutu. Resolver podaje wyłącznie atrybuty zadeklarowane w `attributes`
(inny atrybut, także `scopes` albo atrybut rodzica, to `internal_error`); typ z zadeklarowanym rodzicem wymaga rodzica
tego typu, a typ bez rodzica go nie przyjmuje.

**Klasyfikacja (CC-057, CC-062, CC-067).** Deklaracja `classification` wskazuje atrybut, który builder normalizuje:
`trim` (znaki <= U+0020) i zamiana wyłącznie liter ASCII na małe; zbiory bez duplikatów. Wartość kanoniczna danych
zastrzeżonych to `restricted`; polityki porównują tylko z nią. `required: true`: zasób (także rodzic, np. projekt
zgłoszenia) bez atrybutu albo z atrybutem w złym kształcie nie jest budowany (`internal_error`), więc wywołanie jest
odrzucane, a element wyniku pomijany. `required: false`: brak atrybutu jest dozwolony, zły kształt nie. Przykłady z dawnych
systemów (dane w `resource-types.json`): `Jira::Project.category` (napis, `""` gdy brak, wymagany), `Confluence::Space.labels` i
`OpenSearch::Index.tags` (zbiory, wymagane), `GitLab::Group` i `GitLab::Project` `classification` (zbiór, opcjonalny),
`ServiceDesk::Queue.classification` (zbiór, opcjonalny; zgłoszenie dziedziczy klasyfikację kolejki przez atrybut `queue`).
Źródło klasyfikacji podaje adapter serwera, nie builder (CC-149). Etykiety, których system nie zwrócił w całości (lista
dłuższa niż jedna odpowiedź), są niepełne: serwer odrzuca taki zasób (fail-closed, `internal_error`), zamiast budować encję z
częścią etykiet, bo brakująca etykieta `restricted` otworzyłaby zasób.

**Dziedziczona klasyfikacja przodków (dawny CC-129, GitLab).** Topics w GitLabie się nie dziedziczą, a oznaczenie grupy
`restricted` ma chronić całe poddrzewo. Atrybut `inheritedClassification` (suma znormalizowanych topics **wszystkich**
grup-przodków) liczy od 7.0.0 serwer GitLab w swoim resolverze, nie builder: jest zwykłym zadeklarowanym atrybutem (z
własnym wymaganym polem w schemacie fragmentu), a serwer odrzuca zasób (`internal_error`), gdy dane przodków są niepełne
(fail-closed). Reguła `forbid` dla `restricted` sprawdza go w polityce serwera.

**Kontekst:**

| Pole | Wartość |
| --- | --- |
| `client` | `azp` (zawsze) |
| `mfaAge` | `mfa`, tylko gdy claim jest |
| `credentialType` | typ poświadczenia użytego w wywołaniu, tylko gdy wywołujący builder go zna (CC-136); wartość spoza czterech typów to `internal_error` |
| `refs` | zawsze (może być pusty zbiór) |

### `context.refs`

`refs` to zbiór `ResourceScope`: dla każdego `resourceRef {argument, type}` narzędzia, którego typ ma
`earlyScopeCheck: true`, id argumentu jako `<Typ>/<id>` (`Jira::Project/ABC`). Typy bez `earlyScopeCheck` nie trafiają do
`refs`, ale ich identyfikatory są walidowane tak samo (`idPattern`). Platformowa polityka
`platform-call-write-outside-scope` zabrania zapisu, gdy `principal.scopes` nie zawiera wszystkich `refs`.

| Wartość argumentu | Identyfikatory |
| --- | --- |
| brak lub `null` | żadne |
| napis | ten napis, bez normalizacji (wielkość liter, spacje zostają) |
| liczba o wartości całkowitej | zapis dziesiętny (`4711` i `4711.0` -> `"4711"`) |
| tablica napisów / liczb całkowitych | każdy element jak wyżej |
| cokolwiek innego | błąd `invalid_argument`, wywołanie odrzucone |

Kilka argumentów tego samego typu trafia do jednego zbioru. Argument jest szukany tylko na najwyższym poziomie
`arguments`; manifest musi go deklarować w `inputSchema` (CC-043). Gateway sprawdza zakres wcześnie tylko dla
typów z `earlyScopeCheck`; typy hierarchiczne i identyfikatory, których kontener znany jest dopiero po rozwiązaniu
(klucz zgłoszenia, ścieżka projektu), sprawdza serwer. Typ spoza deklaracji zarejestrowanych serwerów to `internal_error`.

## 6. Fragment serwera i jego walidacja

Polityki serwera leżą w repozytorium serwera (`src/main/resources/mcp/policies/`) i są częścią manifestu
(`policies: {namespace, schema, files: [{name, text}]}`, `policiesHash`):

- `schema.cedarschema`: dokładnie jedna przestrzeń, własna (np. `Jira`), z typami encji serwera i akcjami
  `action "read", "update", "delete", "admin" appliesTo { principal: [User], resource: [<własne typy>], context: RequestContext };`.
  Typy bazowe (`User`, `ResourceScope`, `RequestContext`) fragment nazywa bez kwalifikacji, z pustej przestrzeni.
  Każdy typ encji ma `scopes: Set<ResourceScope>`.
- `*.cedar`: polityki zasobów; akcje to `<Przestrzeń>::Action::"read"` itd.; każda polityka ma `@id`, unikalne w serwerze.
- Przykład: `cedar/examples/systems/jira/` (schemat, polityki, deklaracje).

**Rozpoznawanie nazw w cedar-java (sprawdzone testem `CedarSchemaTest.namespacedFragmentResolvesBaseTypesAndDeclaresItsOwnActions`).**
Schemat bazowy i tekst fragmentu składamy przez dopisanie (`PolicyFragments.composeSchemaText`); cedar-java 4.10.0
rozwiązuje typy z pustej przestrzeni bez kwalifikacji z wnętrza przestrzeni nazw i przyjmuje akcje zadeklarowane w tej
przestrzeni (`Jira::Action::"read"`), więc kwalifikacja (`::User`) nie jest potrzebna. Fragment sam, bez schematu bazowego,
nie daje się rozwiązać (brakuje `ResourceScope` i `RequestContext`), więc reguły sprawdzamy na złożeniu. Fragment nie może
zadeklarować akcji `call`: Cedar zgłasza wtedy cień `Action::"call"`.

**Walidacja** (starter w buildzie i przy starcie, gateway przy rejestracji; `PolicyFragments.validateFragment`): schemat bazowy i
fragment składają się i walidują w trybie strict; fragment nie deklaruje niczego poza swoją przestrzenią (także w pustej);
każdy typ encji ma `scopes: Set<ResourceScope>`; akcje tylko `read`, `update`, `delete`, `admin`, każda z `principal: [User]` i
`context: RequestContext` (obcy typ podmiotu albo kontekstu dawałby dostęp do atrybutów, których platforma nie daje); polityki
parsują się, mają `@id` (niezaczynające się od `platform-` ani `override-`), walidują się względem złożonego schematu (także bez ostrzeżeń "policy is impossible": `forbid`, który nigdy nie
pasuje, to ciche otwarcie); żadna polityka nie wspomina `Action::"call"` ani `Tool`; typy encji fragmentu to dokładnie typy
zadeklarowane w `resourceTypes` tej przestrzeni, z zadeklarowanymi atrybutami i rodzicami (wymagany atrybut spoza deklaracji
to błąd, bo builder go nie zbuduje). Odrzucenie przy rejestracji to `422 manifest_rejected` z `policies_invalid` albo
`resource_types_invalid`.

## 7. Polityki platformy, polityki serwerowe platformy i nadpisania awaryjne

Gateway decyduje o `call` na `Tool` wyłącznie politykami z `cedar/platform/*.cedar` (w jarze kontraktów; ładuje je gateway
i starter, `McpCedarSchema.platformPolicies()`) i nadpisaniami administratora:

- `platform-call-by-group`: `permit`, gdy `principal in resource.requiredGroup`;
- `platform-call-additional-group`: `forbid`, gdy `resource has additionalGroup && !(principal in resource.additionalGroup)`; narzędzie z dodatkową grupą (np. `mcp-opensearch-ops` dla narzędzi tylko dla operatorów) wymaga jej obok grupy wynikającej z ryzyka, więc dodatkowa grupa może tylko zawęzić dostęp (`mcp-opensearch-read` sam nie otwiera narzędzia);
- `platform-call-write-outside-scope`: `forbid`, gdy `risk != "READ_ONLY"` i zbiór `context.refs` nie mieści się w `principal.scopes`;
- `platform-call-write-without-refs`: `forbid` zapisu, gdy kontekst nie ma `refs` (gateway zawsze je daje; brak to odmowa, nie "nic do sprawdzenia").

**Polityki serwerowe platformy (`PlatformServerPolicies.generate`/`texts`/`policySet`).** Starter zawsze ładuje obok fragmentu polityki
wygenerowane z deklaracji, z identyfikatorami `platform-...`, więc fragment nie może ich pominąć ani osłabić: (1) dla każdego typu z
`classification`: `forbid` na wszystkie akcje, gdy wartość to `"restricted"` (napis równy, zbiór zawiera), a dla typu podrzędnego także
wtedy, gdy przodek osiągany łańcuchem `parentAttribute` deklaruje klasyfikację i ją niesie
(`platform-<przestrzeń>-restricted-<typ>[-by-<przodek>]`); (2) dla każdego typu: `forbid`, gdy `context.credentialType` nie jest
poświadczeniem użytkownika (`user-oauth`, `user-secret`, `token-exchange`; brak i nieznany typ liczą się jak konto serwisowe, CC-164) i
nie zachodzi `principal in resource.scopes`
(`platform-<przestrzeń>-<typ>-service-account-outside-scope`). Oba rodzaje to tylko `forbid`. Fragment Jiry i fixture Notes nie mają już
własnych reguł `restricted` ani reguły konta serwisowego.

**Nadpisanie awaryjne** to jedna polityka `forbid` zapisana przez administratora (`PUT /admin/v1/policy/overrides/{id}`), z id
`override-<nazwa>` i celem `gateway`, `all-servers` albo `serverId`
(`PolicyFragments.validateOverride(id, text, OverrideTarget, fragmentSchemas)`): cel `gateway` musi być `action == Action::"call"` na
`resource is Tool` (inaczej nie blokuje niczego); cel `serverId` waliduje się względem schematu bazowego ze fragmentem tego serwera, a
`all-servers` względem fragmentu każdego zarejestrowanego serwera; oba nie mogą wspominać `Tool` ani `call`. Przykład:
`cedar/examples/overrides/step-up.cedar` (zniszczenie wymaga świeżego MFA). Polityki serwera nigdy nie biorą udziału w decyzji
gatewaya; nadpisania z celem `all-servers` albo `serverId` serwer dostaje w danych polityki i ocenia razem z własnymi.

**Identyfikatory polityk.** Polityki platformy mają `platform-`, nadpisania `override-`; polityka serwera nie może użyć żadnego z tych
prefiksów. Zbiór oceniany składa `PolicyFragments.merge(...)`: dwie polityki o tym samym id to błąd (odmowa), nigdy scalenie po id, bo
nadpisanie o id polityki platformy zastąpiłoby ją.

## 7a. Reguły, które wiążą implementacje

- **Gateway:** składa sumę deklaracji (`ResourceTypes.union`) tylko z zatwierdzonych deklaracji; `union` odrzuca dwa rejestry z jedną
  przestrzenią (`namespace_conflict`), a przestrzeń należy do pierwszego `serverId`, który ją zadeklarował, do czasu usunięcia go.
  Wyjątek przy budowie sumy albo mapowania to odmowa z zapisem w audycie, nigdy wynik częściowy. Oceniając, czyta mapowanie
  `ScopeMapping.ofRegistered`: nieważny zakres jest pomijany osobno i zgłaszany (`ignored()`), pozostałe granty zostają; ścisłe `of`
  służy walidacji zapisu administratora. Dane polityki dla serwera zawężone do jego przestrzeni (`forNamespace`), z
  `approvedPoliciesHash`.
- **Własność przestrzeni:** przestrzeń należy do pierwszego `serverId`, którego polityki są ZATWIERDZONE z tą przestrzenią; rejestracja
  sprawdza tylko względem zatwierdzonych właścicieli i niczego nie zajmuje. Gdy zatwierdzenie zmienia albo zwalnia przestrzeń serwera,
  wpisy mapowania zwolnionej przestrzeni są usuwane i audytowane (`scope_mapping_entry_removed`), tak jak przy `deleteServer`.
- **Certyfikat serwera MCP (CC-249):** dowolny certyfikat HTTPS (od zaufanego CA, samopodpisany albo wygenerowany przez starter); gateway łączy się bez
  certyfikatu klienta i ufa mu według trybu zatwierdzonego przez administratora (`ca`, `pinned`, `plain`, C5), a nie według nazwy w certyfikacie.
- **Rewizja danych polityki:** `max(poprzednia + 1, bieżący czas w milisekundach epoki)`, żeby odtworzenie bazy nie obniżyło jej poniżej
  wartości, które serwery już trzymają. Podpisane paczki dawały kontrolę dwóch stron; ich brak zastępują świeże MFA, audyt każdej zmiany i
  zatwierdzenie `policiesHash`, a operacyjnie zalecany jest przegląd dwóch osób dla zmian mapowania zakresów i zatwierdzeń polityk.
- **Starter (serwer):** oblicza `policiesHash` własnych polityk i `resourceTypes` i odmawia każdego wywołania
  (`upstream_unavailable`), gdy różni się od `approvedPoliciesHash` albo tego brak; nigdy nie przyjmuje rewizji niższej ani równej
  trzymanej jako nowych danych; gdy nie ma danych albo `prv` w tokenie jest nowsze niż dane, odpowiada `409 policy_data_stale` przed wykonaniem (sam niczego nie pobiera: gateway wypycha dane i ponawia wywołanie raz, C14); nadpisanie, które nie
  waliduje się względem złożonego schematu, oznacza odmowę wszystkich wywołań. Wzorzec i wektory: `scripts/lib/policy-data-gate.mjs`,
  `PolicyDataGate` (mcp-manifest), `test-vectors/policy-data-gate/`. Rewizja danych jest licznikiem, który tylko rośnie.

## 8. Format wyjścia i kolejność

JSON w formacie Cedar: UID `{"type", "id"}`, encje `{"uid", "attrs", "parents"}`, referencje w atrybutach
`{"__entity": {"type", "id"}}`, zbiory jako tablice. Zbiory posortowane bez duplikatów (zbiory encji po `id`),
encje posortowane po `type`, potem po `id` (porównanie po jednostkach UTF-16). Encje akcji i `ResourceScope`
nie są dołączane (wystarczą krawędzie `parents`). Atrybuty zasobu nie nazwane wyżej (zwykłe atrybuty z resolvera) zachowują
kolejność elementów podaną przez resolver.

## 9. Błędy

Każdy błąd buildera kończy się odmową wywołania: `invalid_argument` dla złego argumentu-identyfikatora (C10),
`invalid_argument` także dla ujemnego wieku MFA (CC-065), `internal_error` dla niespójnych danych platformy: nieobsługiwany
(niezadeklarowany) typ w `resourceRefs` albo w zasobie, `risk` spoza `READ_ONLY`/`UPDATE`/`DESTRUCTIVE`, `action` spoza
`read`/`update`/`delete`/`admin`, liczba poza zakresem Cedar `Long`, brak rodzica przy typie, który go deklaruje, atrybut spoza
deklaracji, zakres spoza deklaracji, brak wymaganej klasyfikacji.

## 10. Wektory

`test-vectors/resource-ids/*.json`: `{resourceTypes, type, kind, valid, invalid}`, identyfikatory poprawne i niepoprawne dla
`idPattern` (`kind: resource`) albo `scopePattern` (`kind: scope`) zadeklarowanych w pliku `resourceTypes`.

`test-vectors/entity-builder/*.json`: `{description, level, resourceTypes, scopeMapping, input, expected}`; `resourceTypes` to
lista plików z tablicą deklaracji (ścieżki względem korzenia repozytorium), `scopeMapping` to plik z mapowaniem; `expected` to
wyjście buildera albo `{"error": "<kod>"}`. Zasób na poziomie `server` ma `scopes` (lista id zakresów) obok `attrs` i
`parent`.

`test-vectors/policy-decisions/*.json`: gotowe `request` i `entities`, wejście buildera w `builder` (`level`, `resourceTypes`,
`scopeMapping`, `input`, ewentualnie `adjustment: remove-tool-entity`), `policies: {schema, policies}` i
`expected: {decision, determiningPolicies}`. `policies.schema` to plik fragmentu (albo `null` dla schematu bazowego),
`policies.policies` to katalogi z plikami `.cedar` (id z adnotacji `@id`): wektory gatewaya używają `cedar/platform` i
`cedar/examples/overrides`, wektory serwera polityk fragmentu (`cedar/examples/systems/jira`, `test-vectors/fixtures/notes`).
`covers` oznacza przypadki wymagane przez DoD i przeglądy.

`test-vectors/result-filter/*.json`: wejście wywołania, elementy zwrócone przez system (`items`), oczekiwane
zachowane elementy i ograniczenia zapytania (`queryConstraints`).

`test-vectors/policies-hash/*.json`: skrót członu `policies` manifestu (sekcja C6).

## 11. Wyszukiwanie i listy (CC-036)

Narzędzie zwracające wiele elementów (wyszukiwanie, lista) nie może polegać na ocenie bramki, bo bez
argumentu-identyfikatora `refs` są puste. Serwer:

1. Ogranicza zapytanie do systemu: `EntityBuilder.queryConstraint(caller, typ)` daje identyfikatory przyznane
   przez mapowanie (`granted`) dla typu z `scopePattern`. Przyznane zakresy trafiają do zapytania tam, gdzie system nie
   egzekwuje uprawnień użytkownika.
   - `granted` puste: użytkownik nie ma żadnego zakresu tego typu. Tam, gdzie zapytanie jest ograniczane do
     zakresów, serwer **nie wykonuje zapytania** i zwraca pustą listę; puste `granted` nigdy nie
     znaczy "bez filtra".
   - Identyfikatory pasują do `scopePattern`, ale serwer i tak je cytuje w języku zapytań systemu, z `\` przed `"` i `\`;
     nigdy przez sklejanie bez cudzysłowów (przykłady dla Jiry, Confluence i OpenSearch niżej).
   - Zakres wyklucza wszystko (`granted` puste, CC-147): wyszukiwanie i lista zwracają pusty wynik bez wołania systemu (to nie błąd), a pobranie jednego zasobu po id kończy się `not_found_or_denied`, tak samo jak zasób, którego użytkownik nie widzi.
2. Ocenia każdy zwrócony element przez `forResource` (`ResultFilter.allowed`); element niedozwolony, którego
   nie da się rozwiązać albo ocenić, jest pomijany. Pominięcie nie jest błędem wywołania.

Zapytanie buduje serwer ze struktury (CC-160); reguły poniżej dotyczą serwerów trzech dawnych systemów i są normatywne dla
nich, a wzorcem dla pozostałych:

- Serwer składa zapytanie z pól strukturalnych (pole, operator, wartość z listy dozwolonych), nigdy z surowego JQL, CQL
  ani DSL OpenSearch podanego przez model. Każda wartość jest cytowana (`\` i `"` poprzedzone `\`, znaki sterujące
  odrzucone), warunki użytkownika stoją w jednym nawiasie, a warunek zakresu dochodzi po nim przez `AND`, więc `OR`
  w wartości nie poszerza zakresu. JQL: `project in ("ABC", "DEF")`, CQL: `space in ("ENG")`, każdy identyfikator w cudzysłowach.
  CQL kończy się stałą klauzulą `AND type = page` (po zakresie, przed `ORDER BY`; CC-219), bo `content/search` zwraca też
  komentarze, załączniki i blogi. `ORDER BY` przyjmuje tylko pole z listy i `ASC`/`DESC`. Pusty zakres to brak zapytania
  (patrz wyżej), nigdy zapytanie bez filtra. Wzorzec: `scripts/lib/query-rendering.mjs`, wektory
  `test-vectors/query-rendering/` (JQL i CQL z wrogimi wartościami, nawias, `ORDER BY`, argumenty indeksu OpenSearch: `*`, `_all`, lista po przecinku, kropka
  na początku, alias, strumień danych). **Listy pól warunków, operatorów (`=`, `~`, `!=`) i pól `ORDER BY` w `scripts/lib/query-rendering.mjs` są
  normatywne:** serwer może dopuścić mniej, nigdy więcej; nowe pole wymaga zmiany kontraktu.
- OpenSearch: dla każdego prefiksu `p` kanoniczny wzorzec indeksów to `p,p-*` (indeks o nazwie `p` i indeksy zaczynające się od
  `p-`); nigdy `p*` (obejmowałoby `p` z innym ciągiem dalej, np. `logs-team-ab` dla `logs-team-a`). Serwer nigdy nie wysyła do
  klucza wzorca typu `logs-team-a*`, bo wzorzec może objąć alias o takiej nazwie, który wskazuje indeksy innych zespołów
  (zliczenia i `hits.total` policzyłyby wtedy dane spoza zakresu). Najpierw rozwiązuje wzorzec `p,p-*`
  (`GET _resolve/index/<wzorzec>`) do konkretnych nazw indeksów, **pomijając aliasy i strumienie danych** (tylko wpisy
  `indices` odpowiedzi), zostawia nazwy równe prefiksowi albo zaczynające się od `<prefiks>-` i dopiero wtedy pyta po liście
  nazw. Alias lub strumień podany jako argument to `not_found_or_denied`. Agregacje, `hits.total` i `_count` liczone są tylko
  na tych nazwach. Między rozwiązaniem a zapytaniem jest krótkie okno (indeks usunięty i alias o tej samej nazwie utworzony);
  wymaga uprawnień administracyjnych w OpenSearch, więc jest ryzykiem znanym, nie zamykanym kontraktem.

Ograniczenie zapytania nie zastępuje filtrowania: filtrowanie jest kontrolą, zapytanie tylko oszczędza
ruch i nie ujawnia liczby elementów spoza zakresu.

## 12. Wzorce identyfikatorów (CC-056)

Wzorzec identyfikatora to `idPattern` deklaracji typu (sekcja 2); wzorzec zakresu to `scopePattern`. Obowiązują w argumentach
narzędzi (`refs`, błąd `invalid_argument`), zasobach z resolvera (`internal_error`) i id zakresów w mapowaniu (odrzucenie
zapisu). Wzorce dawnych systemów wbudowanych, jako dane przykładowe (źródło: dokumentacja systemu):

| Typ | Wzorzec | Źródło |
| --- | --- | --- |
| `Jira::Project` | `^[A-Z][A-Z0-9_]{1,9}$` | Jira DC "Changing the project key format": pierwsza litera, wielkie litery, cyfry, `_`; domyślny maks. rozmiar klucza 10 |
| `Jira::Issue` | `^[A-Z][A-Z0-9_]{1,9}-[1-9][0-9]{0,9}$` | klucz projektu + `-` + numer zgłoszenia |
| `Confluence::Space` | `^[A-Za-z0-9]{1,255}$` | Confluence DC "Space keys": tylko znaki alfanumeryczne, do 255; przestrzenie osobiste (`~user`) wyłączone |
| `Confluence::Page` | `^[1-9][0-9]{0,18}$` | id treści Confluence (liczba 64-bitowa) |
| `GitLab::Group` | `^[A-Za-z0-9](?:[._/-][A-Za-z0-9]\|[A-Za-z0-9])*$` (segmenty ze znaków alfanumerycznych i pojedynczych `.`, `_`, `-`, rozdzielone `/`), maks. 1024 znaki | GitLab "Reserved project and group names" i "Subgroups". Od 7.0.0 wzorzec nie wyraża limitu 20 poziomów ani zakazu końcówki `.git`/`.atom` (lookaround jest poza gramatyką): sprawdza je serwer GitLab |
| `GitLab::Project` | jak grupa, z co najmniej jednym `/` | ścieżka grupy + ścieżka projektu |
| `OpenSearch::Index` | `^[a-z0-9][a-z0-9._-]{0,254}$` | OpenSearch "Create index"; dodatkowo tylko ASCII, maks. 255 i początek litera lub cyfra, więc indeksy ukryte i systemowe (`.security`, `.kibana`, `.ds-*`) są poza wzorcem (CC-074); konkretna nazwa: bez aliasów-wzorców, wildcardów, list, date math |
| `OpenSearch::Index` (zakres) | jak wyżej, bez końcowego `-` i `.` | prefiks nazwy |
| `ServiceDesk::Queue`, `ServiceDesk::Ticket` | `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$` | adapter generyczny: alfabet zachowawczy |

Pliki: `cedar/examples/systems/*/resource-types.json`; wektory `test-vectors/resource-ids/`.

## 12a. Dane zastane a wzorce

Wzorce są zachowawcze, więc część istniejących zasobów jest niedostępna przez MCP (fail-closed, odmowa jak dla
zasobu bez uprawnień), jeśli serwer przyjmie wzorce z przykładów: starsze ścieżki GitLaba ze znakiem `_` lub `.` na początku
lub końcu segmentu, klucze projektów Jiry dłuższe niż 10 znaków (przy zmienionym limicie w Jirze), przestrzenie osobiste
Confluence (`~user`). Ukryte i systemowe indeksy OpenSearch (`.nazwa`, w tym `.ds-*` strumieni danych) nie pasują do wzorca
(CC-074): argument z taką nazwą to `invalid_argument`, zasób z resolvera to `internal_error`. Serwer może zadeklarować
szersze wzorce w swoim manifeście, bo to jego dane.

## 12b. Kolejność ocen i jedna odmowa dla zasobów (CC-146)

Odmowa dla zasobu ma jeden kod i jeden tekst, żeby jej treść ani moment nie zdradzały, czy zasób istnieje:

1. `not_found_or_denied` ma w C10 jeden stały `message`: `The resource does not exist or you do not have access to it.`
   Gateway używa tego samego tekstu dla narzędzia, które odcina filtr adresu (CC-118, CC-170), i dla zasobu poza zakresem.
2. Kolejność: najpierw grant. Użytkownik bez grantu na typ zasobu (żadna grupa nie daje zakresu tego typu i polityka nie
   przyznaje dostępu) dostaje `not_found_or_denied` **przed** budową encji, przed odczytem klasyfikacji i przed każdym
   wywołaniem systemu, które mogłoby się nie udać. Dzięki temu `internal_error` (np. brak wymaganej klasyfikacji) nie
   ujawnia istnienia zasobu osobie, która i tak go nie widzi.
3. Zasób poza przyznanym zakresem (argument spoza grantu) to też `not_found_or_denied`, nie `access_denied`; w kontrakcie
   `access_denied` zostaje dla narzędzi, nie dla zasobów.

## 13. Każda wartość każdego `resourceRef` (CC-061)

Ocena na bramce sprawdza tylko typy z `earlyScopeCheck`, więc o zasobach hierarchicznych i o kontenerach decyduje serwer.
Serwer przed wykonaniem narzędzia:

1. Dla każdego argumentu z `resourceRefs` i dla każdej jego wartości (każdy element tablicy; źródło i cel, np.
   `folderPath` i `targetFolder` przy przeniesieniu) rozwiązuje zasób i ocenia go przez `forResource`.
2. Przy tworzeniu zasobu ocenia także kontener docelowy (grupę, projekt, przestrzeń, kolejkę, folder), w którym zasób
   powstaje.
3. Wykonuje narzędzie tylko, gdy wszystkie oceny dały `allow`; jedna odmowa, błąd rozwiązania albo błąd oceny
   kończy wywołanie odmową (`not_found_or_denied` dla zasobów, C10). `ResultFilter.checkAll` sam wylicza wartości
   z `resourceRefs` i argumentów, rozwiązuje je przez resolver `(typ, id)` i zwraca powód odmowy;
   `ResultFilter.allAllowed` przyjmuje gotową listę zasobów (wywołujący odpowiada za jej kompletność).
4. Fail-closed (2.0.2): narzędzie z zadeklarowanymi `resourceRefs`, dla którego nie ma żadnej wartości zasobu
   (brak argumentu, pusta tablica) ani kontenera, jest odrzucane (`no_resource`); narzędzie listujące bez
   identyfikatorów korzysta z sekcji 11 (`queryConstraint` i filtrowanie wyników), nie z tej kontroli. Zasób z
   resolvera innego typu niż `resourceRef` (`resource_type_mismatch`), z id niezgodnym ze wzorcem
   (`resource_id_invalid`) albo brak zasobu (`not_resolved`) też dają odmowę. `allAllowed` z pustą listą zwraca
   `false`. Narzędzie bez `resourceRefs` nie ma tu czego oceniać: decyzję `call` podjął gateway.

Wektory: `test-vectors/resource-checks/`, decyzje `srv-transfer-target-outside-scope`, `srv-transfer-source-in-scope`.
