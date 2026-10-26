import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isSendableGuardianEmail, normalizeGuardianEmail } from '@/lib/guardian-email';
import { issueCoachInvites } from '@/lib/house-league-coach-invite-mail';
import { withObservability } from '@/lib/observability';

/**
 * A house-league team's coaches (Club Tier 9c, copy §2; rulings 9c·1, 9c·10). A coach is a row with a first and last name
 * (the last optional; `name` is the two joined) and an email.
 *   · POST — add a coach. Before the division is published they are "Invited when you publish". After it, the add is
 *     held (`confirmed`, copy §2.1 "Send {Pat} the invite?") and the invite goes at once.
 *   · DELETE ?coachId= — remove them: they lose the team page at once; families aren't told.
 *   · PATCH { coachId, action: 'resend' } — "Send again" for an invite that expired or didn't send (a new 7-day link).
 */

async function teamOf(seasonId: string, teamId: string) {
  const { data } = await supabaseAdmin.from('league_teams')
    .select('id, name, division_id, league_divisions(teams_published_at)').eq('id', teamId).eq('season_id', seasonId).maybeSingle();
  if (!data) return null;
  const divisionRow = data.league_divisions as unknown as { teams_published_at: string | null } | { teams_published_at: string | null }[] | null;
  const division = Array.isArray(divisionRow) ? divisionRow[0] ?? null : divisionRow;
  return { id: data.id as string, name: data.name as string, published: !!division?.teams_published_at };
}

interface Scope {
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContextWithRole>>>;
  season: NonNullable<Awaited<ReturnType<typeof getLeagueSeasonById>>>;
  team: NonNullable<Awaited<ReturnType<typeof teamOf>>>;
  org: NonNullable<Awaited<ReturnType<typeof getAuthContextWithRole>>>['org'] & { slug: string };
}

/** Give these coaches a fresh invite and send it (only rows still a live, not-signed-in coach of this club). */
const invite = (p: Scope, coachIds: string[]) => issueCoachInvites(p.org, p.season, coachIds, p.ctx.user.id, { onlyNew: false });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string; teamId: string }> },) => {
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;
  const { seasonId, teamId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  const team = await teamOf(seasonId, teamId);
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  const p: Scope = { ctx: ctx!, season, team, org: { ...ctx!.org, slug: ctx!.org.slug } };
  const body = await req.json().catch(() => ({}));
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  // `name` stays the combined "First Last" every reader uses; the two parts ride beside it for the invite's sign-up page.
  const name = [firstName, lastName].filter(Boolean).join(' ');
  const email = normalizeGuardianEmail(typeof body.email === 'string' ? body.email : '');
  if (!firstName) return NextResponse.json({ error: 'Enter the coach’s first name.', field: 'name' }, { status: 400 });
  if (name.length > 120 || firstName.length > 120 || lastName.length > 120) {
    return NextResponse.json({ error: 'That name is too long.', field: 'name' }, { status: 400 });
  }
  if (!email || !isSendableGuardianEmail(email)) {
    return NextResponse.json({ error: 'Enter an email address, like name@example.com.', field: 'email' }, { status: 400 });
  }
  const { data: dupe } = await supabaseAdmin.from('league_team_coaches').select('id')
    .eq('team_id', p.team.id).eq('email', email).is('removed_at', null).maybeSingle();
  if (dupe) return NextResponse.json({ error: `${name} is already a coach of this team.`, field: 'email' }, { status: 409 });
  // After publishing an add tells someone: it is held until the convenor confirms (copy §2.1, house rule "create asks").
  if (p.team.published && body.confirmed !== true) {
    return NextResponse.json({ code: 'confirm', error: `Send ${firstName} the invite?` }, { status: 409 });
  }
  const { data: row, error } = await supabaseAdmin.from('league_team_coaches').insert({
    team_id: p.team.id, org_id: p.ctx.org.id, season_id: p.season.id, name, first_name: firstName, last_name: lastName || null, email, created_by: p.ctx.user.id,
  }).select('id').single();
  if (error || !row) return NextResponse.json({ error: 'That coach didn’t save. Try again.' }, { status: 500 });
  const invited = p.team.published ? await invite(p, [row.id]) : [];
  return NextResponse.json({ ok: true, coachId: row.id, invited });
}, { route: '/api/admin/house-league/seasons/[seasonId]/teams/[teamId]/coaches' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string; teamId: string }> },) => {
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;
  const { seasonId, teamId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  const team = await teamOf(seasonId, teamId);
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  const p: Scope = { ctx: ctx!, season, team, org: { ...ctx!.org, slug: ctx!.org.slug } };
  const body = await req.json().catch(() => ({}));
  if (body.action !== 'resend' || typeof body.coachId !== 'string') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  if (!p.team.published) {
    return NextResponse.json({ error: 'The invite goes when you publish.' }, { status: 409 });
  }
  const { data: coach } = await supabaseAdmin.from('league_team_coaches').select('id, accepted_at')
    .eq('id', body.coachId).eq('team_id', p.team.id).is('removed_at', null).maybeSingle();
  if (!coach) return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
  if (coach.accepted_at) return NextResponse.json({ error: 'They already signed in.' }, { status: 409 });
  const invited = await invite(p, [coach.id]);
  return NextResponse.json({ ok: true, invited });
}, { route: '/api/admin/house-league/seasons/[seasonId]/teams/[teamId]/coaches' });

export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string; teamId: string }> },) => {
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;
  const { seasonId, teamId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  const team = await teamOf(seasonId, teamId);
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  const p: Scope = { ctx: ctx!, season, team, org: { ...ctx!.org, slug: ctx!.org.slug } };
  const coachId = new URL(req.url).searchParams.get('coachId');
  if (!coachId) return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
  const { data, error } = await supabaseAdmin.from('league_team_coaches')
    .update({ removed_at: new Date().toISOString(), token_hash: null })
    .eq('id', coachId).eq('team_id', p.team.id).is('removed_at', null).select('id');
  if (error) return NextResponse.json({ error: 'That didn’t save. Try again.' }, { status: 500 });
  if ((data ?? []).length === 0) return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/teams/[teamId]/coaches' });
