package pl.aiwcorpo.mcp.cedar.entities;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Collection;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
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

    /**
     * A scope or an entry that evaluation skipped.
     *
     * @param group the group of the entry; empty when the entry itself had none
     * @param scope the scope id that was skipped; empty when the whole entry was skipped
     * @param reason why: {@code undeclared_type}, {@code invalid_scope}, {@code group_missing} or {@code group_duplicate}
     */
    public record Ignored(String group, String scope, String reason) {
    }

    private static final ScopeMapping EMPTY = new ScopeMapping(Map.of(), List.of());
    private static final ObjectMapper JSON = new ObjectMapper();
    private final Map<String, SortedSet<String>> scopesByGroup;
    private final List<Ignored> ignored;

    private ScopeMapping(Map<String, SortedSet<String>> scopesByGroup, List<Ignored> ignored) {
        this.scopesByGroup = scopesByGroup;
        this.ignored = ignored;
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
     * Mapping for evaluation: a scope that is not valid is skipped on its own and reported by {@link #ignored()}, so that
     * one bad entry never removes the grants of the others (a server that was removed leaves undeclared types in the stored
     * document; a manifest with a narrower {@code scopePattern} leaves scopes that no longer match). The caller audits the
     * ignored list. Never throws for the content of the mapping.
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
        List<Ignored> invalidEntries = new ArrayList<>();
        try {
            JsonNode array = JSON.readTree(json);
            if (array == null || !array.isArray()) {
                throw new EntityBuilderException(Code.INTERNAL_ERROR, "scopeMapping must be a JSON array");
            }
            for (JsonNode entry : array) {
                String group = entry.path("group").asText("");
                TreeSet<String> scopes = new TreeSet<>();
                entry.path("scopes").forEach(s -> scopes.add(s.asText()));
                if (group.isEmpty() || byGroup.containsKey(group)) {
                    if (!skipUndeclared) {
                        throw new EntityBuilderException(Code.INTERNAL_ERROR, "scopeMapping: group missing or listed twice: " + group);
                    }
                    invalidEntries.add(new Ignored(group, "", group.isEmpty() ? "group_missing" : "group_duplicate"));
                    continue;
                }
                byGroup.put(group, scopes);
            }
        } catch (IOException e) {
            throw new EntityBuilderException(Code.INTERNAL_ERROR, "scopeMapping is not valid JSON");
        }
        ScopeMapping built = build(types, byGroup, skipUndeclared);
        if (invalidEntries.isEmpty()) {
            return built;
        }
        List<Ignored> all = new ArrayList<>(invalidEntries);
        all.addAll(built.ignored);
        return new ScopeMapping(built.scopesByGroup, Collections.unmodifiableList(all));
    }

    private static ScopeMapping build(ResourceTypes types, Map<String, ? extends Collection<String>> scopesByGroup,
            boolean lenient) {
        Objects.requireNonNull(types, "types");
        Map<String, SortedSet<String>> mapping = new TreeMap<>();
        List<Ignored> ignored = new ArrayList<>();
        scopesByGroup.forEach((group, ids) -> {
            TreeSet<String> scopes = new TreeSet<>();
            for (String id : ids) {
                int slash = id.indexOf('/');
                String type = slash > 0 ? id.substring(0, slash) : "";
                if (types.scopeType(id).isEmpty()) {
                    if (!lenient) {
                        throw new EntityBuilderException(Code.INTERNAL_ERROR, "group " + group + ": invalid scope id " + id);
                    }
                    ignored.add(new Ignored(group, id, types.isDeclared(type) ? "invalid_scope" : "undeclared_type"));
                    continue;
                }
                scopes.add(id);
            }
            mapping.put(group, Collections.unmodifiableSortedSet(scopes));
        });
        return new ScopeMapping(Collections.unmodifiableMap(mapping), Collections.unmodifiableList(ignored));
    }

    /** @return the scopes and entries that evaluation skipped, empty for a strict mapping; the caller audits them */
    public List<Ignored> ignored() {
        return ignored;
    }

    /**
     * The mapping as a server of one namespace needs it: only the scopes of types of that namespace, and only the groups that
     * keep one. The gateway serves this in the policy data, so a server never learns the grants of another system.
     */
    public ScopeMapping forNamespace(String namespace) {
        String prefix = namespace + "::";
        Map<String, SortedSet<String>> filtered = new TreeMap<>();
        scopesByGroup.forEach((group, scopes) -> {
            TreeSet<String> kept = new TreeSet<>();
            scopes.stream().filter(s -> s.startsWith(prefix)).forEach(kept::add);
            if (!kept.isEmpty()) {
                filtered.put(group, Collections.unmodifiableSortedSet(kept));
            }
        });
        return new ScopeMapping(Collections.unmodifiableMap(filtered), List.of());
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
