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
     * The base schema is composed with the fragment text of every server, so a change of a single byte can make a
     * fragment that validated yesterday fail today: the file is frozen within a major line and its hash is checked.
     */
    private static final String MCP_CEDARSCHEMA_SHA256 = "6340b0f5704c5d865aac9ec4e3e16cfcbdd2cfe6a4748377db7abcad7d8518b1";

    @Test
    void cedarSchemaIsFrozenForTheWhole7xLine() throws Exception {
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
            fromFiles.add(PublishedTestKeys.spkiSha256(KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(der))));
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
