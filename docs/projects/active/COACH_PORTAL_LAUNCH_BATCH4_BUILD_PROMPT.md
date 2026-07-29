# Coach Portal Launch Batch 4 — Tournament Games Get Real Tools — Build Prompt (paste into a fresh chat)

> **Created:** 2026-07-29, at the close of the Batch 3 session (Batch 3 committed `85d2a015`). This is the **last launch P0** from the readiness review: with it done, all 8 P0s are closed and the batches are ready to bundle for a production release. This prompt is self-contained — read the referenced docs before proposing anything.

---

## The prompt

You are planning and building **Coach Portal Launch Batch 4 — "Tournament Games Get Real Tools"** for the premium Coaches Portal: P0 finding **#2 (a team's REAL platform tournament games have no attendance or lineup tools at all)** plus the P1 that was ratified to ride with it — **"give Attendance a real home in the nav" (f2-6 / f6-0 ×2 / f8-2)**. For many teams, tournament games ARE their season; today they render as read-only chips with nothing behind them, which undercuts the entire "run your team here" pitch on exactly the games that matter most.

Follow the full house process: implementation plan + PM brief → mockups as an artifact (owner approval = binding visual spec, label NEW/RESTYLED/UNCHANGED) → owner decisions → build the whole approved phase in one pass → `/simplify` → `/review` → owner QA → commit only with explicit per-action OK.

### Read first (in order)

1. `docs/agents/design/PREMIUM_COACH_PORTAL_UX_READINESS_REVIEW.md` — the source review. Batch 4 scope = **P0 #2 (f2-0)** and **the Attendance nav home (f2-6, f6-0, f8-2 — found independently by two reviewers)**. Also read the adjacent findings you'll be asked to rule on bundling: **f2-3** (game-day card downgrade) and **wow #2** (a real Game Day card for regular games) — they touch the same surfaces.
2. `docs/projects/active/COACH_PORTAL_LAUNCH_BATCH1_PLAN.md` — its **"Tournaments data reality"** section is the verified ground truth for how tournament registrations reach a rep team (public registration the ONLY entry; the standalone `team_workspaces.basic_coach_team_id` bridge; the mig-196 `rep_team_tournament_registrations` admin-link bridge; `getMergedTournamentHistoryForRepTeam` in lib as the single merged source after /simplify). Do not re-derive this.
3. `docs/projects/active/COACH_PORTAL_LAUNCH_BATCH3_PLAN.md` — Batch 3's ground truth, build deviations, `/simplify` + `/review` records, and QA rulings. The **closed-season access model landmines** below come from here.
4. `docs/projects/active/COACH_PORTAL_LAUNCH_BATCH2_PLAN.md` — the form-disclosure + sheet contracts and the probe recipe.
5. `docs/projects/active/PROGRAM_COACH_PORTAL.md` — the program backlog, incl. §1.5 (the owner-DECIDED frozen past-season model — do NOT build it here, but don't paint it into a corner either).
6. Auto-memory `project_premium_coach_portal_ux_eval.md` + repo `memory/design_decisions.md` (the three 2026-07-28/29 Batch-3-era entries: closed-season model + Wrapped rules, the warm lime-fill restore rule, the nav rework rulings).

### Ground truth to VERIFY FIRST (the review claims it; Batch 1 partially confirmed it — nail the rest before proposing)

- **Why tournament games have no tools:** attendance (`rep_team_event_attendance`) and lineups (`rep_team_lineups`) both attach to `rep_team_events` rows. A REAL platform tournament game is a tournament-side `games` row reached through the team's registration — it has **no `rep_team_events` row to hang tools on**. (Self-entered `event_type='tournament_game'` events are a different, already-working thing — don't conflate them.) Confirm exactly how the coach Schedule page renders real tournament games today (read-only chips from the merged tournament-history data?) and what identity/link data each carries.
- **The architectural fork this batch must decide deliberately** (bring BOTH options to the owner with a recommendation): **(A) mirror** — sync/shadow each real tournament game into a `rep_team_events` row (source-linked, score/time kept in step with the tournament side, coach edits restricted), so every existing tool (attendance, lineups, record, insights, wrapped) just works; vs **(B) teach the tools polymorphy** — let attendance/lineups attach to either a rep event or a tournament game. Option A likely needs **a migration + a sync path** (tournament schedules change — reschedules, bracket resolution, cancellations); option B spreads a second key through every tool's data model. Check `source_basic_event_id` on `rep_team_events` — a mirroring precedent may already exist for the free-portal bridge.
- **Batches 1–3 needed no migration; this one very likely does.** If so: `docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots` ride in the SAME unit of work; the migration applies to dev AND prod before any release; column existence is decided from live snapshots, never migration files.
- **Attendance nav home (the P1):** today the season attendance report has no nav entry anywhere — it's reachable only via a secondary Roster button that disappears in one view. Decide its home (own Squad/Season item vs a stronger door) with the nav-visibility gate (`lib/coach-nav-visibility.ts`) and both navs (sidebar + bottom-nav More) updated together — they share the door list discipline.
- **Sport Pack rule:** any per-game vocabulary stays sport-neutral (`lib/sports.ts`); the lineup builder has known diamond-sport assumptions (PROGRAM doc §1.7) — don't widen them.

### Scope — what the coach gets

1. **Real tournament games become first-class (P0 #2):** attendance marking and lineup building on actual platform tournament games, reachable from the Schedule (and wherever game-day surfaces point), with the tournament game's time/opponent/venue staying true to the tournament side when organizers reschedule. Decide and mock how these games appear in the one-calendar Schedule (merged in place, badged as tournament games) and what happens for finished tournaments.
2. **Attendance gets a real home (P1):** a first-class nav entry; the season attendance report links to where attendance is recorded and vice-versa.
3. **Owner bundling decisions (rule at the mockup round, build only if approved):** fix the game-day card downgrade (f2-3 — on game day the Overview currently offers LESS than three days before) and/or the fuller wow #2 game-day card. Both sit on the exact surfaces this batch reworks; the case for bundling is one QA pass over one set of surfaces, the case against is scope creep on the last launch blocker.

### Landmines & contracts (hard-won — respect them)

- **Closed-season access model (Batch 3):** `closedAssignments` are a SEPARATE array end-to-end — never merged into `assignments` (the active list feeds ~49 write routes that assume visible = writable). The season-READ resolver (`lib/coach-season-read.ts`) is GET-only by contract. Per-row guards enforce "read-only past season" on roster/development writes — new tournament-game tools must respect the same rule (no attendance/lineup writes against a closed season's games). `resolveClosedAssignment` (lib/coaches-context) is the ONE closed-state predicate.
- **Canonical record rule:** `WRAPPED_RECORD_EVENT_TYPES` (lib/season-wrapped.ts) = league + tournament + legacy external_tournament, scrimmage excluded — `getRepTeamHistory`/`getRepCurrentSeasonSummary`/the admin past-year page all consume it. If Batch 4 makes real tournament games count toward the record (it should — decide explicitly), route through this constant, not a new list.
- **Nav rework (owner rulings, 2026-07-29):** `/coaches` is a pure redirector (last-team memory `flhq-coach-last-team:{orgSlug}` → first active → first closed); the sidebar team switcher is a dropdown (`#coach-team-select`); there is NO "Back to {org}" public link and NO hub grid. New nav entries go through `lib/coach-nav-visibility.ts` (shared gate + the `CLOSED_TEAM_NAV_ITEMS` discipline).
- **Warm-theme rules:** raw `--logic-lime` is NEVER a fill inside the portal (the warm gate remaps it to olive — banned as a button/chip fill); "on"-state chips join the warm lime-restore group in coaches.module.css or use `--home-lime`. No raw white rgba inks on portal surfaces. Olive is text/border/tint only. The Wrapped card is a fixed-color keepsake — leave it alone.
- **Sheet contract:** portal modals are full-height sheets ≤640px (`CoachModalHeader`, actions in `.modalFooter`, `useOverlayOpen`); `.formGrid` is one column ≤640; >8 fields → `CoachFormDisclosure`; `CoachEmptyState` rules (lime primary + ghost secondary, rounded-square medallion, never circles).
- **Git:** ONE shared `dev` branch. ⚠ The tree is shared with concurrent sessions — at Batch 3's commit, `TODO.md` (83KB interleaved diff — left uncommitted, a later commit carries all sessions' lines) and `lib/help-content/coaches.tsx` (partial-staged by hunk) both carried foreign work, and untracked migs 204/205 (`game_change_notices`) made `verify:changed`'s schema-parity step fail — NOT yours, do not re-baseline. Diff every shared file, stage explicit `:(literal)` pathspecs, audit `git show --stat`, never commit/push without explicit per-action owner OK.
- **Dev server:** a supervisor from a concurrent session AUTO-RESPAWNS `next dev` on port 3000 when it frees — after a stop → `.next` purge, the respawned server is cache-clean; don't fight it, verify health (login 200, no EACCES) and use it. Full restart required after new files/shared-module changes before owner browser QA.
- **Playwright probes (computed styles, never screenshots):** accounts `j2-rep-coach@dev.local` / `devpass123` (club-owned) and `coach@dev.local` / `devpass123` (standalone; its 2026 season is now completed with a 2027 active season — Batch 3 QA did a real rollover). ⚠ Scope text assertions to `main[class*="coachesMain"]` (an outer layout `<main>` wraps the phone-hidden sidebar — `.first()` matches hidden nav copy); warm cold-compiled routes before asserting redirects. Disposable-data recipe: service-role provisioning with a marker slug + pre-clean + verified teardown (Batch 3's probe in the plan doc is the reference; a leftover "QA Seasons End" team may exist in dev-club-org — the owner may still be using it, ask before deleting). The UAT org coach still needs an `organization_members` row (`organization_id`, `status:'active'`, `accepted_at`).
- **Docs:** user-facing flow changes → `lib/help-content/coaches.tsx` (watch for foreign hunks). Durable design calls → `memory/design_decisions.md`. Tournament-side help (`lib/help-content/tournaments.tsx`) may also need a line if the coach-facing behavior of tournament games changes — it too carries foreign uncommitted work.

### Owner decisions to bring to the mockup round

- **The architectural fork:** mirror tournament games into the team calendar vs attach tools directly — recommend one, with the reschedule/cancellation story spelled out for each.
- **Do tournament games count toward the season record** (and Wrapped/Insights) once first-class? (Recommend: yes, via the canonical rule.)
- **Where Attendance lives in the nav**, and what its page opens on (mark-attendance vs season report).
- **Bundle f2-3 / wow #2 (game-day card)** — in or out.
- **Assistant capabilities:** which capability gates attendance/lineups on tournament games (presumably the same schedule/lineups caps as regular games — confirm, don't assume).

### Definition of done

Plan + PM brief docs (`docs/projects/active/COACH_PORTAL_LAUNCH_BATCH4_*`), approved mockups, built + `/simplify` + `/review` clean (review at HIGH tier — this touches the tournament⇄coach seam and likely a migration), typecheck/tests/verify green (modulo the known foreign parity failure), any migration applied to dev+prod with dictionary + snapshots in the same unit of work, fresh dev restart, owner QA, committed on `dev` with per-action OK, TODO/memory/help docs updated. **NOT pushed to prod** — after this batch, all 8 P0s are closed and the Batch 1–4 bundle is release-ready: offer the owner a `/release` planning pass as the natural next step.

---

## Program state at handoff (2026-07-29)

- **Batch 1** (mobile overlay safety + Tournaments revival) — `934e5275`. **Batch 2** (bulk roster, disclosure, first-week trail) — `8040f4e6`. **Batch 3** (Season's End: closed-season access, Wrapped, winding-down cue, close-out honesty + the nav rework) — `85d2a015`. All on `dev`, **none on prod**.
- **This batch closes the readiness review's P0 list.** After it: (a) the **release bundle** of Batches 1–4 to prod; (b) the **frozen past-season portal** (owner-DECIDED scope, `PROGRAM_COACH_PORTAL.md` §1.5 — same-as-live read-only access for every coach of that season, staff management stays live but governs read access only); (c) the **guardian model + name split** (§1.4 — still gated on owner decision **CP-7**: two guardians — dues reminder to both, or one nominated payer?).
- The review's P1 list (Chat/Announcements clarity, mobile notification bell, money-report mobile tables, unsaved-changes guards, weekly recurrence, schedule import…) remains the post-launch backlog, none of it batched yet.
