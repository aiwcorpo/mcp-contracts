package pl.aiwcorpo.mcp.cedar.entities;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/** The idPattern and scopePattern of a declaration accept exactly the valid ids of test-vectors/resource-ids. */
class ResourceIdsTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    static Stream<Path> vectors() {
        return ContractFiles.list("test-vectors/resource-ids", ".json").stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void vectorIdsAreClassified(Path file) throws Exception {
        JsonNode v = JSON.readTree(file.toFile());
        ResourceTypes types = ResourceTypes.fromJson(ContractFiles.read(ContractFiles.resolve(v.get("resourceTypes").asText())));
        boolean resource = "resource".equals(v.get("kind").asText());
        String type = v.get("type").asText();
        v.get("valid").forEach(id -> assertTrue(
                resource ? types.isValidId(type, id.asText()) : types.isValidScopeLocalId(type, id.asText()), file + ": " + id));
        v.get("invalid").forEach(id -> assertFalse(
                resource ? types.isValidId(type, id.asText()) : types.isValidScopeLocalId(type, id.asText()), file + ": " + id));
    }
}
