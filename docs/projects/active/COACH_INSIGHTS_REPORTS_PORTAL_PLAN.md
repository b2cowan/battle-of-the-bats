# Coach Insights → Reports & Analytics Portal — Implementation Plan

**Status:** **P1 BUILT on dev 2026-08-18** (owner QA §58 owed) · P2 + P3 not started · mockups owner-approved

**P1 build notes — three places the build departed from this plan, each raised rather than made silently:**
1. **The findings engine KEPT its money rules.** §3.4 said to delete them. It has a second consumer
   that is not this page — the Sunday "week in review" digest (`lib/insights-digest.ts`) — so
   deleting them would have stripped dues warnings from a notification nobody asked to change.
   Money is kept off Insights *structurally* instead: the hub never fetches `/dues` and never passes
   a `dues` input, which is what every money rule gates on. Making the digest money-free too is a
   one-line change and an owner call.
2. ⚠⚠ **THE ALL-REPORTS RAIL IS DELETED — owner call on the first look at the built page
   (2026-08-18), superseding the mockup and §3.5.** It was built as specified (one live line per
   report, fed from reads the hub already made, no new endpoint) and it was redundant the moment it
   rendered: six reports listed one line under a tab row listing the same six reports. *"The tabs
   have all the reports, this is redundant."*
   **The durable lesson, and the reason to write it down rather than just delete the code:** the
   rail's job — *"see where the news is without opening anything"* — is what **What stands out**
   already does, and does better, because it names the one thing worth knowing instead of restating
   six report names in a fixed order. **A future phase that feels the Dashboard is thin should add a
   findings rule, not a second index of the tabs.**
   Removed with it: the awards and opponents summary fetches and the cross-season `/history` read —
   three requests per Dashboard load that existed only to fill rail lines. The development summary
   read STAYS: it feeds the coverage findings rule, not a rail row.
3. **The past-seasons shelf shows no attendance %.** The mockup had one; the cross-season endpoint
   does not return it, and §3.4 forbids changing what that endpoint returns. Left out rather than
   fabricated.

**Also delivered, not in the plan:** `CoachTabBar` — the tab row was extracted from the Money hub
into a shared component rather than copied, so the two hubs cannot drift (the CSS classes were
renamed `moneyTab*` → `coachTab*` to match). Five phone tap-floor defects inside the portal were
fixed while measuring it (Awards' toolbar, the opponent search box, past-season rows, and the two
report-foot "go do something" links).

**Owner decisions (2026-08-18, all made in the mockup session — binding):**
1. Insights becomes a **tabbed reports portal** on the Money-hub pattern (persistent tab row, Dashboard first).
2. The **"Ask about your team" bar is retired** (supersedes the parked Phases B/C of ASK_FRONT_OFFICE — they are now dead, not parked). Every answer it gave becomes a permanent fixture in the report that owns it.
3. **NO MONEY ANYWHERE IN INSIGHTS** — no dues tile, no money findings, no rail row, no dues figures in the past-seasons shelf. *"Insights is for player/team stats that coaches (not treasurers) care about."* Money's homes are the team Overview and the Money hub.
4. Question tiles become **report titles**: Results · Attendance · Playing Time · Development · Awards · **Scouting Book** (owner picked this over "Opponents").
5. **Nav rename: "Development" → "Skills & Goals"** (the workbench). The word "Development" now belongs solely to the coverage report tab inside Insights.
6. **Tryout report stays in the Tryouts area** (one home). Dashboard rail may show a tryout line while a tryout runs.
7. The portal keeps the nav name **"Insights"** (owner accepted the lean; "reports & analytics" is subtitle copy, not the label).

**Mockups (the spec — [[feedback_build_to_approved_mockups]]):**
https://claude.ai/code/artifact/7d02e402-fd59-4b11-8d88-33fe95fffd8c
Deviations from the mockup during build must be raised, not silently made.

**PM brief:** `COACH_INSIGHTS_REPORTS_PORTAL_PM_BRIEF.md` (same folder).

---

## 0. Build preconditions — the shared working copy

⚠⚠ **Do not start while the season-close session's work is uncommitted.** As of planning, another
session holds ~25 coach files mid-flight (`CoachesSidebar`, `CoachesBottomNav`,
`lib/coach-nav-visibility.ts`, `coaches.module.css`, `lib/help-content/coaches.tsx`, season-end
surfaces) — the exact files this project must edit. The nav-groups collapse build (Phase 5b of the
nav plan) is queued on the same files. **Sequence: season-close commits → nav collapse builds →
this project.** Re-verify every premise below against committed code at build time; this plan was
written while those files were moving.

⚠ **The hub's season posture changed underneath this plan (2026-08-18 ruling):** a team with no
live season has ONE DOOR (Season's End) — `CoachTeamSeasonGate` redirects before any live screen
mounts. So the reports portal is a **live-season-only surface, structurally**: it never needs a
finished-season mode, and must not grow one. If a closed season needs to show something, it needs
a SHELF on the season-end page, not a branch here (CLAUDE.md ruling).

---

## 1. Current state (verified by sweep 2026-08-18 — re-verify at build)

- Hub: `app/[orgSlug]/coaches/teams/[teamId]/history/page.tsx`, route `/history`, nav label
  "Insights" (label→route rename documented in `lib/coach-nav-visibility.ts`). Sections:
  CoachPageHeader → scoreboard band (Record/Form/Diff/Close/Attendance/**Dues**) → "What stands
  out" (`lib/insight-findings.ts`) → **CoachAskBar** → 7 question-titled door tiles.
- Reports behind the doors: `history/results`, `history/playing-time`, `history/awards`,
  `history/development`, `history/opponents` (+ `[opponentKey]` book), and top-level
  `…/attendance`. "Where's the money?" tile links to `/accounting`.
- Ask machinery: `components/coaches/CoachAskBar.tsx`, `lib/coach-ask-questions.ts`
  (`ASK_QUESTIONS` + `askReportHref`), route `api/coaches/[orgSlug]/teams/[teamId]/ask`,
  data modules `lib/coach-position-recency.ts`, `lib/coach-family-dues.ts`,
  `lib/coach-practice-misses.ts`, `lib/lineup-season-analytics.ts`.
- Money-hub tab pattern to copy (`…/accounting/page.tsx`): `?section=` query param (NOT `?tab=`),
  tabs are `<Link>`s (shareable URLs), panels in `./{tab}/panel.tsx` via `next/dynamic({ssr:false})`,
  visited panels stay mounted (`display:none`), scrollable tab bar with measured chevrons,
  `legacyMoneyAddress()`-style rewriting for old addresses, one-shot params stripped when
  building cross-tab links.
- Gates: nav "Insights" = `hasRecordAccess`; tiles gate per capability (attendance, lineups,
  schedule, notes/record, money). Playing-time + Scouting Book are live-season-only PERMANENTLY
  (owner rulings, enforced by `tests/unit/coach-history-endpoint-guard.test.ts`).

---

## 2. Target structure

Route stays `/history` (renamed labels keep old routes — house precedent). Tabs via `?section=`:

| section | Tab | Content (per mockup) |
|---|---|---|
| *(none)* | **Dashboard** | scoreboard tiles (5 — dues tile DELETED), momentum chart (NEW, P3), "What stands out" (money findings DELETED), all-reports rail (NEW) |
| `results` | **Results** | per-type records, tag filters, game log, run-diff trend + result strip (NEW, P3), past-seasons shelf (dues/expense figures DELETED — record, players, attendance instead) |
| `attendance` | **Attendance** | take-attendance pointer card (kept), games/practices/season stats, RSVP reply rate (NEW, P2), monthly trend chart (NEW, P2/P3), player table now sortable with missed-most highlight (P2), per-player missed-events receipts drill-in (NEW, P2), methodology note (kept) |
| `playing-time` | **Playing Time** | spread readout + per-player table + "Which lineup wins?" (kept), position recency matrix (NEW, P2 — data: `lib/coach-position-recency.ts`), arm care panel (NEW, P2 — data already in `lib/lineup-season-analytics.ts`) |
| `development` | **Development** | coverage table / unplanned focus areas / practices-run (kept verbatim; checklist, NEVER a ranking), header cross-link "Set goals and record measurables in Skills & Goals →" |
| `awards` | **Awards** | unchanged content |
| `scouting` | **Scouting Book** | opponent list panel; `[opponentKey]` book **stays its own route** (drill-in pages stay routes — fundraiser-drill-in precedent) |

Vocabulary rules that bind copy: playing time is measurement-in-context, never "fair"
([[decision_playing_time_vocabulary]]); development copy never ranks or scores a player.

---

## 3. Phases

### P1 — the shell (renames, tabs, removals) — one owner QA walk
1. Convert hub to the tabbed page; move the five `history/*` report pages + `attendance` into
   panels (`panel.tsx` modules, money-hub mechanics copied exactly, including stay-mounted panels
   and the scroll-chevron tab bar).
2. **Enumerate every inbound door to every report BEFORE writing redirects** — the nav project
   proved "it has one parent" is a whole-codebase claim (playing time had FOUR doors: hub tile,
   game console, Overview tile, team page "Season insights →"). Known minimum: `askReportHref`
   consumers (findings strip), Overview tiles, game console links, help-content deep links
   (`#premium-insights`), roster/attendance cross-links. Old report URLs 307/replace to
   `/history?section=…` (legacy-address pattern).
3. Remove: CoachAskBar + `/ask` route + `ASK_QUESTIONS` (keep `askReportHref` — relocate beside
   the findings engine; keep `coach-position-recency` + `coach-practice-misses` for P2; check
   `coach-family-dues` remaining callers before touching — it may serve money surfaces).
4. Remove money: dues scoreboard tile; the two dues findings in `lib/insight-findings.ts`;
   dues/expense columns from the past-seasons shelf render (endpoint may keep returning them —
   UI stops reading; do NOT touch `HISTORY_ENDPOINTS` membership).
5. Dashboard: 5 tiles + findings + all-reports rail (one live stat per row — stats already in the
   summary payloads each panel fetches; do not add N new endpoints for the rail, one summary read).
6. Renames: tab titles per §2; nav "Development" → **"Skills & Goals"** — ⚠ the capability gate in
   `isCoachNavItemVisible` is keyed by LABEL with `default: return true`; add the new label case
   and KEEP `'Development'` as fallthrough (Email-families/Announcements precedent), or an
   ungranted assistant gets the door.
7. Gate change: nav "Insights" moves from `hasRecordAccess` to a record-access-minus-money
   predicate — a money-only treasurer assistant now has nothing here; their home is the Money hub.
   Pin with a test (helper sees nothing; treasurer-only sees no Insights; any real assistant keeps it).
8. Docs/demo in the same unit of work: help guides + hub arrays (`lib/help-content/coaches.tsx`),
   portal tour steps, coach-demo dock copy/tour narration (CLAUDE.md demo-drift rule), Ask bar
   removed from help.
9. Tests: rewrite ask-bar/ask-route tests out; findings tests lose dues cases; nav-groups test
   pins the new label set; `coach-attendance-home.test.ts` reworked (the Insights door IS the tab
   now); **layout sweep must address each `?section=` URL** (money precedent: layout screens
   address section URLs; a hidden panel is an unmeasured panel).

### P2 — drill-ins and the absorbed Ask answers — one owner QA walk
1. Attendance: sortable table, missed-most highlight, RSVP reply-rate stat, per-player
   missed-events receipts drill-in (reuse the pinned-receipts discipline from the Ask build — the
   cited record must survive any cap).
2. Playing Time: position recency matrix + arm care panel. Both live-season-only by construction
   (they ride the existing lineup-analytics route — guard test must stay green untouched).

### P3 — charts — one owner QA walk
1. Dashboard momentum chart (cumulative score-unit diff from recorded results).
2. Results trend chart + result-pip strip; monthly attendance chart if not landed in P2.
3. Chart colors: brand lime for single-series; lime + blue for the one two-series chart with
   direct labels + legend (CVD-validated 2026-08-18; the lime sits above the generic lightness
   band deliberately — brand fidelity, thin marks).

---

## 4. Risks & standing rules this must not break

- **No year parameters.** No panel and no new route reads `?year=` — `HISTORY_ENDPOINTS` /
  `HISTORY_PAGES` in the guard test are untouched by this project. The portal is live-season-only.
- **Closed season stays one page.** No finished-season branches; the season gate handles it.
- **Label-keyed gates** (twice above — the single most repeated defect class in this repo's nav work).
- **check:layout blindness**: stay-mounted hidden panels + any collapsed sections must be
  addressed per-section in `scripts/layout-screens.mjs`; reseed the UAT fixture before sweeping.
- **CSS module purity** (global rule in a `*.module.css` hard-fails the prod build).
- **Panels stay mounted** — a panel owning a local copy of shared data must not let the parent
  re-derive from its own copy (money P2 Critical).
- **`--changed` layout check is a false green once committed** — force `--only` on the touched screens.

## 5. Success criteria
- A coach flips between all seven reports without losing the tab row; every old report URL and
  every enumerated inbound door lands on the right tab.
- Zero money strings/figures render anywhere under `/history` (grep + rendered check).
- The Ask bar is gone and all six of its answers are findable as permanent report fixtures.
- Nav shows "Skills & Goals"; no assistant gains or loses a door except the money-only treasurer
  losing Insights (deliberate).
- Help, tour, and demo narration speak the new names in the same release.
