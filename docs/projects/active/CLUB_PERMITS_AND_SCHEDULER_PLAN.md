# Club permits and the club scheduler — Implementation Plan (Club Tier Stages 10 + 11)

> **⚖ RATIFIED 2026-10-11 — all twenty-seven asks as recommended** (owner: *"looks great, go ahead and write the build
> prompt based on your recommendations"*; hub v86, every "Stages 10 + 11" Decisions row Accepted). Consequences: Stage 11
> Ask 1 (2026-10-08) is amended by Ask 24 (an optional review round that never blocks); Ask 8b's split by hours is in the
> first cut through Ask 23; **Ask 4 (permits on League Plus and both Club bands) is a packaging change to a Decided
> entry** (2026-09-25: Club inclusion) and must be logged by `/strategy` (`BUSINESS_DECISIONS.md` + the Facts doc) before
> its gate is built; Ask 26's two open gaps are answered as recommended at ratification (print setup — landscape, fit to
> width — and a text page footer on the new workbooks; the FieldLogicHQ mark stays the last row). **Build prompts:**
> `CLUB_PERMITS_BUILD_PROMPT.md` (10a) → `CLUB_SCHEDULER_A_BUILD_PROMPT.md` (11a part A, the server) →
> `CLUB_SCHEDULER_B_BUILD_PROMPT.md` (11a part B, the screens) → 11b (house league's half) with Stage 9. **Stage 6d**
> (calendar feeds) is drawn and built on its own (`CLUB_TIER_STAGE6D_MOCKUP_PROMPT.md`): **owner 2026-10-11, the scheduler
> waits for permits only** — the feed reads the scheduler's practices whenever it lands, never the other way round.
>
> **🔨 10a BUILT 2026-10-11 (uncommitted at writing; the owner commits) — permits, to hub v87/88.** Mig 322 (`org_permits`,
> `org_time_blocks` owned by a permit, `org_time_block_facilities`, `org_permit_facility_shares`, `org_time_dates_off`,
> `org_venues.bookings_email`, the private `org-permit-documents` bucket, `org_permit_save`) applied to DEV, ⚠ prod at the
> promote (`MANUAL_PROD_STEPS.json`, order-critical). The rule `lib/permit-time.ts` (`permitAnswer`, `heldTime`,
> `fieldPrices`, `permitUse`), the words `lib/permit-words.ts`, the reads `lib/permit-lookup.ts` / `lib/permit-server.ts`,
> the form `lib/permit-form.ts`, the use workbook `lib/permit-use-workbook.ts`; the routes `/api/admin/org/permits`
> (+ `/document`); the Venue library's Venues · Permits switch, a permit's window, Add permit, Renew, Delete, the venue
> window's Permits section and Bookings contact; the quiet line on every check and Where form (coach event form, tryout
> day, house-league game/practice/series + the generator's count, tournament game + timeline move, the club calendar's
> read window) and in every writer's reply (`permits`, its own field — never a third `ClashKind`); the budget line's
> "Pays for"; the house-format workbooks (`XlsxPrint`: landscape, fit to width, page footer) and the club's Excel reports
> now wear the club's logo; fixture `--club-permits` (also in the full build). Gates: unit suite 6,705 ✓, typecheck,
> lint, verify:changed for this diff ✓; `/simplify` and `/review` (high-risk, five lenses) run — 1 High + 14 fixed, see
> §7 "10a as built". **Owed:** `check:layout` both themes and a `/design` pass at 1440/390 (both need captures — the
> owner's OK), the dev-server restart (new files), walks **§296** on the QA ledger, the commit.
> **Departures from the drawings** (each said in the code's header): (1) a permit's MONEY (cost, an hour held, the field
> prices' dollars, the budget line) reads only to those who hold the club's Accounting — the drawing showed it to every
> reader (owner, 10a build: "time to all, money to accounting"); such a saver types the issuer's name (payees are
> Accounting's) and keeps the stored money on a save; (2) the fiscal year is a RULE (`fiscalYearOf(starts_on)`), never
> a stored link (mig 318 re-spans year rows); (3) "Hand out this time in a schedule ›" is 11a's — absent, never a dead
> door; (4) a block's own dates are stored but not offered (no drawing shows them; a save clears them — 11a note);
> (5) a permit carrying money in a closed year can't be DELETED either (/review — the ruling's "money is locked" read
> through to delete); (6) the venue window lists the permits that still hold time there (ended ones live on the Permits
> view by year). **Owner's addition (build session, recorded as direction, not packaging):** coaches will later enter
> their own team permits (supplemental gym time, exhibitions) with the club seeing them — plan §6 **Ask 28**, open;
> `held_for = 'team'` is informational today, NOT that holder.
> **⚖ The /review's three owner calls — RULED 2026-10-11 (owner), nothing changes:** (a) the issuer's DOCUMENT opens for
> everyone who reads permits ("that is fine") — it is not money; (b) a block need not run to midnight ("no need for
> midnight") — the form's clock stops at 11:59 p.m.; (c) "Used" stays booked ÷ the whole term ("used is fine").
>
> **Status (before ratification): PROPOSED 2026-10-10. Drawn, nothing built.** Written by the joint Stage 10 + 11 mockup session
> (`CLUB_TIER_STAGE10_11_MOCKUP_PROMPT.md`). The drawings are on the club hub
> (https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stages 10 + 11**, screens `s1011-*`); the asks are
> rows on its Decisions tab, **all OPEN** (twenty-seven: Asks 18–20 added by the owner 2026-10-11 — the time shared by percentage, reviewing a draft before keeping it, a team’s days off — and Asks 21–27 from the owner’s dome flow, walked the same day (§6a), and the export instruction (§6b)). PM brief: `CLUB_PERMITS_AND_SCHEDULER_PM_BRIEF.md`. Parent plan:
> `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 10 and Stage 11, which now point here.
>
> **`/design` review 2026-10-10 (hub v82, the owner's standing rule: every mockup goes through /design before the
> hand-off):** nine drawing changes against the written rules, listed on the hub's Formatting check screen — phone lists
> as one frame with hairlined rows (P1, 2026-09-29), no colour rail on list rows and one lead mark (§3.10.7), centred table
> cells (§3.4), bare facts in a read row (2026-10-08), one foot door in the calendar's read window (C12), the coach's
> "Only the club can move or remove this practice." at the body's end, Cancel beside Generate drafts (2026-10-09), and
> one empty-day mark (C7). Found, not this stage's: the tournament generator's step 1 has no Cancel. Proposals until
> ruled; nothing written to the design log.
>
> **This plan is the pair's own record from here on.** The parent plan keeps one pointer per stage. Rulings land in §6
> (each ask) as they happen, and the parent's two stage sections are trued in the same unit of work.

## 0. Goal

A club records the time it holds — a town's diamond permit, a dome's winter contract — once, and hands that time out to
its teams and programs with a scheduler: a few parameters in, ranked drafts out, adjusted by hand, finalized, sent to the
people who need it, and kept by name to reopen next year. Every program reads the result: a rep team finds its slots on
its own schedule, the club calendar lists them, the clash check knows them, families see their team's slots where they
already look.

Both stages hold the Club release (owner, 2026-09-25 for permits; 2026-10-08 for the scheduler; 2026-10-10, *"the club
release will only happen when all of this work is either complete or deemed cancelled by me"*). They are drawn together
because a permit and a schedule share **one model of the club's time** (Stage 11 Ask 2, ruled 2026-10-08), and built as
two (permits first).

## 1. Scope, and what this plan does not hold

**In:** the permit record and where it lives; the clash check's second question; a permit's use; a permit's cost on the
club budget; the scheduler (the record, its settings, drafts, the grid, adjusting, summaries, export, finalize and send,
changes after sending); what a finalized slot becomes on a rep team's schedule, on house league's practices, on the club
calendar and in the clash check; what a head coach, a house-league admin and a family see.

**Not here (each has its own owner):**
- **Calendar feeds (Stage 6d).** A slot reaches a family through the team's feed; this plan says what the feed must
  carry (§5.8) and 6d designs it. (Owner 2026-10-11: the scheduler doesn't wait for 6d — the feed reads the
  scheduler's practices whenever it lands.)
- **House league's own redesign (Stage 9).** This plan draws only what the scheduler needs from house league (§5.7,
  Ask 6). Whether Stage 9 holds the release is the owner's open call.
- **"Message every family" (Stage 7).** Ask 9 names the one send pattern both use; Stage 7 draws its own door.
- **Prices, plans, gates.** Ask 4 is `/strategy`'s; the drawings tag the placement. Customer words are `/marketing`'s;
  every sentence drawn is a draft. The homepage's "field bookings" line returns with permits, through `/marketing`.
- **No code, help, gates, seeds or routes change in this session.**

## 2. Already ruled — drawn to, not re-asked

| Ruling | Source | What it fixes here |
|---|---|---|
| **One model of the club's time** — a block (venue, facility, days, hours, date range) a permit records and a schedule hands out; never two slot models | Stage 11 Ask 2, 2026-10-08 | §5.1 |
| **A finalized club slot on a team's schedule is the club's own booking, read-only to the coach**; the coach keeps arrival, notes, attendance, the lineup; the coach can hand a slot back, which frees it | Stage 11 Ask 1, 2026-10-08; D3 amended narrowly | §5.6 |
| **Who builds and finalizes:** owner and admin for any team or program; a league admin for house league's own teams; a head coach reads the schedule that includes their team, never edits it | Stage 11 Ask 3 | §5.3, §5.6 |
| **Time only** — practice, training and facility time; game pairing stays with house league's and the tournament's generators | Stage 11 Ask 4 | §5.3 |
| **The release waits for both stages** | Stage 11 Ask 5 (against the recommendation), 2026-10-08 | §7 |
| **League Plus and both Club bands carry the scheduler**, alike, never an upgrade lever | Stage 11 Ask 6; `BUSINESS_DECISIONS.md` 2026-10-08 | Ask 4 |
| **Warn, never block, across programs**; a program's own refusal stays its own | Stage 6, 2026-10-08 | §5.2, §5.4 |
| **The draft grid is not the club calendar's Week**; it takes "the Timeline's shape" and wears the calendar recipe | Stage 6c Ask 18, 2026-10-10 | §3.3, Ask 12 (what "the Timeline's shape" turns out to mean) |
| The calendar recipe C1–C13 and register R1–R11 | `TABLE_AND_LIST_STANDARD.md` §11, 2026-10-10 | every grid and list drawn |
| A record reads first and edits whole; edit autosaves, create asks; a change that tells families is held and asks once; a rare door ends the body; an export sits above what it exports; one Export, Excel first; a move can be taken back; a published change asks once | design log 2026-10-01 → 2026-10-10 | every window drawn |

**A record corrected (done in this session):** the parent plan's Stage 11 "Asks for the mockup session (all OPEN…)" list
predates its own RULED block, which settled Asks 1–6 on 2026-10-08. The parent now says so in place.

## 3. Evidence — read from the code, 2026-10-10 (dev at `43678430`)

Five read-only surveys (club time and the tournament mirror; house league and the feeds; the tournament generator as
built; sending and money; counts on both databases). Anchors are `path:line`.

### 3.1 What holds club time today
- **Nothing records time the club holds.** No table for a permit, block, slot, booking or club schedule (columns
  snapshot: 0 matches for permit / club_schedule / club_booking / venue_booking / time_block). Club time today is only
  the bookings themselves, across five tables: `rep_team_events`, `rep_tryout_sessions`, `league_games`,
  `league_practices`, and a tournament's `games` on a library-linked copy.
- **The venue book** (`org_venues`, `org_venue_facilities`, mig 094 + 319 + 321): a venue has name, address, notes,
  `is_active` (Archive); a facility has name, kind (`diamond|field|court|rink|gym|other`), order, notes. No sport on a
  facility, no facility archive, **no contact of any kind** (the venue holds no email; `org_payees` holds no email).
  Server-only writes since mig 321. Saving: owner, admin, league admin, or `create_tournaments` (`lib/venue-library.ts:25-29`).
  Plans: `league`, `club`, `club_large` (`hasOrgVenueLibrary`, `lib/plan-features.ts:150`).
- **The clash rule** (`lib/venue-clash.ts`): two findings, `booked_by` (same venue + same facility + overlap) and
  `busy_then` (same venue, a facility missing on either side). It never refuses. **The permit hook** (`:37-38`):
  "Stage 10 adds `outside_permit` … without changing a caller." ⚠ **That claim is optimistic**: `clashLine` filters only
  the two kinds (`venue-clash-words.ts:108-109`, a third would be dropped silently), the sort treats anything else as
  busy (`:250`), and the calendar's clash pairs and clashes-only count assume two kinds. And a booking against a permit is
  **not a pair** (`findClashPairs` is pair-shaped). See finding P11-04.
- **The lookup** (`lib/venue-clash-lookup.ts` `readClubPool`): club-venue bookings only (typed places and a team's own
  places are never in the pool); cancelled never; postponed league games never; **draft tournaments count** (ruled
  2026-10-08); mirrored tournament copies skipped; pages past 1,000; one check reaches 800 days.
- **The club calendar** (`lib/club-calendar.ts`, `app/[orgSlug]/admin/calendar/page.tsx`): one window ≤ 42 days; List ·
  Week · Month; one toolbar line; a read window with "Clashes with" / "Busy then" and a door to the booking's own
  schedule; "Nothing here writes (D3)". It already reads `rep_team_events` and `league_practices` directly — **a slot
  written as a real row in either table needs nothing new on the calendar or in the clash pool.**
- **The test club** (`scripts/seed-club-fixture.mjs --club-venues`, uat-rep-club): Lions Park (Diamonds 1–3), Kinsmen
  Park (A, B), Westfield School (none). Rep groups Senior (15U AAA, 15U AA, 16U AA, 14U AA; 18U AA archived) and Junior
  (13U AAA, 12U AA, 11U AA, 9U AA); two ungrouped (UAT Test Team, UAT Between Seasons). Bookings float with the seed day
  (from today's run: Tue Oct 20 and 27, Wed Oct 21, Thu Oct 22): 14U AA and 13U AAA overlap on Lions Park Diamond 2 (the
  seeded `booked_by`), 11U AA on Lions Park with no diamond (a `busy_then`), 11U AA and house league's Reds on Kinsmen
  Diamond B. Payee "Town of Milton"; a plan line "Diamond permits — city fields" under Facilities › Diamond Permits. **No
  dome, no indoor venue.** The drawings add one, tagged "drawn, not seeded".

### 3.2 The writers a finalized slot must reach
- **A rep team's schedule — the tournament mirror is the precedent** (`lib/rep-tournament-game-mirror.ts`,
  `lib/tournament-game-mirror.ts`):
  - The link is `rep_team_events.source_tournament_game_id` (not a foreign key; unique per season). Rows are
    `event_type:'tournament_game'`; the mirror never writes `org_venue_id`.
  - **It writes on READ, not on publish** (finding S6-06 still holds): the coach's events GET and the admin's team GET
    sync before reading, debounced 10 s per season. A copy of this would put a club slot on a team only when someone
    opens that schedule — and the club calendar, which reads the rows, would miss it until then (P11-05).
  - A moved game is overwritten in place; a removed game is deleted if the coach did nothing on it, cancelled if
    attendance, a lineup, tags, awards, expenses or coach fields exist.
  - **The server refuses, not just the screen**: PATCH 409 on any organizer-owned field ("This game comes from {name} …
    You can still set arrival time, uniform, field, notes, links and tags — and take attendance or build the lineup"),
    DELETE 409 ("Ask the organizer to remove it"). The coach's sheet reads "From **{name}** · organizer’s schedule" and
    "Only {name} can cancel or remove this game." (`ScheduleEventSheet.tsx:702-717, 1096`).
  - **No hand-back or decline exists** anywhere.
  - Every rep event belongs to **one season** (`program_year_id` NOT NULL). There is no club, permit or booking source
    column; the provenance columns are `source_tournament_game_id` and `source_basic_event_id`. Rep events can be
    cancelled, never postponed.
- **House league's practices** (`league_practices`; `house-league/.../schedule/page.tsx:636-769`):
  - Columns: team (required), season, division (informational, never checked against the team), `scheduled_at` /
    `ends_at`, one line of `location` ("Venue — Facility"), the two venue links, notes, status `scheduled|cancelled`,
    `recurrence_group_id`. **No source, no creator.**
  - **After a practice is made it can only be cancelled** (one / remaining / all); no edit, move, delete or un-cancel.
  - **Writes: owner and league admin only; a club admin is refused** (403 on every write, `practices/route.ts:65-66`).
  - **Families never see practices**: the public league pages read games only; no feed; no notice on create or cancel.
  - House-league team coaches have **no accounts** (`league_teams.coach_name` is free text).
  - The admin's Practices view lists one team at a time, "Week of …" groups (a Stage 9 finding already, 6c).
- **The club calendar and the clash check:** read the rows above directly (§3.1).
- **The team's feed:** the per-family feed exists (`/api/family/calendar/[token]`) but **drops cancelled events** and
  needs a verified guardian link, which the guardian switch keeps off — so effectively no family receives it; the
  team-wide feed's token still has no caller (D07); the coach has a download only. **Today a "From the club" practice
  could reach a family only through the team's public page** (visibility "Public link"), and only as a real row in the
  team's current season. 6d is where this changes.

### 3.3 The tournament generator as built (Tournament Stage 3, built 2026-10-09: `279f1e5d` … `35e6ec2b`)
- **The window** (`schedule/Generator.tsx`, words `lib/schedule-words.ts:168-272`): `KitDialog kind="form" wide`,
  "Round-robin generator", "{event} · step 1 of 2 · settings" → "step 2 of 2 · drafts for {division}".
  - Settings, one scroll: *What it pairs* (division, games per team, pair) · *When* (Day / From / Until rows, "Add a
    day", game length, turnover) · *Where* (venue + facility chips, All · None, a taken line) · *Rules* ("Aim for"
    presets; "More rules" folded). Foot: "{div} has N games." + lime **Generate drafts**.
  - Drafts: up to three cards in a 17rem column (label, a score "/100", measures), "Three more drafts", the chosen
    draft's games by day as the kit's row list, **one statement of what saving does**, foot "Back to settings" + lime
    "Save and replace N games" (asks once).
- **Nothing in it is shared yet** — its own header says so (`Generator.tsx:16`: "The frame is tagged for Club Stage
  11's scheduler (A40); nothing here is shared yet"). The "shared candidates" are a look, not code:
  - The engine (`lib/schedule-generator.ts`) assigns **two-sided matchups** to point slots of **one length**, ranked
    by per-game penalties (games a day, rest, back-to-backs, field moves). Slot building lives in the component.
  - ⚠ Its `isEdgeSlot` penalises slots **before noon or from 5 p.m.** (`:466-469`) — for weeknight practices that is
    backwards: evening is prime time.
  - The draft cards' measures, the health score and `draftStatement` are game measures.
- **The Timeline** (`ScheduleTimeline.tsx`): **facilities run ACROSS as 190 px columns and time runs DOWN** (~69 px an
  hour), **one day at a time**; a column exists only where a game stands that day; **an empty slot is never drawn**
  (free time is blank space). A drag shows a dashed preview green / amber / red, a red drop carries its reason and
  springs back, played games don't drag, every move ends in the 8-second notice with Undo (`NoticePill`,
  `RepKit.tsx:444` — already shared by every kit screen). The club booking's amber line arrives after the save.
- **⚠ So the words the ruling carries describe neither shape.** The 6c register's R3 and this session's prompt say "fields
  down, time across"; the built Timeline is fields across, time down, one day. The parent plan's item 3 says "facilities
  down, the hours in each day, an open slot on the page" — which is 6c's specimen 4 (facility rows, a day per column,
  each day's slots listed in clock order), the drawing the owner saw and ratified as a specimen. What the Timeline and
  specimen 4 truly share is the **question** (place time by facility and clock, with the empty time visible), and the
  **behaviour** (drag with a preview, a refusal with its reason, Undo). Finding P11-01, Ask 12.
- **Publish** (`PublishScheduleModal.tsx`): "Who sees them" sections, an "Email the teams" checkbox (a lock line on the
  free plan), a lime that counts what it publishes ("Publish U11"). "Your game moved" notices: a 10-minute quiet window,
  a move and its move-back inside it tell nobody (`lib/schedule-change-classify.ts`, `-notices.ts`).
- Gating: `auto_schedule` = Tournament Plus (League and Club pass by rank). **No practice or scheduler key exists.**

### 3.4 Sending
- **Nothing sends to the club's staff.** No door to every rep coach, every league admin or an outside contact. Narrow
  per-team notices exist (`tellClubTeamStaff`, `tellTeamMoneyPeople`).
- **The complete precedent is Stage 3a's reminders** (`/api/admin/accounting/reminders`, `RemindersWindow.tsx`): a GET
  preview (per team: recipients, lines, amount; `unreachable` with reasons — *has no head coach* / *has a head coach
  invitation nobody has accepted yet* / *has no one with money access but you*), a sample email ("See {name}'s email"),
  "Last sent {day} by {name}", a POST of the confirmed teams that the server recomputes, a database claim that refuses a
  second wave inside 60 s, reply-to the sender, the sender never a recipient. Log: `rep_allocation_reminder_waves`.
- **Who has schedule access on a team:** `canViewSchedule` over the staff membership's capabilities
  (`lib/coach-capabilities.ts:656`; every preset includes the schedule, a head coach can hide it). Head coaches:
  `coach_role='head_coach'` (several allowed); unanswered invitations via `loadHeadCoaches`.
- **Family email** goes through one choke point (`sendFamilyEmail`, `lib/family-email.ts:184-198`: suppression list,
  CASL footer, unsubscribe). **Staff email** goes as colleague mail (`sendEmail` with reply-to; the practice-plan email is
  the colleague precedent, which checks the demo org itself). Bounces aren't tracked anywhere.
- **No email carries an attachment; every PDF is made in the browser** (jsPDF). A schedule PDF exists for tournaments
  only; the coach's schedule, house league's and the club calendar owe one in the export catalog.
- **A coach notice fits the existing pattern**: a new event in the coach's "Your club" notification group
  (`AccountNotificationsClient.tsx:159-191`), linking to the team's Schedule. Today **a club change to a booking
  notifies no one** (a venue rename is copied onto upcoming bookings without a notice).
- The tournament's coach send caps the free plan at 100 recipients and 10 sends a day; its preview shows a count only.
  ⚠ Its send loop counts a failed `sendEmail` as sent (`communications/route.ts:316-331`) — found, not this stage's.

### 3.5 Money
- **The club budget** (`org_budget_lines`: fiscal year, category, item, description, total, notes; one line per word
  per fiscal year). **Entries carry a budget WORD, not a line** (mig 317 superseded J4-024); Budget vs. Actual matches by
  word. Allocate draws from a line (`rep_cost_allocations.source_budget_line_id`).
- **The words already exist:** platform category **Facilities** with Diamond Permits, Dome Time, Field Equipment,
  Lighting Fees, Indoor space, Cage or tunnel rental (migs 027, 241, 242; Diamond Permits and Dome Time tagged
  softball/baseball only). No "Field rental" word.
- **The fiscal year** (mig 318, `org_fiscal_years`): a ledger line files by its date, a plan line by its year, an
  allocation by its line's year; a closed year is locked.
- **Splits:** Evenly · By amount · By percentage · **By sessions** — and sessions are already weighted by each team's
  count (`lib/club-bill-split.ts:146-156`; ⚠ the dictionary still says "entered manually", stale). **"A dome rental split
  by the hours each team got" is the sessions split with hours as the weights** — new words and a prefill from a
  finalized schedule, not a new split.

### 3.6 Counts (read-only, `.probe/s1011/counts.mjs`, 2026-10-10)

| | Dev | Prod |
|---|---|---|
| Orgs on a plan with the Venue library (League Plus, Club, Club · Association) | 10 | 1 (the coach demo) |
| … of those with at least one venue | 1 (uat-rep-club: 3 venues, 5 facilities) | **0** (no venue rows at all) |
| Club budget lines under a permit or facility word | 5 of 18 ("Diamond permits — city fields" ×4, $29,000; "Diamond & facility permits" $11,200) | 0 of 0 |
| **Coach (team) budget lines under one** | Diamond permits 12 ($30,800); Dome time / winter dome block 6 ($24,000); Diamond rentals 2 ($6,000); others | **Dome time $10,000; Diamond rentals $6,000; Cage or tunnel $4,983.30; Diamond and dome $2,800; Diamond permits $1,600; Winter cage $1,400** |
| House-league seasons · practices | 8 · 6 (2 seasons have practices; uat-rep-club's Fall 2026: 4, one series, all on a club venue) | 0 · 0 |
| Rep events on a club venue | 9 of 279 (all uat-rep-club practices) | 0 of 133 |
| Rep events that mention a dome, cage, tunnel, gym, bullpen or indoor time | 0 | 0 |

**What the numbers say.** No customer holds a venue, a permit or a house league on production, so nothing migrates and
nothing breaks. **Facility time is real money on production today, and it sits in the TEAMS' budgets** — coaches budget
dome time and diamond rentals themselves — **and on no schedule**: nobody records indoor time as an event. The features
assume the club holds the time and hands it out. That is the owner's design for a club, and it is right for one; it
also means a team that rents its own dome time keeps doing what it does today (a practice on a typed place). Recorded,
not an ask.

### 3.7 Records this session corrects or flags
- Parent plan, Stage 11: "Asks … (all OPEN)" → ruled 2026-10-08 (corrected in place).
- Parent plan, Stage 10: its shape now lives here (a pointer added).
- **The 6c register's R3 and the prompt's "fields down, time across"** — the built Timeline is fields across, time down
  (P11-01). The standard's text is `/design`'s and Stage 8's to true when Ask 12 is ruled; this session doesn't edit it.
- The permit hook's "without changing a caller" (P11-04); the dictionary's "sessions entered manually" (stale); the
  dictionary's three stale house-league lines (the practice entitlement gate, game DELETE now a hard delete, the fixed
  server-timezone trap) — for the next dictionary pass, not this session's file.

## 4. Findings (P11-01 … P11-12)

| ID | Sev | What it is | Where it lands |
|---|---|---|---|
| **P11-01** | H | **"The Timeline's shape" names two different layouts.** The built Timeline is one day, facilities across, time down, no empty slot drawn; the ruling's words say "fields down, time across"; the drawing the owner saw (6c specimen 4) is facility rows × a week of days, each day's slots in clock order. A scheduler that copied the built Timeline could not show a week or an open slot. | Ask 12 |
| **P11-02** | H | **Nothing in the tournament generator is shared yet** (its own header says so). Its engine pairs two-sided games, and its edge-slot rule penalises evenings — prime time for practices. "Wear the shared candidates as built" can only mean the frame and the look. | Ask 5 |
| **P11-03** | M | **"From the club" already means money.** The coach's Money › Club tab labels a request the club pays as "From the club". The same words on a practice would give one phrase two meanings in one portal. | Ask 16 |
| **P11-04** | H | **The clash rule would misread the club's own slots.** (a) Two teams sharing one lane in one slot ("teams at once") are two rows on one facility at one time — `booked_by` would flag the club's own plan as a clash. (b) "Not inside a permit" is not a pair, so it cannot ride the pair machinery the hook assumed. (c) The pool holds club-venue bookings only, so "never on a team's game day" cannot read it: an away game is on a typed place. | §5.2, §5.4, Not drawn |
| **P11-05** | H | **The mirror writes on read.** Copied, a club slot would reach a team (and the club calendar, the clash check, the team's feed) only when someone opens that team's schedule. A send must write the rows, once, when it is sent. | §5.4, Not drawn |
| **P11-06** | H | **A team event belongs to one season.** A January dome slot lands in the team's working season at the send; a team with no running season can't take one (New allocation already refuses those); a team that starts its next season mid-schedule would strand its upcoming slots in the closed season (which becomes one page). | Ask 15 |
| **P11-07** | H | **House league cannot hold a club slot today**: no source or creator column, cancel-only, owner and league admin only (a club admin is refused), families never see a practice. Ask 6's "reads as the club's own booking" needs a source link, a writer the schedule runs, and the role answer. | Ask 6, Ask 10 |
| **P11-08** | M | **Nothing sends to staff, there is no facility contact anywhere, and no email carries an attachment** (every PDF is drawn in the browser). The send needs a contact field and either an attachment pipeline or the schedule in the email's body. | Ask 7 |
| **P11-09** | M | **Edits to a sent schedule have no honest home in the plan's shape.** If a move reached the teams at once, a rearrangement in progress (swap two, then move a third) would land on families' calendars half done, before anyone was told. | Ask 14 |
| **P11-10** | L | **The split by hours already exists as By sessions** (weighted by count). A finalized schedule can prefill hours as the weights — words and a prefill, not a new split. | Ask 8 |
| **P11-11** | L | **Facility time on production is the teams' money today** (coach budgets: dome time $10,000, diamond rentals $6,000, cage $4,983) and is on no schedule. | §3.6, recorded |
| **P11-12** | L | **A move in a weekly schedule has no "which weeks" answer.** The grid shows a real week; a drag must say whether it moves this week's slot or every week's. The coach's repeating-event pencil already asks this (design log 2026-10-09). | Ask 13 |

## 5. The proposed shape (drawn on the hub; every word a draft for `/marketing`)

### 5.1 One model of the club's time — the block
A **block** is one weekly stretch of time at one place: a venue, a facility (or every facility there), the days of the
week, a start and an end, and a date range; dates off are held beside it. **A permit is a set of blocks** the club holds,
with its issuer, reference, cost and document. **A schedule's time is a set of blocks** too — picked from a permit in
one choice, or entered by hand where the club holds no permit (its own field, a school gym it books by phone). A schedule
cuts its blocks into **slots** (slot length, changeover, teams at once) and gives each slot to a team. There is never a
second model of the club's time.

### 5.2 Permits (Stage 10)
**Where they live (Ask 1).** In the Venue library, which becomes **the club's venues and the time it holds there**:
- The page's toolbar gains a two-way switch **Venues · Permits** (the olive switch: it chooses what is read). Permits is
  a table at 1200: *Permit* (its name; issuer · reference under it) · *Where* · *Dates* · *A week* (hours held a week) ·
  *Used* (a percentage, "51 of 80 h" under it) · *Cost* · chevron; band rows *In use now* · *Starts later* · *Ended*;
  the fiscal-year pill scopes it (the year a permit starts in, Ask 2). Export (Excel first) above the table; **Add
  permit** the one lime, for savers.
- **A permit can cover several venues** (a town's season allocation often lists several parks under one number), so it
  is the club's record, not a venue's child. Each venue's window gains a **Permits** section listing the permits that
  hold time there, each row opening that permit (the window turns into the permit's, the 3d door rule).
- Not under Accounting, which cites a permit's cost and never owns it.

**The permit's window** (the kit's form window, reads first, the head's pencil edits the whole record, autosaved):
- Eyebrow "Permit · 2026–27" (its fiscal year); title its name ("Fall diamonds 2026").
- **The permit:** Issuer (a payee from the club's payees — "Town of Milton"), Reference ("P-2026-1187"), For (the club ·
  rep teams · house league · a team), Dates ("Sep 8 – Oct 29, 2026"), Document (the issuer's PDF, its name and size; a
  new upload).
- **The time:** its blocks as rows — "Lions Park · Diamond 2 · Tue, Thu · 5:30–9:00 p.m."; dates off; "80 h held".
- **Cost:** the joined band (Cost $3,200.00 · An hour held $40.00 · On the budget *Diamond permits · 2026–27* →).
- **Use** (the number a facilities person takes to the municipality): the joined band (Held 80 h · Booked 51.5 h ·
  Unused 28.5 h · Outside it 1.5 h), then a row per block (held, booked, unused, who booked it); **Export the use** above
  the rows (Excel); a door for builders, "Hand out this time in a schedule ›".
- The body ends with **Renew for next year** (a copy a year on: the same blocks and issuer, dates +1 year, no reference,
  document or cost — `RecordAction`) and **Delete this permit** (red, only when no schedule hands it out).
- **Add permit** (create asks): Name, Issuer, Reference, For, Dates, the blocks (rows with "+ Add a block"), Dates off,
  Cost, Budget line, Document; foot Cancel · **Add permit**.

**The clash check's second question (Ask 3).** A booking at a venue where the club holds a permit for those dates, but
outside every block of it, gets **one quiet line** under the Venue field (never amber, never a refusal): *"Not inside the
club’s permit for Diamond 2. It covers Tue and Thu, 5:30–9:00 p.m., until Oct 29."* It appears on every form that asks
where (the coach's Add Event, house league's game and practice, the tryout day, the tournament's game window) — where
the booking can still change. It is **not** on the club calendar's rows (they stay as quiet as 6c drew them); the read
window says it once, and the permit's Use counts it. A club with no permits, and a venue the club holds no permit at,
sees nothing new. Built as its own answer beside the pair rule, not a third clash kind (P11-04b).

**Money (Ask 8a).** A permit names its budget line (the line's fiscal year + word, e.g. *Diamond permits · 2026–27*), and
that line's window gains a **Permits** row listing what it pays for (name, dates, cost). Allocating the cost to teams is
today's **Allocate** from the line. Paying the town is an ordinary Ledger expense filed under the same word.

### 5.3 The scheduler (Stage 11) — where it lives and its list
- **Schedules** is a rail row directly under **Calendar**, shown to those who build (owner, admin, a league admin); the
  More sheet carries it too. Calendar reads what is booked; Schedules is where the club hands its time out — two jobs,
  two rows (the 2026-09-30 rule: separate jobs list in the rail).
- **The Schedules list** (1200 table): *Schedule* (name; where under it, "Lakeshore Dome · Lanes 1–2") · *Dates* ·
  *Teams* · *Slots* ("288 handed out · 64 open") · *Last sent* ("Dec 14 by Jordan Reyes" / "Not sent") · chevron; one
  state chip only where it needs saying (**Draft**, amber **Changed since sent**; a sent schedule says nothing more);
  band rows *In use now* · *Coming up* · *Ended*. **New schedule** the one lime.

### 5.4 The scheduler — settings, drafts, the grid
**New schedule** opens the tournament generator's frame (the kit's wide form window, two steps), worn as a look (Ask 5):
*"New schedule · step 1 of 2 · settings"*. Three sections (Who and How much became one table on 2026-10-11, Ask 18), the rare ones folded:
1. **The time.** Name ("Winter dome 2026–27") · **Start from** (Nothing · a permit — "Lakeshore Dome · Winter 2027" fills
   the venue, facilities, dates, hours and dates off in one pick · last year's schedule, its settings a year on) · Venue
   and facilities (the library's venue search, then facility chips with All · None) · From / To · Days and hours (rows:
   *days* · *from* · *until*, "+ Add hours") · Slot length · Changeover ("Between slots on one facility") · Teams at once
   ("Teams sharing one facility in one slot", 1 by default) · Dates off (chips). A summary line: "12 weeks · 2 lanes ·
   30 slots a week · 354 slots".
2. **Who, and how much** (one card — ⚖ redrawn 2026-10-11 at the owner's ask, Ask 18): **New allocation's form table
   (3c Ask 11) for time.** *Split the time* · **Evenly** · **By percentage** · **A set number a week** (one dropdown, as
   New allocation's Split). The teams sit under their group headings (the club's own groups from Rep Teams, in its
   order; "Not in a group" last); a heading's tick ticks its teams (tri-state); each team shows the season it is running;
   teams with no season running sit in one disclosure line. Under By percentage or A set number a week, **a group row
   takes a figure that spreads over its ticked teams** (60% over four teams = 15% each, exact to the hundredth by the
   largest remainder; "3 each") and **any team can be retyped**, the heading then showing the group's sum; a Slots column
   says what each share comes to in whole slots. The **closing row** says what the ticked teams take and what is left
   open ("8 teams · 100% · 352 · Nothing left open"); **under 100% leaves slots open, over 100% holds Generate drafts**
   with the reason beside the button (the money window's refusal in the foot). Two things money never had: **Prime
   time** — *Shared the same way* (recommended: a 60% group gets 60% of the prime-time slots too, so a share can't be met
   with late nights) or *Shared evenly by team*; and **the shares hold every week** (recommended, so a group can't take
   its share early; said in one line, not a control). A rule that stops a share being met (a weekly cap of 3 would hold
   Senior to about 41%) shows in amber on the draft card and in Fair shares. House league's divisions join as groups with
   Stage 9 (Ask 6). The foot counts what Generate will hand out ("288 slots for 8 teams.").
3. **Rules** (folded, "Rules · 4 on"): earliest and latest start by age group ("9U AA, 11U AA · finish by 8:00 p.m."),
   at most N a week per team, **never on a team's game day** (read from each team's whole schedule — away games
   included, P11-04c), **never over a booking already on the books** (6a's pool), **prime time** (which hours count:
   "weeknights 6:00–8:00 p.m.") with *keep each team’s nights* or *rotate prime time weekly*, no back-to-back days, and
   ⚖ **Teams’ days off** (added 2026-10-11, Ask 20): a team and a date ("13U AAA · Sat, Feb 6 · away at a tournament")
   or every week ("11U AA · Every Tuesday"); the club-wide Dates off stay in The time.
Foot: "288 slots for 8 teams." (what Generate hands out) · Cancel · lime **Generate drafts**.

**Step 2, drafts** — the tournament's layout: three ranked cards (label, a score, the measures that matter here: *every
team gets its share*, *prime time 23–24 each*, *the same nights every week* or *rotated*, *clear of club bookings* /
*leaves out the 2 slots 13U AAA’s tryout day holds*), "Three more drafts". ⚖ **Redrawn 2026-10-11 (owner, Ask 19):** the
chosen draft reads **By team · By day** (the olive switch) — By team (team · slots · prime time · nights) for fairness,
**By day** for the full review: a band per day and every slot of every day as one compact row (time · team · lane;
open slots say Open), the whole schedule scrolling in the window — with **Export** above it (Excel, PDF; "Best overall ·
a draft · 354 slots"; no Calendar file for a draft). Then **one statement**: *"Saving keeps Winter dome 2026–27 as a
draft. Nothing reaches a team until you send it. On its page you can read every week, export it, change these settings
and adjust it by hand."* Foot: Back to settings · lime **Save as a draft** (was "Save the draft", which read as a
commitment; /marketing). The draft opens on its page. A grid inside the window is not drawn: the 1200 grid doesn't fit
an 800 window, and a smaller second grid would be a fourth calendar shape.

**The schedule's page** (1200; back arrow to Schedules; title its name; the eyebrow says where and when; **Draft** chip):
- **The toolbar line (C4):** the view switch **Grid · By team · By group** · the week ("‹ Jan 4 – 10, 2027 ›") ·
  Facility · Team pills · the amber clash pill (only when there is one) · "Times in Eastern time." · Tools (Regenerate the
  unlocked slots… · Lock this week · Clear this week… · Settings… · Send log) · Export · the lime (**Send** on a draft,
  **Send the changes** once changed, absent when nothing waits).
- **The grid (Ask 12): facilities down, the week across, each day's slots in clock order** — 6c specimen 4's layout. A
  slot chip: the time range on its first line (R9), the team on its second, the team's colour as its edge (R4); an
  **Open** slot dashed; a locked slot's padlock; 6a's amber flag on a clash; a day with no time held reads "—"; today's
  column "Today · …" when the week holds it (C7). Monday first (C2), "Jan 4 – 10, 2027" (C8).
- **Beside it, the fairness panel** (a 300 px card): the joined band for the whole schedule (*Handed out 288 of 354* ·
  *Open 64* · *Short 0* · *Clashes 0*), then a row per team (swatch · team · this week · the schedule · prime time),
  short teams and clashes in amber words with the date. It updates as slots move.
- **Adjusting (the Timeline's behaviour, not its axes):** drag a team onto an open slot (move) or onto another team's slot
  (swap); the dashed preview reads green / amber (a rule broken, a club booking there — warns, drops) and a refusal only
  for the schedule's own overlap (the same team twice at once); **a drop asks which weeks** (Ask 13: *This week only* ·
  *This & later weeks* · *Every week*); every move ends in the 8-second notice with **Undo**. A slot opens a small window
  (when, where, team; *Change team ▾*, *Lock*, *Clear*). Locked slots stay put through **Regenerate the unlocked slots**.
- **Back to the settings (Ask 19):** Tools › **Settings…** (first in the menu) reopens step 1 with every value as saved.
  **A slot moved by hand locks itself** (its padlock appears; unlock to free it), so generating again never undoes a
  decision made on the grid; keeping a new draft asks once — *"Regenerate Winter dome 2026–27? … The 3 slots you locked
  and the 6 you moved by hand stay where they are. It hasn’t been sent, so no team is told."* · Keep it · Regenerate. On a
  sent schedule a regenerate is a change to send.

### 5.5 Summaries, export, print
- **By team:** a table — team · slots · hours · a week · prime time (count and share) · nights · a short mark; band rows
  by group; a row opens that team's slots as a list.
- **By group:** Senior · Junior (a rep club’s first fairness question); house league joins as its own row with Stage 9.
- **The whole schedule** is the Grid stepped week by week. **Export** (one button, Excel first): *Winter dome 2026–27 ·
  354 slots* — Excel (a row per slot), PDF (by facility and week: the printed schedule), Calendar (.ics, once sent).
  Print = the PDF.

### 5.6 Send, and after it is sent
**Send** (a form window over the page, the reminders window's shape — Ask 7, Ask 9):
- **What sending does**, one statement: *"288 slots become bookings: on 8 teams’ schedules, on the club calendar and in
  the clash check. Families see their team’s slots on the team’s schedule."*
- **Who is told:** per team, its head coaches and staff with schedule access ("15U AAA · Dana Whitfield, Sam Ortiz ·
  36 slots"); house-league admins (the whole schedule by team); the venue's **bookings contact**
  ("bookings@lakeshore-dome.example · the whole schedule by facility"), each row ticked by default; **Nobody to send
  to** for a team that can't be reached, with the reason (the reminders' words); **See 15U AAA’s email** (the sample).
- "Last sent … by …" under it; foot Cancel · lime **Send to 12** (eleven coaches and the dome).
- **What a coach receives:** one email per team, the slots as a pattern ("Tuesdays 6:00–7:00 p.m. · Lane 1, Jan 5 – Mar
  23, not Feb 16"), a link to the team's Schedule, and how to hand one back; a **Your club** notice in the bell. The
  bookings contact receives the whole schedule by facility in the email's body (no attachment in the first cut, P11-08).
  Families are never sent it.
- **After it is sent (Ask 14):** the teams keep what they were sent until the next send. An edit marks the schedule
  **Changed since sent**; a white callout with an amber edge above the grid lists what moved ("13U AAA · Tue, Jan 12,
  7:00 p.m. → Wed, Jan 13, 8:00 p.m. · Lane 2") and **Send the changes** (the line's lime) applies them to the teams'
  schedules and tells only the teams whose slots moved (and the bookings contact, ticked). Undo works until then.
- **Handed back:** a coach's hand-back is the coach's own act and lands at once — the slot reads *Open · handed back by
  13U AAA* on the grid, the builders get a notice, and reassigning it is a change to send.
- **The send log:** Tools → Send log lists every send (when, by whom, how many people and teams, the whole schedule or
  the changes).

### 5.7 What each person sees
- **A club admin** records the town's permit once (Venue library › Permits), sees at a glance how much of it the club
  uses, names the budget line it is paid from, builds the winter dome schedule in one window, adjusts it on a grid that
  shows every open slot, reads it by team for fairness, sends it to the coaches with a preview of who gets what, and
  sends only the changes afterwards.
- **A head coach** finds the club's slots on the team's Schedule, each marked as coming from the club's schedule, with
  their own arrival, notes, attendance and practice plan; can't move or delete one; can **hand one back** (this one,
  this & future, or all), which frees it for another team. One email when the schedule is sent, one when their slots
  change.
- **A house-league admin** builds house league's practice schedule the same way (their own teams only); the practices
  it makes read as the schedule's on house league's Practices view and change only in the schedule (Ask 6).
- **A family** sees their team's club slots on the schedule they already use (the team's public page today; the
  team's feed once 6d lands). Nothing new to learn, and no email from the club about it.

### 5.8 What 6d's feed must carry for this
Every club slot as an ordinary practice in the team's feed; a slot the club cancels stays in the feed marked cancelled
(today's family feed drops it — 6c already handed 6d that fix); a handed-back slot leaves the feed; the slot's time in
the club's clock. 6d designs it. (Owner 2026-10-11: the dependency runs the other way — the feed reads the practice rows
the scheduler writes — so 6d no longer gates the scheduler.)

### 5.9 A phone
The scheduler is desk first. **A phone reads:** the Schedules list (white cards), a schedule By team (cards) and its week
as day frames (one frame a day, its slots as hairlined rows — C13), the send log, and **Send the changes** (a confirm).
**Not on a phone:** New schedule and the grid's dragging — their doors are absent at phone width, not dead-ended.
**A coach's phone:** the club slot in the schedule list and its window at 390, Hand back at the body's end, 44 px.

## 6. The asks (each with a recommendation) — ⚖ ALL RULED 2026-10-11 AS RECOMMENDED

1. **Where permits live.** *Recommended:* in the Venue library, a **Venues · Permits** switch; a permit is the club's
   record (it may cover several venues), shown on each venue's window in a Permits section; not under Accounting.
   (Refines the prompt's "on the venue": a permit isn't one venue's child.)
   - ⚖ **Who reads a permit — RULED 2026-10-11 in the 10a build session** (the build prompt's precondition 4; owner: *"I
     agree with time to all, money to accounting"*). The question asked was "who reads a permit?"; the code made it "who
     reads a permit's MONEY?" — the Venue library opens to every admin-side role (tournament officials, staff, league
     registrars, league admins, a treasurer), and most of them can't open Accounting. **A permit's time and use read to
     everyone who opens the Venue library; its money (Cost, an hour held, the budget line) reads only to those who hold
     the club's Accounting, and only a Venue-library saver who also holds Accounting sets it.** For anyone else those parts
     are absent, not greyed. The same savers as the library write the rest. **A coach never reads a permit**: the quiet line
     names a facility, days and hours, never a cost, issuer or reference. A departure from the drawing, which showed the
     cost to whoever reads. ⚠ The issuer picker reads the club's payees, which are Accounting's: a saver without
     Accounting types the issuer's name instead (a one-time name, the Ledger's own "not saved as a payee" shape).
   - ⚖ **Added by the owner in the same answer — Ask 28 below:** coaches will enter their own team's permits.
2. **A permit's period.** *Recommended:* its own dates, filed under the fiscal year it starts in (a budget line belongs
   to one year); **Renew for next year** copies it a year on.
   - ⚠ **Built as a rule over the start date, not a stored link** (10a build, 2026-10-11 — a departure from the build
     prompt's `org_permits` column list, which named "the fiscal year it starts in" as a column). The club's fiscal-year
     rows are deleted and re-spanned by a change of first month and by the first close (mig 318's
     `club_fiscal_year_set_first_month`, `club_fiscal_year_close`); a stored link would either block those steps or lose
     the permit. So the permit's year is `fiscalYearOf(starts_on)` wherever it is read, the closed-year lock is
     `starts_on <= club_books_closed_through(org)`, and a named budget line must be a line of the year the permit starts
     in (checked at every save, in the route and in the database).
3. **What the clash check says about permits.** *Recommended:* one quiet line under the Venue field on every form that
   asks where, at a venue where the club holds a permit for those dates; said once in the calendar's read window, never
   on its rows; counted in the permit's Use; never blocks; a club with no permits sees nothing; built beside the pair
   rule, not as a third clash kind.
4. **Which plans carry permits** (open since 2026-10-08). *Recommended:* League Plus and both Club bands — the same as
   the scheduler and the Venue library, because they are one model of time and a League Plus scheduler with no permit to
   start from would be half a tool. Today the Facts doc says Club inclusion. **A packaging call: `/strategy` logs it and
   the Facts doc follows.**
5. **The scheduler and the tournament's parts.** *Recommended (reframed by P11-02):* the scheduler **wears the
   generator's frame and look** — the two-step wide window, the ranked cards, the row-list preview, one statement, the
   Undo notice, the publish window's "who is told" sections, 6a's amber rule — and **builds its own engine and grid**
   (time handed to teams, one-sided, measured in hours and prime time). Lifting the two-step frame into one shared window
   part, with no visible change to the tournament, is a **shared ask to the tournament redesign**; a shared engine is not
   recommended (it would rewrite the tournament's for no tournament gain).
6. **What a finalized slot becomes in house league.** *Recommended:* a house-league practice that reads *From {schedule}*
   on the Practices view and changes only in the schedule; it asks of house league's practice records a source link, a
   writer the schedule runs (move and cancel, past the owner/league-admin gate only through the scheduler's own check),
   and nothing for families yet (house league shows families no practices today — Stage 9's). **It ships with Stage 9**
   (League Plus un-parks there, and the release target runs no house league); the first cut hands time to rep teams.
7. **The send step and the stakeholders.** *Recommended:* coaches (head coaches and staff with schedule access): one email
   per team listing its slots as a pattern, a link, how to hand one back, and a Your club notice; house-league admins:
   the whole schedule by team; the venue's **bookings contact** (a new field on the venue): the whole schedule by
   facility in the email's body, no attachment in the first cut; sent when the schedule is sent and when its changes are;
   reply-to the sender. Families: never.
8. **Money tie-ins.** *Recommended:* (a) **first cut** — a permit names its budget line and the line lists its permits;
   allocating is today's Allocate; (b) **later** — split a cost by the hours each team got as the existing **By
   sessions** split, prefilled with hours from a sent schedule (small: words and a prefill, P11-10).
9. **One club send, or two?** *Recommended:* one send window and one send log shape for every club send — the reminders
   (built), the schedule, and Stage 7's message every family — with two mail paths (families through the family choke
   point and its suppression; staff as colleague mail). Said now so Stage 7 doesn't draw a second one.
10. **The build split.** *Recommended:* **10a permits** (the record, the venue window's section, the quiet line, the
    use, the budget line) → **6d feeds** → **11a the scheduler for rep teams** (the record, settings, drafts, the grid,
    summaries, send, changes, hand-back, the club calendar) → **11b house league's half with Stage 9**. Each its own walk
    (§K, §L, §L-b). The release waits for 10a and 11a (and for 11b only if Stage 9 holds it).
    ⚖ **Amended by the owner 2026-10-11:** 11a waits for 10a only; 6d is drawn and built on its own (the feed reads the
    scheduler's practices, never the other way round); 11a is two build prompts, part A the server and part B the screens.
11. **What the verification found** — asks 12 to 17 below, each from the code.
12. **The grid's shape (P11-01).** *Recommended:* 6c specimen 4's layout — facilities down, a week across, each day's
    slots in clock order, an open slot drawn — which is what "the Timeline's shape" meant on that drawing; it takes the
    Timeline's **behaviour** (drag with a preview, a refusal with its reason, Undo), not its axes; the standard's R3 is
    reworded to match (`/design`, Stage 8).
13. **Which weeks a move reaches (P11-12).** *Recommended:* the drop asks, with the series pencil's three rows — *This
    week only* · *This & later weeks* · *Every week* — and Undo takes back whichever was chosen.
14. **Does an edit to a sent schedule reach the teams at once? (P11-09)** *Recommended:* **no — when it is sent.** The
    teams keep what they were told; **Send the changes** applies and tells together; until then the page says *Changed
    since sent* and lists what moved. (The alternative, at once with a later email, puts half-finished rearrangements on
    families' calendars.)
15. **Which season a slot lands in (P11-06).** *Recommended:* the team's running season when the schedule is sent; Who
    lists only teams with a season running (as New allocation); **starting a team's next season carries its upcoming club
    slots into the new season**, so none strands on a closed season's page.
16. **The words on a team's schedule (P11-03).** *Recommended:* the mirror's construction — *"From Winter dome 2026–27 ·
    the club’s schedule"* and *"Only the club can move or remove this practice."* — rather than a bare "From the club",
    which the coach's Money already uses for money the club pays. Words: `/marketing`.
17. **Handing a slot back.** *Recommended:* *Hand back this practice* ends the practice's window (a rare door); it asks
    which dates with the series rows (*This practice only* · *This & future* · *All practices*) and says what it does
    ("The club can give the time to another team. Your families stop seeing it."); the builders get a notice and the
    slot reads *Open · handed back by {team}*.
18. **Sharing the time by percentage, by group and by team** (added by the owner 2026-10-11: *"can we also add the
    ability to allocate a percentage of the times to allocate by teams and groups, similar to money allocations? i.e.
    there might be a group of rep and a group of select teams, the admin might want to give 60% of the slots to the rep
    teams and 40% to the select teams"*). *Recommended:* New allocation's split, for time (§5.4 item 2): one table with
    the teams; a group's figure spreads over its ticked teams and any team can be retyped; under 100% leaves slots open,
    over 100% holds Generate with the reason beside it. **Two sub-questions money never had:** (a) **prime time** —
    *shared the same way as the slots* (recommended) or *evenly by team*; (b) **when the shares hold** — *every week*
    (recommended) or *across the whole schedule*. The groups are the club's own groups from Rep Teams, so a club that
    groups its teams as Rep and Select gets exactly that split. Drawn: specimen 4 and its By percentage frame.
19. **Reviewing a draft before keeping it** (added by the owner 2026-10-11: *"can a user export the draft and/or see a
    full list/calendar mode of every day in case they want to do a full review before saving? … (like oh I forgot 13U AAA
    asked for a day off on the sunday before Christmas)"*). *Recommended:* the drafts step reads **By team · By day** and
    has **Export** (Excel, PDF) before anything is kept; the button says **Save as a draft** and the statement says the
    draft's page is the full review (every week on the grid, by team, by group, Export, print); **Tools › Settings…** goes
    back to the parameters; **a slot moved by hand locks itself**, so a regenerate keeps every hand change and asks once.
    The reframe: saving a draft was already safe (it reaches nobody), but nothing on the window said so. Not
    recommended: a grid inside the window.
20. **A team's days off** (found in the owner's own example for Ask 19). *Recommended:* a rule, **Teams’ days off** — a
    team and a date, or every week (a weekday); the generator gives those slots to others. Today's Dates off are the
    club's only, so one team's day off could be fixed only by hand after generating. A date a coach has already put on
    the team's own schedule needs no rule: "never over a booking already on the books" reads it.

**Asks 21–27 come from the owner's common flow, walked 2026-10-11 (§6a), and the export instruction (§6b):**

21. **A permit prices its fields.** *Recommended:* a block covers several facilities ("Fields 1–6"), and each field in a
    permit takes **Full cost · Half cost · a share you type**; the permit works out an hour of each ($72.00 a full field,
    $36.00 a half). The prices are the permit's, never the venue's (the venue keeps the sizes; next winter's contract may
    price them differently); Renew carries them.
22. **Fields by group.** *Recommended:* a rule that keeps facilities for a group or a team ("Fields 5–6 · only for
    Junior"); the generator places nobody else there (also: pitching lanes for pitchers, the turf for older teams).
23. **Bill the teams from the schedule.** *Recommended:* "The bill" in Fair shares opens **Bill the teams**, filled in
    from the schedule and its permit: the budget line, the cost (all of it, or a part when the club covers some), the
    split **By the time each team got** (each field at its price), payments that **follow the time** (One · Monthly ·
    Every two months · Dates I choose; each payment that team's slots in its months), a form-table closing row that says
    whether it matches the permit. The bill **rides with the schedule** and becomes one club allocation, each team with
    its own payments, **at Finalize** (a bill goes live when made and its terms never change, 3d Ask 7b). This brings
    Ask 8b into the first cut. Sub-questions: (a) a change after Finalize that moves a team's time is billed as a
    correction (a second small bill) — recommended — rather than reopening the first; (b) a team still on last season at
    Finalize gets its bill on that season (today's rule), so finalize once the teams have started their winter season.
24. **A review round before Finalize.** *Recommended:* Send gains **For review first** (the default when a bill rides
    with it): each coach sees their slots and their bill together and answers **Looks good** or **Ask for a change** by a
    reply date; the replies show on the schedule's page; **Finalize and send** whenever the admin is ready — never held
    up by a team that doesn't answer. *Final now* stays. ⚠ **Amends Stage 11 Ask 1 (2026-10-08)**, which rejected
    coach acceptance ("slow, leaves slots unclaimed"); the round keeps that reason (nothing waits for a team) and meets
    the owner's own step, "for review and approval".
25. **The team's budget reads the club's bill.** *Recommended:* at Finalize the bill arrives **filed under the club
    line's word** (Facilities › Dome Time), so Budget vs. Actual puts its payments on that row; where the coach's own
    plan for that word differs, one callout offers **Use $2,700.00** or **Keep mine**. The club never writes the team's
    budget (D1); the coach presses Use. The filing stays the coach's to change.
26. **Every export in the house format** (an owner instruction, §6b; only its three gaps were asked): the club Excel
    reports get the club's logo (fixed with these exports); the new workbooks set print setup (landscape, fit to width)
    and a text page footer ("Page n of N · Generated by FieldLogicHQ"); the FieldLogicHQ mark stays the last row (an
    image can't go in an Excel page footer reliably). Every other report keeps its format until the owner asks.
27. **A one-day-a-week schedule reads its dates across.** *Recommended:* when the time falls on one weekday, the grid's
    columns are that day's dates, seven at a time ("Oct 4 – Nov 15, 2026"), the facilities down; a register entry R12.
28. **Coaches enter their own team's permits — OPEN, its own drawing** (added by the owner 2026-10-11 in the 10a build
    session, answering who reads a permit: *"we will need to leave this open to allowing coaches to enter their own
    permits as well. while the club will often take care of the larger permit items (i.e. a season diamond schedule, off
    season dome training, etc.) often coaches on the side get permits for supplemental events for their team (their own
    gym practices, exhibition games, etc.). the club should have visibility into permits the coaches got so they can see
    where they can get permits for their other teams and also as a way to verify the coaches are getting the permits they
    should be getting."*). Read in the 10a session as **design for it now, draw and build it as its own step** — no
    drawing shows a coach entering a permit or the club reading the coaches' permits, and a screen is never built
    without an approved drawing; said to the owner before the work. *Recommended shape, for its drawing session:*
    - **One record, two holders.** A permit is held by the club or by one team (a holder column added then), never a
      second table: the coach's permit is the same record, its blocks the same blocks (the one model of time).
    - **Where a coach enters it:** the team's own places (the coach's place book, mig 307) are where a team's gym lives;
      a coach's permit names one of the club's venues OR one of the team's own places — so the block's place becomes
      "a club venue or a team place", the one shape 10a deliberately did not build (`org_time_blocks.org_venue_id` is
      NOT NULL today).
    - **Money:** a team's permit cost is the TEAM's (its budget, its ledger, D1 — the club never writes a team's book);
      it never files under the club's fiscal year.
    - **What the club sees:** the Permits view lists the teams' permits in their own band ("Held by teams"), each naming
      its team, read-only to the club; the "where can our other teams get permits" question reads the issuer and place.
    - **The quiet line for a team's own permit** applies to that team's bookings only.
    - **Packaging:** whether a standalone Premium Coaches Portal team gets permits is NOT ruled — a `/strategy` question
      at its drawing (Ask 4 covers League Plus and both Club bands only).
    - **What 10a leaves ready:** nothing is built for it; the additions are a holder column and a block place that may
      be a team place — an `ADD COLUMN` and a relaxed `NOT NULL`, no rewrite. The fiscal year is already a rule over the
      start date (Ask 2's note), which a team's permit simply never reads.

**⚠ Found 2026-10-11 while writing the build prompts — two questions the ratified asks did not see** (hub Decisions
"Build question A / B", open; `CLUB_SCHEDULER_A_BUILD_PROMPT.md` precondition 4). The rulings stand; these narrow how two
of them are built, and are the owner's before 11a's money part.
- **A · Who files the club's bill on the team's budget (Ask 25).** Ask 25 pre-files the bill under the club line's word.
  Mig 250's money design (owner question 2026-08-17) files a team's share **by the coach, never by the club**, for two
  reasons: the club doesn't know the team's words, and two teams may file one shared cost differently. *Recommended:*
  keep both reasons — pre-file only under a platform word the team's own budget already has; otherwise unfiled, as
  today; the coach changes it per team, as now.
- **B · A team that loses time after Finalize (Ask 23a).** A correction bill works for a team that gains time; a team
  that loses time is owed money, and a bill can't be negative or change its terms. *Recommended:* Send the changes
  previews the corrections; the loser gets a credit recorded the way the club already covers a cost for a team; the
  first bill never changes; if nothing in the money loop fits, the build stops and asks.
- Also recorded, not a question: **the season roll's "the SCHEDULE starts fresh"** (a locked coach-portal decision,
  `lib/rep-season-rollover.ts:33`) is about the old season's own events; Ask 15's carry of a team's upcoming club slots
  keeps that reason (a club slot is the club's booking), and the build says so in the roll's header.

## 6a. The owner's common flow, walked (2026-10-11)

> Owner: *"when all the pages are done, I would like you to do a full walkthrough of the common user flow … 1. org
> owner/admin get permits for a winter dome program that runs for 6 months 2. the dome is split into 6 'facilities'
> (fields), 4 full cost fields and 2 half cost fields (size differences) 3. based on those permit times, the admin splits
> into segments (i.e. permit every sunday from 8am-11am, times are 1.5 hours for each team practice in each facility)
> 4. after schedule is made the admin allocates the cost of the permits to the teams and sets a payment schedule (i.e.
> Oct 1 pays for the Oct and Nov practices, Dec 1 pays for Dec and Jan practices, etc.) 5. admin distributes schedule and
> allocation to teams for review and approval 6. teams schedules and budgets get updated accordingly … the simpler and
> more streamlined we can make this the better we will be able to market our product. this is a real pain point for orgs
> at present."* Read as: walk it through the drawings now (nothing is built), and make it the builds' definition of done.

**Walked on the hub** (Mockups → Stages 10 + 11 → **14 · The dome, walked**) with real numbers: Lakeshore Dome (drawn),
Fields 1–4 full and 5–6 half, Sundays 8:00–11:00 a.m., Oct 4, 2026 – Mar 28, 2027 (25 Sundays, Dec 27 off), $27,000.00.
**The figures add up:** 450 field-hours held; a half field counts half, so $27,000.00 buys 375 full-field hours at $72.00
($36.00 a half). 90-minute slots: 12 a Sunday, 300 in all. Senior 1 full field a week (25 slots, $2,700.00 a team), Junior
1 full + 1 half (50 slots, $4,050.00); 4 × $2,700.00 + 4 × $4,050.00 = $27,000.00. Every two months from Oct 1: 9, 8 and 8
Sundays, so $972.00 / $864.00 / $864.00 (Senior) and $1,458.00 / $1,296.00 / $1,296.00 (Junior).

| Step | In the drawings | Found → drawn |
|---|---|---|
| 1 The permit | Add permit: one form, ~10 fields | One cost, one facility a block → field prices and a block over several fields (Ask 21) |
| 2 Six fields, two half | The venue's fields, once | Holds; the price lives on the permit |
| 3 Sundays in 90-min slots | New schedule › Start from the permit, slot 90 min, Senior 1 / Junior 2, Generate, By day, Save as a draft — ~12 presses | No way to keep half fields for Junior → Fields by group (Ask 22); a Sundays-only grid wastes six days → its dates across (Ask 27) |
| 4 Cost to the teams, a payment schedule | "The bill" → Bill the teams, filled in — 2 presses | A bill can't price each team's time or make each payment its months (24 amounts by hand today) → the split and payments that follow the time; billed at Finalize (Ask 23) |
| 5 Review and approval | Send for review → replies → Finalize and send | No review step (Ask 1 ruled none) → an optional round that never blocks (Ask 24) |
| 6 Schedules and budgets | Slots land as practices; the bill on Money › Club | The team's Budget never reads the bill → filed under the club's word, Use $2,700.00 / Keep mine (Ask 25) |

**End to end:** one permit form, one schedule window, one press to bill, one send for review, one finalize; the teams'
schedules, Club tabs and Budget vs. Actual follow by themselves; a coach answers twice (Looks good; Use $2,700.00).
**The money facts behind it** (survey 2026-10-11): an allocation already stores each team's own payments, any dates and
amounts (only the arithmetic is missing); it has no proposed state and its terms never change; no notice is sent when a
bill is made; the coach's Budget never reads club bills (Budget vs. Actual counts them once sent, under the coach's
filing); a bill binds to the team's running season. **This flow is the definition of done for 10a + 11a** (one walk, end
to end, every figure read back on both sides).

## 6b. Exports in the house format (owner instruction, 2026-10-11)

> *"when you work on the exports, can you make sure they are in the more polished formats that we have established over
> time (i.e. practice plans and lineups for pdfs, accounting reports for excel). include flhq logo in excel footers, any
> disclaimers/notes below the tables, orgs logo in top left, nice titles/headers, professional stylings in pdf, details in
> excel header with frozen pane at header row, etc."*

Drawn on the hub (**15 · Exports**) from the documents the product renders today (`npm run check:pdf -- --keep=… --only=…`:
the practice run sheet and the tournament schedule, page 1, as the reference).
- **PDF** (the schedule "by facility and week", landscape, compact): through the shared document engine — the club's
  colour band, its crest top-left beside its name and a subtitle, a hairline, the title and subtitle, a section per
  day ruled in the club's colour, the club-colour table heading row (sentence case), a faint alternate row, notes under
  the tables, the footer line (site · email · Exported · Generated by FieldLogicHQ · Page n of N). The tournament schedule
  builder's column set becomes parameters rather than a fork (its own header asks for that); a fixture in the documents
  gate holds it.
- **Excel** (the schedule: a row per slot; By team; By field — and a permit's use): the accounting reports' format — the
  masthead (title, what it holds, "As at" and who; the club's logo top-left), the slate header row frozen under it, real
  figures in the money format, a bold totals row, notes under the table, the FieldLogicHQ mark and "Generated by
  FieldLogicHQ" as the last row; the call-site joins the masthead allowlist (not a round-trip file).
- **Gaps found** (Ask 26): the club's Excel reports never get the club's logo (its export fetches paper settings for PDFs
  only); no workbook sets print setup; the FieldLogicHQ mark is a sheet row, not a page footer; no PDF draws the
  FieldLogicHQ mark (text only) — the owner's "flhq logo in excel footers" is today's row.

## 7. Build split, migrations, gates, walks (ruled 2026-10-11)

**10a · Permits** (build prompt `CLUB_PERMITS_BUILD_PROMPT.md`, 2026-10-11):
- Migrations (expected): `org_permits` (org, name, issuer payee, reference, for-scope, dates, fiscal year by start,
  cost, budget line, document path, notes); `org_time_blocks` (venue, facility or every facility, weekdays, start, end,
  dates; owned by a permit or a schedule — the one model); `org_time_dates_off`; a document bucket (an org-level file,
  none exists today); `org_venues.bookings_email` (Ask 7). Dictionary + snapshots, RLS members-read / server-writes (mig
  321's shape).
- The quiet line beside the pair rule (`lib/venue-clash*`), every Where form; the permit's use read over the one pool;
  the budget line's Permits row; the Venue library's switch, table and windows; the plan gate per Ask 4 (`/billing`).
- Walk §K → **§296** on the Owner QA Ledger (thirteen walks, the build prompt's definition of done).

**10a as built (2026-10-11).** Mig **322** (five tables, the venue's column, the bucket, the save step; RLS on, service-role
only; the members' `org_venues` read is a column list without `bookings_email`). The plan gate rides `hasOrgVenueLibrary`
— no new feature key (Ask 4 logged by `/strategy`, `BUSINESS_DECISIONS.md` 2026-10-11). Guards:
`tests/unit/club-permits-guard.test.ts` (one model of time; the plan and who; the closed year; the house format; the venue
links and the club's removal), `club-stage6a-guard` §7 (every Where form and every writer reply carries the answer; never a
third clash kind), `permit-time.test.ts` (the answer case by case, the dome's $72.00 / $36.00, the use's arithmetic, Renew's
names), `permit-use-workbook.test.ts` (the workbook recomputed from its rows), the masthead guard's two new report call
sites. **`/simplify`:** the save replies carry clashes and permits from ONE parallel read (`clashesForSaved*` return
`{ clashes, permits }`); `checkClubPermitsQuietly` everywhere a permit line may fail; the shared date, id, time-range and
used-ratio helpers; one workbook-branding helper; the route reads the club's places and the fiscal setting once.
**`/review` (high-risk) fixed:** the form re-seeded from the read BEFORE ✓'s save (the next pencil autosaved old values
back — High); delete of a money permit in a closed year (route + trigger); `bookings_email` readable from a member's own
session (column grant); the two RESTRICT links broke the platform-admin org delete and the fixture's `--reset` (NO ACTION +
blocks cleared first); a booking with no field set counted once per block; Renew's names for a date or a four-digit span;
window state (a landed autosave never refreshed the lists, Add's lost document line, a renewed copy reopening in its form,
the budget pages' unkeyed permit window, the game window's stale note, Renew's notice never seen); worded refusals for every
floor error, bounds on a share and a cost, the upload capped before it is read, quiet library and clash reports. Proved on
dev in rolled-back blocks (`.probe/s10a/save-probe.sql`, `review-floor-probe.sql`). **Recorded, not fixed (Low):** a block
added during an open edit gets a new id each autosave until ✓; a booking crossing midnight is read on its start day; after a
plan downgrade a coach still reads the line; two quick timeline moves can race their notes (as the clash note does).

**`/design` pass, 2026-10-11 (owner's go; built screens against specimens 1, 2, 3, 12, 13 and 14 at 1440 and 390, Warm,
Dark spot-checked; captures `.probe/s10a-design/`, writes blocked):** fixed — a permit's budget line rendered at the money
figure's size (three lines; now the body step, as drawn); "$27,000.00" overflowed its tile in a window's four-up band (a
permit's two bands take the band's phone figure step); a row's figure ("56 h", "$3,200.00") was the muted support step
(now body ink, as drawn); Facilities claimed "The whole venue" before a venue was chosen (now "Choose a venue first"); a
block's × sat alone on a row at phone width (now beside Days); the Permits view's Export · Add permit wrapped to a row of
their own on a phone (now the page head's icons, as Add venue is) and the empty year carried a second lime. **Kept,
consistent with the built kit rather than the drawing:** section labels in the kit's small capitals (the venue window's
own), read rows stacked label-over-value on a phone (the venue window's), the head's phone actions under the title (the
shared admin header). **Follow-up, not this stage's:** the shared money band has no narrow-container step — any window
with four money tiles can overflow the same way. `check:layout` both themes on every touched screen: no new findings
(the club calendar's read window entry now steps to a week with bookings).

**`/marketing` sign-off, 2026-10-11 (every `[marketing]` tag in `lib/permit-words.ts` closed):** the quiet line says
**"Outside the club's permit for Diamond 2. It covers …"** (the drawing's "Not inside" was the one surface not saying
"outside" — the series line, a date's mark, the generator's count and the Use band all do; the calendar's no-facility
form is "Outside the club's permit at Lions Park."); the empty year explains rather than instructs and is sport-neutral
("a town's field permit"); Delete's question says "Nothing booked at its venues changes" (a permit holds time, never
bookings); the bookings contact's hint says what it is ("Who to email about bookings at this venue."), never the
schedule send 11a builds. Help, the walks (hub v93 — walk 5's series line also trued to "All 4 dates …"), the PM brief
and the ledger follow. The drawings above keep the words they were ratified with.

**For 11a (precondition 2a of `CLUB_SCHEDULER_A_BUILD_PROMPT.md`):** the block table is `org_time_blocks` (owner column
`permit_id`, NOT NULL today — 11a adds `schedule_id` and a one-owner CHECK); its facilities `org_time_block_facilities`
(none = every facility); dates off `org_time_dates_off` (permit-owned); field prices `org_permit_facility_shares` →
`fieldPrices` in `lib/permit-time.ts`; the answer `permitAnswer` / `checkClubPermits(Quietly)` in `lib/permit-lookup.ts`.

**6d · Feeds** (its own design session, `CLUB_TIER_STAGE6D_MOCKUP_PROMPT.md`, then its build; owner 2026-10-11: on its own,
no longer before 11a).

**11a · The scheduler for rep teams** (build prompts `CLUB_SCHEDULER_A_BUILD_PROMPT.md`, the server, then `CLUB_SCHEDULER_B_BUILD_PROMPT.md`, the screens;
2026-10-11):
- Migrations (expected): `club_schedules` (name, state, settings jsonb, the time as blocks, sent_at / sent_by,
  changed_since_sent); `club_schedule_slots` (block, facility, start, end, teams[], locked, handed_back_at / by);
  `club_schedule_sends` (the log: when, by, kind full/changes, people, teams); `rep_team_events.club_schedule_slot_id`
  (the source link, unique per season, as the mirror's); the feature key (League Plus + both Club bands) in
  `lib/plan-features.ts` + the Facts doc (`/billing`).
- **Not drawn, the build carries it:** the time-allocation engine (one-sided, hours and prime time; not the tournament's);
  writes **at the send**, never on read (P11-05); the server refuses a coach's write to a club slot's time and place, as
  the mirror does; rows from one club slot never clash with each other, and the club calendar reads a shared slot as one
  booking (P11-04a); the availability rule reads each team's whole schedule (P11-04c); the season roll carries upcoming
  club slots (Ask 15); hand-back's route and notice; the send as the reminders' pattern (preview, claim lock, reply-to,
  the demo-org guard), the colleague-mail path; the coach notice in "Your club"; the club calendar's read window door
  "Open the schedule"; the export catalog entries (the schedule's Excel, PDF and Calendar; a permit's use); help;
  `check:layout` both themes; a screens guard.
- **From the dome walk (§6a), ruled 2026-10-11:** permit field prices (a weight per facility in a permit; Ask 21); a block over
  several facilities; the Fields-by-group and Teams'-days-off rules; the proposed bill held in the schedule (line, cost,
  split, payment plan) and created at Finalize through `club_allocation_create` with each team's own installments (the
  arithmetic: slots × field price, grouped by the payment's months; Ask 23); review replies (team, answer, words, when,
  by whom) and the review state (Ask 24); the bill's filing preset to the club line's word and the coach's "Use the
  club's figure" (Ask 25); a bell + email when the bill and slots land; the one-day grid (Ask 27).
- **Exports (§6b):** the schedule PDF through `buildTablePDF` (the schedule builder parameterised), its fixture in
  `scripts/pdf-documents.mjs` + `npm run check:pdf`; the workbooks through `buildXLSXWorkbook` with the masthead
  (settings fetched for Excel too), `columnNumFmts`, notes, the FieldLogicHQ footer row, the masthead allowlist.
- Walk §L — **its definition of done is the dome flow of §6a**, end to end, every figure read back on the club's and a
  team's side.

**11b · House league's half** (with Stage 9): `league_practices.club_schedule_slot_id` + `created_by`; the scheduler's
house-league writer (move, cancel); the Practices view's "From {schedule}"; the role path for a club admin. Walk §L-b.

**Gates to add:** a "one model of time" guard (no second slot table); the screens guards; the arithmetic of a permit's
use recomputed from rows (the `check:club-money-arithmetic` pattern) for the Held / Booked / Unused band.

## 8. Not in the first cut (proposed)
Requesting or paying for permits through the platform; municipal integrations; public booking; families requesting or
swapping slots; coaches trading slots with each other; a public schedule page; paying for time per slot; any optimizer
beyond the listed rules; an email attachment; facility archive. (The split by hours left this list on 2026-10-11: Ask 23.)

## 9. Hand-offs (ruled 2026-10-11)
- **Tournament redesign:** the shared ask in Ask 5 (lift the two-step frame); P11-01's R3 wording.
- **6d:** §5.8; it can draw now (`CLUB_TIER_STAGE6D_MOCKUP_PROMPT.md`); it no longer gates 11a (owner 2026-10-11).
- **Stage 7:** Ask 9's one send pattern.
- **Stage 9:** Ask 6 and 11b; the house-league facts in §3.2.
- **`/strategy`:** Ask 4. **`/marketing`:** every drawn sentence, Ask 16, the homepage's "field bookings". **`/billing`:**
  the scheduler's key and Ask 4's gate at build. **`/design`:** a review pass of the drawings; R3.
- Found, not this stage's: the tournament send loop counts a failed email as sent (§3.4); the dictionary's stale lines
  (§3.7).

## 10. Owner QA walks
§K (permits) and §L (the scheduler) on the Owner QA Ledger when built, checkable on the hub's QA tab; each walk one
purpose; every write read back.
