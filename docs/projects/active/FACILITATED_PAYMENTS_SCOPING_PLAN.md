# Facilitated Payments — Scoping Plan (Q4 2026)

> **Status:** Planning (scoping only — not a build plan)
> **Created:** 2026-06-22
> **Branch:** dev
> **Source of truth:** `docs/agents/strategy/BUSINESS_DECISIONS.md` (2026-06-22 — payments direction + sequencing ratified; rate/who-pays/processor remain Proposed)

## Goal

Produce the formal scope for **facilitated payments** — participant→org money movement on which FieldLogicHQ earns — as the primary mechanism that scales revenue with club size and funds the free floors. This document is the **scoping framework and decision register**; it is NOT a build plan. Direction and sequencing are ratified (scope Q4 2026, target H1 2027 launch, deliberately not before the Jan 2027 billing cliff). The "no payments" posture was always a temporary setup-phase deferral; this is the planned graduation.

## Why this is scoping-only right now

Every dominant Canadian competitor (RAMP, TeamLinkt, Spond) gives software away and earns on payments; a subscription-only model leaves the largest value metric uncaptured. But money movement carries KYC, trust, and regulatory surface that makes a pre-cliff launch dangerous. So the work now is to **answer the open commercial + legal questions**, not to write payment code.

## Decisions to resolve in scope (these are the deliverables)

### 1 — The take-rate (BLOCKING; the number is currently mis-stated)
- The seeded "~2.5% + $0.30" is ambiguous and likely wrong. A processor (e.g. Stripe Connect) already costs ~2.9% + $0.30 to move the money.
  - If 2.5% is the **all-in** rate → **underwater on every transaction.**
  - If 2.5% is FieldLogicHQ's **margin on top of** processing → family pays ~5.4% all-in, lands in competitor range (2.9–5%), and makes money.
- [ ] Decide and document: is the FieldLogicHQ take a **margin on top of** processor cost, and what is the all-in number the family/org sees? Benchmark against RAMP/TeamLinkt/Spond all-in rates.

### 2 — Who pays (family-pays vs org-absorbs vs configurable)
- [ ] Decide the **default** and whether orgs can override. Family-pays default is proposed; confirm against conversion/acceptance norms in Canadian grassroots sport.

### 3 — Processor + money-movement model
- [ ] Choose processor (Stripe Connect vs alternatives) and the flow (destination charges / separate charges + transfers / on-behalf-of). Confirm CAD support, payout timing, and per-org onboarding (KYC) friction.

### 4 — Legal / compliance (gating, not optional)
- [ ] Canadian **KYC / money-transmission** posture (are we a payment facilitator? what does the processor assume?).
- [ ] Refunds, chargebacks, disputes, failed-payment handling, and who bears the loss.
- [ ] Tax treatment + receipts; PIPEDA for participant financial data.
- [ ] **Counsel sign-off** before any launch.

### 5 — Product surface + sequencing
- [ ] Which money flows first (registration fees → team dues → tournament entry?) and how it threads into existing accounting/ledger modules.
- [ ] Confirm H1 2027 launch window vs the Jan 2027 cliff and the product-hardening dependency.

## Architectural Decisions
- **This plan produces decisions, not schema.** Any tables, Stripe Connect wiring, and migrations are defined by the *build* plan that this scope hands off to — at which point the migration-first + data-dictionary rules apply.

## Phases
### Phase 1 — Commercial model (Q4 2026)
- [ ] Resolve take-rate (margin-vs-all-in), who-pays default, value metric.
### Phase 2 — Processor + compliance (Q4 2026)
- [ ] Processor selection + KYC/money-transmission/refund/chargeback/tax posture with counsel.
### Phase 3 — Product scope + build handoff (end Q4 2026)
- [ ] First money flow, accounting integration points, → `/plan` writes the implementation plan + PM brief for an H1 2027 build.

## Open Questions
- [ ] Does facilitated payments change the subscription pricing thesis (could payment revenue eventually subsidize lower/zero subscription tiers)? Flag for `/strategy`, do not assume.
- [ ] Founding-Season interaction: payments must not launch *into* the free founding window (trust risk) — confirm timeline fit.
