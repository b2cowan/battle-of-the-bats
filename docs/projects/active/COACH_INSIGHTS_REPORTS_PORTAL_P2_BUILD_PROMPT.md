# BUILD PROMPT — Insights Reports Portal, Phase 2 (the drill-ins)

You are building **Phase 2 only** of the Insights → Reports Portal. **P1 (the tab shell) is built,
QA-passed and committed.** Read these first, in order:

1. `docs/projects/active/COACH_INSIGHTS_REPORTS_PORTAL_PLAN.md` — the plan (§2 target structure,
   §3 P2 tasks, §4 standing rules, plus the P1 build notes at the top recording where the build
   departed from it).
2. The owner-approved mockups (the spec — deviations get raised, not silently made):
   https://claude.ai/code/artifact/7d02e402-fd59-4b11-8d88-33fe95fffd8c
   P2 delivers the Attendance and Playing Time tabs' new content. **P3 (every chart) is OUT OF
   SCOPE** — do not build the monthly-attendance chart or the momentum chart "while you're in
   there".
3. `AGENTS.md` / `AGENCY_RULES.md` — especially: no commit without explicit owner OK, explicit
   pathspecs only, re-check the branch is `dev` before committing.
4. `docs/projects/active/OWNER_QA_LEDGER.md` **§58** — what P1 shipped and how it was walked.

⚠ **THIS REPO IS A SHARED WORKING COPY AND IT BIT P1 TWICE.** Another session committed while P1
was staged and swept three of its files into their commit; the same session had left work staged in
the shared index. Run `git status` before you start, expect files you did not touch to be modified,
and stage explicit pathspecs only.

---

## ⚠⚠ START HERE — FOUR THINGS THE PLAN GETS WRONG

These were all verified against committed code while writing this prompt. **Do not begin building
until the first one has an owner answer** — it is a design decision, not an implementation detail.

### 1. The plan says "sortable attendance table". The code says never, in as many words.

`history/attendance/panel.tsx` carries this above its table header, and it is not a stray comment —
it is the shape of a standing ruling:

> ⚠ NO sort affordance on any column, ever. Roster order is the only order — this is a support read
> to inform playing-time decisions, and a sortable column is a leaderboard however neutrally it is
> drawn.

The approved mockup shows the table **sortable, with a "Missed most practices" flag on a named
child.** Both cannot be true. The mockup is the more recent artefact (2026-08-18) and mockups are
the spec in this repo — but this rule is the same family as
`memory/decision_playing_time_vocabulary.md` (measurement in context, never a verdict) and the
Development report's "checklist, never a ranking", and reversing it by implication is not the way
those get reversed.

**Take this to the owner before writing code.** Frame it as what it is: *does the attendance table
get to rank children by who turns up least?* Options worth putting in front of them include sorting
without a highlight, a highlight without sorting, and keeping roster order and letting *What stands
out* do the naming (it already names the least-reliable player, once, in a sentence). Whatever comes
back, record it in `docs/agents/strategy/BUSINESS_DECISIONS.md` or the design log — this is the
second time this surface's ranking posture has been decided and it should not need a third.

### 2. The arm-care panel's data does not exist in the shape the mockup shows.

The plan says the arm-care panel's "data already exists in `lib/lineup-season-analytics.ts`". It
does not, and this was verified module by module:

- `SeasonLineupAnalytics.armCare` gives **season totals against a PER-GAME cap**
  (`inningsPitched`, `gamesPitched`, `perGameCap`, `overCapGames`).
- `lib/coach-arm-care.ts` (`resolveArmCare`) is anchored to **TODAY'S game** — it answers "who
  should not pitch tonight", and returns `daysSinceLastOuting` / `lastOutingInnings`.

The mockup shows **"16 of 18 · 2 left"** and **"rested 14 days"** — innings against a *rolling
window* cap with a remainder. **Neither module produces that.** Budget for a new computation, and
decide with the owner what window the cap describes (a week? a rolling 7 days? the sport pack's
own rule?) before drawing a progress bar against it. ⚠ `lib/lineup-caps.ts` is the ONE home for
"the cap that applies to this player" and is shared with the game-day console's chip — three
surfaces quoting a child's arm-care ceiling must never drift apart.

### 3. Nothing feeds position recency any more — P1 deleted its only server-side assembler.

`lib/coach-position-recency.ts` survives (P1 kept it deliberately, and it is pure and unit-tested).
But the **only** code that ever fed it was the `/ask` route, which P1 deleted with the Ask bar. That
route did the assembly: `getRepTeamSeasonLineups` → `analyzeLineup(...).fairPlay` → per-player
`positionInnings` per game, ordered newest-first, which is the ordering `computePositionRecency`
documents as the caller's job.

So the recency matrix needs a **new server read** — either its own route or an extension of
`lineup-analytics` (which today returns `positionVariety` as a bare list of position NAMES, with no
dates and no per-game innings, so it cannot answer "days since"). Same for
`lib/coach-practice-misses.ts` and the attendance drill-in: the pure module is ready, its data path
is gone. **Neither is "already wired" — read the deleted route at `b291e027` before estimating.**

### 4. The plan's P2 line for attendance lists an "RSVP reply rate" with no stated source.

Confirm where a reply *rate* comes from before promising it. The attendance rollup's `known`
deliberately **excludes no-reply**, which is the opposite end of the same fact — a reply rate is
`replied / invited`, and `invited` is not in the payload the panel reads today.

---

## What P1 already established (do not re-litigate)

- **The portal is seven tabs on one page** at `/history`, addressed `?section=`. Panels live in
  `./{tab}/panel.tsx`, mount lazily, then **stay mounted** (`display:none`). The six legacy report
  routes are permanent redirects through `lib/coach-insights-legacy-redirect.tsx`; the folder→tab
  mapping has ONE home (`legacyInsightsSection`) and a test proves each stub passes its own folder
  name, because the first build let that function go dead while a comment claimed otherwise.
- **`CoachTabBar` is shared with the Money hub.** It has since gained a `sticky` prop for the money
  register. Insights does not opt in; do not flip that default.
- **NO MONEY ANYWHERE IN INSIGHTS** (owner ruling). The way it stays true is structural: the hub
  never fetches dues, which is what every money rule in the findings engine gates on. ⚠ Those rules
  **survive on purpose** for the Sunday digest, which is a notification and not this screen.
- **Looking back is gone from every live screen** (owner, 2026-08-19). No past-seasons list on
  Results, no "Compare every season" on Season's End. While a season runs there is no route to a
  previous one. `coach-finished-season-surfaces.test.ts` fails if either comes back.
- **The Insights nav gate is `hasNonMoneyRecordAccess`** — a money-only treasurer has no door here.
- **The nav workbench is "Skills & Goals"** everywhere, including its own page title; the word
  "Development" belongs to the coverage report tab alone. The old label is kept as a gate
  fallthrough — do not remove it.

## Standing rules that bind this build

- **No panel and no route reads `?year=`.** `tests/unit/coach-history-endpoint-guard.test.ts` fails
  the build if one learns to, and it scans `panel.tsx` files too. The portal is live-season-only by
  construction: `CoachTeamSeasonGate` sends a team with no live season to its closed-season page.
- **Playing time is measurement in context, never "fair" and never a verdict**
  (`memory/decision_playing_time_vocabulary.md`). This binds the recency matrix hardest: it must say
  how long it has been, never that someone is *owed* a turn.
- **Position recency may only claim what a saved lineup records** — the module's own header states
  this. A player who has never played a position is ABSENT from the answer, not shown with a
  season-long gap. Do not "improve" that by reading a roster's primary-position field: an intention
  is not a record.
- **Receipts survive any cap.** The attendance drill-in cites specific events; if the list is
  truncated, the cited record must still be reachable (the discipline the Ask build established).
- **Panels stay mounted** — a panel owning a local copy of shared data must not let the parent
  re-derive from its own copy. And **every write in a panel that keys its render on a team must be
  guarded against a superseded run**; `coach-insights-portal.test.ts` pins this after Playing Time
  shipped without it and could strand itself on "Loading report…" permanently.
- **CSS module purity** (a global rule in a `*.module.css` hard-fails the prod webpack build).
- **Mobile actions: icon-only with a hidden label + `aria-label`.** Verify layout claims with
  rendered computed styles, not screenshots.

## Same-unit-of-work obligations

- **Help guides** (`lib/help-content/coaches.tsx`) — the Insights topic describes the Dashboard as
  "two parts" and lists what each tab holds; both change if tabs gain sections. Re-verify every
  routing sentence.
- **The coach demo** (CLAUDE.md's demo-drift rule). The sandbox tour's playing-time step already
  narrates that tab; a recency matrix or arm-care panel appearing above the table is exactly the
  kind of change that leaves a demo sentence quietly stale. `npm run check:demos` proves the world
  is seeded, **not** that the narration is still true — that judgement is yours.
- **Tests**: the endpoint guard must stay green untouched; add coverage for whatever new read you
  build; keep `coach-insights-portal.test.ts`'s stale-guard assertion passing.
- **`scripts/layout-screens.mjs`**: the two tabs you are changing are already addressed
  (`coach-history-playing-time`, `coach-attendance`). ⚠ **A drill-in that arrives CLOSED is
  invisible to that sweep** — if the attendance receipts open on click, they need their own
  addressable state or they will never be measured, which is the trap `§58` records.

## The fixture (reseed before sweeping)

`node scripts/seed-uat-coach-fixture.mjs`. P1 added two things you will need:

- **A populated live season** — six finished games, 3-2-1, two one-run games, home and away, across
  league and tournament, plus two game tags. ⚠ It was added because the live season previously had
  **no finished games at all**, which let `check:layout` sweep seven tabs of empty states and report
  coverage it did not have. If you add a surface, make sure the fixture can actually fill it.
- **`uat-asst-treasurer`** — money and nothing else, the only persona that exercises the Insights
  gate. ⚠ Do not use `uat-asst-money` for access checks; it also holds attendance and lineups.

⚠ **Saved lineups are thin.** The fixture seeds ONE lineup (the live probe game). A recency matrix
and an arm-care panel need several games' worth of saved lineups across several positions to show
anything at all — plan on extending the fixture, and treat a green sweep over an empty matrix as no
evidence.

## Definition of done (P2)

The owner's ranking decision (item 1) is recorded before any table is built. Attendance gains its
drill-in with real receipts, and Playing Time gains the recency matrix and arm-care panel, each fed
by a data path that exists. No `?year=` anywhere. Typecheck + `verify:changed` + a focused layout
sweep on the two changed tabs (with a fixture that actually fills them) are green, and any finding
left red is stated as pre-existing with evidence that it reproduces on an untouched screen. Help,
demo narration and the QA ledger move in the same unit of work; the ledger gains a new § entry (next
free number — never re-sort the table) with a walk script. Commit only with explicit owner OK, on
`dev`, explicit pathspecs, and confirm with `git show --stat HEAD` that only your files landed.
