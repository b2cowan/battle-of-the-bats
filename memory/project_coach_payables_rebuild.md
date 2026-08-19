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
it — do not re-invent month arithmetic.** With it: the ceiling counts the **series, not the request**
(24); the **server regenerates from the rule** and refuses any date the rule cannot produce; and the
importer's duplicate-description reviewer must **not** be reused (every occurrence shares one
description by design).

**Reversed:** its §5.1 rejection of the three-way scope (S1 answers the objection); its frozen
part-paid and paid rows; its "deposit half or invisible" rule; monthly-only; and its shape of twelve
**separate linked payables** — twelve months of gym time is now ONE commitment with twelve
installments.

## Phases

**P1** the model lands invisibly (⚠ acceptance test = the books do not move by one cent and no screen
changes) · **P2** record a payment + undo · **P3** the screen (one list, `Group by`, the drawer) ·
**P4** recurring · **P5** help, both demo sandboxes, exports, baselines.

⚠ ~20 coach-side readers touch the deposit/balance pair — the schedule, Overview's next-30, Budget
vs. Actual (incl. Months), the register, exports, season close, club allocations, the importer, the
status model, the admin-side panel, and both demos.

Related: [[project_coach_expenses_edit_delete]] · [[project_coach_money_table_consistency]] ·
[[project_owner_qa_ledger]] · [[design_decisions]] · [[reference_coach_money_check_then_act]]
