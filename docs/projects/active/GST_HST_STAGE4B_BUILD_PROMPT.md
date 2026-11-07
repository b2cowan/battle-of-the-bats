# GST/HST · Stage 4b: the return worksheet, a Reports view (build prompt, FOUR sessions A–D)

> Written 2026-11-07 in the 4b kickoff session ([GST_HST_STAGE4B_KICKOFF_PROMPT.md](GST_HST_STAGE4B_KICKOFF_PROMPT.md)). Recommended model: Opus for A and C (the numbers, the freeze), Sonnet is enough for B and D.
> Plans of record: [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §Stage 4 and [BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md](BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md) §3 row **4b**.
> **Approved drawings (build to these): https://claude.ai/artifact/LbCjjVcnZeTP8uUT3yVZan** (source `GST_HST_STAGE4_DRAWINGS.html`): tab 5 the worksheet, 6 the four data states, 7 where it lives, 8 the package, 9 the phone half, 10 the rulings.
> Tax rules: `docs/agents/accounting/GST_HST_RETURN_LINES.md` (lines, credit notes, bad debts, currency, tax point). Record the facts you rely on as [V] (opened this session) or [H] (handed over).
> **Prerequisite for Session B only:** [BOOKKEEPING_REPORTS_VIEW_CONTROL_BUILD_PROMPT.md](BOOKKEEPING_REPORTS_VIEW_CONTROL_BUILD_PROMPT.md) (the thin View control). Session A has no dependency on it and may run beside it (A touches `lib/` and one DSQL read; the control touches `BookkeepingClient.tsx`).
> Hard rule for every session: this build changes what we report to the CRA. `/accounting` runs **before hand-off** of A, C and D; apply what it finds or record it as an owner question.

## What 4b is, in one paragraph

A sixth Reports view, "GST/HST return": the return's **lines 101-109 for any dates** (regular method, annual filer, no quick method), each figure opening
the invoices or expenses behind it. **Sales come only from GST/HST Stage 3's per-invoice record**, read where it lives; **credits come from 4a's
expenses**. It lists everything unresolved under "Before you file", shows an honest state when it cannot know, lets the owner **"Mark as filed…"** to freeze
a period, and adds the worksheet and its sources to the accountant package. It is an aid, not the return: nothing is filed from here, and the Overview never shows a tax figure.

## What the audit found [V 2026-11-07 unless marked]

- **No View control exists.** Reports is one long page under four top-level tabs (`BOOKKEEPING_VIEWS` in `lib/bookkeeping-navigation.ts:3`). The thin View control is its own prompt.
- **Where the sales live:** `public.platform_charge_tax_records` (one row per Stripe invoice, written at `invoice.finalized`) and `public.platform_credit_note_tax_records`, in
  **Supabase** (migration `451_every_charge_keeps_its_tax.sql`), not in the Bookkeeping store (Aurora DSQL, schema `bookkeeping.*`, `lib/bookkeeping-store.ts`). 4b reads **two stores**.
  Rows are never copied across (ruling: one source for sales).
- **Columns the worksheet reads** (451): `issued_at`, `status` (open/paid/void/uncollectible), `paid_at`, `voided_at`, `uncollectible_at`, `currency`, `amount_before_tax_cents`, `tax_total_cents`
  (do NOT sum this: it includes PST and US tax), `tax_lines` (jsonb, shape `StoredTaxLine` in `lib/charge-tax-record.ts:42-57`; filter Canadian GST/HST lines with `isCanadianGstHst`, `:116`),
  `gst_hst_position` (taxed / zero_rated / missing) with `gst_hst_position_why`, `kind`, `livemode`, and the Bank of Canada columns `fx_rate`, `fx_rate_date`, `fx_source`,
  `cad_amount_before_tax_cents`, `cad_tax_total_cents`, `cad_total_cents` (all-or-nothing: a foreign-currency sale with no rate read has them null). `stripe_cad_total_cents` is a cross-check only.
  Credit notes carry `issued_at`, `tax_lines`, `status` (issued/void), `note_type`, the same CAD columns. Period index: `(livemode, issued_at)` on both tables.
- **There is NO period-wide sales read.** `readSaleRecords` (`lib/console-money-sales-store.ts:55`) is per customer and capped at 300 rows; `lib/console-money-sales-tax-wait.ts` is a platform-wide count that skips shared customers. 4b needs a new read.
- **"Looked at"** is the append-only `platform_charge_tax_looks` table (452). A test pins that the return must **not** read it (`tests/unit/console-money-looks.test.ts:358`). Keep that: the unresolved list ignores looks.
- **4a gives:** `expenseCredit(row, registrationDate)` (`lib/bookkeeping-gst.ts:251`, the single adapter; the credit is computed on read, never stored), `workOutCredit` (`:189`; state `counted` / `held` / left-out; `Credit.countsOnReturn` true only for `counted`),
  `summarizeTaxPaid` (`:336`), the changeable registration date (`bookkeeping.gst_registration_revisions`; `gstRegistrationDate()` in `lib/bookkeeping-store.ts:237`; today 2026-09-26, CRA backdate to 2026-05-01 pending), and the export's `credit_cad` (`lib/bookkeeping-export.ts:66,111`; held reads 0.00, state in `credit_state`).
  **There is no period total of credits**: sum `expenseCredit` over the active revisions (`selectExpenseRevisions`), do not parse the export.
- **Not built, 4b builds them:** the worksheet, period sums, recovered-bad-debt detection (no code or table), write-off and void relief, the platform-wide unresolved list, "Mark as filed", and the package files. The backfill floor is `BACKFILL_FLOOR_ISO = 2026-05-01T00:00:00-04:00` (`lib/charge-tax-record.ts:176`), run by the daily job; it ran on dev with 0 rows written (dev Stripe has no old invoices) [H], so **Session A must prove the engine on built fixtures**, not on dev data.
- **Accountant package** (`app/api/platform-admin/bookkeeping/package/route.ts`, `lib/bookkeeping-zip.ts`): `expenses.csv`, `owner-transfers.csv`, `package-scope.txt` (line 61 says Stripe income is excluded), `receipt-index.csv`, `receipts/`. No worksheet or sales files.
- **One correction to the kickoff:** a USD credit note's tax goes on line 107 at the **original invoice's rate**, not its own day's (`/accounting` 2026-11-07, Stage 3 prompt :684-687: the adjustment cannot exceed the tax first reported). Zero today (every USD sale is zero-rated); the engine must still do it right.

## Rulings this build carries (all ruled or recorded, do not reopen)

1. **One source for sales:** Stage 3's per-invoice record, read where it lives. Never `platform_fee_invoices`, never a Stripe CSV, never copied into the Bookkeeping store.
2. **GST/HST = Canadian GST/HST lines from `tax_lines`**, not `tax_total_cents`. Per invoice: sum the Canadian GST/HST line cents, convert at `fx_rate` (CAD = rate 1), round to the cent **per invoice**, then add up.
3. **Sales by invoice ISSUE date**, never paid date. A failed or unpaid invoice still owes the tax. Day boundaries follow the same rule Stage 3 and the Money band use (find it; do not invent a second one).
4. **The registration date is 4a's changeable setting**, never hard-coded. A sale before it is not "missing".
5. **Missing answers stay visible:** every sale with `gst_hst_position = missing` is listed as unresolved, **whether or not staff marked it "looked at"**, and including a customer shared by two portals (its sales are on no club's list today). A USD sale with null CAD columns (no rate read) is listed too.
6. **Credit notes on line 107** (103 stays gross). A lost card dispute has no credit note, so its tax stays remitted unless written off. **Recovered bad debt on 104.** A blended `refunded_cents` never feeds the return.
7. **USD:** valued at the Bank of Canada rate on the invoice date (already stored). A USD credit note's tax on 107 at the **original invoice's** rate. Zero today.
8. **Annual filer, regular method.** Lines 101-109 only; 110-115 are "worked out on the return itself" (footnote). Whole dollars on 101 only, rounded once on the sum.
9. **Reports VIEW, not a tab** (Ask 7). Calculated lines (105, 108, 109) open nothing; folded lines use ▸; figures that open use the dotted underline; negative money is written in words ("refund", "you owe"). Never "Not available" shown as $0.
10. **"Mark as filed" freezes a period** (Ask 12). The worksheet plus its sources go in the accountant package. **Nothing tax-related ever appears on the Overview.**
11. Phone: the drawing's line cards, only "Copy lines" kept in the toolbar. The house toolbar, the one-spelling rule (the clock is "8:00 a.m."; "fiscal year" is club-side only) and the house window sizes apply.

## Design calls this prompt makes (flag in the walk; the owner can overrule)

*(`/accounting` reviewed these 2026-11-07; the research is `GST_HST_RETURN_LINES.md` §8. Where it changed a drawing, the drawing loses.)*

- **A bare void earns NO line 107 adjustment** (**this withdraws the drawings' "its reversal shows on 107"**). s.232 relief needs a credit note. A voided finalized invoice **stays in 101 and 103** and is listed in "Before you file" as "Voided, no credit note: its tax stays in line 103". If a credit note exists for it, 107 reads it through the note. (Stripe cannot issue a note on a void invoice, so the going-forward fix is a credit note instead of a void; that is a policy point for the owner, not this build.)
- **Write-off = Stripe "uncollectible"** (UNPAID_SUBSCRIPTION_INVOICES rec. 3). Relief on 107 in the period of `uncollectible_at`, in its own sub-line **"Bad debts written off"**, each invoice openable, relief = GST/HST x (amount written off / total). If the record cannot show the unpaid share, list the invoice, do not guess. Four-year claim limit from RETURN_LINES.
- **Recovered bad debt** = an invoice with `uncollectible_at` and a later `paid_at`: the recovered share of its GST/HST on 104 in the period of `paid_at`. A write-off and recovery in the same period net to zero on one return: correct.
- **Cap:** relief on 107 for one invoice (credit notes + write-off) never exceeds that invoice's GST/HST; the engine caps and lists the capped ones. A voided credit note is excluded.
- **Line 104 tracks only recovered bad debt.** The drawing's caption also names a supplier's refund of tax we claimed and the yearly meals add-back; 4a records neither. The line says "Supplier refunds of tax you claimed and the meals add-back aren't tracked here", never a silent $0.00.
- **Sales before the registration date sit OUTSIDE the return:** not in 101 or 103; one informational "Before you file" line ("N invoices issued before your registration date; they move in if the date changes"). Changing the date (4a) moves them in, and the Stage 3 check then already flags any taxable one with no GST/HST answer as "missing" (use the same registration-date rule `judgeSales` uses, do not invent a second). **Do not compute a deemed tax-included amount for a backdated gap**: CRA's pages say nothing on it (unresearched). Note: for a voluntary registrant CRA wants proof that tax was actually charged before it backdates beyond 30 days, and nothing has been sold, so the backdate may be refused.
- **Line 101 is gross** (RETURN_LINES §7) with a quiet "Credit notes issued: $X" memo beside it. The two accounting files disagree on whether a note reduces 101; it informs no tax figure here; accountant question.
- **The period picker allows any dates.** Do not hard-code the 2026 stub (Sept 26 to Dec 31, 2026): which reporting period it belongs to is an accountant question (Memo 8-5 ¶40-41).
- **"Sales are recorded from…" (state C)** needs to know where the record starts. The record starts at the backfill floor only if the backfill finished. Session A checks whether the code records that it finished; if not, add the smallest honest marker and say so.

## Sessions

### Session A (Opus): the numbers, no screen

- A pure **worksheet engine** (`lib/gst-return-worksheet.ts`, no I/O) taking sales rows, credit-note rows, expense credits, the registration date and the period, returning every line with its parts, the "Not on the return" group, the unresolved list and a per-line completeness flag. One home for the rules above; the screen and the package both call it.
- The **reads**: a platform-wide period read of invoices and credit notes from Supabase (livemode matching the environment, paged like `readAllPages` in `lib/console-money-needs-look.ts:149`, **no 300-row cap**), and a period read of expense credits from the Bookkeeping store through `selectExpenseRevisions` + `expenseCredit`. Each read fails **independently** (state A in the drawings: sales unreadable does not blank line 106, and the reverse).
- The **platform-wide unresolved list** (missing answer, including shared customers; null-CAD foreign sale; capped relief).
- Tests on built fixtures (dev has no rows): CAD and USD invoices, zero-rated, HST at 13/14/15 and GST 5, two taxes on one invoice, a missing answer, an unpaid and a failed invoice (still in 103), a bare void (stays in 101 and 103, listed; NOT on 107), a void with a credit note (107 through the note), a credit note (107, not 103), a write-off (107), a part-paid write-off, a recovered write-off (104, and the same-period net-to-zero case), relief capped at the invoice's tax, an invoice before the registration date (outside the return; moves in when the date changes), a USD credit note (original rate), a period before the record starts (partial), an empty period, rounding (per invoice, 101 once), and a **guard test** that the worksheet never reads `platform_fee_invoices`, `tax_total_cents` or the looks table.
- `/accounting` review of the engine's rules (this is the load-bearing session). Then Session A's record in Progress.

### Session B (Sonnet): the view

*Needs the View control built.* Add "GST/HST return" to the control's registry. Build tab 5 (the table, Before you file, the three windows: line 103's invoices, line 106's bridge, numbers missing), tab 6 (states A, B, C; D waits for Session C), the unresolved list (missing answers, shared customers, null rate) in the Before you file area, "Copy lines" and the Worksheet CSV, the period control (shared with the other views), and tab 9's phone half. Check the line captions (101 "Sales and other revenue", 103 "GST/HST collected or collectible", 104 "Adjustments to be added to net tax", 106 "Input tax credits", 107 "Adjustments to be deducted when determining net tax", 109 "Net tax") against the live CRA return screen; they are paraphrases that were never checked word for word (RETURN_LINES §1). `check:layout --changed` at desktop and 390.

### Session C (Opus): Mark as filed

- A new DSQL migration (007; apply the way 4a applied 006) with an **append-only** `bookkeeping.gst_return_filings` (the app has SELECT and INSERT only there; a freeze fits): period from/to, filed-on date (default today, the owner may change it), the **lines as filed**, the **sources as filed** (invoice, credit-note and expense-revision ids with their amounts), who, when, and a reason when a period is marked again (an amended return appends a new revision; the latest shows, the history stays).
- The **"Mark as filed…" question** (the drawings do not draw it; build the house 416px reason question as in Void, with the lines shown) and the filed state D ("FILED APRIL 20, 2028", "Figures as you filed them", "Changed since you filed"). A late-released credit (a held credit whose number is added after filing) shows under "Changed since you filed" and on the **next** return's line 106 as "Credits from earlier periods". Reject overlapping filed periods unless identical.
- Dictionary and snapshots in the same unit of work (`docs/agents/db/DATA_DICTIONARY.md`; do what 4a did for 006). `/accounting` review. Prod apply is owed with the code (record it, do not run it).

### Session D (Sonnet): the accountant package, wording, records

- Add to the package: `gst-hst-worksheet.csv` (lines 101-109), `gst-hst-sales.csv` (each invoice and credit note with its Canadian-dollar figures and rate), `gst-hst-credits.csv` (each expense's credit and its state), `gst-hst-as-filed.csv` (a filed period only). Reword `package-scope.txt` per tab 8: "Bank statements, processor fees, payouts and bank reconciliation are not in this package. Sales are included only as the GST/HST record of each invoice and credit note." The yearly in-Canada copy takes the same files.
- Privacy default: buyers appear as the invoice number plus buyer kind and the club name; an individual coach appears by invoice number only. (`/legal` glance only if the owner wants names.)
- Platform-admin only, so `/docs` is skipped unless a Bookkeeping help article exists (check). `/accounting` review of the package and the final wording. Update the ladder, the plan and TODO. Write the owner walk (checkable Artifact, one purpose per walk).

## Product-manager UX summary (also in the conversation before this was final)

Reports gets a "GST/HST return" choice in its View control. The owner picks a year or any dates and reads lines 101-109 the way the CRA screen asks for them; each figure opens what is
behind it. "Before you file" lists what is unresolved. When the worksheet cannot know something it says "Not available" with a reason and what to do, never a zero. "Mark as filed…" freezes a
period; later changes read "Changed since you filed". The accountant package carries the worksheet and its sources. Owner-only (platform admin); the Overview never shows a tax figure.

## Open owner / accounting questions (recorded, none blocks Session A)

1. Backdated registration: if CRA grants it and any invoice exists in the gap, what tax is owed? (Unresearched; the accountant answers. Likely moot: nothing has been sold.)
2. Accountant, before the first filed return (`/accounting` 2026-11-07): void and write-off treatment; which reporting period the 2026 stub belongs to; line 101 with credit notes; anything a backdate grants.
3. A separate "held" amount column in the export (4a walk call, still open).
4. Registration-date typo guard (a far-future date moves every credit; year 0000 errors) and the supplier-number format check, both deferred to "Before you file" (4a prompt :403-404).
5. USD mixed-currency "Refunded" cell on the Money band must be fixed before the first US club (Stage 3 prompt :638, :654).
6. Accountant sign-off on the three-part zero-rating evidence rule before the first US club (existing trigger).

## Rules of the room

Branch `dev` only. Commit nothing until the owner says; stage explicit pathspecs. Do not change hooks, settings or database checks. A helper's summary is a lead, not evidence. A migration updates the dictionary and snapshots in the same unit of work. Offer `/review` after each session; `/simplify` if the engine and the package duplicate logic.

## Progress

(empty)
