package pl.aiwcorpo.mcp.policy.bundle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cedarpolicy.model.policy.PolicySet;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import pl.aiwcorpo.mcp.cedar.entities.McpCedarSchema;

/** CC-183: the lint gate for policies that validate but can never match. */
class PolicyLintImpossibleTest {

    private static final String HEAD = "@id(\"x\")\nforbid (principal, action, resource is Jira::Issue)\n";

    private static List<String> impossible(String policy) throws Exception {
        return PolicyLint.impossible(McpCedarSchema.schema(), PolicySet.parsePolicies(policy));
    }

    @Test
    void forbidGuardedByARemovedAttributeIsImpossible() throws Exception {
        List<String> found = impossible(HEAD + "when { context has vsScopes && context.vsScopes has jiraProjects };\n");
        assertEquals(1, found.size(), found::toString);
        assertTrue(found.get(0).contains("impossible"), found.get(0));
    }

    @Test
    void aTypoInAGuardIsImpossibleToo() throws Exception {
        assertEquals(1, impossible(HEAD + "when { context has mfaAge_typo && context.mfaAge_typo > 0 };\n").size());
    }

    @Test
    void aGuardOnAnExistingAttributeIsNotReported() throws Exception {
        assertTrue(impossible(HEAD + "when { context has mfaAge && context.mfaAge > 300 };\n").isEmpty());
    }

    @Test
    void forbidUnlessAbsentAttributeMatchesEverythingAndIsNotReported() throws Exception {
        assertTrue(impossible(HEAD + "unless { context has vsScopes };\n").isEmpty());
    }

    /** The limit stated in the Javadoc: Cedar does not prove a disjunction with a possible branch false. */
    @Test
    void aDisjunctionWithAPossibleBranchIsNotReported() throws Exception {
        assertTrue(impossible(HEAD + "when { (context has vsScopes) || principal has username };\n").isEmpty());
    }

    static List<Path> examples() throws Exception {
        return ContractFiles.list("cedar/examples", ".cedar");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("examples")
    void examplePoliciesAreNotReported(Path file) throws Exception {
        List<String> found = impossible(ContractFiles.read(file));
        assertTrue(found.isEmpty(), () -> file + ": " + found);
    }
}
