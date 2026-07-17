# Prompt — Tournament Mobile Polish, Round 4 BUILD (Day-First Schedule Timeline)

*Owner kickoff prompt for a dedicated build chat. Created 2026-07-17 by the Round 3 chat after
Round 3's commit (`91a26de3`). Paste the block below into a fresh chat verbatim. This is a
BUILD chat — all design decisions are already made and logged; nothing gets re-asked.*

---

Build **Round 4 of the Tournament Mobile Polish plan — the Day-First Schedule day view** —
exactly as specced. Every decision is owner-accepted and logged: do NOT re-open D1–D8 or any
G-decision; build, verify, and hand off.

READ FIRST, in this order:
1. `docs/projects/active/DAY_FIRST_SCHEDULE_TIMELINE_PLAN.md` — the full spec: §2 (why it's
   cheaper than it looks — the date-first render path already exists in ScheduleContent; the
   multi-pool Pool Play branch is the only pool-first path), §3 scope (day selector + "All"
   chip, D8's two selector presentations, smart landing via tournament-timezone helpers),
   **§3b the ride-along fix** (the schedule lays out at a 448px mobile viewport on a 390px
   device — find and constrain the over-wide element; acceptance = the capture harness reports
   vw/vh equal to the device viewport), §4 build phases P1–P4, §6 verification, §7 sequencing.
2. `docs/projects/active/DAY_FIRST_SCHEDULE_TIMELINE_PM_BRIEF.md` — the outcome bar.
3. `memory/design_decisions.md` — the two 2026-07-14 "Schedule DAY VIEW package" + "day
   selector" entries (D1–D8 bindings, incl. **D7: the Pool Play/Playoffs stage toggle STAYS —
   the merged single-timeline day view is REJECTED**) and the 2026-07-16 Round 3 package entry
   (the dock now renders a minimized pill on the schedule route — your layout changes must not
   collide with it).
4. `docs/projects/active/TOURNAMENT_MOBILE_POLISH_PLAN.md` §4 — the accepted canon your work
   sits inside (G3 unified header, G4 mono kickers, G5 More-sheet nav, Rounds 1–3 all built
   and committed: Track A `889273fd`, R1 `66e5ee37`, R2 `94ccc8a1`, R3 `91a26de3`).

PROCESS (AGENCY_RULES applies):
- Present the plain-language PM UX summary in the conversation BEFORE writing code (the PM
  brief is your source — restate, don't invent).
- Build P1→P4 in one pass (the owner's build-full-phase preference), including §3b.
- Desktop gets the same day view (D2 — no mobile-only fork). 390 AND 360 AND light mode AND
  followed/anonymous states all hold.

TRAPS (all bit earlier rounds — check before trusting anything):
- ⚠ STALE-SERVER: before trusting any capture, confirm :3000 serves the current build (the
  Teams tab shows mono "A POOL" kickers + tabular records since R3; standings shows the REC
  column since R2). Symptoms like "Jest worker … exceeding retry limit" or a "(stale)" badge =
  stop server → delete .next → restart (network access) → wait for Ready.
- ⚠ LIVE-DEMO DATE DRIFT: the seeded tournament's final day must equal TODAY. If it has
  drifted, SHIFT dates — tournament start/end + every game's game_date (column is `game_date`,
  not `date`) — by the delta; NEVER re-run the seed script (it orphans QA claims/follows).
  Then `node --env-file=.env.local scripts/mobile-review-capture.mjs --go-live` re-lights the
  two semis. The Round 3 chat left a working shift script pattern in its session records.
- ⚠ The dock pill (R3/G1) mounts on the schedule route — keep it working (it must stay the
  minimized pill there, right-anchored above the bottom nav, tap-to-restore).
- Tokens only; the schedule page must never gain horizontal overflow OR a layout viewport
  wider than the device (§3b's acceptance covers both).

VERIFICATION (plan §6 is binding):
- Re-run `scripts/mobile-review-capture.mjs`: smart-landing day is the ONLY day rendered on
  game day with the live games in the first viewport; each date renders exactly once in the
  "All" view; day chips ≥44px; overflowX false; **vw/vh = device viewport (the §3b check)**.
- The landing-rule matrix (pre-event → first day; event day → that day; gap day → next date
  with games; post-event → last day) computed in the tournament timezone, never device-local.
- `npm run typecheck` (core render loop touched) + `npm run verify:changed`.

BEFORE COMMIT: run `/simplify` then `/review` (Round 2 and 3 both did; it caught real bugs
both times). Commit ONLY on explicit owner OK, explicit pathspecs, dev branch, no push,
`git show --stat HEAD` after. Update TODO.md + the two Round 4 docs' status + project memory.

AFTER BUILD: offer `/docs` — and fold in the Round 3 docs debt the review chat still owes:
the in-app guides don't yet cover the score-alerts bell on team pages, the auto-minimizing
my-team bar, or the "Recent results" rename. One /docs pass can cover both rounds.

This is the LAST build of the Tournament Mobile Polish project — when it lands, the plan +
PM brief pairs (mobile polish + day-first) move to docs/projects/archive/ per the docs
convention, and TODO.md's entry flips to complete.
