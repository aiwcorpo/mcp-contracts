// Reference aggregation of CC-095: the gateway audit events of ONE call (the first request and its retries with a
// code, linked by the gateway's internal confirmationId that is not part of C8) become one ActivityCall row.
// `now` (epoch seconds) matters for a call that waits for a code: the gateway emits no event when the 120 s run out, so a
// pending call older than the TTL is `expired` (CC-095). `result` is computed from the reason of the last event of the
// call, never from its errorCode: confirmation_pending as a decision means "waits", as an errorCode of a refused call it
// means something else and its row is blocked_by_pending.
const TTL_SECONDS = 120;
const TERMINAL = new Set(['user_confirmed', 'user_confirmed_no_preview', 'attempts_exhausted', 'superseded', 'pending_exists', 'confirmation_expired', 'cancelled_by_owner']);

// Result of a row from the reason of its last event (CC-165). The reasons of the limits, of a changed or missing definition and of a refused
// token exchange are refusals: they land in the group denied.
const REASON_RESULT = {
  not_granted: 'denied_not_granted', filter_scope: 'denied_filter_scope', policy_forbid: 'denied_policy', tool_disabled: 'tool_disabled',
  credential_required: 'credential_required', rate_limited: 'rate_limited', step_up_required: 'step_up_required',
  rate_limited_user: 'rate_limited', rate_limited_client: 'rate_limited', rate_limited_tool: 'rate_limited', rate_limited_agent: 'rate_limited',
  definition_changed: 'tool_disabled', tool_not_served: 'tool_disabled', exchange_denied: 'denied_not_granted',
  kill_switch: 'tool_disabled',
  agent_max_risk: 'denied_not_granted', agent_suspended: 'denied_not_granted', principal_not_eligible: 'denied_not_granted',
};

// CC-198: policy_forbid answered not_found_or_denied is a forbid at the tool level; the row of the user does not tell it from a missing
// grant (invariant 8). policy_forbid with access_denied (a resource of the arguments) stays denied_policy.
const resultOfReason = (reason, errorCode) => (reason === 'policy_forbid' && errorCode === 'not_found_or_denied' ? 'denied_not_granted' : REASON_RESULT[reason]);

// Filter group of the result query parameter of GET /activity/calls (CC-142).
export function resultGroup(result) {
  if (result === 'ok') return 'ok';
  if (['denied_not_granted', 'denied_filter_scope', 'denied_policy', 'tool_disabled', 'step_up_required', 'rate_limited'].includes(result)) return 'denied';
  if (['error', 'credential_required'].includes(result)) return 'error';
  return 'confirmation';
}

// CC-264, CC-265: a resource read or a prompt get is one gateway event without a confirmation flow, so its row comes from that
// event alone. The steps 3 to 6 of resources/read and the authorization of prompts/get end in the same -32602 whatever the reason
// (CC-259, invariant 8 of CC-187), so the row must not tell them apart: every such reason carries errorCode not_found_or_denied,
// whatever the event holds, and result follows the reason like for a tool (CC-165) with two additions: a URI that matches no entry
// and a variable that fails its idPattern are denied_not_granted, as an unknown tool name is, and policy_forbid is
// denied_not_granted (the tool-level rule of CC-198 applies to the whole kind). The other reasons (argument_invalid,
// result_too_large, upstream_unavailable, credential_required, rate limits) are what the client was told: result from the table
// or error, errorCode of the event. The row has no server field, so a prompt is named <system>__<prompt> like in prompts/list.
const PRIMITIVE_EVENTS = { resource_read: 'resource', prompt_get: 'prompt' };
const HIDDEN_RESULT = {
  not_granted: 'denied_not_granted', policy_forbid: 'denied_not_granted', uri_no_match: 'denied_not_granted', variable_invalid: 'denied_not_granted',
  filter_scope: 'denied_filter_scope', kill_switch: 'tool_disabled', definition_changed: 'tool_disabled',
  agent_suspended: 'denied_not_granted', principal_not_eligible: 'denied_not_granted', agent_max_risk: 'denied_not_granted',
};

function aggregatePrimitiveCall(event) {
  const kind = PRIMITIVE_EVENTS[event.event];
  const row = { requestId: event.requestId, ts: event.ts, kind };
  if (event.client) row.client = event.client;
  if (event.filter) row.filter = event.filter;
  if (kind === 'resource') {
    if (event.resourceTemplate) row.resourceTemplate = event.resourceTemplate;
    if (event.resource) row.resource = event.resource;
  } else {
    row.prompt = `${event.server.replace(/^mcp-/, '')}__${event.prompt}`;
  }
  if (event.outcome === 'ok') {
    row.result = 'ok';
    row.errorCode = null;
  } else if (HIDDEN_RESULT[event.reason]) {
    row.result = HIDDEN_RESULT[event.reason];
    row.errorCode = 'not_found_or_denied';
  } else {
    row.result = REASON_RESULT[event.reason] ?? 'error';
    row.errorCode = event.errorCode ?? null;
  }
  return row;
}

export function aggregateCall(allEvents, now) {
  if (allEvents[0] && PRIMITIVE_EVENTS[allEvents[0].event]) return aggregatePrimitiveCall(allEvents[0]);
  // Events after the first terminal one (for example more retries after the attempts ran out) do not change the row.
  const cut = allEvents.findIndex((e) => e.event === 'confirmation' && TERMINAL.has(e.reason));
  let events = cut < 0 ? allEvents : allEvents.slice(0, cut + 1);
  const toolCall = allEvents.find((e, i) => e.event === 'tool_call' && cut >= 0 && i > cut);
  if (toolCall && ['user_confirmed', 'user_confirmed_no_preview'].includes(allEvents[cut].reason)) events = allEvents.slice(0, allEvents.indexOf(toolCall) + 1);
  const first = events[0];
  const row = { requestId: first.requestId, ts: first.ts };
  if (first.client) row.client = first.client;
  if (first.filter) row.filter = first.filter;
  const withTool = events.find((e) => e.tool && e.server);
  if (withTool) row.tool = `${withTool.server.replace(/^mcp-/, '')}__${withTool.tool}`;
  const risk = events.find((e) => e.risk)?.risk;
  if (risk) row.risk = risk;
  const resource = events.find((e) => e.resource)?.resource;
  if (resource) row.resource = resource;

  const confirmations = events.filter((e) => e.event === 'confirmation');
  const last = events[events.length - 1];
  const blocked = last.event === 'confirmation' && last.reason === 'pending_exists';
  // Wrong codes are the answers of the broker (invalid or replayed): a retry that is only too late (confirmation_expired)
  // or that finds nothing is not one.
  const wrongCodes = confirmations.filter((e) => e.errorCode === 'confirmation_failed' && (e.reason === undefined || e.reason === 'attempts_exhausted')).length;
  if (confirmations.length > 0 && !blocked) row.wrongCodeCount = wrongCodes;

  let result;
  let errorCode = null;
  if (last.event === 'confirmation') {
    // The TTL runs from the first event of the call (the pending call was created then), not from the last one.
    const startedAt = Date.parse((events.find((e) => e.decision === 'confirmation_pending') ?? first).ts) / 1000;
    const timedOut = now !== undefined && now - startedAt > TTL_SECONDS;
    // A wrong code (or a burned one) with attempts left decides nothing: the call still waits, and after the TTL it expired.
    const waiting = last.decision === 'confirmation_pending' || (last.reason === undefined || ['code_burned', 'authenticator_disabled', 'authenticator_not_registered'].includes(last.reason));
    if (last.reason === 'confirmation_expired') { result = 'expired'; }
    else if (waiting) { result = timedOut ? 'expired' : 'confirmation_pending'; }
    else {
      result = { superseded: 'superseded', attempts_exhausted: 'confirmation_failed', pending_exists: 'blocked_by_pending', cancelled_by_owner: 'cancelled' }[last.reason] ?? 'confirmation_failed';
      errorCode = last.errorCode ?? null;
    }
    if (result === 'expired' || result === 'confirmation_pending') errorCode = null;
  } else if (last.event === 'tool_call') {
    const confirmed = confirmations.some((e) => e.reason === 'user_confirmed' || e.reason === 'user_confirmed_no_preview');
    // The credential or the limit stopped the call after the gateway had allowed it: the row says so instead of a plain error (CC-142).
    const stopped = resultOfReason(last.reason, last.errorCode);
    if (last.outcome === 'ok') result = confirmed ? 'confirmed' : 'ok';
    else { result = stopped ?? 'error'; errorCode = last.errorCode ?? null; }
  } else {
    result = resultOfReason(last.reason, last.errorCode) ?? 'error';
    errorCode = last.errorCode ?? null;
  }
  row.result = result;
  row.errorCode = errorCode;
  return row;
}
