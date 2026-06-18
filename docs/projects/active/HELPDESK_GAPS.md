# Helpdesk Gaps Backlog

Support-seam gaps surfaced by the /helpdesk agent. Feeds the platform-admin
support-tooling work (F1–F5). Newest first. Triage into a fix project when actioned.

## Legacy playoff bracket can't be repaired without engineering — date TBD — ✅ ADDRESSED 2026-06-18
- **Resolution:** Dissolved by the Bracket Graph-Layout work (see [[project_bracket_graph_layout]]). Bracket columns + connectors now derive from the Winner/Loser feed graph, not the code string, so a legacy `G1..G7` (or any renamed) bracket renders as a correct tree for admins AND fans/PDF with **no data repair**. The `repair-legacy-bracket-codes.mjs` script is now optional (cleanup only). Remaining (lower-pri) gap: there's still no platform-admin UI to *inspect* a split `bracket_id` (advancement-breaking) — keep on the backlog as a small diagnostic surface.
- **Symptom:** A prod playoff bracket built by an older generator uses non-canonical `bracket_code` values (`G1..G7`). The renderer can't group those into round columns, so the bracket diagram shows each game in its own column in arbitrary order (e.g. G7 before G6) with crisscrossing connector lines — "links not working as expected." Customer wants to keep all game data (seeds, times, locations) but fix the wiring/display.
- **Why no self-serve fix:** There is NO platform-admin (or org-admin) surface to inspect or repair a bracket's underlying `bracket_code`/placeholder wiring. The inline Bracket Editor re-saves codes as-is (it preserves `bracket_code`), so it can't migrate a legacy scheme. A non-engineer has no path; this required a one-off Node repair script against prod.
- **Suggested surface:** A "Repair / re-code bracket" action in the Schedule playoff admin (or platform-admin org tools) that re-derives canonical `R{round}-{n}` codes from the Winner/Loser feed graph and rewrites placeholders in lockstep, preserving team-ids/dates/scores. Also surface a "distinct bracket_id" warning when one visual bracket is split across ids (advancement-breaking).
- **Workaround used:** `scripts/repair-legacy-bracket-codes.mjs` (dry-run by default, `--apply` to write) — graph-based re-code + lockstep placeholder rewrite, run against `.env.production.local`.
- **Effort:** M (data-repair tool) / L (productized admin action + the broader fix of making `bracketRoundInfo` order legacy codes by feed-graph depth)
- **Related:** [[project_playoff_bracket_builder_ux]] / FP-5 Tournament Organizer
