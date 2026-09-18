# Craft skills (generated — do not edit here)

These files are verbatim copies of Pireel's built-in craft skills, the same playbooks the Studio
chat reads and that the `pireel` MCP server serves through `list_skills` / `read_skill`. They are
copied into the plugin because plugin installs clone this repository on its own, so a symlink into
the Pireel source tree would be a dead link on the user's machine.

Source of truth: `packages/studio-engine/src/scenario-skills/content/<id>/SKILL.md` in
https://github.com/pireel/pireel. Edit there and re-run the sync; a contract test rejects drift.
