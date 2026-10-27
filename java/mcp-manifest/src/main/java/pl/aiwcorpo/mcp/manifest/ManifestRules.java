package pl.aiwcorpo.mcp.manifest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Semantic rules of a C6 manifest that JSON Schema cannot express (README section on semantic manifest rules,
 * CC-005, CC-018, CC-043). Run JSON Schema validation first; a manifest that violates any rule is rejected with
 * 422 {@code manifest_rejected} at registration (C5).
 */
public final class ManifestRules {

    /** serverId == "mcp-" + system. */
    public static final String SERVER_ID_MATCHES_SYSTEM = "serverId-matches-system";
    /** Tool names are unique. */
    public static final String UNIQUE_TOOL_NAMES = "unique-tool-names";
    /** resourceRefs[].type and resourceTypes[].parent are declared in resourceTypes, which has no duplicates. */
    public static final String RESOURCE_TYPES_DECLARED = "resource-types-declared";
    /** resourceRefs[].argument is a declared argument of type string, integer or array of those (CC-043). */
    public static final String RESOURCE_REF_ARGUMENT_DECLARED = "resource-ref-argument-declared";
    /** definition.name == name. */
    public static final String DEFINITION_NAME_MATCHES = "definition-name-matches";
    /** definition.inputSchema does not declare confirmation_code. */
    public static final String NO_CONFIRMATION_CODE = "no-confirmation-code";
    /** Recomputed definitionHash equals the declared one. */
    public static final String DEFINITION_HASH_MATCHES = "definition-hash-matches";

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> ID_TYPES = Set.of("string", "integer");

    private ManifestRules() {
    }

    /**
     * @param manifestJson a manifest that already passed server-manifest.schema.json
     * @return codes of violated rules in rule order, empty when the manifest is acceptable
     */
    public static List<String> violations(String manifestJson) {
        JsonNode manifest;
        try {
            manifest = JSON.readTree(manifestJson);
        } catch (IOException e) {
            throw new IllegalArgumentException("manifest is not JSON", e);
        }
        Set<String> violations = new LinkedHashSet<>();
        if (!manifest.path("serverId").asText().equals("mcp-" + manifest.path("system").asText())) {
            violations.add(SERVER_ID_MATCHES_SYSTEM);
        }
        Set<String> names = new HashSet<>();
        for (JsonNode tool : manifest.path("tools")) {
            if (!names.add(tool.path("name").asText())) {
                violations.add(UNIQUE_TOOL_NAMES);
            }
        }
        Set<String> declared = new HashSet<>();
        List<String> referenced = new ArrayList<>();
        int declarations = 0;
        for (JsonNode type : manifest.path("resourceTypes")) {
            declared.add(type.path("type").asText());
            declarations++;
            if (type.has("parent")) {
                referenced.add(type.get("parent").asText());
            }
        }
        for (JsonNode tool : manifest.path("tools")) {
            tool.path("resourceRefs").forEach(r -> referenced.add(r.path("type").asText()));
        }
        if (declared.size() != declarations || !declared.containsAll(referenced)) {
            violations.add(RESOURCE_TYPES_DECLARED);
        }
        for (JsonNode tool : manifest.path("tools")) {
            JsonNode definition = tool.path("definition");
            JsonNode properties = definition.path("inputSchema").path("properties");
            for (JsonNode ref : tool.path("resourceRefs")) {
                if (!isIdArgument(properties.get(ref.path("argument").asText()))) {
                    violations.add(RESOURCE_REF_ARGUMENT_DECLARED);
                }
            }
            if (!definition.path("name").asText().equals(tool.path("name").asText())) {
                violations.add(DEFINITION_NAME_MATCHES);
            }
            if (properties.has("confirmation_code")) {
                violations.add(NO_CONFIRMATION_CODE);
            }
            if (!DefinitionHash.hashOf(manifest, tool).equals(tool.path("definitionHash").asText())) {
                violations.add(DEFINITION_HASH_MATCHES);
            }
        }
        return List.copyOf(violations);
    }

    private static boolean isIdArgument(JsonNode property) {
        if (property == null || !property.isObject()) {
            return false;
        }
        String type = property.path("type").asText();
        if (ID_TYPES.contains(type)) {
            return true;
        }
        return "array".equals(type) && ID_TYPES.contains(property.path("items").path("type").asText());
    }
}
