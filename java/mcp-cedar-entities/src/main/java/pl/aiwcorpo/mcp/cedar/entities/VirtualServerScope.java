package pl.aiwcorpo.mcp.cedar.entities;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;

/**
 * Virtual server (C5) the call goes through.
 *
 * @param slug link slug, must equal {@link Caller#virtualServer()}
 * @param resourceDefaults narrowing per resource type; keys are the five scope types of C5 (CC-017)
 */
public record VirtualServerScope(String slug, Map<String, List<String>> resourceDefaults) {

    public VirtualServerScope {
        Objects.requireNonNull(slug, "slug");
        TreeMap<String, List<String>> copy = new TreeMap<>();
        Objects.requireNonNull(resourceDefaults, "resourceDefaults").forEach((k, v) -> copy.put(k, List.copyOf(v)));
        resourceDefaults = java.util.Collections.unmodifiableMap(copy);
    }

    /** Link that only lists tools and does not narrow resources. */
    public static VirtualServerScope withoutNarrowing(String slug) {
        return new VirtualServerScope(slug, Map.of());
    }
}
