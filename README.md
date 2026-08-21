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
  manager. The Plugin version is managed independently from the workflow baseline.
- **Standalone Skill:** run:

```bash
npx skills update pireel
```

Re-running `npx skills add pireel/pireel-agent` also updates a standalone installation.

When a standalone user moves to a host that supports Plugins, install and verify the matching
Pireel Plugin first. Only then retire the standalone Skill and manual MCP registration; never
remove the working connection before the Plugin endpoint succeeds.

## Release channels

Plugin SemVer and the MCP/Skill workflow baseline are separate. Their only editable source is
`release/channels.json`; do not hand-edit `plugin.json` or the Skill `VERSION` during a release.

Preview release:

```bash
node scripts/release-channel.mjs preview \
  --plugin-version 0.8.0-preview.1 \
  --workflow-version 2026-08-21.2
```

Stable promotion (run after the shared workflow has landed on `main`):

```bash
node scripts/release-channel.mjs production \
  --plugin-version 0.8.0 \
  --workflow-version 2026-08-21.2
```

The script refuses the wrong branch and Preview/stable SemVer mixups, then synchronizes the
channel manifest, Plugin manifest, and bundled Skill baseline. CI runs the matching `--check`
command and separately verifies endpoint isolation.

## Usage and credits

The agent uses your existing AI agent subscription for the editing conversation.
Optional Pireel generation features may use Pireel credits and are identified
before they are run.

## License

Apache-2.0 — see [LICENSE](./LICENSE). © Pireel.
