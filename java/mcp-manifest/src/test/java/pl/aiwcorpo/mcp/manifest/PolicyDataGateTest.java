package pl.aiwcorpo.mcp.manifest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

class PolicyDataGateTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    static Stream<Path> vectors() {
        return ContractFiles.list("test-vectors/policy-data-gate", ".json").stream();
    }

    private static PolicyDataGate.Data data(JsonNode node) {
        return node == null || node.isNull() ? null : new PolicyDataGate.Data(node.get("revision").asLong(),
                node.has("approvedPoliciesHash") ? Optional.of(node.get("approvedPoliciesHash").asText()) : Optional.empty(),
                node.get("overridesValid").asBoolean());
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void gateMatchesJavaScript(Path file) throws Exception {
        JsonNode v = JSON.readTree(file.toFile());
        JsonNode in = v.get("input");
        PolicyDataGate.Decision d = PolicyDataGate.decide(in.get("ownHash").asText(), data(in.get("held")),
                in.get("prv").isNull() ? OptionalLong.empty() : OptionalLong.of(in.get("prv").asLong()));
        assertEquals("continue".equals(v.get("expected").get("decision").asText()), d.allowed(), file::toString);
        if (!d.allowed()) {
            assertEquals(v.get("expected").get("reason").asText(), d.reason(), file::toString);
        }
    }

    @Test
    void anOlderRevisionIsNeverAccepted() {
        assertTrue(PolicyDataGate.acceptRevision(OptionalLong.empty(), 1));
        assertTrue(PolicyDataGate.acceptRevision(OptionalLong.of(5), 6));
        assertFalse(PolicyDataGate.acceptRevision(OptionalLong.of(5), 5));
        assertFalse(PolicyDataGate.acceptRevision(OptionalLong.of(5), 4));
    }

    @Test
    void reservedSystemIdsAreInThePatternsOfTheSchema() throws Exception {
        JsonNode defs = JSON.readTree(ContractFiles.resolve("schemas/common.schema.json").toFile()).get("$defs");
        for (String id : ReservedSystemIds.IDS) {
            assertTrue(ReservedSystemIds.isReserved(id));
            assertFalse(Pattern.compile(defs.get("SystemId").get("pattern").asText()).matcher(id).matches(), id);
            assertFalse(Pattern.compile(defs.get("ServerId").get("pattern").asText()).matcher("mcp-" + id).matches(), id);
            assertTrue(Pattern.compile(defs.get("SystemId").get("pattern").asText()).matcher(id + "x").matches(), id);
        }
        String pattern = defs.get("SystemId").get("pattern").asText();
        for (String id : ReservedSystemIds.IDS) {
            assertTrue(pattern.contains(id), id);
        }
    }
}
