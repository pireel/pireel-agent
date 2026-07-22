---
name: pireel
description: Edit talking-head videos in Pireel Studio through the `pireel` MCP server — first-run connect/setup, transcript-based cutting, storyboarding, designed graphic blocks, kinetic captions, themes, MP4 export, local media import, and error recovery. Read this whenever the user wants to install/connect/set up Pireel, or to edit/cut/trim/storyboard/illustrate/caption/theme/export a Pireel video, or when any `pireel` MCP tool is about to be called for the first time or fails. Routes to the right bundled reference for each task.
---

# Pireel Studio

Pireel Studio (https://pireel.com) is a video editor for **talking-head videos** (any aspect — the canvas follows the source footage). Your tools edit the composition **live in the user's open studio browser tab** via the `pireel` MCP server; when no tab is open, data-level tools fall back to **OFFLINE MODE** against the user's latest cloud project.

This one skill covers the whole product. Skim the essentials below, then **open the matching file in `references/` for the task at hand** — don't work from memory on the specialized flows.

## Essentials (true for everything)

- **Two element kinds.** Overlay **blocks** = designed graphics laid over the video (metric cards, comparisons, charts, callouts, titles) — the main event. Video **shots** = segments of the talking-head clip, each with a framing treatment (`full` / `punch-in` / `corner-br`|`corner-tl` / `split-l`|`split-r`). Cuts are hard jumps; visual variety comes from framing, not transitions.
- **`get_state` first — and again after any failed mutation.** Ids for blocks/shots/frames/presets come from `get_state`, tool receipts, `list_frames`, or the caption catalog. Never invent an id.
- **Two clocks.** "edited" = final-timeline seconds (cut/split/trim/add_block address by it). "src" = a segment's own source-file seconds (the narration transcript uses the MAIN source clock). Don't mix them.
- **BYO generation is free.** Text/HTML you write yourself (block composition, plan, visual labels) runs on the user's own agent subscription, NOT Pireel credits. Only tools whose description carries a `[…CHARGES…]` marker bill credits (image/video generation + Pireel-LLM fallbacks). Prefer the BYO path.
- **Surface the editor early on real work.** Call `create_browser_handoff` and open the returned `url` with YOUR OWN built-in/embedded browser tool — never the OS `open`/`start`/`xdg-open`, the user's default browser, or an already-connected external Chrome (single-use ticket, ~60s). Then keep that tab **visible and open past your turn** so it isn't auto-cleaned — use your browser tool's own visibility and keep-tab/persist controls (details in `references/pireel-basics.md`). No embedded browser? Hand the user the plain `https://pireel.com/zh/studio/<id>` link instead. Never print the handoff url.

## Routing — read the reference for the task

| The user wants to… | Read |
|---|---|
| Install / connect / set up Pireel, or a tool reports it's not connected | `references/getting-started.md` |
| Understand the model + tool routing in depth (read before the first edit) | `references/pireel-basics.md` |
| Use a LOCAL video or image file | `references/asset-import.md` |
| Clean up a raw talking-head A-roll (retakes, filler, dead air) | `references/talking-head-cleanup.md` |
| Add a designed graphic block (BYO HTML) | `references/compose-blocks.md` |
| Draft a full storyboard in one shot | `references/storyboard-draft.md` |
| Add / restyle captions | `references/captions.md` |
| Export an MP4 | `references/export.md` |
| Answer pricing / credits / plan / UI questions | `references/product-help.md` |
| Recover from a tool error, timeout, or `apply_block` lint rejection | `references/known-errors.md` |

The local media import helper lives at `scripts/import-media.mjs` (Node ≥ 20, zero dependencies).

**Locating the references.** Every path above (`references/…`, `scripts/…`) is relative to THIS skill's own directory — the folder that contains this `SKILL.md`. If your agent hands you the skill directory, read them directly. If it doesn't, locate this skill once and resolve from there, e.g. `find ~ -path '*/skills/pireel/SKILL.md' 2>/dev/null` (Codex/Claude Code install skills as plain files on disk); the references sit in `references/` right next to this file, and `references/product-help/` holds the pricing/UI sub-docs.

## Billing

Agent orchestration and every BYO flow run on the user's own agent subscription, not Pireel credits. Pireel bills only media generation (images/video) and the audio/vision pipelines (transcription, visual analysis). Details in `references/product-help.md`.

## Skill version

`2026-07-22.1`. On connect, the Pireel MCP server announces its current skill baseline in its instructions. The format is `YYYY-MM-DD.rev` — compare the date first, then the numeric `.rev` (e.g. `2026-07-21.3` is newer than `2026-07-21.2`; a bare `2026-07-21` counts as `.0`). If the server's baseline is **newer** than the version above, tell the user once to update the skill: `npx skills update pireel` (or re-run `npx skills add pireel/pireel-agent`). Don't nag if they match.
