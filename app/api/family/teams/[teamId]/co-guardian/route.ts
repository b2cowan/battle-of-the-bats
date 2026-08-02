import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';
import { FamilyLinkError, getEnabledFamilyOrg, getVerifiedLinkForUserTeam } from '@/lib/family-access';
import { GUARDIAN_TIER_ENABLED, inviteCoGuardian } from '@/lib/family-guardian';

/**
 * A verified guardian invites the OTHER household's adult (ruling #17's two-household case).
 *
 * The roster carries one guardian email, so without this the second household silently never
 * learns the feature exists — a common family shape, treated as a design input rather than an
 * afterthought.
 *
 * Scoped entirely to the caller's own link: the player comes from THEIR verified row, never
 * from the request body, so this cannot be used to attach an adult to someone else's child.
 * The cap of two still applies, and the coach sees and can revoke the resulting link like any
 * other.
 */

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string }> },) => {
  const { teamId } = await params;

  if (!GUARDIAN_TIER_ENABLED) {
    return NextResponse.json({ error: 'guardian_tier_unavailable' }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const link = await getVerifiedLinkForUserTeam(user.id, teamId);
  // Followers are refused here as flatly as strangers: inviting a co-guardian is a
  // guardian-tier act, and a follower has no player to invite anyone to.
  if (!link || link.role !== 'guardian') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (!(await getEnabledFamilyOrg(link.orgId, teamId))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === 'string' ? body.email : '';
  if (!email) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  try {
    const { token } = await inviteCoGuardian({ userId: user.id, repTeamId: teamId, email });
    const origin = resolveTrustedAppOrigin(req);
    return NextResponse.json({ ok: true, url: `${origin}/family/claim/${token}` });
  } catch (e) {
    if (e instanceof FamilyLinkError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: 409 });
    }
    throw e;
  }
}, { route: '/api/family/teams/[teamId]/co-guardian' });
