# Merged Exports PM Brief

## Proposed Functionality

FieldLogicHQ should treat exports as a standardized platform capability, not as scattered page-specific utilities. Any durable operational table, schedule, roster, ledger, registration list, standings view, or report-style data set must have an explicit export decision:

- Include the standard `ExportMenu`, or
- Document why export is not appropriate in the export catalog with `omittedReason`.

The default export experience is:

- Excel `.xlsx` as the primary action.
- CSV as the always-available secondary format.
- Calendar `.ics` for schedules, games, practices, assignments, or other date/time records.
- Branded PDF for print-ready or external handoff documents.
- Help documentation that clearly explains where exports are available, what each format is for, what filters are included, who can export, and which plan unlocks each format.

## Why It Matters

Sports organizations routinely move data out of the platform for insurance submissions, check-in sheets, field-ops schedules, coach packets, roster handoffs, AGM reports, parent communications, accounting review, and calendar imports.

The goal is to prevent the frustrating customer question: "Why can I export this table but not that one?" A missing export should be intentional, documented, and explainable. If a page has a filterable table of records, especially one with five or more columns or data meant to leave the platform, export coverage becomes part of the definition of done.

## Expected Customer Impact

- All tiers get cleaner operational data out of the platform, with Excel replacing CSV as the default spreadsheet handoff.
- Tournament Plus gets visible, polished export value: registration check-in sheets, field-ops schedules, insurance documents, and results summaries.
- League gets registration, team, schedule, standings, and calendar exports for season operations.
- Club gets roster PDFs, dues summaries, accounting reports, budget-vs-actual reports, and team calendar exports.
- Coaches and families can import schedule data into calendar apps where appropriate.
- Help docs reduce support questions by making export availability, formats, filters, privacy behavior, and plan requirements explicit.

## Standard Offering Principle

Exports should be part of the standard data-page pattern:

- Qualifying admin tables must use `ExportMenu` unless there is a documented `omittedReason`.
- `.xlsx` is the primary download; CSV is never removed.
- Date/time data should include `.ics` where the export has real calendar value.
- PDF should be offered when the output is likely to be printed, emailed, submitted externally, or used as a report.
- Exports should respect current filters by default. For server-side pagination, the UI should distinguish current view from all matching records.
- Filenames should follow a consistent pattern such as `{org-or-tournament}-{dataset}-{scope}-{yyyy-mm-dd}.{ext}`.
- Server-side export routes must enforce org, role/capability, module entitlement, and plan gates. UI gating alone is not enough.

## Privacy And Sensitive Data

Sensitive fields should not quietly leak through exports.

- Guardian contact details, player medical notes, player notes, internal admin notes, and financial details should be marked as sensitive where appropriate.
- Sensitive fields are excluded from standard exports by default unless the export name, requesting role, and use case clearly justify inclusion.
- If sensitive data is available, it should use an explicit option such as `Excel with contact details` or `Excel with internal notes`.
- Any sensitive data included by default must be justified in the export catalog.
- A future sensitive-export audit log should track exports that include guardian contacts or internal notes.

## Plan Direction

The plan mapping should reinforce product value without blocking basic logistical workflows:

- Free Tournament: schedule and results exports in Excel/CSV; tournament schedule `.ics` where useful.
- Tournament Plus: registration exports, branded PDFs, PDF template settings, and richer tournament reporting.
- League: house league registrations, teams, schedules, standings, and `.ics` schedule exports.
- Club: rep teams, coaches portal, accounting, roster PDFs, dues summaries, budget reports, and team calendar exports.
- Platform Admin: internal exports for orgs, users, audit logs, metrics, and early-access leads; not customer-plan-gated but platform-admin protected.

## First Delivery Targets

The implementation plan starts with reusable infrastructure, then migrates existing export surfaces:

- Shared export catalog and `ExportMenu`.
- Shared `.xlsx`, CSV, `.ics`, and PDF utilities.
- Migration of existing CSV exports to `.xlsx` default and CSV secondary.
- Normalization of the accounting ledger export, which currently uses inline Blob logic.
- `.ics` support for tournament schedule first, especially public/admin schedule downloads.
- PDF settings page with logo, header, footer, orientation, density, branding, generated date, page numbers, and privacy controls.
- First three PDF export surfaces: tournament registrations, tournament schedule, and tournament results.

## Help Documentation Requirements

Help coverage is part of the feature, not a cleanup task.

The help system should include a dedicated "Exports & Downloads" article covering:

- What Excel `.xlsx`, CSV, `.ics`, and PDF are for.
- A cross-module availability table.
- Which filters, tabs, divisions, teams, seasons, or server-side result sets are included.
- Which roles and plans can export.
- Which exports include sensitive fields.
- How to customize PDF headers, logos, footers, page numbers, date stamps, orientation, branding, and privacy settings.
- How to import `.ics` files into Google Calendar, Apple Calendar, and Outlook.
- Troubleshooting for missing records, disabled PDF options, Excel Protected View, and empty data.

Each relevant module help page should cross-link to the exports guide.

## Public Positioning

Pricing and marketing surfaces should show exports as concrete operational value:

- Replace "CSV export" language with "Excel, CSV, and PDF exports" where accurate.
- Add a pricing comparison category for data exports.
- Update Tournament Plus copy to call out check-in sheets, insurance documents, field-ops handouts, and post-event summaries.
- Update module pages for house league, rep teams, accounting, and tournaments to mention the export formats relevant to each module.

## Deferred Items

These are intentionally out of V1 scope but should remain visible:

- Subscribable calendar URLs with signed tokens, revocation, caching, and privacy review.
- Multi-sheet operational workbooks, such as one tournament workbook with registrations, schedule, and results tabs.
- Per-export PDF orientation overrides beyond org-level defaults and schedule-specific landscape handling.
- Sensitive export audit logs for exports that include guardian contacts or internal notes.

## Priority

Medium-high. The `.xlsx` migration and shared export standard are relatively low-effort and high-value. PDF infrastructure is the largest investment but creates the clearest paid-plan differentiator. `.ics` is technically smaller and has strong adoption value for coaches, families, and staff.

## Success Criteria

1. Existing export buttons produce `.xlsx` by default, with CSV available as secondary.
2. Qualifying admin tables either use `ExportMenu` or document an `omittedReason` in the export catalog.
3. Tournament schedule pages have working `.ics` downloads.
4. A PDF settings page exists with logo, header, footer, orientation, density, branding, page number, generated date, and privacy controls.
5. Tournament registrations, schedule, and results have PDF exports.
6. A dedicated "Exports & Downloads" help article exists and is cross-linked from relevant module help pages.
7. Pricing and public module pages accurately reflect export capabilities by plan.
