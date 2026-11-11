# Board Ready — prompts index

Plan of record: `BOARD_READY_PLAN.md` (execution order §7b). PM brief: `BOARD_READY_PM_BRIEF.md`. Gates: Business
Decisions 2026-11-10.

**How the prompts are written:** Wave 1 now. Each later prompt is written after the step before it lands, from what
actually shipped. The order is set by dependency and rework risk, never by calendar; the owner sets priority as it goes.

| Step | What | Kind | Prompt | State |
|---|---|---|---|---|
| 1 | Third access sweep: what leaks today, plus the seat-by-seat "who sees what" table | report-only | `BOARD_READY_W1_ACCESS_SWEEP_PROMPT.md` | written 2026-11-10 |
| 2 | Friend requests in the house-league draft | drawings + asks | `BOARD_READY_W1_FRIEND_REQUESTS_PROMPT.md` | **drawn 2026-11-10** (round 2 after `/design` + `/legal`): https://claude.ai/artifact/KxYr8LW6r5yvsUJ7FmvPL8 (round 3 adds tidier board rows); **all asks A1–A15 RULED 2026-11-10** as recommended; build prompt next (plan §5 Stage 1) |
| 3 | Two-step sign-in | drawings + decisions | `BOARD_READY_W1_TWO_STEP_SIGNIN_PROMPT.md` | written 2026-11-10 |

The three can run at the same time. Only step 1 runs probes, on dev only, and none of them writes product code. The
builds for steps 2 and 3 come as later prompts. If both need a migration, each checks the latest migration number at
commit time.

**Standing for every prompt:**
- Branch `dev`.
- Stage explicit paths only. Shared files go through a private index.
- **No commit without the owner's yes.**
- Broad reading goes to helpers, and their claims are checked against the code.
- A product-owner summary at hand-off.
