---
name: known-errors
description: Meaning and recovery steps for every known Pireel MCP error — studio_not_open, studio_tab_closed, tool_timeout, HTTP 401/409, apply_block lint rejections, and submit_plan validation failures. Use whenever a pireel tool call fails, errors, or hangs, before retrying anything.
---

# Known errors and recovery

Pireel MCP tools execute in the user's open studio browser tab, relayed through a bridge. Most failures are connection-state problems, not bugs — each has a specific recovery. **Never blind-retry**; diagnose first.

## `studio_not_open` (HTTP 409)

**Meaning**: no studio tab is connected to the bridge. The user does not have their Pireel studio project open in a browser, or the tab hasn't finished connecting.

**Recovery**: data-level tools (cuts, block edits, captions, BYO compose/apply, plan) automatically fall back to OFFLINE MODE — they edit the user's most recently updated cloud project directly (the result carries `offline: true` and the project name; changes appear next time the project is opened). Only video-dependent tools hard-fail with this error: `extract_asr`, `analyze_visual`, `capture_frame`, `lay_out`, and Pireel-LLM generation. For those, open a tab yourself: call `create_browser_handoff` and open the returned `url` with your OWN built-in/embedded browser tool — never via the OS `open` command or the user's default browser (single-use ticket; a surface you cannot see wastes it and leaves you blind). Pre-signed-in, ~60s, never show it to the user. If you have no embedded browser, ask the user to open their studio project at https://pireel.com instead. Do not blind-retry the same call — the answer will not change until a tab connects.

## `studio_tab_closed`

**Meaning**: the studio tab disconnected **mid-call** — closed, navigated away, refreshed, or the machine slept.

**Recovery**: re-open a tab (`create_browser_handoff` → built-in browser, or ask the user to re-focus theirs). Then — important — call `get_state` before resuming: the interrupted operation may or may not have applied, and your snapshot is now untrustworthy. Verify what actually landed instead of re-issuing mutations on faith (a repeated cut lands twice).

## `tool_timeout after Ns`

**Meaning**: the bridge gave up waiting for the tab. Instant (badge) operations time out at 60s; slow generation/analysis (card) tools at 600s. A timeout usually means the tab is throttled (backgrounded), the machine is under load, or a genuinely huge job.

**Recovery**:
1. Ask the user to bring the studio tab to the FOREGROUND (background tabs get throttled by the browser) and keep the machine awake.
2. Call `get_state` — the operation may have completed after the bridge stopped waiting.
3. Only then retry, once. For `extract_asr` / `analyze_visual` remember they are minute-scale by design and cached per file — a retry after a real timeout resumes cheaply, but a retry fired at a still-running job just queues noise.

## HTTP 401

**Meaning**: the OAuth session is missing or expired. This is transport-level — no tool ran.

**Recovery**: re-run the OAuth login (`codex mcp login pireel`, or reconnect the server in Claude Code) — the browser opens for consent. There are no API keys to check.

## `apply_block` lint rejection

**Meaning**: not a failure — the validation loop working as intended. The generated block violated a contract rule (unscoped CSS, scripts, non-deterministic animation, etc.); the response lists the exact issues.

**Recovery**: the failure receipt returns a `blockId` (the id the block WILL have). Fix ONLY the listed issues in your generated text, **scope every CSS selector under `#<that blockId>`**, and call `apply_block` again passing that same `blockId` back verbatim (plus the same `atSec`). Reusing the id keeps the scope target stable across retries — for a brand-new block, do NOT omit `blockId` on the retry or a fresh id is minted and the scope never matches. Do not regenerate from scratch or change unrelated parts. If issues persist after 2–3 targeted fixes, re-read the `compose_block_brief` contract; last resort, `add_block`/`edit_block` (charges Pireel credits — say so).

## `submit_plan` rejection

**Meaning**: no scenes survived validation (scene ranges are clamped to the sentence count; an empty result is rejected).

**Recovery**: regenerate the DraftPlan against the `plan_brief` contract — the usual cause is scene indices that don't match the transcript's sentence numbering — then `submit_plan` again. Fallback: `analyze_narration` (charges credits).

## `instruction required` (from `compose_block_brief`)

**Meaning**: you called it without an `instruction` on a target that isn't a placeholder — only `待配图` placeholders carry their own design spec.

**Recovery**: re-call with a concrete `instruction`, or double-check the `blockId` really is a placeholder in `get_state`.

## `unknown tool` / invalid-params JSON-RPC errors (-32602)

**Meaning**: a tool name or argument shape that doesn't exist on this server.

**Recovery**: re-check the tool list (`tools/list`); do not invent tools or parameters. Ids for blocks/shots/frames/presets must come from `get_state`, tool receipts, `list_frames`, or the caption catalog — a made-up id fails inside the tool instead.

## General rules

- After ANY failed mutation, prefer `get_state` over memory before the next edit.
- Errors come back with `isError` and an `ok:false` JSON body, often with a `hint` field — read it; it states the recovery.
- If the user rejects a change that DID apply, that's not an error path: use `undo` (one step per call).
