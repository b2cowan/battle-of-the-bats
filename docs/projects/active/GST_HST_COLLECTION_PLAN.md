# FieldLogicHQ's own sales tax — charging, recording and filing it correctly

> **Status:** PLANNED 2026-10-31 — nothing built. Written by the Accounting Agent from the research in
> `docs/agents/accounting/` (index: `ACCOUNTING_INDEX.md`). **Owner decisions T1–T7 RULED 2026-10-31** (§3; decision
> page https://claude.ai/artifact/Si21JDJNyhQLFjmaS9Wy3t, paste-back 7/7). US club payments review DONE 2026-10-31;
> its owner decisions U1–U5 RULED 2026-10-31 (§4 Stage 8a).
> **PM brief:** [GST_HST_COLLECTION_PM_BRIEF.md](GST_HST_COLLECTION_PM_BRIEF.md)
> **Not professional advice.** Items marked **[ACCT]** need the accountant, **[LAW]** the lawyer, before they are built
> or switched on.

## 0. Facts this plan starts from (2026-10-31)

- FieldLogicHQ is **registered for GST/HST** (number received the week of 2026-10-24). **Nothing has ever been sold**, so
  there is no past tax to correct — this plan is entirely forward-looking. Effective date on CRA's letter: unconfirmed
  (the revenue plan's D01 records a requested backdate to 2026-05-01).
- Registered means **every taxable sale carries tax from the first one** — the $30,000 small-supplier threshold no
  longer matters.
- Today the code charges **no tax anywhere**; Stripe Tax is on with **zero registrations**; prices are
  "tax behaviour unspecified"; **no organization or coach has an address, province or country on file**; there is **no
  FieldLogicHQ Terms of Service page** and the payments terms are a counsel placeholder; prices say "CAD" but never
  "plus tax"; club payout accounts are hard-wired to Canada/CAD; online payments are **off** in production.
- The business decision of 2026-10-26 ("no GST/HST on the payment fee — pre-revenue, below the threshold") and Club
  Stage 12's Ask 8 (a) rest on **not being registered**. That reason no longer holds (T2).

## 1. How this plan relates to the plans already in flight

This plan is the **single home for FieldLogicHQ's own tax** — the sequenced list of every tax change, across every
surface. It does **not** take over the surfaces themselves; each stage names the plan that owns the build.

| Surface | Owning plan | What this plan hands it |
|---|---|---|
| Subscription checkout, Stripe Tax, Connect, registrations | [Revenue readiness](REVENUE_ACCOUNTING_READINESS_PLAN.md) | Answers to its tax decisions D01, D05, D07, D08, D13, D17 and the tax part of D22; Stages 1–3 below are its "Canadian location/tax policy" work, made concrete |
| Owner bookkeeping (platform admin) | [Bookkeeping owner experience](BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md) | Stage 4 below: the **sales** side of GST/HST, which its ladder doesn't have yet (its Stage 4 is purchases only) |
| Our own invoices, plan & price changes | [Stripe from our own admin](STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md) + console Stage 10 | Its open question 1 is answered: yes, we charge GST/HST; invoices carry our number and tax lines; prices are tax-exclusive |
| Online-payment fee | [Club Stage 12 payments](CLUB_TIER_STAGE12_PAYMENTS_PLAN.md) | Stage 5 below; Ask 8 needs re-ruling |
| Terms, counsel questions | [Facilitated payments counsel brief](FACILITATED_PAYMENTS_COUNSEL_BRIEF.md) | Stage 6 below adds the subscription Terms of Service, which no plan owns today |
| US clubs | TODO line "US clubs get their own review" | Stage 8 below |

⚠ Drift noticed: the revenue plan still says the bookkeeping project is "stopped and archived" (§6, §7); it was
restarted as the owner-experience plan after 2026-10-23. Flag for that plan's next update.

## 2. End state — what is true when this plan is done

- **Every buyer has a location on file** (country, province/state, business or home address) before their first paid
  charge, and the product — not only Stripe — knows it.
- **Every subscription charge shows the right tax before the buyer pays**: 13/14/15% HST or 5% GST by province, 0% for a
  verified US buyer, plus provincial tax where FieldLogicHQ is registered there. Prices are shown "plus applicable taxes".
- **Every FieldLogicHQ invoice and receipt** carries the GST/HST registration number and the tax line, meeting CRA's
  $100 / $500 documentation tiers.
- **Every tax result has a recorded reason** — taxed in a province, zero-rated export (with its evidence), or not
  registered in that province — so a zero is never ambiguous.
- **The payment fee** carries the tax counsel and the accountant settle on, invoiced to the club monthly.
- **The books** show tax collected by province, zero-rated sales, tax paid on expenses (input tax credits), and a return
  worksheet that matches what is filed.
- **Terms of Service** exist, are accepted at signup with a recorded version, and say what the price includes.
- **Provincial registrations** (BC, Québec, Saskatchewan, Manitoba) happen when their thresholds say so, with Stripe
  watching.
- **US clubs** can subscribe at 0% with evidence; US clubs taking payments waits on its own review.

## 3. Owner decisions — RULED 2026-10-31

| # | Decision | Ruling (owner, 2026-10-31) | Notes |
|---|---|---|---|
| T1 | US clubs | **A, widened by the owner's note:** build the location and evidence plumbing for both countries now — **and the review of US clubs taking payments is part of THIS project.** Owner: *"I don't want to sell tournament or club subscriptions that can't take payments to American clubs, that weakens our product offer."* → **US clubs are not sold a payments-capable plan until US payments work.** | Reverses the 2026-10-23 "US subscriptions = expansion" scope (revenue plan §1). Follow-up ruled 2026-10-31: **every product, coach Premium included, opens to US customers together** once the US tax and payments work is done. |
| T2 | Tax on the payment fee | **A — tax ON TOP of the fee**, charged to the club; US clubs 0% | Supersedes the 2026-10-26 "no GST/HST on the fee" decision (its reason — not registered — no longer holds) and Club Stage 12 Ask 8 (a). If counsel later says the fee is exempt, stop charging it. → `/strategy` to log |
| T3 | Who the fee is legally charged to | **A — always the club**; "family pays" = the club passes its own cost on to its families | Lawyer writes it into the payments terms |
| T4 | Prices | **A — "plus applicable taxes"** (tax-exclusive) | → `/strategy` (Pricing Facts) + `/marketing` (copy) |
| T5 | Tax engine | **A — Stripe Tax** | Revisit if the 0.5% becomes material |
| T6 | Accountant | **C, with the owner's condition:** *prepare the package, but the accountant does not hold the launch.* Charge the rates we believe are right; any difference is caught at tax time. | Owner's reasoning: low early revenue makes any shortfall immaterial. **Does not change** the separate lawyer gate on online payments (Stage 12 counsel brief: RPAA, FINTRAC, payments terms) — that gate is about regulation, not tax amounts |
| T7 | US buyer evidence | **A — all three**: US address + declaration + one outside-Canada sign | Wording reviewed with the accountant package, not before launch |

## 4. Stages, in dependency order

### Stage 0 — Admin, no code (owner)
1. Find the **effective date** on CRA's registration letter; record it in the revenue plan's D01 (never the number
   itself in the repo).
2. **Give the GST/HST number to every foreign software vendor** that bills you (hosting, database, AI, email, domains,
   developer tools). Vendors under Canada's simplified regime stop charging GST/HST once they have it — and tax they
   charge you anyway is **not recoverable** as an input tax credit.
3. **Claim tax you pay on business expenses** from the effective date: keep receipts showing the supplier's GST/HST
   number (feeds Bookkeeping Stage 4).
4. Add your GST/HST number to the Stripe account's invoice settings so Stripe invoices and receipts show it.
5. Put the **first GST/HST return** on the calendar, and **file it even with nothing sold** (a nil return). If CRA
   assigned annual filing: for an individual with business income and a Dec 31 year end, the return is due **June 15**
   and any payment **April 30** — confirm on the CRA letter / My Business Account.
6. **Prepare the accountant package — NOT a launch gate (T6, ruled 2026-10-31).** It goes to the accountant at the first
   tax time (or sooner if the owner chooses); until then we charge what the research says. The package (most of it is already drafted in
   `REVENUE_ACCOUNTING_CANADA_ROLLOUT.md` §5 and `REVENUE_ACCOUNTING_PHASE0_TAX_REVIEW.csv`):
   (a) the place-of-supply and provincial matrix (D07) — confirm BC / SK / MB / QC registration timing;
   (b) the fee: taxable or exempt (T2), and invoicing it monthly;
   (c) the dispute / returned-debit / foreign-card cost recoveries invoiced to clubs — taxable with the fee or not;
   (d) the US evidence rule (T7);
   (e) is FieldLogicHQ a reporting platform under CRA's digital-platform reporting rules (due each January 31);
   (f) filing frequency and the effective date.
7. **[LAW]** The counsel brief already has the fee/terms questions; add T3 and the subscription Terms of Service (Stage 6).

### Stage 1 — Know where every buyer is
*Owner: revenue plan (D05). Needs T1.*
- Collect **billing country, province/state and address** for the paying organization (or the coach, who buys as an
  individual — home address) at the first paid checkout; require it on every Checkout path. Save it on our own records,
  not only on the Stripe customer.
- Country list = Canada + United States (T1); a province/state picker that follows the country. No PO Box as the only
  address.
- For a US address, the declaration (T7) as a required tick-box, stored with the date and terms version; capture the
  card-issuing country as the corroborator. Mismatches fall back to Canadian tax until resolved.
- Store the country Stripe verifies when a club sets up payouts (already stored) and compare it.
- Address changes later (customer portal) flow back to our records and to the next invoice's tax.
- No backfill is needed — there are no subscribers. Free and comped workspaces simply meet the step at their first paid
  checkout.

### Stage 2 — Subscriptions charge the right tax
*Owner: revenue plan (Gate A); invoices coordinate with Stripe-from-our-own-admin. Needs Stage 1, T4, T5, effective date.*
- Stripe Tax: add the **Canada (normal GST/HST)** registration with its effective date, origin Ontario.
- Every price **tax-exclusive**; confirm the software tax code on each product.
- **Automatic tax on every subscription Checkout path** (workspace plans, coach Premium, next-season choice, plan
  changes, the org add-on) and on any invoice we raise by hand. Offer tax-ID entry (a club's GST/QST number prints on its
  invoice; for a Canadian seller it must **not** remove GST/HST — prove it in test mode).
- **Everything that assumes "no tax" must learn tax**: the plan-move preview, the workspace-upgrade preview, the
  console's money reader, and the credit-note math on the pass-through invoices all currently assume or refuse tax
  lines (see §6). Adding tax is, in effect, a price change to every one of them.
- Customer portal: a FieldLogicHQ configuration (not Stripe's default) that keeps address and tax ID editable.
- **Shown before paying**: the amount, the tax by name ("HST 13%"), and the total, on every paid step.
- Pricing pages, plan panels and marketing: "**plus applicable taxes**" beside every price (→ `/marketing`; the Pricing
  Facts doc records tax-exclusive pricing → `/strategy`).
- **Test matrix**: one test buyer per province/territory group (ON, NS, NB/NL/PE, AB/territories, BC, SK, MB, QC) plus a
  US buyer and a mismatched buyer; renewals, plan changes, refunds and credit notes in each.

### Stage 3 — Every tax result has a reason, and staff can see it
*Owner: revenue plan (D17) + Support console Money tab.*
- For each FieldLogicHQ charge, keep: jurisdiction, tax type and rate, tax amount, **reason** (taxed / zero-rated
  export / not registered in that province) and the location evidence used at the time of sale.
- Platform admin's per-organization Money tab shows the tax on each charge and the buyer's tax location; a list of
  any charge whose reason is missing or contradicts the address.
- Business numbers report revenue **before tax** (tax collected is not revenue).

### Stage 4 — The books carry the sales side of GST/HST
*Owner: Bookkeeping owner-experience plan — add to its ladder; its Stage 4 (purchase-side capture) gets real money now
that input tax credits are claimable.*
- Tax **collected**, by province and type (GST, HST at each rate, PST/QST where registered).
- **Zero-rated sales** (US) as their own line.
- Tax **paid** on expenses (input tax credits), with the supplier's number — Bookkeeping Stage 4 as drawn.
- A **GST/HST return worksheet** for any period: sales, tax collected, credits, net owed — the figures that go on the
  return, each traceable to its charges (this is the accountant review's ask marked "New").
- Revenue rows from Stripe (Bookkeeping Stage 6) bring tax and pre-tax amounts separately; fees and payouts are never
  counted as revenue.
- USD amounts converted by one consistent method (Bank of Canada daily rate, or Stripe's conversion) — the stored rate
  already ruled for Bookkeeping.

### Stage 5 — The online-payment fee
*Owner: Club Stage 12. Gated on counsel and T2/T3. Online payments stay off in production until then.*
- If taxable: tax by the **club's** province, 0% for a verified US club (Stage 1 evidence applies to clubs too).
- A **monthly fee statement per club** — fees taken, tax on them, our GST/HST number — because Stripe's application fee
  is not a tax invoice and Stripe Tax does not tax it.
- How the tax is collected: added to the application fee at payment time vs billed monthly — decide with T2.
- The cost recoveries we invoice clubs (disputes, returned debits, foreign cards) follow the accountant's answer (Stage 0
  6c); their credit-note math changes with Stage 2.
- Club-facing words (set-up window, Payouts card, receipts) say what the fee includes; the payments terms say the fee
  is our charge to the club (T3).

### Stage 6 — Terms
*Owner: new — no plan owns a FieldLogicHQ Terms of Service today. [LAW]*
- **Terms of Service** for subscriptions: who the seller is (the owner, trading as FieldLogicHQ, Ontario), prices in CAD
  plus applicable taxes, renewals and cancellation (the ruled "plans end at the renewal date"), refunds, governing law.
- **Click-through acceptance at signup** with the terms version recorded (the payout set-up already records one for
  payments terms — reuse that shape).
- **Payments terms** (replacing the placeholder): club as merchant of record, the fee as our charge to the club, tax on
  the fee, fee not refunded, who carries disputes.
- Québec: the French-language / standard-form contract review already listed as revenue plan D20.
- A privacy policy for FieldLogicHQ itself (today only clubs' own privacy links exist) — not tax, but the same lawyer
  session.

### Stage 7 — Provincial registrations as they come due
- Stripe Tax monitors other provinces' thresholds for a Canada-based seller; it does not register you.
- **Before the first sale** into Saskatchewan or Manitoba, and as BC passes $10,000 or Québec passes $30,000 of
  sales to unregistered Québec buyers: register with that province, add it in Stripe Tax, record it in the accounting
  facts file. **[ACCT]** confirms which ones bite from the first sale.

### Stage 8 — US clubs (IN this project — T1 ruled 2026-10-31)
- **US clubs open for sale only when they can take payments** (owner). Subscriptions alone are tax-ready once Stages 1–3
  ship (0% with evidence, no US registrations at our scale; Stripe's US threshold monitoring on; a W-8BEN ready), but
  they are not offered to US clubs until the payments half below is done.
- **8a — the US payments review: DONE 2026-10-31** → `docs/agents/accounting/US_CLUB_PAYMENTS_REVIEW.md`.
  **Three blockers:** (1) Stripe's written confirmation that a Canadian platform can hold US direct-charge accounts, and
  at what Connect cost; (2) in today's set-up (the platform pays Stripe's fees) **FieldLogicHQ is the 1099-K filer** —
  needs a US EIN, IRS e-filing, state payer IDs, per-form penalties up to US$340, state thresholds as low as US$600;
  (3) the card fee added on top for families looks like a **card surcharge**, capped at 3% in the US (2.4% in Canada,
  the A14 question already owed to counsel), credit cards only, banned or capped in several states.
  **Owner rulings 2026-10-31 (U1, U2, U3, U5 as recommended; U4 recommendation pending his yes):**
  - **All products — including coach Premium — open to US customers together**, once this project's US work is done.
  - **U1** US clubs pay Stripe's fees directly, so Stripe files the 1099-Ks; FieldLogicHQ keeps only its own fee, which
    needs a separate margin-only US fee schedule → `/strategy` (amounts NOT decided).
  - **U2** no fee added on top for US families — the club pays it (or builds it into its registration price).
  - **U3** ACH bank debit included for US clubs (U1 puts its return/dispute risk on the club, not FieldLogicHQ).
  - **U4 RULED: all 50 states + DC at once, no waitlist.** Made safe by a **per-state US tracker in platform admin**
    (US sales AND number of payments by state — some states still trigger at 200 transactions — with an alert well before
    any threshold; a state-specific check when one alerts) and **no club-side sales tax at launch**. US territories
    (e.g. Puerto Rico) get their own check later.
  - **U5 RULED (owner overrode the recommendation): NO US lawyer before launch.** Same reasoning as T6: open, and bring in
    a lawyer when US sales grow to need one — no legal fees while selling to few clubs in few states. **Bring-in triggers:**
    the tracker alerts in any state; Stripe or a regulator asks about licensing or tax; or **U1 proves impossible** (if
    Stripe can't file the 1099-Ks for our US clubs, per-form penalties return and a US CPA is needed before the first US
    payment). The Stripe written confirmation (blocker 1) is a free support ticket and stays a blocker.
- **8b — the build** the review calls for. Known already:
  - club payout accounts by the club's own country, in USD (today hard-wired to Canada/CAD);
  - who files the US 1099-K forms — Stripe's rule makes the platform the filer under today's set-up (the platform pays
    Stripe's fees) — decide the set-up or file through Stripe;
  - a US marketplace-facilitator opinion for the first clubs' states;
  - currency on cross-border registrations (a Canadian team paying a US tournament in USD).

### Ongoing — the operating rhythm (owner)
- Monthly: Bookkeeping close; check charges with a missing tax reason.
- Each return: run the Stage 4 worksheet, file, pay.
- Each January: CRA digital-platform report if the accountant says it applies (due Jan 31).
- Each year, and at every trigger (new province, first US club, incorporation): `/accounting` re-verifies its topics.

## 5. Order and dependencies (no dates — sequencing only)

Stage 0 first: it's free and makes money (vendor tax stops, credits start). Stage 1 → 2 → 3 is one chain and is the
gate for the **first paid subscription**. Stage 6's Terms of Service also gates the first paid subscription. The
accountant is **not** a gate (T6). Stage 4 can run beside 1–3 inside the Bookkeeping ladder and must be in place before
the first return with sales on it. Stage 5 waits on counsel (the existing lawyer gate) and gates online payments going
live. Stage 7 is triggered, not scheduled. Stage 8 opens US clubs only when both its halves are done: Stages 1–3 for
subscriptions, and 8a → 8b for payments.

## 6. Technical touchpoints (for the build sessions)

- Checkout sessions with no tax/address settings: `lib/billing-setup.ts:113`, `app/api/billing/create-checkout/route.ts:387`,
  `app/api/billing/create-team-checkout/route.ts:333` (coach Premium; creates a new customer per click at :324),
  `app/api/billing/choose-next-season/route.ts:180`, `lib/team-org-billing.ts:825`; Connect `lib/stripe-connect.ts:141`.
- Customers created with email only: `lib/billing-setup.ts:51`, `lib/team-org-billing.ts:798`.
- Code that assumes no tax: `lib/plan-move-preview-lines.ts:11,63` (returns null on tax lines),
  `lib/workspace-upgrade-preview.ts:29`, `lib/console-money-stripe.ts:173`, `lib/platform-stripe-fees.ts:339,448-451`
  (credit-note math; invoices with memo/footer only).
- Portal on Stripe's default configuration: `app/api/billing/portal/route.ts:53`.
- No address/country columns on organizations (`supabase/migrations/001_multi_tenant.sql`); payout country exists
  (`org_payment_accounts.country`, mig 358) and card country (mig 390). Any new column → DATA_DICTIONARY + snapshots.
- Canada/CAD hard-wiring for US payments: `lib/stripe-connect.ts:42-45,130`; `America/Toronto` in `lib/plan-config.ts`.
- Price copy without "plus tax": `app/pricing/page.tsx:23,482`, `app/for-clubs/page.tsx:94,308`,
  `app/for-coaches/page.tsx:119`, `components/PricingSection.tsx`.
- Payments terms placeholder: `lib/online-payment-words.ts:39-41`; acceptance columns mig 358 (+401, 403).
- Read-only Stripe audit to re-run after Stage 2: `scripts/audit-revenue-readiness.mjs`.

## 7. Risks

- **Turning on tax is a price change** to every preview and credit note that assumes none — Stage 2 must ship them
  together, or the product shows one amount and Stripe charges another.
- **A missing address silently becomes the wrong tax** (Stripe falls back to card/IP; CRA's fallback is the highest
  rate) — Stage 1 makes the address required, not optional.
- **The fee wording (T3)** decides whether we ever have to locate families; get it into the terms before payments go live.
- **Provincial registrations** can be owed from the first sale (SK, MB). Accepted by the owner (T6): at low early revenue
  the shortfall is small and is settled at tax time. BC and Québec owe nothing at all until their thresholds.
- **Over-collected tax on the fee** (T2): if counsel later rules the fee exempt, tax already charged to clubs must still be
  remitted or refunded to them — small at launch volume, but stop charging it the day the answer lands.
