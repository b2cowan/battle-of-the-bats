# Finish prompt — Navigation, Phase 4: design, review, docs, the walk, the records, and the commit

> One session, pasted into a fresh chat (`/clear` first). **Model: Opus.** Helpers read on Sonnet (CLAUDE.md: broad reading goes to
> a helper; check its claims against the code). Written 2026-11-11 by the session that BUILT Phase 4 (see project memory
> `project_admin_nav_evaluation.md`, "Phase 4 BUILT 2026-11-11").
> **The owner asked for the commit in this prompt:** commit this phase's files once the steps below are done and the checks
> named in step 7 pass, through a private index (exact hunks). Do not wait for the owner's walk; the walk follows the commit.

## Where things stand (verified 2026-11-11 by the building session)
Plan of record: `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` §5 Phase 4 (the gate's C1–C9 rulings), the build prompt
`ADMIN_NAV_BUILD_PHASE4_PROMPT.md`, drawings https://claude.ai/artifact/S7XXbtLwNeZUjEWXzbUcw4 tab 17 "Phase 4 gate" (version 15)
and tab 7. **Built, in the working copy, not committed:**
- **Step 0, one shared sidebar menu** (`components/shared/SidebarMenu.tsx`, placements `cell` and `beside`): the event list
  (`EventSwitchMenu`), the free portal's strip menu (`SidebarStripMenu`) and the new team cell all wear it; the layer rule is one
  `.stripLayer:has(.cellMenu)`; the switch rows' CSS moved to `SidebarSwitchList.module.css`.
- **The coach sidebar** 240 and unfolded, headed by `CoachTeamCell` (crest → colour → initials via `lib/coach-team-tile.ts`;
  chevron only with 2+ teams; list "Your teams" then "No live season"; folded = the tile, list beside it). The nav list lives once
  in `lib/coach-team-nav.ts` (sidebar, More sheet via `COACH_MORE_SECTIONS`, the strip's name via `coachDeskTitleAt` /
  `coachDrillBack`). Folding retired (`COACH_NAV_DEFAULT_CLOSED_GROUPS` & co. deleted).
- **The split strip on TEAM pages only** (`CoachTopStrip`: never `wall`, never `free`): "Coach", the page's `<h1>` or "← back" one
  level down (`CoachDeskTitle` provider), the team's facts at the right end (`CoachStripFacts` + `lib/coach-strip-facts.ts`),
  rendered on the server by a NEW parallel-route slot `app/[orgSlug]/coaches/@stripFacts/**` (+ `app/[orgSlug]/coaches/default.tsx`)
  from one cached loader shared with the phone's team bar (`lib/coach-team-masthead.ts`).
- **The team bar** hidden above 900 (CSS); `--coach-header-h` → 0 on a computer; phone unchanged (37 px, its "?").
- **The page's top row** (`CoachPageHeader`): `data-desk-named` / `data-desk-drill`; "?" last; a lone "?" packs right (C1); the
  scouting reminder under the row on a computer (`CoachDeskNudge`, C3).
- **Crest (C7):** `logoAspect` + `logoVersion` written by the PUT beside `rep_teams.pdf_settings.logoDataUrl` (`lib/team-crest.ts`);
  served at `app/api/coaches/[orgSlug]/teams/[teamId]/crest`; read by the coach list with JSON paths (`lib/db.ts` `crestOf`); NO
  migration; dictionary updated; one-time pass `scripts/backfill-team-crest-aspect.mjs` (dev: nothing to measure).
- **/simplify applied** (four reviewers). **Skipped and recorded**, carry them into the plan's Phase 4 record:
  - Crest facts as real columns. A JSON path reads the whole jsonb, picture included, on every coach load. Small: most teams have
    no crest, and every `getRepTeam` already reads it. **Owner call**, since it means a migration.
  - One drill-back table also feeding the pages' own `backTo` (9 call sites). The phone shows the page's arrow, the computer the
    table's, and the words can drift.
  - Lifting `CellName`, the cell CSS and the switch-row markup into shared parts (the admin and coach cells are near copies).
  - Moving the split-strip CSS (`.lcell/.rcell/.place/.back/.name`) from `AdminTopStrip.module.css` into the shared strip sheet.
  - One client season hook (resolution repeated in about 5 components).
  - An `inkOnBrand` helper, shared with `lib/themes.ts`.
  - `nudgeDay` shared with the team bar. Phase 5 retires the bar anyway.
- **Measured** (`.probe/nav-phase4/desk.mjs`, results `run2.json`, screenshots `.probe/nav-phase4/shots/run2-*`):
  - First paint (scripts off) = after load for: one team, a club coach with 3 teams, a team between seasons, the demo. Exceptions:
    pages that load client-side (the opponent page, Documents' header, Overview's setup chip), as before.
  - One visible `<h1>` per width.
  - The list's keyboard contract: focus on current, arrows, Escape returns focus to the cell, ArrowDown opens, Tab closes. Folded:
    opens beside.
  - At 1440 × 900 only Collapse sidebar scrolls; at 1366 × 768 the last rows and the foot scroll.
  - The facts hide at 1000.
  - Phone: bar 37 px, `--coach-header-h` 37 px, "?" in the bar.
  - `check:layout` (Overview, Roster, Schedule, Lineups, Money, Season's End, Insights) at 1440 and 390: no new findings.
  - Guards: `coach-nav-phase4.test.ts` (new) plus about 10 updated in the open (header-bar, sidebar-strip, nav-groups rewritten,
    nav-standard, page-actions, billing-host, chat-pause, workspace-flip, event-cell).
- **Not clean, and not this phase's** (do not fix; say so in the hand-off):
  - About 40 unit failures in other sessions' money, two-step and support-console files.
  - `verify-changed`'s ESLint config is broken: the `react-hooks` plugin is missing.
  - Token, old-look and index-coverage flags on others' files.
  - A `statItem` dead class.
  - The workspace-flip census lists others' files.
- **Known gotchas:**
  - An optional catch-all in a parallel slot collides with the team page (hence a page plus `[...rest]`).
  - `@next/env` `loadEnvConfig(dir)` without `true` reads PROD.
  - The Management API treats a bare `?` as a placeholder.
  - Shell heredocs eat backslashes in regexes. Edit regex-bearing code with the Edit tool.

## Steps
1. **Re-read first.** Read the plan §5 Phase 4 and project memory, then `git diff` every file in "This phase's files" below. Another
   session may have touched one since. If a file holds hunks that aren't this phase's, leave them alone and keep them out of the
   commit. The known shared ones are `docs/agents/db/DATA_DICTIONARY.md` (only the `rep_teams.pdf_settings` addition is ours) and
   `tests/unit/workspace-flip-guard.test.ts` (only the coach-team-masthead / team-layout swap is ours).
2. **`/design`** on the built screens against tab 17 and tab 7. Run it through a helper, because the skill loads five large memory
   files.
   - Capture fresh screenshots with `.probe/nav-phase4/desk.mjs`; it signs in fresh coach sessions.
   - Frames to cover: 1440 × 900 Roster (one team), the open list (club coach, 3 teams, one with a team colour), a drill-in
     (opponent), the team between seasons, 1366 and 1000, and the folded rail.
   - Apply the High and Medium findings and record the Low ones.
   - Already known: the top row sits about 14 px lower than drawn (the admin's accepted Low); the list rows show the season but not
     another team's record or game day (the team list doesn't carry them).
3. **`/review`**, high-risk, five lenses:
   - **First paint:** scripts off vs on.
   - **Sticky offsets:** HubTabBar, the lineup board, the chat, the expenses register.
   - **The phone untouched:** the team bar, the More sheet derived from the list (rows identical by test), and the
     `pageHeaderHelpDesk` and `deskNudge` hidden at 900 and below.
   - **The gate untouched:** `seasonFinished={!live && !!closed}` stays literal in the team layout.
   - **The crest route and save route:** auth, never trusting a client-sent aspect or version, cache keys.

   Also check the parallel slot's soft-navigation behaviour: team A → team B → notifications → back. Fix what's real; record Lows.
4. **`/docs`** on help articles that describe the team picker (the `<select>`), the team bar on a computer, the folding sidebar
   groups, or "Coaches Portal" in the strip. Change only the sentences this phase made wrong; the full NAV_STANDARD rewrite is Phase 6.
   In NAV_STANDARD itself, rewrite only the lines this phase contradicts (the coach rail's folding, the 220 width exception, the team
   picker).
5. **Restart the dev server** once before measuring for the walk (this phase added files and a route slot): stop it, then
   `npm run dev`. Check `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returns 200 and the log shows no EACCES.
6. **The owner walk**, a checkable Artifact. Copy the shape of `ADMIN_NAV_PHASE3_WALK.html` (paste-back, one purpose per walk, true
   size). Source: `docs/projects/active/ADMIN_NAV_PHASE4_WALK.html`. Ledger: the next `OWNER_QA_LEDGER.md` § (grep the highest first;
   never sort). Walks:
   1. The team cell and its list (one team: no chevron; three teams; a closed team; keyboard).
   2. The strip names the page and carries the facts (including 1100 and narrower, and game day if a fixture can show it).
   3. The page's top row and the "?" (a lone "?", a page with buttons, a page with nothing).
   4. A drill-in and the way back (an opponent, a lineup template, Tryout history).
   5. A closed season ("2025 Season" in the strip, one sidebar door).
   6. The folded rail.
   7. The demo (`/riverdale-ridge/coaches`).
   8. The phone unchanged (390).

   Fixtures:
   - Coach: `UAT_COACH_EMAIL`. UAT Test Team is live; UAT Between Seasons is closed.
   - Club coach: `UAT_REP_CLUB_COACH_EMAIL` on `/uat-rep-club/...`. 15U AAA has a colour; UAT Test Team and S3 owner walk team are
     its other teams.

   Grep every other walk for checks this phase now makes false (the team select, the team bar on a computer, folding groups), and
   say which.
7. **Records:**
   - `ADMIN_NAV_EVALUATION_PLAN.md` §5 Phase 4: what shipped, the measurements above plus the walk's, the /design, /simplify and
     /review records, the skipped list above, and the owed production steps (step 8).
   - Retire `ADMIN_HEADER_BAR_PLAN.md`'s "pixel-identical" coach lines (L184/289/448/548) on purpose, naming Phase 4.
   - The `TODO.md` line.
   - The `ADMIN_NAV_BUILD_PROMPTS_INDEX.md` row.
   - Project memory: positive facts, "committed `<hash>` 2026-MM-DD", walk §N owed.
   - `memory/design_decisions.md` gets a one-line entry for the strip naming the coach page.
8. **Checks before the commit:**
   - `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck`. Errors in other sessions' in-flight files don't block; name them.
   - The phase's guard set: `coach-nav-phase4`, `sidebar-strip-guard`, `coach-nav-groups`, `nav-standard-guard`,
     `admin-event-cell`, `admin-nav-phase3`, `admin-header-bar-guard`, `coach-page-actions-guard`, `plan-billing-coach-host`,
     `chat-pause-guard`, `coach-finished-season-surfaces`, `coach-first-screen-guard`, `sheet-frame-guard`, `workspace-flip-guard`
     (the census line naming other sessions' files is theirs).
   - `npm run check:spelling`, `npm run check:demos`, `node scripts/check-admin-type.mjs`, `node scripts/check-css-selectors.mjs`.
     Ours must be clean.
   - `npm run check:layout -- --only=coach-overview,coach-roster,coach-season-end --width=1440`, and the same at `--width=390`.

   **The commit:** on `dev` (re-check the branch), one commit for this phase, through a private index built from HEAD with only
   this phase's files and hunks (see memory `reference_partial_commit_shared_tree.md`). Never `git add -A`. Then
   `git show --stat HEAD` and confirm nothing foreign landed. The message says what a coach sees differently, and ends with the
   attribution line the session is given. **Owed at the promote, with the owner's yes** (record these; don't run them):
   `node scripts/backfill-team-crest-aspect.mjs --prod`, then `--prod --write`.
9. **Hand-off:** product-owner voice. What changed for a coach, the walk's link and §, the owner calls (crest columns; anything
   /design or /review raises), what was skipped, and the commit hash. Do not push.

## This phase's files
- **New:**
  - `components/shared/SidebarMenu.tsx`, `components/shared/SidebarSwitchList.module.css`
  - `components/coaches/CoachTeamCell.tsx`, `CoachDeskTitle.tsx`, `CoachStripFacts.tsx`, `CoachDeskNudge.tsx`
  - `lib/coach-team-nav.ts`, `lib/coach-team-tile.ts`, `lib/coach-strip-facts.ts`, `lib/coach-team-masthead.ts`, `lib/team-crest.ts`
  - `app/[orgSlug]/coaches/@stripFacts/default.tsx`, `@stripFacts/teams/[teamId]/layout.tsx`, `/page.tsx`,
    `/[...rest]/page.tsx`
  - `app/[orgSlug]/coaches/default.tsx`
  - `app/api/coaches/[orgSlug]/teams/[teamId]/crest/route.ts`
  - `scripts/backfill-team-crest-aspect.mjs`
  - `tests/unit/coach-nav-phase4.test.ts`
- **Modified:**
  - `components/shared/SidebarStrip.tsx` (+`.module.css`), `components/shared/SidebarLogoTile.tsx` (+`.module.css`)
  - `components/admin/kit/EventSwitchMenu.tsx`, `AdminEventSwitchSheet.tsx`, `AdminKitFrame.module.css`
  - `components/coaches/CoachTopStrip.tsx` (+`.module.css`), `CoachesSidebar.tsx`, `CoachesBottomNav.tsx`, `CoachesChrome.tsx`,
    `CoachPageHeader.tsx`, `CoachTeamHeader.tsx` (docblock only)
  - `lib/coach-nav-visibility.ts`, `lib/db.ts` (crest fields + `crestOf` only), `lib/export/resolve-pdf-settings.ts` (the
    `TeamPdfLook` keys)
  - `app/[orgSlug]/coaches/layout.tsx` (the `stripFacts` prop), `app/[orgSlug]/coaches/teams/[teamId]/layout.tsx`,
    `app/[orgSlug]/coaches/coaches.module.css`
  - `app/api/coaches/[orgSlug]/teams/[teamId]/pdf-settings/route.ts`
  - `docs/agents/db/DATA_DICTIONARY.md` (our hunk only)
  - Tests: `admin-event-cell`, `admin-header-bar-guard`, `chat-pause-guard`, `coach-nav-groups`, `coach-page-actions-guard`,
    `nav-standard-guard`, `plan-billing-coach-host`, `sidebar-strip-guard`, and `workspace-flip-guard` (our hunk only)
- **Plus** what steps 2–7 add: the docs, the walk, the records, and this prompt file.
- `git diff` each file before staging. `lib/db.ts`, `coaches.module.css`, `CoachesBottomNav.tsx` and the dictionary are busy
  shared files, so stage exact hunks.
