package pl.aiwcorpo.mcp.contracts.cedar;

import com.cedarpolicy.CedarJson;
import com.cedarpolicy.model.AuthorizationRequest;
import com.cedarpolicy.model.entity.Entities;
import com.cedarpolicy.model.entity.Entity;
import com.cedarpolicy.value.EntityTypeName;
import com.cedarpolicy.value.EntityUID;
import com.cedarpolicy.value.Value;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Turns the Cedar JSON used by the vectors into cedar-java request objects. */
final class CedarRequests {

    private static final ObjectMapper CEDAR = CedarJson.objectMapper();

    private CedarRequests() {
    }

    static EntityUID uid(JsonNode node) {
        EntityTypeName type = EntityTypeName.parse(node.get("type").asText())
                .orElseThrow(() -> new IllegalArgumentException("bad entity type " + node));
        return new EntityUID(type, node.get("id").asText());
    }

    static Map<String, Value> context(JsonNode node) throws JsonProcessingException {
        Map<String, Value> context = new HashMap<>();
        var fields = node.fields();
        while (fields.hasNext()) {
            var field = fields.next();
            context.put(field.getKey(), CEDAR.treeToValue(field.getValue(), Value.class));
        }
        return context;
    }

    static Entities entities(JsonNode array) throws JsonProcessingException {
        return Entities.parse(array.toString());
    }

    static List<Entity> entityList(JsonNode array) throws JsonProcessingException {
        return new ArrayList<>(entities(array).getEntities());
    }

    /** Request validated against the schema, so a context that does not conform fails the vector. */
    static AuthorizationRequest request(JsonNode principal, JsonNode action, JsonNode resource, JsonNode context)
            throws JsonProcessingException {
        return new AuthorizationRequest(uid(principal), uid(action), uid(resource),
                Optional.of(context(context)), Optional.of(CedarFixtures.schema()), true);
    }
}
