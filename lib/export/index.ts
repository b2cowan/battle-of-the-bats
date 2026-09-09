/**
 * lib/export/index.ts
 * Barrel re-export for the shared export layer.
 *
 * Import from '@/lib/export' in page files.
 */

export type { ExportColumnDef } from './table';
export { buildFilename, serializeRows, serializeHeaders } from './table';

export { generateCSV, downloadCSVBlob } from './csv';

export type { XlsxRowStyle } from './xlsx';
export { downloadXLSX } from './xlsx';
export type { XlsxNote, XlsxMasthead, XlsxFooterMark } from './xlsx';
export { loadBrandMark, BRAND_MARK_SRC } from './brand-mark';

export type { ICSEventInput } from './ics';
export { downloadICS } from './ics';

export type { OrgPdfSettings, ReportShape, LineupPosterOptions, LineupPosterPlayer, DevelopmentSummaryOptions, PracticeSheetOptions, PracticeSheetBlock, PracticeSheetRotation, TryoutBoardSummaryOptions, FamilyDuesStatementRender, FamilyDuesStatementsOptions } from './pdf';
export { BRANDING_TEXT, DEFAULT_PDF_SETTINGS, downloadPDF, fetchResolvedPdfSettings, abbreviateHeadings, downloadLineupPoster, downloadBattingOrderCard, buildPositionLegend, downloadDevelopmentSummary, downloadPracticeSheet, downloadTryoutBoardSummary, downloadFamilyDuesStatements } from './pdf';


// The two roster documents' column lists (Rosters pass) — imported by the roster page
// AND by the renderer contract test, so the wall copy's privacy promise is machine-checked.
export { ROSTER_WALL_HEADERS, ROSTER_PRIVATE_HEADINGS, rosterContactHeaders } from './roster-columns';
export type { ExportCatalogEntry } from './catalog';
export {
  EXPORT_CATALOG,
  getCatalogEntry,
  getLiveExports,
  getExportsByModule,
} from './catalog';
