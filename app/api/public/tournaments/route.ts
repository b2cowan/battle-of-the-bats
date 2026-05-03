import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch public orgs
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, slug, logo_url')
      .eq('is_public', true);

    if (orgsError) throw orgsError;
    if (!orgs?.length) return NextResponse.json({ orgs: [] });

    const orgIds = orgs.map(o => o.id);

    // Fetch active tournaments for those orgs + counts (parallel)
    const [
      { data: tournaments, error: tError },
      { data: ageGroups,   error: agError },
    ] = await Promise.all([
      supabase
        .from('tournaments')
        .select('id, name, year, start_date, end_date, is_active, organization_id')
        .in('organization_id', orgIds)
        .eq('is_active', true),
      // Placeholder — resolved after we have tournament IDs below
      Promise.resolve({ data: null, error: null }),
    ]);

    if (tError) throw tError;

    const tournamentIds = (tournaments || []).map(t => t.id);

    // Now fetch counts with tournament IDs in hand
    const [{ data: agRows, error: agErr }, { data: teamRows, error: teErr }] =
      await Promise.all([
        supabase
          .from('age_groups')
          .select('tournament_id')
          .in('tournament_id', tournamentIds),
        supabase
          .from('teams')
          .select('tournament_id')
          .in('tournament_id', tournamentIds)
          .eq('status', 'accepted'),
      ]);

    if (agErr) throw agErr;
    if (teErr) throw teErr;

    // Build lookup maps
    const tournamentByOrg: Record<string, (typeof tournaments)[0]> = {};
    for (const t of tournaments || []) {
      tournamentByOrg[t.organization_id] = t;
    }

    const agCount: Record<string, number> = {};
    for (const row of agRows || []) {
      agCount[row.tournament_id] = (agCount[row.tournament_id] ?? 0) + 1;
    }

    const teamCount: Record<string, number> = {};
    for (const row of teamRows || []) {
      teamCount[row.tournament_id] = (teamCount[row.tournament_id] ?? 0) + 1;
    }

    const result = orgs.map(org => {
      const t = tournamentByOrg[org.id] ?? null;
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logo_url ?? null,
        tournament: t
          ? {
              name: t.name,
              year: t.year,
              startDate: t.start_date,
              endDate: t.end_date,
              isActive: t.is_active,
            }
          : null,
        ageGroupCount: t ? (agCount[t.id] ?? 0) : 0,
        teamCount:     t ? (teamCount[t.id] ?? 0) : 0,
      };
    });

    // Only return orgs that have an active tournament
    return NextResponse.json({ orgs: result.filter(o => o.tournament !== null) });
  } catch (e: any) {
    console.error('Public tournaments API error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
