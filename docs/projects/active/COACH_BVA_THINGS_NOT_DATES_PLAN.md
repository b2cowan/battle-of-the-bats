# Things, not dates — the Statement and By Activity name what a figure is made of

**Status:** **BUILT on dev 2026-09-10**, gates green, **no migration**. Owner QA owed (§167).
Every ruling settled on the mockup the same day. Kickoff prompt: `COACH_BVA_THINGS_NOT_DATES_BUILD_PROMPT.md`.

**What the build added that the plan did not ask for, and why:**
- **The sweep is deleted at source, not merely unrendered.** `mergePeriods` in
  `lib/coach-budget-rollup.ts` both merged the plan's schedules *and* placed actual money onto them.
  Only the display was in scope; but with the fold gone the placement had **no reader left**, and a
  figure nobody can date honestly sitting in the payload is a wrong figure waiting for its next
  reader. It is now `mergeSchedules`, and it takes only the lines. `PeriodResult.actual` is off the
  type, so the compiler refuses a quiet re-add.
- **`rebaseReport`'s dues special case is deleted.** The plan did not name this. It read a whole-team
  `dues.billedToDate` because an item-less category has nothing to re-sum; with a period per
  installment on each family row, the ordinary rule lands on the identical figure — **proved on the
  live fixture at $97.09.** The route still ships `billedToDate`; the guard script reads it, so it is
  now the second derivation the first is checked against rather than the only one.
- **The per-family arithmetic is a pure function** (`buildDuesFamilyRows`), not inline route code.
  It decides whether a heading equals the twelve rows underneath it, and inside the route no test
  could reach it.
- **`CatFoldRow` gained `foldable` and `caption`.** These are what is left of `DuesRow` after it
  dissolved — a category with nothing under it draws no chevron, and one category is allowed a second
  line ("Not set yet"). Two props on the shared row rather than a second row component.
**Raised:** on the §157 walk (2026-09-10), by the owner, from `Fundraising · Merchandise sales`
unfolding to a row labelled *Feb 2027* against money that arrived Aug 31 and Sep 10.
**Mockup of record:** artifact `e2264b06` (`COACH_BVA_THINGS_NOT_DATES_MOCKUP.html`).
**PM brief:** `COACH_BVA_THINGS_NOT_DATES_PM_BRIEF.md`.

**Thesis:** *a date on a record is a fact about that record; a date as a ROW is a claim about time,
and that is the Months view's job.*

---

## 1 · The finding, and why the fold cannot be repaired

The item row's fold shows the **plan's** periods. Actual money is then placed against them by
`mergePeriods`: each amount lands in the first period falling on or after the day it moved, and
anything after the last dated period — **or with no date at all** — lands in the final one.

So the fold is **dated on the budget side and swept on the actual side**. On a line planned across
five months that reads correctly and usefully. On a line with one planned slot in February it reports
August money as February, which is what the owner hit.

**The owner's own argument for removal is the decisive one, and it is a proof rather than a
preference:** dating one side honestly requires dating the other, and dating the other means a row
per line per month on both halves of a report meant to be read in one screen. *There is no version of
the fold that is both truthful and short.*

### 1.1 The fold is a third answer on a row that already has two better ones

Every item row already carries two doors (owner ruling 2026-09-04, §132 round three — *every figure
on the row is a door*):

- the **Budget** figure opens the plan behind it;
- the **Actual** figure opens the records that made it — and on the revenue side **those records are
  the drives and sponsors, by name** (§157 walk G1b, G2b), each row a link into that record's room.

So the "break out by fundraiser, by sponsor" the owner asked for is **already built**. The fold was
crowding it, and dating it.

### 1.2 Supporting precedent, from the owner

The **"N lines" caption** was removed from this exact report (owner ruling 2026-09-04, §133) on the
grounds that pre-announcing a row's internal structure is over-explaining: *"I don't know how much gas
is in my car until I turn it on."* The period fold is the same instinct one layer down. And a line's
phasing already has a home — the **Budget Plan** tab's When cell, where the coach set it.

---

## 2 · Where dates live, after this

| Where | The date belongs to | Verdict |
|---|---|---|
| **Months view** | The month. Both sides dated the same way — the view is built on time. | **Stays** |
| Behind an **Actual** figure | The record: *"$450.00 · received Sep 10"*. A fact about that payment. | **Stays** |
| Behind a **Budget** figure | The plan's own schedule. Makes no claim about when money moved. | **Stays — ruling 1** |
| **The row's fold** | The plan's dates with real money swept onto them. | **GOES** |

---

## 3 · What changes on screen

1. **The item row loses its fold** — on the **Statement and By Activity both**, which share one row
   component. No chevron, no period sub-rows, no date anywhere on either report. **Category rows keep
   their fold** — that is a fold onto *things*, which is the point.
2. **Player dues becomes an ordinary category and folds to players** (⚖ **owner ruling 2026-09-10**,
   taken on the first mockup and replacing its proposal). One row per player, carrying **Budgeted /
   Actual / Variance in the report's own columns**: what that family was billed, what has come in from
   them, and what they still owe. Closed by default, like every category.
   - **No billed/in/owing panel is built.** *"The modal repeats what we see in the player dues page so
     we don't need that."* A modal listing each family's bill and payments is the Player Dues page
     rebuilt inside a report.
   - **The existing composition panel moves down onto each player's Actual figure** — cash paid, team
     bills that family paid, fundraising credited to them. Same panel, better question: *how did their
     $560 get here?* is worth asking; *how did the team's $5,124.63 get here?* was mostly a curiosity.
   - **The category row's figures go plain.**
3. **Nothing else.** Fundraising and Sponsorship rows are already right (mockup §3) and are untouched.

### 3.0 ⚖ The rule the dues ruling settles, report-wide

**A door lives on an ITEM number, never on a CATEGORY number.** Verified against the code, not the
plan: `CategoryGroup` and `FoldableCatRow` render the three category cells as **plain `<td>`s**; only
`ItemRows` passes `openBehind`. Player dues — a synthetic category carrying a door on a category row —
was the report's **only** violation, and folding it to players resolves it by moving that door down to
where doors belong rather than by special-casing anything.

**A player row's Budgeted figure is a plain number**, not a door. A family's bill is one assessed
figure, not a pile of records, and the report's standing rule is already that *a figure with an empty
list behind it stays a plain number*. Their instalment dates live on Player Dues, which is where a
coach goes to chase — so this needs no exception, it is the existing rule applying.

### 3.1 What is NOT changing

- **No arithmetic.** The plan's schedule is still stored and still drives the **to-date** comparison
  basis (*plan dated on or before today*). This removes a display, not a fact.
- **No figure moves**, on any row, on any team.
- The Months view, in any respect.

---

## 4 · ⚖ The export boundary — RULED 2026-09-10

The Statement exports to a file boards and parents read.

**The 2026-09-10 ruling made this sharper, not softer.** While the families were going to be a modal,
keeping them out of the file was a small divergence. As **rows in the table**, the default pull is the
other way: `EXPORT SHAPE = SCREEN SHAPE` (`project_coach_bva_activity_fold`) would put every family and
what they still owe into an emailed statement.

**RULED: the export keeps the single Player dues row it has today**, and the per-family rows
are screen-only. Drives and sponsors stay named in the export — they are businesses and events, not
children.

⚠ That is a **deliberate, named exception** to a standing lesson and must be recorded as one, in the
export module's own comments, or a later session will "fix" the divergence with a good local reason.
The alternative — the file matching the screen — was considered and rejected: it changes what a
treasurer hands round a table.

---

## 5 · What is genuinely lost

*"We're $400 over on ice time — which month?"* Months answers by **category**, not by line, so that one
intersection leaves the product entirely.

Assessment: an analyst's question, not a coach's. The line-level question (*are we over?*) is on the
row; the timing question (*will we be short in November?*) is Months. The intersection is rare enough
to trade for a report that stops dating money it cannot date honestly. **But it is a real loss and the
owner should accept it explicitly, not discover it.**

---

## 6 · Verification

- The two reports render no date, at any width, on any fixture. Worth a **build-enforced guard** — this
  is a rule that will otherwise be re-added by a future session with a good local reason, exactly as
  the "N lines" caption changed hands three times in three days.
- Item rows have no expander; category rows still do.
- Export: no per-family rows; the file's Player dues row matches the screen's figure.
- Fixtures: a line with one period, several periods, no periods; a dues row with families paid in
  full, part-paid and untouched; a read-only coach (no doors that dead-end).
- Owner QA walk, including phone width for the three-column panel.

---

## 7 · Everything is settled — owner, 2026-09-10

### ⚖ The dues shape — do not reopen

- **Player dues folds to players**, carrying the report's own Budgeted / Actual / Variance columns.
- **No billed/in/owing panel** — that is the Player Dues page.
- **The composition panel moves down** onto each player's Actual figure.
- **Doors live on item numbers, not category numbers** — the dues category row's figures go plain.

This replaced the first mockup's proposal (a three-column per-family panel opened from the category
row), which would have rebuilt the Player Dues page inside a modal *and* entrenched the one door on
the report sitting on a category number.

### ⚖ Also settled 2026-09-10 — nothing is owed

1. **The export boundary — RULED: screen-only.** See §4; it is a named exception and must be commented as one in the export module.
2. **The plan's own schedule survives inside the Budget door — RULED: it stays.** On an *ordinary*
   line it is dates, so it was in scope for the rule — but it is *the plan's* dates and claims nothing
   about when money moved. It was deliberately made the schedule on **2026-09-09** (migration 286: one
   word carries one line, so listing lines would have been one row restating the heading).
   *(Rejected alternative: removing it, which leaves the Budget figure with nothing behind it, ends its
   life as a door, and loses the line's note and its way back to the plan.)*
   ⚠ This does **not** touch a player row, whose Budgeted is a plain number either way (§3.0).

---

## 8 · Relationship to the other open fundraising proposal

`COACH_FUNDRAISER_MORE_THAN_ONCE_PLAN.md` is **separate and has no dependency on this one** — a
different screen (the drive's board and the Record door), a different object, and a data change this
plan does not need.

They share one instinct, which is why they arrived in the same hour: **a figure should open onto the
things it is made of.** That plan applies it to a player's total on a drive; this one applies it to a
figure on the report. Keep them apart; read them together.
