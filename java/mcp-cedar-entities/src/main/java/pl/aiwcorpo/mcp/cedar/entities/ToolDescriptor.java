package pl.aiwcorpo.mcp.cedar.entities;

import java.util.List;
import java.util.Objects;

/**
 * Approved registry entry of a tool (C5, C6).
 *
 * @param serverId {@code mcp-<system>}
 * @param system system id, e.g. {@code jira}
 * @param name server-side tool name, e.g. {@code get_issue}
 * @param risk {@code READ_ONLY}, {@code UPDATE} or {@code DESTRUCTIVE}
 * @param action Cedar action evaluated on the server: {@code read}, {@code update}, {@code delete}, {@code admin}
 * @param resourceRefs arguments that carry resource ids
 */
public record ToolDescriptor(
        String serverId,
        String system,
        String name,
        String risk,
        String action,
        List<ResourceRef> resourceRefs) {

    public ToolDescriptor {
        Objects.requireNonNull(serverId, "serverId");
        Objects.requireNonNull(system, "system");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(risk, "risk");
        Objects.requireNonNull(action, "action");
        resourceRefs = List.copyOf(Objects.requireNonNull(resourceRefs, "resourceRefs"));
    }

    /**
     * @return the group a user needs to call the tool: {@code mcp-<system>-read} for READ_ONLY, {@code -write} for UPDATE and
     *         {@code -destructive} for DESTRUCTIVE (C9), the only place where a group name is derived; the value of
     *         {@code Tool.requiredGroup}
     * @throws EntityBuilderException {@code INTERNAL_ERROR} for another risk
     */
    public String requiredGroup() {
        return "mcp-" + system + "-" + switch (risk) {
            case "READ_ONLY" -> "read";
            case "UPDATE" -> "write";
            case "DESTRUCTIVE" -> "destructive";
            default -> throw new EntityBuilderException(EntityBuilderException.Code.INTERNAL_ERROR, "unknown risk " + risk);
        };
    }

    /** @return client-visible name {@code <system>__<name>}, also the id of the Cedar {@code Tool} entity */
    public String qualifiedName() {
        return system + "__" + name;
    }
}
