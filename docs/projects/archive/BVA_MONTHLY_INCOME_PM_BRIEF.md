# PM Brief — Budget vs. Actual learns the whole income truth

**Status: COMPLETE on dev. Phase 1 BUILT 2026-08-23 (owner QA §83). Phase 2 = Option D — D-1 BUILT
the same day (✅ owner QA §85 PASSED 2026-08-24), D-2 BUILT 2026-08-25, ✅ owner QA §101
PASSED 2026-08-26. Option D is finished; see the bottom of this brief for what D-2 changed.**
⚠ **Migration 262 is on DEV only and must reach production BEFORE this code is promoted.**
Plan: `BVA_MONTHLY_INCOME_PLAN.md` · Origin ruling: owner, 2026-08-23, mid-§80 walk.

## The problem, in the owner's words

*"After logging fundraising, why don't I see it in the budget/actual report? In fact, why aren't
player dues here either?"*

The Months view ends in a three-row cash strip — Money in, Money out, Running balance. On the
"Actual" lens it is supposed to be the season's real cash story, and today it quietly isn't:
Money in counts **only dues payments** (no fundraising, no sponsor money, no recorded income or
refunds, no club reimbursements), and Money out **misses money paid back to families entirely**.
So the Running balance tells a story that doesn't match the team's actual cash — on the same
product whose register proves the team's cash to the cent, one tab away.

The dues-only rule was a deliberate 2026 July decision that was correct then and is wrong now —
the money model changed three times underneath it (the credit/cash split, the income taxonomy,
club money joining the report), and the owner has formally reversed it.

## What a coach sees and does differently (Phase 1)

- On the Months view's **Actual** lens, Money in becomes **every dollar that actually arrived**,
  in the month it arrived: dues families paid, fundraising and sponsor money received, income and
  refunds the coach recorded, and money the club sent. Money out becomes **every dollar that
  actually left**: bills paid, money paid back to families, club installments and payments.
- **Running balance finally matches reality** — its trajectory agrees with the Cash-on-hand figure
  the coach sees everywhere else, and the "you go short in March" warning is computed from true
  numbers.
- A coach who logs a fundraiser amount or receives a dues e-transfer sees that month's Money in
  move immediately. A payout to a family moves Money out. Nothing else about the screen changes —
  same grid, same rows, same layout; only the strip's numbers and its explanatory footnote.
- A cost a family paid a vendor directly stays on the report as spending but stays **out** of the
  cash strip — no team money moved, and the footnote says so plainly.
- The Budget and Scheduled lenses are unchanged: they project the plan and the commitments, where
  dues installments remain the only income with a schedule (nothing else has one), and the note
  under the grid says so honestly.

## Why it matters

The strip is the treasurer's "will we run short?" answer. An understated Money in and an
understated Money out are not offsetting errors — they distort different months, and a coach
planning a season around a wrong trajectory is the most expensive kind of quiet defect. This also
removes a credibility trap: the register (one tab over) already shows the full cash truth, so any
coach comparing the two screens today finds the product disagreeing with itself.

## The safety net (part of the deliverable, not a nicety)

We already prove "the register's balance IS cash on hand" with an automated check. This build
extends that same pattern: an automated check that the strip's monthly figures equal the
register's rows bucketed by month, **to the cent, both directions** — so the two surfaces can
never silently drift apart again (they already had; that's how this was found).

## Tradeoffs / decisions inherited

- **Gross, not netted.** The report deliberately nets refunds into the costs they repaid (right
  for a report); cash counts both directions gross (right for cash). The two answers coexist on
  one screen, each labelled.
- **Sponsor money is dated by its recording day** — sponsors don't carry an "arrived on" date
  today; widening that is an owner question, not part of this build.
- **No visual redesign.** If the implementation ever wants a visible shape change beyond the
  numbers and the footnote, it stops and gets a drawing first.

## What is deliberately NOT in this build (Phase 2, separately gated)

Income **rows in the month grid itself** (seeing dues/fundraising by month as grid lines, not just
the strip). That is a design question the owner rules from drawings — 2–3 mockup options priced as
an artifact, rulings stamped, then its own build with its own go. Nothing of it rides Phase 1.

## Access / roles

No change. Anyone who can view team money sees the corrected strip; read-only coaches see it
read-only as today.

## How to test (owner QA — will be ledger §83)

1. Open a team's Money → Reports → Budget vs. Actual → Months, Actual lens.
2. Record a fundraiser amount with a received date → that month's Money in rises by it (gross).
3. Record a dues payment → its month's Money in rises; pay a family back → Money out rises.
4. Compare the strip's final running balance to Cash on hand — they agree.
5. Flip to Budget/Scheduled — unchanged behaviour, honest footnotes.

## Success criteria

Strip equals register month-by-month under the automated check; all existing money checks and the
full unit suite stay green; help guide's description of the strip matches the new truth; no other
visual change on the page.

---

# Phase 2 = Option D · D-1 built on dev 2026-08-23 (owner QA §85)

The Phase 2 mockup session ran the same day and the owner directed a fourth shape past the three
options drawn: **Months stops being a spending grid and becomes the season's cash statement.** Go
given on the artifact — *"ok, this looks good, I agree with the build"* — with the opening-balance
workflow walked and accepted separately.

## What a coach sees and does differently

**The Months view now reads the way a treasurer thinks.** Everything coming in, everything going
out, and what's left:

- a **REVENUE** band grouped by where the money came from — Player dues, Fundraising, Sponsorships,
  Other income, Money back & reimbursements — showing only the groups the team actually has,
  closed by **Total revenue**;
- an **EXPENSES** band of the coach's own budget categories plus **Paid back to families**, closed
  by **Total expenses**;
- **Net for the month**, then a **Running balance** whose figure in the pinned Total column is the
  season's closing balance — so **cash on hand stays on screen** however far sideways the months
  are scrolled.

Revenue minus expenses is the running balance, in every month, to the cent. The coach can check the
report's own arithmetic by eye, which is the point: the old three-row strip sat *underneath* a table
that did not contain the numbers it was made of.

**All four readings became useful in their own right.**

- **Scheduled** is now the season's forward view — dues instalments still owed, sponsor pledges and
  anything asked of the club and not yet answered, against commitments still owed. Its running
  balance starts from the money the team actually has today. Row names change with the reading, so
  only the club row changes name — it reads "Asked of the club", because a request nobody has
answered is a question rather than money back. Dues and sponsorships keep their names on every
lens: an unpaid instalment is still dues, an unhonoured pledge is still sponsorship (owner,
2026-08-24).
- **Budget** gained its own net and projected balance, so a plan that runs short in September says
  so months before the money does.
- **Actual** is real cash, month by month.
- **Difference** now reads honestly on both bands: a positive figure is good news either way —
  revenue that came in *ahead*, or spending that came in *under*.

**Two honest truths, named on the screen.** Months' Total expenses can differ from the Statement's,
because Months is cash and the Statement is what the season spent. It adds money paid back to
families, leaves out a cost a family paid a vendor directly, and shows money back as revenue instead
of quietly shrinking the cost it repaid. A note under the grid says exactly that, so a coach who
spots the gap is answered by the product rather than by support.

**Money the team can't date has somewhere honest to sit.** A sponsor's pledge and a request the club
hasn't answered appear in a **No date yet** column — counted in the total, in no month — so a pledge
can never appear to rescue a month the team still has to get through without it.

## Why it matters

The question that started the whole programme was *"after logging fundraising, why don't I see
it?"*. Phase 1 made the numbers true. This makes them **visible where the coach was already
looking**, in the shape a treasurer, a board and a parent already know. It also collapses two
widgets into one table: the strip's separate Money in and Money out rows are gone because the band
totals *are* those rows.

## Tradeoffs taken

- **Months' figures are cash, so a per-item figure can differ from the Statement's.** Accepted by
  the owner deliberately: the alternative kept the cells identical and broke "revenue − expenses =
  balance", which is the defect class this programme exists to kill. Both truths are labelled, and
  each is machine-checked against its own authority.
- **The report's build-blocking check was rebuilt.** It no longer holds Months equal to the
  Statement (that would now fail on any team ever refunded a dollar). It holds **both bands equal to
  the register** — month by month, category by category, group by group — and proves the ending
  balance is cash on hand. One genuine coverage loss is recorded in the check's own header: the
  cumulative chart lost its per-month cross-check and now leans on a unit test.
- **A cost a family paid a vendor directly still steps out**, footnoted, until the team pays that
  family back — the owner's own call: *"we didn't pay anything — once we pay the player it shows up
  at that point."*

## Access / roles

No change. Anyone who can view team money sees the bands; read-only coaches read them.

## How to test

Owner QA ledger **§85**. Fastest confidence check: `qa-money-lab` → QA Money U13 reconciles to the
approved mockup to the dollar — Total revenue $8,141.69, Total expenses $5,279.00, Net $2,862.69,
and the $640 gap against the Statement is exactly the two family-paid costs less the one payout.

## D-2 — ✅ BUILT ON DEV 2026-08-25 (owner QA §101). Option D is complete.

### What a coach sees and does differently

**Every figure on Months now opens.** Before this, a coach could see that dues brought in $2,600 in
May and had no way to find out whose $2,600 it was without leaving the report. Now:

- **The chevron beside a revenue group opens where the money came from** — the actual families,
  drives, sponsors and requests behind the figure. Every family renders; nothing is folded away. A
  family's missing catch-up payment is visible at a glance, in the month it did not arrive.
- **The number opens what makes it up** — the individual records, dated. Tap a family's figure for
  that family's month; tap the group's for the whole team's. **Always read-only**: the grid reaches
  the forms, it never becomes a second place to edit, which is why there is no *Record a payment*
  button in any of these panels.
- **At most two doors out of a panel**: Transactions (the book of record), and the thing itself —
  that drive, that sponsor, Player Dues, Club. **Some rows earn only one, on purpose**: money back a
  coach typed in has no "thing" behind it, because the record *is* the thing.
- **The panel says what kind of money it just added up.** A drive totals to *Total raised*, a
  remaining instalment to *Still to come*, and a pledge or a pending club ask to **"Possible"** —
  the one word that stops a coach banking money nobody has agreed to send.
- **Money back names the cost it repaid.** These are the figures that behave differently here than
  on the Statement, and the panel is where a coach learns that without reading a footnote.
- **"Paid back to families" opens by family**, mirroring dues, with the *reason* on each payment's
  own line. It was never in the spec; left shut it would have been the one figure on the statement a
  coach could not trace back to a record.

**A season can now open with money already in the bank.** *Start next season* asks what to do with
the cash the closing season is holding — carry all of it (the default; the team really does still
have it), carry a different amount if families are about to be paid back, or start at $0. Whatever
is carried becomes the new season's **opening balance**: the first line of its register, the first
row of its Budget vs. Actual summary, and part of its cash on hand. Every running balance starts
from it. It is corrected in **Team settings → Money**, which is also where a team whose first season
began mid-year sets one for the first time.

### Why it matters

The report could already prove *how much*; it could not answer *who*. That was the last step between
a treasurer reading a figure and acting on it — and the one figure a coach could not trace was the
one most likely to be questioned at a parents' meeting.

The opening balance closes a smaller but sharper gap: until now every season's books started at
exactly zero, so a team that rolled forward with $2,800 in the bank spent its second season looking
poorer than it was on every money screen at once.

### Tradeoffs taken

- **No item rows on Budget or Difference**, deliberately. A family has no per-family plan, so every
  row would print its whole Actual as "ahead of plan" in the colour the grid uses for good news. The
  comparison a coach wants is the group's, one row up.
- **The carry question is a block inside the existing Start-next-season form**, not the three-step
  wizard the drawing implied. Restructuring that dialog would have pushed its owner-placed *"This
  closes the {season} season"* panel — the sentence that prevents the one mistake this product
  cannot undo — behind a Next button.
- **The register's carried balance takes over its existing "Starting balance" line** rather than
  adding a second line above it saying nearly the same thing.
- **Expense item figures open too**, a small extension past the nine drawn rows: once a coach learns
  that figures open, an inert one reads as broken.
- **Nothing validates a hand-typed opening balance against last season's close.** A coach correcting
  a handoff knows something the product cannot see — they settled in cash, they forgave a balance —
  which is the same reason unsettled money warns and never blocks.

### What the walk changed

Four defects and one shape ruling, all found by the owner on real screens and fixed before the walk
closed — written up in **§101**. The one worth knowing at brief level: **every month now states what
it opened with, and "Running balance" became "Closing balance"**, so the summary block reads
*opening + net = closing* in the column a coach is looking at rather than asking them to trace a
running total back to an origin that may have scrolled off screen.

### How to test

Owner QA ledger **§101** — ✅ passed. ⚠ **Migration 262 is on DEV only** and must reach prod before this code is
promoted. Walk Part A on `qa-money-lab` → QA Money U13; Part B needs a team that actually carried
something, so either roll a season forward or set a figure in Team settings → Money.
