# Coach membership & history-in-place — Design A on M1

**Status:** APPROVED 2026-08-16 (owner). **P1 `8415dcd2` · P2 `fd7c2c3e` · P3 (C1–C3) — ALL ON PROD
2026-08-17, Amplify job 257** (the season toggle and the archive place are out; mig **245 applied to
prod** that day). ✅ **Owner QA §39 · §40 · §42 · §52 — CLOSED BY THE OWNER 2026-08-17** (accepted after the §53 walk, which found and fixed two defects; a page-by-page DESIGN pass follows — see §9).
**Decision record:** mockup artifact `aa758bcb` (R1, §10 verdict) — owner accepted the recommendation
verbatim: **Design A** (the season toggle and archive-place are deleted; history is delivered inside
live tools + Season's End) on **M1** (staff membership lives on the TEAM, not on season rows).
**PM brief:** `COACH_MEMBERSHIP_HISTORY_IN_PLACE_PM_BRIEF.md`.
**Supersedes:** `COACH_CURRENT_STAFF_ACCESS_PLAN.md` (its rulings are absorbed here; its
"latest-season-rows" access definition is replaced by M1 — see §2), the Chunk F frozen-season
architecture, and the archive-rail season-toggle work (`COACH_ARCHIVE_RAIL_PLAN.md` Phases 1–2's
season-switching half; its live-season defect fixes are KEPT — see §6.3).

---

## 1. The owner rulings this plan is built on (all 2026-08-16 unless noted)

1. **Design A**: no season toggle, no archive menu, no frozen-season portal. History reaches a coach
   three ways only: Season's End / Season Wrapped / the every-season compare list; the six existing
   surgical surfaces; and named in-tool shelves (v1: practice plans + money book).
2. **M1**: membership (role + capabilities + active/revoked) attaches to the person-on-the-TEAM.
   Seasons keep a staff *record* (who coached that year) that grants nothing and is never managed.
3. **Removal revokes access without deleting the record** (ruled with the earlier plan; unchanged).
   Re-adding restores access.
4. **Capabilities are the coach's current ones, everywhere** (ruled earlier; unchanged — and under
   M1 there is only one set of capabilities anywhere, so the rule holds by construction).
5. **v1 reference pieces = Practice plans shelf + Money past-season book.** Everything else ships
   with NO historical access until a real moment names it.
6. **⚠ NEW — per-screen planning gates:** each history shelf (practice plans, money, and any future
   piece) gets its **own detailed planning session with mockups, approved before build**. Binding
   design constraint for those sessions: **the current season is always the primary focus** — the
   historical layer must be quiet (below the live content, collapsed/on-demand, never default-open,
   never stealing the page's first read). A shelf that makes the live screen noisier is a failed
   design regardless of how useful the history is.
7. Standing rulings that survive unchanged: playing-time analytics are PERMANENTLY live-only
   (2026-08-16); drill/plan-template libraries, opponent scouting book, club shared book are
   instruments and never become archive surfaces (2026-08-01/04); Season Wrapped carries no money
   and no PII beyond first-name+number.

---

## 2. The M1 data model

New table (migration — take the next free number at build time):

```sql
rep_team_staff_memberships (
  id uuid pk,
  org_id uuid not null references organizations,
  team_id uuid not null references rep_teams,
  user_id uuid not null references auth.users,
  coach_role text not null check (coach_role in ('head_coach','assistant_coach')),
  capabilities jsonb,              -- null = role defaults, same semantics as today
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz, revoked_by uuid,
  unique (team_id, user_id)
)
```

- **Backfill:** one membership per user from their row on each team's LATEST program year (any
  status). Users holding only older-season rows get NO membership — that is the point (ex-staff
  lose access the day this ships). No live clients; no compatibility shim.
- **`rep_team_coaches` becomes the season RECORD + live-season projection.** Closed seasons' rows
  are never touched again (they are the "who coached 2024" fact). The LIVE season's rows are
  maintained as a mirror of active memberships (dual-write on add/remove/role-change) so the ~54
  write routes that resolve `getCoachingAssignmentsForUser` → active-year row keep working with
  ZERO edits. ⚠ The mirror is a projection, not a source: nothing may ever READ capabilities from a
  row when a membership exists — capability resolution goes through membership only.
- **Rollover** (both paths): stops copying staff as an access act; instead it (a) writes the new
  season's record rows FROM active memberships (so the new season names its staff and the write
  routes see their rows), and (b) never touches capabilities — the yearly silent reset of custom
  grants dies here. The org-admin manual per-year coach add/remove becomes membership add/remove
  (admin UI touches this — see §5 P1 scope).
- **Access rule, one sentence:** *a signed-in user may open a team iff they hold an ACTIVE
  membership on it; what they see is their membership's capabilities; the working season is the
  team's latest program year regardless of status; a completed/archived working season renders
  read-only.* This single rule replaces the live lookup, the closed lookup, the season-read rail's
  gate, and the per-season capability map.

## 3. What gets deleted (Phase 2)

- `lib/coach-season-read.ts` (the rail) and every `?year=` read in the ~30 approved routes — they
  revert to working-season resolution. The tag factory's `seasonAwareRead` flag goes.
- `CoachSeasonChip`, the sidebar season `<select>`, the phone "More" season list, the masthead
  archive branch, `CLOSED_TEAM_NAV_ITEMS` / `CLOSED_SECTION_EXTRAS` / `LIVE_ONLY_ARCHIVE_SECTIONS` /
  `archiveHasSection` / `resolveSeasonSwitchHref` and the `?year=` plumbing in `coach-season-view`
  (the page resolver itself survives, simplified to live+working-season duty — ~30 live pages
  import it).
- The `history/*` pages' `isRecord` halves. The live Insights hub, results report, awards report,
  attendance report, and the compare list + Season Wrapped links all SURVIVE as live-season
  surfaces.
- `season-end/page.tsx` SURVIVES (post-season landing + look-back door + start-next-season); it
  stops being reachable via a season dial and is reached by: automatic landing when the working
  season is closed, and per-year links from the compare list.
- The scrapbook head-coach-only restriction `12cf1b19` is reverted (11 files, +254/−12) and ledger
  §37 D2 retires with it (already ruled).

## 4. Tests: rewritten, never deleted (the standing lesson)

- `coach-season-write-guard.test.ts` → **`coach-history-endpoint-guard.test.ts`**: same fs-scan
  mechanism, new contract: (1) NO route under `app/api/coaches` may read a season/year parameter or
  resolve a non-working season EXCEPT the enumerated `HISTORY_ENDPOINTS` allow-list — initially
  `{wrapped, history (compare list), events/[eventId]/practice-plan/read}`, growing only via the
  gated shelf phases; (2) every write verb still resolves an inspectable body (vacuous-pass guard
  kept); (3) the decided-absence blocks (drills, templates, opponents, club book, playing-time)
  survive re-worded — they now assert those modules never join HISTORY_ENDPOINTS; (4) history
  endpoints gate on ACTIVE MEMBERSHIP, asserted by source scan.
- `coach-archive-season-rail.test.ts` → deleted WITH its assertions redistributed: the stale-request
  generation-counter probes and the awards-scoping probe move to a live-season unit test; the rest
  asserted season-switching and dies with the feature, stated in the commit message.
- `coach-frozen-season-smoke.spec.ts` → **`coach-membership-smoke.spec.ts`**: revoked member is
  refused everywhere at the API (the old rule-3 probe, re-aimed); re-add restores; the
  between-seasons limbo state keeps every nav door working (the state that breaks Settings /
  Announcements today); Season's End reachable + read-only working season draws no write controls;
  Wrapped/compare gated by membership + current capabilities.
- ⚠ The rendered layout fixture has NO completed season — that gap hid the original defects and
  would now blind the Season's End / compare / shelf surfaces. Phase 2 adds a completed season to
  the fixture world.

## 5. Phases

- **P1 — Membership (M1).** Migration + backfill; `lib/coach-membership.ts` (the one access rule);
  staff screen de-seasoned (one list, Remove revokes everywhere with the new dialog copy, re-add
  restores); invite/accept + org-admin coach management write memberships (+ live-row mirror);
  rollover writes record rows from memberships; Settings + Announcements (and any other bare
  live-assignment page found by sweep) move to the uniform rule; player-documents endpoint gains
  the membership gate. Fixture probes for revocation rewritten. **No archive changes yet** — the
  rail temporarily gates on membership (one-line change) so nothing leaks between phases.

  **P1 build state (2026-08-16, this session): ✅ COMMITTED `8415dcd2`** (68 files; the money-tab
  session's concurrent edits were hunk-excluded from the three shared files). Everything above is
  BUILT except the tail below. **P2 handoff prompt:**
  `docs/projects/active/COACH_MEMBERSHIP_P2_ARCHIVE_REMOVAL_PROMPT.md`. Mig 245 APPLIED to dev (+dictionary +snapshots); typecheck ✓; 2,048 unit
  tests ✓; Staff also LEFT the archive (door, allow-list entries, rule-3 write exception — the
  per-season "remove access" control retired with the model, so keeping the door would have made
  its Remove button lie).
  - [x] **The bare-gate sweep — DONE (12 files + `components/coaches/CoachNotOnTeam.tsx`).**
    One shared component owns the branch (member-with-finished-season → "This season has
    finished" + Season's End link; everyone else → the honest not-assigned). Applied to:
    `accounting/allocations/panel`, `accounting/payment-requests/panel`, `development/drills`,
    `development/templates`, `development/templates/[templateId]`, `history/opponents`,
    `history/opponents/[opponentKey]`, `history/playing-time`, `lineups/templates/[templateId]`,
    `lineups/[eventId]`, `practice/[eventId]`, `practice/[eventId]/run`. (`game/[eventId]` was a
    false positive — it reads assignments only for the sport pack and has no gate sentence.)
    Announcements + Chat keep their bespoke notes (surface-specific copy).
  - [x] **`/simplify` run 2026-08-16 (4 lenses), 18 findings applied, all green after
    (typecheck ✓ · 2,057 tests ✓ · lint 0 errors).** The keepers: `resolveWorkingProgramYear` +
    `requireHeadCoachMembership` extracted (the working-season fallback and the head-coach gate
    each had 3-4 hand copies); one shared identity-enrichment recipe in db.ts; membership add is
    one upsert; every "fetch the list to find one row" became a point query on the
    `(program_year_id, user_id)` unique index; the rail resolves team+year+membership in ONE
    round trip (hot path, ~30 routes); two dead functions deleted
    (`updateRepTeamCoachCapabilities`, `getCoachAssignmentCapabilitiesForTeam`); the season-row
    staff read no longer exposes `capabilities` at all (stale-projection reads now impossible to
    write); **admin's create-year now REVERTS if the staff projection fails** (a draft year is
    live the instant it exists — a silent projection failure made the team look between-seasons
    to its own staff, the altitude pass's one real posture bug); and a new
    `coach-membership-projection-guard.test.ts` makes the projection invariant build-enforced.
    The billing-access guard caught the resolver extraction and its rail list learned
    `requireHeadCoachMembership` — a decision-point edit, exactly as that contract intends.
    **Skipped, with reasons:** collapsing the capability map to a single value (3 callers get
    reworked in P2 anyway — do it there); a copy-override slot on `CoachNotOnTeam`
    (announcements/chat's bespoke notes are pre-existing local chrome; P2 horizon);
    `getOrgAssistantCoaches`' third copy of the enrichment recipe + tryout-report's pre-existing
    double gate (both outside this diff — follow-ups). **Flagged to owner, recorded as intended:**
    a REVOKED former head coach who accepts an assistant invite reactivates as an ASSISTANT —
    the invite names the seat; reactivation restores grants, never the role.
  - [x] **`/review` run 2026-08-16 — high-risk tier, full funnel.** Stage 0 all green or
    attributed (typecheck ✓ · 2,060 tests ✓ · lint ✓ · css-purity ✓ · check:demos ✓ · rendered
    check PASSED scoped to coach-staff + coach-announcements ×4 widths; the --changed full-sweep
    widening aborted at the shared server's memory floor and was rerun scoped — stated, not
    silently skipped; schema-parity red = expected dev-only drift, migs 236–245). Five lenses →
    ~30 findings → adjudicated in the main loop. **Confirmed & FIXED same day:**
    · CRITICAL — new standalone-team provisioning minted the coach row but NO membership: every
      new signup 403'd from Settings/staff/seasons/documents from minute one. Provisioning now
      goes through `addStaffMember` and reads the projected row back.
    · HIGH — remove-vs-readd race could strand a REVOKED coach with a live projection row
      (writes admitted all season, nothing self-heals). Removal now deletes the row FIRST and
      heals on re-click; the sync deletes rows for revoked memberships, tolerates insert
      collisions (23505 → converge), and re-checks the membership after inserting.
    · CRITICAL-mechanism — the live-year lookup swallows DB errors to null; removal/sync now use
      a STRICT resolver that throws instead of skipping the one write that blocks a removed coach.
    · HIGH — season-creation projection collisions used to nuke the whole just-created year
      (cascade) — projection is idempotent now; admin create-year still reverts on REAL failures.
    · HIGH — client/server disagreed on the scrapbook gate ("ever" vs "current" head coach): a
      demoted head coach was shown doors the server wouldn't fill ("None yet" lie). Client now
      derives from the CURRENT role; the rail guard test re-pinned to the new rule.
    · Grants PATCH re-asserts team+active+assistant in its WHERE (check-then-act discipline);
      remove callers surface the removed:boolean; oversight remove verifies role/tenancy against
      the MEMBERSHIP; per-year admin staff endpoints refuse non-current-season years (two-open-
      years misfile); guest-org-membership cleanup asks memberships (its row-based premise
      expired with M1); `{}` grants can't wipe stored bundles; org_id asserted in revoke WHERE.
    · Seeds/fixtures: demo, UAT-fixture, QA-day seeds + create-uat-accounts.sql now mint
      memberships; check-demo-coach asserts an active membership per team; the dangerous help
      article ("Staff on a finished season") rewritten to the new removal semantics; stale
      comments/docs corrected (history route, tryout-memory R8, PHASE2 prompt, dictionary anchors).
    **Deferred with reasons (not silent):** 11 UAT spec fixtures still mint rows without
    memberships — fix before the next `/uat` run: coach-sponsor-money-lifecycle,
    team-tournament-game-mirror-smoke, coach-money-mobile-smoke, family-guardian-tier-boundary,
    family-access-boundary, tryout-blindfold-boundary, coach-record-access-boundary,
    family-recap-boundary, coach-findability-smoke, coach-schedule-smoke, coach-tryouts-smoke.
    Pre-existing, noted for backlog: two-drafts create TOCTOU (admin create guard ignores
    'draft'); staff panel's whole-bundle last-write-wins PATCH (M1 makes clobbers durable —
    consider a version guard); no behavioral/DB test exercises the membership lib (static guards
    + UAT smoke only); multiple head coaches remain representable (pre-M1 too) — owner nuance.
  - [x] Owner-QA ledger **§39** added (three sign-ins + the new-signup pass). `/docs`: the
    load-bearing staff article fixed inline; the full help sweep rides P2, where the archive UX
    changes wholesale.
- **P2 — The place comes out.** Everything in §3 + §4; demo re-script (tour step 7 + dock line +
  `check-demo-coach` section 6 — the 13U world keeps working, landing on Season's End); CLAUDE.md
  archive section REPLACED with the new contract (same unit of work); ledger §36/§37 retired with a
  salvage note (awards-count fix + live-hub regression checks fold into the new QA section); help
  docs updated (`/docs`); old plans moved to archive.

  ### P2 build checklist (2026-08-16 session — the ordered execution)

  **Three corrections to the handoff prompt, made from the code rather than the prose:**

  1. **The rail module is RENAMED, not deleted.** `lib/coach-season-read.ts` minus its `yearId`
     option IS the working-season read context — team + working year + membership + read-only, in
     ONE round trip, shared by ~26 GETs. Deleting the file would hand-roll P1's team-route pattern
     26 times, which is the drift this repo has paid for repeatedly. It becomes
     **`lib/coach-team-read.ts`**: `resolveCoachTeamRead(orgSlug, teamId)` (no `Request`, no year),
     plus `resolveCoachHistoryRead(orgSlug, teamId, yearId)` for the two enumerated history
     endpoints and `resolveCoachTeamCapabilities(org, userId, teamId)` replacing the per-year
     capability map (uniform since M1). **Season CHOICE dies; the shared resolver survives.**
  2. **Tour step 7's promise is NOT falsified by this phase.** The 13U demo team has no live year,
     so its WORKING season is the finished one — every record screen still opens read-only, exactly
     as the sentence claims. What over-claims is the word *every*: drills, playing time, payment
     requests and the other live instruments already refuse today (P1's `CoachNotOnTeam`). The copy
     is rewritten for that reason, not for a breakage that does not exist.
  3. **`/season-end?year=` SURVIVES**, and must. The compare list's per-year "Season Wrapped →"
     links are the look-back layer's only route to a year that is not the working one. So exactly
     one explicit year parameter remains, on the look-back surface alone, and it is enumerated in
     the new guard's `HISTORY_ENDPOINTS`.

  **The nav decision, argued from P1's own code.** The prompt's "LIVE nav shape routed to what still
  exists" resolves to: **one nav, every door, always** — plus a `Season's End` door when the working
  season is finished. P1 already built the honest state for the live-instrument pages
  (`CoachNotOnTeam`: *"This screen is part of running a live season, and it comes back when the next
  one starts"* + a Season's End link), and P1 already made the team/settings route fall back to the
  newest closed season. That is not a dead-end, so CLAUDE.md's "hide the entry point" rule does not
  bite; a second, shorter menu that appears when a season ends is the thing that was confusing.

  Ordered:

  1. `lib/coach-team-read.ts` replaces `lib/coach-season-read.ts` (above).
  2. `lib/coach-tag-routes.ts` — `seasonAwareRead` deleted; every GET resolves the working season,
     every write keeps `resolveLiveCoachTeamContext`.
  3. The ~26 route call sites: `resolveCoachSeasonRead(o, t, req)` → `resolveCoachTeamRead(o, t)`.
     `wrapped` moves to `resolveCoachHistoryRead`; `history` + `tryout-report` to
     `resolveCoachTeamCapabilities`.
  4. `lib/coach-season-view.ts` — `seasonQueryFor`, `resolveSeasonSwitchHref`, `seasonStatusLabel`,
     `buildCoachSeasons`, `resolveSeasonView`, `SeasonView`, `CoachSeasonOption` all go. The page
     resolver survives as `resolveCoachSeasonPage(ctx, orgSlug, teamId)` — no year, no `query`, no
     `everHeadCoach`.
  5. `lib/coaches-context.tsx` + `lib/types.ts` + both layouts + `assignments` route — the `seasons`
     seed is DELETED (it existed only to feed the switcher; `assignments` ∪ `closedAssignments` is
     already exactly the working season per team).
  6. `CoachesSidebar` / `CoachesBottomNav` — closed branches and season switchers out; Season's End
     door in when the working season is finished. `CoachSeasonChip` deleted; `CoachPageHeader` loses
     `season` / `teamBase` / `chipExtraQuery` (~20 callers).
  7. ~24 pages: drop `useSearchParams().get('year')` and every `${page.query}`.
  8. `history/results` + `season-end` — the scrapbook gate reverted (all current staff), Season's End
     keeps `?year=` for the compare list's Wrapped links.
  9. `lib/coach-nav-visibility.ts` — `CLOSED_TEAM_NAV_ITEMS`, `CLOSED_SECTION_EXTRAS`,
     `LIVE_ONLY_ARCHIVE_SECTIONS`, `archiveHasSection` deleted. The playing-time / opponents rulings
     keep their build-enforced home in the guard test, and the Insights hub hides those two tiles on
     a finished season with the ruling named at the tile.
  10. Tests: `coach-season-write-guard` → `coach-history-endpoint-guard`; `coach-archive-season-rail`
      retired with its keepers redistributed; the frozen-season smoke finishes its rename to a
      membership smoke; the 11 UAT fixtures gain memberships.
  11. Demo re-script + `check-demo-coach` section 6 wording; `check:demos` proves it.
  12. CLAUDE.md replacement, ledger §36/§37 retirement + the P2 section, help sweep, TODO/memory.
  13. The layout fixture gains a completed season so Season's End and the compare list are rendered.

  ### P2 build state: ✅ **committed `fd7c2c3e` 2026-08-16** — awaiting owner QA §40

  Landed alongside the money-tab session's in-flight rework in the same working copy. Nine files were
  shared; five were rebuilt from HEAD with only P2's edits applied so their unfinished work stayed
  uncommitted, and the split was **proved by materialising the staged tree in a scratch worktree and
  typechecking it there** — which is what caught four files that had been mis-attributed to P2 and
  one help passage the sweep had missed. Verified in that isolated tree: typecheck ✓ · 2,020 unit
  tests ✓.

  ⚠ **STILL OWED: the rendered baseline for the five new finished-season screens** — the run needs a
  quiet dev server and a warmed route set. See §5 P2 checklist item 13 and the follow-ups in §8.

  Everything in the checklist above is done. Gates: typecheck ✓ · **2,032 unit tests ✓** ·
  `check:demos` ✓ · CSS purity ✓ · token/contrast/date ratchets ✓ · dictionary ✓ · lint 0 errors.
  Schema-parity is red for the dev-only migrations 236–245, which are other sessions' and pre-date
  this phase — **no migration in P2**.

  **The shape that came out of it:**
  - `lib/coach-season-read.ts` → **`lib/coach-team-read.ts`**: `resolveCoachTeamRead` (working
    season, 23 routes + the tag factory), `resolveCoachHistoryRead` (the ONE year-taking resolver,
    used by `wrapped` alone), `resolveCoachTeamCapabilities` (replacing the per-year capability
    map, which M1 had already made uniform). `seasonAwareRead` deleted from the tag factory.
  - `lib/coach-season-view.ts` reduced to `resolveWorkingSeason` + `resolveCoachSeasonPage`;
    `seasonQueryFor`, `resolveSeasonSwitchHref`, `seasonStatusLabel`, `buildCoachSeasons`,
    `resolveSeasonView`, `SeasonView` and `CoachSeasonOption` all deleted. The `seasons` array is
    gone from the context, the assignments API and both layouts — it existed only for the switcher,
    and `assignments` ∪ `closedAssignments` already answers "the working season per team".
  - `CoachSeasonChip` deleted; `CoachPageHeader` lost `season`/`teamBase`/`chipExtraQuery` (20
    callers). The masthead's presentational "Complete" chip survives and is now the ONLY place the
    portal says a season has finished.
  - **One nav.** `CLOSED_TEAM_NAV_ITEMS`, `CLOSED_SECTION_EXTRAS`, `LIVE_ONLY_ARCHIVE_SECTIONS` and
    `archiveHasSection` deleted with both closed-branches. The landing slot swaps
    (Overview ⇄ Season's End) and nothing else moves.
  - The team layout stopped building the masthead record map for EVERY season — one working season,
    one year id, per team entry.

  **Three corrections to the handoff prompt, made from the code** (the reasoning is above): the rail
  module was renamed rather than deleted; tour step 7's promise was not falsified by this phase (it
  over-claimed *"every screen"*, which was already untrue); and `/season-end?year=` had to survive
  or the compare list's per-year Wrapped links break.

  **Tests: rewritten, never deleted.**
  - `coach-season-write-guard.test.ts` → **`coach-history-endpoint-guard.test.ts`**: same fs-scan,
    new contract (`HISTORY_ENDPOINTS` = `{wrapped}`, `HISTORY_PAGES` = `{season-end}`,
    `CROSS_SEASON_READERS` = `{history, tryout-report}`), plus a NEW client-side half that was
    impossible before — *no coach page may read `?year=`* — and an absence check that neither nav
    has grown a switcher back. The decided-absence blocks survive re-worded.
  - `coach-archive-season-rail.test.ts` → **retired**, keepers redistributed into
    **`coach-finished-season-surfaces.test.ts`** (read-only behaviour, past-tense empty states, the
    awards generation-counter guard, the certificate's own-season naming) plus new look-back-layer
    assertions. Its season-switching assertions died with the feature — stated in the commit.
  - `coach-season-view.test.ts` rewritten around `resolveWorkingSeason`.
  - `coach-attendance-home.test.ts`'s archive-menu block rewritten for the SECOND time by its own
    expiry condition — it now pins the property that survived both rewrites: the Insights hub is the
    attendance report's only parent and must carry its door.
  - `coach-frozen-season-smoke.spec.ts` → **`coach-membership-smoke.spec.ts`**, re-fixtured around a
    BETWEEN-SEASONS team (which the old fixture never had) plus a rolled-forward one. Its sharpest
    new probe: asking an ordinary route for a past year answers with the LIVE season.
  - The 11 UAT fixtures gained memberships via a shared `_coach-membership-fixture.ts` that
    **projects** them from the season rows each spec already writes, rather than making eleven specs
    restate the same grants a second time.

  **The fixture gap is closed.** `seed-uat-coach-fixture.mjs` now seeds a *UAT Between Seasons* team
  (two finished seasons, a roster, four finalized games), `uat-fixture-context.mjs` resolves it and
  REFUSES if it has grown a live year, and `layout-screens.mjs` gained five screens on it
  (Season's End, Insights, the compare list, roster, Money). ⚠ `check:layout` needs a dev server and
  a reseeded fixture — **run `node scripts/seed-uat-coach-fixture.mjs` before the next sweep**, or it
  throws with that repair command rather than passing quietly.

  **Owner QA: §40** (§36/§37 retired unwalked with a salvage note; §37 D2 retired outright with the
  restriction it gated).
- **P3 — Practice plans shelf. ✅ GATE PASSED and ✅ BUILT ON DEV 2026-08-16 — owner QA §42, no
  migration.** C1 committed `58d96ce0` on its own; C2+C3 `0e485b1a`; `/simplify` `a04e7c96`;
  `/review` fixes `d3e18f4e`. Plan of record:
  `docs/projects/active/COACH_PRACTICE_PLANS_SHELF_PLAN.md` (+ PM brief; build prompt
  `COACH_PRACTICE_PLANS_SHELF_BUILD_PROMPT.md`; mockup artifact `f42be4f3`). What the BUILD then
  corrected in that plan is recorded in its §7b — including two findings this line got wrong: C1's
  door had to be gated on record access (the hub opens on `schedule` alone, so a helper reaches it
  and the list behind it would have refused them), and the new cross-season list holds FOUR routes,
  not the two predicted — both library LIST routes walk every season's plans to count "used 8×".

  ⚠⚠ **The session corrected this plan's own P3 line from the code.** "Re-homes the read-only
  past-plan view + copy-forward" implied a missing capability; both ship. What it found instead:
  (a) **a LIVE DEFECT** — `practice/page.tsx`'s between-seasons state says a finished season keeps
  *"not the plans"* and tells the coach to *"switch back to your current season"*; the plans ARE
  kept (the Development report links to them) and the switcher was deleted in P2. That page was
  missed by P1's `CoachNotOnTeam` sweep and P2 made its nav door always-visible, so it is now the
  first thing a between-seasons coach reads. (b) The plan screen's copy picker reads
  `getRepTeamEventsWithPracticePlans(programYear.id)` — **live season only** — so reuse costs five
  steps through the template library. (c) Both `past-seasons` routes claim in their own headers to
  be listed in the guard test as cross-season readers; **neither is** (`CROSS_SEASON_READERS` is
  keyed on `resolveCoachTeamCapabilities`, which neither calls).

  **Approved shape, all three built:** C1 truth-up (shipped alone, no allow-list change) · C2 a
  third "A past season" source in `Start this plan from…` (cross-season reader, no
  `HISTORY_ENDPOINTS` entry, and it makes claim (c) true) · C3 a collapsed "practices you ran"
  section on Season's End (two `HISTORY_ENDPOINTS` entries + one `HISTORY_PAGES`, three questions
  answered at the list). **Rejected and recorded:** a drawer on the Practice plans hub — the only
  shape that costs the live screen (~90px, ~1.4 practice rows at 390px) and a second door to the
  template library.

  ⚠ **`/review` then found four defects in the shelf itself, all fixed in `d3e18f4e` and pinned by
  tests** — each one a screen telling a coach the wrong thing while rendering perfectly: the copy
  picker's past-season list survived a TEAM switch (and its "already asked" check refused to
  refresh, so team B was offered team A's practices, copied through the autosave); the shelf could
  render one season's practices under another season's wrap-up; a practice with an abandoned goal
  and no note was labelled as having a note; and the past-plan page had no stale guard at all,
  which `?year=` widened from wrong-event to wrong-SEASON.
- **P4 — Money past-season book. ✅ GATE PASSED and ✅ BUILT ON DEV 2026-08-17 — owner QA §52, no
  migration, no new route.** Plan of record: `COACH_MONEY_PAST_SEASON_BOOK_PLAN.md` (+ PM brief;
  mockup artifact `3cbb9ecd`). One collapsed **"How the season added up"** section on Season's End,
  below the practices shelf.

  ⚠⚠ **The session corrected this plan's own P4 line from the code, twice over.** "Read-only closed
  book" implied a missing capability: (a) **the entire money book already renders** for a finished
  season, all seven tabs read-only — a team BETWEEN seasons has it today, and what breaks is the
  ROLLOVER; (b) **every past season already carries three money figures** in the compare list; and
  (c) **Budget vs Actual is already the statement**, its three views unified on 2026-08-17.

  ⚠⚠ **And the finding that shrank the build: SIX OF THE SEVEN money tabs are INSTRUMENTS.** Payables
  marks commitments paid, Club creates and withdraws requests, Dues records payments, Fundraisers
  logs amounts, Budget and Transactions are editors. Exactly one — Budget vs Actual — is a record of
  what happened. So the shelf is that statement and nothing else; a season-aware money hub is
  **recorded as rejected**, being the deleted season dial in money's clothing.

  **Built:** the live `budget-vs-actual` route learns a year (⚠ REUSED, not rebuilt — a second
  statement endpoint would be a second walk of the same records, the exact defect fixed hours
  earlier); one `HISTORY_ENDPOINTS` entry with the three answers; the shelf renders **FLAT**, with no
  cell a link, because on the live screen those same figures are doors into the budget editor.

  ⚖ **Owner ruling 2026-08-17: past figures are CORRECTED, not preserved.** The report is derived and
  its arithmetic changed that day. Deliberately the opposite call to playing time, on the grounds of
  what each derivation is over — money records that cannot change, versus lineups being
  re-interpreted. **Not a precedent for playing time**, whose decided absence is untouched.
- **Adjacent, logged not built:** wire/warn the settlement-completeness check on season completion
  (books can seal with money outstanding today); documents retention stance → counsel; free-tier
  `basic_coach_*` model untouched by all of this.

## 6. Verification & risks

1. **Lock-out is still the expensive failure.** P1's membership rule must be probed in the limbo
   state (completed working season, no successor) and the mid-rollover state (draft + completed
   coexisting). Both live in the membership smoke.
2. **Dual-write drift:** the mirror row is write-only; add a unit test asserting no reader consumes
   row capabilities when a membership exists.
3. **Shared branch:** stage explicit pathspecs; bracketed dirs need `:(literal)`; check `git diff`
   per file before staging (two sessions have collided here before).
4. `npm run verify:changed` per phase; `npm run typecheck` (shared modules move); migration →
   DATA_DICTIONARY + `npm run refresh:snapshots` in the same unit of work; owner QA sections added
   to the ledger per phase (three sign-ins needed: head coach, current assistant, removed coach).

## 7. QA ledger

P1+P2 get one new ledger section each when built (next free § numbers at that time), replacing the
retired §36/§37 walk. §37 D2 retires now (restriction reverted in P2). The §36/§37 pieces worth
salvaging into the new sections: the awards "N this season" count fix, certificate printing the
award's own season (moves into the shelf-phase QA if awards ever get one; the live awards report
keeps the scoped count), and the live-hub regression checks.

---

## 8. Follow-ups opened by P2's `/simplify` + `/review` (2026-08-16)

Recorded rather than fixed, each with the reason:

1. **⚠ The client and the server break a mid-rollover tie by DIFFERENT rules.** When a team holds a
   draft AND an active year at once, `resolveWorkingSeason` (client + the team layout) picks the
   highest `year`, while every API route resolves through `getActiveRepProgramYear`, which picks the
   most recently CREATED row. Every rollover the product itself performs makes those agree, so this
   bites only if someone mints a lower-numbered year AFTER a higher one — and then the masthead
   names one season while the data comes from another. **Pre-existing** (the deleted `resolveSeasonView`
   sorted the same way), but P2 removed the `?year=` that used to override it. Closing it properly
   means carrying `created_at` onto the assignment row — a shared-DB change, and `lib/db.ts` is
   currently another session's working file. Own unit of work.
2. **The guard test's two stated scope limits** (now written into its header): a season id arriving
   in a request BODY is not detectable by the scan, and server layouts are outside it. No live
   violation of either; the note is what stops the guard reading as wider than it is.
3. **`tryout-report`'s primary gate still uses the legacy assignment lookup** rather than membership
   (P1's known tail — the route was never on P1's conversion list). The projection invariant means
   the two agree in practice; converting it belongs with the rest of that tail.
4. **`moneySectionHref`'s 4th `carryQuery` parameter is now dead** — P2 removed its last two callers,
   and its JSDoc still points at `page.query`, which no longer exists. Left alone deliberately:
   `lib/coach-money-links.ts` is inside the money session's active rework (`CoachMoneySection` is
   being re-split as this lands), and editing it would collide.
5. **The between-seasons fixture's two finished years are chosen from the current calendar year**, so
   a run either side of New Year adds a third rather than reusing the two. Slow accumulation, not
   per-run drift (the games it seeds use fixed dates keyed to the season's own year, deliberately).

## 9. What the owner asked for next — ✅ NOW A PLAN (2026-08-18)

⚠⚠ **SUPERSEDED BY THE CLOSE-AND-ARCHIVE PLAN.** The two asks below were designed out on 2026-08-18
and are now `COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN.md` (mockups `57e9bfd3`, owner-approved). **Read
that plan, not this section, for what is being built** — this stays as the record of how the
direction arrived and what the tension with Design A actually was.

⚠ The answer to the tension, for anyone reading this section cold: a season is now **fully LIVE
until it is CLOSED**, and a closed season is **one page**, reachable regardless of the live season.
Design A’s real target — no season dial, no second nav, no thirty screens learning a year — is
untouched; what changed is the answer to *“what does a finished season look like?”*

### The direction as it was given (2026-08-17)


Given at the close of the §53 walk, recorded verbatim in substance while it is fresh. **No design
work has been done on either, and none should start until the owner's page-by-page pass reports
back** — they were explicit that the walkthrough comes first and the changes follow from it.

1. **Trim what a finished season shows, substantially.** The page-by-page pass is a DESIGN review
   with that as its purpose. Expect the outcome to be a list of things to remove or fold away from
   finished-season surfaces, screen by screen.

2. **⚠⚠ Make the archived-season pages reachable whether or not the team has a current season.**

**⚠ Point 2 is a CHANGE OF DIRECTION, and it should be logged as an owner ruling when it firms up
rather than absorbed quietly as a detail.** Stating the tension plainly, because the next session
will otherwise read §1 of this plan and build the opposite:

- Today a finished season's records render **in place** — the ordinary screens, resolving the team's
  WORKING season. That is why they are complete for a team BETWEEN seasons and why they stop being
  reachable the day the next season opens. Everything after the rollover goes through the narrow
  look-back layer: Season's End, Season Wrapped, the compare list, and the two shelves.
- "Available whether there is a current season or not" means those pages become addressable **by
  year, independent of what the team is on now** — which is the capability Design A deleted when it
  removed the season dial (§1.1, §3). It is not the dial itself: a dial steered the WHOLE portal and
  had no enumerated surface. But it is the same power, and the guard test exists precisely to make
  granting it a decision someone takes on purpose.
- The two asks fit together and that is what makes this coherent rather than a reversal: **a much
  SMALLER archived-season surface can afford to be permanently addressable in a way the whole portal
  never could.** Trim first, then decide what the trimmed set is allowed to be. Sequencing them the
  other way round re-opens the archive before anyone has decided how big it is.

**What the next session must not do:** treat point 2 as licence to put `?year=` back across the
record screens. The enumerated list (`HISTORY_ENDPOINTS`, four entries, each with its three answers)
is the mechanism for granting it, one surface at a time, and the three questions still have to be
answered for each — especially the second one, which is what the deleted archive kept failing.
