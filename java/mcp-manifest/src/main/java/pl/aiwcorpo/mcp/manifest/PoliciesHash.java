package pl.aiwcorpo.mcp.manifest;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * policiesHash of C6 (7.0.0): SHA-256 of the RFC 8785 form of the {@code policies} member of a manifest
 * ({@code namespace}, {@code schema}, {@code files}). The gateway recomputes it at registration; a changed hash of a
 * deployed server puts the server in {@code pending_approval}. The files are listed in file name order, so the hash does
 * not depend on how a build lists a directory (manifest rule {@code policies-files-sorted-unique}).
 */
public final class PoliciesHash {

    private PoliciesHash() {
    }

    /** @return canonical JSON that is hashed */
    public static String canonical(String policiesJson) {
        return CanonicalJson.canonicalize(policiesJson);
    }

    /** @return {@code sha256:<hex>} of the canonical form of {@code policiesJson} */
    public static String of(String policiesJson) {
        return sha256(canonical(policiesJson));
    }

    static String of(JsonNode policies) {
        return sha256(CanonicalJson.canonicalize(policies));
    }

    private static String sha256(String canonical) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
            return "sha256:" + HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
