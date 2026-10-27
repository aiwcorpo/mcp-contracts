package pl.aiwcorpo.mcp.policy.bundle;

import com.cedarpolicy.BasicAuthorizationEngine;
import com.cedarpolicy.model.EntityValidationRequest;
import com.cedarpolicy.model.ValidationRequest;
import com.cedarpolicy.model.ValidationResponse;
import com.cedarpolicy.model.entity.Entities;
import com.cedarpolicy.model.entity.Entity;
import com.cedarpolicy.model.exception.AuthException;
import com.cedarpolicy.model.exception.InternalException;
import com.cedarpolicy.model.policy.Policy;
import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import pl.aiwcorpo.mcp.cedar.entities.EntityBuilderException;
import pl.aiwcorpo.mcp.cedar.entities.ScopeMapping;
import pl.aiwcorpo.mcp.policy.bundle.BundleRejectedException.Reason;

/**
 * Verifies and loads policy bundles of one channel. Thread-safe. Order of checks: pointer, key id, signature,
 * archive, manifest, consistency of revisions, archive content, monotonic revision, policies (parse, permit and
 * vsScopes lint, strict validation), static entities and their scope mapping.
 */
public final class BundleVerifier {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern GIT_SHA = Pattern.compile("^[0-9a-f]{40}$");
    private static final Pattern TIMESTAMP = Pattern.compile("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?Z$");
    private static final Pattern SEMVER = Pattern.compile("^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$");
    private static final String MANIFEST = "manifest.json";
    private static final String SCHEMA = "schema.cedarschema";
    private static final String STATIC_ENTITIES = "entities/static.json";

    private final Channel channel;
    private final PublicKey key;
    private final String keyId;
    private final boolean allowTestKeys;
    private final TarReader.Limits limits;
    private final BasicAuthorizationEngine engine = new BasicAuthorizationEngine();

    private BundleVerifier(Channel channel, PublicKey key, String keyId, boolean allowTestKeys, TarReader.Limits limits) {
        this.channel = Objects.requireNonNull(channel, "channel");
        this.key = Objects.requireNonNull(key, "key");
        this.keyId = Objects.requireNonNull(keyId, "keyId");
        this.allowTestKeys = allowTestKeys;
        this.limits = Objects.requireNonNull(limits, "limits");
    }

    /**
     * @param channel channel this verifier serves; main and overrides must use different keys
     * @param key Ed25519 public key of the channel
     * @param keyId identifier of the key in the receiver configuration; ids starting with {@code test-} denote the
     *        published test keys and are refused unless {@code allowTestKeys} (CC-044)
     * @param allowTestKeys true only in dev and test environments
     */
    public static BundleVerifier of(Channel channel, PublicKey key, String keyId, boolean allowTestKeys) {
        return new BundleVerifier(channel, key, keyId, allowTestKeys, TarReader.Limits.DEFAULT);
    }

    /** Same as {@link #of(Channel, PublicKey, String, boolean)} with explicit archive limits. */
    public static BundleVerifier of(Channel channel, PublicKey key, String keyId, boolean allowTestKeys, TarReader.Limits limits) {
        return new BundleVerifier(channel, key, keyId, allowTestKeys, limits);
    }

    /** @return the Ed25519 public key from an SPKI PEM text */
    public static PublicKey ed25519PublicKeyFromPem(String pem) throws GeneralSecurityException {
        String base64 = pem.replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
        return KeyFactory.getInstance("Ed25519").generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(base64)));
    }

    /**
     * Verifies a main bundle.
     *
     * @param loadedRevision revision of the main bundle currently loaded, empty at start-up
     */
    public PolicyBundle verifyMain(BundlePointer pointer, byte[] archive, byte[] signature, Optional<String> loadedRevision)
            throws BundleRejectedException {
        requireChannel(Channel.MAIN);
        Map<String, byte[]> files = verifiedFiles(pointer, archive, signature);
        BundleManifest manifest = manifest(files, pointer);
        for (String name : files.keySet()) {
            if (!name.equals(MANIFEST) && !name.equals(SCHEMA) && !name.equals(STATIC_ENTITIES) && !isPolicyFile(name)) {
                throw new BundleRejectedException(Reason.ARCHIVE_UNEXPECTED_FILE, name);
            }
        }
        if (!files.containsKey(SCHEMA) || !files.containsKey(STATIC_ENTITIES)) {
            throw new BundleRejectedException(Reason.ARCHIVE_INCOMPLETE, "schema.cedarschema and entities/static.json are required");
        }
        requireNewer(manifest, loadedRevision);
        PolicySet policies = parsePolicies(files);
        if (!policies.templates.isEmpty()) {
            throw new BundleRejectedException(Reason.POLICY_INVALID, "templates are not used by the platform");
        }
        lintVsScopes(policies);
        String schemaText = text(files.get(SCHEMA));
        Schema schema = new Schema(schemaText);
        validate(schema, policies);
        List<Entity> staticEntities = staticEntities(schema, files.get(STATIC_ENTITIES));
        ScopeMapping mapping;
        try {
            mapping = ScopeMapping.fromStaticEntities(staticEntities);
        } catch (EntityBuilderException e) {
            throw new BundleRejectedException(Reason.STATIC_ENTITIES_INVALID, e.getMessage(), e);
        }
        return new PolicyBundle(Channel.MAIN, manifest, policies, Optional.of(schemaText), Optional.of(schema),
                staticEntities, mapping);
    }

    /**
     * Verifies an overrides bundle against the loaded main bundle (CC-028, CC-040).
     *
     * @param loadedRevision revision of the overrides bundle currently loaded (overrides have their own sequence)
     * @param main the loaded main bundle, whose schema validates the overrides
     */
    public PolicyBundle verifyOverrides(BundlePointer pointer, byte[] archive, byte[] signature,
            Optional<String> loadedRevision, PolicyBundle main) throws BundleRejectedException {
        requireChannel(Channel.OVERRIDES);
        Objects.requireNonNull(main, "main");
        Map<String, byte[]> files = verifiedFiles(pointer, archive, signature);
        BundleManifest manifest = manifest(files, pointer);
        for (String name : files.keySet()) {
            if (!name.equals(MANIFEST) && !isPolicyFile(name)) {
                throw new BundleRejectedException(Reason.OVERRIDES_CONTENT_NOT_ALLOWED, name);
            }
        }
        requireNewer(manifest, loadedRevision);
        PolicySet policies = parsePolicies(files);
        List<String> permits;
        try {
            permits = PolicyLint.permits(policies);
        } catch (InternalException e) {
            throw new BundleRejectedException(Reason.POLICY_INVALID, "cannot determine policy effect", e);
        }
        if (!permits.isEmpty()) {
            throw new BundleRejectedException(Reason.PERMIT_IN_OVERRIDES, String.join("; ", permits));
        }
        if (!policies.templates.isEmpty()) {
            throw new BundleRejectedException(Reason.POLICY_INVALID, "templates are not used by the platform");
        }
        validate(main.schema().orElseThrow(() -> new IllegalArgumentException("main bundle without schema")), policies);
        return new PolicyBundle(Channel.OVERRIDES, manifest, policies, Optional.empty(), Optional.empty(), List.of(),
                ScopeMapping.empty());
    }

    private void requireChannel(Channel expected) {
        if (channel != expected) {
            throw new IllegalStateException("verifier configured for " + channel + ", not " + expected);
        }
    }

    private Map<String, byte[]> verifiedFiles(BundlePointer pointer, byte[] archive, byte[] signature)
            throws BundleRejectedException {
        pointer.check();
        if (keyId.startsWith("test-") && !allowTestKeys) {
            throw new BundleRejectedException(Reason.TEST_KEY_NOT_ALLOWED, "key " + keyId + " is a published test key");
        }
        try {
            Signature verifier = Signature.getInstance("Ed25519");
            verifier.initVerify(key);
            verifier.update(archive);
            if (signature.length != 64 || !verifier.verify(signature)) {
                throw new BundleRejectedException(Reason.BAD_SIGNATURE, "signature does not match the " + channel + " key");
            }
        } catch (GeneralSecurityException e) {
            throw new BundleRejectedException(Reason.BAD_SIGNATURE, "signature check failed", e);
        }
        return TarReader.readGzip(archive, limits);
    }

    private static BundleManifest manifest(Map<String, byte[]> files, BundlePointer pointer) throws BundleRejectedException {
        byte[] bytes = files.get(MANIFEST);
        JsonNode node;
        try {
            node = bytes == null ? null : JSON.readTree(bytes);
        } catch (IOException e) {
            throw new BundleRejectedException(Reason.MANIFEST_INVALID, "manifest.json is not JSON", e);
        }
        if (node == null || !node.isObject() || node.size() != 4
                || !Revisions.isValid(node.path("revision").asText(null))
                || !GIT_SHA.matcher(node.path("gitSha").asText("")).matches()
                || !TIMESTAMP.matcher(node.path("createdAt").asText("")).matches()
                || !SEMVER.matcher(node.path("schemaVersion").asText("")).matches()) {
            throw new BundleRejectedException(Reason.MANIFEST_INVALID, "manifest.json does not match the schema");
        }
        BundleManifest manifest = new BundleManifest(node.get("revision").asText(), node.get("gitSha").asText(),
                node.get("createdAt").asText(), node.get("schemaVersion").asText());
        if (!manifest.revision().equals(pointer.revision()) || !manifest.gitSha().startsWith(manifest.revision().substring(15))) {
            throw new BundleRejectedException(Reason.MANIFEST_MISMATCH, "manifest revision " + manifest.revision()
                    + " does not match latest.json " + pointer.revision());
        }
        return manifest;
    }

    private static void requireNewer(BundleManifest manifest, Optional<String> loadedRevision) throws BundleRejectedException {
        if (loadedRevision.isPresent() && !Revisions.isNewer(manifest.revision(), loadedRevision.get())) {
            throw new BundleRejectedException(Reason.NOT_NEWER, manifest.revision() + " is not newer than " + loadedRevision.get());
        }
    }

    private static boolean isPolicyFile(String name) {
        return name.startsWith("policies/") && name.endsWith(".cedar");
    }

    private static PolicySet parsePolicies(Map<String, byte[]> files) throws BundleRejectedException {
        Set<Policy> policies = new HashSet<>();
        Set<Policy> templates = new HashSet<>();
        Set<String> ids = new HashSet<>();
        for (Map.Entry<String, byte[]> file : files.entrySet()) {
            if (!isPolicyFile(file.getKey())) {
                continue;
            }
            try {
                PolicySet parsed = PolicySet.parsePolicies(text(file.getValue()));
                for (Policy policy : parsed.policies) {
                    policies.add(withStableId(policy, file.getKey(), ids));
                }
                templates.addAll(parsed.templates);
            } catch (InternalException e) {
                throw new BundleRejectedException(Reason.POLICY_INVALID, file.getKey() + ": " + e.getMessage(), e);
            }
        }
        return new PolicySet(policies, templates);
    }

    // Cedar numbers policies per parse (policy0, ...); ids must be unique across files for diagnostics and audit.
    private static Policy withStableId(Policy policy, String file, Set<String> ids) throws InternalException, BundleRejectedException {
        String annotated = policy.getAnnotation("id");
        String id = annotated != null ? annotated : file + "#" + policy.policyID;
        if (!ids.add(id)) {
            throw new BundleRejectedException(Reason.POLICY_INVALID, "duplicate policy id " + id);
        }
        return new Policy(policy.policySrc, id);
    }

    private static void lintVsScopes(PolicySet policies) throws BundleRejectedException {
        try {
            List<String> violations = PolicyLint.vsScopesOutsideForbid(policies);
            if (!violations.isEmpty()) {
                throw new BundleRejectedException(Reason.VS_SCOPES_IN_PERMIT, String.join("; ", violations));
            }
        } catch (InternalException e) {
            throw new BundleRejectedException(Reason.POLICY_INVALID, "cannot inspect policies", e);
        }
    }

    private void validate(Schema schema, PolicySet policies) throws BundleRejectedException {
        ValidationResponse response;
        try {
            response = engine.validate(new ValidationRequest(schema, policies));
        } catch (AuthException e) {
            throw new BundleRejectedException(Reason.POLICY_INVALID, "schema or policies do not parse", e);
        }
        if (!response.validationPassed()) {
            throw new BundleRejectedException(Reason.POLICY_INVALID, "strict validation failed: " + response);
        }
    }

    private List<Entity> staticEntities(Schema schema, byte[] json) throws BundleRejectedException {
        try {
            List<Entity> entities = new ArrayList<>(Entities.parse(text(json)).getEntities());
            engine.validateEntities(new EntityValidationRequest(schema, entities));
            return entities;
        } catch (IOException | AuthException e) {
            throw new BundleRejectedException(Reason.STATIC_ENTITIES_INVALID, e.getMessage(), e);
        }
    }

    private static String text(byte[] bytes) {
        return new String(bytes, StandardCharsets.UTF_8);
    }
}
