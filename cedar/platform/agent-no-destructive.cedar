// A DESTRUCTIVE tool is for a human (CC-263). principalType is "user", "agent" or "delegated"; every value but "user" is
// refused here, so the ban does not depend on the confirmation of C11 that an agent cannot give. A delegated principal is
// treated like an agent until the confirmation of mode 2 is reviewed.

@id("platform-call-agent-no-destructive")
forbid (principal, action == Action::"call", resource is Tool)
when { resource.risk == "DESTRUCTIVE" && context has principalType && context.principalType != "user" };

// A caller of the builder that left principalType out must not turn the ban off (fail closed). Cedar does not accept
// `!(context has x) || ...` in one policy, so this is a policy of its own.
@id("platform-call-destructive-without-principal-type")
forbid (principal, action == Action::"call", resource is Tool)
when { resource.risk == "DESTRUCTIVE" && !(context has principalType) };
