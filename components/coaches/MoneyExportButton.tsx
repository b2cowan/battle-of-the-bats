'use client';
import { useParams } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { downloadMoneyExport, type MoneyDownload, type MoneyExportFormat } from '@/lib/coach-money-exports';
import { fetchResolvedPdfSettings, type OrgPdfSettings } from '@/lib/export';
import CoachExportButton, { type CoachExportChoice } from './CoachExportButton';

/**
 * The Money hub's Export control — one per tab, sitting in that tab's own control row.
 *
 * ⚠ SINCE 2026-08-23 THIS IS A THIN WRAPPER over `CoachExportButton`, which is now the portal's
 * one export control (house rule 2). Everything about how the control LOOKS and BEHAVES — the
 * trigger, the tap floor, the icon-only phone label, the phone file rule, the Save-As dialog, the
 * busy/error path — lives there and is shared with Roster and Schedule. What survives here is the
 * part that is genuinely about MONEY: the format vocabulary, the shape of a money download, and
 * the team-resolved PDF branding fetch.
 *
 * The seven Money tabs' props are unchanged, deliberately — this rewrite moved no call site.
 */
export default function MoneyExportButton({
  /** What is being exported, in the coach's words — titles the dialog ("Export Player dues"). */
  label,
  /** What THIS view can produce, most-wanted first. PDF is dropped automatically when un-planned. */
  formats,
  /**
   * Built at CLICK TIME from what is on screen — never earlier, or a coach who changed view after
   * the tab loaded would get the file they were looking at ten minutes ago. The tab supplies its
   * own team and season names too: it has them, and they land in the filename and a PDF's title.
   *
   * ⚠ IT IS HANDED THE FORMAT, because one view legitimately produces a different DOCUMENT on
   * paper than in a spreadsheet: the month grid is a spreadsheet shape and its PDF is the
   * whole-season statement instead (owner ruling 2026-08-21). A caller that uses the argument
   * owes the coach `pdfHint` below — the swap must be readable before they pick, never a
   * surprise in the downloads folder.
   */
  build,
  /** Overrides the PDF row's hint in the file-type dialog. Required when `build` varies by format. */
  pdfHint,
  /**
   * A DIFFERENT DOCUMENT this view can also produce on paper — offered in the same dialog, under
   * the file types, so the tab keeps its ONE Export control (owner ruling 2026-08-13) while the
   * dialog stays the honest place to say what each choice is. First caller: the Dues tab's
   * per-family statements beside its team sheet. PDF-only by nature, so it is plan-gated and
   * phone-kept exactly like the pdf row.
   */
  secondaryPdf,
  /**
   * What this view's OWN document is called in the picker, when `secondaryPdf` gives the dialog a
   * second one to choose between — "Team sheet" beside "Family statements". Falls back to the
   * dialog's label, which reads fine for a view whose document has no shorter name of its own.
   * Unused when there is no second document: one document gets no picker.
   */
  primaryDocument,
  disabled = false,
  className,
}: {
  label: string;
  formats: MoneyExportFormat[];
  build: (format: MoneyExportFormat) => Omit<MoneyDownload, 'orgLabel' | 'pdfSettings'>;
  pdfHint?: string;
  secondaryPdf?: {
    /** In the coach's words, and now the name of a DOCUMENT — "Family statements". */
    label: string;
    run: (pdfSettings: OrgPdfSettings | null) => Promise<void>;
  };
  primaryDocument?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { currentOrg } = useOrg();

  /**
   * Team-resolved PDF branding (D4: team look → club look → defaults), fetched AT EXPORT TIME —
   * never on mount (one of these buttons sits on every Money tab and they all stay mounted once
   * visited), and deliberately uncached: those tabs live for a whole session, and a remembered
   * copy would keep printing a look the coach has since changed in "How your documents look". An
   * export is a click; one small GET is nothing. The button always lives under /teams/[teamId], so
   * the route params carry the team.
   */
  const { teamId } = useParams<{ teamId: string }>();
  async function loadPdfSettings(): Promise<OrgPdfSettings | null> {
    if (!currentOrg || !teamId) return null;
    // Branding is a nicety — a failed fetch resolves null and the document falls back to the
    // shared defaults rather than being denied.
    return fetchResolvedPdfSettings(`/api/coaches/${currentOrg.slug}/teams/${teamId}/pdf-settings`);
  }

  const choices: CoachExportChoice[] = formats.map(f => ({
    id: f,
    name: FORMATS[f].label,
    ext: FORMATS[f].ext,
    /* ⚠ THE ONLY HINT LEFT IN THIS DIALOG, and it is not an explanation — it is a warning. A view
       whose PDF is a DIFFERENT document says so before the coach picks: the Months view's PDF is
       the whole-season statement, because a month grid does not fit paper (owner ruling
       2026-08-21). Everything else says its name and its extension and nothing more. */
    hint: (f === 'pdf' && pdfHint) || undefined,
    /* One document per view, unless the view offers a second one below — then both are named so
       the dialog can put a picker on top instead of a sentence in the middle. */
    document: secondaryPdf ? (primaryDocument ?? label) : undefined,
    phone: f === 'pdf' ? 'keep' : 'drop',
    feature: f === 'pdf' ? 'pdf_exports' : undefined,
    run: async () => {
      await downloadMoneyExport(f, {
        ...build(f),
        orgLabel: currentOrg?.slug ?? '',
        pdfSettings: f === 'pdf' ? await loadPdfSettings() : null,
      });
    },
  }));

  if (secondaryPdf) {
    choices.push({
      id: 'secondary',
      /* The DOCUMENT carries this view's second name; the row itself is just its file type. */
      document: secondaryPdf.label,
      name: 'PDF',
      ext: '.pdf',
      phone: 'keep',
      feature: 'pdf_exports',
      run: async () => { await secondaryPdf.run(await loadPdfSettings()); },
    });
  }

  return (
    <CoachExportButton
      label={label}
      choices={choices}
      disabled={disabled}
      className={className}
    />
  );
}

/**
 * What each file type is called.
 *
 * ⚠ THE SENTENCES ARE GONE (owner ruling 2026-08-24). Each row used to introduce itself — "Best
 * for working with the numbers", "Plain text — opens in any spreadsheet" — on the theory that the
 * dialog is the only place a coach is asked to choose. Three rows of that is a paragraph in a box
 * whose whole job is to be quick, and nobody picks Excel for a reason the sentence would change.
 * What survives is per-VIEW and only where the file is not what the row implies: `pdfHint`.
 */
const FORMATS: Record<MoneyExportFormat, { label: string; ext: string }> = {
  xlsx: { label: 'Excel', ext: '.xlsx' },
  csv:  { label: 'CSV',   ext: '.csv' },
  pdf:  { label: 'PDF',   ext: '.pdf' },
};
