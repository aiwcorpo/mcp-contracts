/**
 * Reference receiver of MCP policy bundles (contract C7 with CC-008, CC-026, CC-028, CC-040, CC-041, CC-044,
 * CC-045).
 *
 * <p>A component fetches {@code latest.json}, the archive and the signature itself and hands the bytes to
 * {@link pl.aiwcorpo.mcp.policy.bundle.BundleVerifier}. A rejected bundle throws
 * {@link pl.aiwcorpo.mcp.policy.bundle.BundleRejectedException}; the component keeps the previously loaded bundle.
 * {@link pl.aiwcorpo.mcp.policy.bundle.PolicyLint} is also usable on its own in the policy pipeline (ws-09), see
 * {@link pl.aiwcorpo.mcp.policy.bundle.PolicyLintCli}.
 */
package pl.aiwcorpo.mcp.policy.bundle;
