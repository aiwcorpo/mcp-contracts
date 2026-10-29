package pl.aiwcorpo.mcp.cedar.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;

class FrozenArtifactsTest {

    /**
     * Bundles carry the schema byte for byte (CC-059), so every 2.x component must ship the same file; any change,
     * even to the header comment or line endings, makes bundles of other 2.x components fail with schema_mismatch.
     */
    private static final String MCP_CEDARSCHEMA_SHA256 = "902b254090cc7bd5b8f4ff3fa26b76850f516e9d07da0f9faed1729deb1412f7";

    @Test
    void cedarSchemaIsFrozenForTheWhole2xLine() throws Exception {
        byte[] file = Files.readAllBytes(ContractFiles.resolve("cedar/mcp.cedarschema"));
        assertEquals(MCP_CEDARSCHEMA_SHA256, sha256(file));
        assertEquals(MCP_CEDARSCHEMA_SHA256, sha256(McpCedarSchema.text().getBytes(StandardCharsets.UTF_8)));
        assertFalse(new String(file, StandardCharsets.UTF_8).contains("\r"), "LF line endings only");
    }

    @Test
    void publishedTestKeyListMatchesTheKeyFiles() throws Exception {
        Set<String> fromFiles = new TreeSet<>();
        for (Path pem : ContractFiles.list("test-vectors/keys", ".public.pem")) {
            String base64 = ContractFiles.read(pem).replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
            byte[] der = Base64.getDecoder().decode(base64);
            String algorithm = pem.getFileName().toString().startsWith("test-policy") ? "Ed25519" : "EC";
            fromFiles.add(PublishedTestKeys.spkiSha256(KeyFactory.getInstance(algorithm).generatePublic(new X509EncodedKeySpec(der))));
        }
        assertEquals(fromFiles, new TreeSet<>(PublishedTestKeys.SPKI_SHA256));
        JsonNode resource = new ObjectMapper().readTree(ContractFiles.resolve("security/published-test-keys.json").toFile());
        Set<String> fromResource = new TreeSet<>();
        resource.get("keys").forEach(k -> fromResource.add(k.get("spkiSha256").asText()));
        assertEquals(fromFiles, fromResource);
    }

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }
}
