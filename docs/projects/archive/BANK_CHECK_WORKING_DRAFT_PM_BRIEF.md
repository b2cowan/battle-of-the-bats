# PM brief — Bank check: work it down to zero

**Plan:** `BANK_CHECK_WORKING_DRAFT_PLAN.md` · **Priority:** a follow-up to the bank balance check, after its owner walks (BC9). Not a launch gate.
**Status (2026-11-07):** the club card committed `2a64a87d8`; the coach card (the same memory, with the cash not deposited yet, "+ Record"
and "Record the missing amount") committed `47bd64918`; WD3 built 2026-11-07 (the coach card says "recorded" in Find, owner ruling; "…until you save this check or sign out."; a "Work it down to zero" part in both help articles), committed `2bfb18af1`; the two owner walks, Owner QA Ledger §490 (club, 20/20) and §491 (coach, 17/17), both PASSED by the owner 2026-11-08.

## The problem
A treasurer sits down with the bank statement. Today they can type the statement balance and watch "Off by" — but if they
then go to the Ledger to book the missing cheques, the screen forgets what they typed. They start over each time, and a
number that is off by a lot feels like something to "hope" to fix, not something to work down.

## What changes for the customer
- Type the statement balance once. Leave to book transactions. Come back: it is all still there, and "Off by" has moved.
- The screen shows the journey: a quiet line, "Started off by $412.00", beside the live "Off by $187.00".
- An "Add entry" button on the card (coaches: "Record"), named like the Ledger's own button, lets them enter a statement line without leaving, and watch the number fall.
- Coming back to the browser tab refreshes the number, so a line booked in another tab shows up.
- Saving the check is still the moment they finish. They can save while it is still off, as today.

## Why it matters
The people doing this are volunteers, not accountants. A number that visibly counts down to zero teaches the task without
a lesson. It also removes the quiet failure where someone gives up halfway because the screen lost their place.

## Who it affects
Club treasurers and administrators (Accounting → Bank, desk and phone), then coaches doing their team's check (Money →
Ledger → Bank). Readers see no form, so no change for them.

## What we deliberately did not do
No line-by-line ticking (the accountant's way). It stays possible later and nothing here blocks it. No shared drafts between
two people. No change to how the check adds up.

## Trade-off to rule on
The draft is remembered **on the device the person is using** (recommended: simple, nothing new on the server, nothing to
release). It does not follow them from a laptop to a phone. Remembering on the server fixes that but costs a database change
and a production step. Ask 1 in the drawings.

## Success looks like
- A treasurer can start a check, leave, book three transactions, return, and finish without retyping anything.
- In the owner walk, "Off by" visibly falls as lines are added and reads "Matches" at zero.
- No new wording a non-accountant would stumble on; no change to the printed report.
