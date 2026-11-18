# Stripe-owned pricing, Stage 2 — accounts and the fee: build prompt

Paste this into a fresh session. Written 2026-11-17 by the Stage 1 session (probe GO and rate design A, both ruled by the
owner that day).

---

You are building **Stage 2 of Stripe-owned pricing** (plan of record: `docs/projects/active/STRIPE_OWNED_PRICING_PLAN.md`;
PM brief beside it). Board project `payments` (`docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`); status lives on the board.
**This stage changes what we charge**: new club accounts let Stripe charge the club its own fees, and our application fee
becomes margin only. The family-facing rates do not move.

**What is ruled (2026-11-17, do not reopen; `BUSINESS_DECISIONS.md` top entry "Stripe-owned pricing…"):**
- **R3 + GO:** every new club account is created with `fees_collector: 'stripe'` and `losses_collector: 'stripe'` (Express,
  v2, on the preview version account creation already uses). Evidence: the plan's "Stage 1 probe results" and
  `.probe/sop/RESULTS.md`.
- **Rate design A:** family-facing rates unchanged (card 3.5% + $1.50, bank debit 2.5% + $1.00, on the base). **Our
  application fee = that fee less Stripe's standard Canadian cost for the payment**: card 2.9% + $0.30 on the whole charge
  (base + fee when families pay; the base when the club pays); pre-authorized debit 1% + $0.40 on the whole charge, capped
  at $5.00. The figures are in the plan's "Rate design: A" section; the probe matched them to the cent at $100
  (`.probe/sop/sop-7-margin.cjs` holds the arithmetic).
- **R1:** the GST/HST on our fee is inside it, paid out of our share; no tax line to anyone. Recording that tax is GST/HST
  Stage 5 (reshaped), **not this stage**.
- No professional is a gate. Online payments stay off in production throughout.

**What exists (verify, don't assume):**
- `lib/stripe-connect.ts` `createClubAccount()` (`fees_collector: 'application'` today; idempotency key per org).
  `tests/unit/online-payments-guard.test.ts` ~L204-212 pins the four account rulings.
- `lib/online-payment-fee.ts` `onlineFee()`: `applicationFeeCents` = the whole fee today; its tests in
  `tests/unit/online-payments-foundation.test.ts` ~L65-72 and `tests/unit/league-pay.test.ts` ~L72-91 assert that equality.
  The two pay routes (`app/api/pay/team/[token]/route.ts`, `app/api/pay/league/[token]/route.ts`) pass it to Checkout and
  refuse a payment whose fee reaches the total.
- `lib/plan-config.ts` `ONLINE_PAYMENT_RATES` + `FOREIGN_CARD_EXTRA_BPS`, held to `PLAN_PRICING_FACTS.md`'s
  facilitated-payments line by `tests/unit/plan-pricing-facts-agreement.test.ts` (and a test for the foreign-card figure).
- `online_payments` stores `fee_amount`, `fee_pct`, `fee_flat`, `fee_payer` (`DATA_DICTIONARY.md` ~L8858). **There is no
  stored application-fee figure**: today it equals `fee_amount`. Under A it does not.
- Dev club accounts were created with `fees_collector: 'application'`, which is **immutable**. Production has 0 payout
  accounts.

**Do, in order (plan first; PM UX summary before code):**
1. **The Stripe cost figure.** Add Stripe's standard Canadian cost beside `ONLINE_PAYMENT_RATES` in `lib/plan-config.ts`
   (card 290 bps + 30 cents; debit 100 bps + 40 cents, cap 500 cents). It is Stripe's published price, not ours: say so in
   its comment, with the read date. Extend the Facts-doc agreement test to hold it.
2. **The fee.** `onlineFee()` returns `applicationFeeCents` = fee − Stripe's standard cost on the charge (rounded as Stripe
   rounds, half-up to the cent; the probe's $105.00 card charge cost exactly $3.35). Family-pays: cost on base + fee.
   Club-pays: cost on the base. Rewrite the equality tests to the new rule, with the plan's table as cases ($100, $400,
   $800, $1,000; card and bank; both payers) and a tiny payment. Decide (and state) what happens if the margin would be
   ≤ 0 — it cannot be on today's rates, so a guard that refuses is enough.
3. **Store what we took.** Recommendation: a new `online_payments` column for the application fee, written when the
   Checkout opens, so a payment keeps what we took even if Stripe's published price later moves (the "stored, never
   recomputed" rule in `online-payment-fee.ts`'s header). Migration + `DATA_DICTIONARY.md` + snapshots in the same unit of
   work. GST/HST Stage 5 and Stripe-owned Stage 3 read it. `/accounting` (2026-11-17): Stripe Tax never sees an
   application fee, so this per-payment figure is the **only** source for the tax return. If you conclude it isn't needed,
   say why to the owner.
4. **The account.** `createClubAccount()` → `fees_collector: 'stripe'`; update the guard test's pinned value and the
   module header's account description. The preview version and the separate onboarding-link version stay as they are
   (the probe used both).
5. **Today's dev accounts.** They cannot be switched. Decide with the owner: re-create the dev/test club accounts (new
   `acct_`, re-onboarded with Stripe's test data — the owner does the hosted form; Stripe refuses ToS and identity from the
   platform on this account type), and how the code treats an old `application` account if one survives (refuse to take a
   payment on it, or keep the old whole-fee rule for it). Production has none, so this is a dev decision only.
6. **Words.** The Payouts card and the Before window: what Stripe takes and what we take; the club's net varies by Stripe's
   extras (foreign card, conversion, disputes). Run `/marketing` for the words; `/docs` for help articles that describe
   today's fee split (the monthly Stripe-fee invoice itself retires in Stage 4 — don't rewrite those articles twice; mark
   them for Stage 4/5 instead).
7. **The record.** Update `PLAN_PRICING_FACTS.md`'s facilitated-payments line in the same commit as `plan-config.ts`:
   application fee = margin; the new Stripe-cost figure; the tax rider (R1: inside, not on top — drift since 2026-11-17);
   "the organizer nets the full team fee" + "less Stripe's extra on a foreign card or currency conversion". The foreign-card,
   returned-debit and dispute riders stand until Stage 4 retires their machinery: mark them so. Then `/strategy` runs the
   drift check (the checklist at the foot of the Facts doc).
8. **Reviews before hand-off:** `/accounting` (this stage changes what we take per payment), `/legal` if any terms words
   move (the terms rewrite itself is Stage 5), `/review` on the diff.

**Not this stage:** the club's books recording Stripe's real fee (Stage 3); retiring the recovered-fee invoices, panels,
alerts and tables (Stage 4); terms §4/§5, help and the close (Stage 5); recording the tax inside our fee (GST/HST Stage 5).

**Owner asks to carry:** the old-dev-account rule (step 5); the stored application-fee column (step 3) if you depart from
the recommendation. Already ruled, don't ask again: the 2026-11-25 payout test runs on today's model (owner 2026-11-17).
Still open from the plan: keeping the billing-address step before payouts (Stage 4; recommendation yes).

**Process (repo rules):** stage explicit pathspecs only; commit only on the owner's word; the board line changes in the
same commit as the work; online payments stay off in production.
