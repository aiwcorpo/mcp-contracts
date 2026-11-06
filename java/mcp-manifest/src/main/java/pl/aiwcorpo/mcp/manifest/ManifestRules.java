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

    /** The system id is not one of {@link ReservedSystemIds}. */
    public static final String SYSTEM_NOT_RESERVED = "system-not-reserved";
    /** serverId == "mcp-" + system. */
    public static final String SERVER_ID_MATCHES_SYSTEM = "serverId-matches-system";
    /** Tool names are unique. */
    /** acceptedTypes is either service-account alone or user types only (CC-168). */
    public static final String CREDENTIAL_TYPES_NOT_MIXED = "credential-types-not-mixed";
    public static final String UNIQUE_TOOL_NAMES = "unique-tool-names";
    /** resourceRefs[].type and resourceTypes[].parent are declared in resourceTypes, which has no duplicates. */
    public static final String RESOURCE_TYPES_DECLARED = "resource-types-declared";
    /** Each resourceTypes declaration is consistent: parent in the same namespace with its attribute, anchored patterns that compile, earlyScopeCheck with a scopePattern, the classification attribute among attributes. */
    public static final String RESOURCE_TYPES_VALID = "resource-types-valid";
    /** All resource types are in one namespace, and it is policies.namespace when policies is present. */
    public static final String RESOURCE_TYPES_NAMESPACE = "resource-types-namespace";
    /** policies.files has unique names in ascending order. */
    public static final String POLICIES_FILES_SORTED_UNIQUE = "policies-files-sorted-unique";
    /** Recomputed policiesHash equals the declared one. */
    public static final String POLICIES_HASH_MATCHES = "policies-hash-matches";
    /** resourceRefs[].argument is a declared argument of type string, integer or array of those (CC-043). */
    public static final String RESOURCE_REF_ARGUMENT_DECLARED = "resource-ref-argument-declared";
    /** definition.name == name. */
    public static final String DEFINITION_NAME_MATCHES = "definition-name-matches";
    /** definition.inputSchema does not declare confirmation_code. */
    public static final String NO_CONFIRMATION_CODE = "no-confirmation-code";
    /** inputSchema is an object schema and every object in it is closed: additionalProperties false, no open maps (CC-078, CC-123). */
    public static final String INPUT_SCHEMA_CLOSED = "input-schema-closed";
    /** Every node of inputSchema is typed and bounded: maxLength, maxItems with items, minimum and maximum, anchored pattern (CC-123). */
    public static final String INPUT_SCHEMA_BOUNDED = "input-schema-bounded";
    /** inputSchema uses none of allOf, anyOf, oneOf, not, if, then, else (CC-123). */
    public static final String INPUT_SCHEMA_NO_COMBINATORS = "input-schema-no-combinators";
    /** Recomputed definitionHash equals the declared one. */
    public static final String DEFINITION_HASH_MATCHES = "definition-hash-matches";

    private static final ObjectMapper JSON = StrictJson.MAPPER;
    private static final Set<String> ID_TYPES = Set.of("string", "integer");
    private static final List<String> COMBINATORS = List.of("allOf", "anyOf", "oneOf", "not", "if", "then", "else");
    private static final Set<String> SCHEMA_TYPES = Set.of("string", "integer", "number", "boolean", "array", "object");

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
        if (ReservedSystemIds.isReserved(manifest.path("system").asText())) {
            violations.add(SYSTEM_NOT_RESERVED);
        }
        if (!manifest.path("serverId").asText().equals("mcp-" + manifest.path("system").asText())) {
            violations.add(SERVER_ID_MATCHES_SYSTEM);
        }
        boolean hasServiceAccount = false;
        boolean hasUserType = false;
        for (JsonNode type : manifest.path("credential").path("acceptedTypes")) {
            if ("service-account".equals(type.asText())) {
                hasServiceAccount = true;
            } else {
                hasUserType = true;
            }
        }
        if (hasServiceAccount && hasUserType) {
            violations.add(CREDENTIAL_TYPES_NOT_MIXED);
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
        violations.addAll(resourceTypeViolations(manifest));
        violations.addAll(policiesViolations(manifest));
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
            violations.addAll(inputSchemaViolations(definition.path("inputSchema")));
            if (!DefinitionHash.hashOf(manifest, tool).equals(tool.path("definitionHash").asText())) {
                violations.add(DEFINITION_HASH_MATCHES);
            }
        }
        return List.copyOf(violations);
    }

    private static final java.util.regex.Pattern ATTRIBUTE = java.util.regex.Pattern.compile("^[a-z][A-Za-z0-9]*$");

    private static String namespaceOf(String type) {
        return type.substring(0, Math.max(type.indexOf("::"), 0));
    }

    private static boolean compiles(String pattern) {
        try {
            java.util.regex.Pattern.compile(pattern);
            return true;
        } catch (java.util.regex.PatternSyntaxException e) {
            return false;
        }
    }

    private static Set<String> resourceTypeViolations(JsonNode manifest) {
        Set<String> found = new LinkedHashSet<>();
        java.util.Map<String, JsonNode> declared = new java.util.HashMap<>();
        manifest.path("resourceTypes").forEach(d -> declared.put(d.path("type").asText(), d));
        Set<String> namespaces = new HashSet<>();
        for (JsonNode d : manifest.path("resourceTypes")) {
            String type = d.path("type").asText();
            namespaces.add(namespaceOf(type));
            Set<String> attributes = new HashSet<>();
            d.path("attributes").forEach(a -> attributes.add(a.asText()));
            if (attributes.contains("scopes")) {
                found.add(RESOURCE_TYPES_VALID);
            }
            if (d.has("parent")) {
                JsonNode parent = declared.get(d.get("parent").asText());
                String parentAttribute = d.path("parentAttribute").asText();
                if (parent != null && !namespaceOf(parent.path("type").asText()).equals(namespaceOf(type))) {
                    found.add(RESOURCE_TYPES_VALID);
                }
                if (attributes.contains(parentAttribute) || "scopes".equals(parentAttribute) || !ATTRIBUTE.matcher(parentAttribute).matches()) {
                    found.add(RESOURCE_TYPES_VALID);
                }
            }
            if (d.path("earlyScopeCheck").asBoolean(false) && !d.has("scopePattern")) {
                found.add(RESOURCE_TYPES_VALID);
            }
            if (d.has("classification") && !attributes.contains(d.get("classification").path("attribute").asText())) {
                found.add(RESOURCE_TYPES_VALID);
            }
            for (String field : List.of("idPattern", "scopePattern")) {
                if (d.has(field) && (!anchoredPattern(d.get(field).asText()) || PatternGrammar.violation(d.get(field).asText()) != null
                        || !compiles(d.get(field).asText()))) {
                    found.add(RESOURCE_TYPES_VALID);
                }
            }
        }
        if (namespaces.size() > 1 || (manifest.has("policies") && namespaces.size() == 1
                && !namespaces.contains(manifest.get("policies").path("namespace").asText()))) {
            found.add(RESOURCE_TYPES_NAMESPACE);
        }
        return found;
    }

    private static Set<String> policiesViolations(JsonNode manifest) {
        Set<String> found = new LinkedHashSet<>();
        if (!manifest.has("policies")) {
            return found;
        }
        JsonNode policies = manifest.get("policies");
        String previous = null;
        for (JsonNode file : policies.path("files")) {
            String name = file.path("name").asText();
            if (previous != null && previous.compareTo(name) >= 0) {
                found.add(POLICIES_FILES_SORTED_UNIQUE);
            }
            previous = name;
        }
        if (!PoliciesHash.of(policies, manifest.path("resourceTypes")).equals(manifest.path("policiesHash").asText())) {
            found.add(POLICIES_HASH_MATCHES);
        }
        return found;
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

    private static Set<String> inputSchemaViolations(JsonNode root) {
        Set<String> found = new LinkedHashSet<>();
        if (!root.isObject() || !"object".equals(root.path("type").asText())) {
            found.add(INPUT_SCHEMA_CLOSED);
            return found;
        }
        walk(root, found);
        return found;
    }

    private static void walk(JsonNode node, Set<String> found) {
        if (!node.isObject()) {
            found.add(INPUT_SCHEMA_BOUNDED);
            return;
        }
        for (String keyword : COMBINATORS) {
            if (node.has(keyword)) {
                found.add(INPUT_SCHEMA_NO_COMBINATORS);
            }
        }
        JsonNode typeNode = node.get("type");
        if (typeNode == null || !typeNode.isTextual() || !SCHEMA_TYPES.contains(typeNode.asText())) {
            found.add(INPUT_SCHEMA_BOUNDED);
            return;
        }
        String type = typeNode.asText();
        boolean fixed = node.has("enum") || node.has("const");
        if (node.has("pattern")) {
            JsonNode pattern = node.get("pattern");
            if (!pattern.isTextual() || !anchoredPattern(pattern.asText())) {
                found.add(INPUT_SCHEMA_BOUNDED);
            }
        }
        if ("string".equals(type) && !fixed && !isCount(node.get("maxLength"))) {
            found.add(INPUT_SCHEMA_BOUNDED);
        }
        if (("integer".equals(type) || "number".equals(type)) && !fixed
                && !(node.path("minimum").isNumber() && node.path("maximum").isNumber())) {
            found.add(INPUT_SCHEMA_BOUNDED);
        }
        if ("array".equals(type)) {
            if (!isCount(node.get("maxItems")) || !node.has("items")) {
                found.add(INPUT_SCHEMA_BOUNDED);
            }
            if (node.has("items")) {
                walk(node.get("items"), found);
            }
            node.path("prefixItems").forEach(item -> walk(item, found));
        }
        if ("object".equals(type)) {
            if (!node.has("additionalProperties") || !node.get("additionalProperties").isBoolean()
                    || node.get("additionalProperties").asBoolean()
                    || node.has("patternProperties") || node.has("unevaluatedProperties")) {
                found.add(INPUT_SCHEMA_CLOSED);
            }
            node.path("properties").forEach(property -> walk(property, found));
        }
    }

    private static boolean isCount(JsonNode value) {
        return value != null && value.isIntegralNumber() && value.asLong() >= 0;
    }

    /** Starts with ^, ends with an unescaped $ and has no alternation outside every group (CC-123). */
    static boolean anchoredPattern(String pattern) {
        if (!pattern.startsWith("^") || !pattern.endsWith("$")) {
            return false;
        }
        int backslashes = 0;
        for (int i = pattern.length() - 2; i >= 0 && pattern.charAt(i) == '\\'; i--) {
            backslashes++;
        }
        if (backslashes % 2 == 1) {
            return false;
        }
        int depth = 0;
        boolean inClass = false;
        for (int i = 0; i < pattern.length(); i++) {
            char ch = pattern.charAt(i);
            if (ch == '\\') {
                i++;
            } else if (inClass) {
                inClass = ch != ']';
            } else if (ch == '[') {
                inClass = true;
            } else if (ch == '(') {
                depth++;
            } else if (ch == ')') {
                depth--;
            } else if (ch == '|' && depth == 0) {
                return false;
            }
        }
        return true;
    }
}
