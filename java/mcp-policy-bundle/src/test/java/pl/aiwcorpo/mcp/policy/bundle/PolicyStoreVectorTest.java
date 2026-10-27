package pl.aiwcorpo.mcp.policy.bundle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.fail;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/** test-vectors/policy-store: sequences of bundle updates through PolicyStore (CC-060). */
class PolicyStoreVectorTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Path BUNDLES = ContractFiles.resolve("test-vectors/bundles");

    static Stream<Path> vectors() {
        return ContractFiles.list("test-vectors/policy-store", ".json").stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void sequence(Path file) throws Exception {
        JsonNode v = JSON.readTree(file.toFile());
        boolean allowTest = v.get("allowTestKeys").asBoolean();
        BundleVerifier mainVerifier = BundleVerifier.of(Channel.MAIN, key(v.get("mainKey").asText()), "test-policy-bundle", allowTest);
        BundleVerifier overridesVerifier = BundleVerifier.of(Channel.OVERRIDES, key(v.get("overridesKey").asText()), "test-policy-overrides", allowTest);
        JsonNode persistence = v.get("persistence");
        Path stateDir = Files.createTempDirectory("policy-store");
        List<String> warnings = new ArrayList<>();
        PolicyStore store;
        if (persistence == null) {
            store = new PolicyStore(mainVerifier, overridesVerifier);
        } else {
            for (Channel channel : Channel.values()) {
                JsonNode before = persistence.get("stateBefore").get(channel.name().toLowerCase(Locale.ROOT));
                Path stateFile = stateDir.resolve("policy-bundle-" + channel.name().toLowerCase(Locale.ROOT) + ".state");
                if (before.isTextual()) {
                    Files.writeString(stateFile, "not a state line\n");
                } else if (!before.isNull()) {
                    Files.writeString(stateFile, before.get("revision").asText() + " " + before.get("archiveSha256").asText() + "\n");
                }
            }
            Map<Channel, String> minimum = new EnumMap<>(Channel.class);
            persistence.get("minimumRevision").fields().forEachRemaining(e ->
                    minimum.put(Channel.valueOf(e.getKey().toUpperCase(Locale.ROOT)), e.getValue().asText()));
            store = new PolicyStore(mainVerifier, overridesVerifier, new PolicyStore.Persistence(stateDir, minimum, warnings::add));
        }
        for (int i = 0; i < v.get("steps").size(); i++) {
            JsonNode step = v.get("steps").get(i);
            JsonNode expected = v.get("expected").get(i);
            BundlePointer pointer = BundlePointer.parse(JSON.writeValueAsBytes(step.get("latest")));
            byte[] archive = Files.readAllBytes(BUNDLES.resolve(step.get("bundle").asText()));
            byte[] signature = Files.readAllBytes(BUNDLES.resolve(step.get("signature").asText()));
            try {
                if ("main".equals(step.get("channel").asText())) {
                    store.loadMain(pointer, archive, signature);
                } else {
                    store.loadOverrides(pointer, archive, signature);
                }
                if (!expected.get("accept").asBoolean()) {
                    fail(file + " step " + i + ": accepted, expected " + expected.get("reason").asText());
                }
            } catch (BundleRejectedException e) {
                if (expected.get("accept").asBoolean()) {
                    fail(file + " step " + i + ": rejected with " + e.getMessage());
                }
                assertEquals(expected.get("reason").asText(), e.reason().wireCode(), file + " step " + i);
            }
        }
        if (persistence != null) {
            assertEquals(persistence.get("expectedWarnings").asInt(), warnings.size(), () -> file + ": " + warnings);
            JsonNode after = persistence.get("stateAfter");
            for (Channel channel : Channel.values()) {
                Path stateFile = stateDir.resolve("policy-bundle-" + channel.name().toLowerCase(Locale.ROOT) + ".state");
                JsonNode expectedState = after.get(channel.name().toLowerCase(Locale.ROOT));
                if (expectedState == null || expectedState.isNull()) {
                    continue;
                }
                assertEquals(expectedState.get("revision").asText() + " " + expectedState.get("archiveSha256").asText(),
                        Files.readString(stateFile).trim(), file + " " + channel);
            }
        }
        JsonNode fin = v.get("final");
        assertEquals(fin.get("main").isNull() ? null : fin.get("main").asText(),
                store.current().map(s -> s.main().revision()).orElse(null), file::toString);
        assertEquals(fin.get("overrides").isNull() ? null : fin.get("overrides").asText(),
                store.current().flatMap(PolicyStore.Snapshot::overrides).map(PolicyBundle::revision).orElse(null), file::toString);
    }

    private static java.security.PublicKey key(String path) throws Exception {
        return BundleVerifier.ed25519PublicKeyFromPem(ContractFiles.read(ContractFiles.resolve("test-vectors/" + path)));
    }
}
