# Club permits and the club scheduler — PM brief (Club Tier Stages 10 + 11)

Plan: `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` · Hub: https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups →
Stages 10 + 11 · Status: **drawn 2026-10-10, ratified 2026-10-11 (every question as recommended).** Build prompts written; nothing built.

## What it is
Two features that are one idea: **the time a club holds, and how it hands that time out.**
- **Permits.** The club records the permits and rentals it holds — a town's summer diamond permit, a dome's winter
  contract — once: where, which days and hours, the dates, what it costs, the reference and the issuer's document.
- **The scheduler.** The club hands that time out to its teams: a few choices (which time, which teams, how much each
  gets, a few rules), ranked drafts, adjust by hand on a grid, send it, keep it by name ("Winter dome 2026–27") to change
  later or start next year's from.

## What each person sees differently
- **A club admin (or the facilities volunteer).** In the Venue library, a second view, **Permits**, lists what the club
  holds and how much of each it actually uses ("51 of 80 hours"), the number to take back to the town at renewal. A
  permit names the budget line that pays for it. **Schedules**, a new row under Calendar, is where the winter dome gets
  divided: pick the dome contract (it fills in the hours), tick the teams by group, split the time between them (evenly, a set number a week, or by percentage, say 60% to the rep teams and 40% to the select teams, the way money is split), generate,
  pick a draft by how fair it is (reading it day by day, or exporting it, before keeping it), drag a few slots, then **Send**. A preview shows exactly who is told what before
  anything goes. Later changes are sent as just the changes, to just the teams they touch.
- **A head coach.** The club's slots appear on the team's Schedule like any practice, marked as coming from the club's
  schedule. The coach keeps arrival, notes, attendance and the practice plan, but can't move or delete a slot. If the
  team won't use one, the coach **hands it back** (this one, or every week from now), and the club can give it to
  someone else. One email when the schedule is sent, one when their slots change.
- **A house-league admin.** The same scheduler, for house league's own practice slots, when house league's own stage
  lands. The practices it makes read as the schedule's and change only there.
- **A family.** Nothing new to learn. Their team's slots are on the schedule they already use. The club never emails
  families about it.

## The common case, end to end (walked 2026-10-11)
The owner’s own example, walked through the drawings with real numbers: a club rents a winter dome for six months, six fields (four full-cost, two half-cost), Sunday mornings in 90-minute slots, 7,000 for the season. The admin enters the dome contract once, builds the Sunday schedule in one window, presses **Bill the teams** (each team’s share is worked out from the time it got, each field at its price, paid every two months as its practices come: 72 / 64 / 64 for a senior team), and **sends it for review**. Each coach sees their Sundays and their bill together and answers “Looks good” or “Ask for a change”. The admin makes the one swap asked for and **finalizes**: every team’s practices, its bill and its budget line update at once. Today this is a spreadsheet, 24 hand-typed payment amounts and a round of emails.

## Exports a club can hand to a town, a dome or a board
Every export these features add wears the format the practice plans, lineups and accounting reports already have: the club’s logo and colours, proper titles, notes under the tables, a frozen header row in Excel, and the FieldLogicHQ mark at the foot.

## Why it matters
- Facility time is one of a club's biggest costs, and today it lives in spreadsheets and email. On production, coaches
  already budget dome time and diamond rentals in their own team budgets ($10,000 of dome time on one team), and nobody
  puts that time on a schedule.
- Without the scheduler, a club that records its permits still divides them in a spreadsheet. The owner ruled that the
  release waits for both.
- It is the first time the club can put something on a team's schedule. It does it the way a published tournament
  already does: the club owns its own bookings, and never touches the coach's own events.

## Trade-offs and calls
- **Desk first.** Building and dragging need a computer. A phone reads schedules, sends changes, and lets a coach hand a
  slot back. On a phone the build doors are simply not there; they don't dead-end.
- **Changes wait until sent.** A schedule's teams keep what they were told until the admin sends the changes. That way a
  half-finished rearrangement never lands on a family's calendar. Ruled as recommended (Ask 14).
- **Rep teams first, house league with its own stage.** The first Club release is for rep clubs without house league.
  House league's practices can't hold a club slot today (they only cancel and never reach families), so that half is
  built when house league's own stage runs. Ruled as recommended (Ask 6, Ask 10).
- **Looks like the tournament generator, built for time.** The window and its way of showing drafts copy the tournament
  generator's frame, but its engine and grid are new. The tournament's engine pairs games and treats evenings as bad
  slots, which is backwards for practices (Ask 5).
- **The facility contact gets the schedule in the email itself.** No email in the product carries an attachment yet, so
  the dome's booking office reads the schedule in the email body for now (Ask 7).

## Priority
Release-gating. Build order, ruled 2026-10-11: permits (one build), then the calendar feeds (how families' calendars
stay current; they can be drawn now), then the scheduler (two builds: the server, then the screens). House league's half
arrives with house league's own stage. Before the permits gate is built, `/strategy` records which plans carry permits
(League Plus and both Club bands, as ruled).

## Success looks like
- A club records a season's permits in minutes and can say how much of each it used, by diamond and by night.
- A club admin builds a fair winter dome schedule for eight teams in one sitting, and every coach has it on their team's
  schedule, with an email, the moment it is sent.
- A coach hands back a slot without phoning anyone, and the club sees it open.
- Nothing about the club's time is kept twice. The calendar, the clash check, each team's schedule and the permit's use
  all read the same bookings.
- Every question on the hub's Decisions tab has a ruling (done 2026-10-11), and both stages pass their QA walks — the
  scheduler's ends with the winter dome walked end to end, every figure read back on the club's side and a team's.
