package pl.aiwcorpo.mcp.cedar.entities;

import com.cedarpolicy.BasicAuthorizationEngine;
import com.cedarpolicy.model.Effect;
import com.cedarpolicy.model.ValidationRequest;
import com.cedarpolicy.model.ValidationResponse;
import com.cedarpolicy.model.exception.InternalException;
import com.cedarpolicy.model.policy.Policy;
import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Composition and validation of the policy fragment of a server (C6, C7). The gateway calls it at registration, the
 * starter at build and at start, so both reject the same fragments.
 *
 * <p>The fragment schema is appended to the base schema text ({@code cedar/mcp.cedarschema}, empty namespace). Inside its
 * namespace the fragment names base types ({@code User}, {@code ResourceScope}, {@code RequestContext}) without
 * qualification; cedar-java 4.10.0 resolves them (checked by {@code PolicyFragmentsTest}).
 */
public final class PolicyFragments {

    /** Actions a fragment may declare; {@code call} belongs to the gateway. */
    static final Set<String> SERVER_ACTIONS = Set.of("read", "update", "delete", "admin");

    /** Prefix of the ids of the platform policies; a server policy may not use it. */
    public static final String PLATFORM_ID_PREFIX = "platform-";
    /** Prefix of the ids of emergency overrides; a server policy may not use it. */
    public static final String OVERRIDE_ID_PREFIX = "override-";
    private static final Pattern OVERRIDE_ID = Pattern.compile("^override-[a-z0-9][a-z0-9-]{0,54}$");

    private static final Pattern NAMESPACE = Pattern.compile("^[A-Z][A-Za-z0-9]{0,30}$");
    private static final ObjectMapper JSON = new ObjectMapper();

    private PolicyFragments() {
    }

    /** Outcome of a validation; {@code errors} is empty when the input is acceptable. */
    public record Result(List<String> errors) {

        public Result {
            errors = List.copyOf(errors);
        }

        /** @return true when there is no error */
        public boolean ok() {
            return errors.isEmpty();
        }
    }

    /**
     * Joins policy sets (platform, generated platform server policies, fragment, overrides) into the set that is evaluated.
     * Two policies with the same id are an error, never a merge: an override with the id of a platform policy would replace it.
     *
     * @throws IllegalArgumentException on a duplicate id; the caller must refuse to evaluate (deny)
     */
    public static PolicySet merge(PolicySet... sets) {
        Set<Policy> all = new LinkedHashSet<>();
        Set<String> ids = new HashSet<>();
        for (PolicySet set : sets) {
            if (!set.templates.isEmpty()) {
                throw new IllegalArgumentException("templates are not used by the platform");
            }
            for (Policy policy : set.policies) {
                if (!ids.add(policy.policyID)) {
                    throw new IllegalArgumentException("duplicate policy id " + policy.policyID);
                }
                all.add(policy);
            }
        }
        return new PolicySet(all);
    }

    /** @return base schema text followed by the fragment text: the schema both sides validate against */
    public static String composeSchemaText(String fragmentSchema) {
        return McpCedarSchema.text() + "\n" + fragmentSchema;
    }

    /** @return the composed schema as a cedar-java object, for requests built by {@link EntityBuilder} */
    public static Schema composeSchema(String fragmentSchema) {
        return new Schema(composeSchemaText(fragmentSchema));
    }

    /**
     * Policy set of named files; the policy id is the {@code @id} annotation.
     *
     * @throws IllegalArgumentException for a file that does not parse, a policy without {@code @id}, a duplicate
     *         {@code @id} or a template
     */
    public static PolicySet policySet(Map<String, String> filesByName) {
        Set<Policy> policies = new LinkedHashSet<>();
        Set<String> seen = new HashSet<>();
        try {
            for (Map.Entry<String, String> file : filesByName.entrySet()) {
                PolicySet parsed = PolicySet.parsePolicies(file.getValue());
                if (!parsed.templates.isEmpty()) {
                    throw new IllegalArgumentException(file.getKey() + ": templates are not used by the platform");
                }
                for (Policy policy : parsed.policies) {
                    String id = policy.getAnnotation("id");
                    if (id == null || id.isBlank()) {
                        throw new IllegalArgumentException(file.getKey() + ": policy without @id");
                    }
                    if (!seen.add(id)) {
                        throw new IllegalArgumentException(file.getKey() + ": duplicate @id " + id);
                    }
                    policies.add(new Policy(policy.policySrc, id));
                }
            }
        } catch (InternalException e) {
            throw new IllegalArgumentException("policies do not parse: " + e.getMessage(), e);
        }
        return new PolicySet(policies);
    }

    /**
     * Rules for the fragment of a server: exactly one namespace and nothing outside it; every entity type has
     * {@code scopes: Set<ResourceScope>}; only the actions {@code read}, {@code update}, {@code delete}, {@code admin};
     * the composed schema and the policies validate in strict mode, also without "impossible policy" warnings; no policy
     * mentions {@code Action::"call"} or {@code Tool}; and, when {@code types} is given, the entity types of the
     * fragment are exactly the declared types of the namespace with the declared attributes and parents.
     *
     * @param namespace the namespace the manifest names in {@code policies.namespace}
     * @param fragmentSchema text of {@code schema.cedarschema}
     * @param policyFiles name to text of the {@code *.cedar} files
     * @param types declarations of the server, or null to skip the comparison
     */
    public static Result validateFragment(String namespace, String fragmentSchema, Map<String, String> policyFiles,
            ResourceTypes types) {
        List<String> errors = new ArrayList<>();
        if (!NAMESPACE.matcher(namespace).matches()) {
            return new Result(List.of("namespace is not valid: " + namespace));
        }
        JsonNode base;
        JsonNode composed;
        try {
            // The fragment alone does not resolve (its types are in the base), so the rules are read from the composition.
            base = Schema.parse(Schema.JsonOrCedar.Cedar, McpCedarSchema.text()).toJsonFormat();
            composed = Schema.parse(Schema.JsonOrCedar.Cedar, composeSchemaText(fragmentSchema)).toJsonFormat();
        } catch (Exception e) {
            return new Result(List.of("schema does not parse: " + e.getMessage()));
        }
        List<String> found = new ArrayList<>();
        composed.fieldNames().forEachRemaining(found::add);
        found.remove("");
        if (!found.equals(List.of(namespace)) || !composed.get("").equals(base.get(""))) {
            return new Result(List.of("the fragment must declare exactly the namespace " + namespace
                    + " and nothing outside it (found " + found + (composed.get("").equals(base.get("")) ? "" : " and declarations in the empty namespace") + ")"));
        }
        JsonNode own = composed.get(namespace);
        checkScopes(own, errors);
        own.path("actions").fields().forEachRemaining(entry -> {
            String action = entry.getKey();
            if (!SERVER_ACTIONS.contains(action)) {
                errors.add("action not allowed in a fragment: " + action);
            }
            JsonNode appliesTo = entry.getValue().path("appliesTo");
            // A foreign principal or context type would let the fragment read attributes that the platform does not give.
            List<String> principals = new ArrayList<>();
            appliesTo.path("principalTypes").forEach(t -> principals.add(t.asText()));
            if (!principals.equals(List.of("User"))) {
                errors.add("action " + action + " must apply to principal [User]");
            }
            JsonNode context = appliesTo.path("context");
            if (!"RequestContext".equals(context.path("type").asText()) || context.has("attributes")) {
                errors.add("action " + action + " must use context RequestContext");
            }
        });
        if (types != null) {
            checkDeclarations(namespace, own, types, errors);
        }
        PolicySet policies;
        try {
            policies = policySet(policyFiles);
        } catch (IllegalArgumentException e) {
            errors.add(e.getMessage());
            return new Result(errors);
        }
        for (Policy policy : policies.policies) {
            if (policy.policyID.startsWith(PLATFORM_ID_PREFIX) || policy.policyID.startsWith(OVERRIDE_ID_PREFIX)) {
                errors.add("policy id " + policy.policyID + " uses a prefix reserved for the platform or for overrides");
            }
        }
        errors.addAll(forbiddenReferences(policies));
        errors.addAll(validatePolicies(new Schema(composeSchemaText(fragmentSchema)), policies));
        return new Result(errors);
    }

    /** Where an emergency override applies. */
    public enum OverrideTarget {
        /** The decision on {@code call}: the policy must be {@code action == Action::"call"} on {@code resource is Tool}. */
        GATEWAY,
        /** One server: validated against the base schema and the fragment of that server; no {@code Tool}, no {@code call}. */
        SERVER,
        /** Every server: validated against the fragment of each registered server; no {@code Tool}, no {@code call}. */
        ALL_SERVERS
    }

    /**
     * Rules for an emergency override (C5): id {@code override-<name>}; exactly one policy, {@code forbid} only, no template,
     * an {@code @id} in the text equal to the id. A {@code GATEWAY} override must name {@code Action::"call"} and
     * {@code resource is Tool}, so it cannot be a policy that blocks nothing. A server override validates against the base
     * schema composed with the fragment (every fragment, for {@code ALL_SERVERS}) and may not mention {@code Tool} or
     * {@code call}, which are decided by the gateway.
     *
     * @param id the override id; becomes the policy id
     * @param text Cedar text of the override
     * @param target where it applies
     * @param fragmentSchemas for {@code SERVER} the fragment schema of the target server, for {@code ALL_SERVERS} the
     *        fragment schemas of all registered servers; ignored for {@code GATEWAY}
     */
    public static Result validateOverride(String id, String text, OverrideTarget target, Collection<String> fragmentSchemas) {
        if (!OVERRIDE_ID.matcher(id).matches()) {
            return new Result(List.of("an override id is override-<name> (lower case letters, digits and hyphens)"));
        }
        PolicySet policies;
        try {
            policies = PolicySet.parsePolicies(text);
        } catch (InternalException e) {
            return new Result(List.of("the override does not parse: " + e.getMessage()));
        }
        if (!policies.templates.isEmpty() || policies.policies.size() != 1) {
            return new Result(List.of("an override holds exactly one policy and no template"));
        }
        List<String> errors = new ArrayList<>();
        Policy policy = policies.policies.iterator().next();
        PolicySet named = new PolicySet(Set.of(new Policy(policy.policySrc, id)));
        try {
            if (policy.effect() != Effect.FORBID) {
                errors.add("an override is forbid only");
            }
            String declared = policy.getAnnotation("id");
            if (declared != null && !declared.equals(id)) {
                errors.add("@id " + declared + " differs from the override id " + id);
            }
            JsonNode est = JSON.readTree(policy.toJson());
            if (target == OverrideTarget.GATEWAY) {
                boolean isCall = "Action".equals(est.path("action").path("entity").path("type").asText())
                        && "call".equals(est.path("action").path("entity").path("id").asText())
                        && "==".equals(est.path("action").path("op").asText());
                boolean onTool = "is".equals(est.path("resource").path("op").asText())
                        && "Tool".equals(est.path("resource").path("entity_type").asText());
                if (!isCall || !onTool) {
                    errors.add("a gateway override must be action == Action::\"call\" on resource is Tool");
                }
            } else if (mentionsGatewayOnly(est)) {
                errors.add("a server override may not mention Action::\"call\" or Tool");
            }
        } catch (Exception e) {
            return new Result(List.of("the override cannot be read: " + e.getMessage()));
        }
        if (target == OverrideTarget.GATEWAY || fragmentSchemas.isEmpty()) {
            errors.addAll(validatePolicies(McpCedarSchema.schema(), named));
        } else {
            for (String fragment : fragmentSchemas) {
                errors.addAll(validatePolicies(composeSchema(fragment), named));
            }
        }
        return new Result(errors);
    }

    private static List<String> validatePolicies(Schema schema, PolicySet policies) {
        List<String> errors = new ArrayList<>();
        ValidationResponse response;
        try {
            response = new BasicAuthorizationEngine().validate(new ValidationRequest(schema, policies));
        } catch (Exception e) {
            return List.of("validation failed: " + e.getMessage());
        }
        if (response.success.isEmpty()) {
            return List.of("validation failed: " + response.errors.map(Object::toString).orElse(response.toString()));
        }
        response.success.get().validationErrors.forEach(e -> errors.add("policy " + e.getPolicyId() + ": " + e.getError().message));
        // A policy that never matches is a silent fail-open when it is a forbid; Cedar reports it only as a warning.
        response.success.get().validationWarnings.forEach(w -> {
            if (w.getError().message.contains("impossible")) {
                errors.add("policy " + w.getPolicyId() + " is impossible (never matches)");
            }
        });
        return errors;
    }

    private static void checkScopes(JsonNode namespaceSchema, List<String> errors) {
        namespaceSchema.path("entityTypes").fields().forEachRemaining(entry -> {
            JsonNode scopes = entry.getValue().path("shape").path("attributes").path("scopes");
            boolean ok = scopes.path("type").asText().equals("Set")
                    && "ResourceScope".equals(scopes.path("element").path("name").asText())
                    && scopes.path("required").asBoolean(true);
            if (!ok) {
                errors.add("entity type " + entry.getKey() + " needs the attribute scopes: Set<ResourceScope>");
            }
        });
    }

    private static void checkDeclarations(String namespace, JsonNode own, ResourceTypes types, List<String> errors) {
        Set<String> declaredLocal = new HashSet<>();
        for (ResourceTypeDeclaration d : types.declarations()) {
            if (!d.namespace().equals(namespace)) {
                continue;
            }
            String local = d.type().substring(namespace.length() + 2);
            declaredLocal.add(local);
            JsonNode entity = own.path("entityTypes").path(local);
            if (entity.isMissingNode()) {
                errors.add("declared type " + d.type() + " is not an entity type of the fragment");
                continue;
            }
            JsonNode attributes = entity.path("shape").path("attributes");
            Set<String> allowed = new HashSet<>(d.attributes());
            allowed.add("scopes");
            d.attributes().forEach(a -> {
                if (attributes.path(a).isMissingNode()) {
                    errors.add(d.type() + ": declared attribute " + a + " is missing in the schema");
                }
            });
            d.parentAttribute().ifPresent(pa -> {
                allowed.add(pa);
                String parentLocal = d.parent().get().substring(namespace.length() + 2);
                String name = attributes.path(pa).path("name").asText();
                if (!name.equals(parentLocal) && !name.equals(d.parent().get())) {
                    errors.add(d.type() + ": attribute " + pa + " must be of type " + parentLocal);
                }
                boolean member = false;
                for (JsonNode m : entity.path("memberOfTypes")) {
                    member |= m.asText().equals(parentLocal) || m.asText().equals(d.parent().get());
                }
                if (!member) {
                    errors.add(d.type() + ": must be in [" + parentLocal + "]");
                }
            });
            attributes.fields().forEachRemaining(a -> {
                if (!allowed.contains(a.getKey()) && a.getValue().path("required").asBoolean(true)) {
                    errors.add(d.type() + ": required attribute " + a.getKey() + " is not declared in the manifest");
                }
            });
        }
        own.path("entityTypes").fieldNames().forEachRemaining(local -> {
            if (!declaredLocal.contains(local)) {
                errors.add("entity type " + local + " has no declaration in resourceTypes");
            }
        });
    }

    private static List<String> forbiddenReferences(PolicySet policies) {
        List<String> errors = new ArrayList<>();
        for (Policy policy : policies.policies) {
            try {
                if (mentionsGatewayOnly(JSON.readTree(policy.toJson()))) {
                    errors.add("policy " + policy.policyID + " mentions Action::\"call\" or Tool: those belong to the gateway");
                }
            } catch (Exception e) {
                errors.add("policy " + policy.policyID + " cannot be read: " + e.getMessage());
            }
        }
        return errors;
    }

    private static boolean mentionsGatewayOnly(JsonNode node) {
        if (node.isObject()) {
            if ("Action".equals(node.path("type").asText()) && "call".equals(node.path("id").asText())) {
                return true;
            }
            if ("Tool".equals(node.path("entity_type").asText()) || "Tool".equals(node.path("type").asText())) {
                return true;
            }
        }
        for (JsonNode child : node) {
            if (mentionsGatewayOnly(child)) {
                return true;
            }
        }
        return false;
    }
}
