---
name: compose-blocks
description: The BYO-brain workflow for creating and rewriting overlay graphics in Pireel Studio — compose_block_brief, generating the block yourself, apply_block, lint-fix loops, get_icons, and frame playbooks. Use whenever the user wants a new on-screen graphic (card, chart, callout, title), wants an existing block's content or animation changed, or when placeholders (待配图) need filling.
---

# Composing blocks (BYO generation)

In Pireel Studio, **you are the model** for block HTML. Blocks are the designed graphic fragments laid over the video (metric cards, charts, diagrams, callouts, titles). The flow is always:

```
compose_block_brief  →  generate the block yourself  →  apply_block
```

This burns YOUR agent subscription, not the user's Pireel credits. The tools that run Pireel's own LLM instead (`add_block`, `edit_block`, `add_graphics`) **charge the account's credits** — use them only if the BYO flow fails repeatedly.

## Step 1 — get the contract: `compose_block_brief`

Returns the FULL generation contract `{system, prompt}`, assembled live from the composition: theme tokens, frame design language, box size, on-screen beats, neighbor roster. Three targeting modes:

1. **Fill a placeholder**: pass `blockId` of a `待配图` placeholder (ids from `get_state`). Its design spec becomes the instruction — **omit `instruction`**.
2. **Rewrite an existing block**: pass its `blockId` **plus** an `instruction` describing the change. Call `get_block` first when the rewrite must preserve specifics of what's already inside.
3. **New element**: pass `instruction` only (no `blockId`), optionally `atSec` for the timeline start (defaults to the playhead).

`instruction` is what to build/change — concrete and self-contained; Chinese preferred. If you call it with neither a placeholder `blockId` nor an `instruction`, it errors (`instruction required`).

## Step 2 — generate, following the contract exactly

Adopt the returned `system` and `prompt` verbatim and produce the response in the exact expected shape:

1. **One short note** (a sentence about what you built),
2. a **```html fence** with the block's markup and scoped styles,
3. a **```js fence** with the deterministic animation timeline.

Follow every rule in the contract — sizing, tokens, allowed CSS, animation constraints. Two contract-level facts worth pinning:

- The contract references a `get_icons` tool: **it exists on this MCP server**. Call `get_icons {names}` for inline SVG icons (up to 8 lucide-style kebab-case names, e.g. `["trending-up","shield-check"]`; `kind: "brand"` for brand logos). Never hand-draw semantic icons, never put emoji on canvas.
- If a **frame** (theme content pack) is attached, its design language is already baked into the brief — but when YOU are planning what blocks to make, read the playbook first: `read_frame {frame_id}` (ids via `list_frames`; attach with `attach_frame`). Call `read_frame` once after attaching and carry its motifs, proportions, and voice into every instruction you write. Do not copy the playbook's absolute px values — they are written for a different (1920px landscape) preview reference; the brief's own sizing rules govern actual px.

## Step 3 — submit: `apply_block`

Pass the **same `blockId` / `atSec` you gave the brief**, and `raw` = your full generated text (note + ```html + ```js; the fences are parsed out). Behavior by target:

- Placeholder `blockId` → fills it.
- Existing `blockId` → overwrites its content.
- Neither → inserts a NEW element; optional `durationSec` (seconds on screen, default 3) and `label` (short timeline label).

## The lint loop

`apply_block` validates the block (scoped CSS, no scripts, deterministic animation). On failure it returns the lint issues. **Fix ONLY those issues and re-apply** — do not regenerate from scratch, do not "improve" unrelated parts, do not change the note. Repeated identical failures after 2–3 fix attempts are the one case where falling back to the credits-charging `add_block`/`edit_block` is acceptable.

## After it lands

- The receipt confirms placement and the block id; call `focus_element` on it so the user sees the result.
- **Verify with your eyes**: call `capture_frame {atSec}` at the block's moment and LOOK at the rendered frame — placement, overlap with the speaker, contrast, sizing. If something looks wrong, fix it with another brief → generate → apply round before reporting done. (`capture_frame` needs the studio tab open.)
- Timing/position tweaks are NOT re-generation: `move_block` / `resize_block` for timeline changes, `delete_block` to remove, `duplicate_block` to copy (then a brief+apply rewrite to vary the copy).
- Batch work (e.g. filling every placeholder after `lay_out`): loop brief → generate → apply per placeholder, one at a time — each brief is assembled from live state, so apply each block before requesting the next brief.

## Quick reference

| Goal | Brief call | Apply call |
| --- | --- | --- |
| Fill placeholder `b12` | `compose_block_brief {blockId:"b12"}` | `apply_block {blockId:"b12", raw}` |
| Rewrite block `b7` | `compose_block_brief {blockId:"b7", instruction:"..."}` | `apply_block {blockId:"b7", raw}` |
| New card at 14s | `compose_block_brief {instruction:"...", atSec:14}` | `apply_block {atSec:14, durationSec:4, label:"...", raw}` |
