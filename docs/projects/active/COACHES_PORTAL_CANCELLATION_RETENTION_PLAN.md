# Coaches Portal cancellation — the email, and a real 365-day window

**Status:** BUILT 2026-09-24, not committed. Owner walk owed (see §4). PM brief:
[COACHES_PORTAL_CANCELLATION_RETENTION_PM_BRIEF.md](COACHES_PORTAL_CANCELLATION_RETENTION_PM_BRIEF.md).
Decision: `docs/agents/strategy/BUSINESS_DECISIONS.md` (2026-09-24, Coaches Portal retention window).

## 1. How it was found

Stripe cancels test-mode subscriptions 90 days after creation (`cancellation_details.reason =
canceled_by_retention_policy`). On 2026-09-24 it ended the owner's `toronto blue jays5` test
workspace, and the owner got the real Coaches Portal cancellation email. The pipe worked (webhook →
workspace `canceled` → owner emailed within a second); the email and the retention behind it did not.

## 2. Defects

| # | Defect | Fix |
|---|---|---|
| 1 | Name stuttered: "toronto blue jays5 Coaches Portal **Coaches Portal**" (subject + body). Workspace orgs are named `{team} Coaches Portal`; both senders passed the raw org name. | Both senders pass `teamWorkspaceDisplayName()`. |
| 2 | Resubscribe linked to bare `/coaches/start` — the NEW-portal signup. The reactivation door (`?reactivateOrgSlug=`) existed; only the billing page used it. | New `teamWorkspaceReactivatePath()` in `lib/coaches-portal-routes.ts`; email senders and the billing page all use it. |
| 3 | A Stripe-side end (`customer.subscription.deleted` on a workspace) recorded **no** retention — no deadline, no warning — while the email promised a "restore window". | `applyCoachesPortalStripeRetention()` in `lib/billing-retention.ts`, called from the webhook's workspace branch before the email. |
| 3a | The in-app cancel calls Stripe, whose `subscription.deleted` then re-emailed the owner — **two** cancellation emails per in-app cancel. | The webhook skips its email when the workspace is already retained — an unrestored account record carrying the Coaches Portal reason, at any age (see Review). |
| 3b | Platform-admin cancel of a workspace tagged its records `account_cancellation`, which reactivation does not restore — they would outlive a reactivation and later warn an active customer. | It now tags `coaches_portal_cancellation` + `teamWorkspaceId` for a workspace org. |

### Review (2026-09-24, `/review` high-risk, 4 lenses) — fixed in the same unit

| Finding | Fix |
|---|---|
| Platform-admin cancel with "notify owner" sent the generic ORG email to a Coaches Portal owner — doubled name, billing-page link. | It now sends the Coaches Portal email (name once, date, reactivation link). Guarded. |
| The Stripe helper's "already retained" check used a 7-day age window — a late re-send would re-retain and quote a second, later date. | No window: an unrestored account record carrying the Coaches Portal reason, at any age, means "already retained". |
| Platform-admin tagged the Coaches Portal reason only when the workspace row resolved — an untagged record gets the 14-day warning. | Tag by account kind. |
| Team name interpolated unescaped into the email HTML (pre-existing). | Escaped. |

**Carried, not fixed — Low:** two deliveries of the same Stripe event landing in the same instant can
both pass the check-then-act (duplicate records + two emails). Same shape as the pre-existing org
cancellation branch; closing it for both needs a DB constraint (account rows are exempt from the
active-retention unique index). **Pre-existing, Advisory:** an in-app cancel whose Stripe call fails
and is retried by the coach writes a second intent/account row.

## 3. The window (owner ruling 2026-09-24)

- Coaches Portal: **365 days**, warning **30 days** before (`COACHES_PORTAL_RETENTION_DAYS`,
  `COACHES_PORTAL_RETENTION_WARNING_DAYS`). Every other account: unchanged, 90 days / 14-day warning.
- `retentionDaysFor(org)` picks by account kind; used by the in-app and platform-admin cancels.
- Cancellation preflight (billing-page cancel dialog, platform-admin dialog) reads 365 for a workspace.
- The sweep (`processBillingRetentionExpiry`) fetches at the longest lead and filters per record by
  `metadata.retentionReason`. **The sweep is still manual** (platform-admin Retention → Process expiry); no cron.
- The cancelled email now states the date: "Your team is kept until **{date}**."

Guard: `tests/unit/coaches-portal-cancellation-guard.test.ts`.

## 4. Owner walk

1. Cancel a test Coaches Portal from its billing page. The dialog says **365 days**. One email arrives
   (not two): team name once, "kept until {date a year out}", Resubscribe opens "Reactivate Premium
   without starting over" with the team name filled.
2. Platform admin → Retention: the workspace row shows the year-out deadline.
3. Reactivate from the email link → the retention row flips to restored.

## 5. Not done / open

- `toronto blue jays5` (dev) was cancelled BEFORE this build — it has no retention row. Reactivate it,
  or leave it as the example of the old gap.
- Platform-admin cancel of a workspace still does not mark `team_workspaces` itself cancelled until
  Stripe's webhook confirms — and a comped portal with no Stripe subscription never gets one. Flagged,
  not fixed (separate defect).
- Help: DONE 2026-09-24 (`/docs`) — coach FAQ `faq-premium-cancel` (a year, reminder a month before,
  Resubscribe brings back the same team); platform-admin Retention SOP (both windows, Process expiry is
  manual), the cancel-subscription article, and `faq-delete-org-retention`. Org help unchanged (90 days is
  correct for orgs).
