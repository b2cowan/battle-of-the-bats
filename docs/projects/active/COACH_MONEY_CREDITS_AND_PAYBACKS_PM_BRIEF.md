# PM brief — What a credit is, and what happens when you hand it back

**Plan:** `COACH_MONEY_CREDITS_AND_PAYBACKS_PLAN.md` · **Rulings:** owner, 2026-09-07 · **Status:** not built, one question open

## The problem, in one sentence

When a family pays a team bill out of their own pocket, the report counts the bill and forgets that
the family just paid part of their dues.

## What a coach sees today, and why it's wrong

A parent buys a $700 bat for the team. The coach records it and credits the family $700 against
their dues — which is right, and the family's balance on the Player Dues screen is correct.

But on Budget vs. Actual, the season's spending goes up by $700 and nothing comes in to meet it. So
the report shows a season doing worse by $700 because a parent helped. On the test team that is
**$1,379.98 the season looks worse than it is**, and the figure ties exactly to the credits issued.

A second, smaller error runs the other way: the report counts money that has since been handed back
to families as though the team still has it — **$600.00 overstated**. Two mistakes pointing in
opposite directions, which is why neither showed up.

## What changes

**Nothing a coach does day to day, and nothing about what any family owes.** No balance moves, no
dues are recalculated, no budget figure changes. This is the report catching up with what the Player
Dues screen has been saying all along.

Four things change on the Budget vs. Actual report's **Season spending** reading only:

1. **A bill a family paid counts as that family's dues coming in**, as well as an expense. The
   owner's framing: it reads the same as the parent paying their dues and the team buying the bat.
2. **A fundraiser rebate counts as dues rather than fundraising.** Fundraising shows what the team
   actually kept; the rebate shows as the family's dues being paid out of money the team raised.
3. **Money handed back stops counting.** A family who sent $1,200 against a $900 bill and got $300
   returned contributed $900 — their net contribution to the team.
4. **The Cash reading does not change at all.** That money genuinely did move, and Cash is the
   screen that answers "what did our bank account do." It is already right.

## The one behaviour change for a coach

**When handing money back to a family, the coach picks which debts it settles** rather than typing
an amount. Whole debts, one or several per cheque — so one payment can clear two things, but not
half of one.

It is one extra step, and it buys three things: the report always knows which pot the money came
out of, a coach can no longer hand back more than a family is owed, and the record says what the
cheque was actually for.

**Now is the cheapest this will ever be — production has no paybacks recorded at all yet.** Every
month that passes adds history that would have to be guessed at.

## Why it matters beyond tidiness

The report and the Player Dues screen currently disagree about the same families. After this, **every
family's figure on the report matches their balance on the dues screen to the cent — all twelve on
the test team.** Two screens, worked out two different ways, landing in the same place. That is the
thing to check when it is built, and it is the strongest sign the rulings are right.

It also **removes a whole planned change.** The dues-by-family project had a step to subtract credits
from each family's planned dues, which would have moved the season's headline figure by $2,349.63.
Under these rulings the family rows read correctly without touching the plan at all, so that step
disappears rather than getting built and argued about.

## What's still open

**What a "contribution" credit actually is.** A coach can type one by hand, and the product has no
idea whether real money arrived behind it. If it did, it should be recorded as a payment — someone
paying toward a family's dues — and it stops being a puzzle. If nobody paid anything, it is a
discount and must not count as revenue.

The same doubt applies to a hand-typed fundraiser credit. It is $217.00 on the test team — small,
but it is the last piece of this money the report cannot explain, and the answer decides whether the
season's bottom line moves by that much.

## Priority

**Ahead of the dues-by-family fold**, which is currently blocked on it. The reporting error is live
today; the payback change is cheapest today; and everything else in that project sits downstream of
both.

## Success criteria

- Every family's report figure equals their Player Dues balance, to the cent.
- The Cash reading is unchanged, figure for figure.
- Every budget figure is unchanged.
- Fundraising on the report equals the "Team keeps" figure the Fundraising tab already shows.
- A coach handing money back picks what it is for, and cannot return more than is owed.
## Update — 2026-09-09: the last criterion above was only half true

*"A coach handing money back picks what it is for, and cannot return more than is owed"* — the
picking shipped, and the **not more than is owed** part refused everything instead.

Where a family had been paid back once before the product started recording *what* a payback settled,
the tick-list and the Save disagreed about how much of that credit was left. The list was right; the
Save read the credit as untouched, asked to hand back the whole original amount, and its own ceiling
refused it. The coach met a button that could not work, and that family's remaining credit could not
be returned through any door in the product. Every family on the test season was in this state.

It has not bitten a real club yet only because no real payback has been recorded. It would have: the
end-of-season settlement writes paybacks without naming debts on purpose (a settlement cheque covers
more than credits), so *settle the season, then pay a family back afterwards* — an ordinary sequence,
and one the "a season stays live until it is closed" ruling exists to support — walks straight into it.

Two smaller disagreements were found and fixed in the same pass: the Pay-out sheet and the Statement
could name **different credits** as the one an old payback consumed, and a **written-off balance**
could absorb part of a refund even though a write-off is not the family's money to return. Nothing a
coach does changes; three screens that were quietly telling different stories now tell one.
