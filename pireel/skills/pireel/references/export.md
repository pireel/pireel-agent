---
name: export
description: Use when a Pireel Studio workflow needs export, render, download, share, final delivery, or export progress/status from the agent. Covers the local-render default, how the file lands on disk, and the offline fallback.
---

# Export

Pireel exports render **locally in the user's open studio tab** (WebCodecs client compositing) and the file is saved straight to the user's machine via the **browser's download** — nothing is uploaded, there is no cloud render queue and no download URL. The flow is `export_video` to start, `track_export` to poll, then locate the downloaded file.

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
