# Board Ready — prompts index

Plan of record: `BOARD_READY_PLAN.md` (execution order §7b). PM brief: `BOARD_READY_PM_BRIEF.md`. Gates: Business
Decisions 2026-11-10.

**How the prompts are written:** Wave 1 now. Each later prompt is written after the step before it lands, from what
actually shipped. The order is set by dependency and rework risk, never by calendar; the owner sets priority as it goes.

| Step | What | Kind | Prompt | State |
|---|---|---|---|---|
| 1 | Third access sweep: what leaks today, plus the seat-by-seat "who sees what" table | report-only | `BOARD_READY_W1_ACCESS_SWEEP_PROMPT.md` | **swept 2026-11-10**: `BOARD_READY_ACCESS_SWEEP_3.md` (2 serious, 5 medium, ~25 small); fixes are Wave 2 below |
| 2 | Friend requests in the house-league draft | drawings + asks | `BOARD_READY_W1_FRIEND_REQUESTS_PROMPT.md` | **drawn 2026-11-10** (round 2 after `/design` + `/legal`): https://claude.ai/artifact/KxYr8LW6r5yvsUJ7FmvPL8 (round 3 adds tidier board rows); **all asks A1–A15 RULED 2026-11-10** as recommended; drawings committed `bf5ac936c`. **Build prompt written 2026-11-10:** `BOARD_READY_S1_FRIEND_REQUESTS_BUILD_PROMPT.md`, three parts run in order (1 family side + settings · 2 registrar + deletion · 3 draft + board rows). **Part 1 BUILT + committed `9269b5eab` 2026-11-11** (mig 461 applied to dev 2026-11-11; walk §510 https://claude.ai/artifact/2BfsMZ7k3HrkabN3Zo5sM5 ✅ 25/25 2026-11-11); **Part 2 BUILT + committed `f291a8bb1` 2026-11-11** (nightly job mig 472 `3628b51a1`; migs 471 + 472 applied to dev 2026-11-11; walk §516 https://claude.ai/artifact/LEdqsZtJFgVw4NqqQH34bb ✅ 37/37 2026-11-12); **Part 3 BUILT + committed `06a2b17f1` 2026-11-12** (mig 473 applied to dev 2026-11-12; walk §518 https://claude.ai/artifact/LLFzexk8mG9RZZPmk1R9MK published); ⛔ release gate: Parts 1 and 2 in one promote, migs 461 → 471 → 472 (/legal) |
| 3 | Two-step sign-in | drawings + decisions | `BOARD_READY_W1_TWO_STEP_SIGNIN_PROMPT.md` | **drawn 2026-11-10** (round 2 after `/design` + `/legal`): https://claude.ai/artifact/5b956A7svYzjzmZhZUfnkc (round 3: ask 1 ruled 2026-11-10, offered to everyone and the club may require it); **all asks RULED 2026-11-10** (2–8 + A–F as recommended); **build prompts written 2026-11-10**: `BOARD_READY_TWO_STEP_BUILD_PROMPTS.md`, four parts: 1 foundation (**Opus**, after Wave 2 Fix A is committed), 2 your account (Sonnet), 3 switches + resets (**Opus**, beside 2), 4 what the club sees + words (Sonnet, last); **Part 1 committed `7c8f092ab` 2026-11-11, walk §511 ✅ 24/24 2026-11-11; Part 2 committed `0a0ee533d` 2026-11-11, walk §513 ✅ 28/28 2026-11-11; Part 3 committed `5a22b498a` 2026-11-11 (mig 470 `d5f9f7f52`; coach door drawn + approved the same day), walk §515 published, commit on the owner's yes, mig 470 its own commit; walk §515 ✅ 35/35 2026-11-12; Part 4 committed `24e5b9e45` 2026-11-12 (mig 475 dev), walk §520 ✅ 29/29 2026-11-12** |

### Wave 2 — the third sweep's fixes (written 2026-11-10 from `BOARD_READY_ACCESS_SWEEP_3.md`)

**Run now, each in its own new chat (four):**

| Fix | What | Model | Prompt |
|---|---|---|---|
| A | Coaches, scorekeepers and staff stop reading the tournament emails, recipient lists and full tournament records; the score-review switch gets a permission (findings 1 + 3, **serious**) | **Opus**: shared sign-in check, wide blast radius, census first | `BOARD_READY_W2_FIX_A_MEMBER_READS_PROMPT.md` |
| B | The rules-and-resources file store moves behind the server (finding 2, **serious**) | Sonnet: shape decided; production order is code, then the migration | `BOARD_READY_W2_FIX_B_RESOURCES_STORE_PROMPT.md` |
| C | A hidden Schedule sends no games; Unsubscribe asks before it acts (`/legal`); public smalls (findings 6 + 7) | Sonnet | `BOARD_READY_W2_FIX_C_PUBLIC_AND_EMAIL_PROMPT.md` |
| D | Demo billing refused (`/accounting`); team pay links get a version; feedback throttle; defence-in-depth smalls | Sonnet | `BOARD_READY_W2_FIX_D_DEMO_LINKS_THROTTLES_PROMPT.md` |

**Later in this wave · don't start yet:**
- **Fix E**, the inside-club seat reads: the two owner calls (the returning-player scan, the staff export), the scorekeeper
  feed, the permit file, group limits and the family-link revoke. **Waits for fix A to be committed** (neighbouring
  routes; it builds on A's census and guard). Sonnet. `BOARD_READY_W2_FIX_E_SEAT_READS_PROMPT.md`.

If B and D both need a migration, each checks the latest migration number at commit time.

The three Wave 1 prompts can run at the same time. Only step 1 runs probes, on dev only, and none of them writes product code. The
builds for steps 2 and 3 come as later prompts. If both need a migration, each checks the latest migration number at
commit time.

**Standing for every prompt:**
- Branch `dev`.
- Stage explicit paths only. Shared files go through a private index.
- **No commit without the owner's yes.**
- Broad reading goes to helpers, and their claims are checked against the code.
- A product-owner summary at hand-off.
