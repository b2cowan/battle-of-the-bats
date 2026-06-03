# Import Strategy

## Current Decision

Bulk imports should become the safety-first counterpart to the existing export system.

Default direction:

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

- 2026-06-02: Tournament teams import Phase 1 is template + preview only. It includes current/empty XLSX and CSV templates, upload parsing, durable preview batch rows, and the Teams & Registrations import dialog.
- 2026-06-02: `supabase/migrations/106_import_batches.sql` applied to dev and production.
- 2026-06-02: Dev server restarted and platform-admin login health check returned HTTP 200 with no Supabase `EACCES` log entries. Focused registrations-page UAT passed with network access, but import modal browser smoke is still pending because the saved UAT org is on a canceled free tournament plan and redirects to Subscription.
- 2026-06-02: Dev UAT fixture repaired for importer smoke (`uat-test-org` active Tournament Plus plus active smoke tournament/division/team). Import moved into the Teams page export dropdown. Modal now explains current-vs-empty templates, uses consistent XLSX/CSV buttons, and uses a themed file picker. Authenticated browser smoke passed with current CSV template upload and `READY` preview (`1 unchanged`).
- 2026-06-02: Add/update-only commit is implemented for tournament teams. The commit route accepts a persisted preview batch, re-checks auth/plan/tournament status, rejects blocked/expired/already-handled batches, rejects unsupported operations such as delete, blocks stale previews, blocks duplicate creates introduced after preview, and blocks division moves for teams already tied to slots or schedule games. Upload remains preview-first; apply is a separate modal action.
- 2026-06-02: Full modal add/update smoke passed after dev-server restart: generated CSV produced 1 create + 1 update in preview, commit returned HTTP 200, the registrations API reflected the updated coach and new unique team, and browser console error capture was empty.
- 2026-06-02: Tournament Admin > Data Tools is the central bulk-data workspace. It exposes team import templates, add/update team import, registration XLSX/CSV exports, and links to existing schedule/results export pages. The Teams page import affordance now routes to Data Tools instead of opening its own modal.

## Future AI Rules

- Do not build one-off import endpoints that bypass the shared import catalog and preview/commit pattern.
- Treat import as a higher-risk operation than export. Server-side validation, org scoping, role capability checks, plan gates, and audit events are required.
- Upload routes must not commit changes directly.
- Current-data templates should include stable IDs and reference sheets where useful.
- Prefer Data Tools as the product home for future bulk templates/imports/exports. Page-level controls can link there, but avoid scattering duplicate import buttons across admin pages unless the workflow is truly page-specific.
- Name matching is allowed only when unique in the relevant scope and visible in the preview.
- Schedule imports must be especially conservative: no scores in V1, no delete/replace in V1, and no edits to scored/finalized/generator-locked games.
- Help documentation must be updated whenever a new import surface is added.
