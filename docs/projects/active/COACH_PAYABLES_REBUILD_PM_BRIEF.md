# PM Brief — Coach Payables Rebuild

**Plan:** `COACH_PAYABLES_REBUILD_PLAN.md` · **Mockup:** `claude.ai/code/artifact/da11c0eb-07e4-4da4-bf8f-f27eb3b5cf7f`
**Decided:** 2026-08-19 · **Priority:** high — two of the four defects move real money
**QA:** Owner QA Ledger §64

**Status (2026-08-20): ALL FIVE PHASES ARE BUILT AND ON `dev`.**
QA §64 Parts A, B, C and D are walked. **Parts E, F, G and H are owed.**
The C+D walk found five things — every one an absence or a false sentence rather than a broken
control — and all five were closed the same day. Three of those fixes landed after the step
that prompted them and want a short re-look before Part E.
⚠ **None of this is on production.** Production is still on the 2026-08-17 release, so nothing
described below is real to a customer yet, and shipping it carries two database changes.

---

## The problem in one sentence

The product thought a bill was either unpaid or paid, and real money does not behave that way.

## What a coach could not do

- **Pay part of something.** The club takes $200 against a $600 tournament entry. There was nowhere
  to put that unless the coach happened to split the bill into a deposit and a balance *before* any
  money moved. The only button said "Mark paid", and it meant paid in full.
- **Undo a mistake.** Tapping the wrong row posted real money out of the team's books with no way
  back except deleting the whole bill — which also wiped the dates on the half that *was* correct.
- **Edit from where they were standing.** A paid row on the payment schedule did not open, though
  the record was fully editable from the other tab. The screen told coaches a lie about what they
  were allowed to do.
- **Set up a cost that repeats.** Monthly gym time is one of the most common costs a rep team
  carries, and the only way in was pasting a spreadsheet.

⚠ **All four were found by a QA walk that PASSED.** §27 checked everything the product did and found
it correct; these are things the product could not do at all. A checklist of existing behaviour
cannot find an absence — which is the strongest argument in this repo for owner walks over test
coverage, and the reason §64 exists.

---

## What a coach gets now

**A bill is something you owe, with payments recorded against it over time.**

- **Record a payment** replaced "Mark paid". Any amount, any date, any method. Pay $200 of $600 and
  the bill reads *"$200 of $600 paid · $400 still owing"*, status **Partly paid**.
- **Every payment can be undone**, and the books go back by exactly that one payment.
- **Over-payments save**, and the bill says how far over. The money genuinely left the account;
  refusing it teaches coaches to type a figure that is not what happened.
- **One screen instead of two tabs.** The `Schedule | Commitments` toggle is gone. There is one
  list and a **Group by** control that arranges it by bill or by due date — same records, same
  filters, the coach choosing which question is on top.
- **The list opens folded**, one clean line per bill carrying its next due date, what is still
  owing and how late it is. Nothing is hidden by the fold; that is the test.
- **Opening any bill shows the whole story** — the schedule, every payment, what is left — and
  opens on a fully paid bill too.
- **A bill can hold any number of payments.** **Repeat monthly** builds the whole run: pick the day,
  say when it stops and what each costs, and the rows appear. Then change any date, retype December
  for a rate rise, add a row, remove one.
- **Changing one payment in a series asks how far it should reach** — this payment only, this and
  later, or all unpaid — each option showing how many it would touch, and the question skipped when
  it has only one answer.
- **Status is a dropdown with counts** — Outstanding, Overdue, Partly paid, Paid. This is now the
  convention on every reporting screen.

## Who sees it

Head coaches and coaches with money permission on a paid team. **Read-only money assistants see the
same screens with no Record a payment, no Undo, no Edit** — unchanged. Nothing on the family or
player side changes.

---

## ⚠ Three things to know before this ships

**1. A file coaches keep loses four columns.** The commitments export drops *Deposit*, *Deposit due*,
*Balance* and *Balance due*, and everything after them shifts four columns left. Those headings could
only ever describe the first two payments, and a column headed *Balance* quoting payment 2 of twelve
is a lie a reader cannot detect. Nothing is lost — *Payments*, *Paid to date* and *Still owing*
describe a bill of any length, and the payment-schedule file has always had one row per payment — but
**a coach's own spreadsheet that points at our columns by position needs re-pointing once**. Taken
deliberately, in the release that made the headings wrong, rather than split across two.

**2. "Scheduled" changed meaning on Budget vs. Actual.** It now means *what you still owe*, not the
plan at face value, so a settled month reads blank and a part-paid one shows only the remainder.
⚠ **The accepted cost: the Scheduled row now shrinks as a season is paid down**, so it can no longer
be compared against Actual month by month. This was an owner ruling with that cost stated; it is the
one change here most likely to be wanted back, and it is walked in QA Part C.

**3. A money defect was caught in review, not by tests.** Removing a paid installment from a bill
could silently rewrite that payment to a different amount and move the team's books — under a message
that only promised to remove a row. It was found by three independent review passes, fixed, and
verified against a live database. **QA Part E now carries a step for exactly this**, and it is the
single most valuable check in the walk: remove a paid payment and confirm cash on hand does not move.

---

## Trade-offs taken

- **Bulk edits can never touch a payment already settled in full.** A deliberate restriction that
  removes the only genuinely dangerous action in the feature — a bulk change silently re-posting
  money that already left. Editing a settled payment one at a time still works, and the books follow.
- **Monthly is the only repeat.** The plan promised weekly and fortnightly; those were written before
  anyone checked what the product could actually do. Money going out to a vendor is billed monthly,
  and a control that gets refused is worse than one that is not there — so there is no cadence
  picker at all, just a button that says what it does.
- **A commitment no longer has a typed total.** It is worth what its payments add up to. The old
  total box was a second way of stating the same fact and drifted out of step with it.
- **The bigger build was chosen over four narrow patches**, which would have been faster and would
  have left the product unable to express the actual problem.

## How to try it

Money → Payables, on a paid team as head coach. **The full walk is QA §64** — Parts A and B are
done; C through H are the remaining work. In short:

1. **The screen** — one list, Group by, the folded default, the Status dropdown, a paid bill opening.
2. **A repeating cost** — build a monthly run, then edit and remove rows in it.
3. **The scope rules** — where a linked series can go wrong, including the money check above.
4. **The neighbours** — Overview, Budget vs. Actual, Transactions, exports, season close.
5. **The demo and the words** — the sandbox now shows a repeating bill; the help describes it.

## Success criteria

- A coach can record a payment for any amount, on any date, against any bill — including several,
  and including more than the bill is worth.
- Any payment can be undone and cash on hand returns to exactly where it was.
- No screen shows a record as locked that the product will let you edit.
- A monthly cost is set up in one sheet, and one month's amount changes without touching the others.
- No bulk edit ever changes a payment already settled in full.
- **Removing a paid payment never moves the books.**
- Every existing bill survived the change with its books unmoved (Part A — walked and passed).
