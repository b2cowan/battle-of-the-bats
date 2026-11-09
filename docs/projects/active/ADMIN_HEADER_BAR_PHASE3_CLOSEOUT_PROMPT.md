# Closeout prompt: Admin header Phase 3, simplify → review → help → commit

> Written 2026-11-09 at the end of the Phase 3 build session. Paste into a fresh chat (`/clear` first).
> Plan of record: `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md` (§ "Round 5" and § "Phase 3 — Screens with no place of their
> own", which records everything built, measured and found). Build prompt: `ADMIN_HEADER_BAR_PHASE3_BUILD_PROMPT.md`.

---

Admin header Phase 3 is **built, measured and walked-to-be** (walk §499 https://claude.ai/artifact/6zhDUJu3TFMjxCvhKBW4kC is
the owner's, not a gate). **Not committed.** This session does four things, in this order, and nothing else:

1. `/simplify` on this session's diff
2. `/review` on the simplified diff
3. `/docs` for the two help sentences that now read wrong
4. **Commit** (the owner said yes to the commit when he asked for this prompt; still show him the file list first, see step 4)

Read first: the plan's Round 5 and Phase 3 sections (the as-built record, the gates, the measurements). Then the diff of the
files below. Do not re-derive the design: round 5 is ruled (Q1–Q6 as recommended) and recorded.

## This session's files (and ONLY these)

Product:
- `lib/admin-kit-nav.ts`: `namedScreen`, the Phase 3 branches in `clubPlaceAt`, `detail` on `ClubPlaceAt`, four optional
  gates on `ClubPlaceAccess` (`opensCalendar`, `opensSchedules`, `opensPublicSite`, `opensBilling`), `isTournamentOrgScreen`
  (A10 + Q6), the `LEAGUE_TIME_WORDS` import
- `components/admin/AdminBarPlace.tsx`: the four gates built in `useClubPlaceAt`; `useHandBarPlace` takes null;
  `useHandRecordPlace`, `RecordPlaceParts`, `useNamedInBar`
- `components/admin/useAdminPlace.tsx`: `onTournament` excludes `isTournamentOrgScreen`
- `components/admin/AdminEventHeader.tsx`, `components/admin/AdminTopStrip.tsx`: `place.detail` rendered (phone line; strip
  as quiet words, the `own.dates` class)
- `components/admin/kit/club/PlaceFrame.tsx`: `TabPageHeader` also drops the paper title where `useNamedInBar()`
- Pages: `app/[orgSlug]/admin/calendar/page.tsx` (A7 `viewMenu` first in the toolbar), `schedules/page.tsx`,
  `schedules/[scheduleId]/page.tsx`, `house-league/page.tsx`, `public-site/page.tsx`, `rep-teams/rename-slugs/page.tsx`,
  `rep-teams/teams/[teamId]/history/page.tsx`, `…/history/[yearId]/page.tsx`,
  `house-league/seasons/[seasonId]/club-schedule/[scheduleId]/page.tsx`, `components/notifications/NotificationsPageContent.tsx`,
  `components/admin/kit/club/BillingKit.tsx`, `components/admin/kit/club/families/ChildPage.tsx`

Tests: `tests/unit/admin-kit-nav.test.ts`, `admin-header-bar-guard.test.ts`, `child-page.test.ts`,
`club-stage13i-places-guard.test.ts`, `plan-billing-admin-host.test.ts`, `plan-billing-stage3-admin-doors.test.ts`

Docs (new): `docs/projects/active/ADMIN_HEADER_PHASE3_DRAWINGS.html`, `ADMIN_HEADER_BAR_PHASE3_WALK.html`,
`ADMIN_HEADER_BAR_PHASE3_BUILD_PROMPT.md`, this file.

⚠ **Shared files: take only this session's hunks.** Other sessions have uncommitted edits in the same files; read each diff
before staging:
- `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`: ours = the "Round 5 drawings" header line, the whole "## Round 5 · …"
  section, and the Phase 3 section's body (the "Built 2026-11-09" note and every `[x]` bullet under it)
- `docs/projects/active/OWNER_QA_LEDGER.md`: ours = the `## §499` entry at the end of the file and nothing else (the file's
  diff is ~236 lines of OTHER sessions' work; never re-sort the §numbers)
- `TODO.md`: ours = the one change inside the 🧭 Admin header line ("round 5 RULED … Phase 3 … built 2026-11-09, walk §499
  published; next Phase 4")
- `memory/design_decisions.md`: ours = the top entry "2026-11-08 — THE SCREENS WITH NO PLACE OF THEIR OWN …"
- `app/[orgSlug]/admin/calendar/page.tsx`: another session (Club Tier 13c Session B) edited this file during the build. Ours
  = the `TabPageHeader` import, the line-19 comment ("the View drawer first in the toolbar (A7)"), the `header` / `viewMenu`
  block, and `{viewMenu}` with its comment as the toolbar's first child. Check whether their hunks have since been committed
  (`git diff` will show)
- `lib/help-content/org.tsx`: already carries another session's edit; step 3 adds ours

## 1 · `/simplify`

The new abstraction risk is a SECOND kind of place (a named screen with no tabs and no frame) layered on the place model, plus
two page-side hooks. Look in particular at:
- `useClubPlaceAt()` is now called by the bar, the strip, every frame, `TabPageHeader` (`useNamedInBar`) and every record page
  (`useHandRecordPlace`), so several times per page. Each call builds every gate (`useHouseLeagueAccess`, `useOrgTabs`,
  `usePermitsLink`). Is that cheap enough, or should the answer be computed once (a context) and read? Measure before
  changing; do not change the "no flash" contract (address first, hand-off only for the same key).
- The Public site hands its chip through `useHandRecordPlace` though it is not a record: is the name right?
- Duplicated markup between the two renderings is deliberate (guards pin both, Phase 2D's /simplify ruled it); leave it.
Re-run `tests/unit/admin-kit-nav.test.ts` and the guard files above after any change.

## 2 · `/review`

Run on the simplified diff (this session's files only). Lenses that matter here:
- **Gates:** each `opens*` must mirror its page's refusal exactly (Calendar = the API's `calendarPrograms` on a non-Tournament
  tier; Schedules = `canOpenClubSchedules`; Public site = plan + capability; Billing = owner; Seasons list / club schedule =
  house league `read`). A mismatch means the header names a screen over its refusal, or a page drops its title with no name
  above it (zero `<h1>`).
- **One `<h1>`:** every page that switched to `TabPageHeader` must still get its paper title wherever `clubPlaceAt` answers
  null (refusals, the tournament side's copy of billing / Members, a team workspace).
- **Hooks order:** each new `useHandRecordPlace` sits before the page's early returns.
- **A10:** `isTournamentOrgScreen`'s list: the org-wide pages are `manage`, `archives`, the `settings` hub, `settings/members`,
  `settings/subscription`, `settings/payouts`, `settings/pdf`; `settings/event`, `settings/notifications`,
  `settings/registration-fields` are the EVENT's.
Apply real findings; record the rest in the plan's Phase 3 section.

## 3 · `/docs`

Two sentences in `lib/help-content/org.tsx` read wrong after Phase 3 (found and verified at the end of the build):
- the club calendar's "Filters and Export" (~line 700): "On a phone they sit behind **Filter**, and the view switch is the
  icon beside the title." The calendar has no title on the page now; on a phone the View button is the FIRST button in the
  toolbar row (A7).
- the Public site's "Your address, and whether the site is on" (~line 1575): "The top of the page shows an **Online** or
  **Offline** chip and **Families see it at** …". The chip is now beside "Public site" in the header (Q3); the "Families see it
  at" row with Copy link and Open is still the page's first line.
Everything else was checked and still reads true (the plan's Phase 3 "Help" line). Keep `keywords` / `searchText` matched.
`npm run check:spelling` after.

## 4 · Commit

- Re-check the branch is `dev`. Re-run the guards + `tests/unit/admin-kit-nav.test.ts`, and `npm run typecheck`
  (`NODE_OPTIONS=--max-old-space-size=8192`) if steps 1–3 touched product code.
- **Show the owner the file list and the shared-file hunks you will take, then commit.**
- Build the commit in a **private index on the current HEAD** (memory note "Partial commit out of shared files":
  `reference_partial_commit_shared_tree.md`, and its two siblings on partial staging). Never `git add -A`; never stage another
  session's hunk. After the commit, `git show --stat HEAD` and confirm only these files landed.
- Message: what an admin sees ("the screens with no place of their own name themselves in the header; record pages show
  their way back; a tournament organization's own screens name the organization"), then the attribution line.
- Then record the hash: the plan's Phase 3 header note ("committed `<hash>` <date>"), the TODO line, the §499 ledger entry's
  "Committed" line, project memory (`project_admin_header_bar.md` + its MEMORY.md line). A second small commit for that record
  is fine (the Phase 2D pattern).

Known and NOT this change (do not fix here): failing tests in the shared tree from other sessions (`plan-billing-usage`'s
free-time route, `club-stage6c-screens-guard`, `kit-dialog-floor-guard`, the tax console, workspace flip, bank, permits) and
`check:org-slug-callers` / `check:css-selectors` / `check:admin-old-look` / `check:admin-type` findings on other sessions'
files. Three layout findings at 390 were re-keyed (text changes), left for the release sweep's `--prune`.
