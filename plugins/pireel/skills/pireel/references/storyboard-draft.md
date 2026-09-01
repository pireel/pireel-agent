---
name: storyboard-draft
description: Design and execute a complete editable video in Pireel from real source material. Use for a first cut, full polish, storyboard, lesson, product story, ad, montage, or any request whose result is a coherent finished video rather than one local edit.
---

# Complete video design

A complete edit is not a fixed tool pipeline and not a collection of generated cards. Treat the final
video as one designed experience: source footage, crops, cuts, media, typography, Motion Graphics,
captions and sound share one argument, rhythm and visual system.

The method below is **proportional**. A 40-second product clip with a clear brief needs a sentence of
direction and then the edit; a 12-minute lesson with vague intent needs a proposal the user can
approve. Nothing here requires a planning artifact before you may touch the timeline.

## Understand the material before designing

Start with `get_state` and `get_timeline`. Inspect `list_assets` / `search_assets`, and read the spoken
material with `read_script` only when its actual wording or timing matters — speechless footage is read
through `get_timeline`, `inspect_media` and frame inspection instead. `read_script` reuses stored text and
transcribes only when needed. Inspect real frames only where picture evidence is needed; do not infer
what an unviewed clip contains.

Derive the likely solution progressively from the material. Resolve consequential uncertainty about:

- the strongest truthful sequence and what footage actually supports it;
- whether the canvas should stay source-led, split, picture-led or deliberately full-field;
- the selected Frame or a coherent themeless visual language;
- missing evidence, product actions, interface states, pickup shots or audio;
- output count/ratio/duration when the request implies multiple deliverables.

Do not turn this into a generic audience questionnaire. Ask only for decisions the source cannot answer.

## State the direction before building — at the scale the request deserves

- **Clear brief, short piece, or "just do it"**: name the direction in one or two sentences (thesis,
  pace, visual treatment, sound plan) and proceed. Do not stop for approval.
- **Broad, expensive or ambiguous complete edit** (long footage, many sources, paid generation, several
  deliverables, unresolved creative direction): present a concise proposal generated from the actual
  material and wait for approve/reject before publishable-looking timeline work. It must make clear:

  1. **Creative thesis** — the memorable organizing idea.
  2. **Rhythm arc** — where pace, density, pressure, proof, release and holds change.
  3. **Video design system** — composition grammar, typography roles, color/material behavior, imagery
     treatment, motion character and sound hierarchy for the whole output.
  4. **Scene progression** — meaningful picture changes, each with a viewer task, visual anchor,
     full-canvas treatment, motion/payoff/exit, sound plan and honest asset strategy.
  5. **Material sufficiency** — what is supported now and any exact missing source that changes quality.

When a Frame is already selected, read it as professional art direction: its examples demonstrate
transferable shape, material, image, type, color-role, spatial and motion principles, not Scene types,
layouts or media choices. When none is selected and the visual direction is materially uncertain,
recommend one or two evidence-based Frames plus themeless and wait — unless the user has told you not
to ask, in which case pick the strongest and name it. The user's manual palette, layout, captions and
explicit instructions remain authoritative.

## Persisted planning is optional

`set_director_plan` and `set_scene_designs` save a durable whole-video plan (Semantic Scenes with one
design system, then each Scene's open composition, choreography and handoff). Use them when:

- the user or a selected Studio Skill explicitly asks for a saved plan;
- the piece is long or will span several sessions, so Scene-scoped `review_sequence` / repair by
  `sceneId` pays for the authoring cost;
- several outputs must share one design system and you need a single source for it.

Otherwise skip them and compile directly. A plan, when used, must be a real contract: exact edited-time
intervals, one dominant `visualAnchor` and full-canvas `visualTreatment` per Scene, `motionPlan`,
`soundPlan`, `assetStrategy`, an explicit `brollDecision`, and real evidence wherever a Scene asks the
viewer to believe a claim. Split a Scene when its visual anchor or viewing task changes, not by a fixed
duration. Existing projects may already carry a plan; read it with `read_director_plan {sceneIds}` /
`read_scene_designs {sceneIds}` before continuing it, and pass `sceneId` into `compose_block_brief` and
`insert_clips` only when such a plan exists.

## Compile the edit with the neutral timeline tools

Use the batched tools to cut, place, move, resize, frame, crop, layer and mix real media: `split_shot`
/ `cut_range` / `cut_narration` for the cut; `add_clips` / `insert_clips` / `move_clips` for media;
`set_shot_framing` / `apply_layout` for the picture; `set_bgm` / `set_shot_audio` / `add_clips
{role:"sfx"}` for sound (craft in `audio-and-music.md`); `add_transition` only where a boundary means a
change of time, place, chapter or mode; `set_captions` for subtitles. Let source people, products,
interfaces and evidence remain primary when they carry the meaning. Do not add layers to meet a count:
a clean source-led passage may be the strongest design.

A Motion Graphic is one optional layer. Before generating one, decide its actual `atSec`,
`durationSec`, canvas `placement`, real `backdrop` and protected face/product/caption zones. Then:

```
compose_block_brief → generate from its exact contract → apply_block with target unchanged
```

This gives the component its actual box and design context before it is authored. Do not generate a
generic centered card and reposition it later. Prefer one orchestrated visual idea to many independent
fades, and allow deliberate quiet passages.

## Review the viewing experience

Run `review_sequence` after a complete pass. It works with or without a plan: with one it returns each
Scene's entrance, development, payoff and exit frames plus deterministic structure checks; without one
it samples every visible clip's midpoint in time order. Look at every attached image as one moving
sequence, then review at normal playback speed and delivery size; a good midpoint thumbnail is not
proof of a finished passage. Neither tool hears — confirm music levels, fades and B-roll sound from the
timeline receipts and ask the user to play the result.

Repair blank or unloaded media, missing evidence, tiny/unreadable graphics, repeated card geometry,
uncleared overlays, clipped animation, silent/muted voice, level mistakes and weak boundaries. Preserve
unaffected passages, recheck repaired moments and their immediate handoffs, then summarize the finished
experience rather than the number of tool calls.
