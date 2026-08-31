---
name: pireel-basics
description: Core mental model and tool routing for editing videos in Pireel Studio over MCP. Read this FIRST whenever the user asks to edit, cut, storyboard, illustrate, caption, or theme a Pireel video, or whenever any pireel MCP tool is about to be called for the first time in a session. Covers blocks vs shots, the two clocks, get_state discipline, the BYO-brain generation flow, and which tool handles which request.
---

# Pireel Studio basics

Pireel Studio (https://pireel.com) is a multi-source, multi-track video editor for speech-led edits, lessons, product stories, ads and montages. Through the `pireel` MCP server your tools edit the composition **live in an open studio browser tab**: the timeline updates on screen as you work. Call `create_browser_handoff` and open the returned `url` with your own built-in/embedded browser tool. On Codex, use the in-app Browser runtime first; never spend the single-use ticket through OS `open`, the user's default browser, or connected Chrome proactively. Keep the tab visible and open. Only an explicit `local loopback is unreachable from this browser` result permits one retry in a controllable connected browser that shares the agent host's loopback. The handoff expires in ~60s; open it immediately and never print it to the user.

**Keep the editor in YOUR browser, visible, and open — get this right the first time.** Three failure modes that make you look broken to the user:
1. **Wrong surface.** Opening the handoff URL means opening it in your own built-in/embedded browser. On Codex, use the in-app Browser runtime first. Never route it to connected Chrome or an uncontrolled default browser unless the in-app helper attempt has already returned the explicit loopback error.
2. **Not visible.** After opening, make your browser **visible** so the user watches every edit land — use your browser tool's visibility control.
3. **Auto-closed at turn end.** Many embedded browsers clean up tabs when your turn finishes — that yanks the editor out from under the user right after you opened it. **Mark the Pireel tab to persist** using your tool's keep-tab / finalize-with-keep control. Never close-and-reopen the Pireel tab between edits; open it once, keep it.

These are your host's own browser-runtime controls, not Pireel MCP tools — use whatever your tool exposes. **On Codex specifically:** drive the in-app browser through the official Browser runtime / Node REPL, navigate with the selected tab's `goto`, make it visible, and follow the runtime's documented keep/finalize behavior. Never use OS `open` or select connected Chrome preemptively. A controllable connected browser is only the one-retry fallback after the exact loopback-unreachable error.

The MCP endpoint is `https://pireel.com/api/studio/mcp`. Auth is OAuth — the agent's `mcp login` / first-use flow opens the browser; there are no API keys. On HTTP 401, re-run the OAuth login for `pireel`.

## The composition: timeline layers inside designed Scenes

- **Components / overlay blocks** — Component is the broad extensible visual-element concept. Motion Graphics are its primary current family: kinetic words, one-number reveals, data stories, logo stings, overlays and real-source highlights. The editor stores Components as blocks. They are layers inside a composed Scene, not the Scene itself.
- **Video shots** — segments of source video with editable framing. Familiar full/punch/corner/split treatments are convenience recipes, not the design vocabulary. Scene design may combine custom transforms, crops, media, type and Motion Graphics. A hard cut is only one valid boundary; continuity, motivated match/action changes and restrained transitions are derived from adjacent Scene designs rather than added as decoration.
- **Typed timeline clips** — narrative, ordinary visual media, graphics, audio and captions live on explicit tracks. `get_timeline` is the canonical read surface; generic insert/move/resize/split/delete operations address selected clips rather than assuming one special main lane.
- **Director Scenes** — a saved complete-edit plan divides the viewing experience by changes in viewer task or visual anchor. Each Scene inherits one whole-film design system and owns the timeline layers that execute it. `scene-designs.md` then persists each Scene's open whole-canvas composition, temporal choreography and handoff before those ideas are compiled into atomic edits.

## The two clocks (get this wrong and cuts land in the wrong place)

1. **Source seconds** — a source file's own clock. The spoken transcript returned by `read_script` is timestamped in MAIN-source seconds, and those timestamps **never shift when the video is cut**. Fetch the transcript once; it stays valid the whole session.
2. **Edited seconds** — the final-timeline clock. `cut_range`, `split_shot`, `trim_shot`, `move_block`, `resize_block`, `atSec` parameters all address THIS clock. Every cut shifts later content earlier.

`cut_narration` is the bridge: pass it transcript (source-second) ranges and it converts to the edited timeline itself, cuts the footage, compresses overlays, and re-lays captions.

Shots tagged `[clip X]` in state were inserted from a **different source file**: their `src` times belong to that file, not the narration transcript. Transcript-based cutting never touches them — cut inside them with `cut_range` (edited seconds) or drop them with `delete_shot`.

## State discipline

- **Always call `get_state` before your first edit**, and again whenever you are unsure what the timeline looks like. Every mutation invalidates your previous snapshot. Tool receipts describe what each call changed — trust them for the ids they mention.
- The transcript is NOT in `get_state`. Fetch it once via `read_script`; it returns stored text or transcribes when missing. Don't re-fetch it after cuts (source clock, remember).
- Never invent block/shot ids. Only use ids from `get_state` or tool receipts.

## Account Studio Skills and bound voices

Studio Skills belong to the authenticated Pireel account and are separate from this installed MCP workflow Skill. When the user names one, call `list_skills` to resolve its exact id, then `read_skill` and follow the returned playbook as a whole. `list_skills` returns metadata only; private instructions are disclosed only by the explicit account-scoped read. The playbook describes editorial judgment and acceptance criteria, while the MCP tools remain stable general capabilities—never translate internal function names or model parameters into the Skill contract.

If the selected Studio Skill explicitly binds a named voice, that binding is the user's voice choice for this workflow. Call `list_voices` with the exact name to resolve its stable `voiceId`; if exactly one ready match exists, use it with `generate_speech` without asking the user to pick the same voice again. If it is missing, ambiguous, or not ready, report that concrete blocker. Keep script approval, billing, and performance-direction behavior governed by the selected Skill and the charge warning on `generate_speech`.

## You are the model (BYO-brain — the default generation path)

For a complete edit, read `storyboard-draft.md` before mutating the timeline. It defines the shared whole-film method: inspect the material, propose a creative thesis/rhythm/video design system, delivery safe-area contract and Scene progression, wait for approval, persist it with `set_director_plan`, progressively author whole-canvas Scene designs with `set_scene_designs`, compile them into the timeline, then review temporal states, boundaries and sound. Read persisted artifacts by affected `sceneIds`; load the whole file only for a whole-edit audit.

All text/HTML generation is done by YOUR model, not Pireel's:

- **Component content** (rewrite / new element): first decide the actual Scene, timing, placement, backdrop and protected subjects; `compose_block_brief` → it returns the full `{system, prompt}` contract with real box and design context → generate the response yourself → submit it via `apply_block` with the returned target unchanged. If lint rejects it, fix only those issues and re-apply. See `compose-blocks.md`.
- **Icons**: `get_icons {names}` returns inline SVGs — never hand-draw semantic icons, no emoji on canvas.

Hosted generation tools whose descriptions carry a charge marker use Pireel credits. `add_block` and `edit_block` are fallbacks for agents that cannot perform the BYO brief/apply flow. `analyze_visual {mode:"geometry"}` keeps scene cuts, subject/face tracks and safe-region measurement in the browser with no model tokens; use semantic mode when content, evidence, material choice or complete-edit direction depends on what the pixels mean. Never trade needed semantic judgment for geometry merely to save tokens, and never infer charging from a remembered list—read the current tool description.

## Tool routing table

| Request | Tools |
| --- | --- |
| What's on the timeline? | `get_state` |
| Use a private/community Studio Skill | `list_skills` → `read_skill` |
| Resolve a Skill-bound voice | `list_voices {query:<exact name>}` → `generate_speech {voiceId}` |
| What does the speaker say? | `read_script` (main narration + inserted clips; automatically transcribes missing speech) |
| Move / retime an overlay | `move_block`, `resize_block` |
| Reposition / resize an overlay ON SCREEN (into a corner, off the speaker's face) | `place_block` (anchor or % coords; each block's current zone shows in `get_state`) |
| Remove overlays | `delete_block`, `delete_blocks` (several in one call) |
| Copy an overlay | `duplicate_block` |
| Inspect a block's actual HTML/animation | `get_block` (before precise edits or content questions) |
| Show the user an element | `focus_element` (after creating/changing something) |
| New graphic / rewrite a graphic | Decide Scene/timing/placement/backdrop → `compose_block_brief` → generate → `apply_block` (fallback: hosted `add_block` / `edit_block`) |
| Video framing / zoom | `set_shot_treatment` |
| Color-grade a shot | `set_video_filter` (brightness/contrast/saturate, 1 = untouched) |
| Shot sound — quiet or mute a shot's own audio (e.g. B-roll under narration) | `set_shot_audio` (`volumeDb` -60..0 and/or `mute`; batch via `shotIds`/`all:true`) |
| Find a described reusable asset (name/category/mood/use case) | `search_assets` across `mine` / `cloud` / `official` (works with the tab closed; use returned locators, never invent a URL) |
| What media has the user uploaded? | `list_assets` (works with the tab closed; use its urls for block images / `insert_clip`) |
| Find a spoken topic already present in the current `read_script` result | Reason over the numbered transcript rows directly; do not call a lexical search tool |
| Retrieve a spoken/visual moment missing from current context (cold/truncated transcript, multiple sources, visual labels) | `search_media` (stable source-clock segments; this is not the reusable asset library or web search) |
| Cut video at a point / trim an end | `split_shot`, `trim_shot` |
| Remove a whole shot | `delete_shot` |
| Remove an edited-timeline range (or inside a `[clip X]`) | `cut_range` |
| Remove spoken passages by the script | `cut_narration` (source-second ranges, ONE call for all ranges) |
| Remove exact words inside an identified transcript passage | Choose rows/range from `read_script` → one narrowed `list_words` call → `delete_words`; never scan the whole transcript with `list_words` |
| Tighten pacing / remove dead air | `cut_narration` with full gap ranges + `keepGapSec` (0.35 default) — rules in the `talking-head-cleanup` skill |
| Judgment-based speech cleanup (fillers, retakes, tighten) | `read_editing_guide` once, then its workflow — or use the `talking-head-cleanup` skill directly |
| Subtitles on/off/restyle | `set_captions` (18 presets), `remove_captions` — see the `captions` skill |
| Themes | `list_frames` → `attach_frame` → `read_frame {frame_id}` |
| Complete first cut / finished video | whole-film design and approval method in `storyboard-draft.md` |
| Open the live editor (your browser, pre-signed-in) | `create_browser_handoff` → built-in/embedded browser first; connected browser only after the explicit loopback-unreachable error |
| User rejects a change | `undo` (one step per call; doesn't cover the user's manual drags) |

## Patience with slow tools

`read_script` when it must transcribe, and `analyze_visual`, run **in the user's browser** and can take minutes (visual geometry is frame-by-frame; semantic mode adds sparse hosted understanding). A slow response is not a failure — do not retry just because a call takes long. Card-type tools have a 10-minute bridge timeout; instant operations time out at 60s.

## Local media import

When the user points at LOCAL video, image or audio paths, load the `asset-import` skill — its helper streams the files straight into the OPEN studio tab over the user's machine and keeps the original bytes in device-local OPFS (a tab must be open first). Main-video import can optionally send only a small extracted audio copy through Pireel's disclosed ASR path. Never tell the user to upload local source media to the cloud as the first answer.

## Seeing and offline mode

- `capture_frame {atSec}` renders one frame (video + framing + overlays) as an image — your eyes. Verify visual work after `apply_block`, caption, or framing changes, then fix what looks wrong. Needs the studio tab open.
- `review_sequence` renders the approved Director Scenes at entrance, development, payoff and exit states in time order, reports deterministic structure/audio problems, and returns exact Scene repair scopes. Use it for complete edits and Scene-level batches; inspect every attached image as a sequence rather than certifying one attractive midpoint.
- When the tab is closed, data-level tools (timeline edits, cuts, block edits, captions, BYO compose/apply and Director Plan) run in OFFLINE MODE against the user's most recently updated cloud project (results carry `offline: true`). Offline is a fallback, not the default: before consequential editing, open the editor so the user can watch. Media-byte analysis, rendered capture/review, local-file materialization and browser export need the live tab.

## When to ask the user instead of acting

- The request is ambiguous or names an element that doesn't exist — ask ONE short clarifying question, don't guess.
- Aggressive shortening, restructuring, highlight/short-version, or a generated hook — confirm target length, structure, and what to preserve BEFORE cutting.
- Before a consequential complete design with no Frame, inspect the material and recommend 1–2 fitting Frames plus themeless when visual direction is genuinely unresolved; wait for the choice. Never block a small local edit on this. Motion Graphics remain a separate editing layer inside the resulting Scenes.
- PROJECTS (no browser): offline tools act on your ACTIVE project = the most-recently-touched one. `list_projects` shows all (newest first = active); `switch_project {project_id}` makes a different one active and returns its state; `create_project` starts a fresh empty one (immediately active); `rename_project` retitles. If get_state reports "no cloud project", call `create_project` (or `import_media`) — don't send the user to a browser just to create one.
- `studio_not_open` / `studio_tab_closed` — first open your own built-in/embedded browser tab. Ask the user only when no embedded browser exists. For local import, switch to a controllable connected browser only after the embedded attempt explicitly reports the loopback-unreachable error.

## Talking to the user

Explain edits by the actual spoken words ("cut the half-sentence that got re-recorded"), never by internal ids or raw timestamps — the user can't see those. After creating or visibly changing an element, call `focus_element` so the user is looking at the result. Billing note if asked: only tools whose description carries a [CHARGES] marker bill Pireel credits (media generation and the Pireel-LLM fallbacks); your orchestration and every BYO flow cost the user nothing — details in the product-help skill.
