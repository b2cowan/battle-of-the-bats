# Club Tier Readiness — Stage 6c mockup session prompt ("One calendar: every schedule in the app, side by side")

> Paste into a fresh session on `dev`. Written 2026-10-10. **This session reviews, draws and settles rulings. It does
> not build.**
>
> **It runs beside the tournament redesign's Stage 5 drawing** (create and set up), which publishes to a different hub
> and shares no screen with this stage. It does share the dev server, the test clubs, the browser and the owner's time:
> see "Working beside the other sessions".
>
> **Why it sits here.** 6c's rulings come **before the joint Stage 10 + 11 drawing session**, because Stage 11's draft grid
> wears the club calendar's Week, and the scheduler should wear a recipe, not a copy. So the review and its rulings are on
> the release path, even though the builds they produce are not (plan §7, the 2026-10-09 merge note).

## The owner's ask (2026-10-09, walking §288 W4)

*"is there going to be a part of this project that reviews the calendars in the app to ensure formatting consistency
where it makes sense (tournaments, coaches portal, club, etc.)?"* → *"ok, can you incorporate the work from the coaches
portal schedule project (stages 1-5) so this all becomes 1 project?"*

Both of W4's phone calls (Export under the list; List repeating Week) came from copying the coach schedule's calendar
**without the reason behind each choice**. That is the failure this stage exists to stop.

## Read first

- `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`:
  - **§6 Stage 6c** in full: the merge table, the scope, what it produces, and **the rule it carries** ("a shared part
    travels WITH its reason").
  - **Stage 6d** and **6e**: what is NOT this session's (the feeds; the event form's last corrections).
  - **Stage 6**'s 6b record: the club calendar as built, and §288's owner calls (on a phone Export sits in the Filter
    row; a phone offers Week and Month, because List and Week both read one week there).
  - **Stage 11**: "the draft grid is the club calendar's Week". You review the grid **as proposed**; you don't design it.
  - **§7** sequencing, and **"Across every stage — formatting"**: the recipe you write lands there.
- `docs/projects/active/COACH_SCHEDULE_DEEP_DIVE_PLAN.md`: the RECORD of the coach schedule's walk (stations F01–F14,
  rules **R1–R6**, especially **R3 "today first, at every width"** and **R5 "a calendar entry is the event's own time"**).
  Its **stage 2 (the desktop schedule) is drawn and ruled INSIDE this session**:
  - **F01:** the desk opens on the season's first event, not today;
  - **F09:** Month at a desk can't say what or when (chips cut to "UAT probe prac", no time);
  - the toolbar's two rows as one;
  - the 641–768 band's Month (owed from §216 C4).

  Its hub (https://claude.ai/artifact/5yvmCESNKNWnpFiHg8b7Lc) keeps stage 1's drawings and walk §242. **New drawings
  go on the club hub, not there.**
- `TOURNAMENT_ADMIN_REDESIGN_PLAN.md`:
  - §6c (Stage 3 as drawn) and **A41**: the Day and the club calendar are "one shape where they answer the same
    question; whichever builds first makes it the shared part, and the other wears it". **Find out from the code which
    one built first** (6b `c43d767a` and Stage 3's build both landed 2026-10-09), and whether the second actually
    wears the first.
  - Stage 3's build commits (`baf4b0f3` … `e1d40e40`, `35e6ec2b`), and its as-built record if it has been written.
    **What Stage 3 built is an input to 6c, not something 6c overwrites.**
- The formatting standard: `docs/agents/design/TABLE_AND_LIST_STANDARD.md`, `TABLE_EXCEPTION_REGISTER.md`.
- In-repo `memory/design_decisions.md`, the 2026-10-09 entries:
  - the club calendar and the Venue library's four rulings;
  - a move can be taken back, a published game's move asks once, an event's own overlap is refused and another
    program's is amber, one game length;
  - the event window wears the record standard;
  - an export sits above what it exports;
  - a repeating event's pencil asks which dates first.
- The hub (ONE artifact; republish the SAME path): `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html` =
  https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9. Its Stage 6 section (the calendar's drawings and §288).
- Memory: `project_club_tier_readiness`, `project_club_stage6_venues`, `project_club_stage11_scheduler`,
  `project_schedule_deep_dive_inputs`, `project_tournament_admin_redesign`, `feedback_portal_is_the_formatting_benchmark`,
  `feedback_clickable_design_annotations`, `feedback_mockups_as_claude_artifacts`, `decision_export_is_one_button`,
  `decision_one_toolbar_rare_tools_behind_tools`, `decision_record_reads_first_edits_whole`,
  `reference_hub_script_parse_trap`, `reference_artifact_publish_needs_full_read`.

## The surfaces (read from the code 2026-10-10; re-read each before you rely on it)

1. **The coach team Schedule** (`app/[orgSlug]/coaches/teams/[teamId]/schedule/`; the views in
   `components/coaches/ScheduleCalendarViews.tsx`, the event sheet, the attendance room, the event form).
   - List · Week · Month, opening on List.
   - The phone scrolls to today before first paint; **the desk opens at the top of the season (F01).**
   - A row: "Oct 10 · 2:00 p.m.", the name with "vs / @ opponent", then chips: Moved, a mismatch ⚠, the head-to-head
     record, Scrimmage, the score, "WIN / LOSS" and "CANCELLED" (both upper case; a cancelled name is struck through).
   - Add Event and Import in the header; the view switch and Export in the toolbar; no filters.
   - On a phone: a View drawer, a stacked Week, a Month with the chosen day's rows under it, and Export as a row under
     the list.
   - ⚠ Read, not run: the date arrows step with device-clock arithmetic, which would land a day short on a device east of
     UTC. Verify before you rely on it.
2. **The club calendar (6b)** (`app/[orgSlug]/admin/calendar/`, `components/admin/kit/club/ClubCalendarViews.tsx`).
   - List · Week · Month, opening on this week. A phone offers Week and Month.
   - A booking card: time, a program tag (House league / Tournament), who, then "what · where". A clash wears the amber
     flag; a "busy then" booking is dashed.
   - **Cancelled bookings and postponed league games aren't shown.**
   - A booking opens a read window with "Clashes with" and one door to the owning schedule.
   - The toolbar is the coach's (`CoachListToolbar`), with Venue / Program / Team filters and Export (Excel, CSV,
     calendar). The date row carries the clash pill and a hard-coded "Times in Eastern time."
3. **The admin's per-team schedule** (`app/[orgSlug]/admin/rep-teams/teams/[teamId]/schedule/page.tsx`, read-only).
   - List · Week · Month, opening on List at today, without scrolling to it.
   - Rows read "Sat Oct 10 · 6:00 p.m." (no comma).
   - Its window still has a Done footer.
   - No Export, no filters, no tryout days.
   - **No phone form:** the week is seven columns at every width and scrolls sideways.
4. **House league's admin schedule** (`…/house-league/seasons/[seasonId]/schedule/page.tsx`, on the old-look
   baseline).
   - Week (the whole season in week groups, "Week of October 19, 2026"), List (a table) and Practices.
   - Hand-rolled times pinned to the zone.
   - A game opens its edit form, not a read window.
   - A division `<select>`, Generate, Add Game and Export in the toolbar. Its phone rules touch only the form.
5. **The public league schedule** (`app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx`).
   - Week groups ("Week of Oct 19 – Oct 25").
   - No location.
   - Cancelled games are left out, and **a postponed game shows with no word.**
   - No Export. No layout-sweep id.
6. **The tournament admin schedule (Stage 3, built 2026-10-09)** (`app/[orgSlug]/admin/tournaments/schedule/`).
   - Day · All games · Timeline · Bracket, **opening on the day** (today during the event, the first day before it,
     the last after it).
   - "Today · Fri, Oct 9"; bands "Fri, Oct 9 · 4 games".
   - **The Day's row is the club's `ClubRow` with Results' teams and where-line, not the club calendar's booking card.**
     So A41's "one shape" is not one shape yet: confirm, and rule which wears which.
   - One toolbar line (view, day arrows, Search, Filter, Tools), then Export (no calendar file) and Add game.
   - A game opens its window (`GameWindow`, full screen on a phone).
7. **The public tournament schedule** (`components/public/ScheduleContent.tsx`; also the organizer's preview).
   - A day strip with "Jump to date", opening on the first game day from today.
   - Hand-rolled words: "SATURDAY · OCT 10", "Today / Tomorrow", and a jump list whose **weeks start on Sunday**.
   - Badges: LIVE, Cancelled, Final, Unofficial.
   - "Add to calendar" for a followed team.
   - No layout-sweep id.
8. **The public team page and the family app** (`components/public/RepTeamPublicSchedule.tsx`,
   `app/(consumer)/family/teams/[teamId]/`, both through `lib/family-schedule-format.ts`).
   - "Sat, Aug 9 · 2:00 p.m.", then " · Cancelled".
   - The family list centres "Up next".
   - Subscribe makes a family calendar token.
   - The fan app's Scores (`components/consumer/ScoresClient.tsx`): "Today / Tomorrow / Jul 18" and Live / Final /
     Unofficial / Scheduled.
9. **The coach's tournament record** (`components/coaches/CoachTournamentRecord.tsx` → `CoachLiveSchedule.tsx`): its own
   hand-rolled dates and times, "Cancelled by the organizer", and "was 2:00, now 4:30" for a moved game. (The record
   itself is drawn with Stage 7; its words are in this review.)
10. **Date-grouped lists that are not calendars** (in the words review only):
    - the coach Overview's "This week" tile and the helper home's "Coming up";
    - the tournament game-day board;
    - the scorekeeper;
    - the club board's next event ("Sat Oct 3").

**What the surfaces already share:**

| Shared part | Used by |
|---|---|
| The coach toolbar and its view drawer (`CoachListToolbar`, `CoachToolbarMenu`) | coach, club calendar, admin per-team; the view pill on the tournament too |
| The phone week stack (`lib/coach-schedule-phone.ts`) | coach, club calendar |
| `KitDialog` windows | club booking, admin per-team, tournament game |
| `ClubRow` | tournament Day |
| The admin Export menu | club calendar, house league, tournament (the coach has its own button) |
| The Venue field and line (`WhereField`, `WhereLine`) | coach form, house league, tournament game window and move sheet |
| `lib/family-schedule-format.ts` | family app, public team page, the coach's event sheet |

**Where they disagree today** (your starting list for the words asks):

- **Day headings, six spellings:** "Sat, Oct 10" · "Sat 10" · "Saturday, October 10" · "Fri, Oct 9" ·
  "SATURDAY · OCT 10" · "Sat Oct 10".
- **Week headings, six spellings:** "Oct 5 – Oct 11, 2026" · "Oct 5 – 11, 2026" · "Oct 5 – Oct 11" ·
  "Week of October 19, 2026" · "Week of Oct 19 – Oct 25" · "Week of Oct 4" (Sunday start).
- **A cancelled event:**
  - "CANCELLED" on the coach's schedule;
  - "Cancelled" on most other surfaces;
  - " · Cancelled" on the family app;
  - **hidden** on the club calendar and the public league schedule.
- **A played game:** "Completed" (house league) or "Final" (tournament, public, Scores), and "WIN / LOSS" in upper case
  on the coach's schedule.
- **A postponed game:** only house league's admin says "postponed"; the public league says nothing.
- **Times:**
  - the zone helpers on the coach, club, per-team, family and tryout surfaces;
  - hand-rolled but zone-pinned on house league and the public league;
  - the stored wall clock with `formatTime` on the tournament and Scores;
  - **device-parsed** dates on the coach's day and week headings, the public tournament and the coach's tournament
    record.
- **Exports:**
  - coach: Excel, CSV and calendar, for the whole season;
  - club: the same three, for what is on screen;
  - house league: the same three;
  - tournament: Excel, CSV and PDF (no calendar);
  - per-team admin and the public league: none.

**For 6d, not to fix here:**
- The family feed **drops** cancelled events instead of marking them cancelled.
- The team-wide feed token still has no caller.
- The plan's 6d line that says the calendar file's code "still says STUB" is out of date: corrected 2026-09-25.

## What 6c produces

1. **The comparison, first.** One table on the hub: a column per surface, a row per dimension. Each cell holds a true-size
   capture, and the cell is clickable to its note. The dimensions (from the plan's scope):
   - the views offered and what each MEANS (its range: a week, a season, a day);
   - the toolbar and its order;
   - the date row (arrows, range words, the time-zone note);
   - how a booking or game reads (time · who · what · where, the program word, colour);
   - clash and conflict marks;
   - empty days and today;
   - the date it opens on;
   - the phone form (the view switch, the stack, where Filter and Export sit);
   - Export.

   Measure at 1440, 390 and 768 (the 641–768 band), in Warm and Dark. The captures are the evidence; the owner rules from
   them.
2. **A calendar recipe**: what is ONE recipe everywhere, written as rules with a reason each. It goes into the formatting
   standard when ruled (Stage 8 owns the standard; 6c writes the calendar section of it).
3. **A deliberate-differences register**: what differs on purpose, each entry with its reason. Already known:
   - the coach's List is the season, while the club's is a week;
   - the tournament timeline (venues across time) is its own job;
   - the family app reads and never edits.
4. **Per-surface deltas, each ruled, each with the project that builds it:**
   - the coach desk schedule (the deep dive's stage 2) and the club calendar: **6c's own build**;
   - house league's schedules: Stage 9;
   - the tournament screens: the tournament redesign (as a finding to it; its Stage 3 is built);
   - the public and family schedules: name an owner, or park them with a reason.

   **6c rebuilds nobody else's screen.**
5. **The shared parts, each with its reason.** For every part that two or more surfaces wear (or should wear), one line:
   the part, the question it answers, and the surfaces that ask that question. A surface that doesn't ask the question
   doesn't wear the part. This is 2026-10-09's lesson made into a list.
6. **Stage 11's draft grid**, as proposed: say which recipe lines it must wear, and anything in the recipe the scheduler
   would break. Specimen only, tagged "Stage 11 draws this".

**Not this session's:** the feeds and subscribe rows (6d; say only what the recipe asks a feed to carry, such as the
words for a cancelled event); the event form (6e); the coach portal's Tournaments list and record (the deep dive's stage 3,
drawn with Stage 7); any change to scheduling rules, clash rules or what a role can write.

## Blocking gate — item ONE is the mockup

1. **The comparison table and the drawings on the hub's Mockups tab, before any code.** Add a "Stage 6c" link set and
   screens. Whole screen, before (as built today, real fixture data) and after, for every surface with a delta.
2. **Every highlight is clickable:** NEW / RESTYLED / UNCHANGED tags and every comparison cell, each with its own
   `data-note`.
3. **True size:** the club's two widths (960 reading, 1200 tables and grids), the portal's own widths for coach screens,
   phone frames at 390px with the 44px block, and the 641–768 band. **Both themes:** "after" drawn Warm, with a Dark copy
   cloned at load (`.spec.darkcopy`).
4. **Check against the formatting benchmark before the owner sees a drawing.** The written rules come before any hub's
   CSS.
5. **Record every ruling on the Decisions tab as it happens** (rows `open`, then `accepted`).

## The asks (each with a recommendation; Decisions rows, `open`)

Write one ask per recipe line where surfaces disagree today, plus these:

1. **What each view means, everywhere.** Recommended: "Week" always means seven days; "Month" always a month grid that
   says what and when; "List" means the surface's natural range (a season for a team, a week for the club, a day for a
   tournament), and the range is said on the date row. A phone drops a view that repeats another (§288's ruling, made
   general).
2. **The date it opens on (R3, F01).** Recommended: today at every width when today is in range; otherwise the next day
   with something on it; a finished range opens on its last day.
3. **One booking row.** Recommended: time · who · what · where, in that order, with the program word where more than one
   program shows (the club calendar, Stage 11's grid), and the clash mark as the venue line's amber pill (6a). Name the
   row's single shared part, and say who wears it (A41).
4. **The toolbar.** Recommended: the 2026-10-01 order everywhere (scope · Search · Filter · Tools), the view switch where
   the surface has views, Export as one button above what it exports, and on a phone Filter and Export in one row (§288).
5. **Month at a desk (F09).** Recommended: chips with the time and a short title, "+N more" opening the day; the
   641–768 band gets the phone's Month or the desk's, never a third.
6. **Today and empty days.** Recommended: one "today" mark everywhere; an empty day reads as one quiet line in List and as
   blank space in grids.
7. **Words and time.** Day headings, week headings, status words (scheduled / moved / postponed / cancelled / final) and
   the clock: one spelling each (`formatTime`, "8:00 a.m."; the club's zone said once on the date row). List every
   surface that still differs.
8. **The public and family schedules.** Recommended: they follow the recipe's reading lines (row, words, time) and none
   of its editing lines. Name each delta's owner, or park it with a reason.
9. **The coach desk schedule (the deep dive's stage 2).** Rule F01, F09, the one toolbar row and the 641–768 Month as
   deltas of the recipe, built in 6c's own build.
10. **The build.** Recommended: one 6c build session for the coach desk schedule and the club calendar's deltas; every
    other delta handed to its owner as a finding with the recipe line it breaks.
11. **Anything the comparison finds** that the plan's list misses. Say so; don't force-fit it.

## Working beside the other sessions

- **The tournament redesign's Stage 5 drawing** may be running. It publishes to the tournament hub, never this one, and
  it doesn't draw a calendar. Its venue screens read the Venue library, which is Club 6b's; if Stage 5 asks for a change
  to the library, that is an ask on this project, not a drawing on theirs.
- **Other Club sessions may publish this hub** (6b's last walk and re-checks, §288 W9).
  - Before every edit, read it fresh and check `git status`.
  - Parse its scripts before every publish: one unescaped apostrophe kills every tab.
  - The Artifact tool refuses a publish until the live version has been read **in full**, once per session (about
    1.6 MB, every line through the Read tool). Hand that read and the first publish to a subagent.
  - Diff before merging a refused publish; never `force`.
  - The hub's stage switch hard-codes its stage list (`data-stg` buttons, `walkset` spans, `stageOf()`). Add "6c" there
    and change nothing else in the script.
- **One browser tester at a time.** Before any probe, capture or `auth-setup`, ask the owner whether another session is
  measuring. **Probes write nothing.** Never reset a test club without asking: a reset ends every session's club
  sign-ins.
- **QA walks keep their ticks by step POSITION.** Add steps only at a walk's end.
- **No code, no help, no gates.** Your files:
  - the hub's Mockups Stage 6c section, its INTENTS / Decisions additions;
  - the plan's Stage 6c section (and 6d/6e only where a ruling moves something into or out of them);
  - the PM brief's 6c paragraph, your TODO line, and memory.
- **Git:** use a private index and explicit pathspecs. Build shared files as HEAD plus your own hunks, and re-read HEAD
  immediately before committing. After committing, run `git reset -q -- <paths>` on the shared index. Commit only when
  the owner says.

## Hand-off

- Write in product-owner voice. Lead with what a coach, a club admin, a tournament director and a family see differently
  when they move between the product's calendars: the same day words, the same row, the same "today", and the
  differences that stay on purpose with their reasons.
- **Tell the owner to open the hub on a phone.**
- Put the asks as numbered questions with a recommendation each.
- Offer `/design` for a review pass if the session has budget.
- **When the asks are ruled:** write the 6c build prompt (the coach desk schedule and the club calendar's deltas), hand
  every other delta to its owner as a finding, and tell the owner the Stage 10 + 11 session can start.

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Redraw a screen 6c doesn't own beyond a delta specimen. A tournament, house-league, public or family screen is drawn
  "before" and as a delta, then handed to its owner.
- Design Stage 11's scheduler, the feeds (6d) or the event form (6e).
- Change a price, a plan or a gate, or write customer copy. Draw the placement and tag it `/marketing`.
- Mint a second artifact. The club hub is the only one this session publishes.
