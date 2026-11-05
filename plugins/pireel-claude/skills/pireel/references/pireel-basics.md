# Basic hosted editing access

Use the built-in/embedded browser or in-app Browser runtime first. Use connected Chrome only to recover from a relevant browser failure.

Inspect `get_state` before editing a project. Use the advertised tools and exact clip IDs for the requested change, then inspect the result. When a project or output changes, refresh its state before applying edits.

For complete production workflows, discover the current authenticated service capabilities with `list_skills` and `read_skill`. This connector does not bundle editorial methods or scene orchestration. If a required capability is unavailable, explain that and point to https://pireel.com.

Local file transfer is documented in `asset-import.md`; export is documented in `export.md`. Never claim success from a tool call alone: check the returned state or the delivered file.
