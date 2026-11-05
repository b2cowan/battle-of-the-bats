# GST/HST · Stage 2: subscriptions charge the right tax (build prompt)

> Written 2026-11-05. Plan of record: [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §4 "Stage 2" (and §3 T2, T4, T5, T7, §6
> touchpoints, §7 risks); PM brief [GST_HST_COLLECTION_PM_BRIEF.md](GST_HST_COLLECTION_PM_BRIEF.md). Stage 1 (every buyer's billing
> address is on our own records) is CLOSED 2026-11-05: [GST_HST_STAGE1_BUILD_PROMPT.md](GST_HST_STAGE1_BUILD_PROMPT.md) ▶ Progress holds
> what it built and what it handed to this stage. Recommended model: Opus for Part 0 and Part 1 (design-shaped, money); Sonnet is
> enough for Parts 3–5.
> Mark each fact you rely on [V] (verified by you this session, with file:line) or [H] (handed to you, unverified). Lines marked
> **[V 2026-11-05]** below were read in the code the day this was written; everything else is [H], including every line number.

## What this stage is, in one paragraph

Today no charge FieldLogicHQ makes carries tax: **nothing in `app/` or `lib/` sets `automatic_tax`, `tax_id_collection`,
`customer_update` or `tax_behavior`** [V 2026-11-05, grep]. FieldLogicHQ is registered for GST/HST, so every taxable sale owes
tax from the first one. Stage 2 turns Stripe Tax on for every subscription charge (T5), prices stay tax-exclusive ("plus
applicable taxes", T4), and **every screen and email that quotes a price learns about tax in the same release**, because turning
tax on is a price change to all of them (plan §7: the product must never show one amount while Stripe charges another). Stage 1
already put the address on the Stripe customer; this stage makes Stripe use it.

## ▶ Progress (read first when resuming)

**Part 0 answered 2026-11-05: owner ruled ALL ASKS AS RECOMMENDED** (wording below in "Rulings"). Sandbox Stripe Tax set up
and verified (the Club · Association product now `txcd_10103001`, confirmed by API).

**Part 1 BUILT 2026-11-05, committed `aafea07b9` 2026-11-05 (with Part 0's records)** (typecheck clean; 151 billing unit tests pass; `verify:changed` 14242 pass / 7 fail,
all 7 in files this stage did not touch — support-console foot sentences, bookkeeping ExpenseFormWindow, practice-plan phone
N1, two walk-page guards, the free-time route's 503):
- `lib/billing-tax.ts` (new): `decideBuyerTax` (address → Stripe, flagged US held with `billing_review_hold`, no address →
  `billing_address_required`), `taxWasWorkedOut` (a preview counts only when `automatic_tax.status === 'complete'`),
  `AUTOMATIC_TAX`, `BILLING_TAX_WORDS` (held / notWorkedOut / plusTax). Tests `tests/unit/billing-tax.test.ts`.
- `requireBillingLocation` now answers through `decideBuyerTax` (reads the row after any save; `currentReview` only for a US
  row, with the live payout country). Every paid path already calls it, so the hold reaches every path at once.
- Ask 4: `CA_POSTAL_FIRST_LETTERS` + the check in `checkBillingLocation` ("A postal code in Ontario starts with K, L, M, N or
  P."). A stored row that fails it now reads as "no valid address" and the buyer is asked again before paying.
- Ask 2: `withClubAddressOnStripe` (billing-location-server) stamps the club address before the move, restores the
  customer's previous address on a refused or thrown move, refuses with `billing_address_stamp_failed` (503,
  `BILLING_LOCATION_WORDS.stampFailed`) if the stamp fails. `app/api/billing/move/route.ts` uses it; the after-move copy is gone.
- Console: `REVIEW_CONSEQUENCE` is per country (`reviewConsequence`; console review carries `country`).
- ⚠ Part 2 must check every SCREEN shows the `billing_review_hold` and `billing_address_stamp_failed` sentences (the screens
  know `billing_address_required` only).
- ⚠ Another session has uncommitted edits in `components/billing/BillingBody.tsx` and `lib/plan-billing-words.ts` (Part 3/4
  targets): read them fresh before Part 3, and commit around them.

**Drawings DRAWN 2026-11-05 after `/design` + `/ux`:** `GST_HST_STAGE2_DRAWINGS.html`, published
https://claude.ai/artifact/9Sw8VvzwCk4bW5ccDVc9o3 (8 tabs; **drawing asks D1–D3 RULED 2026-11-05, all A**, logged in `memory/design_decisions.md`: D1 Due today is the total, no "Total" row;
D2 the Start-your-club figures reload on a province change + a press-time recheck that charges nothing if it changed; D3 the
monthly-or-yearly step gets words, not figures). Added beyond the prompt's list: the monthly-or-yearly step (Stage 1 put the
Billed-to line there for this stage). Applied without an ask: band move keeps one amount row; renewal = "plus applicable
taxes" under the figure (new `.figures dd small` rule, `.setupSteps small` precedent); `notWorkedOut` rewritten to name no
place ("We couldn’t work out the tax for this billing address. Check the address and try again."); loading = shipped
`LoadingState` "Loading the charge…" in the figures AND the footer start; new words "The charge shows once the address is
complete.", "Club, first month"/"Club, first year", the amber "The charge changed to $X CAD. Nothing was charged. Check the
figures, then press Start my club again.", "Prices are plus applicable taxes." (→ `/marketing` check), Billing address window
hint "Your next charge is taxed for this address."
Build notes from the reviews (Part 2/3, not asks): ⚠ `PlanMoveDialog` unmounts the name + address block in any `loading` /
`refused` state (`inPlace && (preview || quote)`): split "figures loading" from "window loading" (the Monthly/Yearly toggle has
the same flaw); reload only when the draft passes `check()` and country/province differs from the last quote; the move route
needs the shown total (or the preview's tax) to compare at press; the preview route passes no address — a live-subscription
preview needs a `customer_details` address override (verify `invoices.createPreview` accepts it with `subscription`), the
checkout quote likewise (it previews the coach's HOME address today); preview refusals need doors: `billing_address_required` →
the Billing address window (not Check again), `billing_review_hold` → no retry, `billing_address_stamp_failed` → retry by press;
`create-checkout` stamps the club address on the coach's Stripe customer before the session (`ensureStripeCustomer`) and backing
out of Stripe's page does not put it back — low risk (no live subscription on that customer in this path) but verify and record.

**`/accounting` design review DONE 2026-11-05 (blocking gate before Part 2 passed; new topic
`docs/agents/accounting/RECOVERED_STRIPE_FEES_TAX.md`, indexed):**
1. Automatic tax on A–E, tax-exclusive, rate by the stored address's province, GST/HST number left on, US 0 / held — **confirmed**
   (matches `GST_HST_ON_SUBSCRIPTIONS_CANADA.md`). Part 2: C sets it at creation; E sets the schedule's `default_settings`.
2. Ask 3 — **confirmed**. Stripe bills these fees to OUR platform account, so re-billing them is consideration for our payment
   service, not a disbursement (CRA agency test, P-182R / GI-012 / GI-197); they take the payment fee's tax status (T2) and must
   never diverge from it (D1 still open, not a gate). Part 2 MUST: give each fee item `tax_behavior: 'exclusive'` + an explicit
   general-services tax code (verify the code; not the SaaS preset); turn automatic tax on for the club's own monthly fee
   invoice; bill the fee **net of any tax Stripe charged us**; credit against the original invoice LINE so Stripe reverses its
   tax (the club gets fee + tax back) and update the credit-note math.
3. Quotes (Due today = taxed total; "plus applicable taxes" elsewhere) — **confirmed**. Coaches buy as individuals: whether
   consumer rules want the tax-in total before purchase is a `/legal` question (Stripe's page shows it before payment).
4. No backdated registration — **confirmed, no exposure** (nothing sold). Re-count prod sales at the promote (Ask 7); an untaxed
   sale still owes the tax, at our cost.
5. NS 14% — **confirmed** (cut on 2025-04-01). PM summary's "Atlantic 15%" corrected below.
6. Invoice content — **change needed**: (a) every invoice and credit note of $100+ must show our GST/HST number → **owner step**,
   test and live: Stripe Dashboard → Settings → Invoices → Tax → add the Canadian GST/HST account tax ID → Set as default
   (number never in the repo; `MANUAL_PROD_STEPS.json` at closeout); Part 6 checks it prints on a Checkout subscription invoice,
   a move's proration invoice, a credit note and the club's own fee invoice. (b) $500+ (every yearly club plan) needs the
   buyer's name: `ensureStripeCustomer` creates the customer with email only → Part 2 sets the customer's name (club or
   workspace name; the coach's for Premium). (c) A refund of a taxed subscription invoice goes through a credit note (the s.232
   document the club needs, and the reduction Stripe Tax keeps) — Part 6 matrix row.
Owner check (not a decision): does Stripe charge GST/HST on its fees to our account (a Stripe tax invoice under Settings →
Documents)? It decides the ITC and item 2's "net" base.

**Part 2 BUILT 2026-11-05, uncommitted (commit asked of the owner)** (typecheck clean; ESLint clean on the 11 files; billing,
fee, checkout and move tests 857 pass; `npm test` 14257 pass / 8 fail, none in a file this part touched — support-console foot
sentences ×2, practice-plan phone N1, Stage 6 public walk page ×3, `plan-billing-usage` free-time ×1 (fails the same with this
part stashed), `series-date-groups` ×1 (another session's coach series work). ⚠ the focused ESLint runner in `verify:changed`
dies on a config error ("could not find plugin react-hooks") over another session's file set; `npx eslint` on this part's files is
clean):
- `lib/billing-tax.ts`: `TAXED_CHECKOUT` (automatic tax + `tax_id_collection` + `customer_update.name = 'auto'`, never `address`),
  `RECOVERED_FEE_TAX` (`exclusive` + `txcd_20030000` "General - Services", read from Stripe), `buyerNameUpdate` +
  `BUYER_NAME_META` (accounting 6b: our name follows our records; a name typed on Stripe's page is kept), `taxLineLabel` ("HST
  13%") + `namedTaxLines` (Part 3 reuses them). Tests in `tests/unit/billing-tax.test.ts`.
- A (`create-checkout`), B (`create-team-checkout`), C (`lib/next-season-choice.ts`) spread `TAXED_CHECKOUT`; D (`applyMove` up)
  sets `automatic_tax`; E (the down schedule) sets `default_settings.automatic_tax`. Test mode `.probe/gst2/paths-de-run1.txt`: D's
  prorated invoice 1000 + 130 tax on an untaxed subscription turned on by the update; E's renewal 2900 + 377 with phases
  inheriting.
- Names on the customer: `ensureStripeCustomer(…, buyerName)` (club / portal name; created with it, an existing one named when
  ours), B the coach's own name, C the club name or the coach's, `stampStripeCustomerAddress(…, name)`. `withClubAddressOnStripe`
  stamps the club's NAME with its address and puts the coach's name (and our marker) back on a refusal (test added).
- The move route now asks `requireBillingLocation` on a move DOWN too: it turns tax on for the renewal it schedules, which
  Stripe refuses for a customer it cannot place; the screen gets the Billing address window, not a provider error.
- ⚠ **Found and fixed, pre-existing: every real Founding next-season Checkout was refused by Stripe** ("`proration_behavior` can
  only be passed if `billing_cycle_anchor` … exist", test mode, with or without tax: `.probe/gst2/path-c.mjs`). Hidden on dev by
  the mock; in production the choice opens 2027-06-01 and would have failed for everyone. Removed the setting (no anchor = nothing
  to prorate; the session charges $0 at creation, verified); the invariant test now asserts it is ABSENT.
- Recovered fees (Ask 3, `lib/platform-stripe-fees.ts`; test mode `.probe/gst2/fee-tax-run1.txt`): every fee line carries
  `RECOVERED_FEE_TAX` (ON: 1500 + 195); the club's own monthly invoice has automatic tax; `tax_fee` balance transactions (Stripe's
  tax on its own fee) are never billed on — the "net of Stripe's tax" base; a credit note's total is asked of Stripe
  (`creditNotes.preview`: a line's `amount` is before tax, the note reverses 1500 + 195) and a custom line is refused on a taxed
  invoice (Stripe refuses it too); the fee invoice email leads with the fee before tax and lists the tax by name before the Total.
- ⚠ **Ask 8 for the owner (NEW, the fee invoice's address):** Stripe refuses to finalize a taxed invoice for a customer with no
  address (`customer_tax_location_invalid`, verified). A comped or free club taking online payments may never have given one
  (Stage 1 asks only on a paid step). Built for now: the club's own row is stamped on the customer; a club with no address
  anywhere WAITS — its fees stay unbilled with an operator sentence in platform admin, nothing is billed untaxed. *Recommendation:
  ask for the billing address when a club turns on online payments (the same Billing address window), so no club reaches its
  first fee invoice without one; the wait stays as the safety net.* Alternative: copy the payout account's business address
  (Stripe-verified, but a new source the club never gave us for billing). Not built either way until ruled.
- ⚠ Screens: every paid screen shows the server's sentence for the new codes (helper census 2026-11-05: plan-upgrade,
  PlanPanelDrawer, TeamSignupClient, onboarding, BillingBody checkout + next-season, PlanMoveDialog). The one fix:
  `PlanMoveDialog` offered "Check again" on a held account; `billing_review_hold` is now in its no-retry list. A failed stamp
  keeps "Check again" (it can succeed).
- Not touched (Part 3): the move preview and the Premium → Club quote still preview without tax, so on dev the quoted figure is
  pre-tax while the charge is taxed until Part 3 lands. Legacy dev subscriptions stay untaxed until a move turns tax on (prod has
  none). A "Keep {Plan}" restore of a down move (plan-ending, no route check) for a legacy customer with no address
  is expected to be refused by Stripe and read as `moveNotRestored` — not verified (prod has no such customer).

Next: Ask 8 to the owner; Part 3.

**Rulings (owner, 2026-11-05, all as recommended):**
- **Ask 1:** one helper decides tax: taxes by the stored address; a US address with disagreeing card/payout evidence
  (`currentReview`) is HELD — the paid button refused with "we need to look at your account" + the existing console flag, no
  email. Relaxing it is a Stage 8 choice.
- **Ask 2:** Premium → Club stamps the club address on the Stripe customer BEFORE the Stripe update; the coach's home address is
  put back if the move is refused or fails; a failed stamp refuses the move ("try again"). Amends the order of Stage 1 Part 3
  Ask 2, keeps its reason. The window's preview quotes the typed club address.
- **Ask 3:** recovered Stripe fees are taxed ON TOP (T2's reason), on a subscription invoice and on the club's own monthly fee
  invoice; credit-note math updated in the same pass. `/accounting` confirms before Part 2.
- **Ask 4:** a Canadian postal code whose first letter cannot belong to the chosen province/territory is refused with a plain
  sentence (shared validator, every address screen). US unchanged.
- **Ask 5:** the plan card shows the price + "plus applicable taxes", no live tax figure.
- **Ask 6:** GST/HST number offered at Checkout for clubs AND coaches (`tax_id_collection` + `customer_update[name]=auto`,
  accepted: Checkout may rename the Stripe customer to the business name typed); the portal already allows it (no bump).
- **Ask 7:** the owner completes LIVE Stripe Tax (head office, "Include tax in prices: No", SaaS business use, then the Canada
  GST/HST registration) before the promote, soon; the promote's steps re-run the read-only audit and re-count production
  subscribers, and stop if either fails.

Part 0 findings so far [V 2026-11-05]:
- **Production paid subscriptions: 0** (live Stripe not-ended 0; prod org/workspace rows following a real subscription 0;
  `.probe/gst2-prod-subs.mjs`, read-only). ⚠ Coaches Portal and Tournament Plus are on sale in production, so any sale before
  this stage reaches production is untaxed and needs `automatic_tax` set by an update: re-count at the promote.
- **Item 1 answered — the HEAD OFFICE, not the registration, is the switch.** Sandbox tax settings are `pending`
  (missing `head_office`), no registrations. With `automatic_tax: { enabled: true }`, Checkout, `invoices.createPreview` and
  `subscriptions.create` are all **refused** ("You must have a valid head office address to enable automatic tax
  calculation"), not charged 0 (`.probe/gst2/tax-behaviour.mjs`, run 1). So the code must NOT reach production before the live
  account's tax settings are complete; the live setup is a pre-promote step, not an at-promote one.
- Sandbox prices: all 14 active are `tax_behavior: exclusive`; 13 products carry `txcd_10103001` (SaaS, business use), but
  **"FieldLogicHQ - Club · Association" (the `club_large` sandbox slot) carries `txcd_10000000`** (general electronically
  supplied services) — inconsistent; same GST/HST rate, owner to align.
- Charging paths A–E confirmed at the handed-over lines (create-checkout :406, create-team-checkout :332, next-season-choice
  :157 with `trial_end`, plan-move :387 update, :436–441 schedule rebuilt with explicit phases). F (dead add-on) confirmed. No new
  charging path since the census. **Club and coach checkouts also carry `trial_period_days`**, so the "first charge later"
  question is not Founding-only.
- **Fee lines DO ride subscription invoices**: `subscriptionLine` (`lib/platform-stripe-fees.ts` ~:243) creates an invoice item
  with `subscription:` set, and `creditAgainst` adds lines to a draft subscription invoice. These are RECOVERED STRIPE FEES
  (returned debits, disputes, foreign-card extra), not T2's payment fee. Own monthly fee invoice (`invoices.create`, ~:448) is
  separate and untaxed unless set.
- **Portal tax ID is already on**: `PORTAL_FEATURES.customer_update.allowed_updates` includes `tax_id` at version 2
  (`lib/stripe-portal-settings.ts:27`). No version bump is needed for Ask 6.
- `currentReview` callers: `lib/billing-location-server.ts` only (console + Plan & billing reader); no checkout/move/preview
  path. `US_SALES_OPEN` absent = closed.
- Ask 2 confirmed: `app/api/billing/move/route.ts` runs `applyMove` (:74) then `copyBillingLocationToStripe` (:78), and the
  copy swallows Stripe errors (reported, never fails).
- `lib/workspace-upgrade-preview.ts`: with a trial it quotes $0 today and the pre-tax price as the first charge; with no
  customer it previews with no address at all.
- No postal-code/province cross-check in `lib/billing-location.ts` today (format only, :242).

Sandbox setup 2026-11-05: the owner set head office (Canada, Ontario), default tax behaviour "No" (= exclusive) and the preset
category SaaS · business use (`txcd_10103001`) — tax settings now `active`. **The dashboard offers no registration in a
sandbox** ("switch to live mode to … register"), so the session added it by API (`.probe/gst2/add-sandbox-registration.mjs`,
CA standard, active). ⚠ **Stripe refuses a past `active_from`**: 2026-09-26 cannot be recorded; a registration starts the day it
is added. Live: add it before the promote (any sale made earlier is still owed, at our cost — prod has had none).

Stripe test-mode answers [V 2026-11-05, `.probe/gst2/tax-behaviour-run2.txt`, `tax-behaviour-2-run1.txt`]:
- ON 13% (377 on 2900), **NS 14%** (406 — the PM summary's "Atlantic 15%" is wrong for NS), BC and QC 5% GST only
  (`not_collecting` the provincial part), **US 0 with `not_collecting`, not refused** — so a country with no registration
  charges 0, which also answers item 1 once the head office exists.
- Item 2: a customer with no address, or country only, previews with tax 0 and `automatic_tax.status: requires_location_inputs`
  (a silent 0, not an error). Checkout with such a customer is **refused** (`customer_tax_location_invalid`) unless
  `customer_update[address]=auto`, which we must not pass (Stage 1: the address changes only in our window). So every preview
  must check the status and refuse on anything but `complete`; Checkout already refuses.
- Item 3: a `trial` subscription's rate follows the address **at the charge**: made ON (13%), customer moved to AB, the first
  invoice preview re-priced to 5%. Same for `trial_end` (Founding) and `trial_period_days`.
- Item 4: a schedule made from a subscription carries the subscription's `automatic_tax` as `default_settings`; phases with
  no own setting inherit it. From an UNTAXED subscription the default is off; `subscriptionSchedules.update({ default_settings:
  { automatic_tax: { enabled: true } } })` turns it on. Path E must set it explicitly.
- Item 5: an ON customer with a `ca_gst_hst` tax ID is still charged 13%.
- **Province, not postal code, decides the rate**: state ON + BC postal V6C → 13%; state NS + ON postal M5H → 14%. Ask 4 is
  load-bearing.
- **A fee-style invoice item (amount only, no tax code, no behaviour) riding a taxed subscription is taxed 13% ON TOP** (the
  account's preset code and default behaviour). Untreated, the recovered fees are taxed on top by default; the credit-note
  math in `lib/platform-stripe-fees.ts` would then be wrong.
- Checkout `tax_id_collection` with an existing customer is **refused** unless `customer_update[name]=auto` (Checkout then
  overwrites the customer's name with the business name the buyer types).
- A no-customer preview by `customer_details.address` works (13% for ON): the Premium → Club window can quote the typed club address.

## Facts handed to you (the 2026-11-05 code census; verify before you build on any)

**Charging paths that need tax on [H]:**
- A. Club/tournament plan checkout `app/api/billing/create-checkout/route.ts` (~:406) — also Premium → Club when the portal has
  no live subscription. Address is already on the customer before the session is made.
- B. Coach Premium new / Reactivate / Keep `app/api/billing/create-team-checkout/route.ts` (~:332).
- C. Founding next-season choice `app/api/billing/choose-next-season/route.ts` (~:186; params built in `lib/next-season-choice.ts`).
  ⚠ Its subscription uses `trial_end`: the first charge is later, so tax must be set at creation and the rate is decided by the
  address **at the charge date** [H, unverified Stripe behaviour].
- D. A plan move UP on a live subscription `lib/plan-move.ts` (~:387, `subscriptions.update`, immediate prorated invoice). An
  existing subscription gets tax only if THIS update sets it.
- E. A move DOWN is a subscription schedule (`lib/plan-move.ts` ~:429-457): no charge now, but a schedule phase may carry its own
  tax setting. Verify against the Stripe API.
- F. **Dead:** `startOrgTeamAddonCheckout` (`lib/team-org-billing.ts` ~:825) — nothing calls it, creates its own customer with no
  address. Do not revive it; the guard (Part 5) must list it as untaxed-and-dead.
- Not tax targets: `createCardSetupSession` (mode setup), `lib/stripe-connect.ts` (a family paying a club on the club's own
  Stripe account — Club Stage 12 / Stage 5), cancels, Keep toggles.
- Fee-recovery invoices, `lib/platform-stripe-fees.ts` (~:243, :315, :448, :493): a bare-amount invoice item with no tax code and
  no `tax_behavior`; the file says "No tax is set on any FieldLogicHQ invoice" (:339 [V 2026-11-05]) and its credit-note math
  assumes it. **If any of those items ride a subscription's next invoice, the taxed subscription invoice taxes them too**, with an
  unspecified behaviour. Part 0 decides this (Ask 3).

**Quoted amounts that must learn tax [H]:**
- `lib/plan-move.ts` (~:255) invoice preview — inherits tax only if the subscription has it; preview and charge must use the same
  address. `app/api/billing/move/preview/route.ts` passes no address.
- `lib/workspace-upgrade-preview.ts` (~:29) — the Premium → Club "Due today" window. **[V 2026-11-05]** its `createPreview` call
  passes the customer (if any) and the price items and **no automatic-tax setting**, so with no live subscription to inherit from it
  would quote no tax while checkout charges tax. At that moment the customer is the coach's own, carrying the coach's HOME
  address, while the club address is typed in the window and saved to the club's row only (see Ask 2).
- `lib/plan-move-preview-lines.ts` (~:57-63) **[V 2026-11-05]** returns null the moment the invoice has any tax: the Premium → Club
  charge/credit breakdown disappears and only a total shows. It needs a tax line (plan: "the amount, the tax by name, and the
  total, on every paid step").
- Pre-tax prices shown from the plan config or the stored price: `W.plan.charge` / `paidPrice` / `price` / `fromPrice` /
  `chosenBody` (`lib/plan-billing-words.ts`), the Keep window and plan card (`components/billing/BillingBody.tsx`), the cycle and
  article panels, onboarding PlanStep, `PricingSection`, the marketing pages, the plan-ending emails
  (`lib/plan-ending-emails.ts`) and `lib/email.ts`. `lib/stripe-billing-state.ts` stores `subscription_amount_cents` = the price's
  pre-tax `unit_amount` (webhook writes it).
- Readers that assume no tax: `lib/console-money-stripe.ts` (charge amounts are taxed totals, the plan price is pre-tax, the
  `MoneyInvoice` type has no tax field), the credit-note math in `lib/platform-stripe-fees.ts`.

**The card-country flag [H, verified in the census]:** `currentReview` (`lib/billing-location.ts` ~:349) has exactly one caller
today, the platform-admin console reader. **No checkout, move or preview path reads it, and `REVIEW_CONSEQUENCE` ("treated as
Canadian") is a sentence, not behaviour.** Stage 1 left a note: this stage's decision must ask `currentReview`, never the stored
`review_reason`.

## Before any code (AGENCY_RULES, blocking)

1. Present the plan and the PM summary below in plain language, **then the asks in Part 0, each with a recommendation, and wait.**
2. Disagree out loud: if a part is wrong, say so before building. Argue from what the code does, not from this prompt or the plan.
3. A migration is probably not needed. If you find you need one, re-run `ls supabase/migrations` first, apply to **dev only**, add the
   `MANUAL_PROD_STEPS.json` entry, update `docs/agents/db/DATA_DICTIONARY.md` and run `npm run refresh:snapshots`.
4. Do not edit `.claude/settings*.json`, hooks, `package.json` scripts, `scripts/check-*.mjs` database checks or anything in
   `WATCHED_PATHS`. `scripts/audit-revenue-readiness.mjs` is **re-run** at the exit step, not edited. If you think you need to
   change one, stop and ask.
5. Stage explicit pathspecs only; `TODO.md` and the Owner QA Ledger carry other sessions' edits (partial-commit method in memory).
6. This is the most money-shaped stage in the project: **run the `/accounting` review before Part 2 starts (on the design) and again
   before hand-off.** Apply what it finds or record it as an owner question. Neither an accountant nor a lawyer gates the launch
   (owner 2026-10-31 / 2026-11-04).
7. The dev site runs Stripe TEST keys. Never run anything against live Stripe from this stage except the read-only audit at the end.

## What the owner sees after this build (PM summary: present this BEFORE any code)

- **Every price a customer is quoted says "plus applicable taxes"**, and **every paid step shows three things before the buyer
  pays: the amount, the tax by name ("HST 13%"), and the total.** Plan moves and the Premium → Club "Due today" window quote the
  same figure Stripe will charge, for the buyer's own province.
- **The tax follows the address the buyer typed in Stage 1** — Ontario 13%, Nova Scotia 14%, New Brunswick, Newfoundland and Labrador and PEI 15%, Alberta and the territories
  5%, BC 5% GST, Saskatchewan 5% GST, Manitoba 5% GST, Québec 5% GST (provincial taxes only once FieldLogicHQ is registered there:
  Stage 7). A US buyer pays no Canadian tax. (Stripe Tax decides the exact rates; the walk checks them, this list is not the spec.)
- **A club can enter its GST/HST number** at checkout and in Stripe's billing page; it prints on its invoice and never removes the
  tax FieldLogicHQ owes as a Canadian seller.
- **Plan & billing shows the plan price with "plus applicable taxes"**; the actual tax lines are on the Stripe invoice and the
  preview/checkout steps. Platform admin's Money tab reads the taxed totals correctly (the tax-reason record and its display are Stage 3).
- **Nothing changes for free, comped or Founding-comped workspaces**, and no existing paying customer is surprised: production has
  no paid subscribers (re-confirm in Part 0).
- **Role differences:** none new. Only the plan owner sees Plan & billing; staff read, never edit.

## Part 0 · Verify, count, ask, draw (no code)

**Verify [H] facts, reading the code:** every charging path above, plus anything added since 2026-11-05 (`grep` for
`checkout.sessions.create`, `subscriptions.update`, `subscriptions.create`, `invoices.create`, `invoiceItems.create`,
`createPreview`, `subscriptionSchedules`). The list is the scope of Parts 2 and 5.

**Verify against Stripe in TEST mode (a throwaway script in `.probe/`; do not guess):**
1. With `automatic_tax: { enabled: true }` and **no Canada registration** on the account, what does Checkout / `createPreview` do:
   charge 0 tax, or refuse? **This decides whether the code can ship before the registration** (recommended: yes, code ships live, tax
   starts the moment the owner adds the registration — the registration is the switch).
2. A customer whose address Stripe Tax cannot place: refuse or fall back? (Plan §7 says the fallback is the card or IP, or the
   highest rate.) Stage 1 makes the address required; confirm nothing reaches Stripe without it.
3. Does a Founding `trial_end` subscription decide its rate at creation or at the first charge date?
4. Does a schedule phase need its own `automatic_tax`?
5. Does a Canadian GST/HST number entered as a customer tax ID leave the GST/HST on a Canadian-seller invoice?
6. Production paid subscribers: a **read-only** production count (probe in `.probe/`, the prod Supabase safe-read method in memory).
   Stage 1 found **0**. If it is not 0 now, **stop and report**: existing subscriptions need `automatic_tax` set by an update and the
   plan has no backfill step.

**The owner's own Stage 2 step (give exact click-by-click, never put the number in the repo):** Stripe Dashboard → Tax →
Registrations → add **Canada, normal GST/HST** with the effective date **2026-09-26**, origin Ontario, in **test mode first**, and
confirm the products carry a software/SaaS tax code and prices are tax-exclusive. The session needs the test-mode registration for
the matrix in Part 6, so ask for it as soon as Part 0 closes. The **live** registration is added at the promote, not before.

**Asks for the owner (present each with your recommendation; do not build the part that depends on it before it is answered):**
- **Ask 1 · What "treated as Canadian" means when the buyer's address is American.** The plan and Stage 1 say a buyer whose card or
  payout country disagrees with their address is "taxed as Canadian". Argue from the code: while `US_SALES_OPEN` is off (production),
  **no US address can exist**, and a Canadian address with a foreign card is already taxed as Canadian by its address — so the flag
  changes no tax in production today. The only buyer it would change is a US address with a Canadian card, which exists on dev only
  and in the future Stage 8; and we would have no province to give Stripe. *Recommendation: build the tax decision as one helper
  that reads `currentReview` and the address, taxes by the address, and for a US address with disagreeing evidence refuses the paid
  button with a plain "we need to look at your account" sentence + the existing console flag (a hold, honoring Stage 1's "never
  emails"), with the choice to relax it recorded for Stage 8.* Offer the alternative (tax at the origin province's rate) and say
  why it is worse (it guesses a province).
- **Ask 2 · The Premium → Club address order.** Stage 1 Part 3 Ask 2 ruled the club's address reaches Stripe **only after** the move
  is made, so a refused move leaves the coach's home address on the coach's customer. **[V 2026-11-05]** `app/api/billing/move/route.ts`
  runs the move first and `copyBillingLocationToStripe` after. Once tax is on, the move's prorated invoice is taxed at the **coach's
  home address**, not the club's, and the "Due today" window quotes the same wrong place. *Recommendation: stamp the club address on
  the customer BEFORE the Stripe update, and put the home address back if the move is refused or fails.* That meets the ruling's
  reason (a refused move leaves the coach as they were) and changes only its order; say plainly that this amends a ruling and
  let the owner confirm. The preview (no customer yet) should quote against the typed club address.
- **Ask 3 · Fee-recovery invoices and any item riding a subscription.** Plan T2 already rules "tax on top of the fee" (the fee is
  Stage 5). Part 0 finds out whether any fee line can ride a subscription invoice. *Recommendation: if none can, leave the fee
  invoices untaxed here, list them in the guard as deliberately untaxed until Stage 5, and say so; if any can, give those lines an
  explicit `tax_behavior` and tax code now (T2 is ruled), and update the credit-note math in the same pass.*
- **Ask 4 · Address strictness before tax goes live (carried from Stage 1, owner 2026-11-04).** The province sets the rate;
  "Ontario" with a BC postal code is taxed wrong. *Recommendation: refuse a Canadian address whose postal code's first letter cannot
  belong to the chosen province/territory, with a plain sentence; leave US state/ZIP checks and PO Box workarounds ("Lockbox 5") as
  they are — no US tax is charged.* This is the same shared validator, so it changes every address screen at once: say so.
- **Ask 5 · What the plan card says.** *Recommendation:* the plan price + "plus applicable taxes" (no live tax amount on the card;
  the actual tax is on previews, checkout and the invoice). The alternative — reading the next invoice for the real tax on every
  Plan & billing load — costs a Stripe call per page view and shows a figure that moves with the address.
- **Ask 6 · Tax-ID entry.** Offer it on checkout (club and coach) and keep it editable in Stripe's billing page (a portal
  configuration version bump, `lib/stripe-portal-settings.ts`; **not** the address). Confirm the owner wants coaches asked too.

**Drawings (only for screens that gain a row or a line):** the plan-move window, the Premium → Club "Due today" window and the
paid steps gain "Tax" and "Total" rows; the plan card gains "plus applicable taxes". Run those through `/design` and `/ux` as a
PM-level drawing in the house style (one published HTML Artifact; whole-screen before/after; true size; every flag clickable; read
the shipped strings, do not invent them). Do not ask for a mockup session unless the owner asks.

## Part 1 · The tax decision, the registration, the address order

- The registration step above (owner, test mode).
- One shared helper (name it for what it does) answering "how is this buyer taxed?": the stored address, `currentReview`, and
  `US_SALES_OPEN` in; **what Stripe is told, or a plain refusal** out. Pure where possible, with unit tests for every province,
  territory and state group, a flagged buyer, a US buyer and a buyer with no address.
- Ask 2's address order for Premium → Club, with the restore on refusal. Unit tests for refused and failed moves.
- Ask 4's postal-code check inside the existing validator, with tests for every province/territory prefix.
- Products and prices: confirm each carries the software tax code and `tax_behavior: exclusive` (the audit reads these; change them in
  Stripe through the owner or a scripted, owner-approved update — do NOT write to live Stripe from this session).

## Part 2 · Tax on every charging path

- Turn on automatic tax on paths A, B, C (at creation, per Part 0 item 3) and D (an update that enables it on an existing
  subscription), and E if Part 0 item 4 says so. Offer tax-ID entry per Ask 6 (and bump the portal configuration version).
- Every path asks the Part 1 helper first; a refusal reaches the screen as a sentence, not an error.
- `customer_update` / address handling so Stripe never re-guesses the address from the card.
- Fee-recovery lines per Ask 3.

## Part 3 · Every quoted amount learns tax

- The plan-move preview and the Premium → Club "Due today" window: send the same buyer address and the explicit automatic-tax
  setting, so the quote equals the charge; extend `trustedPreviewLines` to carry the tax line by name instead of dropping the
  breakdown; render "Tax" and "Total" per the approved drawing.
- Renewal quotes (`W.plan.charge`, the Keep window, the plan-ending emails): "plus applicable taxes" beside the price (T4).
- Console readers: `toMoneyInvoice` carries the tax total when present; the Money tab's "Next charge" labelled as the total; no
  claim about the *reason* for a tax result (Stage 3).
- Credit-note math: only if Ask 3 puts a fee line under tax.

## Part 4 · Words, everywhere a price is quoted

- "plus applicable taxes" (one spelling; `npm run check:spelling`) on the product's own surfaces: plan panels, cycle picker,
  onboarding PlanStep, `PricingSection`, the Keep window and plan card, the Founding choice buttons, the plan-ending and marketing
  emails (`lib/email.ts`, `lib/marketing-email-defaults.ts`).
- The public marketing pages (`app/pricing`, `for-clubs`, `for-coaches`, `for-leagues`, `for-tournament-organizers`,
  `FoundingSeasonPanel`) route to **`/marketing`** for copy; record the "plus applicable taxes" line in the Pricing Facts doc
  through **`/strategy`** (T4 asked for both). Do not write marketing copy in this session.
- A demo sentence that quotes a price is computed from the config or it is not in the sentence (demos rule).

## Part 5 · The guard

A unit test (house style: reads source text, like `tests/unit/billing-location-checkout-guard.test.ts`) that fails the build with a
sentence naming the file when any code under `app/` or `lib/` creates a Stripe Checkout session in subscription mode, creates or
updates a subscription / schedule, or creates an invoice or invoice item **without** enabling automatic tax — except an explicit,
commented, short list of deliberately untaxed calls (the card-setup session, the Connect payment, the dead add-on, the fee invoices
per Ask 3). A new charging path then cannot ship untaxed by accident. Mutate-and-fail it as Stage 1's guard was.

## Part 6 · The test matrix (Stripe test mode, scripted where possible)

One test buyer per group — ON, NS (Atlantic 15%), NB/NL/PE, AB/territories, BC, SK, MB, QC — plus a US buyer (no tax) and a
mismatched buyer, across: new checkout (club and coach), Premium → Club in place, a move up with its preview, a Founding next-season
choice, a renewal, a refund and a credit note. For each: the preview figure equals the charged figure, the invoice shows the tax by
name, and a club's GST/HST number leaves the tax in place. Record the table in the Progress block.

## Part 7 · Closeout

1. `npm run verify:changed`; `npm run typecheck` (shared modules touched). Report any skipped check and why.
2. **Exit step (owner 2026-10-31): re-run `scripts/audit-revenue-readiness.mjs` read-only against the live and sandbox accounts and
   record that the tax settings it reads now match.** Do not edit the script.
3. `/accounting` review again (blocking, "Before any code" 6).
4. Offer `/simplify` (a new shared helper), then `/review` (billing: high-risk tier), once each.
5. Offer `/docs`: the Plan & billing and checkout help gains "taxes: what you are charged and why". Product words only.
6. Owner walk: one purpose (*a buyer is quoted, and charged, the right tax for where they are, on every paid step*), published as
   the house Artifact, with a §number added to the Owner QA Ledger. Cover each path in Part 0's list for a Canadian province
   group, a US buyer, a club with a GST/HST number, and a move quoted then charged.
7. Records: the plan's Stage 2 line and status header, the PM brief, the TODO line (one line), this Progress block,
   `MANUAL_PROD_STEPS.json` if anything is owed (**the live Stripe Tax registration and the portal configuration bump belong in it
   as owner steps for the promote**).
8. Do not push. Ask before committing.

## Out of scope (do not build, do not "just add")

The per-charge tax-reason record and its Money-tab display (Stage 3), the books (Stage 4), the online-payment fee and its monthly
statement (Stage 5), Terms of Service (Stage 6), provincial registrations (Stage 7), US payments, USD prices and US tax (Stage 8),
the production release (Stage 9). If something here seems to need one of them, stop and say which.
