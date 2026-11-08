// Reference rule that binds the starter (7.0.0, push model of CC-249): a server evaluates a tools/call only with policy data that
// is at least as new as the revision in the token and only for policies that the gateway has approved. `held` is the policy data the
// server holds, as it read it from the last push: { revision, approvedPoliciesHash?, overridesValid } or null when it holds none;
// `prv` is the revision claim of the internal JWT (null when absent). The server never fetches data itself.
// A server that is behind answers 409 policy_data_stale before it does anything else with the request, which tells the gateway to push
// and repeat the call once. Every other refusal is the unavailable error of the server (C10 upstream_unavailable), never access_denied,
// and never an evaluation with older data.
export function policyDataGate({ ownHash, held, prv }) {
  if (held === null || (prv !== null && prv > held.revision)) {
    return { decision: 'deny', errorCode: 'policy_data_stale', reason: 'policy_data_stale', httpStatus: 409, gatewayAction: 'push_and_retry_once' };
  }
  const refuse = (reason) => ({ decision: 'deny', errorCode: 'upstream_unavailable', reason, gatewayAction: 'none' });
  if (held.approvedPoliciesHash === undefined) return refuse('policies_not_approved');
  if (held.approvedPoliciesHash !== ownHash) return refuse('policies_differ');
  if (!held.overridesValid) return refuse('overrides_invalid');
  return { decision: 'continue' };
}

/** Whether data just pushed replaces the data held: only a strictly newer revision does; an older or equal one never does. */
export const acceptRevision = (heldRevision, offeredRevision) => heldRevision === null || offeredRevision > heldRevision;

/** What POST /.well-known/mcp-policy-data answers: `accepted` and the revision the server holds afterwards. */
export function pushDecision({ held, offered }) {
  const accepted = acceptRevision(held === null ? null : held.revision, offered.revision);
  return { accepted, revision: accepted ? offered.revision : held.revision };
}

/**
 * The gateway side of one tools/call (C14): it sends the call with prv = the revision of its own policy data; on policy_data_stale it
 * pushes that data and repeats the call once with a new token; there is no third attempt. `gateway` is its data { revision,
 * approvedPoliciesHash?, overridesValid }; `pushReachesServer` false models a push that fails. Returns the number of calls and pushes and
 * what the client gets: executed, or upstream_unavailable (C10).
 */
export function gatewayCall({ ownHash, held, gateway, pushReachesServer = true }) {
  let state = held;
  const first = policyDataGate({ ownHash, held: state, prv: gateway.revision });
  if (first.decision === 'continue') return { calls: 1, pushes: 0, result: 'executed' };
  if (first.gatewayAction !== 'push_and_retry_once') return { calls: 1, pushes: 0, result: 'upstream_unavailable', reason: first.reason };
  if (pushReachesServer) state = pushDecision({ held: state, offered: gateway }).accepted ? gateway : state;
  const second = policyDataGate({ ownHash, held: state, prv: gateway.revision });
  if (second.decision === 'continue') return { calls: 2, pushes: 1, result: 'executed' };
  return { calls: 2, pushes: 1, result: 'upstream_unavailable', reason: second.reason };
}
