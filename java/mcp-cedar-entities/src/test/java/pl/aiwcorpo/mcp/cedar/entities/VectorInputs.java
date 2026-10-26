package pl.aiwcorpo.mcp.cedar.entities;

import com.cedarpolicy.CedarJson;
import com.cedarpolicy.model.entity.Entity;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/** Converts vector JSON into the public API types and the API result back into vector JSON. */
final class VectorInputs {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final ObjectMapper CEDAR = CedarJson.objectMapper();
    private static final EntityBuilder BUILDER = new EntityBuilder();

    private VectorInputs() {
    }

    static CedarRequest build(String level, JsonNode input) {
        JsonNode c = input.get("caller");
        List<String> groups = new ArrayList<>();
        c.get("grp").forEach(g -> groups.add(g.asText()));
        Caller caller = Caller.of(c.get("sub").asText(), c.get("usr").asText(), groups, c.get("azp").asText());
        if (c.has("vs") != c.has("vsc")) {
            // The Java API cannot represent half a link; this mirrors the JWT receiver rejecting such a token.
            throw new EntityBuilderException(EntityBuilderException.Code.INTERNAL_ERROR, "vs and vsc must be present together");
        }
        if (c.has("vs")) {
            Map<String, List<String>> vsc = JSON.convertValue(c.get("vsc"), new TypeReference<Map<String, List<String>>>() { });
            Map<String, java.util.SortedSet<String>> scopes = new java.util.LinkedHashMap<>();
            vsc.forEach((field, ids) -> scopes.put(field, new java.util.TreeSet<>(ids)));
            caller = caller.withVirtualServer(new VirtualServerScope(c.get("vs").asText(), scopes));
        }
        if (c.has("mfa")) {
            caller = caller.withMfaAge(c.get("mfa").asLong());
        }
        JsonNode t = input.get("tool");
        List<ResourceRef> refs = new ArrayList<>();
        t.get("resourceRefs").forEach(r -> refs.add(new ResourceRef(r.get("argument").asText(), r.get("type").asText())));
        ToolDescriptor tool = new ToolDescriptor(t.get("serverId").asText(), t.get("system").asText(),
                t.get("name").asText(), t.get("risk").asText(), t.get("action").asText(), refs);
        Map<String, Object> arguments = input.has("arguments")
                ? JSON.convertValue(input.get("arguments"), new TypeReference<Map<String, Object>>() { })
                : Map.of();
        return switch (level) {
            case "gateway" -> BUILDER.forToolCall(caller, tool, arguments);
            case "server" -> BUILDER.forResource(caller, tool, arguments, resource(input.get("resource")));
            default -> throw new IllegalArgumentException(level);
        };
    }

    private static ResolvedResource resource(JsonNode node) {
        Map<String, Object> attrs = node.has("attrs")
                ? JSON.convertValue(node.get("attrs"), new TypeReference<Map<String, Object>>() { })
                : Map.of();
        ResolvedResource resource = ResolvedResource.of(node.get("type").asText(), node.get("id").asText(), attrs);
        return node.has("parent") ? resource.withParent(resource(node.get("parent"))) : resource;
    }

    /** Same shape as the vectors: principal, action, resource, context, entities (Cedar JSON). */
    static ObjectNode toJson(CedarRequest request) throws Exception {
        ObjectNode out = JSON.createObjectNode();
        out.set("principal", uid(request.principal().getType().toString(), request.principal().getId().toString()));
        out.set("action", uid(request.action().getType().toString(), request.action().getId().toString()));
        out.set("resource", uid(request.resource().getType().toString(), request.resource().getId().toString()));
        out.set("context", JSON.readTree(CEDAR.writeValueAsString(request.context())));
        ArrayNode entities = out.putArray("entities");
        for (Entity entity : request.entities()) {
            ObjectNode e = (ObjectNode) JSON.readTree(CEDAR.writeValueAsString(entity));
            if (e.has("tags") && e.get("tags").isEmpty()) {
                e.remove("tags");
            }
            List<JsonNode> parents = new ArrayList<>();
            e.get("parents").forEach(parents::add);
            parents.sort(Comparator.comparing(p -> p.get("type").asText() + "\u0000" + p.get("id").asText()));
            e.putArray("parents").addAll(parents);
            entities.add(e);
        }
        return out;
    }

    private static ObjectNode uid(String type, String id) {
        ObjectNode node = JSON.createObjectNode();
        node.put("type", type);
        node.put("id", id);
        return node;
    }
}
