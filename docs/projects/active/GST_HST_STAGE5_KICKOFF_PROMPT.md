# GST/HST Stage 5 — the online-payment fee: kickoff prompt

> **⚠ Overtaken 2026-11-17 — do not paste this as written.** The session that ran it reached owner rulings R1 (the tax is
> included in our fee and paid out of our share, so there is no monthly tax bill; this supersedes T2 for the application fee),
> R2 (D1 goes to the accountant) and R3 (Stripe-owned pricing before launch). Stage 5 is on hold behind
> [STRIPE_OWNED_PRICING_PLAN.md](STRIPE_OWNED_PRICING_PLAN.md) Stage 2. Write a fresh Stage 5 prompt then.

Paste this into a fresh session. Written 2026-11-17 by the `/legal` payments-terms session, at the owner's ask ("for tax,
what stage is that in the GST plan? can we get working on that stage now?").

---

You are opening **GST/HST Stage 5 — the online-payment fee** (plan of record:
`docs/projects/active/GST_HST_COLLECTION_PLAN.md` § "Stage 5 — The online-payment fee", and the status line near the top).
It has not started. It closes together with Club Stage 12 (Families pay online), and it is one of the things that must be
true before the owner switches online payments on. Status lives on the board
(`docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`, projects `gst-hst` and `payments`).

**What is ruled (do not reopen):**
- **T2:** GST/HST is charged **on top of** our online-payment fee, to the club; a US club pays 0%. If the fee is ever
  ruled an exempt financial service, the tax stops. (`BUSINESS_DECISIONS.md` ~L545; supersedes the 2026-10-26 "no tax on
  the fee" and Club Stage 12 Ask 8 (a).)
- **T3:** the fee is always legally FieldLogicHQ's charge to the club; "families pay it" is the club passing on its own cost.
  So only the club's billing address decides the tax. (`BUSINESS_DECISIONS.md` ~L547.)
- No professional is a gate (owner 2026-10-31, 2026-11-04). `/accounting` flags; the owner decides when.

**What already exists (verify, don't assume):**
- The club's billing address is asked for before payouts are set up (Stage 2 Part 2b, `947fd8192`).
- A **monthly invoice per club** already exists for the recovered Stripe fees (disputes, returned debits, foreign cards):
  sent on the 1st, due in 30 days, Stripe automatic tax, riding the next plan invoice when there is one
  (`lib/platform-stripe-fees.ts`, `sendMonthlyFeeInvoices`; tax code in `lib/billing-tax.ts`).
- **No tax is charged on the application fee today**, and there is no statement of fees taken (census 2026-11-17).
  Stripe's application fee is not a tax invoice, and Stripe Tax does not tax it.

**What this stage decides and builds:**
1. **`/accounting` first** (route it; don't answer from memory): `PLATFORM_FEE_TAX_TREATMENT.md` (D1, taxable vs exempt,
   still open) and `RECOVERED_STRIPE_FEES_TAX.md` ("the two must never diverge"). The open choice is **how the tax is
   collected**: (a) added to the application fee at payment time, or (b) billed monthly on a statement, which could be a
   line on the existing monthly Stripe-fees invoice. Get `/accounting`'s recommendation with its reasons, including what a
   valid GST/HST invoice needs (our registration number, the club's name, the tax by rate) and how (a) or (b) lands in the
   owner's Bookkeeping and the GST/HST return (Stage 4).
2. **A monthly fee statement per club**: fees taken, the tax on them, our GST/HST number. It is visible to the club where
   it already reads its Stripe fees (Settings › Plan & billing).
3. **Club-facing words** (the Before window, the Payouts card, receipts) say the fee is plus tax. The payments terms draft
   (`docs/agents/legal/drafts/PAYMENTS_TERMS.md` §4) already says "plus any sales tax that applies to it … worked out from
   your organization's billing address"; keep the product's words matched to it.
4. The product's "passes them on to you" line for recovered fees vs taxing them as our own supply is a known wording
   mismatch (`/accounting`'s call; noted in the payments terms draft §5).

**Process (repo rules):** plan first, then a **plain-language UX summary for the owner before any code** (AGENCY_RULES);
this is billing and tax work, so the `/accounting` review runs before hand-off; a change to what we charge or invoice also
runs `/strategy`'s drift check against `PLAN_PRICING_FACTS.md`. Write the build prompt(s) as
`GST_HST_STAGE5_BUILD_PROMPT.md` and update the board lines in the same commit. Online payments stay off in production
throughout (two locks: the environment switch and the live-key lock).
