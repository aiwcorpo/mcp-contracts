package pl.aiwcorpo.mcp.contracts.cedar;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reference implementation of cedar/entity-builder.md, used only to execute the vectors. Output is Cedar
 * JSON (entities, context) so that it can be compared with the vectors byte-for-byte after parsing.
 * See CC-019 for the proposal to publish it as a shared artifact for the gateway and the starter.
 */
public final class ReferenceEntityBuilder {

    public static final class BuilderException extends RuntimeException {
        private final String code;

        BuilderException(String code, String message) {
            super(message);
            this.code = code;
        }

        public String code() {
            return code;
        }
    }

    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;
    private static final Pattern SCOPE_GROUP = Pattern.compile("^mcp-([a-z]+)-([a-z]+)-(.+)$");
    private static final Map<String, String> SCOPE_FIELD_BY_GROUP = Map.of(
            "jira/proj", "jiraProjects",
            "confluence/space", "confluenceSpaces",
            "gitlab/grp", "gitlabGroups",
            "opensearch/idx", "opensearchIndexPrefixes",
            "servicedesk/queue", "servicedeskQueues");
    private static final List<String> SCOPE_FIELDS = List.of(
            "jiraProjects", "confluenceSpaces", "gitlabGroups", "opensearchIndexPrefixes", "servicedeskQueues");
    private static final Map<String, String> VS_SCOPE_FIELD = Map.of(
            "Jira::Project", "jiraProjects",
            "Confluence::Space", "confluenceSpaces",
            "GitLab::Group", "gitlabGroups",
            "OpenSearch::Index", "opensearchIndexPrefixes",
            "ServiceDesk::Queue", "servicedeskQueues");
    private static final Map<String, String> PARENT_ATTRIBUTE = Map.of(
            "Jira::Issue", "project",
            "Confluence::Page", "space",
            "GitLab::Project", "group",
            "ServiceDesk::Ticket", "queue");

    private ReferenceEntityBuilder() {
    }

    public static ObjectNode build(String level, JsonNode input) {
        JsonNode caller = input.get("caller");
        JsonNode tool = input.get("tool");
        ObjectNode context = context(input);
        List<ObjectNode> entities = new ArrayList<>(principalEntities(caller));
        ObjectNode action;
        ObjectNode resource;
        if ("gateway".equals(level)) {
            action = uid("Action", "call");
            resource = uid("Tool", tool.get("system").asText() + "__" + tool.get("name").asText());
            ObjectNode attrs = JSON.objectNode();
            attrs.put("server", tool.get("serverId").asText());
            attrs.put("name", tool.get("name").asText());
            attrs.put("risk", tool.get("risk").asText());
            entities.add(entity(resource, attrs, List.of()));
        } else if ("server".equals(level)) {
            action = uid("Action", tool.get("action").asText());
            JsonNode resolved = input.get("resource");
            resource = uid(resolved.get("type").asText(), resolved.get("id").asText());
            JsonNode parent = resolved.get("parent");
            if (parent != null) {
                entities.add(systemEntity(parent, null));
            }
            entities.add(systemEntity(resolved, parent));
        } else {
            throw new IllegalArgumentException("unknown level " + level);
        }
        entities.sort(Comparator.<ObjectNode, String>comparing(e -> e.get("uid").get("type").asText())
                .thenComparing(e -> e.get("uid").get("id").asText()));
        ObjectNode out = JSON.objectNode();
        out.set("principal", uid("User", caller.get("sub").asText()));
        out.set("action", action);
        out.set("resource", resource);
        out.set("context", context);
        ArrayNode list = out.putArray("entities");
        entities.forEach(list::add);
        return out;
    }

    static ObjectNode scopes(Iterable<String> groups) {
        Map<String, TreeSet<String>> scopes = new LinkedHashMap<>();
        SCOPE_FIELDS.forEach(f -> scopes.put(f, new TreeSet<>()));
        for (String group : groups) {
            Matcher m = SCOPE_GROUP.matcher(group);
            if (!m.matches()) {
                continue;
            }
            String field = SCOPE_FIELD_BY_GROUP.get(m.group(1) + "/" + m.group(2));
            if (field != null) {
                scopes.get(field).add(m.group(3));
            }
        }
        ObjectNode node = JSON.objectNode();
        scopes.forEach((field, values) -> node.set(field, stringArray(values)));
        return node;
    }

    static Set<String> namePrefixes(String name) {
        String[] parts = name.split("-", -1);
        TreeSet<String> prefixes = new TreeSet<>();
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) {
                current.append('-');
            }
            current.append(parts[i]);
            prefixes.add(current.toString());
        }
        return prefixes;
    }

    static String refsField(String resourceType) {
        String[] parts = resourceType.split("::");
        return parts[0].toLowerCase(java.util.Locale.ROOT) + parts[1];
    }

    private static ObjectNode context(JsonNode input) {
        JsonNode caller = input.get("caller");
        ObjectNode context = JSON.objectNode();
        context.put("client", caller.get("azp").asText());
        if (caller.has("vs")) {
            JsonNode link = input.get("virtualServer");
            if (link == null || !caller.get("vs").asText().equals(link.get("slug").asText())) {
                throw new BuilderException("internal_error", "virtual server definition missing for vs claim");
            }
            context.put("virtualServer", caller.get("vs").asText());
            JsonNode defaults = link.get("resourceDefaults");
            if (defaults != null && defaults.size() > 0) {
                ObjectNode vsScopes = context.putObject("vsScopes");
                defaults.fields().forEachRemaining(e -> {
                    String field = VS_SCOPE_FIELD.get(e.getKey());
                    if (field == null) {
                        throw new BuilderException("internal_error", "resourceDefaults type cannot narrow: " + e.getKey());
                    }
                    TreeSet<String> ids = new TreeSet<>();
                    e.getValue().forEach(v -> ids.add(v.asText()));
                    vsScopes.set(field, stringArray(ids));
                });
            }
        }
        if (caller.has("mfa")) {
            context.put("mfaAge", caller.get("mfa").asLong());
        }
        Map<String, TreeSet<String>> refs = new LinkedHashMap<>();
        JsonNode args = input.has("arguments") ? input.get("arguments") : JSON.objectNode();
        for (JsonNode resourceRef : input.get("tool").get("resourceRefs")) {
            String argument = resourceRef.get("argument").asText();
            refs.computeIfAbsent(refsField(resourceRef.get("type").asText()), k -> new TreeSet<>())
                    .addAll(argumentIds(argument, args.get(argument)));
        }
        ObjectNode refsNode = context.putObject("refs");
        refs.forEach((field, ids) -> refsNode.set(field, stringArray(ids)));
        return context;
    }

    private static List<String> argumentIds(String argument, JsonNode value) {
        if (value == null || value.isNull()) {
            return List.of();
        }
        if (value.isTextual()) {
            return List.of(value.asText());
        }
        if (value.isIntegralNumber()) {
            return List.of(value.bigIntegerValue().toString());
        }
        if (value.isArray()) {
            List<String> ids = new ArrayList<>();
            for (JsonNode element : value) {
                if (element.isTextual()) {
                    ids.add(element.asText());
                } else if (element.isIntegralNumber()) {
                    ids.add(element.bigIntegerValue().toString());
                } else {
                    throw new BuilderException("invalid_argument", argument + ": array element is not a string or integer");
                }
            }
            return ids;
        }
        throw new BuilderException("invalid_argument", argument + ": not a resource identifier");
    }

    private static List<ObjectNode> principalEntities(JsonNode caller) {
        TreeSet<String> groups = new TreeSet<>();
        caller.get("grp").forEach(g -> {
            if (g.asText().startsWith("mcp-")) {
                groups.add(g.asText());
            }
        });
        ObjectNode attrs = JSON.objectNode();
        attrs.put("username", caller.get("usr").asText());
        attrs.put("client", caller.get("azp").asText());
        attrs.set("scopes", scopes(groups));
        if (caller.has("mfa")) {
            attrs.put("mfaAge", caller.get("mfa").asLong());
        }
        List<ObjectNode> parents = groups.stream().map(g -> uid("UserGroup", g)).toList();
        List<ObjectNode> out = new ArrayList<>();
        out.add(entity(uid("User", caller.get("sub").asText()), attrs, parents));
        for (String g : groups) {
            out.add(entity(uid("UserGroup", g), JSON.objectNode(), List.of()));
        }
        return out;
    }

    private static ObjectNode systemEntity(JsonNode resolved, JsonNode parent) {
        String type = resolved.get("type").asText();
        ObjectNode attrs = resolved.has("attrs") ? ((ObjectNode) resolved.get("attrs")).deepCopy() : JSON.objectNode();
        if ("OpenSearch::Index".equals(type)) {
            attrs.set("namePrefixes", stringArray(namePrefixes(attrs.get("name").asText())));
        }
        String parentAttribute = PARENT_ATTRIBUTE.get(type);
        if (parentAttribute != null) {
            if (parent == null) {
                throw new BuilderException("internal_error", type + " needs its parent");
            }
            ObjectNode ref = JSON.objectNode();
            ref.set("__entity", uid(parent.get("type").asText(), parent.get("id").asText()));
            attrs.set(parentAttribute, ref);
        }
        List<ObjectNode> parents = parent == null
                ? List.of()
                : List.of(uid(parent.get("type").asText(), parent.get("id").asText()));
        return entity(uid(type, resolved.get("id").asText()), attrs, parents);
    }

    private static ObjectNode uid(String type, String id) {
        ObjectNode node = JSON.objectNode();
        node.put("type", type);
        node.put("id", id);
        return node;
    }

    private static ObjectNode entity(ObjectNode uid, ObjectNode attrs, List<ObjectNode> parents) {
        ObjectNode node = JSON.objectNode();
        node.set("uid", uid);
        node.set("attrs", attrs);
        ArrayNode list = node.putArray("parents");
        parents.forEach(list::add);
        return node;
    }

    private static ArrayNode stringArray(Iterable<String> values) {
        ArrayNode array = JSON.arrayNode();
        values.forEach(array::add);
        return array;
    }
}
