// An operation that accepts the mtls scheme must name the certificate CNs allowed to call it (x-allowed-client-cn);
// otherwise any client certificate from the internal CA would satisfy the security requirement. {registeredServerId} stands for
// the CN of any server in the registry (the policy data endpoint): the gateway compares the CN with the registry, not with a path.
export default function mtlsClientCn(operation) {
  const usesMtls = (operation?.security ?? []).some((requirement) => Object.hasOwn(requirement, 'mtls'));
  if (!usesMtls) return [];
  const cns = operation['x-allowed-client-cn'];
  if (!Array.isArray(cns) || cns.length === 0 || cns.some((cn) => typeof cn !== 'string' || !/^(mcp-[a-z0-9-]+(-\{serverId\})?|\{registeredServerId\})$/.test(cn))) {
    return [{ message: 'operation secured with mtls needs x-allowed-client-cn: non-empty list of mcp-* certificate CNs' }];
  }
  if (!operation.responses?.['403']) {
    return [{ message: 'operation secured with mtls needs a 403 response for a certificate with another CN' }];
  }
  return [];
}
