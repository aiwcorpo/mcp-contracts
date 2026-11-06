// Reference rule that binds the starter (7.0.0): a server evaluates only policies that the gateway has approved, with policy data
// that is at least as new as the revision in the token. `held` and `refreshed` are policy data as the server read it:
// { revision, approvedPoliciesHash?, overridesValid }. `refreshed` is what a refresh made before this call returned (null when it
// failed or was not made); `prv` is the revision claim of the internal JWT (null when absent). Every refusal is the unavailable
// error of the server (C10 upstream_unavailable), never access_denied, and never an evaluation with older data.
export function policyDataGate({ ownHash, held, prv, refreshed }) {
  let data = held;
  if (prv !== null && (held === null || prv > held.revision)) {
    // A refresh may only move forward; data older than the token's revision is as good as no data.
    data = refreshed !== null && refreshed.revision >= prv && (held === null || refreshed.revision >= held.revision) ? refreshed : null;
  }
  if (data === null) return { decision: 'deny', errorCode: 'upstream_unavailable', reason: 'policy_data_unavailable' };
  if (data.approvedPoliciesHash === undefined) return { decision: 'deny', errorCode: 'upstream_unavailable', reason: 'policies_not_approved' };
  if (data.approvedPoliciesHash !== ownHash) return { decision: 'deny', errorCode: 'upstream_unavailable', reason: 'policies_differ' };
  if (!data.overridesValid) return { decision: 'deny', errorCode: 'upstream_unavailable', reason: 'overrides_invalid' };
  return { decision: 'continue' };
}

/** Whether data just read replaces the data held: only a strictly newer revision does; an older or equal one never does. */
export const acceptRevision = (heldRevision, offeredRevision) => heldRevision === null || offeredRevision > heldRevision;
