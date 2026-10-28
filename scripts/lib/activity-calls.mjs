// Reference aggregation of CC-095: the gateway audit events of ONE call (the first request and its retries with a
// code, linked by the gateway's internal confirmationId that is not part of C8) become one ActivityCall row.
export function aggregateCall(events) {
  const first = events[0];
  const row = { requestId: first.requestId, ts: first.ts };
  if (first.client) row.client = first.client;
  if (first.virtualServer) row.virtualServer = first.virtualServer;
  const withTool = events.find((e) => e.tool && e.server);
  if (withTool) row.tool = `${withTool.server.replace(/^mcp-/, '')}__${withTool.tool}`;
  const risk = events.find((e) => e.risk)?.risk;
  if (risk) row.risk = risk;
  const resource = events.find((e) => e.resource)?.resource;
  if (resource) row.resource = resource;

  const confirmations = events.filter((e) => e.event === 'confirmation');
  const wrongCodes = confirmations.filter((e) => e.errorCode === 'confirmation_failed').length;
  if (confirmations.length > 0) row.wrongCodeCount = wrongCodes;

  const last = events[events.length - 1];
  let result;
  let errorCode = null;
  if (last.event === 'confirmation') {
    result = {
      confirmation_pending: 'confirmation_pending', superseded: 'superseded', confirmation_expired: 'expired',
      attempts_exhausted: 'confirmation_failed',
    }[last.reason ?? (last.decision === 'confirmation_pending' ? 'confirmation_pending' : 'confirmation_failed')] ?? 'confirmation_failed';
    errorCode = last.errorCode ?? null;
  } else if (last.event === 'tool_call') {
    const confirmed = confirmations.some((e) => e.reason === 'user_confirmed' || e.reason === 'user_confirmed_no_preview');
    if (last.outcome === 'ok') result = confirmed ? 'confirmed' : 'ok';
    else { result = 'error'; errorCode = last.errorCode ?? null; }
  } else {
    result = {
      not_granted: 'denied_not_granted', link_scope: 'denied_link_scope', policy_forbid: 'denied_policy', tool_disabled: 'tool_disabled',
      credential_required: 'credential_required', rate_limited: 'rate_limited', step_up_required: 'step_up_required',
    }[last.reason] ?? 'error';
    errorCode = last.errorCode ?? null;
  }
  row.result = result;
  row.errorCode = errorCode;
  return row;
}
