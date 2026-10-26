package pl.aiwcorpo.mcp.cedar.entities;

import com.cedarpolicy.model.AuthorizationRequest;
import com.cedarpolicy.model.entity.Entities;
import com.cedarpolicy.model.entity.Entity;
import com.cedarpolicy.model.schema.Schema;
import com.cedarpolicy.value.EntityUID;
import com.cedarpolicy.value.Value;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Result of the builder: one Cedar authorization request and the entities it needs.
 *
 * @param principal {@code User::"<sub>"}
 * @param action {@code Action::"call"} on the gateway, {@code Action::"<tool action>"} on the server
 * @param resource {@code Tool::"<system>__<tool>"} or the resolved system resource
 * @param context C7 context: client, virtualServer, vsScopes, mfaAge, refs
 * @param entities user, its groups, the resource and its parent, ordered by type then id
 */
public record CedarRequest(
        EntityUID principal,
        EntityUID action,
        EntityUID resource,
        Map<String, Value> context,
        Set<Entity> entities) {

    public CedarRequest {
        Objects.requireNonNull(principal, "principal");
        Objects.requireNonNull(action, "action");
        Objects.requireNonNull(resource, "resource");
        context = Collections.unmodifiableMap(new LinkedHashMap<>(Objects.requireNonNull(context, "context")));
        entities = Collections.unmodifiableSet(new LinkedHashSet<>(Objects.requireNonNull(entities, "entities")));
    }

    /**
     * Request validated against the schema of the loaded policy bundle; a request that does not conform is
     * reported by cedar-java as a failure, which callers must treat as deny.
     */
    public AuthorizationRequest toAuthorizationRequest(Schema schema) {
        return new AuthorizationRequest(principal, action, resource, Optional.of(context),
                Optional.of(Objects.requireNonNull(schema, "schema")), true);
    }

    /** @return the entities as the cedar-java collection expected by {@code isAuthorized} */
    public Entities cedarEntities() {
        return new Entities(entities);
    }
}
