# The studio UI, as the user sees it

Vocabulary first — use the user's terms, not internal ones: **组件** (components: overlay HTML/GSAP graphic blocks — metric cards, charts, callouts, titles), **分镜/场景** (video shots), **取景** (shot framing: full / punch-in / corner / split), **字幕** (global caption presets), **主题** (frames: design-system content packs), **素材** (assets: images/videos/components), **口播稿** (the spoken transcript).

## Layout

- **Projects home** (`/studio`): project cards — new / open / rename / delete. One project = one video.
- **Workbench** (`/studio/<id>`), one screen, four zones:
  - **Preview canvas** (center) — this IS the editing surface: click an element to select it (drag/resize/rotate handles), double-click text to edit it in place. When the chat panel is closed, a 对话 button floats at the preview's top-left.
  - **Assets rail** (right of the preview, above the timeline) — two tabs: **素材** (all assets in one stream: images / videos / components, uploads and generations mixed with source badges; search, grid/list, insert or drag onto the canvas/timeline; the **生成** button opens the generation window) and **主题** (frame gallery: browse design packs, apply one to the whole piece). Collapsible; when collapsed a small 素材 button floats at the preview's top-right.
  - **Transport bar** (under the preview) — play/pause, time, undo/redo, split/trim-left/trim-right at the playhead, delete selection, **智能剪口播** (word-level transcript cutting), **字幕** (caption presets + bilingual translation), **人像** (person matte: text-behind-person, stroke, background swap), **取景** (framing picker for the selected shot), and export.
  - **Timeline** (bottom) — track 0 is the talking-head video (scene cards with framing badges), upper tracks are overlay components; captions do not occupy a track (edit them via 字幕/剪口播). Drag assets in, drag clips around, box-select.
  - **Chat panel** (left side) — the built-in agent; closable via its header ✕ (the 对话 button at the preview's top-left brings it back).
- **Tool panels (docked into the assets rail)** — 生成 (generate image/video/component, tabbed), 智能剪口播, 字幕 (presets + bilingual translation), 人像, 取景 (framing + 画面调色 sliders), 转场 (effect picker for one cut), 素材动效 (enter/exit animation for a media block). One at a time; opening another replaces it. A panel takes over the whole assets rail (the 素材/主题 tabs come back when it closes); if the rail is collapsed it auto-expands, and collapses back if it was only opened for the panel.

## Where things run

- Editing, preview, and **export** are local in the user's browser (WebCodecs; export downloads straight to their Downloads folder).
- The source video stays local (OPFS) with an automatic cloud backup for device switching; projects sync to the cloud.
- The studio tab must be open for video-dependent agent work (transcription, visual analysis, capture_frame, export); pure data edits also work with the tab closed (offline mode, against the cloud project). An agent with a built-in browser can open a pre-signed-in editor tab itself (create_browser_handoff) — the user just watches the edit happen.

## Common "where do I…" answers

- Add a graphic → ask the agent (BYO compose), or 素材 tab → 组件 → insert; empty component cards offer AI-generate / upload actions.
- Change how the video is framed in a scene → select the scene card → 取景 button (or the framing badge on the card).
- Color-grade a scene (brightness/contrast/saturation) → same 取景 window, 画面调色 sliders (100 = untouched; per scene, or ask the agent: set_video_filter).
- Add B-roll → hover a scene card's edge → the「+」button (or ask the agent: insert_clip after uploading).
- Transitions (true dual-stream, rendered by the gl-transitions shaders) → click the narrow band on any cut between scene cards → pick an effect card in the docked panel (无/叠化/渐黑/推移/划开/圆形/百叶窗/变焦/旋转/故障/波浪; hover a card to watch it play on two photos; 推移/划开 have a direction picker). Once set, an accent region straddles the cut on the main track — drag its side handles to adjust length (symmetric around the cut, max 4s); you can't split inside it, and deleting either adjacent scene clears it. Or ask the agent (add_transition).
- Clean up the speech → 智能剪口播 (word-level: click a word to delete/replace, batch-remove fillers and silences).
- Subtitles → 字幕 button → pick a preset (applies to the whole piece; drag/scale on the canvas adjusts all of them).
- Bilingual subtitles → captions panel (字幕) has a 双语翻译 section: pick a target language and Pireel's own LLM translates (charges credits); or ask the agent to translate itself (free) — either way the translation line appears under the captions.
- Change the whole look → 主题 tab → pick a frame → 使用.
- Get the final file → 导出 in the transport bar (or ask the agent: export_video / track_export).
