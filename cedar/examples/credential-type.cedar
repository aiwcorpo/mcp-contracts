// context.credentialType (CC-136) says which credential the call uses. The attribute is optional, so a rule guards it
// with `has`; a caller of the entity builder that does not know the type leaves it out and the rule does not apply.
// A service account belongs to the platform and not to the person who calls, so a destructive operation made with it
// could not be traced to a user's own rights in the system.

@id("destructive-not-with-service-account")
forbid (principal, action == Action::"call", resource is Tool)
when {
  resource.risk == "DESTRUCTIVE" &&
  context has credentialType &&
  context.credentialType == "service-account"
};
