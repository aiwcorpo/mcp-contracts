package pl.aiwcorpo.mcp.policy.bundle;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import pl.aiwcorpo.mcp.policy.bundle.BundleRejectedException.Reason;

/**
 * Content of {@code latest.json} (C7, CC-026). {@code url} and {@code sigUrl} are file names in the directory of
 * {@code latest.json}; resolve them against that URL and never follow anything else.
 *
 * @param revision bundle revision
 * @param url {@code policies-<revision>.tar.gz}
 * @param sigUrl {@code policies-<revision>.tar.gz.sig}
 */
public record BundlePointer(String revision, String url, String sigUrl) {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern ARCHIVE = Pattern.compile("^policies-([0-9]{14}-[0-9a-f]{7})\\.tar\\.gz$");
    private static final Pattern SIGNATURE = Pattern.compile("^policies-([0-9]{14}-[0-9a-f]{7})\\.tar\\.gz\\.sig$");

    public BundlePointer {
        Objects.requireNonNull(revision, "revision");
        Objects.requireNonNull(url, "url");
        Objects.requireNonNull(sigUrl, "sigUrl");
    }

    /**
     * Parses and checks {@code latest.json}: exactly the three fields, anchored file names, the same revision in
     * both names and in {@code revision}.
     */
    public static BundlePointer parse(byte[] latestJson) throws BundleRejectedException {
        JsonNode node;
        try {
            node = JSON.readTree(latestJson);
        } catch (IOException e) {
            throw new BundleRejectedException(Reason.INVALID_LATEST, "not JSON", e);
        }
        if (node == null || !node.isObject() || node.size() != 3 || !node.path("revision").isTextual()
                || !node.path("url").isTextual() || !node.path("sigUrl").isTextual()) {
            throw new BundleRejectedException(Reason.INVALID_LATEST, "expected {revision, url, sigUrl}");
        }
        BundlePointer pointer = new BundlePointer(node.get("revision").asText(), node.get("url").asText(), node.get("sigUrl").asText());
        pointer.check();
        return pointer;
    }

    /** Same checks as {@link #parse} for a pointer built in code. */
    public void check() throws BundleRejectedException {
        if (!Revisions.isValid(revision)) {
            throw new BundleRejectedException(Reason.INVALID_LATEST, "malformed revision");
        }
        Matcher archive = ARCHIVE.matcher(url);
        Matcher signature = SIGNATURE.matcher(sigUrl);
        if (!archive.matches() || !signature.matches()
                || !archive.group(1).equals(revision) || !signature.group(1).equals(revision)) {
            throw new BundleRejectedException(Reason.INVALID_LATEST, "url and sigUrl must be file names of this revision");
        }
    }
}
