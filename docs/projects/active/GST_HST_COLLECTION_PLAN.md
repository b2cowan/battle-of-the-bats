# FieldLogicHQ's own sales tax — charging, recording and filing it correctly

> **Status:** PLANNED 2026-10-31 — nothing built. Written by the Accounting Agent from the research in
> `docs/agents/accounting/` (index: `ACCOUNTING_INDEX.md`). **Owner decisions T1–T7 RULED 2026-10-31** (§3; decision
> page https://claude.ai/artifact/Si21JDJNyhQLFjmaS9Wy3t, paste-back 7/7). US club payments review DONE 2026-10-31;
> its owner decisions U1–U5 RULED 2026-10-31 (§4 Stage 8a).
> **PM brief:** [GST_HST_COLLECTION_PM_BRIEF.md](GST_HST_COLLECTION_PM_BRIEF.md)
> **Sequence rulings (owner, 2026-10-31, all as recommended)** — cross-plan index
> https://claude.ai/artifact/Kua6RAqMA7ChA7QBTNE63a (source `BILLING_TAX_PRICING_SEQUENCE_INDEX.html`). For this plan:
> **(1)** the app creates and pins its own Stripe portal configuration (Stage 2's portal bullet stands; it is built in Plans &
> pricing Stage 0, S8); **(4)** one `/marketing` call settles how a price reads with "plus applicable taxes" beside the ruled
> "$29 CAD / month per team" form, before Plan & billing's help rewrite; **(5)** Stage 2's rework list includes the
> Premium→Club "Due today" window (see Stage 2).
> **Not professional advice.** Items marked **[ACCT]** need the accountant, **[LAW]** legal questions (`/legal` drafts and
> researches them). Neither is a gate: no accountant (T6), no US lawyer (U5) and, since 2026-11-04, no Canadian lawyer holds a
> build or a switch-on (owner).

## Stage list of record (owner, 2026-10-31)

Every outstanding piece of work in this plan has a home in one of these stages. Status anchors are the plan's own header
(nothing built as of 2026-10-31).

- **Stage 0 — Admin, no code (owner):** IN PROGRESS — effective date found (2026-09-26) and production sales answered
  (owner replies, §4); still open: Stripe invoice settings, foreign-vendor number, ITC receipts, accountant package,
  counsel add-ons. Waits on nothing; gates nothing.
- **Stage 1 — Know where every buyer is:** DONE — Parts 1+2 committed `fd55a1df3` 2026-11-04 (mig 433 dev only), Part 3
  committed `32d466e59` 2026-11-04, Part 4 (the guard) committed `95dbdcbec` 2026-11-04, Part 5 (closeout: `/accounting` review, help, the first-time plan screen
  fix, US wording v2) committed `1ab0bfb6f` 2026-11-04; owner walk §454 PASSED 34/34 2026-11-04, Part B re-walked on Part 6 (`e8e37a408`) and passed 2026-11-05; **Stage 1 CLOSED 2026-11-05** — country, province/state, address and US declaration on our own
  records. Needs T1 (ruled).
- **Stage 2 — Subscriptions charge the right tax:** BUILT AND WALKED (owner walk §471 PASSED 36/36 2026-11-06; the live-account prerequisites below ride to Stage 9) (build prompt `GST_HST_STAGE2_BUILD_PROMPT.md`; its ▶ Progress block holds each part's commit) — Parts 0–4 and 2b committed 2026-11-05 (walk §463 passed); Part 5 (the guard: every Stripe charge and quote carries tax or is on a short untaxed list with its reason) built 2026-11-05; Part 6 (the Stripe test matrix) RUN 2026-11-05 — every path and buyer group charges the tax it quoted, except two money defects stopped and recorded in the Progress block: recovered Stripe fees taxed at Ontario 13% for every club (tax code fixed 2026-11-05 on the owner's yes, re-run passed) and platform admin's refund making no credit note (→ /plan); Part 7 (closeout) BUILT + reviewed 2026-11-06 (Q1 step by the gap, Q2 credit-note PDF and fee pay link for refund staff only, the Premium → Club stamp hardened, help "Taxes: what you're charged and why"; /accounting cleared; /simplify + /review no Critical or High), owner walk §471 PASSED 36/36 2026-11-06; the exit-step audit read 2026-11-06 says live does NOT match yet (0 registrations, default not exclusive): promote prerequisites in MANUAL_PROD_STEPS (446's note). Was: Part 7 (closeout) next — Stripe Tax registration, tax on every checkout path and
  preview, "plus applicable taxes", province test matrix; exit step re-runs the Stripe audit. Needs Stage 1, T4, T5.
- **Stage 3 — Every tax result has a reason, and staff can see it:** CLOSED 2026-11-07 (Part 5 `a42af2c45`, walks §477–§479 PASSED, closeout `3bc1457e0`) — Part 0 ruled 2026-11-06 (Ask 2 revised after the probe: Stripe never says "zero-rated" for a US buyer, so the record carries OUR GST/HST answer beside Stripe's lines); Part 1 (the kept tax record, mig 451 applied to dev 2026-11-06) built 2026-11-06 — status home: GST_HST_STAGE3_BUILD_PROMPT.md ▶ Progress
  (`GST_HST_STAGE3_BUILD_PROMPT.md`; its Part 0 puts five asks to the owner first) — charge-level tax record and the Money
  tab. Needs Stage 2 (walked, §471).
- **Stage 4 — The books carry the sales side of GST/HST:** BUILT AND WALKED 2026-11-08 (4a §474 PASSED 55/55; 4b §488 and §494 PASSED); owed: production apply of Bookkeeping migration 007 with the code. DRAWN + RULED 2026-11-06 (every ask A; facts: registered from
  Sept 26, 2026 with a CRA backdate to May 1 pending, so the date is a changeable setting; annual filer; no quick method) —
  drawings https://claude.ai/artifact/LbCjjVcnZeTP8uUT3yVZan (source `GST_HST_STAGE4_DRAWINGS.html`); return lines in
  `docs/agents/accounting/GST_HST_RETURN_LINES.md`. **4a (what we pay) BUILT: Sessions A–E committed 2026-11-06 (f68ebf9fe, 7fac17654, a9a22921e, 0f16bf9a3, f83cbe24e, be2316ef0; reviewed + `/accounting` before hand-off); Bookkeeping migration 006 applied to development 2026-11-06; owner walk §474 PASSED 55/55 2026-11-06 (https://claude.ai/artifact/QGGWeuRKiD2HKehdbH3pQb). Record: `GST_HST_STAGE4A_BUILD_PROMPT.md` Progress.**
  **4b (the worksheet): Sessions A and B committed 2026-11-07 (`035f5e965`); Session C ("Mark as filed", Bookkeeping migration 007) built and
  reviewed 2026-11-07, applied to development 2026-11-07, committed `27c03ff78` 2026-11-08, owner walk §488 closed 2026-11-08, production apply with the code; Session D (the package: gst-hst-worksheet / credits / as-filed) built and reviewed 2026-11-08, committed `b44a22e7a` 2026-11-08, `/accounting` applied, `/review` no High or Medium, walk §494 PASSED 2026-11-08 (part F: as-filed file keeps any return filed inside the package's dates; the walk's two dev filings and test expense wait for the owner's admin AWS sign-in, which had expired on 2026-11-08; the dev backup drill is deferred by the owner). Record: `GST_HST_STAGE4B_BUILD_PROMPT.md`
  Progress; `/accounting` §10 (after filing: more ITC → a later return's line 106; more tax → adjust the filed return).** Stage 3 is closed (§477–§479, `3bc1457e0`). The kickoff audit found the
  Reports View control does not exist in code (ladder row 3 is drawn and ruled, not built; Stage 2 accounts and the Q13 mapping are also unbuilt), so
  waiting for the whole redesign would hold 4b behind them. **Owner ruling 2026-11-07: build a thin View control first** (hidden until a second view
  exists; Reports looks unchanged until 4b adds "GST/HST return"), then 4b. Prompts: `BOOKKEEPING_REPORTS_VIEW_CONTROL_BUILD_PROMPT.md` (one
  session, may run beside 4b Session A) and `GST_HST_STAGE4B_BUILD_PROMPT.md` (A the numbers, B the view, C Mark as filed, D the package; PM brief
  `GST_HST_STAGE4B_PM_BRIEF.md`). `/accounting` reviewed 2026-11-07 (`GST_HST_RETURN_LINES.md` §8): a bare void earns no line 107 adjustment (the
  drawings' "reversal on 107" is withdrawn), invoices before the registration date sit outside the return, a USD credit note's tax uses the original
  invoice's rate. Must exist before the first return with sales on it.
- **Stage 5 — The online-payment fee:** NOT STARTED — tax on the fee, monthly statement per club. (Its address step is
  done: brought forward as Stage 2 Part 2b, committed `947fd8192` 2026-11-05.) Depends on Club Stage 12,
  T2/T3, and **closes with Club Stage 12** (a required stage, not a trigger).
- **Stage 6 — Terms:** PLANNED 2026-11-08 → [GST_HST_STAGE6_TERMS_PLAN.md](GST_HST_STAGE6_TERMS_PLAN.md) (+ PM brief); owner decision sheet (O1–O8, P1–P7 + three lookups) owed. Drafts v0.1 under `docs/agents/legal/drafts/`, not approved, not published. The renewal-date cancel is on production since the 2026-11-05 release (`d10261fdd`); what is left is in the plan's §5 (refresh, pages + links, acceptance at every door, the purchase email, the org-delete files fix, reviews, publication). Payments terms (L3) need no work until payments are switched on. Kickoff: [GST_HST_STAGE6_KICKOFF_PROMPT.md](GST_HST_STAGE6_KICKOFF_PROMPT.md).
  `/legal` drafts it, the owner approves it (no lawyer gate, owner 2026-11-04); gates the first paid subscription of any plan not yet on sale.
- **Stage 7 — Provincial registrations as they come due:** NOT STARTED — **STANDING TRIGGER** (BC $10,000, Québec $30,000,
  first Saskatchewan or Manitoba sale).
- **Stage 8 — US clubs:** 8a DONE 2026-10-31 (review + rulings U1–U5). **8b NOT STARTED — STANDING TRIGGER** (Stripe's
  written confirmation + US demand): USD prices and grandfathering (D03/D04), U2, U3, the U4 per-state tracker, USD payout
  accounts, 1099-K set-up, marketplace-facilitator opinion.
- **Stage 9 — Release and docs:** NOT STARTED (new, 2026-10-31) — help articles and `/docs`, demo check, data dictionary
  and snapshots, production migrations, `/accounting` review, owner walk, on production. Needs Stages 1–3 (and 6).
- **Ongoing — operating rhythm:** STANDING TRIGGER — monthly close and missing-reason check, each return, the January
  digital-platform report, the yearly `/accounting` re-verify.

**Done when** Stages 0–6 and 9 are complete. **Standing triggers (not needed to close):** Stage 7 (provincial
registrations), Stage 8b (US clubs), the Ongoing rhythm (returns, January report, yearly re-verify), and the first
GST/HST return (owner: out of scope, sequence item i04).

## 0. Facts this plan starts from (2026-10-31)

- FieldLogicHQ is **registered for GST/HST** (number received the week of 2026-10-24). **Nothing has ever been sold**, so
  there is no past tax to correct — this plan is entirely forward-looking. Effective date on CRA's letter: **2026-09-26**
  (owner, confirmed 2026-10-31); a backdate request to 2026-05-01 is pending with CRA and affects only rebates on past
  expenses, not this project (revenue plan D01).
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

⚠ Drift noticed: the revenue plan still said the bookkeeping project is "stopped and archived" (§6, §7); it was
restarted as the owner-experience plan after 2026-10-23. **Fixed in the revenue plan 2026-10-31** (see its "Scope after the
2026-10-31 hand-off"). Gate B (registration payments) moved out of the revenue plan to Club Stage 12; the books side to the
Bookkeeping plan; tax stays here.

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
| T6 | Accountant | **C, with the owner's condition:** *prepare the package, but the accountant does not hold the launch.* Charge the rates we believe are right; any difference is caught at tax time. | Owner's reasoning: low early revenue makes any shortfall immaterial. ~~Does not change the separate lawyer gate on online payments~~ — **that gate was removed too (owner 2026-11-04)**; online payments go live on the owner's decision once real payments terms exist |
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
5. ~~Put the **first GST/HST return** on the calendar, and **file it even with nothing sold** (a nil return).~~
   **OUT OF SCOPE for this project (owner, 2026-10-31):** the first return is handled next year, outside this work; it is a
   standing trigger (see "Stage list of record" above). For reference only: if CRA assigned annual filing, for an
   individual with business income and a Dec 31 year end the return is due **June 15** and any payment **April 30** —
   confirm on the CRA letter / My Business Account.
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

**Owner replies on Stage 0, 2026-10-31 (recorded as given):**
- **Production today (sequence item 5):** the Coaches Portal and Premium tournament plans can be bought; nobody is buying yet.
  Owner's view: a sale before tax is built is minor and does not affect this project. ⚠ **One correction to the reasoning:**
  because FieldLogicHQ is registered, the $30,000 small-supplier threshold no longer lets it skip tax (§0, and the
  Accounting Facts doc). A sale made before Stage 2 is still taxable: FieldLogicHQ owes the tax on it even though the buyer
  was not charged it, so it comes out of FieldLogicHQ's own pocket (the accountant confirms the exact mechanics). The amount is small and does not change the plan; it is a reason to keep the first-sale gate.
- **Effective date (item 1):** the effective date on the registration is **2026-09-26**, with a backdate request to CRA
  pending (owner, confirmed 2026-10-31: it affects only rebates on past expenses, not this project).
  Annual filing, Dec 31 year end; a nil return is expected for the first period.
- **Stripe invoice and receipt settings (item 2):** not done. Owner: not a prerequisite; done in parallel with the build.
- **Foreign vendors (item 1 of the list above):** none has been given the number yet. The six categories are right, plus a
  small OpenAI Codex subscription. **Owner, 2026-10-31: an accountant confirmed that the GST/HST paid on these is rebatable
  in a year with little or no revenue (any amount over sales comes back),** so this is not a concern for 2026. This
  settles the point for a no-revenue year; it overrides this plan's warning that tax a vendor charges after being told not to
  is lost. It does not remove the reason to give vendors the number once sales begin, when tax paid and tax collected net
  against each other. Giving the number stays a low-priority desk task, not a gate.

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
- Address changes later happen on our own Plan & billing window only, which copies them onto the Stripe customer (owner
  ruling 2026-11-04, Stage 1 Part 3: Stripe's billing page no longer edits the address, so a refused edit can never sit on
  Stripe looking saved, and the US tick cannot be skipped). The card and payout countries are compared again whenever the
  address, the card or the payout account changes.
- No backfill is needed — there are no subscribers. Free and comped workspaces simply meet the step at their first paid
  checkout.

### Stage 2 — Subscriptions charge the right tax
*Owner: revenue plan (Gate A); invoices coordinate with Stripe-from-our-own-admin. Needs Stage 1, T4, T5, effective date.*
- Stripe Tax: add the **Canada (normal GST/HST)** registration with its effective date, origin Ontario.
- Every price **tax-exclusive**; confirm the software tax code on each product.
- **Automatic tax on every subscription Checkout path** (workspace plans, coach Premium, next-season choice, plan
  changes, the org add-on) and on any invoice we raise by hand. Offer tax-ID entry (a club's GST/QST number prints on its
  invoice; for a Canadian seller it must **not** remove GST/HST — prove it in test mode).
- **Everything that assumes "no tax" must learn tax**: the plan-move preview, the workspace-upgrade preview (incl. the
  Premium→Club "Due today" window — built with no tax line, and its quote creates no customer, so it must quote against
  the buyer's address or it will disagree with checkout; sequence ruling (5), 2026-10-31), the
  console's money reader, and the credit-note math on the pass-through invoices all currently assume or refuse tax
  lines (see §6). Adding tax is, in effect, a price change to every one of them. **Also (added 2026-11-02, `/accounting` on
  Plans end at renewal Part C):** the billing page's Keep {Plan} window and the "Your plan will renew on {date} at {price}"
  email quote the renewal charge from one helper (`W.plan.charge`, `lib/plan-billing-words.ts`) with no tax — it gains
  "plus applicable taxes" (T4) in the same pass.
- Customer portal: a FieldLogicHQ configuration (not Stripe's default) that keeps tax ID editable. **Not the address**
  (owner ruling 2026-11-04, Stage 1 Part 3: portal v2; the address is edited on Plan & billing only).
- **Shown before paying**: the amount, the tax by name ("HST 13%"), and the total, on every paid step.
- Pricing pages, plan panels and marketing: "**plus applicable taxes**" beside every price (→ `/marketing`; the Pricing
  Facts doc records tax-exclusive pricing → `/strategy`).
- **Test matrix**: one test buyer per province/territory group (ON, NS, NB/NL/PE, AB/territories, BC, SK, MB, QC) plus a
  US buyer and a mismatched buyer; renewals, plan changes, refunds and credit notes in each.
- **Carried from Stage 1 (owner 2026-11-04, Part 5 Ask 1; detail in `GST_HST_STAGE1_BUILD_PROMPT.md` ▶ Progress):**
  (a) **address strictness before tax goes live** — check the province against the postal code (the province sets the rate:
  "Ontario" with a BC postal code would be taxed wrong); PO Box workarounds ("Lockbox 5") and US territories/military codes
  are low. (b) **the resolve** for a country-change flag: a CA→US→CA buyer stays flagged and its sentence names the old move;
  a refused "Start your club" can leave the club row saved (a retry with the other country flags it); an abandoned in-place
  checkout leaves the club address on the coach's lapsed Premium customer. (c) **one polish line:** Yearly resets to Monthly
  after Change on "Billed to"; two gates on one screen don't share a saved answer; the sign-up Next can double-fire while the
  first address read is pending; a Stripe stamp error at checkout is a 500; the address read runs on mount even when unused.
- **Exit step (owner, 2026-10-31):** re-run the read-only revenue-readiness Stripe audit
  (`scripts/audit-revenue-readiness.mjs`, §6) after Stage 2 ships, and record that the tax settings it reads now match.
  **Read 2026-11-06 (Part 7): they do not match yet** — live has 0 registrations and default behaviour "Automatic"; both are owner
  steps before the promote (Ask 7). Re-run at the promote; stop if either fails.
- **Follow-ups after Stage 2 (recorded 2026-11-06, not built):** (a) **Q4 (owner ruling):** Plan & billing's fee row shows
  "Refunded $X · credit note" for a refunded fee invoice — a `/plan` item. (b) **/review Lows from Part 7:** the fee-invoice email's
  lines can disagree with its Total when the Stripe customer has a balance; a fee waiting for an address reads to the club as
  "couldn't be billed yet" and the daily retry clears the operator reason; a Stripe customer with only a country passes the
  "has an address" check; a coach whose `full_name` is empty gets no buyer name even with `name` set (with the known first/last-name
  gap); a refused move down can leave a bare schedule on the subscription; a slow Stripe can take a refund preview past its 30 s
  limit (fails safe). Detail: the Stage 2 build prompt ▶ Progress, Part 7.

### Stage 3 — Every tax result has a reason, and staff can see it
*Owner: revenue plan (D17) + Support console Money tab.*
- For each FieldLogicHQ charge, keep: jurisdiction, tax type and rate, tax amount, **reason** (taxed / zero-rated
  export / not registered in that province) and the location evidence used at the time of sale.
  **(`/accounting` 2026-11-04, Stage 1 closeout):** the evidence is a COPY on the charge's own record (address,
  province/country, declaration version + date, card and payout country, review state), not a link to the buyer's
  `billing_locations` row: that row is the CURRENT location, is overwritten on a change and deletes with the club or person
  (ON DELETE CASCADE). The charge record must survive deleting the buyer for six years
  (`docs/agents/accounting/RECORDS_RETENTION_AND_LOCATION.md`). Required before the first zero-rated US sale (Stage 8).
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
- ~~Revenue rows from Stripe (Bookkeeping Stage 6) bring tax and pre-tax amounts separately~~ **Ruled 2026-11-06 (Stage 4
  Ask 2 = A): the worksheet's sales and tax come ONLY from Stage 3's per-invoice record**; Bookkeeping Stage 6 keeps fees,
  refunds as money movements and payouts. Fees and payouts are never counted as revenue.
- ~~USD amounts converted by one consistent method (Bank of Canada daily rate, or Stripe's conversion)~~ **Ruled 2026-11-06
  (Ask 4 = A): a USD sale is valued at the Bank of Canada daily rate on the invoice's issue date**, stored on Stage 3's
  record with the rate and date; Stripe's CAD figure is a cross-check only. Expenses keep the Bookkeeping rule (the CAD
  actually charged, with its source).
- **Rulings 2026-11-06 (drawings tab 10):** 1 build 4a now, 4b after Stage 3 · 2 one source (above) · 3 a credit shows on the
  worksheet and on each expense, never the Overview; Reports shows tax paid · 4 Bank of Canada (above) · 5 a missing number
  from $100 holds the credit, never blocks, with an “I can't get the number” exit · 6 “Supplier's registration” per expense,
  filled in from the last same-name expense; Not checked counts but is listed before filing · 7 the worksheet is a Reports
  view · 8 “Kind of purchase” + CRA's rules · 10 tax paid by type on today's Reports in 4a · 11 Stage 3 backfills since
  registration · 12 “Mark as filed” freezes a period.

### Stage 5 — The online-payment fee
*Owner: Club Stage 12. Gated on T2/T3 (counsel no longer a gate, owner 2026-11-04). Online payments stay off in production until the owner switches them on.
**Depends on Club Stage 12 and closes with it (owner, 2026-10-31) — it is a required stage of this project, not a standing
trigger:** this plan is not done until Club Stage 12's fee-tax work ships.*
- If taxable: tax by the **club's** province, 0% for a verified US club (Stage 1 evidence applies to clubs too).
  **(`/accounting` 2026-11-04, Stage 1 closeout):** Stage 1 asks for the address only at a paid plan checkout, so a club
  taking payments with no paid plan (comped, free time, Founding) has no address on file, and the payout account's verified
  country gives no province. This stage asks the club for its billing address when it sets up payouts (or before its first
  fee or cost-recovery invoice), and the cost-recovery invoice joins the every-path guard then. **Brought forward into Stage 2
  (owner Ask 8, 2026-11-05: asked when a club turns on online payments, the same Billing address window; a club without one
  waits, fees unbilled) because Stage 2 Part 2 already taxes the recovered fees — built as Stage 2 Part 2b, see
  [GST_HST_STAGE2_BUILD_PROMPT.md](GST_HST_STAGE2_BUILD_PROMPT.md).** The families' location is
  never needed while the fee is our charge to the club (T3).
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
  session. **(owner 2026-11-04, Stage 1 closeout):** a `/legal` agent, shaped like `/accounting`, drafts
  these terms and policies — **built 2026-11-04** (`docs/agents/legal/LEGAL_INDEX.md`, backlog L1–L3, L7); the Stage 1 address window already states the purpose at collection ("We use it
  only to work out sales tax…").

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
  **Owner rulings 2026-10-31 (U1, U2, U3 as recommended; U4 and U5 RULED — see below, U5 overrode the recommendation):**
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
- **8b — the build** the review calls for. **A standing trigger** (owner, 2026-10-31): it starts when Stripe's written
  confirmation arrives and US demand exists; this plan counts as complete without it. Named deliverables:
  - **USD list prices and grandfathering (revenue plan D03/D04)** — plus the margin-only US fee schedule (U1, `/strategy`);
  - **U2** — no fee added on top for US families (the club pays it, or builds it into its registration price);
  - **U3** — ACH bank debit for US clubs;
  - **U4 — the per-state US tracker in platform admin** (sales and payment counts by state, alert well before any
    threshold, a state-specific check when one alerts);
  - club payout accounts by the club's own country, in USD (today hard-wired to Canada/CAD);
  - who files the US 1099-K forms — Stripe's rule makes the platform the filer under today's set-up (the platform pays
    Stripe's fees) — decide the set-up or file through Stripe;
  - a US marketplace-facilitator opinion for the first clubs' states;
  - currency on cross-border registrations (a Canadian team paying a US tournament in USD).

### Stage 9 — Release and docs (added by owner ruling, 2026-10-31)
*Owner: this plan. Closes the project; no earlier stage is "done" without it. Needs Stages 1–3 built (and Stage 6 for the
Terms wording).*
- **Help articles and `/docs`** for the new address step at first paid checkout and for the tax lines on every paid step
  (checkout, billing screens, invoices and receipts) — the in-app guides in `lib/help-content/*.tsx`, with their search text.
- **Demo check**: the demo sandboxes still pass the build's tour check with the new address step; any number quoted in a
  demo sentence is computed from the seed.
- **Data dictionary and snapshots**: every new address, tax and reason column documented in
  `docs/agents/db/DATA_DICTIONARY.md` and `npm run refresh:snapshots` run; the **migrations applied on production**.
- **`/accounting` pre-handoff review** (CLAUDE.md requires it for work that changes what we charge, collect or record):
  applied, or recorded as an owner question.
- **Owner browser walk** of the checkout, the preview windows and the Money tab with tax on, in test mode first.
- **On production**: the Stripe Tax registration live, the `scripts/audit-revenue-readiness.mjs` re-run clean, and the
  release recorded in the release-history record.

### Ongoing — the operating rhythm (owner)
*Standing triggers — none of this is needed to close the project (see "Stage list of record").*
- Monthly: Bookkeeping close; check charges with a missing tax reason.
- Each return: run the Stage 4 worksheet, file, pay.
- Each January: CRA digital-platform report if the accountant says it applies (due Jan 31).
- Each year, and at every trigger (new province, first US club, incorporation): `/accounting` re-verifies its topics.

## 5. Order and dependencies (no dates — sequencing only)

**Order across the five plans (set by Claude at the owner's request 2026-10-31; the owner may reverse it on the index; index
https://claude.ai/artifact/Kua6RAqMA7ChA7QBTNE63a):** **0 owner desk (this plan's Stage 0)** → 1 Plan & billing 4b Part 4 → 2 Plans
& pricing Stage 0 → **3 Stage 1 (the address), beside Plans end at renewal Stages 1–3** → **4 Stages 2–3 and the Terms (tax live)**
→ 5 ONE help pass → 6 Club on sale (Coaches Portal and Tournament Plus already selling; "launch together" dropped 2026-10-31) → 7 Plans & pricing program. Stage 0 gates nothing in steps 1–4 (owner,
2026-10-31); it is free and its savings begin the day it is done.

Stage 0 first: it's free and makes money (vendor tax stops, credits start). Stage 1 → 2 → 3 is one chain and is the
gate for the **first paid subscription of any plan not yet on sale**. Stage 6's Terms of Service also gates it. ⚠ Owner
exception, 2026-10-31: Coaches Portal and Tournament Plus are already on sale in production and stay on sale; a sale made
before tax is built is paid out of the owner's revenue and blocks nothing. The
accountant is **not** a gate (T6). Stage 4 can run beside 1–3 inside the Bookkeeping ladder and must be in place before
the first return with sales on it. Stage 5 waits on Club Stage 12 (no lawyer gate since 2026-11-04) and gates online payments going
live. Stage 7 is triggered, not scheduled. Stage 8 opens US clubs only when both its halves are done: Stages 1–3 for
subscriptions, and 8a → 8b for payments. Stage 9 (release and docs) follows the build stages and closes the project; Stage 7,
Stage 8b and the Ongoing rhythm are standing triggers that the project does not wait for (owner, 2026-10-31).

## 6. Technical touchpoints (for the build sessions)

- Checkout sessions with no tax/address settings: `lib/billing-setup.ts:113`, `app/api/billing/create-checkout/route.ts:387`,
  `app/api/billing/create-team-checkout/route.ts:333` (coach Premium; creates a new customer per click at :324),
  `app/api/billing/choose-next-season/route.ts:180`, `lib/team-org-billing.ts:825`; Connect `lib/stripe-connect.ts:141`.
- Customers created with email only: `lib/billing-setup.ts:51`, `lib/team-org-billing.ts:798`.
- Code that assumes no tax: `lib/plan-move-preview-lines.ts:11,63` (returns null on tax lines),
  `lib/workspace-upgrade-preview.ts:29`, `lib/console-money-stripe.ts:173`, `lib/platform-stripe-fees.ts:339,448-451`
  (credit-note math; invoices with memo/footer only).
- Portal on Stripe's default configuration: `app/api/billing/portal/route.ts:53`. *(Updated 2026-11-01, `/accounting` review of
  Plans & pricing Stage 0: Part 3 replaced this with our own pinned configuration, `lib/stripe-portal-settings.ts`, version
  `1`; Stage 2's tax-ID field is switched on there by bumping the version.)*
- No address/country columns on organizations (`supabase/migrations/001_multi_tenant.sql`); payout country exists
  (`org_payment_accounts.country`, mig 358) and card country (mig 390). Any new column → DATA_DICTIONARY + snapshots.
- Canada/CAD hard-wiring for US payments: `lib/stripe-connect.ts:42-45,130`; `America/Toronto` in `lib/plan-config.ts`.
- Price copy without "plus tax": `app/pricing/page.tsx:23,482`, `app/for-clubs/page.tsx:94,308`,
  `app/for-coaches/page.tsx:119`, `components/PricingSection.tsx`. *(Added 2026-11-01, `/accounting` review of Plans &
  pricing Stage 0: Plan & billing's own price line now prints what the customer pays, `W.plan.paidPrice` in
  `BillingBody.tsx`, from `organizations.subscription_amount_cents`, the price's pre-tax `unit_amount`. Once tax is
  charged that line is the price, not the total: it needs the same "plus applicable taxes" wording.)*
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
