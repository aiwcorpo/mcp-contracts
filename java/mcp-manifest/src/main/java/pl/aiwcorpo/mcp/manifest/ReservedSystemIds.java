package pl.aiwcorpo.mcp.manifest;

import java.util.Set;

/**
 * System ids that no server may use. {@code mcp-<system>} is the CN of the certificate of a server, and the CNs
 * {@code mcp-gateway}, {@code mcp-offboarding}, {@code mcp-portal-bff} and the like belong to platform components, so a
 * server named after one of them would inherit the authorization of that component. The same list is in the pattern of
 * {@code SystemId}, {@code ServerId} and {@code QualifiedToolName} in {@code schemas/common.schema.json}; a test keeps
 * them equal. The gateway answers {@code server_rejected} with the reason {@code system_reserved} for such a server.
 */
public final class ReservedSystemIds {

    /** The reserved ids. */
    public static final Set<String> IDS = Set.of(
            "gateway", "offboarding", "portal", "broker", "prometheus", "platform", "admin", "registry", "adapter", "internal", "ci");

    private ReservedSystemIds() {
    }

    /** @return whether the system id is reserved */
    public static boolean isReserved(String system) {
        return IDS.contains(system);
    }
}
