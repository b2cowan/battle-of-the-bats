# Coach Payables Rebuild — a commitment holds many payments

**Approved 2026-08-19 from mockups. Build starting.** Plan:
`docs/projects/active/COACH_PAYABLES_REBUILD_PLAN.md` · PM brief: `_PM_BRIEF.md` ·
Owner QA **§64** · Mockup (binding spec): `claude.ai/code/artifact/da11c0eb-07e4-4da4-bf8f-f27eb3b5cf7f`

## ⚠⚠ The origin is the lesson: A PASSING QA WALK FOUND FOUR DEFECTS

QA **§27 passed CLEAN** on 2026-08-19 — everything it checks, the product does correctly. The owner
then found four things the product **cannot do at all**. A checklist of existing behaviour cannot
find an absence; only a person trying to do real work can. **This is the strongest argument in the
repo for owner walks over test coverage**, and it is why §64 exists.

The four, all one root cause — money going out had ONE boolean:

1. **Cannot pay part of a commitment** unless a deposit/balance split was set up *before* any money
   moved. `Mark paid` means paid in full.
2. **Mark paid cannot be undone.** No un-settle exists anywhere; the only correction is deleting the
   whole commitment, which also destroys the other half's dates.
3. **A paid row on the Schedule is a dead end** — no pencil, not clickable — while the same record
   is fully editable from Commitments. The ruling was honoured; the *door* was missing.
4. **Nothing repeats.**

Underneath: `Schedule | Commitments` presented a **parent and its children as two reports**.

## The model

```
Commitment              what we owe
  └─ Installments        the plan               (1..n, dated)
  └─ Payments           what actually happened (0..n, dated, method)
```

Mirrors **Player Dues since migration 232** (schedule separate from payments recorded against it).

- **Every commitment has ≥1 installment** ⇒ the "No schedule" state (amount, no date, invisible to the
  schedule, can never be marked paid) **stops being representable**.
- **Total = sum of installments**, derived. Today total/deposit/balance can disagree.
- **A payment attaches to the COMMITMENT and applies oldest-unpaid-first, spilling forward.** One
  $700 cheque over $450 installments settles the first and part-pays the second — the coach does no
  arithmetic.
- **Settled = paid IN FULL. Partly paid counts as UNPAID** everywhere.
- **Undo = deleting a payment**, reversing by its own recorded ledger entry — never a guess
  (migration 236's lesson: editable descriptions made guessing unsafe).
- **Over-payment is ACCEPTED, not refused** — the money genuinely left; refusing teaches coaches to
  type a wrong number.

## ⚠⚠ The scope rules (recurring, linked series) — the load-bearing part

Three scopes on every installment edit and delete: **this payment only · this and later payments ·
all unpaid payments**.

- **S1 — bulk scopes NEVER touch an installment settled in full.** This is what makes a linked series
  safe, and it is the answer to the archived plan's own objection to a three-way scope.
- **⚠⚠ S2 — "this payment only" STILL EDITS a settled installment**, books following. Standing owner
  ruling 2026-08-16 (*"once it is edited the new value should permeate to the books"*), tested by
  §27 Part C, passed 2026-08-19. **Locking it reverses a live ruling** and restores the read-only
  branches deleted with it.
- **S4 — the scope picker HIDES when it has one answer** (five of six settled ⇒ just save).
- **S5 — a bulk date change SHIFTS, it does not SET.** Dec 1 → Dec 8 moves later ones by 7 days each.
- **S6 — lowering below what is paid ROLLS FORWARD**, naming every installment touched; blocks only
  when there is nowhere to go (last/only installment).

## ✅ What was already built, and what was reversed

**`COACH_RECURRING_PAYABLES_PLAN.md` (2026-08-15) is SUPERSEDED and archived 2026-08-19.**

⚠ **The owner was right that "we built a way to do that" and an agent told him otherwise** — always
search `docs/projects/{active,archive}/` before claiming a feature does not exist.

**Carries forward:** `lib/coach-monthly-recurrence.ts` + 43 tests, committed `c404bd4b` 2026-08-15
with **no callers, deliberately**, so the form could be built against a proven generator. **P4 calls
`generateMonthlyOccurrences` — do not re-invent month arithmetic.** The ceiling counts the **series,
not the request** (24), refused by generator AND route in ONE shared sentence (`tooManyInstallments`),
and the importer's duplicate-description reviewer must **not** be reused (every occurrence shares one
description by design).

⚠⚠ **ONE CARRY-FORWARD RULE WAS WRONG AND IS STRUCK (P4, 2026-08-20): "the server regenerates from
the rule and refuses any date the rule cannot produce".** It **contradicts QA §64 Part D**, which
requires the coach to `+ Add` a row with a date of their own, and it contradicts **S8**, which stores
no rule at all. It was the right rule for the schedule generator it came from, whose dates are not
editable, and the wrong one for a sheet whose whole point is that they are. **The rule fills the list
and gets out of the way; the LIST is validated and saved.** So `reviewMonthlyOccurrences` — the
engine's other half — is deliberately NOT called. A reviewer will ask why a 43-test module is
half-used; this is the answer.

**Reversed:** its §5.1 rejection of the three-way scope (S1 answers the objection); its frozen
part-paid and paid rows; its "deposit half or invisible" rule; monthly-only; and its shape of twelve
**separate linked payables** — twelve months of gym time is now ONE commitment with twelve
installments.

## Phases

**P1** the model lands invisibly (⚠ acceptance test = the books do not move by one cent and no screen
changes) · **P2** record a payment + undo · **P3** the screen (one list, `Group by`, the drawer) ·
**P4** recurring · **P5** help, both demo sandboxes, exports, baselines.

**⚠⚠ /review CAUGHT A MONEY DEFECT IN P4, and three lenses reached it independently.** `planInstallmentWrites` matched a desired plan to stored rows **by POSITION**. Remove a non-trailing piece and every row below slides up — the row carrying a settled $200 deposit is rewritten to hold the $400 balance while the payment recorded against it still points at that row, and `paymentRestatements` then restates that payment to $400 **with its ledger entry**. Real cash movement under a sentence that only promised to remove a row. **THE LESSON GENERALISES: a positional key is a silent liar the moment a list can be edited in the MIDDLE** — it was correct while a plan held two pieces and could only be collapsed wholesale, and P4 is what made a mid-list removal reachable. Fixed by having an EDITED plan name its rows (`PlanPiece.id`); a CREATED plan names nothing and keeps the positional rule. ⚠ The SQL order is load-bearing — DELETE → renumbering UPDATEs (ascending) → INSERT, because `(expense_id, installment_number)` is UNIQUE and an early append would hit the upsert conflict target and OVERWRITE a row. ⚠ Verified with a live dev-DB round trip, which is the only evidence that can see a unique constraint or an FK action. Also fixed: a **date-only bulk edit rewrote every amount in scope** (send only what changed, and send the same object the preview used), and **missing double-submit latches** (release in `finally`, never in a function the render path can reach).

**✅ P5 CLOSED 2026-08-20 by two owner calls.** The coach sandbox now shows a **repeating dome bill** (5 payments, 2 settled) — a judgement no check could make, since `check:demos` proves breakage and never absence. And the **shared touch-target fix** landed: the filter pills cleared the 44px floor, so all four money screens pass and three stale entries were pruned. ⚠⚠ Two lessons: the obvious fix was wrong twice by adding WIDTH to solve a HEIGHT problem (an `inline-flex` link stops wrapping; moving a media guard dropped the register’s compact sizing) — add height only, never width; and `--init` **silently baselined a regression I had just caused**, caught only by diffing the baseline against HEAD. **Audit what `--init` ADDED, not the count.**

**⚠ P1–P4 ARE ALL ON DEV AS OF 2026-08-20.** §64 Parts A+B walked and passed; C, D and E are owed.
P4 lifted the two-piece cap, and **four things had to move in one change**: the cap in
`parseInstallmentPlan`, the deposit/balance form editor that forced it, `Add an installment`'s
one-piece restriction, and the export's four Deposit/Balance columns. `/review`'s rule is why —
**a raised cap with the old editor still in place re-creates the silent truncation the cap
prevented.** A commitment's typed `Total Amount` went with them (R2). **Monthly is the only cadence
and there is no cadence control** — §4.1's Weekly / Every 2 weeks were written before anyone read
the engines. The three-way scope lives on each scheduled payment in the DRAWER (`Change` / `Remove`),
not on the form, which states the whole plan and so has nothing to ask; **nothing is greyed out on a
settled row.** S1–S7 are `lib/payable-scope-edit.ts`, run in the browser and again on the server so
the sentence a coach reads and the write that follows are one decision. **S6's roll-forward is not
implemented** — `commitmentStanding()` already re-applies payments, so the module re-runs the
standing over the proposed plan and reads off what moved.

⚠ ~20 coach-side readers touch the deposit/balance pair — the schedule, Overview's next-30, Budget
vs. Actual (incl. Months), the register, exports, season close, club allocations, the importer, the
status model, the admin-side panel, and both demos.

Related: [[project_coach_expenses_edit_delete]] · [[project_coach_money_table_consistency]] ·
[[project_owner_qa_ledger]] · [[design_decisions]] · [[reference_coach_money_check_then_act]]
