package pl.aiwcorpo.mcp.policy.bundle;

import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import java.util.Objects;
import java.util.Optional;
import pl.aiwcorpo.mcp.cedar.entities.ScopeMapping;

/**
 * A verified bundle ready for evaluation. For {@link Channel#OVERRIDES} there is no schema and no static entities:
 * evaluate overrides policies together with the main bundle, using the main bundle's schema and entities.
 *
 * @param channel distribution channel
 * @param manifest manifest.json
 * @param policies all policies of the bundle, ids from their {@code @id} annotation when present
 * @param schema parsed schema (main only); always the schema of this contracts version (CC-059)
 * @param scopeMapping group -> scopes from entities/static.json (main only, empty for overrides); give it to
 *        {@code new EntityBuilder(scopeMapping)}. The static entities are not exposed: the builder produces the
 *        UserGroup entities from this mapping, so nothing has to be merged (CC-059).
 */
public record PolicyBundle(
        Channel channel,
        BundleManifest manifest,
        PolicySet policies,
        Optional<Schema> schema,
        ScopeMapping scopeMapping) {

    public PolicyBundle {
        Objects.requireNonNull(channel, "channel");
        Objects.requireNonNull(manifest, "manifest");
        Objects.requireNonNull(policies, "policies");
        Objects.requireNonNull(schema, "schema");
        Objects.requireNonNull(scopeMapping, "scopeMapping");
    }

    /** @return revision from the manifest */
    public String revision() {
        return manifest.revision();
    }
}
