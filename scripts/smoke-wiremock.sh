#!/usr/bin/env bash
# Starts the generated WireMock stubs in Docker and checks a few contract responses.
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE="wiremock/wiremock:3.13.2"
BROKER_PORT=18081
ADMIN_PORT=18082
cleanup() { docker rm -f mcp-contracts-broker-mock mcp-contracts-admin-mock >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
docker run -d --name mcp-contracts-broker-mock -p "$BROKER_PORT:8080" \
  -v "$PWD/mocks/wiremock/credential-broker:/home/wiremock:ro" "$IMAGE" >/dev/null
docker run -d --name mcp-contracts-admin-mock -p "$ADMIN_PORT:8080" \
  -v "$PWD/mocks/wiremock/gateway-admin:/home/wiremock:ro" "$IMAGE" >/dev/null
for port in "$BROKER_PORT" "$ADMIN_PORT"; do
  for _ in $(seq 1 60); do
    curl -fs "http://localhost:$port/__admin/health" >/dev/null 2>&1 && break
    sleep 1
  done
done

expect() {
  local want="$1"; shift
  local got
  got=$(curl -s -o /dev/null -w '%{http_code}' "$@")
  if [ "$got" != "$want" ]; then
    echo "FAIL: expected $want, got $got for: $*" >&2
    exit 1
  fi
  echo "ok $want $*"
}

B="http://localhost:$BROKER_PORT"
A="http://localhost:$ADMIN_PORT"
expect 200 -X POST "$B/v1/credentials/resolve" -H 'Authorization: Bearer test' -H 'Content-Type: application/json' -d '{"system":"jira"}'
expect 409 -X POST "$B/v1/credentials/resolve" -H 'Authorization: Bearer test' -H 'Prefer: example=credential_required' -d '{"system":"jira"}'
expect 401 -X POST "$B/v1/credentials/resolve" -d '{"system":"jira"}'
expect 422 -X PUT "$B/v1/connections/jira/secret" -H 'Authorization: Bearer test' -H 'Prefer: example=identity_mismatch' -d '{"secret":"x"}'
expect 204 -X POST "$B/v1/admin/users/6f1c2a9e/purge"
expect 200 "$A/admin/v1/catalog" -H 'Authorization: Bearer test'
expect 201 -X POST "$A/admin/v1/virtual-servers" -H 'Authorization: Bearer test' -d '{}'
expect 409 -X POST "$A/admin/v1/registry/servers/mcp-jira/tools/update_issue/approve" -H 'Authorization: Bearer test' -H 'Prefer: example=hash_mismatch' -d '{}'
expect 200 -X PUT "$A/admin/v1/registry/servers/mcp-jira" -d '{}'
echo "WireMock smoke test passed"
