# Kickoff prompt — Money redesign Phase 1: the two doors
*(paste into a fresh chat)*

**Build Phase 1 of the Money screens redesign, and ONLY Phase 1.** The direction was ruled by the
owner on 2026-08-16 and is recorded in `COACH_MONEY_TAB_REDESIGN_PLAN.md` §0 — do not re-open it,
and do not reach into later phases: the form redesign is **P2**, the register is **P3**, the club
merge is **P4**. Each phase leaves the product coherent on its own; that is the point of the
phasing, and P1 grabbing P2's form "while it's in there" is how one release becomes three at once.

---

## Read first, in this order

1. **`COACH_MONEY_TAB_REDESIGN_PLAN.md`** — §0 (what is ruled), §3 (the split), §8 (constraints),
   §9 (every surface P1 touches), §10 (P1's scope line). The mockups:
   https://claude.ai/code/artifact/ff5112d8-8e90-40f9-8e67-3aa668b668e2
2. **The binding form proposal** (for the commitment form's fields and consequence lines only —
   the money form's own redesign is P2's, not yours):
   https://claude.ai/code/artifact/b618c784-c050-4003-833b-b87d3cb708f7
3. **`COACH_MONEY_BACK_ON_A_COST_PLAN.md` §2 and §6** — inherited constraints, not up for design.
4. **`OWNER_QA_LEDGER.md` §38** — what the screen does today; your changes must not regress a walk
   that has not been QA'd yet.

## ⚠ Verify before building (state of the shared working copy)

- **The date-fix + editability release must already be on dev** — the money form has a *Date
  paid* field, Mark Paid asks *when*, a future date is refused, and saved records are editable.
  It was built 2026-08-16 in another chat and P1 leans on it. **Confirm it is actually in the
  code before starting; if it is not, stop and say so** — do not build it yourself, do not build
  on its absence.
- Other chats share this working copy: re-check the branch is `dev`, stage explicit pathspecs
  only, expect files you did not touch to be modified.
- Migrations 238/240/241/242/243/244 are dev-only; nothing here promotes before they do.

---

## What Phase 1 builds

### 1 · Two hub tabs replace *Expenses & Payables*

- **Transactions** — carries the existing happened-lists as a stepping stone: the Expenses list
  and the Money in list, **with the Money in sub-view renamed Income**. No register yet (P3); no
  other reshaping of these lists.
- **Payables** — the commitment list and the payment Schedule, moved whole. **Opens on Schedule**
  (recommended default; confirm nothing in the mockup review changed it).
- Tab order: … Fundraising · **Transactions** · **Payables** · Allocations · Payments · Budget
  vs. Actual. (Allocations/Payments merge in P4 — leave them alone.)

### 2 · Every saved address keeps working

`?section=expenses` → transactions · `?section=expenses&tab=payables|schedule` → payables
(matching view) · `?section=expenses&tab=money-in` → transactions, Income view · the legacy
standalone route redirects follow. The plan's §9 lists every surface: hub labels, the money rail,
Overview's link set (including the schedule link), export catalog labels, cross-links in the org
panels, the rendered layout baseline (the expenses screen becomes two screens — a deliberate
baseline edit).

### 3 · The commitment door

**Add a commitment** on Payables: what it's for (the category+item control as it exists today —
**expense items only**, a commitment is always money out), amount owed, due date, optional
deposit/balance split, description; notes/tags under More. Consequence line: *"When you save:
nothing moves. This joins your payment schedule, due …"*.

⚠ **A commitment is today's payable record wearing its own door — not a new object.** Do not
introduce a second record shape; the H2 bulk import, the schedule's deposit/balance halves and
every existing sum must keep working unchanged.

### 4 · *Add money* stops asking the timing question

The money form's **"Promised, not paid yet" branch is removed** — with its deposit/balance pair
and due dates, which now live only on the commitment form. The three-kind switch itself stays as
it is (P2 replaces it). A typed **future date is refused** with *"that hasn't happened yet — add
it as a commitment instead"* and a working link to the commitment door.

### 5 · Mark paid goes through the one door

**Mark paid on a commitment (or a schedule half) opens *Add money* pre-filled** — item, amount,
description from the commitment — and asks **when**. Saving **settles that commitment**: the
record transitions to paid with the chosen date and posts to the books exactly as marking paid
does today. ⚠⚠ **Settling must never create a second record beside the commitment** — a
transaction *and* a payable both carrying the $600 is the double-count §8's rules exist to
prevent. Deposit and balance halves settle independently, as they do today.

---

## 🔒 Constraints (plan §8 — none are open)

Money back ≠ paid out of pocket (test both on one item; count credits — exactly one) · nothing
ever changes a dues schedule · nothing on a saved record is read-only (the two surviving refusals
are not locks) · one row, one source · never both · working season only, no `?year=` anywhere
(`coach-history-endpoint-guard` is the contract) · sport-neutral vocabulary · the report's rules
are untouched by P1.

---

## Done means

- All §9 surfaces for P1 done in the same unit of work: help docs (`/docs` — the Expenses &
  Payables topic splits), demo tour/moments copy re-read for sentences naming the old screen,
  `npm run check:demos`, the layout baseline edit, and a **new Owner QA Ledger section** (annotate
  §38's old tab names, never renumber).
- Fixture: **`qa-money-lab`** (already prepared — do not rebuild). Walk: create a commitment with
  a deposit/balance split → settle the deposit through Mark paid with a back-dated *when* → confirm
  one schedule entry settled, one transaction on the books, dated as chosen, and the balance half
  still owed.
- `verify:changed`, and `typecheck` (shared modules and route contracts move).
- Offer `/simplify` (new door + shared picker touchpoints) then `/review` before handing off.
- Update the plan's §10 P1 line and `TODO.md` status wording per the anti-drift rule (positive
  facts with anchors, no "not on prod").
