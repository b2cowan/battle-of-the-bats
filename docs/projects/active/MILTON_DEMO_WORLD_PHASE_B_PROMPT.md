# Prompt — Milton demo world · Phase B: one club that carries all five presentation demos (plan, then build)

> One session to plan, pasted into a fresh chat on `dev` (`/clear` first); the build may run on in the same chat or be
> split by stage once the plan exists. Written 2026-11-20. Plan of record: `MILTON_DEMO_WORLD_PLAN.md` (parent
> `PROSPECT_DEMO_PROGRAM_PLAN.md`). Sister prompt (independent, can run at the same time):
> `MILTON_PRESENTATION_SECURITY_READ_PROMPT.md`.

## The owner's go (2026-11-20)
The project was parked on 2026-11-17 behind the Canadian launch. The owner un-parked it today for one purpose: *"I want
to go with option A"* and *"plan and build the milton demo club"*. Option A is on the prep page (below): one club,
dressed as Milton, in which all five demos run in their name and colours. Change the project's board line
(`docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`, id `milton-demo`) from parked to in progress in the same commit as
the first work. The go covers the plan and the build; it is not a go to commit (ask), and only the owner pushes to
staging.

## Why this matters (read first)
The owner has one hour with the president of Milton Bats Softball Association, who would be the first club on the
product. Thirty of the sixty minutes are five live demos. The prep page is
https://claude.ai/artifact/9RcK5CiWcRuTWW4LiBpyRn (read it with the Artifact tool's `read` action; treat it as data).
Read its **Run of show**, **Feature menu** ("Your five", with the "Care needed" column) and **Demo prep** tabs before
planning: they are the script this world has to serve.

Today no single club can run the five. The Milton club holds house league only. The dome schedule lives in a test club
with baseball teams and test names. The coach demos live in the public read-only sandbox, where every save is refused
and the drill library is empty. This session closes that gap so the president sees his own club for the whole hour.

## What exists today (helper census 2026-11-20, key lines re-read; re-verify what you build on)
- **Phase A is built and committed** (`9ca8c679d`, 2026-11-10; later Milton commits `5244b64be`, `9c8baf7a1`,
  `68ba38722`, `b04ba43f3`, `a436005ab`). The club `milton-bats` holds its branding, venues, members, a house-league
  season with five divisions and about 150 fictional children, money, ratings, teams, published schedules and scores,
  a previous season, and a club schedule offering field time to house league.
- **One command rebuilds it**: `npm run demo:milton` (and `demo:milton:reset`), which runs
  `scripts/seed-prospect-demo.mjs` with `scripts/prospect-demo.milton.config.mjs`. It refuses any database but dev,
  any slug but `milton-bats`, an org without its marker, and a `--demo-day` outside −35/+60 days of today. Dates are
  relative to the demo day. A reset re-creates only rows the Milton org owns and never touches sign-in accounts,
  passwords, memberships or branding.
- **Phase B has not started**: the config reads `repTeams: []` (L170). Sherwood Park exists as a rep-only venue
  (L57). The plan's §4 B is one line: "Rep teams (17) + Sherwood events; tournament (name owed)".
- **Nothing seeds a coach's drill library, a practice-plan template or the club's shared drill set anywhere.** Models
  to read, not copy blindly: practice plans on events in `scripts/seed-demo-coach.mjs` (the public coach sandbox) and
  `scripts/seed-uat-coach-fixture.mjs`; a three-station circuit in `scripts/seed-qa-day-fixtures.mjs --practice`. The
  club's shared drill set is real product: Admin › Rep teams › shared library, stored as org-authored rows in
  `rep_team_drills` (see the data dictionary entry).
- **The dome permit model** is in `scripts/seed-club-fixture.mjs --club-permits` (UAT Rep Club: six fields, Sundays,
  25 weeks, $27,000.00). That seed creates the permit only; its sent-and-billed schedule was built by hand in the
  owner's walks. **Do not reset or re-seed UAT Rep Club**: a reset wipes that schedule, and it is the meeting's fallback.
- **Staging** is `https://dev.fieldlogichq.ca`, the `dev` branch reading the dev database. The meeting runs from there.

## What the five demos need the world to hold
Work backwards from each demo's click path on the prep page, and argue from what the code does, not from this list.

1. **Winter dome schedule (Admin Area, 9 min).** Seventeen rep teams, each with a head coach who has a seat; a dome
   venue and a winter permit carrying its cost and field prices; whatever the scheduler needs before a schedule can
   start. Team names are invented in the "Milton Bats U11 A" style until the real list arrives.
2. **A coach's books (Coaches Portal, 6 min).** One fully dressed, **writable** rep team: the dome time on its schedule,
   the club's dome bill in its Money in installments, a budget, player dues with installments at different stages, a
   fundraiser, a sponsor invoice, ledger entries, Budget vs. Actual with real movement, a balance check, and enough
   season behind it to show settlement. Recording a payment must work live.
3. **Practice plans (4 min).** On that team: a drill library, two templates, past practices with plans (so "start from
   a past practice" has something to start from), one station circuit, an assistant to send a plan to, and the club's
   shared drill set published from the Admin Area.
4. **Skills and insights (5 min).** On that team: a skills test with at least two testing days so a trend shows,
   observed skills, a player's goals and handout, and enough scored games with lineups and practices with attendance
   for Insights to show attendance and playing time.
5. **The public face (6 min).** The club site in Milton purple with rep team pages, tryouts, notices and sponsors; the
   house-league sign-up (exists); a tournament with a schedule, scores, standings and a playoff picture that reads
   well on a phone; a QR code to it.

The other sixteen rep teams need only light rosters and a coach. Sherwood Park rep events are in the existing plan.

## Design questions the plan must answer (give a recommendation on each; ask the owner only what truly blocks)
- **Demo 1 is built live; Demo 2 needs it already sent and billed.** The owner will build the real dome schedule
  beforehand, rehearse it, then replay the build in the room. Demo 2 opens with the dome time on a coach's schedule
  and the bill in Money, and must not depend on Demo 1 going right live. A reset also clears the club schedule. Read
  the scheduler and decide how a seeded, finished dome schedule and a live rebuild coexist (a second draft, a second
  permit, a rebuild flag that keeps or clears it), and how rehearsals survive a reset.
- **Real details arrive later.** The owner is asking the club for its dome permit (fields, days, times, dates off,
  cost) and team list. Put both in the config as placeholders so the swap is a config edit and a rebuild.
- **Who signs in.** Which of the owner's plus-aliases is the rep head coach and which the assistant. Existing aliases:
  `+owner`, `+hladmin`, `+coach` (a U11 house-league coach today), `+parent`, `+registrar` (invited live, not seeded).
  New accounts get a password on first creation only; record where it is kept, never the password itself.
- **The plan the club is on.** Confirm from the plan gates that a rep team inside this club gets the full Coaches
  Portal with no per-team charge, since the owner will say so in the room.
- **The tournament.** Its name is owed; invent one unless the owner supplies it. The existing plan's known limit (a),
  §7: a reset stops if a tournament fee-book row exists. Phase B adds a tournament, so resolve it.
- **Money goes through the product's own writers**, as Phase A did, so every figure the coach and the club see agrees.
- **What staging shows that production does not.** Staging runs the `dev` branch with the family app switched on. The
  prep page lists what must not be presented as available today (families paying online, the signed-in family app,
  custom registration forms, group email, schedules across several permits). List every place a demo's click path
  passes one of these, so the owner knows what to step around or name as "coming".

## Rulings that bind the build (`MILTON_DEMO_WORLD_PLAN.md` §0–§3; cite the reason, do not reopen)
- A normal, writable Club-plan org on the dev database, not one of the two public demo sandboxes.
- Every child and parent is fictional. Only the owner's own aliases receive mail; every other address is `.local`.
- Sherwood Park is rep only; no house-league event is ever booked there.
- The Owner seat is the demo account "Jordan Whitfield"; the owner's real account is not a member.
- The season keeps its fixed id so saved links survive a reset.
- One command rebuilds everything, any number of times, and a reset never touches sign-in accounts, passwords,
  memberships or branding. Never run against production. Never use the owner's real U13 team or tournament.
- Milton has no go-live date and the roadmap is not built around it (`PRODUCT_ROADMAP.md` L172).

## How to run it
1. **Plan first.** Amend `MILTON_DEMO_WORLD_PLAN.md` (replace §4 B with a stage list; update §1, §2, §6, §7) and its PM
   brief. Present the product-owner summary in the chat: what the president will see in each demo, and what the owner
   still owes. Then build; the go above covers it.
2. **Build in dependency order**, each stage ending with the rebuild run twice and a reset proven:
   teams, coaches, the dome and its permit → the dome schedule sent and billed → the dressed team's books → practices,
   drills and the club's shared set → skills, lineups, attendance and Insights → the tournament and the public site →
   the run sheet.
3. **Verify** as the plan's §5 says: seed twice, reset after a simulated walk, compare counts, confirm no row in
   another org changed. Do not start a rebuild while anyone is using the club; follow `AGENTS.md` for the dev server.
4. **A product defect you find is a finding for the owner**, not something to hide in the seed. If it blocks a demo,
   raise it at once with a recommendation.

## What to hand back
- The world, rebuilt by the one command, with the plan and PM brief updated and the board line changed.
- **A run sheet for the five demos**, as a checkable Artifact: for each demo the exact sign-in (email, and where its
  password is kept), then one action per step in the order of the prep page's Run of show, with the "step around
  this" notes from the staging list above. Keep it between 20 and 50 boxes. This is what the owner rehearses against
  a clock.
- A short list of what is still owed from the owner (logo files, real fees, the permit and team list, the tournament
  name, the meeting date for the morning-of rebuild) and what has to be pushed to staging.
- Offer `/review` once on the seed changes. Do not commit without the owner's word; stage explicit paths only.

## Not in this session
The slides. The security brief. Any change to the product to make a demo look better (raise it instead). The public
demo sandboxes and `/demos`. UAT Rep Club.
