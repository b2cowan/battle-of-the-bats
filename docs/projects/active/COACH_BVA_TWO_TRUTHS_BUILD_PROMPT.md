# BUILD PROMPT — Budget vs Actual: Two Truths

You are building the owner-approved "Two Truths" upgrade to the coaches Budget vs Actual tab.
**Plan of record:** `docs/projects/active/COACH_BVA_TWO_TRUTHS_PLAN.md` (read it in full first —
its §0 carries the owner rulings D1–D6 + Q3; this prompt is the execution script, the plan is the
authority). PM brief beside it. Auto-memory: `project_coach_bva_two_truths.md`.

**Mockup of record:** artifact `b9951b82-f0a9-4d7b-b1c5-06386f759bff` — the deep-dive review the
owner decided from, INCLUDING §7 "Build gate", which holds the three gate mockups (G1–G3).

---

## ITEM ONE — THE MOCKUP GATE (blocking; no code before it clears)

The gate mockups are already built on the artifact's §7 (added 2026-09-02): **G1** the Months view
whole screen with the renamed five-reading menu open (Budget / Scheduled / **Cash** / **Season
spending** / Difference) and every rewritten basis note beneath the grid; **G2** the banner's
forward stat, two wording variants; **G3** the chart shelf below the Statement table, closed and
open, with the flatline marker and the fixed last x-label.

1. Check the conversation / artifact decision sheet for the owner's G1–G3 answers. If absent, ask
   the owner to open §7 of the artifact and answer (G1 approve/amend · G2 pick a wording · G3
   approve/amend). **Do not start coding without them.**
2. If the owner amends anything, update the artifact FIRST (same URL — pass it as `url`), get the
   re-approval, then build **to the approved mockups exactly**; departures get called out at QA.

Already ruled — do not re-ask: Option A (Season spending reading); the Cash rename in principle
(G1 is the final look, not the decision); **Q3: Difference compares plan against SPENDING**; all
eleven quick fixes; all three export additions; forecast includes committed dues, pledges appear
only as a labeled "possible" clause, never in the headline figure.

## Standing constraints (violating any of these is a defect)

- **Payouts are NEVER routed by reason** (owner 2026-09-02, structural: credits pool). Every
  change attaches to the fronting side.
- **One arithmetic.** The Season-spending grid SUMS the route's already-flattened statement
  movements (`actualMovements`, route step 7 — the list the chart sums). Never a second walk of
  the raw rows. `lib/coach-budget-rollup.ts` stays the one grouping home.
- **The export shares the screen's own predicates** (`lensCell`/`lensTotal`/`lensUndated`/
  `hasUndated`/`categoryHasFigure` and friends) — a downloaded file must not be able to disagree
  with the screen.
- **A category is the sum of its rows** on every lens; a cell drill-in opens only where records
  exist; the grid never becomes a second editor.
- **A pledge is "Possible", never "Total"** — the forecast honors it.
- Lens notes state their basis; one spelling everywhere (`check:spelling`); `installment` two Ls.

## Build order (each phase its own commit; P4 may batch its fixes)

### P4 — the eleven quick fixes (plan §5)
Variance key line · dates on the family-paid list (carry the payment date onto
`familyPaidCosts` — it exists on the excluded payment in `lib/coach-cash-strip.ts`) · promote the
Statement CashBridge to a visible sentence + link · "refund only" on the negative-actual variance
guard · visible "not planned" word on unplanned rows (deliberate reversal of the 2026-08-15 trim —
log it in `memory/design_decisions.md`) · off-plan total on the banner (`data.unbudgeted`,
computed + exported, never rendered) · View sublabel line · chart flatline marker (rides P2) ·
"Total cash out" row on Months·Cash (the sum `buildBandCashFlow` already takes) · opening-balance
provenance note · "Not itemized yet" → "Estimate not yet broken out" (screen + export + help).

### P2 — the chart shelf (plan §3)
Chart moves below the Statement/By-activity table into a collapsed `<details>` shelf ("Spending
trend"), open-state remembered with the existing per-device prefs. Fix the clipped last x-label
(anchor first `start` / last `end`, or widen the right margin). Phone: no 9px SVG text at 375px —
follow the approved G3 mockup.

### P1 — Season spending + the Cash rename (plan §2; the heart)
- New `MoneyLens` value `spending`; route builds a `spendingGrid` (`buildMonthGrid` over the
  statement movements, shared month domain, refunds already netted as negative amounts).
  Family-paid movements carry a `familyPaid` fact so the row can tag "paid by a family"
  (the fact exists per-payment via `effectivePayerId`; the statement's movement list currently
  drops it).
- Months UI: expense band only — no revenue band, no balance rows, no returned band; the
  Season-spending basis note per the approved mockup; drill-ins on a `spending|…` cellDetails
  keyspace; HeadroomBridge does NOT render on this lens.
- **Difference switches to the spending basis (Q3, ruled):** its cells read plan − spending; the
  tie-out retires on Difference and stays on Cash; its basis note is rewritten (shown in G1).
- **Rename `actual` → Cash in customer copy** (lens label, notes, export titles/datasets); the
  stored per-device lens value `actual` still resolves (the `readStoredView` precedent). The
  Statement's "Actual" column keeps its name.
- Export: the month-grid export gains the lens; the "PDF = whole-season statement" rule holds.
- **Same unit of work:** help articles + their `keywords`/`searchText` (`lib/help-content/*`), and
  the COMPLETE coach-demo money narration re-read (dock lines + tour steps — CLAUDE.md flags it
  three releases stale; this clears it). `npm run check:demos` after.
- Guards: extend `check:money-report` — spendingGrid grand total == `totalActual` == the
  statement's expense total, and the Difference-lens claims move to the spending basis. Unit
  tests: lens helpers, the stored-pref resolver, label functions.

### P3 — export additions (plan §4)
Reconciliation section appended to the Statement export whenever the CashBridge would render
(reads `cashAdjustments`, never re-derives; family-paid lines dated per P4) · off-plan line
(agrees with the new on-screen figure by construction) · board-ready PDF opening block (team,
season, headroom sentence, funded-by-players — values the screen already computes).

### P5 — the forward stat (plan §6)
The G2-approved wording. Reads the **Scheduled reading's ending-balance machinery**
(`buildBandCashFlow` over Scheduled) — never a second derivation; committed dues in the headline,
pledges + pending club asks as the separate "possible" clause; deep-links to Months · Scheduled.
Banner stays one row on desktop.

## Verification & QA

- `npm run verify:changed` per phase; `npm run typecheck` after P1 (shared modules) — run
  `npx next typegen` first. Serial, resource-aware.
- Extend + run `check:money-report`; run the money unit tests; `npm run check:demos` after the
  narration pass.
- After P1 (substantive + new abstraction): offer `/simplify` then `/review` per house rules.
  Offer `/docs` for the help sweep if not already done inside P1.
- **Owner QA:** one checkable walkthrough artifact at the NEXT FREE § in
  `docs/projects/active/OWNER_QA_LEDGER.md` (never sort the numbers) — real checkboxes +
  localStorage + paste-back, and the Sign-in-as card (uat-coach@uat-test-org.local /
  UATPassword2026!). Cover, at minimum: the five-reading menu; the fronted-$240 flow end to end on
  Cash AND Season spending (record a family-paid cost on the UAT team first); spending total ==
  headroom to the cent on screen and in xlsx/csv/pdf; Difference tying to Headroom with the
  tie-out gone; each of the eleven fixes; the shelf on desktop + phone; the three export adds
  opened and read.
- Dev-server restart discipline per AGENTS.md before handing off for browser testing.

## Ship discipline

Branch `dev` (re-check `git rev-parse --abbrev-ref HEAD` before every commit — shared working
copy). Stage explicit pathspecs only; bracketed route dirs need the git bracket-pathspec
workaround; `git show --stat HEAD` after each commit. **No push without owner word.** Update
TODO.md and the auto-memory topic file with positive anchors (commit hashes, dates) as phases
land; when the whole plan completes + QA passes, move the plan pair to `docs/projects/archive/`
and update the TODO entry.
