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
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
        own.path("actions").fieldNames().forEachRemaining(action -> {
            if (!SERVER_ACTIONS.contains(action)) {
                errors.add("action not allowed in a fragment: " + action);
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
        errors.addAll(forbiddenReferences(policies));
        errors.addAll(validatePolicies(new Schema(composeSchemaText(fragmentSchema)), policies));
        return new Result(errors);
    }

    /**
     * Rules for an emergency override (C5): exactly one policy, {@code forbid} only, no template, validates against the
     * base schema and, when the override targets a server, against the composed schema of its fragment.
     *
     * @param id the override id; becomes the policy id, a different {@code @id} in the text is an error
     * @param text Cedar text of the override
     * @param targetFragmentSchema fragment schema of the target server, empty for a target of {@code gateway} or
     *        {@code all-servers}
     */
    public static Result validateOverride(String id, String text, Optional<String> targetFragmentSchema) {
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
        try {
            if (policy.effect() != Effect.FORBID) {
                errors.add("an override is forbid only");
            }
            String declared = policy.getAnnotation("id");
            if (declared != null && !declared.equals(id)) {
                errors.add("@id " + declared + " differs from the override id " + id);
            }
        } catch (InternalException e) {
            return new Result(List.of("the override cannot be read: " + e.getMessage()));
        }
        Schema schema = targetFragmentSchema.map(PolicyFragments::composeSchema).orElseGet(McpCedarSchema::schema);
        errors.addAll(validatePolicies(schema, new PolicySet(Set.of(new Policy(policy.policySrc, id)))));
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
