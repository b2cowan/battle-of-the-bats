# GST/HST · Stage 4a: GST/HST on what we buy, in the owner's Bookkeeping (build prompt)

> Written 2026-11-06, after the drawing-and-ruling session ([GST_HST_STAGE4_DRAWING_PROMPT.md](GST_HST_STAGE4_DRAWING_PROMPT.md), executed).
> Plans of record: [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §Stage 4 (status + rulings) and
> [BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md](BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md) §3 ladder row **4a**.
> **Approved drawings (build to these): https://claude.ai/artifact/LbCjjVcnZeTP8uUT3yVZan** (source `GST_HST_STAGE4_DRAWINGS.html`):
> tabs 2 (form), 3 (record + register), 4 (Reports + the registration date), 8 (package: the expenses.csv row only), 9 (phone form).
> Tabs 5–7 and the rest of 8 are **4b**, not this build.
> Tax rules: `docs/agents/accounting/GST_HST_RETURN_LINES.md` (§3 ITCs, §4 simplified registrants), `GST_HST_ON_SUBSCRIPTIONS_CANADA.md`
> (documentation tiers), `ACCOUNTING_FACTS.md` (registration date, annual, no quick method).
> Recommended model: Opus for Session A (data shape + the credit rules), Sonnet is enough for B–D.
> Mark each fact you rely on [V] (opened this session, file:line) or [H] (handed over). Everything below is [H] unless marked [V 2026-11-06].

## What this stage is, in one paragraph

Today the expense form records purchase tax as ONE amount and a review status, and says “This form does not claim a tax credit.” Since we
are GST/HST-registered, the GST/HST on business expenses is claimable (input tax credits), and that is money. 4a makes each expense say
**which** tax it paid (GST / HST at its rate / PST / QST / other), the supplier's GST/HST number (needed for a credit from $100), which CRA
registration the supplier holds (tax charged under the **simplified** registration is never claimable), the **kind** of purchase
(CRA works the credit out differently for everyday costs, equipment you keep, and meals), and then **the credit, in one sentence with its
reason**. A missing number holds the credit and shows in Needs attention. Reports shows tax **paid** by type. The GST/HST registration
date (Sept 26, 2026, CRA backdate to May 1 pending) becomes a changeable setting with history, because every credit reads it.
The return worksheet that sums all this is **4b**, built after GST/HST Stage 3.

## Owner rulings this build carries (2026-11-06, all as recommended; drawings tab 10)

- **3:** a credit shows on each expense (form, record) with its reason, and later on the worksheet. **Reports shows tax PAID only; the Overview
  never shows any tax figure.** This is a ruled exception to the Bookkeeping plan §2 reporting rule (recorded there).
- **5:** from **$100** (the receipt total, CAD), a GST/HST line with no supplier number **holds** the credit (it isn't counted). It is listed in
  Needs attention as “GST/HST number missing”, and **saving is never blocked**. “I can't get the number: don't claim this credit” clears
  it (credit reads “Not claimed”). Under $100 no number is needed.
- **6:** “Supplier's registration” on each expense: **Registered the usual way / Simplified (foreign online seller) / Not registered / Not
  checked**. It is filled in, with the number, from the latest active expense with **exactly** the same supplier name (case-insensitive, trimmed;
  say so in the hint). **Simplified = no credit**, plus the refund sentence. **Not checked = counted**, but listed before filing (4b), and its
  credit sentence says so. No supplier table: there is none in Bookkeeping, and this ruling chose not to add one.
- **8:** “Kind of purchase” (**Everyday cost / Equipment you keep / Meal or entertainment**), defaulted from the category (Equipment &
  supplies → Equipment you keep; everything else → Everyday cost, including Travel & meals, because a taxi is not a meal), changeable. The form
  applies CRA's rules and never asks you to type a credit.
- **10:** tax paid by type goes on **today's** Reports page now (the Reports redesign, Bookkeeping Stage 3, carries it into its Spending view later).
- **Facts:** registration effective **Sept 26, 2026**, owner wants it changeable (CRA backdate to **May 1, 2026** pending); **annual** filer;
  **no** quick method.
- **Settled by `/design` + `/ux` and drawn (round 2):** the checkbox “I know the purchase tax amount” becomes **“Tax on this receipt”**
  (Not sure yet / No tax charged / Shown on the receipt), so “no tax” is one pick. Business use stays visible for every expense. The credit
  sentence sits under the tax lines and Kind/Business use, neutral edge, amber only when waiting or not claimable. The record says a missing number
  ONCE (chip in its cell, not a button). A register row with that reason opens the **correction form**, More details open, number field focused.

## The credit rules (put them in ONE pure function; every row of drawings tab 2's table is a unit test)

Inputs: tax lines `[{type, cents}]`, kind, business-use %, receipt total CAD, incurred date, supplier registration, number present,
“can't get the number”, and the registration effective date. Output: `{ creditCents, state, reasonSentence }`.
- Only **GST and HST** lines count. PST, QST and Other never do; they are part of the cost.
- Registration **Simplified** → 0, state `not_claimable`.
- **Services** dated before the registration effective date → 0. **Capital property** bought before it and still used for the business may get
  a deemed credit (Memo 8-5; note §3). **Ask `/accounting` in Session A** how the form says so, and do not guess. The drawing's tab 4 card names it.
- Kind **Everyday cost**: use ≥ 90% → 100% of the tax; ≤ 10% → 0; between → tax × use%.
- Kind **Equipment you keep**: use > 50% → 100%; ≤ 50% → 0. No proration.
- Kind **Meal or entertainment**: 50% of the tax (× business use as the note §3 says; confirm the combination with `/accounting`).
- Receipt total ≥ $100 and no number and not “can't get” → the credit is computed but `held`. With “can't get” → 0, state `not_claimed`.
- Not checked → computed as normal, state flag `registration_unchecked`.
- Rounding: to the cent, half up, on the final credit only. State it in a test.
- **Do not store the credit.** Compute it on read: it changes when the registration date changes. (4b's “Mark as filed” stores a snapshot later.)

## What is true today [V 2026-11-06 unless marked]

- Form: `app/platform-admin/bookkeeping/ExpenseFormWindow.tsx` :205–216 (More details: the checkbox at :209, amount + status at :210–211,
  “Tax amount unknown…” at :212, Business use :213, Notes :214, the “does not claim a tax credit” hint at :215) [V].
- Store insert `lib/bookkeeping-store.ts` :141–148 [V]. Void snapshot `lib/bookkeeping-void.ts` :9–10 [V]. Backup/restore
  `scripts/bookkeeping-backup.mjs` :48 and :192–199 [V]. Schema `scripts/bookkeeping-aws/schema.sql` :19–22 (`tax_cad_cents` CHECK ≤ `cad_cents`,
  `tax_status` IN pending/none/reviewed) [V]. Seed `scripts/bookkeeping-seed-b2-qa.mjs`, restore drill `scripts/bookkeeping-restore-drill.mjs`,
  smoke `scripts/bookkeeping-dsql-smoke.mjs` [V ls]. Other readers of `tax_cad_cents`: `lib/bookkeeping-expenses.ts`, `-export.ts`, `-filters.ts`,
  `app/api/platform-admin/bookkeeping/expenses/route.ts`, `ExpenseRecordBody.tsx`, tests `bookkeeping-{expenses,export,filters,records,void-route}.test.ts` [V grep].
- Migrations: `scripts/bookkeeping-aws/002`–`005` exist; **the next is `006`** [V ls]. Each was applied by its own **dev-host-only** runner that
  inspects, applies, then re-counts revisions/expenses (pattern: `scripts/bookkeeping-dsql-tax-migration.mjs` [V]). **No production store
  exists** (Bookkeeping Stage 5); 006 is development-only, and its production state belongs to the bookkeeping release record.
- Aurora DSQL: the app role has SELECT + INSERT only; append-only revisions. 002/003/005 added **nullable columns with no default and no CHECK**
  [V 005]; validate in the app. **Check DSQL's supported column types before choosing JSON**: if a json/jsonb column can't be stored, put tax
  lines in a child table keyed `(expense_id, revision, line_no)` (recommended anyway: summable, append-only, no parsing).
- Dictionary: the DSQL tables are documented **by hand** in `docs/agents/db/DATA_DICTIONARY.md` ~:7867–7871 [V]; the Supabase snapshots and
  `check:dictionary` do not see them.
- Legacy rows: `tax_amount_known` (003) true/false/NULL with the rule at dictionary :7869 [V]. Map them so nothing old changes meaning:
  known + `tax_status='none'` or 0 → **No tax charged**; unknown → **Not sure yet**; known with an amount → **Shown on the receipt** with ONE
  line of type **“Type not set”** (amber “Choose the tax type” in the form; Reports row “Type not set”; never flagged in the register; no number
  prefilled unless chosen).
- Register reasons live at `lib/bookkeeping-expenses.ts` ~:92–100 [H]; Reports' “Purchase tax recorded” box is `BookkeepingClient.tsx` ~:284 [H],
  half width, plain rows.
- Pre-existing unrelated failing test to expect: stage3 §12 `footerStart` on `ExpenseFormWindow.tsx` [H, from the GST/HST Stage 2 record]. Re-check; don't “fix” it here unless it's this change.
- Shared, dirty working tree (many sessions). Stage explicit pathspecs; after every commit `git show --stat HEAD`.

## Blocking gate before any code

1. **Mockups: already drawn and ruled** at the link above. Build to them. Anything this build needs that the drawing does not show
   (`/design` listed: the record cell for a two-tax receipt, e.g. GST + PST) is **drawn first as an addition to the same artifact and shown to
   the owner**. No undrawn screen is invented in code.
2. Present the product-manager UX summary (AGENCY_RULES), short, from the drawings.
3. Session A's `/accounting` questions (below) answered and applied before Session B.

## Sessions and parts (each part ends with typecheck on touched files, focused tests, `npm run verify:changed`)

### Session A (Opus): data shape + the rules
**Part 0, checks.** Verify every [H] above you rely on. Ask `/accounting` (by default, CLAUDE.md): (a) the capital-property-held-at-registration
deemed credit, and what the form says for it; (b) meals × business use; (c) whether “Not checked” counting is safe for a Canadian supplier with a
printed number (expected yes); (d) the exact sentence for the simplified refund path. Record answers in the note's Progress or a new topic.
**Part 1, migration 006 (dev only).** On `expense_revisions`, add nullable columns: `tax_answer` (`unknown` / `none` / `shown`),
`supplier_tax_number` (text, as printed), `supplier_registration` (`normal` / `simplified` / `not_registered` / `not_checked`), `purchase_kind`
(`operating` / `capital` / `meal`), `number_unobtainable` (boolean). Add tax lines (child table `expense_tax_lines`:
`expense_id, revision, line_no, tax_type` (`gst5`, `hst13`, `hst14`, `hst15`, `pst`, `qst`, `other`, `unset`), `cents`). Rule: the sum of lines =
`tax_cad_cents`, so every old reader stays right. Add `gst_registration_revisions` (`revision`, `effective_date`, `reason`, `created_at`,
`created_by`), seeded with revision 1 = 2026-09-26, reason “First entry”. Write the dev-host-only runner on the 003/005 pattern (inspect → apply
→ recount, refuse any other host). Update `schema.sql`. Hand dictionary entry beside :7871 (what each value means, the legacy mapping, the
sum rule, and that the credit is computed, never stored).
**Part 2, the rules.** `lib/bookkeeping-gst.ts` (pure): the credit function above, the legacy mapping, the $100 tier, the prefill lookup's
name match, and the sentence strings, from ONE place, as drawn in tab 2's table. Unit tests: every row of that table, plus rounding,
before/after the registration date for services and for capital, a date change re-working a credit, and the sum rule.

### Session B: plumbing (the Stage 1 Part 2 checklist, every new field everywhere)
**Part 3.** Store insert + reads (`lib/bookkeeping-store.ts`), the expenses API route validation (server re-derives the credit; never trusts a
client figure; refuses lines that don't sum to `tax_cad_cents`), the void snapshot (`lib/bookkeeping-void.ts`; a void carries the lines and the new
fields unchanged, per BKX-5.9), CSV export columns (tax lines flattened as `gst_cents, hst_cents, hst_rate, pst_cents, qst_cents, other_cents`,
plus number, registration, kind, `credit_cad`, `credit_state`) and the accountant package's `expenses.csv` (tab 8; `package-scope.txt` does NOT
change in 4a), `scripts/bookkeeping-backup.mjs` backup AND restore inserts (the restore insert has needed its own fix before [H]), the seed
script, the restore drill, the smoke script. Registration date: API GET/POST (POST = a new revision with a reason; owner-allowlist only, like
every Bookkeeping route). Tests for each.

### Session C: the form, the record, the register
**Part 4, the form** (tab 2, both states rows, and tab 9 phone). In More details: Tax on this receipt | Tax review status; tax lines with
“Work out from the total” (total × rate ÷ (100 + rate), editable) and “+ Add another tax”; Kind of purchase | Business use % (business use is
visible for every answer); the credit callout (only the figure bold); number | registration with the “Same as your last {supplier} expense” hint
and the simplified-list hint; the waiting state with “I can't get the number…”; the simplified state's sentence. The closed row's summary
strings as drawn. Delete the shipped hint “Purchase tax is a recorded detail. This form does not claim a tax credit.” Correction of a legacy
expense shows the mapped state (“Type not set” in amber). On a phone the shipped full-screen KitDialog; the remove × is 44 wide; a blank number
keeps a normal border (only the hint is amber). Check `npm run check:spelling`.
**Part 5, record + register** (tab 3). Record grid: Purchase tax “HST 13% · $74.78 · Pending review” (a two-tax receipt as drawn in the
gate's addition), Business use “100% · everyday cost”, Supplier's GST/HST number (MISSING chip, not a button / “Not needed under $100” / the
number), Supplier's registration, Credit on your GST/HST return (figure + one quiet line). Register: new reason chip **GST/HST number missing**
(only ≥ $100, GST/HST, no number, not “can't get”), counted in Needs attention; a row whose reasons include it opens the correction form with More
details open and the number focused. No new column. Not checked and legacy rows are NOT flagged in the register.

### Session D: Reports, closeout, walk
**Part 6, Reports** (tab 4, After). Replace the half-width “Purchase tax recorded” box with a full-width **Purchase tax paid** section: title
above, joined band (GST/HST paid · Charged by simplified sellers · Tax unknown), then the by-type table (GST 5% · HST 13% · HST 14% · HST 15% ·
PST · part of the cost · QST · Other · Type not set). Show only types present, except keep Type not set while any exist. Each row filters the
in-page line list like By category. Review view gains **“Tax review pending”** (status moved out of the old box). The quiet line **“Registered for
GST/HST from {date} · Change date”** opens the 416 question (date, required reason, Changes list), as drawn at the end of tab 4. Saving re-works
every credit on next read. No credit figure anywhere on Reports or the Overview (add a test that asserts the Overview renders no tax figure).
**Part 7, closeout.** `/simplify` (a new shared rules module) then `/review`; **`/accounting` review before hand-off** (it changes what we
record and report; CLAUDE.md); apply or record as owner questions. `/docs` is not needed (owner-only platform admin) unless help mentions the old
sentence; grep. Owner walk: a checkable Artifact (one purpose: “record GST/HST on purchases”), steps for every tab-2 row, the missing number
round trip (save without → Needs attention → add it → credit counts), the simplified case, a BC two-tax receipt, a legacy expense correction,
Reports by type, and changing the registration date to May 1 and back (watch a pre-Sept-26 service's credit appear and go). Update: this file's
Progress, the GST/HST plan Stage 4 status, the Bookkeeping ladder row 4a state, `TODO.md`, the QA ledger entry. Status wording: commit
hashes, never “uncommitted”.

## Do not

- Do not show any tax figure on the Overview, and do not compute or show profit, cash or “recoverable tax” anywhere else.
- Do not store a credit on the expense (computed on read; 4b's filed snapshot is the only stored figure, later).
- Do not add a supplier table, a Stripe import, or any sales rows to the Bookkeeping store.
- Do not build the worksheet, the Reports View pill or the Reports redesign (4b / Bookkeeping Stage 3).
- Do not touch Bookkeeping Stage 2 (personal-account redraw) or Stage 5 (production store); the repayment race fix is Stage 5's.
- Do not block saving for anything in the tax section.
- Do not change shared agent automation or database checks (owner rule).

## Progress

### Session A (2026-11-06, Opus): Parts 0–2 committed f68ebf9fe 2026-11-06; migration 006 applied to development 2026-11-06
- **006 applied to dev 2026-11-06** (after the owner refreshed the fieldlogichq login): 51 revisions / 25 expenses before and after; 5 columns
  with the right types; both tables; registration rev 1 = 2026-09-26; 0 tax lines. The app account (bookkeeping_app) reads both new tables
  and the new columns (old rows NULL). Evidence: .probe/gst4a/migration-006-{inspect,apply}.log, app-read.log.
- **Part 0 checks [V 2026-11-06]:** the $100 tier is right (the tiers moved from $30/$150 to $100/$500 on 2021-04-20;
  `GST_HST_ON_SUBSCRIPTIONS_CANADA.md`:46). Register reasons `lib/bookkeeping-expenses.ts:92`; Reports box `BookkeepingClient.tsx:284`;
  categories `BookkeepingClient.tsx:26–29` (“Equipment & supplies” exact). DSQL: the child table was chosen (no json column needed).
  The app credential (`bookkeeping_app`) cannot migrate; the runner needs `AWS_PROFILE=fieldlogichq BOOKKEEPING_DSQL_USERNAME=admin`
  after the owner refreshes that login (as for 005). Expected suite failures, none in files this build touched: the `footerStart`
  foot-sentence guard on `ExpenseFormWindow.tsx` (support-console-stage3-guard :916, pre-existing), plus 8 in other sessions' areas
  (help-content plus-tax words, practice plans phone, plan-billing usage, public stage 6 walk, series date groups, workspace status census).
- **`/accounting` answers** (new topic `docs/agents/accounting/ITC_RULES_FOR_EXPENSE_FORM.md`, index row added; Memo 8-5 fetched):
  (a) equipment held at registration gets a deemed credit at its **market value on that date** (basic tax content, ¶13/¶17), so the
  form never computes it: $0, “…may qualify for a credit based on its value then. It isn’t counted here; ask your accountant.”
  Services before the date get nothing; a **prepaid** plan spanning the date is split (¶19–22), so the everyday-cost sentence adds
  “If it paid for time after that date, such as a yearly plan, that part may be claimed. Ask your accountant.”
  (b) meals = tax × the everyday-cost factor (≥90 → 1, ≤10 → 0, else use%) × 50%. (c) Not checked is safe for a Canadian supplier
  (simplified is non-resident only). (d) the simplified sentence reworded: “…ask for a refund of the {amount}. If you get one, correct this
  expense: remove the tax line and lower the amount by the refund.” (a refund lowers the cost too). **Found:** a supplier marked
  **Not registered** that charged tax gets no credit (amber); the prompt's rules didn't cover it.
- **RULED by the owner 2026-11-06, all as recommended (as built):** Not registered + tax = no credit, amber; the yearly-plan line
  added; the number flag only when it holds a credit; the simplified sentence reworded. The last two items below were reported, not asked.
- **Owner questions raised at the end of Session A (wording/rules beyond the drawing):** the Not-registered rule + sentence; the
  extra pre-registration line; the reworded simplified sentence; the register reason narrowed to “a credit that would count but waits
  on the number” (`state === 'held'`), so simplified / Not registered / pre-registration / ≤10% use rows are never asked for a number;
  the under-$100 row keeps its business-use sentence (“never shown without its reason”); the BC row composes “All of the GST, because
  business use is 90% or more. PST isn’t claimed…” (the drawing abbreviates it to “The GST.”).
- **Part 1:** `scripts/bookkeeping-aws/006_gst_tax_lines.sql` (5 nullable columns; `expense_tax_lines`; `gst_registration_revisions`
  seeded rev 1 = 2026-09-26 “First entry”, `created_by` nil uuid), runner `scripts/bookkeeping-dsql-gst-migration.mjs` (dev host only,
  inspect → apply → recount + column types + seed check), `schema.sql` updated (with the seed), dictionary entry after the 005 paragraph.
- **Part 2:** `lib/bookkeeping-gst.ts` (pure: `workOutCredit`, `resolveTaxState` legacy mapping, `taxFromTotal`, `taxLinesMatchTotal`,
  `supplierPrefill`/`sameSupplier`, `currentRegistrationDate`, `defaultPurchaseKind`, `needsSupplierNumber`, every label and sentence).
  `tests/unit/bookkeeping-gst.test.ts` 36/36: every tab-2 row, thresholds, rounding (final only, half up), before/after the date for
  services and equipment, a date change re-working a credit, legacy mapping, the sum rule, the prefill. Lint clean.
- **Session B starts here.** Its prompt is the Session B section above plus these notes.
- **Session B needs:** a schema-ready probe for the 006 columns (like `hasExpenseTaxColumn`); the form's money formatter is duplicated
  in four files plus `bookkeeping-gst.ts` (a `/simplify` item for Part 7).

### Session B (2026-11-06, Opus): Part 3 committed 7fac17654 2026-11-06; no DDL
- **Store** (`lib/bookkeeping-store.ts`): `hasGstTaxSchema()` (the 5 columns + both tables). `listExpenseRevisions()` and
  `latestExpenseRevision()` attach each revision's `tax_lines` (`[]` when none; absent before 006). `insertExpenseRevision()` writes the
  revision and its lines in ONE `begin()` transaction (DML only), always names the 006 columns, and re-checks the sum rule. New:
  `listGstRegistrationRevisions()` (newest first), `gstRegistrationDate()` (null before 006), `insertGstRegistrationRevision()`.
  `ExpenseRevision` gained the five fields + `tax_lines`. Callers gate writes on `hasGstTaxSchema()`.
- **Expenses API:** a post carrying `taxAnswer` is a 4a post: fields `taxAnswer`, `taxLines` (JSON `[{type, cents}]`, ≤ 10),
  `supplierTaxNumber` (≤ 40, as printed), `supplierRegistration`, `purchaseKind`, `numberUnobtainable` ('true'/'false'). Validated by
  `validateExpenseTaxFields()` (`lib/bookkeeping-expenses.ts`, after today's `validateExpenseFields`, which now reads the known flag
  derived from the answer). Shown = ≥ 1 line, each > $0, summing to `taxCadAmount`; none/unknown = no lines and $0; unknown keeps
  today's pending-only rule. Blank registration / kind / number = NULL ("not stated"); `numberUnobtainable` is stored false when a
  number is given. `unset` lines are accepted only on a correction whose saved tax already resolves to "Type not set". A client
  credit field is never read. **Session C must post these field names.** A post WITHOUT `taxAnswer` is the pre-4a form: it still
  saves (4a columns NULL, legacy mapping), but gets 409 "This expense has newer tax details…" on an expense that holds 4a details.
  GET adds `credits` (`expense_id` → `Credit | null`, current active only), `registrationDate`, `gstSchemaReady`; POST returns
  `credit`. Saves AND voids return the storage-update 503 until 006 is applied. The page's server props (`page.tsx`) were not
  changed: Session C adds `gstSchemaReady` there if the form needs it on first paint.
- **Credit adapter:** `expenseCredit(row, registrationDate)` in `lib/bookkeeping-gst.ts` is the ONE place a saved row becomes a
  `workOutCredit` input (legacy → `resolveTaxState`; registration not stated → Not checked; kind not stated →
  `defaultPurchaseKind(category)`; receipt total = `cad_cents`; date = incurred, else expense date). Null without a date.
- **Void** (`lib/bookkeeping-void.ts`): `taxAnswer`, `taxLines` (JSON), `supplierTaxNumber`, `supplierRegistration`, `purchaseKind`,
  `numberUnobtainable` join the values a void must leave unchanged; the void revision is `{...previous}` so it carries the lines.
- **CSV + package expenses.csv:** after `tax_status`: `tax_answer, gst_cad, hst_cad, hst_rate, pst_cad, qst_cad, other_cad,
  supplier_tax_number, supplier_registration, purchase_kind, credit_cad, credit_state`. **Named `_cad` in dollars, not the prompt's
  `_cents`**, to match every other money column in the file. `hst_rate` joins two rates as `13/15`. A legacy "Type not set" amount
  stays only in `recorded_tax_cad` (type columns blank, state `type_not_set`). Credit only on the current active revision
  (superseded/void blank). A held credit keeps its figure with state `held` (as the record cell shows it); Not checked reads
  `counted_registration_unchecked`. `package-scope.txt` unchanged.
- **Registration date API:** `app/api/platform-admin/bookkeeping/gst-registration/route.ts`. GET `{schemaReady, current, history}`.
  POST JSON `{effectiveDate, reason, expectedRevision}`: reason required (≤ 500), real date, refuses the current date, stale
  revision = 409, 23505 race = 409; inserts revision + 1 and stores nothing else. Same-origin check; `requireBookkeepingApi`.
- **Backup** (`scripts/bookkeeping-backup.mjs`): format 3 adds `tax_line` and `gst_registration_revision` records + their counts in
  `end`; formats 1–2 still verify (their rows get NULL 006 keys). Verify checks each line's revision, type, cents and the sum rule.
  Restore and the isolated drill need 006 applied and write lines + registrations; restore-dev skips registration revisions the
  target already holds identically (006 seeds revision 1) and refuses a differing one. **Found by the real drill and fixed:** the
  format bump made verify reject owner-transfer records (`format === 2`); now `>=`, and a contract test forbids `meta.format ===`.
- **Seed / restore drill / smoke:** each names the 006 columns (`?? null`) and writes lines in its transaction. The B2 QA seed rows stay
  pre-4a on purpose (they exercise the legacy mapping); the seed verification checks the sum rule.
- **Tests:** `bookkeeping-gst-routes.test.ts` (new: 4a save path, sum-rule refusals, no client credit, never-blocking fields, stale
  values, "Type not set" rule, pre-4a form guard, 006-missing pause, GET credits; registration API read/save/refusals/owner-only/
  same-origin/paused); `bookkeeping-expenses` (validator + adapter); `bookkeeping-export` (columns, held, unchecked, date change,
  superseded/void, legacy); `bookkeeping-void-route` (carry + refuse changed 4a fields + paused); `bookkeeping-storage-contract`
  (every `schema.sql` column is in the app insert and the restore insert, 006 additive-only, one-transaction writes, format guard).
  Bookkeeping 114/114. Typecheck clean; lint clean on touched files.
- **Development cluster [V 2026-11-06]:** smoke probe passed (revision + 2 lines in one transaction, rolled back). The shipped store,
  as `bookkeeping_app`: reads 51 revisions with lines, registration rev 1, inserts a synthetic expense with 2 lines, reads them back in
  order, credit `held` 500, void carries them, a bad sum is refused with nothing written; then removed with admin (counts 51 / 0 / 1
  before and after). Backup create → verify → restore-drill-dev with 2 real lines: 52 revisions, 2 lines, 1 registration, 34 owner
  transfers, 10 receipts replayed and compared; synthetic rows and archive removed, no recovery tables left. QA seed: already present,
  verification (incl. the sum rule) passed. Evidence: `.probe/gst4a/session-b-*.log`. **Not run:** `restore-dev` into an empty store
  and `scripts/bookkeeping-restore-drill.mjs` (both need an empty dev expense table; dev holds 51 revisions).
- **Full suite:** 14,700 / 14,709; the 9 failures are Session A's expected set (the `footerStart` foot-sentence guard on
  `ExpenseFormWindow.tsx`, help-content tax words, practice plans phone, plan-billing free time, public stage 6 walk, series date
  groups, workspace status census), none in bookkeeping. verify:changed's other checks: the failing ones (admin old look, admin type,
  schema parity bank tables, index coverage, org-slug callers, CSS selectors, export catalog) are all other sessions' files.
- **For Session C:** post the field names above; read `credits[expense_id]` for the record; `expenseCredit()` / `workOutCredit()` give
  the live form sentence client-side from the same rules. **For Part 7 `/accounting`:** the CSV credit columns' meaning (held keeps its
  figure) and the `_cad` naming are this session's calls, not drawn.

### Session C (2026-11-06, Opus): Parts 4–5 committed a9a22921e 2026-11-06; no DDL
- **Step 0 gate, drawn and RULED 2026-11-06.** Added to the same artifact (versions 3–4), end of tab 3, from the shipped record grid:
  a BC two-tax cell and a pre-4a "Type not set" record. `/design` ran first (helper pass). It changed the legacy recommendation: hide
  number + registration on a Type-not-set record (the type may be PST, the same reason "Not sure yet" hides them), and add footers and
  a PST no-rate note. **Ask 13 A:** one line per tax, then "{total} in all · {status}" as a quiet line; one tax keeps its one line.
  **Ask 14 A:** "Type not set · $74.78 · Pending review", and only the credit cell is added, plain (not amber): "Not worked out" +
  "Choose the tax type when you correct this expense." The kind still shows under business use on that record, as drawn.
- **Part 4, form** (`ExpenseFormWindow.tsx`): "Tax on this receipt" | status (Pending review / Reviewed) or | Business use; tax lines
  (type from `CHOOSABLE_TAX_TYPES`, amount; a legacy line opens as "Choose a type" in amber); "Work out from the total"; "+ Add another
  tax" (≤ 10; a new line starts as PST); Kind | Business use when a GST/HST line exists, else Business use alone; the live credit callout
  (`workOutCredit`, today's registration date; kit callout, neutral edge, amber by the credit's own tone; only the figure bold);
  number | registration (prefilled by `supplierPrefill`, excluding the expense itself, until either is touched; "Same as your last …";
  `REGISTRATION_HINT`; amber `NUMBER_HINT_BLANK` when held; `NUMBER_NOT_NEEDED` under $100); `CANT_GET_NUMBER` while held or not
  claimed. The closed row comes from `taxSummary()`. The old "does not claim a tax credit" hint is deleted (not in help content [V grep]).
  Posts `taxAnswer`, `taxLines`, `taxCadAmount` (sum), `taxStatus` (none → `none`, unknown → `pending`), `purchaseKind`,
  `supplierTaxNumber`, `supplierRegistration` (`not_checked` when untouched with no prefill), `numberUnobtainable`. Hidden fields go
  blank. No `taxAmountKnown`, no credit. A `taxCadAmount` refusal is shown on the first line's amount.
  **Calls not drawn, made here:** the × shows only with 2+ lines (removing the only line of "Shown" is meaningless); "Work out from the
  total" shows only for one line with a rate (a two-tax total can't be split by one rate); a held credit's closed row says
  "credit $x held"; "Copy as new" of a Type-not-set expense refuses at Save with "Choose the tax type." on the type (the server accepts
  `unset` only on a correction).
- **Part 5, record + register.** Record (`ExpenseRecordBody.tsx`): `purchaseTaxCell()`; Business use "{%} · {kind}"; number (as printed
  / MISSING chip when held / `NUMBER_NOT_NEEDED` / `NUMBER_NOT_RECORDED`) and registration only with a GST/HST line; credit cell = figure +
  one quiet line (`HELD_RECORD_NOTE` when held, else its sentence). The credit is `expenseCredit(row, registrationDate)`, the same function
  and date the GET `credits` map uses. New sentences live in `bookkeeping-gst.ts` (`CREDIT_LABEL`, `CREDIT_NOT_WORKED_OUT`,
  `TYPE_NOT_SET_RECORD_NOTE`, `NUMBER_NOT_RECORDED`, `TAX_STATUS_LABELS`; `formatCad` and `hasGstHstLine` exported).
  Register: `attentionReasons(row, registrationDate)` adds `NUMBER_MISSING_REASON` via `needsSupplierTaxNumber()` (state `held`).
  **The date is a required argument** of `attentionReasons`, `matchesReviewFilter`, `matchesExpenseFilters` and `selectExpenseRevisions`,
  so every path passes it (Overview card, tab count, register count + filter + chips, record steps, export + package routes).
  `page.tsx` passes `gstSchemaReady` + `registrationDate`; Add/Save also pause on `gstSchemaReady`. In the Needs attention view, a row
  with the reason opens the correction form with More details open and the number focused (its link carries `form=correct`).
  The Reports worklist hint now names missing GST/HST numbers.
- **Tests:** `bookkeeping-gst-attention.test.ts` (new): the reason and its exceptions (under $100, number, can't get, simplified,
  legacy, void, Not checked); a May 1 ↔ Sept 26 date change moving a June service in and out; the register count, the attention filter,
  `matchesReviewFilter` and the address-parsed export agreeing for Sept 26, May 1 and no date; flagged ⇔ credit `held`; `taxSummary` and
  `purchaseTaxCell` strings; the form posts every Session B field and never `taxAmountKnown`, a credit, or the old sentences.
  Existing filter/expense/export tests pass the date. Bookkeeping 127/127; typecheck clean; lint clean; `check:spelling` passes.
- **Full suite:** 14,727 / 14,736; the 9 failures are the expected set (the `footerStart` foot guard on `ExpenseFormWindow.tsx`, on
  the foot line this session did not touch; help-content tax words, now naming `lib/help-content/coaches.tsx` and `org.tsx`; practice
  plans phone; plan-billing; public stage 6 walk ×3; series date groups; workspace status census). verify:changed's other checks: the
  same 7 as Session B (admin old look, admin type, schema parity, index coverage, org-slug callers, CSS selectors, export catalog),
  none naming a bookkeeping file. Dev server restarted 2026-11-06; login 200, no `EACCES`.
- **Browser checks owed (owner):** the tab-2 states (HST, 50% / 8% use, laptop, meal, Canva simplified, number blank ≥ $100 + can't get,
  $42 under $100, BC two-tax, Not checked, a pre-Sept-26 service), a legacy correction saved unchanged, the record cells, and the
  Needs attention round trip (save without the number → listed → row opens at the number → add it → gone). Phone at 390.
- **For Session D / Part 7:** `/simplify` should take the money formatters (form, record, register, client still have their own;
  `formatCad` is now exported from the rules module). The legacy record's kind line and the four "calls not drawn" above are for the
  owner walk.

### Session D (2026-11-06, Opus): Part 6 committed 0f16bf9a3 2026-11-06; Part 7 step 1 (/simplify) committed f83cbe24e 2026-11-06; no DDL
- **Step 0 [V 2026-11-06]:** `BookkeepingClient.tsx`:103–148 holds `registrationDate` + `gstSchemaReady` and `load()` refreshes both; the
  registration route is as Session B recorded; the review-value list was hard-coded at `bookkeeping-export.ts`:47. Nothing in Part 6 was
  undrawn (tab 4 After + the window at its end), so no drawing addition.
- **`/accounting` (asked first, answered from `ITC_RULES_FOR_EXPENSE_FORM.md`, verified today; new §8 + index note):** Reports shows the
  **full** tax on each receipt. A business-use share of the tax is neither the tax paid nor the credit (the credit uses 90/10, the >50%
  equipment rule and meals' 50%), so it answers nothing CRA or the accountant asks. It asked for a basis sentence because the spend figures
  above are business-use shares.
- **RULED by the owner 2026-11-06 (as recommended):** the drawn second quiet line ("Your credit is worked out on the GST/HST return view.")
  is NOT shipped: that view is 4b. The line is `TAX_PAID_NOTE`: "Tax as charged on your receipts, in full. Spending figures above show only
  the business-use share." 4b may add the return-view pointer back when the view exists.
- **Rules module** (`lib/bookkeeping-gst.ts`): `summarizeTaxPaid()` (band + by-type rows, full tax, GST/HST rows sum to the band,
  simplified = a part of GST/HST paid, unknown = a count; only types paid, so "Type not set" shows while any exist), `taxTypesPaid()`,
  `isTaxReviewPending()` (answer resolves to Shown + status pending; a pre-4a amount counts), `TAX_PAID_ROW_LABELS`, `TAX_PAID_TITLE`,
  `TAX_PAID_NOTE`, `REGISTRATION_LINE`, `REGISTRATION_QUESTION`.
- **Summary** (`summarizeExpenses`): `taxPaid` replaces `taxByStatus` / `pendingTaxCents` / `unknownTaxCount` (the old box's pro-rated
  figures; no other reader). Same active current rows as By category.
- **Review view:** `REVIEW_FILTERS` + `isReviewFilter()` in `lib/bookkeeping-expenses.ts` are now the one list (the export/package parser
  reads it); `tax_pending` added to `matchesReviewFilter` and the screen's select.
- **Tax-type doors:** drilldown kind `tax`; `ExpenseFilters.taxType` (`matchesExpenseFilters`, `expenseFilterParams`, the parser refuses
  an unknown type), so Export CSV / the package follow a tax row as they follow a category. **Call not drawn:** the package's narrowing
  rule (owner-transfers.csv keeps only linked reimbursements) counts a tax type as narrowing, and `package-scope.txt` names it ("tax type"
  in the filter sentence, and in the status line when set). That is the scope file describing a filter that now exists, not a 4b change.
- **Screen** (`BookkeepingClient.tsx` + `bookkeeping.module.css`): the half-width box is gone; full-width section (kit section title, kit
  joined band, framed by-type table with row doors, the selected row tinted, the line-list heading names the type), the two quiet lines,
  then "Recorded spend by payment source" full width (`reportGridWhole`). Phone ≤ 640: band stacks to one column; the table is
  `table-cards`. `money` in the client is now `formatCad`.
- **Change date** (`GstRegistrationQuestion.tsx`, new): KitDialog question, the shipped BookkeepingQuestion recipe (two quiet answers,
  "Keep it" / "Change date"; the drawing's lime button is not the shipped recipe). Lead sentence, "Registered from" (DateInput, starts at
  the current date), Reason (required, ≤ 500), "Changes · n" list from GET history. POST with `expectedRevision`; date/reason refusals
  in place under their field, others in the foot; on 409 the history is re-read and the typed values kept. On save: notice
  `REGISTRATION_QUESTION.saved` and `load()`, so every credit and Needs attention reason re-works. Hidden when no date is on record;
  disabled until `gstSchemaReady`. Owner-only through the route.
- **Tests:** `bookkeeping-gst-reports.test.ts` (new, 13): full tax not pro-rated, rows = band, simplified ⊂ band, order + only-present +
  Type not set, BC counted once in band and in both rows, current/active only, tax door filter, screen = address = export for a tax type
  and for Tax review pending, every `REVIEW_FILTERS` value parses, unknown type refused, the Overview source has no tax word or figure,
  Reports never works out a credit, the window posts `expectedRevision` and re-reads on 409, save calls `load()`. `bookkeeping-expenses`
  summary tests updated. Bookkeeping 140/140; typecheck clean; lint clean; `check:spelling` passes.
- **Full suite:** 14,740 / 14,749; the 9 failures are the expected set. verify:changed's other checks: the same 7 (admin old look, admin
  type, schema parity, index coverage, org-slug callers, CSS selectors, export catalog), none naming a bookkeeping file.
- **Part 7 step 1, `/simplify` (4 helper reviews: reuse, simplification, efficiency, altitude), committed f83cbe24e; no screen change.**
  Applied: `formatCad` in the form, record and register (identical output) and `sumTaxLines` in the form + `taxColumns`; Reports' doors
  are now `Partial<ExpenseFilters>` fields (the line list = `matchesExpenseFilters`, the export = the same object + `dateStatus:
  confirmed`; `drilldownLabel()`); `narrowsExpenses()` in `bookkeeping-filters.ts` (the package's narrowing list has one home);
  `hasKnownTaxAmount` reads `resolveTaxState` (same formula; 4a rows store `tax_amount_known = answer !== unknown`); the expenses GET's
  per-expense `credits` map removed (no screen read it; its route test now asserts it is absent); registration refusal strings shared
  by route + window (`REGISTRATION_QUESTION.dateMissing / reasonMissing`); the window derives its date (no effect copy); row labels =
  `taxPaidRowLabel()` (TAX_TYPES + two overrides); `pluralize`; `attention` memoized. Bookkeeping 140/140, typecheck + lint clean.
  **Skipped (recorded, not done):** `resolveTaxState(row)` reading `row.tax_lines` itself (9 call sites; churn, no defect); one
  `edited` state for the form's number + registration prefill (Session C's form logic; risk without a walk); sharing
  `BookkeepingQuestion` with the registration window (needs per-field refusals and the 409 re-read); a `requireSameOrigin()` helper
  (3 copies, 2 predate 4a; `lib/bookkeeping-access.ts` is outside this build); efficiency in `lib/bookkeeping-store.ts`
  (`hasGstTaxSchema` probed 2–3× per request with 2 queries each, `gstRegistrationDate` reads the whole history, probes awaited in
  series, tax lines inserted one statement each). A module-level "ready" memo would cut the probes but breaks route tests that flip
  readiness in one process; worth a Stage 5 (production store) item. Dead-for-the-app but tested: `legacy`, `countsOnReturn` (kept for
  4b's worksheet), POST `credit` (route tests verify the server re-derives it).
- **Session E (fresh session) starts here: Part 7 steps 2–6.** `/review` (scope: 0f16bf9a3 + f83cbe24e, plus Sessions B–C if the
  funnel allows); `/accounting` review before hand-off (the CSV credit columns, held keeps its figure, `_cad` naming, Reports' full tax
  vs the old pro-rated box, Session C's four calls not drawn); grep `lib/help-content` for "tax credit" / "purchase tax"; the owner walk
  Artifact (steps in Part 7.5 of the Session D prompt, plus: Reports' tax rows open the list and the export follows; the quiet line
  is the full-tax sentence, not the drawn return-view pointer; Change date's window uses the two quiet answers); grep every other walk
  for the old checkbox / "does not claim a tax credit" / the old tax box; then this Progress, the GST/HST plan §Stage 4 status, the
  Bookkeeping ladder row 4a, TODO.md, and a new OWNER_QA_LEDGER entry. The dev server was restarted at the end of Session D.
