# Club Tier Stage 11b · Part 3: House league's time (continuation prompt)

> **Written 2026-10-27** at the end of the session that built 11b Parts 1–2. **Paste this into a new chat on `dev`.** It
> continues `CLUB_TIER_STAGE11B_BUILD_PROMPT.md` (the build prompt: read it first; it stays the plan of record for Parts
> 3–6). Re-verify every lead below before building on it: other sessions share this working copy (Stage 12, the support
> console, bookkeeping). Stage explicit paths only, commit only your own hunks, and build a staged blob by hand when a
> file carries another session's edits (`DATA_DICTIONARY.md` has done so all day).
>
> **Recommended model: Opus 5.5.** New house-league routes under a strict guard, the league admin's first door into the
> club's Schedules, and a window that divides time other people gave. Helpers stay on Sonnet.

## Where 11b stands (committed on `dev`, never pushed)

- `076d4551d` Part 1 · mig **392**: `club_schedule_slot_programs` (house league holds a slot, never with teams: `slot_both`),
  `league_slot_uses` (a league admin's division: one use per slot, owned by a SEASON, `games` | `practices`),
  `league_practice_time`, `league_practices.club_schedule_slot_id`, and the SQL steps `league_slot_uses_set` and
  `league_practices_hand_out`.
- `ac5d68c5e` Part 2 · the club's side: House league as a holder in New schedule (all of it = no drafts, saved and finalized
  in one request; or a share) and in a slot's **Give it to**; never billed; League Plus schedules; the k5 take-back question
  in the slot window.
- `d60c30d3a` the /review of Parts 1–2 · mig **393**: a use now references the SLOT and waits until Send the changes carries
  or clears it; the two league-admin steps lock slots in id order and read again; rep teams stay closed to a member who
  can't open them (`repTeamsRefusal`); house league is offered only while a house-league season runs.
- the next commit: `/marketing` settled the words Parts 1–2 added (appended to `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md`).
- Migs 392 + 393 are applied to **dev** and pending for prod in `MANUAL_PROD_STEPS.json`. `scripts/club-stage11b-check.sql`
  (run: `node scripts/db-query.mjs --dev -f scripts/club-stage11b-check.sql`) passes T1–T11; it must still pass after Part 3.
- Status line: `HOUSE_LEAGUE_STAGE9_PLAN.md` §9, the 2026-10-27 entry. Rulings: §0h, including **11b·A** (never billed),
  **11b·B** (a slot is rep teams' or house league's, never both; h5 not built), **11b·C** (Part 4 puts practices on the
  house-league coach's team page; 9d-2b adds the games beside them).
- **The owner's UX yes covers all of 11b.** No new UX summary is needed for Part 3 unless you change what was summarized.

## Decisions Parts 1–2 made that Part 3 builds on (do not undo)

- **House league is one holder inside the scheduler**, the fixed id `HOUSE_LEAGUE` (`lib/club-schedule-holders.ts`), taken
  back out at every edge (`storedHolders`, `teamsOnly`). A slot house league holds reads `[..., HOUSE_LEAGUE]` in
  `StoredSlot.teamIds` (`holdersOf` in `lib/club-schedule-server.ts`).
- **"Not given yet"** = a live slot of a **final** schedule that house league holds and that has no use. Only final
  schedules' slots can be divided (`league_slot_uses_set` refuses a draft's: `changed`).
- **Holdings change at the club's save; practices change at Send the changes.** A use left on a slot house league no longer
  holds WAITS (mig 393) until the send carries it to where the time moved or clears it. **House league's time must show only
  live slots house league holds**, and ignore uses waiting on slots it no longer holds.
- The two writes are SQL steps; TypeScript never writes a practice's slot link (the scheduler guard). Their refusal codes:
  `not_found`, `season_closed`, `changed` (+ `slotId` / `teamId`), `bad_settings`; raises `slot_full`, `team_twice`,
  `use_*`. `league_slot_uses_set(p_org, p_season, p_actor, p_slots, p_division, p_kind)` with `p_kind` null gives slots
  back to Not given yet (and deletes their practices that haven't started).
- The club side already reads each house-league slot's use for its slot window (`houseLeagueSlots` in the server;
  `houseLeagueUse()` in the words file names a piece: "U12 games", "U12 practice time").

## Part 3: what to build (from the build prompt; the words are settled)

1. **House league's time** (frames k2 desk + phone, k4, the registrar's read), opened from the house-league season's
   Schedule page: a time line under the title ending **"House league's time →"**, and **Tools › House league's time**. ⚠ That
   page has **no Tools menu today** (its toolbar is division · Week/List/Practices · Generate schedule · Add game · Export).
   Adding one follows the owner's "One toolbar; rare tools behind Tools" ruling (memory: `decision_one_toolbar_rare_tools_behind_tools`).
   - The window: the source line ("Given by the club in {schedule} · {dates} · {venue}"), the hours line, each piece
     with hours first then the count, **Not given yet**, and **Give it to** → each division's games or practice time. A
     piece opens its own window: move, shrink, give back. The foot: "Only an owner or an admin changes how much time house
     league has."
   - **Pieces** group a schedule's house-league slots by weekday, start, end and facility across weeks ("Mondays and
     Wednesdays · 6:00 – 9:00 p.m. · Diamonds 1 and 2 · 12 hours a week"). Hours add up across facilities.
   - **Empty states (k4)**: a league admin with all of it divided; a league admin when the club gave nothing (no link); an
     owner or admin who runs the league (lime **Give house league more time** → the club's Schedules; foot "Nothing is saved
     yet."). Next is absent, not disabled.
   - **The registrar** reads the window with no Give it to.
2. **Routes** under `app/api/admin/house-league/seasons/[seasonId]/…` (read House league's time; give a set of slots to a
   division's games or practice time, or back), gated as `house-league-gate-guard.test.ts` demands: no role literal, no
   `.role`, the first gate `houseLeagueRefusal(ctx, '<action>')`, every season-scoped write
   `houseLeagueRefusal(ctx, 'run', season)` (the variable name matters), handlers as `export const VERB =
   withObservability(...)`. `run` = owner, admin or league_admin on a live season; the registrar has `read`.
3. **A league admin's door into the club's Schedules** (9d2·5, build argument 8): they open it and change only which
   division or use a house-league slot has. A rep team's slot reads with no controls ("A rep team holds this time. An owner
   or an admin can give it to house league."); open time is never theirs. ⚠ **Argue the design before building.** Today
   `resolveScheduler` admits only the owner or an admin (`isScheduleBuilder`, pinned by `club-scheduler-guard.test.ts`),
   and every write route expects that. Options: (a) a read-only club-schedule view for a league admin, their writes going
   through the Part 3 house-league routes; (b) widening `resolveScheduler` with a league-admin mode. **(a) is the
   recommendation:** it keeps the scheduler's one gate and its guard intact, and the league admin's only write already
   lives in house league. The Schedules nav row is absent for a league admin today (`kitSchedulesLink` asks
   `canOpenClubSchedules`, owner or admin), so their door is the house-league window's link to the club's schedule, not the rail.
4. **Help** is Part 6, but keep `lib/help-content` in step if a label you build changes a shipped one.

**Not Part 3:** Practice time's window and the hand-out (Part 4); house league's half of Send the changes and the emails
(Part 5); Generate games step 1 (9d-2a).

## Owed by Parts 1–2's review to later parts (don't lose them)

- **Part 5:** house league's half of Send the changes in the app (`p_league`: uses carry, cancel, moves). Until it lands, a
  send over a taken slot with practices still to come refuses `changed`; none can exist before Part 4.
- **Part 5:** the take-back question also on Clear this week, a drag and Regenerate (only the slot window asks today); the
  k5 foot's "U12's league admins are told then" comes back when Part 5 tells them.
- **Recorded, not built:** Fair shares' measures and the .ics export read house league as a team; a "Give it to house
  league" whose send is refused lands on the draft without a sentence.

## Checks

- `npm run verify:changed` (three failures belonged to other sessions on 2026-10-27, in files 11b doesn't touch: the coach
  membership projection guard on `lib/staff-own-club.ts`, the table-grants guard on mig 354 and `platform_stripe_fees`, the
  possessive guard on `TryoutCoachAddressLine.tsx`; confirm before blaming yourself), `npm run typecheck`,
  `npm run lint:focused -- <files>`, the 11b SQL check, `npm test` on the scheduler and house-league guards.
- `check:layout --changed` widens to the whole product while other sessions' shared-style edits sit in the working copy,
  and on 2026-10-27 it aborted on memory. **The dev server was owed a restart.** Ask the owner before restarting it, and
  never run a whole-product sweep on the dev server.
- `/ux` and `/design` on anything you draw that the drawings don't carry (the Tools menu on the house-league page, the
  league admin's read of the club's slot window). New strings go to `/marketing`.
- `/review` on Part 3 (high-risk: new routes, a role's first door). Commit Part 3 locally after its checks.

## Git

`dev` only. Explicit pathspecs; `git show --stat HEAD` after every commit; a staged blob built by hand when a file carries
another session's hunks. No push and no promote without the owner's word.
