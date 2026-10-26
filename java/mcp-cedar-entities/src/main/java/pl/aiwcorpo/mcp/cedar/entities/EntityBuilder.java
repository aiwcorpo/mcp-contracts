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
 * Builds Cedar requests for MCP tool calls exactly as specified in {@code cedar/entity-builder.md}. Stateless and
 * thread-safe. Conformance is defined by the vectors in {@code test-vectors/entity-builder} and
 * {@code test-vectors/policy-decisions}, which this module's tests execute.
 */
public final class EntityBuilder {

    private static final Map<String, String> PARENT_ATTRIBUTE = Map.of(
            "Jira::Issue", "project",
            "Confluence::Page", "space",
            "GitLab::Project", "group",
            "ServiceDesk::Ticket", "queue");
    private static final String OPENSEARCH_INDEX = "OpenSearch::Index";
    private static final Comparator<Entity> BY_TYPE_THEN_ID = Comparator
            .<Entity, String>comparing(e -> e.getEUID().getType().toString())
            .thenComparing(e -> e.getEUID().getId().toString());

    /**
     * Gateway evaluation: {@code Action::"call"} on {@code Tool::"<system>__<tool>"}.
     *
     * @param caller the calling user
     * @param tool approved registry entry of the tool
     * @param arguments {@code params.arguments} of {@code tools/call} without {@code confirmation_code}; values as
     *        produced by a JSON parser (String, Number, Boolean, List, Map, null)
     * @param virtualServer the link, required exactly when {@code caller.virtualServer()} is present
     * @return request and entities
     * @throws EntityBuilderException when a resource argument is not an identifier or the input is inconsistent
     */
    public CedarRequest forToolCall(Caller caller, ToolDescriptor tool, Map<String, ?> arguments,
            Optional<VirtualServerScope> virtualServer) {
        Map<String, Value> context = context(caller, tool, arguments, virtualServer);
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
     * Server evaluation: {@code Action::"<tool action>"} on the resolved resource.
     *
     * @param caller the calling user (from the internal JWT)
     * @param tool the server's own manifest entry of the tool
     * @param arguments arguments of the call, as for {@link #forToolCall}
     * @param virtualServer the link, required exactly when {@code caller.virtualServer()} is present
     * @param resource the resource resolved from the system, with its parent where the type has one
     * @return request and entities
     * @throws EntityBuilderException when a resource argument is not an identifier or the input is inconsistent
     */
    public CedarRequest forResource(Caller caller, ToolDescriptor tool, Map<String, ?> arguments,
            Optional<VirtualServerScope> virtualServer, ResolvedResource resource) {
        Map<String, Value> context = context(caller, tool, arguments, virtualServer);
        List<Entity> entities = principalEntities(caller);
        Objects.requireNonNull(resource, "resource");
        resource.parent().ifPresent(parent -> entities.add(systemEntity(parent, Optional.empty())));
        entities.add(systemEntity(resource, resource.parent()));
        return result(caller, uid("Action", tool.action()), uid(resource.type(), resource.id()), context, entities);
    }

    private static CedarRequest result(Caller caller, EntityUID action, EntityUID resource, Map<String, Value> context,
            List<Entity> entities) {
        entities.sort(BY_TYPE_THEN_ID);
        return new CedarRequest(uid("User", caller.sub()), action, resource, context, new LinkedHashSet<>(entities));
    }

    private static Map<String, Value> context(Caller caller, ToolDescriptor tool, Map<String, ?> arguments,
            Optional<VirtualServerScope> virtualServer) {
        Objects.requireNonNull(caller, "caller");
        Objects.requireNonNull(tool, "tool");
        Objects.requireNonNull(arguments, "arguments");
        Objects.requireNonNull(virtualServer, "virtualServer");
        Map<String, Value> context = new LinkedHashMap<>();
        context.put("client", new PrimString(caller.client()));
        if (caller.virtualServer().isPresent()) {
            String slug = caller.virtualServer().get();
            VirtualServerScope link = virtualServer
                    .filter(vs -> vs.slug().equals(slug))
                    .orElseThrow(() -> new EntityBuilderException(Code.INTERNAL_ERROR,
                            "virtual server definition missing for vs claim " + slug));
            context.put("virtualServer", new PrimString(slug));
            if (!link.resourceDefaults().isEmpty()) {
                Map<String, Value> vsScopes = new LinkedHashMap<>();
                link.resourceDefaults().forEach((type, ids) -> {
                    String field = ScopeGroups.vsScopeField(type).orElseThrow(() -> new EntityBuilderException(
                            Code.INTERNAL_ERROR, "resourceDefaults type cannot narrow: " + type));
                    vsScopes.put(field, stringSet(new TreeSet<>(ids)));
                });
                context.put("vsScopes", new CedarMap(vsScopes));
            }
        } else if (virtualServer.isPresent()) {
            throw new EntityBuilderException(Code.INTERNAL_ERROR, "virtual server given without vs claim");
        }
        caller.mfaAgeSeconds().ifPresent(age -> context.put("mfaAge", new PrimLong(age)));
        Map<String, SortedSet<String>> refs = new LinkedHashMap<>();
        for (ResourceRef ref : tool.resourceRefs()) {
            refs.computeIfAbsent(ScopeGroups.refsField(ref.type()), k -> new TreeSet<>())
                    .addAll(argumentIds(ref.argument(), arguments.get(ref.argument())));
        }
        Map<String, Value> refsValue = new LinkedHashMap<>();
        refs.forEach((field, ids) -> refsValue.put(field, stringSet(ids)));
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
                ids.add(scalarId(argument, element)
                        .orElseThrow(() -> invalid(argument + ": array element is not a string or integer")));
            }
            return ids;
        }
        return List.of(scalarId(argument, value).orElseThrow(() -> invalid(argument + ": not a resource identifier")));
    }

    private static Optional<String> scalarId(String argument, Object value) {
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

    private static List<Entity> principalEntities(Caller caller) {
        TreeSet<String> groups = new TreeSet<>();
        for (String group : caller.groups()) {
            if (group.startsWith("mcp-")) {
                groups.add(group);
            }
        }
        Map<String, Value> scopes = new LinkedHashMap<>();
        ScopeGroups.scopesFromGroups(groups).forEach((field, values) -> scopes.put(field, stringSet(values)));
        Map<String, Value> attrs = new LinkedHashMap<>();
        attrs.put("username", new PrimString(caller.username()));
        attrs.put("client", new PrimString(caller.client()));
        attrs.put("scopes", new CedarMap(scopes));
        caller.mfaAgeSeconds().ifPresent(age -> attrs.put("mfaAge", new PrimLong(age)));
        Set<EntityUID> parents = new LinkedHashSet<>();
        List<Entity> entities = new ArrayList<>();
        for (String group : groups) {
            EntityUID groupUid = uid("UserGroup", group);
            parents.add(groupUid);
            entities.add(new Entity(groupUid, Map.of(), Set.of()));
        }
        entities.add(new Entity(uid("User", caller.sub()), attrs, parents));
        return entities;
    }

    private static Entity systemEntity(ResolvedResource resource, Optional<ResolvedResource> parent) {
        Map<String, Value> attrs = new TreeMap<>();
        resource.attributes().forEach((name, value) -> attrs.put(name, toValue(resource.type() + "." + name, value)));
        if (OPENSEARCH_INDEX.equals(resource.type())) {
            Value name = attrs.get("name");
            if (!(name instanceof PrimString)) {
                throw new EntityBuilderException(Code.INTERNAL_ERROR, "OpenSearch::Index needs a string name");
            }
            attrs.put("namePrefixes", stringSet(ScopeGroups.namePrefixes(resource.attributes().get("name").toString())));
        }
        String parentAttribute = PARENT_ATTRIBUTE.get(resource.type());
        if (parentAttribute != null) {
            ResolvedResource p = parent.orElseThrow(() -> new EntityBuilderException(Code.INTERNAL_ERROR,
                    resource.type() + " needs its parent"));
            attrs.put(parentAttribute, uid(p.type(), p.id()));
        }
        Set<EntityUID> parents = parent.map(p -> Set.of(uid(p.type(), p.id()))).orElse(Set.of());
        return new Entity(uid(resource.type(), resource.id()), attrs, parents);
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
            return new PrimLong(Long.parseLong(integralDecimal(number).orElseThrow(() ->
                    new EntityBuilderException(Code.INTERNAL_ERROR, path + ": Cedar has no fractional numbers"))));
        }
        if (value instanceof Collection<?> collection) {
            CedarList list = new CedarList();
            collection.forEach(element -> list.add(toValue(path, element)));
            return list;
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Value> record = new LinkedHashMap<>();
            map.forEach((k, v) -> record.put(String.valueOf(k), toValue(path + "." + k, v)));
            return new CedarMap(record);
        }
        throw new EntityBuilderException(Code.INTERNAL_ERROR, path + ": unsupported attribute value");
    }

    private static CedarList stringSet(Collection<String> values) {
        CedarList list = new CedarList();
        values.forEach(v -> list.add(new PrimString(v)));
        return list;
    }

    private static EntityUID uid(String type, String id) {
        EntityTypeName typeName = EntityTypeName.parse(type).orElseThrow(() ->
                new EntityBuilderException(Code.INTERNAL_ERROR, "invalid Cedar type " + type));
        return new EntityUID(typeName, id);
    }
}
