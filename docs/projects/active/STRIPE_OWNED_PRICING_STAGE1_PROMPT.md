# Stripe-owned pricing, Stage 1 — prove it and price it: kickoff prompt

Paste this into a fresh session. Written 2026-11-17 by the GST/HST Stage 5 kickoff session, at the owner's ask ("write up
this plan and get me the prompt to kick off the first phase").

---

You are opening **Stage 1 of Stripe-owned pricing** (plan of record:
`docs/projects/active/STRIPE_OWNED_PRICING_PLAN.md`; PM brief beside it). It is part of board project `payments`
(`docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`); status lives on the board. **This stage writes no product code.** It
proves in Stripe test mode that each club's account can pay Stripe's fees itself while we take only our margin. It settles
the margin-only pricing and records the owner's rulings, then writes the Stage 2 build prompt.

**What is ruled (2026-11-17, do not reopen; the plan's "Owner rulings" section has the reasons):**
- **R1:** the GST/HST on our online-payment fee is **included in the fee** and paid out of our share, with no monthly tax bill
  to clubs. This supersedes T2 for the application fee. T3 stands: the fee is our charge to the club, so the club's billing
  address decides the rate, and a US club pays 0%.
- **R2:** D1 (is our fee taxable or an exempt financial service?) goes to the owner's accountant before switch-on.
- **R3:** move to Stripe-owned pricing before launch, **starting with this trial**. If the trial says no-go, stay on today's
  model under R1.
- No professional is a gate (owner 2026-10-31, 2026-11-04).

**What exists (verify, don't assume):**
- `lib/stripe-connect.ts` creates v2 accounts on a preview API with `dashboard: 'express'`, `fees_collector:
  'application'` and `losses_collector: 'stripe'`. All three are immutable (Stage 12 plan §0d table, ~L547-569, including the
  2026-10-25 sandbox probe). `tests/unit/online-payments-guard.test.ts` ~L198-208 pins them.
- `lib/online-payment-fee.ts` `onlineFee()`: the application fee is the whole all-in fee, and the rates are
  `ONLINE_PAYMENT_RATES` in `lib/plan-config.ts`, held to `PLAN_PRICING_FACTS.md` by a test.
- Production has **0 payout accounts**, and online payments are locked off twice: the environment switch and the
  live-key lock.
- Stripe facts, read 2026-11-17 (the plan's "What Stripe says" lists the links): the June 2026 changelog allows Express +
  `fees_collector: 'stripe'` + `losses_collector: 'stripe'` on preview. ⚠ The SaaS overview says connected accounts carry
  their negative balances in this model, which conflicts with the changelog. Settle it.

**Do, in order:**
1. **Probe** (test key only; scripts in `.probe/`; never the live key; never a product file). Read `scripts/` probe
   conventions and the 2026-10-25 probe first. Create a Canadian v2 Express account with fees `stripe` and losses `stripe`
   on the current preview version, and onboard it with Stripe's test data. Then run each case and record, from **both**
   accounts' balance transactions, who was charged what:
   - (a) a card direct charge through Checkout, with an application fee equal to a margin-only figure;
   - (b) a PAD/ACSS debit;
   - (c) a foreign test card;
   - (d) a full refund and a part refund, with the application fee not refunded, matching today's rule;
   - (e) a dispute, won and lost;
   - (f) a returned debit;
   - (g) a payout to the club's test bank, recording whether any Connect payout or account fee hits our platform;
   - (h) the Express login link;
   - (i) a negative balance: whose is it?
   
   Write the results to `.probe/sop/` and summarise them in the plan's Stage 1 section.
2. **Go / no-go to the owner** in plain words, with the evidence, before anything else is recorded as decided.
3. **`/strategy`: the margin-only rate design.** The three options are in the plan's Stage 1 step 3. Compute our margin after
   the tax inside our fee (R1) at $100, $400, $800 and $1,000, card and bank, Ontario and a 15% province, from the probe's real
   fees. Recommend one, and the owner rules. Then run `/strategy`'s drift check against `PLAN_PRICING_FACTS.md` for the Stage 2
   change. Do not edit the Facts doc or `plan-config.ts` here; that is Stage 2.
4. **`/strategy` logs R1, R2, R3 and the rate ruling** in `BUSINESS_DECISIONS.md`, marking T2 superseded for the application fee.
5. **`/accounting`:**
   - Confirm the tax base is our application fee only, tax included by the club's province, with a US club at 0%, and that the
     tax point is when the fee is taken.
   - Update `PLATFORM_FEE_TAX_COLLECTION_METHOD.md`. Its (b) recommendation is overtaken by R1.
   - Flag `RECOVERED_STRIPE_FEES_TAX.md` to retire in Stage 4.
   - Write the accountant question list for R2: D1 first; then the 13/113 remittance and tax point for a fee withheld at
     payment; then US zero-rating evidence.
   
   **`/legal`:** a quick read of what changes in `PAYMENTS_TERMS.md` §4 (our fee becomes margin) and §5 (replaced by "Stripe
   charges your organization directly"), and whether Stripe-owned pricing changes the money-services position
   (`RPAA_FINTRAC_MONEY_SERVICES_STATUS.md`).
6. **Write `STRIPE_OWNED_PRICING_STAGE2_BUILD_PROMPT.md`** (accounts and the fee; see the plan's Stage 2). Update the `payments`
   board line in the same commit.

**Owner asks to carry (the plan lists them; ask, don't assume):**
- (Ruled 2026-11-17: the full payout test on/after 2026-11-25 runs as planned on today's model. Do not ask again.)
- The rate design.
- Keeping the billing-address step before payouts. The recommendation is yes.

**Process (repo rules):**
- Plan first. A plain-language summary for the owner before any decision is recorded.
- `/accounting` and `/strategy` before hand-off, since this changes what we charge.
- Stage explicit pathspecs only, and commit only on the owner's word.
- Online payments stay off in production throughout.
