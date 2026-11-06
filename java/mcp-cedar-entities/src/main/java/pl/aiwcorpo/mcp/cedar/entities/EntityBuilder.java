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
import pl.aiwcorpo.mcp.cedar.entities.ResourceTypeDeclaration.Classification;
import pl.aiwcorpo.mcp.cedar.entities.ResourceTypeDeclaration.Kind;

/**
 * Builds Cedar requests for MCP tool calls exactly as specified in {@code cedar/entity-builder.md}. Stateless after
 * construction and thread-safe. Conformance is defined by the vectors in {@code test-vectors/entity-builder},
 * {@code test-vectors/policy-decisions} and {@code test-vectors/result-filter}, which this module's tests execute.
 */
public final class EntityBuilder {

    // A typo in risk would otherwise skip every rule that compares resource.risk (e.g. the MFA rule for DESTRUCTIVE).
    private static final Set<String> RISKS = Set.of("READ_ONLY", "UPDATE", "DESTRUCTIVE");
    private static final Set<String> ACTIONS = Set.of("read", "update", "delete", "admin");
    private static final Comparator<Entity> BY_TYPE_THEN_ID = Comparator
            .<Entity, String>comparing(e -> e.getEUID().getType().toString())
            .thenComparing(e -> e.getEUID().getId().toString());

    private static final Set<String> CREDENTIAL_TYPES = Set.of("user-oauth", "user-secret", "token-exchange", "service-account");

    private final ResourceTypes types;
    private final ScopeMapping scopeMapping;
    private final String credentialType;

    /**
     * @param types the declared resource types: of the registered servers at the gateway, of the own manifest at a
     *        server; build a new builder when they change
     * @param scopeMapping group -> scopes from the policy data (administrator data); build a new builder when the
     *        mapping changes. The mapping must have been validated against {@code types}.
     */
    public EntityBuilder(ResourceTypes types, ScopeMapping scopeMapping) {
        this(types, scopeMapping, null);
    }

    private EntityBuilder(ResourceTypes types, ScopeMapping scopeMapping, String credentialType) {
        this.types = Objects.requireNonNull(types, "types");
        this.scopeMapping = Objects.requireNonNull(scopeMapping, "scopeMapping");
        this.credentialType = credentialType;
    }

    /** @return the resource types this builder knows */
    public ResourceTypes resourceTypes() {
        return types;
    }

    /**
     * @param type type of the credential used for the call (CC-136): {@code user-oauth}, {@code user-secret},
     *        {@code token-exchange} or {@code service-account}; it becomes {@code context.credentialType}
     * @return a builder like this one that puts the credential type into the context of every request; the builder
     *         itself stays unchanged (the gateway builds a request per call, with the type from its configuration)
     * @throws EntityBuilderException for any other value
     */
    public EntityBuilder withCredentialType(String type) {
        if (type == null || !CREDENTIAL_TYPES.contains(type)) {
            throw new EntityBuilderException(Code.INTERNAL_ERROR, "unknown credentialType " + type);
        }
        return new EntityBuilder(types, scopeMapping, type);
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
        attrs.put("requiredGroup", uid("UserGroup", tool.requiredGroup()));
        entities.add(new Entity(resource, attrs, Set.of()));
        return result(caller, uid("Action", "call"), resource, context, entities);
    }

    /**
     * Server evaluation: {@code <Namespace>::Action::"<tool action>"} on the resolved resource, where the namespace is
     * that of the resource type. Also used for every element a search or list tool returns (see {@link ResultFilter}).
     *
     * @param caller the calling user (from the internal JWT)
     * @param tool the server's own manifest entry of the tool
     * @param arguments arguments of the call, as for {@link #forToolCall}
     * @param resource the resolved resource, with its parent where the type declares one
     * @return request and entities
     * @throws EntityBuilderException when a resource argument is not an identifier or the resource does not match its
     *         declaration
     */
    public CedarRequest forResource(Caller caller, ToolDescriptor tool, Map<String, ?> arguments, ResolvedResource resource) {
        Map<String, Value> context = context(caller, tool, arguments);
        List<Entity> entities = principalEntities(caller);
        Objects.requireNonNull(resource, "resource");
        ResourceTypeDeclaration declaration = declaration(resource.type());
        Optional<ResolvedResource> ancestor = resource.parent();
        while (ancestor.isPresent()) {
            entities.add(resourceEntity(ancestor.get(), ancestor.get().parent()));
            ancestor = ancestor.get().parent();
        }
        entities.add(resourceEntity(resource, resource.parent()));
        return result(caller, uid(declaration.namespace() + "::Action", tool.action()), uid(resource.type(), resource.id()),
                context, entities);
    }

    /**
     * What a search or list query must be limited to for one grantable resource type (CC-036): the ids granted to
     * the user by the scope mapping. The server adds them to the backend query where the backend does not enforce the
     * user's own rights. The query limit does not replace result filtering.
     *
     * @param resourceType a declared type that has a {@code scopePattern}
     */
    public QueryConstraint queryConstraint(Caller caller, String resourceType) {
        if (!types.isGrantable(resourceType)) {
            throw new EntityBuilderException(Code.INTERNAL_ERROR, "not a grantable resource type: " + resourceType);
        }
        TreeSet<String> granted = new TreeSet<>();
        for (String group : mcpGroups(caller)) {
            for (String scope : scopeMapping.scopesOf(group)) {
                if (resourceType.equals(types.scopeType(scope).orElse(""))) {
                    granted.add(ResourceTypes.localId(scope));
                }
            }
        }
        return new QueryConstraint(resourceType, granted);
    }

    private ResourceTypeDeclaration declaration(String type) {
        return types.declaration(type).orElseThrow(() ->
                new EntityBuilderException(Code.INTERNAL_ERROR, "unknown resource type " + type));
    }

    private static CedarRequest result(Caller caller, EntityUID action, EntityUID resource, Map<String, Value> context,
            List<Entity> entities) {
        entities.sort(BY_TYPE_THEN_ID);
        return new CedarRequest(uid("User", caller.sub()), action, resource, context, new LinkedHashSet<>(entities));
    }

    private Map<String, Value> context(Caller caller, ToolDescriptor tool, Map<String, ?> arguments) {
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
        if (credentialType != null) {
            context.put("credentialType", new PrimString(credentialType));
        }
        if (caller.mfaAgeSeconds().isPresent() && caller.mfaAgeSeconds().getAsLong() < 0) {
            throw invalid("mfa age must be >= 0");
        }
        caller.mfaAgeSeconds().ifPresent(age -> context.put("mfaAge", new PrimLong(age)));
        List<String> refScopes = new ArrayList<>();
        for (Map.Entry<String, String> value : resourceValues(tool, arguments)) {
            if (types.isEarlyScopeCheck(value.getKey())) {
                refScopes.add(Scopes.id(value.getKey(), value.getValue()));
            }
        }
        context.put("refs", scopeSet(refScopes));
        return context;
    }

    /**
     * Every value of every resourceRef argument as (type, id), in argument order, validated against the declared
     * {@code idPattern} like {@code context.refs}.
     *
     * @throws EntityBuilderException {@code INVALID_ARGUMENT} for a value that is not a valid id, {@code INTERNAL_ERROR}
     *         for a type no server declared
     */
    List<Map.Entry<String, String>> resourceValues(ToolDescriptor tool, Map<String, ?> arguments) {
        List<Map.Entry<String, String>> values = new ArrayList<>();
        for (ResourceRef ref : tool.resourceRefs()) {
            declaration(ref.type());
            for (String id : argumentIds(ref.argument(), arguments.get(ref.argument()))) {
                if (!types.isValidId(ref.type(), id)) {
                    throw invalid(ref.argument() + ": not a valid " + ref.type() + " id");
                }
                values.add(Map.entry(ref.type(), id));
            }
        }
        return values;
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
        List<Entity> entities = new ArrayList<>();
        Set<EntityUID> userParents = new LinkedHashSet<>();
        Set<String> userScopes = new TreeSet<>();
        for (String group : groups) {
            SortedSet<String> scopes = scopeMapping.scopesOf(group);
            Set<EntityUID> groupParents = new LinkedHashSet<>();
            for (String scope : scopes) {
                groupParents.add(uid("ResourceScope", scope));
                userScopes.add(scope);
            }
            EntityUID groupUid = uid("UserGroup", group);
            userParents.add(groupUid);
            entities.add(new Entity(groupUid, Map.of(), groupParents));
        }
        Map<String, Value> attrs = new LinkedHashMap<>();
        attrs.put("username", new PrimString(caller.username()));
        attrs.put("client", new PrimString(caller.client()));
        attrs.put("scopes", scopeSet(userScopes));
        caller.mfaAgeSeconds().ifPresent(age -> attrs.put("mfaAge", new PrimLong(age)));
        entities.add(new Entity(uid("User", caller.sub()), attrs, userParents));
        return entities;
    }

    private Entity resourceEntity(ResolvedResource resource, Optional<ResolvedResource> parent) {
        ResourceTypeDeclaration declaration = declaration(resource.type());
        if (!types.isValidId(resource.type(), resource.id())) {
            throw new EntityBuilderException(Code.INTERNAL_ERROR, "resolved " + resource.type() + " has an invalid id");
        }
        Map<String, Value> attrs = new TreeMap<>();
        Map<String, Object> input = new LinkedHashMap<>(resource.attributes());
        declaration.classification().ifPresent(c -> normalizeClassification(resource.type(), c, input));
        for (Map.Entry<String, Object> attribute : input.entrySet()) {
            if (!declaration.attributes().contains(attribute.getKey())) {
                throw new EntityBuilderException(Code.INTERNAL_ERROR,
                        resource.type() + ": attribute " + attribute.getKey() + " is not declared");
            }
            attrs.put(attribute.getKey(), toValue(resource.type() + "." + attribute.getKey(), attribute.getValue()));
        }
        Set<EntityUID> parents = Set.of();
        if (declaration.parent().isPresent()) {
            ResolvedResource p = parent.orElseThrow(() -> new EntityBuilderException(Code.INTERNAL_ERROR,
                    resource.type() + " needs its parent"));
            if (!p.type().equals(declaration.parent().get())) {
                throw new EntityBuilderException(Code.INTERNAL_ERROR,
                        resource.type() + " needs a parent of type " + declaration.parent().get());
            }
            attrs.put(declaration.parentAttribute().get(), uid(p.type(), p.id()));
            parents = Set.of(uid(p.type(), p.id()));
        } else if (parent.isPresent()) {
            throw new EntityBuilderException(Code.INTERNAL_ERROR, resource.type() + " declares no parent");
        }
        for (String scope : resource.scopes()) {
            if (types.scopeType(scope).isEmpty()) {
                throw new EntityBuilderException(Code.INTERNAL_ERROR, resource.type() + ": invalid scope id " + scope);
            }
        }
        attrs.put("scopes", scopeSet(resource.scopes()));
        return new Entity(uid(resource.type(), resource.id()), attrs, parents);
    }

    /** Trim (as {@link String#trim()}) and lower-case ASCII letters only, so Java and JavaScript agree exactly. */
    static String normalizeClassification(String value) {
        String trimmed = value.trim();
        StringBuilder out = new StringBuilder(trimmed.length());
        for (int i = 0; i < trimmed.length(); i++) {
            char c = trimmed.charAt(i);
            out.append(c >= 'A' && c <= 'Z' ? (char) (c + ('a' - 'A')) : c);
        }
        return out.toString();
    }

    /**
     * Normalizes the declared classification attribute in place (CC-067) and refuses a resource whose required
     * classification is missing or has the wrong shape (CC-062): without it a rule on "restricted" could not match.
     */
    private static void normalizeClassification(String type, Classification classification, Map<String, Object> attributes) {
        String name = classification.attribute();
        Object value = attributes.get(name);
        if (value == null) {
            if (classification.required()) {
                throw new EntityBuilderException(Code.INTERNAL_ERROR, type + " without " + name);
            }
            return;
        }
        if (classification.kind() == Kind.STRING) {
            if (!(value instanceof CharSequence text)) {
                throw new EntityBuilderException(Code.INTERNAL_ERROR, type + "." + name + " must be a string");
            }
            attributes.put(name, normalizeClassification(text.toString()));
            return;
        }
        if (!(value instanceof Collection<?> values)) {
            throw new EntityBuilderException(Code.INTERNAL_ERROR, type + "." + name + " must be a list of strings");
        }
        TreeSet<String> normalized = new TreeSet<>();
        for (Object element : values) {
            if (!(element instanceof CharSequence text)) {
                throw new EntityBuilderException(Code.INTERNAL_ERROR, type + "." + name + " must be a list of strings");
            }
            normalized.add(normalizeClassification(text.toString()));
        }
        attributes.put(name, new ArrayList<>(normalized));
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
