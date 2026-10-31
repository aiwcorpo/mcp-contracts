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
 * `rawQuery` is the query of the BFF request (the four filter parameters, nothing else); `catalog` is the catalog of the
 * current user from C5: [{ name, risk, access: "granted" | "denied", disabled }]. Only granted, enabled tools are counted.
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
