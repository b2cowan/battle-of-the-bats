# GST/HST · Stage 4b Session C: "Mark as filed" (build prompt for ONE session, Opus)

> Written 2026-11-07, after Session B was reviewed and committed (`035f5e965`; record `daba91b8b`). Recommended model: Opus (the freeze is the part of 4b that cannot be quietly wrong).
> Parent prompt (read its **Rulings**, **Design calls** and the **Progress** records for A and B before anything else): [GST_HST_STAGE4B_BUILD_PROMPT.md](GST_HST_STAGE4B_BUILD_PROMPT.md). PM brief: [GST_HST_STAGE4B_PM_BRIEF.md](GST_HST_STAGE4B_PM_BRIEF.md) (update it, do not write a second one).
> Approved drawings: https://claude.ai/artifact/LbCjjVcnZeTP8uUT3yVZan (source `GST_HST_STAGE4_DRAWINGS.html`): tab 6 draws **state D** ("FILED APRIL 20, 2028", "Figures as you filed them", "Changed since you filed"). **The "Mark as filed…" question itself is not drawn.**
> Tax rules: `docs/agents/accounting/GST_HST_RETURN_LINES.md`. Record every fact you rely on as [V] (opened this session) or [H] (handed over).
> Hard rule: this changes what we report to the CRA. `/accounting` runs **before hand-off**; apply what it finds or record it as an owner question.

## What this session ships

The owner opens Bookkeeping › Reports › GST/HST return for a period, reads the worksheet, and chooses **"Mark as filed…"**. A short question (the lines are shown, the filed-on date defaults to today and can be changed) freezes that period's figures and the invoices, credit notes and expenses behind them. From then on the period reads **FILED** with **"Figures as you filed them"**, and a **"Changed since you filed"** area says what moved since (a held credit whose number was added later, a sale that gained its GST/HST answer, a new credit note). Nothing is filed from here and **nothing tax-related ever reaches the Overview**.

Not in this session: the accountant package files (Session D), any change to the Money tab, any club or coach screen.

## Facts carried from Sessions A and B [V 2026-11-07]

- The engine is `buildWorksheet` (`lib/gst-return-worksheet.ts`, pure). The reads are `readGstReturnWorksheet(period)` (`lib/gst-return-worksheet-read.ts`), which returns `{ worksheet, registration }`; the route is `app/api/platform-admin/bookkeeping/gst-return/route.ts` (GET, `requireBookkeepingApi()` first, no other gate exists for Bookkeeping). The view is `ReportsGstReturn.tsx` and its windows `GstReturnWindows.tsx`; the words are `lib/gst-return-worksheet-text.ts` (`worksheetCsvRows`, `copyLinesText`, line captions).
- A `Worksheet` carries `lines` (cents or null = Not available, plus `partial`, `calculated`, `complete`), `parts` (the invoices, credit notes, bad debts, credits and the 106 bridge), `unresolved` ("Before you file") and `failures`. The invoice and credit items already carry their ids and CAD amounts.
- Bookkeeping's store is **Aurora DSQL** (`bookkeeping.*`, `lib/bookkeeping-store.ts`), not Supabase. The pattern to copy is **006** (`scripts/bookkeeping-aws/006_gst_tax_lines.sql`, runner `scripts/bookkeeping-dsql-gst-migration.mjs`, **dev host only**, inspect then apply then re-count): `gst_registration_revisions` is append-only (`REVOKE ALL FROM PUBLIC; GRANT SELECT, INSERT TO bookkeeping_app`), revision numbers, a required reason, `created_by`. Its question is `GstRegistrationQuestion.tsx` (the house reason question, built on `BookkeepingQuestion`/`DialogReason`) and its route `gst-registration/route.ts`. The next migration number is **007**.
- `hasGstTaxSchema()` (`lib/bookkeeping-store.ts:91`) is the "storage is updated" probe. Before a migration reaches an environment the app must still read everything and refuse the new write with the storage-update message, not crash. Do the same for 007.
- The dictionary entry for the Bookkeeping store is prose in `docs/agents/db/DATA_DICTIONARY.md` (the 006 paragraph), outside the Supabase snapshot and coverage check. Do what 4a did for 006.

## Say this first (disagree by default)

1. **Session A's note (e) is an open tax question that decides what "Changed since you filed" means.** A record that arrives after a period is filed is not handled one way: under-reported tax is believed to need an adjustment to the filed return, while missed ITCs and bad-debt relief can go on a later return within four years, and a late s.232 credit note is unresearched. **Run `/accounting` on this at the START**, not the end, and let the answer decide the wording and the "Credits from earlier periods" rule below. If it cannot be settled, build the neutral wording ("Changed since you filed") and record the rest as an owner/accountant question.
2. **"Credits from earlier periods" on the next return's line 106 is a change to the engine's rules, not the screen's.** Today a credit lands by its incurred date. A held credit released after its period was filed would otherwise vanish from every return (the filed one is frozen, the next one does not reach back). It needs the filings as an input to `buildWorksheet`. This is the one place the engine may legitimately grow; keep it additive, keep every existing total unchanged, and test that. Decide with the owner whether it is built now or recorded (see Design calls).
3. **A freeze needs somewhere to put hundreds of source rows, and DSQL is not Postgres.** [H] Aurora DSQL has no JSON column type, limits rows modified per transaction, and runs DDL apart from DML. Verify each against the cluster before choosing between one table with a text column and a filings table plus a child sources table. Probe it; do not assume.
4. Push back on anything above that the code contradicts.

## Design calls this prompt makes (flag in the walk; the owner can overrule)

- **Mark as filed is refused while any line is "Not available"** (nothing can be frozen from an unknown). **It warns, never blocks, on "Before you file" items and on a partial period**: the question shows the count and the freeze records that it was filed with them open. (Compare the coaches rule "unsettled money warns, never blocks".)
- **A filed period cannot be edited or deleted.** Filing again appends a new revision with a required reason (an amended return); the latest shows and the history stays. **Overlapping periods are rejected unless identical** (same from and to = a new revision).
- **The freeze stores the lines as filed and the sources as filed** (every invoice, credit note and expense revision with its amounts), plus who, when, the filed-on date and the registration date in force. The sources let state D answer "what changed" without trusting today's data.
- **The question is the house 416px reason question as in Void**, with the lines shown. The reason is required only when a period is marked again.
- **State D is the same screen with a FILED banner**, "Figures as you filed them" as the primary figures, and a quiet "Changed since you filed" area below, collapsed unless something changed. A period is "filed" when a filing covers exactly its dates; any other period shows its live worksheet with a note if it overlaps a filed one.
- **The live figures never disappear.** The owner can still see today's worksheet for a filed period beside the frozen one; only the frozen one is labelled as filed.
- **No effect on any other screen.** Not the Overview, not the Money tab, not the Today list.

## Scope

1. **Research first** (`/accounting`, see above). Then the PM UX summary in the conversation (blocking, per AGENCY_RULES), written for a product manager, before any code.
2. **Migration 007** (`scripts/bookkeeping-aws/007_gst_return_filings.sql` plus a dev-host-only runner like 006's): the append-only filings table(s). App role SELECT and INSERT only. Apply to **development**, record counts before and after. **Production apply is owed with the code: record it, do not run it.**
3. **Store and engine reads**: `listGstReturnFilings`, `insertGstReturnFiling` (in `lib/bookkeeping-store.ts`, guarded by a schema-ready probe), a pure `changedSinceFiled(filed, live)` that diffs a frozen filing against a current worksheet (lines and sources), and (if built now) the additive "Credits from earlier periods" input to the engine.
4. **Route**: POST to file (behind `requireBookkeepingApi()`, validates the period against the live worksheet it reads itself, **never trusting figures sent by the browser**: the server recomputes the worksheet and freezes that), GET to list. Extend the existing gst-return GET to say which filing covers the period.
5. **UI**: the "Mark as filed…" door (desktop toolbar and phone), the question, state D, "Changed since you filed". Words go in `lib/gst-return-worksheet-text.ts`. House window sizes, the one-spelling rule (the clock is "8:00 a.m."; "fiscal year" is club-side only) and the layout rules apply.
6. **Tests**: freeze then recompute with a later change reads "Changed"; overlapping rejected, identical accepted as a new revision; Not available refuses; a browser-sent figure is ignored; append-only (no update/delete in the store module, a guard like the one for the registration table); the gate runs before any read; unchanged totals when the filings input is empty.
7. **Dictionary** in the same unit of work. **`/accounting`** before hand-off. **`/review`** and (if the engine and package would now duplicate logic) **`/simplify`**. **`/docs`** is skipped unless a Bookkeeping help article exists (check).
8. **Records**: a Progress entry in the parent prompt (with the commit hash after the owner says commit), the Bookkeeping ladder row, the plan's Stage 4 line, one TODO line (stage only your hunk: other sessions have uncommitted TODO edits), and an owner walk (a checkable Artifact, one purpose per walk).

## Still owed from Session B (carry, do not attempt unless the file is free)

- The desktop and 390 **layout check never ran** for the return view: Bookkeeping is not on `scripts/layout-screens.mjs`, and that list was in another session's open work. Add Bookkeeping › Reports › GST/HST return at desktop and 390 (an owner session as the fixture) if the file is free, then run `check:layout --changed`. Otherwise record it again.
- The line captions are CRA's instruction-page headings, **not** checked against the return screen or the GST34 form. Unconfirmed.
- The portal-tag census (`workspace-flip-guard`) fails on `lib/console-money-sales-tax-wait.ts`, and has since Stage 3. It is the workspace-flip owner's entry to add. Not this session's.
- Typecheck: if `npm run typecheck` fails inside `.next/dev/types`, that is a half-written dev-server file hiding every real check. Typecheck with that folder excluded and say so.

## Rules of the room

Branch `dev` only. Commit nothing until the owner says; stage explicit pathspecs, and read `git diff` on every shared file first (`lib/export/catalog.ts`, `BookkeepingClient.tsx`, the parent prompt). Do not change hooks, settings or database checks. A migration updates the dictionary in the same unit of work. A helper's summary is a lead, not evidence: open the lines before building on them. Restart the dev server before handing off for browser testing (new files and a store change).
