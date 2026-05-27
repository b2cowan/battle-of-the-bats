import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/admin/org/founding-season-status
 *
 * Returns whether this org has an active founding season comp_period override.
 * Founding season = comp_period expires_at = 2027-01-01 (auto-assigned at signup through Dec 31, 2026).
 */
export async function GET(req: Request) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug });
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
  // Founding season specifically = comp_period expiring on 2027-01-01
  const isFoundingSeason = compUntil.startsWith('2027-01-01');

  return NextResponse.json({ isFoundingSeason, compUntil });
}
