---
name: getting-started
description: FIRST-RUN setup for Pireel Studio. Run this whenever the user asks to install, connect, set up, or start using Pireel, or when a `pireel` MCP tool fails because the server is not connected yet. Registers the Pireel MCP server, drives the OAuth login, imports the user's first video, opens the live editor, and prints a self-report. After setup, route work through `pireel-basics` and the task skills.
---

# Getting started with Pireel Studio

Pireel Studio (https://pireel.com) is an AI video editor for **talking-head videos** (any aspect — the canvas follows the source footage). Through the `pireel` MCP server your tools edit the composition **live in a studio browser tab**: transcript-based cutting, storyboarding, designed graphics, subtitles, themes, local media import.

If you are reading this, the Pireel skill is already installed on this machine. This connects the MCP server and gets the user to their first edit. Complete **ALL steps in order** — setup is incomplete until you print the self-report in the final step.

**If you JUST installed the skill this turn: do NOT stop.** A freshly-installed skill only auto-activates in a *new* session, but this file is already on disk — read it and run the steps below **now, in the same turn**. Never end your turn at "the skill will be available next time" or tell the user to start a new conversation; keep going straight into Step 1.

**Base URL** (`<BASE>` below): `https://pireel.com`, unless the user runs Pireel locally, in which case use their localhost origin (e.g. `http://localhost:3005`).

**Host gate**: you must be on the user's LOCAL machine (desktop app or a local CLI with shell access to their agent config). In a web / remote sandbox you cannot edit the MCP client config — tell the user to run their agent locally and re-invoke this skill there.

**Sandbox rule**: your shell sandbox may block ALL network (even localhost). Run network commands out of sandbox (request approval instead of attempting a sandboxed run first). NEVER conclude the Pireel server is down from a sandboxed `curl` — your MCP connection and `mcp login` do not go through the shell sandbox and work regardless.

## Step 1 — Register the Pireel MCP server

MCP endpoint: `<BASE>/api/studio/mcp` (streamable HTTP, stateless).

- **Codex** (plugin already installed via `npx skills add`): `codex mcp login pireel`. If the server is not registered yet, add it to `~/.codex/config.toml` first — the `oauth_resource` line is REQUIRED (without it Codex expects a static bearer token instead of OAuth):

  ```toml
  [mcp_servers.pireel]
  url = "<BASE>/api/studio/mcp"
  oauth_resource = "<BASE>/api/studio/mcp"
  ```

- **Claude Code**:

  ```bash
  claude mcp add --transport http pireel <BASE>/api/studio/mcp
  ```

- **Other MCP clients**: register a streamable-HTTP server at the endpoint above. OAuth discovery is standard (RFC 8414 / 9728 metadata at `<BASE>/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`).

## Step 2 — Authenticate (OAuth)

No API keys. The endpoint answers unauthenticated calls with a `WWW-Authenticate` challenge; the MCP client discovers the OAuth flow from it automatically.

- **Codex**: `codex mcp login pireel` opens the browser sign-in; the user logs into their Pireel account and approves.
- **Claude Code**: the client prompts on first use (or via `/mcp`) — follow the browser flow.

## Step 3 — Verify the connection

Call `get_state` and interpret:

- `<composition_state>` snapshot → the user's studio tab is open and bridged; fully connected.
- `OFFLINE MODE` snapshot → connected; no tab, but data-level editing works against the user's latest cloud project.
- `no cloud project` → connected; fresh account. Go to Step 4.
- HTTP 401 after OAuth → re-run the login flow; the token may not have been granted.

## Step 4 — REQUIRED final step: start the first task

Ask the user how to start, then do it:

**Open the live editor FIRST** (both paths need a tab; the local-video path streams the bytes straight into it): call `create_browser_handoff` (pass the `project_id`, or omit for a fresh project) and open the returned `url` with **your own built-in/embedded browser tool** — the browser whose pages you can see and control. NEVER open it via the OS `open`/`start`/`xdg-open`, the user's default browser, or an already-connected external Chrome: the ticket is single-use (~60 s) and spending it on a surface you cannot see wastes it. Then **keep that tab visible and open past this turn** so it isn't auto-cleaned right after you open it — use your browser tool's visibility + keep-tab controls (on Codex, drive the in-app browser through the Node REPL `js` `browser`/`tab` API — `tab.goto(url)`, visibility via `browser.capabilities.get("visibility").set(true)`, keep-tab via `browser.documentation()` — never `open`/external tools; see `pireel-basics.md`). To hand the user a link, give the plain `<BASE>/zh/studio/<projectId>` instead — never the handoff URL.

**A. From a local video file** (most common) — with the tab open from above. Two ways, both keep the video local (no upload):

- **Primary — the helper**: `import_media` with NO args → `token` → run `node <helper> --base <BASE> --token <token> /path/to/video.mp4` (bundled at `<pireel-skill-dir>/scripts/import-media.mjs`, or `curl -fsSL <BASE>/import-media.mjs`; install `ffmpeg`/`ffprobe` yourself if missing). It streams the video into the open tab over the user's machine (not uploaded), transcribes, and registers a project in one shot. If it reports `studio_not_open`, redo the handoff and re-run.
- **Fallback — inject it directly** (helper unavailable, and you drive the browser): `await tab.playwright.setInputFiles('[data-pireel-video-input]', '/absolute/path/video.mp4')`. The studio loads it locally into its OPFS library and makes it the main video. Then call `extract_asr` for the transcript.

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

Setup done. Return to the `pireel` skill router and read the matching sibling reference next: `pireel-basics.md` (mental model + tool routing) first, then `captions.md` / `storyboard-draft.md` / `compose-blocks.md` / `export.md` / `talking-head-cleanup.md` / `product-help.md` / `known-errors.md` as the task calls for. Full setup contract and troubleshooting also lives at https://pireel.com/connect-agent.md.

## Billing note

Agent orchestration and all BYO text/HTML generation burn **the user's own agent subscription**, not Pireel credits. Pireel bills only media generation (images/video) and the audio/vision pipelines (transcription, visual analysis).
