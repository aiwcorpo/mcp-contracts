// A CN template with {serverId} (x-allowed-client-cn) only makes sense where the route names the server: the path item must
// declare a path parameter serverId, otherwise the gateway has nothing to compare the CN with.
export default function cnTemplateParameter(pathItem) {
  const methods = ['get', 'put', 'post', 'delete', 'patch'];
  const templated = methods.some((m) => (pathItem?.[m]?.['x-allowed-client-cn'] ?? []).some((cn) => typeof cn === 'string' && cn.includes('{serverId}')));
  if (!templated) return [];
  const declared = (parameters) => (parameters ?? []).some((p) => p?.in === 'path' && (p.name === 'serverId' || String(p.$ref ?? '').endsWith('/ServerId')));
  if (declared(pathItem.parameters) || methods.some((m) => declared(pathItem[m]?.parameters))) return [];
  return [{ message: 'a CN template with {serverId} needs a path parameter serverId' }];
}
