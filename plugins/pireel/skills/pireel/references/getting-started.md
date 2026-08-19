---
name: getting-started
description: FIRST-RUN setup for Pireel Studio Preview. Run this whenever the user asks to install, connect, set up, or start using Pireel Preview, or when a `pireel-preview` MCP tool fails because the server is not connected yet. Registers the Preview MCP server, drives the OAuth login, imports the user's first video, opens the live editor, and prints a self-report. After setup, route work through `pireel-basics` and the task skills.
---

# Getting started with Pireel Studio

Pireel Studio Preview (https://preview.pireel.com) is a multi-source AI video editor for producing one or more independently editable cuts. Through the `pireel-preview` MCP server your tools edit the composition **live in a studio browser tab**: transcript-based cutting, montage, storyboarding, designed graphics, subtitles, themes and local media import.

If you are reading this, the Pireel workflow is already available either from the Pireel Plugin or as a standalone Skill. This connects the MCP server when needed and gets the user to their first edit. Complete **ALL steps in order** — setup is incomplete until you print the self-report in the final step.

**If you JUST installed the skill this turn: do NOT stop.** A freshly-installed skill only auto-activates in a *new* session, but this file is already on disk — read it and run the steps below **now, in the same turn**. Never end your turn at "the skill will be available next time" or tell the user to start a new conversation; keep going straight into Step 1.

**Base URL** (`<BASE>` below): `https://preview.pireel.com`, unless the user explicitly asks to run Pireel locally, in which case use their localhost origin (e.g. `http://localhost:3005`). Never substitute the production origin while this Preview plugin is active.

**Host gate**: if Pireel MCP tools are already available through the installed Plugin, continue on any supported host. Web/mobile/remote hosts can work with cloud projects, stock media and server-side tools, but cannot read a path on the user's computer or edit its local agent config. A LOCAL desktop/CLI host is required only when registering MCP for a standalone Skill or importing local-file bytes through the helper.

**Sandbox rule**: on a host with shell access, the shell sandbox may block ALL network (even localhost). Run required network commands out of sandbox (request approval instead of attempting a sandboxed run first). NEVER conclude the Pireel server is down from a sandboxed `curl` — Plugin/MCP connections do not go through that shell sandbox.

## Step 1 — Use or register the Pireel MCP server

MCP endpoint: `<BASE>/api/studio/mcp` (streamable HTTP, stateless).

- **Pireel Plugin:** the bundled `.mcp.json` registers the server. If Pireel tools are already available, do not edit agent config and continue to Step 2. If the Plugin is installed but its tools are absent, start a new chat/session once so the host can load the bundle; do not install a second standalone copy to compensate.

- **Standalone Skill on Codex:** run `codex mcp login pireel-preview`. If the server is not registered yet, add it to `~/.codex/config.toml` first — the `oauth_resource` line is REQUIRED (without it Codex expects a static bearer token instead of OAuth):

  ```toml
  [mcp_servers.pireel-preview]
  url = "<BASE>/api/studio/mcp"
  oauth_resource = "<BASE>/api/studio/mcp"
  ```

- **Claude Code**:

  ```bash
  claude mcp add --transport http pireel-preview <BASE>/api/studio/mcp
  ```

- **Other MCP clients**: register a streamable-HTTP server at the endpoint above. OAuth discovery is standard (RFC 8414 / 9728 metadata at `<BASE>/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`).

## Step 2 — Authenticate (OAuth)

No API keys. The endpoint answers unauthenticated calls with a `WWW-Authenticate` challenge; the MCP client discovers the OAuth flow from it automatically.

- **Codex**: `codex mcp login pireel-preview` opens the browser sign-in; the user logs into their Pireel Preview account and approves.
- **Claude Code**: the client prompts on first use (or via `/mcp`) — follow the browser flow.

## Step 3 — Verify the connection

Call `get_state` and interpret:

- `<composition_state>` snapshot → the user's studio tab is open and bridged; fully connected.
- `OFFLINE MODE` snapshot → connected; no tab, but data-level editing works against the user's latest cloud project.
- `no cloud project` → connected; fresh account. Go to Step 4.
- HTTP 401 after OAuth → re-run the login flow; the token may not have been granted.

## Step 4 — REQUIRED final step: start the first task

Ask the user how to start, then do it:

**Open the live editor FIRST** (both paths need a tab; the local-video path streams the bytes straight into it): call `create_browser_handoff` and open the returned `url` in a browser surface you can control. Never use OS `open`/`start`/`xdg-open` or an uncontrolled default browser: the ticket is single-use (~60 s). For LOCAL helper imports the browser must share the agent host's `127.0.0.1`; on Codex, prefer connected Chrome when available because the in-app browser may isolate loopback. For cloud-only setup, prefer the embedded browser. Keep the selected tab open using that browser runtime's keep/finalize controls. To hand the user a link, give the plain `<BASE>/zh/studio/<projectId>` instead — never the handoff URL.

**A. From a local video file** (most common) — with the tab open from above. Two ways, both keep the video local (no upload):

- **Primary — the helper**: `import_media` with NO args → `token` + `base_url` → run `node <helper> --base <base_url> --token <token> /path/to/video.mp4` (bundled at `<pireel-skill-dir>/scripts/import-media.mjs`, or `curl -fsSL <base_url>/import-media.mjs`; install `ffmpeg`/`ffprobe` yourself if missing). Use the returned `base_url` exactly so preview connections never fall through to production. It streams the video into the open tab over the user's machine (not uploaded), transcribes, and registers a project in one shot. If it reports `studio_not_open`, redo the handoff and re-run.
- **Fallback — inject it directly** (helper unavailable, and you drive the browser): start `tab.playwright.waitForEvent('filechooser')`, click `tab.playwright.locator('[data-pireel-video-trigger]')`, then pass the absolute path to the returned chooser's `setFiles(...)`. The studio loads it locally into its OPFS library and makes it the main video. Then call `extract_asr` for the transcript.

Then `get_state` and edit. See the `asset-import` skill for the full transfer matrix.

**B. From the browser**: the user opens `<BASE>`, creates a studio project and uploads a video there; the live bridge connects automatically.

## Self-report (print this when done)

```
Pireel setup complete:
- MCP server: registered (<client name>)
- Auth: OAuth ✓ (account <email if known>)
- get_state: <connected live / offline mode / fresh account>
- ffmpeg: <available / installed now / degraded>
- First task: <imported <file> → project "<title>" (N transcript sentences) / awaiting user>
```

## Next

Setup done. Return to the `pireel` skill router and read the matching sibling reference next: `pireel-basics.md` (mental model + tool routing) first, then `captions.md` / `storyboard-draft.md` / `compose-blocks.md` / `export.md` / `talking-head-cleanup.md` / `product-help.md` / `known-errors.md` as the task calls for. Full setup contract and troubleshooting also lives at https://preview.pireel.com/connect-agent.md.

## Billing note

Agent orchestration and all BYO text/HTML generation burn **the user's own agent subscription**, not Pireel credits. Pireel bills only media generation (images/video) and the audio/vision pipelines (transcription, visual analysis).
