# PM Brief - Bulk Data Importer

**Created:** 2026-06-02 - **Status:** In progress - **Priority:** Medium-high
**Plan:** [BULK_DATA_IMPORTER_PLAN.md](BULK_DATA_IMPORTER_PLAN.md)

## Proposed Functionality

Add a safe spreadsheet import workflow for high-volume admin tasks, surfaced from a dedicated Tournament Admin > Data Tools page. Admins choose the active tournament, download a FieldLogicHQ workbook, edit it in Excel or Google Sheets, upload it, preview the changes, and confirm before anything is written.

The first version focuses on tournament teams/registrations. It is intentionally add/update-only: missing teams in the spreadsheet are not deleted. Replace/wipe behavior is deferred until we have a separate destructive workflow with schedule, slot, notification, and subscription safeguards. Tournament schedules come next after the team flow is verified. Existing page-level import/export controls should act as shortcuts into Data Tools when that is clearer than placing separate buttons on every page.

## Why It Matters

Many organizers already run tournaments and seasons through spreadsheets. FieldLogicHQ exports are now strong, but without imports, customers still have to manually re-enter spreadsheet changes. A safe importer makes the app easier to adopt, faster to set up, and more credible for experienced admins who expect bulk operations.

The key product promise is confidence: the admin sees exactly what will change before committing.

## Expected Customer Impact

- Faster tournament setup when teams or schedules already exist in Excel.
- Less manual re-entry and fewer copy/paste mistakes.
- Easier migration from spreadsheet-based workflows into FieldLogicHQ.
- Less clutter on individual admin pages because bulk workflows have one home.
- Stronger paid-plan value for serious organizers who manage larger events.
- Better supportability because import batches are auditable.

## Access / Roles

V1 should be limited to authenticated org/tournament admins with the relevant capability. Scoped tournament admins can only import for their assigned tournaments. Coaches, public users, and unauthenticated visitors are unaffected.

Recommended packaging: Tournament Plus for tournament imports, League for house-league imports, and Club for rep/accounting/team imports. This should be confirmed before implementation in case setup imports are intentionally offered on the base Tournament plan.

## Success Criteria

- Uploading a file never changes data until the admin confirms a preview.
- Tournament Admin includes a Data Tools page that centralizes templates, imports, and bulk exports.
- Current-data and empty XLSX templates are available for the first import surface.
- Preview clearly separates creates, updates, unchanged rows, warnings, and blocked rows.
- Blocked rows prevent commit in V1.
- Team commit is add/update-only; row deletion in a spreadsheet never deletes teams.
- Replace/wipe is not available until the product has explicit destructive-mode controls.
- Imports enforce org scope, role capability, plan gates, tournament locks, and cross-org protections server-side.
- Tournament team import is live before schedule import.
- Schedule import blocks scored, finalized, completed, and generator-locked games.
- Help docs explain supported files, safe editing, roles/plans, and limitations.
