#!/bin/bash
# Session start, cloud sessions only. Gets a fresh cloud machine ready:
#  - the site's packages (npm install) and the test tools (tests/requirements.txt), so the tests run straight away;
#  - the reverse-engineering tools: REA (rea-agents 6.5.0) and Ghidra 12.1.4, so the session can take programs apart.
#    Ghidra comes from this repository's release "ghidra-12.1.4" — an unchanged copy of the official file, made by
#    .github/workflows/ghidra-mirror.yml — and its SHA-256 is checked before it's unpacked. Nothing on the site uses it.
# Safe to run again: whatever is already in place is left alone. A failed step is reported, never stops the session.
set -uo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = true ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
GH=/opt/ghidra_12.1.4_PUBLIC JDK=/usr/lib/jvm/java-21-openjdk-amd64 LOG=/tmp/nooi-session-start.log
ZIP=https://github.com/Bonasib/nooi.ai/releases/download/ghidra-12.1.4/ghidra_12.1.4_PUBLIC_20260921.zip
SUM=ddac49f903da9d5bac833e5cc79395098b9c33cfd3279be5f31bd00387d2d4db
failed=()
step() { local name=$1; shift; echo "▶ $name" >> "$LOG"; "$@" >> "$LOG" 2>&1 || failed+=("$name"); }

ghidra() {
  [ -x "$GH/support/analyzeHeadless" ] && return 0
  local tmp; tmp=$(mktemp -d /opt/.ghidra-dl.XXXXXX) || return 1
  curl -fsSL --retry 3 -o "$tmp/ghidra.zip" "$ZIP" && echo "$SUM  $tmp/ghidra.zip" | sha256sum -c - &&
    unzip -q "$tmp/ghidra.zip" -d "$tmp/x" && rm -rf "$GH" && mv "$tmp/x/ghidra_12.1.4_PUBLIC" "$GH"
  local rc=$?; rm -rf "$tmp"; return $rc
}
rea_tool() { [ "$(rea --version 2> /dev/null)" = 6.5.0 ] || npm install --global --no-audit --no-fund rea-agents@6.5.0; }
rea_link() { GHIDRA_INSTALL_DIR=$GH JAVA_HOME=$JDK rea setup --client claude_code --yes > /dev/null; }

step "site packages" npm install --no-audit --no-fund
step "test tools" pip install -q -r tests/requirements.txt
step "REA" rea_tool
step "Ghidra 12.1.4" ghidra
[ -x "$GH/support/analyzeHeadless" ] && command -v rea > /dev/null && step "REA ↔ Ghidra" rea_link
[ -n "${CLAUDE_ENV_FILE:-}" ] && printf 'export GHIDRA_INSTALL_DIR=%s\nexport JAVA_HOME=%s\n' "$GH" "$JDK" >> "$CLAUDE_ENV_FILE"

if [ ${#failed[@]} -eq 0 ]; then
  echo "Session ready: site packages and test tools installed; the rea command (REA 6.5.0) works with Ghidra 12.1.4 at $GH and Java 21 (GHIDRA_INSTALL_DIR and JAVA_HOME are set)."
else
  echo "Session start: these steps failed — ${failed[*]} — see $LOG."
fi
exit 0
