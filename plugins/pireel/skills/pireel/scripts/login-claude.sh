#!/bin/sh
# Claude Code: authenticate the Pireel Plugin's MCP server from an agent shell.
#
# `claude mcp login` opens the browser sign-in but insists on a terminal, and an agent's shell
# usually has none. This wraps the same command in a pseudo-terminal, runs it in the background and
# writes everything it prints to a log. Watch that log for the authorization URL (open it for the
# user when the browser did not open on its own) and for the line
#   Authenticated with "plugin:pireel:pireel"
# which is the only success signal; "Connected" alone is not.
#
# Usage: sh scripts/login-claude.sh [log-path]        (default /tmp/pireel-login.log)
LOG="${1:-/tmp/pireel-login.log}"
python3 -c 'import pty, sys; pty.spawn(sys.argv[1:])' claude mcp login plugin:pireel:pireel > "$LOG" 2>&1 &
echo "$LOG"
