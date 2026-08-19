# BUILD PROMPT — Insights Reports Portal, Phase 3 (the charts)

You are building **Phase 3 only** of the Insights → Reports Portal. **P1 (the tab shell) and P2 (the
drill-ins) are both built and committed** — P1 `0ebd0ffa`, P2 `de773962`. Read these first, in order:

1. `docs/projects/active/COACH_INSIGHTS_REPORTS_PORTAL_PLAN.md` — the plan (§2 target structure,
   §3 P3 tasks, §4 standing rules), **and the P1 + P2 build notes at the top**, which record every
   place the plan was wrong and what was done instead. Two of P2's three owner decisions reversed
   the approved mockup.
2. The owner-approved mockups (the spec — deviations get raised, not silently made):
   https://claude.ai/code/artifact/7d02e402-fd59-4b11-8d88-33fe95fffd8c
3. `AGENTS.md` / `AGENCY_RULES.md` — especially: no commit without explicit owner OK, explicit
   pathspecs only, re-check the branch is `dev` before committing.
4. `docs/projects/active/OWNER_QA_LEDGER.md` **§58** (P1) and **§61** (P2) — what shipped and how it
   was walked, including P2's post-build `/simplify` + `/review` addendum.

⚠ **THIS REPO IS A SHARED WORKING COPY AND IT HAS NOW BITTEN THREE TIMES.** P1 had three files swept
into another session's commit; P2 had **four** (`TODO.md`, `memory/MEMORY.md`,
`memory/design_decisions.md` and part of the QA ledger landed in `ecf2d73c`, a commit about
something else entirely). P2 also lost an hour to a rendered sweep that produced nothing because
another session was sweeping the same dev server. **Run `git status` before you start, check
`git log --oneline -5` for commits you did not make, expect files you never touched to be modified,
and stage explicit pathspecs only** (⚠ `[orgSlug]`/`[teamId]` directories need `:(literal)` — a bare
bracket pathspec stages NOTHING and reports success).

---

## ⚠⚠ PHASE 0 — NOTHING IS BUILT UNTIL THE OWNER HAS SEEN TWO THINGS

**This phase is gated, and the gate is not a formality.** P2 shipped three owner decisions that were
taken *before* code, and two of them reversed the approved mockup — had they been taken during the
build they would have been taken wrongly, because the mockup looked settled. Charts are the same
shape of risk: they look decided because a picture exists.

**Do not write a line of chart code until both of these have been presented and answered.**

### 0a. A product-manager UX summary, in the conversation (AGENCY_RULES, blocking)

Plain language, written for a product owner, not an engineer: what a coach sees and does differently
after this change, what it is drawn from, who sees less (access differences), and what it
deliberately does **not** say. No file paths, no function names. This is a required step in this
repo and P3 does not get to skip it.

### 0b. A mockup of the STATES, published as a Claude Artifact

⚠ **The three chart SHAPES are already owner-approved** in the artifact linked above — momentum,
run-differential trend with its result strip, monthly attendance bars. **Do not re-mockup those.**

What has **never been drawn, and is where a chart actually misleads**, is everything that is not the
happy path. Mock these, for each chart, at **both 361px and desktop**:

| State | Why it needs drawing |
|---|---|
| **Nothing recorded yet** | A brand-new season is legitimately blank. Does the chart vanish, or hold its space with a line of teaching copy? |
| **One data point** | The shared sparkline's standing rule is *render nothing below two points — a single reading is not a trend*. Show what one played game looks like. |
| **Played but unscored** | ⚠ The sharpest one. The Results tab already says records count only games with a score entered. A trend line that silently skips those games while the log beside it lists them puts two accounts of the same games on one page. |
| **Failed to load** | The Dashboard's own rule is that a tile with no data is ABSENT and an absent tile claims nothing. Does a chart follow it, or say "couldn't load"? |
| **Phone, happy path** | The mockup's charts are desktop-width SVG. A season trend at 361px is the state most coaches will actually meet. |

**And put the three open decisions below (items 1, 3, 4) in that same session**, each with options and
a recommendation — the format the P2 mockup session used, which is why its reversals were caught
before code rather than after.

⚠ **Mockups are published as Claude Artifacts, always** — not pasted into chat, not committed as HTML.
Once approved, the artifact IS the spec, and any deviation during the build gets raised rather than
silently made.

---

## ⚠⚠ THE OPEN DECISIONS — ALL THREE ARE THE OWNER'S, NOT YOURS

Items **1**, **3** and **4** below are decisions, not implementation details. An earlier draft of this
prompt asked the owner about the palette and left the other two reading as though the builder should
just pick — which is how a settled-looking plan produces an unsettled product. Take all three into
the Phase 0 session.

---

## ⚠⚠ ALSO READ — FIVE THINGS THE PLAN GETS WRONG OR LEAVES OPEN

All five were verified against **committed** code while writing this prompt. **The first is a design
decision and needs an owner answer before any chart is drawn.**

### 1. The chart palette says "CVD-validated 2026-08-18". Nothing records that validation.

§3 P3.3 of the plan reads:

> Chart colors: brand lime for single-series; lime + blue for the one two-series chart with direct
> labels + legend (CVD-validated 2026-08-18; the lime sits above the generic lightness band
> deliberately — brand fidelity, thin marks).

`memory/design_decisions.md` has **no chart-colour entry at all** — not on 2026-08-18, not on any
date. So either that validation happened in a session that never recorded it, or the sentence
records an intention as though it were a finding. **This repo has been bitten by exactly that shape
before**: the July token guardrail's "zero hardcoded colours" read as a legibility guarantee it never
made, and 1.65:1 text shipped under a green gate for months.

**Take it to the owner before drawing anything**, and whatever comes back, **record it in
`memory/design_decisions.md`** so the third chart does not re-litigate it. Two specific things to put
in front of them:

- **Does the lime sit above the palette's own lightness band on purpose?** The plan says yes, for
  "brand fidelity, thin marks". That is a real trade — a thin lime stroke on the dark ground is the
  legible choice; the same lime as a filled area is not. Ask which marks it applies to.
- **⚠ Colour may never be the only channel** (`memory/reference_warm_theme_badge_contrast.md`, and
  the olive↔danger ΔE 1.0 finding on the budget card). The mockup already does this right — direct
  labels on the last point, a legend with words. Keep it, and check the **warm** theme, which the
  static contrast gates do not read.

### 2. There is a shared chart primitive, and it is deliberately NOT the one you want.

`components/charts/Sparkline.tsx` exists and is used by three surfaces. **Do not extend it into a
full-width chart** — read its header first: it is a 52×16 inline mark, `aria-hidden`, for
"player-vs-self / metric-vs-itself only, **never a comparison between people**". Widening it would
drag that contract onto three existing callers.

But **its two rules are the precedent and they bind P3**:
- **It renders NOTHING below 2 points** — "a single reading is not a trend". Your momentum chart over
  one played game must render nothing, not a dot on an axis.
- It is a **shared component, not a shared class** (`memory/feedback_shared_component_over_shared_class.md`
  — a class stops style drift, not markup drift). Three charts hand-rolling their own axes, labels
  and empty states is how they end up disagreeing about what "no data" looks like.

⚠ **There is no chart library in `package.json` and adding one is a decision, not a detail.** The
mockup's charts are hand-authored inline SVG and are small enough to stay that way. If you propose a
dependency, say what it buys over ~60 lines of SVG and who else would use it.

### 3. The two chart data paths already exist. The third does not, and it is now gated.

Verified:
- **Momentum chart (Dashboard)** — the hub already holds `events` in state with `teamScore` /
  `opponentScore`, and already computes `scoredGames` from them. Cumulative score-unit differential
  is a reduction over data on the page. **No new fetch.**
- **Results trend + pip strip** — the Results panel fetches the same events itself. **No new fetch.**
- ⚠ **Monthly attendance chart — READ THIS BEFORE ESTIMATING.** The attendance route returns
  per-player season TOTALS, which cannot produce a per-month series. P2 added a per-event marks read
  to that route… **but P2's `/review` gated it behind `canViewSchedule`**, because each mark carries
  an event's date and name and enumerating them is schedule content (the same joint gate
  `season-results` takes). So a monthly chart fed from those marks **inherits the schedule gate** —
  an attendance-only coach would see the table and no chart.
  ⚠ **OWNER DECISION — take it to Phase 0** with these options and a recommendation: (a) accept the
  gate, so an attendance-only coach sees the table and no chart; (b) return a schedule-blind
  per-month aggregate — counts by month carry no event names, so the gate does not apply, and this
  is probably the honest answer; (c) leave the monthly chart out of P3. **Whatever comes back, do
  not quietly widen what the marks read returns in order to un-gate it** — that would undo a fix
  P2's security review made on purpose.

### 4. The mockup shows the shapes but not one of the states. ⚠ OWNER DECISION — this is Phase 0b.

Every chart needs an answer to all four states below, and the plan gives none. **Draw them and take
them to the owner** (the table in Phase 0b is the list); do not settle them at the keyboard:
- **No data** — nothing recorded yet. (The Sparkline rule: render nothing.)
- **Not enough data** — one game. A two-point axis is not a trend.
- **Partial data** — games played but unscored. ⚠ The Results tab already states "Records count only
  games with a score entered"; a trend line that silently skips them while the game log lists them
  is two surfaces on one page describing the same games differently — **the exact obligation
  `memory/design_decisions.md` records from the budget-vs-actual chart: when two surfaces on one page
  describe the same figures, fixing one obliges you to fix the other in the same pass.**
- **Failed to load** — the Dashboard's rule is that a tile with no data is ABSENT and an absent tile
  claims nothing. Decide whether a chart follows it.

### 5. A chart is the widest thing on these pages, and the sweep measures width.

`scripts/layout-screens.mjs` already addresses every tab you are touching — `coach-history` (the
Dashboard, at `/history`), `coach-history-results`, `coach-attendance`. **You are adding no screens;
you are making three measured screens wider.** Expect `content-overflow` findings at 361 and re-run
until clean rather than baselining them.

⚠ Use `CoachScrollX` if a chart genuinely needs to scroll — it owns the scroller **and** its swipe
hint together (Chunk A rule); do not hand-roll an `overflow-x` div beside a separate hint. A
responsive `viewBox` that simply scales is better than a scroller for a season trend.

---

## What P1 and P2 already established (do not re-litigate)

- **Seven tabs on one page** at `/history`, addressed `?section=`. Panels mount lazily then **stay
  mounted** (`display:none`). `CoachTabBar` is shared with the Money hub.
- **NO MONEY ANYWHERE IN INSIGHTS** (owner ruling). Structural: the hub never fetches dues, which is
  what every money rule in the findings engine gates on. ⚠ Those rules survive for the Sunday
  digest, which is a notification and not this screen.
- **Live-season only, structurally.** `CoachTeamSeasonGate` sends a team with no live season to its
  closed-season page. **No panel and no route reads `?year=`** —
  `tests/unit/coach-history-endpoint-guard.test.ts` fails the build if one learns to, and it scans
  `panel.tsx` files too. Playing time is live-season-only **permanently** (its figures are
  RECOMPUTED).
- **Panels stay mounted, so every write keyed on a team is guarded against a superseded run.** P2
  added that guard to the Attendance panel; ⚠ note the pinning test **skips any panel that has no
  guard at all**, so a new panel opts out by default.
- **The attendance table does not sort and badges nobody**, and **arm care draws no innings budget**
  (owner, 2026-08-19 — both in `memory/design_decisions.md`). A chart must not reintroduce either:
  no "who misses most" bar chart, no innings-remaining gauge.

## Standing rules that bind this build

- **Charts are measurement, never a verdict** (`memory/decision_playing_time_vocabulary.md`). A
  momentum line may show the season going up; it may not label a stretch "good" or a player "behind".
- **Every claim needs its receipts.** A chart point must be traceable to the games it came from —
  the caption naming the sample ("18 games with a score entered") is the minimum.
- **`formatStoredDate()` only** for any date on an axis; never a raw UTC slice
  (`memory/reference_stored_date_formatting.md`).
- **CSS module purity** — a global rule in a `*.module.css` builds on dev and **hard-fails the prod
  webpack build**.
- **Accessibility**: the mockup's `<svg role="img" aria-label="…">` is the right shape. The label
  must state the trend in words, because a screen reader gets nothing else.
- **Mobile actions: icon-only with a hidden label + `aria-label`.** Verify layout claims with
  rendered computed styles, not screenshots.

## Same-unit-of-work obligations

- **Help guides** (`lib/help-content/coaches.tsx`) — the Insights topic and the attendance/playing-time
  FAQs describe what each tab holds. P2 also fixed a stale routing sentence there that had survived
  P1; re-read every routing sentence rather than trusting them.
- **The coach demo** (CLAUDE.md's demo-drift rule). ⚠⚠ **P2 left you a live one:** its fix to the
  demo's saved lineups is **in the seeder**, so **neither demo world shows the corrected
  position-recency grid until its mid-season lineups are re-seeded** — nothing self-heals it. If you
  are re-seeding the demo for a chart anyway, that is the moment. And ask the two standing questions:
  *should a demo moment show this?* and *are the demo's sentences about this screen still true?*
- **Tests**: the endpoint guard must stay green untouched; keep `coach-insights-portal.test.ts`'s
  stale-guard assertion passing; add coverage for whatever pure reduction a chart needs (a cumulative
  series is a pure function and should be tested as one, **not** left inside a panel — that is the
  lesson P2 paid for when its recency pivot sat in a file no unit test could load).
- **QA ledger**: a new § entry (next free number — never re-sort the table) with a walk script.

## The fixture (reseed before sweeping)

`node scripts/seed-uat-coach-fixture.mjs`. P2 left it in good shape and you should know what it now
guarantees, because a chart over an empty fixture is the trap this project has hit twice:

- **Six finished league/tournament games, 3-2-1**, two of them one-run, home and away, two tagged.
  That is your momentum and trend series.
- **Six games' saved lineups**, four players position-restricted (so the recency grid has real
  dashes), plus arm-care caps.
- **Five practices** — four a week apart and one off-cycle — and season attendance with deliberate
  absences and no-replies.

⚠ **The season's games are fixed to April/May of the program year, deliberately** ("a rendered
baseline keyed on the screen's text must not drift every time the sweep runs"). Two consequences for
you: a **monthly** attendance chart will have few distinct months on this fixture, and the recency
values sit at 0/107/113 days so **the middle tint band never renders** (recorded in §61). If a chart
needs a denser or more recent spread, extend the fixture deliberately and say what you changed —
**do not re-date the existing games**, which would move the Results tab's baselines with them.

⚠ **A green `check:layout` over an empty fixture is not evidence** — §58 and §61 both record it.

## Definition of done (P3)

**Phase 0 happened first**: a PM UX summary was presented, and a states mockup (four states × three
charts × two widths, plus the three open decisions) was published as a Claude Artifact and
**approved** before any chart code was written. All three decisions — palette, monthly-chart gating,
empty/thin-data behaviour — have owner answers, and the palette ruling is recorded in
`memory/design_decisions.md` so a fourth chart cannot re-litigate it.

Each chart states its sample, renders nothing rather than a misleading line below two points, and
never disagrees with the table on the same page about which games count. No `?year=` anywhere. Typecheck +
`verify:changed` + a focused layout sweep (`--only`, never `--changed`) on `coach-history`,
`coach-history-results` and `coach-attendance` are green with a fixture that actually fills them, and
any finding left red is stated as pre-existing **with evidence that it reproduces on an untouched
screen**. Help, demo narration and the QA ledger move in the same unit of work. Commit only with
explicit owner OK, on `dev`, explicit pathspecs, and confirm with `git show --stat HEAD` that only
your files landed.
