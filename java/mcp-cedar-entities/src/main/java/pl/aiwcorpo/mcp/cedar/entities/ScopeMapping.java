package pl.aiwcorpo.mcp.cedar.entities;

import com.cedarpolicy.model.entity.Entity;
import com.cedarpolicy.value.EntityUID;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.SortedSet;
import java.util.TreeMap;
import java.util.TreeSet;
import pl.aiwcorpo.mcp.cedar.entities.EntityBuilderException.Code;

/**
 * Which group grants which resource scopes (CC-037). Data, not code: it is read from {@code entities/static.json}
 * of the main policy bundle, where each {@code UserGroup} entity lists {@code ResourceScope} parents with ids
 * {@code <ResourceType>/<id>}. A group that is not in the mapping grants nothing.
 */
public final class ScopeMapping {

    private static final ScopeMapping EMPTY = new ScopeMapping(Map.of());
    private final Map<String, SortedSet<String>> scopesByGroup;

    private ScopeMapping(Map<String, SortedSet<String>> scopesByGroup) {
        this.scopesByGroup = scopesByGroup;
    }

    /** Mapping that grants nothing; every scope check fails closed. */
    public static ScopeMapping empty() {
        return EMPTY;
    }

    /**
     * Reads the mapping from the static entities of a bundle; entities other than {@code UserGroup} are ignored.
     *
     * @throws EntityBuilderException {@code INTERNAL_ERROR} when a group has a parent that is not a valid
     *         {@code ResourceScope} or is listed twice; a bundle with such data must be rejected
     */
    public static ScopeMapping fromStaticEntities(Collection<Entity> staticEntities) {
        Map<String, SortedSet<String>> mapping = new TreeMap<>();
        for (Entity entity : staticEntities) {
            EntityUID uid = entity.getEUID();
            if (!"UserGroup".equals(uid.getType().toString())) {
                continue;
            }
            String group = uid.getId().toString();
            TreeSet<String> scopes = new TreeSet<>();
            for (EntityUID parent : entity.getParents()) {
                if (!"ResourceScope".equals(parent.getType().toString())) {
                    throw new EntityBuilderException(Code.INTERNAL_ERROR,
                            "UserGroup " + group + ": parent " + parent.getType() + " is not a ResourceScope");
                }
                String id = parent.getId().toString();
                if (ResourceScopes.typeOf(id).isEmpty()) {
                    throw new EntityBuilderException(Code.INTERNAL_ERROR, "UserGroup " + group + ": invalid scope id " + id);
                }
                scopes.add(id);
            }
            if (mapping.put(group, Collections.unmodifiableSortedSet(scopes)) != null) {
                throw new EntityBuilderException(Code.INTERNAL_ERROR, "UserGroup " + group + " listed twice");
            }
        }
        return new ScopeMapping(Collections.unmodifiableMap(mapping));
    }

    /** @return scope ids ({@code <ResourceType>/<id>}) granted by the group; empty when unmapped */
    public SortedSet<String> scopesOf(String group) {
        return scopesByGroup.getOrDefault(group, Collections.emptySortedSet());
    }

    /** @return all mapped groups with their scope ids, in group order */
    public Map<String, SortedSet<String>> asMap() {
        return new LinkedHashMap<>(scopesByGroup);
    }
}
