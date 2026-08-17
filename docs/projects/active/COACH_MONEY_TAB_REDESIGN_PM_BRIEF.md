# PM Brief — the Money screens redesign: the split, the register, and the club tab

**Status: ALL FOUR PHASES BUILT ON DEV — P1+P2 2026-08-16, P3+P4 2026-08-17.**
Owner QA **§41 · §43 · §46 · §49**, all four owed, and the owner is walking them together in that
order. Migrations 246, 247 and 250 are applied to dev only.
**Plan:** [COACH_MONEY_TAB_REDESIGN_PLAN.md](COACH_MONEY_TAB_REDESIGN_PLAN.md)

## Phase 4 — what shipped to dev, in customer terms

**Two tabs became one, and club money finally reaches the report.** *Allocations* (what the club
bills the team) and *Payments* (what the team asks of the club) were two halves of one relationship,
and a coach had to hold both in their head to answer the only question either existed for: **where
do we stand with the club?** They are now a single tab called **Club**, which also gives back the
tab the split added — eight for a club-run team, seven standalone, exactly the count before this
project started.

**But the merge is the smaller half of what shipped.** The owner's question at the mockup review —
*shouldn't a request name which budget category and item it's tied to?* — found that **Budget vs.
Actual contained no club money at all.** Not the allocations the team pays, not the costs the club
agrees to cover. On a club-run team the club's bill is frequently the single largest line of the
season, and the screen whose whole job is *"how did we do against plan?"* had never seen a dollar of
it. The cause was exactly what the question pointed at: club money carried no category or item
anywhere, so even a report that went looking would have had nothing to file it under.

### What a coach sees and does differently

- **One screen for the club relationship**, opening with three figures: **still to pay the club**,
  **waiting on the club**, and what has **settled this season**. Underneath, what the club has
  billed (obligations, with due dates) and what the team has asked (the conversation) — in that
  order, because that is how the money flows.
- **Both club records now say what they're for.** A request asks *"What is it for?"* on the same
  search box the money form and the Budget Plan already use, and a coach files the club's bill under
  one of their own budget words when it arrives. That single field is what puts club money on the
  report — and until something is filed, the screen says so on the row rather than leaving a coach
  to wonder why their report looks light.
- **The word "Org" is gone from these screens.** The badges read **To club** and **From club**; a
  request awaiting a decision reads **Awaiting the club** rather than *Pending*, because that says
  whose move it is. It matches what the ledger has called this money since Phase 3.
- **Money asked for now shows in the forward view.** A request the club hasn't answered appears on
  **Transactions** when *include what's scheduled* is on — at the foot of the list, marked as
  undecided, with no date, because nothing records when a club will reply. It stays out of cash on
  hand and out of the budget plan. **This reverses a rule this project wrote down**; the owner's
  argument was that the forward view already carries a sponsor pledge, which is also money that may
  never arrive.
- **Last season is not on this screen.** Both lists show the working season and nothing else — the
  owner's ruling that seasons are independent, applied without exception.
- **The screen survives the end of a season, read-only.** Previously both tabs vanished the moment a
  season finished, so a coach could see the club's money on the ledger but could not open the
  workspace behind it. It is a record now, rendered in place with every button withdrawn.
- **A loose end stops a season closing.** A request the club never answered blocks the season
  close-out, beside the families who still owe — because with seasons independent, closing would
  leave it somewhere nobody looks again. The coach can chase the club or withdraw the request, and
  both the checklist and the refusal say so.

### Why it matters

The reporting gap is the part with money attached. A treasurer reconciling a club-run team's season
against its plan was reading a report missing its biggest line, with nothing on screen saying so.
That is now fixed, and the fix is a field a coach fills in once per record rather than a new
workflow.

The merge itself buys back a tab and removes a question a coach shouldn't have had to ask — *which
of these two screens has the thing I'm looking for?*

### Tradeoffs made honestly

- **Club money that has never been filed still counts, in the report's "Not itemized" row.** The
  money moved; hiding it would trade one silence for another. Existing records could not be
  backfilled — only a coach can say what a bill was for, and guessing would put invented
  classifications into a report someone reconciles.
- **A request where the club covers a cost files against the team's *spending* words, not its income
  ones**, and on the report it reduces that cost rather than counting as revenue. This is the same
  rule a refund follows, and it is the one design call most likely to look wrong at first glance —
  the QA walk flags it for exactly that reason. Getting it backwards would make a season look twice
  as good as it is.
- **The season-close blocker is a hard block, not a warning.** A coach cannot make a club office
  reply, so the only escape is withdrawing the request. It is flagged in the QA walk as the item to
  argue with, and reversing it to a warning is a one-line change.
- **Budget vs. Actual has no automated identity check** the way the ledger does, so whether club
  money lands under the right heading is walked by eye.

### Impact

No pricing or plan-gating change. **One database change (migration 250)** — both club record types
gain a category and item field. It is additive and optional, so it cannot fail a release, but the
code reads the new fields and must not reach production ahead of it. Coach QA walk is **§49**, and
it asks for the whole money quarter (**§38 → §41 → §43 → §46 → §49**) to be walked in that order,
since each phase reshaped the screens the one before it describes.


## Phase 2 — what shipped to dev, in customer terms

The form behind every money record asked three questions badly. It is now **two buttons and a tick
box**: **Expense** or **Income**, with **This is a refund** beside them. A refund is not a third kind
of money — it is money coming back on something the team paid for — so ticking it flips which way
the money moves and leaves the list of words alone.

- **Finding the right item is now typing, not hunting.** The category and item dropdowns became
  **one search box**: four letters of "diamond" finds *Facilities · Diamond permits*. A word that
  isn't there yet can be added without leaving the form — and the same box is now on the Budget
  Plan and the club's Org Budget, so the question is asked one way in the whole product.
- **Every word now belongs to one side of the books**, and the list follows the button you pressed:
  choosing **Income** no longer offers you *Diamond permits*. **Owner ruling** — it replaces an
  earlier decision that the direction should only re-order the list. Words a club or coach created
  had no side at all, so this needed a data change to be safe (below), plus a place to correct one.
- **New: Budget Plan → Manage our items.** Rename a word your team invented, or move it to the
  other side. Renaming changes what it's called everywhere; moving it across moves no money.
  Standard and club-shared words are shown read-only, with the reason.
- **Every state of the form now says what saving will do, in dollars**, on one line above the
  buttons — money leaving, money arriving, or nothing moving yet. **On a cost a family paid out of
  pocket it names that family and the credit they're owed.** This is what replaced the old
  read-only lock, so it carries the same weight.
- **Paid by folds away under More**, which is safe *only because* that line above the buttons
  cannot be collapsed. The fold's own label names what's inside, so the question is findable without
  opening it.
- **The save button says Save** on both a new record and an edit. Marking something paid still says
  **Mark Paid** — there the outcome is the point.
- **"A cost" is now "Expense"** on the Budget Plan too. One word, one meaning.

**Impact:** no pricing or plan-gating change. **One database change (migration 246)** — every budget
item is given a side and the field becomes mandatory, so no future item can be created without one;
it must reach production before this promotes. Coach QA walk is **§43**, and it flags the item
filter as the one decision worth reversing if browsing feels narrow rather than focused.

## Phase 1 — what shipped to dev, in customer terms

*Expenses & Payables* was one screen doing two jobs, and the ampersand in its own name was the
tell. It is now **two tabs**: **Transactions** (what has already happened) and **Payables** (what
the team owes, opening on the payment schedule).

- **Recording money that has already moved, and committing to pay later, are now separate acts.**
  The money form stopped asking *"already paid, or promised?"*; a commitment has its own door,
  **Add a commitment**, which states plainly that saving it **moves nothing**.
- **Marking a commitment paid now goes through the money form**, pre-filled, asking the one thing
  the record cannot know: **when the money actually left**. Back-date it and the cost lands in the
  right month. It settles that commitment rather than adding a second record beside it.
- **A commitment can finally have a due date when it isn't split in two.** The form had promised
  this and never had the field, so simple commitments saved with no date at all — invisible on the
  payment schedule and with no way to mark them paid. That was a live hole; it is closed.
- **Typing a future date into the money form is refused**, with a link that carries what you typed
  straight into the commitment form.
- **Nothing anyone bookmarked breaks.** Old links land on the right tab and rewrite themselves.

**One naming decision was taken against the plan** and should be revisited at P3: the arrivals list
is still called **Money in** rather than *Income*, because it holds income *and* money back, and
the product teaches those are opposites. P3's register splits them into real filters, which is
where the rename becomes honest.

**Impact:** no pricing or plan-gating change; no database change; the coach QA walk is §41.

## The idea in one sentence

The money area keeps one workspace per relationship — families, fundraising, the club, vendors —
and gains **one book where every dollar meets: a register with a running balance**, read the way a
coach reads their bank app.

## What a coach sees and does differently

- **Transactions becomes the team's chequebook.** One dated list of everything — money out and
  money in as their own columns, a balance beside each row that updates as you read down, each row
  named, filed under its category and item. The balance at today **is** the team's cash on hand —
  same number, guaranteed, because every movement that feeds cash on hand has a row here: typed
  expenses and income, refunds, dues payments as they arrive, fundraiser proceeds, sponsor money,
  club settlements.
- **Turn on "include scheduled" and the book keeps going past today** — upcoming dues
  installments, unpaid commitments, pledged sponsorships — with projected balances, so *"will we
  be short in March?"* is answered by reading down one screen. Anything still awaiting a decision
  (a request the club hasn't approved) never appears; a maybe is not money.
- **Rows are doors.** Tap a typed record and it opens for editing. Tap a dues or fundraiser row
  and you land in that workspace to act. Tap a scheduled commitment and **Mark paid** opens the
  normal money form pre-filled, asking when — money is only ever recorded in one place.
- **Recording gets simpler** (already decided, carried in): Expense or Income, a refund tick box,
  one searchable "what was it for" picker, and one plain sentence before saving that states in
  dollars what the record will do — naming the family and the credit when a family paid out of
  pocket.
- **A commitment gets its own small door on Payables** — what, how much, due when, deposit and
  balance — and nothing about it pretends money has moved. Typing a future date on the money form
  points you there instead of being silently accepted.
- **Allocations and Payments become one club tab** — the whole story of where the team stands
  with the club (what they've billed, what you've asked, what's settled) in one place, with the
  existing request workflow intact.
- **The top of the money area ends at the same size it is today** for club-linked teams — eight
  tabs — because the club merge pays for the new Payables tab. The confusing "Money in" tab name
  disappears; the second row of tabs mostly disappears (Transactions has filters, not sub-tabs).

## Why it matters

- Today the money tabs are islands: dues, fundraising, club money and expenses each keep their own
  list, and nothing shows how they interrelate or what the season's cash actually did. The
  register is that missing picture, and it's built entirely from records that already exist — it
  invents no new bookkeeping and can't double-count, because nothing is ever *created* in it.
- The balance-equals-cash-on-hand rule makes it trustworthy rather than decorative: if the
  register and the cash tile could ever disagree, a coach would rightly stop believing both.
- The isolation between workspaces stays — dues schedules can never be touched by other money
  events, fundraising rows keep refusing typed income — because the register only reads.

## Tradeoffs made honestly

- **A mixed list was previously ruled out — on the budget report, and it stays ruled out there.**
  The register is a different animal: direction lives in two columns (money out / money in) with a
  running balance, the standard every bank statement uses, and it never shows a budget variance.
- **Filters hide the balance.** When a coach filters the register (only expenses, one category),
  the balance column steps aside — a running balance over a partial list looks like cash and
  isn't. The full book is the only place the balance shows.
- **The register waits for the new form** (it's phase 3 of 4) so that tapping a row opens the
  redesigned experience, not the old one — each phase leaves the product coherent on its own.

## What this deliberately does not touch

Dues schedules (display, never touch), refund bookkeeping rules, the report and its three views,
past seasons (the register is this season's book; money history is its own future session), and
everything already decided about the form.

## Priority and sequencing

**High.** Four phases, run serially: the two doors → the form → the register → the club tab. The
club tab gets its own short mockup pass before build (its name — Club vs Org — is settled there).
Prior migrations (§29/§38) reach production before any of this promotes.

## Success criteria

The register's balance at today always equals cash on hand; a commitment and its settlement
produce one schedule entry and one transaction with the right dates; a coach can answer *"what
happened in August"* and *"what's coming in September"* from one screen; no saved link or bookmark
breaks; and the help guide, demo tour and screens tell the same story on day one.
