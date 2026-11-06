package pl.aiwcorpo.mcp.cedar.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.cedarpolicy.BasicAuthorizationEngine;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/** test-vectors/result-filter: ResultFilter and EntityBuilder.queryConstraint on the policies of one fragment (CC-036). */
class ResultFilterVectorTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    static Stream<Path> vectors() {
        return ContractFiles.list("test-vectors/result-filter", ".json").stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void keptElementsAndQueryConstraintsMatch(Path file) throws Exception {
        JsonNode vector = JSON.readTree(file.toFile());
        EntityBuilder builder = VectorInputs.builder(vector, vector.get("input"));
        BasicAuthorizationEngine engine = new BasicAuthorizationEngine();
        var policies = CedarFixtures.policies(vector.get("policies"));
        var schema = CedarFixtures.schema(vector.get("policies"));
        ResultFilter filter = new ResultFilter(builder, ResultFilter.cedarAuthorizer(engine, policies, schema));
        JsonNode input = vector.get("input");
        Caller caller = VectorInputs.caller(input);
        List<JsonNode> items = new ArrayList<>();
        vector.get("items").forEach(items::add);
        List<String> kept = filter.allowed(caller, VectorInputs.tool(input), VectorInputs.arguments(input), items,
                VectorInputs::resource).stream().map(i -> i.get("id").asText()).toList();
        List<String> expected = new ArrayList<>();
        vector.get("expected").get("kept").forEach(k -> expected.add(k.asText()));
        assertEquals(expected, kept, file::toString);

        var constraints = vector.get("expected").get("queryConstraints").fields();
        while (constraints.hasNext()) {
            var entry = constraints.next();
            QueryConstraint constraint = builder.queryConstraint(caller, entry.getKey());
            assertEquals(JSON.convertValue(entry.getValue().get("granted"), new com.fasterxml.jackson.core.type.TypeReference<List<String>>() { }),
                    List.copyOf(constraint.granted()), file::toString);
        }
    }
}
