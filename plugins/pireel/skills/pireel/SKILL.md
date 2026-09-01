---
name: pireel
description: Edit videos in Pireel Studio through the `pireel` MCP server — first-run setup, local and stock media import, transcript editing, multi-source montage, multiple editable outputs, storyboarding, designed graphics, captions, themes and export. Read this whenever the user wants to install/connect Pireel or edit, cut, remix, storyboard, illustrate, caption, theme or export a Pireel video, and before the first Pireel MCP call or after a tool failure. Routes to the matching bundled playbook.
---

# Pireel Studio

Pireel Studio (https://pireel.com) is a multi-source, multi-track video editor that can produce multiple independently editable cuts from one project. Your tools edit the composition **live in the user's open studio browser tab** via the `pireel` MCP server; when no tab is open, data-level tools fall back to **OFFLINE MODE** against the user's latest project.

This one skill covers the whole product. Skim the essentials below, then **open the matching file in `references/` for the task at hand** — don't work from memory on the specialized flows.

## Essentials (true for everything)

- **What you edit.** Typed tracks of clips: a primary video story spine (`role=primary`), concurrent B-roll / PiP (`role=broll`), images, narration / music / SFX audio lanes, captions, and **Components** — designed overlay layers stored as **blocks** (Motion Graphics are the main Component family today). Video **shots** are the segments of the visual clips; each has its own source clock, framing (`full` / `punch-in` / `corner-*` / `split-*` shortcuts, or an exact crop via `set_shot_framing`), speed, color filter and audio treatment. A shot boundary is a hard cut by default; `add_transition` adds one where a change of time, place, chapter or mode earns it.
- **Speech is one editing surface, not the entrance.** When footage carries speech, `read_script` + `cut_narration` edit it by transcript. When it doesn't — B-roll, product footage, screen recordings, music-led montage — edit by time, picture and sound with the same clip tools (`add_clips` / `split_clips` / `move_clips` / `trim_shot` / `cut_range` / `set_shot_framing` / `set_bgm`). Never ask for a script or transcript before editing speechless footage; `get_transcript` reporting no coverage is information, not an error.
- **`get_state` first — and again after any failed mutation.** Ids for blocks/shots/clips/frames/presets come from `get_state`, `get_timeline`, tool receipts, `list_frames`, or the caption catalog. Never invent an id.
- **Two clocks.** "edited" = final-timeline seconds (cut/split/trim/add_block/set_bgm address by it). "src" = a clip's own source-file seconds (a transcript is stamped in its own source's clock). Don't mix them.
- **BYO generation is free.** Text/HTML you write yourself (block composition, plan, visual labels) runs on the user's own agent subscription, NOT Pireel credits. Only tools whose description carries a `[…CHARGES…]` marker bill credits (image/video generation + Pireel-LLM fallbacks). Prefer the BYO path.
- **Surface the editor early on real work.** Call `create_browser_handoff` and open the returned `url` with YOUR OWN built-in/embedded browser tool — on Codex, use the in-app Browser runtime rather than connected Chrome. Never use the OS `open`/`start`/`xdg-open`, the user's default browser, or an already-connected external Chrome proactively (single-use ticket, ~60s). Keep that tab visible and open past your turn using its keep/finalize controls (details in `references/pireel-basics.md`). If and only if a LOCAL helper attempt explicitly returns `local loopback is unreachable from this browser`, release the isolated tab, open one fresh handoff in a controllable connected browser that shares the agent host's `127.0.0.1`, and retry once with a fresh token. Never print the handoff url.

## Routing — read the reference for the task

| The user wants to… | Read |
|---|---|
| Install / connect / set up Pireel, or a tool reports it's not connected | `references/getting-started.md` |
| Understand the model + tool routing in depth (read before the first edit) | `references/pireel-basics.md` |
| Use an account private/community Studio Skill or its bound voice | `references/pireel-basics.md` |
| Use a LOCAL video or image file | `references/asset-import.md` |
| Edit a speech-led video end to end (interview, lesson, commentary, podcast, direct-to-camera): cleanup, restructure, B-roll, graphics, sound | `references/craft/talking-head-edit.md` |
| Clean up a raw talking-head A-roll only (retakes, filler, dead air) | `references/talking-head-cleanup.md` |
| Compose a montage from a body of footage (emotion, motifs, rhythm, sound) | `references/craft/montage-edit.md`, then `references/montage-variants.md` for output families / variants |
| Mix several clips into product ads or create multiple editable outputs / variants | `references/montage-variants.md` |
| Edit footage that has no speech (B-roll, product shots, screen recordings, music-led material) | `references/pireel-basics.md` (clip tools) → `references/craft/montage-edit.md` for a deliberate assembly |
| Add / fit background music, sound effects, per-clip sound, transitions, or beat-aligned cuts | `references/craft/audio-and-music.md` |
| Add a designed graphic block (BYO HTML) | `references/compose-blocks.md` |
| Design or execute a complete first cut / finished video | `references/storyboard-draft.md` |

`references/craft/` holds Pireel's built-in craft skills verbatim — the same playbooks the Studio chat uses and that `list_skills` / `read_skill` serve over MCP. Read the local copy (no round trip); if the MCP server announces a newer workflow baseline than your installed `VERSION`, prefer `read_skill` for the freshest text.
| Add / restyle captions | `references/captions.md` |
| Export an MP4 | `references/export.md` |
| Answer pricing / credits / plan / UI questions | `references/product-help.md` |
| Recover from a tool error, timeout, or `apply_block` lint rejection | `references/known-errors.md` |

The local media import helper lives at `scripts/import-media.mjs` (Node ≥ 20, zero dependencies).

**Locating the references.** Every path above (`references/…`, `scripts/…`) is relative to THIS skill's own directory — the folder that contains this `SKILL.md`. If your agent hands you the skill directory, read them directly. If it doesn't, locate this skill once and resolve from there, e.g. `find ~ -path '*/skills/pireel/SKILL.md' 2>/dev/null` (Codex/Claude Code install skills as plain files on disk); the references sit in `references/` right next to this file, and `references/product-help/` holds the pricing/UI sub-docs.

## Billing

Agent orchestration and every BYO flow run on the user's own agent subscription, not Pireel credits. Pireel bills only media generation (images/video) and the audio/vision pipelines (transcription, visual analysis). Details in `references/product-help.md`.

## Distribution preference and workflow updates

The `VERSION` file next to this SKILL.md is the Pireel **workflow baseline**, not the
Plugin version. The Plugin has its own SemVer in `.codex-plugin/plugin.json`; never compare
those two values.

First determine how this skill was installed. A Plugin bundle has a host-provided Plugin identity
or a `.codex-plugin/plugin.json` two directories above this SKILL.md. Anything else is standalone.

When this is a **standalone Skill** and the current host can natively install Plugins, migrate to
the matching-environment Pireel Plugin before editing:

1. If the matching Plugin is already active and exposes the expected MCP server/endpoint, use it
   immediately. Do not update, register or invoke a duplicate standalone copy.
2. Otherwise install the Plugin through the host's native Plugin manager, reload/start a new
   session when the host requires it, authenticate, and verify `get_state` through the exact MCP
   endpoint for this environment.
3. Only after that verification succeeds, retire the standalone Skill and any manual MCP entry
   through the host's normal removal/config flow. Never delete the working standalone connection
   first. If cleanup needs a user/admin action, request that one action; until then, leave the old
   copy installed but do not invoke or re-register it.
4. If Plugin installation is unsupported, unavailable, denied or fails verification, keep the
   standalone route working and continue with its update path below.

Do not ask the user to choose a distribution. Plugin is the preferred channel whenever the host
can actually install and load it; standalone remains the compatibility fallback.

On connect, the Pireel MCP server announces its current workflow baseline. Versions are opaque
release tags — don't order them. If the installed `VERSION` differs, use the current distribution's
update channel:

- **Plugin bundle:** do **not** run `npx skills`. Use the host's Plugin update/reinstall flow when
  it is directly available.
  Otherwise mention once that the Pireel Plugin needs updating, then continue with the installed
  workflow.
- **Standalone Skill:** when migration did not complete, run `npx skills update pireel` yourself
  (fallback:
  `npx skills add pireel/pireel-agent`) through the host's normal command-approval flow, then
  re-read the updated files.

After one update attempt, if the values still differ, the update mechanism is unavailable or
denied, or `VERSION` is missing, mention it once and continue. Don't nag when they match.
