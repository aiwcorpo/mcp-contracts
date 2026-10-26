# Zmiany kontraktów (propozycje i pytania)

Plik zbiera miejsca, w których `01-contracts.md` jest nieprecyzyjny albo sprzeczny, oraz propozycje zmian
od agentów. Każda pozycja ma przyjęty wariant, który **już jest** zaimplementowany w `mcp-contracts` 1.0.0,
i status. Zmianę statusu na `accepted`/`rejected` robi człowiek; odrzucenie wariantu oznacza nowe wydanie
kontraktów (patrz SemVer w `README.md`).

Format pozycji: numer `CC-NNN`, kontrakt `Cx`, problem, przyjęty wariant, alternatywy, status.

---

## CC-001 · C7 · Nazwa encji `Group` koliduje z `GitLab::Group`

- **Problem:** C7 nazywa encję grup użytkownika `Group` i jednocześnie wymaga `GitLab::Group`. Cedar 4
  (cedar-java 4.10.0) odrzuca taki schemat: `definition of GitLab::Group illegally shadows the existing
  definition of Group`.
- **Przyjęty wariant:** encja grup użytkownika nazywa się `UserGroup` (`User in [UserGroup]`), polityki
  piszą `principal in UserGroup::"mcp-jira-read"`. Typy zasobów systemów bez zmian.
- **Alternatywy:** (a) przenieść encje platformy do przestrzeni `Mcp::` (`Mcp::User`, `Mcp::Group`,
  `Mcp::Tool`, `Mcp::Action::"call"`), większa zmiana w politykach; (b) zmienić `GitLab::Group` na
  `GitLab::Namespace`, co dotyka manifestów serwerów (C6) i `resourceDefaults` (C5).
- **Status:** open
