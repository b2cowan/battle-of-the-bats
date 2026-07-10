# Coaches Portal — Lineups Hub (make Lineups the home of lineups, templates & analytics)

**Status:** PLANNED (2026-07-07). Awaiting owner sign-off before code. No migration.
**Branch:** `dev`. **Scope:** Premium Coaches Portal, org-scoped rep teams. Sport-neutral (softball/baseball today, via `lib/sports.ts`).
**Owner direction (2026-07-07):** "Full hub in one go" — the Lineups page should be the home of lineups, templates, and analytics; the builder should NOT be buried in a schedule modal; Schedule ⇄ Lineups cross-link.
**Related:**
- Sits inside the [Coaches Portal IA/UX Review](COACH_PORTAL_IA_UX_REVIEW_PLAN.md) (this is the "Lineups front-door → real home" follow-through; §9 binding constraints apply).
- Builds on the [Lineup Builder](COACH_LINEUP_BUILDER_PLAN.md) + [Lineup Intelligence](COACHES_PORTAL_LINEUP_INTELLIGENCE_PLAN.md) tracks (smart auto-fill / caps / depth chart). This project does NOT change generation logic — it **relocates** the builder and **rolls up** the analysis that already exists per-game into a season view.

---

## 1. Problem

The Lineups page today (`app/[orgSlug]/coaches/teams/[teamId]/lineups/page.tsx`) is a **front door only**: a stacked list of upcoming + recent games, each a deep-link into the schedule modal's Lineup tab (`schedule?event=<id>&tab=lineup`), with readiness chips and a footer note pointing templates back to the schedule.

All real functionality — drag batting order, per-inning position grid, saved **templates**, auto-generate, fair-playing-time **analysis**, arm-care **caps**, PDF poster/card exports — lives **inside a schedule slide-over modal** (`schedule/page.tsx`, ~439 of 3,293 lines touch lineups). So:
- The page that owns the nav slot does almost nothing.
- Templates (team-level, reusable) have no home — only reachable from inside a game.
- There is no season-level view of playing time, position variety, arm-care load, or which reused lineups actually won.

## 2. Goal

Make **Lineups** the real home:
1. **Games** zone — what needs a lineup, smartly ordered.
2. **Templates** zone — a real manager (view / rename / apply / delete).
3. **Season analytics** zone — five read-outs, all grounded in real saved data.
4. **Builder becomes a native Lineups sub-page** (`/lineups/[eventId]`), shared with the Schedule via one component. Schedule keeps a **read-only peek + "Edit in Lineups →"** link (owner choice 2026-07-07).

## 3. Binding constraints (from IA/UX Review §9 + walkthrough rules)

- **No DB migration.** Templates (mig 159), caps (172), lineups (070/071), and `rep_team_events.home_score/away_score/result` all already exist. If anything truly needs a migration, STOP and get owner OK.
- **Data honesty (hard rule).** Never render a number/row without real saved data behind it. A player/game/pitcher with nothing saved simply does not appear — no zeroes-as-content, no invented rows.
- **Capability gating (app-layer, both server route AND client UI).** Lineups views gate on `capabilities.lineups`; head coach = all. Analytics are lineup data (not guardian PII) → gate on lineups, never a PII gate. Money is not involved here.
- **CP-1 / coach dialect.** Exactly one lime action per surface; warm/rounded copy; mobile 900/640; touch ≥40px; lime = fills only; reuse the shared nav gate (`lib/coach-nav-visibility.ts`) — no new nav item needed (Lineups already exists).
- **Premium ≥ Free** — no regression to the free/basic portal (which has no lineups at all — untouched).
- **Sport-neutral vocab** via `getSportPack`/`DEFAULT_SPORT` — no hard-coded "runs/innings/mercy"; position codes already come from the sport pack.

## 4. Key data finding — "records by reused lineup" (READ THIS)

The owner's 5th analytic = "for lineups that have been reused, the top records per lineup (batting order) sorted by games played."

**Templates are NOT linked to games.** Per DATA_DICTIONARY, `rep_team_lineup_templates` is a convenience snapshot, explicitly *"NOT an analytics surface"*; loading a template fills the grid unsaved, and saving an event lineup records **no** `template_id`. So we **cannot** truthfully build "records by template name."

**Truthful approach (no migration):** group **saved event lineups** by a **batting-order signature** = the ordered list of `player_id` by `batting_order ASC` (NULLs excluded) from `rep_team_lineup_entries`. A "reused lineup" = a signature that appears in **≥2 games**. For each, compute the team record from `rep_team_events.home_score/away_score`:
- Derive W/L/T from **scores**, not the `result` column (`result` is client-auto-filled only and often NULL — DATA_DICTIONARY gotcha).
- Count **only games with both scores present** (a real recorded outcome). Games with no score don't count — shown honestly as "not yet scored," never as a loss.
- **Naming:** if a signature's ordered player set exactly matches a named template's order, borrow that template name; otherwise a generic label (e.g. first 3 batters + "…"). Best-effort, no stored link.

Edge cases to handle: single-game signatures are excluded (not "reused"); a team with <2 scored reused games shows an honest empty state; ties counted separately (W-L-T).

## 5. Season analytics — the five read-outs (all from saved lineups)

All computed by rolling up **existing** per-game analysis (`lib/lineup-analysis.ts`) across the season's saved lineups. New pure helper `lib/lineup-season-analytics.ts` (unit-tested), no I/O.

1. **Fair playing time** — per player: total field innings vs. bench innings across all saved lineups this program year. Sort by most-benched.
2. **Bench balance** — per player: total bench innings + count of games with back-to-back sits. Surfaces who's carried the load.
3. **Position variety** — per player: distinct positions actually played (count + list) across saved lineups.
4. **Arm-care / pitching load** — per pitcher: total innings pitched across saved lineups vs. their effective arm-care cap (`resolveLineupCaps`, per-player → season default). Flag anyone trending over.
5. **Records by reused lineup** — §4, sorted by games played desc.

**Honesty framing on the panel:** "Based on the N games you've saved a lineup for" + the count. If 0 saved lineups → single empty state, no metrics.

## 6. Architecture / phasing (one project, safe steps)

> **Delivery note (2026-07-07):** Step 1 split into **1a** (build the standalone builder page — done, unpushed) and **1b** (convert the schedule tab to the read-only Option-B peek + repoint the Overview "Build lineup" link + remove the now-dead editable lineup code from `schedule/page.tsx`). Splitting keeps the risky schedule surgery out of the same change the owner verifies the new page with.
>
> **1a shipped on `dev` (unpushed, not committed):** new full-page builder `app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx` (self-contained: owns its state, loads the lineup endpoint, persists lineup + attendance, keeps the attendance→lineup "who's playing" derivation, undo/redo, auto-fill/generate, templates, caps, PDF poster/card, playing-time summary). New shared `lib/coach-roster-name.ts` (name helpers). Additive route change: the lineup GET now also returns `event`. Lineups front-door rows link to `/lineups/[eventId]`. Owner-verified in browser + a name-alignment fix.
>
> **1b shipped on `dev` (unpushed, not committed) — 2026-07-07:** schedule modal's editable Lineup tab REPLACED by the read-only **Option-B peek** (mini-stats batting/innings/mode + batting order with each batter's inning-1 position + inning-1 field grid + "Lineup set/Not set" chip + **"Edit in Lineups →"** / "Build lineup →" lime CTA). Removed ~1,000 lines of now-dead editable lineup code from `schedule/page.tsx` (3293 → 2284 lines): all editable state, handlers, effects (autosave/undo/templates/popovers/attendance-sync), module helpers (SortableLineupRow, heatStyle, LINEUP_POSITIONS), and their imports (dnd-kit, generator/analysis/caps libs, poster export fns). Schedule migrated to the shared name lib. Overview "Build lineup" + setup-guide "Set lineup" repointed to the Lineups page. Peek CSS added to `coaches.module.css` (CP-1: single lime = the Edit CTA). typecheck clean; lint 0 errors (4 pre-existing set-state-in-effect warnings, none new); all routes compile (307). **Schedule keeps loading the lineup read-only; the load no longer syncs to live attendance edits (peek reflects the saved lineup).** ⚠ Concurrency: another chat has `admin/tournaments/registrations/*` modified — NOT part of this work; stage explicit pathspecs only.

### Step 1 — Extract the builder into a shared component (behavior-preserving)
- New `components/coaches/LineupBuilder.tsx` (or `app/.../lineups/_LineupBuilder.tsx`) housing the current schedule Lineup-tab UI + handlers: rows/DnD, mode, innings, positions grid, undo/redo, generate/auto-fill, templates popover, analysis "summary" view, caps, PDF exports. Props: `orgSlug, teamId, event, roster, seasonCaps, canWrite`, etc. **Pure lift** — no logic change.
- New route/page `app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx` renders the builder full-page (breadcrumb Portal / Team / Lineups / <game>). Gate on `capabilities.lineups` (client) + the existing lineup API routes already enforce server-side.
- **Schedule change (Q1 = Option B, fuller peek):** the modal's Lineup tab becomes a **read-only summary** — mini-stats (batting count / innings / mode), batting order **with each batter's position**, an **inning-1 field grid**, "Set/Not set" chip, and **"Edit in Lineups →"** link to `/lineups/[eventId]`. Remove the embedded editor from the modal (it now lives in the shared component on the full page). New small presentational piece `LineupPeek` (read-only) — do NOT re-run the editable builder in the modal.
- Deep-link compatibility: existing `schedule?event=<id>&tab=lineup` links (Overview "Build lineup", old Lineups rows) repoint to `/lineups/[eventId]`.
- **⚠ Risk:** this is the surgery. `schedule/page.tsx` is a hot, shared 3,293-line file. Re-verify it's clean before editing; stage explicit pathspecs; browser-test schedule + new page before moving on. This step ships with **no behavior change** so it can be verified in isolation.

> **Step 2c follow-ups (2026-07-08):** (1) **Blank-grid warning fixed** — the "couldn't fill positions" warning now only shows for innings the coach has actually started filling (`assignedInnings` filter in the editor), so a blank template/grid no longer nags. (2) **Inning-range auto-fill** — `generateLineup`/`GenerateOptions` gained `fillFrom`/`fillTo` (1-based inclusive; default all): only innings in range are WRITTEN, out-of-range innings are preserved AND still counted toward caps/bench/back-to-back so filling a sub-range respects what's already set. Editor auto-fill menu has an "Innings to fill: [from] to [to]" control; Reshuffle honors it too. 9-player bench handling made range-aware (out-of-range bench cells preserved). typecheck + lint clean.
>
> **Step 2c — Shared editor consolidation + auto-fill/Reshuffle BUILT on `dev` (unpushed, 2026-07-08).** Owner chose "merge first" + "Reshuffle = regenerate-all with confirm." Extracted pure grid helpers to `lib/lineup-grid.ts` and the whole editable surface (format/innings, auto-fill popover, **new Reshuffle** button, grid, playing-time view, add/remove, analysis warnings) into ONE shared controlled component `app/[orgSlug]/coaches/teams/[teamId]/lineups/_LineupEditor.tsx`. **Game builder REWRITTEN** to render `<LineupEditor>` (keeps its own load/autosave/undo-redo/PDF/attendance-mismatch reconcile/notes/Templates popover [passed via `controlsExtra`]). **Template builder** now renders `<LineupEditor>` too → it gets auto-fill + Reshuffle for free (the earlier "deferred auto-fill" is resolved). Reshuffle re-runs generate with current settings forced to regenerate-all + overwrite confirm (generator is randomized → genuinely fresh each tap). typecheck + lint clean; routes compile. ⚠ HIGH-risk: the reviewed game builder was rewritten — needs careful browser test + a re-`/review`. Minor intentional drops from the game builder: the "roster order" hint line + the per-row "· marked in"/absent tags in the not-in-list (the mismatch banner still surfaces those). Clear-positions moved into the editor (out of the footer icons).

> **Step 2 BUILT on `dev` (unpushed, 2026-07-08).** 2a: Lineups landing rebuilt into **Games** + **Templates** zones; Templates manager lists saved templates (name/format/innings/player-count) with **rename** (inline), **delete** (confirm), and **Apply** (game picker modal → overwrite-aware confirm → maps template onto the game's roster, skips off-roster players, PUTs the game's lineup — attendance untouched). Single lime = "New template". 2b: standalone **template builder** at `/lineups/templates/[templateId]` (`new` = create, id = edit) — reuses the grid (drag order, positions, format, innings, add/remove players), "Save template" (POST new / PATCH edit). Server: new `updateRepTeamLineupTemplate` (partial), **PATCH** on the template route (rename + full edit-save), templates GET now also returns the active **roster** (redacted, lineups-gated) so the builder needs no game. Load-cancel guards added (review pattern). typecheck + lint clean; routes compile. **Deferred from the template builder (noted): auto-fill/generate + PDF export (game-time tools); the row grid + pure helpers are duplicated from the game builder (consolidate to a shared module later).**

### Step 2 — Rebuild the Lineups landing page into zones
- **Games** zone: keep upcoming/recent + readiness chips; rows now link to `/lineups/[eventId]`. Single lime action = "Build lineup" for the nearest game that needs one.
- **Templates** zone: a real manager listing `rep_team_lineup_templates` (name, mode, innings, player count). Rename + delete via existing `lineup-templates/[templateId]` route; "Apply to a game" opens a game picker → `/lineups/[eventId]` with the template pre-loaded (or applied in-builder). No lime here (lime already spent on Build).
  - **Standalone template creation (owner ask, 2026-07-07):** a **"New template"** action opens the SAME builder in a **template mode** — no game/attendance attached, pick players + batting order + positions, "Save template" instead of game auto-save. Reuses the `/lineups/[eventId]` builder (parametrized for template vs game). Lets coaches pre-build templates ("Gold medal", "Rain day") without a game. Templates stay program-year-scoped / player_id-keyed (current-season roster), same as today. Needs a template-scoped save path (POST/PUT `lineup-templates`) — likely a `/lineups/templates/[templateId]` (or `/new`) route reusing the builder component. No migration.
  - **Locked decisions (owner, 2026-07-08):**
    - **Apply flow = pick game → confirm → apply directly (no builder step).** Tapping "Apply" on a template shows a game picker; choosing a game raises a **confirmation modal** that is **overwrite-aware**: if the chosen game already has a saved lineup, the modal says so and asks to overwrite (Overwrite / Cancel); if not, a simple "Apply '{template}' to {game}?" Confirm writes the template onto the game's lineup **directly** (no builder round-trip). Apply = PUT the game's lineup with the template's mode/innings/entries **filtered to the game's current active roster** (skip players no longer rostered, report count) — reuses the existing lineup PUT (which validates roster membership). Requires knowing if the game has a lineup (reuse readiness probe or fetch the game's lineup when picked).
    - **New template build = its OWN dedicated template-builder page** (reuses the builder component, no game/attendance context, "Save template" action) — NOT a modal. Also the natural home for editing an existing template later.
- Cross-links: "Saved templates" footer note removed (they're here now); keep a link to Schedule. The builder page links back to the game on the Schedule (`?event=` deep-link) — **shipped 2026-07-07**.

> **Step 3 BUILT on `dev` (unpushed, 2026-07-08).** Season analytics zone on the Lineups landing page — five collapsible (`<details>`, default-collapsed) read-outs, all from SAVED lineups with an honesty basis line + honest empty states: **fair playing time** (field vs bench innings, most-benched first), **bench balance** (bench innings + back-to-back games), **position variety** (distinct positions played), **arm-care/pitching load** (innings pitched, games, per-game cap, over-cap flag), **records by reused lineup** (batting-order signature run ≥2×, W-L-T from real team scores only, template name borrowed when the order matches). Pure engine `lib/lineup-season-analytics.ts` (reuses `analyzeLineup` per game, rolls up) + 9 unit tests (`tests/unit/lineup-season-analytics.test.ts`, all pass). New bulk `getRepTeamSeasonLineups(programYearId)` + `GET /api/coaches/.../lineup-analytics` (gated on lineups). No migration. typecheck + lint clean; routes compile. **Hub is now feature-complete (Steps 1–3).** Not yet through /review or /docs.

### Step 3 — Season analytics panel
- New API `app/api/coaches/[orgSlug]/teams/[teamId]/lineup-analytics/route.ts` (service-role read, gate on lineups): loads season's saved lineups + entries + event scores + roster + effective caps, returns the rolled-up shape from `lib/lineup-season-analytics.ts`.
- New pure `lib/lineup-season-analytics.ts` + `tests/unit/lineup-season-analytics.test.ts` (fair play, bench, variety, arm-care, records-by-signature; empty-data honesty cases).
- Analytics zone on the landing page: the five read-outs, honesty framing, collapsible sections, mobile-first. No new lime.

## 7. Verification

- `npm run typecheck` (touches shared component + new libs/routes).
- `npm run lint:focused -- <changed files>`.
- Unit tests for `lib/lineup-season-analytics.ts` (pure logic — required).
- Owner browser-tests each step (Step 1 first, in isolation).
- Offer `/review` (adversarial funnel) after Step 1 (the risky extraction) and after Step 3.
- Offer `/docs` — this changes a user-facing flow (where lineups/templates live); update `lib/help-content/coaches.tsx` (answerText/keywords: "lineup", "batting order", "template", "playing time", "records").
- Dev-server restart required (new files + shared component) — stop server, clear `.next`, restart, batch near handoff.

## 8. Non-goals / deferred

- No change to generation/caps logic (owned by the Intelligence track).
- No `template_id`-on-lineup migration (would let "records by template name" work, but §4 gives a truthful no-migration path; revisit only if owner wants named records badly enough to accept a migration).
- No Standings/placement (cut in IA/UX Review for data honesty).
- Cross-season analytics (V1 is program-year scoped, matching every other season control).

## 8.5 Attendance ↔ lineup reconciliation (owner, 2026-07-07 — supersedes the auto-sync model)

> **BUILT on `dev` (unpushed, 2026-07-07):** all three touchpoints + builder decoupling. Server: `getRepTeamLineupAttendanceMismatchEventIds` (lib/db.ts) + `lineupMismatchEventIds` on the events GET (gated on lineups). Schedule: ⚠ on `EventChip` (list/calendar/day-sheet), top-section warning banner (moved OUT of the peek), `mismatchIds` state. Builder: auto-sync REMOVED, no longer writes attendance; rows load from saved entries (new lineup → seed from roster); "Not playing" → "Not in the lineup" (roster-not-placed, lineup-only add); reconcile banner with "Add N coming" / "Remove N Out" buttons (lineup-only). typecheck clean; routes compile. Awaiting owner browser test.


**Principle:** attendance and the lineup are independent; neither auto-rewrites the other. When they disagree the coach decides which to fix (the attendance might be the wrong one). **Reverses the builder's auto-sync.**

**Mismatch** = for a game that HAS a saved lineup: a player marked **coming** (`attending`/`late`) is NOT in the lineup, OR a player IN the lineup is marked **Out** (`absent`). No lineup yet ⇒ not a mismatch.

**Three touchpoints:**
1. **⚠ on the event in the Schedule list/calendar** — server-computed (owner choice: all games). New `getRepTeamLineupAttendanceMismatchEventIds(programYearId)` (3 bulk queries: lineups → entries → attendance, computed in JS); events GET returns `lineupMismatchEventIds` (gated on `capabilities.lineups`). Client badges those events.
2. **Warning banner in the event detail top section** (above the tabs, not inside the Lineup peek) — computed client-side from the loaded saved-entry ids + attendance. Moved OUT of the peek.
3. **Builder page banner + reconcile actions** — same message, and **nothing auto-changes**. Buttons: **"Add coming players"** (adds the missing attending players to the lineup, unplaced) / **"Remove Out players"** (drops the marked-Out players) — lineup-side only; plus a note the coach can fix attendance instead.

**Builder decoupling (Part C):** remove the attendance→lineup auto-sync; the builder no longer writes attendance. Lineup rows load from the SAVED entries (new lineup ⇒ seed from active roster). Row ✕ removes from the lineup only; the "Not playing" list becomes **"Not in the lineup"** (active roster players not currently placed) with a lineup-only "Add". Attendance is loaded read-only just to compute the mismatch.

## 9. Locked decisions (owner, 2026-07-07, via browser mockup `public/mockups/lineups-hub.html`)

- **Q1 → Option B (fuller peek).** The schedule modal's Lineup tab shows a read-only **summary**: batting count / innings / mode mini-stats, batting order **with each batter's position**, an **inning-1 field grid**, status chip, and **"Edit in Lineups →"**. No inline editing in the modal.
- **Q2 → Collapsed.** The season analytics panel's five sections default **collapsed** (tap to expand) on all viewports; honesty line ("Based on the N games you've saved a lineup for") always visible above them.
- Mockup file is throwaway — **delete `public/mockups/lineups-hub.html`** once the hub ships (or sooner).
