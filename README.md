# Pireel agent plugin

Connect **Codex**, **Claude Code**, or another compatible AI agent to the
isolated [Pireel Studio Preview](https://preview.pireel.com) environment.

Use the agent to understand your footage, clean up a talking-head video, turn a
long recording into shorter clips, add captions and visual elements, or prepare
different versions for different platforms.

[Read the setup guide](https://preview.pireel.com/connect-agent.md)

## Install as a Plugin

In the Codex desktop app, open **Plugins**, install **Pireel Studio** when it is
available in your plugin directory, then start a new chat. The Plugin bundles the
Pireel workflow and authenticated MCP connection.

For repository-marketplace testing in Codex CLI:

```bash
codex plugin marketplace add https://github.com/pireel/pireel-agent
codex plugin add pireel@pireel-marketplace
```

To test the unreleased Plugin against the isolated Pireel Preview environment,
install the repository's `preview` branch as a separate marketplace:

```bash
codex plugin marketplace add pireel/pireel-agent --ref preview
codex plugin add pireel@pireel-preview
```

The Preview plugin registers the independent `pireel-preview` MCP server, so it
can coexist with a production `pireel` connection without silently routing work
to the wrong environment. Start a new chat after installing or updating so the
host loads the new Plugin and MCP configuration.

Then tell your agent:

> Set up Pireel and help me edit my first video.

The Plugin guides you through sign-in and importing media.

## Install as a standalone Skill

Use this route for Codex IDE and other Agent Skills-compatible hosts:

```bash
npx skills add pireel/pireel-agent
```

The standalone Skill uses the same workflow but registers the Pireel MCP server
through the host's own MCP configuration.

### Claude Code

You can also connect Claude Code directly:

```bash
claude mcp add --transport http pireel-preview https://preview.pireel.com/api/studio/mcp
```

For the full guided editing workflow, install the standalone Pireel Skill with
`npx skills add`.

## What you can ask

- “Remove pauses and repeated sentences from this talking-head video.”
- “Turn this recording into three short clips with different hooks.”
- “Add readable captions and highlight the key ideas.”
- “Create a product demo from these screen recordings and images.”
- “Make a vertical version for social media.”
- “Give this video a cleaner editorial visual style.”
- “Export the final version.”

When Pireel Studio is open, you can watch supported edits appear in the editor.
Some preparation tasks can also continue without keeping the Studio tab open.

## Update

- **Plugin installation:** update or reinstall Pireel through the host's Plugins
  manager. One release version covers both the Plugin manifest and the bundled Skill.
- **Standalone Skill:** run:

```bash
npx skills update pireel
```

Re-running `npx skills add pireel/pireel-agent` also updates a standalone installation.

When a standalone user moves to a host that supports Plugins, install and verify the matching
Pireel Plugin first. Only then retire the standalone Skill and manual MCP registration; never
remove the working connection before the Plugin endpoint succeeds.

## Release channels

Each channel has **one** release version. `release/channels.json` is the only editable source; do
not hand-edit `plugin.json` or the Skill `VERSION` during a release. The script writes the same
SemVer into the Plugin manifest (what the host orders upgrades by) and the bundled Skill `VERSION`
(what the MCP server announces and the agent compares for equality), and records a content digest
of the skill tree so CI can tell when skill files were edited without a release.

Preview release (on the `preview` branch):

```bash
node scripts/release-channel.mjs preview --bump prerelease   # 0.7.1-preview.1 -> 0.7.1-preview.2
node scripts/release-channel.mjs preview --bump patch        # start a new line: 0.7.2-preview.1
node scripts/release-channel.mjs preview --version 0.8.0-preview.1   # or name it explicitly
```

Stable promotion (on `main`, after the shared workflow has landed there):

```bash
node scripts/release-channel.mjs production --bump patch     # 0.7.2 -> 0.7.3
node scripts/release-channel.mjs production --version 0.8.0  # or name it explicitly
```

`--bump` takes `patch`, `minor`, `major` (a preview line restarts at `-preview.1`) or `prerelease`
(preview only, advances `N`). The script refuses the wrong branch, Preview/stable SemVer mixups,
and any version that is not strictly greater than the channel's current one — a host only upgrades
forward within a channel. `--check` (run by CI) recomputes the skill digest and verifies the
channel, Plugin manifest, Skill `VERSION`, marketplace and MCP endpoint all agree; `--digest`
prints the current skill digest. Production and preview are independent version lines and are
never compared with each other.

### Syncing the preview line

The `preview` branch differs from the source line only by its **identity** — the `pireel-preview`
MCP server, `preview.pireel.com` endpoints and "Pireel Studio Preview" wording — so an agent can
never confuse environments. Its skill content must otherwise match byte for byte. Never edit skill
files on `preview` by hand; refresh it from the source line and release:

```bash
git checkout preview
node scripts/sync-preview.mjs --from develop     # copy skills + README, apply the preview identity
node scripts/sync-preview.mjs --verify develop   # prove only identity differs
node scripts/release-channel.mjs preview --bump prerelease
```

`--from` aborts if an identity anchor it expects is missing (the source wording moved — update the
rule, don't hand-patch). `.mcp.json`, `plugin.json`, `marketplace.json` and the Skill `VERSION` are
branch-owned and never synced.

### Releasing through a pull request

The `skill version guard` workflow fails a pull request whose skill tree changed without a moved
version, and the release script refuses to run for a channel from any other branch. To release
via a PR, prepare the release on the source branch with the branch override, commit, and open the
PR — the guard sees the moved version and passes; merging is the release:

```bash
PIREEL_RELEASE_BRANCH=main node scripts/release-channel.mjs production --bump patch
git commit -am "release: production 0.7.3"
```

## Usage and credits

The agent uses your existing AI agent subscription for the editing conversation.
Optional Pireel generation features may use Pireel credits and are identified
before they are run.

## License

Apache-2.0 — see [LICENSE](./LICENSE). © Pireel.
