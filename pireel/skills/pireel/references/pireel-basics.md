---
name: pireel-basics
description: Core mental model and tool routing for editing videos in Pireel Studio over MCP. Read this FIRST whenever the user asks to edit, cut, storyboard, illustrate, caption, or theme a Pireel video, or whenever any pireel MCP tool is about to be called for the first time in a session. Covers blocks vs shots, the two clocks, get_state discipline, the BYO-brain generation flow, and which tool handles which request.
---

# Pireel Studio basics

Pireel Studio (https://pireel.com) is a video editor for **talking-head videos** (any aspect — the canvas follows the source footage). Through the `pireel` MCP server your tools edit the composition **live in an open studio browser tab**: the timeline updates on screen as you work. You can open that tab YOURSELF: call `create_browser_handoff` and open the returned `url` with your OWN built-in/embedded browser tool — the browser whose pages you can see and control. NEVER open it via the OS `open` command or the user's default browser: the ticket is single-use, so spending it on a surface you cannot see wastes it and leaves you blind. The tab is pre-signed-in (no login screen) and becomes the live editing surface. Surface the editor early on substantial work: the user watches every edit land in real time. The handoff URL expires in ~60s — open it immediately, never print it to the user (it carries a sign-in ticket; share plain `https://pireel.com/zh/studio/<id>` links instead).

**Keep the editor in YOUR browser, visible, and open — get this right the first time.** Three failure modes that make you look broken to the user:
1. **Wrong surface.** Opening the handoff URL means opening it in the browser YOU can see and control. Do NOT let it route to an already-connected external Chrome or the user's default browser — if a Chrome tab is already bridged, opening there leaves you blind and the user sees their own browser being driven. Force it into your OWN embedded browser.
2. **Not visible.** After opening, make your browser **visible** so the user watches every edit land — use your browser tool's visibility control.
3. **Auto-closed at turn end.** Many embedded browsers clean up tabs when your turn finishes — that yanks the editor out from under the user right after you opened it. **Mark the Pireel tab to persist** using your tool's keep-tab / finalize-with-keep control. Never close-and-reopen the Pireel tab between edits; open it once, keep it.

These are your host's own browser-runtime controls, not Pireel MCP tools — use whatever your tool exposes. **On Codex specifically:** the in-app browser is driven ONLY through the Node REPL `js` tool and its `browser`/`tab` API — do NOT use `open`, external MCP browser tools, or the user's default browser (that is exactly how the handoff leaks to the wrong Chrome). Navigate with `tab.goto(<url>)` (don't re-`goto` the same URL). Make it visible with `await (await browser.capabilities.get("visibility")).set(true)`. For persisting the tab past the turn, call `await browser.documentation()` and use the keep/finalize command it lists (the exact name isn't in OpenAI's public API docs, so read it from the runtime rather than guessing). Codex's own rule is to *show* the browser when the user should watch the page — which is exactly this case: they watch edits land.

The MCP endpoint is `https://pireel.com/api/studio/mcp`. Auth is OAuth — the agent's `mcp login` / first-use flow opens the browser; there are no API keys. On HTTP 401, re-run the OAuth login.

## The composition: two kinds of elements

- **Overlay blocks** — designed graphic fragments laid over the video: metric cards, comparisons, charts, flow/structure diagrams, KPIs, callouts, titles. Designed graphics are the main event of a Pireel video. Blocks marked `待配图` in state are **placeholders**: empty slots dropped by `lay_out`, waiting to be filled with a generated graphic.
- **Video shots** — segments of the talking-head clip, each with a framing *treatment*: `full` (full screen), `punch-in` (zoom for emphasis), `corner-br` / `corner-tl` (shrink to a corner to make room for graphics), `split-l` / `split-r` (video takes one half, graphics take the other). Shot boundaries are hard jump cuts; visual variety comes from framing changes, not transitions.

## The two clocks (get this wrong and cuts land in the wrong place)

1. **Source seconds** — a source file's own clock. The spoken transcript (`read_script` / `extract_asr`) is timestamped in MAIN-source seconds, and those timestamps **never shift when the video is cut**. Fetch the transcript once; it stays valid the whole session.
2. **Edited seconds** — the final-timeline clock. `cut_range`, `split_shot`, `trim_shot`, `move_block`, `resize_block`, `atSec` parameters all address THIS clock. Every cut shifts later content earlier.

`cut_narration` is the bridge: pass it transcript (source-second) ranges and it converts to the edited timeline itself, cuts the footage, compresses overlays, and re-lays captions.

Shots tagged `[clip X]` in state were inserted from a **different source file**: their `src` times belong to that file, not the narration transcript. Transcript-based cutting never touches them — cut inside them with `cut_range` (edited seconds) or drop them with `delete_shot`.

## State discipline

- **Always call `get_state` before your first edit**, and again whenever you are unsure what the timeline looks like. Every mutation invalidates your previous snapshot. Tool receipts describe what each call changed — trust them for the ids they mention.
- The transcript is NOT in `get_state`. Fetch it via `read_script` (or reuse an `extract_asr` receipt). Don't call both; don't re-fetch it after cuts (source clock, remember).
- `get_state` also reports a **Pipeline line** (transcript / narration plan / visual analysis done or not) — use it to skip pipeline stages that already ran.
- Never invent block/shot ids. Only use ids from `get_state` or tool receipts.

## You are the model (BYO-brain — the default generation path)

All text/HTML generation is done by YOUR model, not Pireel's:

- **Block HTML** (fill a placeholder / rewrite a block / new element): `compose_block_brief` → it returns the full `{system, prompt}` contract → generate the response yourself following it exactly (one short note, then a ```html fence, then a ```js fence) → submit the raw text via `apply_block`. If `apply_block` rejects with lint issues, fix ONLY those issues and re-apply. See the `compose-blocks` skill.
- **Icons**: `get_icons {names}` returns inline SVGs — never hand-draw semantic icons, no emoji on canvas.
- **Narration planning**: `plan_brief` → generate the DraftPlan JSON yourself per its contract → `submit_plan` → `lay_out` consumes it. See the `storyboard-draft` skill.

Four tools run **Pireel's own LLM and charge the account's credits**: `add_block`, `edit_block`, `add_graphics`, `analyze_narration`. They are fallbacks ONLY — use them if the BYO flow fails repeatedly, never as the first choice.

## Tool routing table

| Request | Tools |
| --- | --- |
| What's on the timeline? | `get_state` |
| What does the speaker say? | `read_script` (main narration + inserted clips; `extract_asr` if no transcript yet) |
| Move / retime an overlay | `move_block`, `resize_block` |
| Remove overlays | `delete_block`, `delete_blocks` (several in one call) |
| Copy an overlay | `duplicate_block` |
| Inspect a block's actual HTML/animation | `get_block` (before precise edits or content questions) |
| Show the user an element | `focus_element` (after creating/changing something) |
| New graphic / rewrite a graphic | `compose_block_brief` → generate → `apply_block` (fallback: `add_block` / `edit_block`, burns credits) |
| Video framing / zoom | `set_shot_treatment` |
| Cut video at a point / trim an end | `split_shot`, `trim_shot` |
| Remove a whole shot | `delete_shot` |
| Remove an edited-timeline range (or inside a `[clip X]`) | `cut_range` |
| Remove spoken passages by the script | `cut_narration` (source-second ranges, ONE call for all ranges) |
| Judgment-based speech cleanup (fillers, retakes, tighten) | `read_editing_guide` once, then its workflow — or use the `talking-head-cleanup` skill directly |
| Subtitles on/off/restyle | `set_captions` (18 presets), `remove_captions` — see the `captions` skill |
| Themes | `list_frames` → `attach_frame` → `read_frame {frame_id}` |
| Full draft from a fresh video | pipeline in the `storyboard-draft` skill |
| Open the live editor (your browser, pre-signed-in) | `create_browser_handoff` → open `url` in the built-in browser |
| User rejects a change | `undo` (one step per call; doesn't cover the user's manual drags) |

## Patience with slow tools

`extract_asr` and `analyze_visual` run **in the user's browser** and can take minutes (visual analysis is frame-by-frame). A slow response is not a failure — do not retry just because a call takes long. Card-type tools have a 10-minute bridge timeout; instant operations time out at 60s.

## Local media import

When the user points at a LOCAL video file path, load the `asset-import` skill — its helper streams the main video straight into the OPEN studio tab over the user's machine (no cloud upload; a tab must be open first) and registers it on a project via `import_media`, with optional ffprobe metadata and transcription (only the small transcription audio goes to the cloud). Never tell the user to manually upload in the browser as the first answer.

## Seeing and offline mode

- `capture_frame {atSec}` renders one frame (video + framing + overlays) as an image — your eyes. Verify visual work after `apply_block`, caption, or framing changes, then fix what looks wrong. Needs the studio tab open.
- When the tab is closed, data-level tools (cuts, block edits, captions, BYO compose/apply, plan) run in OFFLINE MODE against the user's most recently updated cloud project (results carry `offline: true`); video-dependent tools (`extract_asr`, `visual_brief`, `analyze_visual`, `capture_frame`, `lay_out`, `export_video`, Pireel-LLM generation) need the tab — open one yourself with `create_browser_handoff` (built-in browser) before falling back to asking the user.

## When to ask the user instead of acting

- The request is ambiguous or names an element that doesn't exist — ask ONE short clarifying question, don't guess.
- Aggressive shortening, restructuring, highlight/short-version, or a generated hook — confirm target length, structure, and what to preserve BEFORE cutting.
- Before the FIRST full-draft pipeline run, recommend 1–2 fitting frames from `list_frames` and let the user pick (or skip). Never block small edits on this question. When you recommend themes, also mention the user can browse and filter the FULL theme library themselves in the studio's assets / components panel.
- PROJECTS (no browser): offline tools act on your ACTIVE project = the most-recently-touched one. `list_projects` shows all (newest first = active); `switch_project {project_id}` makes a different one active and returns its state; `create_project` starts a fresh empty one (immediately active); `rename_project` retitles. If get_state reports "no cloud project", call `create_project` (or `import_media`) — don't send the user to a browser just to create one.
- `studio_not_open` / `studio_tab_closed` — first try opening a tab yourself (`create_browser_handoff` → built-in browser); only ask the user to open/re-focus the project if you have no embedded browser.

## Talking to the user

Explain edits by the actual spoken words ("cut the half-sentence that got re-recorded"), never by internal ids or raw timestamps — the user can't see those. After creating or visibly changing an element, call `focus_element` so the user is looking at the result. Billing note if asked: only tools whose description carries a [CHARGES] marker bill Pireel credits (media generation and the Pireel-LLM fallbacks); your orchestration and every BYO flow cost the user nothing — details in the product-help skill.
