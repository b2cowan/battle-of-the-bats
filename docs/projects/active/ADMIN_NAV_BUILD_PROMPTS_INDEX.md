# Navigation across the three portals — build prompts index

Plan of record: `ADMIN_NAV_EVALUATION_PLAN.md` (asks E1–E16 **ruled 2026-11-09, all as recommended**; design log entry of
that date). Drawings: https://claude.ai/artifact/S7XXbtLwNeZUjEWXzbUcw4 (version 6; source
`ADMIN_NAV_EVALUATION_DRAWINGS.html`). PM brief: `ADMIN_NAV_EVALUATION_PM_BRIEF.md`.

**How the prompts are written (owner 2026-11-09):** Phase 0 and Phase 1 now; **each later prompt is written after the
phase before it lands**, from what actually shipped. Phases run in order: each depends on the one before, and the order is
set by dependency and rework risk, never by calendar.

| Phase | What the user sees | Asks | Depends on | Prompt | State |
|---|---|---|---|---|---|
| 0 | Nothing, except a tournament page no longer shows the club's name for a moment before the tournament's | E12 (3) | — | `ADMIN_NAV_BUILD_PHASE0_PROMPT.md` | built + committed `fd857b765` 2026-11-09 (walk carried by Phase 2's) |
| 1 | The club admin: the foot holds the portal doors, Help moves into the account menu (every portal, desktop), the strip says "Club" / "Events", Tournaments leaves Programs, the name on two lines, the logo tile, the back-link look | E4, E9 (word), E10 (club), E12 (1), E15, E16 | 0 | `ADMIN_NAV_BUILD_PHASE1_PROMPT.md` | Part A built + committed `664f9113d`, walk §504 PASSED 31/31 2026-11-09; Part B BUILT 2026-11-10 (commit owed, walk §507 owed); prompt: `ADMIN_NAV_BUILD_PHASE1_PARTB_PROMPT.md` |
| 2 | Tournament desktop: the event heads the sidebar with the list, the strip names the page with the dates and phase at its right end, no folding, the org's own sidebar on org-wide screens, page help in the top row | E1, E2, E3, E10 (event), E11, E12 (2), E14 | 1 | after Phase 1 lands | — |
| 3 | Tournament phone: the bar names the page; the event on the small line switches | E5 | 2 | after Phase 2 lands | — |
| 4 | Coaches Portal desktop: 240px, the team cell, the split strip ("Coach", the team's facts at its right end), no team bar, no folding, back arrow in the strip, closed season kept to one door | E6, E7, E9, E10 (team), E11, E14 | 1 (2 for the shared cell list) | after Phase 2 lands | — |
| 5 | Coaches Portal phone: the bar names the page; the team on the small line switches | E8 | 4 | after Phase 4 lands | — |
| 6 | Words, help articles, demos, the written nav standard rewritten, the staging sweep, the closing walk of a multi-role owner across all three | all | 5 | after Phase 5 lands | — |

**Standing for every phase:** branch `dev`; stage explicit paths only (shared files carry other sessions' hunks — partial
commits through a private index); **no commit without the owner's yes**; the drawings are the target (build to them;
anything they don't show gets drawn and ruled before code); `/design` on the built screens, `/simplify` where a phase adds
an abstraction, `/review` before handing off; a checkable walk Artifact per phase (one purpose), ledger § recorded.
Free Coaches Portal out of scope (E13).
