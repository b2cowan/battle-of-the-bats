# Club schedules — Stage 2 build prompt (a field in parts)

> Written 2026-11-25, after the round 1 and round 2 rulings and the `/dba` re-pass (owner: "are you ready to start
> building? if so, do you want to provide the prompt?"). **Five sessions, in order**, each pasted into a fresh chat
> (`/clear` first):
> - **2A** (Opus): *"Read and follow docs/projects/active/SCHEDULE_PARTS_STAGE2_BUILD_PROMPT.md — Session 2A"*
> - **2B** (Opus): *"… — Session 2B"*
> - **2C** (Opus): *"… — Session 2C"*
> - **2D** (Opus): *"… — Session 2D"*
> - **2E** (Opus): *"… — Session 2E"*
>
> Plan: `SCHEDULE_FIELDS_SAME_TIME_TRADES_PLAN.md`: §1 (what the product does today), Stage 2 (its checklist, "Drawing,
> round 1: the asks" and "Drawing, round 2: the asks", both RULED, with their "Facts … rest on"), the Census (§E rows by
> area A–H, the source of every code citation), **§5 (the shape (B) and the `/dba` re-pass, which is the storage spec)**,
> Words for /marketing. Status lives on the board (project `schedule-fields-trades`).
> **The drawing is the spec:** `SCHEDULE_HALVES_SAME_TIME_DRAWINGS.html`, published
> https://claude.ai/artifact/YTTYBE67znkupmwLYkLZRR (round 2 is the current version; round 1 is in its history). Where
> this prompt and the plan differ, the plan wins; where the plan and the CODE differ, the code wins: say so out loud
> before building on it. Stage 3 (teams at the same time) is NOT in these sessions; 2E writes its prompt.

## ⛔ Start conditions (every session)

1. Both rounds' asks are ticked RULED in the plan, and §5 carries the `/dba` re-pass (Finding #55). If not, stop and
   tell the owner.
2. **Other sessions share this working copy.** At writing, the club website's "Close a place" build (its
   `CLUB_WEBSITE_STAGE2_BUILD_PROMPT.md`, Sessions 2B–2C) has uncommitted edits in the Venues page, the Venue library's
   CSS, the house-league schedule page, its emails (`lib/league-schedule-mail.ts`) and game-change code. Run
   `git status` first. **Never edit a file that carries another session's uncommitted changes;** if your session needs
   one, do everything else first and tell the owner which file waits. Commit your lines through a private index
   (`reference_partial_commit_shared_tree.md` in auto-memory), never `git add -A`. The plan and the board line are
   shared files: commit only your hunks.
3. **Close a place meets parts in one place:** a closure is made on a whole place or one field (its K2), never a part.
   Under the ruled storage a field-level closure already covers every part (0 = whole overlaps every mask). Any closure
   code that compares fields must use the shared overlap helper from 2A, not its own equality. If a session finds a
   closure path that compares a booking's field without its part, it is a finding for the owner, not a quiet fix in that
   project's files.
4. Migration numbers: take the next one after the highest in `supabase/migrations/` **at commit time** (others land
   migrations the same day).
5. Each session ends: `npm run verify:changed`, `npm run typecheck` (these touch shared modules), the focused tests, a
   product-owner summary, and **commit at the owner's word**. Offer `/review` once per session (the money and clash
   paths make every session substantive).

## What the owner ruled (build exactly this)

**Round 1 (2026-11-25):** 1 A one field that splits (shape (B)) · 2 A a part counts its share of a practice · 3 A a part's
price is the field's ÷ its share, worked out, never typed · **4 B up to four parts, A–D** · 5 A rep schedules and their
practices (widened by 14 C) · 6 A sharing, Teams at once and parts all kept, counted and billed alike; a part is never
shared · 7 A a same-time group may land on two parts (Stage 3) · 8 B a grid row per part, indented under its field; a
whole-field slot stays on the field's row; the PDF a column per part · 9 A Used stays booked time (a part counts its
share) plus one line naming unused time a final schedule holds · 10–13 Stage 3 · **14 C parts and the same-time rule
both reach house league.**

**Round 2 (2026-11-25, all A):** 1 A house league gets parts only through club time (practices and games take their
slot's part; house league never splits a field; its own pickers offer whole fields) · 2 A a quartered field may be
booked whole, as the halves A–B or C–D, or as one quarter (seven options; up to six grid rows) · 3 A a quarter counts ¼
and costs ÷ 4 · 4 A the word says the size ("side A", "quarter C", "quarters A–B") · 5 A in house league a part holds
one team; Teams at once is for whole facilities, with a line when the time has a part · 6 A the house-league same-time
rule (Stage 3) · 7 A a field's split is locked while any part is booked · 8 A a PDF day too wide for one page splits
into two tables, each field kept with its parts.

**Storage (§5, `/dba` re-pass):** `section_mask`, quarter units, 0 = whole; legal per `sections` {1:[0], 2:[0,3,12],
4:[0,1,2,4,8,3,12]}; weight = share × (bits ÷ 4); one overlap helper; words from (mask, sections) at read time.

## Session 2A — the foundation: the database, the shared helpers, every clash check, the venue list

Nothing can book a part at the end of this session, but a club can split a field. The point of the order: before
anything writes a part, the database refuses overlapping ground and every reader that compares places understands
parts.

1. **Re-count first** (counts only, dev and prod, `scripts/db-query.mjs`; prod refuses a file that starts with a
   comment): overlapping same-place pairs within a family in `club_schedule_slots`; slot-made rows off their slot's
   field. §5 has the 2026-11-25 numbers. If either is non-zero now, stop and tell the owner.
2. **Read the save paths' write order** (every writer of `club_schedule_slots`) before choosing whether the exclusion
   constraint is `DEFERRABLE` (§5 build note 2).
3. **The migration**, exactly §5's re-pass: `org_venue_facilities.sections` (CHECK `IN (1,2,4)`); `section_mask` with
   its named CHECKs on the five tables; the `ends_at > starts_at` CHECK first; `section_range()` IMMUTABLE; the exclusion
   constraint replacing `club_schedule_slots_family_place_start`; the triggers (legal for `sections`, the permit-block
   refusal, overlapping masks in one block, the split lock); `org_time_block_facilities`' new primary key. Grants and
   RLS unchanged (no new table). A `/dba` pass on the migration text before apply. **Apply to dev at the owner's word.**
   Then `docs/agents/db/DATA_DICTIONARY.md` and `npm run refresh:snapshots` (dev + prod) in the same unit of work
   (`npm run check:dictionary`).
4. **One shared module for parts**: legal masks for a split, `partsOverlap`, the weight factor, and the words from
   (mask, sections) ("side A", "quarter C", "quarters A–B", "Field 1 in two sides"; working words). Pure, unit-tested.
   It must stay importable by client code (no server imports).
5. **The SQLSTATE 23P01 mapping** beside the 23505 one in `lib/club-schedule-server.ts` (§5 build note 1), with a test.
6. **Every clash check learns parts** (Census area D, plus `lib/venue-clash.ts`, `lib/venue-clash-lookup.ts`,
   `clashKindOf`, `placementsShareSurface`): compare (field, mask) through `partsOverlap`; a reader the census lists that
   only carries an id reads 0 and stays safe. Census rows marked "(B)" in area D are the list; open each line before
   changing it.
7. **The venue list** (`VenueLibraryWindows.tsx`, Census area A): the split select "Not split" / "Two sides" / "Four
   quarters" on a field, locked while any part is booked with its locked line (tab 2 of round 2), the read card, the
   phone frame. The route refuses a change the trigger would refuse, with words, before the database does.
8. Tests: the mask module; the migration's refusals on dev (a whole and a part, A beside A–B, B–C refused, a split
   change while booked); each clash reader with a part.

## Session 2B — the builder: New schedule, the slots, shares and the grid

At the end a club can build a schedule on parts and see it on the grid and the bill.

1. **New schedule's tick list** (`PickField`; round 2 tab 3): a split field offers its parts in the flat list (seven on
   a quartered field); ticking a part unticks its whole field and the reverse; ticking A–B unticks A and B and the
   reverse; the box words ("Field 1 in two sides, Field 2 side A", "Field 1 quarters A–B, C and D"). A schedule's row
   stores one `org_time_block_facilities` row per ticked part.
2. **Cutting and placing** (Census area C): `cutSlots` cuts a part as its own slot; `slotRoom`, sharing and value
   balancing read a part's weight; a team is never on a field and one of its parts at once; a part is never shared
   (round 1 Ask 6 A). Every place key (`slotKeyOf`, `pos`, `facKey`, `placeKey`, the grid cells) carries the mask.
3. **The weight** through one `weightOf(facility, mask, permit)` at the five sites §5 lists; none of the five may keep
   its own arithmetic.
4. **Shares** (round 1 Ask 2 A, round 2 Ask 3 A): a part counts its share of a practice. Test the drawing's two
   pictures: round 1's (sides beside a whole field, Evenly, every team $1,800, $7,200 billed) and round 2's (quarters
   beside a whole field under Evenly: 7U 10 short each, 10 Field 2 slots open; By percentage fills it).
5. **The grid** (round 1 Ask 8 B, round 2 tab 4): a row per part indented under its field, up to six on a quartered
   field; a whole-field slot on the field's row; hand moves (`planMove`, drag and drop) refuse a part onto ground its
   field or a sibling holds.
6. **The bill** (round 2 tab 5): the "quarter-field slots" count beside full, half and shared (`billTeamCaption`; a
   0.25 slot reads "more" today); the Split hint's "a half field or one side". By price, as round 1 kept it.
7. Tests in `tests/unit/club-schedule-engine.test.ts` and beside the bill: the two pictures above; a run with no split
   field unchanged (byte-for-byte on an existing fixture).
8. **Carried from 2A (committed `e080b0750`; the plan's "2A built" line under Stage 2 holds the reasons):**
   - **The save must learn the part.** `club_schedule_save` (latest in mig 494) finds a stored slot by (schedule, venue,
     facility, `starts_at`) at `:155-159` and inserts slots and a schedule's block rows with no `section_mask`. Side A
     and side B at one start would match one row. A NEW migration (next number at commit time) re-makes the function:
     the lookup and both inserts carry the mask from the payload. Apply to dev at the owner's word, `/dba` on the text
     first, and add it to `MANUAL_PROD_STEPS.json` (function-only, so the drift check cannot see it).
   - **The floor is an exclusion constraint now** (`club_schedule_slots_family_place_overlap`: live rows, deferred to
     commit, raises 23P01, which `floorRefusal` says as "changed since you opened it"). So if the cut or a hand move ever
     puts a whole field and its part at overlapping times, the club sees "changed" in a loop, not a builder message.
     Test that the cut and `planMove` never produce overlapping ground. Do not lean on the database to catch it.
   - **A block can now hold several rows for one facility** (primary key (block, facility, mask)). Every reader that
     builds `facilityIds` from a block's rows must carry (facility, mask) or de-duplicate:
     `lib/club-schedule-server.ts:272` and `:1142`, `lib/permit-lookup.ts:170`, and the held-facility check in
     `app/api/admin/org/venues/route.ts`.
   - **The part words and size come only from `lib/field-parts.ts`** (`partsOverlap`, `partFactor`, `partWords`,
     `fieldPartName`, `splitFieldWords`, `legalMasks`). `weightOf` = the field's share × `partFactor(mask)`. No reader
     writes its own bit arithmetic. A field's split reads from `org_venue_facilities.sections` (the Venue library
     route returns it as `sections`).

## Session 2C — after the builder: Send, the coaches portal, the calendar, the PDF

At the end a part travels everywhere a practice goes, and the PDF prints it.

1. **Send the changes** writes the slot's part beside its field onto `rep_team_events` (and the corrections path);
   Finding #56 fixed here: a gained shared slot's hours recorded at its share, so sharing and parts record alike.
2. **Every place word a coach or family reads** carries the part: the coaches portal's practice rows and event screens,
   the club calendar (`lib/club-calendar.ts`: a part joins with a comma, "Field 1, side A", never a second " — ", round 2
   facts), and anything else Census areas D and G list as reading a practice's place.
3. **The PDF** (round 2 tab 5, Ask 8 A): a column per part keyed by field and part, the part on the heading's second
   line, no price word (`weightWords` would print "· 25%"); a day too wide for one page splits into two tables, each
   field kept with its parts (today `lib/export/pdf.ts:630-640` drops the columns that don't fit; that drop must never
   happen to a schedule's columns again). Landscape US Letter, as shipped.
4. Tests: Send writes the part; the hours fix; the PDF split (a fixture with two quartered fields and four whole ones).
5. **Carried from 2B (committed `b37a4bccc`, the index `c1d36fe06`; the plan's "2B built 2026-11-26" line holds the
   reasons and every open `/review` finding):**
   - **Owed here:** the coach's hand-back series key (`lib/club-schedule-coach.ts` `placeKey`) and the PDF cell
     (`lib/club-schedule-document.ts`, the place cell ~`:160`) carry the part; Send writes `section_mask` onto the
     practice (`rep_team_events.section_mask` exists since 541). Also the schedule page's after-a-move span
     (`app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx` `toDays`, ~`:310`) matches on the field, not the part.
   - **The one home, extended by 2B's `/simplify`:** `lib/field-parts.ts` now also holds `maskSuffix` (a key's part,
     nothing for the whole field), `maskProp` (the optional `sectionMask`, no property for the whole field), `maskRank`,
     `samePlace` (every clash reader), `tickOptions`/`resolveTicks`/`placesOfTicks`/`fieldTicksWords`/`partLabel`; the
     engine has `slotOrder` (the cut's and the kept merge's one order). It imports nothing (a test holds it). Use these;
     never write `|${mask}` or `mask !== WHOLE ? {…} : {}` by hand.
   - **The rule 2B kept:** with no split field every path reads byte-for-byte as before — the two "no split" tests in
     `tests/unit/club-schedule-parts.test.ts`; extend them to Send and the PDF.
   - **Not 2C's (the plan's 2B line):** prime time under "A set number a week" with parts (an owner design call); house
     league and league-time reads (2E); free time reading a part as the whole field busy (2D); the bill hint by size on a
     "Half cost" field; the save proof covers draft schedules only.
   - **Production order** (`MANUAL_PROD_STEPS.json`): 541, then 544, before the 2B promote; 545 (an index) any time.
   - **Before a browser look:** restart the dev server (shared modules changed).
   - A failing `club-scheduler-guard` test naming `scripts/lib/prospect-demo-rep.mjs` is another session's, not 2C's.
   - This item is uncommitted when 2C starts: commit it with 2C's first commit.

## Session 2D — other schedules, and the permit's Used figure

At the end the builder sees time another schedule already holds, and the Permits page says plainly what is unused.

1. **The owed item (P3):** the builder, the finder's pick and the permit's Used figure see other schedules' final
   time; the builder sees another schedule's draft and warns, as the finder does ("Whichever is finalized first keeps
   it"). Parts count by their share.
2. **Used** (round 1 Ask 9 A): stays booked time, a part counting its share; one line names unused time a final schedule
   holds that no team has (open slots, house-league time not yet given out): "Of the unused time, 9 h is open slots on
   {schedule} …" (working words). Census area B; permits never name a part (permit-owned blocks refuse a mask).
3. Tests: two schedules on one permit, one final and one draft; a part's share in Used.

## Session 2E — house league, then the stage's close

At the end house league carries parts from club time, and Stage 2 is ready for its walk.

1. **House league** (round 2 Asks 1 A, 5 A; tabs 6 and 8; Census area E): the game generator on club time writes its
   slot's part beside the field (`league_games` through `league_slot_uses.slot_id`); Practice time writes it on
   `league_practices`; a part holds one team, Teams at once counts whole facilities only, with the line "Field 1's sides
   hold one team each. Teams at once is for whole facilities."; a hand edit that changes a game's or practice's field
   writes 0. Place words on the public schedule pages and family emails carry the part. House league reads its seasons
   in place (CLAUDE.md): no closed-season page question. ⚠ This is where Close a place's files are most likely still
   open (start condition 2).
2. **The stage's close:** `/simplify` then `/review` on the whole stage's diff; the **one `/marketing` pass** for
   Stage 2's words (plan, Words for /marketing: the venue list, the rows, the grid, the PDF, the bill, house league);
   `/docs` (the scheduler and house-league help); the board line; then **write the Stage 2 walk** at the owner's word
   (Owner QA Ledger, house rules for walks: 20–50 boxes, one action per step, exact logins with `UATPassword2026!`).
   `/legal` is not triggered (no new email, nothing new collected; a part only joins the place words) — say so in the
   summary so the owner can disagree. `/accounting` is not triggered (customer bookkeeping).
3. **Write Stage 3's build prompt** (teams at the same time, rep and house league; its rulings are round 1 Asks 7,
   10–13 and round 2 Ask 6) into the plan, from what Stage 2's build actually changed.

> **2E was split in three (2026-11-26, said out loud in the 2E session):** the census counted 7 house-league readers, the
> code has about 40. Part 1 (the part travels and is respected) is committed (2026-11-26); the plan's "2E part 1 built"
> line under Stage 2 holds what it did, the two calls the code made, the review and its two open owner questions. Paste, each in a fresh
> chat (`/clear` first):
> - *"Read and follow docs/projects/active/SCHEDULE_PARTS_STAGE2_BUILD_PROMPT.md — Session 2E part 1, finish"*
> - *"… — Session 2E part 2"*
> - *"… — Session 2E part 3"*

## Session 2E part 1, finish — apply 552 to dev, review, commit

> **DONE 2026-11-26** (the plan's "2E part 1" lines hold the apply, the review and the fixes). Kept as the record.

**The owner's go is this prompt** (2026-11-26: "give me the prompt to do 1 and 2": apply 552 to dev; `/review`, then
commit, with the two one-line changes in the other session's files). Start conditions 2 and 5 above still hold.

1. **Read first:** the plan's "2E part 1 built" line (Stage 2) and `git status`. Part 1's files are uncommitted in the
   shared tree; another session's Close a place work is uncommitted beside them (its typecheck errors and failing
   `place-closure*` tests are not this session's). Take the next free migration number at commit time; if another
   session took 552 meanwhile, renumber (the file, its header, `house-league-parts.test.ts`, the plan line, `lib/types.ts`'
   two comments).
2. **Apply 552 to dev** (`node scripts/db-query.mjs --dev -f supabase/migrations/552_house_league_takes_its_slots_part.sql`).
   Read the six functions back (`pg_get_functiondef`) and run `scripts/schedule-parts-house-league-check.sql` on the
   applied functions: 9 of 9, or stop and say what failed. Record "applied to dev 2026-11-26" in the plan line.
3. **`/review`** (`.claude/commands/review.md`) on Part 1's diff ONLY: the files the plan line names, the migration, the
   proof, `tests/unit/house-league-parts.test.ts` and `league-schedule-health.test.ts`. Fix the clear defects; a finding
   that changes what an admin, coach or family sees is the owner's — ask, don't build. If a fix touches the migration,
   re-run the proof and re-apply to dev. Record what was fixed and accepted in the plan line.
4. **The two waiting files**, through a private index (`reference_partial_commit_shared_tree.md`), never touching the
   other session's hunks:
   - `tests/unit/place-closures-guard.test.ts`: the "only the closure press turns the quiet link on" test counts every
     migration naming `'league.quiet_link'`; 552 re-makes the recorder, which only READS it. Change that one filter to
     migrations that TURN IT ON (`set_config('league.quiet_link', 'on'`). The committed guard fails on 552 too.
   - `supabase/migrations/MANUAL_PROD_STEPS.json`: 552's entry — prod `pending`; function-only, invisible to
     `check:migrations`; ORDER after 541 and 546, before the promote that ships Part 1's code (that code sends
     `section_mask` to `league_game_club_write` and expects parts from the generate and hand-out functions); verify
     `select count(*) from pg_proc where proname='league_game_snapshot' and prosrc like '%sectionMask%'` -> 1.
5. **Before the commit:** `npm run typecheck` (with `NODE_OPTIONS=--max-old-space-size=8192`; it runs out of memory
   otherwise), the focused tests (the 13 files the plan line names), `node scripts/check-dot-joins.mjs`. `verify:changed`
   stops at `npm test` while the other session's tests fail: run its later checks directly and say so.
6. **The board line** for `schedule-fields-trades` (`OWNER_BRIEF_PROJECTS.json`, a shared file: your hunk only): 2E part 1
   committed, part 2 next.
7. **Commit** on `dev`, explicit pathspecs (Part 1's files, the plan's 2E lines and this prompt file's 2E sections —
   both are this session's), `git show --stat HEAD` after; no push. Message: what a house-league admin
   sees (the plan line's "Built"), the two calls the code made, the dev apply, the review.
8. **Hand-off:** a product-owner summary, then **re-read the "Session 2E part 2" section below and bring it up to date
   with anything the review changed**, and give the owner its one paste line. Restart the dev server before any browser
   look (shared modules changed).

## Session 2E part 2 — every place word carries the part

At the end every screen, email, file and public page that says where a house-league game or practice is says the part:
"Milton Sports Dome · Field 1, side A" (round 2 tab 8; the drawing's "Every place a part's words reach" table is the
spec). With no split field every word reads byte-for-byte as before (the 2B rule: test it).

1. **Start:** Part 1 committed (the plan's "2E part 1" line says so); `git status`; start condition 2 (Close a place's
   files: `lib/league-schedule-mail.ts`, the house-league schedule page and the club website's game lists are the likely
   collisions). Part 1's `/review` left **two owner questions** (the plan's 2E part 1 lines, A and B: hand-placing a
   game on side time; Send the changes putting two practices on one side). Ask whether they are ruled; build neither
   without a ruling, and a ruled one is its own small piece before the readers. ⚠ **Part 1 does not go to production
   without Part 2:** a side A → side B move is already news, and the words still say "Field 1" for both until this
   session. Changed by the review: `keptPart(stored, fieldId, sections)` (a part the field no longer offers is the
   whole field; `resolveLeagueVenueSelection` returns `fieldSections`), the live check reads an edited practice's part,
   and mig 552 now also re-makes `section_mask_check` (only a new field or part is judged). Part 1 already gives every reader the part: the `LeagueGame` / `LeaguePractice` mappers carry
   `sectionMask`, `getOrgPlaceNames` returns `sections`, the snapshot carries it, and new stored lines carry ", side A".
   **Stored lines written before 552 do not:** words built from ids get the part; a reader that only shows `location`
   text gets it only for rows written since.
2. **The one rule for words:** the part joins the facility with a comma (`fieldPartName(…, ', ')`, `clubFieldWords`),
   never a second " — " or " · ". Read at read time from (mask, sections); never a new stored word. No reader writes its
   own bit arithmetic (`lib/field-parts.ts` is the one home).
3. **The readers** (the 2E session's census, 2026-11-26 — open each line before changing it):
   - Place builders: `lib/league-season-calendar.ts` `seasonCalendar`'s `where()` (set `CalendarWhere.part`; `whereWords`
     already prints it) and `SeasonPlace` / `placeOf`; `nightPlaces` keys venue|facility (side A and B fold into one);
     `lib/league-venue.ts` `report()` (the refusal's "on {fieldLabel}"); `lib/house-league-coach.ts` `placeNamer`;
     `lib/league-schedule-mail.ts` `placeReader`; `lib/club-games-read.ts:159-171`; `lib/house-league-find.ts:104-105`.
   - Public: the league schedule page (`publicSeasonGames` → `seasonCalendar` → `whereWords`); `publicLeagueGamesBetween`
     → the club website's game lists. The public "Moved" mark already follows (Part 1's `placeDiffers`).
   - Emails and notices: the published-schedule email and the change email (`GameSnapshot` now has the part; teach
     `placeReader`, and check `lib/league-schedule-email.ts`'s `gameLine` / `wasClause` and the tray's `trayChangeLine`
     read a side-only move as two different places); the practice Tell step (Part 1 gave `placeOfTold` a `sections` reader: check every caller passes it).
   - Coach portal (house league): `readTeamScores`, `readGamesAsSent`, `readCoachFeedEvents`, `readTeamPractices`
     (explicit selects: add `section_mask`); `FeedTeamEvent` extends `EventPart` but is never given it (the coach ICS
     feed, `lib/family-team-schedule.ts`, `lib/family-league-entries.ts`).
   - Admin: the schedule page's `placeOf` for `seasonCalendar`, its CSV/XLSX (`g.location`), its ICS
     (`houseLeagueCalendarEntries`), Changes to send's `placeWords`, Schedule health's clash words
     (`leagueIssueWords`); `GameWindow` and `SeasonScheduleViews.nightPlaceWords` (`facilityWords` ignores `w.part`);
     `PracticeWindow` (`practice.location`); Generate games' two row lists (Part 1 made each slot's `place` "Field 1,
     side A": check the window and its count "65 game slots in all" counts each side).
   - The clash pool's facility names (`lib/venue-clash-lookup.ts:289`) read no `sections`: the cross-program clash words
     say no part.
4. **Words for /marketing:** none new beyond the drawing's; collect any sentence you had to write into the plan's
   "Words for /marketing" house-league row for Part 3's pass.
5. **Tests:** each surface with a part, and the "no split = identical" test extended to the public page, both emails, the
   coach feed and the exports. `/review` on Part 2's diff before the commit.
6. **End:** `npm run typecheck`, the focused tests, `check-dot-joins`, a product-owner summary, the plan line ("2E part 2
   built") and the board line; **commit at the owner's word**; then point the owner at "Session 2E part 3" (bring it up
   to date first). `/legal` is not triggered by Part 2 (a part only joins the place words; no new email, nothing new
   collected) — say so so the owner can disagree.

## Session 2E part 3 — the stage's close

Session 2E's original items 2 and 3, above, unchanged: `/simplify` then `/review` on the whole stage's diff; the one
`/marketing` pass for Stage 2's words; `/docs` (the scheduler and house-league help, and the 2D notes folded into it);
the 2D design check's P1/P2 (fix or ideas backlog, the owner's call); the board line; the Stage 2 walk at the owner's
word; Stage 3's build prompt into the plan. Start by reading the plan's 2E part 1 and part 2 lines for what they changed.

Brought up to date by 2E part 2 (2026-11-27):
- **Both owner questions from Part 1's review are ruled and built** (A: the side follows the time; B: one team a side,
  with mig 553). Nothing in Part 3 re-opens them; the walk tests both (a league admin adds a game on side-only game time and
  it lands on side A, then B when A is taken; the club splits a two-teams-at-once practice slot and sends: one team a side).
- **Production order for the whole stage:** 541 → 544 → 546 → 552 → 553 (`MANUAL_PROD_STEPS.json`), every one before the
  promote that ships Stage 2; 545 (an index) any time. 553 is on dev (2026-11-27).
- **/marketing has one open sentence of the owner's:** a practice Send the changes can't fit on a side reads the send's
  existing "cancelled"; the ruling's option said "1 house-league practice needs a new time" (the plan's Words row).
- The stage's whole diff for `/simplify` and `/review`: commits `e080b0750` (2A) through the 2E part 2 commit.
