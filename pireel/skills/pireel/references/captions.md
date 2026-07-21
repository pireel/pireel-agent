---
name: captions
description: Managing the subtitle layer in Pireel Studio — set_captions and remove_captions, the 18 caption style presets (word-emphasis vs line-by-line), and tuning position (yPct) and size (scale). Use when the user asks to add, remove, restyle, move, or resize subtitles/captions on a video.
---

# Captions

Captions in Pireel Studio are a **global preset layer** laid from the spoken transcript: ONE setting styles the WHOLE video. They are not per-block edits — a single `set_captions` call turns them on, restyles them, or repositions them everywhere at once, and cutting the video re-lays them automatically (never hand-fix captions after a cut).

The keyword-slam "花字" effect is a different thing: that is an overlay **block** (BYO flow via `compose_block_brief` → `apply_block`), not the caption layer.

## Tools

- `set_captions {preset?, yPct?, scale?}` — turn captions on and/or restyle:
  - `preset` — a style id from the catalog below. Passing it (re)builds the layer from the transcript, enabling captions if off; ASR runs first automatically if there is no transcript yet. **Never invent an id.**
  - `yPct` — the caption baseline's distance from the TOP as a percentage. Smaller = higher on screen. Omit to keep current.
  - `scale` — size multiplier; `1` = the preset's default. Omit to keep current.
  - Omit `preset` to only reposition/resize the current captions (e.g. "move the subtitles up a bit" → `set_captions {yPct: <smaller>}`; "make them bigger" → `set_captions {scale: 1.2}`).
- `remove_captions` — turn the whole layer off. It does not touch keyword blocks (delete those with `delete_block`).
- `set_caption_translations {items?, shotId?, clear?}` — bilingual subtitles (see below).

`get_state` reports the current caption status (`Captions: ON — preset …, baseline …% from top` or `off`).

## Bilingual subtitles (translation line)

A second, smaller line under each caption showing YOUR translation of that sentence — you translate, the tool only stores. This costs no Pireel credits.

1. `read_script` — the transcript comes back as numbered rows (`0. [x–y s] text`).
2. Translate every row yourself into the target language (keep each translation one sentence, no timestamps).
3. `set_caption_translations {items: [{index: 0, text: "…"}, …]}` — `index` is the row number from step 1. Batch all rows in ONE call.
4. If captions are off, the tool says so — follow with `set_captions {preset}` to show them.

Notes:
- Translations attach to the transcript, so cuts/restyles/re-lays keep them; re-transcribing a new file drops them.
- Inserted clips have their own transcript — translate those with a second call passing `shotId` (the inserted-clip shot id from `read_script`).
- Fix one line: resend just that `{index, text}`. Remove one: `text: ""`. Remove all: `{clear: true}`.
- The translation line inherits the caption preset's look (smaller, no per-word animation) — there is no separate style knob for it.

## The 18 presets — two modes

**emphasis (逐词强调)** — the whole line stays on screen; the word currently being spoken is highlighted (color change, underline slide, or box pop). Energetic, spoken-word feel.

| id | look |
| --- | --- |
| `em-yellow` | white text, yellow current word, drop shadow (the classic default) |
| `em-green` | white text, neon-green current word, drop shadow |
| `em-purple-black` | black bar, white text, purple current word |
| `em-serif-black` | black bar, serif, teal current word |
| `em-underline` | black bar, white underline slides under the current word |
| `em-blue-line` | light bar, dark text, blue underline on the current word |
| `em-box-purple` | purple bar, dark box pops behind the current word |
| `em-box-blue` | blue bar, black box pops behind the current word |
| `em-pink` | pink bar, soft-pink text, current word flips to white |
| `em-gold-serif` | cream bar, gold serif text, darker-gold current word |

**line (整句字幕)** — clean line-by-line fade-in, no per-word animation. Calm, documentary/informational feel.

| id | look |
| --- | --- |
| `ln-clean` | bare white text with shadow, no bar |
| `ln-black` | black bar, white text |
| `ln-navy` | navy-gray bar, white serif |
| `ln-white` | white bar, blue italic text |
| `ln-orange` | orange bar, bold white text |
| `ln-yellow` | yellow bar, black text |
| `ln-red` | red bar, white monospace |
| `ln-mint` | mint text with shadow, no bar |

## Choosing

- Bare "add subtitles" with no style preference → default to a clean **line** preset (`ln-clean` is the safe pick).
- High-energy talking-head / hook-driven content, or the user says "highlight the words as I speak" → an **emphasis** preset (`em-yellow` if no color preference).
- Match the attached frame/theme palette when one exists (e.g. a dark editorial theme pairs with `em-serif-black` or `ln-navy`; a loud commerce theme with `em-box-blue` or `ln-yellow`). Content fit beats variety.
- User names a color/mood ("yellow captions", "something serif") → pick the preset whose look matches; do not try to restyle beyond the catalog.

## Position and size

- Default placement is fine for most videos; adjust when captions collide with graphics or the speaker's face (check shot treatments — `split-l/r` and corner framings change where free space is).
- "Higher/lower" → nudge `yPct` (smaller = higher). "Bigger/smaller" → `scale` around 1 (e.g. 1.15 / 0.85). These are independent of the preset and of each other.

## Recovery

- If the user dislikes the result: another `set_captions` with a different preset is cheaper than `undo` and keeps position tweaks explicit.
- "No captions" / "turn them off" → `remove_captions`, not `delete_blocks`.
