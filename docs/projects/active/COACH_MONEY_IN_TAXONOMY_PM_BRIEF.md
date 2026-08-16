# PM brief — money coming in gets a vocabulary

**Plan:** [COACH_MONEY_IN_TAXONOMY_PLAN.md](COACH_MONEY_IN_TAXONOMY_PLAN.md)
**Status:** planned 2026-08-16, **not built** — awaiting approval · one database change
**Raised by:** the owner, 2026-08-16, reading a real club budget

## The gap

We just spent a whole change making sure money going **out** is recorded in words a report can
match on. Money coming **in** is still whatever a coach typed.

So a coach who budgets $4,000 of fundraising and raises $3,100 gets two numbers and no way to see
*which* of their three revenue streams fell short. It's the same problem we already fixed once, on
the other half of the same page.

## What the real budget showed

Four kinds of money arriving, not one: fundraising drives, sponsorship and grants, player-raised
amounts — and **concession revenue from tournaments the club ran itself**, which has nowhere to go
today at all. That budget has two separate lines for it. Hosting is how these clubs fund a season.

## What we'd add

A short list of revenue kinds — fundraising drive, tournament we hosted, concessions, sponsorship,
grant, merchandise, gate — picked the same way a cost picks its item. Deliberately **not** the
spending list: your August ruling that a spending taxonomy has nothing to say about a bottle drive
still holds, and this is the answer to it rather than a reversal of it.

Budget vs. Actual then reports money in **line for line**, the way it now reports money out.

## The part only we can do

**A coach running a tournament on this platform is generating money we already know about.** The
participating teams registered here; their entry fees are in our own records. Today that coach
re-types the figure into their budget as a guess and reconciles it by eye at season's end.

Instead, a money-in line could point at the tournament itself and read its actual straight from
what the tournament took — so *"did hosting pay for the season?"* answers itself with no data
entry. The coach still budgets what they **expect** beforehand; only the actual is derived, because
deriving both would leave nothing to compare.

That's a feature a spreadsheet cannot copy, and it's the reason this is worth doing properly rather
than as a list of words.

## Who is affected

| Role | Change |
|---|---|
| Head coach / treasurer | Names where money comes from instead of typing it; sees expected-vs-raised per stream; a hosted tournament reports itself. |
| Club admin | Can publish revenue kinds club-wide, same as cost items. |
| Families / players | None. |

## The risk worth naming

**Double-counting.** A coach who budgets "tournament we hosted" *and* logs a fundraiser for the
same money would see it twice. The build has to decide whether a derived figure suppresses a
manual one — and say so on screen rather than leaving a coach to notice.

## Three things I need you to decide

1. **Gross or net?** A hosted tournament's entry fees are money in, but the club also pays umpires,
   diamond hire and prizes. A treasurer usually wants net; the platform only knows gross.
2. **Whose money is it?** A tournament is run by the club; a budget belongs to a team. One team
   hosting to fund its own season is clear. A club hosting and splitting proceeds is not.
3. **Are concessions worth tracking in software at all**, or is that below the line most clubs
   want to manage here?

## Priority

**Medium-high.** Nothing is broken without it, and the cost side just landed — but the asymmetry is
visible on one screen, and the hosted-tournament link is the kind of thing that makes the money
module worth paying for rather than tolerating.
