package pl.aiwcorpo.mcp.manifest;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/** CC-206: the hash of an adapter entry is the same with or without the classification of the registry. */
class AdapterHashTest {

    @Test
    void classificationDoesNotChangeTheHashOfAnAdapterEntry() throws Exception {
        Path file = ContractFiles.list("test-vectors/manifests", ".json").stream()
                .filter(p -> p.getFileName().toString().equals("valid-adapter.json")).findFirst().orElseThrow();
        JsonNode manifest = StrictJson.MAPPER.readTree(file.toFile()).get("manifest");
        JsonNode tool = manifest.get("tools").get(0);
        String declared = tool.get("definitionHash").asText();
        assertEquals(declared, DefinitionHash.ofManifestTool(manifest.toString(), tool.get("name").asText()));
        ObjectNode classified = (ObjectNode) manifest.deepCopy();
        ObjectNode entry = (ObjectNode) classified.get("tools").get(0);
        entry.put("risk", "UPDATE");
        entry.put("action", "update");
        assertEquals(declared, DefinitionHash.ofManifestTool(classified.toString(), entry.get("name").asText()));
    }
}
