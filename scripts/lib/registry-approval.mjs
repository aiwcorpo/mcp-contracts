// Reference of approveTool for the classification of adapter tools (CC-193, CC-206). Used by test-vectors/registry-approval.

const RISK_ORDER = { READ_ONLY: 0, UPDATE: 1, DESTRUCTIVE: 2 };

/**
 * `entry` is the pending entry: { source: manifest | server | adapter, riskLowered? }. `body` is the ApproveRequest without definitionHash:
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
 * What a pulled manifest does with one tool (CC-097, CC-133, CC-249). `approved` is the approved entry { risk, definitionHash } or null for a
 * new tool (also a tool that was removed earlier); `submitted` is the entry of the manifest { risk, definitionHash, additionalGroup? };
 * `riskFloor` is the highest risk ever reported for the tool, or null (CC-167). Nothing is approved by a pull: a new or changed tool is
 * pending_approval whatever its risk, a READ_ONLY tool included, because no reviewed commit stands behind the manifest any more; an entry with the
 * same hash stays. A tool below the risk floor is pending with riskLowered, which only acceptRiskLowering on approval lifts (CC-167). The group
 * floor of CC-245 and CC-246 is still kept and set by approval; it decides nothing here because everything that changes is pending.
 */
export function pullDecision({ approved, submitted, riskFloor = null }) {
  if (approved !== null && approved.definitionHash === submitted.definitionHash) return { state: 'approved', change: 'unchanged' };
  const change = approved === null ? 'new' : 'changed';
  const riskLowered = riskFloor !== null && RISK_ORDER[submitted.risk] < RISK_ORDER[riskFloor];
  return { state: 'pending_approval', change, source: 'manifest', ...(riskLowered && { riskLowered: true }) };
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

/**
 * Approval of a resource, a resource template or a prompt (CC-265). `entry` is { source: manifest | adapter, hashMatches, hiddenCharacters? };
 * `body` is the ApproveRequest without definitionHash. No kind has a classification, so risk, action and acceptRiskLowering are 422
 * classification_not_allowed, also for an entry of an adapter (the approval itself is its classification, D7). The hash is compared first, the hidden
 * characters next, as for a tool (CC-250).
 */
export function approvePrimitiveDecision({ entry, body = {} }) {
  if (!entry.hashMatches) return { status: 409, error: 'hash_mismatch' };
  if (entry.hiddenCharacters === true) return { status: 422, error: 'manifest_rejected', auditReason: 'hidden_characters' };
  if (body.risk !== undefined || body.action !== undefined || body.acceptRiskLowering !== undefined) return { status: 422, error: 'manifest_rejected', reason: 'classification_not_allowed' };
  return { status: 204, auditReason: 'definition_approved' };
}

/**
 * What a pulled manifest does to the entries of one kind (CC-265). `approved` and `submitted` are the definitionHash of the entry, or null when
 * there is none. Nothing is approved by a pull; an entry that leaves the manifest is removed. A prompt whose messages changed has another hash,
 * so it is pending (and hidden) until approved again.
 */
export function pullPrimitiveDecision({ approved, submitted }) {
  if (submitted === null) return { removed: approved !== null, status: null };
  if (approved === null) return { removed: false, status: 'pending_approval', change: 'new' };
  if (approved === submitted) return { removed: false, status: 'approved' };
  return { removed: false, status: 'pending_approval', change: 'changed' };
}
