/**
 * lib/export/index.ts
 * Barrel re-export for the shared export layer.
 *
 * Import from '@/lib/export' in page files.
 */

export type { ExportColumnDef } from './table';
export { buildFilename, serializeRows, serializeHeaders } from './table';

export { generateCSV, downloadCSVBlob } from './csv';

export { downloadXLSX } from './xlsx';

export type { ICSEventInput } from './ics';
export { downloadICS } from './ics';

export type { OrgPdfSettings, LineupPosterOptions, LineupPosterPlayer, DevelopmentSummaryOptions } from './pdf';
export { DEFAULT_PDF_SETTINGS, downloadPDF, downloadLineupPoster, downloadBattingOrderCard, buildPositionLegend, downloadDevelopmentSummary } from './pdf';

export type { ExportCatalogEntry } from './catalog';
export {
  EXPORT_CATALOG,
  getCatalogEntry,
  getLiveExports,
  getExportsByModule,
} from './catalog';
