package pl.aiwcorpo.mcp.contracts.cedar;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cedarpolicy.BasicAuthorizationEngine;
import com.cedarpolicy.model.AuthorizationResponse;
import com.cedarpolicy.model.AuthorizationSuccessResponse;
import com.cedarpolicy.model.policy.PolicySet;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import pl.aiwcorpo.mcp.contracts.ContractFiles;

class PolicyDecisionVectorTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> REQUIRED_COVERAGE = Set.of(
            "no_group", "restricted", "write_without_write_group", "virtual_server_narrowing",
            "unknown_tool", "forbid_overrides_permit");
    private static PolicySet policies;
    private final BasicAuthorizationEngine engine = new BasicAuthorizationEngine();

    @BeforeAll
    static void loadPolicies() {
        policies = CedarFixtures.examplePolicies();
    }

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

    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void decisionMatches(Path file) throws Exception {
        JsonNode vector = read(file);
        assertEquals("cedar/examples", vector.get("policies").asText());
        JsonNode request = vector.get("request");
        AuthorizationResponse response = engine.isAuthorized(
                CedarRequests.request(request.get("principal"), request.get("action"), request.get("resource"),
                        request.get("context")),
                policies, CedarRequests.entities(vector.get("entities")));
        assertTrue(response.success.isPresent(), () -> file + ": " + response);
        AuthorizationSuccessResponse success = response.success.orElseThrow();
        JsonNode expected = vector.get("expected");
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
