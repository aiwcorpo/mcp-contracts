package pl.aiwcorpo.mcp.cedar.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cedarpolicy.BasicAuthorizationEngine;
import com.cedarpolicy.model.AuthorizationResponse;
import com.cedarpolicy.model.AuthorizationSuccessResponse;
import com.cedarpolicy.model.Effect;
import com.cedarpolicy.model.EntityValidationRequest;
import com.cedarpolicy.model.entity.Entity;
import com.cedarpolicy.model.exception.InternalException;
import com.cedarpolicy.model.policy.Policy;
import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * test-vectors/policy-decisions: gateway vectors run the platform policies (cedar/platform) and the example overrides on the
 * base schema; server vectors run the policies of one fragment on the base schema composed with its schema.
 */
class PolicyDecisionVectorTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> REQUIRED_COVERAGE = Set.of(
            "no_group", "restricted", "write_without_write_group",
            "unknown_tool", "forbid_overrides_permit", "scope_hierarchy", "search_results", "every_resource_ref");
    private final BasicAuthorizationEngine engine = new BasicAuthorizationEngine();

    static Stream<Path> vectors() {
        return ContractFiles.list("test-vectors/policy-decisions", ".json").stream();
    }

    private static JsonNode read(Path file) {
        try {
            return JSON.readTree(file.toFile());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static PolicySet permitsOnly(PolicySet policies) throws InternalException {
        Set<Policy> permits = new HashSet<>();
        for (Policy policy : policies.policies) {
            if (policy.effect() == Effect.PERMIT) {
                permits.add(policy);
            }
        }
        return new PolicySet(permits);
    }

    /** The vector's request and entities as given, evaluated directly. */
    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void decisionFromVectorRequest(Path file) throws Exception {
        JsonNode vector = read(file);
        JsonNode request = vector.get("request");
        Schema schema = CedarFixtures.schema(vector.get("policies"));
        engine.validateEntities(new EntityValidationRequest(schema, CedarRequests.entityList(vector.get("entities"))));
        AuthorizationResponse response = engine.isAuthorized(
                CedarRequests.request(request.get("principal"), request.get("action"), request.get("resource"),
                        request.get("context"), schema),
                CedarFixtures.policies(vector.get("policies")), CedarRequests.entities(vector.get("entities")));
        assertDecision(file, vector.get("expected"), response);
    }

    /** The same request rebuilt by EntityBuilder from the vector's builder input, then evaluated. */
    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void decisionThroughEntityBuilder(Path file) throws Exception {
        JsonNode vector = read(file);
        JsonNode builder = vector.get("builder");
        if ("unknown-credential-type".equals(builder.path("adjustment").asText())) {
            assertThrows(EntityBuilderException.class, () -> VectorInputs.build(builder.get("level").asText(), builder.get("input"), builder));
            return;
        }
        CedarRequest built = VectorInputs.build(builder.get("level").asText(), builder.get("input"), builder);
        if ("remove-tool-entity".equals(builder.path("adjustment").asText())) {
            Set<Entity> withoutTool = new LinkedHashSet<>(built.entities());
            withoutTool.removeIf(e -> "Tool".equals(e.getEUID().getType().toString()));
            built = new CedarRequest(built.principal(), built.action(), built.resource(), built.context(), withoutTool);
        }
        ObjectNode json = VectorInputs.toJson(built);
        assertEquals(vector.get("request").get("context"), json.get("context"), file::toString);
        assertEquals(vector.get("entities"), json.get("entities"), file::toString);
        AuthorizationResponse response = engine.isAuthorized(
                built.toAuthorizationRequest(CedarFixtures.schema(vector.get("policies"))),
                CedarFixtures.policies(vector.get("policies")), built.cedarEntities());
        assertDecision(file, vector.get("expected"), response);
    }

    /**
     * A vector claiming "forbid overrides permit" must really have a matching permit: with every forbid removed the
     * same request has to be allowed, otherwise the deny comes from the default and proves nothing.
     */
    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void forbidVectorsAreAllowedWithoutForbids(Path file) throws Exception {
        JsonNode vector = read(file);
        boolean claimsOverride = false;
        for (JsonNode c : vector.get("covers")) {
            claimsOverride |= "forbid_overrides_permit".equals(c.asText());
        }
        if (!claimsOverride) {
            return;
        }
        assertEquals("deny", vector.get("expected").get("decision").asText(), file::toString);
        JsonNode request = vector.get("request");
        AuthorizationResponse response = engine.isAuthorized(
                CedarRequests.request(request.get("principal"), request.get("action"), request.get("resource"),
                        request.get("context"), CedarFixtures.schema(vector.get("policies"))),
                permitsOnly(CedarFixtures.policies(vector.get("policies"))), CedarRequests.entities(vector.get("entities")));
        assertTrue(response.success.orElseThrow().isAllowed(), () -> file + " is not allowed without forbids: " + response);
    }

    private static void assertDecision(Path file, JsonNode expected, AuthorizationResponse response) {
        assertTrue(response.success.isPresent(), () -> file + ": " + response);
        AuthorizationSuccessResponse success = response.success.orElseThrow();
        assertEquals(expected.get("decision").asText(), success.isAllowed() ? "allow" : "deny", file::toString);
        Set<String> expectedPolicies = new TreeSet<>();
        expected.get("determiningPolicies").forEach(p -> expectedPolicies.add(p.asText()));
        assertEquals(expectedPolicies, new TreeSet<>(success.getReason()), file::toString);
    }

    @Test
    void briefCoverageIsMet() {
        List<JsonNode> all = vectors().map(PolicyDecisionVectorTest::read).toList();
        assertTrue(all.size() >= 20, "DoD: at least 20 decision vectors, found " + all.size());
        Set<String> covered = new HashSet<>();
        all.forEach(v -> v.get("covers").forEach(c -> covered.add(c.asText())));
        assertTrue(covered.containsAll(REQUIRED_COVERAGE), () -> "missing coverage: " + REQUIRED_COVERAGE);
    }
}
