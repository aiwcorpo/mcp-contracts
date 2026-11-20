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
    /** additionalGroup of a tool is mcp-&lt;system&gt;-&lt;suffix&gt; with the system of the server and a suffix other than read, write and destructive. */
    public static final String ADDITIONAL_GROUP_VALID = "additional-group-valid";
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

    /** The second part of a resource type is not a name of the base schema (CC-262). */
    public static final String RESOURCE_TYPE_NAME_RESERVED = "resource-type-name-reserved";
    /** Static resource: definition.name == name (CC-258). */
    public static final String RESOURCES_VALID = "resources-valid";
    /** Resource template: definition.name == name; adapter variables carry an anchored pattern that compiles (CC-258). */
    public static final String RESOURCE_TEMPLATES_VALID = "resource-templates-valid";
    /** Prompt: unique names, definition.name == name, argumentRules for exactly the arguments, anchored patterns that compile (CC-258). */
    public static final String PROMPTS_VALID = "prompts-valid";
    /** The scheme of a resource URI is the system; for an adapter {@code <system>+<scheme>} (CC-258). */
    public static final String RESOURCE_URI_SCHEME = "resource-uri-scheme";
    /** Resources and resource templates share one set of unique names (CC-258). */
    public static final String RESOURCE_NAMES_UNIQUE = "resource-names-unique";
    /** No two templates with one skeleton, and no static resource that matches a template (CC-258). */
    public static final String RESOURCE_URI_UNAMBIGUOUS = "resource-uri-unambiguous";
    /** A URI template has only {name} expressions (CC-258). */
    public static final String URI_TEMPLATE_LEVEL1 = "uri-template-level1";
    /** variables has one entry per variable of the template, in order of first occurrence (CC-258). */
    public static final String URI_VARIABLES_BOUND = "uri-variables-bound";
    /** A template of a starter server has a variable whose type has an entity (CC-258). */
    public static final String URI_TEMPLATE_ENTITY_VARIABLE = "uri-template-entity-variable";
    /** Every {{placeholder}} of a prompt message names a declared argument (CC-258). */
    public static final String PROMPT_PLACEHOLDERS_DECLARED = "prompt-placeholders-declared";

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
        for (JsonNode template : manifest.path("resourceTemplates")) {
            template.path("variables").forEach(v -> {
                if (v.has("type")) {
                    referenced.add(v.get("type").asText());
                }
            });
        }
        for (JsonNode prompt : manifest.path("prompts")) {
            prompt.path("argumentRules").forEach(r -> {
                if (r.has("type")) {
                    referenced.add(r.get("type").asText());
                }
            });
        }
        if (declared.size() != declarations || !declared.containsAll(referenced)) {
            violations.add(RESOURCE_TYPES_DECLARED);
        }
        violations.addAll(resourceTypeViolations(manifest));
        violations.addAll(policiesViolations(manifest));
        violations.addAll(primitiveViolations(manifest));
        for (JsonNode tool : manifest.path("tools")) {
            for (JsonNode ref : tool.path("resourceRefs")) {
                if (valueOnly(manifest, ref.path("type").asText())) {
                    violations.add(RESOURCE_TYPES_VALID);
                }
            }
            if (tool.has("additionalGroup")) {
                String prefix = "mcp-" + manifest.path("system").asText() + "-";
                String group = tool.get("additionalGroup").asText();
                String suffix = group.startsWith(prefix) ? group.substring(prefix.length()) : "";
                if (!suffix.matches("[a-z][a-z0-9-]{0,30}") || Set.of("read", "write", "destructive").contains(suffix)) {
                    violations.add(ADDITIONAL_GROUP_VALID);
                }
            }
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

    private static final Set<String> RESERVED_TYPE_NAMES = Set.of("User", "UserGroup", "ResourceScope", "Tool", "McpResource", "McpPrompt", "RequestContext");

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
            if (RESERVED_TYPE_NAMES.contains(type.substring(type.indexOf("::") + 2))) {
                found.add(RESOURCE_TYPE_NAME_RESERVED);
            }
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


    private static final java.util.regex.Pattern TEMPLATE_VARIABLE = java.util.regex.Pattern.compile("\\{([^{}]*)\\}");
    private static final java.util.regex.Pattern PLACEHOLDER = java.util.regex.Pattern.compile("\\{\\{([^{}]*)\\}\\}");
    private static final java.util.regex.Pattern LEVEL1_VARIABLE = java.util.regex.Pattern.compile("^[A-Za-z][A-Za-z0-9]{0,31}$");

    private static boolean valueOnly(JsonNode manifest, String type) {
        for (JsonNode d : manifest.path("resourceTypes")) {
            if (d.path("type").asText().equals(type)) {
                return d.path("valueOnly").asBoolean(false);
            }
        }
        return false;
    }

    /** Variable names of a URI template in order of occurrence, or null when it is not level 1 (only {name}). */
    static List<String> templateVariables(String template) {
        List<String> names = new ArrayList<>();
        java.util.regex.Matcher matcher = TEMPLATE_VARIABLE.matcher(template);
        while (matcher.find()) {
            names.add(matcher.group(1));
        }
        String rest = matcher.replaceAll("");
        if (rest.contains("{") || rest.contains("}") || names.stream().anyMatch(n -> !LEVEL1_VARIABLE.matcher(n).matches())) {
            return null;
        }
        return names;
    }

    /** A template matches a URI when every variable stands for any non-empty text; literal parts are found left to right. */
    static boolean templateMatches(String template, String uri) {
        List<String> literals = new ArrayList<>(List.of(TEMPLATE_VARIABLE.split(template, -1)));
        if (literals.size() == 1) {
            return uri.equals(literals.get(0));
        }
        if (!uri.startsWith(literals.get(0))) {
            return false;
        }
        int at = literals.get(0).length();
        for (String literal : literals.subList(1, literals.size() - 1)) {
            int found = at + 1 > uri.length() ? -1 : uri.indexOf(literal, at + 1);
            if (found < 0) {
                return false;
            }
            at = found + literal.length();
        }
        String last = literals.get(literals.size() - 1);
        return uri.length() - last.length() >= at + 1 && uri.endsWith(last);
    }

    private static Set<String> primitiveViolations(JsonNode manifest) {
        Set<String> found = new LinkedHashSet<>();
        String system = manifest.path("system").asText();
        boolean adapter = "adapter".equals(manifest.path("source").asText());
        JsonNode resources = manifest.path("resources");
        JsonNode templates = manifest.path("resourceTemplates");
        JsonNode prompts = manifest.path("prompts");
        Set<String> names = new HashSet<>();
        int count = 0;
        for (JsonNode group : List.of(resources, templates)) {
            for (JsonNode entry : group) {
                names.add(entry.path("name").asText());
                count++;
            }
        }
        if (names.size() != count) {
            found.add(RESOURCE_NAMES_UNIQUE);
        }
        for (var kind : java.util.Map.of("resource", resources, "resourceTemplate", templates, "prompt", prompts).entrySet()) {
            for (JsonNode entry : kind.getValue()) {
                if (!DefinitionHash.hashOfPrimitive(manifest, kind.getKey(), entry).equals(entry.path("definitionHash").asText())) {
                    found.add(DEFINITION_HASH_MATCHES);
                }
                if (entry.has("additionalGroup")) {
                    String prefix = "mcp-" + system + "-";
                    String group = entry.get("additionalGroup").asText();
                    String suffix = group.startsWith(prefix) ? group.substring(prefix.length()) : "";
                    if (!suffix.matches("[a-z][a-z0-9-]{0,30}") || Set.of("read", "write", "destructive").contains(suffix)) {
                        found.add(ADDITIONAL_GROUP_VALID);
                    }
                }
            }
        }
        for (JsonNode resource : resources) {
            if (!resource.path("definition").path("name").asText().equals(resource.path("name").asText())) {
                found.add(RESOURCES_VALID);
            }
            if (!schemeFits(resource.path("definition").path("uri").asText(), system, adapter)) {
                found.add(RESOURCE_URI_SCHEME);
            }
        }
        Set<String> skeletons = new HashSet<>();
        for (JsonNode template : templates) {
            JsonNode definition = template.path("definition");
            String uriTemplate = definition.path("uriTemplate").asText();
            JsonNode variables = template.path("variables");
            if (!definition.path("name").asText().equals(template.path("name").asText())) {
                found.add(RESOURCE_TEMPLATES_VALID);
            }
            if (!schemeFits(uriTemplate, system, adapter)) {
                found.add(RESOURCE_URI_SCHEME);
            }
            List<String> used = templateVariables(uriTemplate);
            if (used == null) {
                found.add(URI_TEMPLATE_LEVEL1);
            } else {
                List<String> first = new ArrayList<>(new LinkedHashSet<>(used));
                boolean bound = first.size() == variables.size();
                for (int i = 0; bound && i < first.size(); i++) {
                    bound = first.get(i).equals(variables.get(i).path("name").asText());
                }
                if (!bound) {
                    found.add(URI_VARIABLES_BOUND);
                }
                if (!skeletons.add(TEMPLATE_VARIABLE.matcher(uriTemplate).replaceAll("{}"))) {
                    found.add(RESOURCE_URI_UNAMBIGUOUS);
                }
                for (JsonNode resource : resources) {
                    if (templateMatches(uriTemplate, resource.path("definition").path("uri").asText())) {
                        found.add(RESOURCE_URI_UNAMBIGUOUS);
                    }
                }
            }
            if (adapter) {
                for (JsonNode variable : variables) {
                    String pattern = variable.path("pattern").asText();
                    if (!anchoredPattern(pattern) || PatternGrammar.violation(pattern) != null || !compiles(pattern)) {
                        found.add(RESOURCE_TEMPLATES_VALID);
                    }
                }
            } else {
                boolean entityVariable = false;
                for (JsonNode variable : variables) {
                    String type = variable.path("type").asText();
                    for (JsonNode d : manifest.path("resourceTypes")) {
                        entityVariable |= d.path("type").asText().equals(type) && !d.path("valueOnly").asBoolean(false);
                    }
                }
                if (!entityVariable) {
                    found.add(URI_TEMPLATE_ENTITY_VARIABLE);
                }
            }
        }
        Set<String> promptNames = new HashSet<>();
        for (JsonNode prompt : prompts) {
            if (!promptNames.add(prompt.path("name").asText()) || !prompt.path("definition").path("name").asText().equals(prompt.path("name").asText())) {
                found.add(PROMPTS_VALID);
            }
            List<String> argumentNames = new ArrayList<>();
            prompt.path("definition").path("arguments").forEach(a -> argumentNames.add(a.path("name").asText()));
            List<String> ruleNames = new ArrayList<>();
            prompt.path("argumentRules").forEach(r -> ruleNames.add(r.path("name").asText()));
            if (new HashSet<>(argumentNames).size() != argumentNames.size() || new HashSet<>(ruleNames).size() != ruleNames.size()
                    || argumentNames.size() != ruleNames.size() || !ruleNames.containsAll(argumentNames)) {
                found.add(PROMPTS_VALID);
            }
            for (JsonNode rule : prompt.path("argumentRules")) {
                String pattern = rule.path("pattern").asText();
                if (!anchoredPattern(pattern) || !compiles(pattern)) {
                    found.add(PROMPTS_VALID);
                }
            }
            for (JsonNode message : prompt.path("messages")) {
                String text = message.path("text").asText();
                java.util.regex.Matcher matcher = PLACEHOLDER.matcher(text);
                while (matcher.find()) {
                    if (!argumentNames.contains(matcher.group(1))) {
                        found.add(PROMPT_PLACEHOLDERS_DECLARED);
                    }
                }
                String rest = matcher.replaceAll("");
                if (rest.contains("{{") || rest.contains("}}")) {
                    found.add(PROMPT_PLACEHOLDERS_DECLARED);
                }
            }
        }
        return found;
    }

    private static boolean schemeFits(String uri, String system, boolean adapter) {
        String scheme = uri.substring(0, Math.max(uri.indexOf("://"), 0));
        return adapter ? scheme.startsWith(system + "+") : scheme.equals(system);
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
