---
name: montage-variants
description: Use when several local or library clips should become a deliberate montage, product ad, social short, or multiple independently editable versions. Covers discovery questions, Frame choice, source-span selection, output topology, pilot-first production, and the minimum creative bar beyond simple concatenation.
---

# Montage and multiple variants

A montage is an editorial argument or experience built from several sources. It is not every file played once in filename order. When the user asks for product ads or a group of short videos, each output also needs a reason to exist; duplicated timelines with cosmetic changes are not meaningful variants.

## Resolve the deliverable before multiplying it

Inspect `get_state` (it lists the outputs and the asset inventory; `library:true` marks footage not placed yet), `search_assets {scope:"mine"}` when the library needs searching, and the available footage before asking the user to repeat known information. Establish:

- whether they want one finished montage or a family of outputs;
- output count, duration, ratio, platform, language, and purpose;
- what should vary: hook, audience, proof order, use case, duration, placement, or another meaningful hypothesis;
- product identity, supported claims, offer, CTA, mandatory copy, and prohibited claims;
- narration source, whether a newly written voiceover would strengthen the ad, music/source-sound direction, rights, and brand constraints.

If the user says only “一组”, “多条”, “several”, “a batch”, or “variants”, do not silently make one output. After the safe asset audit, offer two or three concrete family shapes with tradeoffs and wait for the user. Examples: three hook hypotheses; two structurally different ads plus short cutdowns; or one representative pilot before expansion.

Ask only one blocking decision at a time. Do not pair a bounded choice with a second open-ended question in the same response. Never invent product results, price, discount, scarcity, endorsement, CTA destination, music rights, or legal wording.

## Choose how the edit communicates

Voiceover is optional, but a content or visual narrative spine is required. After the deliverable shape and product facts are clear, choose one primary mode before the Frame and pilot:

- **voice-led:** existing speech, a user recording, or an approved generated voiceover carries the argument;
- **screen-copy-led:** concise hook, value, proof, and CTA copy carry the message with music and/or useful source sound;
- **visual-led:** selected actions, composition, source sound, and brand feeling carry the edit with minimal copy; use it for product-world or brand work, not as a guaranteed conversion format.

Use an explicit mode from the request when available. Otherwise infer and recommend the strongest mode from the inspected footage and product truth. Generated voiceover is a common ad-production route when useful product action exists but the material lacks a coherent spoken argument; proactively consider it for the hook, mechanism, proof, or CTA instead of waiting for the user to name the tool. Do not require voiceover just because the clips are silent, and do not silently generate speech or music from a general request for a finished montage.

When generated voiceover is the recommendation, write a concise footage-aware draft from approved facts and include the exact script, language, delivery direction, and voice requirement in the pilot proposal. Approve may authorize that exact script and charge-bearing generation; do not add another abstract mode question unless a materially different argument remains unresolved. For multiple outputs, define which script, copy, caption, source-sound, and music layers are shared versus intentionally varied.

## Offer a visual system before the pilot

Skill and Frame remain independent: content category never determines a Frame. For a complete creative build with no attached Frame, once you understand the footage and requested visual feeling, call `manage_frame {action:"list"}` and recommend one or two evidence-based candidates plus a themeless option. When real product footage and light promotional type are the strongest treatment, include `performance-native` (Product Native) as the baseline candidate; it keeps the product full, derives accents from the product world, and reserves Motion Graphics for information that native text (`set_texts`) cannot carry. Wait for the choice unless the user has already said to proceed without asking — then pick the strongest, name it, and continue. After the choice, call `manage_frame {action:"attach", id}`, then `manage_frame {action:"read"}`. Treat its showcases as reference vocabulary rather than framing, layout or transition templates. Your plan — held in working context, not persisted — chooses source spans, media, pacing and composition from the evidence; express the Frame through transferable shape, material, image treatment, typography, color-role relationships, spatial tension, motion temperament and sparse sound texture. Manual palette, captions and layout remain authoritative. Do not merely recolor generic cards.

For ordinary product montage, default to real footage plus native text or managed captions. A short hook, benefit, ingredient, texture note, proof qualifier, offer or CTA in product-derived color is the normal graphic layer. Do not create charts, process diagrams, device mockups, multi-card explainers or full-screen Motion Graphics unless the actual product truth genuinely needs that form.

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

All output management is `manage_project` with `scope:"output"` (the default). Use `action:"create"` for genuinely independent concepts and `action:"duplicate"` for controlled variations of an approved master. Use `action:"switch"` and `action:"rename"` so the user can understand the family. A switch returns the new `get_state`; timeline clip and track ids are output-local, so never carry ids across a switch.

Create a representative pilot before multiplying uncertain claims, audio, generation, Frame treatment, or layout. Derive its creative thesis, rhythm arc, whole-film video design system and progression of movements from the actual actions and evidence in the footage. Present that proposal and wait for approve/reject before publishable-looking construction. After approval, compile the pilot directly with the batched clip, framing, sound, caption and Component tools; the plan itself stays in your working context as a few sentences (thesis, order of movements, where sound leads) — there is no persisted plan artifact, and a passage is repaired by editing its clips. Once the pilot is coherent and reviewed (`inspect_timeline` with no frames reviews the whole output as a sequence), expand the family in small logical batches. Each output must have a distinct hypothesis, such as mechanism-first versus creator-first, rather than a different color or a random clip order.

If the approved pilot includes generated voiceover, call `generate_speech` with the exact approved script and a `voiceId`, pass its returned asset fields unchanged to `register_media`, then place it with `add_clips` using `role:"narration"`. Use `manage_voices {action:"list"}` first only when a specific voice identity matters. Treat the known script as semantic truth; call `get_transcript` with the exact `assetId` only when performed word timing, pauses, captions, animation, or beat-aware passage boundaries require measurement (transcript timing is source seconds).

When a passage earns a Motion Graphic, decide its real region and what picture it overlays before generation. Pass `atFrame`, `durationFrames`, `placement` and `backdrop` into `compose_component`, generate the component with your own model from the returned `{system, prompt, target}`, then submit it with `apply_component` copying the target unchanged. Do not generate standalone cards and scatter them over an already assembled montage.

For local B-roll, follow `asset-import.md`: the helper streams each file over localhost into the open Studio tab's OPFS, and `add_clips` / `insert_clips` place the registered asset by id without an R2 upload.

## Review the result as a viewer

Inspect representative opening, proof, and ending moments in every output. Use `inspect_timeline` with no frames for the
complete pilot and each finished output; use `inspect_timeline {frames:[…]}` at the exact frames only for one small local change.
Nothing there hears audio — read levels and fades from `get_state`. Patch your model of the active output from each
mutation's delta; re-read `get_state` only after a switch or a rejected call. Confirm:

- the opening is clear and supported;
- product identity and important actions are legible at phone size;
- claims stay adjacent to real evidence;
- pace is varied but not concealing missing continuity;
- captions, graphics, face, hands, product, and CTA do not compete;
- sound has hierarchy and does not imply events that were never shown;
- variants differ in viewer-relevant meaning;
- no placeholder, stale offer, accidental local reference, or silent failed operation remains.

If the material cannot support the requested number of distinct outputs, say so and propose a smaller truthful family or a precise pickup-shot list. Fewer useful versions are better than variant theater.
