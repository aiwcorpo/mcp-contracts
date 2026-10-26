/**
 * Shared Cedar entity builder of the MCP platform (contracts C7 and C9, specification
 * {@code cedar/entity-builder.md} in mcp-contracts).
 *
 * <p>The gateway calls {@link pl.aiwcorpo.mcp.cedar.entities.EntityBuilder#forToolCall} to evaluate
 * {@code Action::"call"} on a {@code Tool}; an MCP server calls
 * {@link pl.aiwcorpo.mcp.cedar.entities.EntityBuilder#forResource} after resolving a resource. Both return a
 * {@link pl.aiwcorpo.mcp.cedar.entities.CedarRequest} ready for cedar-java. Any
 * {@link pl.aiwcorpo.mcp.cedar.entities.EntityBuilderException} means the call must be denied.
 *
 * <p>All types are immutable and the builder is stateless and thread-safe.
 */
package pl.aiwcorpo.mcp.cedar.entities;
