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
approve. Nothing here requires a planning artifact before you may touch the timeline — and there is
none to write: the plan lives in your working context as prose.

## Understand the material before designing

Start with `get_state` (once; it lists every track, clip and library asset). Inspect `search_assets`
when the library alone cannot answer, and read the spoken material with `get_transcript` only when its
actual wording or timing matters — speechless footage is read through `get_state`, `inspect_media` and
`inspect_timeline` instead. `get_transcript` reuses stored text and transcribes only when needed
(transcription charges). Inspect real frames only where picture evidence is needed; do not infer what
an unviewed clip contains.

Derive the likely solution progressively from the material. Resolve consequential uncertainty about:

- the strongest truthful sequence and what footage actually supports it;
- whether the canvas should stay source-led, split, picture-led or deliberately full-field;
- the selected Frame or a coherent themeless visual language;
- missing evidence, product actions, interface states, pickup footage or audio;
- output count/ratio/duration when the request implies multiple deliverables.

Do not turn this into a generic audience questionnaire. Ask only for decisions the source cannot answer.
Over MCP there is no `ask_user` tool: ask in your own host's conversation and stop the turn.

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
  4. **Movement progression** — meaningful picture changes, each with a viewer task, visual anchor,
     full-canvas treatment, motion/payoff/exit, sound plan and honest asset strategy.
  5. **Material sufficiency** — what is supported now and any exact missing source that changes quality.

When a Frame is already selected, read it as professional art direction (`manage_frame {action:"read"}`):
its examples demonstrate transferable shape, material, image, type, color-role, spatial and motion
principles, not passage types, layouts or media choices. When none is selected and the visual direction
is materially uncertain, recommend one or two evidence-based Frames (`manage_frame {action:"list"}`) plus
themeless and wait — unless the user has told you not to ask, in which case pick the strongest and name
it. The user's manual palette, layout, captions and explicit instructions remain authoritative.

## The plan is working context, not a saved artifact

There is no persisted director plan or scene-design object, and no tool reads one back. Hold the plan
as a few sentences you can keep in mind for the whole session: the thesis, the order of movements, and
where sound leads. For a long piece, write it down for yourself in the proposal above; for a multi-session
piece, restate it from the timeline (`get_state` plus `inspect_timeline`) when you resume — the built
clips are the record. Split a movement when its visual anchor or viewing task changes, not by a fixed
duration, and give real evidence wherever a passage asks the viewer to believe a claim. When several
outputs must share one design system, attach the same Frame to each (`manage_frame {action:"attach"}`)
and carry the sentence-level plan across `manage_project` output switches yourself.

A passage is repaired by its clips: the receipt of every mutation is a delta (touched clips, shifted
rules, removed clip ids, removed source spans), and the clip ids `inspect_timeline` reports on screen are
the handles you edit with. There is no scene id to target.

## Compile the edit with the neutral timeline tools

Use the batched tools to cut, place, move, resize, frame, crop, layer and mix real media: `split_clips`
/ `ripple_delete_ranges` / `remove_words` for the cut (speech by the transcript, everything else by
frames); `add_clips` / `insert_clips` / `move_clips` for media; `set_clip_framing` / `apply_layout` for
the picture; `add_clips {role:"music"}` + `set_clip_properties {volumeDb, fades}` / `set_clip_properties
{volumeDb, mute}` on footage / `add_clips {role:"sfx"}` for sound (craft in `craft/audio-and-music.md`);
`add_transition` only where a boundary means a change of time, place, chapter or mode; `set_texts` for
titles and labels; `set_captions` for subtitles. Timeline arguments are integer frames at the output fps
from `get_state`; source and transcript positions are seconds; the tools convert. Let source people,
products, interfaces and evidence remain primary when they carry the meaning. Do not add layers to meet
a count: a clean source-led passage may be the strongest design.

A Motion Graphic is one optional layer. Before generating one, decide its actual `atFrame`,
`durationFrames`, canvas `placement`, real `backdrop` and protected face/product/caption zones. Then:

```
compose_component → generate from its exact contract → apply_component with target unchanged
```

This gives the component its actual box and design context before it is authored. Do not generate a
generic centered card and reposition it later. Prefer one orchestrated visual idea to many independent
fades, and allow deliberate quiet passages.

## Review the viewing experience

Run `inspect_timeline` after a complete pass. With no arguments it samples every visible clip's midpoint
in time order; with `{fromFrame, toFrame, maxFrames}` it samples one passage evenly, and `{frames:[…]}`
shows the exact entrance, development, payoff and exit moments of a component you want to check. Look
at every attached image as one moving sequence, then review at normal playback speed and delivery size
(`preview {action:"play"}`); a good midpoint thumbnail is not proof of a finished passage. Nothing here
hears — confirm music levels, fades and B-roll sound from `get_state` and the mutation deltas and ask
the user to play the result.

Repair blank or unloaded media, missing evidence, tiny/unreadable graphics, repeated card geometry,
uncleared overlays, clipped animation, silent/muted voice, level mistakes and weak boundaries — by the
clips involved. Preserve unaffected passages, recheck repaired moments and their immediate handoffs, then
summarize the finished experience rather than the number of tool calls.
