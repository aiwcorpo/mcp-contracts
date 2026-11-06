package pl.aiwcorpo.mcp.cedar.entities;

import java.util.Collections;
import java.util.Objects;
import java.util.SortedSet;
import java.util.TreeSet;

/**
 * Limits a search or list query must respect for one resource type (CC-036, CC-056), from
 * {@link EntityBuilder#queryConstraint}. Ids are local ids without the type prefix and already match the
 * {@code scopePattern} of the type, but the server still quotes or escapes them in the query language (cedar/entity-builder.md
 * section 8).
 *
 * {@code granted} empty means the user has no grant of this type. Where the server limits the query to grants
 * it must not run the query at all and returns no elements; an empty set never means "no filter".
 *
 * @param resourceType type asked for, e.g. {@code Jira::Project}
 * @param granted ids of {@code resourceType} granted by the scope mapping (hierarchical types: roots of subtrees)
 */
public record QueryConstraint(String resourceType, SortedSet<String> granted) {

    public QueryConstraint {
        Objects.requireNonNull(resourceType, "resourceType");
        granted = Collections.unmodifiableSortedSet(new TreeSet<>(Objects.requireNonNull(granted, "granted")));
    }
}
