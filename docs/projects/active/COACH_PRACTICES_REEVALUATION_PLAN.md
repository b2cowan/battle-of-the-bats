# Practices — holistic re-evaluation: the stage ladder, and stage 0 · Arrive

**Plan · 14 September 2026 · stage 0 ruled 2026-09-14 (D1–D8 all "Build as drawn") · stage 0 BUILT ON DEV and WALKED the same day (§186 passed 24/24) · commit owed**
Companions: [PM brief](COACH_PRACTICES_REEVALUATION_PM_BRIEF.md) · the walk + every stage's proposal on ONE artifact:
https://claude.ai/code/artifact/5c3d2f1b-5159-4d99-bad7-c48b2820da28 (source `COACH_PRACTICES_REEVALUATION.html` — republish the
SAME path / `url`) · kickoff prompt used for this stage: [COACH_PRACTICES_STAGE0_BUILD_PROMPT.md](COACH_PRACTICES_STAGE0_BUILD_PROMPT.md)

## 0. What this is

The owner asked for the practice workflow (schedule → plan → print → run → after) to be re-evaluated the way Skills & Goals was:
a walk of every screen as built (eleven stations, five standing-back questions), then **one proposal tab per stage, ruled and built one
at a time**, each stage drawn before/after at true size in the portal's own materials with clickable markers and Build-as-drawn /
Change-it / Not-now decisions. The walk's headline is a SHAPE, not a list of items: the plan maker is a form where a document should
be (a three-block practice is 6,627px and 59 inputs on desktop; the printed run sheet already has the shape the screen lacks).

**Owner direction, 2026-09-14 (binding for every stage):**
- **Practice plans is the hub for three things — the season's practices, plan templates and the drill library.** Skills & Goals is
  metrics, player goals and sessions only, linked to a practice only by *when a session happened*.
- **Tabs, not a dashboard and not stacked headers.** Practices · Templates · Drills; Practices is the landing. No overview tab, no
  tile row: the next-practice card and the "Needs a plan" chip are the room's whole state.
- **The nav entry keeps its name, "Practice plans."** Nav gates are keyed by label; Lineups is named for the instrument too.

## 1. The stage ladder

| Stage | Name | What it decides | State |
|---|---|---|---|
| 0 | **Arrive** — the Practice plans hub | The room opens on the next practice; the count means what is still to come; the past reads as a record; the room becomes the hub for templates and drills (tabs); the fresh-team empty state; the Overview's next-event card | **Ruled 2026-09-14 (D1–D8 as drawn) · built on dev and walked the same day (§186 passed 24/24, zero defects) · commit owed** — §3 below |
| 1 | **The blank page** — the plan page as a document (walk stations 1 · 3) | S.1 is decided here: date · time · length; the timeline; the first block; the rail as a fold; the sheet-shaped page. **First decision: the boundary question** (§2). **Last decision (D9): station 1's question — a practice needs an end time, the Add Practice form asks for it** — this page is built on it | Tab open on the artifact; nine decisions; mockups before any code |
| 2 | **The block** | One block's anatomy — description, goal, duration, people, coaching points — as a row that opens in place | not drawn |
| 3 | **Stations & rotation** | Stations as columns under a rotating block, the grid under them | not drawn |
| 4 | **The library** | The Templates and Drills tab ROWS (minutes · tags · first line), the library docked beside the plan on desktop, drag as an addition — **drag needs the owner's ruling (S.4)**; "reorder with buttons, never drag" stands until then | not drawn |
| 5 | **Paper & the field** | The run door's window on the plan page, "everyone" chips, the printed sheet | not drawn |
| 6 | **Afterwards & who sees what** | "How it went" timing (renders before the practice today), the closed-season shelf, the recap line's second half if not ruled at stage 0 | not drawn |

**Two ladders, two numberings:** the walk's arc counts the eleven SCREENS (stations 0–10); the tabs count the STAGES built. Each tab names the stations it covers — Arrive took 0, 2 and 6 (the first screen, the list, the libraries as tabs); The blank page takes 1 and 3. Station 1 (Put a practice on the calendar) had no stage of its own until the owner asked why (2026-09-14): its one question is the end time, which stage 1 depends on, so it is stage 1's D9. A later stage may depend on an earlier ruling, which is why the tabs are added one at a time. Defects the walk logged that belong
to later stages are NOT fixed on the way past (the walk's "Across the walk" section lists them): the plan page offers Run practice at
any date and the run screen then counts the days; "How it went" renders before the practice; the builder's sheets do not close on
Escape; empty (0-block) templates are offered in "Start this plan from…".

## 2. The open boundary question — OPEN, ruled at the top of the stage 1 tab

The practice room reads goals in two places — the focus rail beside the plan, and the printed sheet's last section — and Insights
reads plans for coverage. With Skills & Goals now "metrics, goals and sessions only", do those reads stay?

**Recommendation on record: keep the reads** (the rail folded shut by default; managing goals stays in Skills & Goals). The clean-cut
alternative (rail → one-line link, the sheet loses its last section) is drawn at stage 1 for comparison. **Stage 0 does not touch the
rail, the sheet or Insights.**

## 3. Stage 0 · Arrive — in full

### 3.1 The rulings (owner, 2026-09-14, pasted from the artifact)

| | Decision | Ruling |
|---|---|---|
| D1 | The hub opens on the next practice — one card, the room's one lime, by state (Plan this practice · Open the plan · Run practice within the run window). No upcoming practice → no card. Nothing new stored. | Build as drawn |
| D2 | "Needs a plan" counts upcoming practices only, absent at zero. (A defect: it counted practices that already happened.) | Build as drawn |
| D3 | A past practice is a record: "No plan written · Open", never "Plan this practice"; a past row shows its recap's first line. | Build as drawn |
| D4 | A planned row says how the plan fits — "3 blocks · 60 of 90 min" — when the practice has an end time. | Build as drawn |
| D5 | A tab bar — Practices · Templates · Drills — Practices the landing; the two library pages move under it WHOLE (same rows, same actions, no back arrow to Skills & Goals). Stage 4 redraws their rows. | Build as drawn |
| D6 | The fresh-team empty state keeps its shape, loses half its words, gains the arc, and its button opens the Add Practice FORM. | Build as drawn |
| D7 | The Overview's next-event card, when the next event is a practice, follows the practice's state; "Take attendance" stays as the quiet link. | Build as drawn |
| D8 | No overview tab, no tiles. | Build as drawn |

**Three build calls the frames left open — raised before the build, unanswered, built on the recommendation (each a one-line reversal):**
1. **The no-plan card's second link, "Start from a template ›" — DROPPED for stage 0.** Making it do what it says means the plan page
   opens its "Start this plan from…" picker on arrival, a plan-page change this stage is told not to make. The card carries one action;
   Templates is one tab over. Stage 1 redraws the plan page and can place that door.
2. **The phone frame's "Your library" foot (Drills · Plan templates cards under the list) — NOT built.** It is a residue of the
   pre-tab-bar drawing; the same frame shows the tab bar at the top. The tabs are the doors at every width.
3. **The card's arrangement — built on the Overview's existing "one card, one lime" shape** (kicker + when · headline with the lime on
   its row · meta with the quiet links on its row) rather than the frame's two-column drawing, so the two cards D1 and D7 produce are
   one thing. The artifact's own Overview facsimile was drawn two-column too; the real card is three rows.

**Stated on the way in, so the walk does not find it:** D3 makes a past row SAY "record", but the page behind "Open" is still today's
editor — it will let a coach plan May's practice if they insist. The row stops inviting it; the page learns it is a record at stage 1.

### 3.2 What a coach sees and does differently

- **Practice plans opens on the next practice** as one card: "Next practice · In 6 days" · "Sun, Sep 20 · 3:31 p.m." ·
  "Practice review — next week · UAT Fields · 3:31–5:00 p.m. · 90 min" · the state chip ("No plan yet" / "Plan set · 3 blocks · 60 of
  90 min · 1 rotation") · the room's one lime by state. Within the run window the lime is **Run practice** and "Open the plan" is the
  quiet link. The card's practice is not repeated in the list below it. A coach who cannot write plans sees the card with "Open"
  (read-only) in place of "Plan this practice" — no lime the coach cannot earn.
- **"Needs a plan"** counts upcoming practices only; absent at zero (it stays mounted while toggled on, so the filter can be turned off).
- **Past rows**: "Plan set · Open the plan" or "No plan written · Open" (muted); a written-up practice shows its recap's first line.
- **Planned rows say the fit**: "3 blocks · 60 of 90 min · 1 rotation" when the practice has an end; "3 blocks · 60 min · 1 rotation"
  when it does not (the frame's wording — no "planned").
- **Tabs Practices · Templates · Drills.** Templates and Drills are the two pages as they were, under the Practice plans title, with
  their own header action ("+ New template ⌄" / "+ New drill ⌄") and help. The tabs are real addresses (`?section=templates|drills`);
  the template editor lives at `/practice/templates/{id}`. **The old addresses redirect.** The tabs are ABSENT for a coach the two
  library reads would refuse (schedule view without edit).
- **Fresh team**: "Plan a practice once, run it from your phone" · one sentence · "Schedule it → Plan it → Print it or run it → Write how
  it went" · "+ Add a practice" opens the Schedule with the Add Practice form already open (`?add=practice`) · "How practice plans work".
- **Overview**: when the next event is a practice the card's lime is Plan this practice / Open the plan / Run practice by state; the
  kicker reads "Next event · practice"; the meta line carries "No plan yet" / "Plan set"; "Take attendance" (while outstanding and
  granted) and "Open schedule" are the quiet links. A coach who cannot write plans keeps today's card for an unplanned practice.

### 3.3 Build design (technical)

**One "practice state → action" helper, `lib/practice-state.ts`** — the abstraction the card, the rows and the Overview share:
`RUN_WINDOW_MS` (moved from the hub; the ONE run window), `practiceHasPlan` (at least one BLOCK — never the row's existence),
`isInRunWindow`, `practicePlanState(event, nowMs) → 'none' | 'planned' | 'run'`, `practiceFitLabel(plan, startsAt, endsAt)` (D4),
`practiceRecapLine(recap)` (D3 — first line, trimmed). Unit-tested.

**The hub `practice/page.tsx` becomes the room's shell:** header ("Practice plans", no action on the Practices tab) → tab bar →
the section's body. `?section=` parsed by `lib/practice-plans-address.ts` (`parsePracticePlansSection`, `practicePlansHref`;
plain-node importable, unit-tested) — the Skills & Goals idiom (`CoachTabBar` on `?section=`). The two library pages move to
`practice/_PlanTemplatesView.tsx` and `practice/_DrillsView.tsx` (git mv; the same rows, actions, dialogs and header create — each
renders its own `CoachPageHeader` because its header ACTION and help section are its own, and the page-actions guard enumerates them
by file). The template editor moves to `practice/templates/[templateId]/page.tsx` (git mv). `practice/templates/page.tsx` redirects
the bare folder address to the tab (a static segment beside `practice/[eventId]` — without it the dynamic segment would capture the
address as an event id). The three old addresses under `development/` become server redirects (the `development/board` precedent).

**The card** is the Overview's `.oneThing` shape rendered on the hub (kicker `.oneKicker` + `.oneKickerWhen`, `.oneHeadRow` +
`.oneHeadline` + `.onePrimary`, `.oneMetaRow` + `.oneMeta` + `.oneAnswers`), `data-kind="next_practice"`; nothing new stored.
`CoachEventListRow` gains a `mute` chip tone, a `quiet` action tone and an optional `note` line (the recap). `CoachEmptyState` gains an
`arc` slot (the four-word arc under the description).

**The Overview (D7):** `lib/coach-overview.ts` — `AnchorInput` gains `practicePlan: PracticePlanState | null` (null = not a practice);
`eventActions` grows the practice branch (`plan_practice` needs `canWritePracticePlans`; `open_plan` / `run_practice` need schedule
view; attendance falls to the answers row while outstanding); three new `AnchorAction`s; `take_attendance` joins `AnchorAnswer`
(already there). The page maps the three to `${base}/practice/{id}` and `…/run`. Unit tests extended.

**The Schedule (D6):** a second deep-link effect — `?add=practice` opens `openAddForm('practice')` once the page has loaded, for a
coach who can add events; independent of the events list being empty (the `?event=` effect bails on an empty list, which is exactly
the fresh-team case).

**Gates and guards touched:** `tests/unit/coach-page-actions-guard.test.ts` (three rows re-homed; the redirect pages have no header),
`tests/unit/coach-history-endpoint-guard.test.ts` (no moved route learns a year — API routes are unchanged; the guard names API paths,
which do not move), `scripts/layout-screens.mjs` (`coach-development-drills/-templates/-template` → `coach-practice-drills/-templates/
-template` on the new addresses; new keys baselined with sibling reasons), `tests/uat/scenarios/drill-library-layout.spec.ts` (the URL),
help (`/docs`: `premium-drill-library` "Skills & Goals → Drills", `premium-plan-templates` "Development → Plan templates",
`faq-practice-plan-where`). No migration. No new API. Nothing about a drill or a template changes.

**Rules that bit, from the code:** lime is earned — the card owns the room's one lime and no row carries one now; "has a plan" = at
least one block, shared by the card, the rows, the chip and the Overview through the helper; `isStale()` on every state write (the page
does not unmount when the team segment changes); live-season only — no page here learns a year; capability gates travel with the pages
(the hub reads on `schedule`; the two libraries on `canManageSchedule`; the tab is absent, never disabled, for a viewer the page would
refuse); every customer-visible word passes the spelling gate; times read "3:31 p.m.".

### 3.4 Verification (this stage)

Unit: `practice-state`, `practice-plans-address`, `coach-overview` (practice branch), the three guards. Static: `verify:changed`
(spelling included), `typecheck` after `next typegen`, `check:layout -- --only=` the touched ids, `check:demos`. Rendered: Playwright
against localhost with `tests/uat/.auth/coach.json` at 1440 and 390 — the hub in state 1 (planned next practice, as the fixture is),
the Templates and Drills tabs, the template editor, the Overview card, the three redirects, the empty state (by filtering the fixture's
practices out in a probe — no fresh team in the fixture, stated on the walk). The owner's QA walk: ledger §186, the checkable "QA
walk" tab on the artifact.

### 3.5 Build record (2026-09-14)

- **/simplify (four lenses) — applied:** the events list is fetched once per team, whichever tab the coach lands on (gating it on
  the Practices tab re-fetched and flashed "Loading…" on every return); the card's shell is `components/coaches/CoachOneThingCard.tsx`,
  and the Overview renders through it too; `relativeDayLabel` in `lib/timezone.ts` (both cards); the fit reading is
  `summarizePracticePlan(plan, { length })` — one builder, no string surgery — and `practiceFitLabel` is a one-liner over it;
  `CoachTabBar` returns nothing for a row of one tab; `parsePracticePlansSection` reads its own list; the row's `quietAction` derives
  from the action. **Skipped:** the hub owning one header across the three tabs (the tabs own their data and actions; the page-actions
  guard resolves `actions` per file); the `.arc` twin in the sibling's uncommitted stylesheet (rule of three, noted); a two-line "quiet
  text" CSS duplicate (a token decision).
- **/review (high-risk; correctness · security · regression · concurrency) — confirmed and fixed:** the hub's clock was a one-time
  snapshot driving the run window (now re-read once a minute, the Overview's own remedy); "Needs a plan" toggled the past half it never
  counted (the filter is the count's — upcoming only); a practice ending seconds after it starts read "60 of 0 min" (a length that
  rounds to nothing is no length); the templates Playwright spec still opened the old address (re-homed; two pre-existing failures in
  the two moved-page specs fixed on the way). **For the owner:** an unplanned practice that has already started is a "record" row while
  the card shows the next one — D1's letter; stage 5 rules it. **Refuted:** no card with only past practices (D1); the redirect
  "open redirect" shape; the views' missing stale-guard (pre-existing, unreachable); two deep links on one URL (nothing emits it). The
  Overview's quiet answers took the tap floor at ≤768 (the rendered gate measured 32px once two of them sat on the practice card) —
  seven pre-existing debt rows retired.
- **/docs:** `premium-practice-plans` landing sentence, `faq-practice-plan-where` (the card, the record rows, the count),
  `faq-practice-plan-no-plan-marker`, the `premium-drill-library` and `premium-plan-templates` door sentences ("the Drills / Templates
  tab of Practice plans"), `faq-overview-one-thing` (a practice as the next event); search terms added for every new phrase.
- **After the sibling's commit (`f6cdb7ff`):** its new `development/layout.tsx` gate (the ONE not-granted door for Skills & Goals)
  swallowed the three redirect pages for a coach WITHOUT the Development grant — a `redirect()` under a client layout reaches the
  browser inside the streamed children, and a layout that renders the block instead of the children never mounts it (verified as
  `uat-asst-nomoney`: an old drills bookmark stopped at the block). Fixed in the layout: `useSelectedLayoutSegment()` lets `board` /
  `drills` / `templates` through untouched — the addresses they redirect to carry their own gates. ⚠ A redirect page under a client
  gate is only a redirect for the coaches the gate lets through; test the refused persona, not the head coach.
- **Gates at hand-off:** typecheck clean · 3,919 unit · `verify:changed` green · `check:layout` clean on the five touched screens ·
  `check:demos` green · the two moved-page Playwright specs 21 pass / 1 skip (4 Insights-report cases red from the peer's committed
  Phase 3 rename — theirs). Ledger §186. Dev server restarted with this build.

## 4. Stage 1 — "The blank page" (opened on the artifact after stage 0's walk; no code in this chat)

The plan page as a document: date · time · length; the timeline; the first block; the rail as a fold; the sheet-shaped page (S.1 is
decided here). Before/after at true size in the portal's tokens, desktop 1440 and phone 390 with the 844 fold, clickable markers,
decisions with Build-as-drawn / Change-it / Not-now and a paste-back. Its first decision is §2's boundary question.
