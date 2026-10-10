# Club Tier Stage 6c — one calendar: the coach's desk schedule, the club calendar and a team's schedule (built to hub version 78)

> Paste into a fresh session on `dev`. Written 2026-10-10, the day the drawings were **ratified**: all twenty asks as
> recommended, and the `/design` review's eleven drawing changes (owner: *"I agree with your recommendations"*). **Part A
> (three date defects) is its own commit and can run alone, first** — Ask 17 ruled it "fix now", and the coach's month arrow
> starts skipping a month on Oct 29. If the owner wants Part A sooner than the full build, ship Part A, stop, and report.
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 6c** (version 78).
> - Build **to the drawings, exactly**. Every NEW, RESTYLED and UNCHANGED tag note is a requirement; open each one. 6c's
>   screens: **specimen 1 · the coach's desk schedule** (`#s6c-coach`) and **specimen 2 · the club calendar and a team's
>   schedule** (`#s6c-club`).
> - **The recipe** (`#s6c-recipe`, lines C1–C13) is the rule behind every drawing; **the register** (`#s6c-register`, R1–R11)
>   says what stays different on purpose. Where a drawing and a recipe line seem to disagree, the recipe's REASON decides; say
>   so in the record.
> - **"Formatting check"** (`#s6c-format`) is your checklist, including the design review's eleven changes; **"Not drawn"**
>   (`#s6c-build`) holds this build's own rows and every finding handed to another owner.
> - The Decisions tab holds the rulings (rows dated "2026-10-10 · Stage 6c", Asks 1–20 + the design review row).
>
> **Read first:** `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 6c (the "🎨 DRAWN" and "⚖ RATIFIED" blocks), §5 **D3** (the
> club admin is read-only on a team's schedule) and **D5**; `COACH_SCHEDULE_DEEP_DIVE_PLAN.md` §1–§2 (F01, F09, R3, R5 — stage 2 is
> this build); the block "Findings handed over by Club Tier Stage 6c" in `TOURNAMENT_ADMIN_REDESIGN_PLAN.md` (the tournament's
> screens are NOT this build's). Survey notes from the drawing session: `.probe/s6c/notes-survey.md` (code facts with line
> numbers, 2026-10-10). Memory `project_club_stage6c_one_calendar`, `project_club_stage6_venues`,
> `feedback_build_to_approved_mockups`, `feedback_portal_is_the_formatting_benchmark`, `decision_one_toolbar_rare_tools_behind_tools`,
> `decision_export_is_one_button`, `decision_record_reads_first_edits_whole`, `decision_drawer_layers_form_vs_menu`,
> `reference_readonly_probe_fixture_traps`, `reference_artifact_publish_needs_full_read`, `reference_hub_script_parse_trap`,
> `reference_backticks_in_shell_strings`, `reference_js_replace_dollar_patterns`.

## ⚠ The lessons this stage already paid for

- **A shared part travels with its reason.** The club calendar's phone copied two coach choices whose reasons it didn't share
  (§288 W4). Before you reuse a part, check the register's "shared parts" table: the part, its question, who asks it.
- **The benchmark has defects.** The coach's date arrows step through the device's clock (Part A). Don't copy their arithmetic
  anywhere; the admin team schedule's and the club calendar's calendar-date arithmetic is the one to wear.
- **The admin's team schedule is a second, older copy of the coach's views** (gapped cards, Won/Lost, a dead "+N more", Week
  names spilling into the next column at 1440, no phone form). Replace it with the coach's views; don't patch the copy.
- **The club calendar hid cancelled and postponed bookings by a build-time choice nobody ruled.** Ruled now: shown, never a clash.
- **A41 is answered:** the shared booking row is the admin kit's / the portal's row (one recipe), which the tournament's Day
  already wears. The club calendar's List moves onto it. **Do not touch the tournament's schedule** (findings handed over).
- **Probes write nothing:** the layout sweep's fixture resolver re-anchors the probe game (a write); resolve ids yourself
  for any read-only probe. Saved sign-ins go stale: check the landed path and retry once.

## Preconditions (check before code)

1. **Git:** on `dev`; `git log` / `git status` fresh. Other sessions' hunks in shared files (TODO, the plans, the strategy
   docs, the tournament plan) are theirs. The tournament redesign's Stage 5 session may be drawing; it shares no file here.
2. **The UX summary for the owner comes first**, short and in owner voice: **a coach** (the desk Schedule opens on today; one
   row of controls; Import inside Add Event; a Month that shows time and name; today marked; the tablet Month a finger can use;
   Export in every phone view); **a club admin** (the calendar's List as rows; cancelled and postponed bookings shown; one day
   spelling; a team's schedule that is the coach's own screens, read-only, and works on a phone); **everyone with a live
   tournament** (the Overview's tournament dates stop reading a day early — Part A); **a free coach** (times in the event's
   clock — Part A); **families, house league and tournaments** — nothing changes in this build.
3. **One browser tester at a time;** ask before captures, probes, `check:layout`, `auth-setup` and a dev-server restart. Never
   reset a test club.

## The code, read 2026-10-10 (re-grep before you trust a line number)

- **The coach's schedule page** `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx`: views `:112`, `:121-123`, default List
  `:161`, cursor = today `:162`, chosen day `:165`; the scroll-to-today effect `:513-528` (a no-op above 640 by design, `:509-511`);
  **`navigate()` `:727-742` (Part A)**; the header's actions `:768-853` (the view glyph `:781-789`; Add Event's menu `:99-105`;
  **Import `:838-853`, hidden ≤640, with a stale comment**); `CoachPageHeader` `:890-902`; the toolbar `:910-922`; the date row
  `:976-992` (unnamed arrows `:978`, `:990`; week words `:982-987`; month `:981`); the phone's Export row `:1001-1007`; the day
  sheet's title `:1019`.
- **The views** `components/coaches/ScheduleCalendarViews.tsx`: `EventChip` `:155-268` (List lead `:172-174`; the trail
  `:187-223`; `CANCELLED` written in capitals `:206`; the result `:209-219`); tryout rows `:64-99`; unmirrored tournament games
  `:105-153`; List bands `:319-385`; Week `:407-474` (desk heads `:441`, "—" `:445`, phone line `:428`); Month `:515` (**Sunday
  first**), heads `:524-526`, today `:535`, desk chips `:570-635` (name cut at 14, no time; "+N more" `:596-604`), phone Month
  `:556-569`, `:641-659` (band `:645`, "Nothing on …" `:655`).
- `lib/coach-schedule-view.ts` (`fmtDate` `:19`, `fmtTime` `:23`, `monthKey` `:48`, `dayStr` `:55`, `shortDate` `:62`),
  `lib/coach-schedule-phone.ts` (`pickTodayRow` `:20-24`, `groupWeekDays` `:35-59`).
- CSS `app/[orgSlug]/coaches/coaches.module.css`: the arrows `:6187` (32 px), `:15850-15854` (44 at ≤768); Month today tint
  `:6390`; chips `:6393-6397`; the phone schedule block `:15773-15838`, `:15855-15917`; the view glyph `:15766-15777`;
  `.headerActionWideOnly` `:14921`. `CoachExportButton` (phone keeps Calendar only).
- **A team's schedule (admin)** `app/[orgSlug]/admin/rep-teams/teams/[teamId]/schedule/page.tsx`: views `:176-182`
  (`repKit.views`, the black fill), List `:203-211`, Week `:186-198` + `:215-219`, Month `:226-244` (Sunday first; "+N more" a
  span `:244`), the row `:56-69`, Won/Lost `:52-54`, the window with Done `:252-272`; CSS `rep-teams.module.css` `:437-535`.
  `lib/club-board-view.ts` `orgWeekdayDay` `:32-35` ("Sat Oct 10", no comma — the club board's next event shares it).
- **The club calendar** `app/[orgSlug]/admin/calendar/page.tsx` (views `:54-57`, default `:66`, `shownView` `:70`, cursor `:71`,
  toolbar `:194-214`, date row `:216-240` incl. the zone note `:232` and the pill `:234-239`, range words `:262-279`, step
  `:254-257`); `components/admin/kit/club/ClubCalendarViews.tsx` (Week card `:44-57`, phone card `:60-76`, heads `:88` / `:100`,
  **List table `:109-154`**, band `:125`, Month `:156-186`, window `:201-243`); `lib/club-calendar-view.ts` (program tag `:107`,
  **`timesNote` written in `:116`**, the Export line `:133-134`, `md` `:259`, day words `:298-300`, clash words `:311-316`);
  `lib/club-calendar.ts` (**cancelled / postponed filtered out** `:136`, `:140`, `:144`, `:148`, `:159`; the header says so `:20-21`);
  `ClubCalendar.module.css`.
- **The row both lists wear:** `components/admin/kit/club/RepKit.tsx` `ClubRow` `:134-181`, `ClubRowList` `:62`, `ClubRowBand`
  `:92`; the portal's `CoachRowList` / `CoachRow` — standard §3.10.
- **Part A:** `components/coaches/CoachLiveEventCard.tsx` `formatRange` `:27-32` (a bare date parsed as UTC midnight);
  the Overview `app/[orgSlug]/coaches/teams/[teamId]/page.tsx` `:1221` and `:1775` (``formatEventDate(`${date}T00:00:00`)``, a
  device midnight); `components/coaches/ScheduleEditor.tsx` `:86-102` (the free portal, the device's zone).
- **Layout:** `scripts/layout-screens.mjs` coach `:673-706`, `admin-calendar` `:1399-1403`, `admin-rep-team-schedule` `:1433`
  (List only — add Week, Month and the phone); the 768 Month chip debt in `scripts/.layout-baseline.json` `:12345-12400`
  (expected to retire).

## Part A · The three date defects (its own commit; first; can run alone)

1. **The coach's date arrows (C6-01):** step by calendar date, never through the device's clock — the arithmetic the admin team
   schedule and the club calendar already use. A month step from the 29th–31st lands in the next month (the cursor clamps to
   that month's last day): Oct 31 › is November, Jan 31 › February, Mar 31 ‹ February. East of UTC every press lands on the
   right Monday. The Week arrows keep the phone Month's chosen day on the grid. The arrows are named ("Previous week" /
   "Next week", "Previous month" / "Next month").
2. **The Overview's tournament dates (C6-02):** the live event card's range reads the stored dates as calendar dates in the one
   range spelling ("Oct 10–12, 2026", the platform's event-range helper; no hyphen); the Tournaments tile and the quiet-week
   card format the next date without a device midnight.
3. **The free portal's schedule (C6-03):** every date and time in the platform's zone (the zone helpers), never the device's.
- **Tests,** run under `TZ=Pacific/Auckland` and `TZ=America/Vancouver` as well as Toronto: the four arrow cases above, a week
  step east of UTC, the live card for Oct 10–12 in Toronto and Vancouver, a free-portal event at 8:00 p.m. read from Auckland.
- Help: none should change; grep the coach help for "Overview" tournament dates to be sure. **`/review` this part on its own
  (standard tier, a date lens) before committing it.**

## Part 0 · Record the rulings where the product reads them (its own commit, after Part A)

- **`memory/design_decisions.md`** (+ its `memory/MEMORY.md` line, same change): one entry, "2026-10-10 — ONE CALENDAR: THE
  RECIPE", naming C1–C13 and R1–R11 in a line each with their reasons, and the review's rulings that are new rules: a season
  list marks today with a **now line**, never a band; **today is said in words** wherever a day is headed; **a rare door
  (Import) lives in the create button's menu**; **a scope that doesn't depend on the view leads, the view follows, the dates
  follow the view**; **the olive face chooses what is read** (a switch for up to three views, the olive View pill for four or
  more; the admin kit's black fill leaves the calendars).
- **`docs/agents/design/TABLE_AND_LIST_STANDARD.md`:** a new **calendar section** — the recipe C1–C13, each with its reason; the
  register R1–R11; the shared-parts table (part · question · who asks it). **`TABLE_EXCEPTION_REGISTER.md`:** K-21 rewritten to
  name ONE calendar-cell chip (time, then title; the kind's colour on a team's calendar, the team's on the club's); the two other
  black view switches (a team's Tryouts page, the tournament's Communication page) listed as open, not ruled.

## What to build

### 1. The coach's desk schedule (specimen 1; Asks 3, 4, 6, 7, 16)

- **List opens on today at every width:** the list scrolls in its own frame at every width (it already does at 640 and
  narrower) and opens with the first event on or after today at the top, the season above; a finished season opens on its last
  event. Decide and record a minimum frame height for a short window (below it the page scrolls instead).
- **Today in the list:** with nothing on today, a now line "Today · Sat, Oct 10" between the last played row and the next; on
  a day with events, above that day's first row. The lead gains its weekday: "Tue, Oct 13 · 1:00 p.m.".
- **One toolbar line** under the title: the view switch, then (wider than 900 px) the date arrows and range, then Export and Add
  Event (lime, last). At 900 px and narrower the dates take their own row. **Import moves into Add Event's menu** ("Import from a
  file"), which also reaches the phone's + drawer. The title row keeps only the title.
- **Week:** today's column wears the club calendar's olive border and top line and its heading reads "Today · Sat, Oct 10";
  column headings in the condensed display face, in capitals; chips are the time, then the title, the kind's colour edge, the
  attendance ⚠ in the corner; empty days "—".
- **Month at a desk (wider than 768):** Monday first; each chip the time over the title (cut with an ellipsis); up to three, then
  "+N more" (opens the day, as today); today an olive ring, not the tint.
- **641–768 px:** the touch Month (dots, the whole day taps, the chosen day's rows under the grid) and every control at 44 px;
  the desk's 16 px chips retire with their baseline entries.
- **A phone:** Export is a 44 px icon in the title row in every view (the List-only "Export the season" row retires); a day's
  heading in the display face, in capitals; today never folds into a run of empty days ("Today · Sat, Oct 10 · nothing
  scheduled"); the phone Month's chosen day reads "Sat, Oct 10" over "Nothing scheduled." (not the sentence twice).
- **Words:** "Cancelled" in the chip's style (not written in capitals); the week range in the club's words ("Oct 5 – 11, 2026";
  no year on a phone) from one shared helper; every heading built from calendar parts or the zone helpers (none device-parsed).
  The Overview's "Sat, Oct 10, 2:00 p.m. vs Falcons" takes " · " before the time.

### 2. The club calendar (specimen 2; Asks 4, 5, 7, 8, 9, 10, 12, 13)

- **The toolbar line:** the view switch, the dates inline wider than 900 px (their own row at 900 and narrower), Venue · Program
  · Team, the amber clash count (it is Clashes only), "Times in Eastern time." and Export at the right end. **The view switch
  wears the portal's olive** (the admin kit's black fill leaves the calendar and a team's schedule; Tryouts and Communication
  keep theirs, open).
- **List becomes the row list** (the kit's `ClubRowList` / `ClubRowBand` / `ClubRow`): a band per day ("Tue, Oct 20"; "Today ·
  Sat, Oct 10" on today), **no count on a band**; a row's lead the time range, its one lead mark the team's swatch, its title "14U
  AA · Practice" / "Reds vs Blues", its caption where (with "House league · U9 Rookie ·" where more than one program shows), 6a's
  clash line under the place, the chevron, the whole row opening the read window.
- **Week:** each chip says the range ("5:30–7:30 p.m."), headings "Tue, Oct 20" in the display face with "Today ·" on today.
- **Cancelled and postponed bookings are shown,** struck through and dimmed, with their chip (Postponed in amber, for league
  games); never in a clash pair or a count; the read window says the state. Excel and CSV gain a Status column; the calendar
  file marks a cancelled booking cancelled and never writes a postponed game at its old time.
- **The zone sentence** is read from the platform's zone through one helper, not written into the page.
- **A phone:** the week stacks one frame per day with its heading inside (the coach's), bookings as hairlined rows with the
  team's colour rail, the clash line, the chevron; a run of empty days is the coach's dashed line; Filter and Export unchanged;
  the pill keeps "4 clashes".

### 3. A team's schedule (admin) (specimen 2; Ask 14)

- The page draws **the coach's List, Week and Month** with every write absent (no Add, no Import, no Export — register R7 —, no
  attendance or lineup taps), opening on today, with the coach's phone form; the season record card and the header stay; the
  view switch leads the line and the read-only sentence takes its end. Its own week grid, month grid and row retire.
- **An event opens a window that reads** (when, where, the opponent, the score and result, the state, notes) **with no foot**.
  If the coach's event window can't show its summary without its working doors cheaply, keep the kit window minus Done and record
  why.
- "Sat, Oct 3" takes its comma through the shared day helper (the club board's next event changes with it).

### Not this build (handed over; see the hub's "Not drawn")

The tournament's schedule and public schedule (the tournament redesign), house league's admin and public schedules (Stage 9), the
coach's tournament record (Stage 7), calendar feeds (6d), the event form (6e), Stage 11's grid (Stage 10 + 11).

## Help, words, walks

- **`/docs`:** the coach's schedule article (opens on today at every width; the one toolbar line; Import inside Add Event; the
  Month; today; the tablet Month), the club calendar's (rows; cancelled and postponed shown), the admin's team schedule (the
  coach's views, read-only). Retire any line that says the club calendar leaves cancelled bookings out.
- **`/marketing`:** "Import from a file", "Nothing scheduled.", the now line's words, the Status column's words. Draft them,
  tagged.
- **Walks:** a new Owner QA ledger § (take the number when you write it; grep before and after), checkable on the hub's QA tab,
  one purpose each, pinned to identities, with the sign-in card. **The definition of done:**
  1. (Part A) The coach steps Month forward and back across a year; Week forward five times; the Overview's live tournament
     card shows its own dates.
  2. The coach's List at 1440 opens on today with the now line; scrolling up reaches April.
  3. The toolbar is one line; Import sits in Add Event's menu; Export works.
  4. Week at 1440: the dates on the line, today's column and heading, a chip's time and title.
  5. Month at 1440: Monday first, each chip's time, "+N more" opens the day.
  6. At 768: the touch Month; every control at the floor.
  7. On a phone: Export from Week and Month; today's quiet line.
  8. The club calendar's List as rows (the seeded clash week), the clash lines, the cancelled Sunday game struck through; Week's
     chip ranges.
  9. The club calendar's phone week: one frame per day; "4 clashes".
  10. A team's schedule (admin) at 1440 and 390: the coach's views, Win / Loss / Tie and scores, opening on today, a window with
      no Done.
  11. A glance in Dark at 1440 and 390 on 2 and 8.

## Gates

- `npm run verify:changed`, `npm run typecheck`, the targeted unit files, `check:spelling`, `check:css-selectors`,
  `check:contrast` + `check:text-contrast`, `check:old-look` (lowered where the admin team schedule's copy retires),
  `check:export-catalog` (the club calendar's Status column), `check:dictionary` (no schema change expected — say so).
- A **screens guard** (6b's pattern): Monday first in every calendar grid; no device-parsed date formatting in the calendar
  family's files; the coach's one-line toolbar order and Import inside Add Event; the club List renders the kit row; the club
  calendar's read includes cancelled and postponed and its clash pairs exclude them; the admin team schedule draws the coach's
  views (no week or month grid of its own); "Today ·" on day headings.
- **`check:layout`, both themes:** the coach's schedule (List, Week, Month, at 1440, 768, 390 and 361), the club calendar's three
  views, and a team's schedule (add its Week, Month and phone entries). Ask first; baseline new entries with their reasons; prune
  the retired 768 chip debt.
- Then `/simplify`, `/review` (standard tier; a high-risk lens on the date arithmetic and the club calendar's read), and a
  `/design` review against hub v78 at 1440, 768 and 390.

## Hand-off

- An owner-voice summary; the walks; departures; anything found and not fixed.
- The plan record (§6 Stage 6c, "6c BUILT"), the PM brief, memory, the TODO line, and the hub's QA tab republished (read it
  fresh; the first publish of a session needs the live copy READ in full — one dedicated subagent reads every line through the
  last before its first publish, never split across agents; parse every script).
- **Next for the programme:** the joint **Stage 10 + 11** mockup session (it may open now; it does not wait for this build).
- **Commit only when the owner says**, from a private index with this session's files and hunks only; Part A and Part 0 are each
  their own commit.
