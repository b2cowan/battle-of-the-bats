'use client';

import type { CSSProperties } from 'react';

/**
 * Exports the FULL filtered issue set (not just the current page) to CSV / XLSX.
 * The list page is a server component, so — like AuditExportClient — this renders
 * download links to the server export route, carrying the current filters. The route
 * re-runs the same filtered query without pagination (capped at 5,000 rows).
 */

interface ExportFilters {
  severity: string;
  status: string;
  route: string;
  org: string;
  q: string;
}

function buildUrl(f: ExportFilters, format: 'xlsx' | 'csv'): string {
  const p = new URLSearchParams();
  if (f.severity) p.set('severity', f.severity);
  if (f.status) p.set('status', f.status);
  if (f.route) p.set('route', f.route);
  if (f.org) p.set('org', f.org);
  if (f.q) p.set('q', f.q);
  p.set('format', format);
  return `/api/platform-admin/observability/issues/export?${p.toString()}`;
}

export default function IssuesExportClient({ filters, disabled }: { filters: ExportFilters; disabled?: boolean }) {
  const linkStyle: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none',
    ...(disabled ? { pointerEvents: 'none', opacity: 0.45 } : {}),
  };
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <a href={buildUrl(filters, 'xlsx')} className="btn btn-outline btn-sm" style={linkStyle} download aria-disabled={disabled}>
        ↓ Export XLSX
      </a>
      <a href={buildUrl(filters, 'csv')} className="btn btn-outline btn-sm" style={linkStyle} download aria-disabled={disabled}>
        CSV
      </a>
    </div>
  );
}
