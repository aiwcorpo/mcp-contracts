package pl.aiwcorpo.mcp.cedar.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cedarpolicy.BasicAuthorizationEngine;
import com.cedarpolicy.model.AuthorizationResponse;
import com.cedarpolicy.model.EntityValidationRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

class EntityBuilderVectorTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private final BasicAuthorizationEngine engine = new BasicAuthorizationEngine();

    static Stream<Path> vectors() {
        return ContractFiles.list("test-vectors/entity-builder", ".json").stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void builderMatchesVector(Path file) throws Exception {
        JsonNode vector = JSON.readTree(file.toFile());
        JsonNode expected = vector.get("expected");
        String level = vector.get("level").asText();
        if (expected.has("error")) {
            var e = assertThrows(EntityBuilderException.class, () -> VectorInputs.build(level, vector.get("input")));
            assertEquals(expected.get("error").asText(), e.code().wireCode());
            return;
        }
        CedarRequest built = VectorInputs.build(level, vector.get("input"));
        assertEquals(expected, VectorInputs.toJson(built));

        engine.validateEntities(new EntityValidationRequest(CedarFixtures.schema(), new ArrayList<>(built.entities())));
        AuthorizationResponse response = engine.isAuthorized(
                built.toAuthorizationRequest(CedarFixtures.schema()), CedarFixtures.examplePolicies(), built.cedarEntities());
        assertTrue(response.success.isPresent(), () -> file + ": " + response);
    }

    @Test
    void scopeParsingKeepsDashesAndCase() {
        var scopes = ScopeGroups.scopesFromGroups(List.of("mcp-gitlab-grp-team-a", "mcp-jira-proj-ABC", "mcp-jira-read"));
        assertEquals(List.of("team-a"), List.copyOf(scopes.get("gitlabGroups")));
        assertEquals(List.of("ABC"), List.copyOf(scopes.get("jiraProjects")));
        assertTrue(scopes.get("confluenceSpaces").isEmpty());
        assertEquals(ScopeGroups.SCOPE_FIELDS, List.copyOf(scopes.keySet()));
    }

    @Test
    void namePrefixesStopAtDashes() {
        assertEquals(List.of("logs", "logs-team", "logs-team-a", "logs-team-a-2026.10"),
                List.copyOf(ScopeGroups.namePrefixes("logs-team-a-2026.10")));
        assertEquals(List.of("logs"), List.copyOf(ScopeGroups.namePrefixes("logs")));
    }

    @Test
    void refsFieldNaming() {
        assertEquals("jiraProject", ScopeGroups.refsField("Jira::Project"));
        assertEquals("opensearchIndex", ScopeGroups.refsField("OpenSearch::Index"));
        assertEquals("servicedeskTicket", ScopeGroups.refsField("ServiceDesk::Ticket"));
    }

    @Test
    void integralNumbersFromAnyJsonParserBecomeIds() {
        ToolDescriptor tool = new ToolDescriptor("mcp-servicedesk", "servicedesk", "get_ticket", "READ_ONLY", "read",
                List.of(new ResourceRef("ticketId", "ServiceDesk::Ticket")));
        Caller caller = Caller.of("u", "u", List.of(), "claude-code");
        for (Object id : List.of(4711, 4711L, 4711.0d, new java.math.BigDecimal("4711"))) {
            CedarRequest request = new EntityBuilder().forToolCall(caller, tool, Map.of("ticketId", id), Optional.empty());
            var refs = (com.cedarpolicy.value.CedarMap) request.context().get("refs");
            assertEquals(List.of(new com.cedarpolicy.value.PrimString("4711")), List.copyOf(
                    (com.cedarpolicy.value.CedarList) refs.get("servicedeskTicket")));
        }
        var e = assertThrows(EntityBuilderException.class, () ->
                new EntityBuilder().forToolCall(caller, tool, Map.of("ticketId", 47.5), Optional.empty()));
        assertEquals(EntityBuilderException.Code.INVALID_ARGUMENT, e.code());
    }

    @Test
    void bundledSchemaIsOnTheClasspath() {
        assertTrue(McpCedarSchema.text().contains("entity UserGroup"));
    }
}
