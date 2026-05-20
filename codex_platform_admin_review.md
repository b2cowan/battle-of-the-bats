# Platform Admin Review

## Review Scope

This review covers the current platform admin surface as a product and operations area: navigation, overview metrics, organization list/detail, platform users, early-access leads, retention queue, audit log, and plans/pricing controls.

The strongest existing foundations are:

- Organization lookup and detail pages.
- Plan and entitlement visibility.
- Subscription overrides and module toggles.
- Internal organization notes.
- Platform audit log.
- Early-access lead pipeline.
- Retention queue.
- Runtime plan, trial, and Stripe price controls.

## Recommended Information Architecture

The current sidebar is flat: Overview, Organizations, Plans & Pricing, Early Access, Retention, Users, Audit Log, Help. A more scalable structure would group pages by operator workflow:

- **Command Center**: Overview, alerts, recent activity, support queue.
- **Customers**: Organizations, org users, support cases, retention/recovery.
- **Growth & Metrics**: Early access, marketing funnel, plan adoption, conversions.
- **Billing & Product**: Plans, pricing, add-ons, Stripe config, feature gates.
- **System & Security**: Platform users, audit log, dev tools, settings.

Rename `/platform-admin/users` to **Platform Users** or **Staff Users**. Today it manages internal company admins, while "Users" sounds like customer or organization users.

## Internal Support Improvements

Org detail is already a good starting point because it shows identity, plan/entitlements, overrides, modules, members, tournaments, and internal notes. It should become a full support workspace.

Recommended additions:

- Global user search by email, name, Supabase user id, organization, role, and last sign-in.
- Dedicated organization **Support Summary** with owner, billing contact, active modules, current plan, Stripe customer/subscription ids, onboarding state, latest admin activity, recent errors, recent billing events.
- User actions: generate password reset, resend invite/confirmation, deactivate org member, change role, transfer ownership, unlock account, and view membership history.
- Guarded "support access" or "view as org admin" flow with required reason, time limit, visible banner, and audit trail.
- Support cases/tags such as onboarding issue, billing issue, churn risk, data restore, and product feedback.
- Organization timeline combining audit log, billing events, plan changes, notes, early-access conversion, and retention events.

One concrete gap: there is already a reset-link API at `app/api/platform-admin/users/[id]/reset/route.ts`, but it does not appear to be surfaced in the platform admin UI.

## Metrics And Tracking

The current overview tracks total organizations, auth users, tournaments, teams, past-due organizations, and new organizations in the last seven days. This should evolve into a real metrics dashboard.

Recommended metrics:

- Plan mix: organizations per plan, active/trialing/past due/canceled per plan.
- Revenue proxy: MRR/ARR by plan and billing period once Stripe subscription data is reliable.
- Churn: cancellations in last 7/30/90 days, downgrades, reactivations, and past-due recovery rate.
- Growth funnel: early-access leads, qualified leads, pilots, converted organizations, conversion by plan interest.
- Product usage: active tournaments, archived tournaments, registrations, teams, house-league seasons, public-site usage, accounting usage, rep-team usage.
- Health: inactive organizations, organizations with no owner sign-in recently, trials ending soon, unpaid/past-due accounts, expired overrides.
- Cohorts: organizations created by month, retention by cohort, activation milestones completed.

Avoid computing every metric only from current row state. Add daily metric snapshots and durable event tracking so cancellation history, plan transitions, marketing attribution, and conversion paths are not lost when the current organization row changes.

## Product And Pricing Planning

Plans & Pricing already combines availability, limits/trials, and Stripe price IDs. It should evolve into a product catalog and release-control area.

Recommended additions:

- Draft and published plan versions with scheduled effective dates.
- Feature matrix editor for module entitlements, not only numeric limits.
- Add-on catalog: public site, accounting, rep teams, extra teams, support packages.
- Price-change impact preview: affected organizations, active subscriptions, and estimated MRR delta.
- Grandfathering rules for existing organizations.
- Coupon, promo, and trial campaigns.
- Sandbox/live Stripe validation: confirm `price_` exists, product names match, currency/interval match expectations.
- Approval workflow for live pricing changes.

Plan config, plan gating, Stripe prices, and company user changes should be consistently audit-logged. Some organization actions already write to the platform audit log, but pricing and platform-user APIs should do the same.

## Robustness Recommendations

Add role-based platform admin permissions:

- Support
- Billing
- Product
- Growth
- Security
- Super admin

Current platform auth appears to be active platform user or bootstrap admin, which is simple but too broad as the admin area gains higher-risk actions.

Fix override semantics. The override API writes directly to `organizations.subscription_status`, while the help text describes overrides as separate from the underlying billing record. Revoking an override marks it revoked but does not restore the previous Stripe-derived status. A safer model would split `billing_subscription_status` and `effective_subscription_status`, or compute effective status from Stripe/base status plus active overrides.

Add a true customer user directory. Org detail currently fetches a limited Supabase auth user page to map member emails, and overview user count also uses a fixed page size. That will become inaccurate as the platform grows.

Update platform help. It says there is no self-serve platform user invite flow, but the UI now has "Add User" and the API creates platform users. That mismatch can confuse future operators.

Add saved filters, CSV exports, bulk actions, alert badges, and recent-changes panels. Platform admin tools become much more useful when support can quickly answer:

- Who is affected?
- What changed recently?
- Who did it?
- What should I do next?

## Suggested Priority

1. **Support foundation**: global user search, support summary, reset links, support timeline, better org/member actions.
2. **Operational metrics**: plan mix, churn, trials, past due, usage, early-access conversion.
3. **Billing/product safety**: audit all product/pricing changes, validate Stripe prices, separate billing status from effective override status.
4. **Information architecture**: reorganize nav into workflow groups and rename ambiguous sections.
5. **Advanced product planning**: versioned plan catalog, add-on management, grandfathering, campaign/promotional tooling.
