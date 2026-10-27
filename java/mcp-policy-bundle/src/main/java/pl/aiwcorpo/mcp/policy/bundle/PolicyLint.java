package pl.aiwcorpo.mcp.policy.bundle;

import com.cedarpolicy.model.Effect;
import com.cedarpolicy.model.exception.InternalException;
import com.cedarpolicy.model.policy.Policy;
import com.cedarpolicy.model.policy.PolicySet;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Structural checks of policies that Cedar validation does not do, on the parsed policy (JSON form from the Cedar
 * parser), never on the text: a string literal or a comment cannot hide or fake anything.
 */
public final class PolicyLint {

    private static final ObjectMapper JSON = new ObjectMapper();

    private PolicyLint() {
    }

    /**
     * CC-041: {@code context.vsScopes} may only appear in forbid policies; in a permit a virtual server could add a
     * permission. Templates cannot be inspected and are reported too (the platform uses no templates).
     *
     * @return descriptions of violations, empty when the set is clean
     */
    public static List<String> vsScopesOutsideForbid(PolicySet policies) throws InternalException {
        List<String> violations = new ArrayList<>();
        for (Policy policy : policies.policies) {
            if (policy.effect() == Effect.PERMIT && readsContextAttribute(policy, "vsScopes")) {
                violations.add(describe(policy) + ": permit reads context.vsScopes");
            }
        }
        for (Policy template : policies.templates) {
            violations.add(describe(template) + ": template (not used by the platform)");
        }
        return violations;
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

    private static boolean readsContextAttribute(Policy policy, String attribute) throws InternalException {
        try {
            return containsAccess(JSON.readTree(policy.toJson()), attribute);
        } catch (IOException e) {
            throw new IllegalStateException("cedar-java returned invalid policy JSON", e);
        }
    }

    // Matches both `context.vsScopes` and `context has vsScopes` in the Cedar JSON policy format.
    private static boolean containsAccess(JsonNode node, String attribute) {
        if (node.isObject()) {
            for (String operator : List.of(".", "has")) {
                JsonNode access = node.get(operator);
                if (access != null && access.isObject() && attribute.equals(access.path("attr").asText())
                        && "context".equals(access.path("left").path("Var").asText())) {
                    return true;
                }
            }
        }
        for (JsonNode child : node) {
            if (containsAccess(child, attribute)) {
                return true;
            }
        }
        return false;
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
