// Reference of approveTool for the classification of adapter tools (CC-193, CC-206). Used by test-vectors/registry-approval.

const RISK_ORDER = { READ_ONLY: 0, UPDATE: 1, DESTRUCTIVE: 2 };

/**
 * `entry` is the pending entry: { source: ci | server | adapter, riskLowered? }. `body` is the ApproveRequest without definitionHash:
 * { risk?, action?, acceptRiskLowering? }. `floor` is the highest classification given earlier to the tool (null when none).
 * Returns the answer and, on success, the classification stored and the audit reason.
 */
export function approveDecision({ entry, body = {}, floor = null }) {
  const classifies = body.risk !== undefined || body.action !== undefined;
  if (entry.source === 'adapter') {
    if (body.risk === undefined || body.action === undefined) return { status: 422, reason: 'classification_required' };
    if (!consistent(body.risk, body.action)) return { status: 422, reason: 'classification_inconsistent' };
    // CC-227: the adapter has no resource scope, so the gateway has nothing to evaluate a write against; only reads are classified.
    if (body.risk !== 'READ_ONLY') return { status: 422, reason: 'classification_not_allowed' };
    if (floor !== null && RISK_ORDER[body.risk] < RISK_ORDER[floor] && body.acceptRiskLowering !== true) return { status: 422, reason: 'risk_lowered' };
    const lowered = floor !== null && RISK_ORDER[body.risk] < RISK_ORDER[floor];
    return { status: 204, classification: { risk: body.risk, action: body.action }, auditReason: lowered ? 'risk_lowered_by_admin' : 'definition_approved' };
  }
  if (classifies) return { status: 422, reason: 'classification_not_allowed' };
  if (entry.riskLowered && body.acceptRiskLowering !== true) return { status: 422, reason: 'risk_lowered' };
  return { status: 204, auditReason: entry.riskLowered ? 'risk_lowered_by_admin' : 'definition_approved' };
}

/**
 * What a registration (PUT of the manifest of the pipeline) does with one tool (CC-097, CC-133, CC-245, CC-246). `approved` is the approved
 * entry { risk, definitionHash } or null for a new tool (also a tool that was removed earlier); `submitted` is the entry of the manifest
 * { risk, definitionHash, additionalGroup? }; `groupFloor` is the last additionalGroup the tool was approved with, or null/absent when it
 * never had one. The floor is kept after the tool is removed and after deleteServer, like the risk floors (CC-167), so removing a tool and
 * registering it again cannot drop the group. A new or changed READ_ONLY tool is approved by the commit review; UPDATE and DESTRUCTIVE wait
 * for an administrator. CC-245/CC-246: a tool (new or existing) whose additionalGroup is missing or differs from a floor widens access, so
 * it waits for an administrator whatever the risk, and approving it sets the floor to what was approved; adding a group where there was none
 * is a narrowing and follows the normal rule.
 */
export function registrationDecision({ approved, submitted, groupFloor = null }) {
  if (approved !== null && approved.definitionHash === submitted.definitionHash) return { state: 'approved', change: 'unchanged' };
  const change = approved === null ? 'new' : 'changed';
  if (groupFloor !== null && submitted.additionalGroup !== groupFloor) {
    return { state: 'pending_approval', change, pendingReason: 'additional_group_changed' };
  }
  if (submitted.risk === 'READ_ONLY') return { state: 'approved', change };
  return { state: 'pending_approval', change, pendingReason: 'risk' };
}

// CC-207: risk and action of a classification must fit each other. read is for READ_ONLY only, update for UPDATE, delete for
// DESTRUCTIVE; admin may be UPDATE or DESTRUCTIVE (a READ_ONLY tool never has the action admin).
const FITS = { READ_ONLY: ['read'], UPDATE: ['update', 'admin'], DESTRUCTIVE: ['delete', 'admin'] };
const consistent = (risk, action) => FITS[risk]?.includes(action) === true;

/** What a tool of an adapter is for callers: until it is classified and approved it is hidden and refused as tool_disabled. */
export function adapterToolState({ classified, risk = 'READ_ONLY' }) {
  // CC-227, 6.3.1: a classification above READ_ONLY stored before the adapter became read only is not valid; the tool is as if it were
  // not classified until an administrator approves it again as a read.
  return classified && risk === 'READ_ONLY' ? { listed: true } : { listed: false, errorCode: 'tool_disabled', auditReason: 'tool_disabled' };
}
