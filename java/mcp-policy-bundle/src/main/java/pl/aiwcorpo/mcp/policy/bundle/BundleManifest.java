package pl.aiwcorpo.mcp.policy.bundle;

/**
 * {@code manifest.json} of a bundle (schemas/policy-bundle-manifest.schema.json).
 *
 * @param revision bundle revision
 * @param gitSha full commit sha of mcp-policies
 * @param createdAt ISO 8601 UTC
 * @param schemaVersion mcp-contracts version of the schema the bundle was built for
 */
public record BundleManifest(String revision, String gitSha, String createdAt, String schemaVersion) {
}
