---
name: known-errors
description: Meaning and recovery steps for common Pireel MCP errors — studio_not_open, studio_tab_closed, tool_timeout, HTTP 401/409, Director Plan validation and apply_block lint rejection. Use whenever a Pireel tool call fails, errors, or hangs, before retrying anything.
---

# Known errors and recovery

Pireel MCP tools execute in the user's open studio browser tab, relayed through a bridge. Most failures are connection-state problems, not bugs — each has a specific recovery. **Never blind-retry**; diagnose first.

## `studio_not_open` (HTTP 409)

**Meaning**: no studio tab is connected to the bridge. The user does not have their Pireel studio project open in a browser, or the tab hasn't finished connecting.

**Recovery**: data-level tools (timeline edits, cuts, block edits, captions, BYO compose/apply and Director Plan) can fall back to OFFLINE MODE against the active cloud project. But offline is a fallback, not the default flow: before consequential editing, open the editor through `create_browser_handoff` in your own visible embedded browser. Media-byte analysis, rendered capture/review, local-file materialization and browser export require the live tab. Never blind-retry—the answer cannot change until a tab connects.

## `studio_tab_closed`

**Meaning**: the studio tab disconnected **mid-call** — closed, navigated away, refreshed, or the machine slept.

**Recovery**: re-open a tab (`create_browser_handoff` → built-in browser, or ask the user to re-focus theirs). Then — important — call `get_state` before resuming: the interrupted operation may or may not have applied, and your snapshot is now untrustworthy. Verify what actually landed instead of re-issuing mutations on faith (a repeated cut lands twice).

## `tool_timeout after Ns`

**Meaning**: the bridge gave up waiting for the tab. Instant (badge) operations time out at 60s; slow generation/analysis (card) tools at 600s. A timeout usually means the tab is throttled (backgrounded), the machine is under load, or a genuinely huge job.

**Recovery**:
1. Ask the user to bring the studio tab to the FOREGROUND (background tabs get throttled by the browser) and keep the machine awake.
2. Call `get_state` — the operation may have completed after the bridge stopped waiting.
3. Only then retry, once. For `extract_asr` / `analyze_visual` remember they are minute-scale by design and cached per file — a retry after a real timeout resumes cheaply, but a retry fired at a still-running job just queues noise.

## `capture_frame` / `export_video` — `Failed to fetch`, or fonts look plain

**Meaning**: the video bytes are fully LOCAL, but frame capture and export rasterize on-screen text by inlining webfonts from **Google Fonts** (an external host). A browser that blocks external hosts — notably an in-app/embedded agent browser scoped to local targets — can't fetch them directly.

**Recovery**: nothing to do — font fetches now fall back through Pireel's own same-origin proxy (the server fetches Google Fonts for the browser), so fonts render properly even in restricted browsers; if even the proxy is unreachable (offline / self-hosted shell with no backend), the frame/export still renders with **system fallback fonts** instead of failing. The video, timeline, cuts and layout are unaffected (all local). If you still see `Failed to fetch` from `capture_frame`, the user's tab is on an older build — a refresh picks up the fix.

## Local helper — `local loopback is unreachable from this browser`

**Meaning**: MCP authentication and the Studio bridge are connected, but the browser hosting Studio cannot reach the agent host's throwaway `127.0.0.1` file server. Some embedded/in-app browser sandboxes isolate loopback; this is different from an API, R2, or ASR failure.

**Recovery**: only after this exact error, keep the same project and open one fresh `create_browser_handoff` in a controllable connected browser that shares the host network. Close/release the isolated in-app Studio tab, get one fresh import token, and retry the helper once. Do not choose the connected browser before the built-in/embedded browser attempt fails. Do not upload the original to cloud storage, drive hidden file inputs, or invent another transfer path.

## HTTP 401

**Meaning** depends on where it appeared:

- An MCP tool call returning 401 means the OAuth session is missing or expired. This is transport-level — no tool ran.
- The local import helper printing `local ... register failed: HTTP 401` means its short-lived import token was rejected by the connected environment. Re-calling `import_media` once distinguishes an expired token from an environment/access-gate defect.

**Recovery**: for an MCP 401, re-run the OAuth login (`codex mcp login pireel-preview`, or reconnect the Preview server in Claude Code). For a helper 401, obtain one fresh token and retry the helper once. If the fresh token also returns 401, stop and report the environment error; do **not** switch to browser DOM injection, invent a direct-upload script, create carrier media, or install a local transcription stack.

## `server_misconfigured`

**Meaning**: the connected Pireel environment is missing a required server-side binding or secret. For media transcription this commonly occurs before ASR, while preparing the temporary compressed-audio upload.

**Recovery**: stop and report the exact environment and failing operation. Retrying, choosing the same file again, manufacturing a temporary video, or installing/running local Whisper cannot repair server configuration. Preserve the successfully imported local media and resume only after the environment has been fixed.

## `apply_block` lint rejection

**Meaning**: not a failure — the validation loop working as intended. The generated block violated a contract rule (unscoped CSS, scripts, non-deterministic animation, etc.); the response lists the exact issues.

**Recovery**: the failure receipt returns a `blockId` (the id the block WILL have). Fix ONLY the listed issues in your generated text, **scope every CSS selector under `#<that blockId>`**, and call `apply_block` again passing that same `blockId` back verbatim (plus the same `atSec`). Reusing the id keeps the scope target stable across retries — for a brand-new block, do NOT omit `blockId` on the retry or a fresh id is minted and the scope never matches. Do not regenerate from scratch or change unrelated parts. If issues persist after 2–3 targeted fixes, re-read the `compose_block_brief` contract; last resort, `add_block`/`edit_block` (charges Pireel credits — say so).

## `set_director_plan` rejection

**Meaning**: the whole-film design contract or one Scene is incomplete/invalid. The error identifies a precise path such as a missing rhythm arc, design-system field, visual anchor, treatment, motion/sound/asset plan, B-roll decision, non-positive duration or overlapping interval.

**Recovery**: repair only the named field from the approved proposal, preserve the rest, and call `set_director_plan` again. Do not weaken the plan to chapter titles or invent evidence merely to satisfy validation.

## `instruction required` (from `compose_block_brief`)

**Meaning**: every Component generation/rewrite needs a concrete communicative instruction; no implicit placeholder specification was supplied.

**Recovery**: re-call with a concrete `instruction`. For new work also decide timing, placement, backdrop/protected zones and the approved `sceneId` before requesting the brief.

## `unknown tool` / invalid-params JSON-RPC errors (-32602)

**Meaning**: a tool name or argument shape that doesn't exist on this server.

**Recovery**: re-check the tool list (`tools/list`); do not invent tools or parameters. Ids for blocks/shots/frames/presets must come from `get_state`, tool receipts, `list_frames`, or the caption catalog — a made-up id fails inside the tool instead.

## General rules

- After ANY failed mutation, prefer `get_state` over memory before the next edit.
- Errors come back with `isError` and an `ok:false` JSON body, often with a `hint` field — read it; it states the recovery.
- If the user rejects a change that DID apply, that's not an error path: use `undo` (one step per call).
