package pl.aiwcorpo.mcp.cedar.entities;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.SortedSet;
import java.util.TreeMap;
import java.util.TreeSet;
import pl.aiwcorpo.mcp.cedar.entities.EntityBuilderException.Code;

/**
 * Which group grants which resource scopes: administrator data, the {@code scopeMapping} of the policy data the gateway
 * stores and serves (C5, C7). A scope id is {@code <Type>/<local>} where the type is declared by a registered server and
 * the local part matches its {@code scopePattern}. A group that is not in the mapping grants nothing.
 */
public final class ScopeMapping {

    private static final ScopeMapping EMPTY = new ScopeMapping(Map.of());
    private static final ObjectMapper JSON = new ObjectMapper();
    private final Map<String, SortedSet<String>> scopesByGroup;

    private ScopeMapping(Map<String, SortedSet<String>> scopesByGroup) {
        this.scopesByGroup = scopesByGroup;
    }

    /** Mapping that grants nothing; every scope check fails closed. */
    public static ScopeMapping empty() {
        return EMPTY;
    }

    /**
     * Strict mapping, for validating a document an administrator submits.
     *
     * @param types the declared resource types
     * @param scopesByGroup group name to scope ids
     * @throws EntityBuilderException {@code INTERNAL_ERROR} when a scope id is malformed, names a type that is not
     *         declared or not grantable, or its local part does not match the {@code scopePattern}
     */
    public static ScopeMapping of(ResourceTypes types, Map<String, ? extends Collection<String>> scopesByGroup) {
        return build(types, scopesByGroup, false);
    }

    /**
     * Mapping for evaluation: scope ids of a type that no registered server declares are skipped, because the server
     * that declared it may have been removed while the stored document still names its scopes. A declared type with a
     * local part that does not match is still an error.
     *
     * @throws EntityBuilderException {@code INTERNAL_ERROR} as {@link #of}, except for undeclared types
     */
    public static ScopeMapping ofRegistered(ResourceTypes types, Map<String, ? extends Collection<String>> scopesByGroup) {
        return build(types, scopesByGroup, true);
    }

    /**
     * Reads the {@code scopeMapping} member of the policy data: {@code [{"group": "mcp-x", "scopes": ["Jira::Project/ABC"]}]}.
     *
     * @param skipUndeclared as {@link #ofRegistered} when true, as {@link #of} when false
     * @throws EntityBuilderException {@code INTERNAL_ERROR} for malformed JSON, a group listed twice or an invalid scope
     */
    public static ScopeMapping fromJson(ResourceTypes types, String json, boolean skipUndeclared) {
        Map<String, Collection<String>> byGroup = new LinkedHashMap<>();
        try {
            JsonNode array = JSON.readTree(json);
            if (array == null || !array.isArray()) {
                throw new EntityBuilderException(Code.INTERNAL_ERROR, "scopeMapping must be a JSON array");
            }
            for (JsonNode entry : array) {
                String group = entry.path("group").asText("");
                TreeSet<String> scopes = new TreeSet<>();
                entry.path("scopes").forEach(s -> scopes.add(s.asText()));
                if (group.isEmpty() || byGroup.put(group, scopes) != null) {
                    throw new EntityBuilderException(Code.INTERNAL_ERROR, "scopeMapping: group missing or listed twice: " + group);
                }
            }
        } catch (IOException e) {
            throw new EntityBuilderException(Code.INTERNAL_ERROR, "scopeMapping is not valid JSON");
        }
        return build(types, byGroup, skipUndeclared);
    }

    private static ScopeMapping build(ResourceTypes types, Map<String, ? extends Collection<String>> scopesByGroup,
            boolean skipUndeclared) {
        Objects.requireNonNull(types, "types");
        Map<String, SortedSet<String>> mapping = new TreeMap<>();
        scopesByGroup.forEach((group, ids) -> {
            TreeSet<String> scopes = new TreeSet<>();
            for (String id : ids) {
                int slash = id.indexOf('/');
                String type = slash > 0 ? id.substring(0, slash) : "";
                if (skipUndeclared && !types.isDeclared(type)) {
                    continue;
                }
                if (types.scopeType(id).isEmpty()) {
                    throw new EntityBuilderException(Code.INTERNAL_ERROR, "group " + group + ": invalid scope id " + id);
                }
                scopes.add(id);
            }
            mapping.put(group, Collections.unmodifiableSortedSet(scopes));
        });
        return new ScopeMapping(Collections.unmodifiableMap(mapping));
    }

    /** @return scope ids ({@code <Type>/<local>}) granted by the group; empty when unmapped */
    public SortedSet<String> scopesOf(String group) {
        return scopesByGroup.getOrDefault(group, Collections.emptySortedSet());
    }

    /** @return all mapped groups with their scope ids, in group order */
    public Map<String, SortedSet<String>> asMap() {
        return new LinkedHashMap<>(scopesByGroup);
    }
}
