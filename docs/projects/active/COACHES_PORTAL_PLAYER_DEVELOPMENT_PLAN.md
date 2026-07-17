# Coaches Portal — Player Development (Roster Depth & Development, roadmap Phase 3) — Implementation Plan

> **Status:** 3A/3B/3C COMMITTED to dev 2026-07-17 (`ae48ead6`, `8bc62990`, `22f1cb41` — each through the full funnel). **3D BUILT on dev 2026-07-17 (uncommitted)** — the final slice. Shipped: **previous-seasons archive** on the Development card (confirmed-link CHAIN walked server-side w/ accept-boundary alias + hop cap; oldest→newest; goals/tests/attendance quoted per prior season; expand-in-place — deliberately never navigates to the prior season's editable profile) · **rollover carry-forward** (mig 192 adds carry_status/carry_decided_by/carry_decided_at to the links table; `startNextRepSeason` now MINTS CONFIRMED links for carried rows — factual provenance, best-effort, never fails the roll; one-time blueprint-blue banner on the Development card: View record / Yes bring forward [copies WORKING goals only, dedup-safe retry] / No start fresh; readings NEVER carry) · **Insights sixth doorway tile + Development coverage report** at `/history/development` (D4 Option B; board GET gained `historyLinked`; tile + report + hub door share the board GET; ceiling exception + package logged in memory/design_decisions.md; ONE conservative findings rule — count-only, silent until ≥3 covered AND ≥2 uncovered) · **Print summary (PDF)** (`buildDevelopmentSummaryDoc` in lib/export/pdf.ts — org header/footer settings, focus areas + dated readings, current season only, no share link) · /docs synced (new faq-premium-development-history; returning-players FAQ corrected for the rollover exception; start-next-season recipe + premium bullet + searchText). Gates: typecheck ✅ lint 0 errors ✅ org-context 249 ✅ dictionary 139 ✅ snapshots #192 ✅; cold restart, login 200, EACCES 0. NEXT: owner browser pass → /simplify → /review (high-risk; checklist: no-ranking on the report, archive never computes deltas, carry idempotency, blind-scoring untouched, PII-free PDF) → commit OK. ⚠ migs 189–192 dev-only, promote together; D2 privacy sign-off + D6 /marketing pass (banner + PDF copy) gate prod.
> **Branch:** `dev` (single shared branch).
> **PM brief:** [COACHES_PORTAL_PLAYER_DEVELOPMENT_PM_BRIEF.md](COACHES_PORTAL_PLAYER_DEVELOPMENT_PM_BRIEF.md)
> **Mockups (round 2, pending acceptance):** https://claude.ai/code/artifact/01f4f7a8-410b-4b68-b521-f9888a9d9d8e — M1–M9, labeled NEW/RESTYLED/UNCHANGED. Once accepted, mockups ARE the visual spec (binding memory rule).
> **Parent roadmap:** Phase 3 of the 5-phase Coaches Portal value roadmap (Phases 1–2 = tryout suite, shipped to prod 2026-07-03; see docs/projects/archive/COACHES_PORTAL_TRYOUTS_EVAL_PM_BRIEF.md §roadmap).
> **Provenance:** 9-agent ultracode planning run 2026-07-17 (4 code readers + 3 lens proposals [coaching-loop / trust-privacy / tryout-continuum] + adversarial judge). One reader died mid-run (tryout-identity); its ground was independently covered by the player-page reader + DATA_DICTIONARY.

## What this phase ships (product summary)

Per-player **Development** on the Premium Coaches Portal: free-text focus areas (IDP) with a status pill, coach-logged **measurables** against a per-team type library, a **Development hub** with **Evaluation Sessions** (whole-roster batch entry — the way coaches actually collect this data at practice) and a team development board, **returning-player continuity** ("possible match — verify", never auto-merge) with cross-season history + a season-rollover carry-forward prompt, a team-wide **coverage** card in Insights, and a printable per-player summary. Coach-facing only; no parent accounts (parked decision honored — design is forward-compatible but ships coach-only).

## Scope decisions locked (owner, 2026-07-17 — do not re-litigate)

1. **Evaluation Sessions + Development hub are IN** — the owner explicitly overrode the judge's cut of batch entry ("coaches input this data all at once during practice evaluations"), reshaped session-first: a session is the unit of work and persists as a reviewable artifact.
2. **The per-player Development card STAYS on the roster player profile** — owner: the player section in the roster is the home for ALL of a player's summary data (attendance, progress, awards, etc.). Hub = team-wide entry/overview door; profile card = per-player summary door. Both read/write the SAME records — never two datasets.
3. **Practice plans get a reserved SLOT in the hub, not a build** — Phase 4 (practice-plan builder) will fill the hub rather than minting new navigation later. Nothing practice-plan-shaped ships in this phase.

## Hard constraints (all binding — from owner decisions + shipped precedent)

1. **No parent/guardian accounts or parent-facing surfaces** (BUSINESS_DECISIONS.md 2026-06-30 deferral). PDF export is coach-generated, hand-delivered; never a shareable link.
2. **PIPEDA / data minimization:** continuity links store FKs + confidence tier + audit metadata ONLY — never a second copy of guardian PII. Free-text fields stay skill/goal-oriented; no behavioral-profiling fields.
3. **Supportive, never ranking** (Attendance-view precedent): no cross-player leaderboards; every roster-wide list renders in roster order or alphabetical — NEVER "least attention first". No team averages/percentiles beside a child's number.
4. **"Scrapbook, not scoreboard"** (owner decision 2026-07-09, retired season-over-season deltas): prior seasons render as dated archives side by side; never a computed delta/arrow/`improved N%`.
5. **Honest data:** sparkline only at ≥2 entries of the same type within the season; empty states are a plain sentence + one CTA, never zeroed charts; the verify chip simply doesn't render when there's no match.
6. **Blind-scoring integrity:** returning-player history NEVER surfaces on evaluator scoring screens (rep_tryout_evaluator_sessions views) — head-coach Decide/Decision-Board surfaces only. Explicit /review checklist item.
7. **No pitch-count drift:** measurables may include per-session velocity etc., but NOT per-outing pitch counts — reserved for roadmap Phase 5 (BUSINESS_DECISIONS.md 2026-06-29 operations-first).
8. **No CSV/vendor import** (Rapsodo/Blast etc.) — parked per BUSINESS_DECISIONS.md; manual coach entry only.
9. **Sport-neutral:** no hard-coded sport vocabulary; V1 measurable types are coach-defined per team (lib/sports.ts untouched). Sport-seeded starter suggestions are a listed fast-follow, not V1.
10. **IA rubric:** no new top-level nav. Development lives inside the player profile (Squad group), the Tryouts Decide surface, and an Insights hub section-card.

## Sub-phases (each independently shippable, in order)

### 3A — The Development card (M)
The standalone-value slice; ships alone if later slices slip.
- **Player-profile "Development" detailSection** on `app/[orgSlug]/coaches/teams/[teamId]/roster/[playerId]/page.tsx`, mounted exactly like `PlayerDocumentsSection` (flat card stack — mobile-safe by construction, no accordion needed). Mockup M1.
  - **Focus areas (IDP):** free text + one note + status pill (Working on it / Achieved / Parked). No score/rank/percent. Autosave + quiet "✓ Saved" + Undo, no Save button (platform convention). Status pills use blueprint-blue/success tokens — gold stays reserved for A-squad.
  - **Measurables:** newest-first mini-table (type, value+unit, date, note) + within-season sparkline at ≥2 entries; "+ Log a measurable" sheet (type picker from library, value, date=today, optional note). Mockup M2.
  - **Read-only context lines** quoting (never recomputing): depth-chart positions (lineup_profile), this-season field/bench innings (playing-time fairness data), attendance % of known. Mockup M1.
- **Per-team measurable-type library** — name+unit, rename/retire only (retire keeps history), mirrors the `rep_team_award_types` manage idiom. Mockup M3.
- **API:** new coach-scoped routes under `app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/…` mirroring the documents-route sibling pattern; auth via the existing `resolveCoachContext` + `denyUnless` path — no parallel auth.
- **Capability gating (V1, no new key):** goals gate on `notes`; measurables view gates on `roster`; ALL Development writes head-coach-only (matches rosterWrite/tryouts precedent) — pending owner decision D1.
- **Help + upsell:** recipe/FAQ in `lib/help-content/coaches.tsx`, extend the premium feature list; new `development` interest option in `lib/basic-coach-interest.ts` + ScopeShelf/ScopeCeilingInterest for FREE Basic coaches.

### 3B — Development hub + Evaluation Sessions (M–L) — rev 2 addition
- **New "Development" destination in the Squad nav group.** IA-rubric justification: a CONSOLIDATING move (sessions + team board + type library + future practice plans in one room), the anti-stacking answer — Lineups-landing precedent. Route the nav addition + hub layout through `/design` at build start; wire through the shared navVisible gate; same capability gating as 3A. Mockup M7.
- **Evaluation Sessions** (mockup M8): coach starts a session (date defaults today; picks which measurable types are being run), gets the roster as a tap-down batch grid — phone = one test at a time with a test switcher, ≥44px per-player rows; desktop = roster × selected-types grid. Debounced autosave, "N of M entered" progress, skip freely (absent players simply have no entry — honest data). The session persists as a reviewable artifact ("Jul 17 — 14 players, 3 tests"). Entries are the SAME `rep_player_measurables` rows (nullable `session_id` back-reference) — the profile card and the session grid are two doors to one dataset. Interaction idiom deliberately mirrors the shipped tryout check-in/station-scoring pattern: *the tryout is the first evaluation session of the year.*
- **Team development board** (mockup M9): whole-roster read view — active focus areas, latest value per prominent measurable, last-evaluated date. **ROSTER ORDER ONLY, no sort-by-result** — this is the first surface with many kids' numbers side by side (constraint 3 applies with teeth here and in the session grid).
- **Type-library manage panel** reachable from the hub (canonical home) as well as the profile card.
- **Practice-plans slot:** quiet "coming" placement in the hub layout reserved for Phase 4. Not built.

### 3C — Returning-player continuity (L)
- **Pure matcher function:** normalized guardian email + name similarity + **exact DOB** against ALL of the team's prior program years (`getRepProgramYears`), over both prior tryout registrations and prior roster rows. No fuzzy-match helper exists anywhere today (confirmed; DATA_DICTIONARY gotcha rep_tryout_registrations#6 "no dedup") — this is greenfield; confidence tiers will need iteration.
- **Link table** (`rep_player_continuity_links`, /dba sign-off required): FKs + confidence tier + status (`suggested`/`confirmed`/`rejected`) + audit (confirmed_by/confirmed_at). Rejected pairings are remembered and never re-suggested. FK design (two nullable FKs vs polymorphic ref) = explicit /dba decision. Never copies PII.
- **"Possible match — verify" UI** (mockup M4): quiet amber chip on the Decision-Board candidate card AND the manual roster-add path (pending owner decision D5); expands to side-by-side compare (name/DOB/guardian — never email alone; no bulk confirm-all); three choices: Confirm / Not the same player / Not sure yet (defers, re-surfaces).
- **Audit line + always-visible unlink** (mockup M5): "Linked to your 2026 season record — confirmed by you, Jul 17" + permanent "Not the same player — unlink"; unlink removes only the association, both source records untouched — a wrong sibling link is instantly reversible.

### 3D — History, rollover, coverage, print (M)
- **"Previous seasons" archive** on the Development card once a link is confirmed: dated, oldest→newest, archive framing only (constraint 4). Mockup M5.
- **Season-rollover carry-forward prompt:** a new-season roster row matching a prior row gets a one-time explicit banner — View old record / Yes bring forward / No start fresh. Never automatic. Kills the "my notes vanished at rollover" trust failure (rep_roster_players mints a NEW row per player per season; no copy exists today). Mockup M5.
- **Insights "Development" doorway tile + dedicated report page** (D4 DECIDED Option B, owner 2026-07-17): a SIXTH tile in the Insights hub — an owner-sanctioned exception to the documented 5-tile ceiling (log as a design decision at build start alongside the hub nav routing) — opening a report page with one row per active player: active focus areas, last-measurable date, history-linked; ROSTER ORDER ONLY. Owner rationale recorded: development is a growth pillar and the report page is the deliberate platform for future development analytics — build the page's layout to accept future sections (e.g., per-type trend views, player-vs-self only) without restructuring. + one conservative finding-ladder rule that stays SILENT until real usage exists and a real gap appears. Honest empty states on tile AND report (a team with no data sees an invitation, not a chart of zeros). Mockups: D4 comparison section (Option B frames) supersedes M6.
- **Printable per-player Development summary** via existing ExportMenu/pdf_exports (already free on every Premium team, no new billing gate): one page, goals + measurables archive, no deltas, no shareable link.

## Data model (all additive; dictionary + snapshots in the same unit of work per AGENCY_RULES)

| Table | Shape | Sign-off |
|---|---|---|
| `rep_team_measurable_types` | id, team_id, name, unit, status(active/retired) — mirrors rep_team_award_types | /db routine |
| `rep_player_measurables` | player_id FK, measurable_type_id FK, value, unit snapshot, logged_at, note, created_by | /db routine |
| `rep_player_development_goals` | player_id FK, focus_area text, note, status, timestamps — **dedicated table, not jsonb** (3C must query goals across the player-row chain; jsonb on a row that's replaced every season can't) | /db confirm |
| `rep_team_evaluation_sessions` | id, team_id, program_year_id, session_date, note, created_by — the session artifact (rev 2) | /db routine |
| `rep_player_measurables.session_id` | nullable FK → evaluation session; singles logged from the profile card leave it null (rev 2) | /db routine |
| `rep_player_continuity_links` | FK-only + confidence + status + audit; spans roster-rows ↔ tryout-registrations across seasons | **/dba required** (FK architecture) |

Decide current schema from live snapshots/DATA_DICTIONARY, never migration files. Run `refresh:snapshots` + `check:dictionary`. Migration numbers = next available at build time (dev is at ~188; verify then).

## Owner decisions — ALL SIX DECIDED 2026-07-17 (D1/D2/D3/D5/D6 at the recommendations; D4 at Option B after mockup comparison)

- **D1 — DECIDED: head-coach-only writes in V1.** No new capability key; goals gate on `notes`, measurables view on `roster`. Revisit delegation only on real coach demand.
- **D2 — DECIDED: quick privacy sign-off is a PRE-3A GATE.** Mig-164 consent is captured ONLY at public tryout submission; nothing covers coach-typed development notes/measurables about already-rostered minors. 3A does not ship until this sign-off happens.
- **D3 — DECIDED: retention/purge spins out** as its own small project (policy decision: window + owner for old tryout PII + continuity links; no purge job exists anywhere today). Logged in TODO.md; route via /strategy + /db when picked up.
- **D4 — DECIDED: Option B (against the recommendation, after reviewing the side-by-side)** — full sixth Insights doorway tile + dedicated per-player report page. Owner rationale: development is an opportunity for growth and should provide robust coach analytics; the hub should be ready to handle it. Implications: the 5-tile ceiling exception + the report-as-analytics-platform intent are recorded in 3D; roster-order/no-ranking binds the report exactly as it would have bound the card; M6 (card) is superseded by the D4 Option-B frames.
- **D5 — DECIDED: both entry points.** The verify banner fires on the tryout Decision Board AND the manual roster-add path — 3C scope is two UI surfaces over one shared matcher.
- **D6 — DECIDED: /marketing tone pass is a PRE-SHIP GATE** for the match banner + printable summary copy.

## Cut list (judged out — do not quietly re-add)

- ~~Roster-wide "Measurables" third segmented view~~ — **UN-CUT by owner 2026-07-17**, reshaped as Evaluation Sessions in the Development hub (3B) rather than a Roster-page view. The Roster page itself gains nothing new.
- New `development` capability key (V1) — see D1.
- Curated/structured goal library — free text won; rubric-seeded suggestions live in fast-follows.
- Depth-chart cross-link badge — touches a shipped, stable, dense component for marginal benefit.
- ~~Full Insights doorway tile + standalone report~~ — **UN-CUT by owner 2026-07-17 (D4 = Option B)**; the section-card variant is what's now dropped.
- Any least-attention-first sort (constraint 3 violation caught by the judge in one proposal — corrected).
- CSV/vendor import, per-outing pitch logs, org-shared libraries, multi-hop chain viewer — parked/out of scope.

## Fast-follows (explicitly not in this phase)

Tryout-rubric-seeded focus-area suggestions (candidate's own lowest rubric categories as starter goals); sport-pack starter measurable sets; org-level shared libraries for multi-team clubs (rep_team_award_types nullable-team_id precedent); digest nudge ("3 players with no measurable in 60 days") via the shipped Coach Insights digest; bulk testing-day grid; friendlier "handout" PDF variant.

## Verification & process

- Per sub-phase: `npm run typecheck` (shared modules touched), `lint:focused`, `check:dictionary`, `check:org-context`; Playwright computed-style verification for the new card at 390/640/desktop (per the binding "verify with Playwright, not screenshots" rule).
- `/simplify` then `/review` (high-risk funnel) per sub-phase — the 3C review MUST include: blind-scoring leak check (constraint 6), sibling-collision UX, link-table PII audit, capability-gate parity client/server. The 3B review MUST include: no-ranking check on the session grid + team board (no sort-by-result anywhere), and profile-card ⇄ session-entry write-path parity (one dataset, two doors).
- `/docs` ships WITH each sub-phase (not a big-bang pass at the end).
- Dev-server restart before browser test (new files each sub-phase).
- No commits/pushes without explicit per-action owner OK.

## Risks (carried from proposals; mitigations in scope)

Matcher false positives/negatives (nicknames, remarried-guardian emails) → confidence tiers + never-auto-merge + always-reversible unlink. Sibling shared-email collisions → DOB-exact + name-forward compare UI, no bulk confirm. Rollover expectation gap → the 3C prompt exists precisely for this; help copy sets the boundary. Measurable-type drift → curated rename/retire library from day one. Scope-creep pressure toward vendor imports/pitch counts → constraints 7–8. Large phase → three independently shippable sub-phases, review per sub-phase, "one-pass complete" means one coherent release per sub-phase, not compressed review.
