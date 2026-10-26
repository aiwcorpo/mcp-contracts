package pl.aiwcorpo.mcp.cedar.entities;

import com.cedarpolicy.model.schema.Schema;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;

/**
 * The Cedar schema of this contracts version ({@code cedar/mcp.cedarschema} from the mcp-contracts jar).
 * Policy bundles carry their own copy ({@code schema.cedarschema}); use that one for bundle evaluation and
 * this one for tests or to check that a bundle targets a compatible version.
 */
public final class McpCedarSchema {

    /** Classpath location inside the mcp-contracts jar. */
    public static final String RESOURCE = "/mcp-contracts/cedar/mcp.cedarschema";

    private McpCedarSchema() {
    }

    /** @return schema text in Cedar syntax */
    public static String text() {
        try (InputStream in = McpCedarSchema.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException(RESOURCE + " not on the classpath; add pl.aiwcorpo.mcp:mcp-contracts");
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** @return the schema as a cedar-java object (not yet parsed by the native library) */
    public static Schema schema() {
        return new Schema(text());
    }
}
