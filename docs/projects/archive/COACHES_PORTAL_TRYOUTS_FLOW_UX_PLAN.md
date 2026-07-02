# Coaches Portal — Tryouts "Run Your Tryout" Flow UX — Implementation Plan

> **Status:** Build-ready — approved 2026-07-02; building
> **Branch:** dev
> **Trigger:** Owner UX review 2026-07-02 — the Tryouts page stacks 6 independent tools with no
> sequence, no "you are here", and no visible tie to the roster. New coaches (and once-a-year veterans)
> can't tell what to do first, in what order, or how results become their team.

## Goal
Wrap the existing tryout tools in a **guidance layer** that makes the flow self-explanatory: a top
progress header (4 stages + the single next action), the tools grouped under those stages with step
labels + a one-line "why", a re-openable "How tryouts work" overview, and a visible finish line that
connects accepted players to the Roster. **No change to the underlying tryout logic** — this is a
presentational/orientation wrapper. Guidance, NOT a locked wizard (coaches can still act out of order).

## The flow being made explicit (4 stages)
1. **Set up** (before the day): tryout dates → scorecard → (optional) invite evaluators.
2. **Tryout day**: check players in (bibs/walk-ups, blind) → score → live ranked scoreboard.
3. **Decide**: lock scoring → reveal names → Offer / Waitlist / Not this season → families respond.
4. **Build your team**: Accept → add to roster (with fees) → players land on the Roster (ready for lineups).

## Architecture
- **New coach-scoped read endpoint `tryout-overview`** — aggregates the state the strip needs in one
  call (sessions, scorecard, candidates/checked-in, scored, blind/locked, offer/waitlist/decline/accept
  counts, roster-from-tryouts) and computes `phase` + the single `next` action (first unmet step). Pure
  read; reuses existing getters (modeled on the decisions route). No new tables/migration.
- **New `TryoutFlowHeader` component** — the 4-stage progress strip (done/current/upcoming) + a prominent
  "next action" prompt + a collapsible "How tryouts work" 4-step overview (re-openable any time). Takes
  the overview data as a prop.
- **Page edits** (`…/coaches/teams/[teamId]/tryouts/page.tsx`): fetch the overview once; render the flow
  header at top; group the 5 cards under 4 labeled stage sections with **Step N · one-line purpose**
  headers; render a **"Build your team" results footer** (offered / accepted / on roster → Roster link).
- **CSS** in the coaches module (or a co-located module) for the strip + section headers. Reuse tokens.

## Phases
### Phase 1 — Overview endpoint
- [ ] `GET tryout-overview`: assigned-coach + active-program-year gate (fail-closed). Returns `{ phase,
  steps{setup,tryoutDay,decide,build: done|current|todo}, next{label,hint,anchor}|null, stats{…} }`.

### Phase 2 — Flow header component
- [ ] `TryoutFlowHeader` + styles: 4-stage tracker, next-action CTA (scrolls/points to the relevant
  card via anchor), collapsible "How tryouts work" overview. Mobile: horizontal scroll / stacked.

### Phase 3 — Page assembly
- [ ] Fetch overview; render header; wrap cards in 4 `<section>`s with step headers + purpose lines;
  add the "Build your team" results footer linking to Roster. Keep all tools freely reachable.

### Phase 4 — Docs + verify + review + commit
- [ ] `/docs` note (the recipe already covers the flow; add the "progress header guides you" line).
- [ ] Verify gate (typecheck · lint:focused · org-context · tokens). Adversarial `/review` (standard —
  read-only endpoint + presentational). Commit.

## Decisions
- **Layout = TABS per stage** (owner ratified 2026-07-02, after seeing the stacked-with-header version). Below
  the guidance header, a tab bar (Set up / Tryout day / Decide / Build team) shows one stage at a time; the
  tab numbers/checks double as the progress tracker (the separate 4-stage strip was dropped as redundant).
  Kept single-column within a tab (mobile/field-side); all panels stay mounted (card state preserved), the
  active tab defaults to the coach's current stage on first load, and the "Do this next" button switches tabs.
- **Guidance, not a wizard** — the tabs orient; every tool stays directly usable in any order.
- **One next action** — the page surfaces exactly one "do this next", derived from real state, to kill
  decision paralysis.
- **Finish line = Roster** — the flow explicitly ends at "players added to your roster → view Roster".
- **Once-a-year proof** — a re-openable overview + inline step labels mean the coach never relies on memory.
- **Freshness** — the strip fetches on load (orientation, not a live dashboard); a refresh reflects
  actions taken on the cards. (A live-refresh optimization is a future nicety.)

## Guardrails
- No migration, no tryout-logic change. Coach-scoped fail-closed endpoint. Design tokens (no new hex).
- PIPEDA unchanged (coach/admin-facing; the strip shows counts, not minor PII).
- `/design` may refine the strip visual after the functional pass.

## Out of scope (V1)
- Admin Rep Teams applicant page gets the same treatment later (this pass is the coach portal).
- Live auto-refresh of the strip as cards mutate (page refresh suffices for V1).
