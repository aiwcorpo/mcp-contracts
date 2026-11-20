package pl.aiwcorpo.mcp.cedar.entities;

import java.util.Set;

/** The one check of an {@code additionalGroup} of a manifest entry: {@code mcp-<system>-<suffix>}, a suffix that is no risk group. */
final class AdditionalGroups {

    private static final Set<String> RISK_SUFFIXES = Set.of("read", "write", "destructive");

    private AdditionalGroups() {
    }

    static void check(String system, String group) {
        String prefix = "mcp-" + system + "-";
        String suffix = group.startsWith(prefix) ? group.substring(prefix.length()) : "";
        if (!suffix.matches("[a-z][a-z0-9-]{0,30}") || RISK_SUFFIXES.contains(suffix)) {
            throw new EntityBuilderException(EntityBuilderException.Code.INTERNAL_ERROR,
                    "additionalGroup must be mcp-" + system + "-<suffix> with a suffix other than read, write and destructive");
        }
    }
}
