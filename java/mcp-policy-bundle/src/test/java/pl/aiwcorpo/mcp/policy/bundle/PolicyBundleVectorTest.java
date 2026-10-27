package pl.aiwcorpo.mcp.policy.bundle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import com.cedarpolicy.model.policy.Policy;
import com.cedarpolicy.model.policy.PolicySet;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.PublicKey;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/** All vectors in test-vectors/bundles through the public API of the module. */
class PolicyBundleVectorTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Path BUNDLES = ContractFiles.resolve("test-vectors/bundles");

    static Stream<Path> vectors() {
        return ContractFiles.list("test-vectors/bundles", ".json").stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("vectors")
    void receiverDecisionMatches(Path file) throws Exception {
        JsonNode vector = JSON.readTree(file.toFile());
        JsonNode expected = vector.get("expected");
        try {
            receive(vector);
            if (!expected.get("accept").asBoolean()) {
                fail(file + ": accepted, expected " + expected.get("reason").asText());
            }
        } catch (BundleRejectedException e) {
            if (expected.get("accept").asBoolean()) {
                fail(file + ": rejected with " + e.getMessage());
            }
            assertEquals(expected.get("reason").asText(), e.reason().wireCode(), () -> file + ": " + e.getMessage());
        }
    }

    private static void receive(JsonNode vector) throws Exception {
        BundlePointer pointer = BundlePointer.parse(JSON.writeValueAsBytes(vector.get("latest")));
        if (!vector.has("bundle")) {
            return;
        }
        Channel channel = "overrides".equals(vector.get("channel").asText()) ? Channel.OVERRIDES : Channel.MAIN;
        PublicKey key = BundleVerifier.ed25519PublicKeyFromPem(
                ContractFiles.read(ContractFiles.resolve("test-vectors/" + vector.get("publicKey").asText())));
        BundleVerifier verifier = BundleVerifier.of(channel, key, vector.get("publicKeyId").asText(),
                vector.get("allowTestKeys").asBoolean());
        byte[] archive = Files.readAllBytes(BUNDLES.resolve(vector.get("bundle").asText()));
        byte[] signature = Files.readAllBytes(BUNDLES.resolve(vector.get("signature").asText()));
        Optional<String> loaded = vector.get("loadedRevision").isNull()
                ? Optional.empty() : Optional.of(vector.get("loadedRevision").asText());
        if (channel == Channel.MAIN) {
            PolicyBundle bundle = verifier.verifyMain(pointer, archive, signature, loaded);
            assertEquals(pointer.revision(), bundle.revision());
            assertFalse(bundle.scopeMapping().asMap().isEmpty(), "example bundles carry the scope mapping");
        } else {
            verifier.verifyOverrides(pointer, archive, signature, loaded, mainBundle(vector.get("mainBundle").asText()));
        }
    }

    private static PolicyBundle mainBundle(String file) throws Exception {
        String revision = file.replaceAll("^files/policies-|\\.tar\\.gz$", "");
        BundleVerifier main = BundleVerifier.of(Channel.MAIN, BundleVerifier.ed25519PublicKeyFromPem(
                ContractFiles.read(ContractFiles.resolve("test-vectors/keys/test-policy-bundle.public.pem"))),
                "test-policy-bundle", true);
        return main.verifyMain(
                new BundlePointer(revision, "policies-" + revision + ".tar.gz", "policies-" + revision + ".tar.gz.sig"),
                Files.readAllBytes(BUNDLES.resolve(file)), Files.readAllBytes(BUNDLES.resolve(file + ".sig")), Optional.empty());
    }

    @Test
    void embeddedTestKeyHashesMatchThePublishedKeys() throws Exception {
        for (String name : new String[] {"test-policy-bundle", "test-policy-overrides"}) {
            PublicKey key = BundleVerifier.ed25519PublicKeyFromPem(
                    ContractFiles.read(ContractFiles.resolve("test-vectors/keys/" + name + ".public.pem")));
            assertTrue(BundleVerifier.isPublishedTestKey(key), name);
        }
    }

    @Test
    void examplePoliciesPassTheLint() throws Exception {
        Set<Policy> all = new HashSet<>();
        for (Path file : ContractFiles.list("cedar/examples", ".cedar")) {
            all.addAll(PolicySet.parsePolicies(ContractFiles.read(file)).policies);
        }
        assertTrue(PolicyLint.linkContextOutsideForbid(new PolicySet(all)).isEmpty());
    }

    @Test
    void lintIgnoresTextThatOnlyLooksLikeAccess() throws Exception {
        PolicySet text = PolicySet.parsePolicies("""
                permit (principal, action, resource) when { context.client == "context.vsScopes context.virtualServer" };
                """);
        assertTrue(PolicyLint.linkContextOutsideForbid(text).isEmpty());
        PolicySet hasCheck = PolicySet.parsePolicies("""
                permit (principal, action, resource) when { context has vsScopes };
                """);
        assertEquals(1, PolicyLint.linkContextOutsideForbid(hasCheck).size());
    }
}
