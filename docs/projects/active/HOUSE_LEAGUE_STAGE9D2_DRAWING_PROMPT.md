# Club Tier Stages 9d-2 and 11b, House league "The schedule" and the club calendar's house-league half: draw them together (prompt)

> **Written 2026-10-26**, the day 9d-1 (one email composer) was walked (§388, 35 of 35) and the owner asked for the 9d-2 kick-off.
> **Owner direction, same day: draw 9d-2 and 11b in ONE drawing round; build 9d-2 first, then 11b.** The reason: the Practices view
> (where 11b's "From {schedule}" lands) is a third tab on the very schedule screen 9d-2 rebuilds, so drawing 11b after 9d-2 would
> draw that screen twice. Drawing them together is not a ruling that they are one build: Ask 6 decides the build split.
> **Paste this into a new chat on `dev`.** Other sessions share this working copy (TODO, the Club plan, the plan, the PM brief and
> the QA ledger carry their edits): stage explicit paths only, and commit only your own hunks.
>
> **This is a drawing session, not a build.** No product code, migration, seed, help article or demo change.
>
> **How to draw (owner ruling 2026-10-26, binding):** the drawings are **one published HTML-page Artifact with tabs and a
> written explanation beside every frame**, published by `file_path`. **Never** use the design canvas / the `design` quickstart /
> a Design artifact type, and never open an empty artifact "to fill later". Load `artifact-design` first.

## What 9d-2 is, and what is already ruled

9d-2 is the sixth rung of the Stage 9 ladder (`docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md` §4, the row for 9d-2): **the
house-league schedule made right.** The row reads: *"Generator rebuilt; C1–C12 admin + public; health (Q11); 11b; venue/permit
links; Publish schedule + change notices (sent through 9d-1's composer path)."* Size L. It was split from 9d on 2026-10-26.
9a, 9b-1, 9b-2, 9c and 9d-1 are built and walked (§372, §375, §378, §381, §388).

**11b is the house-league half of Stage 11, the club's one schedule, and it is NOT built.** Stage 11 gave the club one calendar of
facility time: the club books slots, hands them to teams, lets groups share them, moves or cancels them, and bills for them.
That is built for rep teams (11a, 11c, 11d). 11b does the same for house league (`CLUB_PERMITS_AND_SCHEDULER_PLAN.md` §11b
and Ask 6, about line 1468): `league_practices` gets a link to a club slot and a creator; the scheduler gets a house-league
writer (move, cancel); the Practices view reads "From {schedule}"; a club admin, not only a league admin, has a role path. A
division is a "group" for sharing ("the U9 divisions share a facility"). Its walk is §L-b. **The plan holds the release for it**
(Stage 9 is inside the release since 2026-10-12, so 11b holds it too). It was missing from the previous status summaries; do not
let it be missing from yours.

**Ruled, do not reopen** (record each as ruled and add nothing it did not rule):
- **Q11, the schedule health score is the tournament's** (button, window and engine). Plan §0 (2026-10-24) and the 9d-2 row say
  "ruled". ⚠ Plan §3's old line "Optional, unruled" is stale; fix it in your records pass.
- **C1, C3, C4, C8, C9 and C12 for house league** were drawn and ruled in Stage 6c on 2026-10-10 (Club hub
  `CLUB_TIER_PRODUCTION_READINESS_HUB.html`, Asks 15 and 17; Club plan §6c). The hub labels those specimens "as built (old
  look; Stage 9 redraws house league)", so they are **delta specimens on the old look**: redraw them on the kit, don't
  re-argue them. The recipe itself is `docs/agents/design/TABLE_AND_LIST_STANDARD.md` §3, rules **C1–C13** (C13 is the phone rule).
- **9d1·4:** a schedule notice appears in the season's sent history as an **Automatic** row. **Q12c:** automatic notices never
  count toward a cap. **9c·10 / 9c·12:** the publish and move-notice precedents (service-mode sender, reaches a family who
  unsubscribed from club news, never counts).
- **Stage 10 permit rule:** a quiet permit line already sits on house-league game, practice, series and generator checks
  (`CLUB_PERMITS_AND_SCHEDULER_PLAN.md` top of file). Ask 28 (coach-entered permits) is **not** this stage.
- **A season stays live until closed; a closed season is one page** (CLAUDE.md, owner 2026-08-18). A finished season's
  schedule is not a screen to draw.
- **The public team page is games only**, never practices or team events (owner decision, memory `decision_public_team_page_games_only`).

## The facts the drawing rests on (a helper census on 2026-10-26; I re-opened the ones marked ✔. Re-verify every other row against the code before drawing on it)

| Fact | Where to look | Consequence for the screen |
|---|---|---|
| ✔ **The generator is thin:** one division, one start date, one venue per run, a circle-method round robin, and saving is a plain insert. | `app/api/admin/house-league/seasons/[seasonId]/schedule/generate/route.ts` (208 lines); plan §3 F17, F24 | The rebuilt form: weekdays, slots, game length, dates off, byes, several divisions in one run, venues, and **checks itself before saving.** Draw the form and the check's result. |
| ✔ **The admin schedule screen is off-recipe:** 1,745 lines, Week and List as two views, a greyed "Edit Game" form for a reader, an inline health strip. | `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx` (health strip near :871 and :920); plan F18 | C-recipe restyle: **one season List grouped by week**, opens on this week, "Oct 19 – 25, 2026" labels, place on every game, "Final" on finished games, no chip on a scheduled game, a reader gets a read window and never a greyed form, division leads as the scope pill. |
| **The health route returns conflicts and unchecked bookings only: no score.** The conflict engine is `lib/league-schedule-conflict.ts`. The tournament's button, window and engine are `components/admin/tournament/HealthButton.tsx`, `HealthRow.tsx`, `lib/schedule-metrics.ts`, `lib/schedule-generator.ts`. | `.../schedule/health/route.ts`; the tournament files | Q11 says reuse the tournament's. **Open question for the drawing:** does the tournament engine's metric set (pools, rest, travel) mean anything for a house-league season? Push-back 3. |
| **The public schedule hides a cancelled game by query, shows no place, and shows Postponed as if it were on** (the "C6-04" defect). | `lib/db.ts` near :2766; `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx`; plan F19 | Place on every game; **Cancelled struck through and Postponed in words**; "Times in Eastern time." said once (C10). |
| ✔ **There is no "published schedule" for a league season today.** The only publish concept is a division's teams (`league_divisions.teams_published_at`, mig 377, no unpublish). `Publish schedule` is named in plan §4 and §5 and nowhere defined. | `docs/agents/db/DATA_DICTIONARY.md`; plan §4 row, §5 | **This is the stage's biggest undefined thing.** Push-back 1. |
| ✔ **11b is not built.** `club_schedule_slot_id` exists on `rep_team_events` (mig 326), not on `league_practices`; `lib/club-schedule-server.ts` says "A league admin builds house league's half (11b — not here)" and "League Plus runs no rep teams until house league joins (11b)." Stage 11a/11d are built. The 11b walk is §L-b. | `lib/club-schedule-server.ts:36-46`; `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` ~:1468 and Ask 6 (~:657-661) | 11b = a house-league writer for the club schedule (move, cancel), the Practices view's "From {schedule}", and the club-admin role path. Draw what a league admin sees and what a club owner sees. Push-back 2. |
| **9d-1 left the path for notices:** the Families engine and sender (`deliverFamilyEmail`, `lib/families-email.ts`; `lib/house-league-email.ts`; `lib/house-league-placement-mail.ts` service mode), the notices table `league_season_notices` (mig 385, written by `league_division_publish`), and the season history that shows Automatic rows. **Mig 385 is on dev; prod pending.** | 9d-1 build prompt "Carried in" (~:207); plan ~:496-506 | 9d-2's change notices write the same record as automatic, never touching the cap. |
| **Venue and permit:** `lib/league-venue.ts`, `lib/venue-clash.ts`, `lib/venue-clash-lookup.ts`, `lib/league-practice-series.ts`, the `venue-check` route. Plan F24: "Permit not reachable from the schedule." | files listed | A venue picker in the generator and a permit line reachable from a game. |
| **Practices are not public**, but the Practices view is where "From {schedule}" lands (Ask 6, ratified). | Club plan Ask 6 | Do families ever hear about a practice change? Ask 2. |

## Read first

`AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading goes to a helper; a helper's summary is a lead, so open the cited
lines yourself; disagree out loud). Plan §0, §3 (F17–F19, F24), §4, §5. `docs/agents/design/TABLE_AND_LIST_STANDARD.md` §3
(C1–C13). `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` (Stages 10 and 11, Ask 6, the 11b notes). The 9d-1 build prompt's "Carried in".
The drawings you follow in shape and frame rules: 9d-1's https://claude.ai/artifact/Xy8ENL1KbUZVbWpDthD9EB (source
`HOUSE_LEAGUE_STAGE9D1_DRAWINGS.html`) and 9c's https://claude.ai/artifact/C56VdDqASJ4x53EoFWZjyk. The tournament's schedule health
window as the thing Q11 says to reuse. House rulings in the auto-memory index that touch these screens: mockups are **HTML-page
Artifacts with tabs and explanations, at true size, with a whole-screen before/after**; a window's foot has the sentence left and
the buttons right; a change that tells families is held until ✓; one toolbar with rare tools behind Tools; a waiting count is the
amber pill; a phone's secondary action is its symbol alone; absent beats disabled; every highlight is clickable; a list is a
table only when a column answers the question (row-list recipe); one spelling, "8:00 a.m."; sport-neutral words. Check each
against the code before drawing on it.

## Push back (out loud, on the drawings page, before the work)

1. **"Publish schedule" has no definition, and it may be the wrong shape.** Today a generated or typed game is live the moment
   it is saved: the public schedule reads it straight away. Draw the honest options and recommend one: (a) **no publish step**,
   games are live as saved and every later change to a live game notifies families (simple, but a convenor can't build in peace);
   (b) **a draft until "Publish schedule"**, per division like "Publish teams" (consistent with 9c, needs a flag and a "what
   families see" rule for a half-built season); (c) **publish once, then changes notify** (b, plus a change-notice rule after).
   Say what each costs the convenor building a 12-division season, the family looking at the public page, and 9e's rainout
   (an automatic notice too). Recommend with reasons; say what "unpublish" is (9c has none).
2. **11b is drawn here and built after, and 9d-2 may itself be more than one build.** 11b is the one part that crosses into
   the **rep-team scheduler** (the club's one calendar, Stage 11) and a **role path** (club owner/admin vs league admin), and it
   has a walk of its own (§L-b); the other parts are house-league only. So draw 11b's screens **now, on the same schedule
   screen**, so the page is rebuilt once. Then argue the build split, e.g. **9d-2a** generator + admin/public restyle +
   health, **9d-2b** Publish schedule + notices, **11b** the club-calendar half; say whether 11b's "From {schedule}" row and
   the schedule screen's third tab (Practices) can ship in 9d-2a with only the *writer* waiting for 11b, or must wait whole.
   Name what each split costs in rework. Don't assume 9d-2 is one build because the ladder row is one line, and don't assume
   11b is deferrable in the *drawings* because it is deferrable in the *build*.
   - **A question the drawings must answer for 11b:** a house-league practice booked on the club calendar and a rep team's
     slot compete for the same rink. Draw what a league admin sees when the slot they want is **held by a rep team** and what
     the club owner sees when they move a house-league slot (does the division's families hear, via 9d-2's notice path?).
     Both flows end in the same notice rules: say which kinds of practice change email a family (Ask 2).
   - **Who:** Stage 11 Ask 3 says the owner or an admin builds, adjusts, bills and sends for any team; "a league admin builds
     house league's half (11b)". Draw the table for owner, admin, league admin, registrar, treasurer, coach, and say what an
     admin without house league sees. The scheduler's plan gate is `club_scheduler` (League Plus and both Club bands); point at
     `docs/agents/strategy/PLAN_PRICING_FACTS.md`, don't restate it.
3. **Does the tournament's health engine fit a house-league season?** Q11 is ruled "the tournament's". If its metrics assume
   pools, brackets or tournament-length days, drawing them on a 10-week weekly league would show numbers that mean nothing.
   Draw the window from a real house-league season (use the dev fixture), say which tiles apply, which don't and what replaces
   them. A ruling's *reason* is the authority, not its wording: if the reason (one familiar window, one engine) survives with
   fewer tiles, say so and recommend that.
4. **A change notice is the first email a family gets about a game, and the most likely to be wrong.** Decide, per kind of
   change (time, place, cancelled, postponed, a new game added after publish, a game removed), whether it emails, to whom
   (that game's two teams' families only, never the season), how it **batches** (a convenor moving ten games shouldn't send ten
   emails: one digest per household?) and where the convenor **sees what will be sent** before it goes (held until ✓). Name
   what a family with two children on different teams receives.
5. **The generator "checks itself before saving"**: draw what a failed check looks like (a venue double-booked, a team twice in
   a day, a permit missing) and whether it **blocks** or **warns** (the permit rule today only warns), and what the convenor
   can do from the result without losing the run. A first-time convenor needs the form to start from a sensible default.

## What to produce

1. **One published Artifact**, an HTML page with **tabs** (one per frame group) and a written explanation beside each frame
   (source `docs/projects/active/HOUSE_LEAGUE_STAGE9D2_DRAWINGS.html`; load `artifact-design` first). Before = today's screens
   from the real pages; after = drawn at **true size**, a desk and a phone for each frame; NEW / RESTYLED / UNCHANGED tags;
   clickable flags; one checkbox per option for each ask; a paste-back summary at the end.
2. **Frames:**
   - (a) **Today:** the admin schedule (Week, List, the form for a reader, the health strip), the generator, the public schedule
     with a cancelled and a postponed game, and the Practices view.
   - (b) **The season's schedule as one List:** grouped by week, opens on this week, a game's row (place, state words, no chip
     when scheduled), the division scope pill, Export (C11), and the phone's one-frame-per-day (C13). A reader's read window
     (C12) beside an editor's window.
   - (c) **The rebuilt generator:** the form (several divisions, weekdays, slots, game length, dates off, byes, venues), the
     self-check result in its empty, passing, warning and blocking states, and what saving does.
   - (d) **Health for house league:** the button, the window from a real season, and the states per push-back 3.
   - (e) **Publish schedule:** per push-back 1: its states (not published, published, changed since), the confirm window with
     the count of families it reaches, and what the public page shows before and after.
   - (f) **Change notices:** per push-back 4: the held-until-✓ preview for a convenor moving games, the family's email (words
     provisional), the season history's Automatic rows (9d1·4), and a one-game cancel.
   - (g) **The public schedule:** place on every game, Cancelled struck through, Postponed in words, "Times in Eastern time."
     once, desk and phone, and an empty season.
   - (h) **11b, drawn in this round whatever the build split:** the schedule screen's **Practices tab** (the third view, beside
     Week and List: `viewMode` is `'week' | 'list' | 'practices'`) with "From {schedule}" on a practice; a practice's window
     (read first, C12); a practice booked from the club calendar; **a slot held by a rep team** from the league admin's side;
     a club owner moving or cancelling a house-league slot and the notice that follows; a division as a sharing group; and the
     plan gate's absent state on a plan without `club_scheduler`. Draw it on the **same kit and same toolbar** as (b) so the
     two read as one screen, and show the rep-team scheduler's existing slot window **only as the unchanged neighbour** (UNCHANGED).
   - (i) **Permit and venue links:** the permit line from a game and from the generator; the venue picker.
   - (j) **The gate:** the who-can-do-what table restated for this stage: owner, admin, league admin, registrar, treasurer,
     coach, reader. Who edits a game, runs the generator, publishes, sees health.
   - (k) **Edges:** a season with two divisions and none scheduled; a game on a closed venue; a season mid-play with a
     published schedule; a finished season (one page, nothing to draw: say so).
3. **Words:** provisional, marked provisional. Final words go through `/marketing` **after the owner rules**, before any code
   (house rules: sentence case, "8:00 a.m.", the bare possessive, `npm run check:spelling`).
4. **Flow + design:** run `/ux` on the journeys (convenor building a season, convenor moving a game after publish, a family
   getting a change, a league admin and a club owner sharing one calendar). Run `/design` on the whole page **before the
   hand-off**, apply its fixes, republish, and report what it changed.
5. **Asks:** numbered, each with a recommendation. Ask 1 = Publish schedule's meaning (push-back 1). Ask 2 = which changes
   notify, whom, how batched (push-back 4), including whether a practice change ever reaches a family. Ask 3 = the generator's
   parameters and whether its check blocks or warns (push-back 5). Ask 4 = health for house league (push-back 3). Ask 5 = the
   11b design itself: the Practices tab's shape, "From {schedule}", the held-by-a-rep-team case, who can move a house-league
   slot (push-back 2). Ask 6 = the split into builds, with the owner's stated order (9d-2 first, then 11b) as the starting
   point (push-back 2). Then any the frames raise.
6. **Build notes, not asks** (put them on the page so the build prompts carry them): the league schedule needs a publish flag
   only if Ask 1 says so (a migration, dictionary + snapshots in the same unit of work); notices write `league_season_notices`
   as automatic (mig 385 is prod-pending: the build depends on it); the public query that hides cancelled games; the
   generator route's one-venue limit; for 11b, `club_schedule_slot_id` is absent on `league_practices` (it exists on
   `rep_team_events`, mig 326) and `lib/club-schedule-server.ts` refuses a league admin today by design; "one model of time"
   means **no second slot table**; and 11b's walk is §L-b.
7. **Records, same unit of work:** the plan's §4 9d-2 row and status log ("drawn, asks open", the link), the PM brief, the `s9`
   entry in the Club Tier project index (artifact `MBKRySURVFu3V9cZJvmjVr`: read `stages/s9` first, pin `if_version`, say
   `ruled` only after the owner rules), the auto-memory file `project_club_stage9_house_league.md`, **and 11b's own lines**: the
   Stage 11 notes in `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` and the readiness plan's Stage 11 row must say "11b drawn with 9d-2,
   not built", so it is never again summarised as closed. Record rulings as ruled.

## Do not

- Build, migrate, seed, or touch AWS or DNS.
- Use the design canvas, or publish an empty artifact.
- Reopen Q11, 9d1·4, Q12c, 9c's service-mode notices, the Stage 10 permit rule, or the 6c C-recipe rulings. Push back only
  where a frame exposes a real conflict, and name the conflict.
- Draw game day, scores, standings or the rainout action (9e), season end or Start next season (9f), coach-entered permits
  (Stage 10 Ask 28), or a screen for a finished season's schedule.
- Redraw the rep-team scheduler (11a, 11c, 11d) or reopen its rulings (Stage 11 Asks 3 and 6, "one model of time"). It appears
  only as the unchanged neighbour of 11b's frames.
- Add `module_families` to any role's defaults.
- Restate a plan name, price or gate: point at `docs/agents/strategy/PLAN_PRICING_FACTS.md`.
- Promise timing anywhere.

## Definition of done

The drawings page is published and linked from the plan. `/ux` and `/design` have run and their changes are reported. Every
frame in item 2 is drawn in its empty, working and edge states, **11b's included**. Asks 1–6 are answered with a recommendation,
and the page says whether 9d-2 is one build or several and what order the builds go in. The records say "drawn, asks open" for
both 9d-2 and 11b. A 9d-2 build prompt (or the first of several), and later an 11b build prompt, can be written from the owner's
answers without re-deciding anything or redrawing the schedule screen.
