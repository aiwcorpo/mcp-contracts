package pl.aiwcorpo.mcp.cedar.entities;

/**
 * The builder could not produce a complete request. The caller must deny the tool call (fail-closed) and
 * report {@link Code#wireCode()} as the C10 error code.
 */
public final class EntityBuilderException extends RuntimeException {

    /** Reason of the failure. */
    public enum Code {
        /** A resource argument is not an identifier (C10 {@code invalid_argument}). */
        INVALID_ARGUMENT("invalid_argument"),
        /** Inconsistent input from the platform itself, e.g. a vs claim without its link (C10 {@code internal_error}). */
        INTERNAL_ERROR("internal_error");

        private final String wireCode;

        Code(String wireCode) {
            this.wireCode = wireCode;
        }

        /** @return the C10 error code */
        public String wireCode() {
            return wireCode;
        }
    }

    private final Code code;

    EntityBuilderException(Code code, String message) {
        super(message);
        this.code = code;
    }

    /** @return why the request could not be built */
    public Code code() {
        return code;
    }
}
