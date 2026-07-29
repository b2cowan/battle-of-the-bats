# Facilitated Payments — Scoping Plan (Q4 2026)

> **Status:** Planning (scoping — not a build plan). **Substantially pre-answered 2026-07-28** by the owner-commissioned investigation; remaining open items are listed in §Remaining.
> **Created:** 2026-06-22 · **Updated:** 2026-07-28 (investigation findings folded in)
> **Branch:** dev
> **Source of truth:** `docs/agents/strategy/BUSINESS_DECISIONS.md` (2026-06-22 direction + sequencing ratified; 2026-07-28 investigation outcomes logged — take-rate model Decided, architecture/rails/risk posture Proposed, tier attachment OPEN)

## Goal

Produce the formal scope for **facilitated payments** — participant→org money movement on which FieldLogicHQ earns — as the primary mechanism that scales revenue with club size and funds the free floors. This document is the **scoping framework and decision register**; it is NOT a build plan. Direction and sequencing are ratified (launch H1 2027, deliberately not before the Jan 2027 billing cliff).

## Investigation summary (2026-07-28)

Eight-agent research workflow (codebase, strategy record, Stripe Connect Canada, competitors, Canadian compliance) + independent primary-source fact-check. Full decision-log entry: BUSINESS_DECISIONS.md 2026-07-28. Headlines:

- **Starting point:** ZERO in-app participant→org payment infrastructure exists. Every fee flow (tournament registration, dues, house league, basic-coach fees) is manual bookkeeping — free-text "how to pay" instructions, offline e-transfer, hand-flipped paid flags. The existing Stripe stack is subscription-billing only (no Connect/marketplace wiring anywhere), but its patterns (webhook handler, price-catalog governance, billing mock/test bypass, audit events) are strong templates.
- **Landing surface exists:** the Registration Command Center already computes paid/deposit-paid/pending/past-due per team from the fee schedule. Online payments *feed an existing dashboard*; the manual mark-paid path stays for cash/e-transfer orgs (hybrid — a genuine differentiator; incumbents force their gateway).
- **Effort:** MVP ≈ 15–22 solo-dev+AI days (3–4.5 wks); full feature ≈ 30–48 days (6–10 wks); ongoing operational load (disputes, refund tickets, payout support) is additive post-launch. Workstream model in §Effort.

## Decision register

### 1 — The take-rate ✅ MODEL RESOLVED (number still open)
- **Resolved (Decided 2026-07-28):** the FieldLogicHQ take is a **margin layered into a market-band all-in rate** — NOT an all-in ~2.5% (underwater: Stripe Canada base card cost is 2.9% + $0.30, confirmed live).
- **Verified market band** (primary-source confirmed 2026-07-28 unless noted):

  | Platform | All-in rate | Notes |
  |---|---|---|
  | TeamSnap | 3.25% + $1.50 | pass-to-registrant toggle defaults ON |
  | SportsEngine HQ | 3.25% + $2.00 | atop $69/mo sub; $300 penalty under $1k/yr volume |
  | Jersey Watch | 3.5% + $1.00 | no fee if org doesn't collect online |
  | Tourney Machine | 2.9% + $1.00 | + $4/team scheduling fee |
  | RAMP (Canadian) | "under 2%" org-absorbed | corroborated (indexed primary page; fetch blocked) |
  | TeamLinkt (Canadian) | undisclosed, volume-scaling | via Stripe; free software funded by the take |

- [x] **Rate DECIDED 2026-07-28 (Option B — rail-differentiated launch anchor): cards 3.5% + $1.50 all-in · bank debit (PAD) 2.5% + $1.00 all-in · family-pays.** Riders: "+ tax" display (accountant), international-card policy, org-absorb override.

#### Unit economics at the anchor (computed 2026-07-28; direct model, family-pays, organizer always nets the full fee)

Mechanics: family pays fee + service fee (3.25% + $1.50 on the fee); the charge lands on the organizer's connected account; our take = the service fee via application fee; **we pay Stripe's costs out of our take** (processing billed on the grossed-up total, i.e. fee + service fee, plus 0.25% payout fee on organizer payouts, plus $2/mo per organizer account in payout months).

| Team fee | Family pays | Our fee | Stripe cost — card | **Our net — card** | Stripe cost — bank (PAD) | **Our net — bank** |
|---|---|---|---|---|---|---|
| $300 | $311.25 | $11.25 | $9.33 + $0.75 payout | **≈ $1.17** | $3.51 + $0.75 | **≈ $6.99** |
| $800 | $827.50 | $27.50 | $24.30 + $2.00 | **≈ $1.20** | $5.00 (cap) + $2.00 | **≈ $20.50** |
| $1,500 | $1,550.25 | $50.25 | $45.26 + $3.75 | **≈ $1.24** | $5.00 (cap) + $3.75 | **≈ $41.50** |

- **Card margin is structurally flat ≈ $1.20/transaction at the anchor** (the 0.35-point spread over Stripe's 2.9% is nearly consumed by processing being charged on the grossed-up total + the 0.25% payout fee). **Bank debit (PAD) is the profit engine** — the $5 fee cap means our net GROWS with fee size.
- **Margin-killers to resolve before ratifying the number:** (a) **GST/HST** — if we must remit ~13% out of the service fee rather than charging it on top, card transactions go **negative** (≈ −$2.40 on $800); display "+ tax" vs tax-inclusive is an accountant question with real stakes. (b) **International cards** (+0.8% Stripe surcharge — US teams at cross-border tournaments): ≈ −$5.70 net on an $800 card fee at the anchor unless surcharged or accepted as CAC.
- **Rail-mix illustration** (40-team tournament × $800): all-card ≈ **$48** net · 50/50 ≈ **$434** · all-bank ≈ **$820**. The rail mix IS the business at the anchor rate.
- **Pricing options for the ratification call:** **(A) one rate, both rails** (3.25% + $1.50 — simplest story; profit rides on steering families to bank debit via UX) vs **(B) rail-differentiated** (cards 3.5% + $1.50 ≈ $3.14 net; bank 2.5% + $1.00 ≈ $14.00 net on $800 — the visible discount does the steering; card price = top of band but defensible beside a cheaper bank option, cf. Jersey Watch 3.5% + $1 flat). **→ RATIFIED: Option B (owner, 2026-07-28 — "I agree with option B, log it").**

### 2 — Who pays ✅ DECIDED (family-pays, ratified with Option B 2026-07-28)
- Market default is **family-pays** (TeamSnap default-on toggle; SportsEngine passes fees; RAMP offers pass-through) — ratified as our default with the Option B rate.
- [ ] **Open:** whether orgs can override (org-absorb option) — decide at build.

### 3 — Processor + money-movement model ✅ DECIDED (direction; counsel confirms the reading)
- **Decided (owner 2026-07-28 — "we go with the direct model, we never hold the funds"):** Stripe Connect, **direct charges on organizer-owned connected accounts** (Express-style hosted onboarding — Stripe collects KYC), platform take via application fee. CAD support confirmed; Connect overhead $2/mo per active connected account + 0.25% + $0.25 per payout ("you handle pricing" model, confirmed live 2026-07-28).
- **Why direct charges (the load-bearing call):** Bank of Canada RPAA marketplace guidance (Dec 2025) turns on whether funds ever land in an account the platform **owns or controls** — direct charges match the "not a PSP / no registration" scenarios; **destination charges match the must-register scenario** and additionally put every organizer's chargebacks on the platform's balance. Direct charges: disputes hit the organizer's balance first, loss backstop configurable.
- **Rails:** cards (2.9% + $0.30) **+ ACSS/PAD pre-authorized debit at 1% + $0.40 capped at $5.00** (confirmed on two live Stripe pages). On a $1,000 fee: ~$5 cost vs ~$29 by card — PAD is the margin engine at an unchanged all-in rate. Trade-off: up to 5-business-day settlement, $5 failure/dispute fees.
- Alternatives assessed and set aside: organizer-own-keys (no take capture), PayPal Commerce Platform (sales-gated), Square/Adyen (no confirmed self-serve Canadian marketplace product), Interac e-transfer automation (separate third-party embedded-finance vendor, own KYC, no dispute protection), MoR aggregators (wrong structural fit).
- [ ] **Open:** counsel confirmation of the direct-charges regulatory reading (see §4) — the launch gate; the design direction itself is ratified.

### 4 — Legal / compliance (STILL GATING — but now a short, specific list)
Findings 2026-07-28; **counsel briefing memo ready: `FACILITATED_PAYMENTS_COUNSEL_BRIEF.md`.**
- **RPAA (Bank of Canada):** direct-charges architecture likely outside PSP registration per the Dec 2025 marketplace case scenarios; destination charges likely inside. Not settled either way for our exact shape — the fact-check flagged both flat readings as oversimplifications. **Counsel question #1.**
- **FINTRAC MSB:** separate regime; "intermediary between payer and payee" test has no on-point guidance for a direct-charges Connect platform. **Counsel question #2.**
- **PCI:** stays SAQ-A with Stripe-hosted checkout (unchanged by Connect). Two v4.0.1 payment-page requirements (script inventory 6.4.3, tamper detection 11.6.1 — mandatory since Mar 2025) go on the build checklist.
- **Tax:** GST/HST **likely applies to our platform fee** (accountant confirmation needed); no Canadian 1099-K analog burdens us under direct charges; CRA digital-platform reporting rules likely inapplicable (secondary sources only — spot-check).
- **Refund/cancellation risk (the classic blowup):** tournament cancelled after fees paid out. Mitigations (Proposed): payouts held until post-event (industry practice), rolling reserves (5–15%, 90–180 days) on new accounts, ToS: organizer = merchant of record, owns refund policy, indemnifies platform. 2026 Team Travel Source class action is the cautionary tale.
- **PIPEDA:** disclosure/consent for Stripe processing incl. cross-border; card data never touches us. Insurance: E&O + cyber ~$1.5–4.5k/yr combined (broker quote needed).
- [ ] **Open:** counsel session; accountant sign-off; broker quote.

### 5 — Product surface + sequencing ✅ FIRST FLOW IDENTIFIED (tier attachment OPEN)
- **First money flow (Proposed):** tournament **registration fees** — richest existing surface (fee schedules, deposits, Command Center, payment-reminder dunning already built). Team dues and other flows follow.
- **Hybrid rule:** online collection feeds the same paid/deposit fields the manual path writes; manual mark-paid stays. No org is forced onto Connect.
- [x] **Tier attachment — DECIDED 2026-07-28 (owner via decision prompt): ALL PAID ORG TIERS — Tournament Plus, League Plus, Club (incl. Club · Association).** Free org tiers + Coaches Portal excluded. Recorded in `PLAN_PRICING_FACTS.md` (Decided/not-yet-built line) + BUSINESS_DECISIONS.md 2026-07-28.
- **Sequencing (unchanged):** launch H1 2027, after the Jan 2027 cliff. Build may start earlier; launch may not (amend the 2026-07-28 log entry to change this).

## Effort model (from the 2026-07-28 investigation)

Phasing: **Phase 0** decisions (1–2 days) → **Phase 1 MVP** 15–22 days (onboarding, checkout at registration, Command Center wiring, basic refunds, core webhooks, test mode) → **Phase 2 hardening** 10–15 days (partial refunds, disputes/negative balance, payouts panel, reconciliation with accounting, platform-admin oversight, offboarding, help docs, ToS) → **ongoing ops** (recurring, budget separately). Workstreams of note beyond the obvious: separate Connect webhook endpoint (distinct signing + connected-account event context), multi-tenant test-mode story, org offboarding with in-flight registrations, negative-balance handling. Full workstream table lives in the 2026-07-28 investigation transcript; reconstruct into the build plan at handoff.

## Architectural Decisions
- **This plan produces decisions, not schema.** Tables, Connect wiring, and migrations belong to the *build* plan this scope hands to `/plan` — at which point the migration-first + data-dictionary rules apply.

## Remaining before build handoff
1. [x] Owner: **tier attachment** ruling (§5) — DECIDED 2026-07-28: all paid org tiers.
2. [ ] Owner: **counsel session** (memo ready; RPAA/FINTRAC/ToS) — the long-lead item.
3. [ ] Owner: accountant GST/HST confirmation; insurance broker quote.
4. [x] Rate number + family-pays default RATIFIED 2026-07-28 (Option B — recorded in `PLAN_PRICING_FACTS.md`; plan config at build). Remaining riders: "+ tax" display (accountant), international-card policy, org-absorb override.
5. [ ] → `/plan`: build plan + PM brief for the H1 2027 build (MVP = registration fees, gated at the three paid org tiers).

## Open Questions
- [ ] Does facilitated payments change the subscription pricing thesis (payment revenue subsidizing lower/zero subscription tiers)? Flag for `/strategy`, do not assume.
- [ ] Momentary-custody nuance: does a destination-charge's transient platform-balance stop count as "owns or controls"? (Only matters if counsel disfavors direct charges — ask as a fallback question.)
- [ ] Stripe "Stripe handles pricing" revenue-share qualification (zero per-account/payout fees; Stripe bills the connected account) — worth a Stripe sales conversation before locking the fee model.
