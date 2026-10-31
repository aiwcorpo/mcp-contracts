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
import pl.aiwcorpo.mcp.cedar.entities.McpCedarSchema;
import pl.aiwcorpo.mcp.cedar.entities.PublishedTestKeys;
import pl.aiwcorpo.mcp.cedar.entities.ScopeMapping;
import pl.aiwcorpo.mcp.policy.bundle.BundleRejectedException.Reason;

/**
 * Verifies and loads policy bundles of one channel. Thread-safe. Order of checks: pointer, key id, signature,
 * archive, manifest, consistency of revisions, archive content, monotonic revision, policies (parse, permit
 * lint, strict validation), static entities and their scope mapping.
 */
public final class BundleVerifier {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern GIT_SHA = Pattern.compile("^[0-9a-f]{40}$");
    private static final Pattern TIMESTAMP = Pattern.compile("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?Z$");
    private static final Pattern SEMVER = Pattern.compile("^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$");
    /** Kept for compatibility with 2.0.0; the list now lives in {@link PublishedTestKeys}. */
    static final Set<String> TEST_KEY_SPKI_SHA256 = PublishedTestKeys.SPKI_SHA256;
    private static final String MANIFEST = "manifest.json";
    private static final String SCHEMA = "schema.cedarschema";
    private static final String STATIC_ENTITIES = "entities/static.json";

    private final Channel channel;
    private final PublicKey key;
    private final String keyId;
    private final boolean allowTestKeys;
    private final boolean devstackProfile;
    private final TarReader.Limits limits;
    private final BasicAuthorizationEngine engine = new BasicAuthorizationEngine();

    private BundleVerifier(Channel channel, PublicKey key, String keyId, boolean allowTestKeys, boolean devstackProfile, TarReader.Limits limits) {
        this.channel = Objects.requireNonNull(channel, "channel");
        this.key = Objects.requireNonNull(key, "key");
        this.keyId = Objects.requireNonNull(keyId, "keyId");
        this.allowTestKeys = allowTestKeys;
        this.devstackProfile = devstackProfile;
        this.limits = Objects.requireNonNull(limits, "limits");
    }

    /**
     * @param channel channel this verifier serves; main and overrides must use different keys
     * @param key Ed25519 public key of the channel
     * @param keyId identifier of the key in the receiver configuration; ids starting with {@code test-}, and the
     *        published test keys under any id, are refused unless {@code allowTestKeys} (CC-044); ids starting with
     *        {@code dev-} are refused unless dev mode is on, see {@link #withDevstackProfile} (CC-137)
     * @param allowTestKeys true only in dev and test environments
     */
    public static BundleVerifier of(Channel channel, PublicKey key, String keyId, boolean allowTestKeys) {
        return new BundleVerifier(channel, key, keyId, allowTestKeys, false, TarReader.Limits.DEFAULT);
    }

    /** Same as {@link #of(Channel, PublicKey, String, boolean)} with explicit archive limits. */
    public static BundleVerifier of(Channel channel, PublicKey key, String keyId, boolean allowTestKeys, TarReader.Limits limits) {
        return new BundleVerifier(channel, key, keyId, allowTestKeys, false, limits);
    }

    /**
     * Dev mode is two consents: the devstack profile and {@code allowTestKeys} (CC-137). A key id starting with
     * {@code dev-} is accepted only when both are set; {@code allowTestKeys} alone, as in a unit test, still refuses it.
     *
     * @param devstackProfile true only for a component started with the devstack profile
     * @return a verifier like this one with the profile consent given
     */
    public BundleVerifier withDevstackProfile(boolean devstackProfile) {
        return new BundleVerifier(channel, key, keyId, allowTestKeys, devstackProfile, limits);
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
        String schemaText = text(files.get(SCHEMA));
        // The schema is pinned to this contracts version (CC-059): a bundle cannot reshape the model, e.g. let
        // ResourceScope entities nest and widen grants.
        if (!schemaText.equals(McpCedarSchema.text())) {
            throw new BundleRejectedException(Reason.SCHEMA_MISMATCH, "schema.cedarschema differs from the schema of mcp-contracts");
        }
        Schema schema = new Schema(schemaText);
        validate(schema, policies);
        List<Entity> staticEntities = staticEntities(schema, files.get(STATIC_ENTITIES));
        requireOnlyScopeMapping(staticEntities);
        ScopeMapping mapping;
        try {
            mapping = ScopeMapping.fromStaticEntities(staticEntities);
        } catch (EntityBuilderException e) {
            throw new BundleRejectedException(Reason.STATIC_ENTITIES_INVALID, e.getMessage(), e);
        }
        return new PolicyBundle(Channel.MAIN, manifest, policies, Optional.of(schema), mapping);
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
        return new PolicyBundle(Channel.OVERRIDES, manifest, policies, Optional.empty(), ScopeMapping.empty());
    }

    private void requireChannel(Channel expected) {
        if (channel != expected) {
            throw new IllegalStateException("verifier configured for " + channel + ", not " + expected);
        }
    }

    private Map<String, byte[]> verifiedFiles(BundlePointer pointer, byte[] archive, byte[] signature)
            throws BundleRejectedException {
        pointer.check();
        boolean devMode = allowTestKeys && devstackProfile;
        if (((keyId.startsWith("test-") || isPublishedTestKey(key)) && !allowTestKeys) || (keyId.startsWith("dev-") && !devMode)) {
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

    static boolean isPublishedTestKey(PublicKey key) {
        return PublishedTestKeys.isPublishedTestKey(key);
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

    // CC-059: static.json is only the scope mapping; any other entity could collide with or override the
    // entities the builder produces for a request.
    private static void requireOnlyScopeMapping(List<Entity> entities) throws BundleRejectedException {
        for (Entity entity : entities) {
            String type = entity.getEUID().getType().toString();
            if (!"UserGroup".equals(type)) {
                throw new BundleRejectedException(Reason.STATIC_ENTITIES_INVALID, "entity of type " + type + " in static.json");
            }
            if (!entity.attrs.isEmpty() || !entity.getTags().isEmpty()) {
                throw new BundleRejectedException(Reason.STATIC_ENTITIES_INVALID, "UserGroup " + entity.getEUID().getId() + " has attributes");
            }
            for (var parent : entity.getParents()) {
                if (!"ResourceScope".equals(parent.getType().toString())) {
                    throw new BundleRejectedException(Reason.STATIC_ENTITIES_INVALID, "UserGroup parent " + parent.getType());
                }
            }
        }
    }

    void validate(Schema schema, PolicySet policies) throws BundleRejectedException {
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
