# Gate / Team Check-In + Coach Roster — Implementation Plan

**Status:** SPEC'D 2026-06-04 · not started
**Module:** Tournaments (Tournament / Tournament Plus tiers)
**PM brief:** [GATE_CHECKIN_PM_BRIEF.md](GATE_CHECKIN_PM_BRIEF.md)

## What this is

A game-day **team check-in** workflow for tournament organizers + a **coach roster
submission** flow that front-loads the roster so the gate is just a confirmation.

On arrival, staff mark each accepted team **Present / No-show**, can collect any
**outstanding fee** at the gate, and **confirm the roster** the coach submitted ahead
of time (or capture it on the spot). Coaches submit their roster (names, jersey #s,
DOB) from the coach portal once their registration is accepted, so check-in is fast.

## Locked decisions (from product, 2026-06-04)

1. **Captures:** arrival status **+** pay-at-gate **+** roster confirm **+** coach
   pre-submits roster ahead of time (gate = confirm), with a **gate fallback** to enter
   the roster if the coach didn't use the app.
2. **Granularity:** **once per tournament** (a single `checked_in_at`, not per-day).
3. **Surface:** **admin page _and_** a **gate-volunteer view** (scorekeeper-style limited
   shell gated on a new `check_in_teams` capability).

## Data model — migration `110_gate_checkin.sql`

### `teams` — new columns (tournament team = per-tournament row)
| column | type | notes |
|---|---|---|
| `check_in_status` | text NOT NULL default `'not_arrived'` | `'not_arrived' \| 'checked_in' \| 'no_show'` |
| `checked_in_at` | timestamptz NULL | set when status → checked_in |
| `checked_in_by_user_id` | uuid NULL | org member who checked them in |
| `checked_in_by_name` | text NULL | display label (covers gate volunteers) |
| `roster_submitted_at` | timestamptz NULL | coach front-loaded the roster |
| `roster_confirmed_at` | timestamptz NULL | confirmed at the gate |
| `check_in_notes` | text NULL | free-text gate note |

Payment-at-gate **reuses the existing `payment_status`** (`pending`→`paid`); we add
`payment_collected_at timestamptz NULL` only to record when/that it was taken at the gate.

### `tournament_roster_players` — new table (replaces vestigial `teams.players` jsonb)
> The DB architecture review (2026-05-23) flagged `teams.players` jsonb as
> "never written, never read; drop before any roster feature ships" and recommended a
> proper `tournament_roster_players` table. This is that table.

| column | type | notes |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `org_id` | uuid NOT NULL | denormalized for direct RLS (DB-review pattern) |
| `tournament_id` | uuid NOT NULL | |
| `team_id` | uuid NOT NULL → `teams(id)` ON DELETE CASCADE | |
| `name` | text NOT NULL | |
| `jersey_number` | text NULL | text (allows "00", letters) |
| `date_of_birth` | date NULL | |
| `position` | text NULL | |
| `notes` | text NULL | |
| `source` | text NOT NULL default `'coach'` | `'coach' \| 'gate' \| 'admin'` |
| `created_by_user_id` | uuid NULL | |
| `created_at` / `updated_at` | timestamptz default now() | |

Indexes: `(team_id)`, `(tournament_id)`, `(org_id)`. RLS: org members read/write within
their org; the team's coach (identity = `teams.email` ILIKE user email, per the coach
portal model) may read/write their own team's roster.

**`teams.players` jsonb** — leave in place for now (accepted-risk, unused); drop in a
later cleanup migration once the Type no longer references it. Remove `Player[]` reliance
from the tournament mapper in Phase 1.

## Phases

- ✅ **Phase 1 — Foundation. DONE 2026-06-04.** Migration `110_gate_checkin.sql` written +
  **applied to dev + verified** (8 `teams` check-in columns + `tournament_roster_players`
  table w/ 13 cols, RLS on). `lib/types.ts`: `CheckInStatus`, `RosterPlayer`, optional Team
  check-in fields (additive — populated by the check-in API, no core-mapper churn). Schema
  snapshot refreshed (103 tables). Added `scripts/apply-migration-api.mjs` (Management-API
  migration runner — no local `pg` dependency). tsc clean. *(db.ts read/write helpers fold
  into Phase 2's API route. Restart batched to the Phase 2 handoff — Phase 1 has nothing to
  browser-test. `teams.players` jsonb left for a later cleanup migration.)*
- ✅ **Phase 2 — Admin check-in board. DONE 2026-06-04.** `app/api/admin/check-in/route.ts`
  (GET board: accepted teams + rosters; POST actions `check_in` / `no_show` / `undo` /
  `mark_paid` / `confirm_roster` / `save_gate_roster` / `save_notes`; capability
  `manage_registrations`; writes blocked when tournament completed). `app/[orgSlug]/admin/
  tournaments/check-in/page.tsx` (+ `check-in.module.css`): mobile-first board, gauges
  (checked-in/total, no-shows, unpaid), search + division + arrival filters, teams grouped by
  division with arrival-dot + roster/payment tags + big **Check in** button; tap → `CheckInSheet`
  on `BottomSheet` (no-show / undo, **Mark paid**, view/**Confirm roster**, **add/edit roster at
  the gate**). Nav entry added to `admin-nav-config.ts` (Operations, after Results → shows in
  sidebar + mobile "More", preserving the 4 primary tabs). tsc + lint clean (0 errors). Dev
  server cleanly restarted (200, no EACCES); route registered + auth-guarded like siblings.
  *(Payment uses the simple `payment_status` flip + `payment_collected_at`; division fee shown as
  the "owes" hint — deliberate V1 simplification, not the full deposit/accounting model.)*
- ⏸️ **Phase 3 — Coach roster submission. MOVED 2026-06-04** → folded into the larger
  **[Coaches Experience End-to-End + Wow](COACHES_EXPERIENCE_EVAL_PLAN.md)** project, to be done
  at the **end of this project**. Roster submission (coach enters name/#/DOB from the coach
  portal after acceptance → `tournament_roster_players` → `roster_submitted_at`) is one piece of
  that end-to-end coach-journey assessment. The board already shows "Submitted / Confirmed / None"
  for whatever rosters exist, so the gate works today; coach pre-submission just front-loads it.
- ✅ **Phase 4 — Gate-volunteer surface. DONE 2026-06-04.** New `check_in_teams` capability in
  `lib/roles.ts` (default owner/admin/staff/official; in `ALL_CAPABILITY_KEYS` + members-page
  labels/matrix). Check-in API now accepts `manage_registrations` **OR** `check_in_teams`, and
  GET-without-`tournamentId` returns the org's tournament list (scope-respecting) for the picker.
  Board extracted to shared `components/admin/CheckInBoard.tsx` (+ `.module.css`); admin page is now
  a thin wrapper. New `app/[orgSlug]/check-in/` surface — server `layout.tsx` (auth + capability
  gate + stripped scorekeeper-style shell) + client `page.tsx` (tournament picker → `CheckInBoard`).
  `proxy.ts` updated (`isOrgCheckIn` early auth-bounce + matcher `/:slug/check-in/:path*`). tsc + lint clean.
- ✅ **Phase 5 — Dashboard integration. DONE 2026-06-04.** Dashboard API returns
  `checkIn { accepted, checkedIn, noShow }` (added `check_in_status` to the team-payments select +
  `TeamPaymentRow`). Dashboard page renders a **Team Check-in** panel in the game-day board
  (arrived/total `GaugeBar` + `CountUp` + no-show badge, "Open board →" link), shown when there are
  accepted teams. *(No-show schedule surfacing + check-in notifications left as optional follow-ups.)*

- ✅ **Finishing touches. DONE 2026-06-04.** (1) **No-shows on the schedule** — admin `GameList`
  flags a no-show team's games (`isNoShow` via `teams[].checkInStatus` — added `check_in_status` to
  the `/api/admin/teams` mapper; a red "No-show" tag on the team in both scoring + planning layouts;
  public schedule untouched). (2) **No-show notification** — new `team_no_show` `NotificationEventType`
  (labels/descriptions/sections in `lib/notification-labels.ts`, Tournaments section + per-tournament
  list); check-in route fires `notify()` on the `no_show` action (bell to the org, staff scoped,
  actor excluded). (3) **Dropped vestigial `teams.players` jsonb** — migration `111` (applied dev +
  verified gone), removed `Player[]` from the `Team` type, and cleared all writers (`db.ts`
  saveTeam/updateTeam, teams + setup-tournament routes, Generator, test). tsc + lint clean; schema
  snapshot refreshed.

## Deferred / open

- **Waivers** beyond a simple confirm checkbox (document storage / e-sign) — deferred.
- **Per-day** check-in — out (chose once-per-tournament); revisit if multi-day demand.
- **Stripe-at-gate** (real card capture) — out; V1 just flips `payment_status` to paid +
  stamps `payment_collected_at`.
- **DOB → age/eligibility validation** against division age rules — future enhancement.
- Drop of vestigial `teams.players` jsonb — separate cleanup migration after Phase 1.
