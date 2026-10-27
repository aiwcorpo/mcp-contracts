package pl.aiwcorpo.mcp.policy.bundle;

import java.util.Locale;

/** The bundle must not be loaded; the receiver keeps the previous one. */
public final class BundleRejectedException extends Exception {

    /** Why the bundle was rejected; {@link #wireCode()} is the reason used in the test vectors and in metrics. */
    public enum Reason {
        INVALID_LATEST,
        TEST_KEY_NOT_ALLOWED,
        BAD_SIGNATURE,
        ARCHIVE_INVALID,
        MANIFEST_INVALID,
        MANIFEST_MISMATCH,
        OVERRIDES_CONTENT_NOT_ALLOWED,
        ARCHIVE_UNEXPECTED_FILE,
        ARCHIVE_INCOMPLETE,
        NOT_NEWER,
        PERMIT_IN_OVERRIDES,
        VS_SCOPES_IN_PERMIT,
        POLICY_INVALID,
        STATIC_ENTITIES_INVALID;

        /** @return lower-case name, e.g. {@code bad_signature} */
        public String wireCode() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    private final Reason reason;

    BundleRejectedException(Reason reason, String message) {
        super(reason.wireCode() + ": " + message);
        this.reason = reason;
    }

    BundleRejectedException(Reason reason, String message, Throwable cause) {
        super(reason.wireCode() + ": " + message, cause);
        this.reason = reason;
    }

    /** @return the rejection reason */
    public Reason reason() {
        return reason;
    }
}
