# Prompt — Budget vs. Actual learns the whole income truth (strip fix + month-grid income session)

**Written 2026-08-23 by the money-centralization P1 session, at the owner's direction, mid-§80
walk. Open this in a fresh session. The owner asked, looking at the Months view:** *"after
logging fundraising, why don't I see it in the budget/actual report? in fact, why aren't player
dues here either? how do you propose adding these to the monthly report?"* **— and approved the
two-part answer below. Phase 1 is a BUILD with a locked scope; Phase 2 is a MOCKUP SESSION that
must end in owner rulings before any grid change is built.**

⚠ Discovery below was code-verified 2026-08-23 (line numbers cited were true that day). Re-verify
against the tree — this repo's plans have been wrong before. A concurrent session is finishing
owner QA (§80) on the money-recording conversation; you share `dev` and one working copy with it
and others. Follow AGENCY_RULES' concurrent-work safety (explicit pathspecs, re-check branch).

**Read first:**
1. `docs/projects/archive/COACH_PORTAL_CHUNK_H_MONEY_BY_MONTH_PLAN.md` — where the month grid and
   its cash-flow strip come from (2026-07-30).
2. `app/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual/route.ts` §§ around lines 360-460
   (income/club feeds) and 872-892 (the strip maps) · `components/coaches/MoneyMonthGrid.tsx`
   (strip render ~77-87, 148-154; footnote ~401-406) · `app/api/.../register/route.ts` (the
   register's row assembly — the product's one PROVEN cash truth, `check:register`).
3. `docs/projects/active/COACH_PAYABLES_REBUILD_PLAN.md` §7 — the reporting-filter convention.
4. `docs/projects/active/COACH_MONEY_CENTRALIZATION_PLAN.md` — the sibling program; its P3 will
   touch the same BvA panel (tags pill); coordinate, don't collide.

## PLANNING FIRST — BLOCKING, IN THIS ORDER, NO CODE BEFORE STEP 3 (owner-set, 2026-08-23)

1. **The session's FIRST deliverable is the plan pair**, before any code and before any drawing:
   `docs/projects/active/BVA_MONTHLY_INCOME_PLAN.md` + `_PM_BRIEF.md` (AGENCY_RULES' standing
   requirement). The plan re-verifies §0-§3 of this prompt against the tree and states Phase 1's
   exact row-by-row cash composition and the guard's identity claim; the brief is plain-language,
   outcome-focused.
2. **Present the PM summary in the conversation and WAIT for the owner's explicit go on the
   plan.** No code on the strength of this prompt alone — this prompt is context, not approval.
3. **Phase 1 (strip) builds only after that go.** It is a numbers-correctness fix to an existing
   strip — no new screen shape — which is why it needs a plan gate rather than a mockup gate; if
   its implementation turns out to want ANY visible shape change beyond the row values and the
   footnote, stop and draw it first.
4. **Phase 2 (grid income) is MOCKUPS-FIRST, always**: options drawn as a Claude Artifact, costs
   priced, owner rulings stamped — and only then a build phase, with its own fresh go. A go for
   Phase 1 is never a go for Phase 2, and no grid change of any kind may ride Phase 1 "on the
   way past."

## 0 · What the owner has already ruled (2026-08-23, binding)

1. **The 2026-07-30 "Money in is player dues only" call is REVERSED.** Its double-count rationale
   described a model that predates the credit/cash split (2026-08-14), the money-in taxonomy
   (mig 243) and club money joining the report (mig 250). Verified today: dues cash, drive/sponsor
   cash, money-in records and club cash are DISJOINT streams — the register books all of them with
   no double entry and `check:register` proves its identity. A rebate is a CREDIT (a family sends
   less), never cash arriving twice. The reversal is logged in `memory/design_decisions.md`
   (2026-08-23 entry); your Phase 1 build makes it true on screen.
2. **Income belongs in the monthly report** — dues AND fundraising and the rest. HOW it appears in
   the grid is Phase 2's mockup question, owner-ruled from drawings.
3. Context you inherit for free: as of today the recording conversation exists (owner QA §80), a
   drive entry carries `received_date` (mig 261 — nullable, legacy rows fall back to `created_at`),
   and the fundraiser-entries writer accepts `receivedDate`, dating the ledger entry AND the
   rebate credit. So drive money is now PLACEABLE in a month by fact, not by recording day.

## 1 · Phase 1 — the cash-flow strip tells the truth (BUILD, scope locked)

The Months view's bottom strip (Money in / Money out / Running balance) currently reads, on the
**Actual** lens: in = dues payments only; out = the grid's cost cells. Both are wrong as CASH:

- **Money in (Actual)** must become ALL cash that arrived, by month: dues payments (by
  `receivedDate`) · money-in records — `income` AND `money_back`, both cash IN (by
  `receivedDate`) · realised drive/sponsor money **GROSS** (`amount_raised`, by
  `received_date ?? created_at`-day; a sponsor realises only when `received`) · the club's
  approved `charge_to_org` requests (by reviewed day).
- **Money out (Actual)** must become ALL cash that left: expense payments (by paid date) · dues
  payouts (by `paidDate` — TODAY MISSING from the strip entirely) · paid club allocation
  installments (by paid day) · approved `payment_to_org` requests (by reviewed day).
- ⚠⚠ **DO NOT reuse the grid's cost cells for Money out.** The report NETS club `charge_to_org`
  refunds into item actuals (route ~427-433, deliberately — a covered cost is not income for the
  REPORT). Cash is GROSS both directions; reusing netted cells while adding the same refunds to
  Money in double-counts them. Assemble both strip maps from the primitive records.
- **Scheduled/Budget lenses:** in = dues installments by due month (unchanged — the only income
  with a schedule); out = the lens's cells (unchanged — projections are the plan's business). The
  footnote states each lens honestly; the current "player dues only… same dollar twice" sentence
  RETIRES with the ruling it explained.
- ⚠⚠ **THE GUARD IS THE DELIVERABLE, not a nicety.** The repo's accepted pattern is two routes
  deriving independently + a checker proving they agree (`/register` ↔ `/money-summary`,
  `scripts/check-register-balance.mjs`). Extend that script (or add a sibling in
  `check:money-report`) to assert: BvA's Actual strip, summed over months, equals the register's
  settled rows bucketed by month — to the cent, both directions. Without this the strip and the
  register WILL drift again; they already had (found today: payouts missing, drives missing).
- Running balance follows from the two maps — with the guard, its trajectory finally matches Cash
  on hand's story.
- Aftercare in the same unit of work: help guide's BvA section re-read (`/docs` if it describes
  the strip), demo-copy re-read per CLAUDE.md (the coach tour narrates BvA — money vocabulary is
  the surface that goes stale), QA ledger section (owner walks it), TODO update, and the
  design-decisions entry updated from "ruled, build pending" to built.

Exit: a coach who records a drive amount or receives dues sees the month's Money in move; a
payout moves Money out; the guard is green; `check:register` / `check:money-report` / 2,369 unit
tests stay green.

## 2 · Phase 2 — income in the month GRID (MOCKUP SESSION → rulings → gated build)

The Months grid is deliberately money-OUT only (route ~488-493: "putting revenue rows in it would
be a second report wearing the first's clothes" — panel ~928 "the treasurer's spreadsheet shape").
The owner wants income visible monthly; the SHAPE is his call, from drawings, per this program's
history (the Insights portal was reversed twice by owner eye at exactly this stage).

Draw 2-3 honest options as a Claude Artifact (mockups ARE the spec once approved; a picture owes
functionality, not pixels). Candidates to price — pick/adjust, don't treat as exhaustive:
- **A. An income band in the same grid** — Money-in categories (Dues · each drive · Sponsors ·
  Other) × months above/below the cost rows, same four lenses. The data exists: funding lines
  carry monthly phasing exactly like cost lines (route `toRollupLine`, direction-agnostic;
  rollup `mergePeriods`); dues installments give expected-by-month; actuals per Phase 1.
- **B. A fourth View ("Cash flow" / "Income")** — its own months table, leaving the treasurer's
  spreadsheet untouched.
- **C. Strip-only+** — the Phase 1 strip gains an expandable breakdown (in-rows per source),
  grid rows unchanged.
Weigh: the mental-model principle (memory/design_decisions.md 2026-08-21 — what makes sense in a
coach's head, not click count) · "never a tab row where a filter would do" · the grid already
overflows horizontally on phones (phone tables are a SEPARATE sequenced session — do not solve
phones here, but do not worsen them).

State the costs in the artifact (the spec artifact `783efa1e` shows the house style: options
drawn, trade-offs priced, rulings stamped in place). Then WAIT for rulings; the build that
follows is its own gated phase with the standard per-phase checks.

## 3 · Traps (each verified in code today)

1. **One arithmetic.** Never sum in the browser what a route already sums; never invent a second
   month-bucketing beside the register's. Derive + guard is the licensed pattern.
2. **Sponsor dates are recording dates** — sponsors have no received-date column; the register
   dates them by `created_at` and says so. Match it; widening sponsor dating is an owner question,
   not a build call.
3. **`received_date` is NULL on legacy drive rows and on rows from the drive's own Log-amount
   door** (it doesn't ask until money-centralization P2). Fall back to `created_at`-day, as the
   register does.
4. **BvA already loads almost everything Phase 1 needs** (dues payments, money-in records,
   realised entries, club splits+requests) — dues PAYOUTS are the one missing read
   (`getRepDuesPayoutsByProgramYear`). Don't add per-open fan-outs.
5. **The money-centralization program owns the same surfaces.** Its P3 (tags counted pill +
   filtered total) touches the BvA toolbar and the two stale BvA tag-filter comments; its P2
   re-points the drive door (which then asks the date). Read that plan's phase state before
   editing shared panel chrome; coordinate release notes.
6. **Migration numbering:** 262 is next (261 = drive received_date, dev-applied 2026-08-23).
   Schema change ⇒ DATA_DICTIONARY + `refresh:snapshots` same unit of work; Phase 1 as scoped
   needs NO migration.
7. **The grid and Statement share one grouping on purpose** (route ~672-679). Whatever Phase 2
   draws must not let Months group income differently than Statement's Revenue band groups it.
8. `check:layout` renders the BvA page — run it on the changed screen; but the strip's numbers
   need the QA walk, not the sweep.
