# Club Tier Stage 10a — Permits: the time the club holds (built to hub version 87)

> Paste into a fresh session on `dev`. Written 2026-10-11, the day the Stages 10 + 11 drawings were **ratified**: all
> twenty-seven asks as recommended (owner: *"looks great, go ahead and write the build prompt based on your
> recommendations"*). **The build order** (Ask 10, as the owner amended it
> 2026-10-11): **this one, 10a** (permits) → **11a part A** (`CLUB_SCHEDULER_A_BUILD_PROMPT.md`, the scheduler's server)
> → **11a part B** (`CLUB_SCHEDULER_B_BUILD_PROMPT.md`, its screens) → **11b** (house league's half, with Stage 9). **6d**
> (calendar feeds) is drawn and built on its own and may run beside any of them. 10a goes first because the scheduler's *Start
> from a permit*, its fields-by-price and its bill all read what this build stores.
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stages 10 + 11** (version 87).
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every NEW, RESTYLED, UNCHANGED,
>   SHARED and COPY tag note is a requirement; open each one. **10a's screens:** *Where the club's time stands*
>   (`#s1011-status`), *One model of time* (`#s1011-model`), **1 · Venue library · Permits** (`#s1011-library`), **2 · A
>   permit** (`#s1011-permit`), **3 · Outside a permit** (`#s1011-clash`), from **12** (`#s1011-others`) the two
>   budget-line frames only, from **14 · The dome, walked** (`#s1011-flow`) **Step 1 only** (the permit prices its fields),
>   and from **15 · Exports** (`#s1011-exports`) the house-format references and **A permit's use** workbook. Everything
>   else on the stage is 11a's.
> - **"Formatting check"** (`#s1011-format`) is your checklist, every row, including the seventeen `/design` changes.
>   **"Not drawn"** (`#s1011-build`) holds the build's own rows; its **Permits**, **Plans**, **Exports**, **Gates** and
>   **Help** rows are this build's.
> - The Decisions tab holds the rulings with their reasons (rows "Stages 10 + 11 · Ask 1–27"). **10a's: Asks 1, 2, 3, 4,
>   7 (the venue's bookings contact only), 8a, 21 and 26.** Where you must depart from a drawing, say so at build time and
>   record why; never silently.
>
> **Read first:** `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` (the record: §0–§3 for the evidence, §5.1–§5.2 the shape, §6 Asks
> 1–4, 8, 21, 26, §6a step 1–2, §6b, §7's 10a bullet); `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 **Stage 10** (its
> pointer) and §5 **D1** and **D3**; `CLUB_TIER_STAGE6A_BUILD_PROMPT.md` and `CLUB_TIER_STAGE6B_BUILD_PROMPT.md` (the
> clash check and the Venue library this builds on). Memory `project_club_stage11_scheduler`,
> `project_club_stage6_venues`, `project_club_tier_readiness`, `feedback_exports_house_format`,
> `feedback_build_to_approved_mockups`, `feedback_portal_is_the_formatting_benchmark`, `feedback_money_figures_one_joined_band`,
> `decision_record_reads_first_edits_whole`, `decision_edit_autosaves_create_asks`, `decision_rare_door_ends_body`,
> `decision_export_is_one_button`, `feedback_sport_neutral_no_debt`, `reference_artifact_publish_needs_full_read`,
> `reference_hub_script_parse_trap`, `reference_backticks_in_shell_strings`, `reference_js_replace_dollar_patterns`. The
> in-repo `memory/design_decisions.md` entries from 2026-10-01 on.

## ⚠ The lessons this stage already paid for

- **The permit hook is not a hook.** `lib/venue-clash.ts:37-38` says Stage 10 adds `outside_permit` "without changing a
  caller". It can't: `clashLine` keeps only the two kinds (`lib/venue-clash-words.ts:108-109`, a third is dropped
  silently), the sort treats anything else as busy (`venue-clash.ts:250`), and the calendar's pairs and its clashes-only
  count assume two kinds. A booking outside a permit is **not a pair** either. Build the permit answer **beside** the pair
  rule (its own module, its own field on each check's reply), never as a third `ClashKind`, and rewrite that comment to
  say so (P11-04b).
- **Plans in this repo undercount; the code is the list.** The 6a guard's `WEARS_THE_FIELD` list
  (`tests/unit/club-stage6a-guard.test.ts:140-146`) is the floor for "every form that asks where", not the ceiling: grep
  for `<WhereField` again before you wire the line — another session may have added a form since 2026-10-11.
- **The tournament's game window has no live check.** Its clash line comes back in the save reply
  (`GameWindow.tsx:288-289`, built in `schedule/page.tsx:665`). The permit line rides the same reply there; don't add a
  live hook to the tournament in this build.
- **The tournament redesign's Stage 5 may be building beside you** (its last build; recent commits are its). It owns the
  tournament's schedule screens. Before touching `app/[orgSlug]/admin/tournaments/schedule/**` or
  `app/api/admin/tournaments/**`, read `git status` for those paths: if they hold that session's uncommitted hunks, wire
  the tournament's permit answer last, as a server-only change to the reply, and tell the owner.
- **`rep-team-documents` was made by hand in the dashboard** (`022_rep_team_documents.sql:5-17` says so) — a bucket that
  exists on one database and not the other is drift. The permit's document store is made **by a migration**, as
  `087_resources_storage_bucket.sql` made `resources`.
- **The club's Excel reports never get the club's logo, and always stamp "Generated by FieldLogicHQ"**, even for a club
  that turned branding off: `components/admin/kit/club/money/ClubMoneyExport.tsx:27-30` fetches the resolved paper
  settings only when the format is PDF, so `lib/coach-money-exports.ts:1664` falls back to the defaults. Ask 26 fixes it
  in this build, and the branding defect closes with the same line.
- **The fixture's bookings float with the seed day** (the 6a flag dates them from the run). A permit with fixed dates
  would drift away from them by November. The test permits float too (Part 6).
- **`lib/db.ts` holds a NUL byte**: ripgrep treats it as binary and silently skips it. Search it with `grep -a`.
- **Shared files are shared.** 6d may be drawing; the tournament redesign may be building. The hub, the club plan, the
  TODO, the QA ledger, the dev server and the test club are everyone's.

## Preconditions (check before code)

1. **Git:** on `dev`; `git log` and `git status` read fresh. Other sessions' hunks in shared files (TODO, the plans, the
   briefs, the ledger, the hub, the strategy docs) are theirs: build shared files as HEAD plus your own hunks.
2. **Ask 4 is logged before its gate is built.** Ruled 2026-10-11: permits on **League Plus and both Club bands**, the
   same plans as the Venue library and the scheduler. That changes a Decided entry (`BUSINESS_DECISIONS.md` 2026-09-25,
   "Permits & bookings are IN the Club tier") and a Facts line (`PLAN_PRICING_FACTS.md:87`, "Club inclusion … No feature
   key"). **Logged 2026-10-11** (`BUSINESS_DECISIONS.md` "Permits ride with the Venue library"; the
   Facts doc's permits line): read it, and follow any newer entry. This build never writes the strategy docs itself.
   **Decided for `/billing`:** no new feature key — permits live inside the Venue library, so they ride its gate
   (`hasOrgVenueLibrary`, `lib/plan-features.ts:150-152`: `league`, `club`, `club_large`), and the Facts doc's "no
   feature key" stays true while its plan line changes.
3. **The UX summary for the owner comes first** (AGENCY_RULES), short and in owner voice:
   - **a club admin:** the Venue library gains a Permits view (what the club holds, how much of it is used, what it
     costs, filed by fiscal year); a permit reads first and edits whole; Add permit takes the venue's fields with a price
     each (a full field, a half field, a share); a venue's window lists the permits that hold time there and keeps a
     bookings contact; a budget line says which permits it pays for; a permit's use exports for the town or the dome;
     the club's Excel reports carry the club's logo;
   - **anyone booking a club venue** (a coach, a house-league scheduler, a tryout day, a tournament director): one quiet
     line under Venue when the time is outside the club's permit there — never amber, never a refusal; nothing at a
     venue the club holds no permit at;
   - **a club with no permits:** nothing changes;
   - any departure from the drawings.
4. **One question the drawings leave open — put it to the owner before Part 3.** *Who reads a permit?* The Venue library
   is read by everyone who can open the admin side and written only by savers (`lib/venue-library.ts:25-29`); a coach is
   refused (`app/api/admin/org/venues/route.ts:104`). A permit carries a cost and a budget line. **Recommended:** the same
   readers as the Venue library (club officials; the drawing shows the cost to whoever reads), the same savers, and a
   coach never reads a permit — the quiet line names a facility, days and hours, never a cost, issuer or reference.
   Record the answer in the plan's §6 under Ask 1.
5. **One browser tester at a time.** Ask the owner before any capture, probe, `check:layout` sweep or `auth-setup`, and
   whether another session is measuring. Ask before a dev-server restart (new files and shared modules change here, so
   one is owed before the walks). **Never reset the test club** — Part 6 is additive, and you ask before running it.

## The code, read 2026-10-11 (re-grep before you trust a line number)

- **The Venue library page** `app/[orgSlug]/admin/org/venues/page.tsx`: `VenueLibraryPage` `:45`, plan gate `:51`, the
  `?library=1` read `:68`, header and Add venue (`#org-venue-add-btn`) `:84-95`, the table and phone rows `:125-168`, the
  toolbar `CoachListToolbar` `:173` (**no view switch today — Venues · Permits goes here**), the windows `:198-226`.
  Styles `components/admin/kit/club/VenueLibrary.module.css`.
- **The venue's windows** `components/admin/kit/club/VenueLibraryWindows.tsx`: `BookedBy` `:110`; `VenueWindow` `:124`
  (reads first; the pencil is the `edit=` prop `:220`); the read body `:239-266` (Address / Notes `:241-248`, Facilities
  `:249-263`, "Booked by this season" `:264-265` — **the Permits section goes after it**); the edit form `:225-238`; the
  body-end doors `:268-275`; `AddVenueWindow` `:282`; `VenueQuestion` `:340`.
- **Its API** `app/api/admin/org/venues/route.ts`: GET `:87` (plan gate `:94`, coach refused `:104`, `readVenueUsage`
  `:106`), POST `:122` (save rule `:131`; actions `save-venue` `:140`, `update-venue` `:174`, archive / restore `:261`,
  `delete-venue` `:269`; the tenant wall `:166`); `readVenues` `:63`. Server helpers `lib/venue-library-server.ts`
  (`readVenueUsage` `:53`, `venueIsBooked` `:174`, `facilitiesBooked` `:186`, `carryWordsForward` `:207`). Words
  `lib/venue-library.ts` (`VENUE_LIBRARY_WORDS` `:115`, `planLocked` `:142` — "League Plus and Club", already right).
- **The tables:** `094_org_venues.sql` (venues `:27-34`, facilities `:66-75`, kind CHECK `diamond|field|court|rink|gym|other`);
  `319_…` (the club-venue links on `rep_team_events` / `rep_tryout_sessions`, ON DELETE SET NULL, `:47-51`, `:78-82`);
  `321_the_venue_library_is_written_by_the_server.sql:34-42` (member writes revoked; SELECT kept). Fully server-only
  precedent: `318_…sql:116-118` (RLS on, no policies, `service_role` grant). Dictionary `DATA_DICTIONARY.md:1279-1313`.
- **The clash rule** `lib/venue-clash.ts` (the hook comment `:37-38`, `ClashKind` `:52`, `ClubBooking` `:59`,
  `ClashFinding` `:97`, `findClubClashes` `:243`, the sort `:250`, `findClashPairs` `:268`, `findClubClashesFor` `:289`);
  words `lib/venue-clash-words.ts` (`NOT_CHECKED_LINE` `:24`, `ClashLine` `:90`, `clashLine` `:105`, `clashLineText`
  `:140`, `seriesSummary` `:172`, `leagueSeriesLine` `:212`, `leagueRefusalLine` `:239`, `venueSourceLine` `:277`); the
  lookup `lib/venue-clash-lookup.ts` (`MAX_CHECK_SPAN_MS` `:39`, `getClubVenueLibrary` `:61`, `readClubPool` `:238` —
  pages `:250-280`, mirrored copies skipped `:300`, tournament games `:316-331` — `checkClubClashes` `:346`, the writer
  reports `:402`, `:429`, `:478`, `:486`).
- **The one Where field** `components/venue/WhereField.tsx:50` (props `:70-106`, the `line` slot `:297`, the source line
  under Venue `:171-173`, `:251-261`); `WhereLine` `:308` (tones `warn` · `busy` · `refuse` · **`quiet`**, which exists);
  `lib/where-field.ts`. The live hook `components/venue/useClashCheck.ts:20` (`lineIsCurrent` `:54`, `readFindingsPerDate`
  `:78`, `countFindings` `:84`). **The check routes:** coach `app/api/coaches/[orgSlug]/teams/[teamId]/venue-clashes/route.ts:58`;
  house league `app/api/admin/house-league/seasons/[seasonId]/venue-check/route.ts:119`; tournament
  `app/api/admin/tournaments/[tournamentId]/club-clashes/route.ts:81`.
- **The forms that mount it:** the coach's `components/coaches/ScheduleEventForm.tsx` (hook `:520`, line `:531-542`,
  field `:998`); house league's `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx` (`LeagueWhere`
  `:170` → field `:187`; `useLeagueLine` `:233`, hook `:250`; `GameModal` `:316` → `:421`; `GenerateModal` `:493` → `:564`;
  `PracticeModal` `:636` → `:740`; check path `:954`); the tryout day `components/rep-teams/TryoutDayCard.tsx` (hook
  `:233`, line `:241-242`, field `:423`); the tournament's `…/tournaments/schedule/components/GameWindow.tsx` (field
  `:487`, line from the reply `:288-289`), `MoveSheet.tsx:100`, `Generator.tsx:1227`, `:1242`.
- **The guards:** `tests/unit/club-stage6a-guard.test.ts` (writers `WRITER_CALL` `:41`, `WRITERS` `:56-75`, `EXEMPT`
  `:78`, `NOT_YET` `:91`; forms `WEARS_THE_FIELD` `:140-146`, `WHERE_NOT_YET` `:148`, `ASKS_WHERE` `:163`; pool paging
  `:259-267`); the rule table `tests/unit/venue-clash.test.ts`.
- **The club calendar:** `app/[orgSlug]/admin/calendar/page.tsx` (`BookingWindow` mount `:255`), route
  `app/api/admin/club-calendar/route.ts`, `lib/club-calendar.ts` (`MAX_CALENDAR_DAYS` `:50`, `readClubCalendar` `:121`,
  pairs `:264-284`), words `lib/club-calendar-view.ts` (`CALENDAR_WORDS` `:125`, "Clashes with" `:136`, "Busy then" `:137`),
  `components/admin/kit/club/ClubCalendarViews.tsx` (`BookingWindow` `:223`, its `dl` `:253-262`, the pair blocks
  `:240-250` rendered `:263-264` — **the permit's one line goes here; the rows `:73-82` stay as they are**).
- **The budget line's window** `components/admin/kit/club/money/BudgetWindows.tsx` (`BudgetLineWindow` `:246`, read facts
  `:362-378`, "Allocated to teams" `:379-398` with `Allocate {money}` `:391-395`, the pencil `:352`, `AllocationRows`
  `:224`); mounted on the Budget (`app/[orgSlug]/admin/accounting/budget/page.tsx:391`) and Budget vs. Actual
  (`…/budget-vs-actual/page.tsx:420`); types `lib/club-budget-report.ts` (`PlanLineRow` `:272`, `PlanAllocationRow`
  `:259`); words `lib/club-money-words.ts` (`LINE_ALLOCATIONS_WORD` `:415`). **No "Pays for" exists anywhere yet.**
  `org_budget_lines` `DATA_DICTIONARY.md:6231-6269` (one word per fiscal year `:6239`, the closed-year lock `:6242`).
- **Budget words:** `027_budget_categories.sql` Facilities `:117-126` (Diamond Permits `:122`, Dome Time `:123`); sport
  tags `241_…:44-50`, `242_…:33-38`. **Payees:** `org_payees` (`033_…`; dictionary `:6098-6135`), `PayeeCombobox`
  `components/accounting/PayeeCombobox.tsx:53`, wrapped by `PayeeField` in `components/admin/kit/club/money/LedgerWindows.tsx:194`
  (mounted `:286`, `:507`).
- **The fiscal year:** `lib/club-fiscal-year.ts` (`fiscalYearOf(day, setting)` `:180`, `fiscalYearAt` `:204`, `lockedIn`
  `:337`); `lib/club-fiscal-year-server.ts` (`loadFiscalSetting` `:27`, `resolveFiscalYear` `:85`, `refuseIfClosed` `:129`).
- **Document upload precedent:** `app/api/admin/rep-teams/document-templates/route.ts` (types `:11-16`, 10 MB `:17`,
  checks `:67-72`, the path `${org.id}/templates/…` `:85`, upload `:87-89`, the storage path never returned `:38`, `:106`);
  the signed read `…/[templateId]/route.ts:52-53` (`createSignedUrl(path, 3600)`), remove `:121`.
- **Exports:** `lib/export/xlsx.ts` (`XlsxNote` `:28`, `XlsxMasthead` `:50`, `XlsxFooterMark` `:62`, `XlsxOptions` `:240`,
  `buildXLSXWorkbook` `:313` — masthead + 52 px logo `:362-406`, number formats `:433-435`, notes `:475-499`, the footer
  row + mark `:510-529`, the frozen pane `:553` — `downloadXLSX` `:665`; **no print setup or page footer anywhere in the
  repo**); `lib/export/brand-mark.ts:39` `loadBrandMark`; `BRANDING_TEXT` `lib/export/pdf.ts:196`; the resolver
  `fetchResolvedPdfSettings` `pdf.ts:900`. The club's Excel wiring: `ClubMoneyExport.tsx:13`, `:23`, `:27-30`;
  `lib/coach-money-exports.ts` (`downloadMoneyExport` `:1652`, settings `:1664`, branding `:1717`, `:1764`, logo `:1742`);
  call sites `…/accounting/budget-vs-actual/page.tsx:231`, `:241`, `…/accounting/page.tsx:188`, `:226`, `:235` (the Ledger
  `:575` and Allocations `:550` call `downloadXLSX` bare). **The masthead guard** `tests/unit/export-masthead-guard.test.ts`
  (`ALLOWED` `:30-39`, `NEVER` `:42-46`, scans `app/` for `masthead:` `:62-64`). The PDF gate: `scripts/pdf-documents.mjs`
  (`buildDocuments` `:101`, the `doc({ … })` helper `:167-169`, `NO_PDF_SCREENS` `:1366`); `scripts/check-pdf-documents.mjs`
  (a screen that can print with no fixture fails `:264-307`).
- **Plan features** `lib/plan-features.ts` (the `PlanFeature` union `:3-73`, `FEATURE_MIN_PLAN` `:84-123`, `PLAN_RANK`
  `:75-82`, `requiresPlanCopy` `:160` — a missing case recurses, `:187-188`).
- **The fixture** `scripts/seed-club-fixture.mjs`: usage `:71-73`, `RESET` `:103`, `--club-venues` `:247-253` →
  `addClubVenues` `:1005-1112` (the library `:1009-1022`, practices `:1066-1083`, house league's game `:1099-1104`),
  `--calendar-club` `:256-262`; venue constants `:155-163`; the payee `Town of Milton` `:596`; the current-year budget
  `:422` ("Diamond permits — city fields", inserted `:434-440` on `curYearId` `:432`); the year close `:813-819` (in the
  full build an additive step fits after `:754`; in a flag mode the earlier year is closed — money goes on `CUR` `:137`,
  never `PREV` `:138`).
- **Layout entries** `scripts/layout-screens.mjs`: `admin-org-venues` `:1391`, `-window` `:1394`, `-add` `:1396`;
  `admin-calendar` `:1398` (`-list` `:1399`, `-month` `:1401`); `admin-accounting-budget` `:1446`.
- **Help:** `lib/help-content/org.tsx` `venue-library` `:547` (subtopics `:560`, `:567`, `:580`, `:590`; FAQs `:602`,
  `:611`) and `club-calendar` `:463` (`club-calendar-t-clashes` `:494`, `faq-club-calendar-no-clash` `:536`);
  `coaches.tsx` `event-details-clash` `:2820`; `house-league.tsx` `faq-house-league-double-booked` `:187`;
  `tournaments.tsx` `faq-double-booked-field` `:1049`.
- **Migrations:** the latest is `321_…`; `supabase/migrations/MANUAL_PROD_STEPS.json` entries are
  `"<file>.sql": { "prod": "applied|pending|held|unverified", "note": "…" }`.

## Part 0 · Record the rulings where the product reads them (its own commit, first)

- **`memory/design_decisions.md`**, newest first, and its line in `memory/MEMORY.md` in the same change:
  1. **The time the club holds lives with its venues** (Asks 1, 2): the Venue library's second view, Permits; a permit is
     the club's record (it may cover several venues), filed under the fiscal year it starts in, listed on each venue's
     window; never under Accounting, which cites its cost.
  2. **"Outside the club's permit" is one quiet line under Venue** (Ask 3) on every form that asks where; said once in
     the calendar's read window, never on its rows; never amber, never a refusal; nothing where the club holds no permit.
  3. **A permit prices its fields** (Ask 21): Full · Half · a share; the prices are the permit's, never the venue's.
  4. **Every export wears the house format** (Ask 26 and the owner's 2026-10-11 instruction — memory
     `feedback_exports_house_format`): new workbooks also set print setup (landscape, fit to width) and a text page
     footer; the club's Excel reports carry the club's logo.
- **`docs/agents/design/TABLE_AND_LIST_STANDARD.md`:** only if the build changes a table rule (it shouldn't).
- **The plan** (`CLUB_PERMITS_AND_SCHEDULER_PLAN.md` §6): precondition 4's answer under Ask 1.

## What to build

### 1. The data (one migration; take the number at the moment you write it — 322 if nobody has)

The one model of the club's time (§5.1): **a block** is a weekly stretch at one place — a venue, one or several of its
facilities (or every facility), weekdays, a start and an end time, a date range. A permit is a set of blocks with its own
dates off and field prices. **11a adds the schedule as the block's second owner**; design the tables so it can, and never
build a second slot model.

- **`org_permits`**: org, name, issuer (a payee, nullable), reference, *for* (the club · rep teams · house league · one
  team — the drawing's choices), starts on, ends on, **the fiscal year it starts in** (filed by `fiscalYearOf` at save;
  Ask 2), cost (≥ 0, nullable), the budget line (nullable, SET NULL, and it must be a line in the permit's fiscal year),
  the document (path, file name, size, added at), notes, *renewed from* (nullable), created/updated by and at.
- **`org_time_blocks`**: org, **the permit** (11a adds the schedule and a one-owner CHECK in its own migration), the
  venue, weekdays (Monday first, as the club calendar counts them), start and end (wall-clock times in the club's clock,
  `lib/timezone.ts`), a date range inside the permit's (defaulting to it), order. **A block covers several facilities**
  (Ask 21: "Fields 1–6"): a child table of its facilities, or "every facility" when none is listed — choose, and say which
  in the dictionary.
- **The permit's field prices** (Ask 21): per permit and facility, a share of a full price (1 = Full, 0.5 = Half, or a
  typed share). An hour of a facility = cost ÷ Σ(held hours × share). **The dome's check:** Fields 1–4 full + 5–6 half,
  Sundays 8:00–11:00 a.m., Oct 4, 2026 – Mar 28, 2027 with Dec 27 off = 25 Sundays × 3 h × (4 + 2 × 0.5) = 375
  full-field hours; $27,000.00 ÷ 375 = **$72.00 a full field, $36.00 a half**. That case is a unit test.
- **Dates off** (`org_time_dates_off`): a permit's dates with no time held, an optional note.
- **`org_venues.bookings_email`** (Ask 7): nullable, validated; read and edited on the venue's window (the 11a send uses
  it; 10a only stores it).
- **The document store:** a new **private** bucket made by this migration (the `087_…` pattern, not the dashboard), no
  storage policies (the server reads and writes it with the service role, as `rep-team-documents` does), paths
  `${org.id}/permits/${permitId}/${uuid}-${name}`, PDF / JPEG / PNG, 10 MB; reads by a one-hour signed URL; the storage
  path is never sent to the browser.
- **RLS:** the permit tables are server-only (`318_…:116-118`'s shape: RLS on, no policies, `service_role` only), because
  a permit carries money and every read passes through a route that checks the role (precondition 4). The venue column
  follows `321_…`'s shape (members read, the server writes).
- `docs/agents/db/DATA_DICTIONARY.md` in the same change (every column; the one-model rule; that 11a adds the schedule
  owner); `npm run refresh:snapshots`; `npm run check:dictionary`; the migration recorded in `MANUAL_PROD_STEPS.json`
  (`pending`; dev only until the owner's promote), noting the bucket.

### 2. The permit's answer, beside the pair rule (specimen 3; Ask 3) — one module, one test

- **A module of its own** (next to `lib/venue-clash.ts`; rewrite the `:37-38` comment to point at it): given a proposed
  booking (venue, facility or none, start, end) and the club's permits at that venue, answer **inside**, **outside**
  (with the permit's name, the facility and what its blocks cover, for the line), or **no permit here** (the club holds
  no permit at that venue on that date — say nothing).
  - *Outside* means the club holds a permit covering that date at that venue, and no block of it (on that facility, or on
    any facility when none is set) covers the booking's whole time. A date off counts as outside; the line names it.
  - Several permits at one venue: inside any one is inside.
  - Instants against wall-clock blocks in the club's clock (`lib/timezone.ts`), daylight saving included; a tournament
    game's local date and time converted as the 6a check converts it.
- **Its unit test is a table**, case by case: inside; outside by day; outside by hour (a 5:00 p.m. start on a 5:30 block);
  partly outside (8:30–9:30 p.m. on a block to 9:00); facility not set; a date off; two permits; a venue with no permit;
  a club with no permits; a booking across a daylight-saving change; the fixture's 11U AA Wednesday.
- **The line** (`/marketing` words the draft): *"Not inside the club’s permit for Diamond 2. It covers Tue and Thu,
  5:30–9:00 p.m., until Oct 29."* — `WhereLine`'s **quiet** tone, under Venue. When an amber clash line is also showing,
  both show (the clash first, the permit's quiet line under it), never merged into one sentence; record it as a departure
  if no drawing shows both.
- **Every check carries it:** the three check routes (coach, house league, tournament) and every writer's reply that
  carries clash findings today add the permit answer as **its own field** beside the findings. A coach's reply names the
  facility, days and hours only (no cost, issuer or reference).
- **Every form that asks where shows it** (re-grep `<WhereField` first): the coach's Add / Edit Event (a weekly series
  names each date outside, as the clash marks do, with one summary line), house league's game, practice and generator
  windows, the tryout day, and the tournament's game window from its save reply (lesson 4). A guard extends
  `club-stage6a-guard.test.ts`: every form on `WEARS_THE_FIELD` renders the permit answer.
- **The club calendar:** the booking's read window says it once (after "Clashes with" / "Busy then"); the rows, the
  clash pill and the clashes-only filter never count it.

### 3. Permits in the Venue library (specimens 1, 2; Asks 1, 2, 21)

- **The page:** the toolbar gains the **Venues · Permits** switch (the olive two-way switch; the URL keeps the view);
  Permits is the table as drawn (*Permit* — issuer · reference under it — · *Where* · *Dates* · *A week* · *Used* — a
  percentage, "51 of 80 h" under it — · *Cost* · chevron), band rows *In use now* · *Starts later* · *Ended*, the
  fiscal-year pill (the year a permit starts in), **Export** above the table (Excel first, as drawn), **Add permit** the
  one lime for savers. A phone reads the list as one frame with hairlined rows (the `/design` change, P1 2026-09-29).
- **The permit's window** (the kit's form window; reads first; the head's pencil edits the whole record, autosaved —
  the cost, the budget line and the time included): eyebrow "Permit · 2026–27"; **The permit** (Issuer, Reference, For,
  Dates, Document — its name and size, opened by the signed link, replaced by a new upload); **The time** (its blocks as
  rows, the facilities with their prices, dates off, "80 h held"); **Cost** as one joined band (Cost · An hour held · On
  the budget → the line's window, the 3d door rule: the window turns into the line's and × turns it back); **Use** as one
  joined band (Held · Booked · Unused · Outside it), a row per block (held, booked, unused, who booked it), **Export the
  use** above the rows; the body ends with **Renew for next year** and **Delete this permit** (red, asks); Previous ·
  Next in the foot, as drawn. *Hand out this time in a schedule ›* is 11a's: leave it out until 11a builds it — never a
  dead door.
- **The use**, read over the one pool (`readClubPool`, paged; a permit past the 800-day check span reads in windows):
  held = the blocks' hours over their dates less dates off, per facility; booked = the club's bookings on those
  facilities inside a block, each clipped to the block; a booking with no facility set inside a block's hours counts on
  that block and says so; *Outside it* = bookings at the permit's venues during its dates outside every block. Cancelled
  never counts; a postponed league game counts at its new time.
- **Add permit** (create asks): Name, Issuer (the club's payees, `PayeeField` — the Ledger's list, so the town is one
  name in both), Reference, For, Dates, the blocks ("+ Add a block": venue, facilities, days, from, until), the field
  prices (Full · Half · a share, per facility), Dates off, Cost, Budget line (the permit's fiscal year's lines), Document;
  foot Cancel · **Add permit**. It writes once, on Add.
- **Renew for next year** (`RecordAction`): a copy a year on — the same blocks, facilities, prices and issuer, the dates
  +1 year — with no reference, document or cost, opened for editing. Whether dates off carry is not drawn: they don't (a
  holiday moves), and the copy says so; record it.
- **Delete this permit:** offered while nothing hands its time out (11a adds the schedules check); removes its document.
- **The venue's window:** a **Permits** section after "Booked by this season" (each row opens that permit, the window
  turning into the permit's, × back), and **Bookings contact** in the read facts and the edit form.
- **A closed fiscal year:** a permit is not a money entry, but its cost and budget line belong to a year — refuse a
  change to either in a closed year (`refuseIfClosed`) with the locked line the money windows use; its time stays
  editable. Record it.
- **Who:** savers write (`canSaveVenueLibrary`); readers per precondition 4; the plan gate per precondition 2 (the page's
  own gate already covers it if permits ride `hasOrgVenueLibrary`).

### 4. The budget line says what it pays for (specimen 12; Ask 8a)

- The budget line's window gains **Pays for** (the drawing's frame: each permit that names the line — name, dates,
  cost — opening the permit's window by the door rule). Allocating the cost is today's **Allocate** from the line; paying
  the town is an ordinary Ledger expense under the line's word. Nothing else in the money loop changes.

### 5. Exports in the house format (specimen 15; Ask 26; memory `feedback_exports_house_format`)

- **A permit's use** (Excel, from the permit's window): `buildXLSXWorkbook` with the masthead (the permit's name; what it
  holds; "As at {date} · {who}"; **the club's logo** top-left), the slate header row frozen under it, hours and money in
  their number formats, a bold totals row, the notes under the table (what Held, Booked, Unused and Outside it mean), the
  FieldLogicHQ row last. Its call site joins the masthead guard's `ALLOWED` list with its reason.
- **The Permits list's Export**, as drawn; if it offers a PDF, that PDF goes through `buildTablePDF` and gets a fixture
  in `scripts/pdf-documents.mjs` (or the screen goes on `NO_PDF_SCREENS` with its reason).
- **The export catalog** (`lib/export/catalog.ts:147` `EXPORT_CATALOG`; `npm run check:export-catalog`) gains the
  Permits list and a permit's use, each with its formats.
- **Print setup and a page footer** (Ask 26): `XlsxOptions` gains them — landscape, fit to one page wide, and a text page
  footer "Page n of N · Generated by FieldLogicHQ" (honouring the club's branding setting) — set on this build's new
  workbooks only. Every other report keeps its format until the owner asks. The FieldLogicHQ mark stays the last row.
- **The club's Excel reports get the club's logo:** `useClubMoneyFile` fetches the resolved settings for Excel too, so
  the masthead's logo and the branding setting reach every club money workbook (this closes the "Generated by" row on a
  club that turned branding off). A unit test holds it; the masthead guard still passes.

### 6. The test club gets permits (additive, never a reset)

- A new flag beside `--club-venues` (`--club-permits`), additive to UAT Rep Club, **asked of the owner before it runs**:
  - **Fall diamonds 2026** — Town of Milton, P-2026-1187, For the club; Lions Park Diamond 2 Tue and Thu 5:30–9:00 p.m.
    and Kinsmen Park Diamond B Tue 6:00–9:00 p.m.; eight weeks **that float with the seed day** so the 6a bookings fall
    inside them (13U AAA's and 14U AA's Tuesdays inside, 11U AA's Wednesday at Lions Park outside); $3,200.00 on the
    current year's "Diamond permits — city fields" line (`CUR`, never `PREV`). Eight weeks hold 80 hours ($40.00 an hour).
  - **Lakeshore Dome** (a venue: Fields 1–6, kind field; bookings contact `bookings@lakeshore-dome.example`) and **Winter
    dome 2026–27** — Fields 1–4 full and 5–6 half, Sundays 8:00–11:00 a.m., Oct 4, 2026 – Mar 28, 2027, Dec 27 off,
    $27,000.00 on a current-year Facilities › Dome Time line (added if the fixture has none). The dome walk in 11a starts
    from it.
  - The Lions Park venue's bookings contact (`parks.permits@milton.example`, as drawn).
- Recorded in the hub's QA sign-in card and the plan. The walks pin identities (the permit's name, the team), never a
  booked-hours figure, because the bookings float.

## Help, words, walks

- **`/docs`:** the Venue library article (`venue-library`) gains Permits (the view, adding one with its fields' prices, a
  permit's use and its export, Renew, the bookings contact); the clash subtopics on the club calendar, the coach's event
  form, house league and tournaments gain the permit's quiet line; the club budget's line window gains "Pays for". Keep
  "permit", "rental", "booking" and "contract" as search terms.
- **`/marketing`:** the tagged sentences (the quiet line and its date-off form, the Use band's four words, Renew's line,
  the Pays-for heading); and the homepage's "field bookings" line returning with permits (`BUSINESS_DECISIONS.md`
  2026-09-25 hand-off), on League Plus and the Club bands per Ask 4. Draft, tagged; don't ship placeholders.
- **Walks:** a new Owner QA ledger § (take the number **at the moment you write it**; grep the ledger before and after
  appending), as checkable walks on the hub's QA tab under the stage, one purpose each, with the sign-in card. **The
  definition of done:**
  1. **Permits:** the Venue library's switch; the table, its bands and the year pill; Export.
  2. **A permit reads first:** Fall diamonds 2026 — its time, the cost band ($40.00 an hour held), the use band and its
     block rows, the door to the budget line and back.
  3. **Add the dome** (the owner's step 1): Lakeshore Dome, six fields, four full and two half, Sundays 8:00–11:00 a.m.,
     Dec 27 off, $27,000.00 — the window reads **$72.00 a full field, $36.00 a half**; the document opens.
  4. **The venue's window:** its Permits section opens the permit and × comes back; the bookings contact saves.
  5. **The quiet line, a coach:** 13U AAA's Add Practice at Lions Park Diamond 2 on a Wednesday inside the permit's weeks
     → the line; Tuesday 6:00 p.m. → nothing; a venue with no permit → nothing; a clash and the line together.
  6. **The quiet line elsewhere:** house league's practice, the tryout day, a tournament game's save.
  7. **The club calendar:** 11U AA's Wednesday reads the line once in its window; its row is unchanged.
  8. **The budget line's Pays for** lists Fall diamonds 2026 and opens it.
  9. **The use workbook** in the house format (the club's logo, the frozen header, notes, the FieldLogicHQ row; print
     preview landscape, one page wide, the page footer) — and Budget vs. Actual's Excel now carries the club's logo.
  10. **Renew** Fall diamonds 2026 → a 2027 copy with no reference, document or cost.
  11. **Who:** a reader who can't save sees no Add permit and no pencil; a coach never reaches a permit; a League Plus
      club has permits; a Tournament plan doesn't.
  12. **A phone (390)**: the Permits list and a permit.
  13. **Dark**: every new frame.

## Gates

- `npm run verify:changed`, `npm run typecheck` (after `npx next typegen`), the targeted unit files, `check:dictionary`,
  `check:spelling`, `check:css-selectors`, `check:contrast` + `check:text-contrast`, `check:old-look`,
  `check:export-catalog`, `check:pdf` (with `--only=` the fixtures you add or touch).
- **The permit answer's table test**, **the field-prices test** (the dome's $72.00 / $36.00), **the use arithmetic
  recomputed from rows** (the `check:club-money-arithmetic` pattern: Held − Booked = Unused per block, totals = Σ rows),
  **the guard** that every Where form renders the permit answer, **the one-model guard** (no second table holds club
  time; 11a extends it), the masthead guard, and a test that a club with no permits sees no line.
- **`check:layout`, both themes,** on every touched screen (ask the owner first; `--only=` batches of about ten): the
  Venue library and its windows, the Permits view and a permit's window (new entries), Add permit, the calendar's read
  window, the budget line's window, the coach's event form; new baseline entries with reasons.
- Then `/simplify`, `/review` at the **high-risk** tier (a migration and a storage bucket, every Where form in four
  programs, a money link, a shared export builder), and a `/design` review of the built screens against the hub at 1440
  and 390.

## Hand-off

- An owner-voice summary; the walks to run; departures from the drawings; anything found and not fixed.
- The plan record (`CLUB_PERMITS_AND_SCHEDULER_PLAN.md`: a "10a BUILT" block at the top and §7), the PM brief, the parent
  plan's Stage 10 pointer, memory `project_club_stage11_scheduler`, the TODO line, and the hub's QA tab republished at
  the same address (read it fresh first; the session's first publish needs the live copy READ in full — memory
  `reference_artifact_publish_needs_full_read`; parse every script before publishing).
- **A note to 11a** in `CLUB_SCHEDULER_A_BUILD_PROMPT.md`'s preconditions, as item 2a: the permit tables' final names, the block's
  owner column and how the schedule joins it, the field-price helper, and the permit answer's module.
- **Commit only when the owner says**, from a private index with this session's files and hunks only; Part 0 is its own
  commit. Export and typecheck the staged tree before committing; after it, `git reset -q -- <paths>` on the shared
  index. Then `CLUB_SCHEDULER_A_BUILD_PROMPT.md` in a fresh session.
