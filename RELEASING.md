# Releasing the Pireel agent plugin

Maintainer notes. Agents and users should read [README.md](./README.md) instead — nothing here
is needed to install or use the plugin.

## The shape of this repo

**`develop` is the source. `main` and `preview` are build outputs.** Nothing on a published branch
is written by hand, and the only hand-written version anywhere is `version` in `package.json`.

```
develop                                  main / preview
─────────────────────────────────────    ────────────────────────────────────────────
package.json          ← the version      everything from develop, renamed to the channel's
release/channels.json ← identities         plugin id, plus:
plugins/pireel/                            plugins/<id>/.mcp.json
  .codex-plugin/plugin.json                plugins/<id>/.codex-plugin/plugin.json    (stamped)
    (no name, no version, no URLs)         plugins/<id>/skills/pireel/VERSION
  skills/  assets/                         plugins/<id>-claude/…                     (Claude Code)
scripts/build-channel.mjs                  .agents/plugins/marketplace.json          (Codex)
                                           .claude-plugin/marketplace.json           (Claude Code)
                                           skill text worded for that environment
                                           release/built-from.json                   (provenance)
```

Two channels, one version. They differ only by **identity**, and every identity file is generated:

| Channel | Branch | Plugin id | Marketplace | MCP server | Base URL |
|---|---|---|---|---|---|
| production | `main` | `pireel` | `pireel-marketplace` | `pireel` | https://pireel.com |
| preview | `preview` | `pireel-preview` | `pireel-preview` | `pireel-preview` | https://preview.pireel.com |

The plugin id is what a host registers the bundle under, and it names the published directory
(`plugins/<id>/`, `plugins/<id>-claude/`). The two channels must not share it: a host that keys
plugin identity by name keeps one of two same-named installs and drops the other, so a session ends
up holding the surviving channel's MCP server. Production keeps the bare name, which leaves installs
already out there untouched; changing a channel's id makes its existing installs stale and users
have to reinstall it once.

Two hosts, one plugin. Codex reads `.codex-plugin/plugin.json` with `mcpServers` pointing at
`./.mcp.json`; Claude Code reads `.claude-plugin/plugin.json` with the server inlined and no Agent
Plugins `interface` block. Both are produced from the one authored manifest, so the skills they
ship are byte-identical.

## What the generated manifests tell the server

Both generated manifests set two request headers on the MCP server:

| Header | Value |
|---|---|
| `x-pireel-distribution` | `plugin` |
| `x-pireel-host` | `codex` or `claude-code` |

A manual MCP registration or a standalone Skill sends neither. The server uses that to skip the
workflow-baseline reminder for Plugin installs — their host already owns updates, and a release
deploys the server before publishing the plugin, so the reminder would otherwise point at a version
that is not published yet. The same two axes make distribution × host countable server-side without
any client reporting.

## Releasing

1. On `develop`: make the change. If it should reach users as a new version, bump `version` in
   `package.json` — that is the whole version step.
2. Run the **release a channel** workflow (Actions → *release a channel*), choosing:
   - `channel`: `preview` or `production`
   - `source`: `develop`, or `preview` to **promote** what preview already validated
3. It opens a pull request against that channel's branch. The diff is exactly what publishes.
   Review it and merge — **merging is the release.**

Promoting `preview` does not copy preview's files (those carry the preview identity). It reads
`release/built-from.json`, finds the source commit preview was built from, and rebuilds production
from that same commit — so production ships the content preview actually validated.

Nothing pushes to `main` or `preview` outside this flow; protect both branches and require pull
requests.

## Order of operations

Deploy the server before the plugin reaches users when a release adds new server tools: the skill
must not reference tools that are not live yet.

## Commands

```bash
node scripts/build-channel.mjs <production|preview>           # build the channel into this tree
node scripts/build-channel.mjs <production|preview> --check   # verify this tree IS that build (CI)
```

The build is idempotent and reads the version only from `package.json` — a version typed into a
manifest by hand is overwritten, never honoured. `--check` re-runs the build and rejects any
difference, which is how `main` and `preview` are held to being pure build output.

## CI

- **channel guard** (push to `main`/`preview`, and PRs into them): re-runs the build for that
  branch's channel and fails on any difference; then checks the agent-facing skill text names only
  that environment. (`README.md` documents both channels on purpose and is not scanned.)
- **release a channel** (manual): the workflow above.

Note that a pull request opened by the release workflow uses the default `GITHUB_TOKEN`, so its
checks do not fire automatically; the workflow runs `--check` itself before opening the PR, and the
channel guard runs again on push after the merge.
