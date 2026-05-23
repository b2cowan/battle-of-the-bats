# Standalone Team Workspace Implementation Plan

## Purpose

Build standalone Team workspaces as a first-class acquisition and expansion path for FieldLogicHQ. Coaches who participate in tournaments should be able to claim or activate a team workspace, use the coaches portal for the season, create free-tier local tournaments, and later link billing and data to a parent organization.

The implementation should preserve the current organization-scoped architecture. The customer experience becomes team-first, while the technical model still uses organizations, `rep_teams`, `rep_program_years`, coach assignments, team events, dues, documents, budget, and accounting ledgers.

## Product Manager UX Summary

A coach should not have to understand FieldLogicHQ's organization model. They should see a simple promise:

> Keep running your team here after the tournament.

The coach enters through a tournament CTA or a direct Team signup page, activates one competitive team, and lands in a streamlined coaches portal. From there they can manage roster, schedule, dues, documents, team budget, reminders, attendance, lineup PDFs, and quick free-tier tournaments with other local teams.

If the team has a parent organization, the coach can link the team. Linking should support several business realities: the coach may keep paying, the organization may take over billing, or the organization may fully absorb the team into Club. These are related but separate decisions.

## Guiding Decisions

- Build standalone Team from the onset, not as a separate later product.
- Use a lightweight/stub organization for standalone teams; do not create an org-independent rep-team data model.
- Treat billing ownership, data ownership, and org visibility as separate concepts.
- Support independent, linked, and org-owned team states.
- Use tournament participation as the primary warm acquisition funnel.
- Include free Tournament-tier tournament creation by default so Team subscribers can invite other local teams into lightweight events and expose them to FieldLogicHQ.
- Keep Club valuable by making it the executive/multi-team operating layer.
- Keep the first coach-facing launch focused on practical tools, not advanced stats or messaging.

## Current System Context

Relevant existing structures:

- `rep_teams`, `rep_program_years`, `rep_team_coaches`, roster, events, dues, documents, expenses, and payment requests all carry `org_id`.
- Coaches portal access is based on `rep_team_coaches` assignments inside an organization.
- Rep team routes currently live under `/{orgSlug}/coaches/...`.
- `module_rep_teams` is currently included with Club and absent from Tournament, Tournament Plus, and League in the published feature matrix.
- The free Tournament plan includes `module_tournaments`, communications, members, and a limited tournament count. Team should inherit this free-tier tournament capability without inheriting Tournament Plus features.
- `enabled_addons` can unlock modules at the organization level but cannot by itself limit access to specific teams.
- `stripe_prices` already has `rep_team` rows for additional Club team billing.
- `accounting_ledgers` already supports `entity_type = 'team'`, which makes linked team accounting a natural extension point.

## Target Product Model

### Team Workspace

A Team workspace is the customer-facing unit for a competitive team. Technically, it is anchored by:

- A workspace organization, which may be a normal org or a lightweight/stub org.
- One primary `rep_teams` row.
- One active `rep_program_years` row for the current season.
- One or more `rep_team_coaches` rows for the coach/manager users.
- Team-scoped entitlements and billing state.
- Free-tier tournament entitlement for local tournaments created by the team workspace.

### Season And Program Year Lifecycle

A Team workspace is persistent, but the active season can change. Standalone teams should support the same year-over-year pattern as org-owned rep teams.

Example: "U13 Jr Milton Bats" can become "U13 Sr Milton Bats" in the next season while keeping the same workspace history. The new season should have its own program year, roster, schedule, dues plan, budget, documents, attendance, lineup cards, and tournament participation.

Implementation guidance:

- Treat `rep_teams` or `team_workspaces` as the persistent workspace anchor.
- Treat `rep_program_years` as the season boundary for roster, schedule, dues, budget, and coaching assignments.
- Use season/program-year name for historical display so older seasons keep their original label even if the current team name changes.
- Support a "Start next season" flow that copies only intentional setup data, not players, schedules, balances, or private notes by default.
- Keep history visible by season in the coaches portal and during org linking/ownership transfer.

### Workspace States

| State | Description | Expected UX |
| --- | --- | --- |
| Independent | Coach-owned team workspace with no parent org link. | Coach sees team portal and billing/settings. |
| Linked | Team remains operationally coach-owned but is associated with a parent org. | Coach sees team portal; org sees approved linked data. |
| Org-owned | Team is fully owned by an organization. | Coach still uses portal; org admins manage team in Club. |
| Archived | Team workspace is inactive but history remains available. | Read-only history where appropriate. |

### Billing Modes

| Billing Mode | Description |
| --- | --- |
| `team_direct` | Standalone Team subscription paid by coach/team manager. |
| `org_team_addon` | Linked team paid by a Tournament Plus or League org as a per-team add-on. |
| `club_included` | Org-owned team included under Club allowance. |
| `club_extra_team` | Org-owned team billed as additional Club rep-team quantity. |
| `platform_override` | Temporary/manual entitlement for trial, support, or migration. |

### Link Types

| Link Type | Description |
| --- | --- |
| Visibility link | Org can see approved team summary data but does not pay or manage. |
| Billing link | Org pays for the team while coach keeps operational ownership. |
| Ownership link | Team becomes org-owned and moves under normal Club administration. |

## Recommended Data Foundation

The exact migration names can be chosen during build, but the foundation should include these concepts.

### Organizations

Add a way to distinguish normal organizations from hidden team workspaces.

Candidate fields:

- `account_kind`: `organization` or `team_workspace`
- `team_workspace_status`: `active`, `linked`, `org_owned`, `archived`
- `is_discoverable`: false for team workspace orgs

Rationale: current routes and RLS expect an organization. A lightweight org keeps existing rep-team tables usable.

### Team Workspaces

Create a dedicated table that makes the team product explicit.

Candidate table: `team_workspaces`

Recommended fields:

- `id`
- `workspace_org_id`
- `rep_team_id`
- `active_program_year_id`
- `primary_owner_user_id`
- `source`: `direct_signup`, `tournament_claim`, `org_invite`, `platform_admin`
- `source_tournament_id`
- `source_tournament_team_id` or equivalent registration/team reference
- `workspace_state`
- `billing_mode`
- `billing_owner_org_id`
- `billing_owner_user_id`
- `stripe_customer_id`
- `stripe_subscription_id`
- `subscription_status`
- `current_period_end`
- `created_at`, `updated_at`

Rationale: this avoids hiding product state inside `organizations` alone and gives platform admin a clear object to inspect.

### Program Years

The existing `rep_program_years` table should remain the season boundary. A future build should verify that it has enough season-specific metadata for standalone teams.

Recommended season-specific fields or behaviors:

- Season display name, such as "U13 Jr Milton Bats 2026" or "U13 Sr Milton Bats 2027".
- Season year/status.
- Season age group or division if it can change year to year.
- Season budget.
- Season archive/completed state.
- Historical display should prefer the program-year name over the current persistent team name.

Rationale: standalone coaches need to change team name, age level, roster, and schedule by season without creating a disconnected account or losing history.

### Team Entitlements

Create a team-scoped entitlement layer so non-Club orgs can unlock only paid teams.

Candidate table: `team_entitlements`

Recommended fields:

- `id`
- `team_workspace_id`
- `org_id`
- `rep_team_id`
- `source`: `team_plan`, `org_team_addon`, `club_included`, `club_extra_team`, `platform_override`
- `status`: `active`, `trialing`, `past_due`, `cancelled`, `expired`
- `starts_at`, `ends_at`
- `stripe_subscription_item_id`
- `created_at`, `updated_at`

Rationale: `enabled_addons` can still advertise module availability, but access to paid non-Club teams must be scoped to specific team rows.

### Team Org Links

Create a relationship table for independent, linked, and org-owned transitions.

Candidate table: `team_org_links`

Recommended fields:

- `id`
- `team_workspace_id`
- `rep_team_id`
- `linked_org_id`
- `status`: `requested`, `invited`, `linked`, `ownership_pending`, `org_owned`, `declined`, `revoked`
- `link_type`: `visibility`, `billing`, `ownership`
- `sharing_level`: `basic`, `roster_summary`, `financial_summary`, `full_org_owned`
- `requested_by_user_id`
- `approved_by_team_user_id`
- `approved_by_org_user_id`
- `billing_mode_after_approval`
- `created_at`, `updated_at`

Rationale: linking should be reversible and auditable. It should not require a full data migration until ownership transfer is explicitly approved.

### Tournament Team Claims

Create a claim layer that connects tournament participation to Team activation.

Candidate table: `team_workspace_claims`

Recommended fields:

- `id`
- `tournament_id`
- `tournament_team_id` or registration/team reference
- `contact_email`
- `claim_token_hash`
- `status`: `available`, `claimed`, `expired`, `revoked`
- `team_workspace_id`
- `claimed_by_user_id`
- `expires_at`
- `created_at`, `claimed_at`

Rationale: tournament coaches are a warm funnel. Claims should be secure, email-verified, and single-use.

## Entitlement Rules

### Module-Level Access

`module_rep_teams` should mean different things depending on context:

- Club org: full org-level rep teams module.
- Team workspace org: coaches portal for the associated team only.
- Tournament Plus or League org with paid team add-ons: limited access to specific entitled teams.
- Platform override: explicit temporary access.

Do not use `enabled_addons` alone to turn on all rep teams for a lower-tier org.

### Tournament Access For Team

Team workspaces should include the same baseline tournament capability as the free Tournament tier:

- Ability to create and manage free-tier tournaments from the Team workspace.
- Same tournament count and feature limits as the free Tournament plan by default: one non-archived tournament at a time.
- Access to public schedule, registrations/teams, results, basic communications, and public tournament pages where the free plan already supports them.
- No Tournament Plus features by default, such as advanced registration fields, advanced exports, branding upgrades, paid registration enhancements, or other Plus-gated capabilities.
- No formal archive workflow by default. Team tournaments are intended for one-off scrimmage-style local events; coaches who need more official tournament operations or archiving should upgrade to Tournament Plus or an org tier.

This is both a customer value-add and an acquisition loop: a coach who invites nearby teams to a local event is introducing those teams to FieldLogicHQ.

### Team-Level Access

Add a helper conceptually equivalent to:

`canAccessRepTeam(org, user, teamId, action)`

It should evaluate:

- User role/capability.
- Coach assignment in `rep_team_coaches`.
- Team entitlement status.
- Workspace state.
- Team-org link sharing rules.
- Whether the org is Club and owns the team.

### Admin Access

For linked teams, parent org admins should not automatically receive full player/document access. They should see only the approved sharing level unless the team becomes org-owned.

## Billing Architecture

### Stripe Products/Prices

Add price support for:

- `team` monthly at $29 CAD
- `team` annual or seasonal at $290 CAD
- `org_team_addon` monthly at $29 CAD
- `org_team_addon` annual or seasonal at $290 CAD
- `rep_team` or Club extra-team monthly at $19 CAD
- `rep_team` or Club extra-team annual at $190 CAD

The existing `rep_team` Stripe price should remain the Club extra-team price, but should move from $20/$200 to $19/$190 to match the "ends in 9" pricing pattern and make Club's per-team value obvious. Keeping `team` and `org_team_addon` explicit will make reporting cleaner.

Stripe Dashboard work for the owner:

- In Stripe test mode, create product **FieldLogicHQ - Team** with:
  - Monthly recurring price: `CAD $29.00`, billed every 1 month.
  - Annual/seasonal recurring price: `CAD $290.00`, billed every 1 year.
- In Stripe live mode, create the same **FieldLogicHQ - Team** product and the same two recurring prices.
- In Stripe test mode, create product **Team Add-on (Org-billed)** with:
  - Monthly recurring price: `CAD $29.00`, billed every 1 month.
  - Annual/seasonal recurring price: `CAD $290.00`, billed every 1 year.
- In Stripe live mode, create the same **Team Add-on (Org-billed)** product and the same two recurring prices.
- In Stripe test mode, create product **Additional Rep Team (Club - $19)** with:
  - Monthly recurring price: `CAD $19.00`, billed every 1 month.
  - Annual recurring price: `CAD $190.00`, billed every 1 year.
- In Stripe live mode, create the same **Additional Rep Team (Club - $19)** product and the same two recurring prices.
- In FieldLogicHQ platform admin, open **Stripe Prices** and paste each Stripe `price_...` ID into the matching row:
  - `team` / `monthly` / `sandbox`
  - `team` / `annual` / `sandbox`
  - `team` / `monthly` / `live`
  - `team` / `annual` / `live`
  - `org_team_addon` / `monthly` / `sandbox`
  - `org_team_addon` / `annual` / `sandbox`
  - `org_team_addon` / `monthly` / `live`
  - `org_team_addon` / `annual` / `live`
  - `rep_team` / `monthly` / `sandbox`
  - `rep_team` / `annual` / `sandbox`
  - `rep_team` / `monthly` / `live`
  - `rep_team` / `annual` / `live`
- Do not edit old Stripe Price amounts in place; Stripe prices are effectively immutable. Create new prices and stop using the old $20/$200 price IDs.
- Because there are no live clients, the platform can simply point new Club extra-team billing at the new $19/$190 prices before launch.
- Keep the `team` and `org_team_addon` prices separate even though the amounts match. That keeps reporting, webhooks, and future packaging changes cleaner.

### Direct Team Checkout

Phase 2B/2D/2E implementation status: checkout/recovery plumbing complete; public Team signup UI complete; Stripe sandbox verification support complete; real Stripe sandbox org Team add-on checkout/webhook smoke passed.

Implemented:

- `/api/billing/create-team-checkout` starts standalone Team checkout for an authenticated coach without requiring an existing org context.
- Mock/dev checkout provisions the Team workspace immediately using the Phase 2A provisioning service.
- Real Stripe checkout writes Team intent metadata onto the Checkout Session and Subscription.
- Stripe webhooks provision or recover the Team workspace from metadata on `checkout.session.completed` and Team subscription events.
- Team subscription updates sync `team_workspaces`, `team_entitlements`, and the lightweight workspace org billing fields.
- `/team/checkout/complete` redirects to the coaches portal once webhook provisioning has completed.
- The org upgrade checkout route now rejects `planKey = team` so a normal org is not accidentally mutated into a Team workspace.
- `/team` is the public coach-facing Team signup surface. It collects team, season, billing, and account details, signs in or creates a Team-only coach account, then calls `/api/billing/create-team-checkout`.
- `/api/auth/team-signup` creates coach auth users without creating a normal organization, preserving the Team checkout/provisioning path as the only workspace creator.
- Marketing navigation, footer navigation, and the pricing page now expose the standalone Team path without adding Team to normal org onboarding.

Checkout should:

1. Create or identify the user.
2. Create a Stripe customer for the team workspace or owner.
3. Create a lightweight workspace organization.
4. Create `rep_teams`, an active `rep_program_years` row, and a head coach assignment.
5. Create `team_workspaces` and `team_entitlements`.
6. Route the coach into the team-first portal.

Use transactional server-side creation where possible. If Stripe completes before workspace creation finishes, webhook recovery must be able to resume safely.

### Org Billing Takeover

Org billing takeover should support:

- Existing direct Team moves to `org_team_addon`.
- Existing direct Team moves to `club_included` or `club_extra_team`.
- Subscription cancellation or scheduled cancellation on the prior direct Team subscription.
- Clear messaging about whether the coach retains operational ownership.

Billing transfer must be approval-based:

1. Coach requests org billing or accepts org billing invitation.
2. Org owner approves and completes checkout or confirms billing change.
3. Team entitlement source changes.
4. Prior subscription is cancelled or scheduled to end.
5. Audit event records both parties and timestamps.

### Club Upgrade Math

At 3 or more active paid Team workspaces connected to the same organization, show a soft Club nudge.

Do not hard-gate additional Team add-ons. The non-Club path costs more per team than Club's extra-team price, so the product can allow organizations to keep paying the higher Team add-on rate if they prefer that over subscribing to Club.

## Accounting Link Model

Team accounting should not be treated as a single all-or-nothing merge.

### Independent Team

- Team ledger uses `accounting_ledgers.entity_type = 'team'`.
- Ledger `org_id` points to the lightweight workspace organization.
- Coach sees dues, budget, expenses, and budget-vs-actual inside the coaches portal.

### Linked Team

- Team ledger remains in the workspace org.
- Parent org can see financial summary only if `sharing_level` includes `financial_summary`.
- Parent org can record support payments, reimbursements, or transfers in its own org ledger.
- Cross-org ledger transfer automation can be V2; V1 can show summaries and allow manual org ledger entries.

### Org-Owned Team

- Team data is migrated or reassigned to the parent org.
- Team ledger becomes part of the parent org accounting model.
- Existing entries remain auditable.
- Coach keeps access through normal `rep_team_coaches`.

## Tournament-To-Team Claim Flow

### Surfaces

Add coach conversion CTAs in these places:

- Tournament registration confirmation screen.
- Tournament registration confirmation email.
- Public tournament team page or schedule page when the viewer is an accepted team's contact.
- Post-tournament email to team contacts.
- Tournament admin tools for organizers: "Invite teams to keep managing their season."

### Claim UX

1. Coach opens a secure claim link.
2. They sign in or create an account.
3. System verifies the email matches a tournament team contact or sends a one-time verification.
4. Coach sees a prefilled team activation screen.
5. Coach chooses monthly or seasonal Team billing.
6. Workspace is created or attached to the existing claim.
7. Tournament participation is attached to team history.
8. Coach lands in the team dashboard.

### Data Seeding

Seed only safe, useful data:

- Team name.
- Sport if known.
- Age group/division.
- Coach/contact email.
- Tournament name/date as historical event.
- Tournament schedule/results as read-only history if the data model supports it cleanly.

Do not automatically import unrelated player data unless it was explicitly collected for team management, not only tournament registration.

## Team-To-Org Link Flow

### Coach-Initiated Link

1. Coach enters org name, slug, invite code, or admin email.
2. System creates a `team_org_links` request.
3. Org owner reviews requested sharing and billing mode.
4. Org owner approves, declines, or proposes a different mode.
5. Coach confirms if billing or ownership would change.
6. Link becomes active.

### Org-Initiated Link

1. Org owner invites a Team workspace by coach email or claim code.
2. Coach reviews what the org will see and whether billing changes.
3. Coach accepts or declines.
4. Link becomes active.

### Ownership Transfer

Ownership transfer should require explicit approval from both sides.

When approved:

- Reassign `org_id` across the core rep team tables, or run a dedicated migration/transfer procedure.
- Move or recreate team accounting ledger under the parent org.
- Preserve coach assignments.
- Preserve document storage references.
- Cancel/switch the direct Team subscription.
- Write platform audit events.

This can initially be a platform-admin assisted workflow if self-serve migration is too risky for MVP.

## Portal Experience

### Routes

Keep existing `/{orgSlug}/coaches/...` routes for compatibility. Add team-first entry routes that redirect to the correct workspace:

- `/team`
- `/team/setup`
- `/team/claim/[token]`
- `/team/billing`
- `/team/link-org`

The user-facing language should say "Team Dashboard" or "Coaches Portal," not "Organization Admin," for standalone workspaces.

### Navigation

Team workspace navigation should include:

- Dashboard
- Tournaments
- Roster
- Schedule
- Dues
- Budget
- Documents
- Lineups
- Attendance
- Billing
- Link Organization
- Settings

Hide or remove:

- House league
- Tournament Plus-only controls unless the workspace has a separate tournament upgrade
- Org-wide members
- Org public site management
- Full org accounting outside the team ledger
- Platform-level configuration

### First-Run Checklist

After activation, show a compact team setup checklist:

- Add roster.
- Add season schedule.
- Set dues/installments.
- Upload documents.
- Create a local tournament, optional.
- Create first lineup card.
- Link parent organization, optional.

## Coaches Portal MVP Enhancements

These should be included or planned immediately after the workspace foundation because they make the Team product feel valuable.

### Attendance

- Add attendance/availability per `rep_team_events` row.
- Coach-managed in V1.
- Parent RSVP can wait for parent portal.

### Lineup Cards

- V1: baseball/softball lineup card tied to a scheduled game.
- V1 fallback: generic game roster PDF for other sports.
- Use shared PDF export patterns and org/team PDF settings where possible.
- Coach-only visibility by default.

### Roster/Jersey Polish

- Make jersey number, position, and roster status easy to edit.
- Consider simple equipment notes only if it is cheap and does not create inventory complexity.

### Deferred Enhancements

- Medical/allergy notes: V2 after privacy language and access audit expectations are approved.
- Parent portal: V2 after link/privacy model is stable.
- Messaging: V2, starting with announcements before full chat.
- Stats: V2 lightweight post-game stats, not real-time scoring.
- GameChanger: no unofficial API or scraping; CSV import only if demand is proven.

## Pricing And Marketing Implementation

### Pricing Page

Keep `/pricing` as the canonical URL, but make the first choice segment-based:

- I run tournaments.
- I run a league or club.
- I manage one competitive team.

For "one competitive team," show:

- Team: $29 CAD/month or $290 CAD/season.
- Included: free-tier local tournaments for round robins, exhibition weekends, and informal events with nearby teams.
- Link to Club if the visitor manages multiple teams or needs executive oversight.

### Coach Landing Page

Add a coach-specific page:

- Value proposition: roster, schedule, dues, budget, documents, lineups.
- Tournament continuity: "Your tournament team can become your season workspace."
- Local tournament creation: "Host a quick round robin or exhibition weekend and invite nearby teams."
- Seasonal pricing.
- CTA: Start Team workspace.
- Secondary CTA: Claim a tournament team.

### Tournament CTAs

Use language that connects directly to the event experience:

- "Keep this team organized after the tournament."
- "Turn this tournament team into your season workspace."
- "Track dues, schedules, documents, and lineups in the same place."

## Platform Admin Requirements

Platform admin should be able to:

- View all Team workspaces.
- See source: direct signup, tournament claim, org invite, platform admin.
- See workspace state and billing mode.
- See linked orgs and pending link requests.
- See claim status for tournament teams.
- Grant or revoke platform overrides.
- Assist ownership transfer.
- Audit billing takeover and org link approvals.

This is important because early Team launches will need support intervention.

## Suggested Build Phases

### Phase 0 - Decision Lock

Locked decisions:

- Public name: **Team**.
- Direct Team and org Team add-on price: **$29 CAD/team/month** or **$290 CAD/team/year/season**.
- Club extra rep team add-on price: **$19 CAD/team/month** or **$190 CAD/team/year**.
- Launch posture: build the final public product model from the onset, not a beta-only structure.
- Club upgrade path: soft nudge at 3+ active paid teams; no hard stop.
- Default link sharing level: **Basic**.
- Billing transfer approval: both coach/team owner and organization owner must approve.
- Seasonal billing is the default presentation; monthly is available as the secondary option.
- Existing free Tournament orgs are allowed to pay for org-billed Team add-ons by default.

Acceptance criteria:

- Product owner has approved pricing and package language.
- Build sessions can proceed without reopening core packaging.

### Phase 1 - Data And Entitlement Foundation

Migration status: `supabase/migrations/065_team_workspace_foundation.sql` has been applied in dev and production.

Tasks:

- [x] Add team workspace/account-kind fields or tables.
- [x] Add team workspace, entitlement, org link, and claim tables.
- [x] Extend feature matrix and plan constraints to include `team`, with free-tier tournament access and team-scoped rep team access.
- [x] Add Stripe price rows for Team and org Team add-on.
- [x] Add entitlement helpers for team-scoped access.
- [ ] Add platform audit events for workspace creation, claim, link, billing transfer, and ownership transfer.

Acceptance criteria:

- A Team workspace can exist as a lightweight org with one rep team.
- Entitlement checks can allow one specific team without unlocking all rep teams.
- Platform admin can inspect workspace/link/billing state.

### Phase 2 - Direct Team Onboarding And Billing

Recommended execution order:

1. Build the Team provisioning service.
2. Add direct Team checkout using the `team` Stripe price slots.
3. Add webhook recovery and subscription-state sync for Team workspaces.
4. Route new Team customers into the team-first coaches portal landing experience.
5. Enforce team-scoped access gates so Team users can manage only their entitled team.
6. Complete Stripe Dashboard setup in parallel for `team`, `org_team_addon`, and new Club extra-team prices.

Recommended first build slice: **Phase 2A - Team provisioning service**. This should create the lightweight workspace org, rep team, active program year, coach assignment, `team_workspaces` row, `team_entitlements` row, and team ledger in one safe server-side flow before checkout or tournament claims depend on it.

Phase 2A implementation status: complete.

Implemented:

- `lib/team-workspace-provisioning.ts` provisions the lightweight Team workspace org, rep team, active season, head coach assignment, org/team ledgers, workspace row, entitlement row, platform event, and audit log entry.
- `/api/dev/seed/team-workspace` creates a reusable dev standalone Team workspace for smoke testing.
- Platform admin dev tools can trigger the standalone Team seed and show Team workspace counts.

Phase 2C implementation status: complete.

Implemented in Phase 2C:

- `lib/auth-destination.ts` now sends Team workspace orgs (`account_kind = 'team_workspace'` or `plan_id = 'team'`) to `/{orgSlug}/coaches` after sign-in instead of org admin/onboarding.
- The coaches portal landing page now uses Team workspace language and shows a checkout-success state at `/{orgSlug}/coaches?success=1`.
- Coach assignments are entitlement-aware for Team workspaces: `getCoachingAssignmentsForUser()` filters Team workspace assignments through active `team_entitlements`, while normal Club/org-owned coach behavior remains assignment-based.
- `lib/team-workspace-entitlements.ts` now exposes active org entitlement helpers and requires both active entitlement and current coach assignment for team-scoped access checks.
- Coach-facing org-level endpoints for budget items and payees require an active coach assignment; standalone Team payee searches/creates are scoped through the entitled team.
- `/{orgSlug}/admin/rep-teams/*` remains protected by `module_rep_teams` and redirects standalone Team workspaces back to the coaches portal instead of broadening org-wide rep-team admin access.
- `/api/dev/seed/team-workspace` now returns the expected coaches portal smoke URL for the seeded workspace.

Phase 2D implementation status: complete.

Implemented in Phase 2D:

- `/team` launches the public Team signup flow with team/season details, seasonal vs monthly billing, and account create/sign-in controls.
- New Team-only account creation lives at `/api/auth/team-signup`, so coach signup does not create a normal `organization` account or enter org onboarding.
- The signup page posts to the existing `/api/billing/create-team-checkout` route after authentication; dev/mock checkout provisions immediately, and live checkout uses the existing Stripe/recovery plumbing.
- The marketing nav, footer, and pricing page expose the Team path as "I manage one competitive team" without broadening org plan selection.
- Dev smoke path: visit `/team?billing=annual`, create/sign in as a coach, and in mock billing mode the checkout response should land at `/{orgSlug}/coaches?success=1`.

Remaining after Phase 2D:

- Direct Team Stripe checkout. **Phase 2B plumbing, Phase 2D public UI, and Phase 2E verification support are complete; real Stripe sandbox org Team add-on checkout smoke passed.**
- Webhook recovery and subscription-state sync. **Phase 2B plumbing and Phase 2E readiness checks are complete; real Stripe sandbox webhook smoke passed.**
- Team-first coaches portal landing/redirect. **Phase 2C complete.**
- Team-scoped access gates across the rep-team/coaches routes. **Phase 2C complete for standalone Team workspaces.**

Phase 2E implementation status: complete; real Stripe sandbox checkout/webhook smoke passed on 2026-05-23.

Implemented in Phase 2E:

- `/api/dev/team-checkout-readiness` checks Team checkout readiness for platform-admin dev tools users.
- Platform Admin > Dev Tools now shows Team checkout readiness across app URL, webhook secret, Team gating, Stripe environment, Team monthly price, and Team annual price.
- Platform Admin > Dev Tools includes a dev-only Mock Billing control that can temporarily enable, disable, or clear the mock billing override without editing `.env.local`; the override resets when the dev server restarts.
- When `STRIPE_SECRET_KEY` is present, the readiness check retrieves Stripe price metadata and warns if amount, currency, interval, or active status do not match Team expectations.
- The readiness check distinguishes local mock/direct-provisioning smoke from real Stripe Checkout smoke.
- Final real Stripe sandbox checkout smoke passed for the org Team add-on path with Stripe Checkout and webhook delivery.

Exact Stripe setup steps for sandbox verification:

1. Open Stripe Dashboard and switch to **Test mode**.
2. Go to **Product catalog**.
3. Create or open the product named `FieldLogicHQ - Team`.
4. Add a recurring monthly price:
   - Amount: `29.00`
   - Currency: `CAD`
   - Billing period: monthly
   - Copy the `price_...` ID.
5. Add a recurring yearly price:
   - Amount: `290.00`
   - Currency: `CAD`
   - Billing period: yearly
   - Copy the `price_...` ID.
6. In FieldLogicHQ, sign in as a platform admin and open `/platform-admin/plans-pricing`.
7. In the Product Catalog tab, create a pricing change request such as `Configure Team sandbox Stripe prices`.
8. Mark that change request `Approved`.
9. In the Stripe Prices tab, select that approved request.
10. Under Sandbox, set:
    - Team / Monthly = the monthly `price_...` ID.
    - Team / Annual = the yearly `price_...` ID.
11. Ensure `.env.local` contains:
    - `STRIPE_SECRET_KEY=sk_test_...`
    - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
12. Run `stripe listen --forward-to localhost:3000/api/billing/webhook`.
13. Copy the printed `whsec_...` signing secret into `.env.local` as `STRIPE_WEBHOOK_SECRET=whsec_...`.
14. Restart `npm run dev` with network access.
15. Open `/platform-admin/dev-tools` and confirm Team Checkout Readiness shows no failing checks.
16. Visit `/team?billing=annual`, create or sign in as a coach, complete Stripe Checkout with a Stripe test card, and confirm the redirect lands on `/{orgSlug}/coaches?success=1`.

Tasks:

- Add coach-facing Team signup flow. **Phase 2D complete.**
- Create checkout for Team monthly/seasonal billing. **Phase 2B/2D complete; Phase 2E closed by user sign-off.**
- On successful checkout, create workspace org, rep team, program year, coach assignment, workspace row, entitlement row, and team ledger. **Phase 2A/2B complete.**
- Set the workspace organization's tournament limit and module entitlements to allow free-tier tournaments.
- Route user to the coaches portal. **Phase 2C complete.**
- Add Team billing/settings page.
- Handle subscription webhook updates for Team status.

Acceptance criteria:

- A new coach can pay for Team and land in the coaches portal.
- The workspace has no access to unrelated org modules.
- Cancelling or past-due billing affects only that team workspace.

### Phase 3 - Tournament Claim Funnel

Phase 3A implementation status: first self-serve claim funnel complete.

Phase 3B implementation status: organizer-selected Team claim invitations complete; fully automated post-tournament lifecycle campaigns remain a future enhancement.

Implemented in Phase 3A:

- `lib/team-workspace-claims.ts` creates secure single-use tournament Team claim links, stores only token hashes, resolves public claim context, verifies the signed-in email against the claim contact, and marks claims claimed after workspace provisioning.
- `/team/claim/[token]` shows a prefilled Team activation screen for valid claim links and clear unavailable states for invalid, expired, revoked, or already-claimed links.
- Team checkout now carries tournament-claim metadata through mock checkout and Stripe checkout/webhook recovery, writes `source = 'tournament_claim'`, `source_tournament_id`, and `source_tournament_team_id` to `team_workspaces`, and marks the claim claimed only after the workspace is created.
- Tournament registration confirmation emails now include a Team workspace claim CTA for non-waitlisted team registrations.
- Platform Admin > Dev Tools can generate a sample Team claim link from the seeded dev tournament.

Implemented in Phase 3B:

- Tournament organizers can select teams from `/{orgSlug}/admin/tournaments/teams` and send Team workspace claim invitations from the existing multi-select action bar.
- `/api/admin/tournaments/[tournamentId]/team-claims` creates fresh secure claim links for eligible pending/accepted team registrations, emails the team contacts, returns generated links for follow-up, and logs the operation as a tournament registration event.
- Claimed teams are not reissued claim links. Waitlisted, rejected, missing-email, and out-of-tournament records are skipped or rejected server-side.
- `teamWorkspaceClaimInviteHtml()` provides the organizer-triggered email CTA and reminds coaches to use the invited contact email for security.
- The tournament teams page shows the generated claim links from the last invite send so organizers can immediately open or copy a link if needed.

Tasks:

- Generate claim records for eligible tournament teams/registrations. **Phase 3A complete for new public registrations and dev smoke claims.**
- Add secure claim links and email verification. **Phase 3A complete using a secure token plus signed-in/contact-email match.**
- Add tournament registration confirmation CTA. **Phase 3A complete for non-waitlisted public team registrations.**
- Add post-tournament team contact email CTA. **Phase 3B complete for organizer-selected team contacts; automated post-event campaign scheduling remains future work.**
- Add claim activation screen with prefilled team details. **Phase 3A complete.**
- Attach tournament participation history to the workspace. **Phase 3A complete through Team checkout/provisioning metadata.**
- Add organizer bulk invite/post-tournament campaign tools. **Phase 3B complete for selected-team bulk invites from tournament admin.**

Acceptance criteria:

- A tournament team contact can claim a team securely. **Phase 3A complete.**
- Claim links cannot be reused after activation. **Phase 3A complete.**
- Team workspace creation is idempotent if checkout/webhook flow retries. **Phase 3A complete via existing subscription idempotency plus claim marking.**
- A tournament organizer can send claim invites to selected eligible teams without manually creating links. **Phase 3B complete.**

### Phase 4 - Team-To-Org Linking

Phase 4A implementation status: basic visibility link foundation complete.

Phase 4B implementation status: org-initiated Basic visibility invitations complete.

Phase 4C implementation status: org billing takeover for linked Team workspaces complete.

Implemented in Phase 4A:

- Standalone Team coaches can open `/{orgSlug}/coaches/link-org` and request a parent organization link by org slug or contact email.
- Coach link requests require a Team workspace org plus active team entitlement and active coach assignment for the workspace rep team.
- Organization owners/admins can open `/{orgSlug}/admin/org/team-links` to review pending Team workspace link requests, approve Basic visibility links, decline requests, and see link history.
- Approving a request updates `team_org_links` to `linked` and marks the Team workspace state as linked, without changing billing ownership, data ownership, roster/document/accounting access, or org-wide `module_rep_teams` access.
- Link request, approval, and decline actions write org audit log entries and platform lifecycle events.
- Coaches Portal and Organization Admin navigation now expose the link flow, and the help center documents coach request and org review behavior.

Implemented in Phase 4B:

- Organization owners/admins can open `/{orgSlug}/admin/org/team-links` and invite a standalone Team workspace by workspace slug or primary coach email.
- Org invitations create `team_org_links` rows with `status = 'invited'`, `link_type = 'visibility'`, and `sharing_level = 'basic'`, with the org side recorded as already approved.
- Standalone Team coaches can open `/{teamOrgSlug}/coaches/link-org`, review incoming invitations, and accept or decline them from the Coaches Portal.
- Accepting an invitation updates `team_org_links` to `linked` and marks the Team workspace/workspace org as linked, using the same state change as Phase 4A.
- Acceptance does not transfer billing ownership, data ownership, roster/document/accounting access, parent-org `team_entitlements`, or org-wide `module_rep_teams` access.
- Org-request and coach-response actions write org audit log entries and platform lifecycle events.
- Help docs now explain both the coach-requested and org-invited Basic visibility flows.

Implemented in Phase 4C:

- Linked Team coaches can request org billing from `/{teamOrgSlug}/coaches/link-org` after a Basic visibility link is active.
- Organization owners/admins can invite a linked Team workspace to move billing from `/{parentOrgSlug}/admin/org/team-links`.
- Team coaches can accept or decline org billing invitations from the Coaches Portal.
- Organization owners/admins can approve coach-requested billing and complete annual or monthly org Team add-on checkout. In dev/mock mode this applies immediately; in real Stripe mode it creates an `org_team_addon` Checkout Session and webhook recovery applies the billing takeover.
- Billing takeover updates `team_workspaces.billing_mode` to `org_team_addon`, sets `billing_owner_org_id`, keeps the workspace linked, cancels the previous direct Team subscription when a real Stripe takeover completes, and updates team entitlements without transferring data ownership.
- The workspace org keeps an active Team-scoped entitlement for coach portal access, while the linked org receives a Team-scoped `org_team_addon` entitlement for billing records. This does not grant org-wide `module_rep_teams` access or expose roster, documents, or accounting data.
- Billing request, invitation, acceptance/decline, checkout start, and takeover completion actions write org audit log entries and platform lifecycle events.
- Help docs now explain Basic linking versus org billing takeover for both coaches and organization admins.

Dev smoke path for coach-requested links:

1. Seed or use an existing standalone Team workspace.
2. Sign in as the assigned Team coach and open `/{teamOrgSlug}/coaches/link-org`.
3. Submit a parent organization slug or contact email.
4. Sign in as an owner/admin of that parent org and open `/{parentOrgSlug}/admin/org/team-links`.
5. Approve the request and confirm the link moves from Needs review to Link history while billing and rep-team admin access remain unchanged.

Dev smoke path for org invitations:

1. Seed or use an existing standalone Team workspace.
2. Sign in as an owner/admin of the parent org and open `/{parentOrgSlug}/admin/org/team-links`.
3. Enter the Team workspace slug or primary coach email and send the invitation.
4. Sign in as the assigned Team coach and open `/{teamOrgSlug}/coaches/link-org`.
5. Accept the invitation and confirm the link moves to `linked` while billing, parent-org entitlements, ownership, roster/doc/accounting access, and org-wide rep-team admin access remain unchanged.

Dev smoke path for org billing takeover:

1. Start with an approved Basic linked Team workspace.
2. Sign in as the assigned Team coach and open `/{teamOrgSlug}/coaches/link-org`.
3. Click **Request Org Billing** and confirm the link remains `linked` with `link_type = 'billing'` and `billing_mode_after_approval = 'org_team_addon'`.
4. Sign in as an owner/admin of the parent org and open `/{parentOrgSlug}/admin/org/team-links`.
5. In mock billing mode or a non-Stripe dev environment, click **Approve Annual** and confirm org billing becomes active.
6. Confirm `team_workspaces.billing_mode = 'org_team_addon'`, `billing_owner_org_id` is the parent org, workspace state remains `linked`, coach portal access still works through a workspace-org Team entitlement, and no roster/doc/accounting/org-wide rep-team access is transferred.

Tasks:

- [x] Add coach-initiated org link request flow.
- [x] Add org-initiated team invite flow.
- [x] Add approval screens for coach and org owner.
- [x] Add Basic visibility sharing controls.
- [x] Add org view of linked team summaries.
- [x] Add billing takeover path from direct Team to org Team add-on.

Acceptance criteria:

- A standalone Team can link to an org without moving all data. **Phase 4A complete for coach-initiated Basic visibility links.**
- A standalone Team can link to an org without moving all data. **Phase 4B complete for org-initiated Basic visibility invitations.**
- Org sees only approved sharing level. **Phase 4A/4B/4C complete for Basic visibility summary and billing takeover without data expansion.**
- Org can become billing owner without immediately becoming data owner. **Phase 4C complete for org Team add-on checkout/mock application.**

### Phase 5 - Ownership Transfer

Phase 5A implementation status: ownership transfer approval foundation complete.

Phase 5B implementation status: platform-assisted completion implemented and smoke-tested; migration 067 applied in dev and production.

Implemented in Phase 5A:

- Linked Team coaches can request ownership transfer from `/{teamOrgSlug}/coaches/link-org`.
- Organization owners/admins can invite a linked Team workspace to ownership transfer from `/{parentOrgSlug}/admin/org/team-links`.
- Organization owners/admins can approve or decline coach-requested ownership transfer.
- Team coaches can accept or decline org-initiated ownership transfer invitations.
- Mutual approval moves the relationship to `team_org_links.status = 'ownership_pending'`, `link_type = 'ownership'`, and `sharing_level = 'full_org_owned'`.
- Declines restore the previous active link posture: Basic visibility, or org billing when org Team add-on billing is already active.
- Ownership request, invitation, approval, acceptance, and decline actions write org audit log entries and platform lifecycle events.
- Help docs now distinguish Basic visibility, org billing, and ownership transfer for both coaches and organization admins.

Implemented in Phase 5B:

- Added `supabase/migrations/067_team_ownership_transfer_rpc.sql` with `complete_team_workspace_ownership_transfer(...)`.
- The RPC validates a mutually approved `ownership_pending` link, target org, team slug conflicts, and team ledger conflicts before changing data.
- The RPC moves team-scoped rep-team rows and the team accounting ledger to the linked org in one database transaction.
- The RPC creates or activates parent-org coach memberships, suspends retired workspace-org memberships, retires active Team entitlements, marks other active links revoked, marks the transfer link `org_owned`, and updates `team_workspaces.workspace_state = 'org_owned'`.
- Added platform-admin completion API and org-detail Support workflow controls with a required reason.
- Server completion checks the target org has Club or Rep Teams module access before calling the RPC.
- Server completion attempts to cancel the previous real Stripe Team/org Team add-on subscription when one exists and records any cancellation warning in platform audit/event metadata.
- Platform Admin Operations help now documents the completion and retry SOP.
- Added `tests/uat/scenarios/team-ownership-transfer-smoke.spec.ts`; the focused UAT smoke passed on May 23, 2026.

Next Phase 5 slice:

- Closed for MVP: do not add a rollback RPC now. Ownership transfer is expected to be rare, platform-assisted, and auditable; failed pre-completion attempts remain safely retryable, and completed transfer reversals will be handled by support/engineering case by case.

Tasks:

- [x] Add ownership transfer request and approval workflow.
- [x] Create transfer procedure for `org_id` reassignment across rep team tables. **Migration 067 applied in dev/prod.**
- [x] Move or recreate team accounting ledger under parent org. **Migration 067 applied in dev/prod.**
- [x] Preserve coach access and documents. **Coach memberships and document org ownership are handled by the RPC.**
- [x] Cancel/switch prior billing. **Server completion attempts Stripe cancellation and switches workspace billing to Club included.**
- [x] Add platform admin assisted transfer controls.

Acceptance criteria:

- A linked team can become org-owned without losing roster, schedule, dues, documents, budget, or coach access.
- Transfer is audited.
- Failed pre-completion transfer attempts can be safely retried by platform admin; completed transfer reversals are support/engineering assisted for MVP.

### Phase 6 - Coach Portal Value Bundle

Phase 6A implementation status: coach-managed event attendance implemented and smoke-tested; migration 069 applied in dev and production.

Phase 6B implementation status: roster positions and baseball/softball lineup builder implemented and smoke-tested; migration 070 applied in dev and production.

Phase 6C implementation status: first-run Team workspace setup checklist implemented on the coach team overview and smoke-tested through the lineup path.

Implemented in Phase 6A:

- Added `supabase/migrations/069_rep_team_event_attendance.sql` for event-to-player attendance rows with `unknown`, `attending`, `absent`, and `late` statuses plus coach notes; the migration also syncs attendance ownership when event rows move during ownership transfer. **Migration 069 applied in dev/prod.**
- Added coach-only event attendance API under `app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/attendance/route.ts`.
- Coaches can open an event from `/{orgSlug}/coaches/teams/{teamId}/schedule`, mark active roster players In, Out, Late, or Unknown, add notes, bulk-mark all as attending, and save changes.
- Access uses the existing Coaches Portal rule: active organization membership plus active coach assignment, with Team workspace entitlement filtering still enforced by assignment loading.
- This does not expand linked-org Basic visibility, billing ownership, roster/document/accounting access, or org-wide `module_rep_teams` access.
- Coaches help documentation now mentions attendance from the Schedule event detail flow.
- Added `tests/uat/scenarios/team-attendance-smoke.spec.ts`; the focused UAT smoke passed on May 23, 2026.
- The smoke found and fixed a Next 16 client params issue in `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx`.

Implemented in Phase 6B:

- Added `supabase/migrations/070_rep_team_lineups.sql` for roster primary/secondary positions, event-level lineups, lineup entries, RLS read policies, and a lineup scope-sync trigger tied to `rep_team_events`. **Migration 070 applied in dev/prod. Migration 071 lineup RLS fix also applied in dev/prod.**
- Coaches can store roster position metadata from the roster add/edit flows, and roster XLSX/CSV/PDF exports include position columns.
- Coaches can open league games, tournament games, or scrimmages from the schedule and build a lineup in either `Everyone bats` or `9 player ball` mode.
- `Everyone bats` includes every active roster player in the batting order and uses `Bench` as an optional inning-by-inning defensive position.
- `9 player ball` separates nine starters from the bench, while still allowing bench players to receive inning-by-inning defensive positions for planned substitutions.
- Added lineup PDF export from the game detail panel.
- Added `tests/uat/scenarios/team-lineup-smoke.spec.ts` for the 9 player ball and everyone bats save path; the focused UAT smoke passed on May 23, 2026.
- This remains coach-scoped and does not expand linked-org Basic visibility, billing ownership, roster/document/accounting access, or org-wide `module_rep_teams` access.

Implemented in Phase 6C:

- Added a data-driven `Season setup` checklist to `/{orgSlug}/coaches/teams/{teamId}` using existing coach-scoped roster, events, and budget APIs.
- Checklist progress covers active roster, jersey/position details, calendar events, game lineup readiness, budget setup, and Team-only parent organization linking.
- The parent-organization checklist item appears only for standalone Team workspaces and links to the existing Basic visibility link flow; it does not grant linked orgs roster, document, accounting, billing, ownership, or org-wide `module_rep_teams` access.
- Fixed the coach team overview page to use the Next 16 client `use(params)` pattern.
- Added checklist assertions to `tests/uat/scenarios/team-lineup-smoke.spec.ts`.

Tasks:

- [x] Add attendance to schedule events.
- [x] Apply migration 070 in dev/prod.
- [x] Add baseball/softball lineup card builder and PDF export.
- [x] Add generic game roster PDF fallback through roster PDF position columns and lineup PDF export.
- [x] Improve roster jersey/position editing for lineup setup.
- [x] Add first-run checklist for Team workspaces.

Acceptance criteria:

- Coach can complete a game-day workflow: confirm roster, mark attendance, create lineup, export PDF. **Phase 6A completes attendance; Phase 6B implements and smoke-tests roster positions, lineups, and lineup PDF.**
- Coach can see first-run season setup progress from the team overview. **Phase 6C adds the data-driven checklist and extends the lineup smoke.**
- Features work for standalone, linked, and org-owned teams. **Phase 6A/6B/6C use the shared Coaches Portal assignment and Team entitlement access path.**

### Phase 7 - Pricing And Marketing Surfaces

Phase 7A implementation status: segment-first public pricing entry implemented and smoke-tested for the Team buyer path.

Phase 7B implementation status: public Team landing page refreshed and added to the pricing Team smoke path.

Phase 7C implementation status: tournament-to-Team CTA copy and email paths updated and the Team acquisition URL path smoke-tested.

Phase 7D implementation status: billing-page Team-to-org link and multi-team Club value nudges implemented; focused smoke coverage updated.

Implemented in Phase 7A:

- `/pricing` now starts with a role-based segment picker: "I run tournaments," "I run a league or club," and "I manage one competitive team."
- The Team segment and Team pricing panel point to `/team?billing=annual`, making seasonal pricing the default public presentation while preserving month-to-month choice on the Team signup page.
- Team pricing copy now reflects the implemented MVP: roster, schedule, dues, documents, budget, attendance, lineups, setup checklist, reminders, optional parent-org linking, and one free-tier local tournament slot.
- Organization plan cards remain in the existing shared `PricingSection`, so normal org onboarding and Club/Tournament behavior are unchanged.
- Footer pricing navigation now points to canonical `/pricing`.
- Added `tests/uat/scenarios/pricing-team-smoke.spec.ts` for the public pricing Team segment and CTA path.
- Coaches help documentation now explains what the standalone Team plan includes and the $290 CAD season / $29 CAD month-to-month framing.

Implemented in Phase 7B:

- `/team` now presents a coach-specific landing story before and around the existing signup form: "From tournament weekend to season workspace."
- The landing copy highlights tournament-team continuity, Coaches Portal season operations, attendance, lineups, dues, budget, documents, setup progress, parent-org readiness, and free-tier local tournaments.
- The signup form and checkout plumbing are unchanged; `/team?billing=annual` still defaults to seasonal pricing while preserving the monthly toggle.
- Added `/team` landing assertions to `tests/uat/scenarios/pricing-team-smoke.spec.ts`.

Implemented in Phase 7C:

- Added a Team-specific tournament acquisition href helper that sends coach-facing tournament CTAs to `/team?billing=annual` while preserving source, org slug, tournament slug, and marketing surface context.
- Registration confirmation success CTA now tells coaches to keep the registered team organized after the tournament and points to the Team landing page while the secure claim link remains email-only.
- Public tournament acquisition banner now includes a Team workspace CTA for coaches and preserves the existing organizer event/pricing CTA.
- Tournament registration confirmation email and organizer-sent claim invite email now explain Team season workspace value: roster, schedule, dues, documents, attendance, lineups, and quick local tournaments.
- Post-event results email now includes a Team workspace link for coaches who want to keep the team going after results are posted.

Implemented in Phase 7D:

- Team workspace Subscription now shows a parent-organization billing nudge that sends coaches to the existing `/{teamOrgSlug}/coaches/link-org` Basic link and org billing approval flow.
- Organization Subscription now fetches existing Team Links and shows a Club value nudge when the organization is already paying for 3+ active linked Team add-ons.
- Organization Admin > Team Links shows the same Club value cue at the point where owners/admins manage Team add-on billing.
- The nudges are informational only: they do not transfer billing, ownership, roster/document/accounting access, or org-wide `module_rep_teams` access.
- Help docs now explain the coach billing shortcut and the 3+ paid Team Club value nudge.

Tasks:

- [x] Add segment-first pricing selector.
- [x] Add coach/team landing page.
- [x] Add tournament-to-team CTAs in registration confirmation, public tournament surfaces, and emails.
- [x] Add Team messaging that highlights included free-tier local tournaments as a way to invite nearby teams.
- [x] Add billing-page upsells from Team to org link and from multi-team orgs to Club.

Acceptance criteria:

- Coaches can understand Team without reading Club pricing. **Phase 7A complete for public pricing; Phase 7B complete for the Team landing page.**
- Tournament participants see a relevant follow-up CTA. **Phase 7C updates registration confirmation, public tournament banners, and emails.**
- Organizations with multiple paid teams are nudged toward Club. **Phase 7D complete for Subscription and Team Links informational nudges at 3+ active org-paid Team add-ons.**

### Phase 8 - Verification And Launch

Phase 8 implementation status: focused automated launch verification is passing for public Team acquisition, direct mock checkout, tournament claim mock checkout, Team free-tier tournament slot limits, Basic org linking, coach-scoped attendance/RLS, lineup/checklist, and platform-assisted ownership transfer. Real Stripe org Team add-on checkout/webhook smoke is already passing; direct real Stripe Team checkout, cancellation/past-due simulations, mobile visual sign-off, and live Stripe price confirmation remain manual launch checks.

Automated Phase 8 verification run on May 23, 2026:

- `tests/uat/scenarios/pricing-team-smoke.spec.ts`: passed.
- `tests/uat/scenarios/team-direct-checkout-smoke.spec.ts`: passed. This temporarily enables dev mock billing through the platform-admin dev API, verifies direct Team checkout creates `team_direct` workspace/entitlement state, verifies tournament-claim checkout writes source tournament/team IDs and marks the claim claimed, and verifies a Team workspace can create one free-tier tournament but receives a 403 on a second non-archived tournament.
- `tests/uat/scenarios/team-org-link-smoke.spec.ts`: Basic coach-requested and org-invited visibility paths passed; the mock org-billing subtest skipped because this environment has Stripe configured without mock mode.
- `tests/uat/scenarios/team-attendance-smoke.spec.ts`: passed, including the linked-org owner 403 against the coach attendance API.
- `tests/uat/scenarios/team-lineup-smoke.spec.ts`: passed, including Season setup checklist, 9 player ball, and Everyone bats save paths.
- `tests/uat/scenarios/team-ownership-transfer-smoke.spec.ts`: passed.
- `npx.cmd tsc --noEmit`: passed.
- Focused ESLint for the new direct/claim checkout smoke: passed.

Phase 8 readiness matrix:

| Area | Status | Evidence / Remaining Check |
| --- | --- | --- |
| Direct Team signup | Automated mock pass | `team-direct-checkout-smoke` covers checkout API, workspace state, entitlement state, redirect, and Team one-slot tournament limit. Real Stripe direct Team checkout remains a manual sandbox launch check. |
| Tournament claim signup | Automated mock pass | `team-direct-checkout-smoke` covers claim token checkout, source tournament/team persistence, and claim status update. Real Stripe claim checkout remains covered by the same manual direct Team sandbox path. |
| Team free-tier tournament creation | Automated pass | Direct smoke creates one Team tournament and confirms the second non-archived tournament is blocked by the plan limit. |
| Linked-team visibility | Automated pass | Org link smoke covers Basic visibility approval/invite state; attendance smoke confirms linked org owner cannot read coach-scoped attendance API. |
| Org billing takeover | Prior pass / current skip | Mock and real Stripe org Team add-on checkout/webhook smoke passed previously; current mixed suite skipped only the mock subtest because Stripe is configured without mock mode. |
| Club ownership transfer | Automated pass | Ownership transfer smoke verifies platform-admin completion, org-owned state, ledger/team reassignment, retired entitlements, and workspace membership suspension. |
| Role and RLS boundaries | Automated partial pass | Coach entitlement gates are exercised by attendance/lineup/link smokes; linked org API denial is covered. Full manual role/RLS review remains a launch checklist item. |
| Mobile coach portal flows | Manual | Browser visual verification remains user-owned per agency rules. |
| Cancellation and past-due states | Manual / Stripe simulation | Existing sync code maps Stripe states, but Team-specific direct cancellation and payment-failure simulation remain launch checks. |
| Stripe sandbox webhooks | Prior pass / manual direct remains | Org Team add-on webhook smoke passed. Direct Team real Stripe checkout/webhook still needs the final manual sandbox run. |
| Stripe price IDs | Manual | Readiness checker exists; live and sandbox Team/org Team add-on/Club extra-team price rows should be confirmed before launch. |

Tasks:

- [x] Test direct Team signup.
- [x] Test tournament claim signup.
- [x] Test Team workspace free-tier tournament creation and free-plan feature limits.
- [x] Test linked-team visibility.
- Test org billing takeover. **Mock smoke and real Stripe sandbox org Team add-on checkout/webhook smoke pass.**
- [x] Test Club ownership transfer.
- [ ] Test cancellation and past-due states.
- [x] Test role and RLS boundaries. **Focused automated coverage passes for coach entitlement access and linked-org API denial; full manual policy review remains recommended before launch.**
- Test mobile coach portal flows.
- Test Stripe sandbox webhooks. **Org Team add-on Checkout Session completion and subscription webhooks pass against the local webhook listener.**
- Confirm Stripe price IDs exist for sandbox and live Team, org Team add-on, and Club extra-team prices.

Acceptance criteria:

- No lower-tier org can see unentitled rep teams.
- Coach cannot access unrelated org admin modules.
- Linked org cannot see sensitive data beyond its sharing level.
- Billing state and entitlement state stay synchronized. **Automated mock checkout and org billing/ownership smokes validate Team entitlement state; cancellation/past-due still needs Stripe simulation.**
- Platform admin has enough visibility to support beta customers. **Ownership transfer smoke confirms platform-admin support completion path; Dev Tools readiness checker exists for Team checkout.**
- Stripe sandbox checkout and webhook flows pass for direct Team, org Team add-on, and Club extra-team billing. **Org Team add-on passed; direct Team and Club extra-team remain final manual sandbox launch checks.**

### Phase 9 - Help Documentation And Launch Cleanup

Phase 9 implementation status: complete for launch documentation, help content, owner checklist, and stale Club extra-team pricing copy.

Implemented in Phase 9:

- Expanded coach help with a Team workspace, season rollover, and local tournament guide. It explains Team value, program-year season history, one non-archived free-tier tournament slot, and the Tournament Plus boundary.
- Expanded organization help with Team add-on versus Club guidance, linked Team tournament boundaries, billing transfer language, and Club extra-team positioning.
- Expanded platform-admin help with a Team launch readiness SOP covering Stripe price rows, readiness checks, manual sandbox smokes, cancellation/past-due simulation, and mobile visual sign-off.
- Added `docs/active/codex_STANDALONE_TEAM_LAUNCH_CHECKLIST.md` for owner-facing Stripe Dashboard setup, FieldLogicHQ price-row confirmation, manual sandbox smokes, customer-facing documentation checks, and release notes.
- Updated stale Club extra-team pricing references from $20/$200 to $19/$190 in active pricing copy.

Tasks:

- [x] Add or update help documentation for the Team plan.
- [x] Document season rollover: changing team name, age group, roster, schedule, dues, and budget by season while preserving history.
- [x] Document free-tier Team tournaments: one non-archived tournament at a time, scrimmage/round-robin use case, and Tournament Plus upgrade path.
- [x] Document org linking, Basic sharing, higher sharing levels, and org-owned transfer.
- [x] Document billing transfer and the two-sided approval requirement.
- [x] Document the difference between direct Team, org Team add-on, Club included teams, and Club extra teams.
- [x] Update pricing/help copy anywhere Club extra-team pricing appears so it shows $19/$190 instead of $20/$200.
- [x] Add release notes or internal owner checklist covering required Stripe Dashboard setup.

Acceptance criteria:

- A coach can understand Team from public pricing, coach landing copy, and in-app help. **Phase 9 adds in-app help for Team, seasons, history, and free-tier local tournaments.**
- An org owner can understand when to use Team add-ons versus Club. **Phase 9 adds org help explaining coach-operated Team add-ons versus Club's multi-team operating model.**
- A platform admin or owner can verify all Stripe products/prices needed before launch. **Phase 9 adds platform-admin readiness help and a dedicated launch checklist.**
- Help docs do not imply Team includes Tournament Plus features or formal tournament archiving. **Phase 9 explicitly states Team tournaments are limited to the free-tier one-slot model and that Tournament Plus features require an upgrade.**

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Team add-on becomes cheap Club substitute | Use team-scoped entitlements, price Team add-ons at $29 while Club extra teams are $19, and show soft Club nudges at 3+ paid teams. |
| Stub org leaks into UX | Team-first routes, labels, onboarding, nav, and billing pages. Hide org admin shell. |
| Team tournament access blurs Tournament Plus value | Limit Team to free Tournament-tier capabilities by default and keep Plus features gated or separately upgradeable. |
| Linking exposes sensitive minor data | Default to basic sharing. Require explicit sharing levels. Defer medical notes. |
| Billing transfer creates duplicate subscriptions | Make billing takeover approval-based and auditable. Build webhook recovery/idempotency. |
| Ownership transfer is too risky for self-serve MVP | Start with platform-admin assisted transfer, then automate later. |
| Tournament claim invites wrong person | Require contact email verification and single-use claim tokens. |
| Accounting links become complex | Start with summaries for linked teams; full ledger migration only for org-owned teams. |

## Open Implementation Questions

- Which existing tournament team/registration table should be the canonical claim source?
- Should `team` be a real `plan_id` on the workspace org, or should it be represented only through `team_workspaces` and entitlements?
- Resolved in Phase 4C: org Team add-on checkout uses separate `org_team_addon` Stripe price rows, not the Club extra-team `rep_team` price.
- What exact fields should be visible in each team-to-org sharing level?
- Should direct Team billing customer live on `organizations`, `team_workspaces`, or both?
- Should ownership transfer be self-serve in MVP or platform-admin assisted only?
- How should tournament history be displayed if the tournament team record does not include full roster data?

## Files Likely Touched In A Future Build

Database/migrations:

- [x] `065_team_workspace_foundation.sql` for Team workspace, entitlements, links, claims, plan/catalog updates. Applied in dev and production.
- Possible updates to `organizations`, `stripe_prices`, `plan_feature_matrix`, and product catalog tables.

Core libraries:

- `lib/plan-config.ts`
- `lib/plan-config-db.ts`
- `lib/plan-module-entitlements.ts`
- `lib/roles.ts`
- `lib/auth-destination.ts`
- `lib/api-auth.ts`
- `lib/stripe-prices.ts`
- `lib/stripe-sync.ts`
- `lib/db.ts`
- `lib/help-content/rep-teams.tsx`
- `lib/help-content/tournaments.tsx`
- `lib/help-content/accounting.tsx`
- Potential new Team help content module

API routes:

- Billing checkout/webhook routes.
- New Team signup/claim/link routes.
- Rep team entitlement-protected routes.
- Platform admin org/team support routes.

UI routes:

- `/pricing`
- Coach/team landing page.
- Team signup and claim routes.
- Coaches portal routes under `/{orgSlug}/coaches/...`
- Org billing page.
- Platform admin org/team detail pages.

## Final Recommendation

Build the standalone Team model now, but build it as a reusable Team workspace foundation rather than a one-off plan. The same foundation should support direct coach signup, tournament team claiming, org-paid team add-ons, linked-team visibility, and full Club ownership transfer.

This makes the tournament funnel commercially useful immediately while preserving the long-term Club upgrade path.
