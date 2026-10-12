# Club permits and the club scheduler — PM brief (Club Tier Stages 10 + 11)

Plan: `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` · Hub: https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups →
Stages 10 + 11 · Status: **drawn 2026-10-10, ratified 2026-10-11 (every question as recommended). Permits (10a) BUILT
2026-10-11, reviewed, its walks on QA ledger §296. The scheduler's machinery (11a part A) BUILT and committed
2026-10-11; its screens (part B) BUILT 2026-10-11 and reviewed — the dome walk (QA ledger §300, fifteen walks) owed.**

## The scheduler's screens, as built (11a part B, 2026-10-11)
- **What the club sees.** A new **Schedules** row under Calendar (the owner and admins, on League Plus and Club, once the
  club runs rep teams). **New schedule** takes the dome's time from its permit in one pick, then who gets how much
  (evenly, by percentage, or a number a week), the rules (start times, days off, fields kept for a group, never on a game
  day), and three ranked drafts to read and export before keeping one. A schedule's page shows the dome's Sundays across
  with **Fair shares** beside them; dragging a team's slot asks which weeks and can be undone; **Bill the teams** splits
  the permit's cost by the time each team got, in payments; **Send for review** asks the coaches, **Finalize and send**
  books and bills, and later changes wait until **Send the changes**, telling only the teams they touch.
- **What a coach sees.** The club's proposal on the team's Overview (their Sundays, their bill, Looks good or Ask for a
  change); the practices on the Schedule marked as from the club's schedule, which only the club can move — the coach
  can **hand one back**; the bill on Money › Club, and one press on the Budget to use the club's figure.
- **Checked before the owner sees it.** A code review (26 fixes, none serious — for example "Use the club's figure"
  failed on a budget line split into months), a wording pass, the help articles, and a design check of every new screen
  at desktop and phone width, light and dark.
- **Calls made, said plainly.** "Facilities by group" rather than the drawing's "Fields by group" (a pool or a rink has
  no fields). The bill's whole option is named for what it bills — the time at the permit's price — and the line under it
  compares that with the permit's cost. A practice the coach hands back without having touched it leaves their schedule.

## The scheduler underneath, as built (11a part A, 2026-10-11)
- **What changes for anyone today: nothing visible.** This part is the machinery the screens will drive: cutting the
  club's time into slots, sharing them fairly (evenly, by percentage by group, or a number a week, with prime time
  shared too), three ranked drafts, the bill worked out by the time each team got with payments that follow it, the
  practices written onto every team's schedule at Finalize together with the bill, the emails and notices, a coach's
  review reply and hand-back, and Send the changes. Each figure the drawings print is checked by a test.
- **The two money questions, ruled 2026-10-11.** The club's bill arrives on a team's budget already filed only when the
  team already uses that budget word; otherwise the coach files it, as today. After Finalize, a team that gains time gets
  a small correction bill; a team that loses time is told what it is owed back and asks for it on Money › Club. The
  first bill never changes and nothing is ever billed negatively.
- **Protections the review added.** A coach can't move or remove the club's practice by any route, including the
  schedule import. A team whose time didn't change is never billed or owed a stray cent. A send that fails halfway can
  never bill a team twice. Bill figures stay with the people who hold the club's Accounting.
- **One departure from the drawings.** The sample dome week shows two teams on two fields at the same hour. The
  scheduler never puts a team in two places at once, so those teams get their two fields at different times of the
  morning — the same slots and the same bill.

## Permits, as built (10a, 2026-10-11)
- **What a club admin sees.** The Venue library has two views, **Venues · Permits**. Permits lists what the club holds for
  the fiscal year a permit starts in: In use now, Starts later, Ended, each with where, dates, hours a week, how much was
  used ("13% · 10.5 of 80 h") and the cost. A permit opens reading, with Export at the top: its time, its cost (two
  figures, a row per price when the fields are priced differently, and the budget line it is on), one Use band (held,
  booked, unused) with a row per block naming who booked it. Add
  permit takes the dome contract once and works out each field's hour ($72.00 a full field, $36.00 a half). **Renew for
  next year** copies it a year on. Each venue lists the permits that hold time there and keeps its booking office's
  email. A budget line lists the permits it **pays for**. A permit's use exports as an Excel workbook for the town or the
  dome, in the club's house format; the club's money reports in Excel now carry its logo too.
- **What everyone else sees.** On every form that asks where (a coach's event, a tryout day, house league's games and
  practices, a tournament game), a quiet grey line when the time is outside the club's permit there: "Outside the
  club's permit for Diamond 2. It covers Tue and Thu, 5:30–9:00 p.m., until Nov 19." It never blocks a save and never
  counts as a clash. The club calendar says it once, inside the booking's window.
- **Who.** Time is shared with the club's people; a permit's money (cost, hourly prices, budget line) shows only to those
  who hold the club's Accounting. A coach never sees a permit. Permits come with League Plus and both Club plans.
- **Trade-offs taken.** The fiscal year follows the permit's start date rather than being stored. A permit carrying money
  in a closed year can't be deleted, as its cost can't change. "Hand out this time in a schedule" waits for the scheduler.
- **Owner calls, ruled 2026-10-11.** Everyone who reads permits opens the permit's document; a block doesn't run to
  midnight; "Used" stays measured against the whole term.
- **"Outside it" removed (owner, 2026-10-11, after the walk).** A permit used to list the club's bookings at its parks
  that no club permit covered. That is a question about the park, not the permit: it landed on whichever permit's dates
  happened to include it, on several at once, and grew longest for a club that hadn't entered all its permits. A permit
  now reads held, booked and unused only, and its export drops the matching sheet. Each such booking still says so on
  its own form and in the calendar. Given up: one list of every booking with no permit behind it; if renewal needs that,
  it belongs on the venue, drawn first.
- **Export at the top, the cost as rows (owner, 2026-10-11, after the walk).** The Excel file is a summary of the whole
  permit, so its Export moved from the bottom section to the top of the window (an icon on a phone). The cost band kept
  two figures (the cost and a full field's hour) and stopped wrapping; each price became a row naming its fields
  ("Fields 1–4 · Full field · $72.00 an hour"), so a dome split many ways adds rows rather than squeezed tiles; the
  budget line reads as a line under them. Given up: nothing; the form that sets each field's price is unchanged.

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
