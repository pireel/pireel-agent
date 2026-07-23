# Pireel agent plugin

Connect **Codex**, **Claude Code**, or any MCP-capable agent to [Pireel Studio](https://pireel.com) — an AI video editor for talking-head videos (the canvas follows your source footage). Your agent gets the full Studio toolset: transcript-based cutting, storyboarding, designed graphics, subtitles, themes, and local media import.

When a studio tab is open, edits land **live on the canvas**. When it isn't, data-level tools keep working against the cloud project (offline mode); video-dependent tools ask for the tab.

Hosted setup guide (agent-readable): **https://pireel.com/connect-agent.md**

## Install

### Quickest — any agent (Codex, Claude Code, Cursor, Cline, Gemini CLI…)

```bash
npx skills add pireel/pireel-agent
```

This installs a **single `pireel` skill** (its detailed playbooks are bundled as on-demand `references/`, so your skills list stays clean — one entry, not ten). Then tell your agent **"set up Pireel"** — the skill registers the MCP server, drives the OAuth login, and imports your first video.

### Claude Code (MCP only)

```bash
claude mcp add --transport http pireel https://pireel.com/api/studio/mcp
```

Claude Code prompts for OAuth on first use. For the `pireel` skill, use `npx skills add` above or copy `pireel/skills/pireel/` into `.claude/skills/`.

## Update

Run `npx skills update pireel` (or re-run `npx skills add pireel/pireel-agent`). There's also a built-in nudge: on connect the Pireel MCP server announces its current skill baseline, so if your installed skill is older, the agent tells you to update.

## Verify

Ask the agent to call `get_state`:

- Composition snapshot → connected to the live studio tab.
- `OFFLINE MODE` snapshot → connected; editing the latest cloud project directly.
- `no cloud project` → connected; import a video or create a project to begin.

## Import local video

Point the agent at a local file path — the import flow (`references/asset-import.md`) uploads it (content-addressed, ≤ 2 GB), probes metadata and transcribes audio when `ffmpeg` is available, and registers a project. Transcript-based editing works immediately, before any browser is opened.

## Billing

Agent orchestration and every BYO flow (`compose_block_brief` → generate → `apply_block`, `plan_brief` → `submit_plan`, `visual_brief` → `submit_visual`) run on **your own agent subscription**, not Pireel credits. Only tools whose description carries a `[…CHARGES…]` marker bill Pireel credits (image/video generation and the Pireel-LLM fallbacks).

## What's inside

- `pireel/.mcp.json` — MCP server registration (OAuth).
- `pireel/skills/pireel/SKILL.md` — the single `pireel` skill: essentials + a router to the bundled references (keeps your skills list to one entry).
- `pireel/skills/pireel/references/` — on-demand playbooks the skill reads per task: `getting-started` (first-run MCP connect + OAuth + first import), `pireel-basics` (model + tool routing), `asset-import`, `talking-head-cleanup`, `compose-blocks`, `storyboard-draft`, `captions`, `export`, `product-help`, `known-errors`.
- `pireel/skills/pireel/scripts/import-media.mjs` — the local media import helper (Node ≥ 20, zero dependencies).

## License

Apache-2.0 — see [LICENSE](./LICENSE). © Pireel.
