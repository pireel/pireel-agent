---
name: export
description: Use when a Pireel Studio workflow needs export, render, download, share, final delivery, or export progress/status from the agent. Covers the local-render default, how the file lands on disk, and the offline fallback.
---

# Export

Pireel exports render **locally in the user's open studio tab** (WebCodecs client compositing) and the file is saved straight to the user's machine via the **browser's download** — nothing is uploaded, there is no cloud render queue and no download URL. The flow is `export {action:"start"}` to start, `export {action:"status"}` to poll, then locate the downloaded file. Export only when the user asks for a deliverable — the editable output is the default result of an edit.

## Driving a headless/embedded browser? Use the sink (REQUIRED)

A page download is only a hand-off to the browser — **headless and agent-embedded browsers routinely discard it silently**: `export {action:"status"}` reports done, but no file lands anywhere. When the studio tab is a browser YOU drive (create_browser_handoff into your own browser tool), always deliver through the local sink instead:

1. Start the receiver (blocks until the file arrives; run it in the background):

```bash
node scripts/export-sink.mjs --out ~/Videos &
# first stdout line: {"sink_url":"http://127.0.0.1:PORT/…","out_dir":…}
```

2. Call `export {action:"start"}` with that URL plus the confirmed specs: `{ "action": "start", "resolution": 1080, "sink_url": "http://127.0.0.1:PORT/…" }` (the sink does not skip the needs_options handshake — confirm specs with the user first).
3. Poll `export {action:"status"}` as usual. On done it reports `saved_via: local sink`; the sink process prints `{"saved": "/abs/path", …}` and exits — that's the deliverable's absolute path.

The sink is loopback-only, single-use, and needs no token (it never talks to the Pireel API). Bytes stay on this machine. If the sink PUT fails, the tab falls back to the browser download and `export {action:"status"}` carries `sink_error` — restart a fresh sink and re-export (unchanged content re-delivers instantly from cache).

## Flow

1. The specs are the user's choice — `export` is a two-step handshake. A first `export {action:"start"}` call without explicit specs does NOT start the export; it returns `status: "needs_options"` with recommendations tuned to the source video and common platforms (Xiaohongshu / Douyin·TikTok / YouTube / source quality) in `data.options`. Present them and ask the user which to use in YOUR interface (over MCP there is no in-tool question; ask in your own host).

2. Call again with the chosen specs as explicit overrides to start:

```json
{ "action": "start", "resolution": 1080, "fps": 30, "format": "mp4" }
```

   Resolution is output short-side pixels: 2160 (4K) / 1440 (2K) / 1080 / 720 / 540. FPS: 24 / 30 / 60. Format: mp4 / webm / mov. `resolution` / `fps` / `format` are explicit user overrides only — the default is adaptive source-quality settings. If the user already named the specs in their request, you may skip straight to this call.

3. Rendering is roughly realtime — a 3-minute video takes about 3 minutes. Poll `export {action:"status"}` every ~15s; it returns `{status, progress}` (`running | done | idle`) while running.

4. When `export {action:"status"}` returns `status: "done"` it includes `filename` — the browser has already saved that file. Locate it:
   - Default location is the user's Downloads folder: `~/Downloads` on macOS/Linux, `%USERPROFILE%\Downloads` on Windows (unless the user configured a different browser download directory or the browser asks where to save).
   - Check for a fresh in-progress `.crdownload`/partial file matching the filename first; wait until it completes (suffix gone, size stable).
   - Chrome de-duplicates names itself (`name (1).mp4`) — prefer the freshest file matching the base name over an exact-name older file.
   - Confirm the absolute path to the user; show the video inline when the harness supports it.

4. Unchanged content re-exports instantly (the tab caches the last render for the same composition + options).

## Preconditions & fallbacks

- **The studio tab must be open and stay open** until the export finishes. If tools report OFFLINE MODE, ask the user to open the project in the browser first.
- If `export {action:"status"}` reports an error, report it verbatim and suggest retrying once; repeated failures usually mean the source video File was lost after a page refresh — the user should re-open the project so it reconnects, then retry.
- If the file cannot be found in Downloads after completion, the browser may be configured to ask for a save location — ask the user where they saved it instead of guessing.
- Do not flatten or re-encode the timeline yourself with local ffmpeg as the primary deliverable — the studio render is the source of truth (framing, graphics, captions are composited there).
