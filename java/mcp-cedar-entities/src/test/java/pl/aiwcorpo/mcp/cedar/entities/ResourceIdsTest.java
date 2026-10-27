package pl.aiwcorpo.mcp.cedar.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/** ResourceIds must equal common.schema.json and accept exactly the valid ids of test-vectors/resource-ids. */
class ResourceIdsTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void patternsAreTheOnesOfTheJsonSchema() throws Exception {
        JsonNode defs = JSON.readTree(ContractFiles.resolve("schemas/common.schema.json").toFile()).get("$defs");
        var types = defs.get("ResourceIdPatterns").get("const").fields();
        int compared = 0;
        while (types.hasNext()) {
            var type = types.next();
            for (var kind : new String[] {"resource", "scope"}) {
                JsonNode def = type.getValue().get(kind);
                if (def == null) {
                    continue;
                }
                ResourceIds.Kind k = "resource".equals(kind) ? ResourceIds.Kind.RESOURCE : ResourceIds.Kind.SCOPE;
                assertEquals(defs.get(def.asText()).get("pattern").asText(), ResourceIds.pattern(type.getKey(), k),
                        type.getKey() + " " + kind);
                compared++;
            }
        }
        assertEquals(15, compared);
    }

    static Stream<Path> vectors() {
        return ContractFiles.list("test-vectors/resource-ids", ".json").stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void vectorIdsAreClassified(Path file) throws Exception {
        JsonNode v = JSON.readTree(file.toFile());
        ResourceIds.Kind kind = "resource".equals(v.get("kind").asText()) ? ResourceIds.Kind.RESOURCE : ResourceIds.Kind.SCOPE;
        String type = v.get("type").asText();
        v.get("valid").forEach(id -> assertTrue(ResourceIds.isValid(type, kind, id.asText()), file + ": " + id));
        v.get("invalid").forEach(id -> assertFalse(ResourceIds.isValid(type, kind, id.asText()), file + ": " + id));
    }
}
