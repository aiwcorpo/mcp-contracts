package pl.aiwcorpo.mcp.policy.bundle;

import com.cedarpolicy.model.policy.Policy;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.EnumMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.function.Consumer;
import java.util.regex.Pattern;
import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import java.util.HashSet;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import pl.aiwcorpo.mcp.cedar.entities.EntityBuilder;
import pl.aiwcorpo.mcp.policy.bundle.BundleRejectedException.Reason;

/**
 * Holds the active policies of a component (CC-060): the main bundle, the optional overrides bundle and the entity
 * builder built from the main bundle's scope mapping, swapped together and atomically. Updates are serialized;
 * readers take {@link #current()} without locking and always see one consistent {@link Snapshot}.
 *
 * <p>Rules: overrides need a loaded main bundle; revisions are tracked per channel by the store; policy ids must be
 * unique across both channels. A new main bundle is validated together with the loaded overrides; if they conflict
 * the new main bundle is rejected and the previous main and overrides stay active (fail-closed: an emergency forbid
 * is never dropped by a regular update).
 *
 * <p>Rollback protection across restarts (CC-066): with {@link Persistence} the store writes the last loaded revision
 * and the SHA-256 of its archive per channel to a file in a configured directory (atomic replace). After a restart
 * it accepts only a newer revision, or the same revision with the same archive; a configured minimum revision per
 * channel is never undercut. A missing or unreadable state file falls back to the minimum and is reported through
 * {@link Persistence#warnings()} for the audit log.
 */
public final class PolicyStore {

    /**
     * One consistent set of policies.
     *
     * @param main loaded main bundle
     * @param overrides loaded overrides bundle, if any
     * @param policies main and overrides policies together, ready for {@code isAuthorized}
     * @param schema schema for request validation
     * @param entityBuilder builder with the main bundle's scope mapping
     */
    public record Snapshot(PolicyBundle main, Optional<PolicyBundle> overrides, PolicySet policies, Schema schema,
            EntityBuilder entityBuilder) {

        public Snapshot {
            Objects.requireNonNull(main, "main");
            Objects.requireNonNull(overrides, "overrides");
            Objects.requireNonNull(policies, "policies");
            Objects.requireNonNull(schema, "schema");
            Objects.requireNonNull(entityBuilder, "entityBuilder");
        }
    }

    /**
     * Rollback protection across restarts (CC-066).
     *
     * @param directory where the state files {@code policy-bundle-main.state} and {@code policy-bundle-overrides.state} live
     * @param minimumRevision lowest revision per channel ever accepted (e.g. raised after an incident); may be empty
     * @param warnings receives a message when a state file is missing or unreadable; write it to the audit log
     */
    public record Persistence(Path directory, Map<Channel, String> minimumRevision, Consumer<String> warnings) {

        public Persistence {
            Objects.requireNonNull(directory, "directory");
            minimumRevision = Map.copyOf(Objects.requireNonNull(minimumRevision, "minimumRevision"));
            minimumRevision.values().forEach(r -> {
                if (!Revisions.isValid(r)) {
                    throw new IllegalArgumentException("invalid minimum revision " + r);
                }
            });
            Objects.requireNonNull(warnings, "warnings");
        }
    }

    private record Persisted(String revision, String archiveSha256) {
    }

    private static final Pattern STATE_LINE = Pattern.compile("^([0-9]{14}-[0-9a-f]{7}) (sha256:[0-9a-f]{64})$");

    private final BundleVerifier mainVerifier;
    private final BundleVerifier overridesVerifier;
    private final Optional<Persistence> persistence;
    private final Map<Channel, Optional<Persisted>> persisted = new EnumMap<>(Channel.class);
    private volatile Snapshot current;

    /**
     * Store without persistence: rollback protection only while the process runs.
     *
     * @param mainVerifier verifier configured for {@link Channel#MAIN}
     * @param overridesVerifier verifier configured for {@link Channel#OVERRIDES} (separate key)
     */
    public PolicyStore(BundleVerifier mainVerifier, BundleVerifier overridesVerifier) {
        this(mainVerifier, overridesVerifier, Optional.empty());
    }

    /** Store with rollback protection across restarts (CC-066); reads the state files immediately. */
    public PolicyStore(BundleVerifier mainVerifier, BundleVerifier overridesVerifier, Persistence persistence) {
        this(mainVerifier, overridesVerifier, Optional.of(persistence));
    }

    private PolicyStore(BundleVerifier mainVerifier, BundleVerifier overridesVerifier, Optional<Persistence> persistence) {
        this.mainVerifier = Objects.requireNonNull(mainVerifier, "mainVerifier");
        this.overridesVerifier = Objects.requireNonNull(overridesVerifier, "overridesVerifier");
        this.persistence = persistence;
        for (Channel channel : Channel.values()) {
            persisted.put(channel, persistence.flatMap(p -> readState(p, channel)));
        }
    }

    /** @return the active snapshot, empty until the first main bundle is loaded (callers must deny then) */
    public Optional<Snapshot> current() {
        return Optional.ofNullable(current);
    }

    /** Verifies a main bundle and makes it active together with the loaded overrides. */
    public synchronized Snapshot loadMain(BundlePointer pointer, byte[] archive, byte[] signature) throws BundleRejectedException {
        Snapshot before = current;
        PolicyBundle main = mainVerifier.verifyMain(pointer, archive, signature,
                Optional.ofNullable(before).map(s -> s.main().revision()));
        String archiveSha256 = sha256(archive);
        checkAgainstState(Channel.MAIN, main.revision(), archiveSha256, before != null);
        Optional<PolicyBundle> overrides = Optional.ofNullable(before).flatMap(Snapshot::overrides);
        Schema schema = main.schema().orElseThrow();
        if (overrides.isPresent()) {
            requireDistinctIds(main.policies(), overrides.get().policies());
            mainVerifier.validate(schema, overrides.get().policies());
        }
        Snapshot next = snapshot(main, overrides);
        writeState(Channel.MAIN, new Persisted(main.revision(), archiveSha256));
        current = next;
        return next;
    }

    /** Verifies an overrides bundle against the active main bundle and makes it active. */
    public synchronized Snapshot loadOverrides(BundlePointer pointer, byte[] archive, byte[] signature) throws BundleRejectedException {
        Snapshot before = current;
        if (before == null) {
            throw new BundleRejectedException(Reason.MAIN_NOT_LOADED, "no main bundle to validate the overrides against");
        }
        PolicyBundle overrides = overridesVerifier.verifyOverrides(pointer, archive, signature,
                before.overrides().map(PolicyBundle::revision), before.main());
        String archiveSha256 = sha256(archive);
        checkAgainstState(Channel.OVERRIDES, overrides.revision(), archiveSha256, before.overrides().isPresent());
        requireDistinctIds(before.main().policies(), overrides.policies());
        Snapshot next = snapshot(before.main(), Optional.of(overrides));
        writeState(Channel.OVERRIDES, new Persisted(overrides.revision(), archiveSha256));
        current = next;
        return next;
    }

    /**
     * While running, the verifier already demanded a strictly newer revision. On the first load of a channel after a
     * restart the persisted state applies: newer, or the same revision with the same archive.
     */
    private void checkAgainstState(Channel channel, String revision, String archiveSha256, boolean loadedInThisProcess)
            throws BundleRejectedException {
        if (persistence.isEmpty()) {
            return;
        }
        String minimum = persistence.get().minimumRevision().get(channel);
        if (minimum != null && revision.substring(0, 14).compareTo(minimum.substring(0, 14)) < 0) {
            throw new BundleRejectedException(Reason.BELOW_MINIMUM, revision + " is below the configured minimum " + minimum);
        }
        if (loadedInThisProcess) {
            return;
        }
        Optional<Persisted> state = persisted.get(channel);
        if (state.isPresent()) {
            Persisted last = state.get();
            boolean newer = Revisions.isNewer(revision, last.revision());
            boolean sameContent = revision.equals(last.revision()) && archiveSha256.equals(last.archiveSha256());
            if (!newer && !sameContent) {
                throw new BundleRejectedException(Reason.NOT_NEWER,
                        revision + " is not newer than the persisted " + last.revision() + " (or differs from its archive)");
            }
        }
    }

    private static Optional<Persisted> readState(Persistence persistence, Channel channel) {
        Path file = stateFile(persistence, channel);
        try {
            if (!Files.exists(file)) {
                persistence.warnings().accept("policy bundle state file " + file + " missing for " + channel
                        + "; accepting revisions from the configured minimum");
                return Optional.empty();
            }
            var matcher = STATE_LINE.matcher(Files.readString(file, StandardCharsets.UTF_8).trim());
            if (matcher.matches()) {
                return Optional.of(new Persisted(matcher.group(1), matcher.group(2)));
            }
        } catch (IOException e) {
            // reported below like a corrupt file
        }
        persistence.warnings().accept("policy bundle state file " + file + " unreadable for " + channel
                + "; accepting revisions from the configured minimum");
        return Optional.empty();
    }

    private void writeState(Channel channel, Persisted state) throws BundleRejectedException {
        if (persistence.isEmpty()) {
            return;
        }
        Path file = stateFile(persistence.get(), channel);
        try {
            Files.createDirectories(file.getParent());
            Path temp = Files.createTempFile(file.getParent(), file.getFileName().toString(), ".tmp");
            Files.writeString(temp, state.revision() + " " + state.archiveSha256() + "\n", StandardCharsets.UTF_8);
            try {
                Files.move(temp, file, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(temp, file, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            // Without a durable state the rollback protection would silently lapse after a restart.
            throw new BundleRejectedException(Reason.POLICY_INVALID, "cannot persist policy bundle state: " + e.getMessage(), e);
        }
        persisted.put(channel, Optional.of(state));
    }

    private static Path stateFile(Persistence persistence, Channel channel) {
        return persistence.directory().resolve("policy-bundle-" + channel.name().toLowerCase(java.util.Locale.ROOT) + ".state");
    }

    private static String sha256(byte[] bytes) {
        try {
            return "sha256:" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private static Snapshot snapshot(PolicyBundle main, Optional<PolicyBundle> overrides) {
        Set<Policy> all = new HashSet<>(main.policies().policies);
        overrides.ifPresent(o -> all.addAll(o.policies().policies));
        return new Snapshot(main, overrides, new PolicySet(all), main.schema().orElseThrow(),
                new EntityBuilder(main.scopeMapping()));
    }

    private static void requireDistinctIds(PolicySet main, PolicySet overrides) throws BundleRejectedException {
        Set<String> mainIds = new HashSet<>();
        main.policies.forEach(p -> mainIds.add(p.policyID));
        Set<String> clash = new TreeSet<>();
        overrides.policies.forEach(p -> {
            if (mainIds.contains(p.policyID)) {
                clash.add(p.policyID);
            }
        });
        if (!clash.isEmpty()) {
            throw new BundleRejectedException(Reason.ID_CONFLICT, "policy ids used by both channels: " + clash);
        }
    }
}
