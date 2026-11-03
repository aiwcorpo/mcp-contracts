#!/usr/bin/env bash
# Every check the CI runs, in one command: OpenAPI lint, JSON Schema and vector tests, TS build,
# MSW and WireMock drift checks (npm test) and Cedar validation and decision vectors (Maven).
# Runs on Linux and macOS with bash 3.2+; Windows only through WSL2.
set -euo pipefail
cd "$(dirname "$0")/.."

java_major() {
  local java_bin="$1"
  "$java_bin" -XshowSettings:properties -version 2>&1 | sed -n 's/.*java.specification.version = //p' | head -n 1
}

# True when the given JAVA_HOME-style directory holds a JDK of at least major 25.
jdk_is_25() {
  local home="$1" major
  [ -x "$home/bin/java" ] || return 1
  major="$(java_major "$home/bin/java" 2>/dev/null || true)"
  [ -n "$major" ] && [ "${major%%.*}" -ge 25 ] 2>/dev/null
}

# The build needs Java 25. Keep the current JDK when it is new enough, otherwise look at the usual install
# locations; the first hit wins. Set JAVA_HOME to a JDK 25 to skip the search.
select_jdk() {
  local candidate
  if [ -n "${JAVA_HOME:-}" ] && jdk_is_25 "$JAVA_HOME"; then
    return 0
  fi
  if command -v java >/dev/null 2>&1; then
    candidate="$(dirname "$(dirname "$(command -v java)")")"
    if jdk_is_25 "$candidate"; then
      JAVA_HOME="$candidate"; export JAVA_HOME
      return 0
    fi
  fi
  if [ -x /usr/libexec/java_home ]; then
    candidate="$(/usr/libexec/java_home -v 25 2>/dev/null || true)"
    if [ -n "$candidate" ] && jdk_is_25 "$candidate"; then
      JAVA_HOME="$candidate"; export JAVA_HOME
      return 0
    fi
  fi
  if command -v brew >/dev/null 2>&1; then
    candidate="$(brew --prefix openjdk@25 2>/dev/null || true)"
    for candidate in "$candidate/libexec/openjdk.jdk/Contents/Home" "$candidate/libexec"; do
      if jdk_is_25 "$candidate"; then
        JAVA_HOME="$candidate"; export JAVA_HOME
        return 0
      fi
    done
  fi
  for candidate in /usr/lib/jvm/*25* "$HOME"/.sdkman/candidates/java/25* "$HOME"/.jdks/*25*; do
    if jdk_is_25 "$candidate"; then
      JAVA_HOME="$candidate"; export JAVA_HOME
      return 0
    fi
  done
  echo "verify-all: JDK 25 not found; set JAVA_HOME to a JDK 25" >&2
  return 1
}

select_jdk
PATH="$JAVA_HOME/bin:$PATH"; export PATH

[ -d node_modules ] || npm ci
npm test
# clean: a jar built from a target/ that kept files deleted since the last build ships them (3.0.0 and 3.0.1 did).
./mvnw -B clean verify
node scripts/check-jar-contents.mjs
if [ "${SMOKE_WIREMOCK:-0}" = "1" ]; then
  ./scripts/smoke-wiremock.sh
fi
echo "mcp-contracts: all checks passed"
