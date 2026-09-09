# PM brief — A bill lowered is not a collection

**Plan:** `COACH_DUES_ADJUSTMENTS_LOWER_THE_BILL_PLAN.md` · **Rulings:** owner, 2026-09-09 ·
**Status:** not built · **Mockup:** https://claude.ai/code/artifact/b529dd67-a2e1-4f00-95ce-b246d6cc086c

## The problem, in one sentence

When a coach lowers what a family owes — a discount, a forgiven bill — the product currently counts
it as money the team collected.

## What a coach sees today, and why it's wrong

The Player Dues screen opens with four figures. A coach reads them left to right and subtracts:

> Dues **$11,308.30** − Collected **$2,225.00** = $9,083.30 … but Balance owing says **$7,349.32**.

The band does not add up, and the tile needs two lines of small print to explain why. Worse, the same
season is reported differently on Budget vs. Actual, so a treasurer comparing the two screens finds a
gap and no way to close it.

The cause is that **Collected** is a hybrid — cash, but only the part that landed inside a bill —
while credits that lower a bill without any money existing are quietly mixed into the picture.

## What changes

**A bill lowered comes off the bill.** An adjustment or a forgiven amount reduces **Dues**, and
therefore **Balance owing**, and never appears in **Collected**. Collected becomes money and nothing
else: cash families sent, team bills they paid directly, and fundraising credited to their dues.

The band then reads as one sentence, and closes:

> Dues **$11,291.30** *(after $17.00 of adjustments)* · Collected **$5,124.63** *($1,182.65 of it
> beyond what those families were billed)* · Balance owing **$7,349.32**

**Nothing a coach does changes.** No family's balance moves, no bill is recalculated, no one owes a
dollar more or less than they did yesterday. The screens describe the same season more honestly.

## Three things that follow

1. **Two reports stop disagreeing.** Collected becomes exactly the figure Budget vs. Actual has been
   reporting for dues all along — **$5,124.63 on both screens**. Not a coincidence to be maintained:
   they become one calculation, so they cannot drift apart again.
2. **The season's plan stops counting money that was written off.** Today the report plans to collect
   dues that a coach has already forgiven, so it reports a shortfall that isn't real.
3. **The Money Overview card gets an honest name.** "Collections" is renamed **Bills settled** and
   measures what it has always actually measured — how much of the bill is done. Left as it was, it
   would have read 45% while $7,349 was still owed, and its progress bar would pass 100% the first
   time a team fundraises well.

## What deliberately does not change

- **The installment list.** A family's installments keep showing what they were **charged**, with the
  adjustment beside them — so a coach can see *"we charged this, we lowered it by that, we received
  the rest"* on one screen. The owner's call, and the right one: netting the ladder would hide half
  the story.
- **Cash on hand and the Ledger.** They answer what the bank account did, and they are already right.
  Leaving them untouched is what allows Collected to answer a different question honestly.

## Priority and cost

**Medium — after the money work currently in flight.** It touches the dues band, the dues table and
export, the Money Overview card, the report's plan side, the help guide and the coach demo's money
narration. No data change and no migration: it changes what the figures read, never how a bill is
settled.

## How we'll know it worked

- A coach can subtract the tiles and land on the third one, with no small print required.
- The same season reports the same dues figure on both screens — **$5,124.63**, two ways.
- **Every family's balance is identical before and after.** This change is about vocabulary, not
  money, and twelve unchanged balances is the proof.
- On a season with no adjustments and nothing forgiven — most seasons — the extra caption never
  appears at all.
