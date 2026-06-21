# Coach Premium Upgrade Flow — Frictionless Per-Team Upgrade + Data Carry-Over

**Status:** ACTIVE — **core upgrade flow COMPLETE on dev** (Phases 1, 1.5, 2, 3a, 3b, 3c, 4 all BUILT + reviewed). A coach upgrading from a free team now reaches payment pre-filled in two screens and lands in a **populated** Premium portal (roster/schedule/fees migrated in) with an honest "check these" banner. Architecture decision locked (keep separate models, don't unify). Remaining: **Phase 3d (DEFERRED, minor — manual roster ordering)** and **Phase 5 (companion — in-portal start-next-season + editable division)**. **Dev-only migrations PENDING PROD: 138, 139, 140** (135/136/137 already on prod) — apply before any master promotion, and 139 must precede 140's migration running in prod. Phase 3b/4 committed locally, NOT yet pushed (owner: "push it all after"). ⚠ A parallel Multi-Sport initiative is editing the same shared core (lib/db.ts, lib/types.ts, team-checkout/provisioning, signup) uncommitted — stage per-hunk and verify `git diff --cached` before every commit. Spun out of the Coach Experience walkthrough (Step 7) after the owner walked the live `/coaches/start` checkout on dev and found the upgrade re-asks for everything a free coach already has.

**Owner decision (locked 2026-06-18):** Premium stays **per-team** ($29/mo, "one competitive team"). Upgrading scopes to ONE team and carries THAT team's data forward; the coach's other free teams stay free (each can upgrade separately, each its own subscription). NOT a whole-account upgrade.

**Owner principle (locked 2026-06-18):** **Premium ≥ Free, everywhere.** Anywhere Premium is currently less capable than Free, we close the gap in Premium rather than work around it on migration. Data that can't transfer perfectly is **surfaced honestly** to the coach with a "fix these" list — never silently lost or faked.

**PM brief:** [COACH_PREMIUM_UPGRADE_FLOW_PM_BRIEF.md](COACH_PREMIUM_UPGRADE_FLOW_PM_BRIEF.md)

---

## Problem

A coach already operating in the **free** Coaches Portal who clicks "Upgrade to Premium" lands on `/coaches/start`, a **create-a-team-from-scratch** form. For someone who already has a named team with a roster, schedule, and fees, this is wrong on three counts:

1. **No context carry.** The upgrade CTA knew which team it came from but discarded it — the form was blank.
2. **Season & division asked at setup, then frozen.** Division was collected once and never editable by a coach; a new season can only be created by an org admin. Both contradict the Premium promise of running a team across seasons and divisions.
3. **Nothing actually carries over.** The upgrade only **links** the free team to the new Premium workspace (a bidirectional pointer) but **copies no data** — roster, schedule, and fees are left behind. A coach pays, lands in Premium, and the portal is empty. (Migration 114 explicitly deferred the roster seed to "a later phase" never built.)

**Target experience:** an existing free-portal coach needs only **two screens** — (1) what Premium offers for this team, (2) confirm + pay — with everything from the free portal carrying over automatically, and an honest post-upgrade summary of anything to double-check.

---

## Target flow (existing free-portal coach, per team)

- **Screen 1 — Value, scoped to the team:** "Here's what Premium adds for **{Team Name}**."
- **Screen 2 — Confirm + pay:** "Upgrade **{Team Name}** to Premium — $29/mo. Your roster, schedule, and fees come with you." Billing cycle + payment. **No team-setup form.**
- **After payment:** the Premium workspace is provisioned, **linked** to the free team, and the free team's **roster / schedule / fees are migrated in** so the portal is populated on first load — plus a "here's what we brought over, check these few things" summary.

**Multi-team:** each free team's upgrade button is scoped to that team. A generic-entry "which team?" picker is a fast-follow (see Decisions).

**New / first-time coaches (no free team):** keep the create-a-team signup (slimmed in Phase 1). The frictionless path is specifically for coaches arriving from an existing free team.

---

## Data Model Reconciliation (the migration contract)

Sourced from the **live dev snapshots + DATA_DICTIONARY** (not migration files), 2026-06-18. Each free field is classified: **Clean** (direct or deterministic transform), **Gap-closed** (Premium is changed so it can transfer — honors Premium ≥ Free), or **Surface** (can't transfer perfectly — listed for the coach post-upgrade). This is the contract Phase 4 implements.

### Team identity — `basic_coach_teams` → `rep_teams` (+ `rep_program_years`, `team_workspaces`)
| Free | Premium | Class | Note |
|---|---|---|---|
| name | rep_teams.name | Clean | also pre-filled at signup (Phase 1) |
| sport (free text, nullable) | rep_teams.sport (NOT NULL, default softball) | Clean | normalize; default if blank |
| age_group (free text) | rep_teams.division | Clean | **carried** — division was only "dropped from signup", not lost |
| — | rep_program_years (synth first season @ current year) | Clean | provisioner already creates it |

### Roster — `basic_coach_team_players` → `rep_roster_players`
| Free | Premium | Class | Note |
|---|---|---|---|
| name (single) | player_first_name + player_last_name (NOT NULL) | Clean / Surface | deterministic split (last token = surname); flag 1-token & 3+-token names for review |
| jersey_number | player_number | Clean | |
| date_of_birth | player_date_of_birth | Clean | |
| guardian_name (single, nullable) | guardian_first/last_name (NOT NULL today) | Gap-closed + Surface | make optional on migrated rows; split when present; flag if blank |
| contact_email (nullable) | guardian_email (NOT NULL today) | Gap-closed + Surface | make optional on migrated rows; **never fabricate**; flag missing (dues reminders enable once added) |
| contact_phone | guardian_phone | Clean | |
| notes | notes | Clean | |
| display_order | (none today) | Gap-close (minor) | Premium roster has no manual order — add to match Free (lean) or accept name-sort |
| — | positions | Clean | arrive null (Free has none) |

### Schedule — `basic_coach_team_events` → `rep_team_events`
| Free | Premium | Class | Note |
|---|---|---|---|
| title | name | Clean | rename |
| starts_at / ends_at | starts_at / ends_at | Clean | |
| opponent / location | opponent / location | Clean | |
| notes | description | Clean | rename |
| event_type `practice` | `practice` | Clean | |
| event_type `event` | `team_event` | Clean | |
| event_type `game` | `scrimmage` | Clean | Free never tracked a result, so no loss |
| status `cancelled` | (no status on rep_team_events today) | **Gap-closed** | **add a cancelled state to rep_team_events + show it in the Premium schedule UI** |

### Fees — `basic_coach_team_fees` → `rep_player_dues_schedules` (+ `rep_player_dues_installments`)
Free is now strictly **per-player** (team-wide create removed — Phase 1.5).
| Free | Premium | Class | Note |
|---|---|---|---|
| per-player fee, amount | schedule.total_amount + one installment.amount | Clean | one fee → one single-installment schedule |
| status `paid` + marked_paid_at | installment.paid_at = marked_paid_at | Clean | |
| status `unpaid` | installment.paid_at = null | Clean | |
| (no due date) | installment.due_date (NOT NULL) | Surface | default to season-end; flag "confirm the due date" |
| label / notes | schedule.notes (label folded in) | Clean | Premium schedule has no separate label field |
| amount = 0 | (CHECK > 0 on schedule + installment) | Surface | $0 fees skipped + listed |
| player_id NULL (legacy/orphaned: player deleted) | — | Surface | no player target → not migrated; listed if any exist |

### Announcements — `basic_coach_team_announcements`
The send-LOG is historical (counts only) → **not migrated** (by design). BUT the Premium portal has **no announcements feature at all** today → **Gap-closed: build team announcements into Premium** at parity with Free, so the capability isn't lost on upgrade.

### Membership — `basic_coach_team_users`
Upgrading coach → workspace primary owner. (Free only writes role=owner today, so effectively the one coach.) Any additional members re-join in Premium — flag if present.

### Post-upgrade "check these" summary (what the coach is shown)
On first Premium load, an honest summary lists only items needing a human touch, e.g.:
- Players whose name we split uncertainly (1-token / 3+-token).
- Players missing a guardian name or email (dues reminders off until added).
- Fees we gave a default due date (confirm the real date).
- Any $0 or orphaned (deleted-player) fees we couldn't carry.
- "Team announcements history isn't carried over" (the feature is available; past sends aren't).

Everything else transfers deterministically — no silent loss, no fabricated values.

---

## Phases

### Phase 1 — Slim + smart signup — ✅ BUILT (dev, 2026-06-18)
Both in-portal upgrade CTAs forward the free-team id to `/coaches/start`; the signup pre-fills team name + sport (ownership-checked) and snaps sport to a Premium option; the Division and Season-year fields are dropped (season defaults silently; division → in-portal later); the draft is isolated per team. UX-only, no migration.

### Phase 1.5 — Basic fees per-player alignment — ✅ BUILT (dev, 2026-06-18)
Backend + docs aligned to the already-shipped per-player UI: a single fee create requires a player; the team-wide create path is removed; data dictionary + lib comments updated. No schema change. Makes the fees migration a clean per-player map.

### Phase 2 — Carry the team id through checkout — M (→ `/review`)
Thread the free-team id through the checkout request → Stripe metadata → metadata parser → provisioner, so the link survives the redirect and the provisioner knows which free team to back-link + migrate. (Today none of these carry it; the provisioner accepts the id but only the in-process path can supply it.) Touches the billing pipeline → adversarial review.

### Phase 3 — Premium capability parity (close every Premium < Free gap) — L (→ `/review`; dev-only migrations)
So the migration lands cleanly AND Premium is never weaker than Free:
- **3a Cancelled events** — ✅ BUILT (dev, 2026-06-19; mig 135 dev-applied ⚠ prod-pending; `/review` clean). Real `scheduled|cancelled` state on `rep_team_events`; coach schedule slide-over Cancel/Restore + dimmed "Cancelled" rendering (chips, header, month dots); admin read-only schedule shows the same; cancelled games excluded from the season W-L-T tally.
- **3b Announcements** — ✅ BUILT (dev, 2026-06-19; mig 138 dev-applied ⚠ prod-pending; `/review` clean). Team-announcements in the Premium portal (write subject/body → email the active roster's guardian emails → send log), at parity with Free, in a self-contained module (no shared-data-layer change). Nav + overview quick-link added. Review found only 3 Low items, all inherited-from-Free parity (no fix needed).
- **3c Migrated-row tolerance** — make `rep_roster_players` guardian first/last/email accept blanks on migrated rows (no fabricated data); audit Premium readers that assume non-null (esp. dues reminders) to degrade gracefully.
- **3d Roster ordering** — ✅ BUILT (dev, 2026-06-20; mig 142 `rep_roster_players.display_order` dev-applied ⚠ prod-pending). Premium roster now has drag-to-reorder (dnd-kit, parity with the free `RosterEditor`) + a season-scoped reorder endpoint; new players append at the end; order carries on free→Premium upgrade and into the next season (sequential creates append in source order). typecheck/lint/dictionary/snapshots green.

### Phase 4 — Migrate the data on provisioning — ✅ BUILT (dev, 2026-06-19; migs 138-needed/139/140; `/review` 3-lens clean, no Critical/High in own code)
On provisioning of an upgrade-with-team-id, seeds the new Premium first season from the free team per the reconciliation contract. `lib/coach-upgrade-migration.ts` (roster/schedule/fees, per-entity resilient, never throws); atomic race-safe claim in the provisioner (runs exactly once); summary stored on `team_workspaces.migration_summary` (mig 140) + surfaced via a dismissible overview banner. Fees grouped per player into one dues schedule (UNIQUE program_year+player). **v1 follow-ups (accepted, not blockers):** no auto-retry for a partial migration (surfaced honestly; needs per-entity idempotency to retry safely); the **pre-existing** duplicate-workspace race (two Stripe events both passing the stripe_subscription_id dedup) is unaffected — separate provisioning-hardening follow-up; rare re-upgrade back-link asymmetry (audit any code reading `basic_coach_teams.team_workspace_id` as "current workspace"). Original target properties:
- **Deterministic** (the contract, not "best-effort guessing").
- **Idempotent — DB-atomic, race-safe.** Both Stripe events (`checkout.session.completed` + `customer.subscription.created`) reach the provisioner, possibly concurrently; the existing workspace dedup is keyed on `stripe_subscription_id` and fires *before* the workspace row exists, so an app-layer "not yet upgraded" check has a partial-failure / concurrent-fire window. Gate the migration with a **DB-atomic guard** (partial unique index / advisory lock on the basic-team id, or a `migration_completed_at` marker written atomically) **before any rep_* insert**.
- **Webhook-safe + repairable.** Never throws out of the provision/webhook path (mirror the welcome-email try/catch). BUT webhook-safe = swallowed exceptions, so a *partial* migration (roster in, fees failed) must not strand the coach in a half-populated paid portal: add **detection + a re-run/repair path** (the worst outcome — paying then seeing an empty portal — is exactly what this project fixes).
- **Per-season anchored** — the provisioner creates the first `rep_program_years` row before seeding. **Multi-year free data collapses into one synthetic "current" season** — surface this in the "check these" summary (semantic loss, not data loss).
- **Prereq ordering:** Phase 3c (Premium tolerant of incomplete migrated records — optional guardian fields) must be applied to **prod before Phase 4 runs in prod**, with dues-reminder null-safety audited in the same change, or every player with missing guardian info hits a not-null violation.
- Synchronous best-effort at provisioning (owner decision), so the portal is populated on first load.
- Emits the post-upgrade "check these" summary.

> **Architecture decision (2026-06-19, owner-confirmed):** keep the free/paid portals as separate models + migrate on upgrade; do NOT unify onto shared tier-gated tables now (the Tournament free/Plus analogy is invalid — no shared org row to flip). Unification kept as a future "account-per-free-coach" option. Enforce **Premium ≥ Free** on every new free feature. Full record + the 9-agent analysis: [COACH_PORTAL_ARCHITECTURE_DECISION.md](COACH_PORTAL_ARCHITECTURE_DECISION.md).

### Phase 5 — Companion: in-portal season & division management — ✅ BUILT on `dev` (2026-06-19); spun into its own plan
**Now tracked in [COACH_PREMIUM_PHASE5_SEASON_DIVISION_PLAN.md](COACH_PREMIUM_PHASE5_SEASON_DIVISION_PLAN.md) + PM brief.** Built with no migration and no shared-core (`lib/db.ts`/`lib/types.ts`) edits; typecheck + focused lint clean; adversarial-reviewed. Original scope below.

Required for the multi-season Premium promise.
- **"Start next season"** in the coaches portal — a coach rolls their team into a new season themselves, **without org-admin access** (today admin-only — a year-end dead-end for a standalone Premium coach).
- **Editable division** in team settings (today set at signup and frozen; Phase 1 removed it from signup on the promise it returns here).

**Owner decisions LOCKED (2026-06-19):**
1. **Roster carries forward** by default on "start next season" (copy the active roster into the new season; coach prunes/adds).
2. **Optional carry-over toggles** the coach chooses at season-start: (a) a **fee template** and (b) the **previous season's BUDGET — planned/projected buckets only, NOT actual spending** (projections are usually similar year-to-year; the coach adjusts). **Schedule starts fresh** each season; **actual spending / dues payments / paid history do NOT carry.**
3. **Previous season becomes read-only history** (viewable under Past Seasons), not still-editable.

**Access:** the **coach** (standalone Premium portal owner) performs both — no admin dependency. For org-OWNED/adopted teams, season control sensibly stays with the club admin (scope check at build time).

Should be spun into its own plan + PM brief when scheduled (separable from the now-complete upgrade flow).

---

## Decisions (resolved 2026-06-18)

1. **Cancelled events:** add a real cancelled state to Premium (Phase 3a) — NOT a "[Cancelled]" label hack. Premium ≥ Free.
2. **Team picker:** per-team CTAs first (Phase 1, done); generic-entry "which team?" picker is a fast-follow.
3. **Migration timing:** synchronous best-effort at provisioning.
4. **Announcements:** build into Premium (Phase 3b) — don't let upgrade drop a Free capability.
5. **Team-wide fees:** already removed from Free; code/docs aligned (Phase 1.5). Migration is per-player; orphaned (deleted-player) fees are surfaced, not migrated.
6. **Blank required fields:** transfer as-is, make those fields optional on migrated Premium rows, list them on the post-upgrade summary — **no fabricated emails/dates**.
7. **Re-upgrade / already-linked (build guard, not a choice):** gate on `basic_coach_teams.team_workspace_id` + an idempotency marker so a re-provision never double-migrates.

**Still open (minor):** ~~roster manual-ordering parity (Phase 3d)~~ — ✅ DONE (2026-06-20, mig 142). All phases now built.

---

## Risks / notes

- **Determinism over "best-effort."** "Best-effort" now means only *webhook robustness* (a migration hiccup never fails a payment). The field mapping itself is deterministic per the reconciliation contract; uncertain items are surfaced, not guessed.
- **No fabricated data.** Missing guardian emails/names and fee due dates are made optional on the migrated row + flagged — never filled with fake values.
- **Per-environment safety:** this whole flow only matters where the Premium gate is open (dev today; prod at launch). Prod stays express-interest until its gate is opened. Phase 3 schema changes apply to dev only until release.

## Out of scope (v1)

- Whole-account / multi-team single-subscription upgrade (owner chose per-team).
- Migrating the announcement send-log (the *feature* is built in Premium; past sends aren't carried).
- Lineups / attendance / documents / budget back-fill (Free has no source data — they start fresh in Premium).
