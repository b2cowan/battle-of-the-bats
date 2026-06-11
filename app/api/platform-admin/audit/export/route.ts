import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import ExcelJS from 'exceljs';
import { withObservability } from '@/lib/observability';

const EXPORT_LIMIT = 2000;

type AuditLogRow = {
  id: string;
  actor_email: string;
  org_id: string | null;
  action: string;
  field: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
  organizations: { id: string; name: string } | { id: string; name: string }[] | null;
};

function orgNameFromJoin(value: AuditLogRow['organizations']) {
  if (Array.isArray(value)) return value[0]?.name ?? '';
  return value?.name ?? '';
}

function csvValue(value: unknown) {
  const raw = value === null || value === undefined
    ? ''
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

export const GET = withObservability(async (req: NextRequest) => {
  const auth = await requirePlatformAdmin();
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  const qText = sp.get('q')?.trim().toLowerCase() ?? '';
  const from = sp.get('from') ?? '';
  const to = sp.get('to') ?? '';
  const action = sp.get('action') ?? '';
  const orgId = sp.get('orgId') ?? '';

  let query = supabaseAdmin
    .from('platform_audit_log')
    .select('id, actor_email, org_id, action, field, old_value, new_value, created_at, organizations(id, name)')
    .order('created_at', { ascending: false })
    .limit(EXPORT_LIMIT);

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', `${to}T23:59:59`);
  if (action) query = query.eq('action', action);
  if (orgId) query = query.eq('org_id', orgId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as AuditLogRow[])
    .map(row => ({
      id: row.id as string,
      createdAt: row.created_at as string,
      actorEmail: row.actor_email as string,
      orgId: row.org_id as string | null,
      orgName: orgNameFromJoin(row.organizations),
      action: row.action as string,
      field: row.field as string | null,
      oldValue: row.old_value,
      newValue: row.new_value,
    }))
    .filter(row => {
      if (!qText) return true;
      return row.actorEmail.toLowerCase().includes(qText) ||
        row.orgName.toLowerCase().includes(qText);
    });

  const header = ['id', 'created_at', 'actor_email', 'org_id', 'org_name', 'action', 'field', 'old_value', 'new_value'];
  const date   = new Date().toISOString().slice(0, 10);
  const format = sp.get('format') ?? 'csv';

  function rowValues(row: (typeof rows)[number]): (string | null)[] {
    return [
      row.id,
      row.createdAt,
      row.actorEmail,
      row.orgId ?? null,
      row.orgName || null,
      row.action,
      row.field ?? null,
      row.oldValue !== null && row.oldValue !== undefined
        ? typeof row.oldValue === 'string' ? row.oldValue : JSON.stringify(row.oldValue)
        : null,
      row.newValue !== null && row.newValue !== undefined
        ? typeof row.newValue === 'string' ? row.newValue : JSON.stringify(row.newValue)
        : null,
    ];
  }

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FieldLogicHQ';
    workbook.created = new Date();
    const ws = workbook.addWorksheet('Audit Log');

    const headerRow = ws.addRow(header);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

    rows.forEach(row => ws.addRow(rowValues(row).map(c => c ?? '')));

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
        'Content-Disposition': `attachment; filename="platform-audit-log-${date}.xlsx"`,
      },
    });
  }

  // Default: CSV
  const lines = [
    header.map(csvValue).join(','),
    ...rows.map(row => rowValues(row).map(v => csvValue(v)).join(',')),
  ];

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="platform-audit-log-${date}.csv"`,
    },
  });
}, { route: '/api/platform-admin/audit/export' });
