package pl.aiwcorpo.mcp.cedar.entities;

import java.util.Collections;
import java.util.SortedSet;
import java.util.TreeSet;

/**
 * Helpers for the server that derives {@code scopes} of a resource (cedar/entity-builder.md). Which scopes a
 * resource of a system carries is the server's decision; these are the two derivations several systems need.
 */
public final class Scopes {

    private Scopes() {
    }

    /** @return the scope id {@code <type>/<localId>}, e.g. {@code Jira::Project/ABC} */
    public static String id(String type, String localId) {
        return type + "/" + localId;
    }

    /** @return every prefix of a {@code /}-separated path, e.g. {@code team-a}, {@code team-a/sub} for {@code team-a/sub} */
    public static SortedSet<String> pathPrefixes(String path) {
        TreeSet<String> prefixes = new TreeSet<>();
        int from = 0;
        int slash;
        while ((slash = path.indexOf('/', from)) >= 0) {
            prefixes.add(path.substring(0, slash));
            from = slash + 1;
        }
        prefixes.add(path);
        return Collections.unmodifiableSortedSet(prefixes);
    }

    /**
     * @return every prefix of a name that ends before a {@code -}, plus the full name; e.g. {@code logs}, {@code logs-team},
     *         {@code logs-team-a} for {@code logs-team-a}
     */
    public static SortedSet<String> dashPrefixes(String name) {
        TreeSet<String> prefixes = new TreeSet<>();
        int from = 0;
        int dash;
        while ((dash = name.indexOf('-', from)) >= 0) {
            prefixes.add(name.substring(0, dash));
            from = dash + 1;
        }
        prefixes.add(name);
        return Collections.unmodifiableSortedSet(prefixes);
    }
}
