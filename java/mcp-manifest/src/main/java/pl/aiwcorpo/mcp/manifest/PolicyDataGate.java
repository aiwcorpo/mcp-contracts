package pl.aiwcorpo.mcp.manifest;

import java.util.Optional;
import java.util.OptionalLong;

/**
 * The rule that binds a server (7.0.0): it evaluates only policies that the gateway approved, with policy data at least as
 * new as the revision {@code prv} of the token. The twin is {@code scripts/lib/policy-data-gate.mjs}; the vectors in
 * {@code test-vectors/policy-data-gate} keep them equal. Every refusal is the unavailable error of the server (C10
 * {@code upstream_unavailable}), never an evaluation with older data.
 */
public final class PolicyDataGate {

    private PolicyDataGate() {
    }

    /**
     * Policy data as the server read it from the gateway.
     *
     * @param revision revision of the data (a counter that only increases)
     * @param approvedPoliciesHash {@code approvedPoliciesHash} of the data; empty while nothing is approved
     * @param overridesValid whether every override validated against the composed schema of the server
     */
    public record Data(long revision, Optional<String> approvedPoliciesHash, boolean overridesValid) {
    }

    /**
     * @param allowed whether the call may be evaluated
     * @param reason {@code ok}, {@code policy_data_unavailable}, {@code policies_not_approved}, {@code policies_differ} or {@code overrides_invalid}
     */
    public record Decision(boolean allowed, String reason) {
    }

    /**
     * @param ownHash policiesHash the server computes from its own policies and resourceTypes ({@link PoliciesHash})
     * @param held the data the server holds, or null
     * @param prv revision of the token, if it has one
     * @param refreshed what a refresh made before this call returned, or null when it failed or was not made
     */
    public static Decision decide(String ownHash, Data held, OptionalLong prv, Data refreshed) {
        Data data = held;
        if (prv.isPresent() && (held == null || prv.getAsLong() > held.revision())) {
            data = refreshed != null && refreshed.revision() >= prv.getAsLong()
                    && (held == null || refreshed.revision() >= held.revision()) ? refreshed : null;
        }
        if (data == null) {
            return new Decision(false, "policy_data_unavailable");
        }
        if (data.approvedPoliciesHash().isEmpty()) {
            return new Decision(false, "policies_not_approved");
        }
        if (!data.approvedPoliciesHash().get().equals(ownHash)) {
            return new Decision(false, "policies_differ");
        }
        return data.overridesValid() ? new Decision(true, "ok") : new Decision(false, "overrides_invalid");
    }

    /** @return whether data just read replaces the data held: only a strictly newer revision does */
    public static boolean acceptRevision(OptionalLong held, long offered) {
        return held.isEmpty() || offered > held.getAsLong();
    }
}
