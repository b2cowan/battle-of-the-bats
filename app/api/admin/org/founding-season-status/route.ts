import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isFoundingSeasonCompExpiry } from '@/lib/plan-config';
import { withObservability } from '@/lib/observability';

/**
 * GET /api/admin/org/founding-season-status
 *
 * Returns whether this org has an active founding season comp_period override.
 * Founding Season = a comp_period whose expires_at falls on FOUNDING_SEASON_END's calendar date
 * (auto-assigned at signup while the signup window is open — see lib/plan-config.ts).
 */
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true });
  if (!ctx) return unauthorized();

  const { data } = await supabaseAdmin
    .from('org_overrides')
    .select('expires_at')
    .eq('org_id', ctx.org.id)
    .eq('type', 'comp_period')
    .is('revoked_at', null)
    .gte('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ isFoundingSeason: false, compUntil: null });
  }

  const compUntil = data.expires_at as string;
  const isFoundingSeason = isFoundingSeasonCompExpiry(compUntil);

  return NextResponse.json({ isFoundingSeason, compUntil });
}, { route: '/api/admin/org/founding-season-status' });
