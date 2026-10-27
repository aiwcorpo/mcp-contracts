package pl.aiwcorpo.mcp.cedar.entities;

import java.util.Collections;
import java.util.Objects;
import java.util.Optional;
import java.util.SortedSet;
import java.util.TreeSet;

/**
 * Limits a search or list query must respect for one resource type (CC-036), from
 * {@link EntityBuilder#queryConstraint}. Ids are local ids without the type prefix (project keys, group paths,
 * index prefixes, space keys, queue ids, root page ids).
 *
 * @param resourceType e.g. {@code Jira::Project}
 * @param virtualServer ids of the link narrowing; empty when the call is not narrowed for this type
 * @param granted ids granted to the user by the scope mapping (hierarchical types: roots of granted subtrees)
 */
public record QueryConstraint(String resourceType, Optional<SortedSet<String>> virtualServer, SortedSet<String> granted) {

    public QueryConstraint {
        Objects.requireNonNull(resourceType, "resourceType");
        virtualServer = Objects.requireNonNull(virtualServer, "virtualServer")
                .map(ids -> Collections.unmodifiableSortedSet(new TreeSet<>(ids)));
        granted = Collections.unmodifiableSortedSet(new TreeSet<>(Objects.requireNonNull(granted, "granted")));
    }
}
