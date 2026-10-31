package pl.aiwcorpo.mcp.cedar.entities;

import java.util.List;
import java.util.Objects;
import java.util.OptionalLong;

/**
 * The calling user, with the claim names of the internal JWT (C2). The gateway fills it from the IdP token the
 * same way it fills C2: {@code username} = preferred_username, {@code client} = azp, {@code groups} = groups.
 *
 * @param sub user id, becomes {@code User::"<sub>"}
 * @param username C2 {@code usr}
 * @param groups C2 {@code grp}; groups without the {@code mcp-} prefix are ignored
 * @param client C2 {@code azp}
 * @param mfaAgeSeconds C2 {@code mfa}, absent means unknown
 */
public record Caller(
        String sub,
        String username,
        List<String> groups,
        String client,
        OptionalLong mfaAgeSeconds) {

    public Caller {
        Objects.requireNonNull(sub, "sub");
        Objects.requireNonNull(username, "username");
        groups = List.copyOf(Objects.requireNonNull(groups, "groups"));
        Objects.requireNonNull(client, "client");
        Objects.requireNonNull(mfaAgeSeconds, "mfaAgeSeconds");
    }

    /** Caller without known MFA age. */
    public static Caller of(String sub, String username, List<String> groups, String client) {
        return new Caller(sub, username, groups, client, OptionalLong.empty());
    }

    /** @return a copy with the given MFA age in seconds */
    public Caller withMfaAge(long seconds) {
        return new Caller(sub, username, groups, client, OptionalLong.of(seconds));
    }
}
