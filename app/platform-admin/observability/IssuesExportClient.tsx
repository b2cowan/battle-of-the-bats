'use client';

import ExportMenu from '@/components/admin/ExportMenu';

/**
 * Exports the FULL filtered issue set (not just the current page) to Excel / CSV via the shared
 * ExportMenu dropdown (Excel on primary click, CSV in the menu). The list page is a server
 * component, so this builds the server export URL — carrying the current filters — and triggers
 * it as a download. The route re-runs the same filtered query without pagination (capped 5,000).
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

function triggerDownload(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function IssuesExportClient({ filters, disabled }: { filters: ExportFilters; disabled?: boolean }) {
  return (
    <ExportMenu
      formats={['xlsx', 'csv']}
      onExportXLSX={() => triggerDownload(buildUrl(filters, 'xlsx'))}
      onExportCSV={() => triggerDownload(buildUrl(filters, 'csv'))}
      disabled={disabled}
    />
  );
}
