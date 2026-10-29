// Reference check of a server (CC-166): the gateway sends the type of the credential in X-MCP-Credential-Type, next to X-MCP-Credential,
// and the server compares it with the type from its own configuration. Any difference, a missing header or a value outside the four
// types refuses the call. The client gets the C10 error internal_error without detail (a configuration defect, not the client's
// mistake); the audit event has reason credential_type_mismatch.
export const CREDENTIAL_TYPES = ['user-oauth', 'user-secret', 'token-exchange', 'service-account'];

export function credentialTypeCheck({ header, configured }) {
  if (!CREDENTIAL_TYPES.includes(configured)) throw new Error('configured type must be one of the four');
  if (header === configured) return { decision: 'continue' };
  return { decision: 'deny', errorCode: 'internal_error', auditReason: 'credential_type_mismatch' };
}
