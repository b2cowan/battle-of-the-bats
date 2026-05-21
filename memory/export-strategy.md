# Export Strategy

## Current decision

Exports should become a consistent product capability instead of scattered CSV-only buttons.

Planned direction:

- Default table exports to Excel `.xlsx`.
- Keep CSV as the secondary compatibility option.
- Add `.ics` calendar exports for schedule surfaces where families, coaches, officials, or admins need calendar import/subscription.
- Add PDF report exports after an org-level PDF settings surface exists for logos, headers, footers, generated timestamps, page numbers, report density, and privacy toggles.
- Document export availability in help content and use exports as a plan-aware value add in pricing and public module pages.

Canonical planning docs:

- `MERGED_EXPORTS_IMPLEMENTATION_PLAN.md`
- `MERGED_EXPORTS_PM_BRIEF.md`
- Earlier source context is retained in `EXPORT_ENHANCEMENTS_PLAN.md`, `EXPORTS_IMPLEMENTATION_PLAN.md`, and `EXPORTS_PM_BRIEF.md`.

## Future AI rules

Future feature work should treat export coverage as part of finishing any data-heavy page.

- If a page has a durable operational table, it should usually offer Excel `.xlsx` as the default export and CSV as a secondary option.
- If a page has games, practices, events, assignments, due dates, or other meaningful date/time items, it should usually be evaluated for `.ics` calendar export.
- If a page represents a handoff artifact, board report, coach packet, check-in sheet, roster sheet, insurance document, field-ops sheet, parent statement, accounting report, or post-event summary, it should usually be evaluated for PDF export.
- If an export is intentionally omitted, document the reason in the export catalog or implementation plan. Valid reasons include privacy risk, transient data, low customer value, incomplete feature scope, or data that is not durable enough yet.
- Do not add a one-off export button style. Use or extend the shared export menu/catalog pattern once implemented.
- Help documentation must be updated when adding or changing export availability.

## Existing export inventory

Current CSV exports and the merged roadmap are documented in `MERGED_EXPORTS_IMPLEMENTATION_PLAN.md`.

Source planning docs retained for history:

- `EXPORT_ENHANCEMENTS_PLAN.md`
- `EXPORTS_IMPLEMENTATION_PLAN.md`
- `EXPORTS_PM_BRIEF.md`

- Legacy tournament registrations, schedule, and results under `app/admin/*`.
- Org-scoped tournament registrations, schedule, and results under `app/[orgSlug]/admin/tournaments/*`.
- Tournament Plus registration exports now have a server-side CSV foundation under `app/api/admin/tournaments/[tournamentId]/registrations/export/route.ts`; treat this as an interim Phase 3 surface to migrate into the shared `ExportMenu`/catalog system with `.xlsx` default and CSV secondary.
- Accounting ledger detail under `app/[orgSlug]/admin/accounting/ledger/[ledgerId]/page.tsx`.
- Platform admin early-access leads under `app/api/platform-admin/early-access/export/route.ts`.

## Standard offering principle

Every durable operational table should have an explicit export decision. Default expectation:

- Tables: `.xlsx` primary, CSV secondary.
- Schedules/events/date-time lists: evaluate `.ics`.
- Formal handoff/reporting outputs: evaluate PDF.
- If export is intentionally omitted, record the reason in the export catalog/help plan so customers do not experience inconsistent coverage without explanation.

## Shared UX expectations

- Use one consistent `Export` control across admin, coaches, and platform-admin surfaces.
- Default action should be Excel `.xlsx`; CSV should remain available for compatibility.
- Schedule/event pages can expose `Calendar (.ics)` in the export menu or as a nearby `Add to Calendar` action.
- PDF should appear only when the page has a real report/print use case and the PDF settings/template foundation exists.
- Export filenames should be stable and readable, generally `{org-or-tournament}-{dataset}-{scope}-{yyyy-mm-dd}.{ext}`.
- Exports should respect the visible filter/tab/division/team by default. For paginated or server-filtered data, make the export scope explicit.

## Privacy and role rules

- Export access must follow the underlying data access model: tournament admins export tournament data, league admins/registrars export league registration data where permitted, treasurers export accounting, coaches export only assigned team data, and platform admins export internal pipeline/reporting data.
- Server-side export routes must enforce org, role/capability, module entitlement, and plan gates. UI gating alone is not enough.
- Sensitive fields such as guardian contact details, player/medical notes, internal notes, and financial details should be excluded by default unless the role, format, and export label clearly justify inclusion.
- If internal notes are included, prefer a clearly named option such as `Excel with internal notes`.

## Help documentation rules

Any export implementation should include or update help content that explains:

- Where the export is available.
- Supported formats: Excel `.xlsx`, CSV, `.ics`, PDF.
- Which filters, tabs, divisions, teams, seasons, or server-side result sets are included.
- Which roles and plans can export.
- Whether sensitive fields are included.
- When to use each format.
- For `.ics`, how to import into common calendar apps.
- For PDF, how headers, footers, logos, page numbers, timestamps, orientation, branding, and privacy toggles work.

## Plan notes

- Tournament Plus and above should receive richer tournament export value.
- League and Club should receive house league exports and schedule calendar export.
- Club should receive accounting, rep team, and coach/team export/reporting value.
- Public/internal platform-admin exports are not customer-plan-gated but still require platform-admin authorization.
