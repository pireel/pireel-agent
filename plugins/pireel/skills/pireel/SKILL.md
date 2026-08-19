---
name: pireel
description: Edit videos in Pireel Studio Preview through the `pireel-preview` MCP server — first-run setup, local and stock media import, transcript editing, multi-source montage, multiple editable outputs, storyboarding, designed graphics, captions, themes and export. Read this whenever the user wants to install/connect Pireel Preview or edit, cut, remix, storyboard, illustrate, caption, theme or export a Pireel video, and before the first Pireel Preview MCP call or after a tool failure. Routes to the matching bundled playbook.
---

# Pireel Studio

Pireel Studio Preview (https://preview.pireel.com) is a multi-source video editor that can produce multiple independently editable cuts from one project. Your tools edit the composition **live in the user's open studio browser tab** via the `pireel-preview` MCP server; when no tab is open, data-level tools fall back to **OFFLINE MODE** against the user's latest Preview project.

This one skill covers the whole product. Skim the essentials below, then **open the matching file in `references/` for the task at hand** — don't work from memory on the specialized flows.

## Essentials (true for everything)

- **Two element kinds.** **Components** are the broad extensible visual-element concept and are stored as overlay **blocks**; Motion Graphics (words, number, data, logo, overlay, real source) are the primary Component family available today. Video **shots** = segments of the talking-head clip, each with a framing treatment (`full` / `punch-in` / `corner-tl`|`corner-tr`|`corner-bl`|`corner-br` / `split-l`|`split-r`|`split-t`|`split-b`; the split axis follows the canvas — portrait splits top/bottom, landscape splits left/right). Cuts are hard jumps; visual variety comes from framing, not transitions.
- **`get_state` first — and again after any failed mutation.** Ids for blocks/shots/frames/presets come from `get_state`, tool receipts, `list_frames`, or the caption catalog. Never invent an id.
- **Two clocks.** "edited" = final-timeline seconds (cut/split/trim/add_block address by it). "src" = a segment's own source-file seconds (the narration transcript uses the MAIN source clock). Don't mix them.
- **BYO generation is free.** Text/HTML you write yourself (block composition, plan, visual labels) runs on the user's own agent subscription, NOT Pireel credits. Only tools whose description carries a `[…CHARGES…]` marker bill credits (image/video generation + Pireel-LLM fallbacks). Prefer the BYO path.
- **Surface the editor early on real work.** Call `create_browser_handoff` and open the returned `url` with a browser surface YOU can control — never the OS `open`/`start`/`xdg-open` or an uncontrolled default browser (single-use ticket, ~60s). For LOCAL helper imports, that browser must share the agent host's `127.0.0.1`; on Codex prefer a connected Chrome extension when available because the in-app browser may isolate loopback. For cloud-only work the embedded browser remains preferred. Keep the tab open past your turn using the selected browser's keep/finalize controls (details in `references/pireel-basics.md`). Never print the handoff url.

## Routing — read the reference for the task

| The user wants to… | Read |
|---|---|
| Install / connect / set up Pireel, or a tool reports it's not connected | `references/getting-started.md` |
| Understand the model + tool routing in depth (read before the first edit) | `references/pireel-basics.md` |
| Use a LOCAL video or image file | `references/asset-import.md` |
| Mix several clips, make product ads, or create multiple editable outputs / variants | `references/montage-variants.md` |
| Clean up a raw talking-head A-roll (retakes, filler, dead air) | `references/talking-head-cleanup.md` |
| Add a designed graphic block (BYO HTML) | `references/compose-blocks.md` |
| Design or execute a complete first cut / finished video | `references/storyboard-draft.md` |
| Add / restyle captions | `references/captions.md` |
| Export an MP4 | `references/export.md` |
| Answer pricing / credits / plan / UI questions | `references/product-help.md` |
| Recover from a tool error, timeout, or `apply_block` lint rejection | `references/known-errors.md` |

The local media import helper lives at `scripts/import-media.mjs` (Node ≥ 20, zero dependencies).

**Locating the references.** Every path above (`references/…`, `scripts/…`) is relative to THIS skill's own directory — the folder that contains this `SKILL.md`. If your agent hands you the skill directory, read them directly. If it doesn't, locate this skill once and resolve from there, e.g. `find ~ -path '*/skills/pireel/SKILL.md' 2>/dev/null` (Codex/Claude Code install skills as plain files on disk); the references sit in `references/` right next to this file, and `references/product-help/` holds the pricing/UI sub-docs.

## Billing

Agent orchestration and every BYO flow run on the user's own agent subscription, not Pireel credits. Pireel bills only media generation (images/video) and the audio/vision pipelines (transcription, visual analysis). Details in `references/product-help.md`.

## Workflow version and update channel

The `VERSION` file next to this SKILL.md is the Pireel **workflow baseline**, not the
Plugin version. The Plugin has its own SemVer in `.codex-plugin/plugin.json`; never compare
those two values.

On connect, the Pireel MCP server announces its current workflow baseline. Versions are opaque
release tags — don't order them. If the installed `VERSION` differs, first determine how this
skill was installed:

- **Plugin bundle:** if the host identifies this as a skill bundled by the Pireel Plugin, or
  `.codex-plugin/plugin.json` exists two directories above this SKILL.md, do **not** run
  `npx skills`. Use the host's Plugin update/reinstall flow when it is directly available.
  Otherwise mention once that the Pireel Plugin needs updating, then continue with the installed
  workflow.
- **Standalone Skill:** run `npx skills update pireel` yourself (fallback:
  `npx skills add pireel/pireel-agent`) through the host's normal command-approval flow, then
  re-read the updated files.

After one update attempt, if the values still differ, the update mechanism is unavailable or
denied, or `VERSION` is missing, mention it once and continue. Don't nag when they match.
