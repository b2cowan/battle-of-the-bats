import { NextRequest, NextResponse } from 'next/server';
import {
  EARLY_ACCESS_SELECT,
  parseEarlyAccessFilters,
  parseLimit,
  parseOffset,
} from '@/lib/early-access-admin';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(req.url);
  const filters = parseEarlyAccessFilters(searchParams);
  const limit = parseLimit(searchParams.get('limit'));
  const offset = parseOffset(searchParams.get('offset'));

  let query = supabaseAdmin
    .from('early_access_leads')
    .select(EARLY_ACCESS_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false });

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

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) {
    console.error('[platform-admin] early-access list error:', error);
    return NextResponse.json({ error: 'Unable to load early-access leads' }, { status: 500 });
  }

  return NextResponse.json({
    leads: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}
