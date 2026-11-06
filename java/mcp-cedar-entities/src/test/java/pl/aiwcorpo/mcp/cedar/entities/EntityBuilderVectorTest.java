package pl.aiwcorpo.mcp.cedar.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cedarpolicy.BasicAuthorizationEngine;
import com.cedarpolicy.model.EntityValidationRequest;
import com.cedarpolicy.model.schema.Schema;
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
            var e = assertThrows(EntityBuilderException.class, () -> VectorInputs.build(level, vector.get("input"), vector));
            assertEquals(expected.get("error").asText(), e.code().wireCode());
            return;
        }
        CedarRequest built = VectorInputs.build(level, vector.get("input"), vector);
        assertEquals(expected, VectorInputs.toJson(built));
    }

    /** The entities and the request of every vector conform to the base schema composed with the fragments of the example systems. */
    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void builtEntitiesValidateAgainstTheComposedSchema(Path file) throws Exception {
        JsonNode vector = JSON.readTree(file.toFile());
        if (vector.get("expected").has("error")) {
            return;
        }
        CedarRequest built = VectorInputs.build(vector.get("level").asText(), vector.get("input"), vector);
        Schema schema = PolicyFragments.composeSchema(composedFragments(vector));
        engine.validateEntities(new EntityValidationRequest(schema, new ArrayList<>(built.entities())));
        var response = engine.isAuthorized(built.toAuthorizationRequest(schema), new com.cedarpolicy.model.policy.PolicySet(), built.cedarEntities());
        assertTrue(response.success.isPresent(), () -> file + ": " + response);
    }

    /** One schema text of every fragment whose resource types the vector loads. */
    private static String composedFragments(JsonNode vector) {
        StringBuilder text = new StringBuilder();
        vector.get("resourceTypes").forEach(path -> {
            String dir = path.asText().substring(0, path.asText().lastIndexOf('/'));
            text.append(ContractFiles.read(ContractFiles.resolve(dir + "/schema.cedarschema"))).append('\n');
        });
        return text.toString();
    }

    @Test
    void mappingRejectsScopeIdsThatDoNotMatchTheDeclarations() {
        ResourceTypes types = ResourceTypes.fromJson(ContractFiles.read(ContractFiles.resolve("cedar/examples/systems/jira/resource-types.json")));
        assertThrows(EntityBuilderException.class, () -> ScopeMapping.of(types, Map.of("mcp-x", List.of("Jira::Issue/ABC-1"))));
        assertThrows(EntityBuilderException.class, () -> ScopeMapping.of(types, Map.of("mcp-x", List.of("Jira::Project/abc"))));
        assertThrows(EntityBuilderException.class, () -> ScopeMapping.of(types, Map.of("mcp-x", List.of("Mystery::Place/x"))));
        assertThrows(EntityBuilderException.class, () -> ScopeMapping.of(types, Map.of("mcp-x", List.of("Jira::Project/"))));
    }

    @Test
    void registeredMappingSkipsOnlyTypesNoServerDeclares() {
        ResourceTypes types = ResourceTypes.fromJson(ContractFiles.read(ContractFiles.resolve("cedar/examples/systems/jira/resource-types.json")));
        ScopeMapping mapping = ScopeMapping.ofRegistered(types,
                Map.of("mcp-x", List.of("Jira::Project/ABC", "Removed::Thing/foo")));
        assertEquals(List.of("Jira::Project/ABC"), List.copyOf(mapping.scopesOf("mcp-x")));
        ScopeMapping lenient = ScopeMapping.ofRegistered(types,
                Map.of("mcp-x", List.of("Jira::Project/abc", "Jira::Project/DEF", "Removed::Thing/foo"), "mcp-y", List.of("Jira::Project/GHI")));
        assertEquals(List.of("Jira::Project/DEF"), List.copyOf(lenient.scopesOf("mcp-x")), "one bad scope does not drop the others");
        assertEquals(List.of("Jira::Project/GHI"), List.copyOf(lenient.scopesOf("mcp-y")));
        assertEquals(List.of("invalid_scope", "undeclared_type"), lenient.ignored().stream().map(ScopeMapping.Ignored::reason).sorted().toList());
        ScopeMapping fromJson = ScopeMapping.fromJson(types,
                "[{\"group\":\"a\",\"scopes\":[\"Jira::Project/AB\",\"Jira::Project/x\"]},{\"group\":\"a\",\"scopes\":[]},{\"scopes\":[]}]", true);
        assertEquals(List.of("Jira::Project/AB"), List.copyOf(fromJson.scopesOf("a")));
        assertEquals(3, fromJson.ignored().size());
    }

    @Test
    void mappingForANamespaceKeepsOnlyItsScopes() {
        ResourceTypes types = ResourceTypes.of(java.util.stream.Stream.of("cedar/examples/systems/jira", "test-vectors/fixtures/notes")
                .flatMap(d -> ResourceTypes.fromJson(ContractFiles.read(ContractFiles.resolve(d + "/resource-types.json"))).declarations().stream()).toList());
        ScopeMapping all = ScopeMapping.of(types, Map.of("g1", List.of("Jira::Project/ABC", "Notes::Folder/team"), "g2", List.of("Jira::Project/DEF")));
        ScopeMapping notes = all.forNamespace("Notes");
        assertEquals(List.of("Notes::Folder/team"), List.copyOf(notes.scopesOf("g1")));
        assertTrue(notes.scopesOf("g2").isEmpty());
        assertEquals(List.of("g1"), List.copyOf(notes.asMap().keySet()));
    }

    @Test
    void mappingFromThePolicyDataShape() {
        ResourceTypes types = ResourceTypes.fromJson(ContractFiles.read(ContractFiles.resolve("cedar/examples/systems/jira/resource-types.json")));
        ScopeMapping mapping = ScopeMapping.fromJson(types,
                "[{\"group\":\"mcp-a\",\"scopes\":[\"Jira::Project/DEF\",\"Jira::Project/ABC\"]},{\"group\":\"mcp-b\",\"scopes\":[]}]", false);
        assertEquals(List.of("Jira::Project/ABC", "Jira::Project/DEF"), List.copyOf(mapping.scopesOf("mcp-a")));
        assertTrue(mapping.scopesOf("mcp-b").isEmpty());
        assertThrows(EntityBuilderException.class, () -> ScopeMapping.fromJson(types,
                "[{\"group\":\"mcp-a\",\"scopes\":[]},{\"group\":\"mcp-a\",\"scopes\":[]}]", false));
    }

    @Test
    void longOverflowIsABuilderError() {
        Caller caller = Caller.of("u", "u", List.of(), "claude-code");
        ToolDescriptor tool = new ToolDescriptor("mcp-notes", "notes", "get_folder", "READ_ONLY", "read", List.of());
        ResourceTypes types = ResourceTypes.of(List.of(new ResourceTypeDeclaration("Notes::Counter", List.of("size"),
                java.util.Optional.empty(), java.util.Optional.empty(), "^[a-z]+$", java.util.Optional.empty(), false, java.util.Optional.empty())));
        var resource = ResolvedResource.of("Notes::Counter", "c", Map.of("size", new java.math.BigInteger("99999999999999999999")));
        assertThrows(EntityBuilderException.class,
                () -> new EntityBuilder(types, ScopeMapping.empty()).forResource(caller, tool, Map.of(), resource));
    }

    @Test
    void queryConstraintComesFromTheMapping() throws Exception {
        JsonNode vector = JSON.readTree("{\"resourceTypes\": [\"cedar/examples/systems/jira/resource-types.json\","
                + " \"test-vectors/fixtures/notes/resource-types.json\"], \"scopeMapping\": \"test-vectors/fixtures/scope-mapping.json\"}");
        Caller caller = Caller.of("u", "u", List.of("mcp-jira-proj-ABC", "mcp-jira-proj-DEF"), "claude-code");
        EntityBuilder builder = VectorInputs.builder(vector);
        assertEquals(List.of("ABC", "DEF"), List.copyOf(builder.queryConstraint(caller, "Jira::Project").granted()));
        assertTrue(new EntityBuilder(builder.resourceTypes(), ScopeMapping.empty()).queryConstraint(caller, "Jira::Project").granted().isEmpty());
        assertThrows(EntityBuilderException.class, () -> builder.queryConstraint(caller, "Jira::Issue"));
    }

    @Test
    void pathPrefixesStopAtSlashes() {
        assertEquals(List.of("team-a", "team-a/sub", "team-a/sub/app"), List.copyOf(Scopes.pathPrefixes("team-a/sub/app")));
    }

    @Test
    void dashPrefixesStopAtDashes() {
        assertEquals(List.of("logs", "logs-team", "logs-team-a", "logs-team-a-2026.10"),
                List.copyOf(Scopes.dashPrefixes("logs-team-a-2026.10")));
        assertEquals(List.of("logs"), List.copyOf(Scopes.dashPrefixes("logs")));
    }

    @Test
    void integralNumbersFromAnyJsonParserBecomeIds() {
        ResourceTypes types = ResourceTypes.fromJson(ContractFiles.read(ContractFiles.resolve("test-vectors/fixtures/notes/resource-types.json")));
        ToolDescriptor tool = new ToolDescriptor("mcp-notes", "notes", "get_note", "READ_ONLY", "read",
                List.of(new ResourceRef("noteId", "Notes::Note")));
        Caller caller = Caller.of("u", "u", List.of(), "claude-code");
        EntityBuilder builder = new EntityBuilder(types, ScopeMapping.empty());
        for (Object id : List.of(4711, 4711L, 4711.0d, new java.math.BigDecimal("4711"))) {
            assertEquals(List.of("4711"), builder.resourceValues(tool, Map.of("noteId", id)).stream().map(Map.Entry::getValue).toList());
        }
        var e = assertThrows(EntityBuilderException.class, () -> builder.forToolCall(caller, tool, Map.of("noteId", 47.5)));
        assertEquals(EntityBuilderException.Code.INVALID_ARGUMENT, e.code());
    }

    @Test
    void bundledSchemaIsOnTheClasspath() {
        assertTrue(McpCedarSchema.text().contains("entity UserGroup"));
    }
}
