package pl.aiwcorpo.mcp.cedar.entities;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
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
 * @param principalType C2 {@code pty}: {@code user} (also when the token has none), {@code agent} or {@code delegated}; it becomes
 *        {@code context.principalType} (CC-263)
 * @param actor C2 {@code act.sub}, only with {@code delegated}; it becomes {@code context.actor}. The builder refuses an actor
 *        with another principal type.
 */
public record Caller(
        String sub,
        String username,
        List<String> groups,
        String client,
        OptionalLong mfaAgeSeconds,
        String principalType,
        Optional<String> actor) {

    public Caller {
        Objects.requireNonNull(sub, "sub");
        Objects.requireNonNull(username, "username");
        groups = List.copyOf(Objects.requireNonNull(groups, "groups"));
        Objects.requireNonNull(client, "client");
        Objects.requireNonNull(mfaAgeSeconds, "mfaAgeSeconds");
        Objects.requireNonNull(principalType, "principalType");
        Objects.requireNonNull(actor, "actor");
    }

    /** Caller with an MFA age that may be unknown and the principal type {@code user}. */
    public Caller(String sub, String username, List<String> groups, String client, OptionalLong mfaAgeSeconds) {
        this(sub, username, groups, client, mfaAgeSeconds, "user", Optional.empty());
    }

    /** Caller without known MFA age. */
    public static Caller of(String sub, String username, List<String> groups, String client) {
        return new Caller(sub, username, groups, client, OptionalLong.empty(), "user", Optional.empty());
    }

    /** @return a copy with the given MFA age in seconds */
    public Caller withMfaAge(long seconds) {
        return new Caller(sub, username, groups, client, OptionalLong.of(seconds), principalType, actor);
    }

    /** @return a copy with the principal type {@code user}, {@code agent} or {@code delegated} (C2 {@code pty}) */
    public Caller withPrincipalType(String type) {
        return new Caller(sub, username, groups, client, mfaAgeSeconds, type, actor);
    }

    /** @return a copy with the actor of a delegated token (C2 {@code act.sub}) */
    public Caller withActor(String actorSub) {
        return new Caller(sub, username, groups, client, mfaAgeSeconds, principalType, Optional.of(actorSub));
    }
}
