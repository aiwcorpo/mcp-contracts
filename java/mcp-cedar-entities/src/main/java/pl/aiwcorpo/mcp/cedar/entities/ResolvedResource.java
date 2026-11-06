package pl.aiwcorpo.mcp.cedar.entities;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * A resource as resolved by the server from the target system ({@code @ResourceRef} resolver).
 *
 * <p>Attribute values may be {@link String}, {@link Boolean}, integral {@link Number}, a {@link java.util.Collection}
 * of those (a Cedar set), a {@link Map} with String keys (a Cedar record) or a cedar-java
 * {@link com.cedarpolicy.value.Value}. A {@code null} value means "no attribute"; the classification attribute of the
 * declaration, when it is required, must be present (a project without a category passes {@code ""}, CC-062). Id and parent are the canonical values reported by the system, never the tool argument
 * (cedar/entity-builder.md section 4). Only attributes declared in the manifest are accepted; the builder adds the
 * parent reference itself, so the parent attribute must not be given here.
 *
 * <p>{@code scopes} are the ResourceScope ids of the resource and all its containers ({@code <Type>/<local>}); how they
 * are derived is the server's decision (helpers: {@link Scopes}). The builder only checks that every id is a declared,
 * grantable type with a local part that matches its {@code scopePattern}.
 *
 * @param type Cedar type, e.g. {@code Jira::Issue}
 * @param id entity id, e.g. {@code ABC-123}
 * @param attributes attributes read from the system, e.g. {@code key}, {@code category}
 * @param parent the containing resource as reported by the system (project of an issue), if the type has one
 * @param scopes scope ids of the resource and its containers
 */
public record ResolvedResource(String type, String id, Map<String, Object> attributes, Optional<ResolvedResource> parent,
        List<String> scopes) {

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
        scopes = List.copyOf(Objects.requireNonNull(scopes, "scopes"));
    }

    /** Resource without parent. */
    public static ResolvedResource of(String type, String id, Map<String, Object> attributes) {
        return new ResolvedResource(type, id, attributes, Optional.empty(), List.of());
    }

    /** @return a copy with the given parent */
    public ResolvedResource withParent(ResolvedResource parentResource) {
        return new ResolvedResource(type, id, attributes, Optional.of(parentResource), scopes);
    }

    /** @return a copy with the given scope ids */
    public ResolvedResource withScopes(List<String> scopeIds) {
        return new ResolvedResource(type, id, attributes, parent, scopeIds);
    }
}
