# Plan & billing Stage 2 — owner walk

Prepared 2026-10-29. This is the browser/Stripe walk still owed after the automated checks in the plan's §9.
Use development or Stripe test mode, with owner-prepared fixtures; do not cancel, move, or purchase on production.

## The host and its doors

1. As a standalone workspace owner, open `/{slug}/coaches` on a desktop. The rail foot reads Help,
   Plan & billing, Admin, Collapse sidebar. Open Plan & billing: the address is `/{slug}/coaches/billing`,
   the header has its card icon and `?`, and the shared billing body stays inside Coaches Portal chrome.
2. At 390px, open More. The order is Notifications, team tools, You (Account, Home, Plan & billing, Admin),
   then the existing foot. Open billing: More stays active. Check the body and any window for overflow and 44px controls.
3. Repeat with several teams and a hosted tournament. Billing usage is workspace-wide. No team selector or tournament
   provider should be necessary to open billing. Close all seasons in an appropriate fixture: the team nav has only
   Season's End, while the billing foot/You row remains reachable.
4. In a standalone workspace with no live or closed assignments, open `/{slug}/coaches`. The not-ready wall has an
   owner-only lime Plan & billing door. Follow it; the billing page renders. Reload the billing address directly.
   Direct requests to Notifications and other coach paths still meet the zero-team wall.
   From the zero-team billing page, click Notifications too: the retained layout requests the server again and shows
   the wall, without mounting the notification screen. Going Back to billing remains valid.
5. As an admin/staff helper, check that neither nav has a billing row. With an assignment, typing the billing URL
   shows Billing access required, without money facts or controls. With zero assignments, the existing wall remains.
   Repeat the row check as a club-owned coach/club owner who coaches; Admin stays, billing is absent.
6. Open the `riverdale-ridge` demo: no Plan & billing row on either width.

## Recovery, messages and payment returns

| Fixture or action | Expected result |
|---|---|
| Cancelled standalone owner, including a direct billing URL | Subscription wall, Reactivate Premium → `/coaches/start?reactivateOrgSlug=…&teamName=…`; the same workspace returns. |
| Ended free-time owner | The free-time-ended wall, Keep Premium → the same reactivation path with `keep=1`. |
| Helper on either lapsed wall | No Reactivate/Keep Premium door. Identity and existing exits remain. |
| Payment-failed bell row for an active/trialing/past-due standalone owner | Coach billing address; button says Open Plan & billing. Existing old admin links retain Open in admin until Stage 3. |
| Owner's `/pricing` without another primary organization | Plan buttons lead to coach billing; the role summary's slug remains correct. |
| Stripe Payment method & invoices | Stripe return reaches coach billing. Cancel and plan-change are off in Stripe. The coach dev mock returns directly to billing; it cannot validate real card/invoice management. |
| Save card / cancel card setup | Coach billing with `card_saved=1` / coach billing without the success flag. |
| Next-season choice, including its cancel return | Coach billing with `next_season=1` / coach billing. Confirm the fading success and settled chooser. |
| Upgrade from the coach host, where available in the fixture | Real Monthly/Yearly payment step; checkout success/cancel both return to coach billing, with `success=1` only on success. Premium's shipped Change plan invitation remains unchanged. |
| Plan move where the fixture supports it | Shared move window stays in the host, or its checkout returns there. Premium has no new move option in Stage 2. |

Check empty payment method/invoice/fee states, loading, failed Stripe/read requests, fading success versus persistent
errors, past due, trial, free time running/last 14 days/ended, Founding Season comp, and cancellation. Use both widths.
The automated tests cover these shared-body states and captured callback addresses; this walk verifies their appearance
and actual Stripe/browser behavior. Existing tournament lock links still open the admin plan drawer on an ordinary click
and the admin billing address on a modified click. That remains intentional for Stage 3.

## Optional read-only UAT cases

The ordinary layout fixture measures the club coach's locked billing host, not a standalone owner's body. Owner-prepared
fixtures can exercise the added UAT cases with `UAT_COACH_BILLING_OWNER_SESSION` (default `org-owner.json`),
`UAT_COACH_BILLING_ORG_SLUG`, `UAT_COACH_BILLING_ZERO_TEAM_ORG_SLUG`, and
`UAT_COACH_BILLING_CANCELLED_ORG_SLUG`. Missing fixtures cause explicit skips. These cases create or mutate no fixtures.

Claude-side steps owed: `/simplify`, then `/review`, and `/docs`. Stage 3 removes the standalone Admin door and redirects
old admin billing links; Stage 5 finishes help content. Current host help reuses the shipped Premium first-login article.
