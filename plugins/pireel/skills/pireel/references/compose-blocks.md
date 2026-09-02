---
name: compose-blocks
description: Create or rewrite one Pireel Component (a graphic clip) inside an already understood passage using compose_component, apply_component, planned placement/backdrop, lint repair and rendered verification.
---

# Components and Motion Graphics

`Component` is Pireel's broad editable visual-layer concept: a graphic clip on a graphics track. Motion
Graphics—kinetic type, numbers, comparisons, charts, processes, diagrams, source annotations, authentic
interface treatments and content-specific forms—are one important Component family. Simple hooks,
labels and CTAs are native text clips (`set_texts`), not bespoke Components.

A Component is not a whole passage and never substitutes for directing the source picture. First decide
what the passage needs; only then decide whether a generated layer earns its place.

## New Component: compose before pixels

Before generation, decide:

- `atFrame` and `durationFrames`: the complete thought/action window, in integer timeline frames at the
  output fps from `get_state` (a "2–3 s" hold is converted to frames at that fps);
- `placement`: intended canvas region, a box in canvas units;
- `backdrop`: what real picture sits under that region and which face, product, caption, UI or evidence
  zones must remain unobscured;
- `instruction`: the layer's communicative job and content—not merely "add a nice card".

Then call `compose_component` with those values. It returns the full `{system, prompt}` contract plus a
`target`. The prompt already contains the actual box, the backdrop under it, the active Frame or
themeless visual language and the spoken beats in its window. Generate the answer yourself from that
contract. No credits are charged here.

New/custom Motion Graphics use the markup contract: one short note, one fenced `html` block and one fenced
`js` timeline body. Existing registered Components keep their typed JSON props contract. Use
`format:"kit"` only when intentionally choosing a registered Component; use `format:"html"` for bespoke
visual explanation. The retrieved Component/pattern candidates are useful landmarks, not a closed menu.

Submit with `apply_component`, copying the returned target `clipId`, `atFrame`, `durationFrames` and
`placement` unchanged and adding the complete raw model response as `raw`. The insertion preserves the
duration it was authored for, so later edge drags time-stretch its entrance, payoff/hold and exit instead
of cutting choreography off. The receipt is a delta naming the placed clip; no `get_state` re-read is
needed.

## Existing Component

Call `inspect_media {mode:"component", clipId}` when the requested edit must preserve or inspect existing
content. Then call `compose_component {clipId, instruction}`. Existing timing, box, design context and
current props/markup are supplied automatically. Apply using the same `clipId` and returned target.

Do not regenerate for a pure timeline move or resize: `move_clips` retimes, `set_clip_properties
{durationFrames}` changes length, `set_clip_framing {box | anchor | scale}` repositions on screen, and
`apply_layout` arranges several graphic clips with the footage. A later Frame switch does not rewrite
already generated Components; only an explicit edit does.

## Design standard

- Treat the actual canvas region like a responsive page surface: establish hierarchy, whitespace,
  alignment, scale and one focal path for its real aspect ratio.
- Inherit the whole-film typography, materials, imagery and motion grammar. Vary the form because the
  content and neighboring passage differ, not by inventing a new style.
- Reveal in response to speech/action/evidence. Give the layer an entrance, development, payoff, readable
  hold and clean exit; later spoken content must remain hidden until its local beat.
- Use real screenshots/pages/posts/maps/code or product evidence truthfully. Do not redraw authentic
  interfaces as fake generic UI when the real source is available.
- Use `get_icons` for semantic/brand SVGs. Do not hand-draw familiar icons or use emoji as substitute art.
- Keep phone-size legibility and protected subjects ahead of decorative detail.

## Lint and visual repair

`apply_component` validates scoped CSS, deterministic animation and the output contract. On rejection,
repair only the listed issues and re-apply with the same stable `clipId`; do not restart the design or
alter unrelated content.

After it lands, call `inspect_timeline {frames:[…]}` at meaningful moments for a local change — its
entrance, development, payoff and exit frames in order — or `inspect_timeline` over the passage (`{fromFrame,
toFrame, maxFrames}`) or the whole film for a complete pass. A mid-animation frame is not a broken design;
compare frames before concluding. Check the composed picture—not the Component in isolation: source
dominance, placement, overlap, scale, contrast, readable hold, exit and continuity. Fix the passage by its
clips, not merely the prettiest thumbnail. Then `preview {action:"focus", id}` so the user sees the result.

Hosted `apply_component {generate:true, instruction}` is the credit-charging fallback, to be used only when
the BYO path fails repeatedly. The BYO compose/apply path uses the caller's own agent model and should be
the default for MCP agents.
