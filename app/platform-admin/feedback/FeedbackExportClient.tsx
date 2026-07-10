'use client';

import ExportMenu from '@/components/admin/ExportMenu';

/**
 * Thin client export control for the feedback triage page (server component). Uses the shared
 * ExportMenu dropdown (Excel on primary click, CSV in the menu). Builds the filtered download URL
 * and triggers it on click, mirroring AuditExportClient / IssuesExportClient.
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

function triggerDownload(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function FeedbackExportClient(props: FeedbackExportClientProps) {
  return (
    <ExportMenu
      formats={['xlsx', 'csv']}
      onExportXLSX={() => triggerDownload(buildExportUrl(props, 'xlsx'))}
      onExportCSV={() => triggerDownload(buildExportUrl(props, 'csv'))}
    />
  );
}
