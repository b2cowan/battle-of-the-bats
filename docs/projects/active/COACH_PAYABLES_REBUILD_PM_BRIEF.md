# PM Brief — Coach Payables Rebuild

**Plan:** `COACH_PAYABLES_REBUILD_PLAN.md` · **Mockup:** `claude.ai/code/artifact/da11c0eb-07e4-4da4-bf8f-f27eb3b5cf7f`
**Decided:** 2026-08-19 · **Priority:** high — two of the four defects move real money
**QA:** Owner QA Ledger §64

---

## The problem in one sentence

The product thinks a bill is either unpaid or paid, and real money does not behave that way.

## What a coach can't do today

- **Pay part of something.** The club takes $200 against a $600 tournament entry. There is nowhere
  to put that unless the coach happened to split the bill into a deposit and a balance *before* any
  money moved. The only button says "Mark paid", and it means paid in full.
- **Undo a mistake.** Tapping the wrong row posts real money out of the team's books. There is no
  un-do anywhere. The only way back is deleting the whole bill — which also wipes the dates on the
  half that *was* correct — and re-typing it.
- **Edit something from where they're standing.** A paid row on the payment schedule doesn't open.
  The record is still fully editable, but only from the other tab, so the screen tells coaches a
  lie about what they're allowed to do.
- **Set up a cost that repeats.** Gym time on the first of every month is one of the most common
  costs a rep team carries, and the only way in is pasting a spreadsheet. Player dues can generate a
  schedule. Money going out cannot.

## What changes for the coach

**A bill becomes a thing you owe, with payments recorded against it over time.**

- **Record a payment** replaces "Mark paid". Enter what actually left the account — any amount, any
  date, any method. Pay $200 of $600 and the bill reads *"$200 of $600 paid · $400 still owing"*.
- **Every payment can be undone**, and the books go back exactly as far as that one payment.
- **Over-payments are accepted**, not refused — because the money genuinely left, and refusing it
  just teaches coaches to type a wrong number.
- **One screen instead of two tabs.** The `Schedule | Commitments` toggle disappears. There is one
  list, and a **Group by** control that arranges it either by bill or by due date. Same records,
  same filters — the coach picks which question is on top: *"what do we owe in total?"* or
  *"what's coming out this month?"*
- **Opening any row shows the whole story** — the plan, every payment made, and what's left.
- **Repeating costs** get the same set-up sheet coaches already use for dues: describe the repeat,
  get a numbered list of dated payments, then add rows, remove rows, or re-price any single one
  before saving. A December rate rise is typed straight over that row.
- **Filters become a Status dropdown** matching Transactions — Outstanding, Overdue, Partly paid,
  Paid, with a count beside each. This becomes the convention on every reporting screen from here.

## Who sees it

Head coaches and coaches with money permission on a paid team. **Read-only money assistants see the
same screens with no Record-a-payment, no Undo, no Edit** — unchanged from today's rule.
Nothing on the family/player side changes.

## Why it matters

Two of the four defects are the kind a coach hits in their first week, and both of them put a wrong
number in front of a real family's money. The third makes coaches think the product is more locked
than it is. The fourth is a routine cost with no home. Together they're the difference between the
money section being trusted and being worked around in a spreadsheet.

There's a second reason: **money-in and money-out will finally think the same way.** Player Dues
already separates the plan from the payments recorded against it. Doing the same on the outgoing
side means one vocabulary across the whole Money tab instead of two.

## Trade-offs taken

- **Bulk edits on a repeating cost can never touch a payment that's already settled in full.**
  That's a deliberate restriction — it costs a little flexibility and removes the only genuinely
  dangerous action in the feature, which is a bulk change silently re-posting money that already
  left the account. Editing a settled payment one at a time still works exactly as it does today.
- **The bigger build was chosen over the quick patch.** Four narrow fixes would have been faster and
  would have left the product unable to express the actual problem.
- **A repeating cost is set up once and adjusted per row.** Changing the rate mid-season under
  "this and later payments" is one edit; the safety rule above is what makes that safe.

## How to try it (per phase)

Money → Payables, on a paid team as head coach.

1. **Phase 1** — nothing should look different. That's the test: the numbers on Overview, Budget vs.
   Actual and the exports must be identical to before.
2. **Phase 2** — record a part payment, then undo it, and watch cash on hand move and move back.
3. **Phase 3** — the new single list and the Group by control.
4. **Phase 4** — set up a monthly gym block, then change one month's rate three ways.

## Success criteria

- A coach can record a payment for any amount, on any date, against any bill — including more than
  one payment, and including more than the bill.
- Any payment can be undone, and cash on hand returns to exactly where it was.
- No screen shows a record as locked that the product will actually let you edit.
- A monthly cost can be set up in one sheet, and a single month's amount changed without touching
  the others.
- No bulk edit ever changes a payment that has already been settled in full.
- Every existing bill survives the change with its books unmoved.
