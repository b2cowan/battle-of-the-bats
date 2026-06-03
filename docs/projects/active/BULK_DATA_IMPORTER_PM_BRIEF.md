# PM Brief - Bulk Data Importer

**Created:** 2026-06-02 - **Status:** In progress - **Priority:** Medium-high
**Plan:** [BULK_DATA_IMPORTER_PLAN.md](BULK_DATA_IMPORTER_PLAN.md)

## Proposed Functionality

Add a safe spreadsheet import workflow for high-volume admin tasks, surfaced from a dedicated Tournament Admin > Data Tools page. Admins choose the active tournament, download a FieldLogicHQ workbook, edit it in Excel or Google Sheets, upload it, preview the changes, and confirm before anything is written. Data Tools also shows recent import activity so admins can confirm what was previewed or applied. The team importer now warns when a workbook has extra ignored columns, missing Team IDs, or stale/missing template metadata; the schedule importer now supports current/empty templates, preview, and add/update apply.

The first write-enabled surfaces are tournament teams/registrations and tournament schedule rows. Both are intentionally add/update-only: missing rows in the spreadsheet are not deleted. Replace/wipe behavior is deferred until we have a separate destructive workflow with schedule, slot, notification, and subscription safeguards. Existing page-level import/export controls should act as shortcuts into Data Tools when that is clearer than placing separate buttons on every page.

## Why It Matters

Many organizers already run tournaments and seasons through spreadsheets. FieldLogicHQ exports are now strong, but without imports, customers still have to manually re-enter spreadsheet changes. A safe importer makes the app easier to adopt, faster to set up, and more credible for experienced admins who expect bulk operations.

The key product promise is confidence: the admin sees exactly what will change before committing.

## Expected Customer Impact

- Faster tournament setup when teams or schedules already exist in Excel.
- Less manual re-entry and fewer copy/paste mistakes.
- Easier migration from spreadsheet-based workflows into FieldLogicHQ.
- Less clutter on individual admin pages because bulk workflows have one home.
- Stronger paid-plan value for serious organizers who manage larger events.
- Better supportability because import batches are auditable and visible to admins.
- Clearer spreadsheet troubleshooting because file-level warnings are shown before apply and stored with the preview batch.
- Safer schedule rollout because organizers can preview schedule creates/updates, conflicts, and blocked rows before applying add/update changes.

## Access / Roles

V1 should be limited to authenticated org/tournament admins with the relevant capability. Scoped tournament admins can only import for their assigned tournaments. Coaches, public users, and unauthenticated visitors are unaffected.

Recommended packaging: Tournament Plus for tournament imports, League for house-league imports, and Club for rep/accounting/team imports. This should be confirmed before implementation in case setup imports are intentionally offered on the base Tournament plan.

## Success Criteria

- Uploading a file never changes data until the admin confirms a preview.
- Tournament Admin includes a Data Tools page that centralizes templates, imports, and bulk exports.
- Data Tools shows recent import previews/applies with status, source file, actor, timestamps, and row counts.
- Current-data and empty XLSX templates are available for the first import surface.
- Preview clearly separates creates, updates, unchanged rows, warnings, and blocked rows.
- Preview shows file-level notices for ignored extra columns, missing Team ID, and stale/missing XLSX template metadata.
- Header-only or blank import files are rejected before a preview batch is created.
- Blocked rows prevent commit in V1.
- Team commit is add/update-only; row deletion in a spreadsheet never deletes teams.
- Team commit rechecks normalized money/waitlist values and tournament division membership before applying.
- Replace/wipe is not available until the product has explicit destructive-mode controls.
- Imports enforce org scope, role capability, plan gates, tournament locks, and cross-org protections server-side.
- Tournament team import is live before schedule import.
- Schedule import is available from Data Tools with current/empty XLSX and CSV templates.
- Schedule import blocks scored, finalized, completed, generator-locked, playoff, pool-slot structural, and facility-lane structural changes; venue overlaps block and buffer conflicts warn.
- Schedule apply rechecks live tournament state before writing and remains add/update-only.
- Help docs explain supported files, safe editing, roles/plans, and limitations.
