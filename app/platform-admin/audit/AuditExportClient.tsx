'use client';

import ExportMenu from '@/components/admin/ExportMenu';

/**
 * AuditExportClient.tsx
 * Thin client component that renders the shared ExportMenu dropdown (Excel on primary click, CSV in
 * the menu) for the platform-admin audit log. The audit page is a server component, so export
 * actions are server-side downloads via /api/platform-admin/audit/export. This builds the correct
 * download URL from the current filters and triggers it on click.
 */

interface AuditExportClientProps {
  q: string;
  from: string;
  to: string;
  action: string;
  orgId: string;
}

function buildExportUrl(filters: AuditExportClientProps, format: 'xlsx' | 'csv'): string {
  const p = new URLSearchParams();
  if (filters.q)      p.set('q',      filters.q);
  if (filters.from)   p.set('from',   filters.from);
  if (filters.to)     p.set('to',     filters.to);
  if (filters.action) p.set('action', filters.action);
  if (filters.orgId)  p.set('orgId',  filters.orgId);
  p.set('format', format);
  const qs = p.toString();
  return `/api/platform-admin/audit/export${qs ? `?${qs}` : ''}`;
}

function triggerDownload(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function AuditExportClient(props: AuditExportClientProps) {
  return (
    <ExportMenu
      formats={['xlsx', 'csv']}
      onExportXLSX={() => triggerDownload(buildExportUrl(props, 'xlsx'))}
      onExportCSV={() => triggerDownload(buildExportUrl(props, 'csv'))}
    />
  );
}
