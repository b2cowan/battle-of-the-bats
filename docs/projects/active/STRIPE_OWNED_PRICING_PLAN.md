# Stripe charges the club for processing; we keep only our margin ("Stripe-owned pricing")

**Written:** 2026-11-17, from the GST/HST Stage 5 kickoff session (owner conversation; see "Why" below).
**Part of:** Families pay online (Club Tier Stage 12) — board project `payments`. Status lives on the board, not here.
**PM brief:** [STRIPE_OWNED_PRICING_PM_BRIEF.md](STRIPE_OWNED_PRICING_PM_BRIEF.md)
**First phase prompt:** [STRIPE_OWNED_PRICING_STAGE1_PROMPT.md](STRIPE_OWNED_PRICING_STAGE1_PROMPT.md)
**Holds:** [GST/HST Stage 5](GST_HST_COLLECTION_PLAN.md) (the tax on our fee) is reshaped by this plan and waits on its Stage 2.

---

## Owner rulings, 2026-11-17 (this conversation)

- **R1 — The GST/HST on our online-payment fee is included in the fee, paid out of our share.** No monthly tax bill to
  clubs. Reason (owner): a club believes what it paid at checkout is the whole cost; a later "you owe us more" bill sours
  first customers and invites complaints and non-payment. Revisit adding tax at purchase later, if Stripe can do it at
  payment time, and change the terms then if we choose. **Supersedes T2 for the application fee** (`BUSINESS_DECISIONS.md`
  ~L545). T3 is unchanged: the fee is FieldLogicHQ's charge to the club, so the club's billing address decides the rate.
  → `/strategy` logs it (Stage 1 step 4).
- **R2 — D1 goes to the accountant before online payments switch on:** is our payment fee a taxable supply or an exempt
  financial service? (Stripe treats its own processing as exempt.) The questions to bring are in Stage 1 step 5.
- **R3 — Move to Stripe-owned pricing before launch, starting with a test-mode trial.** Stripe charges each club's
  account for its own processing (and disputes, returned debits, foreign cards); FieldLogicHQ takes only its margin as the
  application fee. This plan.

Not ruled (do not record as ruled): the margin-only rate design (Stage 1 step 3); whether the billing-address-before-payouts
step stays (Stage 4). (The full payout test on/after 2026-11-25 runs as planned on today's model: owner, 2026-11-17.)

## Why

What the code does today (`lib/stripe-connect.ts` creates every club account with `fees_collector: 'application'`):
FieldLogicHQ pays Stripe's processing fee out of the all-in 3.5% + $1.50, plus the Connect payout fee (0.25% + $0.25 per
payout) and $2 a month per active account, and then bills each club monthly for disputes, returned debits and foreign cards.

The cost check (Stripe's Canadian pages read 2026-11-17: card 2.9% + $0.30; PAD 1% + $0.40 capped at $5; Connect "you
handle pricing" $2/active account/month + 0.25% + $0.25 per payout, plus an unclear "funds routing" 0.25% line) on a
$1,000 card payment, family pays, Ontario, tax included (R1):

| | Today (we pay Stripe) | Stripe-owned pricing |
|---|---|---|
| Family pays | $1,036.50 | $1,036.50 (if the family-facing number is kept) |
| Stripe processing | ~$30.36, from our fee | ~$30.36, from the club's balance |
| Payout + account fees | ~$2.50 + $0.25 + $2/month, ours | none (Stripe's Connect page) |
| Our application fee | $36.50 | ~$6.14 (margin only) |
| GST/HST inside our fee (13/113) | ~$4.20 | ~$0.71 |
| **We keep** | **about −$0.56** | **about +$5.43** |

At today's model, card payments lose money above about $640 in Ontario and $460 in the 15% provinces. Under Stripe-owned
pricing the tax base is our margin only, Stripe's costs never pass through our books, and the monthly Stripe-fee invoice
(the very "you owe us more" bill R1 objects to) is no longer needed.

**Why now:** the fee setting is **immutable** on an account (Stage 12 plan §0d table). Production has **0 payout accounts**
(`RECOVERED_STRIPE_FEES_TAX.md`, 2026-11-05; online payments locked off twice). Switching after clubs connect means every
club onboards again.

**What Stripe says** (read 2026-11-17):
- [SaaS platform monetization](https://docs.stripe.com/connect/saas): in the Stripe-owned model connected accounts pay
  Stripe fees, carry their negative balances, take direct charges; the platform earns subscriptions, **an application fee
  per transaction**, and possibly a revenue share. "Stripe doesn't charge your platform in this model."
- [Changelog 2026-06-24](https://docs.stripe.com/changelog/dahlia/2026-06-24/express-connected-accounts-v2-stripe-owned-pricing-negative-balance-liability):
  Express accounts on v2 now allow `fees_collector: 'stripe'` + `losses_collector: 'stripe'` — **preview API**
  (`2026-06-24.preview` or later). Our current accounts already depend on a preview (`2026-09-30.preview`) for losses.
  ⚠ The Stripe SaaS overview says "connected accounts … assume liability for their negative balances" in this model,
  while the changelog says `losses_collector: 'stripe'` means Stripe absorbs them. Stage 1 settles which applies to us.
- [Direct charges](https://docs.stripe.com/connect/direct-charges.md?platform=web&ui=stripe-hosted): the connected account
  receives the charge less Stripe fees and the application fee; no Stripe fee on the application fee itself; application
  fees are not refunded unless asked.

## What the club and family see after

- **Family:** unchanged if the family-facing fee number is kept — one fee line at checkout, no tax line (T3).
- **Club:** Stripe's processing fee comes out of its Stripe balance on each payment; disputes ($15), returned debits ($5),
  foreign cards (+0.8%) and conversion (+2%) come out the same way, automatically. **No monthly Stripe-fee invoice from us,
  no overdue banner, no reminder emails.** The club's books show Stripe's real fee on each payment as a cost line.
  The Payouts card and terms say what Stripe takes and what we take.
- **Changed promise:** "the club always receives the full fee" becomes "the club receives the fee, less Stripe's extra on
  the rare foreign card or currency conversion" — which is what it already pays today, by our invoice, afterwards.
- **Us (platform admin):** no Stripe-fees panel, no fee invoices to chase, no tax on recovered fees. Our income from
  payments is our margin only; Bookkeeping records it with its tax (GST/HST Stage 5, reshaped).

## Stages

Each stage gets its own build prompt, written at the end of the stage before it. Plan first, PM UX summary before code,
`/accounting` before hand-off on any stage that changes what we charge or record, `/strategy` drift check on any rate change,
`/legal` on any change to what a club agrees to. Online payments stay off in production throughout.

### Stage 1 — Prove it and price it (no product code)
Prompt: [STRIPE_OWNED_PRICING_STAGE1_PROMPT.md](STRIPE_OWNED_PRICING_STAGE1_PROMPT.md).
1. Test-mode probe (`.probe/`, test key only) on the Express + v2 preview: create a Canadian account with fees `stripe`
   and losses `stripe`; onboard it; run card, PAD, foreign-card, refund, dispute (won and lost) and payout cases. Record
   who is charged what, from the balance transactions on both accounts. Confirm the Express login link still works, and
   whether negative balances are Stripe's or the club's.
2. **Go / no-go** to the owner, with the evidence. No-go fallback: stay on today's model with R1 at 3.5% or ~3.75%.
3. `/strategy`: the margin-only rate design. Options: (A) keep one family-facing number (3.5% + $1.50 card, 2.5% + $1.00
   bank) and set our application fee to that number less Stripe's standard domestic cost; (B) publish the two parts
   ("Stripe's processing + our fee"); (C) a margin-only fee the club sees, with Stripe's fee visible in its own dashboard.
   Recommendation in the prompt; owner rules. Updates `PLAN_PRICING_FACTS.md` + `lib/plan-config.ts` in Stage 2, not here.
4. `/strategy` logs R1, R2, R3 (and the rate ruling) in `BUSINESS_DECISIONS.md`.
5. `/accounting`: tax base = our application fee only, tax included (R1), by club province, US 0%; tax point = when the fee
   is taken; the accountant question list (D1 first). `/legal`: a quick read of money-services and payments-terms impact
   (§4 margin, §5 replaced by "Stripe charges your organization directly").
6. Write the Stage 2 build prompt; update the board line in the same commit.

#### Stage 1 probe results (test mode, 2026-11-17)
Full record: `.probe/sop/RESULTS.md` (scripts `sop-*.cjs`, raw output beside them). Probe account `acct_1Ud0FDFuSu8KhK2Q`,
Canada, v2, Express, `fees_collector: stripe` + `losses_collector: stripe`, created on `2026-09-30.preview` (the version
`lib/stripe-connect.ts` already uses). Stripe's v1 view of it: `fees.payer = account`, `losses.payments = stripe`.

- **Creation:** accepted first try. **Onboarding:** Stripe refuses ToS acceptance and identity documents from the platform on
  this account type; the club does both on Stripe's hosted form, exactly as today. The owner completed it with test data.
- **Figures** ($100 registration; card: family pays $105.00, application fee $1.65; bank: $103.50, fee $2.06):

| Case | Stripe charged the club | Club nets | Platform |
|---|---|---|---|
| CA card (direct charge) | $3.35 | $100.00 | +$1.65, Stripe fee $0 |
| PAD/ACSS debit | $1.44 | $100.00 | +$2.06, fee $0 |
| US / UK card | $4.19 (incl. 0.8% intl) | $99.16 | +$1.65 |
| Full refund, fee not refunded | Stripe keeps its $3.35 | out $5.00 (as today) | keeps $1.65 |
| Dispute won / lost | $15 dispute fee, **not returned on a win** | out $15 / out $120 | keeps fee, not debited |
| Debit returned (NSF) | Stripe fee returned; **our fee auto-refunded to the club** | $0 | −$2.06 |
| Debit disputed | $5 dispute fee | — | keeps fee |
| Payout $233.70 (standard) | fee $0 | paid | no line at all |

- **Checkout:** a Checkout Session on the club's account with `payment_intent_data.application_fee_amount` is accepted.
- **Express login link:** refused before onboarding finished, works after.
- **Negative balance:** after disputes and a refund that followed a payout, the club's available balance read −$240 and then
  −$500; the platform was never debited. Stripe's two pages reconcile: the club owes its own negative balance first
  (`debit_negative_balances: true`, Stripe may debit its bank); if it cannot pay, Stripe absorbs it (`losses_collector:
  stripe`: "Your platform has no financial liability if a connected account can't cover a refund or chargeback").
- **Not provable in test mode:** Connect's live-only platform fees (billed outside the balance); Stripe's SaaS page says
  "Stripe doesn't charge your platform in this model". A returned debit charged no failure fee in test mode.
- **Side finding:** Stripe's SaaS page offers platforms in this model a revenue share "when your connected accounts meet
  product activation targets". Ask Stripe before launch.
- **Go / no-go: GO** (owner 2026-11-17, on this evidence).

#### Rate design: A, ruled 2026-11-17
Owner: "agree with your recommendation". Logged with R1–R3 in `BUSINESS_DECISIONS.md` 2026-11-17 "Stripe-owned pricing…".
- **Family-facing rates unchanged:** card 3.5% + $1.50, bank debit 2.5% + $1.00, on the base.
- **Our application fee = that fee less Stripe's standard Canadian cost for the payment:** card 2.9% + $0.30 on the whole
  charge; PAD 1% + $0.40 capped at $5 (Stripe's published prices; the probe charged exactly these). Held as a new figure
  beside `ONLINE_PAYMENT_RATES`, held to the Facts doc by the same test. Club-pays mode: Stripe's cost is on the base.
- **What we keep after the tax inside our fee** (families pay; Ontario / 15% province; `.probe/sop/out-7-margin.txt`):

| Base | Card | Bank |
|---|---|---|
| $100 | $1.46 / $1.43 | $1.82 / $1.79 |
| $400 | $2.79 / $2.74 | $5.74 / $5.64 |
| $800 | $4.55 / $4.47 | $14.16 / $13.91 |
| $1,000 | $5.43 / $5.34 | $18.58 / $18.26 |

  Today's model, card, Ontario: $0.57, $0.12, −$0.50, −$0.81.
- Rejected: B (two lines to families: surcharge-rule exposure, and Stripe's real cost is unknown at checkout); C (club
  absorbs Stripe's cost: every club nets ~3.35% less; kept as the shape for the US schedule, amounts still owed).
- **Drift check for Stage 2** (`PLAN_PRICING_FACTS.md`, no edits in Stage 1): the facilitated-payments line's "application
  fee is the whole fee", the tax rider (still says on top; R1 put it inside, drift since 2026-11-17 until Stage 2), the
  foreign-card / returned-debit / dispute riders (retire in Stage 4), the code-homes sentence (new Stripe-cost figure), and
  "the organizer nets the full team fee" (+ "less Stripe's extra on a foreign card or conversion"). The family-facing
  rates, every plan price, band, SKU, key and gate are untouched, so no pricing page or plan card changes.

### Stage 2 — Accounts and the fee
New accounts created with Stripe-owned pricing; our application fee becomes margin only per the Stage 1 ruling; the rate
record (Facts doc + plan config + their tests) updated; dev test accounts re-created (the setting is immutable); the
account-setting guard test updated to the new pinned values; Payouts card and Before window words. `/strategy` drift check.

### Stage 3 — The club's books record Stripe's real fee
Today the club's books record only our fee (and only when the club pays it). Under Stripe-owned pricing Stripe's fee comes
off the club's balance on every payment, whoever pays our fee, and Stripe keeps it on a refund. Each payment's landing
reads Stripe's fee from the charge and books it as its own "Payment processing" cost; refunds leave it in place. The
delicate stage: the land and refund functions for tournaments and leagues, a stored Stripe-fee figure per payment, and the
Payouts tab's existing Stripe-fee lines checked against it.

### Stage 4 — Retire the recovered-fee machinery
The monthly Stripe-fee invoices, their daily job, the club's Stripe-fees list, alert line and overdue banner, the
platform-admin Stripe-fees panel and retry, the invoice emails, the fee kind in the tax records, the foreign-card rate, and
their tests (about 20 code files, 6 dedicated test files, two tables retired by migration with the data dictionary and
snapshots). Owner/`/accounting` call: keep the billing-address-before-payouts step (we still need the club's province for
the tax inside our fee) — likely yes.

### Stage 5 — Words, help, terms, close
Payments terms §4/§5 (`/legal`), help articles (org, tournaments, house league, accounting, platform admin — `/docs`),
the Facts doc's riders, accounting topic files (`RECOVERED_STRIPE_FEES_TAX.md` retires), the Stage 12 plan's §0d table.
**`/accounting` review, 2026-11-17 (Stage 1):** confirmed — the tax base is our application fee only; the tax is included
(13/113 ON, 14/114 NS, 15/115 NB/NL/PE, 5/105 elsewhere) by the club's billing address, a US club 0%; the tax point is the
charge date (a debit's fee shows on our balance days before it settles: an accountant check). Stripe Tax never sees an
application fee, so **our own per-fee record is the only source for the return** (Stage 2's stored application fee, then
GST/HST Stage 5). A returned debit auto-refunds our fee: the tax comes back off only with a credit record (s.232), so Stage 5
writes one. A club-ticked refund or a lost dispute leaves our fee and its tax in place. Files:
`PLATFORM_FEE_TAX_COLLECTION_METHOD.md` (superseded by "The R1 method"), `RECOVERED_STRIPE_FEES_TAX.md` (retires in Stage 4),
the accountant list `STRIPE_OWNED_PRICING_ACCOUNTANT_QUESTIONS.md` (D1 first; the new facts lean slightly toward taxable, not
a conclusion). It recommends **keeping the billing-address-before-payouts step**: the province must be known before the
first fee.

**`/legal` read, 2026-11-17 (Stage 1), what Stage 5 must carry:**
- `drafts/PAYMENTS_TERMS.md` §4: cut "out of it we pay Stripe's own processing fee"; Stripe takes its fee from the club's
  balance and ours separately; tax "plus" → "included" (D1 still open); "not refunded" covers our margin, and Stripe also
  keeps its fee on a refund; a returned debit gives both fees back; the club's net in each payer mode. §6's "the whole
  fee comes out of your balance" gets the same split.
- §5 ("Other Stripe fees we bill") is replaced by "Stripe charges your organization directly": Stripe's agreement and
  pricing; disputes ($15 card / $5 debit, not returned on a win), foreign card, conversion; the net varies; the club's own
  negative balance first, with Stripe able to debit its bank (we promise nothing about Stripe's backstop); Stripe can
  change its fees. §3, §7, §10 and §12 mention the billed fees too.
- **Privacy policy version 2026-11-17** (`lib/legal-documents/privacy/2026-11-17.md` ~L34, L48, L174) names "a club's
  monthly invoice for its Stripe fees": true until Stage 4, so a new privacy version ships with the payments-terms
  rewrite. The billing address stays needed (the tax inside our fee), so that row's purpose changes, not the data.
- Product words in `lib/online-payment-words.ts` (~L97-100, 397, 427, 503, 1280-1405) describe the billed fees →
  `/marketing` + `/docs` in Stage 4/5.
- `CARD_SURCHARGE_PAYER_FEE.md`: the family fee stays above Stripe's real cost with our margin as the gap, which sharpens
  the "no more than the cost of acceptance" point a little; the owner's O2 ruling stands. Flag for a lawyer's eye.
- Money services (`RPAA_FINTRAC_MONEY_SERVICES_STATUS.md`): **neutral to slightly helpful** (Stripe still nets our fee;
  we carry no pass-through). Add `fees_collector` / `losses_collector` changes to its re-verify triggers; re-read it
  before accepting any Stripe revenue share.

Owner walk. Then GST/HST Stage 5 (reshaped: the tax inside our fee recorded per paid fee so Bookkeeping and the return
pick it up, and an information-only fee statement in Plan & billing) can build on the final fee shape.

## Open asks for the owner

1. ~~The full payout test booked for on/after 2026-11-25 runs on today's model.~~ **RULED 2026-11-17 (owner): run it as
   planned** — it proves payouts reach a bank, which does not change; the fee lines are re-tested after Stage 3.
2. Rate design (Stage 1 step 3).
3. Keep the billing-address step before payouts (Stage 4) — recommendation yes.

## Risks

- **Preview API.** Express + Stripe-owned pricing is a 2026-06-24 preview; a preview can change. Our accounts already
  ride a preview; Stage 1 probes it, and the fallback is today's model.
- **The club's net varies** by Stripe's own extras. Words must say so plainly.
- **Sunk work.** The recovered-fee invoicing and fee-invoice alerts were built and walked. They are retired, not reworked.
- **The figures above are estimates** from Stripe's public pages; Stage 1's balance transactions replace them.
