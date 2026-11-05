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

Nothing built. Next: Part 0.

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
- **The tax follows the address the buyer typed in Stage 1** — Ontario 13%, the Atlantic provinces 15%, Alberta and the territories
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
