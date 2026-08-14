# PM Brief — Player Dues "By installment" lens

**Status: on prod 2026-08-14 (job 256), owner QA still owed (ledger §17). No migration.**

## What the coach sees and does differently

The Player Dues screen gains a small switch: **Season totals** (exactly today's table — still
what opens by default) and **By installment**. The new view answers the two questions the page
couldn't before:

- **"How is installment 2 going?"** — a Collection schedule strip across the top, one box per
  installment, in the same style as the Budget tab's plan card: *$920 of $1,200 · ⚠ $280 still
  to collect · 2 behind*, with the due date and a little progress bar. Nothing is flagged
  before its due date — a future installment reads calmly ("2 of 6 paid early · due in 18
  days").
- **"Where is each family, installment by installment?"** — a grid: one row per player, one
  column per installment, each cell showing ✓ paid with the date, "$120 of $200" for a part
  payment, ⚠ overdue, or a quiet "upcoming". Two closing columns: **Due next** — what that
  family owes *right now* (anything past due plus the next installment, the number a coach
  most often comes to check) — and the familiar Balance.
- **On a phone** the grid becomes tap-to-open cards, one per player, closed on that same
  due-next figure ("$280 · ⚠ $80 past due + $200 due Sep 1"). Opening a card shows the
  installment list, the season balance, and a "Full record" door to the usual player panel.

## Why it matters

Treasurer-coaches mid-season think in installments, not season totals — "who still owes me for
installment 2?" previously meant opening every player one by one. This puts the whole team's
installment picture on one screen, and puts "what do they owe me right now" first, which is the
most common reason a coach opens this page at all.

## What deliberately didn't change

The default view, the player panel, recording payments, credits, reminders, exports, the chase
card, and the refund calculator are all untouched. Credits still show against the season
balance (not inside an installment), so the due-next figure always matches what reminder emails
ask a family for. Read-only assistants and archived past seasons behave exactly as the rest of
the tab does.

## How to try it

Money → Player Dues on any team with dues schedules (the QA money teams are seeded) → click
**By installment**. Squeeze the window to phone width to see the cards. The address bar carries
the view, so a bookmarked link reopens the same lens.

## Success criteria

Owner QA §17 passes; coaches stop opening players one-by-one to answer installment questions;
the two views never disagree on a single figure (collected, balance owing, remainders).
