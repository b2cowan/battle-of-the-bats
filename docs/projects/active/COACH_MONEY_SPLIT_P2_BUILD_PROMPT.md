# Kickoff prompt — Money redesign Phase 2: the form

*(paste into a fresh chat)*

**Build Phase 2 of the Money screens redesign, and ONLY Phase 2.** The form's design was ruled by
the owner on 2026-08-16 and is recorded in `COACH_MONEY_TAB_REDESIGN_PLAN.md` §2 — **carried
verbatim, not re-litigated**. Do not reach into later phases: the register is **P3**, the club merge
is **P4**. P1 (the two tabs) shipped to dev as `b3d9694b` and is what you are building on.

---

## Read first, in this order

1. **`COACH_MONEY_TAB_REDESIGN_PLAN.md`** — §2 (the form rulings, verbatim), §8 (constraints, none
   open), §10 P2 (the scope line) and P1's entry (what shipped, and the two decisions it took).
2. **The binding form proposal:** https://claude.ai/code/artifact/b618c784-c050-4003-833b-b87d3cb708f7
3. **`OWNER_QA_LEDGER.md` §38 and §41** — what the screen does today. §38's screen names are
   annotated, not renumbered; read that note first or its walk will read as describing a different
   product.

## ⚠ Verify before building — the working copy, and what P1 left you

- **P1 is committed (`b3d9694b`, 2026-08-16).** *Expenses & Payables* is now **Transactions**
  (Expenses · Money in) and **Payables** (Schedule · Commitments), built as two faces of one panel
  behind a `face` prop. Confirm that is what the code does before trusting any of the below.
- **Other chats share this working copy, and during P1 they reset commits mid-session.** Re-check
  the branch is `dev`, stage explicit pathspecs only, and after committing run `git show --stat HEAD`
  and confirm only your files landed. Expect files you never touched to be modified and staged.
- **⚠⚠ Nothing in the money area has been owner-QA'd yet.** Ten sections sit built-and-unwalked
  (§6, §13b, §22, §23, §24, §27, §29, §30, §38, §41) and migrations 236–245 are dev-only. If §38 or
  §41 turns up a design problem, it is under your feet. Ask before building on anything that looks
  like it might move.

### What P1 changed in the form, which P2 inherits

- **The kind switch is three options** — `A cost` / `Income` / `Money back on something`. P2 replaces
  this with **two pills (Expense · Income) plus a "This is a refund" tick box** (§2).
- **The "Promised, not paid yet" timing switch is GONE.** A commitment has its own door on Payables.
  Do not reintroduce a timing question on this form.
- **A settle mode exists.** Mark paid on a commitment (or a schedule half) opens this same form
  pre-filled and sends one PATCH carrying the edits *and* the mark-paid action. `formMode` resolves
  `settle | edit | add` **once** — read it rather than re-testing `settling`/`editing`, which is
  the bug /review found at four call sites.
- **The discard guard compares against what the form OPENED with** (`formOpenedWith`), not a
  re-derivation. Any new opener or pre-fill must set it, or the guard cries wolf again.
- **The consequence line already exists on two branches** — the commitment's "nothing moves" (and
  its part-paid variant) and the settle's "when you save …". §2 wants one **on every state**,
  including the out-of-pocket sentence naming the family. Extend; do not start over.

---

## What Phase 2 builds

### 1 · Two pills and a tick box

**Expense · Income**, with **"This is a refund"** beside them. The tick box flips the direction of
the money and **never changes the list you choose from**. `Expense` replaces the words *A cost*
everywhere they appear — on this form **and** on the Budget Plan form.

⚠ **A refund is still not income, and still not "paid out of pocket."** The three-way distinction
is unchanged in the data and on the report; only the control changes. §8's test stands: record one
of each against the same item and count the credits — exactly one.

### 2 · One searchable picker, three surfaces

`Category · Item` in one control, type-ahead, grouped by category. **Categories are never
filtered** — *Tournaments* deliberately holds both directions. The item list follows the pill; a
created item carries the direction it was created under and is editable afterwards.

⚠⚠ **THE PICKER ALREADY EXISTS — CHECK BEFORE YOU BUILD ONE.** `components/accounting/BudgetItemPicker.tsx`
already serves **two of the three surfaces** (the coach Budget Plan and the club admin budget
screen) and already handles inline create in both `admin` and `coach` modes, including the
team-ownership rule migration 240 introduced. The money form is the **odd one out** — it still uses
two plain `<select>`s. So P2 is most likely *"teach the existing picker to search and to follow a
direction, then move the money form onto it"*, **not** a new component. Verify that reading against
the code and say so if it is wrong — but do not add a fourth picker to a codebase that has one.

### 3 · The consequence line, in every state

One line above the buttons stating what the record will do, in dollars. On an out-of-pocket cost it
**names the family and the credit**. This is the sentence that replaced the read-only lock, so it
carries the weight the lock used to: it is what tells a coach an edit will reach the books.

### 4 · `Paid by` folds under `More`

Rare enough to hide, and the consequence line makes hiding it safe — that pairing is the ruling, so
do not do one without the other. ⚠ `Paid by` is **creation-only** and the server refuses changing
it; folding it must not make it look editable on an edit.

### 5 · The teaching copy leaves the form

The comparison panels move to **empty states and the help guide only**. They are already on the
empty states — check what is duplicated rather than adding more.

### 6 · `Save`

One modal serves add *and* edit, so the button says **`Save`**. ⚠ P1's settle mode says **`Mark
Paid`** and should keep saying it: on a settle the outcome *is* the point, and that is the one
state where naming it beats a generic word.

---

## 🔒 Constraints (plan §8 — none are open)

Money back ≠ paid out of pocket (count credits — exactly one) · nothing ever changes a dues schedule
· **nothing on a saved record is read-only** (owner 2026-08-16 — the two surviving refusals are an
unmatchable pre-mig-236 ledger entry and changing WHO paid out of pocket; neither is a lock) · one
row, one source · never both · working season only, no `?year=` anywhere
(`coach-history-endpoint-guard` is the contract) · sport-neutral vocabulary · the report's rules are
untouched by P2.

---

## Done means

- Every surface the rename touches, in one unit of work: the money form, the Budget Plan form, the
  club admin budget screen, the help guide (`/docs`), and the demo tour/moments copy re-read for
  sentences naming *A cost* — then `npm run check:demos`.
- `npm run check:layout --only=coach-transactions,coach-payables,coach-budget` (the form is a modal;
  the sweep measures it closed, so say plainly what that does and does not prove).
- **A fixture walk on `qa-money-lab`** (already prepared — do not rebuild). Minimum: record an
  expense, an income entry and a refund through the new pills; confirm the refund reduces its row
  rather than adding one; record an out-of-pocket cost and confirm the consequence line names the
  family and that exactly one credit exists.
- `verify:changed` and `typecheck`. ⚠ `verify:changed` currently fails on a **pre-existing** schema
  parity gap (236–245 are dev-only) — the checks after that gate must be run directly.
- Offer `/simplify`, then `/review`, before handing off. P1's `/review` found a Critical money defect
  that a green build and a passing fixture walk had both missed; the form is where that class lives.
- A **new Owner QA Ledger section** (annotate §38 and §41, never renumber), and update the plan's
  §10 P2 line, the PM brief and `TODO.md` per the anti-drift rule — positive facts with anchors.

## ⚖ Disagree out loud, before the work

If the ruled design is wrong, say so **before** building it, arguing from what the code does rather
than what the plan claims. Two of P1's better outcomes came from exactly that: the arrivals list
kept its name against the plan's own §6, and a due-date field the form had promised for months but
never had got built. Re-frame the question if it is the wrong one. Do not manufacture disagreement.
