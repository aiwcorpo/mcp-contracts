package pl.aiwcorpo.mcp.policy.bundle;

import com.cedarpolicy.model.entity.Entity;
import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import java.util.List;
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
 * @param schemaText schema.cedarschema (main only)
 * @param schema parsed schema (main only)
 * @param staticEntities entities/static.json (main only, empty for overrides)
 * @param scopeMapping group -> scopes from the static entities (main only, empty for overrides); give it to
 *        {@code new EntityBuilder(scopeMapping)}
 */
public record PolicyBundle(
        Channel channel,
        BundleManifest manifest,
        PolicySet policies,
        Optional<String> schemaText,
        Optional<Schema> schema,
        List<Entity> staticEntities,
        ScopeMapping scopeMapping) {

    public PolicyBundle {
        Objects.requireNonNull(channel, "channel");
        Objects.requireNonNull(manifest, "manifest");
        Objects.requireNonNull(policies, "policies");
        Objects.requireNonNull(schemaText, "schemaText");
        Objects.requireNonNull(schema, "schema");
        staticEntities = List.copyOf(Objects.requireNonNull(staticEntities, "staticEntities"));
        Objects.requireNonNull(scopeMapping, "scopeMapping");
    }

    /** @return revision from the manifest */
    public String revision() {
        return manifest.revision();
    }
}
