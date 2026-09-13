# PM brief — An Adjustment is limited by the bill, not the balance

**Plan:** `COACH_DUES_ADJUSTMENT_HANDBACK_PLAN.md` · **Project hub (mockup, this brief, the plan
and decisions, one URL):** https://claude.ai/code/artifact/4ce67727-c449-41ed-bb78-3da5da22d8c1 ·
**Status:** ruled and built on dev 2026-09-12 — the hand-back question went option 1 (a write-off
lands on the bill straight away, like forgiveness), wording accepted as drawn; owner QA walk on the
hub's QA Walk tab · **Priority:** small — no migration.

## The problem, for a coach

An Adjustment lowers a family's bill — "$17.00 off, team photos never got ordered." The only
sensible limit on it is the bill itself: a $900.00 bill can be written down by up to $900.00, whether
the family has paid none of it, half of it, or all of it.

Today the limit is what's still *owed*. So a family who has paid $500.00 of $900.00 can only have
$400.00 written off. A family who has paid in full can't have anything written off — the form refuses
with *"nothing left owing."* And on a team that settles up at season's end, it refuses no matter what.
The coach's intent hasn't changed in any of those cases. The bill is lower. The system just won't let
them say so.

The two workarounds both lose something: paying the family back directly leaves the bill on record
at $900.00 with no reason anywhere; editing the schedule down replaces the coach's reason with a
fixed system sentence and quietly rewrites what the family was "always billed."

## What changes for the coach

The write-off goes through, on any team, up to what's left of the bill. When it's bigger than what's
still owed, the form says where the rest goes before the coach saves: *"This is more than is
currently owed — $17.00 becomes a credit this team can hand back to the family."* If they try to
lower the bill past zero: *"An Adjustment can't lower this bill by more than what's left of it —
$883.00."* Same form, same fields, same place it shows up afterward.

## What a family sees

Their statement shows the same reason next to the same amount, in Adjustments & forgiveness, as it
always has. If they'd already paid more than the lowered bill, the difference shows as a credit the
team owes them back.

## The same rule from the other side — and it's a gap today

If write-offs can't exceed the bill, the bill also can't be lowered beneath its write-offs. Right
now nothing stops that: a family with $600.00 written off can have their schedule edited down to
$300.00, and the drawer then reads *Dues −$300.00* — with the extra $300.00 showing up as a credit
the team "owes back" that nobody ever paid. Both doors that lower a bill (editing one family's
schedule, and "Set dues for all players") will now refuse in that case, by name, with a plain
sentence — *"This family has $600.00 written off — a $300.00 bill would be less than that. Lower or
remove the adjustment first."* — the same way they already refuse a raise that would break a
payout. The roster-wide door refuses only the affected families and lists them in its preview.

## What doesn't change

- A bill can never be lowered below zero, and never below what's already been written off it.
- Nothing is ever handed back to a family that they didn't actually send. On roll-forward teams the
  existing arithmetic already guarantees this; on hand-back teams it's the one open question below.
- No installment picker, no new step in the form, no new setting.

## The hand-back question — ruled

On a "settle at season's end" team, credits don't touch the installments until then — so a write-off
would have read as "owed back" in full the moment it was saved, and the mid-season Pay out door
would have offered it even to a family who hadn't paid anything yet. **Ruled (option 1):** a
write-off lowers the bill immediately on those teams, the way a forgiven amount already does there.
One rule everywhere. The one visible change on hand-back teams: a mid-season write-off lowers the
next installment instead of coming back at season's end, and the setting's own hint now says so —
*"Money credits wait for season's end — a bill the coach lowers is lower now."*

## How we'll know it worked

- A coach can write off any part of a family's bill with a real reason, regardless of what's been
  paid, and it shows up in Adjustments & forgiveness exactly where every other write-off lives.
- A family who paid $500.00 of $900.00 and had the whole bill written off is owed back exactly
  $500.00 — never more.
- On a hand-back team, a family who paid nothing and had their bill written off is offered nothing
  to pay back.
