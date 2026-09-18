# Releasing the Pireel agent plugin

Maintainer notes. Agents and users should read [README.md](./README.md) instead — nothing here
is needed to install or use the plugin.

## The shape of this repo

**`develop` is the source. `main` is the build output.** Nothing on the published branch is
written by hand, and the only hand-written version anywhere is `version` in `package.json`.
Preview and local plugins are built on a tester's machine and never published (see below).

```
develop                                  main
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

Three channels, one version, one published branch. They differ only by **identity**, and every
identity file is generated:

| Channel | Branch | Plugin id | Marketplace | MCP server | Base URL |
|---|---|---|---|---|---|
| production | `main` | `pireel` | `pireel-marketplace` | `pireel` | https://pireel.com |
| preview | — (never published; `pnpm pack:preview`) | `pireel-preview` | `pireel-preview` | `pireel-preview` | https://preview.pireel.com |
| local | — (never published) | `pireel-local` | `pireel-local` | `pireel-local` | http://localhost:3005 (`--base-url` / `PIREEL_LOCAL_BASE_URL`) |

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
2. Test it first against the preview environment: `pnpm pack:preview`, install the archive or the
   marketplace directory (see "Testing against preview or a local server" below), point the preview
   server at the matching app commit.
3. Run the **release a channel** workflow (Actions → *release a channel*) with `source: develop`.
   It opens a pull request against `main`. The diff is exactly what publishes. Review it and
   merge — **merging is the release.**

Nothing pushes to `main` outside this flow; protect the branch and require pull requests.

## Testing against preview or a local server

The `preview` and `local` channels exist for testers: each installs the plugin under its own id next
to the published one, so a test session can never end up talking to production. Same-named installs are
exactly how that used to happen — a host keys plugin identity by name, keeps one of two installs,
and the session inherits the survivor's MCP server.

```bash
pnpm pack:preview                              # → .local/preview/ and .local/pireel-preview.plugin
pnpm pack:local                                # → .local/local/   and .local/pireel-local.plugin
node scripts/pack-channel.mjs local --base-url http://localhost:4010          # another port

# Claude Code / Codex: the channel directory is a local marketplace
claude plugin marketplace add "$(pwd)/.local/preview" && claude plugin install pireel-preview@pireel-preview
codex plugin marketplace add "$(pwd)/.local/preview" && codex plugin add pireel-preview@pireel-preview
codex plugin marketplace add "$(pwd)/.local/local" && codex plugin add pireel-local@pireel-local
```

The preview plugin registers its own `pireel-preview` MCP server, so it coexists with a production
`pireel` install without routing work into the wrong environment. Log in with `claude mcp login
plugin:pireel-preview:pireel-preview` / `codex mcp login pireel-preview`. A marketplace already
added from another path is refused and the plugin then installs from a stale cache: run
`codex plugin remove pireel-preview@pireel-preview` and `codex plugin marketplace remove
pireel-preview` first. Start a new session after installing or updating.

Cowork installs plugins from an archive (`.zip` / `.plugin`) rather than a marketplace: add the
`.plugin` file through "Add a plugin … from a .zip or .plugin archive". Its tasks run in a sandbox,
so the `local` channel's `http://localhost:3005` is not reachable from there — use `preview`.

Start the dev server (`pnpm dev` in the app repo), open a new chat, run `mcp login pireel-local`
and call `get_state`: the request must show up in the dev server log, and the published `pireel`
plugin keeps working unchanged in the same host. Rebuild after editing skills; the host picks up the
new files on the next session.

## Order of operations

Deploy the server before the plugin reaches users when a release adds new server tools: the skill
must not reference tools that are not live yet.

## Commands

```bash
node scripts/build-channel.mjs production            # build the channel into this tree
node scripts/build-channel.mjs production --check    # verify this tree IS that build (CI)
node scripts/pack-channel.mjs <preview|local>        # never-published channels, out of tree
```

The build is idempotent and reads the version only from `package.json` — a version typed into a
manifest by hand is overwritten, never honoured. `--check` re-runs the build and rejects any
difference, which is how `main` is held to being pure build output.

## CI

- **channel guard** (push to `main`, and PRs into it): re-runs the production build and fails on
  any difference; then checks the agent-facing skill text names only that environment.
  (`README.md` documents every channel on purpose and is not scanned.)
- **release a channel** (manual): the workflow above.

Note that a pull request opened by the release workflow uses the default `GITHUB_TOKEN`, so its
checks do not fire automatically; the workflow runs `--check` itself before opening the PR, and the
channel guard runs again on push after the merge.
