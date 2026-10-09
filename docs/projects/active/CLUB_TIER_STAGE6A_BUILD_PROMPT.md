# Club Tier Stage 6a — the one venue book, the one clash check, and one way to say where (built to hub version 64)

> Paste into a fresh session on `dev`. Written 2026-10-08, the day the drawings were **ratified**: all thirteen asks as
> recommended (owner: *"I agree with your recommendations for both stage 6 and 11 except that the release will wait
> until this is all done"*; the exception is Stage 11's, not this stage's). **Stage 6 builds in two sessions** (Ask 11):
> **this one, 6a** (the venue book, the clash check, the one Where field), then **6b** from
> `CLUB_TIER_STAGE6B_BUILD_PROMPT.md` (the club calendar, the Venue library, the clock fix), which starts only after 6a
> is committed. 6a goes first because the tournament redesign's Stages 3 and 5 draw against what it builds.
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 6** (version 64).
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every NEW, RESTYLED, UNCHANGED and
>   COPY tag note is a requirement; open each one. 6a's screens: **Where the venues stand** (`#s6-status`, the
>   verification), **1 · A head coach** (`#s6-coach`), **2 · What counts as a clash** (`#s6-rules`), **3 · The
>   house-league scheduler** (`#s6-league`), **4 · The tournament director** (`#s6-tourn`, specimens only), **7 ·
>   Where, on every form** (`#s6-where`). Specimens 5 (the calendar) and 6 (the Venue library) are 6b's.
> - **"Formatting check"** (`#s6-format`) is your checklist, every row. **"Not drawn"** (`#s6-build`) is the build's
>   list (the 6a row of its build-split table, "Every writer runs the check", the data list, the definition of done);
>   this prompt expands it with file anchors.
> - The Decisions tab holds the rulings with their reasons (Stage 6 Asks 1–13, and the wording ruling). Where you must
>   depart, say so at build time and record why; never silently.
>
> **Read first:** `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 **Stage 6** (the DRAWN / Wording RULED / Ask 13 ADDED /
> RATIFIED blockquotes, the "Every writer" and "Build note" bullets) and §5 **D3**; `COACH_ARRIVAL_AND_PLACES_PLAN.md`
> §5 (its "No org-level venue library" line is now reversed for club teams); `GAME_LOCATION_SOURCE_OF_TRUTH_PLAN.md`
> (house league's field model and the two conflict engines it made agree; its Phase 4 note on the gap this stage
> closes); `TOURNAMENT_ADMIN_REDESIGN_PLAN.md` §1 "Club Tier owns" and §7 A5. Memory `project_club_stage6_venues`,
> `project_club_tier_readiness`, `project_coach_arrival_and_places`, `feedback_sport_neutral_no_debt` (the wording
> ruling), `feedback_build_to_approved_mockups`, `feedback_portal_is_the_formatting_benchmark`,
> `decision_edit_autosaves_create_asks`, `decision_drawer_layers_form_vs_menu`, `feedback_shared_component_over_shared_class`,
> `feedback_qa_walkthroughs_as_checkable_artifacts`, `reference_artifact_publish_needs_full_read`,
> `reference_hub_script_parse_trap`, `reference_backticks_in_shell_strings`. The in-repo `memory/design_decisions.md`
> entries from 2026-09-21 on.

## ⚠ The lessons this stage already paid for

- **Plans in this repo undercount; the code is the list.** The prompt that drew this stage counted three program pairs
  and missed the release target's real clash, two of a club's own teams on one diamond (S6-01). It named one place the
  coach's form asks "where"; there are four, in three shapes (Ask 13). Before wiring a writer, grep for every writer of
  the table again: another session may have added one since 2026-10-08.
- **A ruling that changes a fact re-reads every reason that cited it.** Ask 1 reverses Arrival & Places §5 for club
  teams only. A team outside a club, and every place a club doesn't own, must behave exactly as built; the build proves
  it with a test, not a sentence.
- **The two clocks.** Tournament games store a local date and time as strings; league and rep events store instants.
  The cross-program check compares instants, and converts a tournament game with the conversion the live-score code
  already uses. Never compare a string to an instant.
- **Never write the surface word in.** The owner's wording ruling (2026-10-08): a softball screen says Diamond, a
  basketball one Court, read from the team's, league season's or tournament's sport (`fieldNounFor` /
  `surfaceLabel`, `lib/sports.ts`). The club's Venue library has no sport and says Facilities.
- **The test club has no venues, no places and no event on a venue.** Seed them additively (Part 5), never by a reset:
  a reset ends every session's club sign-ins.
- **Stage 3d may be building beside you** (the club's Payees and allocation windows). It shares no 6a screen, but it
  shares the hub, the plan, the TODO, the ledger, the dev server and the test club.

## Preconditions (check before code)

1. **Git:** you are on `dev`; `git log` and `git status` read fresh. Other sessions' uncommitted hunks in shared files
   (TODO, the plan, the brief, the ledger, the hub, the Facts doc) are theirs: build shared files as HEAD plus your own
   hunks.
2. **The UX summary for the owner comes first** (AGENCY_RULES), short and in product-owner words:
   - **a head coach in a club:** the club's venues at the top of the picker they already use, a Diamond list beside
     Venue, one amber line before Save when a diamond is taken, the dates that clash marked in a series;
   - **a coach outside a club:** nothing new, except the field's label (Venue) and its facility box beside it;
   - **the house-league scheduler:** the same amber line when another program holds the diamond; house league's own
     refusal of a second league game said under the field before Create, not in a pop-up after it;
   - **a tournament director:** nothing on screen yet (Tournament Stage 3 places the line), but every tournament
     writer now reports clashes with the club's other programs;
   - any departure from the drawings.
3. **The production counts** (`.probe/s6-counts.mjs`, read-only) are still owed: the drawing session's guard refused
   production reads. Ask the owner for a go before running it against production, and record the numbers in the plan.
4. **One browser tester at a time.** Ask the owner before any capture, probe, `check:layout` sweep or `auth-setup`, and
   whether the 3d session is measuring. Ask before a dev-server restart (new files and shared modules change here, so
   one is owed before the walks).
5. **One question the drawings left open — put it to the owner before Part 4.** A tryout day is not a schedule event:
   it saves to the tryout sessions, not to `rep_team_events`. Ask 13 gives it the same Where field, but on its own that
   only changes the form. **Recommended:** tryout sessions get the same two club-venue links and join the clash lookup
   (a tryout on Lions Park Diamond 2 at 6:00 p.m. takes the diamond as surely as a practice), and the two tryout-session
   writers run the check. The alternative: the field only, and tryouts stay out of the check (say so in the line:
   "isn't checked for clashes"). Record the answer in the plan.

## The code, read 2026-10-08 (re-grep before you trust a line number)

Coach routes sit under `app/api/coaches/[orgSlug]/teams/[teamId]/`; house league's under
`app/api/admin/house-league/seasons/[seasonId]/`.
- **Rep event writers:** create one `events/route.ts:136` (POST; `resolvePlaceId` `:170`, `createRepTeamEvent` `:281`);
  the weekly series in the same POST (`:188`; dates `lib/coach-recurrence.ts:52` / `:96`; `lib/db.ts:6133`
  `createRepTeamEvents`); edit / move / un-cancel `events/[eventId]/route.ts:52` (PATCH; `lib/db.ts:6168`
  `updateRepTeamEvent`); **series edit** `events/[eventId]/route.ts:109-117` → `lib/db.ts:6324`
  `updateRepTeamEventSeries` (its fields `:6328-6342` carry no place link; the per-row write `:6377` writes words only:
  **S6-05 confirmed**); import `events/import/route.ts:64` (update `:168`, create `:172`, `matchPlace` `:181`); the
  place's "Also update the upcoming events" `places/[placeId]/route.ts:38` → `lib/db.ts:9502`
  `updateUpcomingEventsForPlace` (words only, by place); the mirror `lib/rep-tournament-game-mirror.ts:146`
  (insert `:213`, update `:241`, cancel `:244`, delete `:260`; called from the coach events GET `events/route.ts:81` and
  the admin team-schedule GET). Other writers to classify in the guard (no club venue can reach them; list them as
  exempt with the reason): `lib/coach-upgrade-migration.ts:211` (a Basic team's typed events), the demo date shift
  `lib/demo-coach-reconcile-core.ts:430`, the practice-plan-only writes, the ownership-transfer RPC (mig 067), the seeds.
  Place columns: `place_id` (mig 307), `field_number` (mig 160), `location_address` (mig 161); dictionary
  `docs/agents/db/DATA_DICTIONARY.md` `rep_team_events` from `:2311`.
- **House league writers:** game add `schedule/route.ts:74` (selection `:124`, check `:134`); game edit
  `schedule/[gameId]/route.ts:28` (check `:118`); practice add, single and series, `practices/route.ts:79` (series
  `:129`, check `:154`); practices are cancel-only after (`practices/[practiceId]/route.ts:9`); the generator
  `schedule/generate/route.ts:63` (check `:138`). The engines: `lib/league-schedule-conflict.ts`
  (`findLeagueBookingConflicts` `:161`, `scanLeagueBookingConflicts` `:185`, `isBlockingConflict` `:129`) and
  `lib/league-venue.ts` (`resolveLeagueVenueSelection` `:51`, `checkLeagueBookings` `:181`). The page
  `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx`: `FieldPicker` `:186-283` (used at `:377`,
  `:508`, `:674`; its "Set up your … once" link `:251-253`), `GenerateModal` `:439-580`.
- **Tournament writers:** `app/api/admin/games/route.ts` — POST `:306` (bulk-save `:335`, create `:422`), PATCH `:771`
  (bulk-reschedule `:795`, its RPC `:876` = `bulk_reschedule_games`, mig 178; update `:993`); **it never imports the
  conflict module: there is no server-side check today.** The browser check `lib/schedule-conflict.ts`
  (`checkVenueConflict` `:212`). Timeline drag: schedule `page.tsx:829` `handleMoveGame` → `:734` `handleSaveGame` →
  PATCH update. The generator's commit `Generator.tsx:951` (bulk-save `:966`, `:1061`); playoffs `PlayoffWizard.tsx:1242`
  (bulk-save); lanes resolved `api/admin/schedule-facility-lanes` (`route.ts:159`); locations resolved
  `api/admin/schedule-locations` (`:129`); import `api/admin/tournaments/[tournamentId]/schedule/import/commit/route.ts:113`.
  `TournamentFieldPicker.tsx` (used at schedule `page.tsx:2343`) stays as it is in 6a.
- **The tournament's library link (S6-04), worse than the drawing said:** `api/admin/venues/route.ts` import-from-org
  `:537` stamps `source_org_venue_id` (`:563`); import-from-past `:593` writes no stamp; **the clone
  (`lib/db.ts:228` `cloneTournament`, diamonds `:342-363`) copies a venue's name, address and notes, drops the stamp
  AND copies no facilities at all**; `populateTournamentFrom` (`lib/db.ts:617`) copies facilities but drops the stamp.
  6a keeps the stamp on all three; whether the clone should also copy facilities is a defect for Tournament Stage 5
  (record it there; fix it here only if it is the same line you are touching).
- **The shared surface answer:** `lib/venue-identity.ts` (`resolveVenuePlacement` `:145`, `placementsShareSurface`
  `:204`, `sourcesShareSurface` `:226`, `venueGroupKey` `:242`, `facilityGroupKey` `:250`).
- **The clock:** `lib/timezone.ts` (`ORG_TIME_ZONE` `:23`, `wallClockStringToUtc` `:165`, `orgDayKey` `:200`).
- **The coach's form:** `components/coaches/ScheduleEventForm.tsx` (Location `:889`, the picker `:892-896`, More `:953`,
  "Field / Diamond #" `:961-965`, the usual-diamond hint `:982`, the old Address `:988-994`); `PlaceCombobox.tsx` ("Your
  places" `:163`, rows `:164-182`, add `:186`, manage `:198`); `PlaceSheet.tsx` (its "update upcoming" checkbox
  `:108`); `lib/coach-places.ts` (`matchPlace` `:24`, `applyPlaceToEvent` `:35`); `lib/rep-event-places.ts:12`. The
  tryout day: `components/rep-teams/TryoutDayCard.tsx:394-402`, saved by `tryout-sessions/route.ts:58` and
  `tryout-sessions/[sessionId]/route.ts:39`. The sport's word: `lib/sports.ts` `fieldNounFor` `:353`, `surfaceLabel`
  `:375`.
- **The library, read by 6a:** `app/api/admin/org/venues/route.ts` GET `:45` (plan gate only; a coach in a club needs a
  read of its own: add a coach-side read of the club's active venues and facilities, plan- and membership-checked).
  `hasOrgVenueLibrary` `lib/plan-features.ts:150`.
- **Guards to copy:** `tests/unit/dues-definition-guard.test.ts:180-208` (a sanctioned-writers list) and
  `tests/unit/club-money-one-definition-guard.test.ts` (the "not yet" list that only shrinks).
- **The fixture:** `scripts/seed-club-fixture.mjs` (`--reset` `:96`, `--calendar-club` `:226`) seeds no events, league
  games or venues today; an additive step fits after its house-league block (`:704-721`) and before the year close
  (`:780`), which must run last. `.probe/s6-counts.mjs` is the read-only count.
- **Layout:** `scripts/layout-screens.mjs` has `coach-schedule*` (`:693-719`) and `admin-hl-schedule` (`:1496`) but no
  coach event-form entry: add one (desk and phone).

## Part 0 · Record the rulings where the product reads them (its own commit, first)

- **`memory/design_decisions.md`**, newest first, and its line in `memory/MEMORY.md` in the same change:
  1. **One way to say where, on every form** (Ask 13): Venue (a search box: the program's venues, a coach's own places,
     typed words that say they aren't checked), then the facility under the sport's word ("Not set" first; a short
     typed box for a typed venue). The address belongs to the venue, never typed on an event. Adding a venue asks
     Name · Address · its facilities · Note everywhere. Only what the Venue list offers differs by program. "Location"
     is retired as a label (one spelling: Venue).
  2. **A clash warns in one amber line under the place, before Save; never a panel, never blocking** (Asks 4, 5).
     A refusal (house league's own rule) uses the same shape in red, under the field, before Create.
  3. **The club's venues sit above a coach's own places, as their own group** (Ask 1); a coach reads the library and
     never edits it.
- **`docs/agents/design/TABLE_AND_LIST_STANDARD.md`:** only if the build changes a table rule (it shouldn't).
- **The tournament redesign** (`TOURNAMENT_ADMIN_REDESIGN_PLAN.md`): one line under §1 "Club Tier owns" that Stage 6 was
  ratified and 6a is building, so Stages 3 and 5 can draw against hub v64's specimens 4 and 7 now and wire to 6a's
  check and field when it lands.

## What to build

### 1. The data (one migration, its dictionary lines, both snapshots)

- **A rep event can point at a club venue and facility**: two nullable links on `rep_team_events` (the club venue and
  the facility), the same two a league game holds. **The link lives on the EVENT, not on `rep_team_places`** (the
  build note in the plan: a place can't carry the diamond, which changes game by game, and the check needs both).
  Decide the delete behaviour against 6b's Archive (Delete is only offered when nothing books a venue): match the
  league tables' existing behaviour and say which in the dictionary.
- **The lookup's index:** rep events by club and start time (the cross-program query reads a club's bookings in a
  time window).
- **The tournament copy's link:** the missing index on `venue_facilities.source_org_facility_id`.
- **The 90-minute default** becomes ONE constant (it is copied four times today: find each, route them through it).
- Take the migration number **at the moment you write it** (`ls supabase/migrations | tail`: another session may take
  the next one the same day); `docs/agents/db/DATA_DICTIONARY.md` in the same change; `npm run refresh:snapshots`;
  `npm run check:dictionary`; the production order recorded in `supabase/migrations/MANUAL_PROD_STEPS.json` (dev only
  until the owner's promote).

### 2. The one rule (specimen 2; Ask 3) — one module, one test

- **Where:** beside the existing "same surface?" answer (`lib/venue-identity.ts`), a module that takes a proposed
  booking and the club's other bookings in its window and returns **findings**, each with a **kind** (`booked_by`,
  `busy_then`) and what the line may say (the other booking's team or program, its kind, its time, its facility).
  The kind is the permit hook: Stage 10 adds `outside_permit` without changing a caller.
- **The rule, exactly as the hub's table** (`#s6-rules`): same venue + same facility + overlap = "booked by"; same
  venue with the facility unset on one side = "busy then"; a place the club doesn't own never compares; cancelled
  never; a postponed league game not at its old time; a rep event with no end = the one 90-minute constant; a
  tournament game its own length chain (game → division → tournament → 90); a team's mirrored copy of its own
  tournament game never against that game (S6-06); a team against itself no line; an outside tournament (dates only)
  never; overlap means one starts before the other ends (a 6:00 end and a 6:00 start do not clash).
- **One clock:** instants; a tournament game's local date and time converted in the platform zone (`lib/timezone.ts`,
  the live-score conversion), daylight saving included.
- **Its unit test is the hub's table**, case by case, plus the clock cases (a game across a daylight-saving change, a
  Sunday 9:30 p.m. game).
- **The cross-program lookup** reads, for one club and one window: league games and practices (on library venues),
  tournament games on venues that carry their library link (S6-04), and rep events with a club venue link. It is one
  read the writers and the form's live check share.

### 3. Every writer runs the check (on the server), each with a test

The hub's "Every writer" list (`#s6-build`) and the plan's verified list are the floor; grep again before you start.
- **Rep teams** (all warn, none block; the response carries the findings): add one event; add a weekly series (every
  date checked; the response marks each clashing date); edit, move or un-cancel one event; **edit a series** (this and
  future, all), **and fix S6-05 in the same change** (it rewrites the place words on every date but never the place
  link; with club venues it must carry the venue links too); the schedule file import (a warning per row); the place's
  "Also update the upcoming events at this place" (a summary of what landed on a club booking). **The tournament mirror
  is skipped, with a test** that it never compares a team's copy with its game.
- **House league:** add and edit a game; add a practice (single and series); the season generator (its existing
  after-save summary counts cross-program clashes too). **Each keeps its own refusal against league bookings, unchanged
  in what it refuses**, and adds the cross-program warning.
- **Tournaments:** add and edit a game; drag on the timeline; the pool-play generator's commit; playoffs; the rain-delay
  shift (a database function: run the check after it, on what it moved); field lanes resolved to real venues; the
  schedule import. Each **returns** the cross-program findings. **None changes the tournament's own rule** (S6-03 is
  Tournament Stage 3's). The tournament screens do not show the line yet: Tournament Stage 3 places it.
- **A guard test** fails when a route writes an event's time or place without calling the check (the pattern of the
  one-definition guard: a list of the writers, every one asserted, and a "not yet" list that only shrinks).

### 4. One way to say where (specimen 7, Ask 13; specimen 1, Asks 1, 2, 5)

- **One shared field** (memory `feedback_shared_component_over_shared_class`): Venue, then the facility under the
  sport's word, on one row in a 640px window (1.5fr / 1fr, as drawn), stacked on a phone. It takes what its program's
  Venue list offers and a sport; it reports a venue (club venue, team place, or typed words), a facility (picked, or
  typed for a typed venue), and nothing about the address (the venue's own address shows as one quiet line under
  Venue: "The club's venue · 41 Lions Park Dr", "Your own place · 120 Westfield Rd", "Typed · not checked for
  clashes").
- **The Venue list:** a search box (type to find, name or address), grouped: the program's venues first (Club venues;
  for house league, the club's venues), then a coach's own places (Your places), then the typed row; the foot rows as
  each program has them today ("＋ Add "…" as a place" and "Manage places…" for a coach; the generator and house
  league's windows keep "Set up your diamonds once" where the club has no venue). Rows as the built picker draws them:
  a name, a quiet second line, a count at the end, no icon. A coach's same-named place says "Your own place · not
  checked for clashes"; nothing is merged.
- **The facility dropdown:** "Not set" first, then the picked venue's facilities in the club's order; it opens on the
  facility this team used last time at this venue (the place book's "usual diamond", learned). A typed or own place:
  a short typed box with the same label.
- **The clash line:** amber words under the place row, as soon as date, times, venue and facility are set; re-checked
  on any change (debounced, one small read through the shared lookup); gone when nothing clashes; the softer "busy
  then" words when the facility isn't set; the quiet "Not one of the club's venues, so it isn't checked for clashes."
  in a club with a library, on a place the club doesn't own; another program named by what it is ("a 2026 Fall House
  League game"). A coach sees another team's name, the kind of event and its time, **nothing else** (Ask 5). Save
  checks again on the server and returns the same line.
- **Where it goes in 6a:**
  - **The coach's Add and Edit Event** (`components/coaches/ScheduleEventForm.tsx`): the field replaces Location and
    the "Field / Diamond #" box under More (More keeps links and notes; the old Address box stays only on an older
    event that already holds one). The series list marks each clashing date ("Diamond 2 · 14U AA practice, 5:30–7:30
    p.m.") with one summary line under it, as drawn. A team outside a club gets the same field with only "Your places"
    and the typed row.
  - **House league's windows** (the schedule page's game window, practice window single and series, and the generator's
    default): the field replaces the combined "venue — surface" select. House league's own refusal moves under the
    field, red, Create greyed, before Create (today a pop-up after Create); the series refusal names the date.
  - **The tryout day** (`components/rep-teams/TryoutDayCard.tsx`): Location and the facility box become the field;
    and, if the owner says yes to precondition 5, the tryout sessions carry the two links (in this migration) and their
    two writers run the check.
  - **The coach's place sheet** (`PlaceSheet`): "Field / Diamond" is labelled with the sport's word (adding a place
    asks the same four things as adding a venue).
- **The tournament's forms** (Add Game, its inline edit, the setup wizard's venue step) **keep today's picker in 6a**:
  they take this field when Tournament Stages 3 and 5 redraw them (Ask 13). A guard lists every form that asks where,
  with a "not yet" list holding the tournament's three, which only shrinks.
- **Words:** "Venue" replaces "Location" on the coach form and the tryout day; `check:spelling` and every help article,
  keyword list and demo line that says "Location" for this field follow (grep). /marketing words the tagged sentences.

### 5. The test club gets venues (additive, never a reset)

- A new fixture flag (beside `--calendar-club` in `scripts/seed-club-fixture.mjs`) adds to UAT Rep Club, **without a
  reset**: Lions Park (Diamonds 1–3), Kinsmen Park (Diamonds A, B), Westfield School (no facilities); a few existing
  rep events moved onto them, including **13U AAA's Tuesday practice on Lions Park Diamond 2 overlapping 14U AA's**
  (the hub's clash), a Wednesday practice with no facility set (the softer line), and one on a team's own place.
- **The house-league walk needs a house league on a club with venues.** UAT Rep Club runs none. Ask the owner which:
  add a small one additively (one season, one division, two teams, a league admin sign-in), or use another dev org.
- **Ask the owner before running it.** Record the flag in the QA tab's sign-in card and the plan.

### 6. The tournament library link (S6-04)

- A clone, "import from a past tournament" and populate-from keep a venue's and a facility's library link (all three
  drop it today; the clone also copies no facilities — see the code map); importing the same library venue twice
  offers the copy already there. The check reads the link (Part 2). The setup wizard's venue search is Tournament
  Stage 5's (recorded there, not built here).

## Help, words, walks

- **`/docs`:** the coach's schedule form (Venue and the facility, the club's venues, the clash line, a series' marked
  dates), the place book (the sport's word), house league's schedule (the line; where its refusal now says itself),
  the tryout day. Keep "Location" as a search term in each article's `keywords`.
- **`/marketing`:** the tagged sentences (the clash line's three states, the series summary, the refusal words, the
  quiet line under Venue). Draft them, tagged; don't ship placeholders.
- **`/demos`:** S6-02 — the coach demo books 10U and 12U on one diamond every week, and the check now warns about it.
  Hand it to `/demos` (stagger the seed, or keep it as the shop window's clash story); do not change the demo here.
- **Walks:** a new Owner QA ledger § (take the number **at the moment you write it**; grep the ledger before and after
  appending), as checkable walks on the hub's QA tab, one purpose each, pinned to identities not figures, with the
  sign-in card. **The definition of done:**
  1. A head coach in the club (13U AAA): the club's venues above the team's places; pick Lions Park, Diamond 2 at
     6:00–8:00 p.m. on the seeded Tuesday: the amber line names 14U AA's practice; change to Diamond 3 or 8:00: it
     goes; save anyway works.
  2. The softer line (facility not set), and the quiet line on the team's own place.
  3. A weekly series across the clash: the clashing dates are marked; removing them works.
  4. Editing a series (this and future): every date's place and venue links follow (S6-05).
  5. A coach outside a club: the form is the same field with Your places only; nothing else changes.
  6. The house-league scheduler: a game on a diamond a rep practice holds saves with the line; a second league game on
     a league-held diamond is refused under the field before Create; a series names its clashing dates.
  7. The tryout day takes the same field.
  8. On a phone (390), the coach's form: Venue above Diamond, the line under them, above the fold; the picker with the
     291px keyboard.
  9. Basketball reads Court: a team (or league season) on basketball shows "Court" on the field and in the line (the
     wording ruling's test, also a unit test).
  The tournament director's walk is Tournament Stage 3's (it places the line).

## Gates

- `npm run verify:changed`, `npm run typecheck` (after `npx next typegen`), the targeted unit files, `check:dictionary`,
  `check:spelling`, `check:css-selectors`, `check:contrast` + `check:text-contrast`, `check:old-look` (6a retires no
  page; it must add no old-look code).
- **The rule's table test**, **the writers guard**, **the Where-field guard** (every form that asks where wears the field
  or is on its "not yet" list), **the mirror-skipped test**, **the basketball test**, and a test that a team outside a
  club sees no club group.
- **`check:layout`, both themes,** on every touched screen (ask the owner first; `--only=` batches of about ten); new
  baseline entries with reasons.
- Then `/simplify`, `/review` at the **high-risk** tier (a migration, every schedule writer in three programs, a shared
  form field), and a `/design` review of the built field and line against the hub at 1440 and 390.

## Hand-off

- An owner-voice summary; the walks to run; departures from the drawings; anything found and not fixed.
- **The counts re-run** on dev (links made, clashes found, per pair) and on production with the owner's go, recorded in
  the plan.
- The plan record (§6 Stage 6, "6a BUILT"), the PM brief's Stage 6 paragraph, memory `project_club_stage6_venues`, the
  TODO line, and the hub's QA tab republished at the same address (read it fresh first; the first publish of a session
  needs the live copy READ in full — memory `reference_artifact_publish_needs_full_read`; parse every script before
  publishing).
- **A note to the tournament redesign** (its plan and memory `project_tournament_admin_redesign`): 6a is built; its
  Stages 3 and 5 can draw and wire the line and the field.
- **Commit only when the owner says**, from a private index with this session's files and hunks only; Part 0 is its
  own commit. Export and typecheck the staged tree before committing; after it, `git reset -q -- <paths>` on the shared
  index. Then `CLUB_TIER_STAGE6B_BUILD_PROMPT.md` in a fresh session.
