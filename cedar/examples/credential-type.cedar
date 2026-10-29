// A service account (type service-account) belongs to the platform and sees everything in its system, so the rights of the
// user are the only limit left. These rules keep reading a service desk queue or ticket inside the queues granted to the
// user (CC-136). They are fail-closed: the gateway and the starter of 4.0.0 always give context.credentialType (the type comes
// from the configuration of the system), and when it is missing the rule still forbids what lies outside the grant. A user
// credential (user-oauth, user-secret, token-exchange) is not touched by them, because the system itself applies the user's
// own rights.

@id("servicedesk-service-account-queue-outside-scope")
forbid (principal, action, resource is ServiceDesk::Queue)
when {
  !(principal in resource.scopes) &&
  !(context has credentialType && context.credentialType != "service-account")
};

@id("servicedesk-service-account-ticket-outside-scope")
forbid (principal, action, resource is ServiceDesk::Ticket)
when {
  !(principal in resource.scopes) &&
  !(context has credentialType && context.credentialType != "service-account")
};
