import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 100;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(Math.max(parseInt(searchParams.get('limit')  ?? '20', 10), 1), MAX_LIMIT);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch public orgs (paginated) + total count in one query
    const { data: orgs, error: orgsError, count } = await supabase
      .from('organizations')
      .select('id, name, slug, logo_url', { count: 'exact' })
      .eq('is_public', true)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (orgsError) throw orgsError;
    if (!orgs?.length) {
      return NextResponse.json({ orgs: [], total: count ?? 0, hasMore: false });
    }

    const orgIds = orgs.map(o => o.id);

    // Fetch active tournaments for this batch, then counts (sequential — counts need tournament IDs)
    const { data: tournaments, error: tError } = await supabase
      .from('tournaments')
      .select('id, name, year, start_date, end_date, is_active, organization_id')
      .in('organization_id', orgIds)
      .eq('is_active', true);

    if (tError) throw tError;

    const tournamentIds = (tournaments || []).map(t => t.id);

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

    const result = orgs
      .map(org => {
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
      })
      .filter(o => o.tournament !== null);

    const total   = count ?? 0;
    const hasMore = offset + limit < total;

    return NextResponse.json({ orgs: result, total, hasMore });
  } catch (e: any) {
    console.error('Public tournaments API error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
