# Coach Payables Rebuild — a commitment holds many payments

**Status:** approved 2026-08-19, build starting. **Owner mockup (binding spec):**
`claude.ai/code/artifact/da11c0eb-07e4-4da4-bf8f-f27eb3b5cf7f`.
**PM brief:** `COACH_PAYABLES_REBUILD_PM_BRIEF.md`. **QA:** Owner QA Ledger §64.
**Origin:** owner walked QA §27 on 2026-08-19. It **passed clean** — and in passing, surfaced four
defects that §27 could not have caught, because they are absences rather than failures.

---

## 1 · Why this exists

Money going out has one boolean. A commitment is **unpaid** or **paid**, and the two-slot
deposit-and-balance split was the only concession to the fact that money arrives in pieces. Four
consequences, all found in one sitting:

| # | Defect | Severity |
|---|--------|----------|
| 1 | **You cannot pay part of something.** A $600 entry where the club takes $200 today has no home unless a deposit/balance split was set up *before* anything was paid. `Mark paid` means paid in full. | Blocking — money |
| 2 | **Mark paid cannot be undone.** There is no un-settle action anywhere in the product. A mis-tap posts real money out of the books, and the only correction is deleting the whole commitment — which also destroys the other half's dates. | Blocking — money |
| 3 | **A paid row on the Schedule is a dead end.** The record *is* fully editable (owner ruling 2026-08-16, §27 Part C), but only from the Commitments list. The Schedule row has no pencil and does not open, so the screen communicates a lock the product does not enforce. | Findability |
| 4 | **Nothing repeats.** Gym time on the first of every month can only be entered by pasting rows through Import. Dues can generate a schedule; money going out cannot. | Missing feature |

Plus the framing defect underneath them: **`Schedule | Commitments` reads as two reports and is
actually a parent and its children.**

⚠ **These are not four features.** They are four symptoms of one missing record. Fixing them
separately would mean four special cases layered onto a model that cannot express the problem.

---

## 2 · The model (owner-decided 2026-08-19)

Three layers replace one boolean.

```
Commitment              what we owe            (the existing payable record)
  └─ Installments        the plan               (NEW — dated, amounts, 1..n)
  └─ Payments           what actually happened (NEW — dated, amount, method, 0..n)
```

**This mirrors Player Dues exactly** — since migration 232 the dues side has kept a *schedule* of
installments separate from the *payments* recorded against it. Money-in and money-out finally think
the same way, and the vocabulary a coach reads is already taught on the other tab.

### 2.1 Binding rules

- **R1 — Every commitment has at least one installment.** The one-payment case is a
  one-installment commitment. ⚠ This permanently kills the current "No schedule" state — a record
  with an amount but no due date, which never reaches the payment schedule, can never be marked
  paid, and today needs a warning comment in the code to explain itself. It stops being
  representable.
- **R2 — The commitment's total is the sum of its installments.** Derived, never separately typed.
  Today the total and the two half-amounts can disagree; after this they cannot.
- **R3 — A payment is recorded against the COMMITMENT, and applied to installments oldest-unpaid
  first, spilling forward.** A coach handing over one $700 cheque covering a full month and half the
  next does not do that arithmetic. The coach may override which installment a payment lands on.
- **R4 — An installment is *settled* only when paid in full. Partly paid counts as unpaid**
  everywhere: filters, bulk scopes, the schedule, the Overview's next-30 panel.
- **R5 — Undo is deleting a payment.** The books reverse by exactly that payment's amount, reading
  its own recorded ledger entry — never a guess. (Migration 236's lesson: once descriptions became
  editable, guessing which ledger row belonged to a record stopped being safe.)
- **R6 — Over-payment is accepted, not refused.** Recording $500 against a $450 commitment saves and
  the row reads "$50 over". The money genuinely left the account; refusing it pushes coaches into
  fudging the figure, which is how a book stops matching a bank statement.

---

## 3 · The screen (mockup Option B, with Option C's drawer)

The `Schedule | Commitments` toggle is **deleted**. Payables becomes **one list of rows with a
`Group by` control** — the same "one book, narrowed by controls" shape the Transactions register
already teaches.

### 3.1 The list

- `Group by` — **Commitment** (the group header carries the commitment, its category, paid-of-total
  and still-owing) or **Due date** (headers are Overdue / month names, carrying the period total).
  Same rows, same filters, nothing added or hidden between the two — which is the whole point: it
  says out loud that these are one set of records seen two ways.
- `Group by` sits **first** in the control strip and is labelled as an arrangement, so it never
  reads as another narrowing.
- Rows are **installments**. Every row opens the drawer (§3.2). An unsettled row also offers
  **Record a payment** inline.
- ⚠ **Defect 3 closes here**: every row opens its record, settled or not. There is no dead end.

### 3.2 The drawer

Opening any row shows the whole commitment in one panel:

- Header: description, category + budget item, **Edit** and **Delete**.
- **Scheduled** — every installment, dated, each with its own state (Settled / Part paid /
  In N days / N days overdue).
- **Payments recorded** — every payment, dated, with method, each with **Undo**.
- **Still owing** — the single figure, prominent.
- Actions: **Record a payment**, **Add an installment**.

### 3.3 Filters

The `Unpaid | Paid | All` pills are replaced by a multi-select **Status** dropdown matching
Transactions:

| Option | Meaning |
|--------|---------|
| Outstanding | Not settled, due date ahead |
| Overdue | Not settled, due date past |
| Partly paid | Some money applied, not settled |
| Paid | Settled in full |

Counts on every option, computed before the selection narrows further — the rule the old Overdue
chip already followed, so the numbers never chase their own tail. **Defaults to Outstanding +
Overdue**, reading "2 selected" rather than pretending nothing is filtered. `Item` (budget item)
joins it, as on Transactions.

---

## 4 · Recurring — a linked series (owner-decided 2026-08-19, revising the mockup)

The mockup recommended generate-then-independent. **The owner chose the linked series with a
modification that removes the objection**: bulk scopes may never touch settled money.

⚠⚠ **This supersedes `COACH_RECURRING_PAYABLES_PLAN.md` (2026-08-15), archived 2026-08-19.** That
plan solved recurrence on top of the one-boolean model and would have needed two further mechanisms
beside it. Read its archived header for the full carry-forward/reversal list. The two things to know
here:

- ✅ **The month engine is already built and is reused as-is** — `lib/coach-monthly-recurrence.ts`
  plus 43 unit tests, committed `c404bd4b` 2026-08-15 with no callers, deliberately, so the form
  could be built against a proven generator. **P4 calls it. Do not re-invent month arithmetic.**
  With it come three rules that carry forward unchanged: the **ceiling counts the series, not the
  request** (24 monthly occurrences, refused by generator *and* route with the same message); the
  **server regenerates from the rule** and refuses any date the rule cannot produce; and the
  importer's **duplicate-description reviewer must NOT be reused** (every occurrence of a repeat
  shares one description by design).
- ⚠ **Its §5.1 explicitly rejected the three-way scope** this plan adopts. The objection was that a
  bulk edit could reach money that already moved — which is precisely what **S1** now forbids. The
  concern is honoured, not overruled.

### 4.1 The generator

Re-uses the **Generate installments** sheet's shape from Player Dues **verbatim** — that consistency
was the owner's explicit instruction:

- A numbered `Installment 1..n` list.
- `+ Add` appends; every row has `Remove`.
- Every row has its own **due date** and **amount**.
- Amounts fill in automatically from the repeat rule, are badged **Auto**, and can be over-typed
  (the December rate rise drawn in the mockup is exactly this case).
- A plain-language reconcile line stating count and total — **a sentence, never a barrier**
  (owner ruling 2026-08-13, carried across).

Repeat controls above the list: **Repeat** (Weekly / Every 2 weeks / Monthly), **On the** (day),
**Until** (date) or **times** (count), **Amount each** (or a total, divided evenly).

### 4.2 The three scopes

Every installment edit, and every installment delete, offers:

1. **This payment only**
2. **This and later payments**
3. **All unpaid payments**

### 4.3 ⚠⚠ The scope rules — this is the load-bearing part

- **S1 — Scopes 2 and 3 NEVER touch a settled installment.** Not to change an amount, not to change
  a date, not to delete. This is what removes the danger that made a linked series risky in the
  first place: no bulk edit can re-post money that already left the account.
- **S2 — "This payment only" remains available on a settled installment**, and the books follow.
  ⚠⚠ This is the standing owner ruling of 2026-08-16 — *"once it is edited the new value should
  permeate to the books and everything be in sync"* — and it is tested by §27 Part C, which
  **passed on 2026-08-19**. **Do not lock a settled installment. That reverses a live ruling** and
  re-introduces the read-only branches that were deleted with it.
- **S3 — Partly paid counts as unpaid** (R4) and IS reachable by scopes 2 and 3.
- **S4 — The scope picker is hidden when it has one answer.** If the scope would affect exactly one
  installment (five of six already settled, say), save directly. A three-way question with one
  possible outcome makes a careful feature feel bureaucratic.
- **S5 — A bulk date change SHIFTS, it does not SET.** Moving installment 3 from Dec 1 to Dec 8 under
  "this and later" moves 4, 5 and 6 by seven days each. Setting them all to one date is nonsense on
  a monthly series.
- **S6 — Lowering an amount below what is already applied rolls the excess FORWARD** to the next
  unpaid installment, stated in a sentence naming every installment it touched. **Block only when
  there is nowhere for it to go** — the last installment, or the only one — and then the message
  names the figure and the reason.
- **S7 — Deleting an installment that has money applied** rolls that money forward under "this
  payment only". Under a bulk scope, settled installments are skipped (S1), and a partly-paid
  installment's applied money rolls forward before its row goes.
- **S8 — The series is the commitment's installments.** There is no cross-commitment series, and no
  series record of its own to keep in sync with anything.

---

## 5 · Phases

Each phase is independently shippable and independently walkable.

### P1 — The model lands, invisibly
New installment and payment records. **Every existing commitment migrates**: a deposit/balance split
becomes a two-installment commitment; an un-split payable becomes one installment; each settled half
becomes one recorded payment **carrying its existing ledger entry**. Every reader moves to the new
shape — the payment schedule, the Overview's next-30 panel, Budget vs. Actual (including Months),
the Transactions register, the exports, season close/settlement, club allocations, the bulk importer,
and the admin-side upcoming-payables panel.

⚠ **The screen does not change in this phase, and the books must not move by one cent.** That is the
phase's entire acceptance test.

### P2 — Recording a payment, and undoing one
The **Record a payment** form (date, amount, method, note, which installment). Partial payment.
Over-payment (R6). **Undo** on any recorded payment, reversing the books by its own entry.
⚠ Closes defects 1 and 2 — the two blocking ones.

### P3 — The screen rebuild
Option B's single list with `Group by`, Option C's drawer, the Status dropdown, `Item`.
The `Schedule | Commitments` toggle is deleted. ⚠ Closes defect 3.

### P4 — Recurring
The generator (§4.1), and the linked series with the three scopes and rules S1–S8.
⚠ Closes defect 4.

### P5 — The tail
In-app help content; **both demo sandboxes** (the coach sandbox's dock copy and tour narration talk
about money and will go stale — CLAUDE.md's standing warning, and the 2026-08-17 release already
changed this exact surface once); export columns; the layout and memory baselines.

---

## 6 · What this touches beyond the screen

Roughly twenty coach-side readers currently read the deposit/balance pair directly. Named here so
none is discovered late:

- The payment schedule, and the Overview's **next 30 days** panel
- **Budget vs. Actual**, including the Months view (a payment's date decides its month)
- The **Transactions register** — a settled half is a row in the one book, and carries the running
  balance
- **Exports** — the payables and register files, and their column sets
- **Season close / settlement**, and the closed-season page's money shelf
- **Club allocations** (org-funded installments on a club-run team)
- The **bulk importer** and its payables template
- The **status model** and the free-tier basic-coach team summaries
- The **admin-side** upcoming-payables panel
- The two **demo sandboxes**

---

## 7 · New standing convention — reporting filters

Owner instruction 2026-08-19: *"I would like this to be the convention on reporting going forward
unless there is a good reason for something else."* Logged in `memory/design_decisions.md`.

- **Four or more options, or a list that will grow → a dropdown.** Multi-select, counts on every
  option, and the summary reads "2 selected" when a real default is in force rather than pretending
  nothing is filtered.
- **Two or three fixed, permanent options → pills stay.** A dropdown for two things is a click tax.
- **A control that chooses an ARRANGEMENT is not a filter** — it says `Group by`, and sits first.
- **Never a tab row where a filter would do.** Two tabs over the same records is the mistake this
  whole project exists to correct.

Screens this sweeps next: Player Dues, Fundraising, Club, and the Reports portal when it is built.

---

## 8 · Risks

| Risk | Mitigation |
|------|------------|
| **P1 moves the books by a cent.** The migration re-expresses settled money; an arithmetic slip is a wrong bank balance on a live site. | P1's acceptance test is cash-on-hand and Budget vs. Actual identical before and after, on a team carrying every shape. Existing ledger entries are **carried, never recreated**. |
| **A settled installment gets locked**, reversing the 2026-08-16 ruling by accident. | S2, stated twice above, and walked explicitly in §64. |
| **Roll-forward (S6) cascades confusingly** across several installments. | The sentence names every installment it touched, not just the next one. |
| **Demo copy goes stale.** The coach sandbox narrates money screens that are being rebuilt. | P5, plus `npm run check:demos` — which proves breakage but cannot tell us the demo is missing something the product gained. That judgement is P5's actual work. |
| **The register's running balance** depends on one row per settled half; payments are now their own records. | ⚠ §41 Part D's rule holds — a settle must leave ONE transaction and no second row beside the commitment. Re-assert it in P2. |
| **Scope rules are cheap to state and expensive to get right** across paid/unpaid combinations. | S1–S8 are individually walkable in §64 Part E, and each gets a unit test rather than only a QA step. |
