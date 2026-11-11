# Board Ready — prompts index

Plan of record: `BOARD_READY_PLAN.md` (execution order §7b). PM brief: `BOARD_READY_PM_BRIEF.md`. Gates: Business
Decisions 2026-11-10.

**How the prompts are written:** Wave 1 now. Each later prompt is written after the step before it lands, from what
actually shipped. The order is set by dependency and rework risk, never by calendar; the owner sets priority as it goes.

| Step | What | Kind | Prompt | State |
|---|---|---|---|---|
| 1 | Third access sweep: what leaks today, plus the seat-by-seat "who sees what" table | report-only | `BOARD_READY_W1_ACCESS_SWEEP_PROMPT.md` | written 2026-11-10 |
| 2 | Friend requests in the house-league draft | drawings + asks | `BOARD_READY_W1_FRIEND_REQUESTS_PROMPT.md` | **drawn 2026-11-10** (round 2 after `/design` + `/legal`): https://claude.ai/artifact/KxYr8LW6r5yvsUJ7FmvPL8 (round 3 adds tidier board rows); **all asks A1–A15 RULED 2026-11-10** as recommended; drawings committed `bf5ac936c`. **Build prompt written 2026-11-10:** `BOARD_READY_S1_FRIEND_REQUESTS_BUILD_PROMPT.md`, three parts run in order (1 family side + settings · 2 registrar + deletion · 3 draft + board rows). **Part 1 BUILT + committed `9269b5eab` 2026-11-11** (mig 461 applied to dev 2026-11-11; walk §510 https://claude.ai/artifact/2BfsMZ7k3HrkabN3Zo5sM5 owed); ⛔ release gate: not promoted without Part 2 (/legal) |
| 3 | Two-step sign-in | drawings + decisions | `BOARD_READY_W1_TWO_STEP_SIGNIN_PROMPT.md` | **drawn 2026-11-10** (round 2 after `/design` + `/legal`): https://claude.ai/artifact/5b956A7svYzjzmZhZUfnkc (round 3: ask 1 ruled 2026-11-10, offered to everyone and the club may require it); **all asks RULED 2026-11-10** (2–8 + A–F as recommended); **build prompts written 2026-11-10**: `BOARD_READY_TWO_STEP_BUILD_PROMPTS.md`, four parts: 1 foundation (**Opus**, after Wave 2 Fix A is committed), 2 your account (Sonnet), 3 switches + resets (**Opus**, beside 2), 4 what the club sees + words (Sonnet, last); **Part 1 committed `7c8f092ab` 2026-11-11, walk §511 ✅ 24/24 2026-11-11; Part 2 built 2026-11-11 (commit owed, the owner's yes), walk §513 owed; Part 3 BUILT 2026-11-11 (coach door drawn + approved the same day), walk §515 published; Part 4 after Part 3 commits** |

The three can run at the same time. Only step 1 runs probes, on dev only, and none of them writes product code. The
builds for steps 2 and 3 come as later prompts. If both need a migration, each checks the latest migration number at
commit time.

**Standing for every prompt:**
- Branch `dev`.
- Stage explicit paths only. Shared files go through a private index.
- **No commit without the owner's yes.**
- Broad reading goes to helpers, and their claims are checked against the code.
- A product-owner summary at hand-off.
