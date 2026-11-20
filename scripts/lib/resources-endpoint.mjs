// Reference for the resources and prompts methods of the gateway (CC-259): which methods it answers, what it declares, the fields of
// the results per protocol era, the order of the checks of resources/read and prompts/get, and the answers. Used by the vectors in
// test-vectors/mcp-endpoint/resources-*; the gateway implements the same rules. Era is modern (MCP 2026-07-28) or legacy (2025-11-25).
import { gatewayAuthenticationResponse } from './gateway-authentication.mjs';
import { resolveUri } from './resource-uri.mjs';

export const SUPPORTED_METHODS = ['resources/list', 'resources/templates/list', 'resources/read', 'prompts/list', 'prompts/get'];

/**
 * What a method gets. The supported ones are handled. Everything else of the resources, prompts, completion, sampling, roots and
 * elicitation families stays as it was: -32601, HTTP 404 in the modern era and 200 in the legacy one (resources/subscribe included,
 * and completion/complete).
 */
export function methodAnswer(method, era) {
  if (SUPPORTED_METHODS.includes(method)) return { handled: true };
  return { handled: false, error: { code: -32601, message: 'Method not found' }, httpStatus: era === 'modern' ? 404 : 200 };
}

/** Declared always, whatever the registry holds; completions never. Modern in server/discover, legacy in initialize. */
export function capabilities(era) {
  return {
    declaredIn: era === 'modern' ? 'server/discover' : 'initialize',
    capabilities: { tools: { listChanged: true }, resources: { subscribe: false, listChanged: true }, prompts: { listChanged: true } },
  };
}

/**
 * The fields a result carries besides its own payload. Modern: the three lists are cacheable for 60 s, resources/read is not cached,
 * prompts/get is not a CacheableResult (resultType only); cacheScope is private everywhere because each answer depends on the
 * authorization of the request. Legacy: none of the fields.
 */
export function resultFields(method, era) {
  if (era !== 'modern') return {};
  if (method === 'prompts/get') return { resultType: 'complete' };
  if (method === 'resources/read') return { resultType: 'complete', ttlMs: 0, cacheScope: 'private' };
  return { resultType: 'complete', ttlMs: 60000, cacheScope: 'private' };
}

/** One answer for every refusal of a resource: the same bytes for an unknown URI, a refusal, a disabled entry, a filter, a switch. */
export const resourceNotFound = (uri) => ({ code: -32602, message: 'Resource not found', data: { uri } });
export const upstreamUnavailable = () => ({ code: -32603, message: 'Internal error', data: { error: 'upstream_unavailable' } });

/** Mcp-Name carries params.uri; a value outside ASCII is sent as =?base64?<base64 of UTF-8>?=. */
export function mcpNameValue(header) {
  const m = /^=\?base64\?([A-Za-z0-9+/]*={0,2})\?=$/.exec(header);
  return m ? Buffer.from(m[1], 'base64').toString('utf8') : header;
}

/**
 * Order of the checks of resources/read (CC-259). The token is checked before (a 401 never gets here). Input:
 *   era, header (the Mcp-Name value or null), uri, entries { resources, templates } (approved, with variables and idPattern),
 *   access: allowed | not_granted | policy_forbid   (registry entry in any state, then Cedar read_resource at resource level),
 *   inFilter, entry { approved, enabled, definitionMatches }, killSwitch: none | set | unreadable, serverAvailable,
 *   credential { required, connected, connectUrl, system } (templates only; a static resource never calls the broker),
 *   upstream { outcome: ok | error | input_required, contents, bytes }, maxBytes.
 * Steps 3 to 6 end in -32602 (D5); a header mismatch is -32020 in the modern era only.
 */
export function readDecision(input) {
  const { era, header, uri, entries, access = 'allowed', inFilter = true, entry = {}, killSwitch = 'none', serverAvailable = true, credential, upstream, maxBytes } = input;
  const denied = (auditReason, step) => ({ outcome: 'denied', error: resourceNotFound(uri), auditReason, step });
  const failed = (error, auditReason, step) => ({ outcome: 'error', error, auditReason, step });
  if (era === 'modern' && (header === null || header === undefined || mcpNameValue(header) !== uri)) {
    return failed({ code: -32020, message: 'Header mismatch' }, 'header_mismatch', 2);
  }
  const target = resolveUri(entries, uri);
  if (target.kind === null) return denied(target.reason, 3);
  if (access === 'not_granted') return denied('not_granted', 4);
  if (access === 'policy_forbid') return denied('policy_forbid', 4);
  if (!inFilter) return denied('filter_scope', 5);
  const state = { approved: true, enabled: true, definitionMatches: true, ...entry };
  if (killSwitch === 'unreadable') return failed(upstreamUnavailable(), 'upstream_unavailable', 6);
  if (killSwitch === 'set') return denied('kill_switch', 6);
  if (!state.approved || !state.enabled) return denied('not_granted', 6);
  if (!state.definitionMatches) return denied('definition_changed', 6);
  if (!serverAvailable) return failed(upstreamUnavailable(), 'upstream_unavailable', 7);
  if (target.kind === 'template' && credential?.required && !credential.connected) {
    return failed({ code: -32603, message: 'Internal error', data: { error: 'credential_required', system: credential.system, connectUrl: credential.connectUrl } }, 'credential_required', 8);
  }
  if (upstream.outcome !== 'ok') return failed(upstreamUnavailable(), 'upstream_unavailable', 9);
  const { contents } = upstream;
  if (!Array.isArray(contents) || contents.length !== 1 || contents[0].uri !== uri) return failed(upstreamUnavailable(), 'result_invalid', 10);
  if ('blob' in contents[0]) return failed(upstreamUnavailable(), 'blob_not_supported', 10);
  if (typeof contents[0].text !== 'string') return failed(upstreamUnavailable(), 'result_invalid', 10);
  if (upstream.bytes > maxBytes) return failed(upstreamUnavailable(), 'result_too_large', 10);
  return { outcome: 'ok', result: { contents }, step: 10 };
}

/**
 * Order of the checks of prompts/get: the prompt is known and mayGet (registry entry, Cedar get_prompt) allows it, the filter leaves
 * it, the state of the entry and the server (hidden: pending, not approved, disabled, kill switch; an unreadable store is -32603), and
 * only then the arguments (renderPrompt). The server is never called. `render` is the outcome of renderPrompt, given as input.
 */
export function promptGetDecision({ name, known = true, access = 'allowed', inFilter = true, hidden = false, killSwitch = 'none', render }) {
  const data = { name };
  const denied = (auditReason) => ({ outcome: 'denied', error: { code: -32602, message: 'Prompt not found', data }, auditReason });
  if (!known) return denied('not_granted');
  if (access === 'not_granted') return denied('not_granted');
  if (access === 'policy_forbid') return denied('policy_forbid');
  if (!inFilter) return denied('filter_scope');
  if (killSwitch === 'unreadable') return { outcome: 'error', error: upstreamUnavailable(), auditReason: 'upstream_unavailable' };
  if (killSwitch === 'set') return denied('kill_switch');
  if (hidden) return denied('not_granted');
  if (render.error) return { outcome: 'denied', error: render.error, auditReason: render.reason };
  return { outcome: 'ok', result: render.result };
}

/**
 * Blocks of a tools/call or resources/read result that point at a URI: a resource_link or an embedded resource whose scheme is not
 * the system of the server (an adapter: <system>+<foreign scheme>) is removed, with the audit reason link_scheme_refused. `blocks`
 * is [{ type, uri? , resource?: { uri } }].
 */
export function filterLinkBlocks({ system, adapter = false, blocks }) {
  const schemeOk = (uri) => {
    const scheme = typeof uri === 'string' ? uri.slice(0, uri.indexOf('://')) : '';
    return adapter ? scheme.startsWith(`${system}+`) : scheme === system;
  };
  const kept = [];
  let refused = false;
  for (const block of blocks) {
    const uri = block.type === 'resource_link' ? block.uri : block.type === 'resource' ? block.resource?.uri : undefined;
    if (block.type !== 'resource_link' && block.type !== 'resource') kept.push(block);
    else if (schemeOk(uri)) kept.push(block);
    else refused = true;
  }
  return { blocks: kept, ...(refused && { auditReason: 'link_scheme_refused' }) };
}

/** Over the limit every request but tools/call is the HTTP 429 of CC-156 (README, Rate limits); the audit reason is rate_limited_* . */
export function rateLimitedAnswer(retryAfterSeconds) {
  const { status, headers, body } = gatewayAuthenticationResponse({ reason: 'rate_limited', publicBaseUrl: 'https://mcp.aiwcorpo.pl', resourcePath: '/mcp', retryAfterSeconds });
  return { status, headers, body, auditReason: 'rate_limited_user' };
}
