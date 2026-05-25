# Coaches Portal Unified Product

As of 2026-05-25, the tournament coach portal and the standalone Team workspace are unified under one customer-facing product: **Coaches Portal**.

Product decision:

- Basic Coaches Portal is included for tournament team contacts. It shows tournament registrations, status, schedules, announcements, and historical tournament records.
- Premium Coaches Portal is the paid one-team workspace previously called Team, plus org-billed and Club-included coach access.
- Upgrading adds premium tools inside the same portal. Canceling paid access returns the coach to Basic tournament access, stops active premium tools, and archives premium data for 90 days so it can be restored on reactivation where possible.
- Public copy should use Coaches Portal, not Team. Internal technical names like `team_workspaces`, `team_entitlements`, `team_org_links`, and `team_workspace_claims` can remain until a deliberate technical rename is planned.

Canonical docs:

- `docs/active/COACHES_PORTAL_UNIFIED_PROJECT_PLAN.md`
- `docs/active/COACHES_PORTAL_UNIFIED_PM_BRIEF.md`

Implementation direction:

- `/coaches` becomes the product-level entry route.
- `/coaches/tournaments` replaces the idea of a separate `/my/registrations` product.
- Legacy paid coach/team signup routes should redirect or forward into the `/coaches` route family before launch.
- Existing `/{orgSlug}/coaches` implementation routes can remain for compatibility while the product-level IA is unified.

Access rules:

- Tournament-only coaches get Basic Coaches Portal from tournament registration identity.
- Paid standalone, org-billed, and Club coaches get Premium Coaches Portal through team-scoped entitlement plus coach assignment.
- Linked-org Basic sharing must not expose roster, documents, accounting, billing, ownership, or org-wide rep-team admin access.
- Do not query team workspace foundation tables from a client Supabase instance until explicit RLS policies are written.
