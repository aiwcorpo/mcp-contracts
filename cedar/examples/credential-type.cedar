// A service account (type service-account) belongs to the platform and sees everything in its system, so the rights of the
// user are the only limit left. These rules keep reading a service desk queue or ticket inside the queues granted to the
// user (CC-136). They are fail-closed in two ways: the gateway and the starter always give context.credentialType (the type
// comes from the configuration of the system), and the rules list the credential types of a user (user-oauth, user-secret,
// token-exchange), so a missing or unknown type (a typo, a fifth type) is treated like the service account and still forbids
// what lies outside the grant (CC-164). A user credential is not touched by them, because the system itself applies the
// user's own rights. The grant of a queue comes only from the policy bundle (principal in resource.scopes, CC-163).

@id("servicedesk-service-account-queue-outside-scope")
forbid (principal, action, resource is ServiceDesk::Queue)
when {
  !(principal in resource.scopes) &&
  !(context has credentialType && ["user-oauth", "user-secret", "token-exchange"].contains(context.credentialType))
};

@id("servicedesk-service-account-ticket-outside-scope")
forbid (principal, action, resource is ServiceDesk::Ticket)
when {
  !(principal in resource.scopes) &&
  !(context has credentialType && ["user-oauth", "user-secret", "token-exchange"].contains(context.credentialType))
};
