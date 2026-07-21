---
name: storyboard-draft
description: The full-draft pipeline for turning a fresh talking-head video into a storyboarded, illustrated piece in Pireel Studio — extract_asr, visual_brief/submit_visual, plan_brief/submit_plan, lay_out, then BYO-illustrating every placeholder. Use when the user asks for a one-shot draft ("一键成片", "make a first cut", "auto edit", "storyboard this video") or to (re)run any single pipeline stage.
---

# Storyboard draft (one-shot pipeline)

Turning a fresh talking-head video into a designed draft is a fixed pipeline. Each stage is its own tool call; skip any stage that `get_state`'s **Pipeline line** already marks done (`transcript done · narration plan done · visual analysis done`).

```
extract_asr → visual_brief → (you label the frames) → submit_visual → plan_brief → (you generate the DraftPlan) → submit_plan → lay_out → per placeholder: compose_block_brief → generate → apply_block
```

## Stage 0 — orient, and offer a theme

Call `get_state` first. Before the FIRST full-draft run on a project, look at what the video is about and recommend 1–2 best-fitting **frames** (theme content packs that define the whole design language) from `list_frames` in one short sentence; let the user pick or skip. When they pick, `attach_frame {frame_id}` (tokens apply immediately) then `read_frame {frame_id}` for the playbook — carry its rules into the plan and every block you generate. Don't start the pipeline in the same turn as the question, and never block small edits on it.

## Stage 1 — `extract_asr` (transcript)

Transcribes the spoken audio into timed sentences — the raw material for planning. Covers the main video AND every inserted other-source segment. **Slow**: it runs in the user's browser and can take minutes — do not retry a call just because it is slow; wait for the receipt. Cheap to re-run later (cached per file). It does NOT add captions and does NOT cut shots.

## Stage 2 — footage analysis yourself: `visual_brief` → `submit_visual`

This is BYO-brain: **you** are the vision model, not Pireel's.

1. `visual_brief` (no input) — the tab runs the free passes locally (scene cuts, speaker face/geometry safe-zones, palette; **the slowest stage**, frame-by-frame, minutes, live progress in the tab; one call, wait) and returns sparse sample frames as IMAGES with timestamps. If analysis is already cached it says so — skip step 2.
2. LOOK at each frame and label it, then `submit_visual` with `labels`: per frame `{index, content: talkinghead|screen|broll|slide|other, person: left|center|right|none, safe: left|right|top|bottom|full|none, has_text, desc}`. The tab merges your semantics with its own geometry.

Fallback: `analyze_visual` runs Pireel's hosted vision model and CHARGES the account — only if the brief flow fails repeatedly. Either way this stage must be done before `lay_out` (which would otherwise auto-run the charging version opaquely).

## Stage 3 — plan the narration yourself: `plan_brief` → `submit_plan`

This is BYO-brain: **you** are the planner, not Pireel's LLM.

1. `plan_brief` (no input; requires the transcript, so run `extract_asr` first) returns the full planning contract `{system, prompt}`: transcript sentences, per-sentence visual hints, inserted-clip context.
2. Generate the **DraftPlan JSON** yourself, following the contract exactly — scene segmentation (group consecutive sentences by meaning), a framing per scene (full / punch-in / corner / split), and a designed-graphic brief per scene with real data pulled from the script. Designed graphics are the main event.
3. `submit_plan {plan}` (JSON object or its raw text). It is coerced and validated — scene ranges are clamped to the sentence count. If it is rejected because no scenes survive validation, regenerate against the contract and resubmit.

Fallback only: `analyze_narration` does this planning on Pireel's LLM and **charges the account's credits** — use it only if the BYO plan fails repeatedly.

## Stage 4 — `lay_out` (storyboard)

Consumes the stored plan: slices shots (by sentence boundaries and scene cuts), applies each scene's framing, and drops **placeholder** slots (`待配图`) where graphics should go — no graphics drawn yet. It **overwrites the composition structure**, EXCEPT segments inserted from other source files, which are preserved at their timeline positions. It auto-runs missing prerequisites as a fallback, but prefer the explicit stages above so the user sees each stage's own progress.

## Stage 5 — illustrate every placeholder (BYO)

Call `get_state` after `lay_out` (or read its receipt) to list the placeholder block ids. Then for EACH placeholder, run the BYO block flow (see the `compose-blocks` skill):

```
compose_block_brief {blockId} → generate (note + ```html + ```js) → apply_block {blockId, raw}
```

Work one placeholder at a time — each brief is assembled from live state. Use `get_icons` for any SVG icons the design needs. If `apply_block` returns lint issues, fix only those and re-apply.

Fallback only: `add_graphics` fills all pending placeholders (optionally scoped with `blockIds`) on Pireel's LLM and **charges credits**.

## Wrap up

`get_state` once more to confirm the structure, `focus_element` on a highlight, and recap to the user in plain words what the draft contains (scenes, framings, how many graphics). Offer next steps: captions (`captions` skill), speech cleanup (`talking-head-cleanup` skill), or per-block tweaks.

## Re-running a single stage

The user can ask for any stage alone: "re-transcribe" → `extract_asr`; "re-analyze the footage" → `visual_brief` → `submit_visual`; "re-plan" → `plan_brief` → `submit_plan`; "re-storyboard" → `lay_out` (remember it rebuilds the structure); "redo this graphic" → `compose_block_brief {blockId}` → `apply_block`.
