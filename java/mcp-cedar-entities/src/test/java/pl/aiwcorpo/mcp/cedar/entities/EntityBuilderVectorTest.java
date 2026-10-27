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
            var e = assertThrows(EntityBuilderException.class, () -> VectorInputs.build(level, vector.get("input"), vector.get("staticEntities").asText()));
            assertEquals(expected.get("error").asText(), e.code().wireCode());
            return;
        }
        CedarRequest built = VectorInputs.build(level, vector.get("input"), vector.get("staticEntities").asText());
        assertEquals(expected, VectorInputs.toJson(built));

        engine.validateEntities(new EntityValidationRequest(CedarFixtures.schema(), new ArrayList<>(built.entities())));
        AuthorizationResponse response = engine.isAuthorized(
                built.toAuthorizationRequest(CedarFixtures.schema()), CedarFixtures.examplePolicies(), built.cedarEntities());
        assertTrue(response.success.isPresent(), () -> file + ": " + response);
    }

    @Test
    void mappingRejectsParentsThatAreNotScopes() throws Exception {
        var entities = com.cedarpolicy.model.entity.Entities.parse(
                "[{\"uid\":{\"type\":\"UserGroup\",\"id\":\"mcp-x\"},\"attrs\":{},\"parents\":[{\"type\":\"UserGroup\",\"id\":\"mcp-y\"}]}]");
        var e = assertThrows(EntityBuilderException.class, () -> ScopeMapping.fromStaticEntities(entities.getEntities()));
        assertEquals(EntityBuilderException.Code.INTERNAL_ERROR, e.code());
        var badId = com.cedarpolicy.model.entity.Entities.parse(
                "[{\"uid\":{\"type\":\"UserGroup\",\"id\":\"mcp-x\"},\"attrs\":{},\"parents\":[{\"type\":\"ResourceScope\",\"id\":\"Jira::Issue/ABC-1\"}]}]");
        assertThrows(EntityBuilderException.class, () -> ScopeMapping.fromStaticEntities(badId.getEntities()));
    }

    @Test
    void vscFieldsMustHoldOneToFiftyIds() {
        assertThrows(EntityBuilderException.class, () -> VirtualServerScope.fromClaims("x", Map.of("jiraProjects", List.of())));
        List<String> many = java.util.stream.IntStream.range(0, 51).mapToObj(i -> "P" + i).toList();
        assertThrows(EntityBuilderException.class, () -> VirtualServerScope.fromClaims("x", Map.of("jiraProjects", many)));
    }

    @Test
    void longOverflowIsABuilderError() {
        Caller caller = Caller.of("u", "u", List.of(), "claude-code");
        ToolDescriptor tool = new ToolDescriptor("mcp-jira", "jira", "get_issue", "READ_ONLY", "read", List.of());
        var resource = ResolvedResource.of("Jira::Project", "ABC",
                Map.of("key", "ABC", "size", new java.math.BigInteger("99999999999999999999")));
        assertThrows(EntityBuilderException.class, () -> new EntityBuilder().forResource(caller, tool, Map.of(), resource));
    }

    @Test
    void queryConstraintCombinesLinkAndMapping() {
        Caller caller = Caller.of("u", "u", List.of("mcp-jira-proj-ABC", "mcp-jira-proj-DEF"), "claude-code")
                .withVirtualServer(VirtualServerScope.fromResourceDefaults("l", Map.of("Jira::Project", List.of("ABC"))));
        QueryConstraint c = VectorInputs.builder("cedar/examples/static-entities.json").queryConstraint(caller, "Jira::Project");
        assertEquals(List.of("ABC"), List.copyOf(c.virtualServer().orElseThrow()));
        assertEquals(List.of("ABC", "DEF"), List.copyOf(c.granted()));
        assertTrue(new EntityBuilder().queryConstraint(caller, "Jira::Project").granted().isEmpty());
    }

    @Test
    void pathPrefixesStopAtSlashes() {
        assertEquals(List.of("team-a", "team-a/sub", "team-a/sub/app"), List.copyOf(ResourceScopes.pathPrefixes("team-a/sub/app")));
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
            CedarRequest request = new EntityBuilder().forToolCall(caller, tool, Map.of("ticketId", id));
            var refs = (com.cedarpolicy.value.CedarMap) request.context().get("refs");
            assertEquals(List.of(new com.cedarpolicy.value.PrimString("4711")), List.copyOf(
                    (com.cedarpolicy.value.CedarList) refs.get("servicedeskTicket")));
        }
        var e = assertThrows(EntityBuilderException.class, () ->
                new EntityBuilder().forToolCall(caller, tool, Map.of("ticketId", 47.5)));
        assertEquals(EntityBuilderException.Code.INVALID_ARGUMENT, e.code());
    }

    @Test
    void gatewayMapsResourceDefaultsToVsc() {
        VirtualServerScope link = VirtualServerScope.fromResourceDefaults("team-a",
                Map.of("Jira::Project", List.of("DEF", "ABC"), "OpenSearch::Index", List.of("logs-team-a")));
        assertEquals(List.of("jiraProjects", "opensearchIndexPrefixes"), List.copyOf(link.vsScopes().keySet()));
        assertEquals(List.of("ABC", "DEF"), List.copyOf(link.vsScopes().get("jiraProjects")));
        var e = assertThrows(EntityBuilderException.class, () ->
                VirtualServerScope.fromResourceDefaults("x", Map.of("Jira::Issue", List.of("ABC-1"))));
        assertEquals(EntityBuilderException.Code.INTERNAL_ERROR, e.code());
    }

    @Test
    void bundledSchemaIsOnTheClasspath() {
        assertTrue(McpCedarSchema.text().contains("entity UserGroup"));
    }
}
