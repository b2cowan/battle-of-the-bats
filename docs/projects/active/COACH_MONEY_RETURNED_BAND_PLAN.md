# Money returned to families — its own band, and the tie-out to Headroom

**Status:** BUILT ON DEV 2026-09-02, uncommitted pending owner word. Owner-ruled 2026-09-02;
all four open questions answered as recommended (Q1 "Money returned to families", Q2 caption in the
Actual footnote, Q3 no band on Difference, Q4 no band on the Statement).
**PM brief:** `docs/projects/active/COACH_MONEY_RETURNED_BAND_PM_BRIEF.md`
**Mockup (owner-approved):** `https://claude.ai/code/artifact/cc79b9c1-3871-402b-9aea-fcc3ea50a443`
**Surface:** Coaches → Money → Budget vs. actual → **Months** view.

---

## 1. The ruling

**"Paid back to families" leaves the Expenses band.** It is not a true expense and it never was:
money handed back to a family is either revenue going back out (an overpaid instalment, a
fundraising share, a season-end surplus) or cash settling a cost that was already counted as
spending on the day it was incurred.

It becomes a **third band** with its own subtotal, sitting below Expenses, outside `Total expenses`
and still subtracted by the running balance.

### 1.1 Why not route each payout by what it settles (the rejected option)

The mockup drew a third option — dues refunds netting against Revenue, reimbursement payouts filing
as spending in the original cost's own category. **The owner killed it on a better argument than the
one in the mockup**, and it is recorded here so nobody rebuilds it:

> A payout draws down a family's **pooled credit balance**. A parent can buy a bucket of balls and
> sell at the bottle drive and be issued **one credit for both**; a later cheque against it is
> part-reimbursement and part-fundraising-share in proportions nobody recorded and nobody can
> recover. Routing it means inventing an attribution that does not exist.

The mockup's stated blocker ("the recording form does not ask why") was the weaker reason — it
implied the option becomes available if the form starts asking. It does not. **Do not propose
routing payouts by reason again**, and do not propose asking the coach to split a credit at payout
time to enable it: the credit is issued long before the cheque and the coach has no basis to split
it either.

### 1.2 The owner's accounting position, which this plan implements

> *"I want the bucket of balls to be in expenses when it was paid for because it was a true expense
> at that time, regardless of who paid. Cash didn't move so it won't reconcile to cash, which is
> fine."*

Both halves are already true in the product and stay true:

| | Fronted cost (the balls) | The cheque repaying it |
|---|---|---|
| **Statement view / Headroom** | counted as spending the day it was incurred | not counted at all |
| **Months view (cash)** | not counted — the team's cash never moved | counted, **in the new band** |
| **Cash on hand** | not counted | reduces it |

Nothing is double-counted in any of the three, before or after this change.

### 1.3 What Total expenses means afterwards, and why it is better

Today the payout sits inside `Total expenses` where it *loosely* stands in for the fronted cost the
cash view holds out. **Because a credit pools sources, it never actually does** — the figure is a
mixture of a reimbursement and a fundraising share. After this change:

> **Months → Total expenses = cash the team paid vendors.**

The fronted cost is in neither the band nor its stand-in, which is correct: the team never paid a
vendor for it. This is a change in what the band *means*, so it needs a caption (Q2 below) or a
treasurer will ask where the balls went.

---

## 2. What the coach sees

On **Months → Showing Actual**, using the owner's own season:

```
Revenue
  Player dues                 …            2,700
  Fundraising                 …            1,200
  Money back & reimbursements …              325
  Total revenue                            4,225

Expenses
  Facilities                  …            1,300
  Team Gear                   …              950
  Tournaments                 …              750
  No category                 …              750
  Total expenses                           3,750   <- was 3,945

Money returned to families                          <- NEW BAND (name: Q1)
  Dues credits paid out       …              195
  Total returned                             195

  Opening balance / Closing balance          280   <- UNCHANGED
```

The closing balance does not move. Neither does any figure on the Statement view, the Overview card,
Player Dues, the register, or Headroom. **This is a filing change, not an arithmetic one** — and
that is the property every check in §6 exists to hold.

---

## 3. Phase 1 — the third band

### 3.1 The payload

`GET /api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual` emits `monthGrid` (expenses) and
`revenueGrid` today. Add a third, built by the **same** `buildMonthGrid` over the **same** month
domain (`gridMonths`), from the payout rows the route already assembles:

- The `payoutRows` map and the payout half of `cashStrip.expenses` move out of the `monthGrid`
  call's `lines`/`actuals` and into the new grid's.
- The post-build sort in the route that pins payouts to the foot of the expenses band **is deleted**
  — the band is the ordering now. Its comment explains why the pin was needed; the comment goes with
  it.
- ⚠ The month domain must stay shared. `deriveMonthRange` already runs once over every band's dates
  including `cashStrip.dates`; the third grid takes `months: gridMonths` like its siblings. A band
  built over its own range would put April's payouts in May's column and every claim in §6 would
  still pass.

`isPayoutCategory` survives as the filter deciding which rows go to which grid, and then has no other
reader. Check that when P1 lands: if it has one call site left, inline it.

### 3.2 The band renders on **Actual only**

This is a real defect fix riding along, not a preference. The payout group has no plan and never can.
Under the **Difference** lens today it renders as `0 − 195 = −195` in red — "over budget by $195"
against a budget that does not exist. It is visible in the owner's own first screenshot.

- **Budget / Scheduled:** already hidden (`isPayoutCategory` is the one expense row allowed to
  disappear — see its note in `lib/coach-budget-months.ts`). Unchanged.
- **Difference:** now hidden too. `Total expenses` on that lens becomes `5,100 − 3,750 = 1,350`.
- **Actual:** the band shows.

### 3.3 The running balance — the one thing that must not break

`buildBandCashFlow(revenue, expenses, lens, cashOnHand, openingBalance)` feeds both the screen and
the export, which is exactly why it is shared. It must subtract the returned band as well:

- Extend it to take the third grid (or a list of out-bands). **Do not** add the subtraction at either
  call site — two call sites for one rule is the failure `/simplify` consolidated this function to
  remove in the first place.
- The undated bucket travels with it (`totals.undated`). A payout is always dated, so this is
  belt-and-braces, not a live case.

### 3.4 Labels

`bandTotalLabel(band, lens)` composes `{Budgeted|Scheduled|Total} {revenue|expenses}`. The returned
band's total is **not** a third composition of that pattern — it renders on one lens only, so it
takes a fixed label ("Total returned"). Adding a third `MoneyRowDirection` to satisfy the helper
would leak a band that only exists on Actual into every lens's type.

### 3.5 The drill-in

The band's rows are families (D-2, owner call 2026-08-24) and open by family with the reason on each
payment's line. **Unchanged** — `cellPanelSpec` / `panelRowWords` already special-case the payout
group via `row.payout`, and the panel doors (Dues, Transactions) stay.

### 3.6 The export

`buildMonthsExport` in the BvA panel writes the same two bands the screen shows, via
`band(grid, dir, categories)`. It gains the third band under the same rule as the screen — **Actual
only** — and the closing rows read the extended `buildBandCashFlow`. A file that lists a band the
screen did not show is the drift `categoryHasFigure` was consolidated to prevent.

### 3.7 The guard

`scripts/check-money-report-arithmetic.mjs` reads payouts out of `grid.categories` filtered on
`cash:payouts` for its statement-to-cash bridge claim. Point it at the new band. **The identity is
unchanged** — `statement + moneyBackNetted − familyPaid + payoutsOut = cash out` — which is the proof
this whole change is presentational.

Its fixture-shape assertion currently requires "a dues payout (cash back to a family — **its own
group in the EXPENSES band**)". Reword to the new band. ⚠ Per the standing lesson, the fixture
*shape* is coverage: the fixture must still carry a payout, a family-fronted cost **and** money back,
or the bridge claim passes by blindness.

---

## 4. Phase 2 — the tie-out under the table

A collapsed reconciliation under the Months grid, the mirror of the Statement's `CashBridge`:

```
Headroom says +1,555 under budget — why the difference?
    Total expenses, plan against reality        +1,350
    Plus money back, counted here as arriving     +325
    Less costs a family paid the vendor           −120
    Headroom                                    +1,555
```

- **Two lines, not three.** With payouts outside `Total expenses`, the payout adjustment leaves the
  bridge. Both survivors are genuine differences in basis: money back nets against a cost on the
  statement and arrives as cash here, and a fronted cost is spending that was never team cash.
- **Shown on Actual and Difference; hidden on Budget and Scheduled** (nothing to reconcile).
- **It computes nothing new.** `headroom`, `effectiveBudget`, `totalActual`, `familyPaidCosts` and
  the per-item `refundTotal` are all already in the payload, which is what stops it disagreeing with
  the table above it.
- **It renders only when there is a gap** — the same rule as the Statement's bridge. A bridge saying
  "no difference" is furniture.
- ⚠⚠ **Extract the adjustment list, do not write it twice.** The Statement's bridge walks
  spend → cash; this walks plan-vs-cash → plan-vs-spend. Same three adjustments, opposite direction.
  Two hand-written copies is precisely how the screen and the file ended up with two different
  formulas for `hasUndated`. One source, two presentations.

---

## 5. Phase 3 — help and the demo

**Help** (`lib/help-content/coaches.tsx`) — two definitions name the row inside Expenses and both
become wrong:

- *"Expenses — Your budget categories exactly as you set them up, plus **Paid back to families**…"*
- *"**Paid back to families** — Opens by family, mirroring dues…"* (still true; its placement claim
  is not)

**Demo.** Per `CLAUDE.md`, the coach sandbox's money narration has gone stale across three
consecutive releases and is the standing example of the drift rule. This change alters the money
vocabulary a coach reads on the most-read money screen. **Re-read the coach-money dock lines and tour
steps in this unit of work**, not afterwards — and ask the second question too: *should a demo moment
show the new band?*

---

## 6. Verification

**The property to prove is that nothing moved.** Before and after, on the same fixture:

1. `Total revenue`, closing balance, cash on hand, Headroom, `Total actual`, and every Statement
   figure are **byte-identical**.
2. `Total expenses` on Months falls by exactly the payouts total, on Actual and on Difference.
3. `npm run check:money-report` passes with its bridge claim reading the new band, on a fixture
   carrying a payout **and** a family-fronted cost **and** money back.
4. `npm test` and `npm run verify:changed` (carries `check:spelling`, `check:demos`,
   `check:css-selectors`, `check:root`).
5. Export the Months file on all four lenses; the returned band appears on Actual only and the
   closing rows match the screen.
6. `npm run check:layout --only` on the BvA screen, **after a reseed**. ⚠ The baseline keys on label
   text, so a new band heading and a changed `Total expenses` figure will both re-key — expect
   findings and read them rather than accepting them.
7. Phone (≤640) and the 641–768 tablet band: the third band heading must not push the pinned Total
   column off, and the band's own row stays a real touch target.

No migration. No schema change. No dictionary change.

---

## 7. Open questions for the owner — ALL ANSWERED 2026-09-02 (as recommended)

**Q1 — the band's name.** Options: **"Money returned to families"** (recommended — says what it is
without the word "paid", which reads as spending), "Paid back to families" (keeps today's wording, so
nothing to relearn, but keeps the word that caused the confusion), "Money returned".
⚠ Whatever is chosen must be spelled identically on the screen, the export, the drill-in panel title,
the help definitions and the demo narration — `check:spelling` does not enforce a phrase.

**Q2 — does the Expenses band get a caption?** After this change `Total expenses` counts *cash the
team paid vendors*, which excludes a cost a family fronted and has not been repaid. Recommended: one
line in the existing footnote block under the table, not a second sentence per band.

**Q3 — does the returned band show on the Difference lens?** Recommended **no** (§3.2): a group with
no plan cannot be over or under one, and today it prints a red "−195" that means nothing.

**Q4 — does the Statement view gain the band too?** Recommended **no**: a payout is not season
spending, so it has no place on a statement of what the season spent. It stays named in that view's
cash bridge, which is where it belongs.

---

## 8. Adjacent, deliberately NOT in this plan

Both were found alongside this work and neither is decided:

- **The Difference lens's TOTAL column counts months that have not happened.** Player dues shows
  −2,100 across its months and totals −3,700; the extra −1,600 is a dues instalment nobody owes yet,
  and the footnote under the table promises the opposite. Independent of this plan and smaller than
  it.
- **The "No date yet" column reads the wrong way round on the revenue band.** Undated plan money
  shows as good news on both bands — right for spending not yet done, backwards for income not yet
  collected. Latent: no revenue group on the owner's season carries undated plan money today.

---

## 9. Build record — 2026-09-02

Built on dev, uncommitted pending the owner's word. **No migration, no schema change.**

**What landed beyond the plan as written:**

1. **The group inside the band was renamed** `Paid back to families` → **`Dues credits paid out`**.
   With a band heading that says *Money returned to families*, the old name made the table state one
   thing twice. The new wording is the ledger entry's own (`Dues credit paid out — {family}`), so the
   report and the books now use one phrase. ⚠ The dues **settlement sheet** still has its own
   "Paid back to families" line in the pot breakdown — a different screen and a different sentence,
   left deliberately. Revisit only if the two ever appear together.
2. **A tap-floor defect was fixed on the bridge summary.** `check:layout` measured it at 28px against
   the 44px floor at ≤768. It had gone unflagged because the baseline keys on label text and this
   summary quotes a dollar figure, so it re-keys whenever the season's money moves. The second bridge
   is what surfaced it — the fix is on the shared class, so both get it.
3. **The guard fails loudly on an absent band** rather than treating it as an empty one — the
   `openingBalance` lesson (claim 6) applied before it could be learned twice.

**Verified:**

- `npm test` — 2,780 pass, 0 fail (two new cases assert the returned band is still subtracted from the
  month, the net and the ending balance, and that an empty band is a no-op).
- `npm run check:money-report` — every identity holds on the UAT fixture, which carries a payout, a
  family-fronted cost and money back. Bridge: `$3,755 spent → $3,400 in cash`.
- **The three bridges executed against the live payload**, not reasoned about:
  - Actual: `2,800 − 125 + 1,080 = 3,755` = `totalActual` ✓
  - Difference: `8,100 + 125 − 1,080 = 7,145` = `headroom` ✓
  - Statement: `3,755 + 125 − 1,080 + 600 = 3,400` = cash out ✓
- **Rendered and read back in a browser** at 1600px: the band appears on Actual (`Dues credits paid
  out 600` / `Total returned 600`), is absent on Budget and Difference, `Total expenses` reads 2,800,
  and the closing balance is unchanged at 3,286 — the register's own cash on hand. Both tie-outs open
  and close exactly, with the family-fronted costs itemised.
- `check:spelling`, `check:css-module-purity`, `check:css-selectors`, `check:root`, `check:demos`
  (2 presentable) — all pass. Typecheck clean; lint 0 errors.
- `check:layout --only=coach-budget-vs-actual` — no new findings from this work.

**Demo narration:** checked, nothing to change. No dock line or tour step mentions the payout row, the
Expenses band's contents or `Total expenses`, so no demo sentence was made false by this. Nor does the
band warrant a moment of its own — it is a filing correction, not a capability.

**Not mine, still open:** `check:layout` reports `button·Record money` at 31px against the 44px floor
at 768. It comes from another session's in-flight rework of the shared coach stylesheet (~710 changed
lines) and the Money rail, both uncommitted in the working tree. Left alone.

---

## 10. Review record — `/review`, 2026-09-02 (high-risk tier, four lenses)

Deterministic gate green first (`verify:changed`, typecheck, lint, `check:money-report`,
`check:layout --only`). Four Sonnet lenses: correctness, blast-radius, verification-integrity,
UI/copy. **Seven findings survived; all seven fixed.** One Critical claim was refuted.

### Fixed

1. **CRITICAL — the returned band's drill-in lost every family name.** The panel's subject lookup
   resolved any non-revenue category against the EXPENSES band, so once payouts moved out it found
   nothing. ⚠ It could not fail loudly: a payout event deliberately carries `description: ''`
   *because* the name is expected to come from that lookup, so an empty map reads as "these records
   have nothing to say for themselves". The panel still opened, still totalled correctly, and simply
   stopped saying who the money went to. **Reproduced in a browser before fixing and after**
   (`Sep 1 · E-Transfer · $300.00` → `Casey Test · Sep 1 · E-Transfer · $300.00`).
2. **HIGH — the Actual-lens footnote asserted a cause that this change deleted.** It read *"this view
   adds money paid back to families"*. It no longer does. A note explaining a gap by naming an
   adjustment that is not there is worse than no note: a treasurer reconciling by hand goes looking
   for it. Rewritten to two causes plus a pointer to the band. (Missed by the copy lens; found in the
   main loop by grepping the old phrase.)
3. **HIGH — a third spelling of the renamed thing** on the Statement's cash bridge ("Plus money paid
   back to families"), i.e. on the drill-down a coach opens *because* they are confused about it.
4. **MEDIUM — a fourth spelling** on the dues **settlement sheet**. ⚠ Out of the declared scope and
   fixed anyway: the divergence did not pre-exist, this change created it, and the two screens are
   read together when closing a season. Renamed to match; "paid" was the word that read as spending
   in the first place.
5. **MEDIUM — the help article said the band sits "under Expenses"**, which reads equally as *inside*
   — the exact misreading the whole ruling exists to remove.
6. **MEDIUM — the guard's new band check tested only for an absent key.** A route emitting `{}` would
   have cleared it and then resolved to silent zeros at every optional-chained read. Now tests for a
   usable band. (`null` already throws on the direct `.totals` read.)
7. **LOW — a dead `delta` field with a persuasive, false docstring** ("the gap both bridges cross" —
   it is not; the Months tie-out excludes payouts). Deleted rather than reworded: an inert field whose
   own helper header argues for consolidation is an invitation to a wrong DRY-up.
   Plus the guard's success line printed the expenses band alone while asserting on both.

### Refuted

**"Claim 6b is now algebraically blind to the returned band" — Critical, refuted.** True that
`payoutsOut` cancels from both sides. **But it cancelled identically before this change**: the old
code read the payouts group out of `grid.categories`, i.e. out of the very total it was comparing
against. Verified against `git show HEAD`. The lens's supporting premise — that the pre-change figure
came from an independent statement pipeline — is simply wrong. What *does* constrain that figure is
claims 3 and 4 against the REGISTER, assembled by `lib/coach-register-book.ts`, which does not import
the cash strip — a genuinely separate derivation, still holding. The scope limit is now written into
the claim so no future reader over-reads it.

### Coverage proven, not asserted

The two balance tests were **mutation-tested**: deleting the monthly subtraction fails
`subtracts it from the month…`; deleting the undated subtraction fails the new undated case. A third
test was added because the original pair could not reach the undated term while its docstring implied
it did.

### Left alone, deliberately

- `lib/coach-cash-strip.ts` still justifies emitting payouts last "because they belong at the FOOT of
  the expense band" — now stale, and harmless (the split is by kind, not order). **The file is
  modified by another session**; editing it would risk a staging race. Owed as a comment trim.
- `check:layout` still reports `button·Record money` at 31px. Another session's in-flight rework of
  the shared coach stylesheet.

---

## 11. Addendum — a month still ahead has no Actual balance (owner ruling 2026-09-02)

Owner-raised from the built screen: *"do we need an opening and closing balance on the months after
this month on the actual report if we aren't allowed to future date actual funds?"*

**Premise verified before answering, and it holds product-wide** — not just on dues. Recording money
is refused with a future date on every door ("Record is for money that has already moved"); anything
not yet paid is a bill and belongs to the Scheduled lens. So on Actual, **no month after the current
one can ever hold a figure.**

### Why it is a defect and not clutter

1. It repeated one unchangeable number across every remaining column.
2. ⚠⚠ **A flat balance to the end of the season READS AS A FORECAST.** "$3,286 in December" looks
   like where the team lands; it only means "nothing more has been recorded". It knows nothing about
   the bills between here and there — which is the question **Scheduled** exists to answer. One lens
   quietly impersonating another is worse than noise.
3. **The block already contradicted itself**, which is what made it visible: `Net for the month`
   goes to an em dash in those months (a net of nothing is zero) while the two balance rows kept
   printing. Same three-row block, same months, two answers.

### The rule

`balanceShowsMonth(lens, month, todayMonth)` — **one predicate, two readers** (screen + export), so
a downloaded file cannot show a forecast the table refuses to.

- **Actual:** blank from the month after the current one.
- **The current month keeps its figures** — money can still move today.
- **A past month with no activity keeps its figures** — it genuinely happened, and the team genuinely
  held that money through it. Elapsed, not empty, is the test.
- **Budget and Scheduled untouched.** Their future months carry real plan and real debt; a running
  balance across them is the entire point of those lenses.
- **The Total column is not a month** and keeps the season's ending balance. It is pinned, so where
  the season finished never leaves the screen — which is why nothing is lost by going quiet.
- **Difference** shows no balance rows at all; unaffected.

### Verified

- Three unit cases pin the predicate (future/current/past, and that Budget + Scheduled are exempt).
- **Rendered and read back**: on Actual the balances run to Sep and stop, Total still reads
  `500 → 3,286`; on Budget every future month keeps its projection.
- **Exported and read back**: the CSV blanks the same months and keeps the same season totals.
  (`Net for the month` still writes `0` rather than blank in the file — pre-existing spreadsheet
  convention for every empty month, past or future, and deliberately not changed here.)
- `npm test` 2,794 pass · typecheck clean · lint 0 errors · `check:spelling` · `check:money-report`
  · `check:layout --only` all green for this work.

**Folded into this unit of work** at the owner's word rather than split out: it moves the same three
rows on the same screen and rides the same QA walk (§131, check 08).
