# Date Correctness — PM Brief

**Status:** In progress, started 2026-07-26 · **Priority:** High — live, recurring, customer-facing
**Plan:** [DATE_CORRECTNESS_PLAN.md](DATE_CORRECTNESS_PLAN.md)

## What's wrong today

The app works out what "today" is by asking the **server**, and the server runs on UTC. Toronto is
four hours behind. So **every evening from about 8 PM, the app already thinks it's tomorrow.**

That single fault shows up in three ways customers actually notice:

1. **Tournaments end early.** On the final evening of a tournament, at 8 PM, the event flips to
   *finished* in the coaches portal — the live game-day view is swapped for a results view **while
   games are still being played.** The same rollover makes a tournament show as *game day* the
   night before it starts.
2. **Dues and payables go red too soon.** Money screens decide "overdue" using midnight in the
   wrong timezone, so invoices and installments flag as late **four to five hours early**, and
   "due today" lists are wrong every evening.
3. **Coaches in other provinces see a different day.** On phones and laptops the date comes from
   the *viewer's own device*, so an Alberta coach and an Ontario organiser can disagree about what
   day it is for the same tournament.

**Why it has gone unnoticed:** a developer's machine runs on Toronto time, where the code is
correct. Only the live site is wrong, and only in the evening — which for youth sport is exactly
when everyone is using it.

**It has already bitten once.** The identical fault previously made the live score ticker vanish
mid-game and "Today's Games" go empty on a championship evening. That was fixed on the public fan
pages only; the same fault is still live everywhere else.

## What changes for users

Nothing moves, nothing is renamed, no new screens. Dates simply become right:

- A tournament stays on **game day** until the day it actually ends, wherever you're viewing from.
- Dues and payables turn overdue **on the due date**, not the evening before.
- "Days until" counts match the calendar.
- Everyone looking at the same event sees the same day, regardless of what province they're in.

**Decision made:** dates follow the **organisation's** timezone, not the viewer's device — so a
tournament "today" means today where the tournament is. This matches how game times are already
stored, and means two people can never disagree about the date.

## Scope and tradeoffs

Covering **76 places across 59 files** — shared tournament/coach logic first (everything else
inherits it), then money, schedule, coaches portal, and admin.

- **Included:** anything that asks what day it is, whether something is overdue, or how many days
  until an event. Plus five separate hand-written "is this overdue?" checks collapsed into one, so
  the fix can't be half-applied again.
- **Deliberately excluded:** expiry checks on invites and offers. Those compare exact moments in
  time, not calendar days — they're already correct, and changing them would add risk for nothing.
- **Deliberately excluded:** tidying ~30 duplicated date-formatting helpers. That's consistency
  work with no customer benefit, and it would balloon the change.

**A guardrail ships with it** — the same approach used for the colour cleanup. The unsafe pattern
now fails the build, so this can't quietly creep back. Fixing the fan pages alone last time didn't
stop it spreading; this does.

## Success criteria

- A tournament checked at 8:30 PM on its closing night still reads as **live**, not finished —
  covered by a test with a fixed clock, not a manual check.
- Dues flip to overdue on the correct calendar day.
- Two people in different provinces see the same date for the same event.
- The build rejects any newly-added unsafe date pattern.

## Risk

Low-to-moderate. The correct helpers already exist, are proven in about 20 places, and are already
shipping inside browser components — this is a migration, not new invention. Changes land in
group-by-group commits so any one area can be rolled back on its own. The main thing to watch is
that some dates will legitimately **shift by a day** once corrected — that's the fix working, and
it will be most visible on anything currently sitting near a date boundary.
