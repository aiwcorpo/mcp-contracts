package pl.aiwcorpo.mcp.cedar.entities;

import java.util.Objects;

/**
 * Manifest {@code resourceRefs} entry (C6): the top-level argument that carries ids of a resource type.
 *
 * @param argument argument name in the tool's inputSchema
 * @param type Cedar resource type, e.g. {@code Jira::Project}
 */
public record ResourceRef(String argument, String type) {

    public ResourceRef {
        Objects.requireNonNull(argument, "argument");
        Objects.requireNonNull(type, "type");
    }
}
