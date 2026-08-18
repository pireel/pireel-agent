---
name: storyboard-draft
description: Design and execute a complete editable video in Pireel from real source material. Use for a first cut, full polish, storyboard, lesson, product story, ad, montage, or any request whose result is a coherent finished video rather than one local edit.
---

# Complete video design

A complete edit is not a fixed tool pipeline and not a collection of generated cards. Treat the final
video as one designed experience: source footage, crops, cuts, media, typography, Motion Graphics,
captions and sound share one argument, rhythm and visual system.

## Understand the material before designing

Start with `get_state` and `get_timeline`. Inspect `list_assets` / `search_assets`, and read the spoken
material with `read_script` or `extract_asr` when its actual wording or timing matters. Inspect real
frames only where picture evidence is needed; do not infer what an unviewed clip contains.

Derive the likely solution progressively from the material. Resolve consequential uncertainty about:

- the strongest truthful sequence and what footage actually supports it;
- whether the canvas should stay source-led, split, picture-led or deliberately full-field;
- the selected Frame or a coherent themeless visual language;
- missing evidence, product actions, interface states, pickup shots or audio;
- output count/ratio/duration when the request implies multiple deliverables.

Do not turn this into a generic audience questionnaire. Ask only for decisions the source cannot answer.

## Propose the whole design before building

For a broad edit, present a concise proposal and wait for the user's approve/reject decision before
publishable-looking timeline work. The proposal is generated from the actual material, not a fixed card
template. It must make clear:

1. **Creative thesis** — the memorable organizing idea.
2. **Rhythm arc** — where pace, density, pressure, proof, release and holds change.
3. **Video design system** — composition grammar, typography roles, color/material behavior, imagery
   treatment, motion character and sound hierarchy for the whole output.
4. **Scene progression** — meaningful picture changes, each with a viewer task, visual anchor,
   full-canvas treatment, motion/payoff/exit, sound plan and honest asset strategy.
5. **Material sufficiency** — what is supported now and any exact missing source that changes quality.

When a Frame is already selected, read and use it. When none is selected and the visual direction is
materially uncertain, recommend one or two evidence-based Frames plus themeless and wait. The user's
manual palette, layout, captions and explicit instructions remain authoritative.

## Save an executable Director Plan

After approval, call `set_director_plan`. This is a saved design contract, not chapter labels. Define one
whole-film `creativeThesis`, `rhythmArc` and `designSystem`. Every Scene must name:

- its exact edited-time interval, viewer task, narrative role and purpose;
- one dominant `visualAnchor` and a source-aware full-canvas `visualTreatment`;
- a stable `treatmentId` for the authored composition idea;
- entrance, development, payoff/hold and exit in `motionPlan`;
- voice/source/music/silence hierarchy in `soundPlan`;
- `assetStrategy`, explicit `brollDecision`, and the editorial `brollRationale`;
- real evidence when the Scene asks the viewer to believe a claim.

Split a Scene when its visual anchor or viewing task changes. Do not split by a fixed duration. A long
Scene may remain one interval only when its internal speech/action triggers are explicit.

## Execute Scenes, not insertions

Use the neutral timeline tools to cut, place, move, resize, frame, crop, layer and mix real media. Bind
planned placements to their exact `sceneId`. Let source people, products, interfaces and evidence remain
primary when they carry the meaning.

A Motion Graphic is one optional layer in a Scene. Before generating a new one, decide its actual
`atSec`, `durationSec`, canvas `placement`, real `backdrop`, protected face/product/caption zones and
approved `sceneId`. Then use:

```
compose_block_brief → generate from its exact contract → apply_block with target unchanged
```

This gives the component its actual box and whole-film/Scene design context before it is authored. Do not
generate a generic centered card and reposition it later. Prefer one orchestrated visual idea to many
independent fades, and allow deliberate quiet Scenes.

## Review the viewing experience

Run `review_sequence` after a complete pass. It returns entrance, development, payoff and exit frames in
time order, checks local scene structure and audible audio, and returns exact Scene repair scopes. Look at
every attached image as one moving sequence, then review at normal playback speed and delivery size; a
good midpoint thumbnail is not proof of a finished Scene.

Repair blank or unloaded media, missing evidence, tiny/unreadable graphics, repeated card geometry,
uncleared overlays, clipped animation, silent/muted voice, level mistakes and weak boundaries. Preserve
unaffected Scenes, recheck repaired moments and their immediate handoffs, then summarize the finished
experience rather than the number of tool calls.
