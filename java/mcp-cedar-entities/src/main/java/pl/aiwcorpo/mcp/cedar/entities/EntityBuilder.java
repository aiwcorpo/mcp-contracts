package pl.aiwcorpo.mcp.cedar.entities;

import com.cedarpolicy.model.entity.Entity;
import com.cedarpolicy.value.CedarList;
import com.cedarpolicy.value.CedarMap;
import com.cedarpolicy.value.EntityTypeName;
import com.cedarpolicy.value.EntityUID;
import com.cedarpolicy.value.PrimBool;
import com.cedarpolicy.value.PrimLong;
import com.cedarpolicy.value.PrimString;
import com.cedarpolicy.value.Value;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.SortedSet;
import java.util.TreeMap;
import java.util.TreeSet;
import pl.aiwcorpo.mcp.cedar.entities.EntityBuilderException.Code;

/**
 * Builds Cedar requests for MCP tool calls exactly as specified in {@code cedar/entity-builder.md}. Stateless after
 * construction and thread-safe. Conformance is defined by the vectors in {@code test-vectors/entity-builder},
 * {@code test-vectors/policy-decisions} and {@code test-vectors/result-filter}, which this module's tests execute.
 */
public final class EntityBuilder {

    private static final Map<String, String> PARENT_ATTRIBUTE = Map.of(
            "Jira::Issue", "project",
            "Confluence::Page", "space",
            "GitLab::Project", "group",
            "ServiceDesk::Ticket", "queue");
    private static final Set<String> RESOURCE_TYPES = Set.of(
            "Jira::Project", "Jira::Issue", "Confluence::Space", "Confluence::Page", "GitLab::Group", "GitLab::Project",
            "OpenSearch::Index", "ServiceDesk::Queue", "ServiceDesk::Ticket");
    // refs of these types name a grantable flat scope and become ResourceScope entities (CC-037).
    private static final Set<String> SCOPE_REF_TYPES = Set.of(
            "Jira::Project", "Confluence::Space", "GitLab::Group", "ServiceDesk::Queue");
    // A typo in risk would otherwise skip every rule that compares resource.risk (e.g. the MFA rule for DESTRUCTIVE).
    private static final Set<String> RISKS = Set.of("READ_ONLY", "UPDATE", "DESTRUCTIVE");
    private static final Set<String> ACTIONS = Set.of("read", "update", "delete", "admin");
    // Classification attributes a resolver must deliver (CC-062); without them a Restricted rule could not match.
    private static final Map<String, String> REQUIRED_CLASSIFICATION = Map.of(
            "Jira::Project", "category",
            "Confluence::Space", "labels",
            "OpenSearch::Index", "tags");
    private static final Comparator<Entity> BY_TYPE_THEN_ID = Comparator
            .<Entity, String>comparing(e -> e.getEUID().getType().toString())
            .thenComparing(e -> e.getEUID().getId().toString());

    private final ScopeMapping scopeMapping;

    /** Builder without scope mapping: no group grants any resource scope. */
    public EntityBuilder() {
        this(ScopeMapping.empty());
    }

    /**
     * @param scopeMapping group -> scopes from {@code entities/static.json} of the loaded main policy bundle; build a
     *        new builder when a new bundle is loaded
     */
    public EntityBuilder(ScopeMapping scopeMapping) {
        this.scopeMapping = Objects.requireNonNull(scopeMapping, "scopeMapping");
    }

    /**
     * Gateway evaluation: {@code Action::"call"} on {@code Tool::"<system>__<tool>"}.
     *
     * @param caller the calling user
     * @param tool approved registry entry of the tool
     * @param arguments {@code params.arguments} of {@code tools/call} without {@code confirmation_code}; values as
     *        produced by a JSON parser (String, Number, Boolean, List, Map, null)
     * @return request and entities
     * @throws EntityBuilderException when a resource argument is not an identifier or the input is inconsistent
     */
    public CedarRequest forToolCall(Caller caller, ToolDescriptor tool, Map<String, ?> arguments) {
        Map<String, Value> context = context(caller, tool, arguments);
        List<Entity> entities = principalEntities(caller);
        EntityUID resource = uid("Tool", tool.qualifiedName());
        Map<String, Value> attrs = new LinkedHashMap<>();
        attrs.put("server", new PrimString(tool.serverId()));
        attrs.put("name", new PrimString(tool.name()));
        attrs.put("risk", new PrimString(tool.risk()));
        entities.add(new Entity(resource, attrs, Set.of()));
        return result(caller, uid("Action", "call"), resource, context, entities);
    }

    /**
     * Server evaluation: {@code Action::"<tool action>"} on the resolved resource. Also used for every element a
     * search or list tool returns (see {@link ResultFilter}).
     *
     * @param caller the calling user (from the internal JWT)
     * @param tool the server's own manifest entry of the tool
     * @param arguments arguments of the call, as for {@link #forToolCall}
     * @param resource the resource resolved from the system, with its parent where the type has one
     * @return request and entities
     * @throws EntityBuilderException when a resource argument is not an identifier or the input is inconsistent
     */
    public CedarRequest forResource(Caller caller, ToolDescriptor tool, Map<String, ?> arguments, ResolvedResource resource) {
        Map<String, Value> context = context(caller, tool, arguments);
        List<Entity> entities = principalEntities(caller);
        Objects.requireNonNull(resource, "resource");
        resource.parent().ifPresent(parent -> entities.add(systemEntity(parent, parent.parent())));
        entities.add(systemEntity(resource, resource.parent()));
        return result(caller, uid("Action", tool.action()), uid(resource.type(), resource.id()), context, entities);
    }

    /**
     * What a search or list query must be limited to for one grantable resource type (CC-036): the ids of the
     * virtual server narrowing (if the call goes through a link that narrows this type) and the ids granted to the
     * user by the scope mapping. The server adds the narrowing to the backend query (JQL, CQL, index pattern, group
     * filter) and, where the backend does not enforce the user's own rights (OpenSearch), also the granted ids.
     * The query limit does not replace result filtering.
     *
     * @param resourceType one of {@link ResourceScopes#GRANTABLE_TYPES}
     */
    public QueryConstraint queryConstraint(Caller caller, String resourceType) {
        if (!ResourceScopes.GRANTABLE_TYPES.contains(resourceType)) {
            throw new EntityBuilderException(Code.INTERNAL_ERROR, "not a grantable resource type: " + resourceType);
        }
        // A link narrows Confluence spaces, so a page query is narrowed through its space.
        String narrowingType = "Confluence::Page".equals(resourceType) ? "Confluence::Space" : resourceType;
        Optional<SortedSet<String>> narrowing = caller.virtualServer()
                .flatMap(link -> ScopeGroups.vsScopeField(narrowingType).map(link.vsScopes()::get));
        TreeSet<String> granted = new TreeSet<>();
        for (String group : mcpGroups(caller)) {
            for (String scope : scopeMapping.scopesOf(group)) {
                if (resourceType.equals(ResourceScopes.typeOf(scope).orElse(""))) {
                    granted.add(ResourceScopes.localId(scope));
                }
            }
        }
        return new QueryConstraint(resourceType, narrowing, narrowingType, granted);
    }

    private static CedarRequest result(Caller caller, EntityUID action, EntityUID resource, Map<String, Value> context,
            List<Entity> entities) {
        entities.sort(BY_TYPE_THEN_ID);
        return new CedarRequest(uid("User", caller.sub()), action, resource, context, new LinkedHashSet<>(entities));
    }

    private static Map<String, Value> context(Caller caller, ToolDescriptor tool, Map<String, ?> arguments) {
        Objects.requireNonNull(caller, "caller");
        Objects.requireNonNull(tool, "tool");
        Objects.requireNonNull(arguments, "arguments");
        if (!RISKS.contains(tool.risk())) {
            throw new EntityBuilderException(Code.INTERNAL_ERROR, "unknown risk " + tool.risk());
        }
        if (!ACTIONS.contains(tool.action())) {
            throw new EntityBuilderException(Code.INTERNAL_ERROR, "unknown action " + tool.action());
        }
        Map<String, Value> context = new LinkedHashMap<>();
        context.put("client", new PrimString(caller.client()));
        caller.virtualServer().ifPresent(link -> {
            context.put("virtualServer", new PrimString(link.slug()));
            if (!link.vsScopes().isEmpty()) {
                Map<String, Value> vsScopes = new LinkedHashMap<>();
                link.vsScopes().forEach((field, ids) -> {
                    String type = ScopeGroups.typeOfScopeField(field).orElseThrow();
                    vsScopes.put(field, scopeSet(ids.stream().map(id -> ResourceScopes.id(type, id)).toList()));
                });
                context.put("vsScopes", new CedarMap(vsScopes));
            }
        });
        if (caller.mfaAgeSeconds().isPresent() && caller.mfaAgeSeconds().getAsLong() < 0) {
            throw invalid("mfa age must be >= 0");
        }
        caller.mfaAgeSeconds().ifPresent(age -> context.put("mfaAge", new PrimLong(age)));
        Map<String, String> typeByField = new LinkedHashMap<>();
        Map<String, List<String>> idsByField = new LinkedHashMap<>();
        for (ResourceRef ref : tool.resourceRefs()) {
            if (!RESOURCE_TYPES.contains(ref.type())) {
                throw new EntityBuilderException(Code.INTERNAL_ERROR, "unknown resource type " + ref.type());
            }
            String field = ScopeGroups.refsField(ref.type());
            typeByField.put(field, ref.type());
            List<String> ids = argumentIds(ref.argument(), arguments.get(ref.argument()));
            for (String id : ids) {
                if (!ResourceIds.isValid(ref.type(), ResourceIds.Kind.RESOURCE, id)) {
                    throw invalid(ref.argument() + ": not a valid " + ref.type() + " id");
                }
            }
            idsByField.computeIfAbsent(field, k -> new ArrayList<>()).addAll(ids);
        }
        Map<String, Value> refsValue = new LinkedHashMap<>();
        idsByField.forEach((field, ids) -> {
            String type = typeByField.get(field);
            refsValue.put(field, SCOPE_REF_TYPES.contains(type)
                    ? scopeSet(ids.stream().map(id -> ResourceScopes.id(type, id)).toList())
                    : stringSet(new TreeSet<>(ids)));
        });
        context.put("refs", new CedarMap(refsValue));
        return context;
    }

    private static List<String> argumentIds(String argument, Object value) {
        if (value == null) {
            return List.of();
        }
        if (value instanceof Collection<?> collection) {
            List<String> ids = new ArrayList<>(collection.size());
            for (Object element : collection) {
                ids.add(scalarId(element)
                        .orElseThrow(() -> invalid(argument + ": array element is not a string or integer")));
            }
            return ids;
        }
        return List.of(scalarId(value).orElseThrow(() -> invalid(argument + ": not a resource identifier")));
    }

    private static Optional<String> scalarId(Object value) {
        if (value instanceof CharSequence text) {
            return Optional.of(text.toString());
        }
        if (value instanceof Number number) {
            return integralDecimal(number);
        }
        return Optional.empty();
    }

    /** JSON parsers differ in how they type 4711 or 4711.0, so any number with an integral value is accepted. */
    private static Optional<String> integralDecimal(Number number) {
        if (number instanceof Integer || number instanceof Long || number instanceof Short || number instanceof Byte
                || number instanceof BigInteger) {
            return Optional.of(number.toString());
        }
        try {
            BigDecimal decimal = number instanceof BigDecimal d ? d : new BigDecimal(number.toString());
            return Optional.of(decimal.toBigIntegerExact().toString());
        } catch (ArithmeticException | NumberFormatException e) {
            return Optional.empty();
        }
    }

    private static EntityBuilderException invalid(String message) {
        return new EntityBuilderException(Code.INVALID_ARGUMENT, message);
    }

    private static SortedSet<String> mcpGroups(Caller caller) {
        TreeSet<String> groups = new TreeSet<>();
        for (String group : caller.groups()) {
            if (group.startsWith("mcp-")) {
                groups.add(group);
            }
        }
        return groups;
    }

    private List<Entity> principalEntities(Caller caller) {
        SortedSet<String> groups = mcpGroups(caller);
        Map<String, List<String>> byField = new LinkedHashMap<>();
        ScopeGroups.SCOPE_FIELDS.forEach(f -> byField.put(f, new ArrayList<>()));
        List<Entity> entities = new ArrayList<>();
        Set<EntityUID> userParents = new LinkedHashSet<>();
        for (String group : groups) {
            SortedSet<String> scopes = scopeMapping.scopesOf(group);
            Set<EntityUID> groupParents = new LinkedHashSet<>();
            for (String scope : scopes) {
                groupParents.add(uid("ResourceScope", scope));
                ScopeGroups.vsScopeField(ResourceScopes.typeOf(scope).orElse(""))
                        .ifPresent(field -> byField.get(field).add(scope));
            }
            EntityUID groupUid = uid("UserGroup", group);
            userParents.add(groupUid);
            entities.add(new Entity(groupUid, Map.of(), groupParents));
        }
        Map<String, Value> scopes = new LinkedHashMap<>();
        byField.forEach((field, ids) -> scopes.put(field, scopeSet(ids)));
        Map<String, Value> attrs = new LinkedHashMap<>();
        attrs.put("username", new PrimString(caller.username()));
        attrs.put("client", new PrimString(caller.client()));
        attrs.put("scopes", new CedarMap(scopes));
        caller.mfaAgeSeconds().ifPresent(age -> attrs.put("mfaAge", new PrimLong(age)));
        entities.add(new Entity(uid("User", caller.sub()), attrs, userParents));
        return entities;
    }

    private static Entity systemEntity(ResolvedResource resource, Optional<ResolvedResource> parent) {
        if (!RESOURCE_TYPES.contains(resource.type())) {
            throw new EntityBuilderException(Code.INTERNAL_ERROR, "unknown resource type " + resource.type());
        }
        if (!ResourceIds.isValid(resource.type(), ResourceIds.Kind.RESOURCE, resource.id())) {
            throw new EntityBuilderException(Code.INTERNAL_ERROR, "resolved " + resource.type() + " has an invalid id");
        }
        String classification = REQUIRED_CLASSIFICATION.get(resource.type());
        if (classification != null) {
            Object value = resource.attributes().get(classification);
            boolean ok = "category".equals(classification) ? value instanceof CharSequence : value instanceof Collection<?>;
            if (!ok) {
                throw new EntityBuilderException(Code.INTERNAL_ERROR, resource.type() + " without " + classification);
            }
        }
        Map<String, Value> attrs = new TreeMap<>();
        resource.attributes().forEach((name, value) -> attrs.put(name, "ancestorIds".equals(name)
                ? stringSet(new TreeSet<>(asStrings(resource.type() + ".ancestorIds", value)))
                : toValue(resource.type() + "." + name, value)));
        String parentAttribute = PARENT_ATTRIBUTE.get(resource.type());
        if (parentAttribute != null) {
            ResolvedResource p = parent.orElseThrow(() -> new EntityBuilderException(Code.INTERNAL_ERROR,
                    resource.type() + " needs its parent"));
            attrs.put(parentAttribute, uid(p.type(), p.id()));
        }
        attrs.put("scopes", scopeSet(scopeIds(resource, parent)));
        Set<EntityUID> parents = parent.map(p -> Set.of(uid(p.type(), p.id()))).orElse(Set.of());
        return new Entity(uid(resource.type(), resource.id()), attrs, parents);
    }

    /** Scope ids of the resource and all its containers (cedar/entity-builder.md, CC-037). */
    private static List<String> scopeIds(ResolvedResource resource, Optional<ResolvedResource> parent) {
        String parentId = parent.map(ResolvedResource::id).orElse("");
        List<String> ids = new ArrayList<>();
        switch (resource.type()) {
            case "Jira::Project" -> ids.add(ResourceScopes.id("Jira::Project", resource.id()));
            case "Jira::Issue" -> ids.add(ResourceScopes.id("Jira::Project", parentId));
            case "Confluence::Space" -> ids.add(ResourceScopes.id("Confluence::Space", resource.id()));
            case "Confluence::Page" -> {
                ids.add(ResourceScopes.id("Confluence::Space", parentId));
                Object ancestors = resource.attributes().get("ancestorIds");
                if (ancestors != null) {
                    asStrings("Confluence::Page.ancestorIds", ancestors).forEach(a -> ids.add(ResourceScopes.id("Confluence::Page", a)));
                }
                ids.add(ResourceScopes.id("Confluence::Page", resource.id()));
            }
            case "GitLab::Group" -> ResourceScopes.pathPrefixes(resource.id()).forEach(p -> ids.add(ResourceScopes.id("GitLab::Group", p)));
            case "GitLab::Project" -> ResourceScopes.pathPrefixes(parentId).forEach(p -> ids.add(ResourceScopes.id("GitLab::Group", p)));
            case "OpenSearch::Index" -> ScopeGroups.namePrefixes(resource.id()).forEach(p -> ids.add(ResourceScopes.id("OpenSearch::Index", p)));
            case "ServiceDesk::Queue" -> ids.add(ResourceScopes.id("ServiceDesk::Queue", resource.id()));
            case "ServiceDesk::Ticket" -> ids.add(ResourceScopes.id("ServiceDesk::Queue", parentId));
            default -> throw new EntityBuilderException(Code.INTERNAL_ERROR, "unknown resource type " + resource.type());
        }
        return ids;
    }

    private static List<String> asStrings(String path, Object value) {
        if (!(value instanceof Collection<?> collection)) {
            throw new EntityBuilderException(Code.INTERNAL_ERROR, path + ": expected a list of ids");
        }
        List<String> out = new ArrayList<>();
        for (Object element : collection) {
            String id = scalarId(element).orElseThrow(() -> new EntityBuilderException(Code.INTERNAL_ERROR, path + ": not an id"));
            if (path.endsWith(".ancestorIds") && !ResourceIds.isValid("Confluence::Page", ResourceIds.Kind.RESOURCE, id)) {
                throw new EntityBuilderException(Code.INTERNAL_ERROR, path + ": invalid page id");
            }
            out.add(id);
        }
        return out;
    }

    private static Value toValue(String path, Object value) {
        if (value instanceof Value cedar) {
            return cedar;
        }
        if (value instanceof CharSequence text) {
            return new PrimString(text.toString());
        }
        if (value instanceof Boolean bool) {
            return new PrimBool(bool);
        }
        if (value instanceof Number number) {
            String decimal = integralDecimal(number).orElseThrow(() ->
                    new EntityBuilderException(Code.INTERNAL_ERROR, path + ": Cedar has no fractional numbers"));
            try {
                return new PrimLong(Long.parseLong(decimal));
            } catch (NumberFormatException e) {
                throw new EntityBuilderException(Code.INTERNAL_ERROR, path + ": outside the Cedar Long range");
            }
        }
        if (value instanceof Collection<?> collection) {
            CedarList list = new CedarList();
            collection.forEach(element -> list.add(toValue(path, element)));
            return list;
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Value> record = new LinkedHashMap<>();
            map.forEach((k, v) -> {
                if (v != null) {
                    record.put(String.valueOf(k), toValue(path + "." + k, v));
                }
            });
            return new CedarMap(record);
        }
        throw new EntityBuilderException(Code.INTERNAL_ERROR, path + ": unsupported attribute value");
    }

    private static CedarList stringSet(Collection<String> values) {
        CedarList list = new CedarList();
        values.forEach(v -> list.add(new PrimString(v)));
        return list;
    }

    private static CedarList scopeSet(Collection<String> scopeIds) {
        CedarList list = new CedarList();
        new TreeSet<>(scopeIds).forEach(id -> list.add(uid("ResourceScope", id)));
        return list;
    }

    private static EntityUID uid(String type, String id) {
        EntityTypeName typeName = EntityTypeName.parse(type).orElseThrow(() ->
                new EntityBuilderException(Code.INTERNAL_ERROR, "invalid Cedar type " + type));
        return new EntityUID(typeName, id);
    }
}
