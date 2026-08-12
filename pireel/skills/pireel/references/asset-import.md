---
name: asset-import
description: Use when the user points at a LOCAL video, B-roll, image or audio file (a path like /Users/..., C:\..., or a chat attachment materialized as a file) that should be used in Pireel Studio. Covers streaming local visual media straight into the OPEN Studio tab over the user's machine (no cloud upload), registering it in device-local OPFS, optional metadata probing and transcription via ffmpeg/ffprobe, and when the studio tab must be open.
---

# Asset Import — local video into Pireel

When the user gives a local video path ("把 ~/Desktop/talk.mp4 剪一下"), do NOT tell them to open the browser and upload manually — import it yourself with the bundled helper script, then edit through the normal Pireel tools.

## Where the bytes go (transfer matrix)

This is the authoritative statement — tool descriptions and other references must not contradict it.

| Asset | Transfer |
|---|---|
| **Main video** | **localhost → the OPEN Studio tab, over the user's machine — NOT uploaded to the cloud** (fast even for big files) |
| Transcription audio | a small AAC is uploaded to the cloud (Pireel's transcription needs a URL it can fetch) |
| **B-roll (`--broll`)** | **localhost → the OPEN Studio tab → device-local OPFS; `insert_clip` resolves its sig locally — NOT uploaded to R2** |
| **Images** | **localhost → the OPEN Studio tab → device-local OPFS; project stores only a local locator — NOT uploaded to R2** |
| Audio (music/SFX) | uploaded to the cloud asset library (`set_bgm` places it on the music lane) |

**Because main video, B-roll and image bytes stream straight into the browser, a Studio tab MUST be open before you import them.** If none is, the helper exits with `studio_not_open` — open one (call `create_browser_handoff` and open the URL in your own in-app browser, or ask the user to open the project) and re-run the helper. There is no cloud fallback for user-local visual media.

## Two ways in (both keep the video local)

**A. The helper — PRIMARY.** Runs a throwaway localhost server and hands the bytes to the open tab via `register-local`; the tab fetches them over loopback (verified working, including in restricted in-app browsers — every response carries a Content-Type). Works with ANY browser hosting the tab (the user's own Chrome or an agent-driven one) and needs no browser-driving ability from you: one command imports, probes metadata, transcribes, and registers the project. Details below.

**B. Direct injection (fallback — when the helper can't run, and you drive the browser yourself).** No import token, no helper. With an empty studio output open, use the browser's file-chooser bridge from the stable canvas trigger:

```js
const chooserPromise = tab.playwright.waitForEvent('filechooser', { timeoutMs: 10000 });
await tab.playwright.locator('[data-pireel-video-trigger]').click();
const chooser = await chooserPromise;
await chooser.setFiles('/absolute/path/to/video.mp4');
```

The studio reads the file locally into its OPFS library and makes it the main video — nothing is uploaded. Then transcribe with the `extract_asr` MCP tool (it runs in the tab; note this route skips the helper's ffprobe/transcript step). Do not call `locator.setInputFiles`: the supported browser API exposes file selection through the chooser object.

Both routes converge after the bytes enter the tab: the same local import session classifies the
media, persists it to OPFS, and writes the same metadata-only `localAssets` project index used by
the Studio picker. Skill imports therefore appear in the same local asset list and participate in
the same deletion sync and cross-browser “restore access” guidance; only the source adapter differs.

## The helper

`../scripts/import-media.mjs` (relative to this reference — the `pireel` skill's `scripts/` dir). Node ≥ 20, zero npm dependencies. For a main video it:

1. Computes the content signature (`name:size:mtime` — the same fingerprint the browser uses, so the same file is one object however it enters).
2. Starts a throwaway `127.0.0.1` HTTP server and, via `register-local`, hands the bytes to the open Studio tab — the browser fetches them over loopback straight into its local library (OPFS). The video never touches the cloud. If no tab is open it stops here and asks you to open one and retry.
3. If `ffprobe` is available: probes duration/width/height and the audio-track start offset.
4. If `ffmpeg` is available and the file has audio: extracts a small AAC track, uploads ONLY that audio to the cloud, and runs Pireel's transcription — the transcript lands on the project immediately.
5. Registers everything on a project (server-side, conservative targeting) and prints a JSON summary.

The JSON keeps video import and transcription outcomes separate. `transcription.status` is:

- `completed` — timed transcript rows were registered.
- `empty` — transcription ran successfully but found no speech/timed sentences.
- `skipped` — disabled, no audio track, or ffmpeg was unavailable.
- `failed` — billing, authentication, upload, storage, or provider failure. The video is still imported, and `error`, optional `http_status`, and a short `detail` explain what needs recovery.

Never interpret `transcript: 0` alone as “the video has no speech.” Check `transcription.status`: for `failed`, surface the error and recover it (for example, let the user add credits for `insufficient_tokens`, then run `extract_asr` in the open Studio tab). Do not repeatedly re-import the local video just to retry transcription.

Full flow: open a tab if none is → `import_media` (no args, MCP) → token → run helper with `--token` → read the JSON → `get_state`.

```bash
node <pireel-skill-dir>/scripts/import-media.mjs --token <import-token> /path/to/video.mp4
# options: --base https://pireel.com · --ffmpeg/--ffprobe <path> · --no-transcribe
```

**Run the helper OUT of sandbox by default** — it needs the user's local file paths and network access to the Pireel endpoint; request approval instead of attempting a sandboxed run first. When transcription is enabled, the approval description must say that the main video remains local while its extracted AAC is uploaded for cloud ASR. A sandboxed `connection refused` does not mean the server is down.

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
- **Neither**: the video still streams into the open tab and registers; only metadata/transcript are deferred (the browser completes dimensions on load, and `extract_asr` produces the transcript later). Nothing is lost, just deferred.

## Images

Pass image paths (`.png`/`.jpg`/`.webp`/`.gif`, ≤ 30MB) to the same helper. It serves each file on a throwaway loopback URL; the open Studio tab copies it into device-local OPFS and registers only its signature, dimensions and local locator. Mixed invocations work:

```bash
node import-media.mjs --token … video.mp4 logo.png
```

The returned `url_kind` is `local` and the locator starts with `pireel-local-image:`. Use that exact locator in generated block markup. The preview resolves it to an iframe-local object URL; capture and export read the original OPFS file and inline it only in the transient render document. The saved project never contains the bytes, a data URI or an R2 key.

This is deliberately device-local. On a different browser/device the project keeps its locator but cannot render the image until the user imports the same file there. Never work around that by uploading the file or substituting another image.

## Audio (music / sound effects)

A local audio file (`.mp3`/`.m4a`/`.aac`/`.wav`/`.flac`/`.ogg`, ≤ 200MB) passed to the same helper goes to the asset library and comes back with a `url`:

```
node import-media.mjs --token … /path/to/track.mp3
```

Then place it with `set_bgm {url, startSec?}` — the level auto-balances against the measured narration loudness, and the receipt returns a `trackId` for later adjustments (volume, fades, speed, mute, `headSec`/`tailSec` trims, `splitAtSec`). It needs the studio tab open: the bytes are fetched into the browser, which is also what makes them survive later sessions.

Nothing is transcribed or probed for a timeline here — an audio asset is something you place, not footage to cut. Music the user already owns is in `list_assets {kind: "audio"}`; bring your own file only when they point at one.

## B-roll (insert a clip into the timeline)

To add a local video as a SEGMENT of the current project (not as its main footage), stream it into the open tab with `--broll`:

```
node import-media.mjs --token … --broll /path/to/broll.mp4
```

This serves the bytes once over localhost, stores them in the open tab's device-local OPFS library, and prints a `sig`; it does not upload the video to R2. Then call `insert_clip {sig, atSec?}` — the tool resolves that sig from local OPFS first. The clip snaps to the nearest shot boundary, later overlays shift right, and it is a full peer afterwards: framing, captions, matting, its own audio, and on-demand transcription all apply. A video already in the user's cloud library (for example a generated one) can still be inserted via `insert_clip {url}`. This local sig is device-scoped: on another device the user must restore the same source file instead of silently uploading it.

## Project targeting

`import_media` is conservative: a project that already has footage (shots/blocks) and a DIFFERENT video is never clobbered — a new project is created automatically, titled after the filename. The latest project is reused only when it is empty or already uses this exact video. The tool result tells you which happened (`reused: true/false`, `projectId`, `title`).

## After import

- Call `get_state` — the new/updated project is now the latest, so offline tools target it.
- If a transcript was registered (`transcript > 0` in the helper output), go straight to transcript work: `read_script`, cleanup via the talking-head-cleanup skill, `plan_brief` → `submit_plan`.
- The tab was already open for the import (that's how the bytes got in), so the live bridge is connected — storyboarding (`lay_out`), visual analysis, and Pireel-side generation are all available. If the user later reopens the project on a DIFFERENT device (where the local bytes aren't cached), the video won't auto-return — they re-pick the file. Cross-device video persistence is a deliberate non-goal of this path.

## When NOT to use the helper

- The file is already in the project (check `get_state` — same video sig means re-import is a no-op anyway).
- The user is already in the studio tab and can just drag the file in themselves.
- Upload is denied by host policy: stop, explain, and ask the user to upload in the studio tab instead. Do not work around a denial.

## Limits

Single file ≤ 2 GB. Larger sources: ask the user to trim/transcode first (with their consent, ffmpeg can do it locally) or upload via browser.
