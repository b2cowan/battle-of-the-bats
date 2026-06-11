import { NextRequest, NextResponse } from 'next/server';
import {
  EARLY_ACCESS_FEATURE_LABELS,
  EARLY_ACCESS_PLAN_LABELS,
  EARLY_ACCESS_SELECT,
  EARLY_ACCESS_STATUS_LABELS,
  isEarlyAccessStatus,
  parseEarlyAccessFilters,
  toCsvCell,
} from '@/lib/early-access-admin';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import ExcelJS from 'exceljs';
import { withObservability } from '@/lib/observability';

type LeadExportRow = {
  created_at: string;
  name: string;
  email: string;
  organization_name: string | null;
  role: string | null;
  sports: string | null;
  plan_interest: string[];
  features_interested: string[];
  internal_status: string;
  release_notifications_consent: boolean;
  last_contacted_at: string | null;
  converted_at: string | null;
  converted_org_id: string | null;
  follow_up_due_at: string | null;
  next_action: string | null;
  notes: string | null;
  internal_notes: string | null;
};

export const GET = withObservability(async (req: NextRequest) => {
  const auth = await requirePlatformAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(req.url);
  const filters = parseEarlyAccessFilters(searchParams);

  let query = supabaseAdmin
    .from('early_access_leads')
    .select(EARLY_ACCESS_SELECT)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    query = query.or([
      `name.ilike.${pattern}`,
      `email.ilike.${pattern}`,
      `organization_name.ilike.${pattern}`,
      `role.ilike.${pattern}`,
      `sports.ilike.${pattern}`,
      `notes.ilike.${pattern}`,
    ].join(','));
  }
  if (filters.plan) query = query.contains('plan_interest', [filters.plan]);
  if (filters.feature) query = query.contains('features_interested', [filters.feature]);
  if (filters.status) query = query.eq('internal_status', filters.status);
  if (filters.consent === 'yes') query = query.eq('release_notifications_consent', true);
  if (filters.consent === 'no') query = query.eq('release_notifications_consent', false);
  if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`);
  if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) {
    console.error('[platform-admin] early-access export error:', error);
    return NextResponse.json({ error: 'Unable to export early-access leads' }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as LeadExportRow[];
  const header = [
    'submitted_at',
    'name',
    'email',
    'organization',
    'role',
    'sport_or_program',
    'plans',
    'features',
    'status',
    'consent',
    'last_contacted_at',
    'converted_at',
    'converted_org_id',
    'follow_up_due_at',
    'next_action',
    'lead_notes',
    'internal_notes',
  ];

  const date = new Date().toISOString().slice(0, 10);
  const format = searchParams.get('format') ?? 'xlsx';

  function buildCellValues(row: LeadExportRow): (string | null)[] {
    return [
      row.created_at,
      row.name,
      row.email,
      row.organization_name,
      row.role,
      row.sports,
      row.plan_interest.map(plan => EARLY_ACCESS_PLAN_LABELS[plan] ?? plan).join('; ') || null,
      row.features_interested.map(feature => EARLY_ACCESS_FEATURE_LABELS[feature] ?? feature).join('; ') || null,
      isEarlyAccessStatus(row.internal_status)
        ? EARLY_ACCESS_STATUS_LABELS[row.internal_status]
        : row.internal_status,
      row.release_notifications_consent ? 'yes' : 'no',
      row.last_contacted_at,
      row.converted_at,
      row.converted_org_id,
      row.follow_up_due_at,
      row.next_action,
      row.notes,
      row.internal_notes,
    ];
  }

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FieldLogicHQ';
    workbook.created = new Date();
    const ws = workbook.addWorksheet('Early Access Leads');

    const headerRow = ws.addRow(header);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

    rows.forEach(row => ws.addRow(buildCellValues(row).map(c => c ?? '')));

    ws.columns.forEach((col, i) => {
      const headerLen = (header[i] ?? '').length;
      let maxData = 0;
      rows.forEach(r => { const l = String(buildCellValues(r)[i] ?? '').length; if (l > maxData) maxData = l; });
      col.width = Math.min(Math.max(headerLen, maxData) + 2, 60);
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="early-access-leads-${date}.xlsx"`,
      },
    });
  }

  // Default: CSV
  const csv = [
    header.map(toCsvCell).join(','),
    ...rows.map(row => buildCellValues(row).map(toCsvCell).join(',')),
  ].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="early-access-leads-${date}.csv"`,
    },
  });
}, { route: '/api/platform-admin/early-access/export' });
