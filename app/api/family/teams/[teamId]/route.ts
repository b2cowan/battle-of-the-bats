import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import { getEnabledFamilyOrg, getVerifiedLinkForUserTeam } from '@/lib/family-access';
import { getFamilyTeamView } from '@/lib/family-view';
import { resolveGuardianPayloadForLink } from '@/lib/family-guardian-view';

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
    // A parent whose child's season on this team has CLOSED is still connected (Stage 14 S6: a link follows the child) — the
    // quiet state, as before, not a 404.
    if (await getVerifiedLinkForUserTeam(user.id, teamId, 'recap')) return NextResponse.json({ ok: true, state: 'hidden' });
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

  // ── The boundary, at the one place it decides a response ──
  // The guardian payload is attached ONLY for a link whose role is literally 'guardian' AND
  // which carries a player. Because it is a separate shape rather than extra fields on `view`,
  // a response without one has nowhere for child data to appear even if this check were wrong.
  // (Written against the follower tier, retired 2026-09-12; kept because it fails closed.)
  const guardian = await resolveGuardianPayloadForLink(link, teamId);

  return NextResponse.json({ ok: true, state: 'open', view, role: link.role, guardian });
}, { route: '/api/family/teams/[teamId]' });

/* (Stage 4a Part 7, ruling 6) The per-link calendar mint that lived here (POST) is gone: a parent has ONE calendar address,
   made on the family page (app/api/family/calendar). Existing per-link tokens still answer at /api/family/calendar/[token]. */
