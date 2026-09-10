# PM brief — More than once

**One line:** let a player hand money in to a fundraiser as many times as they actually do, the way
the whole team and a sponsor already can.

**Status:** **BUILT 2026-09-10**, owner QA walk owed. All three rulings taken on the mockup and
carried verbatim. Migration 287 is on dev and **owed to production** before the code promotes.
**Plan:** `COACH_FUNDRAISER_MORE_THAN_ONCE_PLAN.md` · **Mockup:** artifact `94c27428`
**Owner QA:** §166, walk artifact `0c968647` · run order step B22

> **One thing to know that the plan did not say.** "No figure on any screen changes" held only
> because the old rule made *rows* and *people* the same count. Four places counted players by
> counting rows — including the **Players** column of the money export — so a player handing in
> three times would have started reading as three players. All four now count people. It is the
> part of this change most worth checking.

---

## What a coach does differently

**Today.** A player gets one amount on a drive. When Avery sells six boxes in August and three more
in September, the coach opens Avery's row, adds the two numbers in their head, overwrites the total,
and overwrites August's date with September's — which is now wrong for most of the money. And on the
Record form, Avery isn't even in the list: every player who has already handed something in is hidden,
with a note telling the coach to go and find their row instead. On a drive where everyone has handed
in once, the list is empty and the form says there is nothing left to record.

**After.** The coach presses Record, picks Avery — who is simply there — types 90, and saves. Avery's
row on the board now reads $576.00 and opens to show the two hand-ins with their real dates. Nothing
else about the board changes: a player who handed in once looks exactly as they do now.

## Why it matters

Handing money in twice is the normal shape of a fundraiser, not an edge case. The product already
believes this for the whole team ("two hoodie tables on two weekends are two events") and for
sponsors (five cheques, five dated arrivals) — a player is the only participant it treats as a single
running number, and that is an accident of a rule written a year before whole-team entries existed.
The cost lands on the coach as mental arithmetic and a wrong date, and on the drive's history as a
fact it can no longer tell.

## Who sees it

Head coaches and any assistant with money write access, on the Fundraising tab. Read-only coaches see
the richer board and no controls, as now. No change to what families see.

## The tradeoff we're accepting

Today a double-recorded amount is refused outright. Afterwards it saves, so the form has to say what
will happen: *"Avery Test's total for this drive becomes $576.00."* We're choosing to state the
consequence rather than block the door — the same call this product made when a lowered bill stopped
being treated as a collection. A soft confirm on an obvious repeat is available as a fallback if the
owner prefers a guard.

## Success criteria

- A coach can record a second amount for a player without leaving the Record form.
- A drive where nobody handed in twice looks **identical** to today.
- No figure on any screen moves for any drive that exists now.
- The board still answers "who raised what" at a glance, without opening anything.
- A share changed mid-drive is visible per hand-in instead of silently re-multiplying.

## Priority

**Medium.** Not blocking §157 — it's a follow-up raised during that walk. It is the kind of gap that
gets more expensive the longer drives accumulate merged numbers, because the history it can't record
is history nobody can reconstruct later. Best sequenced after §157 closes and before the next
fundraising surface is touched.

---

## What shipped beyond the brief (2026-09-10)

Three things were found while building that the plan had not anticipated. None of them changes the
design; all three are worth knowing before the QA walk.

1. **Four "how many players" counts had to change.** They counted rows, which was the same number
   until now. The one a customer can see is the **Players** column of the Fundraising export.
2. **The remove confirmation now names the date.** It named only the amount, so two $60 hand-ins by
   one player would have produced two identical "are you sure?" dialogs.
3. **The coach demo shows the new shape, and a stale clock was fixed to let it.** Theo Marsh now
   hands money in twice in the sandbox — a *split* of the $160 he already raised, so every figure the
   guided tour quotes is unchanged. Getting his two dates to stay put revealed that the nightly
   re-anchor had never been moving fundraiser entry dates at all: **the sponsor's two cheque dates
   have been frozen since 2026-09-08** while the season around them walked forward. Fixed, and both
   now ride the clock.
