# Milton Bats demo world — build plan (P1 of the Prospect Demo Program)

**Status:** on the board (Owner Morning Brief).
History (not kept current): Phase A built and run on dev 2026-11-10 (committed 9ca8c679d; sign-ups auto-approve under capacity; password only in .env.local) · Parent: `PROSPECT_DEMO_PROGRAM_PLAN.md` (P1, P4c) · Brief: `MILTON_DEMO_WORLD_PM_BRIEF.md`
Playbook (walkthrough): the "House League Demo Playbook" Artifact (republished from this plan's §6).
Presentation run sheet (Phase B, the five demos): https://claude.ai/artifact/J7QuDbZoRg3tZQsbYCh76W (`MILTON_DEMO_RUN_SHEET.html`).
Presentation deck (14 slides, everything outside the demos; built 2026-11-21 from the prep page's outline, /design and /marketing
passes applied): https://claude.ai/artifact/6z6xGQsVATLw8uRnQCsuc3, source `MILTON_PRESENTATION_DECK/` (publish from a copy of that
folder; the speaker notes are readable by anyone with the link, so the never-say lists stay on the prep page's Security tab).
Prospect handout (only what he sees — no reset, scripts, gaps or staging steps): `MILTON_DEMO_PROSPECT_WALK.html`, published as
https://claude.ai/artifact/NqFaetSngvqWEdJQ6u5A4T. Keep it in step with the playbook's five walks + four on-call. It links straight
into the season's admin tabs: the season is rebuilt under a FIXED id (`season.id` in the config, 2026-11-10), so those links survive
every reset — change the id only together with the run sheet. (This retires §7 limit (c) for the season; team ids still change.)
Walk 4 = U9 games AND practices (2026-11-10): the open field time is six club-schedule BLOCKS (`schedule.open.blocks`), one per park
and weekday, so House league's time shows each as its own "Give it to" row. Saturday blocks are cut into 90-minute slots (the
generator makes a game the length of a slot); Sam Sherritt's Tuesday holds two diamonds, so it alone seats U9's 4 teams once a week.
Telling families their practice times and Publish schedule both need U9's teams published (Walk 2) — the seed leaves U9 undrafted.

## 0. Rulings this plan stands on
- Prospect = **Milton Bats Softball Association** (owner 2026-11-10). A **non-demo, writable** Club-plan org on the **dev** database
  (staging reads it) — NOT the two-slug `DEMO_ORGS` list (those block writes and suppress email).
- Children and parents are **fictional**. Only the owner's own aliases receive mail. Every other address is `.local`.
- Divisions **U7, U9, U11, U13, U15**; softball; Jan 1 cut-off; 2027 season → birth years U7 2020–21, U9 2018–19, U11 2016–17,
  U13 2014–15, U15 2012–13.
- Venues (owner): **Sam Sherritt** 3 diamonds, **Lions Park** 3, **Kinsmen Park** 2 carry house league. **Sherwood Park** 1 diamond is
  **rep only — no house-league event is ever booked there.**
- The parent app (`GUARDIAN_TIER_ENABLED`) is on for staging (amplify.yml echo added 2026-11-10; console value set on the `dev` branch).
  While it is on, **Publish teams refuses until the club has a contact email and mailing address** — the seed sets both.
- Public page in Milton purple + logos. Logo files not yet supplied → placeholder purple + stock logo, swapped later in Public site › Look.

## 1. The world (one story per division)
| Division | Stage on demo day | Beat it carries |
|---|---|---|
| U7 | Registration open, ~14 kids, lots of room | Background only (no walkthrough job) |
| **U9** | Registration open, ~38 kids, teams created (4), ratings ~3/4 done, **not drafted**, no games; several sibling pairs rated differently; room for the live sign-up child | Walk 1 (live sign-up), Walk 2 (rate, draft, publish), Walk 3 (generate + publish schedule), Walk 4 |
| **U11** | Teams published, schedule published, earlier games scored, upcoming Saturday games, **two scores waiting in "Scores to check"** (one "Coach entered", one "Reported"), standings with ties | Walk 4 (rainout), Walk 6 (coach score), Standings |
| **U13** | Registration full, **waitlist of ~6**, ~2/3 paid, several owing (days differ), 1 corrected price, 1 refund, 1 ended, early-bird prices | Walk 1 (approve / promote), Money › Still owing |
| **U15** | Small (~20), 2 teams **published**, a published schedule with upcoming Saturday games | Team changes after publishing (banner + Review and email), Walk 4 |

Total ≈ 150 children, sibling households across divisions, a review queue (To review) in U7/U9/U13, notes on some sign-ups.
Also seeded: one finished **previous season** (Past seasons shelf), club schedule with field time offered to house league on the three
house-league venues (unallocated rows for the U9 Walk 3).

**Phase B (2026-11-21) adds the rep side, for the five presentation demos** (§8 holds the design):
| Piece | On demo day |
|---|---|
| **17 rep teams** in six age groups (U9 2, U11 3, U13 3, U15 3, U17 3, U19 3), "Milton Bats U11 A" style, invented until the club's list arrives | Each on a live "2027 Season" with a head coach (an accepted seat) and a light roster (11–12) |
| **The dome**: Escarpment Indoor Dome (invented), Fields 1–2 full and Field 3 half, one winter permit (Sundays 8 a.m.–2 p.m., 20 Sundays, 2 off, cost and field prices) | Placeholder until the club's permit arrives (config edit + rebuild) |
| **Dome schedule, part 1** (the permit's first 8 Sundays: 5 past, 3 to come) | **Sent and billed**: every team's hour each Sunday on its schedule, each team's share in its Money in installments |
| **Dome schedule, part 2** (from the first Sunday after the two dates off) | **Not built**: Demo 1 builds it live on the same permit, with nothing in its way |
| **Milton Bats U15 A** — the dressed team (`+repcoach` head coach, `+assistant` assistant) | Books, practices and drills, skills, lineups, attendance, a finished 2026 season behind it (§8) |
| **The club's shared drill set** (8 drills, Admin › Rep teams › Shared library) | Shows in every team's drill picker |
| **Public site**: rep team pages (automatic), two teams with tryouts open, one notice, sponsors | |
| **Milton Bats Winter Classic** (name invented, owed), a one-day dome tournament the Saturday before the demo, U11 and U15, six teams each | Every game final, standings, semifinals and finals, champions crowned; **free** (no fee book) |
Fees (placeholders until the owner supplies Milton's): U7 $120 · U9 $140 · U11 $150 · U13 $160 · U15 $160; early bird $20 off to a date.
Dates are **relative to `--demo-day`** (default today). Games are dated around it (a past block, the coming Saturday, a future block).

## 2. People
Owner = `+owner` ("Jordan Whitfield", President), a demo account like the others (owner 2026-11-10). The owner's real account
is **not** a member: a club has exactly one Owner seat (the "owner's email" lookups read a single row), so the seat moved
rather than doubled. Aliases (Gmail plus-addresses, delivered to the owner's inbox):
`+hladmin` (League admin, "the admin" persona), `+coach` (coach of one U11 team), `+parent` (a parent with a child in U9 and U11).
`+registrar` is **not** seeded (Walk 5 invites it live). **Passwords are set only when a user is first created — never on a reset.**
Phase B adds two aliases: **`+repcoach`** ("Morgan Hale", head coach of Milton Bats U15 A — Demos 2 to 4) and **`+assistant`**
("Priya Nair", its assistant — receives the practice plan in Demo 3). `+coach` stays the U11 house-league coach so no Phase A walk
changes. The other 16 head coaches are `.local` accounts. Every account's password is `MILTON_DEMO_PASSWORD` in `.env.local`
(gitignored), set once on creation. **Demo 1 signs in as `+owner`**: the scheduler builds, sends and bills for the Owner and an Admin
seat only, and `+hladmin` is a League admin (refused, by design).

## 3. Reset (binding requirement: any time, during or after practice runs)
- ONE command rebuilds the world: `npm run demo:milton` (build/refresh) and `npm run demo:milton:reset` (same, explicit). Idempotent.
- Deletes and re-creates **only rows owned by the Milton org** (children, registrations, teams, games, money, emails sent, notices,
  team-change state, previous season, club schedule). **Never touches auth users, their passwords, memberships, or the org's
  branding.** So an open browser session survives a reset.
- Refuses any database that is not dev; refuses to run if the org slug is not `milton-bats`.
- `--demo-day YYYY-MM-DD` moves the dates. `--dry-run` prints what it would do.
- A reset also clears what a live walk created (his pretend child, the rainout, the published U9 teams, the registrar invite).

## 4. Build order
A. Org + branding + contact details + venues + members/aliases + house-league season, divisions, registrations (money via the real
   money writer), ratings, teams, club schedule, U11/U15 published schedules and scores, previous season. Reset. ← dry-run gate
B. **The rep side, for the five presentation demos** (owner's go 2026-11-20, option A). Each stage ends with the rebuild run twice and
   a reset proven. Code: `scripts/lib/prospect-demo-rep.mjs`, called by the seed when the config has `repTeams` (Kestrel Bay has none).
   - B1 Rep teams, seasons, rosters, head coaches (+ the assistant), the dome and its permit.
   - B2 Dome schedule part 1, sent and billed through the product's own database functions (§8.1).
   - B3 The dressed team's books (§8.2).
   - B4 Practices with plans, the drill library, two templates, a station circuit, the club's shared drill set.
   - B5 Skills tests and testing days, observed skills, goals; fall-ball games with lineups and scores; attendance; the 2026 season.
   - B6 The tournament; the public site's notice, sponsors and tryouts.
   - B7 The run sheet for the five demos (checkable Artifact).
   Sherwood Park rep events are dropped: no demo uses them, and the dome carries the rep story.
C. Playbook republished around the five must-do walks + three on-call; reset instructions; QR codes with the real slugs.

## 5. Verification
Seed twice in a row (idempotent), then reset after a simulated walk (create a registration, publish U9) and diff counts; open each tab
on the local dev server; confirm the public page; confirm Publish is not blocked; confirm no row in another org changed.

## 6. Owed from the owner
Logo files · Milton's real fees and early-bird date · whether the aliases above are the inboxes wanted · the real tournament and rep
team names (or "invent") · push to staging (D1) before a staging dry run (a local dry run works now against the same dev database).
Phase B adds: **the club's dome permit** (dome name, fields and which are half, days and times, first and last day, dates off, cost) →
`dome` in the config · **the team list** → `repTeams` · **the meeting date**, so the world is rebuilt that morning
(`npm run demo:milton -- --demo-day <date>` the evening before at the earliest) · the tournament's name · a staging push of `dev` if
the screens shown should be today's (the world itself needs none: staging reads the dev database).

## 7. Review 2026-11-10 — fixed, and known limits
Fixed in the review commit: a reset after a test-card payment (online payment rows are now cleared first; the club's payment account is kept);
sign-up window times written as the app reads them; no acceptance dated after yesterday; `--demo-day` refused beyond -35/+60 days of today
(the app judges "open", the early bird and "the coming Saturday" by the real clock — rebuild on the morning of the demo).
Known limits, deliberately left: (a) a reset stops if a walk closes a fiscal year (the closed-year lock refuses the budget-line
deletes; do not close a year in a rehearsal). The tournament half of (a) is RESOLVED in Phase B: the Winter Classic is free (no fee
book, no team payments), and the reset now deletes the club's tournaments and tournament books before its budget words, so a
tournament a walk adds with a fee no longer stops it; (b) a member who accepted an invitation under any address other than the seeded `+registrar` keeps their seat through
a reset; (c) ids in season URLs change on every rebuild, so use navigation, not saved links; (d) U7/U9 hold "To review" rows although the season
auto-approves, and 2 U13 "To review" children registered after the waitlist formed; (e) the card-payment step shows only when the club has a
connected Stripe test account (D4) — a reset keeps it; (f) the previous season's acceptance dates are the build date.

## 8. Phase B design (2026-11-21; the owner's go 2026-11-20, "option A")
The script it serves is the prep page's Run of show (https://claude.ai/artifact/9RcK5CiWcRuTWW4LiBpyRn). Each answer below was read
from the code, not from this plan.

**8.1 Demo 1 is built live; Demo 2 needs it already sent and billed.** One permit, two schedules on it, on different dates.
- *Why not the same dates:* a second schedule reads the first one's practices as bookings already on the books. With the default rule
  "Never over a booking already on the books" every slot is held and every team is busy at that hour, so the live drafts come out
  almost empty; with the rule off, every slot shows as a clash, and a send would bill the teams a second time. Neither is a demo.
- *So:* the seed sends and bills **part 1** (the permit's first 8 Sundays), with two dates off after it. In the room, Demo 1 starts a
  new schedule from the same permit dated from the first Sunday after the dates off (**part 2**). Nothing is held, nothing clashes.
  The bill is added on the saved draft's own page ("Bill the teams ›"), not in the new-schedule window. **Send it "For review
  first"** (recommended, and what the run sheet does): a review books and bills nothing, so Demo 2 opens on part 1's bill alone;
  "Final now" would book and bill every team a second time. Part 1 is what "final and billed" looks like. Demo 2 never depends on it.
- *If the start date is left at the permit's first day,* the drafts say "Leaves out the N slots a booking already holds" and hand out
  only part 2's Sundays: correct product behaviour, worth one sentence in the room.
- *Rehearsals do not need to survive a reset.* A rehearsal teaches the split and the rules; those go into the config's `dome`, and the
  rebuild reproduces part 1 from them. A reset clears everything a rehearsal built (schedules, practices, bills).
- *Rejected:* a second permit (the club holds one), a rebuild flag (two worlds to rehearse), the same dates with the rule off (clashes).
- Part 1 goes through the product's own database functions: `org_permit_save` (the permit), `club_schedule_save` (the schedule, its
  blocks and slots), the bill terms on the draft as the Bill step writes them, a send row, then `club_schedule_finalize_priced`
  (practices on every team's schedule, the allocation, its splits and installments, the rates). The bill's figures come from the
  product's own pure bill code (`priceTheBill`, `paymentPeriods`, `timeSplits` in `lib/club-schedule-bill.ts`, loaded through the
  unit tests' resolver), so what the coach sees is what the scheduler would have billed. No budget line (off-plan): the club books
  have no fiscal year to open, and the coach-side bill is the same either way.
- Each team holds one hour a Sunday (17 teams, 18 slots: one slot stays open), rotating through the start times so no team always has
  8 a.m. The bill is shared by time; Field 3 is a half field, so a Sunday there costs half.
- The reset clears the dome rows itself: a final schedule can't be deleted through the product, and deleting one leaves its practices
  and bill behind (no foreign key, by design), so the rep teams go first and take the practices and bills with them.

**8.2 Money goes through the product's own writers: true for the club's bill, not possible for the coach's book.** The coach-side
writers live in the app's server code (route handlers and server-only modules a script cannot load); driving them over HTTP would make
every rebuild need a running dev server and a signed-in session. So the dressed team's book follows the recipe of the public coach
sandbox (`seed-demo-coach.mjs`), which keeps the derived columns in step (an installment is paid only when payments cover it; a
fundraiser rebate is its credit; a cost's amount is its installments' sum). The figures are then proved against the running app with
the product's own checks (`check-register-balance`, `check-money-report-arithmetic`, `check-budget-item-fold`). Recording a payment
live goes through the real route.
- The book: a budget (income and cost lines on the platform words), player dues in four installments (paid, part-paid, overdue,
  upcoming), a bottle drive with rebates to players, a sponsor (part received), costs and bills (paid, part-paid, one the coach paid
  himself), the club's dome bill, Budget vs. Actual with movement on most lines. The **balance check** and the **sponsor invoice** are
  done live (both are one or two clicks and neither has a seeded form in any fixture); the seed prints the cash-on-hand figure to type.
- Settlement reads on the Player dues tab as "if the season ended today": families with rebates are owed money back.

**8.3 Who signs in** — §2. **8.4 The plan the club is on:** a Club-plan club's own teams get the full (Premium) Coaches Portal with no
per-team charge and no per-team row (`lib/coach-portal-plan.ts`: a club org's teams carry it when the plan carries `module_rep_teams`;
`lib/plan-config.ts` Club and Club · Association both do). ⚠ 17 teams is the Club · Association band, not Club (Club's cap is 15; the
demo org's own cap is set to 40 so nothing refuses). Say "the club plan for your size", not a plan name.

**8.5 The tournament** is invented ("Milton Bats Winter Classic") and **free**, so it writes no fee book (§7 a). A one-day dome
tournament the Saturday before the demo, U11 and U15 (Milton's own A and B teams plus four invented visitors each), a round robin in two
pools of three, semifinals and finals, every game final, champions crowned. Standings and the playoff picture are computed by the
product on read. Played in the dome on a Saturday so it never meets the Sunday dome schedule.

**8.6 The dressed team (Milton Bats U15 A)** is mid-way through its 2027 season: fall ball (8 scored games with lineups, 6 practices)
then the dome (5 past Sundays with plans and attendance, 3 to come). Its 2026 season is finished, with practice plans, so "start from a
past season" has something to offer. The next dome practice has **no** plan: Demo 3 starts it from a past practice and sends it to
Priya. Two testing days (September and November) on four tests give each player a trend; observed skills and goals on every player.

**8.7 What staging shows that production does not** (staging runs `dev` with the family app and online payments switched on):
Checked against the code's labels 2026-11-21 (the run sheet carries each as a "step around" note):
| Where a demo passes it | What it is | Do |
|---|---|---|
| Demo 1 · the Admin Area's side menu | **Communications** (group email, Club Communications: dev only); Accounting's **Payouts** tab (online payments; shows because the club has a connected Stripe test account) | Don't open them |
| Demo 1 · "Start from the permit" | The **Permits** tick-list and **"Find the time across every permit"** (schedules across several permits: built, not yet on production) | Leave only the one permit ticked |
| Demo 2 · recording a payment | "How" offers E-Transfer, Cash, Cheque, Card, Other. "Card" is a card taken in person, not online; nothing here pays online | Record an e-transfer |
| Demo 4 · a player's "Family & paperwork" tab | **Guardians › Invite a guardian** (signed-in family app; renders only while it is switched on) | Stay on Skills & goals |
| Demo 5 · after "Sign up" | **"Pay $X by card"** under "To pay now" (online payments). The club's own questions (custom forms) are not seeded, so none show | Stop at the "To pay" card |
| Demo 5 · the sign-up's status page | "Sign in to see it" / "Email me an invitation" (signed-in family app; only once a child is placed) | Not reached |
The run sheet: `MILTON_DEMO_RUN_SHEET.html`, published as https://claude.ai/artifact/J7QuDbZoRg3tZQsbYCh76W (39 boxes). The phone
cards page (`MILTON_DEMO_QR_CARDS.html`) now carries the Winter Classic's QR code.

**8.8 Verified 2026-11-21** (demo day 2026-11-21): built four times. Two builds in a row match table for table (3,201 rows in 69
tables). A simulated rehearsal through the real coach routes (an e-transfer recorded, a balance check saved, the sponsor invoice
2027-001 made, a plan started from a past practice and sent to the assistant, a part-2 draft schedule) is cleared by the rebuild back
to the same 3,201 rows. No table outside Milton changed (only the dev server's own request log moved). Signed in as `+repcoach`, the
team's register closes at the same figure as Money's cash on hand, with dues, fundraising, club and cost rows behind it; Budget vs.
Actual, the club bill, attendance (8 games, 11 practices), playing time (8 lineups), both testing days, the drills, templates,
circuit and the past-season plans all read. Owner pages: Rep teams, Shared library, Schedules; public: the club, Teams, Tryouts, the
Winter Classic and its playoffs. Still owned after a reset, as before Phase B: three rows the club's Stripe test account and the
sign-up form's file sweep keep (`billing_locations`, `club_form_storage_removals`, `stripe_connect_events`).
- Seed lesson: a sponsor with a cheque in is stored "received" (the product flips it on the first cheque and works out "part
  received" from the money); stored "pledged" with an arrival, the register counts none of the cheque.
