'use client';

/**
 * components/admin/ExportMenu.tsx
 * Shared export dropdown used on every admin export surface.
 *
 * CONTRACT (from lib/export/catalog.ts Export Standard):
 *  1. One button opens the formats; Excel is the first row (owner, 2026-10-01 — it was a split
 *     button whose left half downloaded Excel in one click, retired for the portal's one control)
 *  2. CSV when formats includes 'csv' — every surface lists it but a closed year's year-end report,
 *     which is Excel and PDF only (§283 W7: the menu offered CSV there although the year-end report
 *     never asked for it)
 *  3. iCal available when formats includes 'ics'
 *  4. PDF available when formats includes 'pdf' — gated at tournament_plus+
 *  5. Sensitive opt-in variants shown when hasSensitiveOption is true
 *  6. Upgrade tooltip via requiresPlanCopy() when user's plan is below minimum
 *  7. Disabled when no rows or disabled prop is true
 *
 * ⚠ NO SENTENCE UNDER A FORMAT (owner, 2026-10-08 — the coaches portal's 2026-08-24 ruling, carried
 * here). "Opens in Google Sheets…", "Plain text…", "Formatted, print-ready…" made three rows a
 * paragraph in a menu whose job is to be quick. A row's second line survives only where it says
 * something its name does not: a state (no rows, the plan upgrade), a per-view `pdfHint` when the
 * PDF is not what the row implies, a second document, the contact-details and full-dataset rows.
 */

import { useState, useRef } from 'react';
import { Download, FileSpreadsheet, FileText, Calendar, Lock, Upload } from 'lucide-react';
import { useAnchoredMenu, useDismissable } from '@/lib/overlay-hooks';
import type { OrgPlan } from '@/lib/types';
import type { PlanFeature } from '@/lib/plan-features';
import { hasPlanFeature, requiresPlanCopy } from '@/lib/plan-features';
import styles from './ExportMenu.module.css';

export type ExportFormat = 'xlsx' | 'csv' | 'ics' | 'pdf';

export interface ExportMenuProps {
  /** Formats available on this surface. Excel is always shown; CSV, iCal and PDF only when listed. */
  formats: ExportFormat[];
  /** Called when user selects Excel (.xlsx) — the menu's first row. */
  onExportXLSX: () => void | Promise<void>;
  /** Called when user selects CSV. */
  onExportCSV: () => void | Promise<void>;
  /** Called when user selects Calendar (.ics). Required when formats includes 'ics'. */
  onExportICS?: () => void | Promise<void>;
  /** Called when user selects PDF report. Required when formats includes 'pdf'. */
  onExportPDF?: () => void | Promise<void>;
  /** Override the PDF item label (e.g. "Bracket PDF" when the bracket is on screen). Default: 'PDF report'. */
  pdfLabel?: string;
  /** The PDF row's second line — only when the PDF is not what the row's name implies. Default: none. */
  pdfHint?: string;
  /**
   * Optional second PDF item — a different DOCUMENT built from the same rows, shown under the
   * PDF item and gated the same way. Two shipped uses: the schedule's blank fill-in bracket, and
   * the team roster's contacts sheet beside its wall copy. It is a second document, never a
   * second FORMAT — the one-Export-control-per-surface ruling holds by putting the choice inside
   * this menu (the same move `MoneyExportButton.secondaryPdf` makes for the dues statement).
   */
  onExportSecondaryPDF?: () => void | Promise<void>;
  secondaryPdfLabel?: string;
  secondaryPdfHint?: string;
  /**
   * When true, a second opt-in export item appears:
   * "Excel with contact details" (or "Excel with internal notes" if both are set).
   */
  hasSensitiveOption?: boolean;
  /** Label for the sensitive variant. Default: 'Excel with contact details'. */
  sensitiveOptionLabel?: string;
  /** Called when user selects the sensitive opt-in export. */
  onExportXLSXWithSensitive?: () => void | Promise<void>;
  /**
   * PlanFeature key gating the sensitive opt-in. Optional BY DESIGN — this row carries real
   * guardian PII, but "who may see it" is not always a plan question. Two shapes ship:
   *  - A surface whose exports are a PAID capability names its own key here (rep tryouts →
   *    `club_exports`). Before the Rosters pass that row had NO plan check while the PDF above
   *    it — which prints no contacts at all — was locked to Club: exactly backwards, and
   *    reachable because a module can be granted as an add-on without the org reaching Club.
   *  - A surface where the data is the caller's OWN (the coaches' team roster) leaves it unset
   *    and gates on the ROLE grant instead. Locking a standalone coach out of their own team's
   *    contact list would be the wrong fix.
   */
  sensitiveFeatureKey?: PlanFeature;
  /**
   * When true, a "full dataset" server-side export option appears.
   * Use for paginated tables where client state is a subset of all records.
   */
  hasServerExport?: boolean;
  /** Called when user selects "All matching records" (full server export). */
  onServerExport?: () => void | Promise<void>;
  /**
   * Current org plan — used to evaluate PDF gate.
   * When absent, PDF is treated as accessible (e.g. platform admin surfaces).
   */
  planId?: OrgPlan;
  /**
   * PlanFeature key for the PDF gate. Default: 'pdf_exports'.
   * The menu uses hasPlanFeature(planId, pdfFeatureKey) to determine if PDF
   * should be dimmed with an upgrade tooltip.
   */
  pdfFeatureKey?: PlanFeature;
  /**
   * Button label prefix. Default: 'Export'.
   * Shown as "Export ▾" on the button.
   */
  label?: string;
  /**
   * Disable the entire menu (e.g. when no rows are selected / visible).
   * The button renders at reduced opacity and does not open the dropdown.
   */
  disabled?: boolean;
  /**
   * Disable export actions while keeping the menu usable for non-export actions
   * such as import templates.
   */
  exportDisabled?: boolean;
  /** Show an import action in the dropdown. */
  hasImportOption?: boolean;
  /** Called when user selects the import action. */
  onImport?: () => void | Promise<void>;
  /** Import menu label. Default: 'Import teams'. */
  importLabel?: string;
  /** Import menu helper text. */
  importHint?: string;
  /** Optional CSS class added to the root wrapper div. */
  className?: string;
  /**
   * What the export HOLDS, said before it runs (Club Tier Stage 3a, C14: the club's Ledger export is the
   * whole period, signed, voids marked — not the rows on screen). A title and its lines at the top of
   * the menu. One line at most (owner, §283 W7 2026-10-08): the club Ledger's "every entry in the period", and a
   * closed year's "Year-end report · 2025–26" with no lines. Opt-in; no other surface passes it.
   */
  holds?: { title: string; lines?: string[] };
}

export default function ExportMenu({
  formats,
  onExportXLSX,
  onExportCSV,
  onExportICS,
  onExportPDF,
  pdfLabel = 'PDF report',
  pdfHint,
  onExportSecondaryPDF,
  secondaryPdfLabel = 'Blank PDF',
  secondaryPdfHint = 'Empty template to print and fill in',
  hasSensitiveOption = false,
  sensitiveOptionLabel = 'Excel with contact details',
  onExportXLSXWithSensitive,
  sensitiveFeatureKey,
  hasServerExport = false,
  onServerExport,
  planId,
  pdfFeatureKey = 'pdf_exports',
  label = 'Export',
  disabled = false,
  exportDisabled = false,
  hasImportOption = false,
  onImport,
  importLabel = 'Import teams',
  importHint = 'Download a template, upload a file, preview changes',
  className,
  holds,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Outside-click + Escape, and trigger-anchored placement with the above/below flip — both shared
  // with the tournament toolbar menu, which used to carry a near-identical private copy.
  useDismissable(open, rootRef, () => setOpen(false));
  const menuStyle = useAnchoredMenu(open, rootRef, menuRef, {
    minWidth: 220,
    narrowMinWidth: 160,
    // Always right-aligned: the button sits at the right end of a right-aligned button group.
    align: 'end',
  });

  const includesCSV = formats.includes('csv');
  const includesICS = formats.includes('ics');
  const includesPDF = formats.includes('pdf');

  // PDF gate: if planId provided, check against pdfFeatureKey
  const pdfAccessible =
    !planId || hasPlanFeature(planId, pdfFeatureKey);
  const pdfUpgradeCopy = pdfAccessible ? '' : requiresPlanCopy(pdfFeatureKey);
  const pdfRowHint = !pdfAccessible ? pdfUpgradeCopy : exportDisabled ? 'No rows available to export' : pdfHint;

  // Sensitive opt-in gate. Unset key = no plan question on this surface (see the prop's note);
  // the row is then governed by whatever role/grant decided `hasSensitiveOption`.
  const sensitiveAccessible =
    !sensitiveFeatureKey || !planId || hasPlanFeature(planId, sensitiveFeatureKey);
  const sensitiveUpgradeCopy =
    sensitiveAccessible || !sensitiveFeatureKey ? '' : requiresPlanCopy(sensitiveFeatureKey);

  async function run(action: () => void | Promise<void>) {
    setOpen(false);
    setLoading(true);
    try {
      await action();
    } finally {
      setLoading(false);
    }
  }

  function runExport(action: () => void | Promise<void>) {
    if (exportDisabled) return;
    run(action);
  }

  // ONE control, no chevron (owner, 2026-10-01 — the coaches portal's export standard): the button
  // opens the formats, Excel first. It replaced a split button whose left half downloaded Excel
  // outright and whose chevron opened this menu — two sub-44px targets on a phone, read as one.
  function handleTriggerClick() {
    if (disabled || loading) return;
    setOpen((v) => !v);
  }

  return (
    <div ref={rootRef} className={`${styles.root}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className={`btn btn-outline btn-data ${styles.trigger}`}
        onClick={handleTriggerClick}
        disabled={disabled || loading}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={hasImportOption ? `${label} and import` : label}
      >
        <Download size={14} aria-hidden />
        <span className={styles.triggerLabel}>{loading ? 'Exporting...' : label}</span>
      </button>

      {/* ── Dropdown menu ─────────────────────────────────────────────── */}
      {open && (
        <div
          ref={menuRef}
          className={styles.menu}
          style={menuStyle}
          role="menu"
          aria-label={hasImportOption ? 'Export and import options' : 'Export options'}
        >
          {holds && (
            <div className={styles.holds}>
              <span className={styles.menuItemLabel}>{holds.title}</span>
              {holds.lines?.map(l => <span key={l} className={styles.menuItemHint}>{l}</span>)}
            </div>
          )}
          {/* Always: Excel */}
          <button
            role="menuitem"
            className={`${styles.menuItem}${exportDisabled ? ` ${styles.menuItemDisabled}` : ''}`}
            onClick={() => runExport(onExportXLSX)}
            aria-disabled={exportDisabled}
          >
            <FileSpreadsheet size={14} className={styles.menuIcon} aria-hidden />
            <span>
              <span className={styles.menuItemLabel}>Excel (.xlsx)</span>
              {exportDisabled && <span className={styles.menuItemHint}>No rows available to export</span>}
            </span>
          </button>

          {/* CSV — when the surface lists it */}
          {includesCSV && (
            <button
              role="menuitem"
              className={`${styles.menuItem}${exportDisabled ? ` ${styles.menuItemDisabled}` : ''}`}
              onClick={() => runExport(onExportCSV)}
              aria-disabled={exportDisabled}
            >
              <FileText size={14} className={styles.menuIcon} aria-hidden />
              <span>
                <span className={styles.menuItemLabel}>CSV</span>
                {exportDisabled && <span className={styles.menuItemHint}>No rows available to export</span>}
              </span>
            </button>
          )}

          {/* Divider before optional formats */}
          {(includesICS || includesPDF) && (
            <div className={styles.divider} role="separator" />
          )}

          {/* iCal */}
          {includesICS && onExportICS && (
            <button
              role="menuitem"
              className={`${styles.menuItem}${exportDisabled ? ` ${styles.menuItemDisabled}` : ''}`}
              onClick={() => runExport(onExportICS!)}
              aria-disabled={exportDisabled}
            >
              <Calendar size={14} className={styles.menuIcon} aria-hidden />
              <span>
                <span className={styles.menuItemLabel}>Calendar (.ics)</span>
                {exportDisabled && <span className={styles.menuItemHint}>No rows available to export</span>}
              </span>
            </button>
          )}

          {/* PDF — gated */}
          {includesPDF && (
            <button
              role="menuitem"
              className={`${styles.menuItem}${!pdfAccessible ? ` ${styles.menuItemGated}` : ''}${exportDisabled ? ` ${styles.menuItemDisabled}` : ''}`}
              onClick={() => {
                if (!pdfAccessible || exportDisabled) return; // tooltip handles the upsell nudge
                if (onExportPDF) runExport(onExportPDF);
              }}
              aria-disabled={!pdfAccessible || exportDisabled}
              title={pdfAccessible ? (exportDisabled ? 'No rows available to export' : 'Download PDF report') : pdfUpgradeCopy}
            >
              <FileText size={14} className={styles.menuIcon} aria-hidden />
              {!pdfAccessible && (
                <Lock size={12} className={styles.lockIcon} aria-hidden />
              )}
              <span>
                <span className={styles.menuItemLabel}>{pdfLabel}</span>
                {pdfRowHint && <span className={styles.menuItemHint}>{pdfRowHint}</span>}
              </span>
            </button>
          )}

          {/* Second PDF document (same gate as PDF) */}
          {includesPDF && onExportSecondaryPDF && (
            <button
              role="menuitem"
              className={`${styles.menuItem}${!pdfAccessible ? ` ${styles.menuItemGated}` : ''}${exportDisabled ? ` ${styles.menuItemDisabled}` : ''}`}
              onClick={() => {
                if (!pdfAccessible || exportDisabled) return;
                runExport(onExportSecondaryPDF);
              }}
              aria-disabled={!pdfAccessible || exportDisabled}
              title={pdfAccessible ? (exportDisabled ? 'No rows available to export' : secondaryPdfHint) : pdfUpgradeCopy}
            >
              <FileText size={14} className={styles.menuIcon} aria-hidden />
              {!pdfAccessible && (
                <Lock size={12} className={styles.lockIcon} aria-hidden />
              )}
              <span>
                <span className={styles.menuItemLabel}>{secondaryPdfLabel}</span>
                <span className={styles.menuItemHint}>
                  {!pdfAccessible
                    ? pdfUpgradeCopy
                    : exportDisabled
                      ? 'No rows available to export'
                      : secondaryPdfHint}
                </span>
              </span>
            </button>
          )}

          {/* Divider before sensitive opt-ins */}
          {(hasSensitiveOption || hasServerExport) && (
            <div className={styles.divider} role="separator" />
          )}

          {/* Sensitive opt-in */}
          {hasSensitiveOption && onExportXLSXWithSensitive && (
            <button
              role="menuitem"
              className={`${styles.menuItem}${!sensitiveAccessible ? ` ${styles.menuItemGated}` : ''}${exportDisabled ? ` ${styles.menuItemDisabled}` : ''}`}
              onClick={() => {
                if (!sensitiveAccessible || exportDisabled) return;
                runExport(onExportXLSXWithSensitive!);
              }}
              aria-disabled={!sensitiveAccessible || exportDisabled}
              title={sensitiveAccessible ? undefined : sensitiveUpgradeCopy}
            >
              <FileSpreadsheet size={14} className={styles.menuIcon} aria-hidden />
              {!sensitiveAccessible && (
                <Lock size={12} className={styles.lockIcon} aria-hidden />
              )}
              <span>
                <span className={styles.menuItemLabel}>{sensitiveOptionLabel}</span>
                <span className={styles.menuItemHint}>
                  {!sensitiveAccessible
                    ? sensitiveUpgradeCopy
                    : exportDisabled
                      ? 'No rows available to export'
                      : 'Includes additional contact columns'}
                </span>
              </span>
            </button>
          )}

          {/* Server-side full export */}
          {hasServerExport && onServerExport && (
            <button
              role="menuitem"
              className={`${styles.menuItem}${exportDisabled ? ` ${styles.menuItemDisabled}` : ''}`}
              onClick={() => runExport(onServerExport!)}
              aria-disabled={exportDisabled}
            >
              <Download size={14} className={styles.menuIcon} aria-hidden />
              <span>
                <span className={styles.menuItemLabel}>All matching records</span>
                <span className={styles.menuItemHint}>{exportDisabled ? 'No rows available to export' : 'Full dataset - not just this page'}</span>
              </span>
            </button>
          )}

          {hasImportOption && onImport && (
            <>
              <div className={styles.divider} role="separator" />
              <button
                role="menuitem"
                className={styles.menuItem}
                onClick={() => run(onImport)}
              >
                <Upload size={14} className={styles.menuIcon} aria-hidden />
                <span>
                  <span className={styles.menuItemLabel}>{importLabel}</span>
                  <span className={styles.menuItemHint}>{importHint}</span>
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
