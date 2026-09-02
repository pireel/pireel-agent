---
name: pireel-basics
description: Core mental model and tool routing for editing videos in Pireel Studio over MCP. Read this FIRST whenever the user asks to edit, cut, storyboard, illustrate, caption, or theme a Pireel video, or whenever any pireel MCP tool is about to be called for the first time in a session. Covers clips vs components, the two clocks (timeline frames vs source seconds), get_state-once-then-deltas discipline, the BYO-brain generation flow, and which tool handles which request.
---

# Pireel Studio basics

Pireel Studio (https://pireel.com) is a multi-source, multi-track video editor for speech-led edits, lessons, product stories, ads and montages. Through the `pireel` MCP server your tools edit the composition **live in an open studio browser tab**: the timeline updates on screen as you work. Call `create_browser_handoff` and open the returned `url` with your own built-in/embedded browser tool. On Codex, use the in-app Browser runtime first; never spend the single-use ticket through OS `open`, the user's default browser, or connected Chrome proactively. Keep the tab visible and open. Only an explicit `local loopback is unreachable from this browser` result permits one retry in a controllable connected browser that shares the agent host's loopback. The handoff expires in ~60s; open it immediately and never print it to the user.

**Keep the editor in YOUR browser, visible, and open — get this right the first time.** Three failure modes that make you look broken to the user:
1. **Wrong surface.** Opening the handoff URL means opening it in your own built-in/embedded browser. On Codex, use the in-app Browser runtime first. Never route it to connected Chrome or an uncontrolled default browser unless the in-app helper attempt has already returned the explicit loopback error.
2. **Not visible.** After opening, make your browser **visible** so the user watches every edit land — use your browser tool's visibility control.
3. **Auto-closed at turn end.** Many embedded browsers clean up tabs when your turn finishes — that yanks the editor out from under the user right after you opened it. **Mark the Pireel tab to persist** using your tool's keep-tab / finalize-with-keep control. Never close-and-reopen the Pireel tab between edits; open it once, keep it.

These are your host's own browser-runtime controls, not Pireel MCP tools — use whatever your tool exposes. **On Codex specifically:** drive the in-app browser through the official Browser runtime / Node REPL, navigate with the selected tab's `goto`, make it visible, and follow the runtime's documented keep/finalize behavior. Never use OS `open` or select connected Chrome preemptively. A controllable connected browser is only the one-retry fallback after the exact loopback-unreachable error.

The MCP endpoint is `https://pireel.com/api/studio/mcp`. Auth is OAuth — the agent's `mcp login` / first-use flow opens the browser; there are no API keys. On HTTP 401, re-run the OAuth login for `pireel`.

## The composition: outputs, typed tracks, clips and components

- **Project → output → tracks → clips.** A project holds outputs; every tool acts on the active output. An output has a canvas (`width`, `height`, `fps`) and typed tracks: visual (the **primary** story spine plus **broll** overlay/PiP lanes), **graphics**, audio (**narration** / **music** / **sfx**) and one managed **caption** track. Larger track `order` renders above. `manage_tracks` creates, reorders or removes a track; `add_clips` picks or creates the lane from `role` when you omit `trackId`.
- **Clips** are the timeline objects. A clip has a kind — narrative (spoken story footage), media (video or image on any lane), graphic (a Motion Graphic component), audio, text — and occupies integer frames `[start, end)`. `get_state` is the canonical read surface; `add_clips` / `insert_clips` / `move_clips` / `split_clips` / `remove_clips` / `ripple_delete_ranges` / `set_clip_properties` / `set_clip_framing` address exact clips on any track rather than assuming one special main lane. This is the same model as any multi-track NLE. Linked audio is folded into its visual clip as `audio:{clipId,…}` — address the audio side by that nested id.
- **Framing** — every media clip has editable framing, speed, color filter and sound. Familiar full / punch-in / corner / split treatments are convenience recipes on `set_clip_framing`; the same tool takes an exact `transform` and `cropInsets` for precise control. A cut between two story-spine clips is a hard cut by default; `add_transition` adds a real dual-stream transition where a change of time, place, chapter or emotional mode earns one.
- **Components and text** — a Component is a graphic clip: the broad extensible visual-element concept. Motion Graphics are its primary family: kinetic words, one-number reveals, data stories, logo stings, overlays and real-source highlights. Simple hooks, labels and CTAs are native **text** clips made with `set_texts`, not bespoke components. Graphic and text clips may carry an anchor to a clip or a spoken word so they follow the footage through later cuts; their placement is a box in canvas units (0–1). They are layers over the footage, never a substitute for editing the footage itself.
- **No persisted plan.** There is no saved director plan or scene-design artifact. For a complete edit the plan is a few sentences in your working context (thesis, order of movements, where sound leads); the draft is built directly with the clip tools and a passage is repaired by its clips. Most edits — including complete first cuts of short pieces — compile directly with the atomic tools.

## The two clocks (get this wrong and cuts land in the wrong place)

1. **Source seconds** — a source file's own clock. A transcript returned by `get_transcript` is timestamped in that source's seconds, and those timestamps **never shift when the timeline is cut**. Clip `source [inSec, outSec]` on `add_clips` / `set_clip_properties` is on this clock too. Fetch a transcript's segments once; they stay valid for the session (only word ids shift after a word cut).
2. **Timeline frames** — the output's clock, in integer frames at the canvas `fps` from `get_state`. `startFrame`, `durationFrames`, `atFrame`, `fromFrame` / `toFrame` and clip `frames:[start,end)` all live on THIS clock. `duration = end − start`. Never multiply seconds by fps yourself: every tool converts, and a human duration you reason about ("hold for 1–2 s") is converted to frames at the output fps by the tool that takes it. Every ripple cut shifts later content earlier.

`remove_words` is the bridge for spoken footage: pass it transcript (source-second) `ranges` or `wordIds` and it converts to the timeline itself, cuts the footage, re-lays overlays and captions.

Clips inserted from a **different source file** have their own source clock: their `source` seconds belong to that file, not the primary footage's transcript. `get_transcript {clipId}` reads that clip's speech and `remove_words` cuts it by the same rules; non-speech spans inside such clips are cut with `ripple_delete_ranges` (timeline frames) or dropped with `remove_clips`.

**Footage without speech** (B-roll, product footage, screen recordings, music-led montage) needs no transcript at all: `get_state` gives frame positions, and the clip tools above shape it by time, picture and sound. `get_transcript` reporting no coverage is information, not an error. Do not call it on speechless footage just to "start"; do not ask the user for a script before editing it.

## State discipline: get_state once, then patch from deltas

- **Call `get_state` once per session** before your first edit. It returns the canvas, `durationFrames`, playhead, `canGenerate`, the attached frame, every track with its role and clips (`frames:[start,end)`, source seconds, non-default properties only), the asset inventory (`library:true` = not placed yet) and the outputs list. `window` narrows it to tracks and a frame range.
- **Every mutation returns a delta** — touched clips, shifted rules `{trackId, fromFrame, byFrames, count}`, `removedClipIds`, `removedSource`, caption changes and notes. Patch your model of the timeline from the delta instead of re-reading. Re-read `get_state` only when a receipt note or an error says the state is stale: after a `manage_project` switch, after `undo`, after a rejected call.
- The transcript is NOT in `get_state`. When the edit depends on spoken words, fetch it with `get_transcript` (`granularity:"segments"` by default; it returns stored text or transcribes when missing). Don't re-fetch segments after cuts (source clock, remember); only `granularity:"words"` ids shift after `remove_words`.
- Never invent clip / track / asset ids. Only use ids from `get_state` or a receipt, and pass them back exactly. Clip and track ids are output-local — never carry them across an output or project switch.

## Studio Skills: official craft playbooks and account Skills

`list_skills` returns two kinds of Studio Skill, both separate from this installed MCP workflow Skill: Pireel's **official** built-in craft playbooks (`talking-head-edit`, `montage-edit`, `audio-and-music`, `speech-cleanup`, …) — the same files the Studio chat reads, mirrored locally under `references/craft/` — and the authenticated account's private/community Skills. Before a complete edit of a speech-led video, a montage, or sound/music work, read the matching official playbook once and apply it. When the user names an account Skill, call `list_skills` to resolve its exact id, then `read_skill {id}` and follow the returned playbook as a whole. `list_skills` returns metadata only; private instructions are disclosed only by the explicit account-scoped read. The playbook describes editorial judgment and acceptance criteria, while the MCP tools remain stable general capabilities — a skill never introduces tools of its own, and you never translate internal function names or model parameters into the Skill contract.

If the selected Studio Skill explicitly binds a named voice, that binding is the user's voice choice for this workflow. Call `manage_voices {action:"list", query:<exact name>}` to resolve its stable `voiceId`; if exactly one ready match exists, use it with `generate_speech` without asking the user to pick the same voice again. If it is missing, ambiguous, or not ready, report that concrete blocker. Keep script approval, billing, and performance-direction behavior governed by the selected Skill and the charge warning on `generate_speech`.

## You are the model (BYO-brain — the default generation path)

For a complete edit (a whole video rather than one local change), read `storyboard-draft.md` before mutating the timeline. Its method is proportional: understand the material, state the direction (briefly for a clear or short brief; as a concise proposal awaiting approval for a broad, expensive or ambiguous one), then compile the edit directly with the batched clip tools and review it with `inspect_timeline`. The plan stays in your working context as prose; there is no persisted planning artifact to write or read.

All text/HTML generation is done by YOUR model, not Pireel's:

- **Component content** (rewrite / new element): first decide the actual moment, `atFrame`, `durationFrames`, `placement`, `backdrop` and protected subjects; `compose_component` → it returns the full `{system, prompt, target}` contract with the real box and design context → generate the response yourself → submit it via `apply_component {raw, clipId, atFrame, durationFrames, placement}` with the returned target unchanged. If lint rejects it, fix only those issues and re-apply with the same `clipId`. See `compose-blocks.md`.
- **Icons**: `get_icons {names, kind}` returns inline SVGs — never hand-draw semantic icons, no emoji on canvas.

Hosted generation tools whose descriptions carry a charge marker use Pireel credits. `apply_component {generate:true, instruction}` is the hosted fallback for agents that cannot perform the BYO compose/apply flow. `inspect_media {mode:"geometry"}` keeps scene cuts, subject/face tracks and safe-region measurement in the browser with no model tokens; use `mode:"semantic"` (or `"editorial"` for a comparative review against a brief) when content, evidence, material choice or complete-edit direction depends on what the pixels mean. Never trade needed semantic judgment for geometry merely to save tokens, and never infer charging from a remembered list — read the current tool description.

## Tool routing table

Tools are grouped the way the server lists them. Timeline arguments are frames; transcript and `source` arguments are seconds.

### Read

| Request | Tools |
| --- | --- |
| What's on the timeline? | `get_state` (once per session; `window` for one range) — then patch from deltas |
| What does the speaker say? | `get_transcript {granularity:"segments"}` (any speech-bearing asset, clip or track; transcribes missing speech, which charges) |
| Exact words for a word-level cut | Choose rows from the segments → one narrowed `get_transcript {granularity:"words", clipId, fromFrame/toFrame \| segmentIndexes, offset, limit}` → `remove_words {wordIds}`; never scan a whole transcript at word granularity |
| Find a spoken topic already present in the current transcript | Reason over the numbered segment rows directly; do not call a search tool |
| Retrieve a spoken/visual moment missing from current context (cold/truncated transcript, multiple sources, visual labels) | `search_media {query, scope?, clipId?}` (stable source-clock segments; this is not the reusable asset library or web search) |
| Asset facts, a component's markup, or a pending generation | `inspect_media` — `mode:"metadata"` (default), `"frames"` (pixels of 1–8 image assets), `"component"` (one graphic clip's markup and animation), `"generation"` (job status), `"geometry"` (free, browser-local), `"semantic"` / `"editorial"` (charge), `"brief"` then `labels` (BYO visual analysis) |
| See the composited picture at a moment / review the sequence | `inspect_timeline {frames:[…]}` (1–12 exact frames) or `{fromFrame, toFrame, maxFrames}`; no arguments = every visible clip in order |
| Beat-aligned cuts on music with a known BPM | `get_beat_grid {assetId \| clipId, bpm, offsetSec}` → `split_clips` / `move_clips` |

### Project and media

| Request | Tools |
| --- | --- |
| Projects and outputs (list / switch / create / rename / duplicate / delete) | `manage_project {scope:"project" \| "output", action, id?, title?}` — a switch returns the new `get_state`; ids are output-local |
| Find a described reusable asset (name/category/mood/use case) | `search_assets {scope:"mine" \| "cloud" \| "official" \| "all" \| "stock", query?, kind?}` (works with the tab closed; use returned locators, never invent a URL) |
| What media has the user added to this project? | `get_state` asset inventory, or `search_assets {scope:"mine"}` with no query (works with the tab closed) |
| Use generated, remote or stock media | `register_media {assets:[…returned fields unchanged…]}` or `{stock: <exact import payload>}` → `add_clips` / `insert_clips` by asset id |
| Bring LOCAL files into the open tab | `import_media` with no arguments → run the helper from the `asset-import` skill |
| Label, tag or record BPM on assets | `organize_media {items}` |
| Icons for component markup | `get_icons {names, kind:"icon" \| "brand"}` |
| Open the live editor (your browser, pre-signed-in) | `create_browser_handoff` → built-in/embedded browser first; connected browser only after the explicit loopback-unreachable error |

### Clips and tracks

| Request | Tools |
| --- | --- |
| Place footage, B-roll, images or audio without shifting anything | `add_clips {clips:[{assetId, role, startFrame, durationFrames?, source?:[inSec,outSec], trackId?}]}` (one call, many clips, one undo step) |
| Insert and push later material to make room | `insert_clips {clips, atFrame}` |
| Copy a graphic clip to a new start | `add_clips {duplicate:[{clipId, startFrame}]}` |
| Move / retime a clip or overlay | `move_clips {items:[{clipId, startFrame, trackId?}]}`; length via `set_clip_properties {durationFrames}` |
| Remove clips of any kind (leave a gap) | `remove_clips {clipIds}` — several in one call |
| Remove clips and close the gap | `remove_clips {clipIds, ripple:true}` |
| Cut video at a point | `split_clips {items:[{clipId?, atFrame}]}` (omit `clipId` to split the story spine) |
| Remove a timeline range (any lane, any source) and close it | `ripple_delete_ranges {ranges:[{fromFrame, toFrame}]}` |
| Trim a clip's head or tail | `set_clip_properties {items:[{clipId, source:[inSec,outSec]}]}` or `ripple_delete_ranges` on the frames to drop |
| Video framing / zoom / punch-in / corner / split | `set_clip_framing {items:[{clipId, treatment, size?, crop?, scale?, anchorX?, anchorY?}]}` or `{transform, cropInsets}` |
| Reposition / resize a graphic or text ON SCREEN (into a corner, off the speaker's face) | `set_clip_framing {items:[{clipId, box:{x,y,w,h} \| anchor \| scale}]}` |
| Several clips in one arrangement (PiP, split, grid) | `apply_layout {layout, blockIds, shotId?, videoPosition?}` |
| Animate a box or opacity over time | `set_keyframes {clipId, property, keyframes}` (clip-relative seconds) |
| Color-grade a clip | `set_clip_properties {items:[{clipId, filter:{brightness, contrast, saturate}}]}` (1 = untouched) |
| Slow-mo / speed-up a clip | `set_clip_properties {items:[{clipId, speed}]}` (0.25–4; the spine ripples by default) |
| Clip sound — quiet or mute a clip's own audio (e.g. B-roll under narration) | `set_clip_properties {items:[{clipId, volumeDb (−60…+20, 0 = source), mute, fades:{in, out} (frames)}]}` |
| Swap a clip's media, keep its geometry | `set_clip_properties {items:[{clipId, assetId}]}` |
| Background music: add / level / trim / fade / remove | `register_media` (generated or remote only; library assets are already registered) → `add_clips {clips:[{assetId, role:"music", startFrame, source?}]}` → `set_clip_properties {volumeDb, fades}`; remove with `remove_clips` — craft rules in `craft/audio-and-music.md` |
| Place narration / music / SFX as typed audio clips | `add_clips {role:"narration" \| "music" \| "sfx"}` (omit `trackId` to reuse or create the lane) |
| Transition at a cut between two story-spine clips | `add_transition {atFrame, effect, durationFrames?, direction?}` (`effect:"none"` removes) |
| Create / reorder / mute / remove a track | `manage_tracks {action, trackId?, type?, role?, order?, syncLocked?}` |
| Link clips, or sync camera + external audio by a clap | `manage_clip_links {action:"link" \| "unlink" \| "sync", …}` |
| Change the canvas ratio or size | `set_canvas {preset \| width, height}`; re-check framing with `inspect_timeline` |

### Speech

| Request | Tools |
| --- | --- |
| Remove spoken passages by the transcript | `remove_words {ranges:[[fromSec, toSec], …]}` (source seconds, ONE call for all ranges) |
| Remove exact words | `remove_words {wordIds}` — re-read `get_transcript` words before the next word cut |
| Tighten pacing / remove dead air | `remove_silence {minimumPauseSec?, speechPaddingSec?}` first (audio analysis, no transcript needed); `remove_words` with gap ranges + `keepGapSec` (0.35 default) when pauses must be chosen by meaning — rules in the `talking-head-cleanup` skill |
| Judgment-based speech cleanup (fillers, retakes, tighten) | `read_skill {id:"speech-cleanup"}` once, then its workflow — or use the `talking-head-cleanup` skill directly |
| Clean up noisy narration | `denoise_audio {strength}` (0..1, default 0.6; `off:true` removes the pass) |

### Graphics, text, captions and frames

| Request | Tools |
| --- | --- |
| New graphic / rewrite a graphic | Decide moment/timing/placement/backdrop → `compose_component` → generate → `apply_component` (fallback: `apply_component {generate:true}`, charges) |
| Inspect a component's actual HTML/animation | `inspect_media {mode:"component", clipId}` (before precise edits or content questions) |
| Simple title, hook, label or CTA | `set_texts {items:[{text, startFrame, durationFrames?, preset?, animation?, placement?}]}`; update with `{id, …}` |
| Subtitles on/off/restyle/move/resize | `set_captions {on?, preset?, yPct?, scale?}` (18 presets); off = `set_captions {on:false}` — see the `captions` skill |
| Fix caption wording / bilingual line / re-lay after a canvas change | `set_captions {corrections}` / `{translations:{lang, items}}` / `{relayout:true}` |
| Themes (visual direction) | `manage_frame {action:"list"}` → `{action:"attach", id}` → `{action:"read"}` |

### Generation (charges credits — confirm first)

| Request | Tools |
| --- | --- |
| Which hosted models exist | `list_models {kind}` before any non-default `modelId` |
| Generate an image / video | `generate_image {prompt, …}` / `generate_video {prompt, durationSec, …}` → later `inspect_media {mode:"generation"}` → `register_media` → `add_clips` |
| Generate an original music bed or a sound effect | `generate_audio {kind:"music" \| "sfx", prompt, durationSec?, loop?}` → `register_media` → `add_clips {role:"music" \| "sfx"}` — search `official` assets first |
| Synthesize narration | `manage_voices {action:"list"}` → `generate_speech {text, voiceId, instruction?}` → `register_media` → `add_clips {role:"narration"}` |
| Voices (list / clone / design / delete) | `manage_voices {action}` — clone and design charge; surface the price and wait for approval |
| Lip-sync a portrait or source video to audio | `lip_sync {audioUrl, sourceImageUrl \| sourceVideoUrl}` |

### Session

| Request | Tools |
| --- | --- |
| Show the user an element / move the playhead / play | `preview {action:"focus", id}` (after creating or changing something visible), `{action:"seek", frame}`, `{action:"play", frame, toFrame?}`, `{action:"pause"}` |
| Complete first cut / finished video | whole-film design and approval method in `storyboard-draft.md` |
| Use a private/community Studio Skill | `list_skills` → `read_skill {id}` |
| Resolve a Skill-bound voice | `manage_voices {action:"list", query:<exact name>}` → `generate_speech {voiceId}` |
| Deliver a file | `export {action:"start"}` → `export {action:"status"}` — only when the user asks for a deliverable |
| User explicitly asks to undo | `undo` (one step per call; the history is shared with the user's own edits, so never undo unasked — make the forward edit instead) |

## Patience with slow tools

`get_transcript` when it must transcribe, and `inspect_media` in geometry / semantic / editorial modes, run **in the user's browser** and can take minutes (visual geometry is frame-by-frame; semantic mode adds sparse hosted understanding). A slow response is not a failure — do not retry just because a call takes long. Card-type tools have a 10-minute bridge timeout; instant operations time out at 60s.

## Local media import

When the user points at LOCAL video, image or audio paths, load the `asset-import` skill — `import_media` with no arguments returns a short-lived import token and the exact `base_url`; its helper streams the files straight into the OPEN studio tab over the user's machine and keeps the original bytes in device-local OPFS (a tab must be open first). The helper returns registrations you place with `add_clips`. Main-video import can optionally send only a small extracted audio copy through Pireel's disclosed ASR path. Never tell the user to upload local source media to the cloud as the first answer.

## Seeing and offline mode

- `inspect_timeline {frames:[…]}` renders exact frames of the composited output (footage + framing + overlays + text + captions) as images — your eyes. Each image carries its frame number and the receipt lists the clip ids visible on screen, so what you see maps back to what you can edit. Verify visual work after `apply_component`, `set_texts`, caption or framing changes, then fix what looks wrong. Needs the studio tab open.
- `inspect_timeline` with `{fromFrame, toFrame, maxFrames}` or with no arguments reviews the timeline as a sequence: the midpoint of every visible clip in time order. Use it after a complete edit or any multi-clip batch; inspect every attached image as a sequence rather than certifying one attractive midpoint. Nothing here can *hear* — verify sound decisions from `get_state` and mutation deltas (levels, fades, mutes) and invite the user to play the result.
- When the tab is closed, data-level tools (timeline edits, cuts, component edits, text, captions, BYO compose/apply) run in OFFLINE MODE against the user's most recently updated cloud project (results carry `offline: true`). Offline is a fallback, not the default: before consequential editing, open the editor so the user can watch. Media-byte analysis, rendered `inspect_timeline`, local-file materialization and browser export need the live tab.

## When to ask the user instead of acting

Over MCP there is no `ask_user` tool (it exists only in Studio Chat): ask in your own host's conversation, one focused question at a time, and stop the turn. Individual edits are never asked for — they are undoable and effectively free; do them and say what changed.

- The request is ambiguous or names an element that doesn't exist — ask ONE short clarifying question, don't guess.
- Aggressive shortening, restructuring, highlight/short-version, or a generated hook — confirm target length, structure, and what to preserve BEFORE cutting.
- Before a consequential complete *creative* build with no Frame, when the visual direction is genuinely unresolved, inspect the material and recommend 1–2 fitting Frames (`manage_frame {action:"list"}`) plus themeless, then wait for the choice. A Frame is never required to start cutting, placing, framing or mixing; never hold up a small local edit or a speech cleanup on it. If the user said to proceed without asking, pick the strongest direction, name it in one sentence, and continue.
- Paid generation (image, video, audio, speech, voice clone/design, hosted component fallback) — propose prompt, model, duration and aspect, and wait for confirmation.
- PROJECTS (no browser): offline tools act on your ACTIVE project = the most-recently-touched one. `manage_project {scope:"project", action:"list"}` shows all (newest first = active); `{scope:"project", action:"switch", id}` makes a different one active and returns its state; `{scope:"project", action:"create", title?}` starts a fresh empty one (immediately active); `{scope:"project", action:"rename", id, title}` retitles. If `get_state` reports "no cloud project", create one with `manage_project` (or `import_media`) — don't send the user to a browser just to create one.
- `studio_not_open` / `studio_tab_closed` — first open your own built-in/embedded browser tab. Ask the user only when no embedded browser exists. For local import, switch to a controllable connected browser only after the embedded attempt explicitly reports the loopback-unreachable error.

## Talking to the user

Explain edits by the actual spoken words ("cut the half-sentence that got re-recorded"), never by internal ids, frame numbers or raw timestamps — the user can't see those. After creating or visibly changing an element, call `preview {action:"focus", id}` so the user is looking at the result. On-screen text (component copy, captions, titles) follows the VIDEO's spoken language, not the language of the chat. Billing note if asked: only tools whose description carries a [CHARGES] marker bill Pireel credits (media generation, transcription when it must run, semantic/editorial inspection and the hosted component fallback); your orchestration and every BYO flow cost the user nothing — details in the product-help skill.
