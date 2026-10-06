'use client';
/**
 * THE CLUB'S MONEY REPORTS' EXPORT (Club Tier Stage 3b, session 2): the admin's one Export button
 * (`ExportMenu` — Excel first, no chevron; owner 2026-10-01), writing its files through the coach's own
 * money download (`downloadMoneyExport`), so a club report's file carries what a coach's does — the
 * masthead naming the report and the day its figures were true, bold bands and folding item rows in
 * Excel, and the report's own notes under the table (owner ruling 2026-09-05: a caveat travels with the
 * figures it explains). The caller builds the file from the screen's own rows; nothing is re-added here.
 *
 * On a phone the formats join Tools (hub specimen 1: "Export joins Tools on a phone, so the top line is
 * Year, View and two 44px icons") — `useClubMoneyFile` is the one runner both shapes call.
 *
 * The club's document settings (logo, colours) are read only when a PDF is asked for.
 */
import { useCallback } from 'react';
import ExportMenu from '@/components/admin/ExportMenu';
import { fetchResolvedPdfSettings } from '@/lib/export';
import { downloadMoneyExport, type MoneyDownload, type MoneyExportFormat } from '@/lib/coach-money-exports';

export type ClubMoneyFile = Omit<MoneyDownload, 'orgLabel' | 'pdfSettings'>;

/** Make and hand over one file. A failure is said in words (`onFailed`), never thrown at the screen. */
export function useClubMoneyFile(q: string, orgSlug: string, build: (format: MoneyExportFormat) => ClubMoneyFile, onFailed?: (text: string) => void) {
  return useCallback(async (format: MoneyExportFormat) => {
    try {
      const spec = build(format);
      const pdfSettings = format === 'pdf'
        // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
        ? await fetchResolvedPdfSettings(`/api/admin/org/pdf-settings?${q}&resolve=1`)
        : null;
      await downloadMoneyExport(format, { ...spec, orgLabel: orgSlug, pdfSettings });
    } catch (e) {
      onFailed?.(e instanceof Error && e.message ? e.message : 'The file couldn’t be made. Please try again.');
    }
  }, [q, orgSlug, build, onFailed]);
}

export default function ClubMoneyExport({ run, formats, disabled = false, holds, pdfHint }: {
  /** `useClubMoneyFile`'s runner. */
  run: (format: MoneyExportFormat) => Promise<void>;
  formats: MoneyExportFormat[];
  disabled?: boolean;
  /** What the file holds, said on the menu before it runs. */
  holds?: { title: string; lines: string[] };
  /** What the PDF holds when it is not the shape on screen (Months: the PDF is the year's statement). */
  pdfHint?: string;
}) {
  return (
    <ExportMenu
      formats={formats}
      label="Export"
      disabled={disabled}
      holds={holds}
      pdfHint={pdfHint}
      onExportXLSX={() => run('xlsx')}
      onExportCSV={() => run('csv')}
      onExportPDF={formats.includes('pdf') ? () => run('pdf') : undefined}
    />
  );
}
