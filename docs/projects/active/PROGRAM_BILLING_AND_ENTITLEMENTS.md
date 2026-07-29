# Program — Billing, Plans & Entitlements

> **Consolidated 2026-07-28.** Replaces 17 billing/pricing/entitlement plan-brief files (§5).
> **Scope:** outstanding work only. Shipped work appears as one-line reference in §4.
> **Canon:** `docs/agents/strategy/PLAN_PRICING_FACTS.md` is the single source of truth for plan
> names, prices, capacity bands, gating and inclusions. Never restate a price here — point at it.

---

## 0. Ground truth (verified 2026-07-28)

**Stripe is live.** ⚠ *Corrected 2026-07-28 — an earlier draft of this doc said the live cutover was
still outstanding. It isn't, and it hasn't been for some time.* Verified against the live
configuration: a live Stripe account with live products and prices, the production webhook endpoint,
the Customer Portal branded and configured for live mode, all 12 live price IDs entered, production
carrying live keys, and the billing audit passing with zero failures and zero warnings. Real money
can move today.

**Two separate things were being confused, and that's what made this look unfinished:**

1. **Is Stripe ready?** Yes — done.
2. **Which plans can a customer actually buy?** That's a *product* gate, not a Stripe one. Right now
   **Tournament and Tournament Plus are open** for real self-serve purchase. **The Premium Coaches
   Portal, League, Club and Club Large are held in early access** — deliberately, because the coach
   portal is free until January and League/Club are pre-launch.

Everything else in this program is either a deferred slice of a shipped engine or a
scoped-but-unstarted audit follow-up.

The commercial context has changed since most of these plans were written: **Tournament Plus is free
through 2026-12-31** for founding orgs and the **Premium Coaches Portal is $0 until 2027-01-01**. That
means almost nothing here is revenue-blocking *today* — but a large cluster of it becomes
simultaneously due in **January 2027**. That concentration is the main risk this program carries.

---

## 1. Outstanding work

### 1.1 Live-card smoke test — the only Stripe item left
Seven of the ten cutover steps are done. Three remain, and none of them block anything from being live:

- **The live-card smoke test** — a 43-step run covering a real checkout, webhook delivery, the
  customer portal, a refund and a cancellation, using an actual card. Deliberately deferred so the
  small non-refundable processing fee is only incurred near real revenue.
- **Watching the first real transactions** land in Stripe and confirming webhooks deliver.
- Trial-lifecycle reminder emails for the League and Club trial windows (deferred to a later slice).

**When to run it:** before the January conversion, not before "going live" — that's already happened.
The conversion is when charges begin at volume, and it's the first moment a broken payment path would
hurt many customers at once rather than one.

### 1.2 January 2027 conversion — the real concentration risk
Three separate commitments all land at once:
- Founding-season orgs convert off free Tournament Plus (2026-12-31).
- Premium Coaches Portal converts off $0 (2027-01-01).
- The whole 2026 comp cohort (orgs **and** coach workspaces) converts via a **manual, owner-executed
  runbook** — mass email → card on file → flip or cancel per account.

The manual runbook exists in outline only. **It needs to be written and rehearsed well before
December.** With Stripe already live, this is now the single largest piece of unmanaged risk in the
program — the dependency isn't technical any more, it's preparation time.

### 1.3 Stripe price-configuration validation — Phase 3
Phases 1–2 shipped (shared validator + server hard-block on a mis-wired price). **Phase 3 — the
in-app card price-guard — is not built**; it lands with the H8 build. Also deferred on purpose: the
side-by-side comparison screen and the "acknowledge this warning" step.

### 1.4 Timed entitlement grants — deferred slices
The grant engine is merged behind `ENTITLEMENT_GRANTS_ENABLED` and the flag has since been turned on
by owner decision. Deferred slices remain:
- **Scenario A2** — comp with real billing pause/resume via Stripe `pause_collection`. Deferred because
  a manual fallback already exists (staff pause/refund directly via the org's "Open Stripe" link) and
  because there are no subjects yet during the comp period.
- **Daily reconciliation** — audit-log expirations, clear stale flags, optional internal notice.
  Cron mechanism decision was deferred alongside the notifications work; **cron is now wired**, so this
  is unblocked.
- **Stale canon to fix:** the `/billing` agent guide claims an `org_overrides type:'plan'` enforced by
  `lib/plan-gating-server.ts`. That is **not true** — the CHECK is `subscription_status | comp_period`.
  Correct the guide.

### 1.5 Plan / Tier Trial — proposed, deferred, not scheduled
Operator-granted, timed, auto-reverting **whole-plan** trial ("give this club League Plus for 14 days").
Access-only; never touches Stripe. Completes the long-deferred `plan_tier` slice of the grants engine,
which needs an **effective plan rank** threaded through gating. Owner relabelled the existing surgical
grant for clarity and deferred the build.

### 1.6 Billing downgrade & data retention — hard purge missing
Retention windows, owner warnings, the `pending_purge` transition and the notice emails are built and
applied in both environments. **Not built: the hard purge execution + purge audit events** — deliberately
held until the pending-purge review policy is finalised. Also outstanding: the **platform-admin retention
queue** (what's approaching purge, per org, with deadline and days remaining, plus extend/expire actions).

> ⚠ **This is an unbounded data-retention liability.** Records enter `pending_purge` and stay there
> forever because nothing deletes them. Low urgency while customer count is small; it does not stay low.

### 1.7 Billing & Accounting Coherence — scoped, not started
Successor to the archived Stripe Integration project. Four threads: bill-what-you-confirm lifecycle,
board numbers that don't lie (overdue / headroom / budget-vs-actual / rollup), reversible money actions,
and a whole-club Financial Summary. Includes a known live defect — **comped/override orgs are hard-blocked
from creating a 4th rep team** by a billing-preview 400 that fails to distinguish "no subscription to
bill" from a transient failure.

### 1.8 Single Source of Truth hardening — scoped, not started
A 4-domain audit found ~**17 instances** across 5 shapes (ghost controls, copy-pasted constants, stale
copy, inconsistent assembly, DB-vs-Stripe divergence), several **live on customer surfaces**. The
headline: the **plan-limits override table is a ghost control** — shown on Plans & Pricing, never read
by enforcement. Copy-side items route to `/marketing`.

---

## 2. Decisions required from you

| # | Decision | Recommendation |
|---|----------|----------------|
| BL-1 | **When do the held plan gates open?** Premium Coaches Portal, League, Club and Club Large are all in early access. Each has a different trigger — the coach portal at the January conversion, League at its launch, Club at repackaging. | Open League first (it's built and free), coach portal in January, Club last. Track each against its own program doc rather than as one billing event. |
| BL-2 | **When is the live-card smoke test run?** It costs a small non-refundable fee and it's the last unverified link in the payment chain. | Before the January conversion. Running it on a quiet day beats discovering a broken refund path mid-conversion. |
| BL-3 | **Finalise the pending-purge review policy** so hard purge can be built. Who reviews, what window, what's exportable first? | 30-day pending-purge review, owner-notified, export-before-purge. |
| BL-4 | **Does a tier trial lift plan-derived *limits* (tournament limit, team caps), or only feature/module gating?** | Lift them — a trial that hits caps isn't a faithful trial. |
| BL-5 | **Is Plan/Tier Trial still wanted?** It's been Proposed/deferred since June with no demand signal. | Drop it until a sales conversation actually needs it. The surgical grant covers today's cases. |
| BL-6 | **Founding-season spotlight email calendar** — the Aug/Sep/Oct/Nov dates assume a June/July 2026 external launch. That launch has shifted. | Re-anchor the calendar to the actual launch date before the first send. |
| BL-7 | **Priority for SoT hardening.** ~17 instances, several customer-visible, but none are outages. | Fold the customer-visible ones into whatever billing work happens next rather than running it as a standalone project. |

---

## 3. Cross-references

- Pricing/packaging **decisions** belong in `docs/agents/strategy/BUSINESS_DECISIONS.md` via `/strategy`.
- Facilitated Payments (Q4 2026 scoping, H1 2027 build) is a **separate, current** project —
  see `FACILITATED_PAYMENTS_SCOPING_PLAN.md`. Do not merge it here.
- Free-tier floors and League Starter launch live in `PROGRAM_LEAGUE_AND_CLUB.md`.

---

## 4. Shipped — reference only

- **Stripe, end to end and live** — checkout, full-lifecycle webhook, customer portal, billing UI, per-team billing, and the production cutover itself: live account, live products and prices, production webhook endpoint, branded live customer portal, 12 live price IDs, production keys, billing audit clean. Tournament and Tournament Plus are purchasable today.
- **Price-configuration validation P1–P2** — shared validator + server hard-block on missing / inactive / one-time / wrong-interval / wrong-currency / wrong-environment prices; warns on amount mismatch, reuse, wrong product.
- **Timed entitlement grants** — `org_overrides`-based grant engine (no new table), request-time evaluation, Active Overrides operator surface, auto-revert at expiry.
- **Retention lifecycle** — retention windows, 14-day owner warning, `pending_purge` transition, notice emails.
- **Founding Season — Coaches Free** — Premium Coaches Portal $0 until 2027-01-01, Coaches Portal live self-serve, mischarging trial-checkout bug fixed, accidentally-open $29 prod checkout closed.
- **Founding Season GTM** — Tournament Plus free through 2026-12-31 for founding orgs, homepage/pricing callouts, in-app billing banner, platform-admin tracking.

---

## 5. Source files consolidated (archive candidates)

`STRIPE_PRICE_VALIDATION_PLAN.md` · `STRIPE_PRICE_VALIDATION_PM_BRIEF.md` ·
`STRIPE_PRODUCTION_SMOKE_TEST_TODO.md` · `TIMED_ENTITLEMENTS_PLAN.md` · `TIMED_ENTITLEMENTS_PM_BRIEF.md` ·
`PLAN_TIER_TRIAL_PLAN.md` · `PLAN_TIER_TRIAL_PM_BRIEF.md` · `BILLING_DOWNGRADE_RETENTION_PLAN.md` ·
`BILLING_DOWNGRADE_RETENTION_PM_BRIEF.md` · `BILLING_ACCOUNTING_COHERENCE_PLAN.md` ·
`BILLING_ACCOUNTING_COHERENCE_PM_BRIEF.md` · `SOURCE_OF_TRUTH_HARDENING_PLAN.md` ·
`SOURCE_OF_TRUTH_HARDENING_PM_BRIEF.md` · `FOUNDING_SEASON_PLAN.md` · `FOUNDING_SEASON_PM_BRIEF.md` ·
`FOUNDING_SEASON_COACHES_FREE_PLAN.md` · `FOUNDING_SEASON_COACHES_FREE_PM_BRIEF.md`

> **Note:** `STRIPE_PRODUCTION_SMOKE_TEST_TODO.md` contains the 43-step live-card checklist and is the
> only source file with operational content that must survive. **Keep it active** until that test is run.
