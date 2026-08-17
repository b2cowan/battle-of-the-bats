# PM Brief — the Money screens redesign: the split, the register, and the club tab

**Status: direction approved by the owner 2026-08-16. Phase 1 built on dev the same day (Owner QA
§41); phases 2–4 open.**
**Plan:** [COACH_MONEY_TAB_REDESIGN_PLAN.md](COACH_MONEY_TAB_REDESIGN_PLAN.md)

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
