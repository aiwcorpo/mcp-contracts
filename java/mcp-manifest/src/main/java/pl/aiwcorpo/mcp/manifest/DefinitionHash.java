package pl.aiwcorpo.mcp.manifest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * definitionHash of C6 (CC-004, CC-005, CC-042): SHA-256 of the RFC 8785 form of the flat object {name, title?,
 * description, inputSchema (without confirmation_code), outputSchema?, annotations?, risk?, action?, resourceRefs,
 * system, credential}. risk and action are absent for the entries of an adapter (CC-193).
 */
public final class DefinitionHash {

    private static final ObjectMapper JSON = StrictJson.MAPPER;

    private DefinitionHash() {
    }

    /**
     * @param definitionJson MCP tool definition (name, title?, description, inputSchema, outputSchema?, annotations?)
     * @param manifestEntryJson object with risk, action and resourceRefs (a manifest tool entry works as is)
     * @param system server system id
     * @param credentialJson server credential object
     * @return canonical JSON that is hashed
     */
    public static String canonicalInput(String definitionJson, String manifestEntryJson, String system, String credentialJson) {
        return CanonicalJson.canonicalize(hashedObject(read(definitionJson), read(manifestEntryJson), system, read(credentialJson)));
    }

    /** @return {@code sha256:<hex>} of {@link #canonicalInput} */
    public static String compute(String definitionJson, String manifestEntryJson, String system, String credentialJson) {
        return sha256(canonicalInput(definitionJson, manifestEntryJson, system, credentialJson));
    }

    /** @return the hash a manifest tool entry must declare, computed from its definition and the manifest */
    public static String ofManifestTool(String manifestJson, String toolName) {
        JsonNode manifest = read(manifestJson);
        for (JsonNode tool : manifest.path("tools")) {
            if (toolName.equals(tool.path("name").asText())) {
                return hashOf(manifest, tool);
            }
        }
        throw new IllegalArgumentException("no tool " + toolName + " in the manifest");
    }

    static String hashOf(JsonNode manifest, JsonNode tool) {
        // CC-206: for an adapter manifest the hash never covers risk and action, even when the entry carries the classification of the registry.
        JsonNode entry = "adapter".equals(manifest.path("source").asText()) ? withoutClassification(tool) : tool;
        return sha256(CanonicalJson.canonicalize(hashedObject(tool.get("definition"), entry, manifest.get("system").asText(),
                manifest.get("credential"))));
    }

    private static JsonNode withoutClassification(JsonNode tool) {
        ObjectNode copy = tool.deepCopy();
        copy.remove("risk");
        copy.remove("action");
        return copy;
    }

    private static ObjectNode hashedObject(JsonNode definition, JsonNode entry, String system, JsonNode credential) {
        ObjectNode flat = JSON.createObjectNode();
        flat.set("name", definition.get("name"));
        if (definition.has("title")) {
            flat.set("title", definition.get("title"));
        }
        flat.set("description", definition.get("description"));
        ObjectNode inputSchema = definition.get("inputSchema").deepCopy();
        // confirmation_code is added by the gateway to tools/list (C11) and never part of the hash.
        if (inputSchema.path("properties").has("confirmation_code")) {
            ((ObjectNode) inputSchema.get("properties")).remove("confirmation_code");
            if (inputSchema.get("required") instanceof ArrayNode required) {
                ArrayNode kept = JSON.createArrayNode();
                required.forEach(r -> {
                    if (!"confirmation_code".equals(r.asText())) {
                        kept.add(r);
                    }
                });
                inputSchema.set("required", kept);
            }
        }
        flat.set("inputSchema", inputSchema);
        if (definition.has("outputSchema")) {
            flat.set("outputSchema", definition.get("outputSchema"));
        }
        if (definition.has("annotations")) {
            flat.set("annotations", definition.get("annotations"));
        }
        // An entry of an adapter has neither risk nor action (CC-193); the administrator's classification is not hashed.
        if (entry.has("risk")) {
            flat.set("risk", entry.get("risk"));
        }
        if (entry.has("action")) {
            flat.set("action", entry.get("action"));
        }
        if (entry.has("additionalGroup")) {
            flat.set("additionalGroup", entry.get("additionalGroup"));
        }
        flat.set("resourceRefs", entry.has("resourceRefs") ? entry.get("resourceRefs") : JSON.createArrayNode());
        flat.put("system", system);
        flat.set("credential", credential);
        return flat;
    }

    private static String sha256(String canonical) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
            return "sha256:" + HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private static JsonNode read(String json) {
        try {
            return JSON.readTree(json);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
