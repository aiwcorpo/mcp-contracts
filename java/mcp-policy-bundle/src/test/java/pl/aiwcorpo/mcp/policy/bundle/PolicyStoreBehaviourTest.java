package pl.aiwcorpo.mcp.policy.bundle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/** Review 2.0.0 M3 and M4: readiness after restart, state on disk is authoritative, no temporary files left. */
class PolicyStoreBehaviourTest {

    private static final Path BUNDLES = ContractFiles.resolve("test-vectors/bundles/files");
    private static final String R1 = "20261026120000-a1b2c3d";
    private static final String R2 = "20261026130000-b2c3d4e";
    private static final String O1 = "20261026121500-d4e5f60";

    private static PolicyStore store(Path dir, List<String> warnings) throws Exception {
        return new PolicyStore(
                BundleVerifier.of(Channel.MAIN, key("test-policy-bundle"), "test-policy-bundle", true),
                BundleVerifier.of(Channel.OVERRIDES, key("test-policy-overrides"), "test-policy-overrides", true),
                new PolicyStore.Persistence(dir, Map.of(), warnings::add));
    }

    private static java.security.PublicKey key(String name) throws Exception {
        return BundleVerifier.ed25519PublicKeyFromPem(ContractFiles.read(ContractFiles.resolve("test-vectors/keys/" + name + ".public.pem")));
    }

    private static void load(PolicyStore store, Channel channel, String revision) throws Exception {
        BundlePointer pointer = new BundlePointer(revision, "policies-" + revision + ".tar.gz", "policies-" + revision + ".tar.gz.sig");
        byte[] archive = Files.readAllBytes(BUNDLES.resolve("policies-" + revision + ".tar.gz"));
        byte[] signature = Files.readAllBytes(BUNDLES.resolve("policies-" + revision + ".tar.gz.sig"));
        if (channel == Channel.MAIN) {
            store.loadMain(pointer, archive, signature);
        } else {
            store.loadOverrides(pointer, archive, signature);
        }
    }

    @Test
    void notReadyUntilPreviouslyActiveOverridesAreBack() throws Exception {
        Path dir = Files.createTempDirectory("store");
        PolicyStore first = store(dir, new ArrayList<>());
        load(first, Channel.MAIN, R1);
        assertTrue(first.isReady());
        load(first, Channel.OVERRIDES, O1);

        PolicyStore restarted = store(dir, new ArrayList<>());
        load(restarted, Channel.MAIN, R1);
        assertTrue(restarted.awaitingOverrides());
        assertFalse(restarted.isReady());
        load(restarted, Channel.OVERRIDES, O1);
        assertTrue(restarted.isReady());
    }

    @Test
    void stateOnDiskWinsOverAnOlderInstance() throws Exception {
        Path dir = Files.createTempDirectory("store");
        PolicyStore older = store(dir, new ArrayList<>());
        PolicyStore newer = store(dir, new ArrayList<>());
        load(newer, Channel.MAIN, R2);
        var rejected = assertThrows(BundleRejectedException.class, () -> load(older, Channel.MAIN, R1));
        assertEquals(BundleRejectedException.Reason.NOT_NEWER, rejected.reason());
        try (Stream<Path> files = Files.list(dir)) {
            assertTrue(files.noneMatch(p -> p.toString().endsWith(".tmp")), "no temporary state files left");
        }
    }
}
