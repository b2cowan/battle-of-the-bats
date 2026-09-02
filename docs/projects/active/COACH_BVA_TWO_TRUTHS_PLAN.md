# Budget vs Actual — Two Truths: the Season-spending reading, the Cash rename, and the report polish

**Status:** BUILT 2026-09-02 — all five phases committed to dev (P4 `afc702f1` · P2 `a73279d7` ·
P1 `17d549ce` · P3 `34b10f03` · P5 `ec03487e`); gate answers G1 approved / G2 Variant 1 / G3
approved; `check:money-report` extended and green on the live fixture; **Owner QA §132 OWED**
(walk artifact `d88950ba-9f51-4b6a-b4b5-59789325a5f8`). Archive the pair when §132 passes.
**Decided from:** the BvA deep-dive review (25-agent analysis, 10 findings confirmed against code)
and its mockup artifact — `claude.ai/code/artifact/b9951b82-f0a9-4d7b-b1c5-06386f759bff`
(**the mockup of record for this plan**; §8 names the deltas that still need a mini-mockup pass).
**PM brief:** `COACH_BVA_TWO_TRUTHS_PM_BRIEF.md`.
**Migrations:** none expected — every figure this plan shows is already computed server-side.

---

## §0 Owner decisions (2026-09-02, from the deep-dive artifact's decision sheet)

| # | Decision | Ruling |
|---|----------|--------|
| D1 | Fronted-fee fix | **Option A — a fifth "Showing" reading: Season spending.** Owner also asked: rename "Actual" → "Cash"? → §1/Q1 |
| D2 | Chart placement | **Collapsed shelf below the table.** Plus: fix the clipped last x-axis label (visible on prod screenshots today) |
| D3 | Dues on the Statement | **Yes — its own mockup session.** DELIBERATELY NOT IN THIS PLAN's build scope (§7) |
| D4 | Forward stat | **Yes.** Owner asked: include committed revenue (dues, sponsorships)? → §6/Q2 |
| D5 | Quick-fix bundle | **All eleven approved** (§5) |
| D6 | Export additions | **All three approved** (§4) |
| Q3 | Difference basis | **RULED 2026-09-02: Difference compares plan against SPENDING** (owner: "that difference makes more sense") |

**Build prompt:** `COACH_BVA_TWO_TRUTHS_BUILD_PROMPT.md` (same folder) — the mockup gate is its item ONE,
and the gate mockups were pre-built onto the artifact's §7 on 2026-09-02, awaiting owner approval.

**Standing constraint honored throughout (owner ruling 2026-09-02, same day, re-verified structurally):**
a payout can NEVER be routed by reason — a family's credit POOLS a fronted cost and a fundraising
share in unrecorded proportions. Every change here attaches to the **fronting** side, where
category/item/date/payer are all known. Do not re-propose payout routing.

---

## §1 The vocabulary — two bases, honestly named

The report runs two deliberate bases and today labels neither: *what the season SPENT* (Statement,
chart, Headroom) vs *what the CASH did* (Months · Actual). The deep dive confirmed the owner's
flagship complaint is exactly the gap between them, surfaced only in collapsed footnotes.

After this plan, the Months "Showing" menu reads:

| Reading | Basis | Bands shown |
|---------|-------|-------------|
| Budget | the plan | Revenue + Expenses |
| Scheduled | still to come / still owed | Revenue + Expenses |
| **Cash** (renamed from Actual — Q1) | money that moved | Revenue + Expenses (vendors) + Money returned to families + Opening/Net/Closing |
| **Season spending** (NEW) | what the season spent, whoever paid | Expenses only — the Statement's expense half by month |
| Difference | plan vs reality | Expenses — plan vs SPENDING (Q3, ruled) |

- **Q1 — the rename (owner-raised, RECOMMENDED YES):** with two actual-flavored readings on one
  menu, "Actual" stops naming anything. "Cash" is the word the lens's own note already leads with
  ("Actual is cash"). The **Statement's column keeps "Actual"** — that view has one basis and the
  word is unambiguous there. Stored per-device lens preferences must keep resolving the old
  `actual` value (same pattern as `readStoredView`'s `categories` → `statement`).
- **Q2 — forecast composition** → §6.
- **Q3 — RULED (owner, 2026-09-02): Difference compares plan against SPENDING.** It then ties to
  Headroom and the Statement's variance column exactly, and the HeadroomBridge tie-out RETIRES on
  the Difference lens (it stays on Cash). The Difference basis note is rewritten to say so. A
  per-month plan-vs-cash comparison, if ever wanted, is a new ask — not this lens.

## §2 P1 — the Season-spending reading (D1)

**What the coach sees:** Months view, Showing → Season spending. Expense categories by month, a
cost counted the day it was incurred **whoever paid it**; a family-paid cost sits in its category
and month with a quiet "paid by a family" tag on its item row; money back nets into the row it
repaid (bracketed negative cells); no revenue band, no balance rows, no returned band (a cheque to
a family is settlement, not spending). **Total spent = the Headroom banner's "spent", to the cent**
— the first time the monthly table and the banner agree on one screen.

Build notes (the approved mockup is authoritative for layout):
- The route already flattens the statement's movements ONCE (`actualMovements`, step 7 — the list
  the chart sums). The spending grid is a third `buildMonthGrid` call over that list, on the same
  shared month domain as the other bands. **Do not derive a second walk** — the whole point of the
  one-arithmetic consolidation is that a new reader sums the existing list.
- Family-paid pieces already carry category/item/date through `paidMovements`; the "paid by a
  family" tag needs the per-payment `familyPaidDirect` fact carried onto the movement (it exists in
  the cash strip's read; the statement's movement list currently drops it).
- Drill-ins: spending cells open the same read-only panel idiom, fed by a `spending|…` cellDetails
  keyspace (records = the statement's costs + refunds, which carry ids/descriptions/dates).
- Lens notes under the grid: a Season-spending basis note ("…a cost counts the day it was
  incurred, whoever paid it; cheques you write back to families aren't spending — see Cash"), and
  the Cash note keeps its existing text under its new name.
- The HeadroomBridge does NOT render on Season spending (nothing to reconcile — it ties exactly).
- Export: the month-grid export gains the lens (`budget-by-month-spending`), same shared helpers,
  same "PDF = whole-season statement" rule.
- Guards: extend `check:money-report` with the new claim — spending grid grand total ==
  `totalActual` == the statement's expense total. The existing bridge claims stay.
- Rename ripple (Q1, same unit of work): `MONEY_LENSES` labels, lens notes, export titles/dataset
  names, help articles + their search keywords, **and the coach-demo money narration** — CLAUDE.md
  flags that narration as stale three releases running; this change re-reads ALL of it (dock lines
  + tour steps) as part of P1, not as a follow-up.

## §3 P2 — the chart moves below the table (D2)

- The cumulative chart leaves its position above the table on Statement/By-activity and becomes a
  **collapsed shelf below the table** (the page's existing `<details>` idiom), summary line
  "Spending trend — cumulative actual vs plan"; open state remembered per device alongside the
  view/lens preference. The undated-budget footnote moves inside the shelf.
- **The clipped last x-axis label** (owner-spotted; visible in today's screenshots as "Sep '2"):
  the final month label is centered on a data point ~22px from the SVG's right edge, so it
  half-escapes the viewBox and clips at the container. Fix: anchor the final label `end` (and the
  first `start`), or widen the right margin. Applies to however the chart renders post-move.
- Phone: inside a shelf the chart still needs a floor — if rendered under 480px wide, drop to
  fewer gridline labels and larger font, or state "open on a larger screen". Decide at the mockup
  pass; do not ship 9px SVG text at 375px.

## §4 P3 — export additions (D6, all approved)

1. **The reconciliation travels with the file.** Whenever the CashBridge would render on screen
   (nonzero gap), the Statement export (all three formats) appends the same walk as a final
   section — starting figure, adjustments (family-paid costs itemized WITH dates — see §5.2),
   closing figure. Reads `cashAdjustments`, never re-derives.
2. **"Of which never budgeted" reaches the screen** (see §5.6) — the file already carries it; after
   §5.6 the two agree by construction.
3. **A board-ready PDF opening block:** team, season, the headroom sentence, funded-by-players —
   the values the screen already computes, no new arithmetic.

## §5 P4 — the eleven quick fixes (D5, all approved)

1. **Variance key** — one quiet line under the Statement/By-activity table: revenue reads +/−,
   costs read under/over; good news is always green. (One column currently speaks three dialects.)
2. **Dates on the family-paid list** — both bridges itemize family-paid costs; each line gains its
   month. (The payload's `familyPaidCosts` needs the date carried — it exists on the excluded
   payment.)
3. **Promote the Statement reconciliation** — from a collapsed question to a visible one-line
   sentence + "see the walk-through" link that opens the existing details.
4. **"Refund only" instead of a dash** — the cost-row variance guard (negative actual) prints
   "refund only" (muted) instead of a bare em-dash, so an odd refund is named, not hidden.
5. **Visible "not planned" word on unplanned rows** — reverses the 2026-08-15 label trim,
   deliberately: the sr-only sentence stays, a quiet visible word joins it. (Owner approved via D5;
   log the reversal in `memory/design_decisions.md` when built.)
6. **Off-plan total on the banner** — "$X spent off-plan" joins the result strip when nonzero
   (`data.unbudgeted`, currently computed + exported but never rendered).
7. **View sublabel** — one line under the toolbar that changes with the View choice: Statement
   "season vs plan, by category" / By activity "did each activity pay for itself?" / Months
   "month by month". Prose, not chips.
8. **Chart flatline marker** — a small "rest of plan has no date" annotation where the budgeted
   line goes flat (rides with §3's shelf move).
9. **"Total cash out" row** — Months · Cash: one row under the returned band stating vendors +
   families = cash out (the sum `buildBandCashFlow` already takes internally).
10. **Opening-balance provenance** — a note beside the balance rows: "opens from $X — carried from
    {season}" / "not set — assumed $0", pointing a wrong bank tie-out at its likeliest cause.
11. **Rename "Not itemized yet"** → "Estimate not yet broken out" (near-collision with
    "Not itemized", a different concept). Screen + export + help in one pass; spelling-gate clean.

## §6 P5 — the forward stat (D4)

Owner ruled YES and asked whether committed **revenue** should be included (committed dues,
committed sponsorships) for accuracy.

**Q2 — RECOMMENDED SHAPE (two-sided, pledges never silently banked):**
- **Committed player dues: YES** — an unpaid installment is a real obligation with a due date; the
  Scheduled reading already quotes exactly the remainder.
- **Sponsor pledges + pending club asks: NOT in the headline figure.** A standing product rule
  says a pledge is "Possible", never banked (its drill-in panel deliberately refuses the word
  "Total"). They appear as a separate labeled clause, e.g. "+$Y possible".
- The projection already exists as the **Scheduled reading's season-ending balance** — the stat
  must read from that same machinery (`buildBandCashFlow` over Scheduled), never a second
  derivation, so the banner and Months·Scheduled cannot disagree.
- Presentation: one added banner element, e.g. **"On what's scheduled you end the season with
  $X"** (+ "$Y possible" when pledges/asks exist), deep-linking to Months · Scheduled. Exact
  wording at the mockup gate; the banner is one row and must stay one row on desktop.

## §7 Explicitly out of scope

- **D3 — Player dues on the Statement:** its own owner mockup session (it changes what Season net
  and Funded-by-players mean). Schedule after P1 ships; nothing in this plan blocks on it.
- Per-family season statement (belongs on Player Dues), season settlement shelf (season-close
  plan owns it), tag filtering on this report (removed 2026-08-21, stays out), payout routing by
  reason (settled, impossible).

## §8 Build order, mockup gate, QA

**Order:** P4 quick fixes (small, independently shippable) → P2 chart shelf → P1 Season spending +
Cash rename (the heart; includes help + demo narration) → P3 exports → P5 forward stat.
P1 and P5 each get their own commit; P4 may batch.

**Mockup gate — item ONE of the build session** (standing rule): the deep-dive artifact is the
approved mockup of record; before code, a mini-mockup pass (same artifact, updated) must show
whole-screen before/after for the three things the artifact does not yet render precisely:
(a) the Showing menu + lens notes after the Cash rename, (b) the forward-stat wording on the
banner, (c) the chart shelf collapsed AND open below the table. Q1 (final look) and Q2 (wording)
get owner confirmation at that gate; Q3 is ruled (spending basis) and is shown, not re-asked.
**Status: these three gate mockups were built onto the artifact's §7 on 2026-09-02** — the build
session's first act is reading the owner's answers to G1–G3 there (or collecting them).

**QA:** one Owner QA walk at the next free § number (checkable artifact, sign-in card with the UAT
coach account, per the standing walkthrough format), covering: the five-reading menu; the fronted
$240 flow end to end on Cash AND Season spending; totals tie-out (spending total == headroom, to
the cent, on screen and in every export format); the eleven quick fixes; the chart shelf on
desktop + phone; the three export additions opened and read.

**Verification:** `check:money-report` extended (spending-grid claim); unit tests for the new lens
helpers and the label resolver (old stored `actual` value); `verify:changed`; demo narration
re-read recorded in the walk. A layout reseed is owed by the fundraiser-band work already — this
plan's sweeps ride after it.
