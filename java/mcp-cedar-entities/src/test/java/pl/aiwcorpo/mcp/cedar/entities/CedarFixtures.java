package pl.aiwcorpo.mcp.cedar.entities;

import com.cedarpolicy.model.exception.InternalException;
import com.cedarpolicy.model.policy.Policy;
import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

final class CedarFixtures {

    private CedarFixtures() {
    }

    static Schema schema() {
        return new Schema(ContractFiles.read(ContractFiles.resolve("cedar/mcp.cedarschema")));
    }

    static PolicySet examplePolicies() {
        return withAnnotatedIds(ContractFiles.list("cedar/examples", ".cedar"));
    }

    /**
     * Cedar numbers policies policy0, policy1, ... per parse. Vectors name the determining policies by
     * their @id annotation, so the set is rebuilt with those ids; duplicates across files fail here.
     */
    static PolicySet withAnnotatedIds(Iterable<Path> files) {
        Set<Policy> policies = new HashSet<>();
        Map<String, Path> seen = new HashMap<>();
        for (Path file : files) {
            try {
                PolicySet parsed = PolicySet.parsePolicies(ContractFiles.read(file));
                for (Policy policy : parsed.policies) {
                    String id = policy.getAnnotation("id");
                    if (id == null || id.isBlank()) {
                        throw new IllegalStateException("policy without @id in " + file);
                    }
                    Path previous = seen.put(id, file);
                    if (previous != null) {
                        throw new IllegalStateException("duplicate @id " + id + " in " + file + " and " + previous);
                    }
                    policies.add(new Policy(policy.policySrc, id));
                }
            } catch (InternalException e) {
                throw new IllegalStateException("cannot parse " + file + ": " + e.getMessage(), e);
            }
        }
        return new PolicySet(policies);
    }
}
