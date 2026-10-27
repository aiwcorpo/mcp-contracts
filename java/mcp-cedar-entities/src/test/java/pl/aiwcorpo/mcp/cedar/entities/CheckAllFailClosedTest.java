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

    private static final ToolDescriptor UPDATE_PROJECT = new ToolDescriptor("mcp-gitlab", "gitlab", "archive_projects", "UPDATE",
            "update", List.of(new ResourceRef("projectPaths", "GitLab::Project")));
    private static final ToolDescriptor NO_REFS = new ToolDescriptor("mcp-jira", "jira", "list_projects", "READ_ONLY", "read", List.of());
    private static final Caller WRITER = Caller.of("u", "writer", List.of("mcp-gitlab-read", "mcp-gitlab-write", "mcp-gitlab-grp-team-a"), "claude-code");

    private final ResultFilter allowEverything = new ResultFilter(
            VectorInputs.builder("cedar/examples/static-entities.json"), request -> true);

    private static ResolvedResource project(String path) {
        return ResolvedResource.of("GitLab::Project", path, Map.of("path", path))
                .withParent(ResolvedResource.of("GitLab::Group", path.substring(0, path.lastIndexOf('/')), Map.of("path", path.substring(0, path.lastIndexOf('/')))));
    }

    @Test
    void declaredRefsWithoutValuesAreDenied() {
        for (Map<String, ?> arguments : List.<Map<String, ?>>of(Map.of(), Map.of("projectPaths", List.of()))) {
            ResultFilter.CheckResult result = allowEverything.checkAll(WRITER, UPDATE_PROJECT, arguments, (t, id) -> project(id), Optional.empty());
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
        ResultFilter.CheckResult result = allowEverything.checkAll(WRITER, UPDATE_PROJECT, Map.of("projectPaths", List.of("team-a/app")),
                (t, id) -> ResolvedResource.of("GitLab::Group", "team-a", Map.of("path", "team-a")), Optional.empty());
        assertEquals(Optional.of("resource_type_mismatch"), result.reason());
    }

    @Test
    void resolverReturningAnInvalidIdIsDenied() {
        ResultFilter.CheckResult result = allowEverything.checkAll(WRITER, UPDATE_PROJECT, Map.of("projectPaths", List.of("team-a/app")),
                (t, id) -> project("team-a/app,other"), Optional.empty());
        assertEquals(Optional.of("resource_id_invalid"), result.reason());
    }

    @Test
    void resolverReturningNothingIsDenied() {
        ResultFilter.CheckResult result = allowEverything.checkAll(WRITER, UPDATE_PROJECT, Map.of("projectPaths", List.of("team-a/app")),
                (t, id) -> null, Optional.empty());
        assertEquals(Optional.of("not_resolved"), result.reason());
    }

    @Test
    void allAllowedWithAnEmptyListIsFalse() {
        assertFalse(allowEverything.allAllowed(WRITER, UPDATE_PROJECT, Map.of(), List.of()));
    }
}
