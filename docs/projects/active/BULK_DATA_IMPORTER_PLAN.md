# Bulk Data Importer

**Status:** In progress - Created 2026-06-02; Phase 1 tournament teams template, preview, add/update commit, and Data Tools hub built 2026-06-02
**Owner surfaces:** Tournament admin first; later House League, Rep Teams, Coaches Portal, Accounting
**PM brief:** [BULK_DATA_IMPORTER_PM_BRIEF.md](BULK_DATA_IMPORTER_PM_BRIEF.md)
**Related foundation:** [Export Enhancements](../archive/MERGED_EXPORTS_IMPLEMENTATION_PLAN.md), [Export strategy memory](../../../memory/export-strategy.md)

## Implementation Notes

- 2026-06-02: Added import batch tables, XLSX/CSV parsing helpers, tournament team template download, upload preview API, and Teams & Registrations import dialog. Uploads persist a preview and do not mutate tournament data.
- 2026-06-02: `supabase/migrations/106_import_batches.sql` applied to dev and production.
- 2026-06-02: Dev server restarted with network access; `/platform-admin/login?next=%2Fplatform-admin` returned HTTP 200 and logs showed no Supabase `EACCES` failures.
- 2026-06-02: Focused authenticated registrations-page UAT passed with network access. Import modal smoke could not proceed because the saved UAT org redirects to Subscription due to a canceled free tournament plan.
- 2026-06-02: Repaired dev UAT fixture for `uat-test-org` to active Tournament Plus with an active import smoke tournament, one open division, and one team.
- 2026-06-02: Merged Teams page import into the export dropdown and tightened the import modal copy/density/file picker. Authenticated browser smoke passed: current CSV template returned HTTP 200, uploaded current template preview rendered `READY`, and summary showed `1 unchanged`.
- 2026-06-02: Added add/update-only commit endpoint and modal apply step. Commit reuses persisted server-normalized preview rows, rejects blocked/expired/already-handled batches, rejects unsupported delete-like operations, blocks stale previews, blocks duplicate creates introduced after preview, and blocks division moves for teams already tied to slots or schedule games.
- 2026-06-02: Full add/update browser smoke passed after dev-server restart: modal upload preview returned 1 create + 1 update, commit returned HTTP 200, registrations API showed the updated coach and new team, and console error capture was empty.
- 2026-06-02: Added Tournament Admin > Data Tools as the central bulk-data workspace. Teams page import now routes to Data Tools; Data Tools exposes team templates, add/update import, team registration exports, and links to existing schedule/results export pages.
- Remaining product work: expand validation edge cases from real customer templates, then start schedule import as a separate higher-risk surface.

## Product UX Summary

Admins should be able to bulk update operational data without copying rows one-by-one into forms. The intended workflow is:

1. Open **Tournament Admin > Data Tools**, or use an eligible page action that routes there.
2. Choose the active tournament.
3. Download either a current-data workbook or an empty template.
4. Edit the workbook in Excel or Google Sheets.
5. Upload the file.
6. Review a preview showing creates, updates, unchanged rows, warnings, and blocked rows.
7. Confirm the import only after the preview is clean enough to trust.

The importer should feel like a safety-first companion to exports: exports get data out, imports bring curated changes back in. Uploading a file must never immediately change production data.

## Problem

Admins often prepare tournament teams, divisions, and schedules in spreadsheets before they are ready to manage the event inside FieldLogicHQ. Today they can export data in several places, but there is no round-trip path for bringing edited data back. That forces manual re-entry, creates avoidable mistakes, and makes FieldLogicHQ less attractive for organizers migrating from Excel-heavy workflows.

The danger is that a careless import could silently damage schedules, score history, team assignments, payments, or notifications. The implementation must prioritize preview, validation, auditability, and narrow first surfaces.

## Product Decisions

- **Preferred format:** XLSX first, CSV secondary.
- **Upload behavior:** Upload produces a preview only. Commit requires a separate confirmation action.
- **Template types:** Support both current-data workbooks and empty templates.
- **Matching:** Updates should use stable IDs whenever possible. Name matching is allowed only when the match is unique in the scoped context and the preview marks it clearly.
- **Deletes:** No delete imports in V1. Row deletion in a spreadsheet must not delete records.
- **Notifications:** Off by default. If a future import supports notifications, the confirmation step must make that explicit.
- **Schedules:** Do not import scores/results in V1. Schedule imports affect schedule structure only.
- **Entry point:** Use a central Tournament Admin > Data Tools page for bulk templates, imports, and exports. Page-level import/export menus can link to Data Tools where that is more discoverable, but the central page is the product home for spreadsheet workflows.
- **Commercial packaging:** Treat customer-facing bulk import as a paid productivity feature by default: Tournament Plus for tournament imports, League for house-league imports, Club for rep/accounting/team imports. Revisit before implementation if team/schedule import is needed as a free onboarding accelerator.

## V1 Scope

### P0: Shared Import Foundation

Build the platform pattern before adding multiple surfaces.

- Import catalog parallel to `lib/export/catalog.ts`.
- Server-side XLSX/CSV parsing.
- Schema definitions per import type.
- Preview builder with row-level diffs.
- Commit handler with audit events.
- Template/current-data workbook generation.
- Shared admin import UI shell.
- Help documentation entry for Imports.

### P1: Tournament Teams / Registrations Import

This is the safest and highest-value first surface. Existing team APIs already support create, bulk update, duplicate detection, status changes, payment status changes, slot movement, and waitlist workflows.

Supported V1 operations:

- Create manually entered teams.
- Update existing teams by `team_id`.
- Update division assignment, team name, coach/contact fields, status, payment status, payment amounts, waitlist position, and admin notes where existing business rules allow.
- Import custom registration answers only after the base importer is stable. Treat this as a later extension because field definitions are dynamic.

Blocked in V1:

- Deleting teams.
- Sending email or push notifications by default.
- Bulk importing private uploaded files.
- Overwriting slot assignments unless the preview can prove the destination slot belongs to the same tournament/division and is available.

### P2: Tournament Schedule Import

Add after the team importer proves the workflow. Schedule import has more blast radius.

Supported V1 operations:

- Update existing games by `game_id`.
- Create scheduled games for a selected tournament/division when all referenced teams and venues resolve cleanly.
- Update date, time, home team, away team, venue/facility, location, status, and notes.

Blocked in V1:

- Importing scores.
- Editing completed/finalized/scored games.
- Editing generator-locked games unless the user unlocks them in the app first.
- Deleting games.
- Replacing a whole division schedule. Consider this only after a transaction-backed replace flow exists.

### P3: Supporting Reference Imports

Once teams and schedules are working, add lower-risk reference surfaces:

- Org venues/facilities.
- Tournament divisions.
- House league season teams.

### P4: Club / League Extensions

Future import types:

- House league schedule.
- House league registrations/placements.
- Rep team rosters.
- Rep team tryout registrations.
- Coaches Portal team events.
- Accounting budget plans, only after a separate financial-controls review.

## Proposed File Structure

```text
lib/import/
  catalog.ts
  schema.ts
  types.ts
  csv.ts
  xlsx.ts
  preview.ts
  templates.ts
  validators/
    tournament-teams.ts
    tournament-schedule.ts
  commit/
    tournament-teams.ts
    tournament-schedule.ts

components/admin/
  ImportMenu.tsx
  ImportDialog.tsx
  ImportPreviewTable.tsx

app/api/admin/imports/
  templates/route.ts
  preview/route.ts
  commit/route.ts
```

Keep import type handling catalog-driven rather than creating unrelated one-off endpoints per page. Individual validators and commit handlers should still stay domain-specific.

## Import Catalog

Create `lib/import/catalog.ts` as the source of truth for import availability, plan gates, help docs, and future audits.

```typescript
export interface ImportCatalogEntry {
  id: string;
  label: string;
  module:
    | 'tournaments'
    | 'house_league'
    | 'rep_teams'
    | 'accounting'
    | 'coaches'
    | 'org';
  page: string;
  file: string;
  formats: ('xlsx' | 'csv')[];
  defaultFormat: 'xlsx';
  minPlan?: 'tournament' | 'tournament_plus' | 'league' | 'club';
  moduleGate?: string;
  audiences: ('org_admin' | 'coach' | 'treasurer')[];
  requiredCapabilities: string[];
  operations: ('create' | 'update')[];
  supportsCurrentDataTemplate: boolean;
  supportsEmptyTemplate: boolean;
  supportsDryRun: true;
  riskLevel: 'low' | 'medium' | 'high';
  helpSummary: string;
  omittedReason?: string;
  plannedPhase?: string;
}
```

## Workbook Standard

XLSX templates should use multiple sheets:

- `Instructions` - short guidance, date/time formats, safety notes, and what not to edit.
- `Data` - the rows the user edits.
- `Reference` - divisions, teams, venues, facilities, and allowed status values.

Current-data templates should include stable ID columns. Empty templates should include the same columns with examples.

Recommended column rules:

- Required columns use plain names, not symbols.
- ID columns are visible and clearly labeled "do not edit" in the instructions.
- Use ISO dates (`yyyy-mm-dd`) and 24-hour times (`HH:mm`) for CSV compatibility.
- Allow Excel date cells in XLSX, but normalize them during preview.
- Include `template_version` metadata in the workbook so old templates can be warned or blocked.

CSV should remain available, but XLSX is preferred because it can carry instructions and reference lists without overloading the data rows.

## Preview Contract

The preview response should contain:

```typescript
type ImportPreview = {
  batchId: string;
  importType: string;
  scope: Record<string, string>;
  summary: {
    totalRows: number;
    creates: number;
    updates: number;
    unchanged: number;
    warnings: number;
    blocked: number;
  };
  rows: ImportPreviewRow[];
  canCommit: boolean;
};

type ImportPreviewRow = {
  rowNumber: number;
  operation: 'create' | 'update' | 'unchanged' | 'blocked';
  targetId?: string;
  displayName: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes: Array<{ field: string; before: unknown; after: unknown }>;
  warnings: string[];
  errors: string[];
};
```

Commit should only be allowed when `canCommit` is true, or when the UI explicitly supports committing valid rows while blocked rows are ignored. V1 should prefer all-or-nothing commit for user trust.

## Durable Batches And Audit

Add DB tables in a migration so preview and commit are tied to the same server-normalized data:

- `import_batches`
  - `id`
  - `org_id`
  - `actor_user_id`
  - `import_type`
  - `scope_json`
  - `source_filename`
  - `status` (`previewed`, `committed`, `failed`, `expired`)
  - `summary_json`
  - `created_at`
  - `committed_at`
  - `expires_at`
- `import_batch_rows`
  - `id`
  - `batch_id`
  - `row_number`
  - `operation`
  - `target_id`
  - `raw_json`
  - `normalized_json`
  - `before_json`
  - `after_json`
  - `warnings_json`
  - `errors_json`
  - `status`

Reasons:

- The commit step should not trust a client-resubmitted diff.
- Support can inspect what happened after the fact.
- A failed commit can show exact failed rows.
- Old previews can expire cleanly.

Write a platform event for preview and commit attempts with import type, row count, result, and scope. If org audit log helpers exist for the target surface, use them too.

## Authorization And Safety Rules

Every preview, template, and commit route must enforce:

- Authenticated user.
- Org scope based on visited `orgSlug`.
- Module entitlement.
- Role capability.
- Plan gate.
- Tournament/season/team ownership.
- Scoped tournament assignment rules.
- Tournament completed/locked checks.

V1 tournament teams should reuse:

- `getAuthContextWithScope`
- `scopeGuard`
- `requireTournamentInOrg`
- `hasCapability`
- `hasPlanFeature`
- tournament locked response pattern
- duplicate team detection from `lib/team-registration-duplicates.ts`

V1 tournament schedule should reuse:

- schedule update capability checks
- game delete/replace policy helpers where relevant
- schedule conflict helpers
- tournament lock checks
- scored/finalized game protections

## Validation Rules

### Shared

- Reject unknown required headers.
- Warn on extra headers.
- Reject duplicate stable IDs in the uploaded file.
- Normalize whitespace.
- Normalize enum values case-insensitively, but display canonical values in preview.
- Block rows that reference records outside the current org/scope.
- Block rows with ambiguous name matches.
- Block files over the configured row limit.
- Reject stale templates only when a breaking schema change occurred; otherwise warn.

Recommended V1 row limits:

- Tournament teams: 1,000 rows.
- Tournament schedule: 1,500 rows.
- Reference imports: 500 rows.

### Tournament Teams

- Team name is required for creates.
- Division must resolve to the same tournament.
- Duplicate team names in the same tournament/division should be blocked unless the existing duplicate policy explicitly allows it.
- Payment status values must be valid.
- Payment amounts must be non-negative.
- Waitlist position must be a positive integer or blank.
- Slot changes must be guarded and probably deferred until V2.

### Tournament Schedule

- Game date is required.
- Time is required for non-all-day games.
- Home and away teams must be different.
- Teams must belong to the selected tournament and, where applicable, division.
- Venue/facility must belong to the org/tournament venue library.
- Existing scored/completed/finalized games are blocked.
- Generator-locked games are blocked.
- Venue overlap should block or warn according to the existing conflict policy.
- Cancelled games can be imported as status changes, but importing cancellation should be explicit in preview.

## UI Plan

### Import Entry Point

Expose bulk workflows from Tournament Admin > Data Tools in the Admin nav. The page should use compact operational cards, not a marketing landing page. Eligible page-level actions may route to Data Tools so users do not have to hunt for spreadsheet controls on every table.

### Import Dialog Steps

1. **Template**
   - Download current data workbook.
   - Download empty template.
   - Show supported format and row limit.
2. **Upload**
   - Drag/drop or file picker.
   - Accept `.xlsx` and `.csv`.
   - Show selected file name and size.
3. **Preview**
   - Summary counts.
   - Filter chips: All, Creates, Updates, Warnings, Blocked.
   - Row diff table.
   - Blocking errors clearly separated from warnings.
4. **Confirm**
   - Final confirmation with row counts.
   - Notification checkbox only if supported, default off.
   - Commit button disabled when blocked rows exist in V1.
5. **Result**
   - Success summary.
   - Failed row details if applicable.
   - Link back to the refreshed table.

## Implementation Phases

### Phase A: Planning And Foundation

- Create import catalog.
- Define import types and schema primitives.
- Add parser utilities for XLSX and CSV.
- Add durable import batch tables.
- Add shared preview/commit types.
- Add unit tests for parser/schema behavior.

### Phase B: Template Generation

- Generate current-data and empty XLSX templates for tournament teams.
- Generate CSV fallback templates.
- Add template API route with org/tournament scope checks.
- Add help text for file format and safe editing.

### Phase C: Tournament Teams Preview

- Implement tournament teams validator.
- Resolve divisions, existing teams, statuses, payments, and duplicate checks.
- Produce preview rows with before/after diffs.
- Persist batch and rows.
- Add API tests for authorization and wrong-org references.

### Phase D: Tournament Teams Commit

- Commit only server-normalized preview rows.
- Reuse existing team creation/update business rules where practical.
- Keep notifications off by default.
- Record audit/platform events.
- Refresh page data after success.

### Phase E: Shared Import UI

- Add `ImportMenu`, `ImportDialog`, and preview table components.
- Add Tournament Admin > Data Tools as the central hub for templates/imports/exports.
- Route tournament Teams / Registrations import actions to Data Tools.
- Add empty/loading/error states.
- Add help docs.

### Phase F: Tournament Schedule Preview

- Generate current-data and empty schedule templates.
- Implement schedule validator.
- Enforce locked/scored/generator-locked protections.
- Add conflict warnings/blocks.

### Phase G: Tournament Schedule Commit

- Commit row-level schedule creates/updates only.
- Do not implement replace/delete yet.
- Add focused tests for dangerous schedule cases.

### Phase H: Import Catalog And Help Expansion

- Add planned catalog entries for house league, rep teams, coaches, accounting, and org reference data.
- Update help docs to show what imports exist, what is planned, and which plan/role can use them.

## Testing Plan

- Unit tests for CSV parser behavior, XLSX date/time normalization, enum normalization, required headers, duplicate IDs, and row limits.
- Unit tests for tournament team preview classification: create, update, unchanged, warning, blocked.
- Unit tests for schedule safety: scored game blocked, generator-locked game blocked, ambiguous team name blocked, cross-org reference blocked.
- API tests for unauthenticated, wrong org, insufficient capability, insufficient plan, scoped tournament user, and locked tournament.
- Manual browser verification by the user per repo rule:
  - Download current-data workbook.
  - Edit one row and upload.
  - Confirm preview diff.
  - Commit.
  - Verify page refresh.
  - Try a blocked row and confirm commit is disabled.

## Open Decisions

- Should tournament team/schedule imports be Tournament Plus-only, or should initial setup imports be free to improve onboarding?
- Should commit be strict all-or-nothing in V1, or allow "commit valid rows only" after a second confirmation?
- Should schedule import support division-level replace in V2, and if so should it require a Postgres transaction/RPC?
- Should successful imports create downloadable result files for support/audit handoff?

## Out Of Scope For V1

- Delete imports.
- Score/result imports.
- File upload field imports.
- Accounting ledger transaction imports.
- Subscribable/importable external feeds.
- Cross-org import migration tools.
- Background jobs for very large files.
- Rollback UI. Audit history is required; rollback is future work.
