import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { getErrorGroupsForExport, normalizeEnv, type IssueFilters } from '@/lib/observability/dashboard';
import { withObservability } from '@/lib/observability';

const SEVERITY_OPTIONS = ['critical', 'error', 'warning', 'info'];
const STATUS_OPTIONS = ['open', 'resolved', 'ignored', 'snoozed'];

const HEADER = [
  'title', 'error_name', 'route', 'http_method', 'severity', 'status',
  'occurrences', 'affected_orgs', 'first_seen', 'last_seen', 'fingerprint',
];

function csvValue(value: unknown) {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

export const GET = withObservability(async (req: NextRequest) => {
  // Export is a read — allow any observability viewer (super_admin / product / support).
  const { response } = await requirePlatformAreaApi('observability', 'view');
  if (response) return response;

  const sp = req.nextUrl.searchParams;
  const filters: IssueFilters = {
    env: normalizeEnv(sp.get('env') ?? undefined),
    severity: SEVERITY_OPTIONS.includes(sp.get('severity') ?? '') ? sp.get('severity')! : '',
    status: STATUS_OPTIONS.includes(sp.get('status') ?? '') ? sp.get('status')! : '',
    route: (sp.get('route') ?? '').slice(0, 120),
    org: (sp.get('org') ?? '').slice(0, 120),
    q: (sp.get('q') ?? '').slice(0, 120),
    offset: 0,
  };

  const rows = await getErrorGroupsForExport(filters);
  const date = new Date().toISOString().slice(0, 10);
  const format = sp.get('format') ?? 'csv';

  function rowValues(r: (typeof rows)[number]): (string | number)[] {
    return [
      r.title ?? '',
      r.errorName ?? '',
      r.route ?? '',
      r.httpMethod ?? '',
      r.severity,
      r.status,
      r.occurrenceCount,
      r.distinctOrgCount,
      r.firstSeenAt,
      r.lastSeenAt,
      r.fingerprint,
    ];
  }

  if (format === 'xlsx') {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FieldLogicHQ';
    workbook.created = new Date();
    const ws = workbook.addWorksheet('Issues');

    const headerRow = ws.addRow(HEADER);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    rows.forEach(r => ws.addRow(rowValues(r)));
    ws.columns.forEach((col, i) => {
      const headerLen = (HEADER[i] ?? '').length;
      let maxData = 0;
      rows.forEach(r => { const l = String(rowValues(r)[i] ?? '').length; if (l > maxData) maxData = l; });
      col.width = Math.min(Math.max(headerLen, maxData) + 2, 80);
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="observability-issues-${filters.env}-${date}.xlsx"`,
      },
    });
  }

  const lines = [
    HEADER.map(csvValue).join(','),
    ...rows.map(r => rowValues(r).map(csvValue).join(',')),
  ];
  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="observability-issues-${filters.env}-${date}.csv"`,
    },
  });
}, { route: '/api/platform-admin/observability/issues/export' });
