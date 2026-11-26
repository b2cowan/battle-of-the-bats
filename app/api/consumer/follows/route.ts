/**
 * /api/consumer/follows
 *
 * POST — syncs a fan's follow to their ACCOUNT (fan_follows) so it travels across
 * devices. The follow button always writes device localStorage first (lib/follow.ts)
 * and then fire-and-forgets here — so this is additive, never a gate on the follow
 * itself. Anonymous callers get { linked: false } (200, not an error): their follow
 * stays device-only, which is the permanent anonymous path.
 *
 * Body: { action: 'follow' | 'unfollow', entityType?: 'team' | 'tournament' | 'org', … }
 *   - entityType defaults to 'team' (byte-stable with every shipped team-follow caller).
 *   - team       → { teamId, orgSlug?, tournamentSlug? }  (follow needs the slugs to validate)
 *   - tournament → { orgSlug, tournamentSlug }
 *   - org        → { orgSlug }
 *   Each follow validates the target is real + publicly-reachable before recording it (a follow
 *   must never resolve to a dead/hidden page): team → teamBelongsToTournament, tournament →
 *   resolveFollowableTournament, org → resolveFollowableOrgBySlug (the Phase-2 org-search predicate).
 *
 * GET — two shapes, discriminated by `?entity=`:
 *   - (no entity) ?orgSlug=&tournamentSlug= → this account's TEAM follows within that tournament,
 *     newest-first (N2 public-page hydration). Byte-stable with the shipped contract.
 *   - ?entity=tournament&orgSlug=&tournamentSlug=  → { following } for the whole-event strip.
 *   - ?entity=org&orgSlug=                         → { following } for the org-hero button.
 * Anonymous → { linked: false, … } (200). Never SW-cached (the /api/ lane is network-only) and
 * never server-rendered into public HTML — same identity rule as the account chip.
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import {
  followEntity,
  unfollowEntity,
  teamBelongsToTournament,
  resolveFollowableTournament,
  resolveTournamentIdForUnfollow,
  resolveOrgIdForUnfollow,
  getAccountFollowsForTournament,
  isUserFollowing,
  UUID_RE,
} from '@/lib/fan-follows';
import { resolveFollowableOrgBySlug } from '@/lib/directory';
import { withObservability } from '@/lib/observability';

const NO_STORE = { 'Cache-Control': 'no-store' };

export const GET = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  const url = new URL(req.url);
  const entity = url.searchParams.get('entity');
  const orgSlug = url.searchParams.get('orgSlug');
  const tournamentSlug = url.searchParams.get('tournamentSlug');

  // Phase-6 single-entity hydration (whole-event strip / org-hero button).
  if (entity === 'tournament' || entity === 'org') {
    if (!user) return NextResponse.json({ linked: false, following: false }, { headers: NO_STORE });
    if (!orgSlug) return NextResponse.json({ error: 'Missing orgSlug.' }, { status: 400 });

    let following = false;
    if (entity === 'tournament') {
      if (!tournamentSlug) return NextResponse.json({ error: 'Missing tournamentSlug.' }, { status: 400 });
      const t = await resolveFollowableTournament(orgSlug, tournamentSlug);
      following = t ? await isUserFollowing(user.id, 'tournament', t.id) : false;
    } else {
      const org = await resolveFollowableOrgBySlug(orgSlug);
      following = org ? await isUserFollowing(user.id, 'org', org.id) : false;
    }
    return NextResponse.json({ linked: true, following }, { headers: NO_STORE });
  }

  // Shipped shape: the account's team follows within one tournament (N2).
  if (!user) return NextResponse.json({ linked: false, follows: [] });
  if (!orgSlug || !tournamentSlug) {
    return NextResponse.json({ error: 'Missing orgSlug or tournamentSlug.' }, { status: 400 });
  }
  const follows = await getAccountFollowsForTournament(user.id, orgSlug, tournamentSlug);
  return NextResponse.json({ linked: true, follows }, { headers: NO_STORE });
}, { route: '/api/consumer/follows' });

export const POST = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  // Anonymous → device-only follow; nothing to write to an account. Not an error.
  if (!user) return NextResponse.json({ linked: false });

  let body: {
    action?: string;
    entityType?: string;
    teamId?: string;
    orgSlug?: string;
    tournamentSlug?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const entityType = body.entityType ?? 'team';
  const isFollow = body.action !== 'unfollow';
  const { teamId, orgSlug, tournamentSlug } = body;

  // ── Whole tournament ──────────────────────────────────────────────────────
  if (entityType === 'tournament') {
    if (!orgSlug || !tournamentSlug) {
      return NextResponse.json({ error: 'Missing orgSlug or tournamentSlug.' }, { status: 400 });
    }
    if (isFollow) {
      // Following requires the tournament to be publicly reachable (never a dead-link follow).
      const t = await resolveFollowableTournament(orgSlug, tournamentSlug);
      if (!t) return NextResponse.json({ error: 'Tournament not found.' }, { status: 404 });
      await followEntity({ userId: user.id, entityType: 'tournament', entityId: t.id, source: 'manual' });
      return NextResponse.json({ linked: true, following: true });
    }
    // Unfollowing resolves the id regardless of current visibility so an explicit unfollow always
    // deletes the row (a draft/private tournament must not leave a follow that resurrects later).
    const id = await resolveTournamentIdForUnfollow(orgSlug, tournamentSlug);
    if (id) await unfollowEntity(user.id, 'tournament', id);
    return NextResponse.json({ linked: true, following: false });
  }

  // ── Organization ──────────────────────────────────────────────────────────
  if (entityType === 'org') {
    if (!orgSlug) return NextResponse.json({ error: 'Missing orgSlug.' }, { status: 400 });
    if (isFollow) {
      const org = await resolveFollowableOrgBySlug(orgSlug);
      if (!org) return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
      await followEntity({ userId: user.id, entityType: 'org', entityId: org.id, source: 'manual' });
      return NextResponse.json({ linked: true, following: true });
    }
    const id = await resolveOrgIdForUnfollow(orgSlug);
    if (id) await unfollowEntity(user.id, 'org', id);
    return NextResponse.json({ linked: true, following: false });
  }

  // ── Team (default — shipped contract, byte-stable) ─────────────────────────
  if (!teamId || !UUID_RE.test(teamId)) {
    return NextResponse.json({ error: 'Missing or invalid teamId.' }, { status: 400 });
  }
  if (!isFollow) {
    await unfollowEntity(user.id, 'team', teamId);
    return NextResponse.json({ linked: true, following: false });
  }
  if (!orgSlug || !tournamentSlug) {
    return NextResponse.json({ error: 'Missing orgSlug or tournamentSlug.' }, { status: 400 });
  }
  const ok = await teamBelongsToTournament(orgSlug, tournamentSlug, teamId);
  if (!ok) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

  await followEntity({ userId: user.id, entityType: 'team', entityId: teamId, source: 'manual' });
  return NextResponse.json({ linked: true, following: true });
}, { route: '/api/consumer/follows' });
