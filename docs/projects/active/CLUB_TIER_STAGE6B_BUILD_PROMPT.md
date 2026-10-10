# Club Tier Stage 6b — the club calendar and the Venue library (built to hub version 64)

> Paste into a fresh session on `dev` **after 6a is committed** (`CLUB_TIER_STAGE6A_BUILD_PROMPT.md`). Written
> 2026-10-08, the day the drawings were **ratified**: all thirteen asks as recommended (owner: *"I agree with your
> recommendations for both stage 6 and 11 except that the release will wait until this is all done"*). 6b reads what
> 6a built: the one clash rule and its lookup, the rep event's club venue link, the one Where field. **Re-read 6a's
> commits and its plan record before you start**; where 6a departed from the drawings, its record says so, and 6b
> builds on what 6a built, not on this prompt's assumption of it.
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 6** (version 64).
> - Build **to the drawings, exactly**. Every NEW, RESTYLED, UNCHANGED and COPY tag note is a requirement; open each
>   one. 6b's screens: **5 · The club calendar** (`#s6-calendar`) and **6 · The Venue library** (`#s6-library`); from
>   specimen 7 (`#s6-where`), the rule that adding a venue asks the same four things everywhere.
> - **"Formatting check"** (`#s6-format`) is your checklist; **"Not drawn"** (`#s6-build`) holds 6b's row of the build
>   split, the data list and the definition of done.
> - The Decisions tab holds the rulings (Asks 6–9 are 6b's; Ask 10 hands the calendar feeds to the schedule deep dive).
>
> **Read first:** `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 6 (every blockquote, and "6a BUILT" once written),
> §5 **D3** (the club admin stays read-only on a team's schedule; amended narrowly 2026-10-08 for Stage 11's own
> bookings, which is not 6b's) and **D5** (an internal, read-only club calendar in the first release);
> `COACH_SCHEDULE_DEEP_DIVE_PLAN.md` (stage 4 owns the calendar feeds, D07). Memory `project_club_stage6_venues`,
> `project_club_tier_readiness`, `feedback_build_to_approved_mockups`, `feedback_portal_is_the_formatting_benchmark`,
> `decision_record_reads_first_edits_whole`, `decision_edit_autosaves_create_asks`, `decision_autosave_word_is_transient`,
> `decision_one_toolbar_rare_tools_behind_tools`, `decision_export_is_one_button`, `decision_waiting_count_is_amber_pill`,
> `decision_close_x_is_plain_glyph`, `decision_drawer_layers_form_vs_menu`, `feedback_qa_walkthroughs_as_checkable_artifacts`,
> `reference_artifact_publish_needs_full_read`, `reference_hub_script_parse_trap`, `reference_backticks_in_shell_strings`.

## ⚠ The lessons this stage already paid for

- **The calendar is built on the admin's team schedule, not beside it.** The admin's read-only team schedule already
  files every day in the platform's zone and has List · Week · Month; the coach schedule's toolbar is the benchmark
  for the page's chrome. Reuse their parts; a second week grid is drift.
- **There is no per-club time zone.** Every organization runs on one platform constant (Eastern). The page says so
  once ("Times in Eastern time."); a per-club zone is a platform item (S6-13), not this build.
- **Deleting a library venue today strips it from every house-league game and practice on it** (S6-08), and a failed
  load reads as an empty library (S6-09). Both are this build's to end.
- **A read gate is not a write gate.** The database lets any member of a club write a venue directly (S6-10); the
  page's server route is the only wall. 6b closes it with a migration.
- **The Venue library shares its stylesheet with the tournament's Venues & Facilities screen.** Retire only the
  library's half of the old look; the tournament's half stays until Tournament Stage 5.

## Preconditions (check before code)

1. **Git:** on `dev`; `git log` / `git status` fresh; 6a committed. Other sessions' hunks in shared files are theirs.
2. **The UX summary for the owner comes first**, short: the club admin (Calendar under Overview; the whole club's week,
   clashes marked; the Venue library as a table that says who books each venue, a venue that reads first, Archive
   instead of a Delete that loses bookings), the league admin (the library saves for them now), a treasurer,
   registrar or staff member (reads the library, no Add, no pencil; sees the calendar only for programs they can
   open), a head coach (**nothing changes**, except that a club venue they book shows its new name after a rename).
3. **One browser tester at a time;** ask before captures, probes, `check:layout`, `auth-setup` and a dev-server restart.
   Never reset the test club; 6a's venue flag is the fixture.

## The code, read 2026-10-08 (re-grep before you trust a line number; 6a will have moved some)

- **The Venue library page** `app/[orgSlug]/admin/org/venues/page.tsx`: plan gate `:359` / `:403`, `AdminPageHeader`
  `:416`, its `legacy` header `:425-438`. **Its route** `app/api/admin/org/venues/route.ts`: GET `:45` (plan gate
  only); POST `:86` (plan gate `:93`, the `create_tournaments` check `:96` = D02) with the actions save-venue `:104`
  (`is_active: true` `:111`), update-venue `:118`, **delete-venue `:134` (a hard delete; facilities go by cascade
  `:139-140`)**, add / update / delete-facility `:146` / `:165` / `:183`. `is_active` is read only by the unused
  `lib/db.ts:1022` `getOrgVenues`; the route maps it (`:23`) and never filters.
- **What a delete strips today (S6-08):** league games' and practices' venue link is ON DELETE SET NULL (mig 229
  `:20-26`); a tournament copy's `source_org_venue_id` likewise (mig 095 `:23`); 6a's rep event links follow whatever 6a
  chose. Archive ends all of it.
- **RLS (S6-10):** `supabase/migrations/094_org_venues.sql:42-59` (venues) and `:83-99` (facilities) let any
  `is_org_member` insert, update and delete; mig 311 (`:57`, `:77`) only revokes anon. The new migration: members read,
  writes only through the server (service role), with the dictionary and both snapshots.
- **The doors:** the rail entry `lib/admin-kit-nav.ts:234` (via `components/admin/kit/useAdminKitNav.ts:56`); the
  Organization page's tile `app/[orgSlug]/admin/org/page.tsx:40-45` (no plan or role gate: S6-11);
  `hasOrgVenueLibrary` `lib/plan-features.ts:150`; house league's "Set up your … once" link (its schedule page
  `:251-253`).
- **The rail and the phone:** Overview is hard-coded in `components/admin/kit/AdminKitRail.tsx:141` (Calendar goes
  directly under it); the phone bar's Overview tab `AdminKitBottomNav.tsx:128`, its More sheet `:203-285` (Calendar is
  its first row).
- **What the calendar reuses:** the admin's read-only team schedule
  `app/[orgSlug]/admin/rep-teams/teams/[teamId]/schedule/page.tsx` (`CoachListToolbar` with an inline view group
  `:180-191`); the coach schedule's toolbar `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx:891-900`
  (`components/coaches/kit/CoachListToolbar.tsx:40`; its phone glyph menu `:750-760`, `CoachToolbarMenu.tsx`); the
  exports `lib/export/schedule-calendar.ts` (`coachScheduleCalendarEntries` `:58`, `houseLeagueCalendarEntries` `:100`)
  and `lib/export/ics.ts` (`composeICSFromInstants` `:73`).
- **The three clocks (Ask 8):** `lib/coach-schedule-view.ts` `monthKey` `:44`, `weekKey` `:49` (device clock; `dayStr`
  `:61` is already the platform zone); house league's admin schedule `weekKey` `:127` (used `:892`, `:906`); the
  public league schedule `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx:28` (used `:81`; a server page, so UTC).
  `lib/timezone.ts` `orgDayKey` `:200`, `formatInOrgZone` `:183`.
- **The old look:** `scripts/.admin-old-look-baseline.json:57-62` (org/venues: one `useAdminKit`, one `legacy`, 34
  kit-scoped CSS lines); `scripts/check-admin-old-look.mjs`. **Layout:** `scripts/layout-screens.mjs` `admin-org-venues`
  `:1406`; add the calendar (desk and phone).

## Part 0 · Record the rulings where the product reads them (its own commit, first)

- **`memory/design_decisions.md`** (+ its `memory/MEMORY.md` line, same change):
  1. **The club calendar** (Asks 6, 7): "Calendar" under Overview with the calendar-with-clock glyph (House league
     wears the plain calendar); the coach schedule's toolbar (List · Week · Month in the portal's order, opening on
     Week; quiet Venue / Program / Team pills; Export pinned right; the week's arrows on their own row; no Today, no
     Search); one clock, said once; the week's clash count as the amber pill doubling as "Clashes only"; a booking's
     edge is its team's colour, house league and tournaments say their program in words; a booking opens a read window
     with both sides of a clash.
  2. **A count that is a status, not work waiting, may wear the amber pill** (the format check's "not written yet (a)",
     ruled with Ask 7).
  3. **What colours a booking on a club-wide page: the team** (the kind in words), where the portal's one-team schedule
     colours by kind ("not written yet (c)", ruled with Ask 7).
  4. **Archive when anything books a record; Delete only when nothing does** (Ask 9), red only for the destructive one.

## What to build

### 1. The club calendar (specimen 5; Asks 6, 7)

- **The door:** "Calendar" in the admin rail directly under Overview, the calendar-with-clock glyph; the first row of
  the phone's More sheet. Shown to whoever can read at least one program's schedule (owner, admin, the league roles
  for their program); each person sees only the programs they can open.
- **The page** (the 1200px width): title "Calendar", no subtitle; the coach schedule's toolbar exactly as drawn; the
  date row with the week arrows, "Times in Eastern time." and the amber clash count (a click = Clashes only, a second
  click shows everything).
- **What it shows:** every club team's events (games and practices, from the coaches' schedules, read-only), house
  league's games and practices, and the club's tournaments (a tournament day is ONE booking with its game count; a
  club team's own games in that tournament sit inside it, never twice, S6-06). Each booking: its time, who, what, and
  venue · facility (by the sport's word). A team's own place or typed words show as they are, never compared.
- **Clashes:** 6a's rule, run over the window: a clashing booking carries the amber mark; a "busy then" booking is drawn
  dashed. No notification (Ask 6).
- **Views:** Week (each day's bookings), List (a table, one row per booking, days as band rows, "Clashes with …" in
  words under the place, the name the link, one chevron), Month (a count per day and an amber mark where a day has a
  clash; a day opens its List). On a phone: the coach schedule's phone (the View drawer in the title row; Week stacks
  its days and folds a run of empty ones into one line; 44px rows; Export as a quiet row under the list).
- **The read window** (a 640px form window, read-only, no pencil, D3): When, Where (venue · facility, the address under
  it), Team (with its head coach), then "Clashes with" as one white block with an amber edge (the other booking, its
  facility and its head coach, or its season, or its tournament); the foot's door in olive text: "Open {team}'s
  schedule" (the admin's read-only team schedule), or "Open in the Coaches Portal" for someone who coaches that team;
  a house-league booking opens its season's schedule, a tournament booking the tournament; Done.
- **Filters:** quiet pills that tint and name their choice only when they narrow (Venue lists the club's venues and
  "Places the club doesn't own"; Program; Team), each choice's count at its row's end; not remembered between visits.
- **Export:** one button (Excel first, then CSV, then Calendar .ics), one line on top saying what the file holds (the
  range and the filters), no sentence under a format. It writes what the page shows. A PDF week and a subscribable
  link are not in the first cut (Ask 10 hands the feeds to the schedule deep dive's stage 4).

### 2. The clock fix (Ask 8)

- The three groupings that still use a device's or the server's clock file by the platform zone instead: the coach
  schedule's week and month keys, the house-league admin schedule's weeks, and the public league schedule's weeks
  (which use the server's UTC clock, S6-12: a Sunday game after 8 p.m. files into next week). The admin's team schedule
  is already right. A unit test each, with a Sunday 9:30 p.m. game.

### 3. The Venue library (specimen 6; Ask 9)

- **Who saves:** the owner, an admin, a league admin, and anyone granted the tournament permission; everyone else who
  can open Organization reads it (no Add venue, no pencil). A refused save says why in the window, never silently.
- **The page** (1200px): title "Venue library" (eyebrow Organization), Add venue (the one lime; it asks); the lede in
  the toolbar ("The club's venues and their facilities. Teams, house league and tournaments book them from here, and
  a clash between any two is flagged." — /marketing words it); a table: Venue (name the link, address under it) ·
  Facilities (by name, in the club's order) · Booked by this season (by program, in words) · one chevron; a quiet
  "N archived venues" line that opens them. A failed load: "We couldn't load the Venue library." with Try again.
- **A venue's window** (640px; a record that reads first and edits whole): Address (with Open in Maps), Notes,
  Facilities (each with its kind and its upcoming bookings), Booked by this season (teams by name, the house-league
  season with its game count, the tournament with its game count). The pencil turns it into its form (Name, Address,
  Notes, each facility's name and kind, "＋ Add a facility"), saving as you go with the floating pill; ✓ turns it back.
  A facility with bookings can be renamed, never removed; one nothing books gets its ✕ back. **A rename reaches the
  upcoming team and house-league bookings that link it, and families' calendars at their next refresh; past bookings
  keep the name they were played under; it sends no notice.** A tournament keeps its own copy, as built.
- **Archive or Delete:** a venue anything books (past bookings included) offers Archive (the kit's question: it names
  who books it, says it leaves every picker and every booking keeps it, and that it can come back); a venue nothing
  books offers Delete (red, asks first). Archived uses the venue table's existing "active" column; archived venues
  leave every picker (6a's field included) and keep every booking; a facility's equivalent if the facility table
  needs one (decide from the data; record it).
- **The doors:** the rail's Organization › Venue library (unchanged, plan-gated); house league's "Set up your diamonds
  once" (unchanged words, now true for the league admin); the Organization page's tile renamed "Venue library" and
  gated with the plan (S6-11); tournaments' Import from Library unchanged (its link kept by 6a).
- **Adding a venue** asks Name (required), Address, its facilities, Note — the same four things specimen 7 rules for
  every place a venue or place is added.
- **The server:** the save rule above on every write route; a migration so members READ the two library tables and only
  the server writes them (S6-10), with the dictionary, both snapshots and the production order recorded.
- **Its old look retires:** the page's legacy header and its kit-scoped style layer (the library's half of the shared
  stylesheet); `npm run check:old-look:report` before, lock your own drop with `--init` in the same change (hand-drop a
  peer's uncommitted entries).

## Help, words, walks

- **`/docs`:** the club calendar (new), the Venue library (who saves, Archive, renaming a facility, what "Booked by"
  means), the clock (Eastern, said once). Retire any article line that says a deleted venue disappears from bookings.
- **`/marketing`:** the tagged sentences (the library's lede, the Archive and Delete questions, the read window's
  door words, the Export line). Draft them, tagged.
- **Walks:** a new Owner QA ledger § (take the number when you write it; grep before and after), checkable on the hub's
  QA tab, one purpose each, pinned to identities, with the sign-in card. **The definition of done:**
  1. The club admin opens Calendar: the seeded week, the Tuesday clash marked on both bookings, the count, Clashes only.
  2. A booking's read window: both sides, each head coach, the door to the team's schedule.
  3. List filtered to one venue; Month with its day marks; Export (Excel) holding what the page shows.
  4. On a phone (390): the View drawer, the stacked week, a booking's window.
  5. A league admin saves a venue (refused before 6b); a treasurer reads with no Add or pencil.
  6. Rename a facility (writes): an upcoming team booking and a house-league game read the new name; a past one keeps
     the old.
  7. Archive a booked venue: it leaves the coach's picker and house league's; its bookings keep it; bring it back.
  8. Delete an unbooked venue; the Organization tile is gone on a tournament-only plan.
  9. The clock fix: a Sunday 9:30 p.m. game files into its own week on the public league schedule and the coach's.

## Gates

- `npm run verify:changed`, `npm run typecheck`, the targeted unit files, `check:dictionary`, `check:spelling`,
  `check:css-selectors`, `check:contrast` + `check:text-contrast`, `check:old-look` (lowered), `check:export-catalog`
  (the calendar's Export joins the catalog).
- A **screens guard** (3c's pattern): Calendar's rail row and its gate; the toolbar's order; no write control on the
  calendar or its read window; the library's save rule on every write route; Archive in place of Delete when booked; the
  Organization tile gated; the RLS policy text; the three clocks.
- **`check:layout`, both themes,** on the calendar (desk 1440 and phone 390) and the library (ask first; baseline new
  entries).
- Then `/simplify`, `/review` at the **high-risk** tier (an RLS migration, a rename that reaches bookings), and a
  `/design` review against the hub at 1440 and 390.

## Hand-off

- An owner-voice summary; the walks; departures; anything found and not fixed.
- The plan record (§6 Stage 6, "6b BUILT"; Stage 6 complete when both walks pass), the PM brief, memory, the TODO line,
  and the hub's QA tab republished (read it fresh; the first publish of a session needs the live copy READ in full;
  parse every script).
- **Next for the programme:** the joint **Stage 10 + 11** mockup session (permits and the club scheduler, ruled
  2026-10-08 to be drawn together; the release waits for both).
- **Commit only when the owner says**, from a private index with this session's files and hunks only; Part 0 is its own
  commit.
