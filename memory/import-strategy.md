# Import Strategy

## Current Decision

Bulk imports are the safety-first counterpart to the existing export system.

Current rules:

- Prefer XLSX workbooks for imports, with CSV as a secondary compatibility option.
- Support both current-data workbooks and empty templates.
- Uploading a file creates a preview only; users must explicitly confirm before data changes.
- Match updates by stable IDs wherever possible.
- Do not support delete imports in V1.
- Keep notifications off by default.
- Start with tournament teams/registrations, then tournament schedules.

Canonical planning docs:

- `docs/projects/active/BULK_DATA_IMPORTER_PLAN.md`
- `docs/projects/active/BULK_DATA_IMPORTER_PM_BRIEF.md`

## Current Implementation Status

- 2026-06-02: Tournament teams import Phase 1 initially shipped as a preview-first foundation. It included current/empty XLSX and CSV templates, upload parsing, durable preview batch rows, and the Teams & Registrations import dialog.
- 2026-06-02: `supabase/migrations/106_import_batches.sql` applied to dev and production.
- 2026-06-02: Dev server restarted and platform-admin login health check returned HTTP 200 with no Supabase `EACCES` log entries. Focused registrations-page UAT passed with network access, but import modal browser smoke is still pending because the saved UAT org is on a canceled free tournament plan and redirects to Subscription.
- 2026-06-02: Dev UAT fixture repaired for importer smoke (`uat-test-org` active Tournament Plus plus active smoke tournament/division/team). Import moved into the Teams page export dropdown. Modal now explains current-vs-empty templates, uses consistent XLSX/CSV buttons, and uses a themed file picker. Authenticated browser smoke passed with current CSV template upload and `READY` preview (`1 unchanged`).
- 2026-06-02: Add/update-only commit is implemented for tournament teams. The commit route accepts a persisted preview batch, re-checks auth/plan/tournament status, rejects blocked/expired/already-handled batches, rejects unsupported operations such as delete, blocks stale previews, blocks duplicate creates introduced after preview, and blocks division moves for teams already tied to slots or schedule games. Upload remains preview-first; apply is a separate modal action.
- 2026-06-02: Full modal add/update smoke passed after dev-server restart: generated CSV produced 1 create + 1 update in preview, commit returned HTTP 200, the registrations API reflected the updated coach and new unique team, and browser console error capture was empty.
- 2026-06-02: Tournament Admin > Data Tools is the central bulk-data workspace. It exposes team import templates, add/update team import, registration XLSX/CSV exports, and links to existing schedule/results export pages. The Teams page import affordance now routes to Data Tools instead of opening its own modal.
- 2026-06-02: Data Tools now includes read-only Recent Imports for team imports, sourced from `import_batches.summary_json` and scoped through the same importer auth path. It shows preview/applied/failed/expired status, file name, actor email, timestamps, and row counts.
- 2026-06-02: Team importer hardening added XLSX template version metadata, preview notices for ignored extra columns/missing Team ID/stale workbook metadata, empty-file/batch guards, persisted preview notices in batch summaries, and commit-time rechecks for normalized money/waitlist values plus current tournament division membership.
- 2026-06-03: Tournament schedule import is now add/update-enabled in Data Tools. It includes current/empty XLSX and CSV templates, schedule preview/apply upload persistence, generic Recent Imports history across teams and schedules, file-level template notices, unique name matching warnings, venue overlap blocks, buffer warnings, and blocks for submitted/completed/scored/generator-locked/playoff rows plus pool-slot/facility-lane structural changes. Apply rechecks live state before writing and remains add/update-only.
- 2026-06-03: Targeted UAT route-hardening smoke added for schedule imports. It verifies unauthenticated denial, completed-tournament preview/apply denial, actor mismatch, importer mismatch, tournament-scope mismatch, already-handled and expired previews, and blocked-row commit denial.
- 2026-06-04: Data Tools now has a safe-import guidance strip with a direct tournament Help link. Tournament Help explains current vs empty templates, XLSX vs CSV, warnings vs blocked rows, add/update-only behavior, completed-tournament locks, and importer FAQs.
- 2026-06-04: Targeted UAT route-hardening parity smoke added for team imports. It verifies unauthenticated denial, completed-tournament preview/apply denial, actor mismatch, importer mismatch, tournament-scope mismatch, already-handled and expired previews, blocked-row commit denial, stale preview denial, duplicate team introduced after preview, deleted division after preview, and scheduled-team division-move denial.
- 2026-06-04: Focused importer validation unit pack added for parser, team preview, and schedule preview edge cases. It covers blank/quoted CSV behavior, duplicate normalized headers, row limits, alias/reordered columns, Excel-style money and decimal time values, invalid preview values, ambiguous name matching, and file-level notices.
- 2026-06-04: Paywall pass confirmed `bulk_data_imports` gates team import, schedule import, and import history at the API layer, while `registration_export` gates registration exports. Data Tools now gives base-plan admins a Tournament Plus upgrade path instead of only disabled buttons.
- 2026-06-04: Combined Data Tools UAT smoke passed for template downloads, team create/update import apply, schedule create/update import apply, Recent Imports, and base-plan upgrade messaging. The smoke found and fixed blank team payment amounts committing as null; commit payloads now coerce blank imported payment amounts to zero before writing `teams`.
- 2026-06-04: Bulk Data Importer V1 is considered release-ready for tournament teams and schedules. Future replace/wipe behavior, reference imports, and league/club import surfaces should be treated as follow-up work, not launch blockers.

## Future AI Rules

- Do not build one-off import endpoints that bypass the shared import catalog and preview/commit pattern.
- Treat import as a higher-risk operation than export. Server-side validation, org scoping, role capability checks, plan gates, and audit events are required.
- Upload routes must not commit changes directly.
- Current-data templates should include stable IDs and reference sheets where useful.
- Prefer Data Tools as the product home for future bulk templates/imports/exports. Page-level controls can link there, but avoid scattering duplicate import buttons across admin pages unless the workflow is truly page-specific.
- Name matching is allowed only when unique in the relevant scope and visible in the preview.
- Schedule imports must be especially conservative: no scores in V1, no delete/replace in V1, and no edits to scored/finalized/generator-locked games.
- Help documentation must be updated whenever a new import surface is added.
- Do not treat destructive replace/wipe workflows, supporting reference imports, or league/club import surfaces as V1 blockers.
