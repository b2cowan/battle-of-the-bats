# Milton Bats demo world — build plan (P1 of the Prospect Demo Program)

**Status:** on the board (Owner Morning Brief).
History (not kept current): Phase A built and run on dev 2026-11-10 (committed 9ca8c679d; sign-ups auto-approve under capacity; password only in .env.local) · Parent: `PROSPECT_DEMO_PROGRAM_PLAN.md` (P1, P4c) · Brief: `MILTON_DEMO_WORLD_PM_BRIEF.md`
Playbook (walkthrough): the "House League Demo Playbook" Artifact (republished from this plan's §6).
Presentation run sheet (Phase B, the five demos): https://claude.ai/artifact/J7QuDbZoRg3tZQsbYCh76W (`MILTON_DEMO_RUN_SHEET.html`).
Presentation deck (16 slides since 2026-11-24: slide 8 "See what your families see" (two QR codes, the demo club's site and Battle of the Bats; images in `MILTON_PRESENTATION_DECK/assets/`, uploaded to the deck) and slide 13 "Your club's website, today and next"; the prep page and run sheet were renumbered the same day; everything outside the demos; built 2026-11-21 from the prep page's outline, /design and /marketing
passes applied): https://claude.ai/artifact/6z6xGQsVATLw8uRnQCsuc3, source `MILTON_PRESENTATION_DECK/` (publish from a copy of that
folder; the speaker notes are readable by anyone with the link, so the never-say lists stay on the prep page's Security tab).
Deck revised 2026-11-23 (deck version 12, source folder updated, not yet committed; owner 2026-11-23: meeting 2026-11-24 on the cover, the closing "Your questions" slide removed, slide 2 says only "since November 10" (that session was with the club's head of house league, not the board), slide 3 made generic to clubs, the last slide is "start with any part", and a new slide lists eighty live features in five groups): statuses trued up to the 11-22 and 11-23
releases (50 releases; group email, the club's own registration questions, several permits, the club plans, the legal pages, the
Security page and club file deletion read Live; Sponsorships reads "first part live" / Under way), and a /design pass (one footer and
one status pill on every slide, headings at the brand weight, the name as the lockup, Milton's own purple `#8B2FC9` / `#C084FC`).
A data audit the same day found the demo club thin or empty off-script (§10).
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
| **Battle of the Bats** (name invented, owed), a one-day dome tournament the Saturday before the demo, U11 and U15, six teams each | Every game final, standings, semifinals and finals, champions crowned; **free** (no fee book) |
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
deletes; do not close a year in a rehearsal). The tournament half of (a) is RESOLVED in Phase B: Battle of the Bats is free (no fee
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

**8.5 The tournament** is invented ("Battle of the Bats") and **free**, so it writes no fee book (§7 a). A one-day dome
tournament the Saturday before the demo, U11 and U15 (Milton's own A and B teams plus four invented visitors each), a round robin in two
pools of three, semifinals and finals, every game final, champions crowned. Standings and the playoff picture are computed by the
product on read. Played in the dome on a Saturday so it never meets the Sunday dome schedule.

**8.6 The dressed team (Milton Bats U15 A)** is mid-way through its 2027 season: fall ball (8 scored games with lineups, 6 practices)
then the dome (5 past Sundays with plans and attendance, 3 to come). Its 2026 season is finished, with practice plans, so "start from a
past season" has something to offer. The next dome practice has **no** plan: Demo 3 starts it from a past practice and sends it to
Priya. Two testing days (September and November) on four tests give each player a trend; observed skills and goals on every player.

**8.7 What staging shows that production does not** (staging runs `dev` with the family app and online payments switched on):
Checked against the code's labels 2026-11-21 (the run sheet carries each as a "step around" note).
**Stale since the 2026-11-22 release:** group email (Communications) and schedules across several permits are on production, so the
first two rows are no longer "not on production"; stepping around them is now a choice of time, not of truth. The run sheet's two
notes (Demo 1, steps 4 and 12) still say "not on production yet" and are owed an update. Online payments and the family app rows hold.
| Where a demo passes it | What it is | Do |
|---|---|---|
| Demo 1 · the Admin Area's side menu | **Communications** (group email, Club Communications: dev only); Accounting's **Payouts** tab (online payments; shows because the club has a connected Stripe test account) | Don't open them |
| Demo 1 · "Start from the permit" | The **Permits** tick-list and **"Find the time across every permit"** (schedules across several permits: built, not yet on production) | Leave only the one permit ticked |
| Demo 2 · recording a payment | "How" offers E-Transfer, Cash, Cheque, Card, Other. "Card" is a card taken in person, not online; nothing here pays online | Record an e-transfer |
| Demo 4 · a player's "Family & paperwork" tab | **Guardians › Invite a guardian** (signed-in family app; renders only while it is switched on) | Stay on Skills & goals |
| Demo 5 · after "Sign up" | **"Pay $X by card"** under "To pay now" (online payments) | Since 2026-11-24 the demo takes it: Stripe test card 4242, then the owner sees "Online, card" on Lily's record. Fallback if Stripe is slow: stop at "To pay" |
| Demo 5 · the sign-up's status page | "Sign in to see it" / "Email me an invitation" (signed-in family app; only once a child is placed) | Not reached |
The run sheet: `MILTON_DEMO_RUN_SHEET.html`, published as https://claude.ai/artifact/J7QuDbZoRg3tZQsbYCh76W (45 boxes since §9). The phone
cards page (`MILTON_DEMO_QR_CARDS.html`) carries the Battle of the Bats' QR code — since §9 a leave-behind, no demo time.

**8.8 Verified 2026-11-21** (demo day 2026-11-21): built four times. Two builds in a row match table for table (3,201 rows in 69
tables). A simulated rehearsal through the real coach routes (an e-transfer recorded, a balance check saved, the sponsor invoice
2027-001 made, a plan started from a past practice and sent to the assistant, a part-2 draft schedule) is cleared by the rebuild back
to the same 3,201 rows. No table outside Milton changed (only the dev server's own request log moved). Signed in as `+repcoach`, the
team's register closes at the same figure as Money's cash on hand, with dues, fundraising, club and cost rows behind it; Budget vs.
Actual, the club bill, attendance (8 games, 11 practices), playing time (8 lineups), both testing days, the drills, templates,
circuit and the past-season plans all read. Owner pages: Rep teams, Shared library, Schedules; public: the club, Teams, Tryouts, the
Battle of the Bats and its playoffs. Still owned after a reset, as before Phase B: three rows the club's Stripe test account and the
sign-up form's file sweep keep (`billing_locations`, `club_form_storage_removals`, `stripe_connect_events`).
- Seed lesson: a sponsor with a cheque in is stored "received" (the product flips it on the first cheque and works out "part
  received" from the money); stored "pledged" with an arrival, the register counts none of the cheque.

## 9. Demo 5 replaced: house league end to end (owner 2026-11-21, "go with your recommendations")
The public-page demo (club home, a team page, tryouts, a sign-up, Battle of the Bats on his phone) is replaced by one U9 child
followed from the sign-up to a team. Owner rulings, all as recommended: The Battle of the Bats phone card stays as a **leave-behind**
(no demo time); **one** parent-coach is added live ("same for the other three"); Demo 5 runs **7 minutes**, the meeting 31.
The owner: the sign-up questions, friend requests and board answers will be **on production by the demo**, so the run sheet
carries no "not on production" note for them (it keeps the "Pay by card" step-around, worded as "leave it").
- **The story (run sheet steps 34–45):** a parent (Sam Porter, `b2cowan+newfamily@gmail.com`, child Lily Porter born 2018) signs
  up on the public page, answers the club's three questions (allergies, T-shirt size, **"Can a parent help?" → Coach**) and names
  a friend by the code **MLT 9BV** (Tomas Volkov, seeded). Owner window, U9 › Teams: Filter › Can a parent help? › Coach gives four
  children (three seeded + Lily); each is moved to its own team and **locked**; Stingers gets Sam Porter as coach; Run the draft
  with families and friends together; the Together column and Registrations › Friend requests show every pair kept.
- **The questions** copy the dev test club's (dev-league-org, "Walk Summer 2027", made by the Stage 4 Part 3 walk fixture):
  "Can a parent help?" is many-choices (Coach · Assistant coach · Field set-up), asked once per sign-up, shown on the draft
  board. Written by `scripts/lib/prospect-demo-signup-form.mjs` when the config has `signupForm`; the form through the product's
  own `club_form_for_season`, one submission per family-made sign-up (`ref` = the registration id, as the screens read it),
  questions dated before the season opened so nothing reads "Not asked". 122 sign-ups answered, 235 answers.
- **Who answers "Can a parent help?":** only one-child households (a once-per-sign-up answer reaches one child); in U9 three Coach,
  three Assistant coach, three Field set-up; a few offers in the other divisions so the question reads as the club's.
- **Friend requests:** six confirmed U9 requests, five links — one pair both asked (by code), two more by code, two by name (confirmed
  by the League admin); one friend joining the Hargrove twins (a group of 3, the cap), one following a parent-coach's locked child. The
  live friend's code is **fixed** (`signupForm.liveFriendCode`, check letter worked out), so the run sheet prints it once.
- **Known product gap, said truly in the room:** a parent's "Coach" answer does not carry them onto the team; the admin locks the
  child and types the coach in. A "make this parent the coach" action is an idea, not built (IDEAS_BACKLOG).
- **Care:** moved but not locked, the draft deals a child again. Teams are not published (publishing emails the families).
- **Known limit (/review 2026-11-21):** the form is made after the seeded sign-ups exist, so the product's own first-need step
  records each seeded family's waiver as "recorded before documents had versions" on its Documents row, as any season reads whose
  form was made after families signed up (it did before §9 too, on the first sign-up). Demo 5 opens no seeded record; Lily's live
  sign-up writes a normal tick. Twins read as two sign-ups (the seed's registrations carry no shared sign-up reference).
- **The rebuild clears** Lily's sign-up, the locks, the draft and the coach. It also removed the Stage 4 Part 3 walk fixture's
  three questions on Milton's finished 2026 season (that walk passed 2026-11-21); the fixture's dev-league-org half is untouched.
- **Verified on dev 2026-11-21:** two rebuilds in a row each reset 3,671 rows in 72 tables with the same picks; the product's own
  `runDraft` with the three parent-coach children locked kept every household and every friend link together in 20 of 20 draws
  (teams 8/8/8/9 before Lily); the U9 board read as `+owner` returns the board question, nine answers, "Coach" → the three
  seeded children, five links, none waiting; the public sign-up page shows the three questions and the friend field. Probes:
  `.probe/milton-demo5-draft-check.mjs`, `.probe/milton-demo5-board-check.mjs`. Owed: the owner's rehearsal in a browser.
- **Papers:** run sheet Demo 5 rewritten (45 boxes; stored ticks reset). Deck slide `demos.html` ("The house league"; 31
  minutes) republished 2026-11-21 (deck version 7); the prep page republished the same day (version 3): Run of show (Demo 5 at 7
  minutes, questions 9), the agenda email's item 5, the feature menu (custom forms no longer "development site only"; top-20 #1 is
  now the club site), the value case, Demo prep and Start here (custom forms reach production before the meeting, owner's word).


## 10. Data audit 2026-11-23: what the demo club can and cannot show off-script (nothing built; owner's go owed)
Read from the dev database (world built for demo day 2026-11-21), read-only. The five scripted demos' preconditions all hold except
the date drift a rebuild clears. Off-script, a board of coaches can hit these:
- **Interrupts the first screen:** every Milton account accepted the Terms on 2026-11-17, older than the published 2026-11-22 version,
  so each sign-in meets the Terms screen. A rebuild re-records it (`ensureFixtureUser` → `recordLegalAcceptance`); confirm at rehearsal.
- **Date drift:** the 11-22 dome practice (Demo 3's "next practice, no plan") is past; four dues payments are dated after the demo day
  (`paidDay` is not clamped to it). Rebuild on the meeting morning, as §6 already says.
- **Seed not run in full since migrations 525–529:** the sponsor insert changed in `ee17f50df`; the reset list has none of the new
  sponsorship deal tables, so a rehearsal deal would survive a rebuild.
- **Dressed team (U15 A), shows well:** roster, 8 past games with scores, 8 past lineups (all read "Draft"), 14 practices (10 with
  plans), two testing days on four tests, observed skills, goals, attendance, playing time, the coach's book.
- **Dressed team, empty or thin:** no upcoming game, tournament or team event; no next-game lineup or lineup template; awards;
  player paperwork and documents (no templates in the club); opponent notes; Email families; Chat; tryouts (none on any team).
- **Last season:** U15 A's 2026 season holds four practice plans and nothing else, and has no door while 2027 is live (the closed-season
  page is the one door of a team with NO live season). "The season's end" needs a team whose only season is closed.
- **Club side, empty or thin:** Sponsorships (three bare names; no packages, deals or invoices); the club's budget, Budget vs. Actual
  and Bank (no fiscal year, §8.1's choice); tournaments (one finished event: nothing to register, check in, generate or score; no
  last year to reuse; News and Rules blank); Members (owner, one league admin, 18 coaches; nothing pending); Email history (one send).
- **Papers:** the deck's "Twenty more" speaker note now says which of the twenty the club can show; §8.5 says six teams a division
  and the data holds four.
- **Dressed 2026-11-23 (owner: "rebuild the demo world for tomorrow and dress the small items"), world built for demo day
  2026-11-24, not committed.** In `scripts/lib/prospect-demo-rep.mjs` (block B5b), `scripts/seed-prospect-demo.mjs` (KEEP) and the
  Milton config (`repPeople.invited`). On Milton Bats U15 A: three upcoming exhibition games on Saturdays (2026-12-05, 12, 19;
  the first is at least a week out, so the next event stays the dome practice Demo 3 plans), the eight past lineups marked
  ready, two award kinds and six awards, the opponent book (four lines, eight notes), two player notes, two emails in Email
  families' history, an emergency contact on every player and a medical note on two. In the club: one invitation waiting in
  Members (Renee Castellano, Treasurer, a `.local` account). Dues payments are no longer dated after the demo day.
  The reset deletes awards before the team (a type holds its awards with RESTRICT).
  - Proved: a reset over the dressed world cleared 3,698 rows in 78 tables with only the three usual strays, and a full build
    followed (cash on hand still $4,290.50; next dome practice 2026-11-29 with no plan; part 2 starts 2027-01-03).
  - **Not built, on purpose:** a lineup for the next game (Build lineup from a past one is the live step); signed documents and
    a waiver template (they need real stored files); tryouts, sponsorship packages and deals, a finished-season team, the
    club's budget and bank, a tournament in progress (none is small).
  - **Known limit:** a sponsorship deal made in a rehearsal is not cleared by the rebuild. The deal tables refuse a direct delete
    from the service role; the first attempt stopped a rebuild half-way (fixed the same evening by removing it).
  - **Lesson:** the rebuild reads counts through the hosted query service, which answered 502 for about two minutes that evening
    and stopped two runs (one after its reset). A rebuild is not safe in the last minutes before a meeting: build the evening
    before, and rebuild on the morning only if a rehearsal changed the world.
  - **Papers, same evening:** the run sheet republished (version 3; the 45 boxes and their stored ticks are unchanged): the build
    for Nov 24 and its figures, "rebuild only after a rehearsal, never in the last half hour", the two Demo 1 notes now say group
    email and several permits are live, the deck's slide numbers, and a new unticked card "If he asks to see more" (what is
    ready to open, what belongs in a second session). The board line and the PM brief say the same.
  - **The prep page, same evening:** republished (version 4) and given a source file for the first time,
    `MILTON_PRESENTATION_PREP.html`, built from the live copy (until now the published page was the only copy). Every tab says
    tonight's state: the club plans on sale, the legal pages and supplier list published, the demo club built and its figures,
    the deck's fourteen slides as published, the November 10 session named by its date only. On the Security tab the two
    "waiting" lines and the conditions /legal set on 2026-11-21 were lifted after checking the published Data Terms (72 hours,
    30 days for a new supplier, a full copy within 30 days, deletion with backups gone in 7 days); /legal has not re-read the
    tab since. The run sheet (version 4) adds that on staging Sponsorships' Deals and invoices are ahead of production.
