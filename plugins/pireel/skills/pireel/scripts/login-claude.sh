#!/bin/sh
# Claude Code: authenticate the Pireel MCP server from an agent shell.
#
# `claude mcp login` opens the browser sign-in but insists on a terminal, and an agent's shell
# usually has none. This wraps the same command in a pseudo-terminal, runs it in the background
# and writes everything it prints to a log. Watch that log for the authorization URL (open it for
# the user when no browser opened) and for the line
#   Authenticated with "<server>"
# which is the only success signal; "Connected" alone is not.
#
# Usage: sh scripts/login-claude.sh [server-name] [log-path]
#   server-name  the name `claude mcp list` shows. Default: the first of the Plugin's namespaced
#                server and the standalone registration that the CLI knows about.
#   log-path     default /tmp/pireel-login.log
#
# Hosts that install the Plugin without a CLI-visible server (a desktop app's connector, e.g.
# Cowork) show nothing in `claude mcp list`; there the user reconnects the Pireel connector in the
# host's own UI and this script exits with a message instead of guessing.
PLUGIN_SERVER="plugin:pireel:pireel"
STANDALONE_SERVER="pireel"
SERVER="$1"
LOG="${2:-/tmp/pireel-login.log}"
if [ -z "$SERVER" ]; then
  KNOWN="$(claude mcp list 2>/dev/null)"
  for candidate in "$PLUGIN_SERVER" "$STANDALONE_SERVER"; do
    case "$KNOWN" in *"$candidate:"*) SERVER="$candidate"; break;; esac
  done
fi
if [ -z "$SERVER" ]; then
  echo "No Pireel MCP server is registered with the Claude Code CLI (looked for $PLUGIN_SERVER and $STANDALONE_SERVER)." >&2
  echo "Plugin from a desktop app connector: reconnect Pireel in that app's connector settings. Otherwise register first:" >&2
  echo "  claude mcp add --transport http $STANDALONE_SERVER <BASE>/api/studio/mcp" >&2
  exit 2
fi
python3 -c 'import pty, sys; pty.spawn(sys.argv[1:])' claude mcp login "$SERVER" > "$LOG" 2>&1 &
echo "$LOG"
