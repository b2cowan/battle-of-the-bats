# Launch Pricing Positioning

As of the pre-live marketing cleanup, Tournament and Tournament Plus are the only self-serve plans presented as available today.

League and Club remain visible on public marketing pages as coming-soon / early-access previews so prospects can see the broader FieldLogicHQ roadmap without being invited to buy unfinished tiers. Public module pages for House League, Rep Teams, and Accounting should use early-access CTAs until those workflows are ready for launch.

The authenticated billing page mirrors this posture by showing League and Club as coming soon, and `/api/billing/create-checkout` rejects League and Club checkout attempts server-side. Reopen self-serve checkout only when the product and support posture for those tiers is ready.

Early-access interest is captured through a reusable modal opened by Join Early Access CTAs. Submissions go to `/api/early-access` and are stored in `early_access_leads` with name, email, organization, role, sport/program, plan interest, feature interest, notes, notification consent, and source metadata.
