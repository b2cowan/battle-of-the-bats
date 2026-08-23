'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Download, X } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasPlanFeature } from '@/lib/plan-features';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { downloadMoneyExport, type MoneyDownload, type MoneyExportFormat } from '@/lib/coach-money-exports';
import { fetchResolvedPdfSettings, type OrgPdfSettings } from '@/lib/export';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './MoneyExportButton.module.css';

/**
 * The ONE Export control in the Money hub — one per tab, sitting in that tab's own control row.
 *
 * ⚠ IT LIVES ON THE TAB, NOT IN THE HUB HEADER, and that is a decision with history (owner ruling
 * 2026-08-13, mockup artifact 96675523). A single hub-wide Export menu was built first and could
 * not survive the screens: Budget vs. Actual has two shapes and four readings, Budget Plan has
 * two, Expenses has three sub-tabs and a tag filter. A menu above the tab bar can see none of it,
 * so it offered a generic version and hoped — which is how Budget vs. Actual ended up with two
 * buttons both labelled "Export" producing different files.
 *
 * IMPORT stayed in the header, because it genuinely is hub-wide: what you bring in does not depend
 * on anything you have arranged on screen. Export always does. **The test for any future door: if
 * the answer changes with what the coach is looking at, it belongs beside what they are looking
 * at.**
 *
 * The caller passes the rows it already has on screen. This component owns everything that must
 * not be re-decided per tab: PDF plan-gating, the phone rule, the file-type dialog, and the one
 * download path.
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
   */
  build,
  disabled = false,
  className,
}: {
  label: string;
  formats: MoneyExportFormat[];
  build: () => Omit<MoneyDownload, 'orgLabel' | 'pdfSettings'>;
  disabled?: boolean;
  className?: string;
}) {
  const { currentOrg } = useOrg();
  const canUsePdf = currentOrg ? hasPlanFeature(currentOrg.planId, 'pdf_exports') : false;

  // PDF resolves to ABSENT, not locked, on a plan without it — nothing to offer beats a button
  // that refuses.
  const available = formats.filter(f => f !== 'pdf' || canUsePdf);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<MoneyExportFormat | null>(null);
  const [error, setError] = useState('');

  /**
   * ⚠ CLOSE THE DIALOG WHENEVER THE URL MOVES — this is not tidiness, it prevents a portal-wide
   * lock-up (/review finding, 2026-08-13).
   *
   * Money tabs stay MOUNTED once visited (`display:none` while inactive), so a dialog left open
   * on a tab the coach navigates away from stays mounted too — invisible, but still registered
   * in the portal's shared overlay counter. That counter is what pins `body { overflow: hidden }`
   * and hides the bottom nav, and it lives at the coaches-LAYOUT level, so it survives the tab
   * change. The result would be a coach unable to scroll anywhere in the portal, with nothing on
   * screen explaining why, until they found their way back to that tab or reloaded.
   *
   * The backdrop swallows ordinary clicks, so the reachable route is the BROWSER'S BACK BUTTON
   * (or an Android/iOS back gesture) — which changes `?section=` without touching the dialog.
   * Watching the search params catches every such navigation.
   */
  const closeDialog = useCallback(() => setOpen(false), []);
  const searchParams = useSearchParams();
  const navKey = searchParams.toString();
  useEffect(() => { closeDialog(); }, [navKey, closeDialog]);

  /**
   * Team-resolved PDF branding (D4: team look → club look → defaults), fetched AT EXPORT
   * TIME — never on mount (one of these buttons sits on every Money tab and they all stay
   * mounted once visited), and deliberately uncached: those tabs live for a whole session,
   * and a remembered copy would keep printing a look the coach has since changed in
   * "How your documents look". An export is a click; one small GET is nothing. The button
   * always lives under /teams/[teamId], so the route params carry the team.
   */
  const { teamId } = useParams<{ teamId: string }>();
  async function loadPdfSettings(): Promise<OrgPdfSettings | null> {
    if (!currentOrg || !teamId) return null;
    // Branding is a nicety — a failed fetch resolves null and the document falls back to
    // the shared defaults rather than being denied.
    return fetchResolvedPdfSettings(`/api/coaches/${currentOrg.slug}/teams/${teamId}/pdf-settings`);
  }

  if (available.length === 0) return null;

  async function run(format: MoneyExportFormat) {
    setBusy(format);
    setError('');
    try {
      await downloadMoneyExport(format, {
        ...build(),
        orgLabel: currentOrg?.slug ?? '',
        pdfSettings: format === 'pdf' ? await loadPdfSettings() : null,
      });
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'That export could not be built.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {/* ⚠ `data-phone` carries the phone rule (2026-08-13 decision 4, restated once Export moved
          off the header): a phone is offered an export only where the file is something a coach
          can READ, SHOW or SEND. A spreadsheet lands in a downloads folder nobody opens on a
          phone; a PDF dues statement is held up to a parent. Enforced in CSS rather than by
          measuring the viewport in JS, which would differ between the server and the browser on
          first paint. */}
      <button
        type="button"
        className={`${shared.btnSecondary} ${styles.trigger}${className ? ` ${className}` : ''}`}
        data-phone={available.includes('pdf') ? 'keep' : 'drop'}
        disabled={disabled}
        onClick={() => { setError(''); setOpen(true); }}
        /* Icon-only on phones like every toolbar secondary (`.headerBtnLabel`, page-header
           ruling mechanism) — this trigger sits on all seven Money tabs, so the label rule
           lives here once rather than per caller. */
        aria-label="Export"
      >
        <Download size={14} aria-hidden /> <span className={shared.headerBtnLabel}>Export</span>
      </button>

      {open && (
        <ExportFormatDialog
          label={label}
          formats={available}
          busy={busy}
          error={error}
          onPick={f => { void run(f); }}
          // Stable, so the dialog's Escape listener is attached once rather than torn down and
          // re-added on every re-render of the panel this button lives in.
          onClose={closeDialog}
        />
      )}
    </>
  );
}

/**
 * How each file type introduces itself. Every one says what it is FOR, because this dialog is the
 * only place a coach is asked to choose and "CSV" alone means nothing to most of them.
 */
const FORMATS: Record<MoneyExportFormat, { label: string; hint: string; ext: string }> = {
  xlsx: { label: 'Excel', hint: 'Best for working with the numbers', ext: '.xlsx' },
  csv:  { label: 'CSV',   hint: 'Plain text — opens in any spreadsheet', ext: '.csv' },
  pdf:  { label: 'PDF',   hint: 'A printable document you can share', ext: '.pdf' },
};

/**
 * "Choose a file type" — the Save As dialog, which is where picking a format belongs.
 *
 * ⚠ TWO IN-MENU ATTEMPTS FAILED BEFORE THIS (owner, 2026-08-13): format chips on every row turned
 * three file types into twelve buttons, and a quieter default-label-plus-overflow still printed
 * something beside all five names. **Anything drawn beside every item in a list is drawn as many
 * times as the list is long.** A dialog has room to explain itself and repeats nothing.
 */
function ExportFormatDialog({
  label,
  formats,
  busy,
  error,
  onPick,
  onClose,
}: {
  label: string;
  formats: MoneyExportFormat[];
  busy: MoneyExportFormat | null;
  error: string;
  onPick: (format: MoneyExportFormat) => void;
  onClose: () => void;
}) {
  useOverlayOpen(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={`${shared.modalOverlay} ${shared.centeredOnMobile}`}
      onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* A hand-rolled title+X row, NOT CoachModalHeader — that component is for SHEET modals and
          its own contract says a centered dialog keeps the simple row instead. */}
      <div className={`${shared.modal} ${styles.dialog}`} role="dialog" aria-modal="true" aria-label={`Export ${label}`}>
        <div className={shared.modalHeader}>
          <h2 className={shared.modalTitle}>Export {label}</h2>
          <button type="button" className={shared.modalCloseBtn} aria-label="Close without exporting" onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className={styles.intro}>Choose a file type.</p>
        <div className={styles.list}>
          {formats.map(f => {
            const spec = FORMATS[f];
            return (
              <button
                key={f}
                type="button"
                className={styles.choice}
                // Same phone rule, one level in: on a phone the spreadsheet formats are not
                // offered even for a dataset that also makes a PDF.
                data-phone={f === 'pdf' ? 'keep' : 'drop'}
                disabled={busy !== null}
                onClick={() => onPick(f)}
              >
                <span className={styles.name}>
                  {spec.label}
                  <span className={styles.ext}>{spec.ext}</span>
                </span>
                <span className={styles.hint}>
                  {busy === f ? 'Preparing your file…' : spec.hint}
                </span>
              </button>
            );
          })}
        </div>
        {error && <p className={`${shared.errorText} ${styles.error}`} role="status">{error}</p>}
      </div>
    </div>
  );
}
