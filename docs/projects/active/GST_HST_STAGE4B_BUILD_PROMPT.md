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

### Session A: built and reviewed 2026-11-07 (no screen, no migration, no package change)

**Files.** New: `lib/gst-return-worksheet.ts` (the pure engine, `buildWorksheet`; it also owns the column lists `WORKSHEET_SALE_COLUMNS` /
`WORKSHEET_NOTE_COLUMNS`), `lib/gst-return-worksheet-read.ts` (server-only reads: `readGstReturnWorksheet(period)` plus the three reads
on their own for Session D), `tests/unit/gst-return-worksheet.test.ts` (40 tests, built fixtures). Changed: `lib/charge-tax-record.ts`
(`toCad` exported, unchanged), `lib/charge-tax-record-server.ts` (the backfill marker below), `docs/agents/db/DATA_DICTIONARY.md` (one
clause on the marker), `docs/agents/accounting/GST_HST_RETURN_LINES.md` §9 + its index row (the /accounting review). `BookkeepingClient.tsx`
not touched.

**Facts relied on.** [V] = opened this session: `StoredTaxLine` and `isCanadianGstHst` (`lib/charge-tax-record.ts:42-57,116`); `toCad`'s
rounding and `cadValuation` (rate dated by `orgDayKey`); 451's columns, the fx all-or-nothing shape and the period indexes; `beforeRegistration`
(`lib/console-money-sales.ts:214`, also treats anything before the floor as outside); `expenseCredit` / `workOutCredit` / `summarizeTaxPaid`
(`lib/bookkeeping-gst.ts`); `selectExpenseRevisions` lives in `lib/bookkeeping-export.ts:54`, NOT the store (the prompt's audit put it there);
`gstRegistrationDate` (`lib/bookkeeping-store.ts:237`); `readAllPages` (`lib/console-money-needs-look.ts:149`); the looks guard
(`tests/unit/console-money-looks.test.ts:357-385`, which now scans the new reader too and passes); Reports totals only confirmed-dated expenses
(`BookkeepingClient.tsx:155`, read only). [H] = handed over: dev's backfill ran with 0 rows.

**The rules, where they live (all in `buildWorksheet`).** Day rule = `orgDayKey` (Stage 3's: the stored rate date, `beforeRegistration` and the
"needs a look" checks use it). The reader reads a day wider each side and the engine decides the edge. Sales: issue day; 101 = the stored
`cad_amount_before_tax_cents`, whole dollars once; 103 = Canadian GST/HST lines × rate, rounded per invoice (residue on the larger line when two
foreign lines share an invoice), grouped by tax, rate and province. Credit notes: own issue day, valued at the invoice's rate (the note's own CAD
columns are not even read). Write-off: day of `uncollectible_at`, GST/HST × (total − pre-payment notes on or before it) ÷ total; any payment
before it means listed, not claimed. Recovery: day of `paid_at` after a write-off, exactly what the write-off relieved. Cap: in time order per
invoice, net of recoveries. 106: 4a's counted credits on the same set Reports totals; the "Not on the return" bridge (paid − simplified −
not registered − before registration − share not claimable − held − not claimed − type not set = 106) is tested to agree with
`summarizeTaxPaid`.

**Before you file (`unresolved`, each with the lines it can still change; empty = information only).** Sales: missing answer, no rate (foreign
sale with null CAD), voided with no note, issued before the registration date, relief capped, relief with no rate, write-off share unknown,
recovery share unknown, note with no invoice record. Expenses: credit held, tax unknown, registration not checked, type not set, dates to review.
**Shared customers** are on the list by construction (the read has no customer filter). Saying "on no club's list" needs
`visibleCustomers` (`lib/console-money-sales-tax-wait.ts:35`, not exported, and that module imports `judgeSales`), so that sentence is
**Session B's call**.

**States.** A: a sales failure → 101, 103, 104, 105, 107, 108, 109 `null` with `sales_unread`, and 106 stands. The reverse (`expenses_unread`,
or `expenses_too_many`) → 106, 108, 109 `null`, and the sales lines stand. An unread registration date → every line `null`
(`registration_unread`): the sales cannot be split without it. B: `nothingSold`. C: `partial` when the return's part of the period (from the
registration day) starts before `salesRecordStart`, or that is unknown.

**"Sales are recorded from…": the backfill did NOT record that it finished, so the smallest honest marker was added.** In
`lib/charge-tax-record-server.ts`, `recordMissing` now also returns `left` (missing documents never started), and the backfill returns
`complete: true` when it started every missing document and none failed. The daily job already writes each step's result onto its
`platform_audit_log` row, so no table or migration was needed. The reader takes the floor (May 1, 2026) once any run said complete; before
that, the day AFTER the first webhook-written record; else unknown. ⚠ This changes what a production job records (additive only). It needs
one run of the daily job on each environment before the worksheet stops reading as partial.

**Owner push-back raised before the build.** (1) The marker above. (2) `listExpenseRevisions` stops at 1,001 rows without saying so. The
worksheet's read refuses past 1,000 (`expenses_too_many`, so 106 reads "Not available") rather than dropping the oldest expenses. The shared
read is unchanged; paging it is a separate fix. (3) Our record does not store how much of a part-paid invoice was paid, so such a write-off is
listed, never estimated.

**/accounting review (2026-11-07, `GST_HST_RETURN_LINES.md` §9): all ten rules confirmed, no engine change.** Recorded as owner or accountant
questions: (a) bad-debt relief needs an arm's-length buyer (true for clubs; never invoice a related person through Stripe); (b) "mark paid out of
band" on an uncollectible invoice reads as a recovery, so use it only when money arrived; (c) the **ITC period date**: 4a dates a credit by its
incurred date, which can fall before the supplier's invoice (a monthly bill dated the 1st). That lands one period early, and only across
December 31 for an annual filer. Recommendation: the form's help says the incurred date of a bill is the supplier's invoice date, and the
accountant confirms; (d) proration credits net into 103 instead of going on 107 (same net tax); (e) **for Session C**: a record that arrives
after a period is filed is not handled one way. Under-reported tax is believed to need an adjustment to the filed return; missed ITCs and
bad-debt relief can go on a later return within four years; a late s.232 note is unresearched. "Changed since you filed" must say which. Research
it at the start of C.

**Checks.** `tests/unit/gst-return-worksheet.test.ts` 40/40. The neighbouring tax and guard suites 302/302 (looks guard, the job guard,
charge-tax-record, sales, needs-a-look, every bookkeeping-gst file, export). `tsc --noEmit` clean. Full `npm test` 2026-11-07: 15,256 / 15,269. The 13 failures
all sit in other sessions' uncommitted work (help-content's tax phrase, practice plans on a phone, the house-league season gate, the portal-tag
and workspace-status censuses, the team move's org_id list, console window feet, billing free time, two walk-page tests). None names a file this
session touched.

**`/review` 2026-11-07 (high-risk tier; three lenses: correctness, data and contract, regression and security). Fixed:**
- **Critical:** the "backfill complete" lookup passed a JS array to postgrest-js `.contains`. That builds a Postgres array literal
  (`cs.{[object Object]}`), which the jsonb column refuses, so EVERY sales read would have failed. It now passes a JSON string
  (`backfillCompleteMarker`, in the engine so it is tested).
- **Medium:** the marker now carries the Stripe mode (`live`, written by the job and matched by the reader), so a test-key run never vouches
  for the live record.
- **Medium:** a recovery of a foreign write-off with no rate silently read 104 = $0. It is now listed.
- **Medium:** "dates to review" listed unconfirmed expenses from other years in every period, so 106 could never be complete. It now lists
  only rows with no incurred date or one inside the period.
- **Low:** a credit note after a write-off, then the payment, added back the whole relief (over-remit). A recovery now adds back the tax
  fraction of what was actually paid (s.231(3)).
- **Low:** the province groups counted tax lines, not invoices.
- **Low:** the readers now refuse a malformed period before reading.
- Tests added for each fix, and for a write-off that is itself capped (45/45). Typecheck clean.

**Recorded, not fixed:**
- One-cent rounding can mark a last foreign credit note "capped" (foreign GST/HST is zero today).
- A part payment before a write-off that was later paid in full is invisible (the record keeps only the final payment).
- "Nothing sold" stays true when only an older invoice's relief lands in the period. The drawn sentence stays right.
- A "complete" backfill counts a document Stripe gives with no customer as done (it records nothing for one, by design).
- **Accounting question:** an invoice both written off AND later voided gets 107 relief while "Voided, no credit note: its tax stays in line
  103" is listed. The two sentences disagree; ask `/accounting` or the accountant before the first such case.
- **For Session B:** the route must call `requirePlatformPower` before `readGstReturnWorksheet` (the read is platform-wide, service role).
- **For Session B:** the registration date reads null both when it is unset and when the store failed.

### Session B: built 2026-11-07 (the view; no migration, no "Mark as filed", no package change). Uncommitted, awaiting the owner.

**Files.** New: `app/platform-admin/bookkeeping/ReportsGstReturn.tsx` (the view, desktop table + phone cards),
`GstReturnWindows.tsx` (the windows), `ReportsGstReturn.module.css`, `app/api/platform-admin/bookkeeping/gst-return/route.ts` (GET),
`lib/gst-return-worksheet-text.ts` (the words: captions, money in words, "Copy lines", the Worksheet CSV rows; Session D's
`gst-hst-worksheet.csv` should take `worksheetCsvRows` as is), `tests/unit/gst-return-view.test.ts` (15 tests). Changed:
`lib/bookkeeping-navigation.ts` (`gst_return` in `REPORT_VIEWS`, label "GST/HST return"), `BookkeepingClient.tsx` (the registry entry),
`lib/gst-return-worksheet.ts` (one additive field, below), `lib/gst-return-worksheet-read.ts` (the registration read, below),
`lib/console-money-sales-tax-wait.ts` (`visibleCustomers` exported, unchanged), `lib/export/catalog.ts` (two entries, the gate asks for
them), `tests/unit/gst-return-worksheet.test.ts` (+1 test).

**Facts relied on.** [V] opened this session: the engine and reader as committed in 17bc1a746; `requireBookkeepingApi`
(`lib/bookkeeping-access.ts:13`, confirmed staff session + owner allowlist) and that `PLATFORM_POWERS` has no Bookkeeping power
(`lib/platform-areas.ts:102-128`); `gstRegistrationDate` returns null before migration 006 or with no revision, throws on a store
failure (`lib/bookkeeping-store.ts:237`), and 006 seeds 2026-09-26 (`scripts/bookkeeping-aws/006_gst_tax_lines.sql:32-35`);
`visibleCustomers` + `customerSharing` (`lib/console-money-sales-tax-wait.ts:35`, `lib/console-money-stripe.ts:166`); the
`KitDialog` size ladder (520 / medium 640 / wide 800; `components/shared/KitDialog.tsx:242-246`); the Money tab opens a sale only by
Stripe **charge** id (`?tab=money&charge=`), with `&show=needs_look` for the list (`ClubRecord.tsx:197-200`), and there is no invoice
parameter. [H] from a helper, then checked by me: the CRA headings below.

**Line captions: checked against CRA's own page, and they differ from the drawings.** Source: "Instructions for preparing a GST/HST
return", canada.ca (`.../calculate-prepare-report/instructions-preparing-return.html`, page details 2021-04-27), opened 2026-11-07
[V]. Its headings, used verbatim: 101 "Total sales and other revenues" (the heading reads "Total sales and other revenues (line
101)"), 103 "GST/HST collected or collectible", 104 "Adjustments to be added to the net tax", 105 "Total GST/HST and adjustments for
the period", 106 **"GST/HST paid or payable (ITCs)"**, 107 "Adjustments to be deducted when determining the net tax", 108 "Total
ITCs and adjustments", 109 "Net tax". CRA's "GST/HST Return Working Copy" PDF prints 105, 108 and 109 as captions with the same
words ("…for period"); the other lines there are prose only [H]. The drawings' "Adjustments that increase / decrease net tax" and the
prompt's "Input tax credits" are not CRA's wording. **UNCONFIRMED: all eight against the filing screen itself** (My Business Account
/ NETFILE) and the GST34 form, which could not be opened (the GST34 page returned 404). These are instruction-page headings, not
the return's field labels. The drawing's plain-language hint follows each caption.

**Session A's three items.**
1. **The gate.** The route calls `requireBookkeepingApi()` and returns on refusal before any read (guard test). The review said
   `requirePlatformPower`, but Bookkeeping holds no power in the table: its gate is the owner allowlist, which is stricter, and every
   Bookkeeping route uses it.
2. **Unset vs failed.** `readWorksheetRegistrationDate` now returns `set` / `unset` / `failed`, and `readGstReturnWorksheet` returns
   `{ worksheet, registration }`. The engine is unchanged and still takes the date or null. The screen says "Your GST/HST registration
   date isn't recorded yet… It is recorded once bookkeeping storage is updated" (unset can only mean 006 is not applied, because 006
   seeds it), or "Your registration date couldn't be read… Try again". A malformed stored date reads as failed.
3. **Shared customers: said.** The route reads Stage 3's own `visibleCustomers` and returns, per invoice in the period, the club
   whose Money tab shows it, or null. A null reads "On no club's list (its Stripe customer is shared)" and has no link, because the
   Money tab refuses a shared customer and a link there would dead-end. The read fails on its own: no links, no sentence, every
   figure stands.

**The one engine change (additive, no rule).** Each `WorksheetCreditItem` carries `notOnReturn`: the cents each bridge step took
off it, written by the same `step()` that adds the step's total. The 106 window's steps filter its list by it, so the screen never
sorts an expense into a step. Test: each step's total equals the sum of its expenses.

**Design calls in this session (flag in the walk).**
- **Invoice links open the club's Money tab, not the one sale.** The tab opens a sale by charge id, and an unpaid invoice has none. A
  sale with no answer opens the tab's "needs a look" list. Opening one invoice there would be a Money-tab change (out of scope).
- **State C's two answers are not built.** "No sales before…" and "Enter them yourself" save an answer to a period, which needs
  storage (this session has no migration). The message shows alone. With the backfill marker it can appear only until the daily job
  has run once on that environment. With no known start it reads "We can't yet tell where the sales record starts".
- **"Before you file" also lists information.** The drawing's box held only what can change a line. The prompt adds the bare void,
  pre-registration invoices and capped relief, so they sit in the same box after "For your information:". The bare void reads
  "Voided, no credit note: its tax stays in line 103".
- **The period.** The page's own period is shared with Spending. "All confirmed dates" is not offered (a return needs dates): while it
  is in force the return reads this year to date without changing it, and a pick here moves the shared period. Presets: this year to
  date, last calendar year, last quarter, last month, this month to date, custom.
- **Windows, from the house ladder** (the drawings' 720 frame is not a house size): the invoice lists are `wide` (800), the rest
  `medium` (640), and a phone fills the screen. Lines 101, 104 and 107 got windows on the drawn 103 pattern. Their figure opens one
  only when something stands behind it, so a $0.00 with nothing behind it opens nothing.
- **Desktop toolbar is two rows.** The View pill keeps its own bar (the view control's pinned structure), and the view's toolbar
  holds Period, Expand all, Copy lines and Worksheet CSV. On a phone this is exactly the drawing: View, then Period + Copy lines.
- **Buyer column privacy:** a club by name; an individual coach as "Coach" (Session D's default).
- **Money in words:** net tax "$209.58 refund" / "$84.10 you owe". Any other line below zero reads "minus $x". "Copy lines" and the CSV
  carry no sign: the word goes beside the figure, or in the Note column.

**Checks.** `tsc --noEmit` clean (needs `NODE_OPTIONS=--max-old-space-size=8192`; the default heap runs out). Focused suites 149/149
(view, worksheet, navigation, looks guard, bookkeeping GST reports, accountant fixes). Full `npm test`: 15,281 / 15,292. The 11
failures name no file this session touched: the console window foot (ExpenseFormWindow), BILLING_TAX_WORDS, the portal-tag and
workspace-status censuses, the team move's org_id, billing free time, practice plans on a phone, the schedule door, two walk pages.
ESLint clean on every touched file. The spelling, export catalog, CSS selector, CSS purity, date and observability gates are clean for
these files. The admin type, old-look and CSS selector gates fail on other sessions' files only.
**LAYOUT: `check:layout --changed` NOT RUN (skipped, honestly).** Three reasons. (1) `--changed` widened to all 352 screens because
another session's uncommitted shared stylesheet (`components/admin/kit/club/league/teams/Teams.module.css`) is in the tree, and a
whole-product sweep never runs on the dev server (owner 2026-10-13). (2) The UAT fixture is unavailable (the free coach's team is linked
to a paid workspace), and its repair is a seed that signs everyone out. (3) **No Bookkeeping screen is on the sweep's list**
(`scripts/layout-screens.mjs`, itself modified by another session), so even a clean run would not measure this view. Owed: add a
Bookkeeping › Reports › GST/HST return screen at desktop and 390 to the list (with an owner session as the fixture) once that file is
free, then run `--changed`. Until then the 390 layout rests on the owner's browser check.
Dev server restarted at hand-off: login page 200, the route answers a signed-out call 403.

**Session B review (`/review`, 2026-11-07, high-risk tier; main-loop read of the route, engine hunks, text module and both components, no finder fan-out).**
Checked and found as built: the route runs `requireBookkeepingApi` and returns on refusal before any read (guard test); the screen and
windows add no tax rule (every figure, part, state and "Before you file" item is the engine's, and the text module only words them);
`notOnReturn` changes no totals (`step()` adds the same cents to the same bucket it always did; the Session B test sums each step's items
back to its total); "Not available" is never `$0` (`lineFigure` returns null, the screen words it); negative money is in words; a bare void
sits under "For your information" and is not on line 107 (107's rows are credit notes and write-offs only); shared customers reuse
`visibleCustomers()` unchanged; the registration date reads `set` / `unset` / `failed` and the two failures are worded apart.
**One defect confirmed and fixed:** the line-106 "Tax type not set" step opened a list that did not match it. The step holds only the
GST/HST-typed tax on an expense that also has an unset line (a pure unset expense adds nothing), but its window listed every type-not-set
expense at its unset amount. Fix: one more additive engine field, `bridgeCents` on the `type_not_set` item (present only when the step took
something off), the window lists only those at that amount; test added (sum and count equal the step). No rule, no totals moved. **This is a
second additive engine field; the first (`notOnReturn`) is above.** Also: the route now logs a 500 (it swallowed the cause).
**Gate:** focused suites 211/211 (worksheet, view, bookkeeping); `tsc` clean when the stale `.next/dev/types` (a half-written file from the
running dev server, 100s of syntax errors that hide every real check) is left out of the project; ESLint clean on the 12 touched code files;
spelling, contrast, date, observability, dictionary, snapshot, CSS purity, public tokens and root-file gates clean. Not ours, left alone:
the full `npm test` still shows 11 failures (BILLING_TAX_WORDS, practice plans on a phone, billing free time, the Stage 6 walk summary, the
coach form, ExpenseFormWindow's foot, the portal-liveness census, the team move, the portal-tag census) and the admin old-look, admin type,
org-slug callers, CSS selector and export-catalog gates fail on other sessions' files. **One of the 11 names a file on this session's list:**
the portal-tag census (`workspace-flip-guard`) flags `lib/console-money-sales-tax-wait.ts` for reading `team_workspaces`. That read is in
`HEAD` (Stage 3, `visibleCustomers`), the one change here is the `export` keyword, so it fails on a clean checkout too; its fix is an
entry on that test's list with a reason, which is the flip owner's call. Layout check still owed (above).

**Session B: committed 035f5e965 2026-11-07** (the 14 files above plus the review fix). Review result is the paragraph above.

### Session C: built and reviewed 2026-11-07 ("Mark as filed"; migration 007). Uncommitted, awaiting the owner.

Prompt: [GST_HST_STAGE4B_SESSION_C_BUILD_PROMPT.md](GST_HST_STAGE4B_SESSION_C_BUILD_PROMPT.md).

**Files.** New: `lib/gst-return-filing.ts` (pure: `freezeSources` / `parseSources` (format v1), `latestFilings`, `filingFor`, `filedCredits`,
`carryContext`, `filingBlock`, `checkFiling`, `linesKey`, `changedSinceFiled`, `filingSummary`), `app/api/platform-admin/bookkeeping/gst-return/filings/route.ts`
(GET list without sources, POST file), `app/platform-admin/bookkeeping/GstReturnFilingQuestion.tsx`, `scripts/bookkeeping-aws/007_gst_return_filings.sql`,
`scripts/bookkeeping-dsql-filings-migration.mjs` (dev host only), `tests/unit/gst-return-filing.test.ts` (33 tests). Changed: `lib/gst-return-worksheet.ts`
(additive, below), `lib/gst-return-worksheet-read.ts` (`readWorksheetFilings`, `filedForEngine`; `readGstReturnWorksheet` also returns `filings`),
`lib/gst-return-worksheet-text.ts` (`FILING`, `refusalWords`, `CHANGE_EFFECT`, `changeSentence`, `filedFigure`, `longDate`; 106's note in Copy lines and the CSV),
`lib/bookkeeping-store.ts` (`hasGstReturnFilingsTable`, `listGstReturnFilings`, `insertGstReturnFiling`; no update or delete),
`app/api/platform-admin/bookkeeping/gst-return/route.ts` (`filing` + `today` in the GET), `ReportsGstReturn.tsx` + `.module.css` (door, state D, FILED tag
and history window, today's figures folded below, 106's earlier-credits sub-line), `GstReturnWindows.tsx` (the 106 window lists earlier credits),
`scripts/bookkeeping-aws/schema.sql`, `docs/agents/db/DATA_DICTIONARY.md` (the 007 paragraph after 006's), `docs/agents/accounting/GST_HST_RETURN_LINES.md`
§10 + index row.

**Facts relied on.** [V] opened this session: the engine, reader, route, view and windows as committed in 035f5e965; `selectExpenseRevisions`,
`currentExpenses`, `expenseCredit` (held = no number and receipt ≥ $100); 006's SQL, runner and `hasGstTaxSchema`; `GstRegistrationQuestion` and the
registration route (the patterns copied); `KitDialog`'s `question` kind; the storage contract test; the drawings' state D (tab 6) and that **ruling 12
chose the option that includes "a late credit moves to your next return's line 106"** (so "Credits from earlier periods" was ruled, not open);
CRA P-149R (June 2026) and ETA s.232(3) re-opened by the main session. [H] from a helper: RC4022 "How do you change a return?", CRA "After you file",
s.169(4), s.225(4), s.231 (quotes in §10). **DSQL probed on the dev cluster 2026-11-07 (throwaway tables dropped, every write rolled back):**
PostgreSQL 16; **3,000 rows per transaction fits, 3,001 is refused (54000)**; DDL and DML in one transaction are refused (0A000); no savepoints;
one 2.1 MB text value fits. ⚠ **The prompt's [H] "Aurora DSQL has no JSON column type" is FALSE on this cluster: a `jsonb` column was created.**
The design keeps text anyway (the app reads it whole and checks its own format version); the one-row choice rests on the row limit, which held.

**`/accounting` at the START (Session A's note (e)), `GST_HST_RETURN_LINES.md` §10.** More ITC after filing → a LATER return's line 106 (CRA generally
refuses an ITC-only amendment, P-149R; four years, s.225(4)). Anything that raises net tax for the filed period (more 101/103/104, less 106/107) →
adjust the filed return in My Business Account. Credit notes, write-offs and recoveries land by their OWN date, so issuing one after filing never moves a
filed period (the engine's existing rule is right). A late-recorded note dated inside the period → accountant (s.232(3)(b) names the issue period;
CRA silent on catching up). A late-recorded write-off → may go on a later return (s.231(1)), NOT carried by the worksheet (the sentence says to add it).

**The design as built.** One table, one append-only row per filing (`filing_no` global PK, so concurrent filings collide and the overlap rule is
race-safe without a lock; `period_revision` per dates; lines as typed bigint columns; `sources` as JSON text, `octet_length` ≤ 1,000,000). One row,
not a child table, because of the 3,000-row transaction limit. Refused: any line Not available; a period not yet ended; filed-on on or before the
period's last day or in the future; overlapping dates unless identical; a stale revision; a missing reason when marking again; **lines the server works
out that differ from the ones the question showed** (`linesKey` fingerprint, compared, never saved). Warned, never blocked: open "Before you file"
items, a partial period (both recorded on the filing). The server recomputes the worksheet and freezes that; the browser's body is read for the period,
the filed-on date, the reason, the revision and the fingerprint only (guard test).

**The engine change (additive).** Optional `filed` input; `parts[106].earlierCredits` + `earlierCents`; line 106 = this period's credits + earlier
credits; `WorksheetCreditItem.savedOn`; `'filings_unread'` (106/108/109 Not available, the sales lines stand). An earlier credit = a counted credit on an
expense incurred in a period filed BEFORE this one, less what every OTHER filing claimed for it; it lands in the one period containing
`landsOn` = the later of the day its current revision was saved and the day of the most recent filing; what a filed return already carried stays with
it (its frozen `landsOn`), whatever is edited afterwards. Test: no filings (absent or empty) = every line, part and item unchanged.

**/review 2026-11-07 (high-risk tier; gate + four Sonnet lenses: correctness/tax, security/data, concurrency/state, regression; High and Medium
adjudicated in the main loop). Fixed:** (High) a later edit of a carried expense moved its landing day, so the return that carried it read a false "no
longer counts / adjust the filed return": carried credits now stay with the return that carried them; (Medium) a credit released without a new revision
(a registration-date change) could land in a period already filed without it: it now lands no earlier than the most recent filing; (Medium) the 106
window's rows did not add up to the line with earlier credits: it now shows this period's subtotal, "Credits from earlier periods" (openable, each
expense listed, in its CSV) and line 106; (Medium) "Copy lines" and the Worksheet CSV now say 106 includes earlier credits; (Medium) the question could
save lines it never showed: the fingerprint refusal; (Medium) a 409 left the screen stale: it re-reads and reopens the question with the reason;
(Low) a key collision now reads "another filing was being saved at the same moment", not "changed"; the size cap is bytes; "changed by $0.00" on a
before-tax-only change reworded; one banner when expenses and filings both fail; today's figures fold resets per period; a ref guard on double submit;
a sentence when filings can't be read (the door is hidden); `aria-haspopup` on the FILED tag. Two guards caught the first draft and were satisfied
properly: `possessive()` for the supplier name, and the credit sum carried out of the engine's loop. **Refuted:** a relief-key collision (one write-off
and one recovery per invoice; every note has an id). **Recorded, not fixed:** filed periods offer no Copy lines / CSV (drawn that way; the as-filed CSV
is Session D's `gst-hst-as-filed.csv`); every worksheet read loads every filing with its sources (fine at a few filings a year; past 1,000 the read
fails and 106 reads Not available); the four-year ITC limit is not enforced on a carried credit; "number added" assumes a held credit was released by
its number; amending a period whose credit was already carried to a later filed return makes both claim it (the later one then reads "no longer
counts"; ask the accountant before such an amendment); after a successful save, focus returns to the page, not the new FILED tag.
**Gate:** `tsc` clean (two errors in another session's `tests/unit/renewals.test.ts` only; `.next/dev` left out, as Session B); ESLint clean on every
touched file; the GST, Bookkeeping, looks, possessive, dues-definition and console foot suites 309/309; spelling and dictionary gates clean.
`verify:changed` fails only on other sessions' files (BILLING_TAX_WORDS in help content, the schedule door, billing ended state, walk pages, the
remove taps, ExpenseFormWindow's foot, workspace status and portal-tag censuses, the team move's org_id list).

**Owed.**
- **Migration 007 applied to development 2026-11-07** (after the owner refreshed the `fieldlogichq` sign-in): inspect, then apply; expense
  revisions 56 → 56, registration revisions 1 → 1, the table present with 21 columns, the app role granted SELECT and INSERT only, 0 filings
  (`.probe/migration-007-{inspect,apply}.log`). **Proved after it, with the app role and every write rolled back** (`.probe/filing-flow-probe.log`,
  `.probe/filing-check-probe.log`): the real worksheet read for Sept 26 to Oct 31, 2026 on dev data (registration set, 0 filings, partial, 20 invoices,
  28 open items); `checkFiling` accepts it as revision 1 and refuses a mismatched fingerprint; the filing row the route builds inserts (6 KB of sources),
  reads back and parses; the comparison against the same worksheet is empty; the table refuses revision 2 with no reason and a filed-on date inside the
  period; the app role is refused UPDATE and DELETE (42501); 0 filings left. **Not proved here:** the signed-in HTTP path (the Bookkeeping gate admits
  only the owner's account, whose password a session does not hold; the guard tests pin the gate and the body). That is the owner walk.
- **Production apply is owed with the code** (record it with the promote; do not run it from here).
- **Owner walk §488 published 2026-11-07** (https://claude.ai/artifact/Bo1sbCpv4HHdtz9EXBAWcn, source `GST_HST_STAGE4B_SESSION_C_WALK.html`;
  32 boxes; it writes one dev expense and two filings of October 2026, which the app cannot remove; part F asks F1-F4). Every step was checked
  against the code before publishing; that check fixed line 109's words in "Changed since you filed" ("refund" / "you owe", not "minus").
- **Owner ruled F3 yes (walk §488, 2026-11-08); built and committed `d6433b20f` 2026-11-08:** the Bookkeeping backup (`scripts/bookkeeping-backup.mjs`) is format 4 with a
  `gst_return_filing` record, verified (columns, revisions in order, counts), restored and replayed by the drill; format 1-3 archives still verify. Contract test
  in `tests/unit/bookkeeping-storage-contract.test.ts`. **Not yet run against a real archive** (a dev `create` / `verify` / `restore-drill-dev` is owed once the
  walk rows are settled). Own commit (automation that runs against production).
- **Walk §488 result 2026-11-08: 27 of 32.** F1 keep, F2 keep, F3 yes, F4 remove after the walk. **Open: dev holds 1 filing of October, not the 2 part D describes;
  C5 not walked.** **Owner closed the walk 2026-11-08.** Part D (and C5) are carried to Session D's first step
  ([prompt](GST_HST_STAGE4B_SESSION_D_BUILD_PROMPT.md)); the dev rows stay until then.
- Layout: Bookkeeping is still not on `scripts/layout-screens.mjs` (another session's open work in that file); `check:layout --changed` not run.
- Session B's carries stand: the captions are unconfirmed against the return screen; the portal-tag census entry is the flip owner's.
