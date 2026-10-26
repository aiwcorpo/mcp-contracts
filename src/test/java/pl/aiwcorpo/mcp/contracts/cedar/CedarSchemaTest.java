package pl.aiwcorpo.mcp.contracts.cedar;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cedarpolicy.BasicAuthorizationEngine;
import com.cedarpolicy.model.ValidationRequest;
import com.cedarpolicy.model.ValidationResponse;
import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import pl.aiwcorpo.mcp.contracts.ContractFiles;

class CedarSchemaTest {

    private final BasicAuthorizationEngine engine = new BasicAuthorizationEngine();

    @Test
    void schemaParses() throws Exception {
        Schema parsed = Schema.parse(Schema.JsonOrCedar.Cedar,
                ContractFiles.read(ContractFiles.resolve("cedar/mcp.cedarschema")));
        assertTrue(parsed.toJsonFormat().has(""), "top-level namespace must exist");
    }

    @Test
    void examplePoliciesValidateWithoutErrorsOrWarnings() throws Exception {
        List<Path> files = ContractFiles.list("cedar/examples", ".cedar");
        assertFalse(files.isEmpty());
        for (Path file : files) {
            PolicySet set = CedarFixtures.withAnnotatedIds(List.of(file));
            ValidationResponse response = engine.validate(new ValidationRequest(CedarFixtures.schema(), set));
            assertTrue(response.validationPassed(), () -> file + ": " + response);
            assertEquals(0, response.success.orElseThrow().validationWarnings.size(), () -> file + ": " + response);
            assertTrue(response.warnings.isEmpty(), () -> file + ": " + response);
        }
    }

    @Test
    void allExamplesTogetherValidate() throws Exception {
        ValidationResponse response = engine.validate(
                new ValidationRequest(CedarFixtures.schema(), CedarFixtures.examplePolicies()));
        assertTrue(response.validationPassed(), response::toString);
    }

    /**
     * cedar-java does not expose the validation mode; the native side uses Cedar's default, which is strict.
     * These policies type-check only in permissive mode, so rejecting them proves strict validation is active.
     */
    @Test
    void validatorRunsInStrictMode() throws Exception {
        PolicySet mixedSet = PolicySet.parsePolicies("""
                permit (principal, action == Action::"call", resource is Tool)
                when { [principal, resource].contains(principal) };
                """);
        ValidationResponse response = engine.validate(new ValidationRequest(CedarFixtures.schema(), mixedSet));
        assertFalse(response.validationPassed(), "strict mode must reject a set of User and Tool");
        assertTrue(response.toString().contains("are not compatible"), response::toString);
    }

    @Test
    void optionalAttributeWithoutHasGuardIsRejected() throws Exception {
        PolicySet unguarded = PolicySet.parsePolicies("""
                permit (principal, action == Action::"call", resource is Tool)
                when { context.mfaAge < 3600 };
                """);
        ValidationResponse response = engine.validate(new ValidationRequest(CedarFixtures.schema(), unguarded));
        assertFalse(response.validationPassed(), "optional context.mfaAge must require a has-guard");
    }
}
