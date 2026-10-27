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
        EntityBuilder builder = VectorInputs.builder(vector.get("staticEntities").asText());
        ResultFilter filter = new ResultFilter(builder, ResultFilter.cedarAuthorizer(
                new BasicAuthorizationEngine(), CedarFixtures.examplePolicies(), CedarFixtures.schema()));
        JsonNode input = vector.get("input");
        List<ResolvedResource> resources = new ArrayList<>();
        vector.get("resources").forEach(r -> resources.add(VectorInputs.resource(r)));
        assertEquals(vector.get("expected").get("allowed").asBoolean(),
                filter.allAllowed(VectorInputs.caller(input), VectorInputs.tool(input), VectorInputs.arguments(input), resources),
                file::toString);
    }
}
