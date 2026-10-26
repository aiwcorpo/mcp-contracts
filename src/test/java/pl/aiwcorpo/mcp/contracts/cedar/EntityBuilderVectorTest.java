package pl.aiwcorpo.mcp.contracts.cedar;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cedarpolicy.BasicAuthorizationEngine;
import com.cedarpolicy.model.AuthorizationResponse;
import com.cedarpolicy.model.EntityValidationRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import pl.aiwcorpo.mcp.contracts.ContractFiles;

class EntityBuilderVectorTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private final BasicAuthorizationEngine engine = new BasicAuthorizationEngine();

    static Stream<Path> vectors() {
        return ContractFiles.list("test-vectors/entity-builder", ".json").stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void referenceBuilderMatchesVector(Path file) throws Exception {
        JsonNode vector = JSON.readTree(file.toFile());
        JsonNode expected = vector.get("expected");
        String level = vector.get("level").asText();
        if (expected.has("error")) {
            var e = assertThrows(ReferenceEntityBuilder.BuilderException.class,
                    () -> ReferenceEntityBuilder.build(level, vector.get("input")));
            assertEquals(expected.get("error").asText(), e.code());
            return;
        }
        // Round-trip through text so that int and long nodes compare equal.
        assertEquals(expected, JSON.readTree(ReferenceEntityBuilder.build(level, vector.get("input")).toString()));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void builderOutputConformsToSchema(Path file) throws Exception {
        JsonNode expected = JSON.readTree(file.toFile()).get("expected");
        if (expected.has("error")) {
            return;
        }
        engine.validateEntities(new EntityValidationRequest(
                CedarFixtures.schema(), CedarRequests.entityList(expected.get("entities"))));
        AuthorizationResponse response = engine.isAuthorized(
                CedarRequests.request(expected.get("principal"), expected.get("action"), expected.get("resource"),
                        expected.get("context")),
                CedarFixtures.examplePolicies(), CedarRequests.entities(expected.get("entities")));
        assertTrue(response.success.isPresent(), () -> file + ": " + response);
    }

    @Test
    void scopeParsingKeepsDashesAndCase() {
        JsonNode scopes = ReferenceEntityBuilder.scopes(List.of("mcp-gitlab-grp-team-a", "mcp-jira-proj-ABC", "mcp-jira-read"));
        assertEquals("team-a", scopes.get("gitlabGroups").get(0).asText());
        assertEquals("ABC", scopes.get("jiraProjects").get(0).asText());
        assertEquals(0, scopes.get("confluenceSpaces").size());
    }

    @Test
    void namePrefixesStopAtDashes() {
        assertEquals(List.of("logs", "logs-team", "logs-team-a", "logs-team-a-2026.10"),
                List.copyOf(ReferenceEntityBuilder.namePrefixes("logs-team-a-2026.10")));
    }
}
