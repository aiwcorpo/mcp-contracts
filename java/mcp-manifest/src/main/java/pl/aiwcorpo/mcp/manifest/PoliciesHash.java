package pl.aiwcorpo.mcp.manifest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * policiesHash of C6 (7.0.0): SHA-256 of the RFC 8785 form of {@code {"policies": <policies>, "resourceTypes": <resourceTypes>}}
 * from a manifest. The declarations are covered because {@code earlyScopeCheck}, {@code idPattern}, {@code scopePattern} and
 * {@code classification} weaken or strengthen checks. The gateway recomputes it at registration; a changed hash of a deployed
 * server puts the server in {@code pending_approval}. The files are listed in file name order, so the hash does not depend on
 * how a build lists a directory (manifest rule {@code policies-files-sorted-unique}).
 */
public final class PoliciesHash {

    private PoliciesHash() {
    }

    /** @return canonical JSON that is hashed */
    public static String canonical(String policiesJson, String resourceTypesJson) {
        return CanonicalJson.canonicalize("{\"policies\":" + policiesJson + ",\"resourceTypes\":" + resourceTypesJson + "}");
    }

    /** @return {@code sha256:<hex>} of {@link #canonical} */
    public static String of(String policiesJson, String resourceTypesJson) {
        return sha256(canonical(policiesJson, resourceTypesJson));
    }

    static String of(JsonNode policies, JsonNode resourceTypes) {
        ObjectNode input = StrictJson.MAPPER.createObjectNode();
        input.set("policies", policies);
        input.set("resourceTypes", resourceTypes);
        return sha256(CanonicalJson.canonicalize(input));
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
