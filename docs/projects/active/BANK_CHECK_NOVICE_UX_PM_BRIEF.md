# Bank check through a volunteer's eyes — PM brief

**Plan of record:** `BANK_CHECK_NOVICE_UX_PLAN.md` · **Evaluation:** https://claude.ai/artifact/SDTnvjwNmq5HUUhAyj7BVF
**Status:** started 2026-11-08; every owner question ruled; Stage S1 next.

## What this is
The bank check lets a coach or a club treasurer type what their bank says and see whether their records agree. It works,
and it was walked and passed. An evaluation through a volunteer's eyes found it *helpful, and buried*: nothing says what
it is for, the way to it is a fourth option in a dropdown, and its words ("statement", "books", "starting point") are an
accountant's. This project fixes the words, the door and the small-gap paths, and adds a proper way to work on a check
over more than one sitting.

## What changes for the person using it
1. **It says what it is.** "Check your bank balance", a one-line purpose under the heading, "Date" instead of "Statement
   date", and one plain note instead of three (Stage S1).
2. **The treasurer starts where they mean to.** The club's first step asks for the first statement they want to check,
   its start date and opening balance, and then checks that statement straight away. Nothing before it is silently
   skipped, and the dead end a same-day start caused today is gone (S1b).
3. **They can find it.** The Overview invites a first check in every season stage, the view links to its help, and a
   reload or a shared link lands on the same view and account (S2).
4. **A $4.50 bank fee takes one click.** "Record a bank fee" fills the amount, the date and the category, and a gap no
   line explains no longer opens a 31-line list (S3).
5. **The printed check says how it was worked out**, so it doesn't seem to contradict the screen (S4).
6. **Start, work, save for later.** The person fixes the statement's date and balance at the top, works the difference,
   and can leave and come back on any device before saving the check for good (S7).

## Why it matters
Volunteers aren't accountants. A check they don't find, or don't trust, is a check that never happens, and the club's
money goes unchecked until a problem is large. This turns a working feature into one a volunteer will actually use.

## Who sees what
Coaches and club treasurers who can record money do everything above. People who can only view money see the saved
checks and the printed check, never the form. Nothing changes who can see a team's money: the club still sees no team
bank figure.

## Priority and order
S1 words → S1b the start → S2 the door → S3 the fee door → S7 save for later (drawn first, then built). S4 can run any
time after S1. Two ideas are parked: a second Save button on a phone (decided after S3) and a reminder of how old the
last check is.

## Success looks like
- A volunteer who never opened Help can say what the check is for after one look.
- A first-time treasurer's first check covers the statement they meant to check.
- A bank-fee gap is closed in one click.
- Half-done work comes back on another device after "Save for later".
- Each stage's owner walk passes.
