package pl.aiwcorpo.mcp.cedar.entities;

import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * A resource as resolved by the server from the target system ({@code @ResourceRef} resolver).
 *
 * <p>Attribute values may be {@link String}, {@link Boolean}, integral {@link Number}, a {@link java.util.Collection}
 * of those (a Cedar set), a {@link Map} with String keys (a Cedar record) or a cedar-java
 * {@link com.cedarpolicy.value.Value}. A {@code null} value means "no attribute"; required classification attributes
 * ({@code category}, {@code labels}, {@code tags}) must be present, a Jira project without a category passes
 * {@code ""} (CC-062). Id and parent are the canonical values reported by the system, never the tool argument
 * (cedar/entity-builder.md section 4). The builder adds the parent reference and {@code scopes} itself (see {@code cedar/entity-builder.md}),
 * so they must not be given here. A Confluence page passes the ids of its ancestor pages as {@code ancestorIds}.
 *
 * @param type Cedar type, e.g. {@code Jira::Issue}
 * @param id entity id, e.g. {@code ABC-123}
 * @param attributes attributes read from the system, e.g. {@code key}, {@code category}
 * @param parent the containing resource as reported by the system (project of an issue), if the type has one
 */
public record ResolvedResource(String type, String id, Map<String, Object> attributes, Optional<ResolvedResource> parent) {

    public ResolvedResource {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(id, "id");
        java.util.Map<String, Object> present = new java.util.LinkedHashMap<>();
        Objects.requireNonNull(attributes, "attributes").forEach((k, v) -> {
            if (v != null) {
                present.put(k, v);
            }
        });
        attributes = java.util.Collections.unmodifiableMap(present);
        Objects.requireNonNull(parent, "parent");
    }

    /** Resource without parent. */
    public static ResolvedResource of(String type, String id, Map<String, Object> attributes) {
        return new ResolvedResource(type, id, attributes, Optional.empty());
    }

    /** @return a copy with the given parent */
    public ResolvedResource withParent(ResolvedResource parentResource) {
        return new ResolvedResource(type, id, attributes, Optional.of(parentResource));
    }
}
