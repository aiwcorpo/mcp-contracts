// Reference of what a pulled manifest leaves in the registry (CC-193, CC-206, CC-249). Used by the vectors in test-vectors/adapter-registry.

/**
 * `serverMode` is what the registry holds for the server: adapter or starter; null when the server is being added, then it is derived from the
 * `source` of the first manifest (`manifestSource`: adapter, or null for a starter manifest). A later manifest whose source disagrees with
 * the stored mode is refused like any invalid manifest and changes nothing (manifest_invalid, adapter_source_mismatch).
 * `tools` is [{ name, risk (the risk the entry would have as a starter entry), state: new | changed | unchanged | removed }].
 * `runtimeRead` true is the difference the gateway finds when it reads tools/list of a running server (not a manifest pull).
 * Nothing is approved by a pull or by a read: every new or changed tool is pending, a READ_ONLY one included (CC-249).
 */
export function manifestPullDecision({ serverMode = null, manifestSource = null, tools = [], runtimeRead = false }) {
  if (runtimeRead) return pending(tools, serverMode === 'adapter' ? 'adapter' : 'server');
  const sourceMode = manifestSource === 'adapter' ? 'adapter' : 'starter';
  if (serverMode !== null && serverMode !== sourceMode) {
    return { stored: false, lastError: 'manifest_invalid', manifestReason: 'adapter_source_mismatch' };
  }
  // A tool missing from the manifest of an adapter is removed with its classification (CC-207): when it returns it is new and unclassified.
  if (sourceMode === 'adapter') return { stored: true, adapter: true, ...pending(tools, 'adapter'), removed: removed(tools), classificationLost: removed(tools) };
  return { stored: true, adapter: false, ...pending(tools, 'manifest'), removed: removed(tools) };
}

const removed = (tools) => tools.filter((t) => t.state === 'removed').map((t) => t.name);

function pending(tools, source) {
  return { approvedByPull: [], pending: tools.filter((t) => t.state === 'new' || t.state === 'changed').map((t) => t.name), pendingSource: source };
}
