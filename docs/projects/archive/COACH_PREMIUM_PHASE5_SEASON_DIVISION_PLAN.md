# Coach Premium — Phase 5: In-Portal Season & Division Management

**Status:** ACTIVE — NOT built. Spun out of [COACH_PREMIUM_UPGRADE_FLOW_PLAN.md](COACH_PREMIUM_UPGRADE_FLOW_PLAN.md) Phase 5 (the core upgrade flow, Phases 1–4, is COMPLETE on dev). This is the "multi-season Premium promise" companion: a standalone Premium coach can roll their own team into a new season and edit their division — no org-admin dependency.

**PM brief:** [COACH_PREMIUM_PHASE5_SEASON_DIVISION_PM_BRIEF.md](COACH_PREMIUM_PHASE5_SEASON_DIVISION_PM_BRIEF.md)

## Build status — ✅ BUILT on `dev` (2026-06-19), gates green, NOT pushed

Both parts implemented exactly to the manifest below: a self-contained `lib/rep-season-rollover.ts`, a coach team route (`GET` settings + `PATCH` division), a `seasons` `POST` route, a new Settings page + `StartNextSeasonModal`, nav entries, and overview division/Settings surfacing. **No migration; no `lib/db.ts`/`lib/types.ts` edits.** `npm run typecheck` + `npm run lint:focused` clean. Owner browser-tests on dev.fieldlogichq.ca (restart the local dev server first — new files added).

**Adversarial review (4 lenses → per-finding verification) folded in.** Confirmed-real fixes applied: reject a past/equal new-season year (was allowing backward due-date shifts); create the new season already-`active` in one statement (removed a draft→active orphan window); **self-heal** a prior partial roll by completing any stale non-current open season instead of a hard "anomaly" 409 (so a transient failure can't permanently block retries); `summary.ok` now reflects the data carry only, not a soft finalize hiccup; delete an orphan dues schedule if its installments fail to land; suppress the waiver note on an empty roster; modal — backdrop-after-success now navigates (no stale page), year edits sync the season name when untouched, Escape closes the form. Reviewer false-positives (e.g. the `/coaches/tournaments/…` rootless href is the intentional Basic-portal route) were dismissed with justification.

**Documented follow-ups (NOT bugs — owner decisions, deferred):**
- The scope gate checks workspace identity + role, not **subscription health** — a cancelled/past-due Premium coach can still roll a season (no new charge; the data is theirs). Consistent with the rest of the coaches portal, which has no per-action subscription gate. Revisit if a grace-state lockout is wanted.
- Editing division currently requires an active season to resolve (incidental coupling — division is team-level). Harmless in practice (a provisioned Premium team always has an active season); revisit only if a no-active-season edit is ever needed.
- True DB-atomic rollover would need a Postgres RPC (mirror mig 067) — documented future hardening, not a v1 blocker.

**Architecture verified against live dev snapshots + code (2026-06-19, 9-agent map).** Headline finding: **no schema change is required and no HOT shared file (`lib/db.ts`, `lib/types.ts`) is touched.** Every operation maps to existing tables/columns and existing `lib/db.ts` helpers; all new orchestration lives in a self-contained module. This keeps Phase 5 off the migration-coordination path (138/139/140 are still prod-pending) and out of the concurrent-agent collision zone.

---

## Problem

Today a Premium team's season (`rep_program_years`) can only be created/advanced by an **org admin** (the admin shell at `app/[orgSlug]/admin/rep-teams/teams/[teamId]`). A standalone Premium coach has **no org admin** — so at year-end they hit a dead-end: they cannot start next season themselves. Separately, **division** (`rep_teams.division`) is set once at signup, then frozen; Phase 1 deliberately removed it from the signup form on the promise that it returns as an in-portal team setting. It is currently displayed **nowhere** in the coaches portal.

## Owner decisions (LOCKED 2026-06-19 — do not re-litigate)

1. **Roster carries forward by default** on "start next season" — copy the **active** roster (`rep_roster_players.status = 'active'`) into the new season; the coach prunes/adds after.
2. **Optional carry-over toggles** at season-start: (a) a **fee template** and (b) the previous season's **BUDGET — planned/projected buckets only, NOT actual spending**. **Schedule starts fresh.** Actual spending, dues payments, and paid history do **NOT** carry.
3. **Previous season becomes read-only history** (under Past Seasons), not still-editable.
4. **Access:** the **coach** (standalone Premium portal owner) performs both. For **org-owned/adopted** teams, season + division control stays with the **club admin** (scope check at build time).

## Build-time decisions (sensible defaults; owner may redirect)

- **Scope gate (both features):** coach self-service is allowed only when the workspace is a standalone Team workspace and **not** org-owned — `isTeamWorkspaceOrg(ctx.org) && ctx.org.teamWorkspaceStatus !== 'org_owned' && ctx.org.teamWorkspaceStatus !== 'archived'`. `linked` still counts as coach-controlled (only `org_owned` hands control to the club admin). Real club/league orgs (`account_kind = 'organization'`) never pass this gate — their admins keep season + division control.
- **Role gate:** both actions require `assignment.coachRole === 'head_coach'`. (Assistant coaches — a future building block — can view but not roll the season or change division.) No head-coach gate exists anywhere in the coaches API today; this introduces one, scoped to these two structural actions only.
- **Carry-toggle defaults:** budget **on**, fee template **on**, both freely unchecked. Rationale: projections are usually similar year-to-year (owner's words) and due dates are year-shifted (not left stale). Roster is **always** carried (decision #1) — not a toggle.
- **Division edit:** standalone head coach only; for org-owned/real-org teams the Settings page shows division **read-only** ("managed by your club").
- **No DB-level atomicity (no RPC/migration).** This is a single-user, low-frequency, button-click action (not a webhook race). The structural swap runs as a guarded app-level sequence with revert-on-critical-failure; the data carry is best-effort + surfaced (mirrors Phase 4's "structural commit, then best-effort migrate, then summarize"). Documented tradeoff below.

---

## Verified architecture facts (the contract)

### Season spine
- `rep_program_years`: status CHECK `draft|active|completed|archived` (constraint `rep_program_years_status_check`), default `'draft'`; `UNIQUE(team_id, year)` (`rep_program_years_team_id_year_key`). Cols: id, team_id, org_id, name, year, status, tryout_open, tryout_description, budget_amount, auto_reminders_enabled, created_at, updated_at.
- **Active season is resolved dynamically** by `getActiveRepProgramYear(teamId)` = newest `status IN ('draft','active')` by `created_at DESC`. `team_workspaces.active_program_year_id` is written **once at provisioning and never re-pointed** — a stale pointer the coach portal does **not** read. (Phase 5 will re-point it as hygiene, but correctness does not depend on it.)
- Admin "add program year" copies **nothing** (new year = empty draft). No rollover/clone logic exists anywhere. Status transitions (forward-only `draft→active→completed→archived`) live only in the admin PATCH route; `updateRepProgramYear(yearId, {status})` itself is unguarded.
- `getCoachingAssignmentsForUser` filters program years to `status IN ('draft','active')`. **Therefore the new season only appears in the coach's portal if a `rep_team_coaches` row exists for them on the new year** — the rollover MUST create coach assignments on the new year.

### Roster (`rep_roster_players`)
- `status` default `'active'` (active|inactive in practice; no DB CHECK). `getRepRosterPlayers(programYearId)` returns ALL statuses — **filter to `status === 'active'` for the carry.**
- `createRepRosterPlayer({programYearId, teamId, orgId, source, playerFirstName, playerLastName, playerDateOfBirth, playerNumber, primaryPosition, secondaryPosition, guardianFirstName, guardianLastName, guardianEmail, guardianPhone, notes, adminNotes})` — status always inserts `'active'`.
- **Carry:** new `id`/`program_year_id`/timestamps; copy names, dob, number, positions, guardian_*, notes; `source='admin_manual'`, `tryout_registration_id=null`; **drop** `admin_notes` (avoid stale staff/dues notes). Documents, dues, attendance, lineups, credits are per old `player_id` and intentionally do **not** follow (waivers re-collected fresh; surface in summary).
- No `UNIQUE(program_year_id, name)` → roll-twice would dup. The op is single-shot and guarded; build an old→new `player_id` map for the fee carry.

### Budget (`rep_budget_lines` + `rep_budget_periods`) — all PLANNED
- `rep_budget_lines`: org_id, team_id, program_year_id, category_id (nullable, → org-level `budget_categories`, persists across seasons → safe to copy id), item_id (nullable, → org-level `budget_items`), description, total_amount (CHECK `> 0`), notes, sort_order. **No actual/spent columns** — actuals live in `rep_team_expenses` (separate, per-season; never carried).
- `rep_budget_periods`: child of `budget_line_id` only (no org/team/program_year cols): period_label, period_date (nullable), amount (CHECK `> 0`), sort_order.
- **Carry (when toggled):** copy each line (new program_year_id, same category_id/item_id, description, total_amount, notes, sort_order) then its periods against the new line id (period_label, year-shifted period_date, amount, sort_order). Also copy `rep_program_years.budget_amount` (legacy single-number envelope, still read by the `/budget` route) onto the new season. No helper exists → read+insert via `supabaseAdmin` in the new module.

### Fees / "fee template" (`rep_player_dues_schedules` + `rep_player_dues_installments`)
- No fee-template entity exists — "fee template" = a snapshot copy of the prior season's per-player dues structure, stripped of all paid state.
- `rep_player_dues_schedules`: `UNIQUE(program_year_id, player_id)`, total_amount CHECK `> 0`, budget_line_id (nullable). `rep_player_dues_installments`: schedule_id (CASCADE), player_id, installment_number, amount CHECK `> 0`, due_date (NOT NULL), paid_at, reminder_*_at, accounting_entry_id, source (`manual|budget_generated`).
- Helpers: `createRepPlayerDuesSchedule({programYearId, playerId, teamId, orgId, totalAmount, notes})`, `replaceRepDuesInstallments(scheduleId, playerId, installments[], orgId, teamId)`.
- **Carry (when toggled, requires roster carry):** for each prior schedule whose player carried forward (via old→new `player_id` map), create a new schedule (total_amount, notes; budget_line_id null) + installments (installment_number, amount, **year-shifted due_date**); **reset** paid_at, accounting_entry_id, all reminder timestamps (never carried). Surface "confirm due dates" in the summary. `due_date` is absolute → shift the year by `(newYear - oldYear)`.

### Scope detection (`team_workspaces` / `organizations`)
- `team_workspaces.workspace_state` CHECK `independent|linked|org_owned|archived` (default `independent`). `organizations.account_kind` `organization|team_workspace`; `team_workspace_status` `active|linked|org_owned|archived` (nullable), mirrored on the shadow org.
- Helpers: `isTeamWorkspaceOrg(org)` (= team_workspace OR plan 'team'). `ctx.org.teamWorkspaceStatus` is already on the resolved org — **no extra query.** Gate = standalone (not org_owned/archived) — see build-time decisions.

### Division (`rep_teams.division`)
- text, nullable, free-text (no CHECK/FK/enum), admin UI caps at 30 chars. `updateRepTeam(teamId, {division})` **already supports it** — no new lib needed. No coach team-update route exists today → create one. Division is shown nowhere in the coaches portal today.

### Coaches API + portal shape
- `resolveCoachContext(orgSlug, teamId)` is copy-pasted inline per route (≈38 copies) → returns `{ ctx:{user,org}, team, assignment, programYear }`. New routes copy the same inline helper (do **not** refactor to shared).
- Pages live under `app/[orgSlug]/coaches/teams/[teamId]/` (overview/roster/schedule/announcements/accounting/documents/history). **No settings page exists.** Nav: `components/coaches/CoachesSidebar.tsx` `TEAM_NAV` + `components/coaches/CoachesBottomNav.tsx` `TEAM_MORE`. History page lists `completed|archived` years as read-only cards (no switcher) — it already satisfies "Past Seasons."

---

## File manifest (no migration; no `lib/db.ts` / `lib/types.ts` edits)

**New:**
- `lib/rep-season-rollover.ts` — `server-only`. `startNextRepSeason(params)` orchestration + `RepSeasonRolloverSummary` type + roster/budget/fee carry. Reuses `createRepProgramYear`, `updateRepProgramYear`, `getActiveRepProgramYear`, `getRepProgramYears`, `getRepRosterPlayers`, `createRepRosterPlayer`, `addRepTeamCoach`, `createRepPlayerDuesSchedule`, `replaceRepDuesInstallments` from `lib/db.ts`; reads/writes `rep_budget_lines`, `rep_budget_periods`, `rep_team_coaches`, `team_workspaces.active_program_year_id` directly via `supabaseAdmin`. Never throws past the per-entity boundary on the data carry (mirrors `lib/coach-upgrade-migration.ts`).
- `app/api/coaches/[orgSlug]/teams/[teamId]/route.ts` — `GET` (team + current season + scope flags for the Settings page) and `PATCH` (update `division` via `updateRepTeam`). Inline `resolveCoachContext` + scope/role gate.
- `app/api/coaches/[orgSlug]/teams/[teamId]/seasons/route.ts` — `POST` (start next season; body `{ name, year, carryBudget, carryFees }`). Inline `resolveCoachContext` + scope/role gate; returns the rollover summary.
- `app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx` (+ `settings.module.css` or reuse) — Settings page: editable division (standalone head coach) + "Start next season" entry. Read-only division note for org-owned.
- `components/coaches/StartNextSeasonModal.tsx` — client modal: new season name/year (defaults next year), carry toggles (budget/fees), confirm; renders the post-roll "what carried" summary.

**Edit (non-HOT):**
- `components/coaches/CoachesSidebar.tsx` — add `Settings` to `TEAM_NAV`.
- `components/coaches/CoachesBottomNav.tsx` — add `Settings` to `TEAM_MORE`.
- `app/[orgSlug]/coaches/teams/[teamId]/page.tsx` (overview) — surface division + a "Start next season" entry point (links to Settings / opens modal), gated on scope.
- `docs/projects/active/COACH_PREMIUM_UPGRADE_FLOW_PLAN.md` — mark Phase 5 in-progress, link this plan.
- `TODO.md` — one summary line.

---

## "Start next season" — execution order (guarded app sequence)

Input resolved by `resolveCoachContext` → `current` = active program year. Gate: standalone + head_coach (else 403). Compute `nextYear` (default `current.year + 1`, coach-editable) and `name` (coach-editable, default `"{nextYear} Season"`).

**Pre-checks (else 409):**
- A season with `year === nextYear` already exists for this team (`UNIQUE(team_id, year)` would 23505) → "A {nextYear} season already exists — pick a different year."
- Anomaly guard: more than one `draft|active` season already exists (prior partial roll) → "Season state needs attention" (don't compound it).

**Critical core (must succeed; on failure revert + 500, old season untouched):**
1. `createRepProgramYear(teamId, orgId, {name, year:nextYear})` → new draft, then `updateRepProgramYear(new.id, {status:'active'})`. (Two existing helpers; avoids adding a `status` param to `createRepProgramYear`.)
2. Copy **all** `rep_team_coaches` rows from `current.id` → `new.id` (same users + roles) via `addRepTeamCoach`. Guarantees the initiating coach (and any assistants) see the new season. — *On failure: best-effort delete the new year + revert; 500.*
3. Re-point `team_workspaces.active_program_year_id` → `new.id` (hygiene; best-effort).

**Best-effort carry (never throws; collected into summary):**
4. Roster (always): copy `status='active'` players → new season; build old→new `player_id` map.
5. Budget (if `carryBudget`): copy lines + periods + `budget_amount`.
6. Fees (if `carryFees`): copy per-player dues structure for carried players (year-shifted due dates; paid state reset).

**Finalize:**
7. Complete the old season: `updateRepProgramYear(current.id, {status:'completed'})` → makes it read-only history. (No billing sync — gate guarantees a standalone Team workspace, not a Club org; `syncRepTeamBilling` is Club-only and active-team count is unchanged anyway.) — *On failure: surface a non-fatal warning; new season is already live.*
8. Return `RepSeasonRolloverSummary { newSeason{ id,name,year }, roster{copied}, budget{linesCopied,periodsCopied,carried}, fees{playersCopied,carried,dueDateNote}, notes[], warnings[] }`.

**Why this order:** the new active season + coach assignment exist before any data copy, so the coach is never locked out; the old season is completed **last** so a mid-sequence crash leaves the prior season intact and retryable. Window of two `active` seasons is bounded to one synchronous request and never observed by the client (which refetches after `200`).

## Tradeoffs / risks

- **Non-atomic structural swap.** Accepted: single-user button click, not a webhook race; guarded + revert-on-critical-failure; consistent with the admin path (which is itself two non-atomic manual steps). If true atomicity is later wanted, lift steps 1–3+7 into a Postgres RPC (mirror mig 067) — a clean future hardening, not a v1 blocker.
- **Stale `active_program_year_id`** elsewhere: nothing reads it for coach UX, but we re-point it anyway so any future consumer is correct.
- **Fee due dates** are year-shifted, not validated against the real new-season calendar → surfaced as "confirm due dates" (same honesty posture as Phase 4).
- **Player waivers/documents don't carry** (per-season by design) → surfaced in the summary.
- **`replaceRepDuesInstallments` is destructive** but only ever called here on freshly-created new-season schedules → safe.

## Out of scope (v1)

- Season switcher / drilling into a past season's full pages (History summary cards already cover read-only history).
- Editing team name/sport in the coaches portal (Settings page is the natural future home; this v1 ships division only).
- A Postgres RPC for atomic rollover (documented future hardening).
- Any change for org-owned/real-org teams beyond read-only display + the admin path they already have.

## Verification

- `npm run typecheck` (new shared module + routes), `npm run lint:focused -- <changed files>`.
- No `check:dictionary` / `check:snapshots` impact (no schema change).
- Owner browser-tests on dev.fieldlogichq.ca: roll a standalone Premium team into next season (with/without each toggle), confirm roster carried + schedule fresh + old season under Past Seasons read-only; edit division and confirm it shows on overview; confirm an org-owned/real-org coach sees the read-only/admin-managed states.
- Offer `/review` (substantive change: new auth-gated mutating routes + cross-season data copy).
