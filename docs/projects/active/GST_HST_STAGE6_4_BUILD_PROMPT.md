# GST/HST Stage 6 · step 6.4 — the purchase email, the yearly reminder and the Québec refusal (build prompt)

> Written 2026-11-13 by the 6.4 planning session (`/plan`, Opus) from
> [GST_HST_STAGE6_4_KICKOFF_PROMPT.md](GST_HST_STAGE6_4_KICKOFF_PROMPT.md). **Run as Sonnet build sessions, two parts, in order
> (A, then B).** Plan of record: [GST_HST_STAGE6_TERMS_PLAN.md](GST_HST_STAGE6_TERMS_PLAN.md) — §3's RULED block (**O1′** no
> personal name, **O2** the yearly reminder, **O4** not offered in Québec) and the **§5 6.4 RULED block (2026-11-13)** bind.
> PM brief: [GST_HST_STAGE6_TERMS_PM_BRIEF.md](GST_HST_STAGE6_TERMS_PM_BRIEF.md). The promises this makes true: the Terms draft
> `docs/agents/legal/drafts/TERMS_OF_SERVICE.md` **§8 "Yearly plans"**, **§16** (the details of a purchase), **§17** (Québec), and
> its **"From the `/accounting` read"** list (what the email shows).
> **The customer words are in §6 below, reviewed by `/accounting` and `/legal` on 2026-11-13 — copy them exactly.** Anything
> not there is a new sentence: write it, mark it in the hand-over, and it goes to the next `/legal` pass.
> Marks: **[V]** opened by the planning session 2026-11-13; **[H]** a helper's census that day — **open the line before relying
> on it.**

## 1. What this builds (owner's view)
- **"The details of your purchase."** One email, sent once, a minute or so after Stripe marks a plan's invoice paid:
  - **When it goes:** a first paid plan, the start of a free trial, an upgrade (including Premium → Club), a next-season
    choice, and coming back after a cancel.
  - **What it shows:** the plan and how often it's charged, the price before tax, each tax by name, rate and amount, the total
    in CAD, the start and renewal dates, how to cancel, a link to the invoice, our business name and GST/HST number, and a link
    to the Terms version the buyer accepted.
  - **Where the figures come from:** the invoice's own tax record, the same row the books keep.
  - **Never sent for:** a renewal, a club's Stripe-fees invoice, a Founding Season comp, a demo, or a dev mock purchase.
- **The yearly reminder.** At least 30 days before a yearly plan's next charge, every owner gets the date and the amount with
  its tax, as Stripe would charge it that day. This includes a yearly trial ending, and a yearly next-season choice's first
  charge.
- **Québec.** Every door that buys or upgrades refuses a Québec billing address with one plain line, and nothing is charged.
  An account with Québec on file keeps everything else: renewing, moving down, cancelling, payouts, its fee invoices and saving
  the address.
- **Every owner, not one.** These emails go to every active owner of the organization (a coach's Premium: the coach). The same
  build fixes the existing billing emails that today send **nothing** when a club has two owners.
- **Live, not dark (ruled Q1).** All of it goes out with the next release. **Only the Terms line follows the legal-pages switch**:
  - pages off (production until 6.7): no line;
  - dev preview: the draft page, called "draft";
  - published: the accepted version's own page.

## 2. The rulings this build implements (owner, 2026-11-13 — all four as recommended)
1. **Q1 — live; the Terms line hidden until the pages publish.** The email, the reminder and the Québec refusal are not behind
   the legal-pages switch. The tests prove all three switch states for the Terms line, and that everything else is the same
   in each.
2. **Q4 — every active owner.** One recipients helper serves the new emails **and** fixes the existing ones.
   - [V] `getOrgOwnerEmail` (`lib/supabase-admin.ts:11–23`) selects `role='owner'` with `.single()` and no `status` filter. A
     club with two owners errors, returns `undefined`, and nothing is sent.
   - Callers [H — open each]: `trial_ending` (`lib/billing-webhook-handler.ts:950`), `welcome_back` (`:534`, `:696`), the
     plan-ending emails (`lib/plan-ending-server.ts:397`, `:461`) and the retention warning (`lib/billing-retention.ts:450`).
   - The private `owners()` in `lib/online-payment-owner-notices.ts:36` [H] already returns every active owner with their email.
     Export one shared helper rather than writing a second.
   - Any once-only stamp stays one stamp per email (claim once, then send to each owner).
3. **Q3 — the Premium welcome stays; "Welcome back" is folded in.**
   - A coach buying Premium gets "Your Coaches Portal is ready" (unchanged, `lib/team-checkout.ts:661–678` [H]) **and** the
     details email.
   - A **paid comeback** gets **one** email: the details email, opening with its welcome-back line (§6). The separate
     `welcome_back` send (`lib/billing-webhook-handler.ts:543`, `:700` [H]) stops for any comeback that comes with a Stripe
     invoice.
   - Any `welcome_back` path with no invoice (if one exists — find out) keeps it.
   - Don't touch the Premium welcome's sender. Its once-only guard is the workspace's unique row [H `:553`, `:624`]. Its
     bypass of customised templates is a recorded follow-up, not this build.
4. **Q6 — every purchase door refuses Québec, upgrades included.** The rule in one line: **no new charge decision from a
   Québec billing address.** Refused at:
   - a new plan or trial (create-checkout), coach Premium (create-team-checkout), a move **up**, its preview, Premium → Club,
     and a next-season choice.
   - **Not** refused at: a move down, Keep {Plan}, cancelling, payouts connect, card setup, fee invoicing, renewals, and saving
     the address.

**Also settled (planning session, from the code):**
- **§9 needs nothing.** The draft already says "We will try to email the owner a warning". [H] the retention warning is
  manual only (`processBillingRetentionExpiry`, `lib/billing-retention.ts:494`, called only from the platform-admin "Process
  expiry" button), and nothing ever deletes automatically. The `ending_warnings` step is about online payments ending, not
  data. Scheduling the warning rides with the automatic purge (privacy finding 2), not this build.
- **The completion point is the invoice, not the subscription** (Q2, §3).
- **The reminder's amount is Stripe's forecast of the next invoice, not the plan's price** (Q5, §4).

## 3. Part A — the purchase email, and every owner

### 3.1 Where it hangs (the order trap)
- [V] `runVerifiedBillingEvent` (`lib/billing-webhook-handler.ts:228–248`) runs `runPlanWork` first, then writes the invoice's
  tax record (`recordInvoiceTax`, `lib/charge-tax-record-server.ts:173` [V]) for every event in `CHARGE_TAX_INVOICE_EVENTS`.
  That list includes **`invoice.paid` and `invoice.payment_succeeded`** [V `lib/charge-tax-record.ts:452`].
- **Send the email AFTER the tax record is written**, from `runVerifiedBillingEvent`, reading the stored row. That is how the
  email, the billing page and the books read the same figures, and it is why the plan arm is the wrong place.
- Pass `opts` through and send via **`customerSenders`** (`lib/billing-event-customer-messages.ts` [H]), so a replay
  (`opts.replay`) stays silent. Fee invoices already return early inside `runPlanWork`, but the tax record still runs for
  them. The classifier must refuse a fee invoice by its `FEE_INVOICE_META` too.
- **A catch-up step in the daily job** (`app/api/platform-admin/stripe-fees-daily/route.ts` [V]): `purchase_emails`, after
  `tax_records`, sends any email still owed. Two limits:
  - only rows whose `billing_reason` is set (old rows and backfilled history never qualify);
  - only rows paid within the last 3 days.
  
  It uses the same send function as the webhook path.

### 3.2 The classifier (pure, tested on fixtures)
Read the invoice's **`billing_reason`**. [V by grep] the webhook reads it nowhere today [H: only `lib/console-money-stripe.ts:82`].
Store it on the tax record when the record is written (new column, §5).

| Invoice | Email |
|---|---|
| `subscription_create`, amount > 0 | **first purchase**, or **comeback** when this buyer had a subscription before (the checkout routes already know: `hadSubscriptionBefore` [H]) |
| `subscription_create`, amount 0, subscription trialing | **trial start**, or **next-season choice** when the subscription carries `metadata.choiceKind` [H `lib/billing-webhook-handler.ts:438`] |
| `subscription_update`, amount > 0, subscription metadata `flhq_plan_move = 'up'` (`lib/plan-move.ts:477–486` [V], `isInAppUpMove` `lib/plan-growth.ts:23` [H]) — and the Premium → Club in-place path, whatever it marks | **plan change** |
| `subscription_cycle` | none: a renewal. This includes a trial's or next-season choice's first real charge; the purchase email and the reminder already told them. |
| `manual`, `subscription_threshold`, anything carrying `FEE_INVOICE_META`, any other `subscription_update` | none |
| a status that isn't paid; a `mock_` subscription; no organization or person on the record | none |

**Verify first, in test mode, before writing the classifier:**
- **(a)** A trial's $0 first invoice arrives and reaches paid. Record which of `invoice.paid` / `invoice.payment_succeeded`
  fires for it.
- **(b)** The move-up proration invoice's `billing_reason` is `subscription_update`.
- **(c)** What the Premium → Club in-place move's invoice carries.

Write the three answers into this file's Progress block.

### 3.3 Once only
- New stamp on the tax record (§5). **Claim before sending; release only on a definite not-sent.** This is the free-time
  reminder's pattern: `lib/portal-free-time-reminders.ts:63–99` [H].
- Don't rely on Resend's idempotency key alone: it remembers 24 hours. Pass one anyway, `purchase-details:<invoice id>`.
- **Tests:**
  - a replayed event sends nothing;
  - `invoice.paid` then `invoice.payment_succeeded` for the same invoice send one email;
  - the webhook and the daily catch-up racing send one email;
  - a fee invoice, a renewal, a `mock_` subscription and a demo address send nothing.

### 3.4 What it reads
- **Figures:** the stored row's `amount_before_tax_cents`, `tax_lines` (name, rate, cents — `StoredTaxLine`,
  `lib/charge-tax-record.ts:42` [H]) and `total_cents`. Labels come from the existing `taxLineLabel` (`lib/billing-tax.ts:111` [H]),
  so the email reads "HST (ON) 13%" exactly as the invoice and Bookkeeping do. **Never recompute.** A zero-rated sale reads
  "GST/HST 0%" because the record says so.
- **Trial and next-season choice: the after-trial figure** comes from Stripe's preview of the subscription's next invoice:
  - call `stripe.invoices.createPreview({ subscription })`, as `lib/console-money-stripe.ts:221` does [H], and read its tax with
    `namedTaxLines`;
  - label it as the estimate in §6. This is the one place a figure isn't the paid invoice, and it says so.
- **The renewal date:** the subscription's current period end, through `formatStoredDate`. **Never** `toLocaleDateString` — the
  `trial_will_end` arm does that; don't copy it.
- **The invoice link:** the invoice's `hosted_invoice_url`.
- **Our GST/HST number:** from the invoice's `account_tax_ids` (expand it), so the email matches the invoice.
  - If the invoice carries none, omit the line and report it in the send result. **Never type the number into code.**
  - [V by grep] nothing reads `account_tax_ids` today.
  - Owner step owed: Stripe Dashboard → the account's tax ID is set to print on invoices (`/accounting` question D already asks
    for this before 6.7).
- **The Terms version:** the version **the purchaser** accepted.
  - Stamp the purchasing user's id into the Checkout session's `subscription_data.metadata` and the move's update metadata
    (`flhq_buyer_user_id`) at every purchase door. Read that user's latest `legal_acceptances` row; the helper is
    `latestRecordedTermsVersion`, `lib/legal-acceptance.ts:55` [H], not exported today — export it.
  - Fallback when no user is recorded: the version current when the invoice was created. 6.3's purchase gate guarantees the
    buyer accepted it then.
  - Build the link with `legalPageHref('terms', version)` (`lib/legal-links.ts:17` [H]).
  - **Three states, all tested:** off → no line; preview (`'draft'`) → the draft wording in §6; published → the dated version's
    page.

### 3.5 The kind, the template, every owner
- Kinds in `lib/email-kinds.ts`: `purchase_details` and (for Part B) `yearly_renewal_reminder`, both `klass: 'account'` (logged).
  - [H] `tests/unit/support-console-stage5-guard.test.ts:162` asserts `LOGGED_EMAIL_KINDS.length === 55`. Move it to 57.
  - The comments name a `…-sender-guard.test.ts` that does not exist. Fix the comment.
- Template rows in `platform_email_templates`, category `billing`, `on conflict (key) do nothing`, the starting words exactly as
  §6. Send through `sendTransactionalEmail` (`lib/platform-email-templates.ts:208` [H]), so a customised template is used.
- **The recipients helper** (Ruling 2):
  - every active owner's email;
  - **skip `isDemoOrganizerEmail` addresses** (`lib/demo-org.ts:227` [V]). The demo accounts are `demo-organizer@example.com`
    and `demo-coach@example.com` [V `lib/demo-org.ts:106,113`], and `sendEmail` only skips `.local` [V `lib/email.ts:80–82`];
  - a Premium workspace's owner is the coach.
  - Move every caller in Ruling 2 to it, and keep each caller's stamp semantics.
  - Grep for any other `getOrgOwnerEmail` caller and decide each one. Report the list.

### 3.6 Done when (Part A)
- Each classifier row has a fixture test.
- The once-only tests in 3.3 pass.
- The three Terms states are tested.
- A two-owner club gets `trial_ending`, the plan-ending emails and the purchase email at both addresses.
- A paid comeback gets the details email and no `welcome_back`.
- `npm run verify:changed` passes. `npm run typecheck` passes too (shared modules).
- `/simplify` then `/review` are offered.

## 4. Part B — the yearly reminder, and Québec

### 4.1 The reminder step (`yearly_renewal_reminder`)
- A new step in the daily job, `renewal_reminders`, in its own `run()`. The job is pg_cron `'15 11 * * *'` (mig 395 [H]); on
  production it's a manual step already tracked.
- **Who:** every subscription whose next charge is yearly, with `current_period_end` (or, for a next-season choice, its trial
  end) **30–37 days from now**. Exclude:
  - monthly plans;
  - a plan with a waiting cancel or a move to the free plan (`readPendingEnding(orgId)`, `lib/plan-ending-store.ts:62` [H]);
  - Founding comps (no subscription);
  - `mock_` ids (`stripeStillBills`, `lib/stripe-billing-state.ts:18–21` [H]);
  - a status other than active or trialing;
  - **a trial whose purchase email went out under 38 days before its first charge** (League's 30-day trial). That email
    gave the date and is the notice. Without this rule, the step would send a "late" reminder the morning after the purchase.
  
  Yearly is `organizations.subscription_period = 'annual'` [H]. For a next-season choice it's `next_season_billing_cycle` [H].
  Confirm the column homes from the snapshots, not the migrations.
- **Once per period:** a stamp holding the charge date being reminded about (§5). Claim before sending (conditional update,
  `is null or != date`), release only on a definite not-sent.
- **Late, not silent.** If the date is under 30 days away and unstamped (the job was down for over a week), send anyway and
  report it as `late` in the step's result.
- **The amount:** `stripe.invoices.createPreview({ subscription })`, read with `namedTaxLines`. It is the truth when the address
  or a tax rate has changed, and a paid → paid move down's schedule shows its next phase [H `lib/plan-move.ts:527–553`].
  - When the previewed plan differs from today's plan, the email names the plan it renews into (§6, the move-down line).
  - A failed preview sends nothing, releases the claim, and the next day retries (still in the window).
- **Every owner** (Part A's helper); demo addresses skipped.
- **Tests:**
  - the window edges: 37 days sends, 38 doesn't, 29 sends as late;
  - a second run the same day sends nothing;
  - each exclusion sends nothing;
  - a move-down names the new plan.

### 4.2 The Québec refusal
- **Not in `checkBillingLocation`** (`lib/billing-location.ts:280` [V]). That validator also feeds `storedLocationStillValid`
  (`:317` [V]), which club fee invoicing reads (`lib/platform-stripe-fees.ts:505` [V]), plus the save path and the "on file"
  test. A rule there would stop a Québec club's fee invoices and contradict "existing accounts stay".
- **At the purchase gate, as an option.** `requireBillingLocation(buyer, sentAddress, { purchase: true })`
  (`lib/billing-location-server.ts:269` [V]).
  - **Check the region BEFORE the save**: [V] today it saves a sent address first (`:276–279`), which would store a refused
    buyer's address.
  - Check both the sent address and the stored row: `region_code = 'QC'` with `country = 'CA'` (mig 433 [H]).
  - Refusal: **409, code `billing_region_closed`**, the §6 line as `error`.
- **Callers [H — the census in `tests/unit/billing-location-every-path-guard.test.ts` lists them]:**
  - `purchase: true` at create-checkout (`:202`), create-team-checkout (`:200`), choose-next-season (`:110`), and the move route
    **only when `direction === 'up'`** (`app/api/billing/move/route.ts:77–82` [V] — today it runs for down moves too).
  - Move preview (`:58`): purchase.
  - The Premium → Club in-place quote checks the typed address with `checkBillingLocation` at preview `:55` [H]; add the region
    refusal there too.
  - Payouts connect (`app/api/admin/payouts/route.ts:214`): **no**.
- **Every screen already shows the server's `error` as written** [H]: onboarding plan step, billing page and next-season
  choice, plan panel and drawer, move window, coach sign-up. So the line reaches each without any per-screen copy.
  - **Two edits:** the move window's "Check again" exclusion list (`components/billing/PlanMoveDialog.tsx:301` [H]) gets the
    new code, so it doesn't offer a pointless retry.
  - And the address form shows the §6 notice under Province when Québec is chosen (`components/billing/BillingAddressFields.tsx`
    — the US-closed amber line under Country is the pattern [H `:144`]). **It never blocks the save.**
- **Stripe Checkout must not be a side door.** Confirm whether create-checkout / create-team-checkout let Checkout collect or
  change the billing address (`billing_address_collection`, `customer_update.address`; [V by grep] neither is set today).
  - If Checkout can take an address, a Québec address typed there must not complete as a new purchase. Find out in test mode
    and report.
  - The customer portal cannot edit the address [H `lib/stripe-portal-settings.ts:26–32`].
- **The census test** gains a `purchase` column per checked call and fails when a purchase door lacks `{ purchase: true }`, or
  a non-purchase door has it.
- **Tests:**
  - a Québec address is refused at each purchase door, and nothing is saved or charged;
  - a stored-Québec club can move down, cancel, connect payouts and get its fee invoice;
  - saving a Québec address on the billing page works;
  - with the legal-pages switch in each state, the refusal is the same.

### 4.3 Done when (Part B)
- The tests above pass, plus `verify:changed` and `typecheck`.
- `/simplify` then `/review` are offered.
- Then the **6.4 walk** is written, as its own session (§8).

## 5. The migration (Part A carries it all; Part B uses it)
One migration, the next free number (476 at the time of writing — re-check), in the same unit of work:
1. `platform_charge_tax_records.billing_reason text null` — filled when a record is written. Null = an old or backfilled row;
   it never gets an email.
2. `platform_charge_tax_records.purchase_email_at timestamptz null` — the claim and sent stamp.
3. `organizations.renewal_reminded_for timestamptz null` — the charge date last reminded about. If Premium's period lives
   elsewhere, put the column there too; confirm from the snapshots.
4. Two `platform_email_templates` rows: `purchase_details`, `yearly_renewal_reminder` — the §6 words, the variables listed.
5. `docs/agents/db/DATA_DICTIONARY.md` updated, `npm run refresh:snapshots` (dev + prod), and `npm run check:dictionary` passes.
6. Production: apply before the promote that ships 6.4. If any part is data-only, record it in
   `supabase/migrations/MANUAL_PROD_STEPS.json` (as mig 434 did).

## 6. The words (reviewed 2026-11-13 — see §9 for the review record)
*Placeholders in `{braces}`; dates through `formatStoredDate`; money as `$1,234.56`. One spelling: "cancelling", "Québec".*

**How the words are built (from the reviews — binding):**
- **The terms block is fixed, not editable.** The renewal, cancel and refund sentences and the seller lines are rendered by
  code, outside the editable template body. An operator customising `purchase_details` must not be able to change what the
  buyer is told about cancelling or refunds (`/legal` 6: before the Terms publish, these are the only written terms the buyer
  sees). The operator can edit the opening and closing.
- **No upsell, pricing or sign-up link in either email** (keeps them transactional under CASL, `/legal` 3). The only links are
  the invoice, the billing page and the Terms version.
- **Currency** comes from the stored record, not a typed "CAD". **No tax line on the record** → one row "Tax · $0.00", never a
  blank (`/accounting` 1).
- **The registration number:** only the account tax ID of type `ca_gst_hst`.
- **The trial estimate never holds the email.** If the preview fails or carries no tax, drop only the estimate sentence and
  send. [H] `lib/workspace-upgrade-preview.ts` returns `tax: null` for trials on purpose, so test in test mode whether a
  trialing subscription's preview carries tax lines, and write the answer in Progress.
- **The reminder reads the preview's subtotal, tax lines and total, not `amount_due`** (a credit balance distorts it). It
  writes no tax record and nothing to Bookkeeping.
- **No invoice link when there is no hosted invoice.** Never use "paid", "payment received" or "receipt" anywhere.
- **The contact line** uses the product's one contact address (`FIELDLOGICHQ_CONTACT_EMAIL`, `lib/fieldlogichq-contact.ts`
  [V import]). It becomes support@ when 6.2's rule says so; don't type an address.
- **Phone and mailing address (§1, owed by the owner):** two optional seller lines that drop out when blank. Their home sits
  beside the contact address, blank today, and gets filled at 6.7 with no code change. **No personal name, ever (O1′).**

**The purchase email (`purchase_details`)**
- Subject: **The details of your purchase: {planLabel}**
- Heading: **The details of your purchase**
- Opening, by case (editable):
  - first: "Thanks for choosing {planLabel} for {orgName}. Here are the details of your purchase."
  - comeback: "Welcome back to {planLabel}, {orgName}. Here are the details of your purchase."
  - plan change: "{orgName} is now on {planLabel}. Here are the details of the change."
  - trial: "Your free trial of {planLabel} for {orgName} has started. Nothing has been charged today."
  - next-season choice: "You chose {planLabel} for {orgName}'s next season. Nothing has been charged today."
- The figures (a two-column table):
  - Bought by · "{purchaser name or email}, on {date}" (the purchaser from `flhq_buyer_user_id`; the row drops out when
    unknown)
  - Plan · "{planLabel}, billed {monthly | yearly}, in advance, to the card on file"
  - Price before tax · "{amount}". For a plan change, the row is "Price before tax, for the rest of this period" ·
    "{amount}".
  - One row per tax · "{tax label}" (e.g. "HST (ON) 13%") · "{amount}" — or "Tax" · "$0.00" when the record has none
  - Total · "{total} {currency}"
  - Trial and next-season only: "Charged today" · "$0.00"
  - Invoice number · "{invoice number}" (drops out when there is none)
- Dates and renewal (fixed):
  - "Started on {date}." · "Renews on {date} at {price} plus applicable taxes, until you cancel. If the price changes, we'll
    email you at least 30 days before."
  - Trial and next-season, instead: "Your first payment: {price} plus applicable taxes, on {date}. **Estimated tax, based on
    your billing address today:** {tax label} {amount}, for a total of {total} {currency}. The tax is worked out when the
    payment is taken, so it can change if your address or the tax rate does."
- Cancelling and refunds (fixed):
  - "You can cancel any time from your billing page. Your plan stays active until the end of the period you've paid for, and
    you won't be charged again."
  - Trial and next-season, instead: "Cancel from your billing page before {date} and you won't be charged."
  - Then, always: "We don't refund the unused part of a period. This doesn't affect any refund right you have under the law."
- The links: "View your invoice" (the hosted invoice, when there is one) · "Your billing page".
- Seller (fixed): "Sold by FieldLogicHQ · GST/HST registration number {number}" (the number part drops out when the invoice
  carries none) · "Questions? {contact address}" · then the optional phone and mailing-address lines.
- Terms:
  - published: "The Terms of Service you accepted: [version {version date}]({link})"
  - preview: "The Terms of Service you accepted: [the draft]({link})"
  - off: no line.
- Closing (editable): "This email is a summary of your purchase. Your invoice is the document to keep for your books, and
  it's always on your billing page." (**Never "receipt" or "invoice" for this email itself.**)

**The yearly reminder (`yearly_renewal_reminder`)**
- Subject: **{planLabel} renews on {date}** · trial or next-season first charge: **Your first yearly payment for {planLabel}
  is on {date}**
- Heading: **Your yearly plan renews on {date}** · first charge: **Your first yearly payment is on {date}**
- Body, renewal: "{orgName}'s yearly {planLabel} plan renews on {date}. We'll charge the card on file {price} plus applicable
  taxes. Based on today's tax rates and your billing address on file, that's {tax label} {amount}, for a total of {total}
  {currency}. If either changes, the tax will too."
- Body, a trial ending: "{orgName}'s free trial of yearly {planLabel} ends on {date}. We'll then charge the card on file
  {price} plus applicable taxes. Based on today's tax rates and your billing address on file, that's {tax label} {amount},
  for a total of {total} {currency}. If either changes, the tax will too."
- Body, a next-season choice: "{orgName}'s yearly {planLabel} plan starts on {date}. We'll charge the card on file {price}
  plus applicable taxes. Based on today's tax rates and your billing address on file, that's {tax label} {amount}, for a
  total of {total} {currency}. If either changes, the tax will too."
- Move-down line, when the next plan differs: "On {date}, {orgName} moves to {nextPlanLabel}, so this is the price of
  {nextPlanLabel}."
- "To keep it, there's nothing to do. To stop it, cancel from your billing page before {date}; your plan stays active until
  then."
- Button: "Your billing page".
- *A trial shorter than the window (League's 30 days) can't get 30 days' notice. Its purchase email states the date, which is
  the notice; §8 of the Terms is about renewals (`/legal` asks for a clarifying line in 0.3, §9 below).*

**Québec (`billing_region_closed`)**
- The refusal: "We're not selling in Québec yet, so we can't take a purchase with a billing address there. If the province
  is wrong, correct it on your billing page and try again."
- The form's notice under Province: "We're not selling in Québec yet." *(The same shape as `usClosed`,
  `lib/billing-location.ts:70` [V].)*

## 7. Rules that bind
- **Figures come from the invoice's tax record (or, for the trial estimate and the reminder, Stripe's preview).** Nothing is
  recomputed. The same invoice reads the same on the email, the billing page and the books.
- **Replay-silent and once-only**, as in 3.3 and 4.1.
- **Dates** only through `formatStoredDate` / `formatTime`. **One spelling** (`npm run check:spelling`). No personal name or home
  address anywhere (O1′).
- **Demos:** demo addresses never receive these. Demo orgs have no Stripe invoices; confirm the tour check passes.
- **Dev mock paths** (`shouldApplyDirectly`, `mock_` ids) write no invoice, so no purchase email. Test it.
- Explicit pathspecs only, on `dev`. **Ask before committing**: other sessions share this working copy.
- `/legal` and `/accounting` review any NEW sentence before hand-off. `/docs` writes the help line at 6.7. No release timing.
- Census work → an `Explore` helper ("return path:line and a verdict"); open every cited line yourself.

## 8. After the build — the 6.4 walk (its own session)
- A checkable Artifact, one purpose: the three deliverables on dev in test mode, with Canadian test cards from the plan's notes
  (e.g. 4000 0012 4000 0000).
  - **Cases:** a first purchase, a trial (League, 30 days), an upgrade, Premium → Club, a comeback, a next-season choice, a
    two-owner club, the reminder (a fixture subscription with its period end set inside the window), and each Québec door plus
    the stored-Québec club's down move and payouts.
  - **The Terms line** in preview, and the line absent with the preview off.
- **Fixture teardown is listed at the end of the walk.**
- Then **6.6** reviews. 6.5 can run any time.

## 9. Review record
Research reads, not a professional's sign-off. **Both applied to §6 on 2026-11-13.**

**`/accounting`** (topic files `GST_HST_ON_SUBSCRIPTIONS_CANADA.md`, `STRIPE_TAX_SETUP.md`, `GST_HST_RETURN_LINES.md`,
`CREDIT_NOTES_ON_REFUNDS.md`; no Stripe test run).
- **Labels:** right as drafted.
- **Applied:**
  - "Price before tax, for the rest of this period";
  - a "$0.00" tax row instead of a blank;
  - the currency read from the record;
  - "GST/HST registration number", from the `ca_gst_hst` ID only;
  - the estimate sentence says the tax is fixed when the payment is taken (owner question B: **yes, say "estimated"** — taken
    as the recommendation);
  - the reminder states the tax as today's figure, read from subtotal, tax lines and total, never `amount_due`;
  - a closing that points to the invoice as the document to keep, instead of "for your records";
  - an invoice-number row;
  - no invoice link for a trial with no hosted invoice;
  - the estimate never holds the email.
- **Still owed before 6.7 (question D):** a live invoice prints the GST/HST number and the Ontario business details.
  Otherwise the number line never appears.

**`/legal`** (`ONTARIO_CONSUMER_INTERNET_AGREEMENTS.md`, the CASL topic files; the CPA text was not re-read).
- **Applied:**
  - the renewal line adds the 30 days' notice of a price change (§8 "then-current price");
  - the refund line;
  - "Bought by";
  - "in advance, to the card on file";
  - the contact line;
  - the optional phone and mailing-address lines (filled at 6.7);
  - the trial and next-season reminder wording;
  - the reminder's tax said as a forecast;
  - a way out of the Québec refusal for a mistyped province;
  - the terms block is fixed (not customisable);
  - no upsell link.
- **CASL:** both emails are transactional (s. 6(6)), so no unsubscribe.
- **Every owner:** fine.
- **English-only Québec refusal:** fine (a refusal forms no contract).
- **Not applied (planning session):** `/legal` asked for support@ in the contact line. The 6.2 ruling keeps hello@ until
  support@ is confirmed to receive mail, so the email uses the product's one contact address and follows that rule.
- **Terms edits owed in 0.3 (`/legal`'s file, not this build):**
  - **§16** "we email you the details of your purchase and a link to the version of these Terms you accepted" (today it says "a
    copy"; whether a link is a copy stays a 6.6 question);
  - **§17** "We do not take a new purchase, upgrade or plan choice with a billing address in Québec. An account that already
    has one keeps its plan and can renew, move down or cancel." (Today's "we do not accept a billing address" is untrue once
    a Québec address can be saved and renewed.)
  - **§8** a line that a trial's first payment date is in the purchase email, and that "the account owner" means every owner;
  - and the Privacy Policy's billing-email wording says "owners".
- **Release check:** the cancel promise ("active until the end of the period, not charged again") must be true on production
  when 6.4 ships. The Terms draft's §8 note says it has been live since the 2026-11-05 release; confirm it against the release
  history before the promote.
- **Interim buyers:** anyone who buys before 6.7 is brought into acceptance at 6.7 by "oldest version still accepted". 6.3
  already does this (no work here).

## Progress
- [x] Part A — the purchase email, every owner, the migration — COMMITTED `8bb8ac32f` 2026-11-13 (simplify + review + legal applied).
  Migration is **478** (476 and 477 were taken by Signed-in family accounts 4b), applied to dev 2026-11-13; its prod step (before
  the promote that ships 6.4) is recorded in MANUAL_PROD_STEPS. Tests: `tests/unit/gst-hst-6-4-purchase-email.test.ts` (30). Hand-over notes for Part B and the walk:
  - **Built as:** pure rules + words + the once-only run in `lib/purchase-details.ts`; the server's reads in
    `lib/purchase-details-server.ts`; every-owner reader `orgOwnerEmails` in `lib/notify-recipients.ts`; the shared send
    outcome in `lib/owners-send-outcome.ts`; `sendTransactionalEmail({ fixedHtml })` keeps the fixed block when an operator
    customises (it renders after the operator's body there, so a customised email reads opening, closing, then the block).
  - **Metadata keys** (`lib/plan-growth.ts`): `flhq_buyer_user_id` at create-checkout, create-team-checkout (subscription only),
    choose-next-season (via `buildNextSeasonCheckoutParams({ buyerUserId })`) and a move UP (`applyMove({ buyerUserId })`);
    `flhq_comeback: '1'` at the two Checkouts when `hadSubscriptionBefore` (now always asked there). The classifier reads the
    invoice's own `parent.subscription_details.metadata` (as it stood when the invoice was made).
  - **Welcome back:** both webhook sends now wait for `!sub.latest_invoice` (a comeback with no invoice). Every Stripe comeback
    has one, so in practice the only `welcome_back` left is the dev mock path in create-checkout (no invoice), kept.
  - **Every owner, moved:** `trial_ending`, both `welcome_back` sends (no-invoice case), the plan-ending emails (ended,
    ends-on, reminder; one idempotency key per owner), the retention warning, the online-payments notices (`owners()` now reads
    the shared helper, demo addresses skipped). `getOrgOwnerEmail` itself no longer fails on two owners (active owners, first
    to accept, `.limit(1)`). **Left on it (one contact address, decided):** the tournament reply-to/fallback senders, schedule
    publish, registration routes, game-day reminders, team-payment notices, CoachTournamentRecord, the platform-admin delete
    email, and the club fee-invoice emails + the Stripe customer email in `lib/platform-stripe-fees.ts` (:472, :642, :688). **The
    fee-invoice emails are billing emails: moving them to every owner is a recommended follow-up, not done (stamp per row).**
  - **New sentences for the next `/legal` pass:** the fallback names "your plan" and "your Coaches Portal" (a Premium invoice
    paid before its workspace exists names `workspaceName`/`teamName` from the checkout first); the two template descriptions
    (platform-admin only). **A conflict to rule:** §6's rule says never "paid" anywhere, but §6's own reviewed cancel sentence
    says "the period you've paid for". The reviewed words were copied exactly; the test pins "paid" to that one phrase.
  - **Not in §6, decided in the build:** a trial or next-season email leaves out "Started on {date}" (the opening says it
    started, or that nothing is charged yet). A $0 `subscription_create` that is not trialing (a 100% coupon) sends nothing.
  - **Known limit:** `flhq_plan_move: 'up'` stays on the subscription after a move, so a later `subscription_update` invoice
    with an amount (only a dashboard change makes one) would read as a plan change.
  - **Close session 2026-11-13 (simplify, review, legal; applied):** one `sendToOwners` in `lib/owners-send-outcome.ts` for the two
    outcome-aggregating senders (plan-ending, purchase); "Bought by" reads the shared name helper (account-only signups have
    `first_name`/`last_name`); the purchase run skips its Stripe reads for a renewal or a fee invoice; the daily catch-up stops
    starting invoices after 2 minutes; a billing reason that does not fit the column's CHECK is stored NULL instead of failing the
    tax record; an unknown outcome now alerts (`captureError`); the fixed block's footer is composed before the render call
    (the envelope guard pins that call's shape). Review found no Critical or High; the guard trigger in mig 478 equals mig 451 plus
    `purchase_email_at`. **Owner calls recorded, not changed:**
    1. *Welcome back is dead for real Stripe subscriptions* (every one has a latest invoice), so a returning club gets only the
       purchase email: the old welcome's restored-tournaments count and dashboard link are gone (product-only, `/legal`: no law angle).
    2. *The comeback flag counts any past or current subscription on a reused customer* (`hadSubscriptionBefore`, which also withholds
       the trial): a coach adding a second team's Premium can be greeted "Welcome back". Fix needs a new Stripe lookup and a ruling.
    3. *A 429 or 5xx from the mail service is read as "may have gone"* (shared `lib/email.ts` refusal list): the once-only stamp stays,
       nothing retries; a person is alerted (new). Treating 429 as a definite refusal is a shared-infra change for the owner.
    4. *Operator sees no fixed block*: the template preview and test-send build from the row alone; a customised send renders
       opening, closing, then the fixed block (default: opening, block, closing); saving a transactional template unchanged flips it
       to customised. Options: show the fixed block in the preview, or move the closing below the block in both paths.
    5. *Two-owner clubs*: `getOrgOwnerEmail` now names the oldest owner where it used to return nothing (schedule publish and
       tournament footers used the club's contact email in that case); the fee-invoice emails still go to one owner (follow-up).
    6. `/legal` (`docs/agents/legal/CASL_PURCHASE_DETAILS_EMAIL.md`): fine as built. Rule wording: "paid" is allowed in the reviewed
       cancel sentence (the Terms say the same); the rule should read "never say a payment was received, never call it a receipt".
       Three small owner questions are in that file (a "keep this transactional" line on the template description; the rule's
       wording; one optional privacy-policy clause about who sees "Bought by").
- [x] Part B — the yearly reminder, Québec — COMMITTED `4a0444c03` 2026-11-13 (simplify + review + legal + accounting applied; no migration). Tests:
  `tests/unit/gst-hst-6-4-renewal-reminder.test.ts` (43) + the `purchase` column in `billing-location-every-path-guard.test.ts`.
  Hand-over notes for the walk:
  - **Built as:** rules + words + the once-only run in `lib/renewal-reminder.ts`; the reads in `lib/renewal-reminder-server.ts`;
    the daily step `renewal_reminders` right after `purchase_emails` (2-minute budget, `captureError` on unknown/throw).
    Québec: `requireBillingLocation(buyer, sent, { purchase: true })` refuses the SENT address before the save, then the one on
    file; `BILLING_REGION_CLOSED` + `isClosedRegion` in `lib/billing-location.ts`; the in-place preview refuses a typed QC address
    before the quote; Province notice in `BillingAddressFields`; the move window offers no "Check again" on it.
  - **Decided in the build (not in §4):** (1) **one stamp table** — a coach's Premium is mirrored on its workspace's
    `organizations` row, so the reminder reads and stamps there; `team_workspaces.renewal_reminded_for` is UNUSED (dictionary says
    so; dropping it is an owner call). (2) **Rows with no cycle on record** (seen on dev: a Premium's org row with
    `subscription_period` NULL) are read too, but only while the charge is 31–37 days out (never a monthly plan's), so they cost
    no daily Stripe read; Stripe's preview decides yearly. (3) **One reminder per account** (the earlier date) if the rows show
    two (a live yearly plan and a next-season choice), or the one stamp would flip and both send daily. (4) **Stripe's date wins**:
    the subscription is read; a cancel set in Stripe, a status not active/trialing, a date moved out of the window or a next
    charge that is not yearly sends nothing. (5) Release restores the stamp to what it held before.
  - **/accounting (applied):** the price is the PLAN's lines only (amount after discounts), their own taxes, total = price + taxes
    charged on top — a club's recovered fees queued on the subscription ride the same invoice and must not inflate it
    (`planLineFigures`; the plan's "subtotal" was ruled wrong under a coupon). A 100% coupon sends nothing. A non-CAD price names
    its code (new sentence shape, no non-CAD sale exists). A subscription that works no tax out alerts a person (`captureError`),
    the email still goes. **Owner flag:** existing Québec accounts renew at GST only (no QST registration) and count toward
    Québec's $30,000/12-month test — keep a running total (`docs/agents/accounting/GST_HST_ON_SUBSCRIPTIONS_CANADA.md`).
  - **/legal (`docs/agents/legal/RENEWAL_REMINDER_AND_QUEBEC_GATE.md`):** words equal §6; transactional. **Owner call (route
    to /plan): the reminder's template is EDITABLE** — an operator edit that drops `{{lead}}` or the cancel line silently breaks
    Terms §8's "at least 30 days … the date and the amount". Rec: render the lead and the cancel sentence in code outside the
    editable body (as the purchase email does; needs a new migration for the row's body), or refuse to save a body without them.
    Terms 0.3: §17 "we do not accept a billing address in Québec" is now untrue for existing accounts (the §9 replacement + "an
    account already holding Québec keeps its plan"); §8 needs the trial line. Lawyer flags: Québec CPA/French on a renewing QC
    account; whether a consumer is owed the renewal notice by law against the `late` path.
  - **Stripe Checkout side door (test mode, read-only 2026-11-13):** 40 of 40 recent subscription sessions set no
    `billing_address_collection` and no `customer_update.address` (only `name`), so Checkout cannot change the customer's address
    and tax uses the one our gate checked. The one completed session whose customer still exists carries the customer's own
    address. The walk's Québec case looks at the page itself.
  - **§6 trial-preview tax question — still open:** test mode holds no trialing subscription (read 2026-11-13). Left to the walk.
  - **Also fixed:** `public-face-s3b-family-emails` was red from Part A's `fixedHtml` (its pin read the old render shape); the pin
    now reads the face spread first and the fixed block only added to its foot.
  - **Repo-wide lint step** in `verify:changed` crashes on a missing `react-hooks` plugin config (not this build's files);
    `lint:focused` on this build's files: 0 errors.
  - **Close session 2026-11-13 (`4a0444c03`):** `verify:changed` still ends red on the known, not-this-build workspace-flip-guard
    entries; typecheck clean; 224 tests (+2 pins) green.
    - **/simplify changed:** the Québec 409 body is built once (`regionClosedResponse`, used by the gate and the in-place preview);
      the reminder's three stored reads run together; the "already told" accounts are dropped AFTER the one-per-account pick (so the
      pick never flips) and no longer cost a Stripe read each day; the two per-account reads in the run go in parallel; `DAY_MS`,
      the 31-day constant and one `ms` helper named once; `planLineFigures` hands its taxes back as read. **Declined:** moving
      `money` out of `purchase-details.ts` (an identical `formatCents` sits in `console-money.ts`, which pulls in four heavy
      modules — a shared leaf would touch other sessions' files; one-line call for a later tidy); making the gate's default
      "purchase" (the census pins today's doors; a design change); previewing only after the cheap Stripe checks; a shared
      budgeted-sweep helper; a `retryable` set shared with `plan-upgrade.ts`.
    - **/review found and fixed:** (1) **a Québec buyer in the Premium → Club window was stuck** — the refusal removed the address
      fields and left only Cancel; the fields now stay (changing the province asks again). (2) the next-season stamp lookup sent up
      to 500 ids in one URL — now a hundred at a time, so it cannot take the whole step down. (3) a comment overclaimed what the
      "already told" filter protects; corrected. Both pinned in the test.
    - **/review noted, not changed (watch in the walk / scale):** the reads cap at 500 rows before the filter (past 500 yearly
      accounts inside 37 days it needs a paged read); a no-cycle row is read only past 31 days, so a job down that long misses it
      (decision 2 above); `planLineFigures` would count a proration line on the plan item and would overstate an inclusive-tax
      line (no inclusive price exists; a pending proration is not expected on a yearly renewal — the walk's upgrade-then-reminder
      case can look); a claim that lands in the database but loses its response is not released (needs a network fault).
- [x] Test-mode answers (a) (b) (c) from 3.2 (read-only, from test-mode events 2026-11-13):
  - **(a)** A trial's $0 first invoice reaches paid and fires **both** `invoice.paid` and `invoice.payment_succeeded`
    (32 of 32 seen). So does every other paid invoice.
  - **(b)** The move-up proration invoice's `billing_reason` is **`subscription_update`**, its metadata carries
    `flhq_plan_move: 'up'`.
  - **(c)** Premium → Club in place is the same: `subscription_update`, with `flhq_plan_move: 'up'`, `inPlaceClub: '1'`,
    `checkoutKind: 'standalone_team'`, `clubName`.
  - **§6's trial-preview question — unanswered:** test mode holds no trialing subscription today (read 2026-11-13), and making one
    fires webhooks into dev. The code drops only the estimate sentence when the preview carries no tax, so either answer is
    safe; the 6.4 walk's trial case answers it.
  - **Stripe Checkout as a side door (§4.2):** `billing_address_collection` is set nowhere; `TAXED_CHECKOUT` sets
    `customer_update: { name: 'auto' }` only (never `address`). Part B confirms in test mode.
- [ ] The 6.4 walk
