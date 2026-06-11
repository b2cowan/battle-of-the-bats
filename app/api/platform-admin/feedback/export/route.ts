import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAdminContext } from '@/lib/platform-auth';
import { canViewPlatformArea } from '@/lib/platform-areas';
import { supabaseAdmin } from '@/lib/supabase-admin';
import ExcelJS from 'exceljs';
import { withObservability } from '@/lib/observability';

// Gated to viewers of the observability area (super_admin / product / support) — same as the page,
// stricter than a generic platform-admin check so billing/growth can't pull the feedback export.
const EXPORT_LIMIT = 2000;

type FeedbackRow = {
  id: string;
  org_id: string | null;
  user_email: string | null;
  submitter_name: string | null;
  type: string;
  category: string | null;
  title: string | null;
  body: string;
  status: string;
  severity: string | null;
  created_at: string;
  organizations: { id: string; name: string } | { id: string; name: string }[] | null;
};

function orgNameFromJoin(value: FeedbackRow['organizations']) {
  if (Array.isArray(value)) return value[0]?.name ?? '';
  return value?.name ?? '';
}

// Neutralize CSV/spreadsheet formula injection: feedback body/title are anonymous attacker-controlled
// free text. A leading =/+/-/@/tab/CR is evaluated as a formula by Excel/Sheets even inside a quoted
// CSV field — prefix a single quote so it renders as literal text.
function neutralizeFormula(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function csvValue(value: unknown) {
  const raw = value === null || value === undefined
    ? ''
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);
  return `"${neutralizeFormula(raw).replace(/"/g, '""')}"`;
}

export const GET = withObservability(async (req: NextRequest) => {
  const auth = await getPlatformAdminContext();
  if (!auth || !canViewPlatformArea(auth.role, 'observability')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const type = sp.get('type') ?? '';
  const category = sp.get('category') ?? '';
  const status = sp.get('status') ?? '';

  let query = supabaseAdmin
    .from('feedback_submissions')
    .select('id, org_id, user_email, submitter_name, type, category, title, body, status, severity, created_at, organizations(id, name)')
    .order('created_at', { ascending: false })
    .limit(EXPORT_LIMIT);

  if (type) query = query.eq('type', type);
  if (category) query = query.eq('category', category);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as FeedbackRow[]).map(row => ({
    id: row.id,
    createdAt: row.created_at,
    type: row.type,
    category: row.category ?? '',
    status: row.status,
    severity: row.severity ?? '',
    orgId: row.org_id ?? '',
    orgName: orgNameFromJoin(row.organizations),
    userEmail: row.user_email ?? '',
    submitterName: row.submitter_name ?? '',
    title: row.title ?? '',
    body: row.body,
  }));

  const header = ['id', 'created_at', 'type', 'category', 'status', 'severity', 'org_id', 'org_name', 'user_email', 'submitter_name', 'title', 'body'];
  const date = new Date().toISOString().slice(0, 10);
  const format = sp.get('format') ?? 'csv';

  function rowValues(row: (typeof rows)[number]): (string | null)[] {
    return [
      row.id, row.createdAt, row.type, row.category, row.status, row.severity,
      row.orgId || null, row.orgName || null, row.userEmail || null, row.submitterName || null,
      row.title || null, row.body,
    ];
  }

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FieldLogicHQ';
    workbook.created = new Date();
    const ws = workbook.addWorksheet('Feedback');

    const headerRow = ws.addRow(header);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

    rows.forEach(row => ws.addRow(rowValues(row).map(c => (typeof c === 'string' ? neutralizeFormula(c) : c ?? ''))));

    ws.columns.forEach((col, i) => {
      const headerLen = (header[i] ?? '').length;
      let maxData = 0;
      rows.forEach(r => {
        const l = String(rowValues(r)[i] ?? '').length;
        if (l > maxData) maxData = l;
      });
      col.width = Math.min(Math.max(headerLen, maxData) + 2, 80);
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="feedback-${date}.xlsx"`,
      },
    });
  }

  const lines = [
    header.map(csvValue).join(','),
    ...rows.map(row => rowValues(row).map(v => csvValue(v)).join(',')),
  ];

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="feedback-${date}.csv"`,
    },
  });
}, { route: '/api/platform-admin/feedback/export' });
