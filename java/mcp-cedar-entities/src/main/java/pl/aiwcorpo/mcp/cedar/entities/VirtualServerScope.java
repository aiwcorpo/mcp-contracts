package pl.aiwcorpo.mcp.cedar.entities;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.SortedSet;
import java.util.TreeSet;
import pl.aiwcorpo.mcp.cedar.entities.EntityBuilderException.Code;

/**
 * Virtual server (C5) the call goes through, as carried by the internal JWT: claim {@code vs} = {@link #slug()},
 * claim {@code vsc} = {@link #vsScopes()} (CC-027). The gateway creates it from the link's {@code resourceDefaults}
 * with {@link #fromResourceDefaults} and writes {@link #vsScopes()} into {@code vsc}; a server creates it from the two
 * claims with the canonical constructor.
 *
 * @param slug link slug
 * @param vsScopes narrowing keyed by the {@code vsScopes} fields of the Cedar model ({@link ScopeGroups#SCOPE_FIELDS});
 *        empty when the link does not narrow resources
 */
public record VirtualServerScope(String slug, Map<String, SortedSet<String>> vsScopes) {

    public VirtualServerScope {
        Objects.requireNonNull(slug, "slug");
        Map<String, SortedSet<String>> copy = new LinkedHashMap<>();
        Objects.requireNonNull(vsScopes, "vsScopes");
        for (String field : ScopeGroups.SCOPE_FIELDS) {
            if (vsScopes.containsKey(field)) {
                copy.put(field, Collections.unmodifiableSortedSet(new TreeSet<>(vsScopes.get(field))));
            }
        }
        for (String field : vsScopes.keySet()) {
            if (!ScopeGroups.SCOPE_FIELDS.contains(field)) {
                throw new EntityBuilderException(Code.INTERNAL_ERROR, "unknown vsc field " + field);
            }
        }
        vsScopes = Collections.unmodifiableMap(copy);
    }

    /**
     * Gateway side: maps C5 {@code resourceDefaults} (keys are resource types) to {@code vsScopes} fields.
     *
     * @throws EntityBuilderException {@code INTERNAL_ERROR} for a type that cannot narrow
     */
    public static VirtualServerScope fromResourceDefaults(String slug, Map<String, ? extends List<String>> resourceDefaults) {
        Map<String, SortedSet<String>> scopes = new LinkedHashMap<>();
        resourceDefaults.forEach((type, ids) -> {
            String field = ScopeGroups.vsScopeField(type).orElseThrow(() ->
                    new EntityBuilderException(Code.INTERNAL_ERROR, "resourceDefaults type cannot narrow: " + type));
            scopes.computeIfAbsent(field, f -> new TreeSet<>()).addAll(ids);
        });
        return new VirtualServerScope(slug, scopes);
    }

    /** Link that only lists tools and does not narrow resources ({@code vsc = {}}). */
    public static VirtualServerScope withoutNarrowing(String slug) {
        return new VirtualServerScope(slug, Map.of());
    }
}
