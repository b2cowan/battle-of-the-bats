/**
 * POST /api/consumer/follows
 *
 * Syncs a fan's follow to their ACCOUNT (fan_follows) so it travels across devices.
 * The follow button always writes device localStorage first (lib/follow.ts) and then
 * fire-and-forgets here — so this is additive, never a gate on the follow itself.
 * Anonymous callers get { linked: false } (200, not an error): their follow stays
 * device-only, which is the permanent anonymous path.
 *
 * Body: { action: 'follow' | 'unfollow', teamId, orgSlug?, tournamentSlug? }
 *   - follow requires orgSlug + tournamentSlug (to validate the team belongs there)
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getOrganizationBySlug, getPublicTournamentBySlug } from '@/lib/db';
import { followEntity, unfollowEntity } from '@/lib/fan-follows';
import { withObservability } from '@/lib/observability';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only if `teamId` is a real team in the tournament named by the slugs (public, live org). */
export async function teamBelongsToTournament(
  orgSlug: string,
  tournamentSlug: string,
  teamId: string,
): Promise<boolean> {
  if (!UUID_RE.test(teamId)) return false;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org || org.subscriptionStatus === 'canceled') return false;
  const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
  if (!tournament) return false;
  const { data } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('tournament_id', tournament.id)
    .maybeSingle();
  return !!data;
}

export const POST = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  // Anonymous → device-only follow; nothing to write to an account. Not an error.
  if (!user) return NextResponse.json({ linked: false });

  let body: { action?: string; teamId?: string; orgSlug?: string; tournamentSlug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { action, teamId, orgSlug, tournamentSlug } = body;
  if (!teamId || !UUID_RE.test(teamId)) {
    return NextResponse.json({ error: 'Missing or invalid teamId.' }, { status: 400 });
  }

  if (action === 'unfollow') {
    await unfollowEntity(user.id, 'team', teamId);
    return NextResponse.json({ linked: true, following: false });
  }

  // Default action = follow (validate the team is real before recording it).
  if (!orgSlug || !tournamentSlug) {
    return NextResponse.json({ error: 'Missing orgSlug or tournamentSlug.' }, { status: 400 });
  }
  const ok = await teamBelongsToTournament(orgSlug, tournamentSlug, teamId);
  if (!ok) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

  await followEntity({ userId: user.id, entityType: 'team', entityId: teamId, source: 'manual' });
  return NextResponse.json({ linked: true, following: true });
}, { route: '/api/consumer/follows' });
