import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { readClubEmail, readSeasonHistory } from '@/lib/families-emails-log';
import { emailAllowance } from '@/lib/families-email';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isUuid } from '@/lib/utils';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * A house-league season's sent history (Club Tier Stage 9d-1, frame e; owner 9d1·3, 9d1·4, 9d1·7). Read by the people
 * who email the season — the season's email right, never the Families grant (9d1·2).
 *
 *   GET ?orgSlug — the season's own emails (typed, one-family, automatic notices), the old log apart and read-only, the
 *       season's allowance, and whether it has families at all (the empty states).
 *   GET ?orgSlug&send=<id> — one of the season's typed emails as sent, with the families it missed and who opted out.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const url = new URL(req.url);
  const ctx = await getAuthContextWithRole({ orgSlug: url.searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'email');
  if (err) return err;

  const { seasonId } = await params;
  // Ownership: every read below is by this season — the season must be this org's.
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const send = url.searchParams.get('send');
  if (send) {
    if (!isUuid(send)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const row = await readClubEmail(ctx!.org.id, send);
    // The season's door reads only its own emails.
    if (!row || row.seasonId !== seasonId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(row);
  }

  const [history, allowance, regs] = await Promise.all([
    readSeasonHistory(ctx!.org.id, seasonId),
    emailAllowance(ctx!.org.id, seasonId),
    supabaseAdmin.from('league_registrations').select('id', { count: 'exact', head: true }).eq('season_id', seasonId),
  ]);
  if (regs.error) throw regs.error;
  return NextResponse.json({
    season: { id: season.id, name: season.name, status: season.status },
    ...history, allowance, hasFamilies: (regs.count ?? 0) > 0,
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/emails/history' });
