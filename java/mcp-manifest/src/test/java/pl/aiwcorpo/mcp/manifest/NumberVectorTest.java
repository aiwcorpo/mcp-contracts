package pl.aiwcorpo.mcp.manifest;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HexFormat;
import org.junit.jupiter.api.Test;

/** Number serialization against values produced by the JavaScript engine (test-vectors/canonical-json). */
class NumberVectorTest {

    @Test
    void everyDoubleMatchesJavaScript() throws Exception {
        JsonNode cases = new ObjectMapper().readTree(ContractFiles.resolve("test-vectors/canonical-json/numbers.json").toFile()).get("cases");
        for (JsonNode c : cases) {
            double value = Double.longBitsToDouble(HexFormat.fromHexDigitsToLong(c.get("bits").asText()));
            assertEquals(c.get("canonical").asText(), CanonicalJson.number(value), c.get("bits").asText());
        }
    }

    @Test
    void powersOfTwoAndRandomDoublesMatchJavaScript() throws Exception {
        JsonNode cases;
        try (var in = NumberVectorTest.class.getResourceAsStream("/ecmascript-numbers.json")) {
            cases = new ObjectMapper().readTree(in).get("cases");
        }
        int checked = 0;
        for (JsonNode c : cases) {
            double value = Double.longBitsToDouble(HexFormat.fromHexDigitsToLong(c.get("bits").asText()));
            assertEquals(c.get("canonical").asText(), CanonicalJson.number(value), c.get("bits").asText());
            checked++;
        }
        assertEquals(cases.size(), checked);
    }
}
