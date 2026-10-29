// Reference checks of the credential type (CC-166). The configuration names a SET of credential types allowed for a system (for GitLab
// user-oauth and user-secret): `allowed` below. A system never mixes service-account with user types, so the default type of the
// configuration tells a service account from a user credential.
//
// Gateway: the broker returns the type of the credential it resolved; the gateway refuses (internal_error, audit credential_resolve with reason
// credential_type_mismatch) when that type is not in the set of its configuration of the system, before the credential is used.
//
// Server: the gateway sends that type in X-MCP-Credential-Type next to X-MCP-Credential, and the server checks that it is in the set of its own
// accepted credential types, before anything uses the credential: before the evaluation of Cedar, the grant probe and the resolvers. Only a request
// that carries X-MCP-Credential is checked; initialize, tools/list and the registry calls have no credential and are not affected. For a request with
// a credential a header that is missing, outside the four types or outside the set, and a server with no configured type at all, refuse the call with
// the C10 error internal_error without detail; the audit reason is credential_type_mismatch.
//
// context.credentialType in Cedar is the default type of the system from the gateway configuration (Cedar is evaluated before the broker is asked,
// so the type actually used is not known yet); it is not the type of the credential in the header.
export const CREDENTIAL_TYPES = ['user-oauth', 'user-secret', 'token-exchange', 'service-account'];

const refused = { decision: 'deny', errorCode: 'internal_error', auditReason: 'credential_type_mismatch' };

export function credentialTypeCheck({ side = 'server', header, returned, allowed, credentialPresent = true }) {
  if (!Array.isArray(allowed) || allowed.some((t) => !CREDENTIAL_TYPES.includes(t))) throw new Error('allowed must be a list of the four types');
  if (side === 'gateway') return allowed.includes(returned) ? { decision: 'continue' } : refused;
  if (!credentialPresent) return { decision: 'continue' };
  return allowed.includes(header) ? { decision: 'continue' } : refused;
}
