# Club schedules: open slots and short teams — PM brief

**Plan:** [SCHEDULE_GAPS_PLAN.md](SCHEDULE_GAPS_PLAN.md) · **Drawings:** [SCHEDULE_GAPS_DRAWINGS.html](SCHEDULE_GAPS_DRAWINGS.html)
· owner rulings 2026-11-24.

## What changes

A club coordinator who builds a practice schedule sees, in one sentence, how many teams are short of their share and
where the open slots are. One click explains why the time is open (for example "one practice a week holds the Rep teams
back") and goes straight to the setting that would change it. When a free team that is owed time can take a slot, they
can give it in one click.

The schedule generator also stops leaving time empty that a team was owed and allowed to use. On Milton's winter dome
it went from 8 empty slots to 2.

## Why it matters

Today the page lists a warning per team ("3 short these Sundays") that changes every time you step to the next set of
dates, names teams that are fine and misses teams that aren't. A coordinator can't tell what is wrong or what to do, and
the grid is pushed off the screen. Empty dome time is paid-for time; when it is empty, the coordinator should know
whether that is their own rule doing its job or something to fix.

## Who sees what

Anyone who can read the schedule sees the line and the window. The doors to Settings and "Give it to" appear only for
someone who can change the schedule. Money is unchanged: the bill follows whatever slots teams have, and a team never
gets more than its share without the coordinator changing the share.

## Priority

High within the club scheduler: it is the first thing a coordinator reads after generating, and the current lines
actively mislead.

## Success looks like

- On a generated schedule, the line's numbers match the band (short teams, open slots) on every set of dates.
- Every open slot in the window has a stated reason or a "Give it to".
- No empty slot is left that a free, owed, allowed team could have had (the generator test enforces this).
