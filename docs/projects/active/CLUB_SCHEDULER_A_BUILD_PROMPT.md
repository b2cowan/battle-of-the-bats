# Club Tier Stage 11a, part A — the club scheduler's server: data, engine, bill, bookings, sends (built to hub version 87)

> Paste into a fresh session on `dev`, **after 10a (permits) is committed**. Written 2026-10-11, the day the Stages 10 +
> 11 drawings were **ratified**: all twenty-seven asks as recommended (owner: *"looks great, go ahead and write the build
> prompt based on your recommendations"*). **11a builds as two prompts:** **this one, part A — the server** (the data, the
> engine, the bill, every writer, the sends, the guards; **no screens**), then **part B — the screens**
> (`CLUB_SCHEDULER_B_BUILD_PROMPT.md`), which starts only after this part is committed. 11b (house league's half) waits
> for Stage 9 (Ask 6). **The calendar feeds (6d) are not a precondition** (owner, 2026-10-11): the feed reads the practices
> this part writes whenever it is built.
>
> **The definition of done for 11a is the owner's own flow** (plan §6a): a club records a six-month winter dome permit
> (10a), six fields, four full and two half; hands out its Sundays 8:00–11:00 a.m. in 90-minute slots; bills the teams for
> the time each got with payments that follow the time (Oct 1 pays for October and November, Dec 1 for December and
> January, …); sends the schedule and the bill for review; finalizes; and every team's schedule and budget follow. Part A
> makes every step of that true on the server, proved by unit tests; part B puts it on screen and walks it.
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stages 10 + 11** (version 87).
> Part A builds no screen, but every number, rule and word it computes is drawn there — read 11a's screens (**4** to
> **15**, `#s1011-list` … `#s1011-exports`, the house-league frames excepted) and **"Not drawn"** (`#s1011-build`: every
> row except *Permits* and *House league*). The Decisions tab holds the rulings with their reasons — **11a's: Asks 5–7, 9,
> 12–20, 22–27 and Stage 11 Asks 1–6** (Ask 24 amends Stage 11 Ask 1: an optional review round that never blocks) — and two
> **open** rows, *Build question A* and *B* (precondition 4). Where you must depart, say so and record why; never silently.
>
> **Read first:** `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` — all of it (§3 the evidence, §5.3–§5.9 the shape, §6 the asks and
> the two build questions after Ask 27, §6a the dome walk, §6b exports, §7's 11a bullets), and the **"10a BUILT"** block
> 10a's session wrote at its top; `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 11 (its RULED block) and §5 **D1** and
> **D3** (amended narrowly 2026-10-08); `BUSINESS_DECISIONS.md` 2026-10-08 (the scheduler's plans) and 2026-10-11 (permits'
> plans). Memory `project_club_stage11_scheduler`, `project_club_stage6_venues`, `project_club_tier_readiness`,
> `feedback_exports_house_format`, `reference_backticks_in_shell_strings`, `reference_js_replace_dollar_patterns`.

## ⚠ The lessons this stage already paid for

- **"Wear the tournament's parts" means the look, not the code** (P11-02, Ask 5). Nothing in the tournament generator is
  shared yet (its own header, `Generator.tsx:16`). Its engine pairs two-sided games, and its `isEdgeSlot` penalises slots
  before noon and from 5 p.m. (`lib/schedule-generator.ts:466-469`) — backwards for practices. **Build your own engine.
  Never edit the tournament's generator, engine or Timeline in this build.**
- **The mirror writes on read; a club slot writes once** (P11-05). The tournament mirror re-diffs on every events GET
  (debounced 10 s, `lib/rep-tournament-game-mirror.ts:122-158`). Copied, a club slot would reach a team — and the club
  calendar, the clash pool and any feed — only when someone opened that team's schedule. Rows are written **at Finalize**
  and changed **at Send the changes**, never on read.
- **The 409 refusal keys on the mirror's own column.** `isMirroredEvent` (`lib/coach-tournament-games.ts:43`) reads
  `sourceTournamentGameId` only. A club slot needs its own provenance column, unique index and predicate, and the
  PATCH/DELETE guards (`events/[eventId]/route.ts:76-86`, `:352-356`) must ask both.
- **The clash rule would flag the club's own plan** (P11-04a): two teams sharing one lane in one slot ("teams at once")
  are two rows on one facility at one time. Rows from one club slot never clash with each other. **"Never on a team's
  game day" cannot read the pool** (P11-04c): an away game stands on a typed place, which the pool never holds — read each
  team's whole schedule.
- **A team event belongs to one season** (P11-06). Rows land in each team's running season at Finalize; a team with no
  running season can't take one. **The season roll's "the SCHEDULE starts fresh"** (`lib/rep-season-rollover.ts:33`, a
  locked owner decision) is about the old season's own events; Ask 15 carries a team's **upcoming club slots** into the
  new season because they are the club's booking, not the old season's — a narrow exception that keeps the rule's
  reason. The mirror's `resolveSeasonFloor` (`:60`) is the precedent for a season-aware copy. Say so in the roll's header.
- **The money loop has no proposed state and its terms never change** (3d Ask 7b). So the bill **rides with the
  schedule** until Finalize and becomes one allocation then (Ask 23). An allocation already stores each team's own
  installments with any dates and amounts (`club_allocation_create`, `318_…sql:1686-1803`); only the arithmetic is
  missing. Its limits are real: one split method per bill, one split per team per bill, `billSplits` demands a
  bill-level schedule even when every team carries its own (`lib/club-bill-split.ts:124-128`), each share needs at least
  as many cents as due dates (`:159-161`), and a closed season or a closed fiscal year is refused.
- **The demo guard for email is at the request layer only.** `sendEmail` (`lib/email.ts:52`) has no demo check; the
  proxy blocks a demo org's POST (`proxy.ts:55-56`, `lib/demo-guard.ts:123`) and `notify()` stays silent for one
  (`lib/notify.ts:138`). Send every email from a POST route, never from a GET or a background path.
- **League Plus has no rep teams.** The key passes `league` (Stage 11 Ask 6), but on League Plus 11a has no team to hand
  time to until 11b. Every route answers that honestly (nothing to schedule), and part B hides the entry point.
- **`lib/db.ts` holds a NUL byte**: ripgrep skips it as binary. Search it with `grep -a`.
- **Shared files are shared.** 6d, the tournament redesign or a 10a follow-up may be running. The hub, the plans, the
  TODO, the ledger, the dev server and the test club are everyone's.

## Preconditions (check before code)

1. **Git:** on `dev`; `git log` and `git status` read fresh. Other sessions' hunks in shared files (TODO, the plans, the
   briefs, the ledger, the hub, the strategy docs) are theirs: build shared files as HEAD plus your own hunks.
2. **10a is committed.** Read its "BUILT" block and its note to this part (the permit and block tables' final names, the
   block's owner column and how a schedule joins it, the field-price helper, the permit answer's module). **10a's session
   writes that note here as item 2a.** If 10a isn't committed, stop and tell the owner.
   - **2a · From 10a's session (2026-10-11 — re-grep every name before you trust it):**
     - **The one model of time.** `org_time_blocks` (mig 322): `org_id`, **`permit_id` — the owner column, NOT NULL
       today**, `org_venue_id`, `weekdays` (smallint[], 1 = Monday … 7 = Sunday), `start_time` / `end_time` (wall clock
       on the club's clock — a block never crosses midnight, and the form's clock stops at 11:59 p.m. — the owner ruled
       2026-10-11 that no block needs to run TO midnight), `from_date` / `until_date` (stored, NOT offered by 10a's
       form — and a permit save through `org_permit_save` nulls them: carry them through `lib/permit-form.ts` before
       anything writes one). **Join a schedule as the second owner:** add `schedule_id` (FK, cascade), make `permit_id`
       nullable, a one-owner CHECK (exactly one of the two), and teach `org_time_blocks_check` the schedule's org. The
       guard `tests/unit/club-permits-guard.test.ts` ("one model of the club's time") fails on a second weekly-time table
       and expects this owner column — extend it, don't route around it.
     - **Facilities:** `org_time_block_facilities` (block, facility; NO ROWS = every facility at the venue, read at the
       time). The venue and facility links are NO ACTION (not RESTRICT — the club's own removal cascades); a delete path
       that clears a club's `org_venue_facilities` first must clear `org_time_blocks` before it (the platform-admin org
       delete and the fixture's `--reset` do).
     - **Dates off:** `org_time_dates_off` is PERMIT-owned (`permit_id`). A schedule's days off are its own (Ask 20).
     - **Field prices:** `org_permit_facility_shares` (permit, facility, share < 1; no row = Full) and
       **`fieldPrices(permit, venueFacilities, shares, cost)`** in `lib/permit-time.ts` — the hour of each field, Σ(held
       hours × share) the divisor (the dome's $72.00 / $36.00 is its test). The bill's arithmetic starts there (Ask 23).
     - **The permit's answer:** `permitAnswer` in `lib/permit-time.ts` (pure); `checkClubPermits` /
       `checkClubPermitsQuietly` in `lib/permit-lookup.ts` (the reads, one per check; the quiet one never throws); the
       wire shape `PermitOutside` in `lib/permit-words.ts` (facility, days, hours, until, date off — never money).
       `readClubPlaces` there reads the club's venues and facilities once. The answer rides every check and every
       writer's reply as its own field `permits`; never a third `ClashKind`.
     - **Reads you will reuse:** `readPermitTimes` (by venue + days, by id, or by start span), `permitUse` (Held ·
       Booked · Unused over the one pool, `readClubBookings` — no "Outside it" since the owner removed it 2026-10-11;
       a permit never lists the bookings no permit covers, see `lib/permit-time.ts` §3). A block added during an open edit gets a new
       id at each autosave until the window re-reads (✓) — fix that before a schedule slot points at a permit's block.
     - **Money rule:** a permit's money reads only to `canMoveClubMoney` readers (stripped on the server); a closed
       fiscal year locks a permit's cost and budget line, and refuses its delete (`org_permits_check`, BEFORE INSERT OR
       UPDATE OR DELETE).
   - **6d:** not required. If it is already built, read its record of what the feed carries (plan §5.8) so the rows you
     write give it what it reads (an ordinary practice; a cancelled one kept and marked; a handed-back one gone).
3. **The UX summary for the owner comes first** (AGENCY_RULES), short and in owner voice: this part changes **nothing a
   person can see yet**; it makes the scheduler work underneath — the time cut into slots, the fair shares, the bill and
   its payments, the practices written onto teams' schedules at Finalize, the emails and notices, the hand-back — each
   proved with the dome's own numbers; part B puts it on screen. Name any departure from the drawings.
4. **Two money questions — the hub's open *Build question A* and *B* (plan §6, after Ask 27). Put them to the owner
   before A3, unless the owner has already ruled them on the hub:**
   - **A. The bill's filing (Ask 25).** The ratified answer files the club's bill under the club line's word so the
     team's Budget vs. Actual places it. Mig 250 (`250_club_money_says_what_it_was_for.sql`; dictionary
     `rep_allocation_splits.budget_item_id`) says a team's share is "filed by the COACH, never by the club", because the
     club doesn't know the team's words and two teams may file one shared cost differently. **Recommended:** keep both
     reasons — pre-file **only** under a platform word the team's own budget already has; otherwise unfiled, as today;
     the coach changes it per team on Money › Club, as now.
   - **B. A team that loses time after Finalize (Ask 23a).** A correction bill works for a team that gains time. A team
     that loses time is owed money, and an allocation can't be negative or change its terms. **Recommended:** Send the
     changes previews the corrections; the loser gets a credit recorded the way the club already covers a cost for a team
     (check what the money loop offers before proposing anything new); the first bill never changes. If nothing fits,
     stop and ask; never invent a negative allocation.
   Record both answers in the plan's §6 and on the hub's two rows (they become Accepted or their ruling).
5. **The feature key** (`/billing`): the scheduler = League Plus and both Club bands (`PLAN_PRICING_FACTS.md:54`, Decided
   2026-10-08; "no scheduler key exists yet"). Add it in `lib/plan-features.ts` (the `PlanFeature` union `:3-73`,
   `FEATURE_MIN_PLAN` `:84-123`, a case in both copy helpers `:160`, `:216` — a missing case recurses forever,
   `:187-188`; verify the rank ladder `PLAN_RANK` `:75-82`) and the Facts doc in the same change, drift check run.
6. **One browser tester at a time.** Part A needs no browser; if you probe anything, ask the owner first. **Never reset
   the test club**; the fixture step (A6) is additive and asked first.

## The code, read 2026-10-11 (re-grep before you trust a line number)

- **The tournament mirror, the precedent** — `lib/rep-tournament-game-mirror.ts`: `resolveSeasonFloor` `:60`; the "did the
  coach do anything" read `loadChildWorkEventIds` `:90-109` (attendance, lineups, tags, awards, expenses; a failed read
  counts as worked on); the debounce `:122-131`; `syncTournamentGameMirror` `:146` (insert `:212-225` — a `23505`
  collision counts as success; orphans sorted `:228-234`; update per row `:240-241`; cancel `:243-245`; delete last
  `:256-269`, only while the coach's own fields are null); `syncTournamentGameMirrorSafely` `:288`.
  `lib/tournament-game-mirror.ts`: `MIRROR_SYNCED_COLUMNS` `:148`, `ORGANIZER_OWNED_API_FIELDS` `:165-171`,
  `hasCoachOwnedFields` `:196`, `planTournamentGameMirror` `:212`, `decideOrphanFate` `:324-329`. The column and its
  partial unique index `207_rep_event_tournament_game_source.sql:35-40` (not a foreign key, on purpose `:20-26`).
- **The coach's refusals** `app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/route.ts`: PATCH `:53`, guard
  `:76-86` (words `:81`); DELETE `:335`, guard `:352-356` (words `:354`). The coach's events GET `…/events/route.ts:62`
  (season `:52`, the mirror sync `:83-88`); the admin's team schedule GET
  `app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/events/route.ts:22` (syncs `:50-58`).
- **Rep events** `lib/db.ts` (`grep -a`): `mapRepTeamEvent` `:5603` (`sourceTournamentGameId` `:5643`), `getRepTeamEvents`
  `:5692`, `getRepTeamEventById` `:5709`, `CreateRepTeamEventFields` `:5719`, `createRepTeamEvent` `:5754`,
  `createRepTeamEvents` `:5791` (batch; takes an explicit id; the insert maps `:5757-5784`, `:5794-5822` carry only
  `sourceBasicEventId`), `updateRepTeamEvent` `:5828`. Dictionary `rep_team_events` `DATA_DICTIONARY.md:2317`
  (`program_year_id` NOT NULL `:2332`, the mirror's ownership contract `:2436`). The running season:
  `getActiveRepProgramYear` `lib/db.ts:4185`, `liveSeasonOf` `lib/season-live.ts:28`, SQL `rep_team_live_season`
  `318_…sql:482`, `resolveLiveCoachTeamContext` `lib/coach-route-context.ts:73`.
- **The season roll** `lib/rep-season-rollover.ts` (`startNextRepSeason` `:98`, "the SCHEDULE starts fresh" `:33`, the
  old season completed `:455-458`); called from `app/api/coaches/[orgSlug]/teams/[teamId]/seasons/route.ts:285` and
  `app/api/admin/rep-teams/teams/[teamId]/seasons/route.ts:146` (which tells the staff `:162`).
- **The pair rule and the pool** `lib/venue-clash.ts` (`ClubBooking` `:59`, `findClubClashes` `:243`, `findClashPairs`
  `:268`), `lib/venue-clash-lookup.ts` (`readClubPool` `:238`, `checkClubClashes` `:346`, `clashesForSavedRepEvents`
  `:478`); the writers guard `tests/unit/club-stage6a-guard.test.ts` (`WRITERS` `:56-75`, the mirror named `:80`,
  `:129-130`).
- **Club money:** `club_allocation_create` `318_…sql:1686-1803` (params `p_org, p_actor, p_description, p_source_line,
  p_split_method, p_splits, p_notes`; each split `{teamId, programYearId, amount, splitValue, paymentSchedule, notes,
  installments:[{installmentNumber, amount, dueDate}]}`; refusals `season_closed` `:1733-1737`, `over_line` `:1748-1753`,
  `year_closed` `:1744`, `:1757-1760`; installments `:1776-1780`); the caller `lib/club-budget-writes.ts:392`
  (`createClubAllocation`; the running-season check `:442-456`; the RPC `:469-477`); route
  `app/api/admin/rep-teams/allocations/route.ts:47`. `lib/club-bill-split.ts`: `shareCents` `:62`, **`spreadGroupFigure`
  `:81`** (a group's figure spread over its teams — reuse it for time), `billSplits` `:111`, weights `:146-156`, a team's
  own installments `:167-182`. Dictionary: `rep_cost_allocations` `:4553`, `rep_allocation_splits` `:4588`
  (`split_method` CHECK `even|percentage|sessions|fixed` `:4612`, the stale "entered manually" `:4594`, the filing
  columns `:4620-4622`), `rep_allocation_installments` `:4624`.
- **The coach's side of a club bill:** the filing PATCH `app/api/coaches/[orgSlug]/teams/[teamId]/allocations/route.ts:76-120`;
  Budget vs. Actual `…/budget-vs-actual/route.ts` (`getSeasonClubBills` `:233`, paid installments placed by the filing
  `:823-845`, scheduled ones `:1266-1285`, "Not itemized" when unfiled); `lib/coach-club-bills.ts:49`;
  `lib/coach-budget-rollup.ts` (header `:1-9`, `rollupMoneyReport` `:581`).
- **The send precedent (3a's reminders):** `app/api/admin/accounting/reminders/route.ts` (GET preview `:28`, POST `:34`,
  the resolver `:17-26`); `lib/club-money-reminders.ts` (`reminderPreview` `:62`, unreachable `:101-107`, `lastWave`
  `:126`, `sendReminders` `:144`, the claim `:162-173`, reply-to `:183`, released when nothing went `:187-192`); the claim
  `club_reminder_wave_claim` `315_…sql:650-675` (advisory lock, 60 s), its table `:202-212`; words
  `lib/club-money-words.ts` (`UNREACHABLE_WORD` `:285-290`, the email `:263-283`); `sendEmail` `lib/email.ts:52`
  (`reply_to` `:68`), `allocationReminderHtml` `:1366`.
- **Notices:** a new kind = `NotificationEventType` `lib/types.ts:3254` (TypeScript only, no database CHECK) +
  `lib/notification-labels.ts` (labels `:10`, descriptions `:57`, push default `:180`, category `:259`) +
  `lib/notification-view.ts:15` icons + the guard `tests/unit/club-stage2-server-guard.test.ts:296-300`; sent by
  `notify()` `lib/notify.ts:119`. `tellClubTeamStaff` `lib/club-season-notify.ts:15`; `tellTeamMoneyPeople`
  `lib/club-money-notify.ts:99`; `canViewSchedule` `lib/coach-capabilities.ts:656`; `loadHeadCoaches`
  `lib/club-team-board.ts:155`.
- **Guards to copy:** `tests/unit/dues-definition-guard.test.ts`, `tests/unit/club-money-one-definition-guard.test.ts`
  (`READS_THE_MODULE` `:24`), `scripts/check-club-money-arithmetic.mjs` (`npm run check:club-money-arithmetic`).
- **The fixture** `scripts/seed-club-fixture.mjs` (10a's `--club-permits` flag seeds Lakeshore Dome and Winter dome
  2026–27; the Senior and Junior groups are the fixture's: Senior 15U AAA, 15U AA, 16U AA, 14U AA; Junior 13U AAA, 12U AA,
  11U AA, 9U AA).

## Part 0 · Record the rulings where the product reads them (its own commit, first)

- **`memory/design_decisions.md`**, newest first, and its line in `memory/MEMORY.md` in the same change:
  1. **The club hands out its time in schedules** (Asks 5, 12, 13): the tournament generator's frame and look, its own
     engine; the grid is facilities down × a week across with every open slot (a one-weekday schedule reads its dates
     across, R12); a drop asks which weeks; every move can be undone; a slot moved by hand locks itself.
  2. **A club slot is the club's booking on the team's schedule** (Stage 11 Ask 1, Asks 16, 17): *"From {schedule} · the
     club’s schedule"*, *"Only the club can move or remove this practice."*; the coach keeps arrival, notes, attendance and
     the lineup, and can hand it back.
  3. **A sent schedule's edits wait for Send the changes** (Ask 14); a review round never blocks (Ask 24).
  4. **Time is shared like money** (Ask 18): New allocation's form table for time; a group's figure spreads over its
     teams; prime time shared the same way; shares hold every week.
  5. **One club send** (Ask 9): one window and one log shape for every club send (the reminders, the schedule, Stage 7's
     message every family).
- **`docs/agents/design/TABLE_AND_LIST_STANDARD.md` §11:** R3's words ("fields down, time across") trued to what Ask 12
  ruled, and **R12** (a one-weekday schedule reads its dates across) added — `/design` reviews the wording.
- **The plan's §6:** precondition 4's two answers.

## What to build

### A1. The data (one migration; take the number at the moment you write it)

- **`club_schedules`**: org, name, state (`draft` · `in_review` · `final`), the settings (one jsonb: slot length,
  changeover, teams at once, the split and its figures, prime time and how it is shared, every rule — versioned, so a
  regenerate reads what it was made with), *started from* (a permit, last year's schedule, or nothing), the review's
  reply-by date, sent at / by, **changed since sent**, created/updated by and at.
- **The time:** the schedule becomes the second owner of 10a's blocks (the block table gains the schedule and a one-owner
  CHECK); dates off likewise. **Never a second block model** (the one-model guard).
- **`club_schedule_slots`**: the schedule, the block, the facility, start and end (instants), **its teams** (a child
  table, so "teams at once" is rows, not an array the pair rule can't read), locked, moved by hand, handed back at / by.
- **The bill held in the schedule** (Ask 23): the budget line, the cost (all of the permit's, or a part), the split (by
  the time each team got), the payment plan (One · Monthly · Every two months · Dates I choose, with its first date), and,
  after Finalize, the allocation it became. No allocation row exists before Finalize.
- **`club_schedule_replies`** (Ask 24): schedule, team, answer (`looks_good` · `ask_for_change`), words, by whom, when.
- **`club_schedule_sends`** (the log): schedule, when, by, kind (`review` · `final` · `changes`), people and teams told,
  the bookings contact told or not.
- **`rep_team_events.club_schedule_slot_id`**: the source link, a partial unique index per season (as `207_…`); whether
  it is a foreign key follows the mirror's reasoning (`:20-26`: a slot's deletion must not take a worked-on practice with
  it) — say which in the dictionary.
- **`rep_allocation_splits.split_method`** gains `time` (By the time each team got; `split_value` = the team's priced
  hours) — widen the CHECK; the dictionary's stale "sessions entered manually" line is trued in the same change.
- **The feature key** (precondition 5). Dictionary + both snapshots (`npm run refresh:snapshots`), `check:dictionary`,
  `MANUAL_PROD_STEPS.json` (`pending`). RLS server-only (`318_…:116-118`'s shape); every read through a route that checks
  the role (owner and admin; a league admin is 11b's; a head coach reads only their own team's slots, bill and replies).

### A2. The engine — its own module, one-sided, unit-tested by the drawings' numbers

- **Slots from the time:** each block's days and hours over its dates, less dates off (the club's and the permit's), cut
  by slot length and changeover, per facility, × teams at once. Held slots (a tryout day already on the books, a booking
  in the pool) are left out and named.
- **Shares** (Ask 18): *Evenly* · *By percentage* · *A set number a week*; a group's figure spread with
  `spreadGroupFigure` (largest remainder, exact to the hundredth), any team retyped; under 100% leaves slots open, over
  100% is refused with its reason. **Prime time** (which hours count) shared the same way as the slots by default, or
  evenly by team. **The shares hold every week.**
- **Rules:** earliest and latest start by age group; at most N a week per team; never on a team's game day (each team's
  whole schedule, away games on typed places included); never over a booking already on the books (the pool); keep each
  team's nights or rotate prime time weekly; no back-to-back days; **teams' days off** (a date, or every week; Ask 20);
  **fields by group** (facilities kept for a group or a team; Ask 22). A rule that stops a share being met is reported,
  never silently broken (a weekly cap of 3 holds Senior to about 41%).
- **Drafts:** ranked, three at a time ("Three more drafts"), each with a score and the measures drawn (every team gets its
  share; prime time each; the same nights every week or rotated; clear of club bookings; what the held slots cost).
  **Locked slots and slots moved by hand are kept** through a regenerate (Ask 19).
- **Where it runs:** a pure module, as the tournament's engine is; a route hands it its inputs (the time, the teams with
  their running seasons, each team's schedule in the window, the pool) and **the save re-validates on the server** (the
  schedule's own rule — the same team twice at once — is refused; everything else warns).
- **Its unit tests are the drawings:**
  - *The lanes* (drawing data, not seeded): Lanes 1–2, Mon–Thu 6:00–9:00 p.m. + Sat 8:00–11:00 a.m., Jan 4 – Mar 28,
    2027, Feb 15 off, 60-minute slots = **354** (30 a week); 13U AAA's tryout holds Sat Jan 9 Lane 1 9:00–11:00 (2); 8
    teams × 3 a week = **288**; **64** open; prime weeknights 6:00–8:00 p.m., **23–24 each**.
  - *By percentage* 60 / 40: 352 slots → Senior **211** (53/53/53/52), Junior **141** (36/35/35/35); prime **113 · 75**.
  - *The dome* (seeded by 10a): Fields 1–4 full + 5–6 half, Sundays 8:00–11:00 a.m., Oct 4, 2026 – Mar 28, 2027, Dec 27
    off, 90 minutes = **12 a Sunday, 300**; Fields 5–6 only for Junior; Senior 1 full field a week (**25** each), Junior 1
    full + 1 half (**50** each).
  - The rules one by one (a team's day off on the Sunday before Christmas; an away game; a 13U latest start), a locked
    slot kept, a hand move kept.

### A3. The bill (Ask 23) — the arithmetic, then one allocation at Finalize

- **By the time each team got:** each slot × its field's hourly price from the permit (10a's helper), summed per team; a
  part of the cost scales every team alike (largest remainder to the cent). **Payments that follow the time:** each
  payment is that team's slots in its months. **The dome's check, a unit test:** $27,000.00 → Senior **$2,700.00**, Junior
  **$4,050.00** (4 × 2,700 + 4 × 4,050 = 27,000); every two months from Oct 1 → 9 / 8 / 8 Sundays → **$972.00 / $864.00 /
  $864.00** and **$1,458.00 / $1,296.00 / $1,296.00**. The closing row says whether it matches the permit's cost.
- **At Finalize** it becomes **one allocation** through `club_allocation_create` (split `time`, each team's own
  installments with its dates and amounts; the bill-level schedule `billSplits` demands carries the plan's name), in the
  same step as the rows — both happen or neither does. Every refusal it can return (`season_closed`, `year_closed`,
  `over_line`) is checked **before** Finalize is offered and said in words (Ask 23b: a team still on last season gets its
  bill there — finalize once the teams have started their winter season).
- **The filing** per precondition 4A. **A change after Finalize** per precondition 4B.

### A4. Writing the bookings — at Finalize, once; at Send the changes, the changes

- **Finalize** writes one practice row per slot date per team, in each team's running season, carrying
  `club_schedule_slot_id`, the club venue and facility links (6a's columns) and the schedule's name as its source — **in
  one transaction with the allocation**. Never on read.
- **The server refuses a coach's write** to a club slot's time, place or name (PATCH 409 and DELETE 409, the mirror's
  shape, with the drawn words); the coach's own fields (arrival, notes, uniform, links, tags, attendance, lineup, plan)
  stay theirs.
- **Send the changes** applies the held edits: a moved slot updates its rows in place; a removed one is deleted if the
  coach did nothing on it, cancelled if they did (`decideOrphanFate`'s rule); a new one inserts. Until then the teams keep
  what they were sent, and the schedule says *Changed since sent* (Ask 14).
- **Hand back** (Ask 17): the coach's route (this practice · this & future · all), the coach's own act, landing at once —
  the slot reads *Open · handed back by {team}*, the rows go as above, the builders get a notice; reassigning it is a
  change to send.
- **The clash rule:** rows from one club slot never clash with each other (P11-04a), with a test; the club calendar's
  reader can tell a shared slot is one booking with its teams (part B draws it); the 6a writers guard lists the Finalize,
  Send-the-changes and hand-back writers.
- **The season roll** carries a team's upcoming club-slot rows into the new season (Ask 15; lesson 5), with a test.

### A5. Sending (Asks 7, 9, 24) — the reminders' pattern

- **Send for review** (the default when a bill rides with it) and **Final now**; **Send the changes** after. Each has a GET
  preview (per team: its head coaches and staff with schedule access, its slots as a pattern, its bill; unreachable teams
  with the reminders' reasons; the venue's bookings contact) and a POST of the confirmed rows that the server recomputes,
  a database claim against a double send (the `club_reminder_wave_claim` pattern), reply-to the sender, the sender never
  a recipient, the send log row.
- **What a coach receives:** one email per team (colleague mail): the slots as a pattern ("Sundays 8:00–9:30 a.m. · Field
  2, Oct 4 – Mar 28, not Dec 27"), the bill and its payments when one rides with it, the reply-by date in a review, a link
  to the team's Schedule (or its review card), how to hand one back; and a **Your club** notice. New notice kinds: the
  review, the final schedule, the changes, a bill arrived — and, for builders, a reply and a hand-back.
- **The bookings contact** receives the whole schedule by facility in the email's body (no attachment, P11-08), when it is
  final and when its changes are sent, if ticked.
- **Replies** (Ask 24): *Looks good* / *Ask for a change* (with words) is a POST any head coach of the team may make; the
  latest answer per team stands; Finalize is never held up by a team that hasn't answered.
- Families are never sent anything by this part (the team's schedule — and the feed, once 6d lands — carries their slots).
- **Words:** the email and notice sentences are drafts — `/marketing` words them in part B, before the walks.

### A6. The routes, the fixture, the gates

- **Routes** for everything above (the schedule's create / read / update / delete, generate's inputs, save, lock, the
  bill, replies, the three sends and their previews, Finalize, hand-back, the send log), each checking the key, the role
  and the org; the hidden-row answer for an org with nothing to schedule.
- **No fixture schedule** — part B's walk builds the dome schedule by hand from 10a's permit (that is the walk). If a
  unit or route test needs data, build it in the test.
- **Gates:** the engine's drawings, the bill's arithmetic, the shared-slot clash case, the roll's carry, every refusal,
  the claim; **the one-model guard** (no second slot or block table); a **writers guard** for every route that writes a
  club slot's rows; `check:club-money-arithmetic` (or its pattern) over a finalized bill: the allocation's total = Σ splits
  = Σ installments = the schedule's bill. `npm run verify:changed`, `npm run typecheck` (after `npx next typegen`),
  `check:dictionary`, `check:spelling`.
- Then `/simplify`, and `/review` at the **high-risk** tier (a migration, money creation, writes onto every team's
  schedule, emails).

## Hand-off

- An owner-voice summary (what now works underneath; nothing visible yet), departures, anything found and not fixed.
- The plan record (`CLUB_PERMITS_AND_SCHEDULER_PLAN.md`: an **"11a part A BUILT"** block and §7), memory
  `project_club_stage11_scheduler`, the TODO line. The hub changes only if precondition 4 was ruled (its two rows).
- **A note to part B** written into `CLUB_SCHEDULER_B_BUILD_PROMPT.md`'s preconditions as item 2a: the route names and
  shapes, the engine's module and its inputs, the notice kinds, the words left for `/marketing`, and precondition 4's two
  answers.
- **Commit only when the owner says**, from a private index with this session's files and hunks only; Part 0 is its own
  commit. Export and typecheck the staged tree before committing; after it, `git reset -q -- <paths>` on the shared
  index. Then `CLUB_SCHEDULER_B_BUILD_PROMPT.md` in a fresh session.
