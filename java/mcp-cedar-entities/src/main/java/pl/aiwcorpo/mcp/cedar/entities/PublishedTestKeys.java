package pl.aiwcorpo.mcp.cedar.entities;

import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.util.HexFormat;
import java.util.Set;

/**
 * The keys published in mcp-contracts test-vectors/keys (EC P-256, for JWTs), as SHA-256
 * of their SubjectPublicKeyInfo. Production receivers refuse these keys under any kid or configured id (CC-044).
 * Same list as {@code mcp-contracts/security/published-test-keys.json} in the mcp-contracts jar; a test keeps both
 * in line with the key files.
 */
public final class PublishedTestKeys {

    /** SHA-256 (lower-case hex) of the DER SubjectPublicKeyInfo of each published test key. */
    public static final Set<String> SPKI_SHA256 = Set.of(
            "2c9b2f1e8cc291d8f9ab8a2c312726a1d9162253038d3670363084d5e2a07147",
            "f776f49706b7fa2a9368b66d075bbb8ae737911125f4f144187b9a586f31eccc",
            "c679efaec91adf76e792b3d56d1d59d5da3a3a6c4378da690c9c00f6ceff010a",
            "8a264c8d907f48620d4f5963d2e5250766b5845cd5263677554575041e86de2f");

    private PublishedTestKeys() {
    }

    /** @return whether the key is one of the published test keys */
    public static boolean isPublishedTestKey(PublicKey key) {
        return SPKI_SHA256.contains(spkiSha256(key));
    }

    /** @return SHA-256 (lower-case hex) of the key's SubjectPublicKeyInfo */
    public static String spkiSha256(PublicKey key) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(key.getEncoded()));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
