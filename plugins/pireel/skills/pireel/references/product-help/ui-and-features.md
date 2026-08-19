# The studio UI, as the user sees it

Vocabulary first: **组件 / Component** is Studio's broader extensible visual-element concept. **动态图形 / Motion Graphic** is the primary Component family currently exposed in the UI: kinetic words, one-number reveals, data stories, logo stings, overlays and real-source highlights. Do not treat the two terms as synonyms or assume every future Component is a Motion Graphic. Other user-facing terms: **分镜/场景** (video shots), **取景** (shot framing: full / punch-in / corner / split), **字幕** (global caption presets), **主题** (Frames: professional art directions, not Scene/layout templates), **素材** (assets: images/videos/Components), **口播稿** (the spoken transcript). The editor stores Components as `block` records.

## Layout

- **Projects home** (`/studio`): project cards — new / open / rename / delete. One project may contain multiple independently editable outputs.
- **Workbench** (`/studio/<id>`), one screen, four zones:
  - **Preview canvas** (center) — this IS the editing surface: click an element to select it (drag/resize/rotate handles), double-click text to edit it in place. When the chat panel is closed, a 对话 button floats at the preview's top-left.
  - **Assets rail** (right of the preview, above the timeline) — two tabs: **素材** (all assets in one stream: images / videos / Components, with Motion Graphics as the current designed-visual family; uploads and generations mixed with source badges; search, grid/list, insert or drag onto the canvas/timeline; the **生成** button opens the generation window) and **主题** (Frame gallery: browse design packs, apply one to the whole piece). Collapsible; when collapsed a small 素材 button floats at the preview's top-right.
  - **Transport bar** (under the preview) — play/pause, time, undo/redo, split/trim-left/trim-right at the playhead, delete selection, **智能剪口播** (word-level transcript cutting), **字幕** (caption presets + bilingual translation), **人像** (person matte: text-behind-person, stroke, background swap), **取景** (framing picker for the selected shot), and export.
  - **Timeline** (bottom) — typed visual, Component/graphics, audio and caption tracks. The primary narrative is one semantic role rather than a special editing universe; ordinary media tracks can also carry video and its sound. Drag assets in, drag clips around, box-select, and apply split/trim/delete to the selected clip.
  - **Chat panel** (left side) — the built-in agent; closable via its header ✕ (the 对话 button at the preview's top-left brings it back).
- **Tool panels (docked into the assets rail)** — 生成 (generate image/video/Motion Graphic Component, tabbed), 智能剪口播, 字幕 (presets + bilingual translation), 人像, 取景 (framing + 画面调色 sliders), 转场 (effect picker for one cut), 素材动效 (enter/exit animation for a media block). One at a time; opening another replaces it. A panel takes over the whole assets rail (the 素材/主题 tabs come back when it closes); if the rail is collapsed it auto-expands, and collapses back if it was only opened for the panel.

## Where things run

- Editing, preview, and **export** are local in the user's browser (WebCodecs; export downloads straight to their Downloads folder).
- User-local video, image and audio bytes stay in device-local OPFS; project structure and local locators sync, but the source bytes do not silently upload for device switching.
- The studio tab must be open for video-dependent agent work (transcription, visual analysis, capture_frame, export); pure data edits also work with the tab closed (offline mode, against the cloud project). An agent with a built-in browser can open a pre-signed-in editor tab itself (create_browser_handoff) — the user just watches the edit happen.

## Common "where do I…" answers

- Add a Motion Graphic → ask the agent (BYO compose) or 素材 tab → 动态图形 → insert. For complete edits it should be designed as one layer of the current Scene, with real placement/backdrop decided before generation.
- Change how the video is framed in a scene → select the scene card → 取景 button (or the framing badge on the card).
- Color-grade a scene (brightness/contrast/saturation) → same 取景 window, 画面调色 sliders (100 = untouched; per scene, or ask the agent: set_video_filter).
- Shot sound (volume/mute of a scene's own audio, e.g. quiet a B-roll insert) → same 取景 window, 声音 section (volume 0–100% of source level + mute toggle; per scene, or ask the agent: set_shot_audio with volumeDb -60..0 / mute).
- Narration / music / SFX → typed audio lanes (bottom), drawn with waveforms. User-local audio stays in OPFS; generated/cloud audio keeps its own cloud locator. Drag an audio asset onto the timeline or use its 加到音轨 action. The agent uses `register_media` + `add_clips` and declares the intended role; `set_bgm` remains a legacy convenience for an already-addressable music URL, not the path for local narration. On a clip: body-drag moves it, the two edges trim in/out, the top-corner knobs drag the fades, click selects and Del removes. While an audio clip is selected the toolbar's split / trim-left / trim-right act on it. 音频 is a tab in the assets rail (after 字幕): with a lane clip selected it edits that clip's volume / fade-in / fade-out / speed; with none selected it edits the footage's own sound. Several tracks may overlap and sum.
- Narration denoise → same 音频 panel, 口播降噪 toggle + strength (on-device model, bakes once per source in the background; strength re-blends instantly; or ask the agent: denoise_audio). Needs the studio tab open — it processes audio in the browser.
- Add B-roll → hover a scene card's edge → the「+」button (or ask the agent: import it locally, then `insert_clip`).
- Transitions (true dual-stream, rendered by the gl-transitions shaders) → click the narrow band on any cut between scene cards → pick an effect card in the docked panel (无/叠化/渐黑/推移/划开/圆形/百叶窗/变焦/旋转/故障/波浪; hover a card to watch it play on two photos; 推移/划开 have a direction picker). Once set, an accent region straddles the cut on the main track — drag its side handles to adjust length (symmetric around the cut, max 4s); you can't split inside it, and deleting either adjacent scene clears it. Or ask the agent (add_transition).
- Clean up the speech → 智能剪口播 (word-level: click a word to delete/replace, batch-remove fillers and silences).
- Subtitles → 字幕 button → pick a preset (applies to the whole piece; drag/scale on the canvas adjusts all of them).
- Bilingual subtitles → captions panel (字幕) has a 双语翻译 section: pick a target language and Pireel's own LLM translates (charges credits); or ask the agent to translate itself (free) — either way the translation line appears under the captions.
- Change the whole look → 主题 tab → pick a frame → 使用.
- Get the final file → 导出 in the transport bar (or ask the agent: export_video / track_export).
