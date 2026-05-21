'use client';

/**
 * AuditExportClient.tsx
 * Thin client component that renders the ExportMenu for the platform admin
 * audit log. The audit page is a server component, so export actions are
 * server-side downloads via the /api/platform-admin/audit/export route.
 * This component accepts the current filter params and builds the correct
 * download URLs, then triggers them as navigation on click.
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

export default function AuditExportClient(props: AuditExportClientProps) {
  const xlsxUrl = buildExportUrl(props, 'xlsx');
  const csvUrl  = buildExportUrl(props, 'csv');

  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <a
        href={xlsxUrl}
        className="btn btn-outline btn-sm"
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
        download
      >
        ↓ Export XLSX
      </a>
      <a
        href={csvUrl}
        className="btn btn-outline btn-sm"
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
        download
      >
        CSV
      </a>
    </div>
  );
}
