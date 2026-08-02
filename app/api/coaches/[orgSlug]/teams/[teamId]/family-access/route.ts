import { NextResponse } from 'next/server';
import { denyUnless } from '@/lib/coach-capabilities';
import { resolveFamilyCoachContext } from '@/lib/family-coach-route';
import { withObservability } from '@/lib/observability';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';
import {
  FOLLOWER_SAFETY_CEILING,
  SCHEDULE_VISIBILITIES,
  getFamilyAdoptionCounts,
  getTeamFamilyAccess,
  listTeamFamilyLinks,
  resetTeamFamilyLink,
  setScheduleVisibility,
  type ScheduleVisibility,
} from '@/lib/family-access';

/**
 * Coach-side family access: the team's link, its schedule visibility, and its followers.
 *
 * ⚠ LIVE SEASON ONLY — deliberately does NOT import `lib/coach-season-read.ts`. Family
 * access is an INSTRUMENT (it configures who may reach the team right now), not a record,
 * so under the archive's opt-in rule it must not be addressable in a past season. Because
 * this route never joins the season-read rail it resolves the team's active state and
 * cannot address an archived one — the fail-closed default doing its job. It must never
 * appear in `APPROVED_SEASON_AWARE_ROUTES`.
 *
 * Permission: `rosterPii`. This panel surfaces guardian/family email addresses, which is
 * exactly the capability an assistant is (by default) not granted.
 */


/** The panel's whole payload: settings, the follower list, and the waiting queue. */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveFamilyCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;

  const denied = denyUnless(assignment.capabilities.rosterPii, 'You do not have access to family contacts for this team.');
  if (denied) return denied;

  const [access, links, counts] = await Promise.all([
    getTeamFamilyAccess(teamId),
    listTeamFamilyLinks(teamId),
    getFamilyAdoptionCounts({ repTeamId: teamId }),
  ]);
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const followers = links.filter(l => l.role === 'follower');
  return NextResponse.json({
    ok: true,
    access: {
      scheduleVisibility: access.scheduleVisibility,
      hasFamilyLink: access.hasFamilyLink,
      familyLinkCreatedAt: access.familyLinkCreatedAt,
      followerCeiling: FOLLOWER_SAFETY_CEILING,
    },
    followers: followers
      .filter(l => l.status === 'verified')
      .map(l => ({
        id: l.id, email: l.invitedEmail, relationship: l.relationship, approvedAt: l.approvedAt,
      })),
    requests: followers
      .filter(l => l.status === 'requested' || l.status === 'pending_approval')
      .map(l => ({
        id: l.id, email: l.invitedEmail, relationship: l.relationship, requestedAt: l.createdAt,
      })),
    counts,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/family-access' });

/**
 * Mint (or reset) the team family link.
 *
 * The raw URL is returned exactly once, here. Resetting overwrites the stored hash, which
 * kills every previously-shared copy at the same instant — the honest meaning of "reset"
 * when a coach tells you the link went further than they meant it to.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveFamilyCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;

  const denied = denyUnless(assignment.capabilities.rosterPii, 'You do not have access to family contacts for this team.');
  if (denied) return denied;

  const token = await resetTeamFamilyLink({ repTeamId: teamId, userId: ctx.user.id });
  const origin = resolveTrustedAppOrigin(req);
  return NextResponse.json({ ok: true, url: `${origin}/family/join/${token}` });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/family-access' });

/** Change the team's schedule visibility. */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveFamilyCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;

  const denied = denyUnless(assignment.capabilities.rosterPii, 'You do not have access to family contacts for this team.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const visibility = body?.scheduleVisibility;
  if (!SCHEDULE_VISIBILITIES.includes(visibility)) {
    return NextResponse.json({ error: 'bad_visibility' }, { status: 400 });
  }

  await setScheduleVisibility({ repTeamId: teamId, visibility: visibility as ScheduleVisibility });
  return NextResponse.json({ ok: true, scheduleVisibility: visibility });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/family-access' });
