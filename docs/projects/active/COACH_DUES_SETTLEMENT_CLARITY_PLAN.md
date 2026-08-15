# Coach Dues & Settlement — Clarity Pass

**Status:** in flight (started 2026-08-14)
**Owner review:** mockups approved — Claude artifact `a9175274-aefb-43f1-9782-c7290f672312`
**PM brief:** `COACH_DUES_SETTLEMENT_CLARITY_PM_BRIEF.md`

Owner-driven pass over the coach Player-dues screen and the season settlement sheet. Started as a
decluttering request ("there is a ton of text in this table") and turned up **two correctness
defects in the shipped product** along the way, which now lead the work.

---

## The two correctness defects (found during owner review, 2026-08-14)

### D1 — the settlement's Refund column does not follow from the columns beside it

The sheet prints `Owed back`, `Even share`, `Refund`. The refund is
`owedBack + cashShare − leftToSend − sharePaid`, and **`leftToSend` is on no column of the table.**
A family with a $347.14 share and $150 still owing shows a $197.14 refund with nothing on the row
to explain the $150. Across seven rows the column reads as arbitrary, which is exactly how the
owner read it.

**Fix:** restore `Still owes` as a real column, so every row reads across
`owed back + even share − still owes = refund`, and total EVERY column in the footer. No arithmetic
changes; one term stops being invisible.

The footer total of the Refund column is `cashHeld − holdBack` exactly (the invariant the sheet
already rests on, `lib/season-settlement.ts`). Making the columns visible makes that provable on
screen for the first time.

### D2 — the bulk payout is not gated on money existing

`Pay all` is enabled whenever `totals.payable > 0`. The sheet **already computes** the gap
(`awaitingCash = max(0, payable − cashAvailable)`) and prints a warning strip naming who the team is
waiting on — then leaves the button live and offers the full amount anyway. A warning beside an
enabled button that would overdraw the team is not a safeguard.

**Fix — and the owner ruled the scope wider than a cap** (2026-08-14): the settlement sheet becomes
a **season close-out**, not a payment console. See §3.

---

## Owner rulings carried into this work

| # | Ruling | Date |
|---|---|---|
| R1 | The dues grid does not show payment SOURCE. One tick = "nothing left to send", whether cash or fundraising covered it. Source lives in the player record. | 2026-08-14 |
| R2 | The dues footer carries no labels on desktop/tablet — the column headings already name the totals. | 2026-08-14 |
| R3 | Negative money renders in **brackets**, never a minus sign. Swept everywhere. | 2026-08-14 |
| R4 | The settlement is a **close-out**: it pays everyone, once, when nothing is left to come in. Early single-family payouts happen from the player's own record. Partial/allocated payouts are explicitly NOT a case to design for. | 2026-08-14 |
| R5 | Hold-back is shown **above** the total it is already inside. | 2026-08-14 |
| R6 *(assumed, stated to owner)* | "Ready to close" = no family still owes anything. Unspent budget plan and unattributable club money **warn but do not block**. ⚠ **Amended in build** — see §1.4: a second condition proved necessary. | 2026-08-14 |
| R7 *(assumed, stated to owner)* | Closing pays everyone; it does **NOT** lock the season's money to further edits. A lock is a separate decision. | 2026-08-14 |
| R8 | The settlement sheet **never says who shares a payment with whom**. It works out what each family is owed; it does not issue payments, so combining cheques is another screen's job. Two attempts (a family caption row, then a per-row "paid with X") were both removed. | 2026-08-14 |
| R9 | **No labels on a totals row** — every figure sits under the column heading that names it. Applies to the dues grid footer and the settlement footer. The settlement footer's lead cell shows the player count alone; no "Team". | 2026-08-14 |
| R10 | The settlement's density is **modal density, not page density** — matched to the summary card it sits beside, not to a full-page table. | 2026-08-14 |
| R11 | **Nothing is stated twice.** Applied repeatedly during review: the blocking figure left the subtitle once the checklist stated it; the "why it can't close" strip was deleted once the checklist covered it; the per-instalment footer totals went because the band above already carried them. | 2026-08-14 |

---

## Pass 1 — correctness

### 1.1 Brackets for negative money (R3)

`fmt()` in `lib/coach-money-summary.ts` is the single money formatter for the coach money hub
(12 consumers, all UI — the CSV/PDF exports do **not** use it, and two API routes use it only for
positive amounts in error strings). Change it centrally:

```
-$1,234.56   →   ($1,234.56)
```

⚠ **Known consequence, accepted:** brackets mean "negative in this column", and the *direction*
flips between two screens — a bracketed dues balance is a family **in credit** (green, good), a
bracketed settlement refund is a family who **owes the team** (red, bad). Colour and the column
heading separate them; both readings are standard. Noted rather than special-cased.

Also: relabel the settlement summary's `Owed to families (credits)` → `Credits owed to families`,
so the row does not print two sets of brackets side by side.

### 1.2 Hold-back above the total (R5, D-adjacent)

The summary currently prints `Surplus to share` and *then* `Hold back for next season`, but the
surplus already has the hold-back subtracted. As printed, `755 − 75 + 2,250 = 2,930` against a
stated total of `2,430` — a visible $500 hole. Move the hold-back line above the rule, render it as
a subtraction, keep the `Change` control on it.

### 1.3 The `Still owes` column (D1)

`SettlementSheetRow.leftToSend` is already on the payload — nothing new is derived. Add the column
to the table (desktop + the card-mode `data-label`), and total every column in the `tfoot`.

### 1.4 Close-out gating (D2, R4)

- `Pay all …` → **`Pay everyone and close the season`**, enabled only when
  `expectedIn <= 0.005` (no family still owes) **and** `awaitingCash <= 0.005` **and**
  `totals.payable > 0.005`.

  ⚠ **The `awaitingCash` condition is not redundant, and the first cut of this plan said it was.**
  The gate was written as `expectedIn` alone, reasoning that a season with nothing left to collect
  must have every refund positive, so payouts would equal cash on hand and an affordability check
  could never fire. That is false. `refund = owedBack + cashShare − leftToSend − sharePaid`, and
  `sharePaid` (money already handed over) is **not bounded by the family's eventual share** — a
  family paid out early, now the documented way to settle someone leaving mid-season, can owe
  value back at close-out. One negative row makes `payable` exceed the sum of all refunds, which
  is the cash on hand. Caught by the randomised test added in `tests/unit/season-settlement.test.ts`
  (`a season that is done collecting cannot overdraw the team`), which also pins a worked example
  of the state and asserts the gate is not vacuously closed.
- When not ready: the button is disabled, and **a checklist beside the money summary** states every
  condition at once — see §2.4. (An earlier build put this in a warning strip below the table; it
  said the same thing as the checklist and was deleted under R11.)
- The per-row `Pay out` button is **removed from the settlement sheet**. The per-row `Change`
  (even / set amount / no share) **stays** — it decides the split and belongs to closing out — but
  moves INTO the row's expanded breakdown (§2.5).
- The group "Pay X in one" button goes with the per-row payout, same reasoning. `settlementGroups`
  is reduced to rows + ordering: the family label, payable and playerIds it used to carry all
  existed for the caption and that button.
- Server-side: `POST …/season-surplus/payouts` gains the same gate, so the rule holds even if a
  stale client posts. ⚠ It must NOT gate the single-player payout path used by the player record.

  ⚠ **The first cut of this gate was bypassable, and `/review` found it.** It tested
  `playerIds == null` — the shape the "pay everyone" button sends. The route also accepts an
  explicit array of any length, each row paid what its own figure says, which is the same act in a
  different request body; the browser already holds every playerId, so the bypass was one
  hand-written fetch. It granted no capability a coach lacked (single payouts are legal all season
  and N of them reach the same place), so this was **not** a privilege escalation — but the code
  and this document both ASSERTED a protection that did not hold, which is the actual defect.
  Now gated on **how many families are paid**: one is the early-payout path, two or more is a
  close-out and must meet its conditions.

### 1.5 The close-out is the ONLY payout on this sheet — where the others went

| Was | Now |
|---|---|
| Per-row `Pay out` | The player's own money record (unchanged server path, legal all season) |
| Family `Pay X in one` | Gone; the close-out writes one payment per household |
| `Pay all` (ungated) | `Pay everyone and close the season`, gated + moved to the modal footer |

---

## Pass 2 — the declutter

### 2.1 The dues grid cell (R1)

Today: two lines per cell — amount + a caption sentence. 28 cells on a 7×4 roster.

Proposed: the instalment amount moves into the column heading (`Installment 1 · $200 · due May 15`);
the cell prints a figure **only when the family still owes something**:

| State | Cell |
|---|---|
| Nothing left to send | ✓ (green) |
| Part paid, not due yet | ◐ + amount still to send (amber) |
| Anything outstanding and past due | ⚠ + amount still to send (red) |
| Nothing paid, not due yet | · (muted) |

Per-player exceptions keep their own figure/date in-cell when they differ from the column's common
value — the same exception rule the dates already use (`ownDate`). A compact legend sits under the
grid. Colour never carries meaning alone; the glyph does.

⚠ The phone card list (`.duesCards`) is a different surface and keeps its fuller wording — a card
has room and no column heading to inherit from.

### 2.2 The dues footer (R2)

The per-instalment `Collected` cells are **deleted**, not restyled: the Collection-schedule band
directly above already states each instalment's collected/assessed with a meter and a plain-English
note. The footer keeps `Season` on the left and the two season totals, **unlabelled**, sitting under
`Due next` and `Balance`.

⚠ **Checked, and the phone concern does not apply to THIS table** (the plan assumed it did): the
By-installment matrix is `display: none` under 640 and the phone renders `.duesCards` instead, so
it never becomes the card stack that `.tableAsCards` has to re-caption. The labels can be stripped
outright. The **settlement** table below IS `.tableAsCards` and keeps its `.footLabel`s.

### 2.3 Settlement: accordion → modal (R4)

The full-width `refundOpen` accordion is replaced by a **one-line door** that never grows the page:

- Mid-season: `Season settlement · $X of dues still to come in · [Review settlement]`
- Ready:      `Season settlement · All dues are in — the season is ready to close · [Close out the season]`

The door's state rides the URL exactly as the accordion does today (`?settlement=open`), so a shared
link and the layout sweep still address it. Its wording is derived from figures the DUES PAGE
already holds, so opening the sheet is not required to label the line.

⚠ **THE MODAL IS STACKED, NOT SIDE BY SIDE — the approved mockup was wrong and this is arithmetic.**
Measured against the shipped columns: the summary needs ~320px before the hold-back label truncates,
the table ~590px for six columns without player names breaking over two lines. 320 + 590 + gap is
~930px inside an 840px content box, so side-by-side could only be delivered by clipping the Refund
column — which the first build did. The mockup's table was narrower than the real one. Stacking costs
a scroll INSIDE the modal, which was never the objection: the objection was the PAGE growing.

The modal uses the shared scrolling-modal recipe (`.modalScrollBody` + `.modalFlushFooter`) so the
header and footer pin and only the middle scrolls. The old drawer's three nested padded boxes and
`maxWidth: 460` summary — the reported "huge padding" and the dead space beside it — are gone.

### 2.4 The readiness checklist (new, fills the width beside the summary)

The modal opens saying "Not ready to close yet" and, before this existed, made a coach hunt for the
reason. A compact list beside the summary states every condition at once, from figures already
derived: dues collected · payouts covered by cash (both BLOCK), plus unspent budget plan and
unattributable club money (both WARN only, per R6). Marks carry the verdict, not colour — amber and
danger sit at ΔE ~1.0 for deutan vision on this palette, so a blocked item is also the only one set
in heavier ink. When ready the heading becomes "Ready to close" and the blockers become ticks.

### 2.5 Density and the row action (R10)

- The table drops from the shared page density (0.88rem / 0.7rem×1rem cells) to modal density
  (0.82rem / 0.4rem×0.7rem), matching the summary card beside it.
- **`Change` moved into the row's expanded breakdown**, and its column with it. It carries the
  portal's 44px tap floor, and a 44px control in every row set the ROW's height — eight families
  needed a scroll to show four. Inside the breakdown it sits BESIDE the arithmetic, not under it,
  so opening a family costs no extra row of height. Rows went ~59px → ~39px.

---

---

## The `.muted` trap — three separate visual defects, one cause

Worth recording because it cost three review rounds. `.muted` in `coaches.module.css` is **not** a
text colour: it is the empty-state helper and carries `padding: 2rem`. Used as an inline text class
it silently adds 32px on every side. It produced, on three different screens, what read as three
unrelated bugs:

1. the modal header's subtitle indented 32px with the X floating mid-block;
2. the sheet's caveat notes each wrapped in a box of air, leaving the column looking broken;
3. **"No share" appearing left-aligned in a right-aligned numeric column** — it was right-aligned
   the whole time, pushed 32px off the edge by its own padding.

`.mutedInline` is the colour-only class. Every inline use inside the settlement now points at it;
genuine empty states (`Loading…`, `No families are owed anything yet.`) correctly keep `.muted`.

## The rendered sweep earned its keep, and then needed a fix of its own

`npm run check:layout --only=coach-dues,coach-dues-settlement` caught two real defects the static
gates could not: the phone card's status line spilling 60px off a 361px screen, and the modal's X
close button at 28px under the 44px floor.

It also produced **122 findings of which ~110 were phantom**, because two of its rules treated an
open modal as chrome: `.modalOverlay` is `position: fixed; inset: 0`, so R6 read the whole inert
page beneath as "hidden behind chrome", and R4 read the scroll-locked body as a broken sticky
header. Both rules are now modal-aware — while an `aria-modal` dialog is open the dialog becomes the
scope, since the page behind it is inert by declaration. **122 → 0.** Without this, every future
screen registered with a modal open would have dumped the same phantoms.

## Verification

- `npm run typecheck` (shared modules: `coach-money-summary`, `season-settlement`)
- `npm test` — includes the new close-out invariant suite
- `npm run verify:changed`
- `npm run check:layout --only=coach-dues,coach-dues-settlement` at 361/390/768/1440
- ⚠ `npx next typegen` before typecheck (Next 16.3).
- ⚠ **Render it, don't just gate it.** Two rounds of "passes every gate" still shipped a visibly
  broken screen: the gates measure overflow and tap targets, not whether a layout reads well.
- ⚠ The layout sweep and repeated Playwright runs exhausted the dev server's compiler workers
  (500s on every coach route, "Jest worker … exceeding retry limit"). Stop the server → delete
  `.next` → restart, per `AGENTS.md`. Expected after heavy sweeping; not a code fault.
- Owner QA: new ledger section — see the PM brief.

## Portal-wide defects this pass SCOPED rather than fixed (`/simplify`, 2026-08-14)

Three shared-infrastructure problems were patched inside `.modalSettlement` only. Scoping was the
right call for the pass — retuning shared portal chrome as a side effect of a dues change is how
regressions get smuggled in — but each is a **standing defect every future screen re-discovers**,
so they are named here rather than left implicit.

| Defect | Scope of the real problem | Recommended depth |
|---|---|---|
| `.modalCloseBtn` renders 28px, under the 44px tap floor | 69 usages across 37 files — **every dialog in the portal** | Fix on the shared class; one change, whole portal |
| `.btnPrimary:disabled` is `opacity: 0.5` — a lime fill at half opacity reads as a highlighted, pressable button on the warm/light ground | Every disabled primary CTA in the warm portal | Retune the shared disabled state for the warm palette |
| `.muted` is an empty-state block (`padding: 2rem`) with a name that reads as a text colour | ~190 callers / 65 files; spot-checks find the same misuse elsewhere (e.g. the Expenses panel) | Rename to `.mutedEmptyState` so the trap cannot be reached by name association, then sweep callers onto `.mutedInline` |

The `.muted` trap alone produced three defects in this one pass (see below). A warning now sits at
its definition site as an interim guard.

⚠ **`.modalSettlement .table` density is NOT on this list** — it is correctly scoped. This is the
first dialog in the portal to carry a full page-density table, so there is no "modal table density"
convention to generalise from yet; inventing one now would be speculative.

## Out of scope (named, not done)

- Locking the season's money on close (R7) — separate decision.
- Any change to how the surplus is split (`solveEvenLevel` and the fixed/even/none model are
  untouched).
- The **`Due next` column on the dues grid** still carries a caption under each figure — the same
  two-line shape removed from the instalment cells. Left deliberately (it is the only place saying
  WHEN and how much is already late) and raised with the owner; not yet ruled on.
- The demo sandboxes' narration — checked: the coach demo's tour copy mentions dues only in general
  terms and says nothing about the settlement or the table's layout, so nothing there has drifted.
