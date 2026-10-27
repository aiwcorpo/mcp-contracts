package pl.aiwcorpo.mcp.cedar.entities;

import java.util.List;
import java.util.Optional;
import java.util.SortedSet;
import java.util.TreeSet;

/** Ids of {@code ResourceScope} entities: {@code <ResourceType>/<id>} (CC-037). */
public final class ResourceScopes {

    /** Types a mapping may grant; {@code Confluence::Page} grants a page tree. */
    public static final List<String> GRANTABLE_TYPES = List.of(
            "Jira::Project", "Confluence::Space", "Confluence::Page", "GitLab::Group", "OpenSearch::Index", "ServiceDesk::Queue");

    private ResourceScopes() {
    }

    /** @return {@code type + "/" + id} */
    public static String id(String type, String id) {
        return type + "/" + id;
    }

    /** @return the resource type of a scope id, empty when the id is malformed, the type is not grantable or the local id does not match its pattern (CC-056) */
    public static Optional<String> typeOf(String scopeId) {
        int slash = scopeId.indexOf('/');
        if (slash <= 0 || slash == scopeId.length() - 1) {
            return Optional.empty();
        }
        String type = scopeId.substring(0, slash);
        return GRANTABLE_TYPES.contains(type) && ResourceIds.isValid(type, ResourceIds.Kind.SCOPE, scopeId.substring(slash + 1))
                ? Optional.of(type) : Optional.empty();
    }

    /** @return the part after the type, e.g. {@code team-a/sub} for {@code GitLab::Group/team-a/sub} */
    public static String localId(String scopeId) {
        return scopeId.substring(scopeId.indexOf('/') + 1);
    }

    /** @return every prefix of a {@code /}-separated path, e.g. {@code team-a}, {@code team-a/sub} */
    public static SortedSet<String> pathPrefixes(String path) {
        TreeSet<String> prefixes = new TreeSet<>();
        int from = 0;
        int slash;
        while ((slash = path.indexOf('/', from)) >= 0) {
            prefixes.add(path.substring(0, slash));
            from = slash + 1;
        }
        prefixes.add(path);
        return prefixes;
    }
}
