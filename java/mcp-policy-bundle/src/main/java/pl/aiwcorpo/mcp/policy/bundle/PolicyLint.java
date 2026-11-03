package pl.aiwcorpo.mcp.policy.bundle;

import com.cedarpolicy.BasicAuthorizationEngine;
import com.cedarpolicy.model.Effect;
import com.cedarpolicy.model.ValidationRequest;
import com.cedarpolicy.model.ValidationResponse;
import com.cedarpolicy.model.exception.AuthException;
import com.cedarpolicy.model.exception.InternalException;
import com.cedarpolicy.model.policy.Policy;
import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import java.util.ArrayList;
import java.util.List;

/**
 * Structural checks of policies that Cedar validation does not do, on the parsed policy, never on the text: a string
 * literal or a comment cannot hide or fake anything. Since 5.0.0 (CC-173) there is no check of the removed link
 * attributes: a policy that reads {@code context.vsScopes} or {@code context.virtualServer} fails the schema validation.
 *
 * <p>{@link #impossible} is a gate for the policy pipeline (ws-09, CC-183) and is not part of {@link BundleVerifier}: a
 * receiver still accepts a bundle whose policy never matches.
 */
public final class PolicyLint {

    private PolicyLint() {
    }

    /** @return descriptions of templates; the platform uses none and a receiver rejects a bundle that has one */
    public static List<String> templates(PolicySet policies) throws InternalException {
        List<String> found = new ArrayList<>();
        for (Policy template : policies.templates) {
            found.add(describe(template) + ": template (not used by the platform)");
        }
        return found;
    }

    /**
     * Policies that Cedar validates but can never match ("policy is impossible" warnings of the validator): a {@code forbid}
     * that never matches is a silent fail-open, which a typo in a guard such as {@code context has mfaAge_typo && ...}
     * produces as easily as a removed attribute does.
     *
     * <p>Limit: Cedar warns only when the validator can prove the condition false for every request that fits the schema.
     * A condition like {@code (context has virtualServer) || principal has username} is not proven false, so no warning
     * is given; covering it would need a walk over the syntax tree that checks every {@code has} against the schema. A
     * {@code forbid ... unless { context has x }} with an absent attribute matches every request and is fail-closed, so it
     * is not reported either.
     *
     * @return one description per policy the validator calls impossible; empty when there is none
     * @throws IllegalStateException when the schema or a policy does not validate (no result, or validation errors)
     */
    public static List<String> impossible(Schema schema, PolicySet policies) throws AuthException {
        ValidationResponse response = new BasicAuthorizationEngine().validate(new ValidationRequest(schema, policies));
        List<String> found = new ArrayList<>();
        if (response.success.isEmpty()) {
            // No result means the schema or the policies did not validate at all; an empty list would read as "clean" (CC-203).
            throw new IllegalStateException("cannot lint, validation failed: " + response.errors.map(Object::toString).orElse(response.toString()));
        }
        if (!response.success.get().validationErrors.isEmpty()) {
            throw new IllegalStateException("cannot lint, a policy does not validate against the schema: "
                    + response.success.get().validationErrors.stream().map(e -> e.getPolicyId() + " " + e.getError().message).toList());
        }
        for (ValidationResponse.ValidationError warning : response.success.get().validationWarnings) {
            String message = warning.getError().message;
            if (message.contains("impossible")) {
                found.add(describeById(policies, warning.getPolicyId()) + ": policy is impossible (never matches)");
            }
        }
        return found;
    }

    private static String describeById(PolicySet policies, String policyId) {
        for (Policy policy : policies.policies) {
            if (policy.policyID.equals(policyId)) {
                return describe(policy);
            }
        }
        return policyId;
    }

    /** @return descriptions of policies and templates whose effect is permit */
    public static List<String> permits(PolicySet policies) throws InternalException {
        List<String> found = new ArrayList<>();
        for (Policy policy : policies.policies) {
            if (policy.effect() != Effect.FORBID) {
                found.add(describe(policy) + ": permit");
            }
        }
        for (Policy template : policies.templates) {
            if (template.effect() != Effect.FORBID) {
                found.add(describe(template) + ": permit template");
            }
        }
        return found;
    }

    private static String describe(Policy policy) {
        try {
            String id = policy.getAnnotation("id");
            return id != null ? "@id(\"" + id + "\")" : String.valueOf(policy.policyID);
        } catch (InternalException e) {
            return String.valueOf(policy.policyID);
        }
    }
}
