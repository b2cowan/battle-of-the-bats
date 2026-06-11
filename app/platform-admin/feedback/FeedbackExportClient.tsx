'use client';

/**
 * Thin client export control for the feedback triage page (server component). Builds the filtered
 * download URLs and triggers them as plain <a download> navigation, mirroring AuditExportClient.
 */
interface FeedbackExportClientProps {
  type: string;
  category: string;
  status: string;
}

function buildExportUrl(filters: FeedbackExportClientProps, format: 'xlsx' | 'csv'): string {
  const p = new URLSearchParams();
  if (filters.type) p.set('type', filters.type);
  if (filters.category) p.set('category', filters.category);
  if (filters.status) p.set('status', filters.status);
  p.set('format', format);
  const qs = p.toString();
  return `/api/platform-admin/feedback/export${qs ? `?${qs}` : ''}`;
}

export default function FeedbackExportClient(props: FeedbackExportClientProps) {
  const xlsxUrl = buildExportUrl(props, 'xlsx');
  const csvUrl = buildExportUrl(props, 'csv');

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
