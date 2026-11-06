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

### Session A (2026-11-06, Opus): Parts 0–2 built; migration 006 applied to development 2026-11-06
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
- **Session B needs:** a schema-ready probe for the 006 columns (like `hasExpenseTaxColumn`); the form's money formatter is duplicated
  in four files plus `bookkeeping-gst.ts` (a `/simplify` item for Part 7).
