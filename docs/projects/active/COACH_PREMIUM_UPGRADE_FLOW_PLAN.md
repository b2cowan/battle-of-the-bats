# Coach Premium Upgrade Flow — Frictionless Per-Team Upgrade + Data Carry-Over

**Status:** ACTIVE — planning, 2026-06-18. Spun out of the Coach Experience walkthrough (Step 7) after the owner walked the live `/coaches/start` checkout on dev and found the upgrade re-asks for everything a free coach already has.

**Owner decision (locked 2026-06-18):** Premium stays **per-team** ($29/mo, "one competitive team"). Upgrading scopes to ONE team and carries THAT team's data forward; the coach's other free teams stay free (each can upgrade separately, each its own subscription). NOT a whole-account upgrade.

**PM brief:** [COACH_PREMIUM_UPGRADE_FLOW_PM_BRIEF.md](COACH_PREMIUM_UPGRADE_FLOW_PM_BRIEF.md)

---

## Problem

A coach already operating in the **free** Coaches Portal who clicks "Upgrade to Premium" lands on `/coaches/start`, a **create-a-team-from-scratch** form (team name, sport, division, season year, billing). For someone who already has a named team with a roster, schedule, and fees, this is wrong on three counts:

1. **No context carry.** The upgrade CTA knows which team it came from but discards it — the form is blank. Name and sport should be known.
2. **Season & division asked at setup, then frozen.** Division is collected once and can never be changed by a coach in-portal; a new season can only be created by an org admin. Both contradict the Premium promise of running a team across seasons and divisions.
3. **Nothing actually carries over.** The current upgrade **links** the free team to the new Premium workspace (a bidirectional pointer) but **copies no data** — roster, schedule, and fees are left behind. A coach pays, lands in Premium, and the portal is empty. (Migration 114 explicitly deferred the roster seed to "a later phase" that was never built.)

**Target experience (owner's words):** an existing free-portal coach should need only **two screens** — (1) what Premium offers for this team, (2) confirm + pay — with everything from the free portal carrying over automatically.

---

## Target flow (existing free-portal coach, per team)

- **Screen 1 — Value, scoped to the team:** "Here's what Premium adds for **{Team Name}**." (Reuses the existing `/coaches/start` left panel / `/for-coaches` content, personalized.)
- **Screen 2 — Confirm + pay:** "Upgrade **{Team Name}** to Premium — $29/mo. Your roster, schedule, and fees come with you." Billing cycle + payment. **No team-setup form.**
- **After payment:** the Premium workspace is provisioned, **linked** to the free team, and the free team's **roster / schedule / fees are migrated in** so the portal is populated on first load.

**Multi-team:** each free team's upgrade button is already scoped to that team. From a generic entry point (the hub, the team-workspaces list) where the coach has >1 team, insert a **"Which team?"** picker before Screen 1. Each upgrade is its own per-team subscription.

**Multi-season:** the migrated data lands in the team's **first Premium season** (a `rep_program_years` row synthesized at current year). Future seasons are a **companion gap** — see "Dependency" below.

**New / first-time coaches (no free team):** keep today's create-a-team signup (slimmed — see Phase 1). The frictionless path is specifically for coaches arriving from an existing free team.

---

## Phases

### Phase 1 — Slim + smart signup (UX-only, no data model change) — **S**
The fast, low-risk wins; they improve the signup for everyone and set up the carry path.
1. **Forward the team context.** Both in-portal upgrade CTAs (`ScopeShelf` footer, `ScopeCeilingInterest`) append the originating free-team id to the `/coaches/start` link. (They already receive it and drop it.)
2. **Pre-fill name + sport** in the signup form from that team id (a small read endpoint for `basic_coach_teams`). Sport normalizes to the Premium sport options with an "Other" fallback.
3. **Drop "division" from signup.** Optional in the data, un-editable post-signup today → pure day-one friction. Division moves to team settings in the portal (Phase 4 / Dependency).
4. **Default the season silently** to the current year (the provisioner already accepts a null/default) — remove it as a visible field.

Result: arriving from a free team, the form is pre-filled and shrinks toward "name (known) + billing."

### Phase 2 — Carry the team id through checkout — **M** (→ `/review`)
Complete the upgrade *link* so the provisioned workspace properly references the originating free team across the Stripe redirect.
- Add the free-team id to the checkout request, the Stripe metadata, and the metadata parser so it survives the redirect and reaches the webhook provisioner. (Today none of these carry it; the provisioner accepts the id but only the in-process path can supply it.)
- Touches the checkout/billing pipeline → adversarial review before shipping.

### Phase 3 — Migrate the data on provisioning (the substantive piece) — **L** (→ `/review`)
On provisioning of an upgrade-with-team-id, seed the new Premium season from the free team. Build a single migration step (best-effort, idempotent, never blocks provisioning or the webhook 200) covering:

- **Roster** (`basic_coach_team_players` → `rep_roster_players` under the new `program_year_id`). Handle the friction:
  - Split single `name` → `player_first_name` / `player_last_name` (best-effort tokenize; last token = last name; single token → first name only).
  - Split single `guardian_name` → required `guardian_first_name` / `guardian_last_name`; when blank, fall back to a placeholder so the required fields are satisfiable, and flag for the coach to fix.
  - Map `jersey_number → player_number`, `date_of_birth → player_date_of_birth`, `contact_email → guardian_email`, `contact_phone → guardian_phone`, `notes → notes`. Positions arrive null (basic has none).
- **Schedule** (`basic_coach_team_events` → `rep_team_events`). Map `title → name`, dates, `opponent`, `location`, `notes → description`. Event-type mapping: `practice → practice`, `event → team_event`, `game → scrimmage` (default; league win/loss tracking is lost without more metadata — accept for v1). `status='cancelled'` has no Premium field → prefix the name with "[Cancelled]" (or drop — decision below).
- **Fees** (`basic_coach_team_fees` → Premium dues/expenses). Player-linked fee → a single-installment `rep_player_dues_schedule` (+ one installment; synthetic due date from `marked_paid_at`/now; `paid` → installment `paid_at`). Team-wide fee (null player) → a `rep_team_expenses` row (no player-unlinked dues slot exists). This is a model shift the coach should be told about.
- **Announcements:** the sent-email log stays on the basic team (historical; not migrated — by design).

**A migration summary** is surfaced to the coach on first Premium load: "We brought over N players, M events, and your fees. A few items need a quick check: [players missing a guardian name], [cancelled events], [team-wide fees moved to expenses]." Honesty over silent lossy migration.

### Phase 4 — Companion gap: in-portal season & division management — **L** (separate track; required for the Premium promise)
Independent of the upgrade flow but exposed by it. Without these, Premium can't actually deliver "across seasons and divisions":
- **"Start next season"** in the coaches portal — a coach can roll their team into a new `rep_program_years` row, complete the prior one, and re-assign themselves, **without org-admin access** (today this is admin-only — a hard dead-end every year-end).
- **Editable division** in team settings (today set at signup and frozen).

Tracked here for visibility; may be split into its own plan when scheduled.

---

## Open decisions

1. **Cancelled basic events:** migrate with a "[Cancelled]" name prefix, or drop them? (Lean: migrate-and-prefix — never silently lose data.)
2. **Generic-entry team picker (Phase 1.1):** build the "which team?" step now, or only wire the per-team CTAs (footer/afterglow) first and leave the hub/list CTAs routing to a picker later? (Lean: per-team CTAs first; picker is a fast follow.)
3. **Migration timing:** synchronous in the provisioning webhook (simpler, but adds latency/failure surface to the webhook) vs. a queued/deferred job. (Lean: synchronous best-effort with a retry-safe idempotency key, given typical roster sizes; revisit if large.)
4. **Re-upgrade / already-linked:** a basic team already linked to a (cancelled) workspace must not double-migrate — gate on `basic_coach_teams.team_workspace_id` + an idempotency marker.

## Risks / notes

- **Lossy mappings are inherent** (name splitting, game→scrimmage, team-fee→expense, binary-paid→installment). v1 accepts these with an explicit post-migration summary; do not pretend it's a perfect copy.
- **Webhook safety:** the migration must be best-effort and never throw out of the provisioning/webhook path (mirror the welcome-email pattern) — a failed migration must not fail the payment/provision.
- **Idempotency:** both Stripe webhook events (`checkout.session.completed` + `customer.subscription.created`) reach the provisioner; migration must run exactly once (gate on first-provision, same as the welcome email).
- **Per-season anchor:** every migrated child row needs a `program_year_id`; the provisioner must create the first season row before seeding.
- **Prod-safety unaffected:** this whole flow only matters where the Premium gate is open (dev today; prod at launch). Prod stays express-interest until its gate is opened.

## Out of scope (v1)

- Whole-account / multi-team single-subscription upgrade (owner chose per-team).
- Migrating the announcement send-log.
- Lineups/attendance/documents/budget back-fill (basic has no source data for these — they start fresh in Premium).
