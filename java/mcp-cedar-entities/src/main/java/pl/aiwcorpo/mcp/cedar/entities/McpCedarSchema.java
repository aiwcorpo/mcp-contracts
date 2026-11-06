package pl.aiwcorpo.mcp.cedar.entities;

import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The Cedar base schema and the platform policies of this contracts version (from the mcp-contracts jar). The base
 * schema names no system; it is composed with the fragment of a server ({@link PolicyFragments}).
 */
public final class McpCedarSchema {

    /** Classpath location inside the mcp-contracts jar. */
    public static final String RESOURCE = "/mcp-contracts/cedar/mcp.cedarschema";

    /** Directory of the platform policies inside the mcp-contracts jar. */
    public static final String PLATFORM_DIRECTORY = "/mcp-contracts/cedar/platform/";

    /** Files of {@code cedar/platform}; a test keeps this list equal to the directory. */
    public static final List<String> PLATFORM_POLICY_FILES = List.of("call-additional-group.cedar", "call-by-group.cedar", "call-write-outside-scope.cedar");

    private McpCedarSchema() {
    }

    /** @return base schema text in Cedar syntax */
    public static String text() {
        return read(RESOURCE);
    }

    /** @return the base schema as a cedar-java object (not yet parsed by the native library) */
    public static Schema schema() {
        return new Schema(text());
    }

    /** @return file name to text of the platform policies: the gateway decides {@code call} with these (and overrides) */
    public static Map<String, String> platformPolicyTexts() {
        Map<String, String> texts = new LinkedHashMap<>();
        PLATFORM_POLICY_FILES.forEach(name -> texts.put(name, read(PLATFORM_DIRECTORY + name)));
        return texts;
    }

    /** @return the platform policies as a policy set, each with its {@code @id} as policy id */
    public static PolicySet platformPolicies() {
        return PolicyFragments.policySet(platformPolicyTexts());
    }

    private static String read(String resource) {
        try (InputStream in = McpCedarSchema.class.getResourceAsStream(resource)) {
            if (in == null) {
                throw new IllegalStateException(resource + " not on the classpath; add pl.aiwcorpo.mcp:mcp-contracts");
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
