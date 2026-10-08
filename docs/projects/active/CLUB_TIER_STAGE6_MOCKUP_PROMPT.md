# Club Tier Readiness — Stage 6 mockup session prompt ("Venues, the clash check and the club calendar")

> Paste into a fresh session on `dev`. Written 2026-10-08. **This session draws and settles rulings. It does not
> build.**
>
> **It runs beside Stage 3d's drawing (owner, 2026-10-08: "can round 3 happen in parallel with the new club 3d
> work?" → yes, with the rules in "Working beside the other sessions").** 3d moves the club's Payees list and an
> allocation into windows. It shares no product screen with this stage, but it shares the hub, the plan, the PM
> brief, the TODO, the Owner QA Ledger, the test club, the dev server and the owner's time. Check `git log` and
> `git status` before you start, and again before every shared-file edit.
>
> **Why now.** The tournament admin redesign has two stages left, 3 (the schedule) and 5 (create and set up), and
> both wait for this one: they draw the real clash warning and the one venue book, so those must exist first (the
> plan's §7, "two orderings are load-bearing"). Tournament Stage 6 (the volunteers) finished on 2026-10-08, so until
> this stage is ruled and its first build lands, the tournament redesign has nothing it can do.

## Read first

- `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`:
  - **§4D** (D01–D07), the venues inventory. Re-verify every anchor before you draw from it: line numbers have
    moved since 2026-09-25, and plans in this repo have been wrong.
  - **§5**: **D3** (the club admin stays read-only on a team's schedule, and gets two doors instead: the club
    calendar and the clash check), **D4 as AMENDED** (permits are in scope as Stage 10 and the release waits for
    them), **D5** (an internal, read-only club calendar in the first release; a public club schedule deferred).
  - **§6 Stage 6** (what it closes and its first list), **Stage 10** (the permit's starting shape: Stage 6 must
    leave the venue book and the clash check shaped so a permit can plug in), and **"Across every stage —
    formatting"** (the coaches portal is the benchmark, checked before the owner sees a drawing; the two widths,
    960 reading and 1200 tables and grids).
  - **§7**, sequencing: the two load-bearing orderings, and the old look Stage 6 retires (the venue library).
  - **§10 question 2** ("does the Club release wait for Stage 6?") is **already answered** by D4's amendment: the
    release waits for Stage 10, and Stage 10 sits on this stage's venue book. Record that; do not ask it again.
- `CLUB_TIER_PRODUCTION_READINESS_PM_BRIEF.md`: the "One venue book" paragraph, the stage table row for 6, and the
  risks bullet **"Permits and a club-wide calendar are new features, not readiness items … an explicit owner
  decision on whether they gate"**. That bullet is stale since D4's amendment: correct it in your brief paragraph.
- The hub (ONE artifact; republish the SAME path): `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html`
  = https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9. Stage 3c's Mockups section is the newest drawing method.
- `docs/projects/active/TOURNAMENT_ADMIN_REDESIGN_PLAN.md`: §1 **"Club Tier owns"** (Stage 6 = the one venue book,
  the cross-module clash check, the club calendar) and §7 **A5, "where each Club seam shows"** (Venues & facilities'
  "Import from library", the schedule's field picker and its clash warning, drawn there as today's behaviour and
  tagged "owned by Club Stage 6/7"). What you rule here is what Tournament Stages 3 and 5 will draw against.
- `docs/projects/active/COACH_ARRIVAL_AND_PLACES_PLAN.md` **§5 "Not built, on purpose": "No org-level venue library
  for coaches (admin's `org_venues` stays admin's)."** This stage reverses that sentence for teams inside a club.
  It is a ruling that changes a fact: say so in the drawing and ask it as its own question (Ask 1), and re-read the
  places plan's other reasons that cite it.
- `docs/projects/active/COACH_SCHEDULE_DEEP_DIVE_PLAN.md`, the stage ladder. Its **stage 4 (the coach's calendar
  feed)** and **stage 5 (the forms)** are not ruled and sit next to this stage's ground: see Ask 10.
- `docs/projects/active/GAME_LOCATION_SOURCE_OF_TRUTH_PLAN.md` ("Where is this game?", phases 0–4 complete,
  migration 229 on prod): house league's field model, and the two conflict engines made to agree. Read its Phase 4
  notes: coach events were ruled **out of scope** there, and it records the gap this stage closes (a tournament
  game and a league game on the same field are never compared).
- Memory: `project_club_tier_readiness`, `project_coach_arrival_and_places`, `project_tournament_admin_redesign`,
  `project_schedule_deep_dive_inputs`, `decision_record_reads_first_edits_whole`,
  `decision_edit_autosaves_create_asks`, `decision_drawer_layers_form_vs_menu`,
  `decision_one_toolbar_rare_tools_behind_tools`, `decision_export_is_one_button`,
  `feedback_portal_is_the_formatting_benchmark`, `feedback_clickable_design_annotations`,
  `feedback_mockups_as_claude_artifacts`, `feedback_qa_walkthroughs_as_checkable_artifacts`,
  `reference_hub_script_parse_trap`.

## What Stage 6 is

A club has three venue books that never meet, and a diamond can be booked twice across them with no warning:

- **The club's Venue Library** (house league points at it; tournaments import a copy).
- **A tournament's own copy** (it keeps a link to the library venue it came from, but nothing reads that link
  for clashes, and a cloned tournament drops it).
- **Each coach's place book** (the Coaches Portal's "Arrival & Places", built 2026-09-21; the team owns it).

House league checks its own games and practices. A tournament checks inside itself. A rep team's events have no
check at all. So a 12U practice, a house-league game and a tournament game can share Diamond 2 at 6 p.m.

Stage 6 draws four things, in this order of value:

1. **One venue book.** A club team's place can be one of the club's venues (or still a free-typed place); a
   tournament's venues keep their link to the library; house league already reads the library.
2. **One clash check across every program** (warn, never block): on every write that puts an event on a venue
   (a rep event, a series, a league game or practice, a tournament game, the generators). One warning shape and
   one sentence everywhere, for example "Diamond 2 is booked by 12U AA practice, 6:00–8:00 p.m."
3. **The club calendar** (D5): one read-only page for the club admin showing every team's games and practices,
   house league and tournaments, filtered by venue, team or day, with an export. (D03's per-program schedule is
   gone; see the starting map for what is left of the time problem, and Ask 8.)
4. **The Venue Library fixed and redrawn** (D02, D05): the right people can save (today saving needs a
   tournament permission a league admin does not have, and failures are silent); an in-use guard; facility
   edit; copy that names every program; a door in the rail wherever venues matter; and its old look retired
   (it is one of the two club areas still wearing it).

**What it is not:**

- **No admin writes to a team's schedule** (D3 stands: the coach owns the day-to-day).
- **No permit screens.** Permits are Stage 10, with their own plan, brief and mockup session. Stage 6 only leaves
  room: name the hook (the clash check later also asks "is this slot inside a permit we hold?").
- **No public club schedule** (D5 deferred it) unless the owner asks for it in this session.
- **No tournament screen redrawn.** Tournament Stages 3 and 5 draw the schedule and the setup screens. Here you
  draw the shared parts **once** (the clash warning, the venue choice in a picker) and place them as specimens on
  today's tournament screens, tagged "Tournament Stage 3 / 5 places this".
- **No coach form redrawn.** The coach's Add Event form and its place picker gain the club-venue choice and the
  clash line; everything else on the form stays as built (the schedule deep dive's stage 5 owns the forms).

## Blocking gate — item ONE is the mockup

1. **Mockups on the hub's Mockups tab, before any code.** Add a "Stage 6" link set and screens. Whole screen,
   before (as built today, real fixture names and times) and after.
2. **Every highlight is clickable:** NEW / RESTYLED / UNCHANGED tags, each with its own `data-note`.
3. **True size:** the club's two widths (960 reading, 1200 tables and grids; the calendar and the Venue Library
   list are 1200). The kit's windows are 640px (form), 800px (`wide`) and 26rem (question). Phone frames at
   390px with the 44px block. **Both themes:** "after" drawn Warm, with a Dark copy cloned at load
   (`.spec.darkcopy`).
4. **Four people, so four "before/after" journeys:** the club admin (the calendar, the Venue Library), a head
   coach on a club team (picking a club venue, meeting a clash), the house-league scheduler (a clash with a rep
   practice), and a tournament director (a clash with a club team; specimen only).
5. **Check against the formatting benchmark before the owner sees a drawing.** The written rules come before the
   previous hub's CSS.
6. **Record every ruling on the Decisions tab as it happens** (rows `open`, then `accepted`).

## Verify before drawing (read the code; plans in this repo have been wrong)

**A starting map (read from the code 2026-10-08; re-read each line before you rely on it):**

- **The Venue Library:** the page `app/[orgSlug]/admin/org/venues/page.tsx` (half kit, half old look: it is on the
  old-look baseline) and `app/api/admin/org/venues/route.ts`.
  - It reads behind the plan gate `hasOrgVenueLibrary` (League, Club, Club · Association).
  - Every write also needs the `create_tournaments` capability (D02).
  - Delete has no in-use guard: facilities cascade, and league games and practices lose their link.
  - The API can rename a facility; the page never offers it.
  - Tables `org_venues` and `org_venue_facilities` (`DATA_DICTIONARY.md`, the org venue entries: `is_active` is never
    used to filter, delete is hard).
  - Doors: the rail's Organization group ("Venue library", plan-gated, `lib/admin-kit-nav.ts`), a link on the
    house-league schedule page, and a "Venues" tile on the Organization page **with no plan gate** (a mismatch;
    record it). The old `AdminSidebar` that §4D's D05 cites no longer exists.
- **The coach's place book:** `rep_team_places` (team-owned, unique name per team, capped at 100), the places routes
  under `app/api/coaches/[orgSlug]/teams/[teamId]/places/`, `lib/coach-places.ts`, `lib/rep-event-places.ts`, and the
  picker (`PlaceCombobox` → `PlaceSheet` / `ManagePlacesSheet`, rendered by `components/coaches/ScheduleEventForm.tsx`).
  A rep event keeps its own copy of name, address and field plus a `place_id`. **Nothing links a place to a club
  venue today.**
- **Tournaments:** games store a local date and a local time (strings), with `diamond_id` (the tournament's own
  venue copy), `venue_facility_id` and `schedule_facility_lane_id`.
  - `diamonds.source_org_venue_id` and `venue_facilities.source_org_facility_id` are **one-time provenance stamps,
    not live links**.
  - The setup wizard's venue search returns **other tournaments' venue copies, not the library**. That is a finding
    for Tournament Stage 5; record it there, don't draw it.
  - Venues & Facilities' "Import from Venue Library" is the one library door.
- **Every clash check today:**
  - Tournaments:
    - `lib/schedule-conflict.ts`, in the browser only, one tournament: an overlap **blocks**, a buffer clash warns.
    - `lib/schedule-metrics.ts` (`scanVenueConflicts`), the health panel.
    - The schedule import's checks.
  - House league: `lib/league-schedule-conflict.ts` plus `lib/league-venue.ts` (`checkLeagueBookings`, org-wide
    across seasons). A match on a picked venue **blocks with a refusal**; a typed-text match only warns; the
    generator never blocks.
  - The shared "same surface?" answer both engines use: `lib/venue-identity.ts`. That is the natural place for the
    cross-program question.
  - **Rep teams: no check at all.**
  - ⚠ The clocks differ: tournament games are local strings, league games are instants with an end. Name the one
    clock the cross-program check compares in.
- **Calendars and time:**
  - ⚠ **There is no per-club time zone.** Every org runs on one platform constant (`ORG_TIME_ZONE`, Eastern, in
    `lib/timezone.ts`, with `orgDayKey` and `formatInOrgZone`). "The club's time zone" means that constant today.
  - **§4D's D03 is partly stale.** The per-program admin schedule it cites is gone. The admin's team schedule
    (`app/[orgSlug]/admin/rep-teams/teams/[teamId]/schedule/page.tsx`, read-only) already files days in that zone.
  - Week and month grouping still uses the **device** clock in three places: the coach schedule's week and month
    keys (`lib/coach-schedule-view.ts`), the house-league admin schedule, and the public league schedule.
  - `app/[orgSlug]/schedule/page.tsx` only redirects to the active tournament: there is no club-wide calendar.
  - Exports: the coach's and house league's downloads (`lib/export/schedule-calendar.ts`, `lib/export/ics.ts`), and
    the family feed (`app/api/family/calendar/[token]/route.ts`). The team-wide feed has no caller (D07).
- **Permits:** nothing exists. "Diamond Permits" is only a budget word.
- **The test club** (`scripts/seed-club-fixture.mjs`, "UAT Rep Club"):
  - ⚠ **It has no venues, no places and no event on a venue.** Its teams' events come from the coach fixture as free
    text ("UAT Fields").
  - Draw with the fixture's real team names and plausible venue names, tagged "drawn, not seeded". The build seeds
    venues as an additive step, never a reset: `--reset` deletes and rebuilds the org, removes the coach fixture,
    and ends the club sign-ins until `auth-setup` runs again.

**Count before you propose** (the Arrival & Places lesson: its case was a number, not a hunch). Read-only queries
on dev AND prod, and put the numbers in the drawing's notes:

- clubs with a Venue Library, venues and facilities per club;
- club teams' places, and how many share a name or address with one of their club's venues (what a one-time
  match would link, and what it would get wrong);
- tournaments whose venues still carry their library link, and cloned ones that lost it;
- existing clashes today, per pair of programs (rep × league, rep × tournament, league × tournament), counted on
  the same rule you will propose. If prod has none, say so: the case then rests on the club's first season.

**Every writer that should run the check.** List each route or job that creates or moves an event on a venue,
per program, including series, generators, drag-to-move, imports and the clone. A writer the check misses is the
defect this stage exists to close.

## The asks (each with a recommendation; Decisions rows, `open`)

1. **The place book meets the Venue Library (reverses Arrival & Places §5 for club teams).** Recommended: in a
   club, the coach's place picker lists the club's venues as their own group above the team's places; picking
   one keeps a link to it and copies its name and address the way a place does today; the coach still owns the
   team's own places and can still type free text. A team outside a club is unchanged. The club's Venue Library
   stays the club's (a coach reads it; never edits it).
2. **The diamond.** When a club venue has facilities, the place picker (or the event's "usual diamond") offers
   them as a list. Recommended: yes; the clash check is only exact when the facility is known.
3. **What counts as a clash.** Recommended: same venue + same facility + overlapping time; same venue with no
   facility on one side = "may clash" (a softer line); a free-typed place never clashes (and the drawing says so,
   because that is where a coach could miss one). Cancelled events never clash. Postponed ones clash on their new
   time. Say how long a rep event without an end time is assumed to run (house league assumes 90 minutes).
4. **Block or warn, by program pair.** The plan says the cross-program check warns and never blocks. But today a
   house-league booking on top of another league booking is **refused**, and a tournament overlap is **refused** in
   the browser. Recommended: keep each program's own refusal as it is (a double-booked league diamond is the
   league's own mistake), and make every **cross-program** clash a warning. Draw the two side by side so the owner
   sees the difference, and say plainly that the two rules sit next to each other on the same diamond.
5. **The warning: one shape, one sentence, every program.** Recommended: a line under the time and place fields,
   amber, naming the other booking (team, kind, time) and opening it read-only; it never blocks Save. Draw it on
   the coach form, the house-league game and practice forms, and as a specimen on the tournament game sheet.
   Decide what a coach may see about another club team's booking (recommended: team name, kind, time, nothing
   else).
6. **Clashes already on the books.** Recommended: the club calendar marks them (one amber marker and a "Clashes"
   filter); no notifications in the first cut.
7. **The club calendar.**
   - Where its door sits in today's rail (Stage 8's nav review may move it later).
   - Its views (recommended: Week first with a List view, Month on a computer, Day on a phone).
   - Its filters (venue, team, program, day).
   - The export: one Export button, per the export ruling.
   - What a row opens (recommended: the event read-only, in a window, with "Open in the team's schedule" only for
     someone who coaches that team).
   - **Time:** every day is filed in the platform's one zone, and the page says which (the starting map's
     ⚠). Whether a club outside Eastern time gets its own zone is **not this stage's to build**. Record it as a
     finding with the count of orgs it would affect today, and recommend where it belongs (a platform item, before
     the first such club).
8. **The device-clock leftovers of D03.** The weeks and months on the coach schedule, the house-league admin
   schedule and the public league schedule still group by the device clock. Recommended: the club calendar files
   by the platform zone from day one, and the three leftovers become one small fix that rides 6b's build. Ask; do
   not assume. (The admin's per-team schedule is already right; draw it only if the calendar replaces its door.)
9. **The Venue Library.**
   - Who can save (recommended: whoever schedules any program, not the tournament permission alone).
   - A venue is a record that reads first and edits whole, with its facilities (renamed too) inside it.
   - The in-use guard: what it says, and what Delete becomes when a venue is in use (recommended: Archive, which
     the table's unused `is_active` could carry).
   - Copy that names every program, and its doors: the rail, the house-league link, the Organization tile and
     its missing plan gate.
   - Its old look is retired in the build, not here.
10. **The calendar feeds (D07) and the schedule deep dive.** The dead team-wide public feed and the coach's
    subscribable feed belong to the deep dive's stage 4. Recommended: Stage 6 owns only the club calendar's
    export; D07 moves to the deep dive's stage 4 as a finding. Ask the owner to confirm the hand-off.
11. **The build split.** Recommended: two build sessions. **6a**: the venue book and the clash check (everything
    Tournament Stages 3 and 5 need). **6b**: the club calendar, the Venue Library redraw and Ask 8's small fix. 6a
    goes first, so the tournament redesign can draw its last two stages while 6b builds.
12. **Anything the verification finds** that the plan's list misses. Say so; don't force-fit it.

## Working beside the other sessions

- **Stage 3d's drawing may be running.** Its files: the hub's Mockups Stage 3d section, the plan's Stage 3 section,
  the PM brief's 3d paragraph, its TODO line. Never edit those. Yours are listed below.
- **The hub is published from the shared working copy by several sessions.**
  - Before every edit, read it fresh and check `git status`.
  - Parse its scripts before every publish (`new Function` over each `<script>`): one unescaped apostrophe kills
    every tab.
  - The Artifact tool refuses a publish until the live version has been read **in full**, once per session (about
    1.6 MB). Hand that read and the first publish to a subagent. After its publish, this session can publish
    directly.
  - A refusal saying a newer version is live usually means 3d's session published. Diff the live copy against
    yours (strip the publish skeleton first) and merge; never `force`.
  - Agree a turn with the owner if both sessions are about to publish in the same minutes.
  - ⚠ **The one place both sessions must edit the same lines: the hub's stage switch.** The stage buttons
    (`nav#walkNav`, `data-stg="1|2|3a|3b|3c"`), the `walkset` spans and `stageOf()` hard-code the stage list, and
    the saved stage uses the key `club-hub-stage-3c`. **Whichever session publishes first adds BOTH new stages, "3d"
    and "6"** (buttons, `walkset` spans, `stageOf()` cases), and changes nothing else in the script. The other
    session then only adds its own sections. New sections follow the pattern
    `<section class="screen s6" id="s6-…" hidden>`.
- **The Owner QA Ledger:** if your drawings lead to walks, take the next § number only when you write it, and
  re-grep the ledger right after appending (another session may have taken the same number).
- **QA walks keep their ticks by step POSITION.** Add steps only at a walk's end.
- **One browser tester at a time.** Before a probe, capture or `auth-setup`, ask the owner whether another session
  is measuring. Read-only probes only; never create, move or delete an event or a venue on dev without the
  owner's go.
- **Never reset the test club** ("UAT Rep Club") without asking: a reset ends the club sign-ins for every session
  using them, including 3d's.
- **No code, no help, no gates.** Your files:
  - the hub's Mockups Stage 6 section, and its INTENTS / Decisions additions;
  - the plan's Stage 6 section (and §4D's anchors where you re-verified them);
  - the PM brief's Stage 6 paragraph and the stale permits bullet;
  - your TODO line under Club Tier, and memory.
- **Git:** use a private index and explicit pathspecs. Build shared files as HEAD plus your own hunks; re-read HEAD
  immediately before committing, because another session's commit can land in between (2026-10-08: a TODO line was
  dropped and then restored twice by two sessions at once). After committing, run `git reset -q -- <paths>` on the
  shared index. Commit only when the owner says.

## Hand-off

- Write in product-owner voice. Lead with what each person sees differently: the club admin (a calendar that
  shows the whole club; a Venue Library that saves and says what it holds), a head coach in a club (the club's
  diamonds in the place picker; a clash line before Save), the house-league scheduler (a clash with a rep
  practice), a tournament director (the same line, later, through Tournament Stages 3 and 5). Then what a coach
  outside a club sees: nothing; say so.
- **Tell the owner to open the hub on a phone.**
- Put the asks as numbered questions with a recommendation each.
- Offer `/design` for a review pass if the session has budget.
- **Write the build prompt(s) only after the drawings are ratified** (two if Ask 11 is ruled as recommended). Their
  definition of done carries:
  - every writer from "Verify" running the check, each with a test;
  - the counts re-run after the build (links made, clashes found);
  - the migrations with their dictionary lines and snapshot refresh, and their prod order recorded;
  - the Venue Library's old look removed (`check:old-look` lowered in the same change);
  - walks for each of the four people, on a phone too;
  - a note to the tournament redesign that its Stages 3 and 5 can draw.

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Reopen admin writes to a team's schedule (D3).
- Draw permit screens (Stage 10), or a public club schedule unless the owner asks.
- Redraw a tournament screen or the coach's event form beyond the parts named above.
- Touch Stage 3d's section, files or drawings.
- Change a price, a plan or a gate, or write customer copy. The homepage's "field bookings" line is `/marketing`'s
  and comes back with Stage 10, not this stage.
- Mint a second artifact. The hub is the only one.
