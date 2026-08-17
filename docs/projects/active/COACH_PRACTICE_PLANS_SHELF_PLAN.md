# Practice plans shelf — P3 of history-in-place

**Status:** BUILT 2026-08-16 — C1 committed `58d96ce0` on its own; C2 + C3 committed together.
Awaiting owner QA (ledger §41).
**Parent:** `COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md` §5 P3 — the owner-gated shelf phase
(ruling §1.6: every history shelf gets its own mockup session, and the current season stays the
primary focus).
**Decision record:** mockup artifact
`https://claude.ai/code/artifact/f42be4f3-29f3-4bb6-80a5-09fc736c208f` — owner accepted the
recommendation verbatim.
**PM brief:** `COACH_PRACTICE_PLANS_SHELF_PM_BRIEF.md`.
**Session prompt that produced it:** `COACH_PRACTICE_PLANS_SHELF_MOCKUP_PROMPT.md`.

---

## 1. What the session found, and why the phase is a different shape than its plan line

The parent plan's P3 line reads *"re-homes the read-only past-plan view + copy-forward"*, which
implies a missing capability. **Read against the code, it is not missing.** Three findings, each
read out of the shipped source rather than a plan:

1. **⚠⚠ A LIVE DEFECT ON THE SCREEN THE SHELF WOULD SIT NEXT TO.**
   `app/[orgSlug]/coaches/teams/[teamId]/practice/page.tsx` renders a bespoke `page.isReadOnly`
   empty state saying *"A finished season keeps its schedule, attendance and records — **but not the
   plans**"* and *"**Switch back to your current season** to plan a practice."* Both clauses are
   false as of P2:
   - The plans **are** kept, and the Development report on that same finished season links straight
     to them (`history/development` → "Practices you've run" → "Open the plan →").
   - There is no season switcher — deleted 2026-08-16 — and a between-seasons team has no current
     season to switch to.

   This page was **not** in P1's `CoachNotOnTeam` sweep (which covered `practice/[eventId]` and
   `practice/[eventId]/run` but not the hub), and P2 made the nav door always-visible, so this is
   now the first thing a between-seasons coach reads about their plans. **It is most of the
   perceived gap: the product denies having the plans.**

2. **The reuse moment is served, badly.** The plan screen's `Start this plan from…` dialog already
   has two sources (a template / a previous practice). The previous-practice list comes from
   `getRepTeamEventsWithPracticePlans(programYear.id, …)` — **live season only**. So reusing last
   October means: Development → Plan templates → "Add from a past season" → import → back to the
   practice → start from the template. Five steps, and it permanently grows a library the coach may
   not have wanted to grow.

3. **The two cross-season doors that already ship are on no guarded list.**
   `development/drills/past-seasons` and `development/plan-templates/past-seasons` both call
   `getRepTeamPracticePlansAcrossSeasons(teamId)` — every season the team has ever had. Each route's
   own header claims it *"is a CROSS-SEASON READER, which the guard test lists separately"*.
   **Neither is listed.** `CROSS_SEASON_READERS` is keyed on `resolveCoachTeamCapabilities`, which
   neither route calls, so the guard cannot see them. No live harm; the harm is that a future
   session reads those comments and believes a build-enforced record exists.

   Related, smaller: `drills/past-seasons` still gates through `getCoachingAssignmentsForUser`
   (the legacy assignment lookup) rather than membership — the same tail as parent plan §8.3's
   `tryout-report`. The projection invariant makes them agree today.

**The gap, stated precisely:** a plan and its recap stay readable up to the moment the next season
starts, because the list that leads to them resolves the working season. **Not "no way to read an
old plan" — "no way once the new season begins."** One screen wide.

---

## 2. The shape approved

Three chunks, in this order. C1 is a defect fix and does not wait for the rest.

### C1 — Say the true thing (no design decision, no allow-list change)

1. **Rewrite the Practice plans hub's between-seasons state.** It must say the season has finished,
   that planning resumes with the next one, and that everything written is still here — with a
   working door to the practices that were run. It must not mention switching seasons.
   ⚠ Do **not** simply swap in `CoachNotOnTeam`: that component's copy is right for a live
   *instrument* that has nothing to show, and this screen genuinely does have something to show. Its
   sibling `practice/[eventId]` keeps `CoachNotOnTeam` — a single past practice reached by URL is
   the instrument case.
2. **Correct the stale route notes.** `events/[eventId]/practice-plan/read`'s header still describes
   a `?year=` it no longer takes and claims membership of an approved list it is no longer on
   (P2 moved it to `resolveCoachTeamRead`). Both `past-seasons` routes' "the guard lists this"
   claims are false until C2 makes them true.
3. **Make the claim true.** Give `coach-history-endpoint-guard.test.ts` a second, narrow detector
   keyed on `getRepTeamPracticePlansAcrossSeasons` — the one named function that means "reads every
   season's plans" — with its own enumerated list (initially the two `past-seasons` routes).
   ⚠ Key it on that function, **not** on "reads more than one year", for the reason the existing
   list states: a noisy guard gets edited until it passes.
4. **Delete the two dead `useCoachSeasonPage` calls** left by P2's chip removal, in
   `history/development/page.tsx` and `history/development/practices/[eventId]/page.tsx`.

### C2 — A third source in the copy picker (no allow-list change)

Add **"A past season"** beside "A template" and "A previous practice" in `Start this plan from…`.

- Rows are the team's own past-season practices that carry a plan, **each labelled with its season
  name and date** — a row must never be mistakable for this year's work.
- Head-coach-only, matching both existing imports and the dialog's own `canWrite` gate — everything
  this list can do is write tonight's plan.
- It is a **cross-season reader, not a history endpoint**: it derives its seasons from the team's own
  data, is never handed one, reads records and writes only into the live plan. Same power as the
  drill and template imports. It joins C1's new enumerated list — so **this chunk is a net increase
  in what the build enforces.**
- ⚠ Exclude the live season (the "A previous practice" tab already covers it) for the reason both
  imports state: offering the same practice under two tabs lets a coach copy it twice.

### C3 — "The practices you ran" on Season's End (two allow-list entries)

Each finished season's Season's End page grows **one collapsed section**, below the Wrapped card and
the existing look-back doors: the practices that season, each row opening the read-only plan page
that already ships.

**The three questions, answered in full** (required before either allow-list entry):

1. **Record or instrument?** **Record.** A plan renders entirely from its own jsonb — Phase 2's
   copy-on-add means editing a drill today cannot rewrite what June's practice says. Nothing here
   runs a tryout, moves money, messages a family or configures the team. The instruments around it
   (drill library, plan-template library, tag vocabulary) stay live-season-only; those decided
   absences are untouched.
2. **Does the whole subtree carry the year?** **Yes, and it is one level deep by construction.** The
   section lists; a row opens the plan; the plan's only link goes back. There is no second level for
   a Chunk-F-class defect to hide on. ⚠ The plan page's back link currently hard-codes
   `history/development` — it must return to wherever the reader came from, carrying the season.
3. **Could the coach tell which season they are reading?** **Yes, structurally.** Season's End is a
   page about one named season and titles itself that way. This is the only shape that answers
   without a label, which matters because the chip that used to answer it was a season switcher
   wearing a label.

---

## 3. What was rejected, and why (recorded so it is not re-proposed)

**A collapsed "From past seasons" drawer on the Practice plans hub.** Rejected on the governing
constraint first: it is the only proposal that puts weight on a live screen (~90px — a 47px section
heading plus a 44px tappable summary — displacing ~1.4 practice rows at 390px). It also fails on
merit: it serves the reuse moment, which C2 serves better and closer to the point of use, and it
would sit directly above the Plan templates door as a second entrance to one library — the
"two lists of the same library eventually disagree" failure that hub's own design already warns
against.

**Also out of scope, deliberately:** anything that points the portal at a past year; awards or
certificates on a finished season (still homeless, parent plan §7); the money book (P4, its own
gate).

---

## 4. Costs, measured from the shipped stylesheet

| Change | Live screen @390px | Desktop | Where it does cost |
|---|---|---|---|
| C1 rewritten message | 0px | 0px | A state no live season renders |
| C2 third source tab | 0px | 0px | ~44px **inside the dialog** at 390px (three tabs wrap; `.ppSourceTab` min-height 44px) |
| C3 collapsed section | 0px | 0px | ~90px on Season's End, which no live season renders |
| ~~Hub drawer~~ (rejected) | ~90px | ~90px | The Tuesday screen |

Derived from: `.sectionKicker` 47px, `.ppSourceTab`/tap-target 44px, `.lineupFrontRow` ~66px,
`.seasonDoorRow` ~41px.

---

## 5. Risk — it sits in the list, not the plan

The plan page ships and is proven; the new surface is the list. Three specific ways to get it wrong:

1. **⚠ A silent cap lies about the season.** `getRepTeamPracticePlansAcrossSeasons` caps at 400 and
   `getRepTeamPracticesWithPlanOrRecap` caps too. A season list that truncates tells a coach they
   ran fewer practices than they did. Either scope the read to one season so the cap cannot bite, or
   state the truncation.
2. **⚠ The gate must match its own door.** The existing read route gates on
   `canViewSchedule && hasRecordAccess` **precisely so a helper who turns up to run one station
   cannot type the URL** — and its header records that the gate and the entry point must move
   together. A second entry point on Season's End must carry the same pair. Season's End itself
   currently gates on `hasRecordAccess` alone; the schedule half is the addition.
3. **⚠ A cancelled practice did not happen.** The read route 404s them and the Development report's
   list excludes them. The new list must too, or a called-off night appears in the record complete
   with who was assigned where.

Fourth, lower: `getRepTeamPracticesWithPlanOrRecap` includes practices with a recap but no plan
("either, not both" — deliberate). The Season's End list should follow that rule, and rows without a
plan must not offer a link that 404s.

---

## 6. Tests — rewritten, never deleted

- `coach-history-endpoint-guard.test.ts`: the new cross-season detector + its list (C1); then
  `HISTORY_ENDPOINTS` gains the season practices list and the read route, and `HISTORY_PAGES` gains
  the past-plan page, **each with the three answers written at the list** (C3). The decided-absence
  blocks (drills, plan templates, opponents, club book, playing time) are untouched and must stay
  green — C2 must not make the *libraries* season-aware, only the copy source.
- `coach-finished-season-surfaces.test.ts`: the Season's End section is collapsed by default and
  read-only; the cancelled-practice exclusion; the helper gate.
- The membership smoke gains: a helper (schedule, no record access) is refused the Season's End
  practices section and the plan behind it.
- ⚠ The layout fixture's *UAT Between Seasons* team already has finished seasons and games — it
  needs **practices carrying plans** before `check:layout` can see any of this. Reseed with
  `node scripts/seed-uat-coach-fixture.mjs` before the sweep (it throws with that repair command
  rather than passing quietly).

---

## 7. Verification & sequencing

- **C1 ships first and alone.** It is a defect fix with no design surface; holding it behind the
  shelf leaves a false sentence on a live screen.
- `npm run verify:changed` per chunk; `npm run typecheck` (C2/C3 touch shared read modules);
  `/simplify` before `/review` if C2+C3 land together (C2 adds a third branch to an existing
  two-branch picker — duplication risk); `/docs` sweep for the practice-plans help section, whose
  wording about finished seasons follows C1's correction.
- **No migration.** Every read is over existing columns.
- Owner QA: one new ledger section at build time, walked with three sign-ins (head coach, assistant
  with record access, helper without) on a between-seasons team **and** a team that has rolled
  forward — the second is the case the whole phase exists for.

---

## 7b. What the BUILD found that this plan had wrong (2026-08-16)

Recorded here rather than silently corrected, because §1 of this plan exists for exactly this
reason: the mockup session found three things the plan LINE got wrong, and the build then found
three things this plan got wrong. The code won each time.

1. **⚠ C1's "working door" would have 403'd the person §5 risk 2 is about.** §2 C1.1 says the
   rewritten message must carry "a working door to the practices that were run" — the Development
   report. But the Practice plans hub opens on `schedule` alone, while that report's route requires
   record access. A helper reaches the hub, so the plan as written would have swapped a false
   sentence for a link that refuses them. **Built:** the door is gated on record access; everyone
   else gets the true half without one.

2. **⚠ The new cross-season list has FOUR entries, not the two §2 C1.3 predicted.** It says
   "initially the two `past-seasons` routes". Both LIBRARY list routes also call
   `getRepTeamPracticePlansAcrossSeasons`, walking every season's plans to count "used 8×". A
   two-entry list would have failed on its first run. **Built:** four, with the reason at each.

3. **⚠ A recap-only row is not a link that 404s.** §5's fourth point says rows without a plan "must
   not offer a link that 404s". Read against the read route, it 404s only a cancelled practice, a
   foreign season and a non-practice — a plan-less practice opens and shows the recap. Since the PM
   brief promises a coach can still read "what they ran **and what they wrote about it**", leaving
   those rows dead would have honoured the letter and lost the point. **Built:** every row links,
   and the row says which it is ("No plan written — your note about how it went").

**One thing the plan did not anticipate at all, found while building C2.** "Start this plan from…"
is offered only when there is something to start from, and that test was "a template, or another
practice this season". So the coach C2 exists for — first practice of a brand-new season, no
templates yet — would never have seen the button. Fixed with one boolean on the plan GET
(`hasRepTeamPastSeasonPracticePlans`); no past plan is fetched or parsed on the everyday path. That
boolean is a second way to reach outside the working season, so the guard's detector matches BOTH
function names and the live plan route joins `CROSS_SEASON_PLAN_READERS` — a guard keyed on one
name would have gone blind to the second, which is the failure that file has a whole test about.

## 8. Follow-ups this session opened but did not fix

1. `drills/past-seasons` gates on the legacy assignment lookup rather than membership (parent plan
   §8.3's tail, a second instance). **Still open** — recorded in that route's own header at build
   time so the next reader finds it there rather than only here.
2. ~~The read route's back link hard-codes one destination~~ — **fixed in C3.** The page reads an
   explicit `from=season-end` marker rather than inferring the origin from the presence of a year,
   because Season's End showing the team's own working season carries no year at all.
3. Reprinting an award certificate for a finished season remains homeless (parent plan §7) — no
   moment has named it, and this phase does not create one.
4. **New:** the `season-practices` cap is stated rather than removed. A season holding more than 200
   practices with a plan or a recap is implausible, so the honest notice is the right cost; if a
   real team ever trips it, paging is the fix, not a bigger number.
