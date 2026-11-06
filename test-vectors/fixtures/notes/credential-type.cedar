// A service account sees everything in its system, so the rights of the user are the only limit left. A folder outside the
// user's grant is forbidden unless the credential is a user credential, which the system itself limits. Fail-closed: a
// missing or unknown credential type is treated like the service account (CC-136, CC-164).

@id("notes-service-account-folder-outside-scope")
forbid (principal, action, resource is Notes::Folder)
when {
  !(principal in resource.scopes) &&
  !(context has credentialType && ["user-oauth", "user-secret", "token-exchange"].contains(context.credentialType))
};
