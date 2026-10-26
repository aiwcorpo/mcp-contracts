package pl.aiwcorpo.mcp.cedar.entities;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.SortedSet;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Mapping rules of C9 groups and resource types to the Cedar model (cedar/entity-builder.md, CC-007). */
public final class ScopeGroups {

    /** Fields of {@code principal.scopes} and {@code context.vsScopes}, in schema order. */
    public static final List<String> SCOPE_FIELDS = List.of(
            "jiraProjects", "confluenceSpaces", "gitlabGroups", "opensearchIndexPrefixes", "servicedeskQueues");

    private static final Pattern SCOPE_GROUP = Pattern.compile("^mcp-([a-z]+)-([a-z]+)-(.+)$");
    private static final Map<String, String> FIELD_BY_GROUP_KIND = Map.of(
            "jira/proj", "jiraProjects",
            "confluence/space", "confluenceSpaces",
            "gitlab/grp", "gitlabGroups",
            "opensearch/idx", "opensearchIndexPrefixes",
            "servicedesk/queue", "servicedeskQueues");
    private static final Map<String, String> FIELD_BY_SCOPE_TYPE = Map.of(
            "Jira::Project", "jiraProjects",
            "Confluence::Space", "confluenceSpaces",
            "GitLab::Group", "gitlabGroups",
            "OpenSearch::Index", "opensearchIndexPrefixes",
            "ServiceDesk::Queue", "servicedeskQueues");

    private ScopeGroups() {
    }

    /**
     * Derives {@code principal.scopes} from group names such as {@code mcp-jira-proj-ABC}.
     *
     * @param groups group names; anything that is not a known scope group is ignored
     * @return all five scope fields in schema order, each a sorted set (empty when no scope)
     */
    public static Map<String, SortedSet<String>> scopesFromGroups(Collection<String> groups) {
        Map<String, SortedSet<String>> scopes = new LinkedHashMap<>();
        SCOPE_FIELDS.forEach(f -> scopes.put(f, new TreeSet<>()));
        for (String group : groups) {
            Matcher m = SCOPE_GROUP.matcher(group);
            if (m.matches()) {
                String field = FIELD_BY_GROUP_KIND.get(m.group(1) + "/" + m.group(2));
                if (field != null) {
                    scopes.get(field).add(m.group(3));
                }
            }
        }
        scopes.replaceAll((k, v) -> Collections.unmodifiableSortedSet(v));
        return Collections.unmodifiableMap(scopes);
    }

    /**
     * @param resourceType a type from {@code resourceDefaults} (C5)
     * @return the {@code vsScopes} field it narrows, empty if the type cannot narrow
     */
    public static Optional<String> vsScopeField(String resourceType) {
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
