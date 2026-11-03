package pl.aiwcorpo.mcp.policy.bundle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cedarpolicy.model.policy.PolicySet;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.file.Files;
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

    /** CC-203: a policy that does not validate gives the validator no result; that is not "clean". */
    @Test
    void aPolicyThatDoesNotValidateIsAnErrorNotAnEmptyResult() throws Exception {
        String unknownType = "@id(\"x\")\nforbid (principal, action, resource is Nosuch::Thing);\n";
        assertThrows(IllegalStateException.class, () -> impossible(unknownType));
    }

    private static int exitCode(String... args) {
        PrintStream sink = new PrintStream(new ByteArrayOutputStream());
        return PolicyLintCli.run(args, sink, sink);
    }

    @Test
    void exitCodesOfTheCommandLine(@org.junit.jupiter.api.io.TempDir Path dir) throws Exception {
        Path clean = Files.writeString(dir.resolve("clean.cedar"), HEAD + "when { context has mfaAge && context.mfaAge > 300 };\n");
        Path never = Files.writeString(dir.resolve("never.cedar"), HEAD + "when { context has mfaAge_typo && context.mfaAge_typo > 0 };\n");
        Path unknownType = Files.writeString(dir.resolve("unknown.cedar"), "@id(\"x\")\nforbid (principal, action, resource is Nosuch::Thing);\n");
        Path brokenSchema = Files.writeString(dir.resolve("broken.cedarschema"), "this is not a schema");
        assertEquals(0, exitCode(clean.toString()));
        assertEquals(1, exitCode(never.toString()));
        assertEquals(2, exitCode(unknownType.toString()), "a policy that does not validate");
        assertEquals(2, exitCode("--schema", brokenSchema.toString(), clean.toString()), "a broken schema");
        assertEquals(2, exitCode(), "no input");
    }
}
