---
name: export
description: Use when a Pireel Studio workflow needs export, render, download, share, final delivery, or export progress/status from the agent. Covers the local-render default, how the file lands on disk, and the offline fallback.
---

# Export

Pireel exports render **locally in the user's open studio tab** (WebCodecs client compositing) and the file is saved straight to the user's machine via the **browser's download** — nothing is uploaded, there is no cloud render queue and no download URL. The flow is `export_video` to start, `track_export` to poll, then locate the downloaded file.

## Driving a headless/embedded browser? Use the sink (REQUIRED)

A page download is only a hand-off to the browser — **headless and agent-embedded browsers routinely discard it silently**: `track_export` reports done, but no file lands anywhere. When the studio tab is a browser YOU drive (create_browser_handoff into your own browser tool), always deliver through the local sink instead:

1. Start the receiver (blocks until the file arrives; run it in the background):

```bash
node scripts/export-sink.mjs --out ~/Videos &
# first stdout line: {"sink_url":"http://127.0.0.1:PORT/…","out_dir":…}
```

2. Call `export_video` with that URL: `{ "resolution": 1080, "sink_url": "http://127.0.0.1:PORT/…" }`.
3. Poll `track_export` as usual. On done it reports `saved_via: local sink`; the sink process prints `{"saved": "/abs/path", …}` and exits — that's the deliverable's absolute path.

The sink is loopback-only, single-use, and needs no token (it never talks to the Pireel API). Bytes stay on this machine. If the sink PUT fails, the tab falls back to the browser download and `track_export` carries `sink_error` — restart a fresh sink and re-export (unchanged content re-delivers instantly from cache).

## Flow

1. Call `export_video` with the options the user asked for (all optional):

```json
{ "resolution": 1080, "fps": 30, "format": "mp4" }
```

   Resolution options: 2160 / 1440 / 1080 (default) / 720 / 540. FPS: 24 / 30 (default) / 60. Format: mp4 (default) / webm / mov.

2. Rendering is roughly realtime — a 3-minute video takes about 3 minutes. Poll `track_export` every ~15s; it returns `{status, progress}` while running.

3. When `track_export` returns `status: "done"` it includes `filename` — the browser has already saved that file. Locate it:
   - Default location is the user's Downloads folder: `~/Downloads` on macOS/Linux, `%USERPROFILE%\Downloads` on Windows (unless the user configured a different browser download directory or the browser asks where to save).
   - Check for a fresh in-progress `.crdownload`/partial file matching the filename first; wait until it completes (suffix gone, size stable).
   - Chrome de-duplicates names itself (`name (1).mp4`) — prefer the freshest file matching the base name over an exact-name older file.
   - Confirm the absolute path to the user; show the video inline when the harness supports it.

4. Unchanged content re-exports instantly (the tab caches the last render for the same composition + options).

## Preconditions & fallbacks

- **The studio tab must be open and stay open** until the export finishes. If tools report OFFLINE MODE, ask the user to open the project in the browser first.
- If `track_export` reports an error, report it verbatim and suggest retrying once; repeated failures usually mean the source video File was lost after a page refresh — the user should re-open the project so it reconnects, then retry.
- If the file cannot be found in Downloads after completion, the browser may be configured to ask for a save location — ask the user where they saved it instead of guessing.
- Do not flatten or re-encode the timeline yourself with local ffmpeg as the primary deliverable — the studio render is the source of truth (framing, graphics, captions are composited there).
