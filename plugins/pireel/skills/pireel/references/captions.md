---
name: captions
description: Managing the subtitle layer in Pireel Studio — set_captions for on/off, the caption look (artistic and basic presets), the independent animation, highlight color and highlighted words, position (yPct), size (scale), wording corrections and bilingual translation lines. Use when the user asks to add, remove, restyle, animate, highlight, move, resize, correct or translate subtitles/captions on a video.
---

# Captions

Captions in Pireel Studio are a **managed caption track** laid from the spoken transcript: ONE object styles the WHOLE video. They are not per-clip edits — a single `set_captions` call turns them on or off, restyles them, repositions them, corrects wording or adds a translation line everywhere at once, and cutting the video re-derives the cues automatically (never hand-fix captions after a cut; cues are never addressed individually). `get_state` reports the caption track as one captions object, never as cue clips.

The keyword-slam "花字" effect is a different thing: that is a graphic **component** (BYO flow via `compose_component` → `apply_component`) or a `set_texts` text clip, not the caption layer.

## Reading the current look

`get_state` → the caption track's `captions.style` is `{preset, animation, highlightColor?, yPct, scale, font?}` — the same names `set_captions` takes. Read it before restyling so "make it livelier" or "keep the look, change the motion" starts from what is on screen.

## Tools

Everything goes through `set_captions`; pass only the fields you mean to change.

- `on` — `true` shows the layer, `false` hides it. Passing `preset` alone enables captions if off. ASR runs first automatically if there is no transcript yet (transcription charges).
- `preset` — the **look** (typography, outline, plate, row layout). The parameter's description lists every current look with a one-line description. **Never invent an id.** Changing the look keeps the current animation.
- `animation` — the **motion**, independent of the look: `none`, whole-caption entrances (`fade`, `rise`, `pop`, `slide`, `blur`, `typewriter`) and word-timed emphasis (`karaoke`, `underline`, `marker`, `pulse`, `bounce`, `glow`). Changing the animation keeps the look.
- `highlightColor` — `#RRGGBB` for whatever the animation emphasizes (the karaoke word color, the marker box, the underline, the pulse/bounce/glow word) and the default color of highlighted words. `"animation"` restores the animation's own color.
- `highlights {items:[{index, text}], color?}` — highlighted words: they stay colored for as long as their caption shows. `index` is the transcript row from `get_transcript` (same numbering as `corrections`), `text` the exact word(s) copied from that row. `color`: `"style"` (default — follows `highlightColor`), a fixed `#RRGGBB`, or `"off"` to clear those words; `clear: true` clears every highlight. A word given its own color keeps it; otherwise it follows the caption style.
- `yPct` — the caption baseline's distance from the TOP as a percentage. Smaller = higher on screen.
- `scale` — size multiplier; `1` = the default size.
- `font` — a font id (`sans` / `serif` / `mono`, a library font, or `preset` to restore the look's own font).
- `source` — which transcript feeds the layer: `auto` (default), or a `trackId` / `clipId` / `assetId` when several speech-bearing clips exist.
- `corrections` — fix caption wording by transcript row without touching the spoken audio (a misheard name, a wrong homophone).
- `translations: {lang, items}` — bilingual subtitles (see below).
- `relayout: true` — regenerate cue boundaries after a `set_canvas` ratio change or a font change; cuts never need it.
- `on: false` — turn the whole layer off. It does not touch graphic or text clips (remove those with `remove_clips`).

Examples: "move the subtitles up a bit" → `set_captions {yPct: <smaller>}`; "make them bigger" → `{scale: 1.2}`; "make the spoken word pop" → `{animation: "pulse"}`; "highlight the key numbers" → `get_transcript`, then `{highlights: {items: [{index: 3, text: "3x"}, …]}}`.

The receipt of every `set_captions` call is a delta describing the caption change.

## Looks

**Artistic** looks break each caption into at most two short stacked rows with size, color, plate or tilt contrast — bold, social-first. Because a row holds only a few words, captions change more often.

**Basic** looks keep one clean line per caption — documentary, interview, informational content.

The legacy `em-*` / `ln-*` ids from earlier versions are still accepted so existing projects keep rendering; choose from the current artistic and basic looks for new work.

## Choosing

- Bare "add subtitles" with no style preference → a clean basic look (`style-documentary`), no animation or a quiet `fade`.
- High-energy talking-head or hook-driven content, or "make the captions pop" → an artistic look, optionally with a word-timed animation.
- "Highlight the words as I speak" → a word-timed `animation` (`karaoke` is the classic); set `highlightColor` when the user names a color.
- "Emphasize the important words" → `highlights` on a few words per sentence that carry the point (numbers, names, the claim, a contrast); leave the rest plain.
- Match the attached frame/theme palette when one exists; content fit beats variety.
- Caption text follows the VIDEO's spoken language; the translation line is where a second language goes.

## Bilingual subtitles (translation line)

A second, smaller line under each caption showing YOUR translation of that sentence — you translate, the tool only stores. This costs no Pireel credits.

1. `get_transcript` (segments) — the transcript comes back as numbered rows (`0. [x–y s] text`, source seconds).
2. Translate every row yourself into the target language (keep each translation one sentence, no timestamps).
3. `set_captions {translations: {lang: "<target>", items: [{index: 0, text: "…"}, …]}}` — `index` is the row number from step 1. Batch all rows in ONE call.
4. If captions are off, the tool says so — follow with `set_captions {on:true, preset}` to show them.

Notes:
- Translations attach to the transcript, so cuts/restyles/re-lays keep them; re-transcribing a new file drops them.
- Clips inserted from another source have their own transcript — read it with `get_transcript {clipId}` and translate it with a second call passing that `clipId`.
- Fix one line: resend just that `{index, text}`. Remove one: `text: ""`. Remove all: `translations: {clear: true}`.
- The translation line has its own simple look, chosen in the editor's caption style panel; `set_captions` does not change it.

## Position and size

- Default placement is fine for most videos; adjust when captions collide with graphics or the speaker's face (check clip framing — `split-*` and corner treatments change where free space is).
- "Higher/lower" → nudge `yPct` (smaller = higher). "Bigger/smaller" → `scale` around 1 (e.g. 1.15 / 0.85). These are independent of the look and of each other.
- Verify with `inspect_timeline {frames:[…]}` at a spoken moment after restyling or moving; nothing here hears audio, so check legibility over the actual picture.

## Recovery

- If the user dislikes the result: another `set_captions` with a different look or animation is the forward edit — cheaper than `undo` (which belongs to the user and may erase their own work).
- "No captions" / "turn them off" → `set_captions {on:false}`, not `remove_clips`.
