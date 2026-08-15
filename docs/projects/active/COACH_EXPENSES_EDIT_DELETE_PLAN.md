# Expenses & Payables — correcting a record, and one door to create one

**Status:** BUILT on dev 2026-08-15 · owner QA = `OWNER_QA_LEDGER.md` §27 · migration 236 applied
to **dev only** · not committed at time of writing
**Mockups (binding):** `claude.ai/code/artifact/d693ab01-4cf4-4566-bad5-dedc74ea2ba8` (rounds 1–5)
**PM brief:** `COACH_EXPENSES_EDIT_DELETE_PM_BRIEF.md`

> ⚠ **This is a record, not a forecast.** The work was approved from mockups rather than from a
> plan, and shipped to dev before this file existed. It is written so the reasoning survives the
> conversation it was decided in — several of the rules below are load-bearing and would be easy to
> undo without knowing why they are there.

---

## Where this came from

The owner opened the Expenses & Payables screen and asked four questions in one message:

1. Why do payee/notes/tags hide behind a disclosure on the payable form but sit in the open on the
   expense form?
2. Why do the buttons sit on their own line under the sub-tabs?
3. Why is there no space between the description and "Add tags"?
4. **Why can't I edit an expense — I can only add tags?**

Three more followed as the review went on: payment-method spellings (Q5), recurring payables (Q6),
and how a coach is supposed to know the difference between an expense and a payable (Q7). An eighth
came from the mockups — one Add button instead of two (Q8).

Q6 is **not in this project** — it has its own plan (`COACH_RECURRING_PAYABLES_PLAN.md`) written by
a parallel session, and that plan depends on this one shipping first.

---

## What shipped

| # | Change | Note |
|---|---|---|
| Q1 | The expense form adopts the payable's "Add details (optional)" group | It was the SHORTER form and the one that scrolled |
| Q2 | Sub-tabs and the toolbar actions share one row | Removes a full band of vertical chrome |
| Q3 | The glued "Add tags" link | Resolved by DELETION — see Q4 |
| Q4 | **Edit and Delete on both sub-tabs** | Carries migration 236 |
| Q5 | Payment method suggests what has been used before | Seeded list; free text still accepted |
| Q7 | Expense-vs-payable comparison on both empty states | Plus a line in each Add form |
| Q8 | **One Add button** with a type switch, pre-selected from the sub-tab | Supersedes Q7's modal subtitle |
| — | Tags join the export | The filter sits on the same toolbar as Export |
| — | Payable rows show their tag chips | Previously visible only inside the drawer |
| — | The row-edit convention, recorded as a binding design decision | `memory/design_decisions.md` |

---

## The rules that must not be quietly undone

### 1. A paid record locks its FIGURES, never its words
Owner ruling 2026-08-15. Description, category, notes and tags stay editable forever; the amount
and who paid lock once money has posted. **The gate is per half on a payable** — a paid deposit must
not freeze a balance the coach still has to manage — and a payable's *total* locks only once both
halves have paid, because the total is the commitment rather than a half.

One definition serves all three readers (the form that shows the lock, the save that omits locked
fields, the API that refuses them). They were each deriving it separately until `/simplify`; the
client's send-filter was the copy most likely to be missed, and it fails **silently**.

### 2. Deleting reverses the money, and says how much first
Never a bare "Are you sure?". The confirmation and the reversal read the **same function**, so the
sentence and the outcome cannot drift apart. An out-of-pocket expense reverses **nothing** — a
family's money moved, not the team's — but deleting it removes the credit the team owed them, which
is said in its own sentence rather than folded into a dollar figure.

### 3. ⚠ A rename must claim its ledger link BEFORE it changes the name
Anything paid before migration 236 has no recorded link, so a delete finds its ledger entry by
matching the description it was posted under. Rename such a record and the match fails — and a
failed match is **indistinguishable from "already reversed"**, so the delete would remove the record
and leave a posted entry behind, having told the coach money was coming back.

Migration 236's own comment predicted this and left it open; it is closed by adopting the link at
the moment of the rename. **An ambiguous match refuses the rename** rather than letting the link go.

### 4. Type is set at creation
Owner ruling. A saved record never converts between expense and payable — conversion would mean
due-date and deposit fields materialising on an existing row, and a payable converting the other way
silently dropping a schedule it may already appear on. Now that Delete exists, the wrong type is
cheap to fix by deleting and re-adding.

### 5. Payment-method suggestions are scoped to the coach's OWN teams
The field is free text. An org-wide read hands a coach on one team the exact strings coaches on
every other team typed — cheque numbers, account references. Cross-team sharing in this product is
opt-in and sanitised (the Club Shared Book); a suggestions dropdown had quietly become neither.
**The shared-vocabulary goal is met by the seeded list**, not by exposing other teams' history.

### 6. The row-edit convention — three affordances, chosen by intent
Recorded in full in `memory/design_decisions.md` (2026-08-15). Open-to-edit → pencil + clickable
row. Expand-in-place → chevron. One specific verb → labelled button. **Delete is not a row action** —
it lives in the edit form's footer, which is why a row needs only one control and no overflow menu.

⚠ **The pencil has two phone treatments and they are not interchangeable.** A list table that stacks
into cards gets a labelled "Edit" button; a ledger grid gets the clip treatment. Using the wrong one
caused 30px of sideways page scroll, because the card rules stretch a trailing button to full width
and a clipped button has nothing to be full width *of*.

---

## What the reviews earned

`/simplify` (4 lenses) found a **class-name collision** in the shared coaches stylesheet: this
project's type switch and a parallel session's sponsor picker both defined `kindOption`. Class names
there are file-scoped, so the two would have silently overwritten each other's borders and padding —
neither picker broken enough to notice, both subtly wrong.

`/review` (high-risk tier, 5 lenses) found five, two of them serious:

- **Editing a payable silently discarded its deposit and balance** — the form rendered from the
  correct value and saved from a stale one, returning success. **Introduced by `/simplify` an hour
  earlier**, which is the argument for running review *after* cleanup rather than instead of it.
- **Rule 3 above** — the rename-orphans-the-ledger-entry hole.
- The cross-team payment-method leak (rule 5).
- A combined "change the amount and mark it paid" request posting the pre-edit figure to the books.
- A shared icon button that could compress below tap size in a crowded row.

⚠ **Two rendered-check diagnoses were wrong before the third was right**, and the reason matters:
both experiments ran after a dev-server child had been hard-killed, so the browser was served a
stale bundle and never tested the code being edited. **When a rendered finding contradicts the source
you are reading, restart the server before believing either.**

---

## Deliberately NOT done

- **No Tags column.** Tags are sparse; a column would sit blank four rows in five, and Category
  already owns that slot — two fields competing visually while meaning different things.
- **No hover-reveal on the pencil.** Raised by the owner, considered, declined: it would have
  re-forked the convention this pass had just unified.
- **No merging of the three payment-method vocabularies.** Payment requests keeps its own closed
  list and dues keeps its stored codes. Unifying them is a vocabulary decision across surfaces and,
  for dues, a stored-value migration. The seed casing here was matched to the oldest of the three so
  this did not become a fourth.
- **No pruning of dead layout-baseline entries.** Three no longer reproduce; pruning from a narrow
  run is how this repo previously dropped entries that were merely dormant under a thin fixture.

---

## Still owed

1. **Owner QA** — ledger §27.
2. **Migration 236 to production**, before the code that reads it.
3. A full-sweep prune of the three dead baseline entries.
4. Recurring payables (`COACH_RECURRING_PAYABLES_PLAN.md`) unblocks once this ships — its Repeats
   group must be absent from the Expense side of the Add switch.
