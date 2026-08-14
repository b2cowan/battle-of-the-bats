# PM Brief — how installment amounts get set

**Plan:** `COACH_INSTALLMENT_BASIS_PLAN.md` · **Mockup:**
`claude.ai/code/artifact/1177bcf0-1103-41e9-891f-cb39c063bbd4`
**Status:** BUILT on dev 2026-08-13, **owner QA pending** · **Priority:** high — closes a known
correctness defect

---

## The problem in one sentence

The screen a coach reads before charging ten families shows different numbers from the ones it
creates, and there is no way to say "a $150 deposit now, the rest in November".

## What we found

The sheet asks for an amount per installment, then throws it away: Preview re-derives an even split
from the budget every time. Confirm, however, uses the typed amount. A coach entering $150 was shown
$800 and would have created $150.

Alongside it, two real gaps. There is no way to set amounts by hand at all — the only schedule the
product can build is the budget divided evenly. And the sheet is now opened from Player Dues as well
as Budget Plan, where a coach may never have built a budget and simply gets turned away.

## What a coach sees differently

**Choosing how amounts are set.** Three options at the top of the sheet, each showing what it works
out to per player *before* you pick it: split the budget, split the season estimate, or set the
amounts yourself. On a team with $8,000 of costs, $1,200 of expected funding and a $9,000 estimate,
that is $680 against $780 against "you decide" — comparable at a glance.

**Adding a date splits it again.** In either even-split mode the amounts fill themselves in and
recalculate whenever a date is added or removed, so the same money divides across players *and*
periods. Odd cents land on the last payment, so nobody is a penny short.

**Typing your own amounts, with a warning instead of a wall.** A $150 deposit and a $250 balance now
works, and underneath it a running line says "collecting $400 per player — $3,800 short of what
players need to fund". Amber, never blocking. Over-collecting gets a sharper colour, because that is
the one that takes money off families who do not owe it. An exact match gets a quiet tick.

**A preview that matches what happens.** The table now shows the amounts that will actually be
created, plus a per-player Total column and a team total, so the figure a family will owe for the
season is on the screen where you approve it. The shortfall warning follows you to that screen rather
than being left on the previous one.

**A coach with no budget is no longer turned away.** Opened from Player Dues, someone who just wants
to charge everyone $400 can do it — the two split options go grey with their reasons, manual stays
live, and "Build a Season Budget Plan first" remains on screen as a link rather than a wall.

**What does not change:** who is allowed to do it, both doors opening the same sheet, preview always
coming before confirm, and the safe replace — anyone who has already paid something keeps their
schedule and is named afterwards.

## Why it matters

This is the moment money becomes real for a family. Everything downstream — what they are told they
owe, what the reminders chase, what the team's books expect — is decided on this one screen, and it
was showing a figure it did not intend to use. Beyond the correctness fix, real teams do not charge
in equal quarters: a deposit at tryouts and a balance in the new year is the ordinary pattern, and
until now the product could not express it.

## Tradeoffs taken

- **Budget-first becomes guidance, not a gate.** A team can now end up with dues no budget stands
  behind. Judged the better trade: the alternative sends a coach away from the job they came to do,
  and the nudge survives as a link.
- **Expected funding comes off both split bases**, so "split the estimate" is not literally the
  estimate divided by the roster. Each card spells out its own arithmetic rather than leaving it to
  be inferred.
- **The manual comparison quotes one figure** — funded by players, the number the rest of the Money
  hub uses — rather than whichever split option was last highlighted.
- **A row without a date is now incomplete rather than quietly ignored.** Slightly stricter, but the
  even split divides by the number of rows, so a silently-dropped row would mean the sheet showing a
  three-way split and creating a two-way one.

## Success criteria

- The preview shows exactly what gets created, in all three modes.
- A coach can build a deposit-plus-balance schedule without leaving the sheet.
- A coach with no budget can set dues from Player Dues and still sees the budget offer.
- No basis is ever offered as `$0.00` — an unavailable one says why.
- No new sub-44px tap targets at 390px; nothing scrolls the page sideways.

## Out of scope, deliberately

Changing a player's dues after they have paid (that rides with the payment-record project), per-player
amounts, and a "money in" summary on the budget page — drawn and withdrawn by the owner as too heavy
above the budget rows.
