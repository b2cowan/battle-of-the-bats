# Stripe-owned pricing Stage 5: the words read against the code and the probe
**Last verified:** 2026-11-18
**Re-verify by:** the owner's answer on payments terms v0.2 (O4); Stage 3 (the books record Stripe's real fee); the 2026-11-25 live payout test (returned-debit and dispute behaviour); accountant answer D1
**Depends on facts:** `lib/online-payment-fee.ts` (rate design A), `lib/stripe-connect.ts` (`fees_collector` and `losses_collector` both `stripe`), plan "Stage 1 probe results" (test mode, 2026-11-17), `STRIPE_FEE_INVOICE_RETIREMENT.md`, `LEGAL_FACTS.md` payments census

## Question(s) this answers
Is payments terms v0.2, the next privacy version, `before.stripeTerms` and the help true against the code, free of any promise about Stripe's negative-balance backstop, and right about tax while D1 is open?

## Finding
No MUST-FIX. Every checked sentence in v0.2 §4 and §5 is true against `onlineFee()` and the probe: the two parts sum to the processing fee at Stripe's standard Canadian price in both payer modes (club-pays computes Stripe's cost on the base, family-pays on base plus fee; the code's `clubReceivesCents` is the terms' net); a foreign card makes the parts exceed it ($4.19 + $1.65 vs $5.00 in the probe). Nothing promises Stripe's backstop: §5 states the club's debt and says "FieldLogicHQ does not cover it", and `before.stripeTerms` states only the club's debt. Tax: "included in our fee" is true whether D1 lands taxable (paid out of our share) or exempt (nothing to include), and "nothing is added on top" is the owner's R1. Not quoting Stripe's dispute dollar figures is right: the page and the probe disagree on the answering fee, and any figure goes stale on Stripe's say.

Findings are in the hand-off report; the SHOULDs are:
1. Terms §4 (last bullet) and §7 promise that **Stripe's** fee comes back on a returned debit ("both parts"). Verified in test mode only, and the draft's own principle is "we promise only our own fee". Say ours comes back; Stripe's is Stripe's.
2. Privacy draft: the billing-address purpose says the address works out tax "to ... the fee FieldLogicHQ takes", but D1 is open and nothing computes that tax yet. Add "where it applies".
3. The privacy version must be live before the first Payments Terms tick on production (the placeholder tick already writes mig 497 rows). Add it to the draft's Before list.
4. Stale records: `LEGAL_FACTS.md` L95 (`fees_collector: 'application'`, "billed to FieldLogicHQ"), the Documents row for the payments terms (still 0.1, O3), backlog L3 (still "invoiced to it monthly").

## What the product does today
- Fee split: `lib/online-payment-fee.ts` (`onlineFee`, `stripeStandardCostCents`); accounts `fees_collector: 'stripe'`, `losses_collector: 'stripe'` (`lib/stripe-connect.ts:62`). The code never sets `debit_negative_balances`; "Stripe may debit your bank" rests on Stripe's default and the probe, which is why the terms say "may".
- The card's issuing country is still stored on `online_payments.card_country` (`lib/online-payment-landing.ts:1083`), so terms §11's "the country it was issued in" is true.
- Privacy draft passes `tests/unit/legal-draft-preview.test.ts` and `legal-documents.test.ts` (24 of 24, run 2026-11-18); the shape rules hold.
- `before.otherFees` / `record.otherFees` agree with §4 and §5. They say "outside your country" where the terms say "outside Canada"; the same thing while payments are Canadian-only (§14).

## Recommendation
Apply the SHOULDs before the owner approves v0.2 (O4). Owner questions: (a) O4 approval; (b) with the terms now stating that the passed-on fee is Stripe's cost plus our margin, a card payment on a $100 base charges the payer $5.00 against Stripe's $3.35 cost and a 2.4% cap, so the default "payer pays" is the sharper exposure (`CARD_SURCHARGE_PAYER_FEE.md`); decide whether to make "The club pays it" the default until Stripe answers in writing.

## Sources
- Internal only: the files named above; Stripe's Canadian pricing page as recorded in the plan and the v0.2 §5 note (read 2026-11-18 by the author, not re-fetched here).

## Lawyer's eye needed?
Yes, already listed in the draft: the passed-on fee against the surcharge cost-of-acceptance rule (sharper under v0.2), and "tax included" as a contract term against ETA s. 223 if D1 comes back taxable. Nothing else new.
