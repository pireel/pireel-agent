---
name: asset-import
description: Use when the user points at a LOCAL video, B-roll, image or audio file (a path like /Users/..., C:\..., or a chat attachment materialized as a file) that should be used in Pireel Studio. Covers uploading local media into the user's Pireel cloud media store with the bundled helper, registering it into the active project, optional metadata probing and transcription via ffmpeg/ffprobe.
---

# Asset Import — local media into Pireel

When the user gives a local video path ("把 ~/Desktop/talk.mp4 剪一下"), do NOT tell them to open the browser and upload manually — import it yourself with the bundled helper script, then edit through the normal Pireel tools.

## Where the bytes go (transfer matrix)

This is the authoritative statement — tool descriptions and other references must not contradict it.

| Asset | Transfer |
|---|---|
| **Main video** | uploaded to the user's Pireel cloud media store (content-addressed: the same bytes are one object however they enter, a duplicate upload is instant) and registered as the project's narrative source |
| Transcription audio | a small AAC is uploaded for transcription (only when ffmpeg is available and `--no-transcribe` is absent) |
| **B-roll (`--broll`)** | uploaded to the cloud media store, registered as a project **library asset**; `add_clips` / `insert_clips` place it by `assetId` |
| **Images** | uploaded to the cloud media store, registered as a project library asset |
| **Audio (narration/music/SFX)** | uploaded to the cloud media store, registered as a project library asset; `add_clips` places it on the matching typed audio lane |

No studio tab needs to be open. If one is open, it picks the new assets up from the project sync; otherwise the assets are there when the project is next opened, and offline tools (`get_state`, `add_clips`, `insert_clips`) can already see and place them.

## Two ways in

**A. The helper — PRIMARY.** One command fingerprints, uploads, probes metadata, transcribes and registers. It needs no browser-driving ability from you.

**B. Direct injection (fallback — when the helper can't run, and you drive the browser yourself).** No import token, no helper. Open the handoff in your own built-in/embedded browser (on Codex, the in-app Browser runtime), and with an empty studio output open use the browser's file-chooser bridge from the stable canvas trigger:

```js
const chooserPromise = tab.playwright.waitForEvent('filechooser', { timeoutMs: 10000 });
await tab.playwright.locator('[data-pireel-video-trigger]').click();
const chooser = await chooserPromise;
await chooser.setFiles('/absolute/path/to/video.mp4');
```

The studio imports the file the same way a user drop does (device cache + background cloud upload) and makes it the main video. Then call the `get_transcript` MCP tool; it returns a stored transcript or transcribes in the tab when missing (this route skips the helper's ffprobe/transcript step). Do not call `locator.setInputFiles`: the supported browser API exposes file selection through the chooser object.

Direct injection is a capability fallback, not an authentication or server-error workaround. If the helper reaches Pireel but returns HTTP 401 with a freshly issued import token, or reports `server_misconfigured`, stop and surface that infrastructure error. Do not drive hidden file inputs, write a custom upload client, create a carrier video, or install a local ASR stack to route around it.

## The helper

`../scripts/import-media.mjs` (relative to this reference — the `pireel` skill's `scripts/` dir). Node ≥ 20, zero npm dependencies. For a main video it:

1. Computes the content fingerprint (`pireel2:<hash>:<size>` — the same fingerprint the browser uses, so the same file is one object however it enters; filename and mtime are not part of it).
2. Asks the store for the object (`put`): if the bytes already exist the upload is skipped; otherwise it streams the file to a presigned upload URL.
3. If `ffprobe` is available: probes duration/width/height and the audio-track start offset.
4. If `ffmpeg` is available and the file has audio: extracts a small AAC track, uploads only that audio, and runs Pireel's transcription — the transcript lands on the project immediately.
5. Registers everything on a project (server-side, conservative targeting: `register` for the main video, `register-asset` for library assets) and prints a JSON summary.

The JSON keeps video import and transcription outcomes separate. `transcription.status` is:

- `completed` — timed transcript rows were registered.
- `empty` — transcription ran successfully but found no speech/timed sentences.
- `skipped` — disabled, no audio track, or ffmpeg was unavailable.
- `failed` — billing, authentication, upload, storage, or provider failure. The video is still imported, and `error`, optional `http_status`, and a short `detail` explain what needs recovery.

Never interpret `transcript: 0` alone as "the video has no speech." Check `transcription.status`: for `failed`, surface the error and recover it (for example, let the user add credits for `insufficient_tokens`, then call `get_transcript`). Do not repeatedly re-import the local video just to retry transcription.

Full flow: `import_media` (no args, MCP) → token + `base_url` → run helper with both `--base` and `--token` → read the JSON → `get_state`.

```bash
node <pireel-skill-dir>/scripts/import-media.mjs --base <base_url> --token <import-token> /path/to/video.mp4
# options: --ffmpeg/--ffprobe <path> · --no-transcribe · --broll
```

**Run the helper OUT of sandbox by default** — it needs the user's local file paths and network access to the Pireel endpoint; request approval instead of attempting a sandboxed run first. The approval description must say that the file is uploaded to the user's Pireel media store and, when transcription is enabled, that its extracted AAC is sent for transcription. A sandboxed `connection refused` does not mean the server is down.

Auth — no user action needed: call the `import_media` MCP tool **with no arguments** first; it returns a short-lived (30 min) import `token` and the exact `base_url` for the connected production/preview environment. Pass both to the helper. Never guess the environment from documentation and never pass OAuth tokens to shell commands.

## ffmpeg / ffprobe

Resolution order: `--ffmpeg`/`--ffprobe` flags → `FFMPEG_PATH`/`FFPROBE_PATH` env → `PATH`.

**If they are missing, install them yourself** — do not bounce this to the user as a question. The host's own command-approval flow is the user's consent surface:

- macOS: `brew install ffmpeg`
- Windows: `winget install --id Gyan.FFmpeg` (then re-open the terminal for PATH)
- Linux: `apt-get install -y ffmpeg` / the distro equivalent

If the package manager itself is unavailable or the install command is denied, THEN fall back to a degraded import and tell the user what was skipped. Capability tiers:

- **Both available**: full import — duration/dims registered, transcript ready; transcript-based editing (`get_transcript`, `remove_words`, captions) can start immediately.
- **ffprobe only**: metadata registered, no transcript. Transcription happens later when `get_transcript` is called.
- **Neither**: the video still uploads and registers; only metadata/transcript are deferred (the browser completes dimensions on load, and `get_transcript` produces the transcript later). Nothing is lost, just deferred.

## Images

Pass image paths (`.png`/`.jpg`/`.webp`/`.gif`, ≤ 50MB) to the same helper. Each is uploaded and registered as a library asset with its dimensions. Mixed invocations work:

```bash
node import-media.mjs --token … video.mp4 logo.png
```

The JSON returns the `assetId`; place it with `add_clips {clips:[{assetId, role, startFrame, durationFrames}]}` (an image clip holds for its `durationFrames`) or refer to it from generated component markup through the Materials panel. The saved project references the asset by id; the bytes live in the cloud store and are cached on each device that opens the project.

## Audio (narration / music / sound effects)

A local audio file (`.mp3`/`.m4a`/`.aac`/`.wav`/`.flac`/`.ogg`, ≤ 2GB) passed to the same helper is uploaded and registered as a library asset with its measured duration:

```
node import-media.mjs --token … /path/to/track.mp3
```

Place it with `add_clips` (`assetId`, `startFrame` in timeline frames, optional `source [inSec, outSec]`). Choose `role: "narration"`, `"music"` or `"sfx"` from the user's intent; do not put spoken teaching audio on the music lane. The typed clip can then be trimmed, split, muted, leveled, faded or speed-adjusted like other timeline media (`set_clip_properties` for `volumeDb` / `mute` / `fades` in frames / `speed`, `split_clips`, `move_clips`).

The helper probes duration but does not automatically transcribe standalone audio. When meaning or performed timing matters, call `get_transcript` with the `assetId`; it reuses stored text and transcribes only when missing.

## B-roll (insert a clip into the timeline)

To add a local video as a SEGMENT of the current project (not as its main footage), import it with `--broll`:

```
node import-media.mjs --token … --broll /path/to/broll.mp4
```

It is uploaded and registered as a library asset; the JSON returns its `assetId`. Place it by asset id: `add_clips {clips:[{assetId, role, startFrame, durationFrames?, source?}]}` when nothing else should move (an overlay on the `broll` lane, or a gap on the spine), or `insert_clips` at a `startFrame` on an existing cut when later material on the sync-locked lanes should ripple to make room. It is a full peer afterwards: framing (`set_clip_framing`), captions, matting, its own audio (`set_clip_properties`), and on-demand transcription all apply. A video already in the user's cloud library (for example a generated one) is registered with `register_media` — pass the returned fields unchanged, never a hand-built locator — and placed the same way.

## Project targeting

`import_media` is conservative: a project that already has footage (placed clips) and a DIFFERENT main video is never clobbered — a new project is created automatically, titled after the filename. The latest project is reused only when it is empty or already uses this exact video. The tool result tells you which happened (`reused: true/false`, `projectId`, `title`). Library assets (`--broll`, images, audio) always go to the ACTIVE (most recently touched) project; switch first with `manage_project` when another project is the target.

## After import

- Call `get_state` — the new/updated project is now the latest, so offline tools target it; library assets appear with `library: true` until placed. From here on, patch your model from each mutation's delta instead of re-reading.
- If a transcript was registered (`transcript > 0` in the helper output), use `get_transcript`; for a complete edit follow `storyboard-draft.md`: propose the whole-film design, obtain approval, keep the approved plan in your working context as a few sentences (there is no persisted plan artifact), then build directly with the clip tools.
- Media-byte analysis, rendered review and export still run in an open tab (`create_browser_handoff`); the tab retrieves the bytes from the cloud store on its own.

## When NOT to use the helper

- The file is already in the project (check `get_state` — same content sig means re-import is a no-op anyway).
- The user is already in the studio tab and can just drag the file in themselves.
- Upload is denied by host policy: stop, explain, and ask the user to upload in the studio tab instead. Do not work around a denial.

## Limits

Single file ≤ 2 GB (images ≤ 50 MB). Larger sources: ask the user to trim/transcode first (with their consent, ffmpeg can do it locally) or upload via browser.
