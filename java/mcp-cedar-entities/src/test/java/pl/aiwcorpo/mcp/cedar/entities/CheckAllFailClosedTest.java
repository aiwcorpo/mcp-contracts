package pl.aiwcorpo.mcp.cedar.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** ResultFilter.checkAll and allAllowed never allow without a policy decision on a resource (2.0.2). */
class CheckAllFailClosedTest {

    private static final ToolDescriptor ARCHIVE = new ToolDescriptor("mcp-notes", "notes", "archive_folders", "UPDATE",
            "update", List.of(new ResourceRef("folderPaths", "Notes::Folder")));
    private static final ToolDescriptor NO_REFS = new ToolDescriptor("mcp-notes", "notes", "list_notebooks", "READ_ONLY", "read", List.of());
    private static final Caller WRITER = Caller.of("u", "writer", List.of("mcp-notes-read", "mcp-notes-write"), "claude-code");

    private final ResultFilter allowEverything = new ResultFilter(new EntityBuilder(
            ResourceTypes.fromJson(ContractFiles.read(ContractFiles.resolve("test-vectors/fixtures/notes/resource-types.json"))),
            ScopeMapping.empty()), request -> true);

    private static ResolvedResource folder(String path) {
        return ResolvedResource.of("Notes::Folder", path, Map.of("path", path)).withScopes(List.of(Scopes.id("Notes::Folder", path)));
    }

    @Test
    void declaredRefsWithoutValuesAreDenied() {
        for (Map<String, ?> arguments : List.<Map<String, ?>>of(Map.of(), Map.of("folderPaths", List.of()))) {
            ResultFilter.CheckResult result = allowEverything.checkAll(WRITER, ARCHIVE, arguments, (t, id) -> folder(id), Optional.empty());
            assertFalse(result.allowed());
            assertEquals(Optional.of("no_resource"), result.reason());
        }
    }

    @Test
    void toolWithoutRefsHasNothingToEvaluate() {
        assertTrue(allowEverything.checkAll(WRITER, NO_REFS, Map.of(), (t, id) -> null, Optional.empty()).allowed());
    }

    @Test
    void resolverReturningAnotherTypeIsDenied() {
        ResultFilter.CheckResult result = allowEverything.checkAll(WRITER, ARCHIVE, Map.of("folderPaths", List.of("team/a")),
                (t, id) -> ResolvedResource.of("Notes::Notebook", "alpha", Map.of("name", "alpha", "labels", List.of())), Optional.empty());
        assertEquals(Optional.of("resource_type_mismatch"), result.reason());
    }

    @Test
    void resolverReturningAnInvalidIdIsDenied() {
        ResultFilter.CheckResult result = allowEverything.checkAll(WRITER, ARCHIVE, Map.of("folderPaths", List.of("team/a")),
                (t, id) -> folder("team/a,other"), Optional.empty());
        assertEquals(Optional.of("resource_id_invalid"), result.reason());
    }

    @Test
    void resolverReturningNothingIsDenied() {
        ResultFilter.CheckResult result = allowEverything.checkAll(WRITER, ARCHIVE, Map.of("folderPaths", List.of("team/a")),
                (t, id) -> null, Optional.empty());
        assertEquals(Optional.of("not_resolved"), result.reason());
    }

    @Test
    void anArgumentThatIsNotAnIdIsDeniedBeforeResolving() {
        ResultFilter.CheckResult result = allowEverything.checkAll(WRITER, ARCHIVE, Map.of("folderPaths", List.of("team/../x")),
                (t, id) -> folder("team/a"), Optional.empty());
        assertEquals(Optional.of("invalid_argument"), result.reason());
    }

    @Test
    void allAllowedWithAnEmptyListIsFalse() {
        assertFalse(allowEverything.allAllowed(WRITER, ARCHIVE, Map.of(), List.of()));
    }
}
