package pl.aiwcorpo.mcp.cedar.entities;

import com.cedarpolicy.model.policy.PolicySet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import pl.aiwcorpo.mcp.cedar.entities.ResourceTypeDeclaration.Classification;
import pl.aiwcorpo.mcp.cedar.entities.ResourceTypeDeclaration.Kind;

/**
 * The policies that the platform itself adds on every server, generated from the declarations so that a server fragment
 * cannot forget or weaken them. The starter always loads them next to the fragment; their ids start with {@code platform-}.
 *
 * <ul>
 *   <li><b>Restricted data.</b> For every type with a {@code classification}: a {@code forbid} on all actions when the
 *       attribute is {@code "restricted"} (a string that equals it, a set that contains it). A child type is forbidden also
 *       when an ancestor reached through the {@code parentAttribute} chain declares a classification and carries the value.</li>
 *   <li><b>Service account.</b> For every type: a {@code forbid} when {@code context.credentialType} is not a user credential
 *       ({@code user-oauth}, {@code user-secret}, {@code token-exchange}; a missing or unknown type counts as a service
 *       account, CC-164) and {@code principal in resource.scopes} does not hold, so a service account never reads outside the
 *       scopes of the user.</li>
 * </ul>
 *
 * Both are {@code forbid} only: they can remove access, never grant it.
 */
public final class PlatformServerPolicies {

    private static final String RESTRICTED = "restricted";
    private static final List<String> USER_CREDENTIALS = List.of("user-oauth", "user-secret", "token-exchange");

    private PlatformServerPolicies() {
    }

    /** @return policy id to Cedar text, in a stable order */
    public static Map<String, String> texts(ResourceTypes types) {
        Map<String, String> out = new LinkedHashMap<>();
        for (ResourceTypeDeclaration d : types.declarations()) {
            String ns = d.namespace().toLowerCase(Locale.ROOT);
            String local = d.type().substring(d.type().indexOf("::") + 2).toLowerCase(Locale.ROOT);
            d.classification().ifPresent(c -> out.put("platform-" + ns + "-restricted-" + local,
                    restricted("platform-" + ns + "-restricted-" + local, d.type(), "resource", c)));
            String path = "resource";
            ResourceTypeDeclaration at = d;
            while (at.parent().isPresent()) {
                path = path + "." + at.parentAttribute().get();
                at = types.declaration(at.parent().get()).orElseThrow();
                ResourceTypeDeclaration ancestor = at;
                String via = path;
                ancestor.classification().ifPresent(c -> {
                    String id = "platform-" + ns + "-restricted-" + local + "-by-"
                            + ancestor.type().substring(ancestor.type().indexOf("::") + 2).toLowerCase(Locale.ROOT);
                    out.put(id, restricted(id, d.type(), via, c));
                });
            }
            String id = "platform-" + ns + "-" + local + "-service-account-outside-scope";
            out.put(id, "@id(\"" + id + "\")\nforbid (principal, action, resource is " + d.type() + ")\nwhen {\n"
                    + "  !(context has credentialType && " + userList() + ".contains(context.credentialType)) &&\n"
                    + "  !(principal in resource.scopes)\n};\n");
        }
        return out;
    }

    /** @return the policies as a set whose policy id is the {@code @id} */
    public static PolicySet policySet(ResourceTypes types) {
        return PolicyFragments.policySet(texts(types));
    }

    /** @return the ids of the generated policies */
    public static Set<String> ids(ResourceTypes types) {
        return texts(types).keySet();
    }

    private static String userList() {
        return USER_CREDENTIALS.stream().map(c -> "\"" + c + "\"").toList().toString();
    }

    private static String restricted(String id, String type, String path, Classification c) {
        String attribute = path + "." + c.attribute();
        String test = c.kind() == Kind.SET ? attribute + ".contains(\"" + RESTRICTED + "\")" : attribute + " == \"" + RESTRICTED + "\"";
        String condition = c.required() ? test : path + " has " + c.attribute() + " && " + test;
        return "@id(\"" + id + "\")\nforbid (principal, action, resource is " + type + ")\nwhen { " + condition + " };\n";
    }
}
