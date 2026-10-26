package pl.aiwcorpo.mcp.cedar.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cedarpolicy.BasicAuthorizationEngine;
import com.cedarpolicy.model.Effect;
import com.cedarpolicy.model.ValidationRequest;
import com.cedarpolicy.model.exception.AuthException;
import com.cedarpolicy.model.exception.InternalException;
import com.cedarpolicy.model.policy.Policy;
import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import java.util.zip.GZIPInputStream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Reference policy bundle receiver (C7, CC-008, CC-026, CC-028). The permit check of overrides uses the Cedar
 * parser (effect of every policy), never text matching.
 */
class PolicyBundleVectorTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern REVISION = Pattern.compile("^[0-9]{14}-[0-9a-f]{7}$");
    private static final Pattern ARCHIVE_NAME = Pattern.compile("^policies-([0-9]{14}-[0-9a-f]{7})\\.tar\\.gz$");
    private static final Pattern SIGNATURE_NAME = Pattern.compile("^policies-([0-9]{14}-[0-9a-f]{7})\\.tar\\.gz\\.sig$");
    private static final Pattern GIT_SHA = Pattern.compile("^[0-9a-f]{40}$");
    private static final Pattern SEMVER = Pattern.compile("^[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z.-]+)?$");
    private final BasicAuthorizationEngine engine = new BasicAuthorizationEngine();

    static Stream<Path> vectors() {
        return ContractFiles.list("test-vectors/bundles", ".json").stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void receiverDecisionMatches(Path file) throws Exception {
        JsonNode vector = JSON.readTree(file.toFile());
        String reason = vector.has("bundle") ? receive(vector) : (latestValid(vector.get("latest")) ? null : "invalid_latest");
        JsonNode expected = vector.get("expected");
        if (expected.get("accept").asBoolean()) {
            assertNull(reason, file::toString);
        } else {
            assertEquals(expected.get("reason").asText(), reason, file::toString);
        }
    }

    private static boolean latestValid(JsonNode latest) {
        String revision = latest.path("revision").asText("");
        Matcher archive = ARCHIVE_NAME.matcher(latest.path("url").asText(""));
        Matcher signature = SIGNATURE_NAME.matcher(latest.path("sigUrl").asText(""));
        return latest.size() == 3 && REVISION.matcher(revision).matches()
                && archive.matches() && archive.group(1).equals(revision)
                && signature.matches() && signature.group(1).equals(revision);
    }

    private String receive(JsonNode vector) throws Exception {
        JsonNode latest = vector.get("latest");
        if (!latestValid(latest)) {
            return "invalid_latest";
        }
        Path dir = ContractFiles.resolve("test-vectors/bundles");
        byte[] archive = Files.readAllBytes(dir.resolve(vector.get("bundle").asText()));
        byte[] signature = Files.readAllBytes(dir.resolve(vector.get("signature").asText()));
        PublicKey key = ed25519(ContractFiles.read(ContractFiles.resolve("test-vectors/" + vector.get("publicKey").asText())));
        Signature verifier = Signature.getInstance("Ed25519");
        verifier.initVerify(key);
        verifier.update(archive);
        if (signature.length != 64 || !verifier.verify(signature)) {
            return "bad_signature";
        }
        Map<String, String> files = untarGz(archive);
        JsonNode manifest = JSON.readTree(files.getOrDefault("manifest.json", "null"));
        if (manifest == null || !manifest.isObject() || manifest.size() != 4
                || !REVISION.matcher(manifest.path("revision").asText("")).matches()
                || !GIT_SHA.matcher(manifest.path("gitSha").asText("")).matches()
                || !manifest.path("createdAt").asText("").endsWith("Z")
                || !SEMVER.matcher(manifest.path("schemaVersion").asText("")).matches()) {
            return "manifest_invalid";
        }
        String revision = manifest.get("revision").asText();
        if (!revision.equals(latest.get("revision").asText()) || !manifest.get("gitSha").asText().startsWith(revision.substring(15))) {
            return "manifest_mismatch";
        }
        boolean overrides = "overrides".equals(vector.get("channel").asText());
        for (String name : files.keySet()) {
            boolean allowed = name.equals("manifest.json") || (name.startsWith("policies/") && name.endsWith(".cedar"))
                    || (!overrides && (name.equals("schema.cedarschema") || name.equals("entities/static.json")));
            if (!allowed) {
                return overrides ? "overrides_content_not_allowed" : "archive_unexpected_file";
            }
        }
        if (!overrides && !(files.containsKey("schema.cedarschema") && files.containsKey("entities/static.json"))) {
            return "archive_incomplete";
        }
        JsonNode loaded = vector.get("loadedRevision");
        if (loaded != null && !loaded.isNull() && revision.substring(0, 14).compareTo(loaded.asText().substring(0, 14)) <= 0) {
            return "not_newer";
        }
        StringBuilder policyText = new StringBuilder();
        files.forEach((name, text) -> {
            if (name.startsWith("policies/")) {
                policyText.append(text).append('\n');
            }
        });
        PolicySet policies;
        try {
            policies = PolicySet.parsePolicies(policyText.toString());
        } catch (InternalException e) {
            return "policy_invalid";
        }
        if (overrides) {
            for (Policy policy : policies.policies) {
                if (policy.effect() != Effect.FORBID) {
                    return "permit_in_overrides";
                }
            }
            return null;
        }
        return validates(new Schema(files.get("schema.cedarschema")), policies) ? null : "policy_invalid";
    }

    private boolean validates(Schema schema, PolicySet policies) throws AuthException {
        return engine.validate(new ValidationRequest(schema, policies)).validationPassed();
    }

    private static PublicKey ed25519(String pem) throws Exception {
        String base64 = pem.replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
        return KeyFactory.getInstance("Ed25519").generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(base64)));
    }

    /** Regular files of a ustar archive; anything else (links, devices) makes the archive invalid. */
    private static Map<String, String> untarGz(byte[] archive) throws IOException {
        byte[] raw;
        try (GZIPInputStream in = new GZIPInputStream(new ByteArrayInputStream(archive))) {
            raw = in.readAllBytes();
        }
        Map<String, String> files = new LinkedHashMap<>();
        int offset = 0;
        while (offset + 512 <= raw.length && raw[offset] != 0) {
            String name = cString(raw, offset, 100);
            long size = Long.parseLong(cString(raw, offset + 124, 12).trim(), 8);
            char type = (char) raw[offset + 156];
            assertTrue(type == '0' || type == 0, "only regular files expected in " + name);
            files.put(name, new String(raw, offset + 512, (int) size, StandardCharsets.UTF_8));
            offset += 512 + (int) ((size + 511) / 512) * 512;
        }
        return files;
    }

    private static String cString(byte[] raw, int offset, int length) {
        int end = offset;
        while (end < offset + length && raw[end] != 0) {
            end++;
        }
        return new String(raw, offset, end - offset, StandardCharsets.US_ASCII);
    }
}
