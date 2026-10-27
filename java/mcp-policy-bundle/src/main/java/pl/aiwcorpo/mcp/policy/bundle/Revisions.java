package pl.aiwcorpo.mcp.policy.bundle;

import java.util.regex.Pattern;

/** Bundle revisions {@code YYYYMMDDHHMMSS-<sha7>} (C7, CC-008). */
public final class Revisions {

    static final Pattern REVISION = Pattern.compile("^[0-9]{14}-[0-9a-f]{7}$");

    private Revisions() {
    }

    /** @return whether the text is a well-formed revision */
    public static boolean isValid(String revision) {
        return revision != null && REVISION.matcher(revision).matches();
    }

    /**
     * Only the timestamp part orders revisions; the same second with another sha is not newer (CC-008).
     *
     * @return true when {@code candidate} is strictly newer than {@code loaded}
     */
    public static boolean isNewer(String candidate, String loaded) {
        return candidate.substring(0, 14).compareTo(loaded.substring(0, 14)) > 0;
    }
}
