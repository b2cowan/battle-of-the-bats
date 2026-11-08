# GST/HST · Stage 4b Session D: the accountant package, wording, records (build prompt for ONE session, Sonnet)

> Written 2026-11-08, after the Session C owner walk §488 was closed by the owner (27 of 32; F1-F4 ruled). Recommended model: Sonnet (files and wording; the engine and the freeze are built).
> Parent prompt (read its **Rulings**, **Design calls**, and the **Progress** records for A, B and C before anything else): [GST_HST_STAGE4B_BUILD_PROMPT.md](GST_HST_STAGE4B_BUILD_PROMPT.md); the Session D scope is its section "Session D" (line ~85). PM brief: [GST_HST_STAGE4B_PM_BRIEF.md](GST_HST_STAGE4B_PM_BRIEF.md) (update it, do not write a second one).
> Tax rules: `docs/agents/accounting/GST_HST_RETURN_LINES.md`. Record every fact you rely on as [V] (opened this session) or [H] (handed over). A helper's summary is a lead, not evidence.
> Hard rule: this changes what we hand an accountant for the CRA. `/accounting` runs **before hand-off**; apply what it finds or record it as an owner question.

## Step 1, before any Session D code: the part D question from walk §488

The owner closed walk §488 but **part D was ticked and dev does not agree.** Read back 2026-11-08 with the admin login: `bookkeeping.gst_return_filings` holds **1** row for 2026-10-01..2026-10-31 (filing_no 1, period_revision 1, filed_on 2026-11-07, line_106_cents 0, saved 03:13Z), where D3 says there should be **2** (the second ending with the reason "Walk: amended with the supplier's number", October's 106 now including the $13.00). The expense has its 2 revisions (the number was added 12:02Z 2026-11-08), so C1 worked. **C5 (Copy lines on November) was never checked.**

1. Find out whether "Mark as filed again" with a reason really saves. Read `app/api/platform-admin/bookkeeping/gst-return/filings/route.ts`, `checkFiling` in `lib/gst-return-filing.ts` and `insertGstReturnFiling` in `lib/bookkeeping-store.ts` against the case: a period already filed as revision 1, then an expense changes, then marked again with a reason. The earlier proofs inserted revision 1 only and showed the table refusing revision 2 with no reason; **revision 2 with a reason through the real route was never proved.** Suspects to test, not assume: the shown-lines fingerprint after a change (`figures_changed`), the expected revision, a 409 the screen reads as success.
2. Prove it with the app role on dev, every write rolled back (the pattern is in `.probe/filing-flow-probe.log` / `.probe/filing-check-probe.log`; probes live in `.probe/`). If it is a real defect, fix it, add a unit test for the second filing, and tell the owner before going on: it is a Session C defect found late, not a Session D feature.
3. If it works, say so and say the owner's D ticks were not backed by the store; ask the owner to re-walk D3 and C5 with the Network tab open.
4. **Then, and only then, the owner's F4 ruling: remove the walk's dev rows** (the filings of October 2026 and the "Walk test supplier" expense and its tax lines) with the dev admin login. A probe that inspects first, deletes in one transaction, and re-counts. Dev only (`BOOKKEEPING_DSQL_ENDPOINT` must be the dev host); the app role cannot delete, by design. `.probe/walk488-cleanup.mjs` is the inspect/delete probe from the walk (`inspect` or `delete`); it expects exactly 2 filings, so adjust its guard to what is there.
5. With the passphrase set by the owner (`BOOKKEEPING_BACKUP_PASSPHRASE`), run a dev backup `create`, `verify` and `restore-drill-dev` (format 4 is committed `d6433b20f` and has never run against a real archive). Report the counts the drill prints.

## ⚠ The invoice file already exists (Plans & pricing Part 4 Session 2, built 2026-11-08, committed `5fe7ad3c7`)

The accountant package's ONE invoice file is built: **`invoices-and-credit-notes.csv`** (`INVOICE_FILE_NAME`, `INVOICE_FILE_HEADER`,
`invoiceFileRows` in `lib/sales-by-month.ts`; `readInvoiceFile` in `lib/sales-by-month-read.ts`; written by
`app/api/platform-admin/bookkeeping/package/route.ts`). One row per invoice issued, paid, voided or written off in the package's dates
("Listed for" says which) and one per credit note issued in them, with: invoice and credit note numbers, issue day, kind, buyer (the
club's name, "Coach" for an individual, "A club no longer on file"), province taxed, GST/HST treatment, status, currency, before tax,
tax (all kinds), total, GST/HST, GST/HST rate, Bank of Canada rate and its date, before tax (CAD), GST/HST (CAD), paid / voided /
written-off days, written off (before tax), before GST/HST registration, refunded with no credit note. Its GST/HST is valued by the
engine's own rules (`saleGstHst`, `noteRate`, `noteGstHst`). **So this session does NOT write `gst-hst-sales.csv`**: reuse this file
and add nothing that repeats it. Its privacy default differs from this prompt's draft (an individual appears as "Coach", not by
invoice number only): that is /legal's Recommendation 3 (STAFF_CROSS_CLUB_BILLING_LISTS.md) and the owner's ruling as handed to
Part 4. `package-scope.txt` already says "Bank statements, payouts and bank reconciliation are not in this package; sales and credit
notes are. Stripe's fees to us are included only as the monthly expenses entered from Stripe's statement (expenses.csv)." plus a line
describing the file; the draft sentence below ("Sales are included only as the GST/HST record…") is superseded. The package is
refused (503) when the sales cannot be read (an owner question in walk §493). The worksheet, credits and as-filed files remain this
session's.

## What this session ships

The accountant package (the Bookkeeping export the owner hands to an accountant, in-year and the yearly in-Canada copy) gains the GST/HST files:

- `gst-hst-worksheet.csv`: lines 101-109 for the chosen period, the same figures as the Reports view, including "Not available" with its reason (never a zero).
- `gst-hst-sales.csv`: each invoice and credit note with its Canadian-dollar figures and rate.
- `gst-hst-credits.csv`: each expense's credit and its state (counted, held, released, carried to a later return).
- `gst-hst-as-filed.csv`: **a filed period only**: the figures as filed and the sources as filed (the Session C freeze), with the filing number, revision, filed-on date and reason. (Session C ruled F2: a filed period has no Copy lines / Worksheet CSV in its toolbar; the as-filed CSV belongs here, in the package.)
- Reword `package-scope.txt`: "Bank statements, processor fees, payouts and bank reconciliation are not in this package. Sales are included only as the GST/HST record of each invoice and credit note."
- **Privacy default:** a buyer appears as the invoice number plus the buyer kind and the **club name**; an **individual coach appears by invoice number only**. (`/legal` glance only if the owner wants names.)

Not in this session: any change to the return screen, the freeze, the engine, the Overview, the Money tab, or any club or coach screen. Platform-admin only, so `/docs` is skipped unless a Bookkeeping help article exists (check).

## Coordination with Plans & Pricing Stage 2 Part 4 Session 2 (it overlaps this session; do not run both at once)

[PLANS_PRICING_STAGE2_PART4_BUILD_PROMPT.md](PLANS_PRICING_STAGE2_PART4_BUILD_PROMPT.md) "Session 2" (Parts 4d, 4e) edits the same files as this session (the package route and `package-scope.txt`, `lib/export/catalog.ts`, `BookkeepingClient.tsx`, `ReportsGstReturn.tsx`, `lib/gst-return-worksheet-read.ts`) and plans its own `sales.csv` and `credit-notes.csv` for the same package. **Whichever lands first writes the sales files; the other reuses them.** Before writing, run `git status` and read that prompt's current text: if its Session 2 is built or holds those files modified, stop and tell the owner rather than writing a second `gst-hst-sales.csv`. Its `package-scope.txt` wording differs from this prompt's; the owner picks one.

## Say this first (disagree by default)

1. **Where the package is built is decided by the code, not by this prompt.** [H] The package lives under the Bookkeeping export; find the real module (`grep` for `package-scope`), read how the existing CSVs are produced and whether the worksheet read (`readGstReturnWorksheet`) can be called from it without a second pass over every sale. If a CSV would recompute the worksheet differently from the screen, that is a defect to stop on, not to paper over.
2. **A CSV the owner emails is a record.** Every figure must be the engine's, in cents turned to dollars the way the screen does it; no re-derivation in the export. Spreadsheet-injection (cells starting `=`, `+`, `-`, `@`) must be handled the way the existing exports do it.
3. Push back on anything above the code contradicts.

## Scope

1. The PM UX summary in the conversation first (blocking, per AGENCY_RULES), written for a product manager.
2. Step 1 above.
3. The four files, the reworded scope note, both package paths (in-year and the yearly in-Canada copy), wording in `lib/gst-return-worksheet-text.ts`, **one spelling everywhere** (the clock is "8:00 a.m."; "fiscal year" is club-side only; `npm run check:spelling`).
4. Tests: each file's header row and one fixture row; the as-filed file only for a filed period and absent otherwise; the coach privacy default; a "Not available" line stays blank-with-reason, never 0; the existing package tests still pass.
5. **`/accounting`** review of the package and the final wording **before hand-off**; apply or record as an owner question. Open owner/accounting questions are in the parent prompt ("Open owner / accounting questions"); do not close them here.
6. **`/review`** after the build; offer `/simplify` if the CSV writers duplicate logic.
7. **Records:** a Progress entry in the parent prompt (with the commit hash after the owner says commit), the Bookkeeping ladder row, the plan's Stage 4 line, one TODO line (stage only your hunk: other sessions have uncommitted TODO edits), the PM brief, and an owner walk (a checkable Artifact, one purpose per walk, paste-back; write the walk's file list so the owner can open the real files, and include the re-walk of D3 and C5 if step 1 asked for it).

## Still owed (carry, do not attempt unless free)

- Session C's code is **uncommitted** in the shared working tree (the filings route, `lib/gst-return-filing.ts`, `GstReturnFilingQuestion.tsx`, migration 007 and its runner, tests). Do not stage them; the owner commits Session C on their word. If this session needs to read them, read them as they are.
- **Production apply of migration 007 is owed with the code**: record it with the promote, do not run it from here.
- The layout check never ran for the return view (Bookkeeping is not on `scripts/layout-screens.mjs`); the captions are unconfirmed against the CRA return screen; the portal-tag census fails on `lib/console-money-sales-tax-wait.ts` (the workspace-flip owner's entry). None is this session's.
- If `npm run typecheck` fails inside `.next/dev/types`, that is a half-written dev-server file hiding every real check: typecheck with that folder excluded and say so.

## Rules of the room

Branch `dev` only. Commit nothing until the owner says; stage explicit pathspecs and read `git diff` on every shared file first. Do not change hooks, settings or database checks unasked. The dictionary is updated in the same unit of work as any schema change (none expected). Restart the dev server before hand-off if files were added. The owner does the browser testing.
