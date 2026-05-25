import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLeagueSeasons, getLeagueSeasonSummary } from '@/lib/db';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

export async function GET() {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const seasons = await getLeagueSeasons(ctx!.org.id);
  const summaries = await Promise.all(seasons.map(s => getLeagueSeasonSummary(s)));
  return NextResponse.json({ seasons: summaries });
}

export async function POST(req: Request) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const body = await req.json();

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';

  if (!name || name.length > 120) {
    return NextResponse.json(
      { error: 'name is required and must be 120 characters or fewer' },
      { status: 400 },
    );
  }
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: 'slug must contain only lowercase letters, numbers, and hyphens' },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('league_seasons')
    .insert({
      org_id:                       ctx!.org.id,
      name,
      slug,
      sport:                        typeof body.sport === 'string' && body.sport ? body.sport : 'softball',
      division:                    typeof body.division === 'string' && body.division ? body.division : null,
      description:                  typeof body.description === 'string' && body.description ? body.description : null,
      registration_fee:             typeof body.registrationFee === 'number' ? body.registrationFee : null,
      auto_generate_fees:           body.autoGenerateFees === true,
      auto_approve_under_capacity:  body.autoApproveUnderCapacity === true,
      auto_promote_waitlist:        body.autoPromoteWaitlist === true,
      registration_open_at:         typeof body.registrationOpenAt === 'string' && body.registrationOpenAt ? body.registrationOpenAt : null,
      registration_close_at:        typeof body.registrationCloseAt === 'string' && body.registrationCloseAt ? body.registrationCloseAt : null,
      season_start_date:            typeof body.seasonStartDate === 'string' && body.seasonStartDate ? body.seasonStartDate : null,
      season_end_date:              typeof body.seasonEndDate === 'string' && body.seasonEndDate ? body.seasonEndDate : null,
      waiver_text:                  typeof body.waiverText === 'string' && body.waiverText ? body.waiverText : null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A season with this slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
