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
