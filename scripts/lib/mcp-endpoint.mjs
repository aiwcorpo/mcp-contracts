// Reference for GET /api/v1/me/mcp-endpoint of the portal BFF (CC-175): the address of the aggregate endpoint for a
// filter, the client configurations and the number of tools. The BFF normalizes with the filter of the gateway, so
// there is one source of the canonical address.
import { applyFilter, parseFilter, InvalidFilter } from './endpoint-filter.mjs';

export const CLIENT_CONFIG_NAME = 'aiwcorpo-mcp';

export function clientConfigs(url) {
  return {
    claudeCode: `claude mcp add --transport http ${CLIENT_CONFIG_NAME} "${url}"`,
    copilot: JSON.stringify({ servers: { [CLIENT_CONFIG_NAME]: { type: 'http', url } } }),
    codex: `[mcp_servers.${CLIENT_CONFIG_NAME}]\nurl = "${url}"\n`,
  };
}

/**
 * CC-182: the BFF receives the four parameters as typed values of the OpenAPI operation, already decoded by the HTTP layer
 * (`systems=jira%2Cgitlab` arrives as `jira,gitlab`), and composes the query itself: `name=value` joined with `&`, nothing
 * encoded again. A decoded value that contains `&` or `=` would change the structure of the query, so it is written as
 * `%26` / `%3D`, which the parser refuses: the filter is invalid, never a different one. `pairs` is URLSearchParams or a list
 * of [name, value]. A parameter outside the four is refused before this (the mock and the BFF answer invalid_filter).
 */
export function composeQuery(pairs) {
  return [...pairs].map(([name, value]) => `${name}=${value.replaceAll('&', '%26').replaceAll('=', '%3D')}`).join('&');
}

/**
 * `rawQuery` is the query the BFF composed from the decoded values of its four parameters (`composeQuery`); `catalog` is the flat list the
 * BFF builds from servers[].tools[] of GET /admin/v1/catalog (C5) for the current user: [{ name, risk, access: "granted" | "denied", disabled }]. Only granted, enabled tools are counted.
 */
export function mcpEndpoint({ publicBaseUrl, rawQuery, catalog }) {
  let parsed;
  try {
    parsed = parseFilter(rawQuery);
  } catch (e) {
    if (!(e instanceof InvalidFilter)) throw e;
    return { status: 400, body: { error: 'invalid_request', reason: 'invalid_filter', message: 'The filter is not valid.' } };
  }
  const callable = catalog.filter((t) => t.access === 'granted' && !t.disabled).map(({ name, risk }) => ({ name, risk }));
  const url = parsed.canonical === '' ? `${publicBaseUrl}/mcp` : `${publicBaseUrl}/mcp?${parsed.canonical}`;
  return {
    status: 200,
    body: {
      url,
      ...(parsed.canonical !== '' && { filter: parsed.canonical }),
      toolCount: applyFilter(parsed.filter, callable).length,
      clientConfigs: clientConfigs(url),
    },
  };
}
