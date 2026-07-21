---
name: asset-import
description: Use when the user points at a LOCAL video or image file (a path like /Users/..., C:\..., or a chat attachment materialized as a file) that should be used in Pireel Studio. Covers uploading local source video into Pireel cloud storage, registering it on a project, optional metadata probing and transcription via ffmpeg/ffprobe, and when to fall back to browser upload.
---

# Asset Import — local video into Pireel

When the user gives a local video path ("把 ~/Desktop/talk.mp4 剪一下"), do NOT tell them to open the browser and upload manually — import it yourself with the bundled helper script, then edit through the normal Pireel tools.

## The helper

`../scripts/import-media.mjs` (relative to this reference — the `pireel` skill's `scripts/` dir). Node ≥ 20, zero npm dependencies. It:

1. Computes the content signature (`name:size:mtime` — the same fingerprint the browser uses, so the same file is one object however it enters).
2. Uploads the bytes to Pireel cloud storage via presigned PUT. Re-imports of the same file are dedup-skipped server-side ("bytes already in cloud").
3. If `ffprobe` is available: probes duration/width/height and the audio-track start offset.
4. If `ffmpeg` is available and the file has audio: extracts a small AAC track, uploads it, and runs Pireel's transcription — the transcript lands on the project immediately.
5. Registers everything on a project (server-side, conservative targeting) and prints a JSON summary.

Full flow: `import_media` (no args, MCP) → token → run helper with `--token` → read the JSON → `get_state`.

```bash
node <pireel-skill-dir>/scripts/import-media.mjs --token <import-token> /path/to/video.mp4
# options: --base https://pireel.com · --ffmpeg/--ffprobe <path> · --no-transcribe
```

**Run the helper OUT of sandbox by default** — it needs the user's local file paths and network access to the Pireel endpoint; request approval instead of attempting a sandboxed run first. A sandboxed `connection refused` does not mean the server is down.

Auth — no user action needed: call the `import_media` MCP tool **with no arguments** first; it returns a short-lived (30 min) import `token`. Pass that to the helper via `--token`. Never pass OAuth tokens to shell commands.

## ffmpeg / ffprobe

Resolution order: `--ffmpeg`/`--ffprobe` flags → `FFMPEG_PATH`/`FFPROBE_PATH` env → `PATH`.

**If they are missing, install them yourself** — do not bounce this to the user as a question. The host's own command-approval flow is the user's consent surface:

- macOS: `brew install ffmpeg`
- Windows: `winget install --id Gyan.FFmpeg` (then re-open the terminal for PATH)
- Linux: `apt-get install -y ffmpeg` / the distro equivalent

If the package manager itself is unavailable or the install command is denied, THEN fall back to a degraded import and tell the user what was skipped. Capability tiers:

- **Both available**: full import — duration/dims registered, transcript ready; transcript-based offline editing (read_script / cut_narration / plan_brief / set_captions) works immediately, before any browser is opened.
- **ffprobe only**: metadata registered, no transcript. Transcription happens later in the browser (`extract_asr`).
- **Neither**: bytes + registration only. The project opens fine — the browser completes metadata and the video auto-attaches from cloud storage. Nothing is lost, just deferred.

## Images

Two routes, picked by what the deployment has — the goal is the user's local image (logo, product shot, screenshot) ending up inside a composed block (`<img src="...">` in the compose_block_brief → apply_block flow).

**Small images (≲ 500KB): inline as a data URI — fully local, zero storage.** You write the block HTML yourself in the BYO flow, so read the file, base64 it, and embed `<img src="data:image/png;base64,...">` directly. No upload, works on every deployment including self-hosted with no storage. Constraint: the whole apply_block payload must stay under ~1MB (bridge message cap), and inlined images bloat the saved project — keep them small (compress/resize first if ffmpeg is around).

**Larger images: upload to the asset library via the same helper.** Image paths (`.png`/`.jpg`/`.webp`/`.gif`, ≤ 30MB) passed alongside videos are uploaded and registered; mixed invocations work: `node import-media.mjs --token … video.mp4 logo.png`.

- `url_kind: "public"` — a stable public/CDN link came back: safe to bake into blocks. (Hosted pireel.com always does this.)
- `url_kind: "none"` — the deployment has storage but no public media base: the bytes are stored and visible in the asset library, but there is no stable URL to bake into blocks. Fall back to the data-URI route for the block itself, or tell the user to configure a public media base.

## B-roll (insert a clip into the timeline)

To add a local video as a SEGMENT of the current project (not as its main footage), upload with `--broll`:

```
node import-media.mjs --token … --broll /path/to/broll.mp4
```

This uploads bytes only (no transcription, no project registration) and prints a `sig`. Then call the `insert_clip` MCP tool with `{sig, atSec?}` — it needs the studio tab open (video bytes live in the browser). The clip snaps to the nearest shot boundary, later overlays shift right, and it is a full peer afterwards: framing, captions, matting, its own audio, and on-demand transcription all apply. A video already in the user's library (e.g. a generated one) can be inserted directly via `insert_clip {url}` — external URLs are rejected, upload those first.

## Project targeting

`import_media` is conservative: a project that already has footage (shots/blocks) and a DIFFERENT video is never clobbered — a new project is created automatically, titled after the filename. The latest project is reused only when it is empty or already uses this exact video. The tool result tells you which happened (`reused: true/false`, `projectId`, `title`).

## After import

- Call `get_state` — the new/updated project is now the latest, so offline tools target it.
- If a transcript was registered (`transcript > 0` in the helper output), go straight to transcript work: `read_script`, cleanup via the talking-head-cleanup skill, `plan_brief` → `submit_plan`.
- Storyboarding (`lay_out`), visual analysis, and Pireel-side generation still need the studio tab open. Open the live editor for the user: `https://pireel.com/zh/studio/<projectId>` — in your host's in-app browser if available (the user watches edits land live; the surface must be signed in), otherwise ask them to open it. The open tab upgrades offline mode to the live bridge, and the video auto-attaches from cloud storage.

## When NOT to use the helper

- The file is already in the project (check `get_state` — same video sig means re-import is a no-op anyway).
- The user is already working in the studio tab and can drag the file in faster than an upload round-trip.
- Upload is denied by host policy: stop, explain, and ask the user to upload in the studio tab instead. Do not work around a denial.

## Limits

Single file ≤ 2 GB. Larger sources: ask the user to trim/transcode first (with their consent, ffmpeg can do it locally) or upload via browser.
