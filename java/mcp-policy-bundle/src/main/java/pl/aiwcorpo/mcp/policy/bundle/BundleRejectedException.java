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
        LINK_CONTEXT_IN_PERMIT,
        POLICY_INVALID,
        SCHEMA_MISMATCH,
        STATIC_ENTITIES_INVALID,
        MAIN_NOT_LOADED,
        ID_CONFLICT,
        BELOW_MINIMUM,
        /** The rollback state could not be written durably; the bundle is not activated (review 2.0.0 M4). */
        STATE_WRITE_FAILED;

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
