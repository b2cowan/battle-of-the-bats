# Club Tier Stage 11b · Part 3, second half: House league's time, finished (build prompt)

> **Written 2026-10-27** at the end of the session that drew Part 3, had it ruled, and built its first half. **Paste this
> into a new chat on `dev`.** It continues `CLUB_TIER_STAGE11B_PART3_PROMPT.md` and `CLUB_TIER_STAGE11B_BUILD_PROMPT.md`
> (read both for the rules of the road; this file wins where they differ). Re-verify every lead before building on it:
> other sessions share this working copy (Stage 12, the support console, bookkeeping). Stage explicit paths only, commit
> only your own hunks, and build a staged blob by hand when a file carries another session's edits.
>
> **Recommended model: Opus 5.5.** A new SQL step that makes one Save all-or-nothing (and closes the stale-give race in the
> database), and a role's first door into the club's schedule, where the trap is leaking rep team names or the club's
> money. Helpers stay on Sonnet for reading and checks.

## The drawings and the rulings (do not reopen)

- **Drawings (build to these):** https://claude.ai/artifact/C7ZbiDmmcxFgKUBte3qrDe (v3), source
  `docs/projects/active/HOUSE_LEAGUE_STAGE11B_PART3_DRAWINGS.html`. The list window (k2) is in the older drawings
  (TdXm5jmTEJ9qPvR3T5H9qU, tab "11b · club time").
- **RULED "all recommendations" (owner 2026-10-27)** — the decisions tab's 11 cards, recorded in
  `HOUSE_LEAGUE_STAGE9_PLAN.md` §9 (the "11b Part 3: drawn, RULED, first half built" entry). Read that entry first.
- **Owner, the toolbar (2026-10-27):** Part 3 adds **only** the Tools menu and the time line to the house-league Schedule page.
  The views (List · Week · Month, Week · Month on a phone), the Show filter (games, practices) and the phone's symbol buttons
  are **9d-2a's** toolbar rebuild (9d2·12, already ruled). Do not restyle today's toolbar; place Tools and the time line where
  the ruled 9d-2 toolbar puts them, so 9d-2a does not move them.

## What is already built (commit `cd5d32472`, re-read it)

- `lib/league-time.ts` (client-safe): the grouping (`groupLeagueTime`: sources → stretches = the club's blocks → rows = one
  use each, Not given yet last), `partsWords`, `hoursAWeek`, `readGiveBody` (`from` REQUIRED), `LEAGUE_TIME_WORDS`,
  `LEAGUE_TIME_REFUSALS`. Tests: `tests/unit/league-time.test.ts`.
- `lib/league-time-server.ts`: `readLeagueTime` (live slots of final schedules house league holds, still to come, inside the
  season's dates, never another season's) and `giveLeagueTime` (checks each slot still holds `from`, then
  `league_slot_uses_set`).
- `app/api/admin/house-league/seasons/[seasonId]/time/route.ts`: GET `read`, POST `run` on the season.
- `components/admin/kit/club/league/time/HouseLeagueTimeWindow.tsx`: the k2 window (rows, Give it to on Not given yet, the
  corrected empty states, the owner's rare door when all is divided). **Not yet mounted anywhere.**

## Build, in this order, each committed after its checks

**1 · One atomic Save (database).** A Save in a piece can give new parts AND give others back; `league_slot_uses_set` takes one
use per call, so two calls could half-apply. Add one SQL step (next free migration — `ls supabase/migrations` first; 393
is the last 11b one) that takes a set of changes, e.g. `league_slot_uses_apply(p_org, p_season, p_actor, p_changes jsonb)`
with `[{ slotId, from: {divisionId, kind} | null, to: {divisionId, kind} | null }]`: refuse via `league_time_refusal`; lock
every slot in id order, THEN read again; each slot must be a live slot of a final schedule house league holds, not another
season's, AND hold exactly `from` (else `{ok:false, code:'changed', slotId}` and nothing applied); remove practices that
haven't started where a slot stops being that division's practice time (as `league_slot_uses_set` does); apply. Return
`{ ok, slots, practicesRemoved }`. SECURITY DEFINER, EXECUTE service_role only. Move the `from` check from TypeScript into
it (the TS pre-read stays harmless or goes). Keep `league_slot_uses_set` (Part 2's club-side callers and the SQL check use
it) or route both through the new step — say which. **Same unit:** `DATA_DICTIONARY.md` (the function; build a staged
blob by hand — other sessions edit that file), `npm run refresh:snapshots`, the migration at the END of
`MANUAL_PROD_STEPS.json`, and new cases in `scripts/club-stage11b-check.sql` (a mixed Save applies whole; a stale `from`
applies nothing; another season's slot refuses). Apply to DEV only. The route's POST takes the change set; the k2 window's
whole-row give becomes a one-change set.

**2 · The piece's level** (drawings tab "A piece's window", b–g). Inside `HouseLeagueTimeWindow` as a LEVEL (KitDialog
`back: { label: 'House league’s time', onBack }`, `levelKey`), never a second window. A division's row gets its ›.
- Parts here group by weekday + start + end + facility **without** the use (the read groups with it), so a part can be
  **mixed**: half tick, "{n} of {m} dates". Ticking takes its Not-given-yet dates; unticking gives back this division's.
- Group ticks per weekday and per stretch, tri-state. A part another division holds: no box; its holder is a link to that
  piece. Ticks STAGE; the foot reads "Nothing is saved yet." then "{n} changes", Cancel + lime Save (faded until a change).
- "Give all of it back" = `RecordAction` ending the body; it stages unticking everything.
- On Save, when practices still to come sit on time being given back: the question (KitDialog `question`), titled per the
  drawing, naming the teams, a **danger** confirm "Save and remove {n} practices". The read must return each slot's future
  practices (team names) for this. Until Part 4 none exist; build it anyway and test it with a fixture row.
- The registrar's read: the same level, no boxes, no group ticks, no door, no Save, no foot.
- Phone: KitDialog's form fills the screen; part rows 56px; the facility and hours under the part.

**3 · Choose parts…** — the last item of a Not given yet row's Give it to (after a separator): a small question step picking
the division + kind (the four pairs as a radio list), then the piece level for it with nothing new ticked.

**4 · The house-league Schedule page** (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx`):
- **Tools** (⋯) at the right end of the toolbar: `CoachToolbarMenu` as `TeamsScreen` uses it (`collapseOnPhone bareOnPhone
  drawerOnPhone drawerTitle="Tools"`). Items: "House league’s time"; a separator; `CoachToolbarMenuHeading` "Export" over
  Excel / CSV / Calendar file — move today's `ExportMenu` behaviour in, **including its free-floor "Exports · League" case**
  (read `components/admin/ExportMenu` before moving it). Practice time joins in Part 4 (absent until then).
- **The time line** under the title: the settled sentence (`/marketing`: "U12’s time comes from the club’s schedule,
  {schedule}. Games: Tue and Thu, 6:00–7:30 p.m. Practice time: Mon and Wed, 6:00–9:00 p.m. House league’s time →" — no
  facilities; `possessive()`; a clause only for what the division has; two schedules → "the club’s schedules, {A} and {B}";
  none → "U12 has no time from the club yet. House league’s time →"; a phone shows one line). Shows only when the club has
  house-league time (any source) **or** the viewer builds Schedules (`canOpenClubSchedules`); otherwise absent.
- Mount the window: `canDivide` = `useSeasonAccess(season)?.run`; `schedulesHref` = the club's Schedules when
  `canOpenClubSchedules({ planId, role })`. Open it from Tools, the time line, and `?time=1` (the club view's Back replays it).

**5 · The league admin in the club's schedule** (drawings tab 5; built second, its own commit). A house-league page reading
one club schedule's week, opened from the source line's schedule name in House league's time (never the rail).
- A NEW read route under `app/api/admin/house-league/seasons/[seasonId]/…` (gate `read`; the house-league guard forbids role
  literals and `canOpenModule(` in route files — put any Rep-teams check in a lib function). It returns an **allow-list
  projection**, never `scheduleView` passed through: each slot's day, clock, place, and holder as `house_league` (+ its use)
  | `rep` | `open`. **Rep team names are stripped server-side** unless the viewer can open Rep teams. No bill, pricing,
  asks, replies, sends, money. A test pins the projection's keys.
- Slot windows per the drawing: a rep slot reads ("Team · A rep team" + the settled sentence); an open slot reads (the
  /marketing note); a house-league slot has a **Use** radio list for that one date, saving on the spot through the time
  route's change set (transient Saved pill; a failed state reverts the radio and puts the reason in the foot's left). Past
  dates read with no Use. Setting Not given yet on a date with practices still to come asks first. Changes are desk-only, as
  the club's page (`canChange = !isPhone`); a phone reads.
- "← House league’s time" returns to the Schedule page with `?time=1`.

## Words

Settled: `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md` plus the /marketing round of 2026-10-27 recorded in the drawing (untagged strings
there are settled). **Run `/marketing` on everything still tagged "draft words" in the drawing** and on the build's own
`[marketing]` strings in `lib/league-time.ts` (`noneGivenClub`, `noneGivenClubHint`, `giveSome` were added after the round),
then append the settled set to the copy file (a "Part 3" section). House rules: "6:00 p.m.", `possessive()`, `pluralize()`,
sport-neutral, "league admin". Amend the copy file's "hours · count" row: hours only until a length exists (ruling 9).

## Checks and done

- `npm run verify:changed` (failures in files 11b doesn't touch were other sessions' on 2026-10-27 — confirm before blaming
  yourself), `npm run typecheck`, `npm run lint:focused -- <files>`, `node scripts/db-query.mjs --dev -f
  scripts/club-stage11b-check.sql`, and `npm test` on `league-time`, `house-league-gate-guard`, `club-scheduler-guard`,
  `club-scheduler-screens-guard`, `kit-dialog-foot-text-guard`.
- `/review` on Part 3 as a whole (high-risk: new SQL step, new routes, a role's first door) — fix or record findings.
- New files → **the dev server needs a restart before the owner tests**; ask first. `check:layout --changed` only if it
  doesn't widen to the whole product (it did on 2026-10-27); never a whole-product sweep on the dev server.
- `/docs` is Part 6, but keep `lib/help-content` in step if a shipped label changes.
- Record in `HOUSE_LEAGUE_STAGE9_PLAN.md` §9 (commits, the migration, what's owed), the scheduler plan's 11b block, and memory
  `project_club_stage9_house_league.md`. The 11b walk stays at the end of 11b (all parts).

## Do not

- Restyle today's Schedule toolbar beyond Tools and the time line (9d-2a owns it). Build Option B. Autosave per tick.
- Let a give change a slot whose use differs from what the window saw. Let a rep team's name or any club money reach a
  league admin. Pass `scheduleView` to a house-league route.
- Write a practice's slot link or a use from TypeScript (SQL steps only). Promise families or coaches a notice (Part 5).
- Push or promote.

## Git

`dev` only. Explicit pathspecs; `git show --stat HEAD` after every commit; a staged blob built by hand when a file carries
another session's hunks. No push and no promote without the owner's word.
