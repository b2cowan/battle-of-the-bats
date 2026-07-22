# Tournament Seam Fixes — Phase 2 Implementation Plan ("Re-point the broken doors")

**Status:** PLANNED (owner decisions taken 2026-07-22) · **PM brief:** `TOURNAMENT_SEAM_P2_PM_BRIEF.md` · **Source review:** `TOURNAMENT_SEAM_UX_REVIEW.md` (findings A3, A4, A6) · **Phase 1:** shipped/committed on dev `5b3743c1`

Three items, all repairing a coach-side seam where the *correct* data/screen already exists but the "Schedule"/"Fees"/public-coach surfaces point at the wrong thing. Root cause named by the review: the Basic-coach claim link is currently the only bridge between "a coach" and "a tournament registration"; Premium/rep-team coaching (`rep_team_coaches`) is a separate model several surfaces don't bridge yet — the arch decision (`reference_coach_portal_arch_decision`) is "bridge better," not "unify."

**Owner decisions (2026-07-22):** Item 2 = **show both ledgers**; Item 1 = **merge live tournament games into the Schedule view** (needs a mockup); Item 3 = **full coverage** (all paid-portal coaches, incl. org-registered rep teams).

**Build order:** WI-2A (Fees tile — ready) → WI-2B (Schedule merge — after mockup approval) → WI-2C (coach detection — after data-path decision).

---

## WI-2A · Free-coach "Fees" tile shows the real tournament entry fee (review A4) — READY

**UX:** the free coach Overview "Fees" tile stops showing a false "$0 / all clear" when a tournament entry fee is owed. It shows **both** ledgers, clearly labeled: the **tournament entry fee** (money owed to the organizer — the higher-stakes line, alarm-styled when owed) and the existing self-entered **player fees** (money owed *to* the coach). When the team is in no tournament, the tile is unchanged (player fees only).

**Key insight:** no new query needed. `app/coaches/team/[basicTeamId]/page.tsx` already fetches `history = getBasicCoachTournamentHistoryForTeam(basicTeamId)`, and each entry carries `amountDue: number | null` (the outstanding tournament fee, computed via `buildCoachTournamentStatus` for accepted registrations, `lib/basic-coach-teams.ts` ~847-905).

**Files**
- `app/coaches/team/[basicTeamId]/page.tsx` (~114-128, 173-183) — from `history`, compute the accepted registrations, `tournamentFeeOwed` = Σ `amountDue`, and a `tournamentFee` prop that is `null` when there is no accepted registration (no fee context → tile unchanged) else `{ owed }`. Pass to `<TeamHQ variant="standalone" … />` alongside the existing `unpaidTotal`/`unpaidCount`.
- `components/coaches/TeamHQ.tsx` (`StandaloneTeamHQ` Fees tile, ~166-173) — when `tournamentFee` is set, render a two-line tile: **Entry fee** (owed → alarm color; else "clear") as the headline + **Player fees: $X · N unpaid** as the sub-line. When `null`, keep today's single self-entered display.
- `components/coaches/TeamHQ.module.css` — a small `hqFeeAlert` text-tone class (danger/warning token, no literal hex) for the owed entry fee.

**Design spec:** the two-row tile the owner approved via the decision preview (Entry fee line + Player fees line). No separate mockup.

**Risk/gating:** free tier only (no assistant-capability model, so no WI-5-style redaction needed here — free coaches always own their team). Read-only tile; the number the coach sees matches the tournament record's fee strip (same `buildCoachTournamentStatus` source, so the two surfaces can't disagree).

**QA:** a free team with an accepted, unpaid tournament registration → tile shows "Entry fee ⚠ $X" + player-fee sub-line (no false $0); a paid/no-fee registration → "Entry fee · clear" + player fees; a team in no tournament → unchanged; the amount equals the tournament record's Fee strip.

---

## WI-2B · Coach "Schedule" merges the live tournament games (review A3) — NEEDS MOCKUP

**UX (owner-chosen "merge"):** the coach "Schedule" tab (both the free portal and the Premium bottom-nav #2 tab) folds the team's **real, live tournament games** into the calendar alongside self-entered practices/scrimmages — instead of dead-ending on a hand-typed calendar with no feed from the actual tournament. Tournament games are read-only (owned by the organizer), visually distinct, and carry the live score / status on game day.

**Reuse:** the real schedule mechanism already exists — `components/coaches/CoachLiveSchedule` (live games + polling + public deep-links), today mounted only inside `CoachTournamentRecord` (the "Tournaments" tab). WI-2B surfaces those games in the Schedule view. Decide at mockup time: a merged single calendar vs. a "Tournament games" section above the self-entered list.

**Files (to confirm at build):** free `app/coaches/team/[basicTeamId]/schedule/page.tsx` (+ `ScheduleEditor`); Premium `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx`; the live-games source (`getBasicCoachTournamentHistoryForTeam` / the rep-team registration → games). Nav labels stay ("Schedule").

**Gate:** owner-approved mockup first (this project's pattern). Not started until then.

**Risk:** the two tiers aren't symmetric (free = org-less basic team; Premium = rep team) — the live-games source differs per tier; the mockup + build must handle both. Read-only tournament rows must never be editable in the self-entered editor.

---

## WI-2C · Public-page recognizes ALL paid-portal coaches (review A6) — PENDING DATA-PATH DECISION

**UX (owner-chosen "full coverage"):** a coach who manages their team through the paid portal is recognized as a coach on that tournament's public pages (the account "hat" chip → their coach view), not only coaches who came through the free "claim your team" flow. Full coverage includes rep teams the org registered directly (no Basic claim).

**Current gap:** `lib/tournament-viewer-hats.ts` (`getTournamentViewer`) detects coaches **only** via `getBasicCoachTournamentTeamsForUser` (the Basic-claim table). It never looks at `rep_team_coaches` coaching assignments. Chip visibility gates on `hats.length > 0`, so a Premium-only coach gets no chip.

**Mechanism — DECIDED (2026-07-22 investigation): query-time email-match heuristic, NO migration.** In `getTournamentViewer` add a branch alongside the existing Basic-claim lookup: (a) `getCoachingAssignmentsForUser(params.orgId, user.id)` proves the viewer coaches *something* in this org; (b) query `teams` for `tournament_id = params.tournamentId AND normalizeEmail(email|coach_email) = normalizeEmail(user.email)`, org-scoped via `tournaments.org_id = params.orgId`. Add the coach hat only when **both** hit (the assignment gate blocks a coincidental cross-org email match). Href `/${orgSlug}/coaches/teams/${repTeamId}`. Reuse `normalizeEmail` from `lib/basic-coach-teams.ts` (no third copy). This mirrors the exact-match trust model already proven for Basic claims (Migration 092 removed ILIKE fallbacks — exact `normalizeEmail` only).

**Owner decision (2026-07-22): FULL DATA PROJECT — guarantee every paid-portal coach, regardless of contact email.** This is a self-contained sub-project (do it AFTER WI-2A + WI-2B ship), NOT a same-batch fix, because the heuristic's residual gap can only be closed structurally:

- **Layer 1 (baseline, still do it):** the query-time email-match branch above — ships coverage for self-registered coaches / org-used-the-coach's-email with no migration. This is the floor even in the full project.
- **Layer 2 (the data project):** a stored link between a tournament registration (`teams` row) and a `rep_team`. Design questions to settle FIRST (route via `/dba` for the schema + `/plan` for the flow):
  1. **Storage** — nullable `rep_team_id` FK on `teams`, or a `rep_team_tournament_registrations(team_id UNIQUE, rep_team_id)` link table mirroring `basic_coach_team_registrations`. (Migration ⇒ DATA_DICTIONARY + dev/prod snapshots in the same unit of work; `/dba` architecture review.)
  2. **Population going forward — the real open question:** nothing today lets org staff say "this registration IS my rep team X." The shared public `/register` route has no rep-team concept, and there is no admin "link registration ↔ rep team" surface. Full coverage needs a NEW association mechanism (e.g. an org-admin control on the tournament's team/registration list to attach a rep team, and/or a rep-team-aware registration path). This is a product/flow design, not just a column.
  3. **Backfill existing rows** — only best-effort fuzzy (team name + org + sport/division) ⇒ manual-review, never an automatic migration step.

**Sequencing:** WI-2C Layer 1 can ride with WI-2A/2B; Layer 2 is its own phase gated on the `/dba` + `/plan` design above. Do not improvise the migration — surface the schema design for approval first.

### Concrete design (scoped 2026-07-22)

- **Storage (recommended): a link table `rep_team_tournament_registrations`**, mirroring `basic_coach_team_registrations` exactly — `tournament_team_id` (FK→`teams.id`, UNIQUE), `rep_team_id` (FK→`rep_teams.id`), `org_id` (denormalized tenant scope, indexed), `linked_by_user_id` (audit), `link_source` CHECK(`explicit`|`backfill`), `created_at`. NOT a column on `teams` (keeps the already-drift-heavy `teams` table untouched + matches the established bridge-table convention). Migration ⇒ DATA_DICTIONARY section (gotcha-first, cross-ref `teams` + `rep_teams`) + `refresh:snapshots` + `check:dictionary`, all same unit of work; **route the SQL through `/dba`**; dev-only first, prod is a separate explicit step.
- **Admin link control — where the association is created:** the tournament **Registrations** admin page (`UnifiedTeamsPage`), in the expanded registration row's quick-actions row (accept/reject/edit/delete already live there). A new "Link to rep team" icon-button opens an org-scoped rep-team **name search/select** (divisions are free text with no shared id — no auto-match; human picks). New POST endpoint mirrors the existing `/api/admin/teams` auth chain + additionally asserts `rep_teams.org_id === ctx.org.id` (cross-tenant linking structurally impossible). **Needs a small mockup** (new control on a dense panel).
- **Resolver:** additive branch in `getTournamentViewer` — the viewer's org coaching assignments (already fetched for Layer 1) ∩ `rep_team_tournament_registrations` for this tournament+org → coach hat, href `/${orgSlug}/coaches/teams/${repTeamId}` (identical to Layer 1's hat). Stays inside the never-SSR'd server-only resolver (cache-safety unchanged). `/review` after (identity/auth-adjacent). Extract a shared assignment-resolution helper if it becomes a 3rd copy (`/simplify`).
- **Backfill:** a best-effort, human-confirmed candidate-match admin tool (name + org + rough division text) writing `link_source='backfill'` — NOT an automatic migration step. Built last (non-blocking cleanup).
- **Build sequence:** Layer 1 (email-match, no migration) → migration + dictionary (`/dba`) → admin link control (mockup → build) → resolver (+`/review`) → backfill tool.

**Owner product decision (2026-07-22): PASSIVE.** A quiet "Link to rep team" action in the expanded registration row (no proactive match-prompts anywhere). Coverage grows as staff link + via the one-time backfill tool. This drops all loose-match/prompt logic from scope → simpler build (a picker + a link write, no suggestion engine), and makes the backfill tool the primary path for existing registrations.

**Build sequence (finalized):**
1. **WI-2C.1 — Layer 1 (email-match, NO migration)** — buildable now, ships baseline coverage, no gate.
2. **WI-2C.2 — the link table migration** (`rep_team_tournament_registrations`) via `/dba` + dictionary + snapshots (dev-first; prod later).
3. **WI-2C.3 — the passive admin link control** (mockup → approve → build): the "Link to rep team" row action + org-scoped rep-team picker + the link/unlink endpoint.
4. **WI-2C.4 — resolver** consumes the stored link (+`/review`).
5. **WI-2C.5 — backfill tool** (candidate-match, human-confirmed) — last, non-blocking.

**Caveats:** `lib/tournament-viewer-hats.ts` is a `server-only`, cache-sensitive identity resolver (its own header warns it must never be server-rendered into cached public HTML) — any change stays server-fetched only. Identity/auth-adjacent ⇒ `/review` after build. If the assignment-resolution chain gets copied a third time (it already exists in the tournament-history route + `CoachTournamentRecord`), extract a shared helper (`/simplify`).

**Gate:** the query-vs-migration decision above must be settled before build.

---

## Cross-cutting

- **Verification:** `npm run verify:changed` per batch; `npm run typecheck` when shared modules are touched (`lib/tournament-viewer-hats.ts`, `TeamHQ.tsx`). No migrations expected for WI-2A/2B; WI-2C TBD (surface if one appears).
- **Post-build:** `/simplify` (WI-2C resolver reuse), `/review` (WI-2C is identity/auth-adjacent), `/docs` (coach Schedule + Fees behavior changes; public-page coach recognition).
- **Out of scope:** P3 (offline shells for authed routes); the remaining lower-severity review findings; unifying the basic-vs-rep coach models (arch decision stands).
