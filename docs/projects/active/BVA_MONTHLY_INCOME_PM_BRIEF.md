# PM Brief — Budget vs. Actual learns the whole income truth

**Status: plan written 2026-08-23, awaiting go. Nothing built yet.**
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
