# BUILD PROMPT — Insights Reports Portal, Phase 1 (the shell)

You are building **Phase 1 only** of the Insights → Reports Portal project. Read these first, in
order:
1. `docs/projects/active/COACH_INSIGHTS_REPORTS_PORTAL_PLAN.md` — the plan (§2 target structure,
   §3 P1 tasks, §4 standing rules). P2/P3 items (charts, recency matrix, arm care, attendance
   drill-in/sort/reply-rate) are OUT OF SCOPE — do not build them "while you're in there".
2. The owner-approved mockups (THE SPEC — deviations get raised, not silently made):
   https://claude.ai/code/artifact/7d02e402-fd59-4b11-8d88-33fe95fffd8c
   P1 delivers: the tab shell, the Dashboard tab **minus its chart**, all renames, all removals.
3. `AGENTS.md` / `AGENCY_RULES.md` — especially: no commit without explicit owner OK, explicit
   pathspecs only (never `git add -A`), re-check the branch is `dev` before committing.

**Every factual claim below was verified against commit `b291e027` (2026-08-18). The prior
blockers (season-close `fa5317d1`/`67acede0`, nav collapse `5fcf2a7d`) are committed — but other
sessions share this working copy, so re-run `git status` before you start and verify any file you
find modified.**

## The verified map (all paths repo-relative)

- Hub: `app/[orgSlug]/coaches/teams/[teamId]/history/page.tsx` (nav label "Insights"). Today:
  scoreboard band → "What stands out" → `CoachAskBar` → question-titled door tiles.
  ⚠ `history/route.ts` beside it is the cross-season reader listed in `CROSS_SEASON_READERS` —
  leave it alone.
- Reports to convert into panels: `history/results`, `history/playing-time`, `history/awards`,
  `history/development`, `history/opponents` (list only — `[opponentKey]` book STAYS a route),
  plus top-level `…/attendance` (keep its take-attendance pointer card).
- The pattern to copy: `…/accounting/page.tsx` — `?section=` param (NOT `?tab=`), panels as
  `./{tab}/panel.tsx` via `next/dynamic({ssr:false})`, visited panels stay mounted
  (`display:none`), scrollable tab bar with measured chevrons, and **each tab folder keeps a
  slim `page.tsx` that redirects its legacy URL** (see `accounting/dues/` — `page.tsx` +
  `panel.tsx` side by side). Follow `lib/coach-money-links.ts` (`legacyMoneyAddress`) for the
  address-rewrite idiom; build the Insights equivalent, don't extend the money one.
- Ask machinery to remove: `components/coaches/CoachAskBar.tsx`,
  `app/api/coaches/[orgSlug]/teams/[teamId]/ask/route.ts`, `ASK_QUESTIONS` in
  `lib/coach-ask-questions.ts`, `tests/unit/coach-ask-questions.test.ts`.
  **KEEP** `askReportHref` (the findings strip uses it — relocate it, e.g. beside
  `lib/insight-findings.ts`) and **KEEP** `lib/coach-position-recency.ts` +
  `lib/coach-practice-misses.ts` (P2 needs them; unused-export lint may want a pragma or a note).
  Check `lib/coach-family-dues.ts` callers before touching it — it may serve money surfaces.
- Money removal (owner ruling — NO money anywhere in Insights):
  - The dues scoreboard tile in `history/page.tsx`.
  - In `lib/insight-findings.ts`: the two dues rules (~lines 186–210, `tier: 'money'`), the
    `FindingsDuesSummary` input, the `dues` field, the `'money'` members of `InsightTier` /
    `InsightReport`, and the `DUE_SOON_DAYS` constant. ⚠ The `money()` formatter — check callers
    before deleting; the priority ladder comment (safety → money → …) needs updating either way.
    Update the findings tests in the same pass; the hub's fetch that feeds `dues` goes too.
  - The past-seasons shelf inside `history/results`: stop rendering dues/expense figures (show
    record · players · attendance per the mockup). UI-only — do NOT change what the endpoint
    returns and do NOT touch `HISTORY_ENDPOINTS`/`HISTORY_PAGES`/`CROSS_SEASON_READERS` in
    `tests/unit/coach-history-endpoint-guard.test.ts`.
- Gates, all in `lib/coach-nav-visibility.ts` (`isCoachNavItemVisible`, keyed by LABEL with
  `default: return true`):
  - `case 'Insights'` (line ~187): `hasRecordAccess` → a minus-money predicate (record access
    with the `money` grant contributing nothing). A money-only treasurer deliberately loses the
    door; their home is the Money hub. `case "Season's End"` keeps `hasRecordAccess` unchanged.
  - `case 'Development'` (line ~190): nav label becomes **"Skills & Goals"** — add the new label
    case and KEEP `'Development'` as a fallthrough (the Email families/Announcements precedent),
    or a future surface asking by the old name falls to `default: true`.
  - `case 'Attendance'` (line ~148) STAYS — its comment explains why; the Insights door and the
    Overview coaching-pair tile still ask it.

## Tab set (route stays `/history`; `?section=`)

*(none)*=Dashboard · `results` · `attendance` · `playing-time` · `development` · `awards` ·
`scouting` (title **"Scouting Book"**). Dashboard = 5 scoreboard tiles (dues tile gone) +
"What stands out" (money findings gone) + the all-reports rail (one live stat per row — feed it
from one summary read, not N new endpoints; a missing stat renders a quiet caption, never a
fabricated zero). Development panel header gains the cross-link line "Set goals and record
measurables in Skills & Goals →" per the mockup.

## Before writing any redirect: enumerate the doors

"It has one parent" is a whole-codebase claim (playing time once had FOUR doors). Grep for every
inbound link to each converted route (`/history/results`, `/history/playing-time`,
`/history/awards`, `/history/development`, `/history/opponents`, `/attendance`) — known minimum:
`askReportHref` consumers, Overview tiles (`resolveCoachingPair`), the game console, the team
page's "Season insights →", help-content deep links (`#premium-…` ids in
`lib/help-content/coaches.tsx`), and the portal tour. Every door either retargets to
`/history?section=…` or rides the legacy redirect. List the doors you found in your summary.

## Same-unit-of-work obligations

- Help guides + hub arrays (`lib/help-content/coaches.tsx` — Ask bar out, new tab names,
  "Skills & Goals", every routing sentence re-verified), portal tour steps, and the coach demo's
  dock copy / tour narration (CLAUDE.md demo-drift rule; `npm run check:demos`).
- Tests: nav-groups test pins the new label set (both navs move together); a new gate test
  (helper sees nothing · money-only treasurer loses Insights · every real assistant keeps it);
  findings tests lose the dues cases; `tests/unit/coach-attendance-home.test.ts` reworked (the
  door IS the tab now); ask tests deleted with the feature.
- `scripts/layout-screens.mjs`: address EVERY `?section=` URL (a hidden panel is an unmeasured
  panel — money precedent). Reseed the UAT fixture (`node scripts/seed-uat-coach-fixture.mjs`)
  before sweeping; `--changed` is a false green once committed — use `--only` on touched screens.

## Standing rules that bind this build

No panel or route reads `?year=`. No finished-season branches — `CoachTeamSeasonGate` already
keeps a closed-season team out of this surface entirely. Playing-time copy: measurement-in-
context, never "fair". Development copy: checklist, never a ranking. CSS-module purity (a global
rule in `*.module.css` hard-fails the prod webpack build). Panels stay mounted — a panel owning a
local copy of shared data must not let the parent re-derive from its own copy. Mobile actions:
icon-only with hidden label + aria-label. Verify layout claims with rendered computed styles, not
screenshots.

## Definition of done (P1)

Coach flips between all 7 tabs without losing the tab row; every enumerated door and every legacy
URL lands on the right tab; `grep -ri` for dues/money strings under the history tree comes back
clean and the rendered Dashboard shows 5 tiles; nav reads "Skills & Goals"; Ask bar gone;
typecheck + `verify:changed` + focused layout sweep green; OWNER_QA_LEDGER gains a new § entry
(next free number — never re-sort the table) with a walk script; TODO.md line updated to
"P1 BUILT on dev, QA §N owed" with the commit hash. Commit only with explicit owner OK, explicit
pathspecs, on `dev`, and confirm with `git show --stat HEAD` that only your files landed.
