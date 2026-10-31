package pl.aiwcorpo.mcp.policy.bundle;

import com.cedarpolicy.model.Effect;
import com.cedarpolicy.model.exception.InternalException;
import com.cedarpolicy.model.policy.Policy;
import com.cedarpolicy.model.policy.PolicySet;
import java.util.ArrayList;
import java.util.List;

/**
 * Structural checks of policies that Cedar validation does not do, on the parsed policy, never on the text: a string
 * literal or a comment cannot hide or fake anything. Since 5.0.0 (CC-173) there is no check of the removed link
 * attributes: a policy that reads {@code context.vsScopes} or {@code context.virtualServer} fails the schema validation.
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
