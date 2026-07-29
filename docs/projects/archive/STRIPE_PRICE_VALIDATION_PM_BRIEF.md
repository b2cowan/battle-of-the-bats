# PM Brief — Stripe Price-Configuration Validation + H8 Price-Guard

**Created:** 2026-06-29 · Companion to `STRIPE_PRICE_VALIDATION_PLAN.md`

## What this is
A safety net for the moment an operator attaches a Stripe price to a plan. Until now, the console accepted almost any price ID without checking it against Stripe — so a wrong, mismatched, or test price could be wired to a real plan and only surface when a customer's checkout broke. This validates the price at the moment it's set and blocks the dangerous mistakes.

## Why it matters
Plan prices are where a configuration slip turns directly into lost revenue or a failed purchase. Catching a bad price at config time — with a plain explanation — is far cheaper than discovering it from a customer who couldn't pay. It's also the safety dependency for opening new plans for self-serve checkout (a plan can't go "buyable" without a valid price behind it).

## What changes for the operator
- When wiring a price, the system now **refuses** anything that's never valid — a price that doesn't exist, is archived, isn't a subscription price, bills on the wrong frequency, is in the wrong currency, or is from the wrong (test vs. live) environment.
- For "probably wrong" cases — the dollar amount doesn't match the catalog, the price is already used on another plan, or it belongs to a different product — it **flags a warning** the operator must acknowledge before continuing.
- (Next phase) The approval screen will show a plain **"Catalog vs Stripe"** comparison instead of raw data, so the operator sees exactly what matches and what doesn't before committing.

## Status & sequencing
- **Built now:** the checks themselves and the hard-block enforcement (a bad price is refused), plus the lightweight "is a price wired?" check the in-app upgrade card needs.
- **Deferred (on purpose):** the side-by-side comparison screen + the "acknowledge this warning" step — these touch the same console screens currently under manual QA, so they're held until that QA finishes to avoid stepping on it.
- **Coordinated:** the in-app card guard ("don't open checkout for a plan with no valid price") lands with the related launch-mechanics work.

## Success criteria
- A wrong-environment, wrong-frequency, wrong-currency, inactive, or non-existent price can't be applied to a plan.
- An amount/reuse/product mismatch is surfaced clearly before it's accepted.
- No plan can be opened for self-serve checkout without a valid price behind it.

## Customer impact
Far lower chance of a broken or mispriced checkout reaching a customer — the failure mode that's most damaging at exactly the moments (launches, repricing) when it's most likely.
