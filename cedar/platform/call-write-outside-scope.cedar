// Writes are allowed only inside granted scopes. The gateway checks this early for the arguments whose resourceRef type
// is declared earlyScopeCheck (a flat type whose scope is the exact id, e.g. a project key); context.refs holds those ids
// as ResourceScope ids. Hierarchical types and ids whose container is known only after resolution are checked by the
// server with `principal in resource.scopes`.

@id("platform-call-write-outside-scope")
forbid (principal, action == Action::"call", resource is Tool)
when {
  resource.risk != "READ_ONLY" &&
  context has refs &&
  !principal.scopes.containsAll(context.refs)
};
