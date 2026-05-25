# Coaches Portal Unified Product Plan

**Created:** 2026-05-25  
**Status:** Active canonical plan  
**PM brief:** `docs/active/COACHES_PORTAL_UNIFIED_PM_BRIEF.md`

## Product Decision

FieldLogicHQ will ship one **Coaches Portal**.

The tournament participant portal and the paid standalone Team workspace are not separate products. They are entitlement states inside the same coach-owned portal:

- **Basic Coaches Portal:** free access created through tournament registration. It keeps persistent coach team profiles, tournament registrations, status, schedule, announcements, and historical tournament records.
- **Premium Coaches Portal:** paid standalone Coaches Portal, org-billed Coaches Portal add-on, or Club-included coach access. It adds the rep-team operating tools already built for Team workspaces.

Public naming changes from **Team** to **Coaches Portal**. Internal technical names such as `team_workspaces`, `team_entitlements`, `team_org_links`, and `team_workspace_claims` can remain until a technical rename is worth the migration cost.

## Source Docs Reviewed And Merged

| Source | Disposition |
| --- | --- |
| `docs/active/TOURNAMENT_COACH_PORTAL_PLAN.md` | Shipped baseline. `/my/join`, `/my/registrations`, auth routing, email updates, and resend access are already implemented and must be treated as existing foundation work. |
| `docs/archive/TOURNAMENT_COACH_PORTAL_PLAN.md` | Earlier draft source. Merged, but superseded by the active completed implementation record above. |
| `docs/archive/TOURNAMENT_COACH_PORTAL_PM_BRIEF.md` | Merged into the unified PM brief. |
| `docs/archive/codex_STANDALONE_TEAM_IMPLEMENTATION_PLAN.md` | Merged. Existing Team workspace implementation becomes Premium Coaches Portal entitlement. |
| `docs/archive/codex_STANDALONE_TEAM_PM_BRIEF.md` | Merged into the unified PM brief. |
| `docs/archive/codex_STANDALONE_TEAM_LAUNCH_CHECKLIST.md` | Merged into the launch readiness section below. |
| `docs/archive/codex_COACHES_STANDALONE_RESEARCH.md` | Merged as research context for pricing, packaging, and V1 feature priorities. |
| `docs/active/BRAND_STRATEGY.md` | Remains active brand source; updated to point at the unified Coaches Portal. |
| `docs/active/PRICING_PAGE_COPY.md` | Remains active pricing copy; updated to treat Coaches Portal as the single product name and route target. |
| `docs/active/DB_ARCHITECTURE_REVIEW.md` | Relevant advisory retained: team workspace foundation tables are service-role mediated until explicit client RLS policies are written. |
| Public/owner tournament mobile docs | Adjacent dependencies. Registration and admin UX should align with this plan, but those docs remain separate projects. |

## Existing Tournament Coach Portal Implementation

The tournament-only portal work is already shipped as of 2026-05-25 and should not be rebuilt from scratch.

Implemented foundation:

- `/my/join` creates or signs in coach accounts after tournament registration is saved.
- `/api/auth/coach-signup` creates auth users without creating a normal organization.
- `proxy.ts` protects `/my/*` while leaving `/my/join` public.
- `/my/registrations` lists tournament registrations by coach email.
- `/my/registrations/[teamId]` shows registration status, details, schedule, announcements, and CTAs.
- `lib/auth-destination.ts` routes no-org users with tournament registrations to `/my/registrations`.
- `app/auth/select-org/page.tsx` shows Tournament Registrations for users who also have org memberships.
- Registration confirmation and acceptance emails now point coaches toward the dashboard.
- Tournament admin workspace sales invites were removed and replaced with per-registration resend access.

Implementation consequence:

- Phase 2 below is not a greenfield build. It is a migration/refinement phase that folds the existing pages into the canonical `/coaches/tournaments` route.
- Phase 5 admin/email cleanup is largely complete and should be verified rather than rebuilt.
- Any future implementation should preserve the working account creation, auth destination, email, and resend-access behavior while moving the customer-facing routes into `/coaches`.

## Locked Migration Decisions

| Area | Already shipped | Locked target |
| --- | --- | --- |
| Basic tournament route | `/my/registrations` and `/my/registrations/[teamId]` | `/coaches/tournaments` and `/coaches/tournaments/[registrationId]`; current `/my` paths become redirects or compatibility aliases. |
| Account step route | `/my/join` | `/coaches/join`; keep the current route only as a redirect or compatibility alias. |
| Paid CTA target | Legacy paid team signup route | `/coaches/start`; remove the legacy route from customer-facing links. |
| Product naming in code/help | Some existing implementation still says Team | Customer-facing copy says Coaches Portal. Technical table names may remain until a separate migration is approved. |
| Admin invite model | Bulk workspace invite removed; resend access implemented | Keep resend access only. Verify adjacent mobile/admin docs no longer treat Workspace Invite as an active action. |
| Paid availability | Existing paid checkout path exists | Keep public paid Coaches Portal signup gated until Stripe, cancellation, retention, and mobile checks pass. |

## Unified Customer Journey

### 1. First Tournament

1. Coach registers a team for a tournament.
2. Registration is saved immediately.
3. Coach creates a FieldLogicHQ account or signs in.
4. FieldLogicHQ creates or links a persistent Basic coach team profile for that coach and team.
5. The tournament registration is attached to that persistent team profile.
6. Coach lands in Coaches Portal and sees that team with the first tournament registration under it.
7. Confirmation and acceptance emails link back to Coaches Portal.

### 2. Returning Tournament Coach

1. Coach signs in during registration for another tournament.
2. Coach selects an existing team profile or creates a new one.
3. The new tournament registration is attached to the selected team profile.
4. Coaches Portal shows that team once, with all active and historical tournament records underneath it.

### 3. Upgrade To Premium Coaches Portal

1. Coach sees the premium CTA after they have received value from tournament status/schedule/results.
2. Coach starts a paid Coaches Portal subscription or activates through an org-paid/Club path.
3. The portal gains premium navigation and tools without losing tournament history.
4. Source tournament/team IDs are retained where a premium workspace came from tournament participation.

### 4. Cancellation Or Payment Failure

1. Paid entitlement becomes canceled, expired, or past due according to billing state.
2. Premium tools are no longer actively available.
3. Premium workspace data is archived for the same 90-day retention window used for canceled Tournament accounts.
4. Basic tournament records remain available in the same Coaches Portal.
5. Reactivation during the 90-day retention window restores the archived premium workspace where possible instead of creating a duplicate.

## Entitlement Model

### Basic Coaches Portal

Basic access is granted by tournament participation.

Identity rule:

- Add a persistent Basic coach team profile for tournament participants.
- Add explicit links between auth users, Basic coach team profiles, and tournament `teams` registration records.
- Use tournament registration email only during the account/linking step, before the explicit Basic team link exists.
- Do not render Coaches Portal records from email matching alone. The product is not live yet, so explicit Basic team links are the only portal access source.
- Let returning coaches select an existing team during registration so the same team can accumulate tournament history across events.
- Keep the Basic team profile distinct from paid premium workspace entitlement until upgrade; on upgrade, attach or convert the Basic profile to the Premium Coaches Portal workspace so history remains intact.

Basic portal includes:

- All current and historical tournament registrations tied to the coach's team profiles.
- A team-first view that lets a coach see each team once, then drill into the tournaments that team has entered.
- Status: pending, accepted, waitlist, rejected, completed/archived.
- Tournament facts: name, dates, location, organization, division.
- Coach's own schedule once published.
- Tournament announcements where appropriate.
- Payment/status notes where already available.
- Links back to public tournament pages.
- Premium Coaches Portal and Tournament hosting CTAs.

Basic portal does not include:

- Roster management.
- Team documents.
- Player dues or budget.
- Attendance and lineup tools.
- Parent portal or player accounts.
- Tournament Plus organizer features.

### Premium Coaches Portal

Premium access is granted by one of these sources:

- Direct paid Coaches Portal subscription for one team.
- Org-billed Coaches Portal add-on for a linked team.
- Club-included or Club extra team entitlement.
- Platform override for support, trial, or migration.

Existing implementation that should be preserved:

- Lightweight workspace org behind standalone workspaces.
- `team_workspaces` as the product/workspace anchor.
- `team_entitlements` for team-scoped access.
- `team_org_links` for Basic org visibility, billing transfer, and ownership transfer.
- Program years as the season boundary.
- Coaches Portal access requiring both active entitlement and active coach assignment for standalone workspaces.

Premium portal includes:

- Team dashboard.
- Roster with jersey and position fields.
- Schedule and event management.
- Attendance.
- Baseball/softball lineup builder and PDF export.
- Dues, budget, expenses, and reminders.
- Documents.
- Season setup checklist.
- Season history.
- Link organization and billing transfer flows.
- One non-archived Tournament-level local event slot, without Tournament Plus features.

## Naming And Routing

### Canonical Public Product Name

Use **Coaches Portal** in customer-facing copy.

Avoid public use of:

- Team plan
- Standalone Team
- Team subscription
- Team workspace, except in support/internal contexts

Acceptable internal wording:

- "technical team workspace"
- "`team_workspaces` record"
- "team-scoped entitlement"

### Canonical Routes

Target route family:

| Route | Purpose |
| --- | --- |
| `/coaches` | Coaches Portal home/dashboard. |
| `/coaches/tournaments` | Basic tournament records across all organizations. |
| `/coaches/tournaments/[registrationId]` | Tournament registration detail. |
| `/coaches/teams` | Premium team workspace list/selector when the coach has premium access. |
| `/coaches/teams/[teamWorkspaceId]` | Premium team dashboard entry. |
| `/coaches/billing` | Coach-owned billing and cancellation/reactivation. |
| `/coaches/link-org` | Parent organization link and billing transfer entry. |
| `/coaches/start` | Paid Coaches Portal signup/start page. |
| `/coaches/join` | Lightweight account creation/sign-in step after tournament registration. |

Compatibility rules:

- Legacy paid team signup and claim routes should redirect or forward into the `/coaches` route family before public launch.
- Existing `/{orgSlug}/coaches/...` routes can remain as implementation compatibility for org-scoped and workspace-scoped views, but the product-level entry point should be `/coaches`.
- Fold the shipped `/my` implementation into `/coaches` or redirect it before launch. The user should not perceive a separate "my registrations" product.

## Portal IA And UX Rules

The first screen should adapt to the coach's entitlement state:

| State | First screen |
| --- | --- |
| Tournament-only | Tournament registrations and status cards, plus contextual upgrade CTAs. |
| Premium with one team | Team dashboard with a visible tournament history area. |
| Premium with multiple teams/roles | Team selector plus current tournaments and alerts. |
| Canceled premium | Basic tournament records plus a reactivation prompt; premium workspace data archived during the 90-day retention window. |

Navigation should keep tournament records available for every coach, including premium and canceled users.

Upgrade CTAs:

- Show the paid Coaches Portal CTA after accepted registrations and post-event moments.
- Keep the Tournament hosting CTA lower weight and always platform-owned.
- Suppress paid Coaches Portal CTAs when the coach already has active premium access.
- Suppress Tournament hosting CTAs when the coach already has an organizer/org account with tournament access.

Admin rule:

- Tournament organizers can resend dashboard access links.
- Tournament organizers should not send bulk paid Coaches Portal sales invites from registration admin.

## Implementation Phases

### Phase 0 - Documentation And Product Alignment

- [x] Create unified Coaches Portal PM brief.
- [x] Create unified Coaches Portal project plan.
- [x] Archive or supersede separate Tournament Coach Portal and Standalone Team docs.
- [x] Update `TODO.md` to point to this project.
- [x] Update memory with the unified product decision.
- [x] Update active brand/pricing docs so "Team" is no longer the public product.

Acceptance criteria:

- Active planning has one canonical Coaches Portal project.
- Historical source docs remain available in archive.

### Phase 1 - Naming And Route Migration

Goal: make the product feel like one portal before adding more behavior.

Tasks:

- [x] Establish `/coaches` as the product-level entry route.
- [x] Move or wrap the shipped `/my/registrations` implementation under `/coaches/tournaments` instead of rebuilding it.
- [x] Move or wrap the shipped `/my/join` implementation under `/coaches/join`.
- [x] Redirect current `/my` routes into their `/coaches` equivalents.
- [x] Redirect legacy paid coach/team signup, claim, and checkout completion routes into the `/coaches` route family.
- [x] Audit public navigation, footer, pricing, tournament emails, help docs, and CTAs for "Team" public copy.
- [x] Keep technical table/helper names stable unless there is a separate migration plan.
- [x] Update auth destination routing so coaches with tournament records but no org land in Coaches Portal.
- [x] Add Coaches Portal entry to org/account selection for users with both org memberships and coach records.

Acceptance criteria:

- A coach never has to choose between a tournament portal and a paid team portal.
- Existing paid workspace routes still work during the transition.

### Phase 2 - Basic Tournament Records Inside Coaches Portal

Goal: preserve the shipped tournament-only coach view and make it feel like Basic Coaches Portal.

Tasks:

- [x] Save registration before account creation/sign-in.
- [x] Redirect new tournament coaches to lightweight account creation after registration.
- [x] Build the current registration list using authenticated coach email at `/my/registrations`.
- [x] Build the current registration detail view with status, registration facts, schedule, announcements, contact, and CTAs.
- [x] Show active/upcoming registrations first and historical registrations below.
- [x] Return 404 for registrations that do not belong to the signed-in coach.
- [x] Add empty state for coaches with no registrations.
- [ ] Move, alias, or redirect this shipped experience into `/coaches/tournaments`.
- [ ] Add a cleaner `not-found.tsx` under the registration detail route.
- [x] Add a `/my` index redirect to `/coaches/tournaments`.

Acceptance criteria:

- First tournament registration creates a persistent coach relationship.
- Second tournament registration appears in the same portal.
- Historical tournament records remain visible after events complete.

### Phase 2B - Team-Centric Basic Coaches Portal

Goal: replace the temporary registration-by-email model with persistent coach-owned team profiles that can carry tournament history and later upgrade into Premium Coaches Portal tools.

Tasks:

- [x] Add a Basic coach team identity model, likely as a lightweight table separate from paid `team_workspaces` until upgrade.
- [x] Add explicit links from auth users to Basic coach team profiles.
- [x] Add explicit links from Basic coach team profiles to tournament `teams` registration records.
- [x] Backfill existing tournament coach access by grouping current registration records by verified coach email and team identity, creating explicit Basic team and registration links.
- [x] Update first-time tournament registration account creation so creating/signing into a user also creates or links the submitted team profile.
- [x] Update returning-coach tournament registration so signed-in coaches can select an existing team or create a new team before completing registration.
- [x] Update `/coaches/tournaments` into a team-first Basic portal view: team cards first, tournament registrations under each team, active events before historical records.
- [x] Ensure a paid Coaches Portal upgrade attaches premium workspace access to the same Basic team identity instead of creating an unrelated team record.
- [x] Add future hooks for a tournament directory where coaches can register existing teams into listed tournaments.

Implementation note, 2026-05-25:

- Migration `091_basic_coach_team_profiles.sql` adds `basic_coach_teams`, `basic_coach_team_users`, `basic_coach_team_registrations`, and `team_workspaces.basic_coach_team_id`.
- `/api/coaches/basic-teams` is the server-mediated link/list endpoint for Basic team profiles; client Supabase still does not query these tables directly.
- `/coaches/join` links the saved tournament registration after account creation/sign-in. New accounts auto-create the Basic team; returning accounts can select an existing team or create a new one.
- Public tournament registration shows an existing/new Basic team selector for signed-in coaches and immediately links the submitted registration when the signed-in email matches the registration email.
- `/coaches/tournaments` now renders team-first groups from explicit Basic team links only.
- Premium provisioning now carries `basic_coach_team_id` forward when the upgrade originates from a linked tournament registration.
- Follow-up migration `092_basic_coach_team_explicit_access_only.sql` removes the unused `email_fallback` link source from the database constraint.

Manual browser test script to run before launch:

1. Register a tournament team as a new coach and confirm the saved registration sends the coach to `/coaches/join` with the registration id.
2. Create the coach account and confirm `/coaches/tournaments` shows one Basic team with one tournament record.
3. Sign in as the same coach before another tournament registration and select the existing Basic team.
4. Confirm `/coaches/tournaments` shows one Basic team with two tournament records.
5. Register a different team as the same coach and choose `New Team`.
6. Confirm `/coaches/tournaments` shows two separate Basic team profiles.
7. Try opening a registration detail while signed in as a different coach and confirm it returns the not-found state.
8. Upgrade from a linked tournament registration and confirm `team_workspaces.basic_coach_team_id` is populated.

Acceptance criteria:

- A coach can register one team for a tournament, create/sign into their user, and see one Basic team with one tournament record.
- The same coach can register that same team for another tournament by selecting the existing team and then see one team with two tournament records.
- Registering a different team creates a separate Basic team profile under the same coach account.
- Upgrading a Basic team to Premium keeps the same tournament history visible in the same Coaches Portal.
- Email matching is no longer the only source of access for new registrations after this phase ships.

### Phase 3 - Unified Premium Workspace Experience

Goal: premium tools appear in the same portal, not a separate product.

Tasks:

- [x] Add entitlement-aware portal shell that shows basic and premium sections from one navigation model.
- [x] Surface premium workspace cards for direct, org-billed, and Club coach access.
- [ ] Preserve tournament history in premium dashboards.
- [ ] Connect tournament-claimed premium workspace history to the Basic tournament records view.
- [ ] Confirm Team entitlement checks still require active entitlement plus active coach assignment.
- [ ] Confirm linked-org Basic visibility does not expose roster, documents, accounting, billing, or org-wide rep-team admin access.

Implementation note, 2026-05-25:

- `/coaches` now acts as the coach-specific portal home. It shows Basic tournament records and Premium Coaches Portal workspace entries from the existing user context resolver, without duplicating the broader `/home` account switcher.
- `/coaches/teams` lists Premium Coaches Portal workspaces only and links through to the existing org-scoped premium dashboards.

Acceptance criteria:

- Upgrading adds features in place.
- Club coaches and standalone paid coaches use the same Coaches Portal language.
- Tournament history remains visible to every coach state.

### Phase 4 - Billing, Upgrade, Cancellation, And Reactivation

Goal: make the subscription lifecycle match the promised customer journey.

Tasks:

- [ ] Rename public billing surfaces from Team to Coaches Portal.
- [ ] Keep direct paid price at CAD $29/month and CAD $290/season unless owner changes pricing.
- [ ] Keep org-billed Coaches Portal add-on at CAD $29/month and CAD $290/season.
- [ ] Keep Club extra team at CAD $19/month and CAD $190/year.
- [ ] On cancellation, downgrade coach to Basic Coaches Portal while preserving tournament records.
- [ ] Archive premium workspace data for 90 days, matching canceled Tournament account retention.
- [ ] Disable active premium tools during the canceled state; show reactivation messaging instead.
- [ ] Simulate direct cancellation and payment failure and confirm entitlement status changes.
- [ ] Ensure reactivation during the 90-day retention window restores the archived workspace where possible instead of creating duplicates.

Acceptance criteria:

- Canceling paid Coaches Portal never deletes tournament history.
- Canceling paid Coaches Portal makes premium tools unavailable and archives premium data for 90 days.
- Billing and entitlement state stay synchronized.
- Reactivation is understandable and supportable.

### Phase 5 - Admin And Email Cleanup

Goal: keep organizers out of product-selling flows while improving coach access support.

Tasks:

- [x] Remove or keep removed the tournament admin bulk workspace invite action.
- [x] Replace paid workspace invite action with a single-registration "Resend access link".
- [x] Update registration confirmation email to point at coach account creation/sign-in.
- [x] Update acceptance email to point at the coach dashboard instead of public team profile only.
- [ ] Update post-event emails to preserve Coaches Portal upgrade CTA.
- [ ] Ensure secure paid claim links remain email-only where needed.

Acceptance criteria:

- Tournament admins can help a coach regain access.
- Platform-owned CTAs drive paid Coaches Portal upgrade.

### Phase 6 - Marketing, Pricing, Help, And Brand

Goal: public copy matches the unified product.

Tasks:

- [x] Update pricing copy to use Coaches Portal as the product name.
- [x] Present the free/basic tournament record view as included for tournament participants.
- [x] Present paid Coaches Portal as the premium team operating workspace.
- [x] Rename legacy paid coach/team marketing, signup, help, and admin-support language to Coaches Portal.
- [x] Update help docs for tournament-only, paid standalone, org-billed, Club coach, cancellation, and org-link states.
- [ ] Keep "Less admin. More sport." and the existing brand rules.

Acceptance criteria:

- Coaches do not see "Team" as a separate paid product.
- Public copy explains that tournament history carries forward.
- Club copy still makes the multi-team operating layer more valuable than many individual paid coach subscriptions.

### Phase 7 - Launch Verification

Manual and automated checks:

- [ ] Register tournament team as a new coach and land in Coaches Portal Basic.
- [ ] Register second tournament with same coach, select the existing team, and see both registrations under that team.
- [ ] Register a different team with the same coach and confirm it appears as a separate Coaches Portal team context.
- [ ] Verify accepted registration shows premium Coaches Portal CTA.
- [ ] Upgrade from a tournament registration into premium Coaches Portal and keep tournament history.
- [ ] Direct paid Coaches Portal checkout provisions premium entitlement.
- [ ] Org-billed Coaches Portal add-on preserves Basic sharing boundaries.
- [ ] Club coach access works through the same portal language.
- [ ] Cancel direct paid Coaches Portal and confirm fallback to Basic plus archived premium data.
- [ ] Payment failure updates entitlement state and portal messaging.
- [ ] Mobile visual sign-off for registration, Coaches Portal home, tournament detail, team overview, attendance, and lineups.
- [ ] Platform Admin readiness confirms Stripe price rows and webhook/app URL setup.

## Data And Security Notes

- Do not query `team_workspaces`, `team_entitlements`, `team_org_links`, or `team_workspace_claims` directly from client Supabase until explicit RLS policies exist.
- Basic tournament record access should not expose another coach's data through predictable IDs.
- Basic portal should not expose player documents, medical information, parent contact data, or team financial detail.
- Linked org Basic sharing remains limited to team identity, coach contact, season, tournament history, and roster count unless a higher sharing level is explicitly approved.
- Ownership transfer remains platform-assisted unless a separate self-serve migration plan is approved.

## Launch Checklist

Stripe and price rows:

- [ ] Sandbox direct Coaches Portal monthly price: CAD $29.
- [ ] Sandbox direct Coaches Portal annual/seasonal price: CAD $290.
- [ ] Live direct Coaches Portal monthly price: CAD $29.
- [ ] Live direct Coaches Portal annual/seasonal price: CAD $290.
- [ ] Sandbox org-billed Coaches Portal add-on monthly price: CAD $29.
- [ ] Sandbox org-billed Coaches Portal add-on annual/seasonal price: CAD $290.
- [ ] Live org-billed Coaches Portal add-on monthly price: CAD $29.
- [ ] Live org-billed Coaches Portal add-on annual/seasonal price: CAD $290.
- [ ] Sandbox and live Club extra rep team price: CAD $19/month and CAD $190/year.
- [ ] FieldLogicHQ Stripe price rows are populated for direct, org-billed, and Club extra-team billing.
- [ ] Old CAD $20/$200 Club extra-team price IDs are not reused.

Customer-facing readiness:

- [ ] Pricing, brand, help, and emails say Coaches Portal.
- [x] Coaches Portal help explains tournament-only Basic access.
- [x] Coaches Portal help explains premium tools, season rollover, org linking, billing transfer, ownership transfer, and cancellation fallback.
- [x] Coaches Portal help explains the 90-day cancellation retention window and reactivation recovery path.
- [x] Organization help explains org-billed Coaches Portal add-ons versus Club.
- [x] Platform-admin help explains readiness checks and support workflows.

## Resolved Decisions And Remaining Questions

- Resolved by shipped Tournament Coach Portal work: save registration first, then redirect to lightweight account creation/sign-in so no registration is lost.
- Resolved by product owner: all public coach routes move into `/coaches`; current `/my` routes become redirects or compatibility aliases.
- Resolved by product owner: remove legacy paid coach/team route references from customer-facing links and use `/coaches`.
- Resolved by product owner: paid Coaches Portal remains gated until Stripe, cancellation, retention, and mobile launch checks pass.
- Resolved by product owner: cancellation follows the Tournament-style model. Premium tools stop being actively available, premium data is archived for 90 days, and reactivation restores it during that window where possible.
- Resolved by product owner, 2026-05-25: product is not live, so Basic tournament access should not stay email-derived. Explicit Basic team links are required before records appear in Coaches Portal.
- Should the Basic team profile table be named and modeled as its own lightweight entity, or should it reuse `team_workspaces` from day one? Recommendation: keep Basic profiles separate and attach a `team_workspace` only when Premium is activated, because `team_workspaces` currently represents paid/team-management entitlement and provisioning.
- Should Basic teams support multiple coaches in the first team-centric release? Recommendation: design the link table for multiple coaches but launch with the registering coach as primary owner until delegated access UX is ready.
- Should duplicate team detection be automatic? Recommendation: avoid fuzzy auto-merge in the first release; let signed-in coaches explicitly select an existing team during registration.

## Final Recommendation

Build the coach experience as one portal with two states: Basic tournament history and Premium team operations. This matches the natural tournament acquisition path, preserves the work already completed for technical team workspaces, and makes cancellation behavior clean: the coach loses active paid tools, not their FieldLogicHQ identity or tournament record; premium data is archived for 90 days.
