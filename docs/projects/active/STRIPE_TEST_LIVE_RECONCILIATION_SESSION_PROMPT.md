# Stripe test ↔ live reconciliation (item R, owner steps O12 / O13) — planning + test-side audit session

Paste this whole file as the first message of a new chat. Branch: `dev`. Written 2026-11-17.

## Why this, why now
Stage 2 of Plans & pricing is closed. The only open item with a deadline in the Stripe program is **R: the test ↔ live
reconciliation**, which must be finished **before Club goes on sale** (owner ruling 2026-11-06, O13). Tripwire: the first real
paying customer pulls O3 (the four dispute/refund events on the live webhook) and O6 (the first live "Payment method &
invoices" press) forward. Nothing is recorded as done after 2026-11-06.

## What is already settled (do not re-litigate)
- **Order (owner 2026-11-06):** write the target → clean TEST until it equals the target → confirm test with the read-only audit →
  the owner makes LIVE match in the Stripe dashboard → end-to-end testing (first live portal press, a live purchase, cancel, refund).
- **The target is written and the owner CONFIRMED it 2026-11-06:** `docs/agents/strategy/BUSINESS_DECISIONS.md` (the 2026-11-06 entry
  around lines 199–232; Club $219/$2,190, Club · Association $379/$3,790; retired products deleted not archived; League Plus stays active;
  names = plan labels; lookup keys are not part of the target; tax, USD and Connect rows get filled when they exist). It must reconcile
  against `docs/agents/strategy/PLAN_PRICING_FACTS.md`; a disagreement is drift to flag to `/strategy`, never a new number.
- **First audits ran 2026-11-06** (record: `PLANS_PRICING_STAGE0_BUILD_PROMPT.md` O12a-results): live prices all match; **live still
  needs** ten webhook events (the four dispute/refund events plus `payment_method.attached`/`.detached` and four fee-invoice
  events — the audit's expected list is now 17 events), the Premium Coaches Portal product renamed, and the four retired prices
  deleted (owner said they are). **Test has** a League yearly slot pointing at a monthly price and one extra, harmless invoice event.
- **Claude never changes Stripe settings and never reads LIVE Stripe.** The owner runs the live audit and pastes the result.
  Claude may audit TEST (read-only) and may change OUR database/code only when asked.
- Audit tooling: `scripts/audit-stripe-billing.mjs` (+ `scripts/lib/stripe-portal-audit.mjs`; takes `--webhook-url` for test).
  Its expected list was updated to the target 2026-11-06 and was **not committed** at the time — check `git status` / `git log` first.

## This session's job
1. Read, in order: `STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md` item R, `PLANS_PRICING_STAGE0_BUILD_PROMPT.md` O3, O6, O12, O13, the 2026-11-06
   entry in `BUSINESS_DECISIONS.md`, `STRIPE_BRANDING_PASS.md` (owner questions Q-L1…Q-M6 owed before the first live sale), and
   TODO.md line about the live-card smoke test. Broad reading goes to a helper agent; open the cited lines yourself.
2. Re-run the read-only audit against **TEST** (needs network access; start nothing else on the dev server). Report differences from
   the confirmed target in plain language: what is wrong, where, and what the owner must click to fix it. Do not fix Stripe yourself.
3. Produce **one ordered owner checklist** (a checkable Artifact, one purpose, 20–50 boxes, one action per step) covering:
   clean test → re-audit test → owner's live fixes (six missing events, Premium product name, confirm the four retired prices are gone,
   live portal settings creation) → owner runs the live audit and pastes it → end-to-end (first live portal press, a live purchase,
   cancel, refund). Fold the Stripe-branding owner questions that are due "before the first live sale" into it as separate rulings,
   never inside the box counter.
4. Check the records before listing any step as owed — the owner may have done some in another session (see
   `reference_prod_release_history.md` in memory and the ledger).
5. Surface, don't decide: (a) should the end-to-end live purchase be done the same day as the next production promote, (b) anything
   in the live audit that contradicts the confirmed target. Disagree out loud if the target looks wrong against what the code does.

## Not in this session
Stage 3 tools, subscription-change replay, price-change stages (7–8), any code change to billing behaviour. If the audit finds a
code defect, record it as a finding and route it to `/plan`.

## Close the session by
Updating the Stripe plan's item R and the Stage 0 prompt's O12b/O13 lines with what actually happened (dated facts, not
"owed"/"not done" wording), TODO.md, and the program memory file. Offer `/review` only if code changed.
