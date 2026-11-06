package pl.aiwcorpo.mcp.cedar.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.cedarpolicy.BasicAuthorizationEngine;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/** test-vectors/resource-checks: every value of every resourceRef is evaluated (CC-061). */
class ResourceCheckVectorTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    static Stream<Path> vectors() {
        return ContractFiles.list("test-vectors/resource-checks", ".json").stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void callAllowedOnlyWhenEveryResourceIs(Path file) throws Exception {
        JsonNode vector = JSON.readTree(file.toFile());
        EntityBuilder builder = VectorInputs.builder(vector, vector.get("input"));
        ResultFilter filter = new ResultFilter(builder, ResultFilter.cedarAuthorizer(
                new BasicAuthorizationEngine(), CedarFixtures.policies(vector.get("policies")), CedarFixtures.schema(vector.get("policies"))));
        JsonNode input = vector.get("input");
        List<ResolvedResource> resources = new ArrayList<>();
        vector.get("resources").forEach(r -> resources.add(VectorInputs.resource(r)));
        assertEquals(vector.get("expected").get("allowed").asBoolean(),
                filter.allAllowed(VectorInputs.caller(input), VectorInputs.tool(input), VectorInputs.arguments(input), resources),
                file::toString);
    }

    /** The same vectors through checkAll, which enumerates the values itself and resolves them by id. */
    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void checkAllEnumeratesEveryValue(Path file) throws Exception {
        JsonNode vector = JSON.readTree(file.toFile());
        EntityBuilder builder = VectorInputs.builder(vector, vector.get("input"));
        ResultFilter filter = new ResultFilter(builder, ResultFilter.cedarAuthorizer(
                new BasicAuthorizationEngine(), CedarFixtures.policies(vector.get("policies")), CedarFixtures.schema(vector.get("policies"))));
        JsonNode input = vector.get("input");
        java.util.Map<String, ResolvedResource> byId = new java.util.HashMap<>();
        vector.get("resources").forEach(r -> byId.put(r.get("type").asText() + "/" + r.get("id").asText(), VectorInputs.resource(r)));
        ResultFilter.CheckResult result = filter.checkAll(VectorInputs.caller(input), VectorInputs.tool(input),
                VectorInputs.arguments(input), (type, id) -> java.util.Objects.requireNonNull(byId.get(type + "/" + id)),
                java.util.Optional.empty());
        assertEquals(vector.get("expected").get("allowed").asBoolean(), result.allowed(), () -> file + ": " + result);
    }
}
