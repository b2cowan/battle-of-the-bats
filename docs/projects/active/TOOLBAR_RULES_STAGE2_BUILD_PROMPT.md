# Toolbar Rules — Stage 2 (shapes) build prompt

> Paste into a fresh session on `dev`. Written 2026-10-18 by the session that built Stage 0 and Stage 1. Stage 1 (the
> one search field) is committed `56bfa9f9` and its walk **§330 passed 9 of 9** (`822555e0`). No migration, no API.

**Read first:** `docs/projects/active/TOOLBAR_RULES_PLAN.md` — §1 the rules, §2 the call list, **§9 the Stage 0 census
rulings (C1–C9, owner "as recommended")**, §10 Stage 1's departures. The hub (spec + census + QA walks):
https://claude.ai/artifact/SPjRTAB6kVqd9vJ8x1vuza — read it with the Artifact tool before publishing to it (version 9
at writing). The ruling whole: `memory/design_decisions.md`, the 2026-10-17 "EVERY LIST'S TOOLBAR" entry and its census
addendum. Then `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading → a helper; open a helper's cited lines before
relying on them — two helper claims were wrong in Stage 1).

## What Stage 2 builds (Rules 4 and 6 — corners and the one view pill; nothing moves)
What picks WHICH list becomes rounded (999px); what narrows or acts keeps its square corners.

1. **The olive `lead` picker rounds.** `components/shared/FilterPill.module.css` — the rule is
   `.multiSelectLead > .multiSelectSummary` (~:115); the 8px comes from the BASE `.multiSelectSummary` (~:39), which
   also shapes every narrowing pill — add `border-radius: 999px` to the lead rule only, never the base. It reaches
   (census): club Ledger Book, Allocations View, Budget Year + View, BvA Year + View, Accounting Overview Year,
   Accounting · Teams Year, Team statement Team, Venue library › Permits Year, the Payees window Year
   (`components/admin/kit/club/money/YearPill.tsx` serves the Years), Families Show; coach Ledger, Dues, Budget and BvA
   View. No tournament screen wears it.
2. **The view switch rounds.** `.calViews` (~:6223, 8px) and its buttons `.calView` (~:6231, 6px) in
   `app/[orgSlug]/coaches/coaches.module.css` — both. One component wears it (`ViewSwitch`,
   `components/coaches/ScheduleCalendarViews.tsx` ~:748): club Calendar, Venue library (Venues · Permits), rep team
   schedule, Schedule detail (desk AND its phone `lensLine`), the New schedule window, the coach Schedule.
3. **Teams' division picker rounds** — `components/admin/tournament/AdminToolbar.module.css` `.divisionSelect`
   (~:16, 8px); match Schedule's Day pill (`.viewPill`, `schedule/components/ScheduleDay.module.css` :8). Keep the
   amber waiting dot; the amber count lives in the open list only (census) and keeps it.
4. **`repKit.views` becomes the one view pill** (Rule 6) — `components/admin/kit/club/RepKit.module.css` `.views`
   (:425) / `.view` (:434) / `.viewOn` (:448, black ink — its note says "open, not ruled (K-21)"; Rule 6 rules it:
   olive). Target look = Results' lens pill: `app/[orgSlug]/admin/admin-common.module.css` `.filterChip` under
   `[data-admin-kit]` (~:462–482), 38px (`results-admin.module.css` :24), count in `.chipCount` (opacity 0.65, 1 when
   chosen). Counts are drawn by each screen today: Communication `<b className={styles.lensCount}>` full ink
   (`communication.module.css` :43); club Tryouts writes " · n" inline in the label
   (`rep-teams/teams/[teamId]/tryouts/page.tsx` ~:416) → a separate lighter count. Prefer a shared pill over a third
   copy of the recipe (memory: a shared component beats a shared class).
5. **Check-in's arrival buttons on a desk → the view pill** (Rule 6, census C1). `DayOfFilterBar` / `DayOfFilterButton`
   (`components/volunteer/DayOfBottomBars.tsx`; CSS `components/volunteer/DayOfShell.module.css`). ⚠ **The face must be
   switched on by the Check-in BOARD (`components/admin/CheckInBoard.tsx`, ~:447), never by the bar itself:** the
   organizer's board renders it `inline`, the gate (`app/[orgSlug]/check-in/page.tsx`, `pinnedFilters`) renders the
   base bar — four equal 44px boxes on a desk — and the **Scorekeeper** (`app/[orgSlug]/scorekeeper/page.tsx` ~:878)
   wears the same bar and must stay exactly as it is. Above 640: pills sized to their words, 38px (44 at 641–768);
   at ≤640 both phones keep the four-up bar (count over word) and the gate's pinned bottom bar, unchanged.
6. **Two coach switches round** (census C7): Roster's List · Depth chart (`coaches/teams/[teamId]/roster/page.tsx`
   ~:767, `segChoice`) and the player record's Goals / Results (`components/coaches/PlayerDevelopmentSection.tsx`
   ~:681). Take the view switch's rounded face rather than restyling `segChoice` portal-wide (other segChoices are not
   in scope). The tabs inside the drill picker and the docked library stay tabs.
7. **Unchanged (census C2/C3):** the amber attention toggles (Calendar and Schedule detail clash pills, "Needs a
   plan", "Needs lineup") stay rounded; Budget Columns, BvA Compare / Showing and Collapse all keep face and corners;
   Filter, Tags, Tools, Export and every button stay square. Placement is Stage 3 — move nothing here.

## Guards
Extend `tests/unit/toolbar-rules-guard.test.ts` with a Stage 2 `describe`: the lead rule and `.calViews`/`.calView`
are 999px and the base summary is not; the division picker is 999px; `repKit.views` renders the shared view pill (or
its rule); the Check-in board — not `DayOfFilterBar` — opts into the pill face, and the Scorekeeper's call is
unchanged. Existing guards that pin these shapes: grep `tests/unit` for `calViews`, `multiSelectLead`, `viewOn`,
`divisionSelect`, `DayOfFilter` before editing.

## Each step (as Stage 1 did)
- PM UX summary in the chat before code (AGENCY_RULES).
- `npm run verify:changed -- <files>`; `npm run typecheck` (shared modules). **Known failures that are not yours:**
  `club-stage6c-screens-guard` (the admin rail scrollbar, another session) and `coach-semantic-ink` (`.occGroupPermit`,
  committed 10-11); `check:css-selectors` reports a `GuidanceRail.module.css` `.context` clash; `check:admin-old-look`
  reports house-league 130 → 131. If your change LOWERS an old-look count, lower its baseline entry by hand
  (`--init` refuses while house-league is high).
- `node scripts/check-layout-invariants.mjs --workers=1 --only=<ids>` on the running dev server (never a whole sweep;
  `--workers=1` — four at once ran the machine under the memory floor). If it says a session "is not signed in", run
  `npx playwright test --config playwright.config.ts --project=auth-setup` and re-run. Screen ids: `--list`.
- `/simplify` (a shared pill is new abstraction) → `/review` → the owner's walk → commit.
- `/design` pass on the result before the walk (memory: run it, don't just offer it).

## Walk W2 (one purpose: the shapes)
Add it to the QA ledger as the next free § (§330 is Stage 1; others are being added daily — check) and to the hub's
QA walk section as its own group (checkboxes + Copy results; parse the page scripts before publishing). Cover: the
club money pickers and the coach money View pills (rounded, olive kept); the view switches on Calendar, Venue library,
rep schedule, Schedule detail (desk + phone), the coach Schedule; Teams' picker; Communication and club Tryouts pills
(olive when chosen, count lighter); Check-in organizer + gate on a desk (pills) vs phone (four-up bar, gate pinned);
**the Scorekeeper unchanged**; Roster and the player record switches; squares still square (Filter, Tags, Tools,
Export, narrowing pills); Dark.

## Commit
ONE commit, explicit pathspecs. TODO.md, the QA ledger and `memory/design_decisions.md` carry other sessions'
uncommitted edits — commit only your lines: build each as HEAD + your exact block in a temporary index, `commit-tree`
+ a compare-and-swap `update-ref`, re-point the main index only inside `if git update-ref …` (memory
`reference_partial_commit_shared_tree`; Stage 1's scripts: `.probe/tb1/commit.sh`, `build.cjs`, `build2.cjs`). Then
`git show --stat HEAD` and confirm only your paths. Update the plan's status, the TODO line and the memory file
`project_toolbar_rules` (auto-memory).
