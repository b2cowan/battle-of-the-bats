# Milton Bats demo world — build plan (P1 of the Prospect Demo Program)

Status: Phase A built and run on dev 2026-11-10 (committed 9ca8c679d; sign-ups auto-approve under capacity; password only in .env.local) · Parent: `PROSPECT_DEMO_PROGRAM_PLAN.md` (P1, P4c) · Brief: `MILTON_DEMO_WORLD_PM_BRIEF.md`
Playbook (walkthrough): the "House League Demo Playbook" Artifact (republished from this plan's §6).

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
house-league venues (unallocated rows for the U9 Walk 3), Sherwood Park rep-only events, **17 rep teams** with light rosters (invented
names, "Milton Bats U11 A" style) — second priority.
Fees (placeholders until the owner supplies Milton's): U7 $120 · U9 $140 · U11 $150 · U13 $160 · U15 $160; early bird $20 off to a date.
Dates are **relative to `--demo-day`** (default today). Games are dated around it (a past block, the coming Saturday, a future block).

## 2. People
Owner = `+owner` ("Jordan Whitfield", President), a demo account like the others (owner 2026-11-10). The owner's real account
is **not** a member: a club has exactly one Owner seat (the "owner's email" lookups read a single row), so the seat moved
rather than doubled. Aliases (Gmail plus-addresses, delivered to the owner's inbox):
`+hladmin` (League admin, "the admin" persona), `+coach` (coach of one U11 team), `+parent` (a parent with a child in U9 and U11).
`+registrar` is **not** seeded (Walk 5 invites it live). **Passwords are set only when a user is first created — never on a reset.**

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
B. Rep teams (17) + Sherwood events; tournament (name owed) — after the dry run.
C. Playbook republished around the five must-do walks + three on-call; reset instructions; QR codes with the real slugs.

## 5. Verification
Seed twice in a row (idempotent), then reset after a simulated walk (create a registration, publish U9) and diff counts; open each tab
on the local dev server; confirm the public page; confirm Publish is not blocked; confirm no row in another org changed.

## 6. Owed from the owner
Logo files · Milton's real fees and early-bird date · whether the aliases above are the inboxes wanted · the real tournament and rep
team names (or "invent") · push to staging (D1) before a staging dry run (a local dry run works now against the same dev database).

## 7. Review 2026-11-10 — fixed, and known limits
Fixed in the review commit: a reset after a test-card payment (online payment rows are now cleared first; the club's payment account is kept);
sign-up window times written as the app reads them; no acceptance dated after yesterday; `--demo-day` refused beyond -35/+60 days of today
(the app judges "open", the early bird and "the coming Saturday" by the real clock — rebuild on the morning of the demo).
Known limits, deliberately left: (a) a reset stops if a walk closes a fiscal year or adds a tournament fee-book row (latent; Phase B adds a
tournament, revisit then); (b) a member who accepted an invitation under any address other than the seeded `+registrar` keeps their seat through
a reset; (c) ids in season URLs change on every rebuild, so use navigation, not saved links; (d) U7/U9 hold "To review" rows although the season
auto-approves, and 2 U13 "To review" children registered after the waitlist formed; (e) the card-payment step shows only when the club has a
connected Stripe test account (D4) — a reset keeps it; (f) the previous season's acceptance dates are the build date.
