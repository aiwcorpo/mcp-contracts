package pl.aiwcorpo.mcp.manifest;

import java.util.Optional;
import java.util.OptionalLong;

/**
 * The rule that binds a server (7.0.0, push model of CC-249): it evaluates a {@code tools/call} only with policy data at least as new as
 * the revision {@code prv} of the token, and only for policies that the gateway approved. The server never fetches data: the gateway pushes it
 * ({@code POST /.well-known/mcp-policy-data}). A server that holds none, or holds an older revision than {@code prv}, answers
 * {@code 409 policy_data_stale} before it does anything else with the request, so that the gateway pushes and repeats the call once. Every other
 * refusal is the unavailable error of the server (C10 {@code upstream_unavailable}), never an evaluation with older data. The twin is
 * {@code scripts/lib/policy-data-gate.mjs}; the vectors in {@code test-vectors/policy-data-gate} keep them equal.
 */
public final class PolicyDataGate {

    private PolicyDataGate() {
    }

    /**
     * Policy data as the gateway pushed it.
     *
     * @param revision revision of the data (a counter that only increases)
     * @param approvedPoliciesHash {@code approvedPoliciesHash} of the data; empty while nothing is approved
     * @param overridesValid whether every override validated against the composed schema of the server
     */
    public record Data(long revision, Optional<String> approvedPoliciesHash, boolean overridesValid) {
    }

    /**
     * @param allowed whether the call may be evaluated
     * @param reason {@code ok}, {@code policy_data_stale} (the gateway pushes and repeats the call once; answer 409), {@code policies_not_approved},
     *     {@code policies_differ} or {@code overrides_invalid} (final; answer {@code upstream_unavailable})
     */
    public record Decision(boolean allowed, String reason) {
    }

    /**
     * @param ownHash policiesHash the server computes from its own policies and resourceTypes ({@link PoliciesHash})
     * @param held the data the server holds (the last accepted push), or null
     * @param prv revision of the token, if it has one
     */
    public static Decision decide(String ownHash, Data held, OptionalLong prv) {
        if (held == null || (prv.isPresent() && prv.getAsLong() > held.revision())) {
            return new Decision(false, "policy_data_stale");
        }
        if (held.approvedPoliciesHash().isEmpty()) {
            return new Decision(false, "policies_not_approved");
        }
        if (!held.approvedPoliciesHash().get().equals(ownHash)) {
            return new Decision(false, "policies_differ");
        }
        return held.overridesValid() ? new Decision(true, "ok") : new Decision(false, "overrides_invalid");
    }

    /** @return whether data just pushed replaces the data held: only a strictly newer revision does */
    public static boolean acceptRevision(OptionalLong held, long offered) {
        return held.isEmpty() || offered > held.getAsLong();
    }
}
