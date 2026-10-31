package pl.aiwcorpo.mcp.cedar.entities;

import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.SortedSet;
import java.util.TreeSet;

/**
 * Naming rules of the Cedar model (cedar/entity-builder.md). Scopes granted by groups are data
 * ({@link ScopeMapping}), not derived from group names (CC-037).
 */
public final class ScopeGroups {

    /** Fields of {@code principal.scopes}, in schema order. */
    public static final List<String> SCOPE_FIELDS = List.of(
            "jiraProjects", "confluenceSpaces", "gitlabGroups", "opensearchIndexPrefixes", "servicedeskQueues");

    private static final Map<String, String> FIELD_BY_SCOPE_TYPE = Map.of(
            "Jira::Project", "jiraProjects",
            "Confluence::Space", "confluenceSpaces",
            "GitLab::Group", "gitlabGroups",
            "OpenSearch::Index", "opensearchIndexPrefixes",
            "ServiceDesk::Queue", "servicedeskQueues");

    private ScopeGroups() {
    }

    /**
     * @param resourceType a grantable resource type
     * @return the {@code principal.scopes} field that holds its scope ids, empty if the type is not grantable
     */
    public static Optional<String> scopeField(String resourceType) {
        return Optional.ofNullable(FIELD_BY_SCOPE_TYPE.get(resourceType));
    }

    /**
     * @param resourceType e.g. {@code Jira::Project}
     * @return the {@code context.refs} field: namespace in lower case followed by the type, e.g. {@code jiraProject}
     */
    public static String refsField(String resourceType) {
        int separator = resourceType.indexOf("::");
        if (separator <= 0) {
            throw new EntityBuilderException(EntityBuilderException.Code.INTERNAL_ERROR,
                    "not a namespaced resource type: " + resourceType);
        }
        return resourceType.substring(0, separator).toLowerCase(Locale.ROOT) + resourceType.substring(separator + 2);
    }

    /**
     * @param indexName OpenSearch index name
     * @return every prefix ending before a {@code -}, plus the full name; e.g. {@code logs}, {@code logs-team},
     *         {@code logs-team-a} for {@code logs-team-a}
     */
    public static SortedSet<String> namePrefixes(String indexName) {
        TreeSet<String> prefixes = new TreeSet<>();
        int from = 0;
        int dash;
        while ((dash = indexName.indexOf('-', from)) >= 0) {
            prefixes.add(indexName.substring(0, dash));
            from = dash + 1;
        }
        prefixes.add(indexName);
        return Collections.unmodifiableSortedSet(prefixes);
    }
}
