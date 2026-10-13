# Club permits and the club scheduler — PM brief (Club Tier Stages 10 + 11)

Plan: `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` · Hub: https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups →
Stages 10 + 11 · Status: **drawn 2026-10-10, ratified 2026-10-11 (every question as recommended). Permits (10a) BUILT
2026-10-11, reviewed, its walks on QA ledger §296. The scheduler's machinery (11a part A) BUILT and committed
2026-10-11; its screens (part B) BUILT 2026-10-11 and reviewed — the dome walk (QA ledger §300, fifteen walks) passed 2026-10-12.**
**Round two (11c) drawn and ratified 2026-10-12 — every question as recommended — and BUILT 2026-10-13** (hub v102,
Mockups → Stage 11c; committed `691170b1`; its walks are QA ledger §307, six, on the hub's QA tab).
**A hand-back that asks for money back (11d) drawn and ratified 2026-10-12 — every question as recommended; built in
two parts: the money half can run beside round two, the schedule-page half after it** (hub, Mockups → Stage 11d; plan
§6d; build prompts `CLUB_SCHEDULER_11D_A_BUILD_PROMPT.md` and `CLUB_SCHEDULER_11D_B_BUILD_PROMPT.md`).
**The money half (11d part A) BUILT 2026-10-13** — reviewed (two serious fixes found and made before any walk), checked
at both widths in both themes, words and help done; its walks are QA ledger §308, six, on the hub's QA tab. The
schedule-page half (part B) is next.

## A hand-back that asks for money back (11d, drawn and ratified 2026-10-12)
- **What changes.** When a coach hands club time back, they can tick *Ask the club for $432.00 back* — the figure is
  what the club billed for those Sundays, worked out, never typed. With the tick, nothing is handed back yet: the
  practices stay on the team's schedule, marked *Hand-back asked*, and the club answers. **Accept** opens the time and
  settles the money in the same step: it comes off what the team still owes (its last payment drops), or, for what the
  team has already paid, it waits in the club's payment requests until the club records paying it. **Decline** keeps the
  Sundays the team's, with a reason the coach reads. Without the tick, Hand back works exactly as today.
- **Why it matters.** Today a coach who gives back four paid-for Sundays has no way to ask for the money, and the
  product already works out that the team is owed it ($432.00) — then tells nobody. The page the club sees after a
  hand-back also asks for a send it never offers (the dome walk's dead end). This makes the money visible, decided once,
  by the person who holds the club's books.
- **The same rule for the club's own moves.** When the club moves a team out of time, the money now comes back the same
  way, as part of sending the changes, instead of "your coach can ask for it".
- **Trade-off said out loud.** "What they owe goes down" is a **credit** — new to club money. The bill a team was sent
  never changes; a credit row lowers what is owed on it, and every money figure (statements, owed by the teams, Budget
  vs. Actual, the fiscal year, exports) learns to read it. It reverses one reason of the 2026-10-11 ruling ("nothing new
  enters the money loop"); a credit lowers a debt and gives no money, which is why the drawing recommends it. And a
  Sunday the club takes back but can't give away is the club's cost: the answer window says so before Accept.
- **Ruled (nine questions, all as recommended, 2026-10-12):** the tick and its figure; waiting for the club; accept or
  decline the whole ask; the ask as a payment request answered by whoever holds the club's money; how it settles; the
  credit; a Sunday that arrives unanswered; the club's own changes; a hand-back never leaving the schedule waiting for a
  send.
- **How it gets built.** Two parts, so it doesn't wait on round two. **Part A** (the coach's ask, the club's answer from
  its payment requests, the credit on both sides, the club's own changes settling the same way) runs alongside round
  two — it touches none of round two's screens. **Part B** (the ask showing on the schedule page, the asked Sundays
  marked on the grid, Fair shares' bill figure) follows once round two is committed, because round two rebuilds those
  same screens. Part A also fixes the money notifications that currently open a page that no longer exists.
- **What part A delivered, and the calls made building it.** Everything above except the schedule page: the tick, the
  waiting practices, Withdraw, the club's Answer window from Payment requests, the credit on both sides, Record paying, the
  club's own moves settling the same way, and every money figure reading what is still owed. Calls made and said: a
  payment the coach has already *sent* counts as paid (the credit comes off what they haven't sent); the treasurer's
  notification opens Payment requests (the schedule page is one they can't open); an ask whose Sundays all pass
  unanswered closes in the daily overnight step and the coach is told; taking back a recorded payment on one of these
  requests leaves the club still owing it. On a phone, the ask's status sits with the practice and the screen's bottom
  keeps only Withdraw (owner, at the design review). Until part B, the club answers from Payment requests: the
  schedule page's own Answer button arrives with part B.
- **Success looks like:** a coach asks for the money in the same place they hand time back; the treasurer answers it
  once; what the team owes, on both sides, drops by exactly what the time cost, or the club's list shows one payment to
  make; nobody is left with a figure the product worked out and never said.

## Round two: sharing, times that move, a window that reads easier (11c, drawn 2026-10-12)
- **What changes for a club admin.** *Some teams can share a facility* while the rest keep one to themselves: name two
  young teams, or a whole group, and the generator pairs them; each pays half for a shared slot (ruled by the owner
  2026-10-12, and already how the bill splits one). Today the only choice makes every team share. *Each team's time* can
  stay the same every week (today, the default) or **move around** — early one week, late the next, field to field — so
  no team always has the first slot; a team keeps its day either way. And New schedule **reads as three questions**
  (what time, who gets how much and how it falls, what the club won't allow): each rule is a sentence, nothing is shown
  for a rule the club hasn't added, and one *Add a rule* door offers every kind.
- **Why it matters.** The first two came from walking the dome: juniors on half a field and seniors on a whole one is
  how clubs actually use a dome, and "the same team always gets 8:00 a.m." is the complaint a fixed schedule creates.
  The third is the owner's read of the window: about the same length, but in the order a club thinks.
- **Trade-off said out loud.** Freed time on a permit the club has already paid for costs the club unless it is handed
  out — the drawing's bill says so ($5,400.00 of the dome's $27,000.00 when two junior teams share).
- **Ruled by the owner 2026-10-12 (all seven as recommended):** sharing is a rule about named teams; paired whenever a
  partner is free; a shared slot counts half toward a share too; moving keeps each team's days; prime time's own
  keep/rotate folds into the one choice; rules as sentences; and this round is inside the Club release, built in its
  own session once the dome walk is complete (owner: "I will kick it off when qa 300 is complete").
- **Success looks like:** a club with two young teams sharing gets a schedule where they practise together and pay half,
  and Fair shares and the bill agree on it; a club that moves teams around sees each team's early starts even out over a
  season; nobody opens Rules to find thirteen controls for one rule.
- **As built (2026-10-13).** All of the above, checked on the club's own dome data: two junior teams sharing two to a
  facility leave 50 of 300 Sundays' slots open, every team gets 37.5 hours and is billed $2,700.00, and the bill says the
  50 open slots cost the club $5,400.00. Moved around gives each senior team 12 or 13 early starts of 25, field to field,
  on the same Sundays. **Worth knowing:** under *Evenly* or *By percentage* sharing frees no time — a team that shares
  gets twice the practices, each on half a facility (a share is time); only *A set number a week* frees time (help's
  FAQ says so). A team whose partner can't play that day plays alone. A schedule saved before keeps its meaning (a
  "teams at once" of 2 becomes one sharing rule naming every team). **Still to do:** the owner's walks (§307), the
  layout sweep on the owner's dev server, a design pass.

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
- **~~The facility contact gets the schedule in the email itself.~~ Changed 2026-10-12 (owner, walking the dome flow):
  sending a schedule tells the club's coaches only, never the venue.** "This is between clubs and their coaches." A club
  that wants its venue to have the schedule sends it the Export (Excel or PDF, by facility). The venue keeps its booking
  office's email as a contact; nothing sends to it.

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
