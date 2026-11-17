# Club schedule — unsent changes said as a summary, not a list (plan)

**Owner ruling 2026-11-17:** all seven asks on the drawing ruled as recommended ("I agree with your recommendations, go
ahead and build it"). Drawing: Claude Artifact `YLos6rKun1mA612uRsChsG` (source
[UNSENT_CHANGES_ROW_MOCKUP.html](UNSENT_CHANGES_ROW_MOCKUP.html)). PM brief:
[CLUB_SCHEDULE_CHANGE_SUMMARY_PM_BRIEF.md](CLUB_SCHEDULE_CHANGE_SUMMARY_PM_BRIEF.md).

## The problem

After a schedule is sent, every change waiting for Send the changes was listed one date at a time, in three places:
the Needs attention row on the schedule (35 lines for two teams' added Tuesdays and Thursdays), the Send the changes
window (each team's dates run together as one paragraph, "Time added Nov 17" after every date, the money line trailing
the last date), and the email each team's coaches get (a bullet per date). The page and the window also named places
differently ("Prospect Park · Diamond 1" against "Diamond 1").

## The rulings (asks 1–7, as recommended)

1. **Collapse only identical runs.** A run is one line when every change in it has the same kind, start time and place,
   and for a move the same new time, place and number of days moved. Anything else is its own line (today's wording).
2. **Every team opens closed.** The one-line summary per team is enough to decide.
   **Amended by the owner's browser check (2026-11-17):** on the page the team list itself starts closed too, behind
   "All 36 changes" as before — open, it took too much of the screen. The headline and the one-line total stay at rest.
   The Send window keeps its rows open (it is the confirm step).
3. **Soonest affected date first; three teams, then "Show N more teams"** (as the hand-back asks fold on the same card).
4. **Phone: the Send button drops under the body**, full width, on this row only.
5. **Words to `/marketing`.** Drafted with `[marketing]` tags; settled in this unit of work (see the build record).
6. **One summary in both places** — the page row and the Send window — and a change's place names the park and the
   facility (two parks can each have a Diamond 1).
7. **The email gets the same grouping, every date written out** (an email has no Show dates; a coach may copy the dates
   into a calendar): a titled list per run, a month to an item.

## What does not change

- The flat change lines are kept beside the groups: the bells' change count and the send log read them, unchanged.
- House league's rows ("Sundays from Nov 8: …") and a division's games are already said as runs; they are carried as
  they are, one line each.
- A move and a loss on the same day stay two lines when they come from two different changes (the schedule's own edit
  and added time); they sit under the same team.

## Build record

- Built 2026-11-17, uncommitted at hand-off (commit owed on the owner's word).
- Words (ask 5): `/marketing` kept every head, pattern, toggle and email title; changed two in the total — "taken off"
  → "lost" (in this scheduler "taken off" already means a permit taken off, or money off what a team owes) and "N other"
  → "N other changes". Unit tests:
  `tests/unit/club-schedule-change-groups.test.ts` (new) plus the family, family-send and screens-guard updates.
- Owed: the owner's browser check (desktop row, phone row, Send window, a sent email).

## Known, not this unit of work

- The club email's plain-text part runs list items together (`htmlToText` has no rule for `</li>`). This predates
  this change and affects every club email with a list; logged as a finding, not fixed here.
