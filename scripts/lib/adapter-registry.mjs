// Reference of the registry rules for servers served by an adapter (CC-193, CC-206). Used by the vectors in test-vectors/adapter-registry.

/**
 * Which channel may submit a manifest and what it leaves in the registry.
 * `serverMode` is gateway configuration for the serverId: adapter or starter. `channel` is the operation: registerServer (ci) or
 * submitAdapterManifest (adapter). `cn` is the CN of the client certificate. `manifestSource` is the `source` of the manifest.
 * `tools` is [{ name, risk (the risk the entry would have as a starter entry), state: new | changed | unchanged }].
 * `runtimeRead` true is the difference the gateway finds when it reads tools/list of a running server (not a submission).
 */
export function submissionDecision({ serverId, serverMode, channel, cn, manifestSource = null, tools = [], runtimeRead = false }) {
  if (runtimeRead) return pending(tools, serverMode === 'adapter' ? 'adapter' : 'server');
  const expectedCn = channel === 'adapter' ? `mcp-adapter-${serverId}` : `mcp-registry-ci-${serverId}`;
  if (cn !== expectedCn) return { status: 403, audit: 'client_certificate_rejected', stored: false };
  const adapterChannel = channel === 'adapter';
  if ((serverMode === 'adapter') !== adapterChannel || (manifestSource === 'adapter') !== adapterChannel) {
    return { status: 422, reason: 'adapter_mode_mismatch', stored: false };
  }
  if (adapterChannel) return { status: 200, stored: true, ...pending(tools, 'adapter') };
  return {
    status: 200,
    stored: true,
    approvedByCall: tools.filter((t) => t.state !== 'unchanged' && t.risk === 'READ_ONLY').map((t) => t.name),
    pending: tools.filter((t) => t.state !== 'unchanged' && t.risk !== 'READ_ONLY').map((t) => t.name),
    pendingSource: 'ci',
  };
}

// Nothing of an adapter is approved by a call or by a read: every new or changed tool waits for the administrator, whatever it looks like.
function pending(tools, source) {
  return { approvedByCall: [], pending: tools.filter((t) => t.state !== 'unchanged').map((t) => t.name), pendingSource: source };
}
