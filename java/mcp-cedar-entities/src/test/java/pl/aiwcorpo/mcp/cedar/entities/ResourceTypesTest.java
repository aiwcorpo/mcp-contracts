package pl.aiwcorpo.mcp.cedar.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import pl.aiwcorpo.mcp.cedar.entities.ResourceTypeDeclaration.Classification;
import pl.aiwcorpo.mcp.cedar.entities.ResourceTypeDeclaration.Kind;

class ResourceTypesTest {

    private static ResourceTypeDeclaration declaration(String type, String parent, String parentAttribute, String idPattern,
            String scopePattern, boolean early, Classification classification) {
        return new ResourceTypeDeclaration(type, List.of("name", "labels"), Optional.ofNullable(parent), Optional.ofNullable(parentAttribute),
                idPattern, Optional.ofNullable(scopePattern), early, Optional.ofNullable(classification));
    }

    private static ResourceTypeDeclaration flat() {
        return declaration("Acme::Box", null, null, "^[a-z]+$", "^[a-z]+$", true, new Classification("labels", Kind.SET, true));
    }

    @Test
    void emptyRegistryKnowsNoType() {
        assertFalse(ResourceTypes.empty().isDeclared("Jira::Project"));
        assertFalse(ResourceTypes.empty().isValidId("Jira::Project", "ABC"));
    }

    @Test
    void idsAndScopesAreMatchedAsAWhole() {
        ResourceTypes types = ResourceTypes.of(List.of(flat()));
        assertTrue(types.isValidId("Acme::Box", "abc"));
        assertFalse(types.isValidId("Acme::Box", "abc\n"));
        assertFalse(types.isValidId("Acme::Box", "ABC"));
        assertFalse(types.isValidId("Acme::Crate", "abc"));
        assertTrue(types.isGrantable("Acme::Box"));
        assertEquals(Optional.of("Acme::Box"), types.scopeType("Acme::Box/abc"));
        assertEquals(Optional.empty(), types.scopeType("Acme::Box/ABC"));
        assertEquals(Optional.empty(), types.scopeType("Acme::Box"));
    }

    @Test
    void invalidDeclarationsAreRefused() {
        assertThrows(IllegalArgumentException.class, () -> ResourceTypes.of(List.of(flat(), flat())), "twice");
        assertThrows(IllegalArgumentException.class, () -> ResourceTypes.of(List.of(
                declaration("acme::Box", null, null, "^a$", null, false, null))), "type shape");
        assertThrows(IllegalArgumentException.class, () -> ResourceTypes.of(List.of(
                declaration("Acme::Box", null, null, "a", null, false, null))), "not anchored");
        assertThrows(IllegalArgumentException.class, () -> ResourceTypes.of(List.of(
                declaration("Acme::Box", null, null, "^a|b$", null, false, null))), "top-level alternation");
        assertThrows(IllegalArgumentException.class, () -> ResourceTypes.of(List.of(
                declaration("Acme::Box", null, null, "^a\\$", null, false, null))), "escaped dollar");
        assertThrows(IllegalArgumentException.class, () -> ResourceTypes.of(List.of(
                declaration("Acme::Box", null, null, "^(a$", null, false, null))), "does not compile");
        assertThrows(IllegalArgumentException.class, () -> ResourceTypes.of(List.of(
                declaration("Acme::Box", null, null, "^a$", null, true, null))), "early without scope pattern");
        assertThrows(IllegalArgumentException.class, () -> ResourceTypes.of(List.of(
                declaration("Acme::Crate", "Acme::Box", null, "^a$", null, false, null))), "parent without attribute");
        assertThrows(IllegalArgumentException.class, () -> ResourceTypes.of(List.of(
                declaration("Acme::Crate", "Acme::Box", "box", "^a$", null, false, null))), "parent not declared");
        assertThrows(IllegalArgumentException.class, () -> ResourceTypes.of(List.of(flat(),
                declaration("Other::Crate", "Acme::Box", "box", "^a$", null, false, null))), "parent in another namespace");
        assertThrows(IllegalArgumentException.class, () -> ResourceTypes.of(List.of(
                declaration("Acme::Box", null, null, "^a$", null, false, new Classification("colour", Kind.STRING, false)))),
                "classification attribute not listed");
    }

    @Test
    void patternsOutsideTheGrammarAreRefused() {
        for (String pattern : List.of("^(.*a){12}$", "^(a+)+$", "^(a|aa)+$", "^(a|a?)+$", "^([a-z]+)*[0-9]$", "^(a)\\1$", "^(?=a)a$", "^(?!a)b$",
                "^" + "a".repeat(520) + "$")) {
            assertThrows(IllegalArgumentException.class, () -> ResourceTypes.of(List.of(
                    declaration("Acme::Box", null, null, pattern, null, false, null))), pattern);
        }
        ResourceTypes.of(List.of(declaration("Acme::Box", null, null, "^[a-z0-9](?:/[a-z0-9]|[a-z0-9])*$", null, false, null)));
    }

    @Test
    void hostileIdIsRejectedFastAndLongIdsBeforeMatching() {
        ResourceTypes types = ResourceTypes.of(List.of(declaration("Acme::Box", null, null, "^[a-z0-9](?:/[a-z0-9]|[a-z0-9])*$", "^[a-z]+$", false, null)));
        long start = System.nanoTime();
        assertFalse(types.isValidId("Acme::Box", "a".repeat(1000) + "!"));
        assertTrue((System.nanoTime() - start) / 1_000_000 < 500);
        assertFalse(types.isValidId("Acme::Box", "a".repeat(1025)));
        assertFalse(types.isValidScopeLocalId("Acme::Box", "a".repeat(1025)));
    }

    @Test
    void unionRefusesTwoServersInOneNamespace() {
        ResourceTypes a = ResourceTypes.of(List.of(flat()));
        ResourceTypes b = ResourceTypes.of(List.of(declaration("Acme::Crate", null, null, "^a$", null, false, null)));
        var e = assertThrows(IllegalArgumentException.class, () -> ResourceTypes.union(List.of(a, b)));
        assertTrue(e.getMessage().startsWith("namespace_conflict"));
    }

    @Test
    void unionRefusesATypeDeclaredByTwoServers() {
        ResourceTypes a = ResourceTypes.of(List.of(flat()));
        ResourceTypes b = ResourceTypes.of(List.of(flat()));
        assertThrows(IllegalArgumentException.class, () -> ResourceTypes.union(List.of(a, b)));
        assertEquals(1, ResourceTypes.union(List.of(a)).declarations().size());
    }

    @Test
    void jsonDeclarationsOfEveryExampleSystemLoad() {
        for (String dir : List.of("cedar/examples/systems/jira", "cedar/examples/systems/confluence", "cedar/examples/systems/gitlab",
                "cedar/examples/systems/opensearch", "cedar/examples/systems/servicedesk", "test-vectors/fixtures/notes")) {
            ResourceTypes types = ResourceTypes.fromJson(ContractFiles.read(ContractFiles.resolve(dir + "/resource-types.json")));
            assertFalse(types.declarations().isEmpty(), dir);
        }
    }

    @Test
    void jsonThatIsNotAnArrayIsRefused() {
        assertThrows(IllegalArgumentException.class, () -> ResourceTypes.fromJson("{}"));
        assertThrows(IllegalArgumentException.class, () -> ResourceTypes.fromJson("["));
    }
}
