# GST/HST · Stage 2 Part 6b: a refund goes through a credit note, and a checkout invoice names the club (build prompt)

> **Status: BUILDING 2026-11-05 — owner ruled R1–R4; Part 0 run, Part 1 (mig 446, dev) done, Part 2 (the credit-note refund) built 2026-11-05. Next: Part 3.**

> Written 2026-11-05 by `/plan`. Parent: [GST_HST_STAGE2_BUILD_PROMPT.md](GST_HST_STAGE2_BUILD_PROMPT.md) ▶ Progress, "Part 6 RUN"
> (Defect 2 and the "name on the invoice" observation are this part's whole reason). Plan of record:
> [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §4 Stage 2; PM brief [GST_HST_COLLECTION_PM_BRIEF.md](GST_HST_COLLECTION_PM_BRIEF.md).
> Tax research: `docs/agents/accounting/GST_HST_ON_SUBSCRIPTIONS_CANADA.md` (the $500 name rule; refunds via credit note) and
> `RECOVERED_STRIPE_FEES_TAX.md` (how a credit note reverses tax). Sequenced **before Part 7** (closeout); its matrix rows and walk
> steps fold into Part 7's ONE Stage 2 walk. Recommended model: Opus for Part 0 and Part 2 (money, Stripe's credit-note rules);
> Sonnet is enough for Parts 1 and 3.
> Mark each fact you rely on [V] (verified by you this session, with file:line) or [H] (handed to you). Lines marked
> **[V 2026-11-05]** were read in the code the day this was written; line numbers drift.

## Why this exists, in one paragraph

Part 6's test matrix found that platform admin's **Refund** sends money back to the card and nothing else: the club's invoice
still reads "paid" with its full GST/HST, no credit note is made, and the club gets no tax document (`.probe/gst2/part6-refund-run1.txt`).
`/accounting` (review item 6c, confirmed 2026-11-05): a refund of a taxed invoice must go through a **credit note**. That is the
Excise Tax Act s.232 document showing the tax adjusted, and it is how Stripe Tax records that we collected less tax. Without it our
own tax filing over-reports. Separately, Checkout's `customer_update.name: 'auto'` (needed for the buyer to type a GST/HST number)
saves the **cardholder's** name on the Stripe customer when no business name is typed. Every later invoice then names the person
who paid, not the club. It is compliant (an "authorized representative"), but the owner ruled on 2026-11-05: **the club's name,
unless a business name was typed on Stripe's page.**

## Facts handed to you (verify before building on any)

**The refund**
- **One refund path, one Stripe call [V 2026-11-05].** `lib/console-money-stripe.ts` `makeRefund` (~:400) makes our record
  (`platform_refunds`, `started`), re-reads the charge, then `stripe.refunds.create({ charge, amount, reason, metadata:
  { platform_refund_id, org_id, staff_email } }, { idempotencyKey: record.id })` (~:452). Route
  `app/api/platform-admin/orgs/[id]/money/charges/[chargeId]/refund/route.ts`. No other product path refunds a platform charge
  [H, helper census]: cancels, move-down and the customer portal refund nothing. `lib/stripe-connect.ts:201` is family payments
  (Connect), out of scope.
- **The route never learns which invoice the charge paid [V].** It calls `readClubCharge(…, null)` (route ~:46, "no invoice:
  the refund needs neither"). `readClubCharge` fills `MoneyCharge.invoice` (`lib/console-money.ts` ~:66, id in `MoneyInvoice.id`)
  only when given prices; the lookup is payment_intent → `invoicePayments.list` (console-money-stripe ~:128) [H]. API
  `2026-04-22.dahlia` has no `invoice.charge` [H].
- **What a charge can be [H]** (`paidForWords`, `lib/console-money.ts` ~:173-181): a subscription invoice, a plan-move proration
  invoice, our own Stripe-fee invoice, a dashboard invoice, or **a charge with no invoice** ("A charge made in Stripe, not by an
  invoice").
- **Partial refunds exist and the amount is tax-included [V].** The window (`app/platform-admin/orgs/[id]/MoneyTab.tsx` ~:455-489)
  offers "All of it" / "Part of it" and a typed amount, checked against what is left of the charge (`decideRefund`,
  `lib/console-money.ts` ~:567). Window sentence: "Refund $X of the $Y charge to the {card}. This cannot be undone. … plan does
  not change … Stripe emails a receipt to {email}."
- **Our record has no credit-note column [H].** `platform_refunds` (mig 380 ~:38-58; dictionary `DATA_DICTIONARY.md` ~:9680). Its
  guard trigger `platform_refunds_guard` freezes the request columns; only status, refund id, error fields and `completed_at` may
  change. **A new column needs the trigger changed too.**
- **Recovery matches by refund metadata [V].** `recoverRefunds` (~:496) lists the CHARGE's refunds and matches
  `metadata.platform_refund_id`. ⚠ A refund Stripe makes FROM a credit note will not carry our metadata (to verify in Part 0), so
  recovery must also look for the credit note on the invoice by ITS metadata.
- **The model to copy [V].** `lib/platform-stripe-fees.ts` `creditAgainst` (~:322-374) already credits a paid, taxed invoice:
  against the invoice line (Stripe refuses a custom line on a taxed invoice, verified 2026-11-05), the total asked of
  `creditNotes.preview` (a line's `amount` is before tax), `refund_amount` to the card, `email_type: 'none'`, keyed once by
  metadata, and the club's own fee-invoice row re-read after (`writeInvoiceState`).
- **Story [H].** The club's Story reads `platform_refunds` (`lib/platform-story.ts` ~:127, ~:373-380): "Refunded {amt} of a charge",
  "To the card it came from · the plan did not change". Refunds made in Stripe's dashboard merge in (`lib/console-money-story.ts`).
- **Tests [H].** `tests/unit/support-console-stage3-guard.test.ts` (makeRefund cases from ~:117).
- **The club sees no credit notes in our product today [H].** No invoice history in Plan & billing; buyers go to Stripe's
  customer portal (`invoice_history` enabled, `lib/stripe-portal-settings.ts` ~:28).

**The name**
- **Three Checkout sessions spread `TAXED_CHECKOUT` [H]** (`lib/billing-tax.ts` ~:39, `customer_update: { name: 'auto' }`): A club
  (`app/api/billing/create-checkout/route.ts` ~:414), B coach Premium (`create-team-checkout/route.ts` ~:340), C Founding
  next-season (`lib/next-season-choice.ts` ~:162 → `choose-next-season/route.ts` ~:189).
- **Our name is stamped BEFORE Checkout, never after [V].** `buyerNameUpdate` (`lib/billing-tax.ts` ~:65) writes the name plus
  `metadata.fieldlogic_buyer_name`; once `customer.name` differs from that metadata it returns null ("the buyer typed their own",
  ~:74). Checkout's saved cardholder name looks exactly like a typed business name to it, so **the cardholder's name persists
  forever**, including through a Premium → Club move (`withClubAddressOnStripe` asks `buyerNameUpdate`). Pinned by
  `tests/unit/billing-tax.test.ts` ~:104-105.
- **The webhook never touches the name [V].** `app/api/billing/webhook/route.ts` `checkout.session.completed` (~:222) updates
  only the default payment method (setup mode).
- **Stripe's types know a typed business name [H]** (stripe 22.1.0): `Session.collected_information.business_name` /
  `individual_name`, `Session.customer_details.business_name` / `individual_name`, and `SessionCreateParams.name_collection`
  (`business` / `individual`, `{ enabled, optional }`). Which one Checkout fills, and when, is a Part 0 question.
- **Timing matters.** Stripe copies the customer's name onto an invoice when it is finalized. Path A and C start with a trial (Part 6:
  "0 at page → 219000 after the 90-day trial"), so the first PAID invoice comes long after the webhook. Path B (Premium) charges at
  the page, so its first invoice is finalized inside Checkout. That is the coach's own purchase, under $500, and the cardholder is
  usually the coach. **Verify in Part 0 that no CLUB checkout charges at the page.**
- **Nothing to back-fill.** Production has 0 subscriptions (Stage 2 Ask 7 re-counts at the promote). Dev clubs are test data.

## Owner asks — RULED 2026-11-05: R1 A, R2 A, R3 A (as recommended)

- **R1 · A part refund of a taxed invoice: what does staff type?**
  **A (recommended):** what goes back to the card, tax included, as today. Before sending, the window shows Stripe's split, e.g.
  "$100.00 back to the card: $86.96 for the plan + $13.04 HST", and says a credit note goes to the club. If Stripe's split lands a
  cent away from the typed figure, the window shows the figure Stripe will refund, and that is what is sent. *Why:* staff answer a
  club's "please refund $100", and the card figure is what the club sees. The product never shows one figure while Stripe moves
  another (Stage 2 plan §7). B: staff type the before-tax amount and the tax is added. C: whole refunds only.
- **R2 · How the club receives the credit note.**
  **A (recommended):** Stripe emails it, from the same sender as the refund receipt it already sends (`email_type: 'credit_note'`).
  The credit note also shows on the invoice's Stripe page and in the customer portal. This adds no new email of ours (no `/legal`
  pass) and no new screen. B: no email, and the credit note is a link in platform admin only (staff send it by hand). C: our own
  email (Resend) with the PDF link; that is new email content, so `/legal` runs first.
  *(The answering-fee credit notes keep `email_type: 'none'`: Plan & billing's fee list already says "Returned", and that path is unchanged.)*
- **R3 · A charge that paid no invoice.**
  **A (recommended):** it keeps today's bare refund. The window adds one line, "This charge paid no invoice, so there is no credit
  note", and the Story says so. *Why:* no invoice means no tax was invoiced on it. Our checkout never makes such a charge; it comes
  only from someone charging in Stripe's dashboard. B: refuse it in our console; staff refund it in Stripe.
- **Not asked: settled by the owner 2026-11-05.** The club's name goes on its invoices unless a business name was typed on
  Stripe's page. Every charge that paid an invoice, taxed or not, refunds through a credit note. One kind of document, and a
  pre-Stage 2 untaxed invoice gets one too.

## Part 0 · Test-mode spike (no product code; `.probe/gst2/part6b-*`)

Settle Stripe's behavior before designing against it. Write each answer into ▶ Progress with its run file.
- [ ] **Credit note shape on a paid taxed invoice:** does `creditNotes.create` accept a top-level `amount` there, or only
  `invoice_line_item` lines? For lines: the part-refund recipe that makes the note's total = a typed tax-included figure (the
  before-tax amount = typed × subtotal ÷ total, previewed, adjusted ±1 cent). Run at 13% and 15%.
- [ ] **Multi-line invoices:** a Premium → Club proration invoice (a negative "unused time" line + a positive line) and a renewal
  carrying a recovered fee (plan line + fee line, both taxed). Full refund and part refund each: which lines get credited, and does
  the preview total match the charged total exactly for a full refund?
- [ ] **The refund a credit note makes:** with `refund_amount` (or the dahlia `refunds` shape, whichever the API takes), the refund
  id is readable on the note; does the refund carry our metadata? Does `idempotencyKey` = our record id hold for `creditNotes.create`?
  A refund that fails: the note still stands (accounting topic: "keeps the tax reduction even if the refund fails"). Confirm.
- [ ] **An earlier bare refund on the same charge** (made in Stripe's dashboard): what is left to credit, and does Stripe refuse a
  note above it? This decides the window's "what is left" figure.
- [ ] **The email:** `email_type: 'credit_note'` sends to the customer's email in test mode (Stripe's email log). Is the refund
  receipt still sent alongside it? (Two emails is fine; record it.)
- [ ] **Checkout's name:** pay paths A and B in test mode three ways: no business name; a business name typed with a GST/HST
  number; a business name typed under `name_collection.business` (optional) if that changes anything. For each, record what
  `customer.name` becomes, and which of `collected_information.business_name` / `customer_details.business_name` /
  `customer_details.tax_ids` carries the typed name on the `checkout.session.completed` event.
- [ ] **No club checkout charges at the page:** confirm A always opens a trial (read `create-checkout` for a no-trial branch, such
  as a club whose free time ended) and C too. If one does charge at once, stop and bring it to the owner. The webhook fix cannot
  reach an invoice finalized inside Checkout. The fallback is `name_collection` (if Part 0 shows it stops the cardholder overwrite),
  or accepting a named representative on that first invoice (compliant).

## Part 1 · The record (migration first)

- [ ] `ls supabase/migrations` for the next number. New migration: `platform_refunds.stripe_credit_note_id text null` (unique where
  not null) and `stripe_invoice_id text null` (the invoice the charge paid, written at `started`, part of the frozen request).
  Rewrite `platform_refunds_guard` so `stripe_credit_note_id` may go from null to a value once, never change after. Dev only;
  production apply goes in `MANUAL_PROD_STEPS.json`.
- [ ] `docs/agents/db/DATA_DICTIONARY.md` `platform_refunds` entry: both columns, the trigger rule. `npm run refresh:snapshots`
  (dev + prod). `npm run check:dictionary` passes.

## Part 2 · The refund goes through a credit note

- [ ] **Learn the invoice.** The refund route (and the window's read) asks which invoice the charge paid: a light lookup
  (payment_intent → `invoicePayments.list`), not the full price read. 0 invoices → R3 path. Exactly 1 → credit-note path. More
  than 1 (Stripe allows it; we never make it) → refuse with a fixed sentence, nothing sent.
- [ ] **Preview (R1).** New read route beside the refund route (`…/refund/preview`, same `refund` power, no writes): the amount
  typed → the credit note Stripe would make (`creditNotes.preview`), returned as the card figure, the before-tax figure and named
  tax lines (`namedTaxLines`, `lib/billing-tax.ts`). The window calls it as the amount settles (debounced) and shows the split
  sentence. The confirm sends the previewed card figure and the before-tax figure, and the server re-previews and refuses if
  Stripe's answer changed ("it changed since you opened it", like today's remainder check).
- [ ] **`makeRefund` credit-note branch** (`lib/console-money-stripe.ts`): our record as today (plus `stripe_invoice_id`), the
  charge re-read as today, then `creditNotes.create({ invoice, lines (per Part 0), refund_amount: card figure, email_type (R2),
  memo: none (never the typed reason), metadata: { platform_refund_id, org_id, staff_email } }, { idempotencyKey: record.id })`.
  Complete the record with `stripe_credit_note_id` and the refund id read off the note. A note made whose refund failed or was
  cancelled → today's "did not reach the card" message, plus "The credit note stands."
- [ ] **A fee invoice:** when the credited invoice is one of our monthly fee invoices (`FEE_INVOICE_META`), re-read its row
  (`writeInvoiceState`, as `creditAgainst` does) so Plan & billing shows the new amount.
- [ ] **Recovery** (`recoverRefunds`): an old unfinished record with an invoice id also lists that invoice's credit notes and
  matches `metadata.platform_refund_id`. Found → done with both ids; not found in either list → not made.
- [ ] **The no-invoice branch (R3):** today's `refunds.create`, unchanged, plus the window line and Story words.
- [ ] **Words** (staff-only, platform admin): the window sentence (R1 split, "A credit note goes to {email}" per R2, or the R3
  line); the success message ("Refunded $X to the {card} with credit note {number}…"); the Story sub-line names the credit note
  number with its PDF link ("To the card it came from · credit note CN-… · the plan did not change"). Keep "Test mode" and
  "This cannot be undone."
- [ ] **Guards and tests:** extend `tests/unit/support-console-stage3-guard.test.ts`: an invoice charge never reaches
  `refunds.create`; the key is the record id; the email setting is R2's; a changed preview refuses; recovery finds a note by
  metadata. A build guard (alongside `billing-location-every-path-guard.test.ts`): `refunds.create` on a platform charge appears
  only in the no-invoice branch. Mutate-and-fail each guard on disk.

## Part 3 · The club's name stays on its invoices

- [ ] **`buyerNameAfterCheckout(session, customer)`** (pure, `lib/billing-tax.ts`): a business name typed on Stripe's page
  (whichever field Part 0 names) → keep it and leave `fieldlogic_buyer_name` as ours, so `buyerNameUpdate` keeps treating it as
  theirs. No business name typed → put OUR name back (`metadata.fieldlogic_buyer_name`). Null when nothing changes.
- [ ] **Webhook** `checkout.session.completed`, subscription mode (paths A, B, C): read the customer, apply it with one
  `customers.update`. A failure is logged and does not fail the webhook (the name is not money), and the next paid step's
  `buyerNameUpdate` cannot repair it, so log it as an operator line too.
- [ ] **Tests:** `tests/unit/billing-tax.test.ts`, for typed kept, cardholder replaced, no metadata (an old customer) does nothing,
  and same name does nothing. Keep the existing ~:104-105 pin: `buyerNameUpdate` is unchanged. Webhook test if one exists for that
  case.
- [ ] **A Premium → Club move after this:** the coach's own name was put back by the webhook, so `buyerNameUpdate` now renames to
  the club at the move (Stage 2 Ask 2's order). A coach who typed a business name on the Premium page keeps it. Record that as known.

## Part 4 · Close it into Part 7

- [ ] `/accounting` review **before hand-off** (it changes what we invoice and record): the credit note's contents (s.232 / Memo
  12.2 list), R1's rounding rule, R3's bare refund, the name rule. Apply findings or record owner questions.
- [ ] `/legal` only if R2 = C (our own email).
- [ ] `/review` on Parts 1–3; `/simplify` first if the preview route duplicates `creditAgainst`'s math (share one helper).
- [ ] **Matrix rows re-run** (test mode, through the product): full + part refund on ON 13% and NB 15%; a proration invoice; a
  fee invoice; a no-invoice charge; recovery (kill after the Stripe call). Name: path A with no business name → the first invoice
  after the trial names the club; typed business name kept; Premium → Club renames to the club.
- [ ] Steps for Part 7's ONE Stage 2 walk: the refund window's split and credit-note line; the credit note PDF (our GST/HST number,
  the club's name, the tax reversed); the email (R2); the Story entry. TODO / Progress truth-up.
- [ ] Help: platform-admin-only (refund) needs no help article. The name change alters no flow. Skip `/docs` unless Part 0
  changes the Checkout page the buyer sees (`name_collection`).

## Words for /marketing
> None customer-facing: the refund words are staff-only (platform admin). The credit note and its email are Stripe's templates.
> The invoice name is data. If R2 = C, the email goes to `/marketing` and `/legal` before the walk.

## Architectural decisions
- **Every invoice charge refunds through a credit note, taxed or not.** One document kind; the s.232 record exists whenever an
  invoice existed. *Rationale:* accounting 6c; keeping one path keeps the guard simple.
- **Stripe works out the tax on a refund; we never do.** Preview, then send what was previewed. *Rationale:* the Stage 2 rule (a
  quote that is not Stripe's is never shown), and `creditAgainst` already learned a line `amount` is before tax.
- **Fix the name after Checkout, not by dropping `customer_update.name`.** Stripe requires `name: 'auto'` for tax-number
  collection on an existing customer (Stage 2 Ask 6). *Rationale:* keeps the buyer's GST/HST number field.
- **Known gap, kept:** a refund made in Stripe's dashboard makes no credit note (Story still shows it). Staff refund from our
  console; it is the only place that makes the document.

## ▶ Progress
- 2026-11-05: planned (`/plan`). Owner ruled R1 A (card figure + Stripe's split previewed), R2 A (Stripe emails the credit
  note), R3 A (no-invoice charge: plain refund, said in the window and Story). `/legal` not needed (R2 ≠ C). Next: Part 0.
- 2026-11-05: **Part 0 run (test mode).** Runs: `.probe/gst2/part6b-credit-notes-run1.txt` (+ `-result.json`),
  `part6b-credit-notes-2-run1.txt`, `part6b-sessions-run1.txt`. Everything the probes made is deleted/archived. All [V 2026-11-05]:
  - **Shape.** ⚠ A top-level `amount` on a paid taxed invoice is ACCEPTED and reverses **no tax** (preview: total 10000, tax 0,
    no lines). Never use it; always `invoice_line_item` lines with `amount` (before tax). Whole line by `amount = line.amount`
    (or `quantity: 1`) previews exactly the invoice total (ON 247470, plan+fee 249165).
  - **R1 recipe** (b = round(typed × subtotal ÷ total), preview, then b±1, b±2): at NB 15% every typed figure tried hit exactly on
    the first preview. At ON 13% 10000 and 3333 are **unreachable** (b=8849 → 9999, b=8850 → 10001). By the formula, ~11.5% (ON)
    and ~13% (NB) of card figures have no before-tax cent that hits them. So the "a cent away" case is common, not rare: the
    window must show Stripe's figure. **Tie rule to build: take the nearest figure NOT above the typed one** (never refund more
    than staff typed; it also keeps a "what is left" figure from being refused). Stripe's last note on a line takes the line's
    remaining tax exactly (2h: 210150 before tax → 237469 = 247470 − 10001), so "refund the rest" is always exact.
  - **Lines.** Each line is capped at its own total incl. tax minus earlier notes on it (2i, Stripe's sentence). **Proration
    lines must be credited by `amount`, never `quantity`** (5a/5c refused); a negative line cannot be credited at all (5d). Full
    refund of a proration invoice = the positive line, `amount` = the invoice's net subtotal → previews exactly what was paid
    (5b: 21470). Plan + fee invoice: full = each line by its amount (exact); a part split by size (60 + 8790) works but reads
    oddly. **Build: a part refund goes on the largest positive line first, spilling to the next only past that line's cap.**
    (Recorded for the Part 4 `/accounting` review.)
  - **The note's refund.** `refund_amount` makes a refund whose id is on `note.refunds[0].refund` (dahlia shape
    `{ amount_refunded, refund, type: 'refund' }`). ⚠ **That refund carries NO metadata** (2b, 2f) → recovery must list the
    invoice's credit notes and match the NOTE's `metadata.platform_refund_id` (2e works). `idempotencyKey` = record id holds
    (2c: same note back); the same key with other figures is refused by Stripe (2d) — a re-preview that changed must get a new
    record, never a re-send under the old key.
  - **The sum rule.** `refund_amount` must equal the note's post-payment total exactly ("The sum of refunds, credit amount, and
    out of band amount must equal the credit note post_payment_amount"); a preview with a mismatched `refund_amount` is refused.
  - **An earlier bare refund** (3): Stripe counts it. After a 50000 bare refund the create refused a whole note ("must not exceed
    the remaining creditable amount ($2,018.50)") — but the **preview did not refuse it** (3b), so the server checks the charge's
    remainder itself (today's `decideRefund` already does). A note for exactly what is left worked (3e). New fact, out of scope:
    an existing refund can be LINKED to a new note (`refunds: [{ refund, amount_refunded }]`, 3f) — a possible later fix for the
    known gap "a dashboard refund makes no credit note".
  - **A failed refund:** not observed — `pm_card_refundFail`'s refund still read `succeeded` minutes later. The note is issued on
    its own (status `issued`); build to read the refund's status and say "The credit note stands." when it failed. [H, accounting]
  - **Email:** `email_type: 'credit_note'` is accepted. Stripe's API shows no "email sent" event, and test mode mails only verified
    team addresses → it is a **Part 7 walk step** (a club whose email is the owner's; check the credit-note email and the refund
    receipt in the inbox / the note's Dashboard timeline).
  - **Checkout's name** (the five Part 6 sessions, paid by a person): no business name typed → `collected_information.business_name`
    and `customer_details.business_name` both null, `customer_details.name` = the cardholder, and the customer's name became the
    cardholder's. A business name typed with a GST/HST number → **`collected_information.business_name`** = the typed name (also
    `customer_details.business_name`), customer name = it. **Build on `collected_information.business_name`.** The
    `name_collection` way was not tried (needs a person-paid page; Stripe's docs do not say what a blank optional field does).
  - ⚠ **A club checkout DOES charge at the page:** `create-checkout` gives no trial to a customer who had a subscription before
    ("NO SECOND TRIAL", Ask 4 2026-09-25 → `trialDays` 0). Its first invoice is made inside Checkout, so it names the cardholder
    whatever the webhook does after — over $500 for a returning Club / Association annual or League Plus annual. Path C always
    trials (its guard refuses a past `trial_end`). **Stopped here and brought to the owner** (see the next entry).
- 2026-11-05: **Owner ruled (R4): accept it.** A returning club's first invoice, made inside Stripe's page, may name the cardholder
  (compliant, a named representative); every later invoice names the club through Part 3's webhook fix. No `name_collection`,
  Stripe's page unchanged (so no `/docs`). Part 3 as written. Next: Part 1.
- 2026-11-05: **Part 1 done (uncommitted).** Mig `446_a_refund_carries_its_credit_note.sql` applied to DEV: `stripe_invoice_id`
  (frozen with the request) + `stripe_credit_note_id` (once), and two CHECKs beyond the prompt — a note needs an invoice, and
  **`done` with an invoice needs its note** (the database refuses a skipped credit note). Guard proved on dev
  (`.probe/gst2/part6b-guard-steps.sql`, rolled back, 10/10). Dictionary entry updated, snapshots refreshed, `check:dictionary`
  OK, `MANUAL_PROD_STEPS.json` entry `pending`. Next: Part 2.
  **Amended the same day (still dev-only, uncommitted):** + `stripe_credit_note_number` (set once, only with a note id) so the
  Story names the document without a Stripe read; guard re-proved 13/13. The PDF link is NOT stored (Stripe's link lifetime is
  unverified): the **charge window** reads the invoice's credit notes from Stripe and links each PDF; the Story entry already
  opens that window (`chargeId`). This replaces "the Story sub-line … with its PDF link" in Part 2's Words.
- 2026-11-05: **Part 2 design, settled from Part 0 (build from this; a fresh session).** Read [V] lines before editing.
  1. **One shared planner, pure + injected Stripe** (`lib/console-money-credit.ts`, new): `planCreditNote(stripe, target, cardCents)`
     → `{ lines, cardCents, beforeTaxCents, taxes }` or a refusal. `target` = the invoice (id, lines, subtotal, total,
     `amount_paid`, `post_payment_credit_notes_amount`, fee metadata) + what earlier notes credited per line (from
     `creditNotes.list({ invoice })` lines, before tax). Rules from Part 0: positive lines only, always by `amount`; a line's
     room = its amount − credited; the pool also ≤ net subtotal − all credited (a proration invoice's net). **Full of what is
     left** (cardCents = invoice total − post-payment notes): each line its room → exact. **Part:** b = round(card × subtotal ÷
     total) on the largest line first (spill past its room), preview; total(b) only rises with b, so walk b down/up to the
     **nearest total NOT above the typed figure** (≤ 3 previews). Never top-level `amount` (reverses no tax).
     `/simplify` question for Part 4: does `creditAgainst` (fee path) share the preview-and-read piece?
  2. **Light invoice lookup** (`invoiceIdsForCharge`): `invoicePayments.list({ payment: { type: 'payment_intent', … }, limit: 2 })`.
     0 → R3 bare refund; 1 → credit note; 2 → refuse, fixed sentence, nothing sent.
  3. **Preview route** `…/refund/preview` (POST, `refund` power, no writes): ownership as the refund route; typed cents → planner
     → `{ cardCents, beforeTaxCents, taxLines (namedTaxLines), note: 'credit_note' | 'none' }`.
  4. **makeRefund**: input gains `invoice` (planner target or null) and `ask.beforeTaxCents`. After the charge re-read, the planner
     runs again on `ask.amountCents`; `cardCents !== ask.amountCents` or `beforeTaxCents` differs → 409 "it changed since you
     opened it", record `not_made`. Stripe refuses a note above the creditable amount but its PREVIEW does not (3b/3c), so
     today's charge-remainder check stays the guard. Create: `{ invoice, lines, refund_amount: cardCents (must equal the note's
     post-payment total exactly), email_type: 'credit_note' (R2), metadata: { platform_refund_id, org_id, staff_email } }`, no
     memo, no reason text, `idempotencyKey: record.id`, `REFUND_OPTS`. Complete with `stripe_refund_id = note.refunds[0].refund`,
     `stripe_credit_note_id`, `stripe_credit_note_number`. Read that refund's status: failed/canceled → "did not reach the card.
     The credit note stands." Store gains `insertStarted(… stripe_invoice_id)`, `complete(… note id + number)`, and
     `refreshFeeInvoice(invoiceId)` (→ `syncFeeInvoiceFromEvent`, only when the invoice carries `FEE_INVOICE_META`).
  5. **Recovery**: a record with `stripe_invoice_id` lists `creditNotes.list({ invoice })` and matches the NOTE's
     `metadata.platform_refund_id` (the note's refund has no metadata, 2b); found → done with all three ids; else the charge's
     refunds as today (R3 rows); neither → not made.
  6. **Window** (MoneyTab ~:455-489): invoice charge → debounced preview call as the amount settles; the sentence "Refund
     $100.01 of the $2,474.70 charge to the {card}: $88.50 for the plan + $11.51 HST (13%). A credit note goes to {email}." When
     Stripe's figure ≠ typed: say "Stripe can refund $100.01, the nearest it can make with the tax." (words → Part 4 review).
     No invoice → "This charge paid no invoice, so there is no credit note." Confirm sends the previewed figures.
  7. **Story**: sub "To the card it came from · credit note {number} · the plan did not change"; R3 rows "… · no invoice, no
     credit note · …". Charge window lists the invoice's credit notes with PDF links.
  8. **Guards**: as Part 2's list, plus: `creditNotes.create` never gets top-level `amount`; `quantity` never used on a refund note.
- 2026-11-05: **Part 2 BUILT 2026-11-05.** Built from the design entry above;
  where it differs, this says why. All [V 2026-11-05] in the code as written.
  - **The planner** `lib/console-money-credit.ts` (new, no key, Stripe injected): `invoiceIdsForCharge` (0 / 1 / 2 invoices,
    `limit: 2`), `readCreditTarget` (the invoice + its payments, its lines, its ISSUED notes and each note's lines → per-line
    credited before tax), `creditTargetForCharge` (both routes call it), `creditRoom` / `creditLines` (positive lines, largest
    room first, spill), `planCreditNote` (estimate from the remaining ratio; all that is left → every line its room; walk
    down or up a cent at a time to the nearest total NOT above the figure; ≤ `MAX_PREVIEWS` 6). Beyond the design, two more
    refusals before anything is written: an invoice Stripe does not show `paid`, and one paid by more than one payment (a
    note's refund would go to Stripe's choice of payment). `READ_OPTS` moved here (re-exported from console-money-stripe.ts)
    so the planner shares it without an import cycle.
  - **makeRefund** (`lib/console-money-stripe.ts`): `invoice: CreditTarget | null` is REQUIRED on its input (no caller can
    forget it). An invoice charge without `ask.beforeTaxCents` → 409 before any write. Record with `stripe_invoice_id` →
    charge re-read (unchanged) → planner again on the card figure; a different card figure or before-tax figure → `not_made`,
    409 `REFUND_WORDS.noteChanged` (a new record next time, never a re-send). Create: lines + `refund_amount` (the previewed
    total) + `email_type: 'credit_note'` + metadata, no memo, no reason, key = record id, `REFUND_OPTS`. Completed with refund
    id (`note.refunds[0].refund`), note id, number; the note's refund is read for its fate ("… did not reach the card. The
    credit note stands."). The bare `refunds.create` lives only in the `else` (R3).
  - **NOT built: `refreshFeeInvoice`** (design point 4). Read before building: our fee-invoice row holds status, number,
    `amount_due`, `total`, tax lines — a POST-payment note changes none of them (Part 0 2g: still `paid`, total unchanged,
    remaining 0), and the refund only ever credits a `paid` invoice. The re-read would write the same values back. **Open
    point for Part 4's `/accounting` + `/plan`: Plan & billing's fee list does not show that a fee invoice was refunded**
    (the club sees it in Stripe's portal and the credit note email only).
  - **Recovery**: a record with `stripe_invoice_id` lists that invoice's notes and matches the NOTE's metadata (all three ids);
    a record without lists the charge's refunds as before; the charge's refunds are not even listed when every old record has
    an invoice.
  - **Routes**: refund route learns the invoice before makeRefund (0 → bare, 1 → note, 2 → `manyInvoices`, nothing sent) and
    passes `beforeTaxCents`; NEW `…/refund/preview` (POST, `refund` power first, ownership as the refund, no writes) →
    `{ note, cardCents, beforeTaxCents, taxLines (namedTaxLines), capped, feeInvoice }` or `note: 'none'`. The charge GET adds
    the invoice's issued credit notes (number, total, date, PDF link; null = "Not read from Stripe").
  - **Window** (MoneyTab): an invoice charge previews as the amount settles (450 ms; "All of it" at once); the confirm is
    blocked until Stripe answers and sends the PREVIEWED figures. Sentence: "Refund $99.99 of the $2,474.70 charge to the Visa
    ending 4242: $88.49 for the plan + $11.50 HST 13%. Stripe can refund $99.99, the nearest it can make with the tax. This
    cannot be undone. … A credit note goes to {email}." A fee invoice says "for the Stripe fees"; an untaxed invoice shows no
    split; capped: "Stripe can refund at most $X: the rest of this invoice was credited before." No invoice: "This charge paid
    no invoice, so there is no credit note." (R3). "Test mode" and "This cannot be undone." kept. Words → Part 4 review.
  - **Story**: "To the card it came from · credit note {number} · the plan did not change"; a row without a note says
    "· no credit note ·", NOT "no invoice" (design point 7): a row from before mig 446 has a null invoice id too, and does not
    record whether its charge paid one. The charge window shows "· credit note {number}" on our refunds and the PDF links.
  - **Guards**: `support-console-stage3-guard.test.ts` §6b (9 cases against a fake Stripe that taxes per line, as Part 0:
    one note never `refunds.create`, key = record id, lines by amount, no top-level amount / quantity / memo / reason, R2
    email, tie rule incl. a walk UP (typed 100 → 99), moved split refused + not_made, failed refund stands, refused/unknown,
    lines/pool/spill/earlier notes, exact full, recovery by the note's metadata, R3 bare) + NEW
    `refund-credit-note-path-guard.test.ts` (5 source guards: one `refunds.create`, only in the else; none elsewhere under the
    platform-admin routes or `lib/console-*.ts`; the create's exact arguments; the route hands the invoice on; the preview
    writes nothing; the fee credit keeps `email_type: 'none'`). **Mutate-and-fail: 13/13 caught** (`.probe/gst2/p6b2-mutate.cjs`,
    `part6b-part2-mutate-run2.txt`; run 1 found the tie rule unguarded on the walk up → the 100 → 99 case added).
    ⚠ Pre-existing, not this part: §12 "each footerStart in the console is bare…" fails on
    `app/platform-admin/bookkeeping/ExpenseFormWindow.tsx` (last changed `b9712ccd5`, 6 days earlier, untouched here).
  - **Test-mode probe through the product's own path** (`.probe/gst2/part6b-part2-refunds.mjs`, run
    `part6b-part2-refunds-run1.txt` + `-result.json`; readClubCharge → creditTargetForCharge → planCreditNote → makeRefund →
    recoverRefunds, in-memory store mirroring mig 446's CHECKs). 18/18 as expected; every note: refund = note total = preview,
    never above the typed figure, refund carries no metadata, note carries ours, PDF present:
    ON 13% part 10000 → 9999 (8849 + 1150), then the rest 237471 (tax 27320; 1150 + 27320 = the invoice's 28470) · ON full
    247470 · NB 15% full 251850 · NB part 3333 exact, then the rest · proration full 21470 (one line, 19000 = the net) · a
    subscription's first invoice part 1000 · plan + fee part 10000 → 9999 all on the plan line, then the rest [210151, 1500]
    (tax 1150 + 27515 = 28665, exact) · no-invoice charge part 2000 + rest (bare, no note) · split moved by a cent → 409, not
    made, nothing sent · answer lost AFTER the note → unknown → recovery (now + 6 min) → done with note, number and refund ·
    answer lost BEFORE the note → unknown → not made → a fresh refund of the rest worked. Cleanup: 3 customers deleted, 1
    product archived, nothing written to the database. The note object does not echo `email_type`, so the email stays a
    Part 7 walk step (Part 0).
  - **Window fix after the first pass:** a refusal that sent nothing (the note moved) now asks Stripe again (a preview round),
    so the next press sends a fresh figure, never the stale one a second time.
  - **Verify 2026-11-05:** lint clean on every changed file; `typecheck` exit 0 (8 GB heap; the default 4 GB runs out).
    `npm test` 14368 / 48 fail, NONE in this part's files after one fix: the dues guard's "hand-rolled credit sum" pattern
    matched the planner's per-line map (credit-NOTE amounts, not dues credits) → renamed `takenByLine`. The rest are another
    session's bank reconciliation work in flight (mig 439/440/442 guards, bank routes), the coach practice-plans phone guard,
    plan-billing free time, a walk HTML, and stage3 §12 (above). `verify:changed` stops at `npm test`, so its later checks were
    run one by one: spelling, dates, dictionary, observability (the preview route is wrapped), snapshots, org context — pass;
    schema parity flags mig 446's CHECKs as dev-only (expected: prod apply owed, MANUAL_PROD_STEPS); css-selectors flags
    `money.compare` at MoneyTab:209 (existing, not this part); admin-type / old-look / export-catalog / org-slug / index-coverage
    fail on files this part did not touch. Next: Part 3 (fresh session), then `/simplify` (the planner vs `creditAgainst`'s
    preview) and `/review` on Parts 1–3 per Part 4.
