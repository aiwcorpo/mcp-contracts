// Reference checks of the credential type (CC-166). The type in the configuration of the system is the one source of truth.
//
// Gateway: the broker returns the type of the credential it resolved; the gateway refuses (internal_error, audit credential_resolve with reason
// credential_type_mismatch) when it differs from the type in its configuration of the system, before the credential is used.
//
// Server: the gateway sends that type in X-MCP-Credential-Type next to X-MCP-Credential, and the server compares it with its own configuration
// before anything uses the credential: before the evaluation of Cedar, the grant probe and the resolvers. Only a request that carries
// X-MCP-Credential is checked; initialize, tools/list and the registry calls have no credential and are not affected. For a request with a
// credential, a header that is missing, outside the four types or different from the configuration is refused with the C10 error internal_error
// without detail; the audit reason is credential_type_mismatch.
export const CREDENTIAL_TYPES = ['user-oauth', 'user-secret', 'token-exchange', 'service-account'];

const refused = { decision: 'deny', errorCode: 'internal_error', auditReason: 'credential_type_mismatch' };

export function credentialTypeCheck({ side = 'server', header, returned, configured, credentialPresent = true }) {
  if (!CREDENTIAL_TYPES.includes(configured)) throw new Error('configured type must be one of the four');
  if (side === 'gateway') return returned === configured ? { decision: 'continue' } : refused;
  if (!credentialPresent) return { decision: 'continue' };
  return header === configured ? { decision: 'continue' } : refused;
}
