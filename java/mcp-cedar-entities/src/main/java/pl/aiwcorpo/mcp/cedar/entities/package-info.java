/**
 * Shared Cedar entity builder of the MCP platform (contracts C7 and C9, specification
 * {@code cedar/entity-builder.md} in mcp-contracts) and the validation of the policy fragments of servers.
 *
 * <p>The builder knows no system, server or resource type. Everything it knows about a resource type comes from the
 * {@code resourceTypes} declarations of the registered manifests ({@link pl.aiwcorpo.mcp.cedar.entities.ResourceTypes}),
 * and the scopes granted by groups from the administrator's mapping ({@link pl.aiwcorpo.mcp.cedar.entities.ScopeMapping}).
 * The gateway calls {@link pl.aiwcorpo.mcp.cedar.entities.EntityBuilder#forToolCall} to evaluate {@code Action::"call"} on a
 * {@code Tool}; an MCP server calls {@link pl.aiwcorpo.mcp.cedar.entities.EntityBuilder#forResource} after resolving a
 * resource. Both return a {@link pl.aiwcorpo.mcp.cedar.entities.CedarRequest} ready for cedar-java. Any
 * {@link pl.aiwcorpo.mcp.cedar.entities.EntityBuilderException} means the call must be denied.
 * {@link pl.aiwcorpo.mcp.cedar.entities.PolicyFragments} composes and validates the schema and the policies of a server.
 *
 * <p>Input records copy their collections and are immutable. {@link pl.aiwcorpo.mcp.cedar.entities.CedarRequest}
 * holds cedar-java objects ({@code Entity}, {@code CedarList}, {@code CedarMap}) that cedar-java itself keeps
 * mutable; the builder creates fresh instances for every call and callers must not modify them. The builder holds
 * only its {@link pl.aiwcorpo.mcp.cedar.entities.ResourceTypes} and
 * {@link pl.aiwcorpo.mcp.cedar.entities.ScopeMapping} and is thread-safe.
 *
 * <p>Compatibility: the public records are part of the API. Adding a component to a record or moving to another
 * major version of cedar-java changes signatures and is released as a new major version of this library.
 */
package pl.aiwcorpo.mcp.cedar.entities;
