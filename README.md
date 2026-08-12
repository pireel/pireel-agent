# Pireel agent plugin

Connect **Codex**, **Claude Code**, or another compatible AI agent to
[Pireel Studio](https://pireel.com).

Use the agent to understand your footage, clean up a talking-head video, turn a
long recording into shorter clips, add captions and visual elements, or prepare
different versions for different platforms.

[Read the setup guide](https://pireel.com/connect-agent.md)

## Install

For supported agents:

```bash
npx skills add pireel/pireel-agent
```

Then tell your agent:

> Set up Pireel and help me edit my first video.

The agent will guide you through sign-in and importing media.

### Claude Code

You can also connect Claude Code directly:

```bash
claude mcp add --transport http pireel https://pireel.com/api/studio/mcp
```

For the full guided editing workflow, install the Pireel Skill with
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

```bash
npx skills update pireel
```

Re-running `npx skills add pireel/pireel-agent` also updates the installation.

## Usage and credits

The agent uses your existing AI agent subscription for the editing conversation.
Optional Pireel generation features may use Pireel credits and are identified
before they are run.

## License

Apache-2.0 — see [LICENSE](./LICENSE). © Pireel.
