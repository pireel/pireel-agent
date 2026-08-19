---
name: compose-blocks
description: Create or rewrite one Pireel Component inside an already understood Scene using compose_block_brief, apply_block, planned placement/backdrop, lint repair and rendered verification.
---

# Components and Motion Graphics

`Component` is Pireel's broad editable visual-layer concept. Motion Graphics—kinetic type, numbers,
comparisons, charts, processes, diagrams, source annotations, authentic interface treatments and
content-specific forms—are one important Component family.

A Component is not a whole Scene and never substitutes for directing the source picture. First decide
what the Scene needs; only then decide whether a generated layer earns its place.

## New Component: compose before pixels

Before generation, decide:

- `atSec` and `durationSec`: the complete thought/action window;
- `sceneId`: the approved Director Scene when a plan exists;
- `placement`: intended `{xPct,yPct,widthPct,heightPct}` canvas region;
- `backdrop`: what real picture sits under that region and which face, product, caption, UI or evidence
  zones must remain unobscured;
- `instruction`: the layer's communicative job and content—not merely “add a nice card”.

Then call `compose_block_brief` with those values. It returns the full `{system,prompt}` contract plus a
`target`. The prompt already contains the actual box, whole-film design system, current Scene treatment,
Frame/themeless visual language and local spoken beats. Generate the answer yourself from that contract.

New/custom Motion Graphics use the markup contract: one short note, one fenced `html` block and one fenced
`js` timeline body. Existing registered Components keep their typed JSON props contract. Use
`format:"kit"` only when intentionally choosing a registered Component; use `format:"html"` for bespoke
visual explanation. The retrieved Component/pattern candidates are useful landmarks, not a closed menu.

Submit with `apply_block`, copying the returned target block id, timing and placement unchanged and adding
the complete raw model response. The insertion preserves the duration it was authored for, so later edge
drags time-stretch its entrance, payoff/hold and exit instead of cutting choreography off.

## Existing Component

Call `get_block` when the requested edit must preserve or inspect existing content. Then call
`compose_block_brief {blockId,instruction}`. Existing timing, box, design context and current props/markup
are supplied automatically. Apply using the same `blockId` and returned target.

Do not regenerate for a pure timeline move or resize: use the relevant timeline/placement tool. A later
Frame switch does not rewrite already generated Components; only an explicit edit does.

## Design standard

- Treat the actual canvas region like a responsive page surface: establish hierarchy, whitespace,
  alignment, scale and one focal path for its real aspect ratio.
- Inherit the whole-film typography, materials, imagery and motion grammar. Vary the form because the
  content and neighboring Scene differ, not by inventing a new style.
- Reveal in response to speech/action/evidence. Give the layer an entrance, development, payoff, readable
  hold and clean exit; later spoken content must remain hidden until its local beat.
- Use real screenshots/pages/posts/maps/code or product evidence truthfully. Do not redraw authentic
  interfaces as fake generic UI when the real source is available.
- Use `get_icons` for semantic/brand SVGs. Do not hand-draw familiar icons or use emoji as substitute art.
- Keep phone-size legibility and protected subjects ahead of decorative detail.

## Lint and visual repair

`apply_block` validates scoped CSS, deterministic animation and the output contract. On rejection, repair
only the listed issues and re-apply with the same stable `blockId`; do not restart the design or alter
unrelated content.

After it lands, call `capture_frame` at a meaningful moment for a local change, or `review_sequence` for a
complete Scene/film pass. Inspect its entrance, development, payoff and exit images in order. Check the
composed picture—not the Component in isolation:
source dominance, placement, overlap, scale, contrast, readable hold, exit and continuity. Fix the Scene,
not merely the prettiest thumbnail.

Hosted `add_block` / `edit_block` are credit-charging fallbacks. The BYO brief/apply path uses the caller's
own agent model and should be the default for MCP agents.
