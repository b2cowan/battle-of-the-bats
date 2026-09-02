# The dues forms — PM brief

**Status:** owner-ruled 2026-08-30 (Owner QA Ledger §123). Not started. No schema change.
Plan: `COACH_DUES_FORMS_PLAN.md`.

## What this is, in one line

The five forms a coach uses to set, correct and settle what families owe are brought up to the
grammar the rest of Money already speaks — and two silent money defects underneath two of them are
closed.

## Why it matters

**Two of these are real money, and neither is visible on screen.**

A coach who lowers a family's dues below what that family has already paid gets an automatic credit
for the difference, which is right. But the product cannot see the credits it creates this way, so
doing it twice credits the family twice, and putting the total back leaves a credit standing that
nobody is owed. A family can end up holding a thousand dollars of credit against six hundred
dollars of genuine overpayment — or keeping four hundred dollars off a bill they owe in full.

Separately, a coach who hands a family their credit back in cash and then corrects the dues total
upward deletes the credit that payout was standing on. The books then say the family was owed
nothing, and the money is already gone. This is the identical hole the sponsorship work closed five
days ago; the refusal already exists and simply is not asked here.

**Everything else is the same consistency question the review was set up to ask.** The clearest
example: *"Record is for money that has already moved"* is the product's flagship rule. It is
enforced when money goes out. It is enforced on sponsor cheques. It is not enforced anywhere on
dues — so a coach can record a family's payment dated next March, watch their bill drop today, and
have the money land in next March's income. One branch across in the same window, the identical act
is refused.

## What a coach sees change

- **Nothing silently goes wrong with a family's credit any more.** Where a correction would leave
  the books owing a family less than they have already been handed, the product refuses and says so
  in dollars — and offers a link straight to that family's payouts so the refusal is actionable
  rather than a dead end.
- **A payment cannot be dated in the future.** The coach gets the same plain sentence the
  sponsorship screen already uses.
- **One name for setting everyone's dues.** Today the same act is called four different things
  between the button, the window, the confirm and the help guide. It becomes
  **"Set dues for all players"** everywhere.
- **The single-player schedule form stops being the poor relation of the roster-wide one.** It gains
  a name, a running "3 installments, $1,200 — matches the total" sentence *while the coach types*
  instead of an error after they save, the roster form's proven row layout on a phone, sensible
  column widths on a desktop, tappable controls, and — the one most likely to be felt — it stops
  throwing away a hand-built payment plan when the coach clicks slightly off target.
- **Add a credit says what it does** before the coach commits: *"nothing changes hands — Riley's
  family owes $60.00 less, taken off their last payment first"*, following whatever credits rule the
  team set months ago.
- **The end-of-season refund sheet stops hiding things.** Every option shows what it would pay that
  family, whether or not it is the one currently chosen; a blank amount refuses instead of quietly
  meaning zero; and a failed save appears on the sheet the coach is looking at rather than on the
  window behind it.
- **A view-only money assistant stops being shown three doors the server will refuse** — adding a
  credit, editing one, and setting a schedule.

## What it does not do

The forms stay where they are. Nothing is folded into the recording conversation, and the one-tap
*Record as paid* buttons stay exactly as they are — no questions, forever.

## Tradeoffs taken

- **The whole schedule form at once, not in slices.** It is one form; splitting the heading, the
  layout, the tap targets and the guard means touching it four times.
- **Two phone-width findings were downgraded rather than carried.** The first pass called the credit
  and correction forms broken at 360px. Measured, they are tight but nothing is cut off. They ride
  along with the layout pass and are the first thing to cut if it shrinks.
- **The consequence-sentence sweep was ruled for all seven forms across the whole review**, not just
  the three here — so the later walks inherit a decision instead of re-litigating it.

## Priority

**The two write-path fixes are the priority and should ship first.** They are the only items where
delay has a cost measured in a family's money. Everything after them is consistency work that has
waited since August and can wait a little longer.

There are no live customers with real families on production today, which is what makes this
sequencing acceptable rather than urgent. That protection ends at the first live customer.

## Success criteria

1. Repeating a dues change, in either direction, leaves a family holding exactly the credit they are
   owed — proven by a test that exercises the real path, not the calculation in isolation.
2. No dues screen accepts a payment dated in the future.
3. A correction that would strand cash already handed to a family is refused before anything is
   written, and the refusal tells the coach where to go.
4. A customer reads one name for setting everyone's dues, help guide and search included.
5. Every control in these five forms is tappable on a phone and a tablet.
6. A coach cannot lose a typed schedule to a stray click.
