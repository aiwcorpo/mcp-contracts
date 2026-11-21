// Reference of what the broker answers for the kind of principal in the internal JWT (CC-261). Used by test-vectors/broker-eligibility.

const AGENT_TYPES = new Set(['service-account', 'token-exchange']);

/**
 * `claims` is { pty?, act?, tool?, resource? }; `operation` is resolve (with credentialType, the type the system hands out for this call)
 * or authenticator (GET /v1/authenticator, verify, invalidate-codes). `system` is { supportedTypes, agentsAllowed }.
 * An agent never reaches the secret store, the connection database or the IdP when the answer is 403.
 */
export function brokerEligibility({ operation, claims, system, credentialType }) {
  if (operation === 'resolve' && ((claims.tool !== undefined) === (claims.resource !== undefined))) return { status: 401, error: 'invalid_claims' };
  if (claims.pty === 'delegated' && claims.act === undefined) return { status: 401, error: 'invalid_claims' };
  if (claims.pty === 'agent') {
    if (operation === 'authenticator') return { status: 403, error: 'principal_not_eligible' };
    if (!AGENT_TYPES.has(credentialType)) return { status: 403, error: 'principal_not_eligible', touchedStore: false };
    if (credentialType === 'service-account' && system.agentsAllowed !== true) return { status: 403, error: 'principal_not_eligible', touchedStore: false };
  }
  return { status: 200, resolvedBy: claims.pty === 'delegated' ? 'human_sub' : 'sub' };
}

/**
 * 422 of a write of a system with agentsAllowed (CC-261) and whether the replace needs a fresh MFA. Every write of a system needs one (C4), except
 * a replace whose only change is agentsAllowed from true to false: taking access away is never blocked by the check. `othersChanged` is true when
 * the replace changes anything besides agentsAllowed.
 */
export function agentsAllowedWrite({ before = null, after, othersChanged = true }) {
  if (after.agentsAllowed === true && !after.supportedTypes.includes('service-account')) return { status: 422, error: 'system_rejected', reason: 'agents_allowed_without_service_account' };
  const turnsOffOnly = before !== null && before.agentsAllowed === true && after.agentsAllowed !== true && !othersChanged;
  return { status: 200, freshMfaRequired: !turnsOffOnly };
}
