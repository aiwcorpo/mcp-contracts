package pl.aiwcorpo.mcp.cedar.entities;

import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * A resource as resolved by the server from the target system ({@code @ResourceRef} resolver).
 *
 * <p>Attribute values may be {@link String}, {@link Boolean}, integral {@link Number}, a {@link java.util.Collection}
 * of those (a Cedar set), a {@link Map} with String keys (a Cedar record) or a cedar-java
 * {@link com.cedarpolicy.value.Value}. The builder adds the parent reference and derived attributes itself
 * (see {@code cedar/entity-builder.md}), so they must not be given here.
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
        attributes = Map.copyOf(Objects.requireNonNull(attributes, "attributes"));
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
