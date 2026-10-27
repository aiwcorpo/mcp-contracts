package pl.aiwcorpo.mcp.manifest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/** The Java implementation must reproduce the JavaScript-generated vectors exactly (CC-063). */
class ManifestVectorTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    static Stream<Path> hashVectors() {
        return ContractFiles.list("test-vectors/definition-hash", ".json").stream();
    }

    static Stream<Path> manifestVectors() {
        return ContractFiles.list("test-vectors/manifests", ".json").stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("hashVectors")
    void definitionHashMatchesJavaScript(Path file) throws Exception {
        JsonNode v = JSON.readTree(file.toFile());
        JsonNode input = v.get("input");
        String definition = JSON.writeValueAsString(input.get("tool"));
        String entry = JSON.writeValueAsString(input.get("manifestEntry"));
        String system = input.get("server").get("system").asText();
        String credential = JSON.writeValueAsString(input.get("server").get("credential"));
        assertEquals(v.get("canonical").asText(), DefinitionHash.canonicalInput(definition, entry, system, credential), file::toString);
        assertEquals(v.get("expected").asText(), DefinitionHash.compute(definition, entry, system, credential), file::toString);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("manifestVectors")
    void rulesMatchJavaScript(Path file) throws Exception {
        JsonNode v = JSON.readTree(file.toFile());
        JsonNode expected = v.get("expected");
        if (!expected.get("valid").asBoolean() && "schema".equals(expected.get("rule").asText())) {
            return;
        }
        var violations = ManifestRules.violations(JSON.writeValueAsString(v.get("manifest")));
        if (expected.get("valid").asBoolean()) {
            assertTrue(violations.isEmpty(), () -> file + ": " + violations);
        } else {
            assertTrue(violations.contains(expected.get("rule").asText()), () -> file + ": " + violations);
        }
    }

    @Test
    void numbersFollowEcmaScript() {
        assertEquals("1000", CanonicalJson.number(1e3));
        assertEquals("1", CanonicalJson.number(1.0));
        assertEquals("0.1", CanonicalJson.number(0.1));
        assertEquals("1e+21", CanonicalJson.number(1e21));
        assertEquals("100000000000000000000", CanonicalJson.number(1e20));
        assertEquals("1e-7", CanonicalJson.number(1e-7));
        assertEquals("0.000001", CanonicalJson.number(1e-6));
        assertEquals("123.456", CanonicalJson.number(123.456));
        assertEquals("-5e-324", CanonicalJson.number(-Double.MIN_VALUE));
        assertEquals("0", CanonicalJson.number(-0.0));
        assertEquals("9007199254740992", CanonicalJson.number(9007199254740992d));
        assertEquals("1.7976931348623157e+308", CanonicalJson.number(Double.MAX_VALUE));
    }

    @Test
    void keysSortedByUtf16AndStringsEscapedLikeJavaScript() {
        assertEquals("{\"\\u0007\":\"\\n\",\"a\":1,\"b\":[true,null]}",
                CanonicalJson.canonicalize("{\"b\":[true,null],\"a\":1.0,\"\\u0007\":\"\\n\"}"));
    }

    @Test
    void duplicateKeysAndTrailingContentAreRejected() {
        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class, () -> CanonicalJson.canonicalize("{\"a\":1,\"a\":2}"));
        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class, () -> CanonicalJson.canonicalize("{\"a\":1} {\"b\":2}"));
        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class, () -> ManifestRules.violations("{\"tools\":[],\"tools\":[]}"));
    }
}
