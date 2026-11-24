# Proving online payments on the live site: may the owner pay himself?
**Last verified:** 2026-11-24
**Re-verify by:** 2027-11-24, or a trigger: Stripe's testing page changes its "Don't use real card details" line; Stripe
answers the owner in writing about a verification charge; or a real club on production takes its first payment (the
question then becomes moot).
**Depends on facts:** LEGAL_FACTS.md "Payments" (Connect direct charges, the club is the merchant of record, Accounts v2,
Express Dashboard, Stripe collects the processing fee from the club, Stripe carries negative balances);
ACCOUNTING_FACTS.md legal form (sole proprietorship). The FieldLogicHQ platform account is the same Stripe account
that bills our own plans.

## Question(s) this answers
Before the first live-money walk of online payments (`docs/projects/active/ONLINE_PAYMENTS_REAL_MONEY_WALK.html`) the
owner has no club on production. Proposed: make a private internal club, connect it to Stripe in live mode truthfully as
the owner himself (his own bank account), pay its team entry fee (about CA$11.85) with his own real card, refund CA$2.00
and watch the payout. Is that allowed? If not, what is the compliant way to prove the live flow?

## Finding
**Not allowed as proposed.** It is testing in live mode with real payment details, and Stripe's own documentation says
in so many words that the Services Agreement prohibits that.

- **Stripe's testing page, verbatim** (heading "Don't use real card details"): "The Stripe Services Agreement prohibits
  testing in live mode using real payment method details. Use your test API keys and the card numbers below." The
  sentence links to the Services Agreement.
- **How the Agreement carries it.** No separate "testing" clause was found in the General Terms (read in part; see
  Sources). The hook is §1.1: "User must use the Services solely for User's Business Purposes and in compliance with the
  Documentation." The testing page is Documentation, so breaching it breaches §1.1.
- **Two more problems specific to the proposal:**
  - The internal club has no business. Its connected account would exist only to receive the owner's own money for
    nothing sold. §1.1 limits use to "Business Purposes", and §1.2(a)(i) forbids using the Services "for personal,
    family, or household purposes". Onboarding truthfully means telling Stripe that the business is a test, which Stripe
    can refuse. Onboarding as if it were a real club would be untrue, and that is worse.
  - A payment that goes in and comes back out from the same person, with the platform's owner on both sides, is the
    shape a risk review looks for. §10.1(b) lets Stripe suspend where it reasonably believes the activity is unlawful or
    raises fraud risk. No Stripe text says a single small self-payment triggers that; the point is that the downside
    would land on the **platform** account, which also collects every customer's plan payments.
- **No carve-out.** Stripe's go-live checklist and its Connect testing page give no "make one small real payment"
  step. They say sandbox and live behave alike ("Switching between them is mostly a matter of swapping your API keys"),
  that Connect flows are tested with sandbox connected accounts, and that live connected accounts can't use test bank
  numbers. The checklist does ask you to confirm the live webhook endpoint is registered and works, which needs no
  payment.
- **Not found:** no Stripe text that names paying yourself, self-funding or cash advances on your own account (the
  restricted-businesses list does not). The prohibition rests on the testing sentence, not on a self-dealing rule.

## What the product does today
Not re-checked for this question; nothing in it turns on code. The walk as written requires "a real production club you
own" and the owner's own card, which is the shape this finding rules out.

## Recommendation
1. **Prove the live flow with the first real club's first real payment.** A real team paying a real entry fee to a real
   club is a business transaction, not a test, so the prohibition does not reach it. The club's owner does the
   onboarding (Parts A–B); the owner of FieldLogicHQ watches and checks our side (the receipt, the records, the webhook
   deliveries, the payout line). A refund is walked only if the club really gives one; never stage one.
2. **Everything that needs no money can be checked live now:** the switch-on (Part S on a real club), the live webhook
   destinations registered and healthy in our Stripe dashboard, and the Payments Terms page. Card-path behaviour was
   already walked in sandbox and stays proven there.
3. **If no real club is close and the owner wants certainty first:** ask Stripe support **in writing** whether one small
   verification charge on a platform-owned connected account is acceptable, and keep the answer. Only a written yes
   from Stripe changes this finding; a support chat's "should be fine" is weaker but still worth recording.
4. **Do not** connect the Riverdale demo or any fictional club to live Stripe, under any identity.

## Sources
- [Stripe Docs: Testing ("Don't use real card details")](https://docs.stripe.com/testing): accessed 2026-11-24, sentence
  read verbatim twice.
- [Stripe Services Agreement, General Terms](https://stripe.com/legal/ssa) (Last modified September 28, 2026; the Canadian
  page https://stripe.com/en-ca/legal/ssa showed the same text), §1.1, §1.2(a)(i), §10.1(b): accessed 2026-11-24. Only
  about 100k of 144k characters was read; a testing clause elsewhere is not ruled out.
- [Stripe Docs: Go-live checklist](https://docs.stripe.com/get-started/checklist/go-live): accessed 2026-11-24.
- [Stripe Docs: Testing Connect (Accounts v2)](https://docs.stripe.com/connect/testing?accounts-namespace=v2): accessed
  2026-11-24.
- [Stripe Prohibited and Restricted Businesses](https://stripe.com/legal/restricted-businesses): accessed 2026-11-24;
  nothing on self-payment.
- [Stripe Connected Account Agreement](https://stripe.com/legal/connect-account): accessed 2026-11-24; information given
  to Stripe must be accurate; nothing that bars a platform operator from being its own connected account.

## Lawyer's eye needed?
No. This is a supplier's usage rule, not a question of law. Stripe is the authority, and route 3 (a written answer from
Stripe) is the way to get more certainty.
