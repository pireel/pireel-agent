---
name: montage-variants
description: Use when several local or library clips should become a deliberate montage, product ad, social short, or multiple independently editable versions. Covers discovery questions, Frame choice, source-span selection, output topology, pilot-first production, and the minimum creative bar beyond simple concatenation.
---

# Montage and multiple variants

A montage is an editorial argument or experience built from several sources. It is not every file played once in filename order. When the user asks for product ads or a group of short videos, each output also needs a reason to exist; duplicated timelines with cosmetic changes are not meaningful variants.

## Resolve the deliverable before multiplying it

Inspect `get_state`, `list_outputs`, `list_assets`, and the available footage before asking the user to repeat known information. Establish:

- whether they want one finished montage or a family of outputs;
- output count, duration, ratio, platform, language, and purpose;
- what should vary: hook, audience, proof order, use case, duration, placement, or another meaningful hypothesis;
- product identity, supported claims, offer, CTA, mandatory copy, and prohibited claims;
- narration source, music/source-sound direction, rights, and brand constraints.

If the user says only “一组”, “多条”, “several”, “a batch”, or “variants”, do not silently make one output. After the safe asset audit, offer two or three concrete family shapes with tradeoffs and wait for the user. Examples: three hook hypotheses; two structurally different ads plus short cutdowns; or one representative pilot before expansion.

Ask only one blocking decision at a time. Do not pair a bounded choice with a second open-ended question in the same response. Never invent product results, price, discount, scarcity, endorsement, CTA destination, music rights, or legal wording.

## Offer a visual system before the pilot

Skill and Frame remain independent: content category never determines a Frame. For a complete creative build with no attached Frame, once you understand the footage and requested visual feeling, call `list_frames` and recommend one or two evidence-based candidates plus a themeless option. Wait for the choice. After authorization, call `attach_frame`, then `read_frame`, and carry that audiovisual language through typography, crops, pacing, motion, captions, graphics, sound-image relationships, and ratio adaptations. Do not merely recolor generic cards.

The user may always remain themeless. Themeless still requires deliberate visual craft.

## Audit the clips as usable actions

Use metadata and visual inspection to identify each source's real editorial function: product identity, reveal, mechanism, contact, application, consequence, human context, reaction, proof, or CTA hold. Find the strongest span inside repeated or long takes. Preserve action continuity when anticipation, contact, and consequence matter.

An equal-duration slice from each file, one untouched span per file, or filename-order assembly is only an import/continuity test. Never describe it as a finished montage or pilot.

A deliberate first pass should have:

- a specific opening reason to keep watching;
- selected source spans, not arbitrary clip heads;
- pace changes motivated by action and meaning;
- mobile-safe crops or reframing that keep the product and hands legible;
- an explicit audio strategy: narration, source sound, BGM, silence, or a controlled combination;
- truthful on-screen copy, captions, proof, and CTA when supplied;
- a clear ending or loop rather than a file simply running out.

Use transitions sparingly. Hard cuts, action matches, scale changes, source sound, and purposeful holds usually create stronger rhythm than a transition on every seam.

## Build the output family visibly

Use `create_output` for genuinely independent concepts and `duplicate_output` for controlled variations of an approved master. Use `switch_output` and `rename_output` so the user can understand the family. Re-read `get_state` after every switch because timeline ids are output-local.

Create a representative pilot before multiplying uncertain claims, audio, generation, Frame treatment, or layout. Once the pilot is coherent, expand the family in small logical batches. Each output must have a distinct hypothesis, such as mechanism-first versus creator-first, rather than a different color or random shot order.

For local B-roll, follow `asset-import.md`: the helper streams each file over localhost into the open Studio tab's OPFS, and `insert_clip {sig}` places it without an R2 upload.

## Review the result as a viewer

Inspect representative opening, proof, and ending moments in every output. Use `capture_frame` for visual verification and check the active output with `get_state` after structural mutations. Confirm:

- the opening is clear and supported;
- product identity and important actions are legible at phone size;
- claims stay adjacent to real evidence;
- pace is varied but not concealing missing continuity;
- captions, graphics, face, hands, product, and CTA do not compete;
- sound has hierarchy and does not imply events that were never shown;
- variants differ in viewer-relevant meaning;
- no placeholder, stale offer, accidental local reference, or silent failed operation remains.

If the material cannot support the requested number of distinct outputs, say so and propose a smaller truthful family or a precise pickup-shot list. Fewer useful versions are better than variant theater.
