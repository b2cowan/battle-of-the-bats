# Retiring the monthly Stripe-fee invoice (Stripe-owned pricing Stage 4) — what the documents still say
**Last verified:** 2026-11-18
**Re-verify by:** the privacy policy's next version and the payments terms' publication (Stage 5), or the first club with a payout account on production
**Depends on facts:** online payments OFF in production, no club has a payout account on prod, prod held 0 rows in both fee tables (mig 499 header, 2026-11-18); `LEGAL_FACTS.md` payments lines

## Question(s) this answers
Is it acceptable that the published privacy policy still describes a monthly invoice for a club's Stripe fees while Stage 4 removes it? What must the new version change? What else in our legal files states the invoice as current? Does retiring the two emails touch CASL?

## Finding
1. **The published privacy policy (`lib/legal-documents/privacy/2026-11-17.md`) now over-describes. It names a processing we no longer do (less processing than promised), not more.** That is the safe direction: no one's information is used for a purpose the policy does not mention (PIPEDA 4.2 identifying purposes, 4.8 openness are not breached by listing a purpose we have dropped). The harm is an inaccurate statement, which is a defect under our own rule (a policy must match the product), not a privacy breach. It becomes a live inaccuracy only when the policy is on production AND a club has a payout account; today the second is false, so the invoice cannot exist and no one can be misled in practice.
2. **Acceptable while online payments are off in production. MUST be fixed by the new version before the first club on production sets up payouts**, and ideally in the same promote that carries the policy so the live page never describes a monthly invoice. The frozen file cannot be edited (the build fails): it is a new dated version (Stage 5).
3. **Not a material change needing fresh acceptance** in my reading: it narrows what we do, adds no collection or sharing. Notice by the updated date and change log is enough; the policy's own change section governs (not re-read for this). Say so in the Stage 5 hand-off.
4. **CASL: nothing owed.** The two retired emails (`stripe_fee_invoice`, `stripe_fee_invoice_reminder`) were transactional notices to the owner of a paying account (an invoice and one reminder about it), not commercial electronic messages. Stopping them needs no notice, consent change or unsubscribe handling. Nothing replaces them: Stripe's own emails to the club about its fees and disputes are Stripe's. Notes only: (a) the "email kinds" list is a label list; make sure nothing breaks on old email-log rows of a removed kind (dev only; prod sent none); (b) the policy's "our emails to you" list (L48) is the only customer-facing place that names the invoice email.

## What the product does today
Checked from the Stage 4 build (uncommitted on dev): `lib/email-kinds.ts` drops both kinds; mig 499 drops `platform_stripe_fees` and `platform_fee_invoices` (prod 0 rows; the `'fee'` kind stays in the tax-record CHECKs as history). The billing-address step before payouts is proposed to stay (owner call (a)), for the province of the GST/HST inside our fee. Nothing in the Terms of Service 2026-11-17 mentions the Stripe-fee invoice (only plan invoices, L101/L104): no Terms change owed for this.

## Recommendation — what the Stage 5 privacy version changes
Privacy policy `2026-11-17.md`, three places plus one check:
- **~L34 (billing address row), purpose:** delete "and for the Stripe fees a club's online payments cause". If the billing address step stays (owner call (a)), say the real reason: to work out the sales tax on our processing fee. Do not leave the address with no stated purpose for the online-payments case.
- **~L48 (our emails to you):** delete "a club's monthly invoice for its Stripe fees".
- **~L174 (Stripe row):** "Card payments for our plans and our invoices for Stripe fees" becomes "Card payments for our plans"; the club-payments half of the row is unchanged.
- **Check, do not assume:** the payments lines should still be true under Stage 2/3 (our fee stored per payment; the club's books record Stripe's real fee, read from the club's own charge). Both are data about the club's own payments, already covered by the "what is being paid for" fields; confirm the wording once at Stage 5 and add nothing unless a new kind of data appears.
- No change to the retention row (~L218, six years for billing, tax and invoice records): prod holds no fee rows; dev rows are test data and dropped.

## Stage 5 list: payments terms draft (`drafts/PAYMENTS_TERMS.md`) sentences that promise the fee invoice or Stripe-billed-to-us fees
- **§5 as a whole (L108-140):** the heading "Other Stripe fees we bill to your organization", "we bill it to your organization at Stripe's own figure ... published rate" (L117-119), "How we bill them ... next plan invoice ... invoice on the 1st ... whatever plan" (L122-126), the reminder and suspend sentence (L128-129), and the four NOTEs (L131-140, incl. the "passes them on to you on an invoice" product-words note). Replace with the true statement: Stripe takes its own extras (disputes, returned debits, foreign cards) from the club's Stripe balance; we never bill them.
- **§4 L72:** "Out of it, we pay Stripe's own processing fee" is no longer true under Stage 2 (the club's Stripe account pays Stripe; our fee is our margin only). Also L73-74 "Stripe takes the fee out ... receives the payment less the fee" and L81 "the fee is owed to us" need the same read.
- **L63 NOTE:** "only our fee (and Stripe's charges to us) land in FieldLogicHQ's Stripe balance": the parenthesis is gone.
- **L175-176 and L177-178 (disputes):** "Stripe's dispute fees are dealt with under §5" / "Stripe's fee for it is dealt with under §5": re-point to "come out of your Stripe balance".
- **L216-217 (ending):** "fees already owed under §4 and §5 are still owed": drop §5.
- **L224:** "or a Stripe fee not yet billed or paid" (a reason we may keep a payments feature open): drop.
- **L239 NOTE:** "the issuing country drives the §5 fee": no longer; the country is still recorded.
- **L244 (§12):** "Our fees and the Stripe fees we bill count as amounts your organization paid us": drop "and the Stripe fees we bill".
- **L125-126 and the billing-address ask:** "Because these invoices carry sales tax, we ask for your organization's billing address before you set up payouts": the reason changes to the tax on our fee (if owner call (a) keeps the step).
- **Header/change log and the "Before this can be published" list:** the O-items and publish conditions that mention §5 or the invoice (grep `§5`, `invoice`).

## Other legal files that state the invoice as current
- `LEGAL_INDEX.md` L85 (backlog **L3**): "the club's Stripe fees ... are invoiced to it monthly with sales tax, and setting up payouts needs its billing address". Stale. **Not edited here: the row carries another session's uncommitted hunk.** Whoever next edits it should read: "(retired by Stripe-owned pricing Stage 4, 2026-11-18: Stripe takes those fees from the club's balance; the billing address stays only for the tax inside our fee, if owner call (a) holds)".
- `LEGAL_FACTS.md` L93-100: the 2026-11-17 payments census says "Stripe's processing fees are billed to FieldLogicHQ and paid out of our fee (`fees_collector: 'application'`)". Stale after Stage 2 (mig 498, `fees_collector: 'stripe'` for new accounts). **Not edited: another session's uncommitted hunk.** Needs a dated "superseded 2026-11-17/18" line.
- `RENEWAL_REMINDER_AND_QUEBEC_GATE.md` L17: "keep fee invoices, cancel, move down and renewals working and still say 'no new purchase'". A historical read (2026-11-13) of the Québec gate; "fee invoices" no longer exist. Pure history; left as written.
- `PAYMENTS_TERMS.md` is the list above. `CARD_SURCHARGE_PAYER_FEE.md` and `RPAA_FINTRAC_MONEY_SERVICES_STATUS.md` (untracked, 2026-11-17) were not re-read for fee-collector statements: grep `fees_collector` / "billed to us" when Stage 5 starts, since the rate-design A change (margin = fee less Stripe's cost) can alter the "commission netted by the PSP" shape the RPAA read assumed; flag to Stage 5 as a re-verify trigger of that file.

## Sources
- Internal: `docs/projects/active/STRIPE_OWNED_PRICING_STAGE4_BUILD_PROMPT.md` step 11; `supabase/migrations/499_the_recovered_stripe_fees_are_retired.sql` header; `lib/email-kinds.ts` (diff); `lib/legal-documents/privacy/2026-11-17.md` L34/L48/L174/L218.
- PIPEDA Schedule 1, principles 4.2 and 4.8 (read earlier, `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md`, 2026-11-05); not re-fetched for this note.

## Lawyer's eye needed?
No for this change. (The wider payments-terms and privacy publication questions are already listed in their own files.)
