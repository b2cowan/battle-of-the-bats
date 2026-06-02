# Coaches Portal Unified Product

As of 2026-05-25, the tournament coach portal and the standalone Team workspace are unified under one customer-facing product: **Coaches Portal**.

Product decision:

- Basic Coaches Portal is included for tournament team contacts. It shows tournament registrations, status, schedules, announcements, and historical tournament records.
- Premium Coaches Portal is the paid one-team workspace previously called Team, plus org-billed and Club-included coach access.
- Upgrading adds premium tools inside the same portal. Canceling paid access returns the coach to Basic tournament access, stops active premium tools, and archives premium data for 90 days so it can be restored on reactivation where possible.
- Public copy should use Coaches Portal, not Team. Internal technical names like `team_workspaces`, `team_entitlements`, `team_org_links`, and `team_workspace_claims` can remain until a deliberate technical rename is planned.

Canonical docs:

- `docs/projects/active/COACHES_PORTAL_UNIFIED_PROJECT_PLAN.md`
- `docs/projects/active/COACHES_PORTAL_UNIFIED_PM_BRIEF.md`

Implementation direction:

- `/coaches` becomes the product-level entry route.
- `/coaches/tournaments` replaces the idea of a separate `/my/registrations` product.
- Legacy paid coach/team signup routes should redirect or forward into the `/coaches` route family before launch.
- Existing `/{orgSlug}/coaches` implementation routes can remain for compatibility while the product-level IA is unified.
- 2026-05-25 implementation note: unified sign-in now uses a shared context resolver and `/home` for multi-context users. It composes existing org admin, tournament dashboard/list, scorekeeper, Coaches Portal Basic, and Coaches Portal Premium destinations instead of creating a duplicate tournament dashboard. `/auth/select-org` is now a compatibility redirect through the same auth-destination logic.
- 2026-05-25 product decision: Basic Coaches Portal should become team-centric. When a tournament coach creates/signs into a user, FieldLogicHQ should create or link a persistent Basic coach team profile. Future tournament registrations should let that coach select an existing team so tournament history accumulates under the team. Paid Premium upgrade should attach team-management tools to that same team identity instead of creating unrelated history.
- 2026-05-25 Phase 2B implementation: migration `091_basic_coach_team_profiles.sql` adds Basic coach team profiles, user links, registration links, backfill from verified auth email + team name, and `team_workspaces.basic_coach_team_id`. `/api/coaches/basic-teams` mediates list/link access server-side. `/coaches/join` now links the saved registration after account creation/sign-in, returning signed-in coaches can choose an existing Basic team or create a new one, and `/coaches/tournaments` groups tournament history by explicit Basic team links only. Follow-up migration `092_basic_coach_team_explicit_access_only.sql` removes the unused email-fallback link source because the product is not live.
- 2026-05-25 Phase 3 first slice: `/coaches` is now a coach-specific portal home with Basic tournament records and Premium workspace cards from the shared context resolver. `/coaches/teams` lists Premium Coaches Portal workspaces only and links into the existing org-scoped premium dashboards. This intentionally does not duplicate the broader `/home` context switcher.
- 2026-05-25 Phase 3 completion: Premium team overview now includes linked Basic tournament history through `/api/coaches/[orgSlug]/teams/[teamId]/tournament-history`. The route requires active team entitlement plus active coach assignment, reads only explicit Basic team links, and can repair a missing `team_workspaces.basic_coach_team_id` from the workspace source tournament registration. Basic tournament pages hide paid Coaches Portal upgrade CTAs when the signed-in coach already has active Premium access.
- 2026-05-25 Phase 4 first slice: Coaches Portal billing/cancellation is split from full organization cancellation. Team-workspace billing copy now says Coaches Portal billing, direct Premium cancellation cancels `team_workspaces` and `team_entitlements`, writes 90-day retention records, keeps Basic tournament records available, and shows Basic records plus Reactivate Premium in the canceled state. User access contexts only count Premium access when the subscription is active, trialing, or past-due; canceled Premium workspaces no longer appear as active Premium entries.
- 2026-05-25 Phase 4 reactivation slice: the canceled billing page sends `/coaches/start` a `reactivateOrgSlug` marker. Mock and Stripe Coaches Portal checkout metadata now use that marker to restore the existing canceled `team_workspaces` row, update the existing org/subscription/entitlement state, restore retained Coaches Portal records, and avoid creating duplicate Premium workspaces. `past_due` remains an active Premium access state for grace-period handling; `canceled` remains inactive Premium with Basic tournament fallback.
- 2026-05-29 billing shelf rule: Coaches Portal, League, and Club are adjacent products for distinct user types, not higher/lower steps in one subscription ladder. The only true self-serve upgrade is Tournament -> Tournament Plus; Tournament Plus can downgrade back to Tournament. Free Tournament and Tournament Plus orgs should both see Coaches Portal under "Managing more than tournaments?" as a separate workspace option.

Access rules:

- Tournament-only coaches get Basic Coaches Portal from tournament registration identity.
- Paid standalone, org-billed, and Club coaches get Premium Coaches Portal through team-scoped entitlement plus coach assignment.
- Linked-org Basic sharing must not expose roster, documents, accounting, billing, ownership, or org-wide rep-team admin access.
- Do not query team workspace foundation tables from a client Supabase instance until explicit RLS policies are written.
- Org admin navigation and the org dashboard only show the personal Coaches Portal shortcut when the signed-in user has a coach assignment in that same org. Coach access in another org must appear as a separate `/home` context.
