# Club Tier Stage 11b: house league in the club's schedule (build prompt)

> **Written 2026-10-27**, the day the owner ruled all sixteen 9d-2 + 11b asks (`HOUSE_LEAGUE_STAGE9_PLAN.md` §0h) and the
> words were settled (`HOUSE_LEAGUE_STAGE9D2_11B_COPY.md`). **Paste this into a new chat on `dev` and re-verify every lead
> first.** The leads were read in the code on 2026-10-27 by a helper census, and the three load-bearing ones were re-read by
> hand; code moves, so re-open each before building on it. Other sessions share this working copy (Stage 12, the support
> console, bookkeeping): stage explicit paths only, commit only your own hunks, and build a staged blob by hand when a file is
> shared (memory: "Partial commit out of shared files", item 14: never `git apply --cached` a -U0 patch with a hunk dropped).
>
> **Recommended model: Opus 5.5.** A new holder in the club's slot model (a database floor of triggers and SECURITY DEFINER
> steps), a new door for the league admin, the finalize path writing a second program's practices, and a families email.
> Helpers stay on Sonnet as configured.
>
> **11b is the first of three builds** (9d2·6): 11b, then 9d-2a (the schedule screen, Generate games, health, the public
> schedule), then 9d-2b (Publish schedule, Changes to send, the families' game emails, the coach's page). Build it in
> **parts, each committed locally after its own checks.** Part 1 (data) is the base.

## What 11b makes true

The club has **one place that controls time**, and house league works only inside the share the club gives it. In the club's
Schedules an owner or admin gives time to **House league as a whole** (a whole schedule, a share beside the rep teams, or one
slot), never to a division. From the house-league season, a **league admin** opens **House league's time**: everything the
club gave, how it is divided, and what is **Not given yet**. They give a piece to a division as its **game time** (which 9d-2a's
Generate games will fill) or as its **practice time**, and **Practice time** hands that out to the division's teams fairly, week
by week, with the club scheduler's own engine. Those practices land on the house-league schedule and each coach's team page,
read **"From {schedule}"**, and change only in the club's schedule. When the club moves or clears house-league time, **Send the
changes** tells that team's coaches **and its families** (9d2·2). When the club takes back time that has practices on it, it
names them first (9d2·16). A league admin can open the club's Schedules and change only house league's own pieces; a rep
team's slot reads, with no controls.

## The rulings (do not reopen; record nothing they did not rule)

All in `HOUSE_LEAGUE_STAGE9_PLAN.md` §0h; the ones 11b builds:
- **The owner's rule (2026-10-27, binding):** the club has one place to control time and allocates what house league gets;
  nobody in house league picks a day or time the club has not given it.
- **9d2·15:** the club gives time to **House league as a whole**; dividing it into division game time and team practice time
  is the league admin's job alone. The club never sees a division in its lists.
- **9d2·5 (as amended):** a slot can be given (by the league admin, inside house league's time) to a division as game time or
  to a team as practice time; the league admin gives time and hands out practices from the house-league schedule; the owner
  sees it all in the club's schedule; a club practice reads "From {schedule}" and changes only there; a league admin opens the
  club's schedules and changes **only house-league time, never open time**; a rep team's slot reads, with no controls and no
  "ask for it" step; a house-league coach can't hand a practice back.
- **9d2·2:** a practice change emails that team's coaches **and its families**. The **first** practice notice to families is
  NOT 11b's: it is **9d-3** (deferred, owner 2026-10-27).
- **9d2·13:** a move of a division's game time with published games waits in the division's Changes to send. **9d2·16:** time
  the club takes back names what is on it first. Both of their *games* halves need 9d-2b's Changes to send; 11b builds the
  practices half and the warning (see "Carried in").
- **Stage 11's own rulings stand:** Ask 3 (owner or admin for any team), Ask 6 (a slot becomes a practice that reads "From
  {schedule}"), "one model of time" (`CLUB_PERMITS_AND_SCHEDULER_PLAN.md` §5.1), and 6c's calendar recipe.

**Drawn but not asked (build as drawn after /ux and /design):** House league's time's hours line and the hours-then-count row
figures; the two empty states (nothing left; nothing given at all); an owner or admin who runs the league gets "Give house
league more time" as the lime; Next is absent, not disabled; the registrar reads House league's time with no Give it to.

## Read first

- The drawings: https://claude.ai/artifact/TdXm5jmTEJ9qPvR3T5H9qU, tab **"11b · club time"** (frames k1–k5, h1–h5), source
  `HOUSE_LEAGUE_STAGE9D2_DRAWINGS.html`. **The words: `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md` wins over the drawings.**
- `HOUSE_LEAGUE_STAGE9_PLAN.md` §0h (rulings), §4 (the ladder, 9d-3), §9 (status log).
- `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` §5.1 (one model of time), §5.8 (what the feed needs), and the 11b status block.
- `DATA_DICTIONARY.md` on `club_schedules` … `club_schedule_hand_back_slots` (~:1599–1790) and `rep_team_events.club_schedule_slot_id` (~:3004).
- `TABLE_AND_LIST_STANDARD.md` §11.1 (C1–C13) for any list you draw.

## Leads to re-verify (read in the code 2026-10-27)

**The data.**
- **The holder is a rep team, in the floor.** `club_schedule_slot_teams (slot_id, team_id, org_id)`, PK (slot, team),
  `team_id` FK → `rep_teams` ON DELETE CASCADE; the triggers `slot_full`, `slot_team` ("not this club's") and
  `club_schedule_assert_no_team_twice` (mig 326). Also rep-keyed: `club_schedules.settings` (jsonb v2: `teamIds`, `split`, the
  per-team figure, `rules.sharing [{teamIds, groupIds, atOnce}]`, `teamsAtOnce`), `club_schedule_slots.handed_back_team_id`,
  `club_schedule_replies.team_id`, `club_schedule_sends.team_ids` / `team_values` / `billed` / `settled`,
  `club_schedule_hand_backs.team_id`.
- **The slot → practice link** is `rep_team_events.club_schedule_slot_id` (a plain column, not an FK; partial unique index
  `rep_team_events_club_slot_uq (program_year_id, club_schedule_slot_id)`), written by the SQL step `club_practices_write`
  (mig 326) during `club_schedule_finalize` / `club_schedule_apply_changes`.
- **`league_practices` and `league_games` have no slot link** (dev snapshot, re-read 2026-10-27: practices `team_id` NOT NULL →
  `league_teams`, `division_id`, venue/facility, `status scheduled|cancelled`, `recurrence_group_id`).
- **The highest migration is 390** (2026-10-27). `ls supabase/migrations` right before creating yours.

**The server.**
- `lib/club-schedule-server.ts`: `readClubTeams` (~:129) reads only `rep_teams` / `rep_team_groups` / `rep_program_years` and every
  route starts from it; `readScheduleRequest` (~:789) refuses `nothing_to_schedule` with no running rep team; `engineContext`
  (~:274) takes a team's own bookings from `rep_team_events` + `rep_tryout_sessions` only; `resolveScheduler` (~:68) is plan,
  then owner/admin, then `module_rep_teams` for any write, and its header says "A league admin builds house league's half (11b —
  not here)".
- `lib/club-schedule-engine.ts` (`EngineTeam` ~:194, `shareTargets` ~:315, `generateDrafts` ~:641): takes a list of ids, but
  `ageOf(name)` and `groupId` are rep ideas. `lib/club-schedule-settings.ts` (`TeamDayOff` ~:74, `sharingPools` ~:160).
- `lib/club-schedule-send.ts`: recipients are rep staff (`listActiveStaffForTeams`, `loadHeadCoaches`, ~:119–144); practices read
  from `rep_team_events` (~:265); finalize (~:575) and apply changes (~:603). The rep coach email is `changesEmail` in
  `lib/club-schedule-words.ts` (~:319).
- `lib/club-schedule-bill.ts` (`teamInstallments` ~:128, `timeSplits` ~:169) writes `rep_cost_allocations`: the bill is rep money.
- `lib/club-schedule-coach.ts` (`clubSourcesFor` ~:41, the "From {schedule}" line), `lib/club-hand-back*.ts`: rep-keyed.
- **Clashes:** `lib/venue-clash-lookup.ts` (~:271–280) brings league practices and games into the pool with no slot link, so a
  practice written from a slot would clash with its own slot on a regenerate unless it carries the link; `lib/venue-clash.ts`
  (~:248) skips two bookings from one slot via `clubSlotOf`. `lib/club-calendar.ts` reads league practices (~:153) but builds the
  schedule link only from rep rows (~:171, ~:338).

**The doors.**
- `lib/club-schedule-gate.ts`: `isScheduleBuilder` (~:22) owner or admin; `canOpenClubSchedules` (~:25) plan plus role.
  `lib/admin-kit-nav.ts` (~:240): the Schedules link also needs `module_rep_teams`.
- `lib/house-league-access.ts`: `LEAGUE_RUNNER_ROLES` (owner, admin, league_admin), `houseLeagueAccess`, `run`;
  `lib/house-league-gate.ts` `houseLeagueRefusal`. A league admin reaches house league's time through `run`, never through
  `isScheduleBuilder`.
- House league today: `app/api/admin/house-league/seasons/[seasonId]/practices/route.ts` (GET one team's, POST `createPractices`
  after `resolveLeagueVenueSelection` + `checkLeagueBookings`), `practices/[practiceId]/route.ts` (PATCH cancels only);
  `lib/db.ts` `getPracticesForTeam`, `createPractices`, `cancelPractice`; the admin schedule page
  `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx` (PracticeModal ~:653).
- **Plan:** `club_scheduler` requires the League rank (`lib/plan-features.ts` ~:143); `module_house_league` is on League, Club
  and Club Large, `module_rep_teams` on the Club bands only (`lib/plan-config.ts`). No plan was found with house league and no
  scheduler, **but a purchased add-on was not traced** (`planCarriesModule`, `lib/module-entitlements.ts`): trace it.
- **Guards that pin today's shape (they must change, not be bypassed):** `club-scheduler-guard` (the `module_rep_teams` gate
  regex "until 11b"; owner/admin only; only `club-schedule-send.ts` finalizes; no TypeScript writes `club_schedule_slot_id`;
  the link stays a non-FK column on `rep_team_events`), `club-scheduler-screens-guard` (Schedules absent with no rep teams),
  `house-league-gate-guard` (house-league routes name no role and refuse through `houseLeagueRefusal` with the season).

## Things to argue before building (disagree out loud)

1. **How "House league" holds a slot.** `club_schedule_slot_teams` cannot hold it (team FK, PK). Recommended: a second holder
   table for programs, `club_schedule_slot_programs (slot_id, program, org_id)` with `program` checked to `'house_league'`,
   inside the same floor (the `slot_full` count and the "not this club's" check learn it; one slot is held by teams *or* by
   house league, never both). Not a nullable `team_id` with a kind column: it weakens a PK and an FK the whole rep side relies
   on. Not a fake rep team: it would be billed, emailed and counted as one.
2. **Where the league admin's division is recorded.** The club holds "House league"; the league admin's pieces need their own
   table, e.g. `league_slot_uses (slot_id, season_id, division_id, use 'games'|'practices', org_id)`, one use per slot.
   **A season, not the program**, owns the use (house league's time can span two seasons' dates). Practices handed to teams
   are `league_practices` rows carrying the slot. Argue the alternative of hanging the use on the slot itself.
3. **The practice link.** `league_practices.club_schedule_slot_id`, the same shape as `rep_team_events` (plain column, partial
   unique index on season + slot), so the clash read skips a practice's own slot and "From {schedule}" can be found.
   `league_games` gets the same column **now** (unused until 9d-2a) only if adding it later would be costlier; say which.
4. **House league is not billed (recommended).** A schedule's bill is rep money (`rep_cost_allocations`); house league's share
   is not billed to anyone, and the k1 window shows no bill for it. Put this in the UX summary for the owner's yes: it was
   not asked.
5. **h5 is now wrong, and it is a drawing, not a ruling.** Round 2 drew a club sharing rule pairing **a division** ("U9 Rookie")
   with a rep team. 9d2·15 says the club never sees a division. Recommended: the club's sharing rules may name **House league**
   as one party; "teams at once" inside house league's time is the league admin's (Practice time's "Teams at once"). Tell the
   owner; do not build the drawn h5.
6. **League Plus becomes schedulable.** Today a club with no running rep team gets `nothing_to_schedule`, and the Schedules link
   needs `module_rep_teams`. With house league as a holder, a League Plus club has something to schedule. The nav link, the
   refusal and both guards change together, with the reason in the commit.
7. **The families' practice-change email** goes through 9d-1's batched sender in service mode as an automatic notice (one per
   household per send, one part per child; the season's history shows one Automatic row; never counted). Argue if the club's
   Send the changes should instead write one notice per season touched.
8. **A league admin in the club's Schedules (9d2·5).** Their writes are only to house league's own pieces (which division or
   team uses a house-league slot); never give, take, lock, swap or clear a rep team's or an open slot. Recommended: the same
   slot window with Give it to listing only house league's uses, gated by `run` on the season the use belongs to.

## Before any code

1. **The product-manager UX summary** (AGENCY_RULES, blocking), plain words: what an owner, an admin, a league admin, the
   registrar, a rep coach, a house-league coach and a house-league family see differently; the gate table (k-section "Who can
   do what" on the drawings' edges tab); arguments 4, 5 and 6 above in the owner's terms. Get the owner's yes.
2. **The words are settled** (`HOUSE_LEAGUE_STAGE9D2_11B_COPY.md`), including one shipped change: a slot's "Change team"
   becomes **Give it to** for rep teams too. Any new string goes back to `/marketing`. House rules: "8:00 a.m.",
   `possessive()`, `pluralize()`, sport-neutral sentences, "league admin" never "convenor", `npm run check:spelling`.

## What to build, in parts

**Part 1 · Data.** One additive migration (391 or the next free number): the program holder (argument 1) inside mig 326's floor
(its triggers and SECURITY DEFINER steps learn it); the use table (argument 2); `league_practices.club_schedule_slot_id`
(argument 3); the finalize / apply-changes steps writing `league_practices` for house-league uses beside `club_practices_write`.
`DATA_DICTIONARY.md` in the same unit, `npm run refresh:snapshots`, and the migration at the end of `MANUAL_PROD_STEPS.json`.
Prove the floor with a SQL check: a slot held by house league can't also take a team; a full slot refuses either; another
club's season can't take a use; a finalize writes one practice per handed-out slot and a re-finalize writes none twice.

**Part 2 · The club's side (owner and admin).** House league as one row in New schedule's "Who, and how much" (k1: all of it,
no drafts; or a share the drafts place like a team's), and once in a slot's Give it to (h3; "Change team" → "Give it to"). The
engine takes house league as a holder with no age, no group and no bill. The take-back warning (k5, practices half). League Plus
schedulable (argument 6). The rep side must not move: every existing scheduler test stays green.

**Part 3 · House league's time (the league admin).** The window (k2, desk and phone) from the time line under the house-league
schedule's title and Tools; Give it to → a division's games or practice time; a piece's own window (move, shrink, give back);
the empty states (k4); the registrar's read. Routes gated by `houseLeagueRefusal` with the season. A league admin's door into
the club's Schedules (argument 8).

**Part 4 · Practice time.** The window (h1): each practice's length, teams at once, the fair hand-out across the division's
teams with the club engine, "Hand out N practices a week". Practices write through the finalize path with the slot link; they
read "From {schedule}" on the house-league schedule and the coach's team page (h2) and change only in the club's schedule; a
hand-booked practice keeps today's path (and gains edit, per h2).

**Part 5 · Send the changes and the emails.** House-league rows in the club's Send the changes (h4); the house-league coach's
email on the rep coach's shape; the families' practice-change email (argument 7). Until sent, the house-league schedule keeps
the old time.

**Part 6 · Help.** `/docs`: the club's Schedules guide (House league as a holder, Give it to), a new house-league guide "House
league's time" (dividing, Practice time, what families hear), and the league admin's role article. Keywords in the one spelling.

## Definition of done

- Parts 1–6 committed; `npm run verify:changed` and `npm run typecheck` clean; the floor's SQL check passes; new tests for the
  holder, the use, the hand-out and the practice link; the changed guards say what changed and why.
- `/review` on Parts 1–2 (the floor, the doors) and on the whole; findings fixed or recorded.
- `check:layout --changed` on the club's Schedules and the house-league schedule (say so if the UAT fixture can't render them).
- **The 11b walk** (the drawings call it §L-b): a checkable Artifact and the next § in `OWNER_QA_LEDGER.md` (check the last
  number), one purpose per walk: an owner gives house league a whole schedule and a share; a league admin divides it (games,
  practice time), hands out practices, sees them on a coach's page; the club moves a practice and sends (coach + families);
  the club takes back time with practices on it; a league admin in the club's Schedules (house league's pieces only; a rep
  slot reads); the registrar reads; the empty states; a League Plus club with no rep teams. Dev sends no email: say which steps
  read the send record instead of an inbox.
- The plan's status log and §4 row, the scheduler plan's 11b block, the Club Tier plan's Stage 11 line, the PM brief, a news
  row on the Club index (`ArtifactData`, artifact `MBKRySURVFu3V9cZJvmjVr`, stage `s9`; read first, pin `if_version`), and
  memory `project_club_stage9_house_league.md`.

## Carried in, not yours to build

- **9d-2a** reads a division's game time from 11b (Generate games, step 1 per the copy file), the schedule's List · Week ·
  Month, health, the public schedule. **9d-2b** builds Changes to send and Needs a new date, which the *games* halves of 9d2·13
  and 9d2·16 need; until then no game carries a slot link, so taking back game time has no games to move.
- **9d-3**: the first practice notice to families, and house league's calendars. **Stage 6d**'s feeds stay rep-only here.
- **Stage 13**: where permits sit in the navigation. **Prod:** your migration joins the end of `MANUAL_PROD_STEPS.json`; no
  promote.

## Do not

- Give house league's time by division at the club level, or show a division in any club list. Let anyone in house league pick
  an hour the club has not given it.
- Make house league a fake rep team, bill house league, or weaken `club_schedule_slot_teams`' PK or FK.
- Write the slot link from TypeScript (the guard holds it to the SQL steps), or a second practice writer.
- Email families the *first* practice time (9d-3), or show practices on the public team page (ruled games-only).
- Build Generate games, Publish schedule, Changes to send or the public schedule (9d-2a/b). Build the drawn h5.
- Add `module_families` to any role, restate a price, reopen a ruling, push or promote.

## Git

`dev` only. Explicit pathspecs; `git show --stat HEAD` after every commit; a staged blob built by hand when a file carries
another session's hunks. Part 1 may be committed alone once its SQL check passes. No push and no promote without the owner's word.
