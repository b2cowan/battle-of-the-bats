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

import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { Download, ChevronDown, FileSpreadsheet, FileText, Calendar, Lock } from 'lucide-react';
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
  /** Optional CSS class added to the root wrapper div. */
  className?: string;
}

export default function ExportMenu({
  formats,
  onExportXLSX,
  onExportCSV,
  onExportICS,
  onExportPDF,
  hasSensitiveOption = false,
  sensitiveOptionLabel = 'Excel with contact details',
  onExportXLSXWithSensitive,
  hasServerExport = false,
  onServerExport,
  planId,
  pdfFeatureKey = 'pdf_exports',
  label = 'Export',
  disabled = false,
  className,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | undefined>();

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function updateMenuPosition() {
      const trigger = rootRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const margin = 12;
      const triggerRect = trigger.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const menuWidth = Math.min(
        Math.max(menu.offsetWidth, 220),
        Math.max(viewportWidth - margin * 2, 160),
      );
      const left = Math.max(
        margin,
        Math.min(triggerRect.right - menuWidth, viewportWidth - menuWidth - margin),
      );
      const menuHeight = menu.offsetHeight;
      const minimumUsefulHeight = Math.min(menuHeight, 160);
      let top = triggerRect.bottom + 6;
      let maxHeight = viewportHeight - top - margin;

      if (maxHeight < minimumUsefulHeight) {
        const availableAbove = triggerRect.top - margin - 6;
        if (availableAbove > maxHeight) {
          const visibleHeight = Math.min(menuHeight, availableAbove);
          top = Math.max(margin, triggerRect.top - visibleHeight - 6);
          maxHeight = visibleHeight;
        } else {
          top = margin;
          maxHeight = viewportHeight - margin * 2;
        }
      }

      setMenuStyle({
        position: 'fixed',
        top,
        left,
        width: menuWidth,
        maxHeight,
        overflowY: 'auto',
      });
    }

    const frame = window.requestAnimationFrame(updateMenuPosition);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const includesICS = formats.includes('ics');
  const includesPDF = formats.includes('pdf');

  // PDF gate: if planId provided, check against pdfFeatureKey
  const pdfAccessible =
    !planId || hasPlanFeature(planId, pdfFeatureKey);
  const pdfUpgradeCopy = pdfAccessible ? '' : requiresPlanCopy(pdfFeatureKey);

  async function run(action: () => void | Promise<void>) {
    setOpen(false);
    setLoading(true);
    try {
      await action();
    } finally {
      setLoading(false);
    }
  }

  function handlePrimaryClick() {
    if (disabled || loading) return;
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
          disabled={disabled || loading}
          aria-label={`${label} as Excel`}
          title="Download Excel (.xlsx)"
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
          aria-label="More export formats"
          title="More export options"
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
          aria-label="Export options"
        >
          {/* Always: Excel */}
          <button
            role="menuitem"
            className={styles.menuItem}
            onClick={() => run(onExportXLSX)}
          >
            <FileSpreadsheet size={14} className={styles.menuIcon} aria-hidden />
            <span>
              <span className={styles.menuItemLabel}>Excel (.xlsx)</span>
              <span className={styles.menuItemHint}>Opens in Google Sheets, Excel, Numbers</span>
            </span>
          </button>

          {/* Always: CSV */}
          <button
            role="menuitem"
            className={styles.menuItem}
            onClick={() => run(onExportCSV)}
          >
            <FileText size={14} className={styles.menuIcon} aria-hidden />
            <span>
              <span className={styles.menuItemLabel}>CSV</span>
              <span className={styles.menuItemHint}>Plain text — import into any tool</span>
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
              className={styles.menuItem}
              onClick={() => run(onExportICS!)}
            >
              <Calendar size={14} className={styles.menuIcon} aria-hidden />
              <span>
                <span className={styles.menuItemLabel}>Calendar (.ics)</span>
                <span className={styles.menuItemHint}>Add events to Google Calendar, Outlook, Apple Calendar</span>
              </span>
            </button>
          )}

          {/* PDF — gated */}
          {includesPDF && (
            <button
              role="menuitem"
              className={`${styles.menuItem}${!pdfAccessible ? ` ${styles.menuItemGated}` : ''}`}
              onClick={() => {
                if (!pdfAccessible) return; // tooltip handles the upsell nudge
                if (onExportPDF) run(onExportPDF);
              }}
              aria-disabled={!pdfAccessible}
              title={pdfAccessible ? 'Download PDF report' : pdfUpgradeCopy}
            >
              <FileText size={14} className={styles.menuIcon} aria-hidden />
              {!pdfAccessible && (
                <Lock size={12} className={styles.lockIcon} aria-hidden />
              )}
              <span>
                <span className={styles.menuItemLabel}>PDF report</span>
                <span className={styles.menuItemHint}>
                  {pdfAccessible
                    ? 'Formatted, print-ready document'
                    : pdfUpgradeCopy}
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
              className={styles.menuItem}
              onClick={() => run(onExportXLSXWithSensitive!)}
            >
              <FileSpreadsheet size={14} className={styles.menuIcon} aria-hidden />
              <span>
                <span className={styles.menuItemLabel}>{sensitiveOptionLabel}</span>
                <span className={styles.menuItemHint}>Includes additional contact columns</span>
              </span>
            </button>
          )}

          {/* Server-side full export */}
          {hasServerExport && onServerExport && (
            <button
              role="menuitem"
              className={styles.menuItem}
              onClick={() => run(onServerExport!)}
            >
              <Download size={14} className={styles.menuIcon} aria-hidden />
              <span>
                <span className={styles.menuItemLabel}>All matching records</span>
                <span className={styles.menuItemHint}>Full dataset — not just this page</span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
