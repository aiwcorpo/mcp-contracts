package pl.aiwcorpo.mcp.cedar.entities;

import java.util.Collections;
import java.util.Objects;
import java.util.Optional;
import java.util.SortedSet;
import java.util.TreeSet;

/**
 * Limits a search or list query must respect for one resource type (CC-036, CC-056), from
 * {@link EntityBuilder#queryConstraint}. Ids are local ids without the type prefix and already match the
 * per-system patterns, but the server still quotes or escapes them in the query language (cedar/entity-builder.md
 * section 8).
 *
 * <ul>
 *   <li>{@code virtualServer} empty: the call is not narrowed by a link for this type; no narrowing condition.
 *       Present: the query must be limited to these ids of type {@code virtualServerType}.</li>
 *   <li>{@code granted} empty: the user has no grant of this type. Where the server limits the query to grants
 *       (OpenSearch) it must not run the query at all and returns no elements; an empty set never means
 *       "no filter".</li>
 * </ul>
 *
 * @param resourceType type asked for, e.g. {@code Confluence::Page}
 * @param virtualServer ids of the link narrowing that applies to this type
 * @param virtualServerType type of the ids in {@code virtualServer}: the type itself, or the container type when
 *        the link narrows containers ({@code Confluence::Space} for {@code Confluence::Page})
 * @param granted ids of {@code resourceType} granted by the scope mapping (hierarchical types: roots of subtrees)
 */
public record QueryConstraint(String resourceType, Optional<SortedSet<String>> virtualServer, String virtualServerType,
        SortedSet<String> granted) {

    public QueryConstraint {
        Objects.requireNonNull(resourceType, "resourceType");
        virtualServer = Objects.requireNonNull(virtualServer, "virtualServer")
                .map(ids -> Collections.unmodifiableSortedSet(new TreeSet<>(ids)));
        Objects.requireNonNull(virtualServerType, "virtualServerType");
        granted = Collections.unmodifiableSortedSet(new TreeSet<>(Objects.requireNonNull(granted, "granted")));
    }
}
