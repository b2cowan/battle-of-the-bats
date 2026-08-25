# PM Brief — One Conversation for Money (Coach Money Centralization)

**Status: direction approved AND all three rulings taken by the owner 2026-08-21. The mockups are
the spec; ready to build. Nothing built yet.** Plan: `COACH_MONEY_CENTRALIZATION_PLAN.md` · Build
prompt: `COACH_MONEY_CENTRALIZATION_BUILD_PROMPT.md` · Mockups (spec):
`https://claude.ai/code/artifact/783efa1e-98e1-4c36-8083-f3e568f46844`

## The problem, in the owner's words

*"I still feel like I have to go to too many places to log different transactions, and as a user it
feels confusing."* Five money screens each grew their own way of writing money down, in different
months, with different words. The bookkeeping underneath already thinks one way; the screens don't.

## What changes for a coach

**Recording money becomes one conversation, everywhere.** Whenever money actually moved — a parent
e-transferred dues, the bottle drive brought in $80, the team paid the umpires, a club bill got
settled — the coach meets the same window, with the same questions in the same order, ending in the
same plain-English sentence stating exactly what will happen before they save.

- **One button on the Money hub — "Record".** Sunday night with four e-transfers and a receipt, the
  coach taps it five times and answers a question they always know: *who was the money with?* — "a
  family paid their dues", "fundraiser money came in", "we paid for something", "we settled up with
  the club". Each answer files itself onto the right book, the right child's bill, the right drive.
  Today that pile has no home: the coach must first work out which tab each item belongs to, and
  the ledger — the one screen that shows everything — is the one place that refuses most of it.
- **Standing in context stays the fastest path.** The button on a player's dues row, a drive
  leaderboard row, or a bill still opens the recording window instantly — with the first questions
  already answered by where the coach is standing. Nothing gets slower; there's just nothing
  separate to learn anymore.
- **The other screens keep their real jobs.** Fundraising is where you set up and run a drive;
  Dues is where schedules, credits and the season settlement live; Payables is where commitments
  and their schedules live; Club is your back-and-forth with the club. What they lose is only their
  private dialects — "Mark paid", "Log amount", "Record payment", "Add" all meant the same act.

## Why this matters

The confusion was never distance — everything already lives behind one Money door. It was that the
product made the coach answer the filing question in their head before it asked anything. Now the
product asks it, once, in the coach's own words. Fewer things exist afterwards: one form instead of
five, one method list instead of three, one vocabulary instead of five.

## The three calls — all made (owner, 2026-08-21)

1. **A payment learns who paid it: YES.** A parent covering the $200 deposit on the team's $600
   tournament entry gets an honest record — the family fronted that one payment, and the team owes
   them exactly that. Because it touches real money owed to real families, it's built as its own
   careful phase with correction-safety as the bar.
2. **Payables stays, for now.** A place to see and plan future money owed still makes sense.
   Whether it eventually folds into the ledger is re-explored — by the owner, after living with the
   new forms — never decided by a build session on the way past.
3. **Tags stay, with a real job named.** A tag is the *occasion* label a budget item can't express:
   the item says "tournament fees", the tag says "Summer Classic" — and filtering by that tag
   answers "what did the Summer Classic actually cost us?" The ledger's tag filter becomes the
   standard counted control, and a filtered view always shows its total.

## Success criteria

- A coach can empty a pocket of receipts from one place without deciding first where each belongs.
- Recording from a row is exactly as fast as today, and reads identically to recording cold.
- One verb, one method list, one consequence-line style across every money surface.
- Fewer forms exist than before; no new screen exists that didn't.

## Sequencing

The phone money-list rework (the "huge tiles, ton of scrolling" complaint) is deliberately a
separate, later session — this work reduces how many screens that one must touch. In-app help and
both public demo sandboxes must be re-read when this ships; money vocabulary is exactly where demo
sentences go quietly stale.

---

## What P2 actually shipped, and the two things it reversed (2026-08-23, dev)

**P2 was gated on four questions. All four were answered by the owner, and two of the answers
undid work that had passed QA six days earlier.** That is worth saying plainly in a brief, because
both reversals made the product simpler rather than larger.

### Record now means one thing: money that has already moved

The recording form used to ask, inside "we paid for something", *has it been paid?* — and answering
*not yet* opened a schedule editor. It was the only place in Money where writing something down
produced a **plan** instead of a **transaction**, and it quietly gave a coach three different ways
to create an unpaid thing: that fork, leaving the date blank, or typing a future date.

All three are gone. Everything recorded here has a date and has actually happened. Something the
team has *agreed* to pay is a payment schedule, and payment schedules are made on Payables with
**Add a commitment** — which therefore keeps its button while Transactions' plain **Add** retires.
Type a future date by mistake and the form says so and hands you that door, carrying everything you
had already typed.

The sentence a coach can now hold: *schedules are made where schedules live; Record is for money
that moved.*

### And it can finally do the thing it could not do at all

From the Record button there was previously **no way to pay down a bill the team already owed** —
you had to go and find that bill first. Now the branch's one field offers **Bills you owe** at the
top of its list, above your budget items, each with what is still owing beside it. Type what you
paid for; if it is something you already owed, it is the first thing you see. Pick a bill and the
form becomes a payment against it — no second description to write, an option for which installment
it lands on, and a line naming what the bill drops to before you save.

Nobody has to decide in advance whether their payment is "a cost" or "a payable". That was the
habit this project set out to break.

### Every door is the same door — and a door that names one record locks

A family's row, a drive row, a bill's row: all of them now say **Record**, and all of them open the
same window a coach already knows. Opened from one of those, the answers arrive **stated rather
than offered** — *"A family paid their dues — Jenny Alvarez · Owes $252"* — with no dropdown and no
picker underneath.

That lock is a defect fix, not a restriction. Before it, a coach could open Jenny's row, change the
question to something else, save, and land back on a page where nothing had changed, with money
filed against a completely different thing and no clue on screen. Wrong family? Close and reopen.

Pressing **Record** from the top of a *tab* is a different matter: a tab is a guess, not a record,
so it pre-answers for that tab and stays changeable.

### What deliberately did not change

The one-tap shortcuts still don't stop to ask — **Record as paid** on a dues installment, and the
club installment's button, which kept its single tap and only changed its name (it had no amount,
date or method to ask for anyway). **Editing** stays where the record lives, because correcting
something is a different act from writing it down; the drive's **Edit amount** even gained the date
field it was missing, so a date the new form can set is a date the old screen can fix.

### The quiet repairs that rode along

Two things were found while wiring this and closed in the same pass: a back-dated fundraiser amount
that later earned a family credit stamped that credit with today rather than the day the money
arrived; and the mechanism that keeps the Record chooser's live figures fresh after a save had been
written but never actually switched on.
