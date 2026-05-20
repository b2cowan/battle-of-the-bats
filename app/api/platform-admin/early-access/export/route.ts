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
  notes: string | null;
  internal_notes: string | null;
};

export async function GET(req: NextRequest) {
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
    'lead_notes',
    'internal_notes',
  ];

  const csv = [
    header.map(toCsvCell).join(','),
    ...rows.map(row => [
      row.created_at,
      row.name,
      row.email,
      row.organization_name,
      row.role,
      row.sports,
      row.plan_interest.map(plan => EARLY_ACCESS_PLAN_LABELS[plan] ?? plan),
      row.features_interested.map(feature => EARLY_ACCESS_FEATURE_LABELS[feature] ?? feature),
      isEarlyAccessStatus(row.internal_status)
        ? EARLY_ACCESS_STATUS_LABELS[row.internal_status]
        : row.internal_status,
      row.release_notifications_consent ? 'yes' : 'no',
      row.last_contacted_at,
      row.notes,
      row.internal_notes,
    ].map(toCsvCell).join(',')),
  ].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="early-access-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
