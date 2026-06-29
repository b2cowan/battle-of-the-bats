# Stripe Price-Configuration Validation + H8 Price-Guard — Implementation Plan

> **Created:** 2026-06-29 · Owner-approved during platform-admin QA 3.2. Routed to `/billing`.
> **Decisions:** validation set + block/warn split ratified by owner 2026-06-29 (see `docs/projects/active/PLATFORM_ADMIN_WALKTHROUGHS.md` "3.2 — NEW"). Pairs with the H8 decision (`BUSINESS_DECISIONS.md` 2026-06-29 "Plan-launch mechanics") and the SoT governance principle (same date). No pricing/packaging values change.

## Problem
Attaching a Stripe price ID to a plan slot (via the catalog approval flow, or the direct price-set path) did **no meaningful validation** — it retrieved the price but only checked "is it active," and only when the slot's environment matched the running server's Stripe key. Amount, frequency, currency, environment, reuse, and product were all ignored. An operator could silently wire a wrong/mismatched price, which would surface as a broken customer checkout.

## Validation set (owner-approved)
**Hard block** (refuse to apply): price missing · inactive · not recurring · frequency ≠ slot cycle · environment (test↔live) ≠ slot · currency ≠ CAD.
**Warn + explicit confirm** (usually a mistake): amount ≠ catalog price · price already on another slot · Stripe product ≠ this plan's product.

## Phases

### Phase 1 — Shared validator + server enforcement + H8 readiness helper — ✅ BUILT 2026-06-29 (this session)
- New `lib/stripe-price-validation.ts`: `validateStripePriceForSlot(priceId, slot)` returns a structured result — per-check ✓/⚠/✗, `hardBlock`/`warn` flags, the Stripe facts (amount/interval/currency/active/environment/product) and the expected catalog amount (from `PLAN_CONFIG`, matched to `PLAN_PRICING_FACTS.md`). The reuse check is DB-only (always runs); the Stripe lookup runs only where the matching key lives, else returns `validated:false` with a `skippedReason` (no hard block) — so a Production-slot price still can't be falsely blocked from a sandbox/local environment.
- Wired into **both** apply paths (the change-request approval flow + the direct price-set PATCH): a **hard-block result now refuses the apply** with a clear message; warnings are recorded on the application/audit record and returned in the response for the UI.
- New `isPlanCheckoutPriceConfigured(planId, cycle)` in `lib/stripe-prices.ts`: cheap DB "is a price wired?" check, no Stripe call — the runtime piece of the H8 price-guard.
- No migration. typecheck ✓ / focused lint ✓ (0 errors). Not pushed.

### Phase 2 — "Catalog vs Stripe" UI panel + warn-confirm handshake — ✅ BUILT 2026-06-29 (brought forward — owner wanted to see warnings during QA; same-chat, no collision)
- New read-only endpoint `…/change-requests/validate-price` runs the validator for a request (re-derives the slot server-side, never trusts client data) and returns the structured result.
- The **approval-detail modal** now shows a **"Stripe price check"** panel: per-line checks (active, recurring, interval, currency, environment, amount-vs-catalog, reuse, product) with ✓/⚠/✗, an "amount X (expected Y)" readout, and a "not validated in this environment" note when the Stripe lookup was skipped.
- **Approve & Apply is disabled on a hard-block** (and while validating), and a **warn requires checking an explicit "I've reviewed the warnings" box** before Approve enables. Server still enforces hard-blocks independently. *(Server-side warn-confirm — rejecting a direct API approve that skips the checkbox — is a small follow-up; warnings are "allow with confirm," and the server already hard-blocks the dangerous cases.)*
- typecheck ✓ / focused lint 0 errors (one benign set-state-in-effect warning consistent with existing screens). New endpoint file → dev server restarted.

### Phase 3 — H8 in-app price-guard wiring — ◻ NOT BUILT (coordinates with the H8 build)
- Use `isPlanCheckoutPriceConfigured` in the in-app upgrade card's gating so a plan toggled "Live" with no wired price keeps its Upgrade button **closed** (no broken checkout). Lands with the H8 gating-source switch (the in-app card reading the live availability toggle).

## Out of scope / non-goals
- No pricing/packaging value changes.
- No change to which environments validate (the env-gating is correct behaviour, just made explicit).

## Verify
- Sandbox slot, local dev: wiring a price with a wrong interval/currency/inactive/one-time now **blocks** at approval; an amount mismatch or reuse is **allowed but recorded** (until Phase 2 adds the confirm gate). A Production slot from local dev still applies (env can't be checked here) — by design.
