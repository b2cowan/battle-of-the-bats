import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { divisionInSeason } from '@/lib/league-season-scope';
import { readDivisionBoard } from '@/lib/house-league-teams';
import { failedPlacementEmails, sendPlacementEmails } from '@/lib/house-league-placement-mail';
import { mintCoachTokens, sendCoachInvites } from '@/lib/house-league-coach-invite-mail';
import { publishRefusal } from '@/lib/house-league-teams-words';
import { formatTime } from '@/lib/utils';
import { utcToZonedInputs } from '@/lib/timezone';
import { withObservability } from '@/lib/observability';

/**
 * Publish one division's teams (Club Tier 9c, Part 4; rulings 9c·4, 9c·6, 9c·10). A fact first, an email second:
 *   1. `league_division_publish` writes, in one transaction, the division's published-at, one email row per family and
 *      the invites of the division's coaches who have none, refusing a stale window or a second press.
 *   2. Only then the family emails go (the batched sender's service mode) and each coach's invite.
 * A send that fails partway leaves the division published and the failures recorded; `resend` sends those again
 * ("Send the {n} again", copy §7.2).
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

  const body = await req.json().catch(() => ({}));
  const { action, divisionId } = body;
  if (!(await divisionInSeason(seasonId, divisionId))) {
    return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  }
  const org = { ...ctx!.org, slug: ctx!.org.slug };

  if (action === 'resend') {
    const failed = await failedPlacementEmails(divisionId);
    const outcome = await sendPlacementEmails(org, season, failed);
    return NextResponse.json({ ok: true, outcome });
  }

  if (action === 'publish') {
    const board = await readDivisionBoard(season, divisionId);
    if (!board) return NextResponse.json({ error: 'Division not found' }, { status: 404 });
    const division = board.division.name;
    // The coaches with no invite yet are invited now (9c·10); the raw tokens never leave this request.
    const waiting = board.teams.flatMap(t => t.coaches.filter(c => c.state === 'waiting').map(c => c.id));
    const tokens = mintCoachTokens(waiting);
    const { data, error } = await supabaseAdmin.rpc('league_division_publish', {
      p_org: ctx!.org.id, p_season: seasonId, p_division: divisionId, p_actor: ctx!.user.id,
      // The function answers a second press ('already') before a stale window ('changed').
      p_fingerprint: typeof body.fingerprint === 'string' ? body.fingerprint : '',
      p_coaches: tokens.ids, p_hashes: tokens.hashes,
    });
    if (error) throw new Error(`Publish didn't save: ${error.message}`);
    const result = (Array.isArray(data) ? data[0] : data) as {
      refusal: string | null; published_at: string | null; published_by: string | null; families: number; invited: string[] | null;
    };
    if (result.refusal === 'finished') {
      return NextResponse.json({ error: 'This season is finished. Reopen it to change it.', finished: true }, { status: 423 });
    }
    if (result.refusal === 'already') {
      const by = result.published_by ? await personName(result.published_by) : null;
      const at = result.published_at ? formatTime(utcToZonedInputs(result.published_at).time) : null;
      return NextResponse.json({ error: publishRefusal('already', { division, by, at }), code: 'already' }, { status: 409 });
    }
    if (result.refusal === 'changed') {
      return NextResponse.json({ error: publishRefusal('changed', { division }), code: 'changed' }, { status: 409 });
    }
    if (result.refusal === 'not_ready') {
      return NextResponse.json({ error: publishRefusal('notReady', { division }), code: 'notReady' }, { status: 409 });
    }

    // The facts are written. Now the emails: the families first, then the coaches.
    const { data: rows } = await supabaseAdmin.from('league_placement_emails').select('id')
      .eq('division_id', divisionId).eq('status', 'pending').eq('created_at', result.published_at!);
    const outcome = await sendPlacementEmails(org, season, (rows ?? []).map(r => r.id as string));
    const invitedIds = result.invited ?? [];
    const invited = await sendCoachInvites(org, season, invitedIds, tokens.raw);
    return NextResponse.json({ ok: true, publishedAt: result.published_at, families: result.families, outcome, invited });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/publish' });

/** The name the "already published" refusal says ("{Sam Lee} published …"). */
async function personName(userId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const meta = (data?.user?.user_metadata ?? {}) as Record<string, unknown>;
    return (typeof meta.full_name === 'string' && meta.full_name.trim()) || (typeof meta.name === 'string' && meta.name.trim())
      || data?.user?.email || null;
  } catch {
    return null;
  }
}
