# GST/HST · Stage 3: every tax result has a reason, and staff can see it (build prompt)

> Written 2026-11-06. Plan of record: [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §4 "Stage 3" (and §6 touchpoints, §7 risks);
> PM brief [GST_HST_COLLECTION_PM_BRIEF.md](GST_HST_COLLECTION_PM_BRIEF.md). Stage 2 (every paid step is quoted and charged the right tax)
> is built and WALKED (§471 PASSED 36/36 2026-11-06): [GST_HST_STAGE2_BUILD_PROMPT.md](GST_HST_STAGE2_BUILD_PROMPT.md) ▶ Progress holds what it built.
> Recommended model: Opus for Part 0 and Part 1 (money, retention, a new table); Sonnet is enough for Parts 3–4.
> Mark each fact you rely on [V] (verified by you this session, with file:line) or [H] (handed to you, unverified). Lines below marked
> **[V 2026-11-06]** were opened in the code the day this was written; everything else is [H], including every line number.
> Read first: `docs/agents/accounting/RECORDS_RETENTION_AND_LOCATION.md`, `GST_HST_ON_SUBSCRIPTIONS_CANADA.md`, `UNPAID_SUBSCRIPTION_INVOICES.md`,
> `CREDIT_NOTES_ON_REFUNDS.md` (all in `docs/agents/accounting/`), and the root `AGENTS.md` / `AGENCY_RULES.md`.

## What this stage is, in one paragraph

Stage 2 made Stripe charge the right tax. But **FieldLogicHQ keeps no record of it**: a subscription charge's tax lives only on Stripe's
invoice and is re-read live every time the Money tab opens. Nothing stores *why* a charge was taxed (taxed in a province / zero-rated /
not registered there), and nothing stores the **evidence we used** (the buyer's address, province, the US declaration wording and date, the
card and payout country) at the moment of sale. The buyer's current location row is overwritten on every change and deletes with the
club or person, but CRA needs six years of records. Stage 3 builds the **charge tax record** (one row per charge, kept forever-ish, written
by us at the time), shows it on platform admin's Money tab, adds a **"needs a look" list** of charges whose reason is missing or
contradicts the address, and makes sure **our revenue numbers are before tax**. Stage 4 (the books) will sum this table, so design it to be summed.

## What is true today [V 2026-11-06 unless marked]

- **There is no table that stores a subscription charge or invoice** [V]: no per-charge row to attach tax to. Stage 3 creates one.
- Newest Supabase migration is `449_the_start_can_be_corrected.sql` [V `ls`]; **Stage 3's is 450 or later** (re-check at build time: other
  sessions have uncommitted migrations). Copy no "CAMPAIGN RESEED" marker line from mig 443.
- `app/api/billing/webhook/route.ts`: `case 'invoice.payment_succeeded'` is at :813 and only updates plan state; the
  `isTheRecordsSubscription` guard at :822 `break`s for a stray subscription's invoice before any update [V]. **No handler exists for any
  `credit_note.*` event** [V grep]. Fee invoices (club's monthly Stripe-fees invoice) are routed at :253–256 to `syncFeeInvoiceFromEvent`
  (`lib/platform-stripe-fees.ts:605`) and return [H].
- `charge.refunded` / dispute events go to `handleSubscriptionChargeEvent` (`lib/stripe-subscription-charges.ts:94`), which writes a Story
  (`platform_events`) with `amountCents` (tax included) and no tax [H].
- **No code reads Stripe's per-tax `taxability_reason`** [V grep: no use in `lib/` or `app/`]. There is no reason enum anywhere.
- Tax stored today: only `platform_fee_invoices.total` and `.tax_lines` (`[{label, cents}]`, mig 444) [H]. Nothing for subscription / Premium charges.
- `platform_fee_invoices.org_id` is **ON DELETE CASCADE** (mig 390:530) [V]: a pre-existing retention gap; flag it to `/accounting`, do not copy it.
  `platform_refunds.org_id` and `platform_events.org_id` are ON DELETE SET NULL [H]: that is the pattern to follow.
- `billing_locations` (mig 433): ONE current row per buyer, updated in place, FK ON DELETE CASCADE, no history [H]. It holds address, country,
  `region_code`, `us_declaration_at`, `us_declaration_version` (current `us-2026-11-v2`), `card_country`, stored review fields. **Payout country is
  read live** (`org_payment_accounts.country`) and the card/payout "mismatch" reviews are **worked out at read time, never stored**
  (`lib/billing-location.ts` `currentReview`/`evidenceReview`) [H]. So the copy must capture the *resolved* values at charge time.
  `toStored()` strips `card_country` and the review fields, so a new reader is needed [H].
- Money tab (`app/platform-admin/orgs/[id]/MoneyTab.tsx`): charges are read **live from Stripe on every open**, nothing stored
  (`lib/console-money-stripe.ts` header). Tax appears as amount only ("includes $X tax"); no rate, jurisdiction, reason or per-charge location.
  A separate read-only `BillingAddressPanel` shows the buyer's *current* address and review state. Stripe unreachable = no charge list at all [H].
- Revenue-style sums that now include tax [H]: `lib/console-money.ts` `moneyBand` ("Paid, last 12 months" = sum of `amountCents`, tax
  included; "Refunded" likewise). The Business numbers page shows only an MRR/ARR estimate from **list price** (`lib/platform-metrics.ts:241,307`),
  which is already pre-tax: it needs a statement, not a change.
- Working tree is shared and dirty: `MoneyTab.tsx`, `ClubRecord.tsx`, `lib/billing-location.ts`, `lib/console-money.ts`,
  `tests/unit/billing-location.test.ts` have other sessions' uncommitted edits. Read them fresh; commit around them (explicit pathspecs).

## Questions to answer before building (Part 0), and my recommendation on each

**Disagree out loud: three of these change the plan's wording, so decide them before Part 1.**

1. **When is the record written: at payment, or when the invoice is issued?** The plan implies "per charge". But GST/HST is owed when the
   invoice is **issued**, not when it is paid (`UNPAID_SUBSCRIPTION_INVOICES.md`), and a failed or unpaid invoice still owes the tax. Stage 4's
   return worksheet needs the issue date. **Recommend: one row per Stripe INVOICE, written on `invoice.finalized`, with payment status updated on
   `invoice.paid` / `payment_failed` / `voided` / `marked_uncollectible`.** Verify the platform webhook endpoint is subscribed to `invoice.finalized`
   for subscription invoices (the destination for fee invoices was extended in 12d-1; the platform endpoint may not be). If not, it is a new
   LIVE Stripe webhook setting = an owner step in `MANUAL_PROD_STEPS`.
2. **Reason vocabulary.** The plan says three reasons. **Recommend storing Stripe's own `taxability_reason` verbatim PLUS our three-value
   `reason_class`** (`taxed`, `zero_rated`, `not_collected`) derived from it, and a `reason_missing` state when Stripe gave none. Prove each class
   in test mode (a Canadian taxed buyer, a US/non-resident buyer if `usSalesOpen()` allows, a province with no registration). "Missing" must be a
   real stored state, not an absent row, so the list can find it.
3. **Refunds change tax.** A charge's tax is only right after credit notes. **Recommend a second small table (or jsonb on the row) of credit
   notes, written from a NEW `credit_note.created` / `credit_note.voided` handler**, so a refund made in Stripe's dashboard still lands. Same
   no-cascade rule. Owner step: subscribe the live endpoint to the credit-note events.
4. **Fee invoices.** `platform_fee_invoices` already store total + tax lines, but no reason or evidence copy. **Recommend they get the same
   record (same table, `kind = 'fee'`)** so Stage 4 and Stage 5 read one place, and flag the cascade to `/accounting`. Do not rewrite that table in Stage 3.
5. ~~**Backfill: none.**~~ **RULED by the owner 2026-11-06 (GST/HST Stage 4 Ask 11 = A): BACKFILL.** On its first run, Stage 3 copies
   every LIVE invoice Stripe holds that was issued on or after the GST/HST registration effective date, through the same pure builder.
   That date is Sept 26, 2026 today, with a CRA request pending to backdate to May 1, 2026. Nothing was sold before either date, so use May 1, 2026 as
   the floor; it covers the backdate either way. Reason: once Stage 2 is promoted, a paying club creates a taxed invoice, and a
   forward-only table would leave every invoice from before Stage 3's release off every return worksheet. Evidence for a backfilled
   row is resolved at backfill time; mark it (e.g. `evidence_captured = 'backfill'`) so the record never claims it was captured at sale.
   Idempotent on the invoice id, like the webhook writer.

**Also RULED 2026-11-06 (Stage 4 Ask 4 = A), and it adds columns to Part 1:** a sale in a currency other than CAD is valued at the **Bank of
Canada daily rate on the invoice's issue date** (CRA Memo 3-6 / ETA s.159; `docs/agents/accounting/GST_HST_RETURN_LINES.md` §5). Store
`fx_rate`, `fx_rate_date`, `fx_source` (`bank_of_canada`) and the CAD amounts (before tax, tax, total) beside the original-currency ones.
Keep Stripe's own CAD figure, when it gives one, only as a cross-check column. Never use it as the return figure: its filing amounts can be
blank on the zero-rated rows. Only US sales need it, and they stay closed (`usSalesOpen()`), so build the columns and the rate fetch but
it may never run in production yet. Also from Stage 4 (Ask 2 = A): **this table is the ONLY source of the sales figures on the GST/HST return
worksheet.** Bookkeeping's Stage 6 Stripe import will not carry sales tax. Design the table for that: issue date, status, credit notes and the
reason class must be summable without calling Stripe. Drawings of the worksheet that reads it: https://claude.ai/artifact/LbCjjVcnZeTP8uUT3yVZan tabs 5–6.

If the owner has not ruled asks 1–4, present them as Asks with the recommendations above, in plain language, and stop (ask 5 and the
currency columns are already ruled).

## Parts (each ends with typecheck, focused tests, `verify:changed`)

**Part 0, rulings + proof.** Present the five Asks. Then read-only probes in Stripe TEST mode (scripts in `.probe/gst3/`): list what
`taxability_reason`, `tax_rate_details` and `jurisdiction` Stripe returns on a taxed ON invoice, an AB invoice, and a not-collecting case; record the
real field names. Confirm which webhook events the platform endpoint receives. Do not build on a guessed field name.

**Part 1, the charge tax record (migration + writer).**
- New table (name it for what it is, e.g. `platform_charge_tax_records`), keyed by Stripe invoice id (unique). Columns, at minimum: org/person ids as
  **plain ids with NO cascading FK** (SET NULL or none, like `platform_refunds`), `kind` (subscription / premium / fee), `stripe_invoice_id`,
  `stripe_charge_id`, `issued_at`, `currency`, `amount_before_tax_cents`, `tax_total_cents`, `total_cents`, per-line tax `jsonb`
  (`{jurisdiction, tax_type, rate, cents, taxability_reason}`), `reason_class`, `reason_missing`, `status` (open/paid/void/uncollectible),
  and the **evidence copy**: address lines, country, region, postal code, `us_declaration_version`, `us_declaration_at`, `card_country`,
  `payout_country`, `review_reason` (resolved at write time), `evidence_missing` flag, plus the buyer's name as it stood. RLS on, no policies,
  `GRANT … TO service_role` (`tests/unit/migration-table-grants-guard.test.ts` enforces).
- A pure builder in `lib/` (no I/O; unit-tested) that turns `invoice + resolved evidence` into the row, and a thin writer. The new evidence reader
  must resolve card country, payout country and `currentReview(...)` at write time; do not reuse `readBillingLocation` (it strips them).
- Wire the writer into the webhook for **every** subscription invoice, **before** the `isTheRecordsSubscription` `break` at :822 so a stray
  subscription or a coach's own Premium customer (a person, not a club: `buyerOfStripeCustomer`) still gets a record. Idempotent on replay
  (webhook retries).
- Same writer for fee invoices from `syncFeeInvoiceFromEvent`.
- Credit notes: new handler + table/jsonb per Ask 3; the console's own refund path (`lib/console-money-stripe.ts` ~:500) must not double-write.
- Dictionary + snapshots in the same unit of work (`DATA_DICTIONARY.md` markers, `npm run refresh:snapshots`, `npm run check:dictionary`).
- Guard test: every code path that creates a Stripe invoice-bearing charge is covered by the writer (extend
  `billing-location-every-path-guard.test.ts` style: the build fails if a charging path is added with no record).

**Part 2, the Money tab shows it.** ⚠ Owner mockup session first (CLAUDE.md house rule for new screens): run `/design` then `/ux`, draw as a Claude
Artifact at true size, **whole Money tab before/after** (house layout: sticky tabs, minimal scroll, Everything / Show-only-what-differs toggle).
Draw: a **Tax** treatment on each charge row (rate named: "HST 13%"), the charge window showing the tax lines, the reason in plain words,
**"Taxed for: {province, country}"** and the evidence copy *as it stood that day* (not today's address), credit-note tax netted. Draw the
"needs a look" list and its empty state. Respect the existing `find_stripe` power: roles without it see "ours only", never tax or location.
Reuse shipped components (the Money tab's own row recipe); Stripe-unreachable must **not** hide the stored records (they come from our table now).
Plain words for every reason; run `npm run check:spelling`.

**Part 3, "needs a look".** A query over the stored table (not a Stripe read; the plan's monthly rhythm needs it from the database) for rows whose
reason is missing, or whose taxed province contradicts the stored evidence (tax rate does not match the region's rate, a zero-rated row with
no non-resident evidence, a flagged review at the time of sale, evidence missing). Define each contradiction in one sentence and unit-test it.
Show it on the org's Money tab and as a count where the platform admin already surfaces "needs review" (reuse the existing strip, do not add a second one).

**Part 4, revenue before tax.** `moneyBand` "Paid, last 12 months" and "Refunded": show **before tax** (from the stored record; fall back
to Stripe's pre-tax amounts, never total minus guesswork), and say "before tax" in the label. Business numbers: add the statement
"before tax" to the MRR/ARR line and a guard test that no figure in `lib/platform-metrics.ts` reads an amount that includes tax. The Story's
refund/dispute metadata gains the tax split.

**Part 5, closeout.** `/simplify` (new table + builder + reader is a new abstraction), `/review` (money, high risk), `/accounting` review
**before hand-off** (CLAUDE.md rule: it changes what we record): retention (no cascade, the pre-existing fee-invoice cascade), the evidence
copy, `taxability_reason` mapping, net-of-credit-note. `/docs` check (platform-admin only = likely none). Add the stage's owner steps to
`MANUAL_PROD_STEPS.json` (migration 450+, any webhook event subscription). Re-run the Stripe test matrix rows that create invoices and confirm
every one produced a record. Write the owner walk (checkable Artifact, one purpose, new test buyers, runs on the dev site): charge → record exists
with the right reason and evidence; change the buyer's address afterwards → the OLD charge still shows the OLD address; delete a test club → its
records survive; refund in the Stripe dashboard → the credit note appears; the list flags a deliberately contradicted row; revenue tile is before tax.

## Done when

- Every subscription, Premium and fee invoice leaves a stored record with reason, tax by name and the evidence copy; replays do not duplicate.
- Deleting a club or person does not delete their records (tested).
- The Money tab shows tax by name, reason and location-as-of-sale, and the "needs a look" list works from our own data.
- Revenue figures say and mean "before tax"; a guard keeps tax out of them.
- Dictionary + snapshots updated; typecheck and `verify:changed` pass; `/review` and `/accounting` done; walk written.

## Do not

- Do not link the record to the buyer's current location row; copy it.
- Do not build Stage 4's return worksheet or the owner Bookkeeping in this stage (it only has to be summable).
- Do not touch live Stripe, production, hooks or settings. Owner steps go in `MANUAL_PROD_STEPS`.
- ~~Do not backfill.~~ (superseded 2026-11-06 by Stage 4 Ask 11 = A: backfill from 2026-05-01, see Ask 5 above.) Do not rewrite `platform_fee_invoices`.
- Do not restate plan prices anywhere; link the Facts doc.

## ▶ Progress

- **2026-11-06 · Part 0 started: probes run, Asks presented, rulings OWED.** Probe `.probe/gst3/part0-reasons.mjs` → `part0-reasons-run1.txt`
  (read-only invoice previews, no customer, an active monthly test price, CAD, tax-exclusive; nothing created in Stripe).
  - [V] **Field names.** `invoice.total_taxes[]` and `invoice.lines.data[].taxes[]` are each `{amount, taxable_amount, taxability_reason,
    tax_behavior, type: 'tax_rate_details', tax_rate_details: {tax_rate}}`. `tax_rate` is a bare id unless expanded; expanding BOTH
    `total_taxes.tax_rate_details.tax_rate` and `lines.data.taxes.tax_rate_details.tax_rate` in one call works and returns `display_name,
    jurisdiction, jurisdiction_level, country, state, percentage, effective_percentage, tax_type`. The writer must re-read the invoice
    with those expands (the event payload carries ids only).
  - [V] **What Stripe says, per buyer.** ON: one line, HST 13%, `standard_rated`, jurisdiction "Canada", **`state` null** (an HST line never
    names the province; the province must come from the address Stripe taxed on, plus the rate). AB: GST 5% `standard_rated`. BC: GST 5%
    `standard_rated` **and** PST 7% `not_collecting` (amount 0, effective 0). QC: GST 5% + QST 9.975% `not_collecting`. US (NY): ONE line,
    "Sales Tax" New York 8.875% `not_collecting`, **no Canadian line at all**.
  - ⇒ **Ask 2 as written above is wrong.** Stripe never returns `zero_rated` for a US sale; it reports the US state it is not collecting in.
    Zero-rating (a service exported to a non-resident) is OUR determination from the Stage 1 evidence, not Stripe's. And "not registered
    in that province" is per tax line (BC is GST taxed AND PST not collected), not a reason for the whole charge. Revised Ask 2 below.
  - [V] **Webhook events.** The test-mode dev platform endpoint (`/api/billing/webhook`) already receives `invoice.finalized`, `.paid`,
    `.voided`, `.marked_uncollectible`, `.payment_succeeded`, `.payment_failed`, `charge.refunded` and the dispute events
    (`revenue-accounting-evidence/stripe-sandbox-2026-11-06.json`, the billing destination). **No `credit_note.*`.** Live: the four invoice
    events are on `docs/agents/ops/stripe-setup-guide.md`'s add-list (12d-1) but not in `MANUAL_PROD_STEPS`; live not read (not touched).
  - [V grep] **Charging paths on OUR account:** subscriptions (Checkout `mode: 'subscription'` + API updates) and the fee invoice
    (`lib/platform-stripe-fees.ts:481` `invoices.create`). The only `mode: 'payment'` Checkout (`lib/stripe-connect.ts:143`) is a family's
    payment on the club's connected account, not our sale. So one row per invoice covers every platform sale (Part 1's guard proves it).
  - [V] Webhook layout as described above (fee-invoice routing :253–256, `invoice.payment_succeeded` :813, the stray-subscription `break`
    :822, `invoice.payment_failed` :881/:888). `buyerOfStripeCustomer` is `lib/billing-location-server.ts:395`.
  - **Asks as presented 2026-11-06 (recommendations):** (1) write at `invoice.finalized`; update on paid / failed / void / written off and
    keep the DATE of each change (a write-off's tax relief lands in the write-off's period, `UNPAID_SUBSCRIPTION_INVOICES.md` step 3).
    (2) REVISED: one `gst_hst_position` per record = `taxed` / `zero_rated` (ours, from the evidence) / `missing`; every Stripe tax line
    kept verbatim with its own `taxability_reason`; a US sale gets a synthesised Canadian line at 0% marked zero-rated (source: ours) so
    Stage 4 sums zero-rated sales; a Canadian buyer with a `not_collecting` Canadian line goes on "needs a look" (exactly what live does
    today with 0 registrations). Keep Stripe's own copy of the address it taxed on beside our evidence copy. (3) credit notes in their
    OWN dated table, written from new `credit_note.created` / `.voided` handlers, keyed by note id so the console's refund (Stage 2 6b,
    already makes notes) cannot double-write; a plain dashboard refund with NO credit note goes on "needs a look" (tax not reduced).
    Owner step: subscribe test + live to the credit-note events. (4) fee invoices = same table, `kind = 'fee'`; flag the
    `platform_fee_invoices` cascade to `/accounting`. (5) no backfill.
  - **RULED 2026-11-06 by the owner: all five as recommended (Ask 2 = the REVISED recommendation).** ⚠ **Ask 5 is SUPERSEDED** by the
    Stage 4 session's later ruling the same day (Stage 4 Ask 11 = A: BACKFILL from 2026-05-01, recorded above in this file's Asks):
    built as ruled there, with its reason (a sale between Stage 2's promote and Stage 3's would miss every return worksheet). The owner
    answered "as recommended" in this session before that edit landed, so **the owner should confirm backfill is the standing answer**.
  - **Part 0 DONE 2026-11-06.** Real invoices (`.probe/gst3/part0-real-invoice-run1.txt`, `part0-credit-note-run1.txt`): [V] the EVENT
    payload names each tax rate by id only (the writer re-reads with the expands); events arrive in any order and the `invoice.finalized`
    payload already showed `paid` (so every event re-reads and upserts); `invoice.customer_address` and `status_transitions.finalized_at`
    are on it; dahlia invoices have NO `charge` field, the payment is `invoice.payments` (expand) → `payment.payment_intent`; a $0 trial
    invoice is finalized + paid at once with GST `standard_rated` at 0; a credit note carries `total_taxes` (rate id), `type`
    (post_payment), `effective_at`, `refunds[]`, `out_of_band_amount`; **Stripe voids a note only on an OPEN invoice** ("You can only void a
    credit note if the associated invoice is open"), so a refund's note is never voided.
- **2026-11-06 · Part 1 BUILT (uncommitted; dev DB has mig 451).** What it does: every invoice on our account (club plan, Premium, fee,
  one-off) and every credit note leaves a kept record with the tax by name, OUR GST/HST position and the buyer's evidence copied.
  - Migration `451_every_charge_keeps_its_tax.sql` (two tables, no FK, guard triggers, plus Stage 4's `evidence_captured` and CAD
    valuation columns). Dev applied, amended once the same day (empty tables dropped + re-made). Rolled-back rules probe
    `.probe/gst3/part1-guard-steps.sql` **24/24** (it caught a real hole: a CHECK with `fx_source = 'same_currency'` passes on NULL;
    now `IS NOT DISTINCT FROM`). MANUAL_PROD_STEPS 451 written, with the Stripe event owner steps.
  - Pure `lib/charge-tax-record.ts` (`gstHstPosition`, `buildChargeTaxRecord`, `buildCreditNoteTaxRecord`, `cadValuation`,
    `rateFromValet`, `torontoDate`); writer `lib/charge-tax-record-server.ts` (`recordInvoiceTax`, `recordCreditNoteTax`,
    `recordInvoiceRefunded`, `recordTaxOrReport`, `catchUpChargeTaxRecords`, `backfillChargeTaxRecords`, `bankOfCanadaRate`); evidence
    reader `readSaleEvidence` in `lib/billing-location-server.ts` (resolves card, payout and `currentReview` at write time).
  - Wiring: billing webhook records every `CHARGE_TAX_INVOICE_EVENTS` / `CHARGE_TAX_CREDIT_NOTE_EVENTS` event FIRST (before the fee
    route, the no-customer return and the stray-subscription `break`); `charge.refunded` keeps `refunded_cents` (before the
    not-a-subscription return); the console refund (`RefundStore.recordCreditNote`) and the fee credit write the note at once; daily job
    steps `tax_records` (35-day catch-up) then `tax_records_backfill`. ⚖ **Agent call, flag to the owner:** a failed record NEVER fails
    the webhook (reported + one `tax_record_alert` email; the daily job retries) — a club's plan must not wait on our bookkeeping.
  - Deviations from the prompt's column list, each on purpose: `stripe_payment_intent_id`, not `stripe_charge_id` (dahlia invoices
    name the payment, and a charge joins by its `payment_intent`); `reason_class` / `reason_missing` became `gst_hst_position` +
    `gst_hst_position_why` (Ask 2 revised); kinds add `one_off` (a dashboard invoice is still our sale); `taxed_*` = Stripe's own place
    beside our `evidence_*` copy.
  - Proof: unit `tests/unit/charge-tax-record.test.ts` (22); the guard block "every charge leaves a tax record" in
    `tests/unit/billing-location-every-path-guard.test.ts` (each charging call answers `invoice` / `none`; webhook order; refund; both
    note makers; the daily steps; the setup guide lists every event; **the dev schema snapshot holds ZERO foreign keys on both tables**);
    `team-move-coverage` STAYS + `workspace-flip-guard` SPECIAL entries; the REAL writer on real test invoices
    `.probe/gst3/part1-writer-run3.txt` **21/21** (ON taxed HST 13%, a US person with the declaration zero-rated with our 0% line, a
    no-one's customer = unknown + evidence missing, replay = one row, paid / void / credit note); Bank of Canada fetch against the real
    API `.probe/gst3/part1-boc-run1.txt` (a Sunday falls back to Friday). Typecheck clean. `verify:changed` (run 1, before the Stage 4
    amendment): 10 failures, ONE mine (workspace-flip-guard, fixed); the other 9 are other sessions' files (help-content tax words,
    practice plans phone, plan-billing-usage 503, public tournament stage 6 walk, series date groups, ExpenseFormWindow footer
    [pre-existing], workspace-upgrade-status in-force).
  - **Open for `/accounting` (Part 5):** a USD credit note is valued at its OWN date's rate (vs the invoice's); zero-rating rests on a US
    address + the declaration (the "one outside-Canada sign" T7 asks for is Part 3's check, not the position); the `platform_fee_invoices`
    cascade (pre-existing, flagged); a refund with no credit note leaves the tax unreduced (Part 3 lists it); retention vs a GDPR delete of
    the Stripe customer (our copy survives it — likely `/legal` too).
  - **Known gaps:** `refunded_cents` stays 0 on a record the catch-up first wrote after a refund (until the next refund event); the
    credit-note events are on NEITHER endpoint yet (owner step), so a dashboard refund's note lands by the catch-up, up to a day late.
  - Next: `/simplify` then `/review` on Part 1 (new abstraction, money); then Part 2 needs the owner mockup session.
- **2026-11-06 · Part 1 `/simplify` DONE (uncommitted).** Four angles (reuse, simplification, efficiency, altitude). Applied, no
  behaviour change: the builder reads `taxWasWorkedOut` (lib/billing-tax.ts, the quote's own rule) and `orgDayKey` (lib/timezone.ts;
  `torontoDate` removed); ONE `invoiceIssuedAt` / `noteIssuedAt` / `amountsOf` in the pure module, used by both builders AND the
  writer's late-valuation paths (the writer's own `issuedIsoOf` and the note's hand-listed CAD fields are gone); `idOf` exported once;
  `SaleEvidence.location` = `StoredBillingLocation`; `readSaleEvidence` and `readBillingLocationForConsole` share one private
  `rowWithReview`; the writer reads Stripe and our row in parallel, and `contextOf` reads evidence / org / rate in parallel; the
  catch-up and backfill are ONE `recordMissing` (5 at a time, `inParallel`) + `collect`, `notRecorded` uses `fetchAllIn`; the daily
  refresh re-reads an open record only when Stripe's list shows it moved, it is older than the list, or it still lacks its CAD rate.
  Proof: typecheck clean; unit 268/268 (charge-tax-record + every billing-location / billing-tax / guard file); the real writer
  `.probe/gst3/part1-writer-run4.txt` **21/21**; `verify:changed` run 3 (`.probe/gst3/verify-changed-run3.txt`): 14,625/14,634,
  the 9 failures the SAME other-session files as run 1 (help-content tax words, practice plans phone, billing free time, Stage 6 walk,
  series date groups, console footers, workspace status), none in a Stage 3 file.
  - **Skipped, on purpose:** dropping `invoice.payment_succeeded` / `.payment_failed` from the writer's events (duplicates of `.paid`,
    but the LIVE endpoint may lack `.paid` until the owner step, so they are the belt); one shared "record this note" wrapper (the guard
    test pins each maker's call; churn for little); one array per guard trigger in mig 451 (applied to dev; a SQL re-apply + re-probe
    for a tidy-up); a stop marker for the backfill (its window is fixed once the webhook writes; a few Stripe list pages a day);
    handing the fee invoice to `syncFeeInvoiceFromEvent` (one extra read per fee-invoice event); not awaiting the record in the
    webhook (`after()` drops on Amplify).
  - **Owner 2026-11-06 (this session):** "we are waiting for CRA to confirm we can go back to May 1, currently our start date is
    Sept 26." Read as: the backfill stands; registration effective = Sept 26, 2026 until CRA answers. The backfill floor stays
    2026-05-01 (it is only how far back we LOOK; it covers either date). ⇒ **Part 3 must read the registration effective date
    (Stage 4a's changeable setting, `GST_HST_STAGE4A_BUILD_PROMPT.md`), never a hard-coded date:** a sale issued before it is NOT
    "tax missing" (we were not registered yet) and stays off "needs a look". Stage 4's worksheet reads the same setting.
  - **Handed to `/review` (behaviour choices, not tidy-ups):** (a) `refunded_cents` has its own writer reached through the Story
    handler; reading the refunded figure inside `recordInvoiceTax` would close the Known gap above. (b) `orgOfInvoice` re-implements
    the webhook's `ownerOf` and they DIFFER (exactly one match vs the first match), so a charge alert and its tax record can name
    different clubs.
- **2026-11-06 · Part 1 `/review` DONE; Part 1 COMMITTED `976a6a7b3` 2026-11-06 (owner "commit"; 20 files, the dictionary's
  two-table hunk only; schema snapshots left for the next refresh commit, they carry other sessions' tables).** High-risk funnel: gate (typecheck, focused lint clean; `check:migrations` red
  only for prod-owed schema, 451 among it, expected) + four lenses (pure rules vs the Part 0 probes, data & contract, webhook blast
  radius, security / retention / livemode). No Critical, no High. **Every `gstHstPosition` branch matches the Part 0 probes** (ON, AB, BC
  GST + PST not collecting, QC, US NY, the $0 trial, tax off); no cascade anywhere (dev snapshot: zero FKs; no delete path touches
  the tables); RLS / grants clean; livemode reads per mode or keyed by globally unique Stripe ids.
  - **Decided (a): read the refunded figure when the record is FIRST written, plus a daily refund sweep — not on every write.** The
    gap was wider than handed over: a missed or failed `charge.refunded` was never retried at all (the webhook answers 200, the
    catch-up never re-read a paid record), so Part 3's "refund with no credit note" would have missed it for good. Now: the first
    write reads the payment's `amount_refunded` (best effort, one read, only for a paid invoice); the catch-up lists Stripe's
    refunds of the last 35 days and raises any record that is behind (monotonic). Every-write reading would add a read per event
    and still not fix a missed refund event.
  - **Decided (b): exactly-one, shared.** `orgOfSubscription` (lib/charge-tax-record-server.ts) is the ONE rule; the webhook's
    `ownerOf` calls it. `organizations.stripe_subscription_id` is NOT unique (dev index snapshot), so "the first match" could name
    an arbitrary club on both an alert and a six-year record; a shared id now names no club. Guard test pins the wiring.
  - **Fixed (Medium):** (1) **out-of-order state** — two events read at once could finish stale-last and roll a paid record back to
    open with no paid date (all four lenses / my own read): the update now moves only forward in Stripe's order (`MOVES_FROM`) and
    never drops a recorded date (a write-off's date is its tax period); a void note is never undone and keeps its first date.
    (2) **the webhook waited on bookkeeping** — the record ran BEFORE the plan's work: split into `runPlanWork` (every early return
    lives there) and the seam records an invoice AFTER it, whatever it answered; every Stripe read in the writer has a 10 s limit
    (client default 80 s) and the alert email an 8 s one. (3) **the console refund** awaited the note's record before its strict
    audit row (route `maxDuration` 60): moved after the audit. (4) **a hand-made invoice could be refused forever** — `taxed_region`
    ≤ 10 (a province spelled out) and the number regexes: mig 451 now length-only (region ≤ 100, numbers 1–64), re-stated as
    named constraints so dev reshaped; builder cuts `buyer_name` to 300 and stores a blank number as none. **Dev re-applied;
    rules probe 24/24** (`.probe/gst3/part1-guard-steps-run-review.txt`). (5) **the daily job could overrun** (300 s, two new steps
    last): both stop STARTING documents 240 s after the job began, and a step with any failure is now NOT ok on the job's record
    (it said ok with failures buried in the logs). (6) **the catch-up could leave records stuck**: it now re-reads `uncollectible`
    as well as `open` records, any record still lacking its CAD rate (it only looked at open ones), and a note Stripe lists as void
    that we show issued. (7) **a note written before its invoice's record** froze a null owner: the note writer records the invoice
    first (its failure is the invoice's own; the note goes on).
  - **Fixed (Low):** `toCad` rounded a true half cent down (100 × 1.005 → 100.4999…): cut to 15 significant digits, never -0; the
    Stripe CAD cross-check no longer blocks the insert (best effort); the alert email names a database error's message (a plain
    object printed "[object Object]"); a first write a day or more after issue is labelled `catch_up`, not `event` (it did not read
    the evidence at the sale); dictionary (movable columns incl. the set-once CAD ones, "six" not "seven", the new checks, refunded,
    the late label) and the setup guide's dated negative → "owner step OWED".
  - **Proof:** typecheck clean; focused unit **236/236** (charge-tax-record + every billing-location* + billing-tax +
    stripe-subscription-charges + console-money* + stripe-billing-events*; two older seam tests re-pointed at `runPlanWork`, intent
    kept); the real writer `.probe/gst3/part1-writer-run5.txt` **25/25** (3 new: a stale open read keeps paid + its date; a void
    note keeps its first void date; a note written before its invoice carries the invoice's owner); the catch-up once end to end
    on test mode `.probe/gst3/review-catchup-run1.txt` (120 invoices + 107 notes in 27 s, 0 failed; 65 real refunds started with
    their figure; everything removed after). `verify:changed`: see the run below.
  - **Not fixed, on purpose (for later parts / other agents):** the FX day — a USD invoice issued before the Bank of Canada posts
    that day's rate (~4:30 p.m.) takes the prior day's (set once); `/accounting` to rule with the open note-rate question (US sales
    closed, dormant). Each CAD figure rounds on its own, so before-tax + tax can differ from total by a cent (`/accounting`).
    Stage 4 must sum GST/HST from `tax_lines` (Canadian GST/HST lines), not `tax_total_cents` (it includes US tax / PST), and treat
    `void` / `uncollectible` by their own dates. A dashboard invoice with MANUAL tax rates (automatic tax off) records
    `missing / stripe_did_not_work_out` — a safe "needs a look", noted for Part 3's wording. The buyer is frozen at the first event
    (a new club's first invoice can precede its card country / org link) — Part 0 Ask 1's rule; Part 3 can read card country live.
    Six-year copy of a person's home address survives their account deletion → `/legal` (with the existing retention note).
    A draft older than 35 days whose finalize write failed and which predates the first `event` record is missed by both nets
    (rare). The catch-up re-reads at most 200 movable records a run (newest first). No `event.account` skip in the billing webhook
    (Connect events go to their own endpoint; would only be a noisy alert).
  - **`verify:changed` after the fixes** (`.probe/gst3/verify-changed-review-run1.txt`): 14,757/14,767; the 10 failures are other
    sessions' files — the same 9 as before (tax words, practice plans phone, plan-billing usage, Stage 6 walk ×6 tests, series date
    groups, console footers, workspace in-force) plus ONE new, `table-recipe-guard` on `BankReport.module.css` (the bank balance
    check's session). None in a Stage 3 file. Focused lint clean.
  - **Commit pathspecs (owner's yes first):** the Part 1 files plus, from this review, `tests/unit/stripe-subscription-charges.test.ts`
    and `tests/unit/stripe-billing-events.test.ts` (seam tests re-pointed). ⚠ The snapshot hook refreshed the shared schema
    snapshots after the dev re-apply; those files also carry other sessions' changes — stage them only with a partial commit.
  - Next: `/accounting` flags above go with Part 5; Part 2 needs the owner mockup session.
- **2026-11-06 · Part 2 DRAWN, rulings OWED (no code).** `/design` + `/ux` run; drawings published
  https://claude.ai/artifact/NwkZe2YiwiN7Ydua9JVntA (source `GST_HST_STAGE3_PART2_DRAWINGS.html`): whole Money tab before/after,
  every row kind, three sale windows + the shipped one, Stripe unreachable before/after, needs a look (club, empty, Today, mark),
  who sees it, 8 Asks. Recommended: (1) the list becomes ONE ROW PER SALE (invoice) from our record, Stripe's payment joined;
  (2) unreachable keeps the sales from our record; (3) row = tax name + rate + amount + province, window = the rest; (4) the
  shipped strip + tab dot + a Show dropdown + the shipped flag line; (5) [V platform-waiting.ts:62] there is NO cross-club
  needs-review count today — recommend a new Today Customers queue row "Sales tax"; (6) NEW, not in the plan: "Mark as looked at"
  (required why, kept BESIDE the record = a new table + migration, Super admin + Billing) or the list only grows; (7) find_stripe
  roles only; (8) refund with no credit note = the shipped flag line. Part 4's before-tax band is drawn on the after frame.
- **2026-11-06 · Part 2 RULED by the owner: all eight Asks A (paste-back).** Recorded in `memory/design_decisions.md` (2026-11-06,
  "The club record's Money tab lists sales, not charges") and at the top of `GST_HST_STAGE3_PART2_PROMPT.md`, which now carries the
  split: Part 2 = the sales list, Tax column, window, unreachable state, roles; Part 3 gains the strip/dot/dropdown/flag-line wiring,
  Today's "Sales tax" row and **"Mark as looked at" (Ask 6 = A: a new table beside the records + a migration; Part 3's `/review` and
  `/accounting`)**; Part 4 = the before-tax band as drawn. Owner did not yet say "build": Part 2's build is the next session.
  Build prompt for that session: [GST_HST_STAGE3_PART2_BUILD_PROMPT.md](GST_HST_STAGE3_PART2_BUILD_PROMPT.md).
- **2026-11-06 · Part 2 BUILT. The Money tab lists sales with their kept tax.** Built to the
  ruled drawings (all eight Asks A) plus the owner's nine gap rulings of this session ("all as recommended", 2026-11-06): (1) with
  Stripe unread, "What it paid for" says what the record knows by kind ("The subscription · invoice …", "Coach Premium · invoice
  …", the fee words, "Invoice made in Stripe · …"), the state reads "Open" with no due date; (2) the unreachable band: "Paid, last
  12 months" = record totals, "{n} paid sales since … · our record", Refunded "{n} sale(s) refunded · our record" (before tax = Part
  4); (3) a record not written yet: quiet "No tax record / not written yet" (before the registration date: "Before we registered");
  (4) "Paid from credit"; (5) "Not paid" = open + written off, never void, "{n} sales not paid, newest first" / "Every sale in these
  12 months is paid."; (6) the window's answer for a pre-registration sale names the setting's date; (7) both failing: "Stripe and our
  tax records could not be read at {clock}. Our subscription record is below; the sales, charges and refunds wait until they
  answer."; (8) unreachable window foot "Not read from Stripe · tax from our record"; (9) "Failed tries" lines in the window.
  - Pure `lib/console-money-sales.ts` (the join `joinSales` + every word: Tax cell, Stripe says / Our record says, Card, the
    record band, the window band netting credit notes, the GST/HST answer per position/why, `taxReasonWords` with an unknown reason
    shown as Stripe's code, the three "Kept" wordings, the evidence lines, the changed-address check, the credit note's GST/HST);
    server read `lib/console-money-sales-store.ts` (records BY STRIPE CUSTOMER + livemode, the same set Stripe's side shows — tab 5:
    a coach paying for several portals has one set of sales; plus the records of invoices the window's charges name; and
    `registrationDateOrNull`, the Stage 4a setting from the Bookkeeping store with a 4 s limit, null on any failure).
  - The money route reads records + the registration date beside Stripe and returns them in `read` AND `unreachable`; the charge
    route also opens a sale by `in_…` (ownership: record by customer + mode, invoice by `ownsObject`) and, with Stripe down, still
    answers from the record (`stripe: 'unreachable'`). `readClubInvoice` + a shared `chargeOfInvoice` (Find's invoice step reuses it).
    `MoneyInvoice` gains state fields (status, issued, totals, due, written off), `MoneyCharge.paymentIntentId`, `MoneyRead.invoices`
    (drafts skipped); `invoicePaidForWords` (the row drops "includes $X tax"); `isRatedTaxReason` exported from the pure record module.
  - Screen: one row per sale, Tax column, Show dropdown (All sales / Not paid), void struck + Void chip + uncounted, failed tries
    folded, "Show older sales" pages Stripe AND our records (joined over every page read, deduped), the amber "Tax missing" chip opens
    the window at its Tax group; window = joined band, Tax / Where it was taxed / The payment, "Stripe invoice" beside "Stripe charge",
    the changed-address line with a door to today's block, unreachable "Refunds wait until Stripe answers."; Billing address caption
    says "today". Records failing: the rows come from Stripe's invoices + charges (folded as sales), Tax "Not read", the amber line;
    the dropdown stays (All / Not paid — Needs a look is Part 3's). Shipped orphan class `money.compare` (never declared) removed.
  - Proof: typecheck clean; unit `tests/unit/console-money-sales.test.ts` **22/22** (every tab-2 row kind, BC, zero-rated + CAD,
    missing vs before registration incl. the Toronto day and a moved date, registration unread, open/paid after failure, duplicate,
    written off, void, $0, outside Stripe, credit, fee owed, bare, not written yet, unreachable, records failing, credit-note netting,
    Kept, evidence, address changed, words for every why); focused money + guard files 279 run, 278 pass (the one failure is
    `ExpenseFormWindow.tsx`'s footer, another session's, pre-existing). `support-console-stage3-guard` re-pointed at the ruled
    unreachable words (intent kept). `check:spelling` clean; focused lint clean. `verify:changed` (`.probe/gst3/part2-verify-changed-run1.txt`):
    14,871/14,880, the 9 failures all other sessions' files (help-content tax words, practice plans phone, billing free time ×2,
    Stage 6 walk, series date groups, console footers [ExpenseFormWindow], workspace in-force, plan census); the post-test checks run
    by hand (`.probe/gst3/part2-verify-rest-run1.txt`): admin-old-look (schedule CSS), admin-type (BankReport / SystemScreen / lead),
    css-selectors (other files) and index-coverage (three tables) red on other sessions' files only.
  - Not built, on purpose: Part 3 (needs-a-look query, flag lines for tax, the strip / dot / dropdown choice, Today's row, Mark as
    looked at) and Part 4 (the before-tax band). No migration; the record tables are only read.
  - Next: `/simplify` then `/review` (owner offered); `/docs` = none (platform-admin only); owner commit; Part 5's walk.
- **2026-11-06 · Part 2 `/simplify` DONE (four angles: reuse, simplification, efficiency, altitude; no wording or behaviour change).**
  Applied: `gstHstPosition` now calls `isRatedTaxReason` (one rule for the stored position and the Tax column, as its comment
  claimed); one 12-month helper `yearBefore` in `lib/console-money.ts`, used by the money route and `MoneyTab` (was written twice;
  `readClubMoney`'s own `365 * DAY` left as shipped); MoneyTab's "older pages" empty value is memoised (it was rebuilt every render,
  so the join and `findPatterns` re-ran on every filter change or window open until "Show older sales" was used); the 4 s timer in
  `registrationDateOrNull` is cleared once the read answers; the charge route's three hand-built answers are one `answer()` builder
  and the `kept` undefined-sentinel is `= null` with `if (!bySale)`; `saleStatus`, `placeName`, `taxLineName` are no longer
  exported; one import merged in `console-money-sales.ts`.
  Skipped on purpose: `saleCents` vs `formatCents` (differ for non-CAD: "US$" vs "$"); dropping credit notes from the list read
  (needs a payload and type change, and the window's use of them is not proven); reading the invoice once on the by-`in_` path and
  starting the credit-note read earlier (Stripe-call changes on a money route, medium confidence); `listed` vs `band` (equal today,
  but the flag reads clearer); the `pages`/`exhausted` state fields; a shared `SaleAnswer` type; `MoneyInvoice` optional fields made
  required (test-literal churn); `triesSub`/`byNewest`/`rateText` (single-use but clear).
  Proof after the edits: `npm run typecheck` clean; focused lint clean; `check:spelling` clean; the eight named test files 191 run,
  190 pass (the one failure is `ExpenseFormWindow.tsx`'s footer, the known other-session baseline).
- **2026-11-06 · Part 2 `/review` DONE (high-risk tier; five lenses: security and tenancy, paging and join, charge route and
  Stripe-down, data and contract, regression and blast radius). No Critical or High. The six Mediums were fixed
  on the owner's word the same day (fixes listed after the findings).**
  Gate: `typecheck` clean; `verify:changed` (`.probe/gst3/part2-review-verify-changed.txt`) 14,894 run, 10 fail = the 9 on the
  baseline plus `club-stage1-server-guard` ("attention counts ask the plan too", `module_house_league`), which is another
  session's (`app/api/admin/attention-summary/route.ts` and that test, both in the shared tree); none is a Part 2 file.
  Confirmed against the code:
  1. **[Medium] `money/route.ts` `getStripe()` now throws outside any `try`.** It sat inside the `try` before and answered
     `unreachable` with our records; with `STRIPE_SECRET_KEY` unset it is now a 500 and the tab shows both reads failed. Fix: build the
     read lazily (`Promise.resolve().then(() => readClubMoney(getStripe(), …))`).
  2. **[Medium] The sale window cannot tell "tax record failed to read" from "no record".** `readSaleRecord` returns null on a
     database error and `saleInvoiceForIntent` ignores its error; the window calls `saleTaxCell(row, registration)` with
     `recordsRead` defaulted true, so it says "No tax record · not written yet" (or "Before we registered") when the honest word is
     "Not read". The list is right. Fix: return a "failed" signal from the record read through the route answer.
  3. **[Medium] `MoneyTab` `exhausted: got === 0 || !before` ends paging across a gap year.** Stripe's cursor is null for a window
     with no charges, our records' cursor is not; an empty page then stops "Show older sales" with older sales unreachable.
  4. **[Medium] A half-failed older page is accepted silently.** A page counts as good when Stripe OR the records answered; the
     other half's window is skipped for good (rows then read "Paid outside Stripe" or "not written yet") and no error shows.
     Fix: treat a page where either source failed as failed (retry on the same cursor).
  5. **[Medium] "Paid outside Stripe" / "Paid from credit" is inferred from a charge or invoice missing from what was loaded.**
     Stripe's read is capped (3 × 100); a sale newer than the cap's cursor can lose its charge and be mislabelled until older
     sales are shown. Fix: say "Not read" when the loaded set is capped.
  6. **[Medium] Refund-door refusal wording when the tab's first read failed.** With no good read ever seen, a Super admin
     opening a record-only sale is told "Refunds are made by Billing or a Super admin." No refund is possible either way; only the
     reason is wrong ("read the tab again" is the true one).
  Lows (listed, not ruled): the 300-record cursor is a raw `+00:00` timestamp that the route's `…Z` check rejects (paging stalls at
  300+ sales in a window), and mixed `Z`/`+00:00` strings compare lexically; `withSalesFor` keeps only 100 invoices and one failed
  extra read turns a good records read into "failed"; a tie at the cap's timestamp is skipped; a partial Stripe outage on the
  by-`in_` path is a 503 where the record could answer; `recordMoneyBand` counts differently from the shipped band (labelled "our
  record"); `REASON_WORDS[reason]` would return a function for a reason named `constructor`; a $0 invoice where Stripe returns no
  Canadian line might show "Tax missing" (unverified); Bookkeeping's pool has 2 slots and the abandoned registration read can hold
  one for up to its connect timeout; the money payload can carry 300 full records (about 450 KB, inside Amplify's ceiling).
  Refuted: ownership on the `in_…` path (shared customer, draft, test record on a live key, another club's id all answer
  "nothing"); gating order (`find_stripe` first, `no_customer`/`shared` return before any record read); filter injection; RLS;
  every column exists in the dev dump; a null registration date never reads "Tax missing"; paging cannot loop (the cursor strictly
  decreases); Story tab and refund routes unaffected; `money.compare` was never declared; the cleanup edits are behaviour-neutral.
  `/accounting`: not due (display only, no new charge, invoice, record or report). `/legal`: not due as a gate (nothing new
  collected, emailed or promised). One owner question: Support (no `refund` power) now sees the buyer's street address in plain
  fields, while the credit-note PDF that carries the same address is hidden from that role (Stage 2 Part 7 Q2). Ask 7 = A ruled
  "only `find_stripe` roles see any of it", so it is as ruled; say if Q2's reasoning should reach the address lines.
  **Fixes applied (owner: "yes fix them then commit", 2026-11-06):** (1) the money route builds the Stripe client inside the
  promise, so a missing key reads "unreachable" again; (2) `readSaleRecord` / `saleInvoiceForIntent` say `'failed'`, the charge
  route returns `recordFailed`, and the window passes it so the tax cell says "Not read" (a failed record read with no invoice
  answers 503 "Our tax record could not be read. Try again in a moment."); (3) the records cursor jumps to the newest record before
  an empty window (a quiet year no longer ends "Show older sales"), cursors are always `…Z` to the millisecond (also fixes the
  300-record `+00:00` cursor the route rejected), and a page ends only when the cursor stops falling; (4) an older page is
  accepted only when every source the list was built from answered, else it fails and asks again from the same place; (5)
  `MoneyRead.chargesFrom` says how far back Stripe's charges are complete, `SaleRow.chargeUnread` flags a charge-less sale older
  than that, and such a row speaks from our record instead of "Paid outside Stripe"; (6) with no good tab read the refusal says
  "Read this tab again to see whether this charge can be refunded." (new line, `REFUND_WORDS.tabNotRead`; the owner may reword).
  Proof: `typecheck` clean; `console-money-sales.test.ts` 23/23 (one new test, charge-unread); the nine named guard files 208
  run, 207 pass (the one failure is `ExpenseFormWindow.tsx`'s footer, the known other-session baseline); focused lint and
  `check:spelling` clean. Not browser-walked: paging across a gap year and a half-failed older page need the owner's walk (Part 5).
  Left as Lows: `withSalesFor` keeps 100 invoices; a partial Stripe outage on the by-`in_` path is a 503 where the record could
  answer; `recordMoneyBand` counts differently from the shipped band; the invoice list's own 300 cap can still lose an invoice.
  Commit pathspecs (never `git add -A`): whole files: `lib/console-money-sales.ts`, `lib/console-money-sales-store.ts`,
  `tests/unit/console-money-sales.test.ts`, `lib/charge-tax-record.ts`, `lib/console-money-stripe.ts`,
  `app/api/platform-admin/orgs/[id]/money/route.ts`, `app/api/platform-admin/orgs/[id]/money/charges/[chargeId]/route.ts`,
  `tests/unit/support-console-stage3-guard.test.ts`, this plan file. Partial (other sessions' hunks share the file):
  `lib/console-money.ts` (leave out the "A Coaches Portal this club pays for" words), `app/platform-admin/orgs/[id]/MoneyTab.tsx`
  (leave out the FileDown "Download PDF" button), `app/platform-admin/orgs/[id]/money.module.css` (leave out `.pdfButton`),
  `lib/billing-location.ts` (take only the `BILLING_LOCATION_CONSOLE_WORDS` hunk; the `tidyAddressCase`/`capitalizeWord` changes
  are another session's).
