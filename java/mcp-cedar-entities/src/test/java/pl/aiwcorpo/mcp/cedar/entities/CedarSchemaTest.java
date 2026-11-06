package pl.aiwcorpo.mcp.cedar.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cedarpolicy.BasicAuthorizationEngine;
import com.cedarpolicy.model.ValidationRequest;
import com.cedarpolicy.model.ValidationResponse;
import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;

class CedarSchemaTest {

    private final BasicAuthorizationEngine engine = new BasicAuthorizationEngine();

    @Test
    void baseSchemaParsesAndNamesNoSystem() throws Exception {
        String text = ContractFiles.read(ContractFiles.resolve("cedar/mcp.cedarschema"));
        Schema parsed = Schema.parse(Schema.JsonOrCedar.Cedar, text);
        JsonNode json = parsed.toJsonFormat();
        assertEquals(List.of(""), List.copyOf(new TreeSet<>(iterate(json.fieldNames()))), "only the empty namespace");
        assertEquals(List.of("ResourceScope", "Tool", "User", "UserGroup"),
                List.copyOf(new TreeSet<>(iterate(json.get("").get("entityTypes").fieldNames()))));
        assertEquals(List.of("call"), List.copyOf(iterate(json.get("").get("actions").fieldNames())));
        assertFalse(text.contains("\r"), "LF line endings only");
    }

    private static List<String> iterate(java.util.Iterator<String> names) {
        List<String> out = new java.util.ArrayList<>();
        names.forEachRemaining(out::add);
        return out;
    }

    @Test
    void platformPoliciesValidateAgainstTheBaseSchemaWithoutWarnings() throws Exception {
        PolicySet set = McpCedarSchema.platformPolicies();
        assertEquals(2, set.policies.size());
        ValidationResponse response = engine.validate(new ValidationRequest(McpCedarSchema.schema(), set));
        assertTrue(response.validationPassed(), response::toString);
        assertEquals(0, response.success.orElseThrow().validationWarnings.size(), response::toString);
    }

    @Test
    void platformPolicyListEqualsTheDirectory() throws Exception {
        List<String> onDisk;
        try (var files = Files.list(ContractFiles.resolve("cedar/platform"))) {
            onDisk = files.map(Path::getFileName).map(Path::toString).sorted().toList();
        }
        assertEquals(onDisk, McpCedarSchema.PLATFORM_POLICY_FILES.stream().sorted().toList());
    }

    @Test
    void overrideExamplesValidateAgainstTheBaseSchema() throws Exception {
        for (Path file : ContractFiles.list("cedar/examples/overrides", ".cedar")) {
            PolicySet set = PolicyFragments.policySet(java.util.Map.of(file.getFileName().toString(), ContractFiles.read(file)));
            ValidationResponse response = engine.validate(new ValidationRequest(McpCedarSchema.schema(), set));
            assertTrue(response.validationPassed(), () -> file + ": " + response);
            assertEquals(0, response.success.orElseThrow().validationWarnings.size(), () -> file + ": " + response);
        }
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
        ValidationResponse response = engine.validate(new ValidationRequest(McpCedarSchema.schema(), mixedSet));
        assertFalse(response.validationPassed(), "strict mode must reject a set of User and Tool");
        assertTrue(response.toString().contains("are not compatible"), response::toString);
    }

    @Test
    void optionalAttributeWithoutHasGuardIsRejected() throws Exception {
        PolicySet unguarded = PolicySet.parsePolicies("""
                permit (principal, action == Action::"call", resource is Tool)
                when { context.mfaAge < 3600 };
                """);
        ValidationResponse response = engine.validate(new ValidationRequest(McpCedarSchema.schema(), unguarded));
        assertFalse(response.validationPassed(), "optional context.mfaAge must require a has-guard");
    }

    /**
     * The 7.0.0 rule that a namespaced fragment names base types unqualified and declares namespaced actions: cedar-java
     * 4.10.0 resolves them, so the contracts need no qualification such as {@code ::User}.
     */
    @Test
    void namespacedFragmentResolvesBaseTypesAndDeclaresItsOwnActions() throws Exception {
        for (String system : List.of("jira", "confluence", "gitlab", "opensearch", "servicedesk")) {
            String fragment = ContractFiles.read(ContractFiles.resolve("cedar/examples/systems/" + system + "/schema.cedarschema"));
            JsonNode composed = Schema.parse(Schema.JsonOrCedar.Cedar, PolicyFragments.composeSchemaText(fragment)).toJsonFormat();
            assertTrue(composed.has(""), system);
            assertTrue(composed.size() == 2, system);
            ValidationResponse response = engine.validate(new ValidationRequest(PolicyFragments.composeSchema(fragment), new PolicySet()));
            assertTrue(response.validationPassed(), () -> system + ": " + response);
        }
    }
}
