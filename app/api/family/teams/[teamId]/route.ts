import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import {
  ensureFamilyCalendarToken,
  getEnabledFamilyOrg,
  getTeamFamilyAccess,
  getVerifiedLinkForUserTeam,
  isVisibleToFamilies,
} from '@/lib/family-access';
import { getFamilyTeamView } from '@/lib/family-view';
import { resolveGuardianPayloadForLink } from '@/lib/family-guardian-view';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';

/**
 * A connected family's view of one team.
 *
 * Identity resolves SERVER-SIDE from the session: session → verified `family_links` row →
 * team → schedule. The `teamId` in the path is not trusted as authorization; it is only
 * used to select WHICH of this user's links to look for, and a user with no verified link
 * to it gets the same 404 a stranger gets.
 *
 * `staff` visibility is enforced inside `getFamilyTeamView`, so flipping the setting
 * removes the data rather than the button.
 */

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string }> },) => {
  const { teamId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const link = await getVerifiedLinkForUserTeam(user.id, teamId);
  if (!link) {
    // Covers all of: never asked, still waiting, declined, revoked, and someone else's
    // team. A pending requester learns their state from the join page, not from here.
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Re-checked on every read, not just at approval: a team whose entitlement lapses stops
  // serving families the same day, without anyone having to remember to revoke links.
  const org = await getEnabledFamilyOrg(link.orgId, teamId);
  if (!org) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const view = await getFamilyTeamView({ repTeamId: teamId, requireVisibility: 'families' });
  if (!view) {
    // The team exists and this family is connected — the coach has simply closed the
    // schedule to staff. A quiet state, never an error (plan §6.3).
    return NextResponse.json({ ok: true, state: 'hidden' });
  }

  // ── The tier boundary, at the one place it decides a response ──
  // The guardian payload is attached ONLY for a link whose role is literally 'guardian' AND
  // which carries a player. A follower cannot reach this branch — and because the guardian
  // payload is a separate shape rather than extra fields on `view`, a follower's response has
  // nowhere for child data to appear even if this check were wrong.
  const guardian = await resolveGuardianPayloadForLink(link, teamId);

  return NextResponse.json({ ok: true, state: 'open', view, role: link.role, guardian });
}, { route: '/api/family/teams/[teamId]' });

/** Mint this family's own calendar subscription URL. */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string }> },) => {
  const { teamId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const link = await getVerifiedLinkForUserTeam(user.id, teamId);
  if (!link) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const org = await getEnabledFamilyOrg(link.orgId, teamId);
  if (!org) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // A team closed to staff has no schedule to subscribe to; refuse rather than hand out a
  // token that would resolve to an empty calendar and look broken. One team row answers
  // that — building the whole schedule just to test it for null was loading every event of
  // the season and throwing it away.
  const access = await getTeamFamilyAccess(teamId);
  if (!access || !isVisibleToFamilies(access.scheduleVisibility)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const token = await ensureFamilyCalendarToken(link.id);
  const origin = resolveTrustedAppOrigin(req);
  return NextResponse.json({ ok: true, url: `${origin}/api/family/calendar/${token}` });
}, { route: '/api/family/teams/[teamId]' });
