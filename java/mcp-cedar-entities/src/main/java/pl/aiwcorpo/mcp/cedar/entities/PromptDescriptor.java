package pl.aiwcorpo.mcp.cedar.entities;

import java.util.Objects;
import java.util.Optional;

/**
 * Approved registry entry of a prompt (C5, C6, CC-258), as the gateway evaluates {@code Action::"get_prompt"} on
 * {@code McpPrompt}.
 *
 * @param serverId {@code mcp-<system>}
 * @param system system id
 * @param name server-side prompt name
 * @param additionalGroup optional group of the manifest entry, it narrows access
 */
public record PromptDescriptor(String serverId, String system, String name, Optional<String> additionalGroup) {

    public PromptDescriptor {
        Objects.requireNonNull(serverId, "serverId");
        Objects.requireNonNull(system, "system");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(additionalGroup, "additionalGroup");
        additionalGroup.ifPresent(group -> AdditionalGroups.check(system, group));
    }

    /** Prompt without an additional group. */
    public PromptDescriptor(String serverId, String system, String name) {
        this(serverId, system, name, Optional.empty());
    }

    /** @return a copy with the additional group of the manifest entry */
    public PromptDescriptor withAdditionalGroup(String group) {
        return new PromptDescriptor(serverId, system, name, Optional.of(group));
    }

    /** @return {@code mcp-<system>-read}, the value of {@code McpPrompt.requiredGroup} (C9) */
    public String requiredGroup() {
        return "mcp-" + system + "-read";
    }

    /** @return client-visible name {@code <system>__<name>}, also the id of the Cedar {@code McpPrompt} entity */
    public String qualifiedName() {
        return system + "__" + name;
    }
}
