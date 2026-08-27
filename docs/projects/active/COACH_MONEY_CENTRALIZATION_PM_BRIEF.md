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

---

## What P3 shipped: tags earn their keep, and the leftovers go (2026-08-25, dev)

Owner QA **§104**. No migration. This is the small phase — tags, three bits of debt, and a
portal-wide tidy of one visual habit.

### Tags finally answer the question they were kept for

When the owner ruled that money tags should stay, he said exactly what they were for: *"maybe they
have items for tournament fees and deposits but want to tag each one with the tournament name,
later filter by how much they paid for a specific tournament."*

A budget item says **what kind of cost** something was. A tag says **which occasion** it belonged
to. So the question a tag exists to answer is *"what did the Summer Classic actually cost us?"* —
and until now the product could narrow the list and then leave the coach to add the column up
themselves. **Transactions had no total at all.** Payables had one, written back-to-front.

Now: the row of little tag buttons becomes a **Tags dropdown** sitting with Show, Status, Item and
Date — the same shape as everything beside it, with a count against each label. It takes **several
tags at once**. And whenever a tag is on, a line above the list states the answer, money first:

> **$1,240.00** across 3 costs tagged **Spring Classic**

The same line, the same shape, on **both** money screens. On Payables it counts commitments; switch
that screen to read by due date and it says *"across 5 payments"* — because the rule is
that the line totals **whatever is in front of you**, not a figure computed off to one side. The old
Payables line said "3 commitments" while the screen showed five dated payments; that is fixed.

One small thing goes with it: the colour key explaining that blue tags belong to the whole club used
to sit under the Payables toolbar only — so the other screen showed blue tags and never said why.
The colour now sits in the dropdown itself, on both screens, and the key is gone.

### A bug a coach could hit any day

On **Player Dues → Add credit**, the *Kind* list offered **Forgiven** and **Reimbursement**. Neither
is something a coach creates by hand — forgiveness is granted from the settlement sheet, and a
reimbursement is created by an out-of-pocket expense. The server has always refused both. So a coach
who picked either filled the whole form in, pressed Save, and got a bare error with no explanation.

Both are off the list. Existing credits of those kinds still name themselves correctly.

### Red stops meaning "required"

Required fields have always carried an asterisk. On most forms it was **red**. Red in this portal
means something has gone wrong — money owed, a payment overdue, a save refused — and a field is not
in error simply for being required. The asterisk already carries the meaning; the colour was
spending a signal that real failures need.

Every required field still has its asterisk, in the same place. It is now the label's own colour.
Nothing else moves. Two screens — Player Dues and the money record form — were using **both**
treatments, so this also makes those screens consistent with themselves.

### Two things nobody could see, and now can

**The automated layout check had never looked at this feature.** The tag control hides itself when a
team has no tags, and the test fixture only ever created *game* tags — so every sweep of both money
screens walked past an invisible control and came back green. The fixture now carries money tags,
one of each kind.

**The demo could not show tags either.** No money tag had ever been seeded into the coach sandbox,
so no prospect has ever seen this. The mid-season team now carries a *Spring Classic* label
deliberately spanning two different budget categories — which is the whole distinction — and a
club-shared *Club permits*. The Transactions tour gained one closing sentence about it, naming no
figures so a reseed can never make it wrong. ⚠ **The demo needs a reseed for this to appear**; the
nightly job only moves dates.

### Success criteria

- A coach can answer *"what did that tournament cost us?"* without adding anything up.
- The figure reads the same on both money screens and on both Payables arrangements.
- Nobody can pick a credit kind the system will refuse.
- Red, in the coaches portal, means something is wrong — and nothing else.

## The P3 follow-on: the number on a filter now means what you'd expect (2026-08-26, dev)

Found by the owner while walking §104, with a filtered Transactions screen in front of him: the
**Tags** list offered *test tag (1)* while the band directly beneath it read *$400.00 across 3
costs*. Both numbers were correct and they were counting different things — the option counted
**labelled records**, the band counted **rows on screen** — and a cost paid in three installments is
one record and three lines.

### What a coach sees now

The number beside a tag tells you **how many rows you will see if you tick it**. It matches the band
underneath, always, on every money screen:

- **Transactions** counts the lines in the register.
- **Payables**, arranged by commitment, counts bills — one commitment is one, however many
  installments it carries.
- **Payables**, arranged by due date, counts the individual payments. The number changes when you
  change the arrangement, because the arrangement changes what is on screen.

It also respects the rest of the toolbar. Narrow the date window past everything a tag is on and it
reads **(0)** — still listed, so you can always undo the thing that emptied the screen, but honest
about what picking it would show.

### A club bill was ignoring the tag filter completely

On a team whose club bills it, filtering Payables by an occasion left **every club bill** sitting in
the results — they were added to the list after the filter had already run. The caption underneath
counted only the tagged team bills, so it disagreed with the rows above it. Club bills now drop out
of a tag-filtered list, which is what the register has always done with rows that cannot carry a
label.

### The fold button — a change we built and then took back

Raised in the same breath: *"can we remove Open all? seems like a button no one will select."* It
turned out to be one button with two labels — it only says "Open all" because bills arrive folded,
and the same button says "Fold all" everywhere else, so removing it would have removed both. What
looked wrong was smaller: with a single commitment on screen it was offering to open one row. So we
hid it below two groups and let a lone commitment arrive already open.

**The review found that this broke something worse.** The screen remembers which bills you have
opened as *differences from the default*. Tying the default to how many bills are on screen meant
that every time a filter narrowed the list to one, every remembered click reversed: open a bill,
tick a tag that narrows to it, and **the bill you were reading folded itself shut** — with the bulk
control gone at the same moment.

Shown both options drawn side by side, the owner chose to leave folding alone, and gave the rule
that decided it: **a filter narrows content; it does not change the shape of the screen.** That rule
also rules out hiding the *button* whenever a filter narrows the list, so that came out too.

**So folding behaves exactly as it did before this work** — and the original complaint is recorded
as still open. If the button is ever to disappear for a one-commitment team, the test has to be what
the team actually has, not what the current filter is showing.

### Success criteria

- The number on a tag and the figure beneath the toolbar never disagree.
- A tag never disappears from the list while its filter is the reason the screen is empty.
- A tag-filtered Payables list contains nothing the tag is not on.
- Ticking a filter never folds, unfolds, or removes anything a coach had set for themselves.
