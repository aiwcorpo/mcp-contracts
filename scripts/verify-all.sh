#!/usr/bin/env bash
# Every check the CI runs, in one command: OpenAPI lint, JSON Schema and vector tests, TS build,
# MSW and WireMock drift checks (npm test) and Cedar validation and decision vectors (Maven).
set -euo pipefail
cd "$(dirname "$0")/.."
java_major() { "${JAVA_HOME:+$JAVA_HOME/bin/}java" -XshowSettings:properties -version 2>&1 | sed -n 's/.*java.specification.version = //p'; }
# The build needs Java 25; fall back to the Homebrew JDK when the current one is older.
if [ "$(java_major 2>/dev/null || echo 0)" -lt 25 ] 2>/dev/null && [ -d /opt/homebrew/Cellar/openjdk@25 ]; then
  JAVA_HOME="$(ls -d /opt/homebrew/Cellar/openjdk@25/*/libexec/openjdk.jdk/Contents/Home | tail -1)"
  export JAVA_HOME
fi
[ -d node_modules ] || npm ci
npm test
# clean: a jar built from a target/ that kept files deleted since the last build ships them (3.0.0 and 3.0.1 did).
./mvnw -B clean verify
node scripts/check-jar-contents.mjs
if [ "${SMOKE_WIREMOCK:-0}" = "1" ]; then
  ./scripts/smoke-wiremock.sh
fi
echo "mcp-contracts: all checks passed"
