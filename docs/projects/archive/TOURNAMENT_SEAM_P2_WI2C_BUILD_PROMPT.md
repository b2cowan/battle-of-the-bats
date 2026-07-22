# Build Prompt — Tournament Seam P2 · WI-2C ("Recognize every paid-portal coach on public pages")

**For a NEW chat. This is a BUILD prompt executing an owner-approved, fully-scoped plan.** Scope =
WI-2C only (its five sub-steps). WI-2A (Fees tile) and WI-2B (Schedule merge, both portals) already
shipped — committed on `dev` (`6c8805d2`). Do **not** revisit them.

All the big decisions are already made — **do not re-litigate them**:
- **Full data project** (owner chose complete coverage, not the email-match-only version).
- **Passive linking** (owner chose a quiet "Link to rep team" row action — NO proactive
  match-prompts, NO suggestion engine in the linking UI; loose matching is only the backfill tool's job).
- **Storage = a link table** `rep_team_tournament_registrations` (NOT a column on `teams`).

## READ FIRST (in order)
1. `docs/projects/active/TOURNAMENT_SEAM_P2_PLAN.md` — the **WI-2C section** (Layer 1/Layer 2, the
   "Concrete design (scoped 2026-07-22)" block, and the finalized build sequence). This is your spec.
2. `docs/projects/active/TOURNAMENT_SEAM_P2_PM_BRIEF.md` — the coach-recognition tradeoff + outcome.
3. `docs/projects/active/TOURNAMENT_SEAM_UX_REVIEW.md` — **only** finding A6 (grep for it; the doc is
   ~150KB, never read it whole).
4. Memory: `reference_coach_portal_arch_decision.md` (basic vs rep coach models stay SEPARATE — this
   is "bridge better," not "unify"), `reference_supabase_rls_grants.md` + `reference_prod_supabase.md`
   (migrations dev-first, never auto-applied to prod), `reference_db_schema.md`.
5. Line refs were scouted 2026-07-22 on a tree with concurrent uncommitted work (a theming tranche) —
   **re-verify every cited path/line with a fresh Read before editing**; treat drift as expected.

## Workflow (AGENCY_RULES — blocking)
Before code: present (a) an **Implementation Plan / task list** and (b) a **plain-language PM UX
summary**. WI-2C spans a migration + a new admin control, so honor the gates below.

## Build sequence + hard constraints (per the plan's finalized sequence)

**WI-2C.1 → WI-2C.2 → WI-2C.3 → WI-2C.4 → WI-2C.5.**

- **WI-2C.1 — Layer 1 (email-match, NO migration) — build first, no gate.** In
  `lib/tournament-viewer-hats.ts` `getTournamentViewer`, add a branch: fetch the viewer's
  `getCoachingAssignmentsForUser(params.orgId, user.id)` (proves they coach in this org), then match
  `teams` rows for `tournament_id = params.tournamentId` where `normalizeEmail(email|coach_email) =
  normalizeEmail(user.email)`, org-scoped via `tournaments.org_id = params.orgId`. Add a coach hat
  only when BOTH hit (assignment gate blocks a coincidental cross-org email match). Href
  `/${orgSlug}/coaches/teams/${repTeamId}`. Reuse `normalizeEmail` from `lib/basic-coach-teams.ts`
  (exact match — Migration 092 removed ILIKE fallbacks; do NOT reintroduce fuzzy email). **Stay
  inside the server-only resolver — never SSR it into cached public HTML** (its header explains why:
  `sw.js` offline-caches tournament HTML as anonymous; identity in it leaks across a shared device).
  `/review` after (identity/auth-adjacent).
- **WI-2C.2 — migration `rep_team_tournament_registrations`.** Shape mirrors
  `basic_coach_team_registrations`: `tournament_team_id` (FK→`teams.id`, **UNIQUE**), `rep_team_id`
  (FK→`rep_teams.id`), `org_id` (denormalized tenant scope, indexed), `linked_by_user_id` (audit,
  ON DELETE SET NULL), `link_source` CHECK(`explicit`|`backfill`), `created_at`. **Route the SQL
  through `/dba` for review — do NOT improvise it.** Same unit of work: new numbered migration +
  `DATA_DICTIONARY.md` section (gotcha-first, cross-ref the `teams` + `rep_teams` sections) +
  `npm run refresh:snapshots` + `npm run check:dictionary` green. **Dev-only apply; prod is a
  separate explicit step (never auto-apply).** Enable RLS appropriately (service-role table posture
  per `reference_supabase_rls_grants`).
- **WI-2C.3 — passive admin link control. MOCKUP FIRST (owner approval), then build.** Home = the
  tournament **Registrations** admin page (`app/[orgSlug]/admin/tournaments/registrations/page.tsx`,
  `UnifiedTeamsPage`), in the expanded row's `teamQuickActions` row (accept/reject/edit/delete live
  there). A "Link to rep team" icon-button opens an **org-scoped rep-team name search/select** (from
  `GET /api/admin/rep-teams/teams`; divisions are free text — NO auto-match, human picks). New
  endpoint mirrors the `/api/admin/teams` auth chain (`getAuthContextWithScope` → scope guard →
  `requireTournamentInOrg`) **and additionally asserts `rep_teams.org_id === ctx.org.id`** (cross-
  tenant linking must be structurally impossible). Support link AND unlink. Passive only — no
  proactive "looks like your team X" prompt anywhere.
- **WI-2C.4 — resolver consumes the stored link.** Additive branch in `getTournamentViewer`: the
  viewer's org assignments (already fetched in 2C.1) ∩ `rep_team_tournament_registrations` for this
  tournament+org → coach hat, same href as Layer 1. Org-scope on the link table's own `org_id`
  (never trust `rep_teams.org_id` alone). Same cache-safety constraint. `/review` after. If the
  assignment-resolution chain becomes a 3rd copy (it exists in the tournament-history route +
  `CoachTournamentRecord`), extract a shared helper (`/simplify`).
- **WI-2C.5 — backfill tool — build last (non-blocking).** A best-effort, **human-confirmed**
  candidate-match admin/platform-admin utility (name + org + rough division text) writing
  `link_source='backfill'`. NOT an automatic migration step; never auto-links.

## Discipline
- One shared **`dev`** branch (re-check HEAD before committing); **explicit pathspecs only** — the
  tree carries other chats' uncommitted work (theming tranche in `coaches.module.css`,
  `globals.css`, etc.); `git show --stat HEAD` after every commit; **NO commit/push without the
  owner's per-action OK.**
- `npm run verify:changed` per batch; `npm run typecheck` (shared modules:
  `lib/tournament-viewer-hats.ts`, `lib/basic-coach-teams.ts`). The migration adds the
  dictionary/snapshot obligations above.
- New API routes → they self-gate (org-context guard runs in `verify:changed`). No new top-level
  consumer routes expected; if one appears, SW denylist + version bump (PII rule).
- After build: `/simplify` (shared assignment-resolution helper), then `/review` (identity/auth-
  adjacent resolver + a new write endpoint + a migration = high-risk), then `/docs` if a user-facing
  admin flow changed (the new "Link to rep team" control + public coach recognition).
- Report honestly at handoff: what shipped, what's gated (prod migration apply), residual coverage
  limits (a registration with no email match AND not manually linked stays unrecognized until
  linked/backfilled — that's the accepted design, not a bug).

## Definition of done
Layer 1 built + `/review`'d; migration designed via `/dba`, applied to dev, dictionary + snapshots
refreshed; admin link control mockup approved then built; resolver consumes the link; backfill tool
built; typecheck + verify:changed green; `/simplify` + `/review` + `/docs` run or offered; TODO.md's
Tournament Seam P2 WI-2C entry updated; memory (`project_tournament_seam_ux_review.md`) updated;
commits only with per-action owner OKs; prod migration apply flagged as a separate owner step.
