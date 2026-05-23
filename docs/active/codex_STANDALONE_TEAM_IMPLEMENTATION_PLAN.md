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

Phase 2B/2D implementation status: checkout/recovery plumbing complete; public Team signup UI complete; Stripe sandbox verification still pending real Team price IDs.

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

- Direct Team Stripe checkout. **Phase 2B plumbing and Phase 2D public UI complete; end-to-end Stripe sandbox verification pending Stripe price IDs.**
- Webhook recovery and subscription-state sync. **Phase 2B plumbing complete; end-to-end Stripe sandbox verification pending Stripe price IDs.**
- Team-first coaches portal landing/redirect. **Phase 2C complete.**
- Team-scoped access gates across the rep-team/coaches routes. **Phase 2C complete for standalone Team workspaces.**

Phase 2E implementation status: verification support complete; real Stripe sandbox smoke pending account setup.

Implemented in Phase 2E:

- `/api/dev/team-checkout-readiness` checks Team checkout readiness for platform-admin dev tools users.
- Platform Admin > Dev Tools now shows Team checkout readiness across app URL, webhook secret, Team gating, Stripe environment, Team monthly price, and Team annual price.
- Platform Admin > Dev Tools includes a dev-only Mock Billing control that can temporarily enable, disable, or clear the mock billing override without editing `.env.local`; the override resets when the dev server restarts.
- When `STRIPE_SECRET_KEY` is present, the readiness check retrieves Stripe price metadata and warns if amount, currency, interval, or active status do not match Team expectations.
- The readiness check distinguishes local mock/direct-provisioning smoke from real Stripe Checkout smoke.

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
- Create checkout for Team monthly/seasonal billing. **Phase 2B/2D complete; Stripe sandbox verification pending.**
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

Implemented in Phase 4A:

- Standalone Team coaches can open `/{orgSlug}/coaches/link-org` and request a parent organization link by org slug or contact email.
- Coach link requests require a Team workspace org plus active team entitlement and active coach assignment for the workspace rep team.
- Organization owners/admins can open `/{orgSlug}/admin/org/team-links` to review pending Team workspace link requests, approve Basic visibility links, decline requests, and see link history.
- Approving a request updates `team_org_links` to `linked` and marks the Team workspace state as linked, without changing billing ownership, data ownership, roster/document/accounting access, or org-wide `module_rep_teams` access.
- Link request, approval, and decline actions write org audit log entries and platform lifecycle events.
- Coaches Portal and Organization Admin navigation now expose the link flow, and the help center documents coach request and org review behavior.

Dev smoke path:

1. Seed or use an existing standalone Team workspace.
2. Sign in as the assigned Team coach and open `/{teamOrgSlug}/coaches/link-org`.
3. Submit a parent organization slug or contact email.
4. Sign in as an owner/admin of that parent org and open `/{parentOrgSlug}/admin/org/team-links`.
5. Approve the request and confirm the link moves from Needs review to Link history while billing and rep-team admin access remain unchanged.

Tasks:

- [x] Add coach-initiated org link request flow.
- Add org-initiated team invite flow.
- [x] Add approval screens for coach and org owner.
- [x] Add Basic visibility sharing controls.
- [x] Add org view of linked team summaries.
- Add billing takeover path from direct Team to org Team add-on.

Acceptance criteria:

- A standalone Team can link to an org without moving all data. **Phase 4A complete for coach-initiated Basic visibility links.**
- Org sees only approved sharing level. **Phase 4A complete for Basic visibility summary.**
- Org can become billing owner without immediately becoming data owner.

### Phase 5 - Ownership Transfer

Tasks:

- Add ownership transfer request and approval workflow.
- Create transfer procedure for `org_id` reassignment across rep team tables.
- Move or recreate team accounting ledger under parent org.
- Preserve coach access and documents.
- Cancel/switch prior billing.
- Add platform admin assisted transfer controls.

Acceptance criteria:

- A linked team can become org-owned without losing roster, schedule, dues, documents, budget, or coach access.
- Transfer is audited.
- Failed transfer can be safely retried or rolled back by platform admin.

### Phase 6 - Coach Portal Value Bundle

Tasks:

- Add attendance to schedule events.
- Add baseball/softball lineup card builder and PDF export.
- Add generic game roster PDF fallback.
- Improve roster jersey/position editing if needed.
- Add first-run checklist for Team workspaces.

Acceptance criteria:

- Coach can complete a game-day workflow: confirm roster, mark attendance, create lineup, export PDF.
- Features work for standalone, linked, and org-owned teams.

### Phase 7 - Pricing And Marketing Surfaces

Tasks:

- Add segment-first pricing selector.
- Add coach/team landing page.
- Add tournament-to-team CTAs in registration confirmation, public tournament surfaces, and emails.
- Add Team messaging that highlights included free-tier local tournaments as a way to invite nearby teams.
- Add billing-page upsells from Team to org link and from multi-team orgs to Club.

Acceptance criteria:

- Coaches can understand Team without reading Club pricing.
- Tournament participants see a relevant follow-up CTA.
- Organizations with multiple paid teams are nudged toward Club.

### Phase 8 - Verification And Launch

Tasks:

- Test direct Team signup.
- Test tournament claim signup.
- Test Team workspace free-tier tournament creation and free-plan feature limits.
- Test linked-team visibility.
- Test org billing takeover.
- Test Club ownership transfer.
- Test cancellation and past-due states.
- Test role and RLS boundaries.
- Test mobile coach portal flows.
- Test Stripe sandbox webhooks.
- Confirm Stripe price IDs exist for sandbox and live Team, org Team add-on, and Club extra-team prices.

Acceptance criteria:

- No lower-tier org can see unentitled rep teams.
- Coach cannot access unrelated org admin modules.
- Linked org cannot see sensitive data beyond its sharing level.
- Billing state and entitlement state stay synchronized.
- Platform admin has enough visibility to support beta customers.
- Stripe sandbox checkout and webhook flows pass for direct Team, org Team add-on, and Club extra-team billing.

### Phase 9 - Help Documentation And Launch Cleanup

Tasks:

- Add or update help documentation for the Team plan.
- Document season rollover: changing team name, age group, roster, schedule, dues, and budget by season while preserving history.
- Document free-tier Team tournaments: one non-archived tournament at a time, scrimmage/round-robin use case, and Tournament Plus upgrade path.
- Document org linking, Basic sharing, higher sharing levels, and org-owned transfer.
- Document billing transfer and the two-sided approval requirement.
- Document the difference between direct Team, org Team add-on, Club included teams, and Club extra teams.
- Update pricing/help copy anywhere Club extra-team pricing appears so it shows $19/$190 instead of $20/$200.
- Add release notes or internal owner checklist covering required Stripe Dashboard setup.

Acceptance criteria:

- A coach can understand Team from public pricing, coach landing copy, and in-app help.
- An org owner can understand when to use Team add-ons versus Club.
- A platform admin or owner can verify all Stripe products/prices needed before launch.
- Help docs do not imply Team includes Tournament Plus features or formal tournament archiving.

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
- Should org Team add-on use the existing `rep_team` Stripe price or separate `org_team_addon` prices?
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
