# Coach Dues Payment Record — PM Brief

**One line:** teach the coach portal the difference between what a player was *billed* and what
their family actually *paid* — so part-payments, changed dues, and honest reminders all become
possible at once.

## The problem, as a treasurer meets it

Dues are set at $300 per quarter. A family decides to send $100 a month instead — same money,
different rhythm. Today the product cannot record that. There is no "record a payment" anywhere:
an installment is either untouched or stamped fully paid in one click. So the paying family shows
$0 paid, sits in the "haven't paid anything yet" list, and the automatic reminder emails tell them
they owe the full $300 with "no dues payments yet" — the only money message a family ever receives
from us, and it's wrong.

The workaround coaches will find (logging the $100s as credits) is worse: the money never reaches
the team's books, the exported spreadsheet shows "Paid $0.00" beside "Status: Fully paid" in the
same row, and the season-end refund calculator schedules that family to be **refunded** the $300 it
thinks they never owed.

## What changes for a coach

- A **Record payment** button: amount, the date the money actually arrived, how it arrived, an
  optional note. The sheet shows where the money lands before saving. "Mark paid" stays as a
  one-tap shortcut for the exact-amount case.
- The dues table's **Paid column finally means money received**, whatever rhythm it arrived in;
  "Partial" starts appearing for the people it was always meant to describe.
- The player drawer gains a **Payments list** — each payment is a receipt with its own date and its
  own line in the team's books, dated the day the money arrived (not the day it was typed in).
- **Changing dues mid-season stops being blocked** for anyone who has paid something: their money
  stays exactly as received, and only the unpaid remainder is re-spread across the season.
- An overpayment asks one question ("keep the extra as a credit?") instead of deciding silently.

## What changes for a family

Reminder emails chase **what's actually left** ("$100 remaining of the $300 due Sep 30") and thank
the family for what's arrived. Nobody with a recorded payment can ever again be told they've paid
nothing. Families see nothing else — there is deliberately no family-facing money screen.

## What deliberately does not change

Credits (fundraiser rebates, contributions) stay credits and never count as income; posted book
entries are never rewritten; the two balance figures keep their names and jobs; everything stays
live-season-only; org-level accounting and the free coach fee path are untouched.

## Priority and status

High — this was the sharpest customer-facing money defect in the coach portal (families dunned
for money they were sending), found during the Generate Installments redesign 2026-08-13.
**FULLY BUILT ON DEV the same day**: inventory (16 surfaces) → published mockups → all six owner
rulings → three build passes → a compact reminders row with an email preview → `/simplify` and a
high-risk `/review` (2 Criticals + 1 High found and fixed — the review log in the plan is worth
reading). Awaiting: owner browser QA (ledger §13), commit approval, and prod migration at the
next release. Refund credit provenance deliberately descoped to an owner discussion.

## Pass 4 (2026-08-14) — "where did this family's money go?", and a re-run that stops flattening people

Three things a coach gets, all from one owner review of the player ledger:

1. **The ledger answers the whole question, not a quarter of it.** Each installment now shows what
   was billed, what fundraising took off, what has arrived, and what is still owed — and the four
   season figures at the top of the record are literally those four columns added up, so it reads
   left to right as one sentence instead of four unrelated facts. The "Credits −$250" tile became
   "After fundraising $550": the result rather than the deduction, because a negative among
   positives was the one figure people had to stop and decode.
2. **On a phone, an installment is one line until you tap it** — its date and what's owing (or
   *Paid*, or *Covered*). A twelve-payment season now fits on one screen, and the only rows wearing
   a number are the ones that need attention.
3. **Re-running the team's dues no longer silently destroys per-player arrangements.** This was the
   real find. "Set dues for all players" gave everyone the identical schedule — a hardship plan, a
   deposit-then-balance arrangement, a mid-season joiner's prorated dates, all flattened without a
   word. The confirmation now **names those families** and offers **"Keep the ones I set by hand"**
   as the default answer, with "Apply to everyone" still one click away. It also says when due
   dates families already have are about to move, since the reminder emails will start quoting the
   new ones. **We deliberately did not lock the schedule mid-season** — re-running is a legitimate,
   common need, and a lock would have blocked the honest case while missing the damaging one.

Also: the per-installment **"Mark paid"** button is now **"Record as paid"** — it always did write a
real receipt, and the old name made coaches reasonably ask what the difference was from Record
payment. And a **live production defect** was found in the same screenshot: paid rows had been
showing the words "Paid Invalid Date", and the same family of bug was showing every due date one day
early on the admin allocation screen. Both fixed.

## Success criteria

- A coach can record any amount on any date and the books show it that day, for that amount.
- The $100-a-month family reads as "Partial — $200 of $300" on every surface (table, tiles,
  digest, Ask, export) with no two surfaces disagreeing.
- No reminder path can quote a figure that ignores recorded payments.
- Season-end refunds distinguish real credits from money that went through the books.

Plan: `COACH_DUES_PAYMENT_RECORD_PLAN.md` · Mockup:
https://claude.ai/code/artifact/ccc923b8-e6f3-4a1e-b972-95fc2b809185
