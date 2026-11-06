package pl.aiwcorpo.mcp.cedar.entities;

import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class CedarFixtures {

    private CedarFixtures() {
    }

    /** Base schema alone, or composed with the fragment schema file named by the vector ({@code schema}, may be null). */
    static Schema schema(JsonNode policies) {
        JsonNode fragment = policies.get("schema");
        return fragment == null || fragment.isNull()
                ? McpCedarSchema.schema()
                : PolicyFragments.composeSchema(ContractFiles.read(ContractFiles.resolve(fragment.asText())));
    }

    /** Policies of the vector's {@code policies.policies}: every {@code .cedar} file of each listed directory. */
    static PolicySet policies(JsonNode policies, ResourceTypes types) {
        List<String> directories = new ArrayList<>();
        policies.get("policies").forEach(d -> directories.add(d.asText()));
        PolicySet own = policySet(directories);
        if (!policies.path("platformServer").asBoolean(false)) {
            return own;
        }
        String namespace = policies.get("namespace").asText();
        ResourceTypes ofNamespace = ResourceTypes.of(types.declarations().stream().filter(d -> d.namespace().equals(namespace)).toList());
        return PolicyFragments.merge(own, PlatformServerPolicies.policySet(ofNamespace));
    }

    static PolicySet policySet(List<String> directories) {
        Map<String, String> texts = new LinkedHashMap<>();
        for (String directory : directories) {
            for (Path file : ContractFiles.list(directory, ".cedar")) {
                texts.put(directory + "/" + file.getFileName(), ContractFiles.read(file));
            }
        }
        return PolicyFragments.policySet(texts);
    }

    static boolean isDirectory(String relative) {
        return Files.isDirectory(ContractFiles.resolve(relative));
    }
}
