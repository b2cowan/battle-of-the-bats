'use client';

/**
 * components/admin/ExportMenu.tsx
 * Shared export dropdown used on every admin export surface.
 *
 * CONTRACT (from lib/export/catalog.ts Export Standard):
 *  1. Primary click → xlsx (non-negotiable default)
 *  2. CSV always present as a secondary option
 *  3. iCal available when formats includes 'ics'
 *  4. PDF available when formats includes 'pdf' — gated at tournament_plus+
 *  5. Sensitive opt-in variants shown when hasSensitiveOption is true
 *  6. Upgrade tooltip via requiresPlanCopy() when user's plan is below minimum
 *  7. Disabled when no rows or disabled prop is true
 */

import { useState, useRef } from 'react';
import { Download, ChevronDown, FileSpreadsheet, FileText, Calendar, Lock, Upload } from 'lucide-react';
import { useAnchoredMenu, useDismissable } from '@/lib/overlay-hooks';
import type { OrgPlan } from '@/lib/types';
import type { PlanFeature } from '@/lib/plan-features';
import { hasPlanFeature, requiresPlanCopy } from '@/lib/plan-features';
import styles from './ExportMenu.module.css';

export type ExportFormat = 'xlsx' | 'csv' | 'ics' | 'pdf';

export interface ExportMenuProps {
  /** Formats available on this surface. Always include 'xlsx' and 'csv'. */
  formats: ExportFormat[];
  /** Called when user selects Excel (.xlsx). Also the primary-click action. */
  onExportXLSX: () => void | Promise<void>;
  /** Called when user selects CSV. */
  onExportCSV: () => void | Promise<void>;
  /** Called when user selects Calendar (.ics). Required when formats includes 'ics'. */
  onExportICS?: () => void | Promise<void>;
  /** Called when user selects PDF report. Required when formats includes 'pdf'. */
  onExportPDF?: () => void | Promise<void>;
  /** Override the PDF item label (e.g. "Bracket PDF" when the bracket is on screen). Default: 'PDF report'. */
  pdfLabel?: string;
  /** Override the PDF item helper text. Default: 'Formatted, print-ready document'. */
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
}

export default function ExportMenu({
  formats,
  onExportXLSX,
  onExportCSV,
  onExportICS,
  onExportPDF,
  pdfLabel = 'PDF report',
  pdfHint = 'Formatted, print-ready document',
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
    // Always right-aligned: the chevron sits at the right end of a right-aligned button group.
    align: 'end',
  });

  const includesICS = formats.includes('ics');
  const includesPDF = formats.includes('pdf');

  // PDF gate: if planId provided, check against pdfFeatureKey
  const pdfAccessible =
    !planId || hasPlanFeature(planId, pdfFeatureKey);
  const pdfUpgradeCopy = pdfAccessible ? '' : requiresPlanCopy(pdfFeatureKey);

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

  function handlePrimaryClick() {
    if (disabled || loading || exportDisabled) return;
    run(onExportXLSX);
  }

  function handleChevronClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (disabled || loading) return;
    setOpen((v) => !v);
  }

  return (
    <div ref={rootRef} className={`${styles.root}${className ? ` ${className}` : ''}`}>
      {/* ── Primary button + chevron ───────────────────────────────────── */}
      <div className={`${styles.buttonGroup}${disabled || loading ? ` ${styles.buttonGroupDisabled}` : ''}`}>
        <button
          type="button"
          className={`btn btn-outline btn-data ${styles.primaryBtn}`}
          onClick={handlePrimaryClick}
          disabled={disabled || loading || exportDisabled}
          aria-label={`${label} as Excel`}
          title={exportDisabled ? 'No rows available to export' : 'Download Excel (.xlsx)'}
        >
          <Download size={14} aria-hidden />
          <span className={styles.primaryLabel}>{loading ? 'Exporting...' : label}</span>
        </button>
        <button
          type="button"
          className={`btn btn-outline btn-data ${styles.chevronBtn}`}
          onClick={handleChevronClick}
          disabled={disabled || loading}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={hasImportOption ? 'Export and import options' : 'More export formats'}
          title={hasImportOption ? 'Export and import options' : 'More export options'}
        >
          <ChevronDown size={14} aria-hidden />
        </button>
      </div>

      {/* ── Dropdown menu ─────────────────────────────────────────────── */}
      {open && (
        <div
          ref={menuRef}
          className={styles.menu}
          style={menuStyle}
          role="menu"
          aria-label={hasImportOption ? 'Export and import options' : 'Export options'}
        >
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
              <span className={styles.menuItemHint}>{exportDisabled ? 'No rows available to export' : 'Opens in Google Sheets, Excel, Numbers'}</span>
            </span>
          </button>

          {/* Always: CSV */}
          <button
            role="menuitem"
            className={`${styles.menuItem}${exportDisabled ? ` ${styles.menuItemDisabled}` : ''}`}
            onClick={() => runExport(onExportCSV)}
            aria-disabled={exportDisabled}
          >
            <FileText size={14} className={styles.menuIcon} aria-hidden />
            <span>
              <span className={styles.menuItemLabel}>CSV</span>
              <span className={styles.menuItemHint}>{exportDisabled ? 'No rows available to export' : 'Plain text - import into any tool'}</span>
            </span>
          </button>

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
                <span className={styles.menuItemHint}>{exportDisabled ? 'No rows available to export' : 'Add events to Google Calendar, Outlook, Apple Calendar'}</span>
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
                <span className={styles.menuItemHint}>
                  {!pdfAccessible
                    ? pdfUpgradeCopy
                    : exportDisabled
                      ? 'No rows available to export'
                      : pdfHint}
                </span>
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
