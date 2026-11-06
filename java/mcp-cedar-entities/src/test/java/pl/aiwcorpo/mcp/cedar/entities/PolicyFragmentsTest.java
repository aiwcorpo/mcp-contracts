package pl.aiwcorpo.mcp.cedar.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class PolicyFragmentsTest {

    private static final String NOTES_DIR = "test-vectors/fixtures/notes";
    private static final String JIRA_DIR = "cedar/examples/systems/jira";

    private static String schema(String dir) {
        return ContractFiles.read(ContractFiles.resolve(dir + "/schema.cedarschema"));
    }

    private static Map<String, String> policies(String dir) {
        Map<String, String> files = new LinkedHashMap<>();
        for (Path file : ContractFiles.list(dir, ".cedar")) {
            files.put(file.getFileName().toString(), ContractFiles.read(file));
        }
        return files;
    }

    private static ResourceTypes types(String dir) {
        return ResourceTypes.fromJson(ContractFiles.read(ContractFiles.resolve(dir + "/resource-types.json")));
    }

    private static PolicyFragments.Result validate(String namespace, String schema, Map<String, String> files) {
        return PolicyFragments.validateFragment(namespace, schema, files, null);
    }

    @ParameterizedTest
    @ValueSource(strings = {JIRA_DIR, NOTES_DIR})
    void fragmentsOfTheExamplesAreAccepted(String dir) {
        String namespace = dir.endsWith("jira") ? "Jira" : "Notes";
        PolicyFragments.Result result = PolicyFragments.validateFragment(namespace, schema(dir), policies(dir), types(dir));
        assertTrue(result.ok(), result::toString);
    }

    @Test
    void schemasOfTheOtherExampleSystemsComposeAndMatchTheirDeclarations() {
        for (String system : List.of("confluence", "gitlab", "opensearch", "servicedesk")) {
            String dir = "cedar/examples/systems/" + system;
            String namespace = switch (system) {
                case "confluence" -> "Confluence";
                case "gitlab" -> "GitLab";
                case "opensearch" -> "OpenSearch";
                default -> "ServiceDesk";
            };
            PolicyFragments.Result result = PolicyFragments.validateFragment(namespace, schema(dir), Map.of(), types(dir));
            assertTrue(result.ok(), () -> system + ": " + result);
        }
    }

    @Test
    void fragmentWithTypesOutsideItsNamespaceIsRefused() {
        String schema = schema(NOTES_DIR) + "\nentity Stray;\n";
        PolicyFragments.Result result = validate("Notes", schema, Map.of());
        assertTrue(result.errors().get(0).contains("exactly the namespace Notes"), result::toString);
    }

    @Test
    void fragmentWithTwoNamespacesIsRefused() {
        String schema = schema(NOTES_DIR) + "\nnamespace Other { entity Thing { scopes: Set<ResourceScope> }; }\n";
        assertTrue(!validate("Notes", schema, Map.of()).ok());
    }

    @Test
    void fragmentNamedLikeItsManifestOnly() {
        assertTrue(!validate("Jira", schema(NOTES_DIR), Map.of()).ok());
        assertTrue(!validate("notes", schema(NOTES_DIR), Map.of()).ok());
    }

    @Test
    void entityTypeWithoutScopesIsRefused() {
        String schema = """
                namespace Notes {
                  entity Notebook { name: String };
                  action "read" appliesTo { principal: [User], resource: [Notebook], context: RequestContext };
                }
                """;
        PolicyFragments.Result result = validate("Notes", schema, Map.of());
        assertTrue(result.errors().stream().anyMatch(e -> e.contains("Notebook needs the attribute scopes")), result::toString);
    }

    @Test
    void scopesOfAnotherTypeAreRefused() {
        String schema = """
                namespace Notes {
                  entity Notebook { name: String, scopes: Set<String> };
                  action "read" appliesTo { principal: [User], resource: [Notebook], context: RequestContext };
                }
                """;
        assertTrue(!validate("Notes", schema, Map.of()).ok());
    }

    @Test
    void callActionInTheFragmentIsRefused() {
        String schema = """
                namespace Notes {
                  entity Notebook { scopes: Set<ResourceScope> };
                  action "call" appliesTo { principal: [User], resource: [Notebook], context: RequestContext };
                }
                """;
        // Cedar itself refuses the shadowing of Action::"call"; the explicit rule covers a schema Cedar would accept.
        assertTrue(!validate("Notes", schema, Map.of()).ok());
    }

    @Test
    void policyOnCallOrToolIsRefused() {
        for (String policy : List.of(
                "@id(\"p\") permit (principal, action == Action::\"call\", resource);",
                "@id(\"p\") permit (principal, action, resource is Tool);",
                "@id(\"p\") forbid (principal, action, resource) when { resource is Tool };")) {
            PolicyFragments.Result result = validate("Notes", schema(NOTES_DIR), Map.of("bad.cedar", policy));
            assertTrue(!result.ok(), policy);
        }
    }

    @Test
    void policyWithoutIdOrWithDuplicateIdIsRefused() {
        String noId = "permit (principal, action == Notes::Action::\"read\", resource);";
        String one = "@id(\"p\") permit (principal, action == Notes::Action::\"read\", resource);";
        assertTrue(!validate("Notes", schema(NOTES_DIR), Map.of("a.cedar", noId)).ok());
        assertTrue(!validate("Notes", schema(NOTES_DIR), Map.of("a.cedar", one, "b.cedar", one)).ok());
    }

    @Test
    void policyAgainstAnUnknownActionOrAttributeIsRefused() {
        assertTrue(!validate("Notes", schema(NOTES_DIR), Map.of("a.cedar",
                "@id(\"p\") permit (principal, action == Notes::Action::\"publish\", resource);")).ok());
        assertTrue(!validate("Notes", schema(NOTES_DIR), Map.of("a.cedar",
                "@id(\"p\") forbid (principal, action, resource is Notes::Notebook) when { resource.colour == \"red\" };")).ok());
    }

    @Test
    void impossiblePolicyIsRefused() {
        PolicyFragments.Result result = validate("Notes", schema(NOTES_DIR), Map.of("a.cedar",
                "@id(\"p\") forbid (principal, action, resource is Notes::Notebook) when { resource has colour && resource.colour == \"red\" };"));
        assertTrue(!result.ok(), result::toString);
    }

    @Test
    void policyOfAnotherNamespaceIsRefused() {
        PolicyFragments.Result result = validate("Notes", schema(NOTES_DIR), Map.of("a.cedar",
                "@id(\"p\") forbid (principal, action, resource is Jira::Project) when { resource.category == \"x\" };"));
        assertTrue(!result.ok(), result::toString);
    }

    @Test
    void declarationsMustMatchTheSchema() {
        ResourceTypes types = types(NOTES_DIR);
        String missingType = schema(NOTES_DIR).replace("entity Folder {", "entity Drawer {");
        assertTrue(!PolicyFragments.validateFragment("Notes", missingType, Map.of(), types).ok());
        String extraRequired = schema(NOTES_DIR).replace("name: String,", "name: String,\n    colour: String,");
        PolicyFragments.Result result = PolicyFragments.validateFragment("Notes", extraRequired, Map.of(), types);
        assertTrue(result.errors().stream().anyMatch(e -> e.contains("colour")), result::toString);
        String wrongParent = schema(NOTES_DIR).replace("notebook: Notebook", "notebook: Folder");
        assertTrue(!PolicyFragments.validateFragment("Notes", wrongParent, Map.of(), types).ok());
    }

    @Test
    void overridesAreForbidOnlyAndOneAtATime() {
        String forbid = "forbid (principal, action == Action::\"call\", resource is Tool) when { resource.name == \"drop_table\" };";
        PolicyFragments.OverrideTarget gateway = PolicyFragments.OverrideTarget.GATEWAY;
        assertTrue(PolicyFragments.validateOverride("override-block-drop", forbid, gateway, List.of()).ok());
        assertTrue(PolicyFragments.validateOverride("override-block-drop", "@id(\"override-block-drop\") " + forbid, gateway, List.of()).ok());
        assertTrue(!PolicyFragments.validateOverride("override-other", "@id(\"override-block-drop\") " + forbid, gateway, List.of()).ok());
        assertTrue(!PolicyFragments.validateOverride("override-x", "permit (principal, action, resource);", gateway, List.of()).ok());
        assertTrue(!PolicyFragments.validateOverride("override-x", forbid + "\n" + forbid, gateway, List.of()).ok());
        assertTrue(!PolicyFragments.validateOverride("override-x", "forbid (", gateway, List.of()).ok());
    }

    @Test
    void overrideIdsNeedThePrefixAndCannotTakeAPlatformId() {
        String forbid = "forbid (principal, action == Action::\"call\", resource is Tool);";
        for (String id : List.of("block-drop", "platform-call-write-outside-scope", "override-", "Override-x", "override-a_b")) {
            assertTrue(!PolicyFragments.validateOverride(id, forbid, PolicyFragments.OverrideTarget.GATEWAY, List.of()).ok(), id);
        }
        com.cedarpolicy.model.policy.PolicySet platform = McpCedarSchema.platformPolicies();
        com.cedarpolicy.model.policy.PolicySet clash = PolicyFragments.policySet(Map.of("o.cedar",
                "@id(\"platform-call-write-outside-scope\") forbid (principal, action, resource);"));
        assertThrows(IllegalArgumentException.class, () -> PolicyFragments.merge(platform, clash));
        assertEquals(3, PolicyFragments.merge(platform).policies.size());
    }

    @Test
    void aGatewayOverrideThatBlocksNothingIsRefused() {
        PolicyFragments.OverrideTarget gateway = PolicyFragments.OverrideTarget.GATEWAY;
        assertTrue(!PolicyFragments.validateOverride("override-a", "forbid (principal, action, resource) when { principal.username == \"x\" };", gateway, List.of()).ok());
        assertTrue(!PolicyFragments.validateOverride("override-a", "forbid (principal, action == Action::\"call\", resource);", gateway, List.of()).ok());
        assertTrue(!PolicyFragments.validateOverride("override-a", "forbid (principal, action, resource is Tool);", gateway, List.of()).ok());
    }

    @Test
    void serverOverridesAreCheckedAgainstEveryFragmentAndCannotTouchTool() {
        PolicyFragments.OverrideTarget all = PolicyFragments.OverrideTarget.ALL_SERVERS;
        List<String> fragments = List.of(schema(NOTES_DIR), schema(JIRA_DIR));
        assertTrue(PolicyFragments.validateOverride("override-no-claude-ai", "forbid (principal, action, resource) when { context.client == \"claude-ai\" };", all, fragments).ok());
        assertTrue(!PolicyFragments.validateOverride("override-notes-only", "forbid (principal, action, resource is Notes::Notebook);", all, fragments).ok(),
                "a type of one server does not validate against the other");
        assertTrue(!PolicyFragments.validateOverride("override-tool", "forbid (principal, action, resource is Tool);", all, fragments).ok());
        assertTrue(!PolicyFragments.validateOverride("override-call", "forbid (principal, action == Action::\"call\", resource);", all, fragments).ok());
        PolicyFragments.OverrideTarget server = PolicyFragments.OverrideTarget.SERVER;
        assertTrue(PolicyFragments.validateOverride("override-secret", "forbid (principal, action, resource is Notes::Notebook) when { resource.labels.contains(\"secret\") };", server, List.of(schema(NOTES_DIR))).ok());
        assertTrue(!PolicyFragments.validateOverride("override-secret", "forbid (principal, action, resource is Notes::Notebook) when { resource.labels.contains(\"secret\") };", server, List.of(schema(JIRA_DIR))).ok());
    }

    @Test
    void fragmentActionsMustApplyToUserAndRequestContext() {
        String foreign = """
                namespace Notes {
                  entity Folder { scopes: Set<ResourceScope> };
                  type Ctx = { x: Long };
                  action "read" appliesTo { principal: [Folder], resource: [Folder], context: Ctx };
                }
                """;
        PolicyFragments.Result result = validate("Notes", foreign, Map.of());
        assertTrue(result.errors().stream().anyMatch(e -> e.contains("principal [User]")), result::toString);
        assertTrue(result.errors().stream().anyMatch(e -> e.contains("RequestContext")), result::toString);
    }

    @Test
    void fragmentPoliciesCannotUseReservedIdPrefixes() {
        for (String id : List.of("platform-x", "override-x")) {
            PolicyFragments.Result result = validate("Notes", schema(NOTES_DIR), Map.of("a.cedar",
                    "@id(\"" + id + "\") forbid (principal, action == Notes::Action::\"read\", resource is Notes::Notebook);"));
            assertTrue(!result.ok(), id);
        }
    }

    @Test
    void generatedPlatformServerPoliciesValidateForEveryExampleSystem() throws Exception {
        for (String dir : List.of(JIRA_DIR, NOTES_DIR, "cedar/examples/systems/confluence", "cedar/examples/systems/gitlab",
                "cedar/examples/systems/opensearch", "cedar/examples/systems/servicedesk")) {
            Map<String, String> texts = PlatformServerPolicies.texts(types(dir));
            assertTrue(!texts.isEmpty(), dir);
            String namespace = dir.endsWith("jira") ? "Jira" : dir.endsWith("notes") ? "Notes" : types(dir).declarations().get(0).namespace();
            PolicyFragments.Result own = PolicyFragments.validateFragment(namespace, schema(dir), Map.of(), types(dir));
            assertTrue(own.ok(), own::toString);
            com.cedarpolicy.model.policy.PolicySet generated = PolicyFragments.policySet(texts);
            var response = new com.cedarpolicy.BasicAuthorizationEngine().validate(new com.cedarpolicy.model.ValidationRequest(
                    PolicyFragments.composeSchema(schema(dir)), generated));
            assertTrue(response.validationPassed() && response.success.orElseThrow().validationWarnings.isEmpty(), () -> dir + ": " + response);
            assertTrue(texts.keySet().stream().allMatch(id -> id.startsWith(PolicyFragments.PLATFORM_ID_PREFIX)), dir);
        }
    }

    @Test
    void restrictedIsForbiddenThroughTheParentChain() {
        Map<String, String> texts = PlatformServerPolicies.texts(types(JIRA_DIR));
        assertTrue(texts.containsKey("platform-jira-restricted-project"));
        assertTrue(texts.containsKey("platform-jira-restricted-issue-by-project"));
        assertTrue(texts.get("platform-jira-restricted-issue-by-project").contains("resource.project.category == \"restricted\""));
        assertTrue(texts.containsKey("platform-jira-issue-service-account-outside-scope"));
    }

    @Test
    void policySetTakesTheIdFromTheAnnotation() {
        assertEquals(1, PolicyFragments.policySet(Map.of("f", "@id(\"a\") forbid (principal, action, resource);")).policies.size());
    }
}
