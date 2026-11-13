package pl.aiwcorpo.mcp.manifest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

class DefinitionHashMembersTest {

    @Test
    void membersOutsideTheHashAreRefused() throws Exception {
        JsonNode vector = StrictJson.MAPPER.readTree(ContractFiles.resolve("test-vectors/definition-hash/get-issue.json").toFile());
        JsonNode input = vector.get("input");
        String entry = input.get("manifestEntry").toString();
        String system = input.get("server").get("system").asText();
        String credential = input.get("server").get("credential").toString();
        ObjectNode withMeta = (ObjectNode) input.get("tool").deepCopy();
        withMeta.putObject("_meta").put("note", "x");
        ObjectNode withIcons = (ObjectNode) input.get("tool").deepCopy();
        withIcons.putArray("icons");
        assertThrows(IllegalArgumentException.class, () -> DefinitionHash.compute(withMeta.toString(), entry, system, credential));
        assertThrows(IllegalArgumentException.class, () -> DefinitionHash.compute(withIcons.toString(), entry, system, credential));
        assertEquals(vector.get("expected").asText(), DefinitionHash.compute(input.get("tool").toString(), entry, system, credential));
    }
}
