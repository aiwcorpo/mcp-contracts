package pl.aiwcorpo.mcp.cedar.entities;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Approved registry entry of a static resource or a resource template (C5, C6, CC-258), as the gateway evaluates
 * {@code Action::"read_resource"} on {@code McpResource}.
 *
 * @param serverId {@code mcp-<system>}
 * @param system system id
 * @param name server-side name of the resource or template, unique among both
 * @param uriTemplate the URI template, or the URI itself for a static resource
 * @param variables the variables of the template as (variable name, resource type), empty for a static resource; a type may
 *        be {@code valueOnly}
 * @param additionalGroup optional group of the manifest entry, it narrows access
 */
public record ResourceDescriptor(
        String serverId,
        String system,
        String name,
        String uriTemplate,
        List<ResourceRef> variables,
        Optional<String> additionalGroup) {

    public ResourceDescriptor {
        Objects.requireNonNull(serverId, "serverId");
        Objects.requireNonNull(system, "system");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(uriTemplate, "uriTemplate");
        variables = List.copyOf(Objects.requireNonNull(variables, "variables"));
        Objects.requireNonNull(additionalGroup, "additionalGroup");
        additionalGroup.ifPresent(group -> AdditionalGroups.check(system, group));
    }

    /** Resource without an additional group. */
    public ResourceDescriptor(String serverId, String system, String name, String uriTemplate, List<ResourceRef> variables) {
        this(serverId, system, name, uriTemplate, variables, Optional.empty());
    }

    /** @return a copy with the additional group of the manifest entry */
    public ResourceDescriptor withAdditionalGroup(String group) {
        return new ResourceDescriptor(serverId, system, name, uriTemplate, variables, Optional.of(group));
    }

    /** @return {@code mcp-<system>-read}, the value of {@code McpResource.requiredGroup} (C9) */
    public String requiredGroup() {
        return "mcp-" + system + "-read";
    }

    /** @return client-visible name {@code <system>__<name>}, also the id of the Cedar {@code McpResource} entity */
    public String qualifiedName() {
        return system + "__" + name;
    }
}
