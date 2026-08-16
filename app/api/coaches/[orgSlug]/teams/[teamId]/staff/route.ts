import { NextResponse } from 'next/server';
import { resolveCoachCapabilities } from '@/lib/coach-capabilities';
import { requireHeadCoachMembership, getTeamStaffPanelList } from '@/lib/coach-membership';
import { withObservability } from '@/lib/observability';
import { listVerifiedFamilyEmails } from '@/lib/family-access';
import { normalizeGuardianEmail } from '@/lib/guardian-email';

// GET /api/coaches/[orgSlug]/teams/[teamId]/staff — THE team's staff (M1: one list, no season
// dimension) + each member's effective capabilities, for the head coach's manage panel.
// Head coach only. Seasons' staff RECORDS are separate (`rep_team_coaches`) and not served here.
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const gate = await requireHeadCoachMembership(orgSlug, teamId);
  if ('error' in gate) return gate.error;
  const { ctx } = gate;

  /**
   * ⚠ **A LABEL, NOT A JOIN** (owner ruling 2026-08-03 — "leave the model alone").
   *
   * The same adult can be staff AND connected to the team as a family member, as two unrelated
   * records that nothing connects. The owner ruled that separation is CORRECT and declined a merge
   * or a combined "people" view: the two relationships run in opposite directions of trust, carry
   * different consent, and stay auditable precisely because one file answers "who is in?" and a
   * different one answers "what do they see?".
   *
   * So this is deliberately the weakest possible thing that helps: **one boolean, computed here by
   * comparing normalised email addresses, joining no data and offering no action.** It exists for
   * one reason — the removal confirmation used to promise access ended "immediately", which is
   * FALSE for someone who also follows the team, and the head coach most likely to read that line
   * carefully is the one removing someone after a problem.
   *
   * ⚠ Non-fatal on purpose: a team whose org has no family layer, or a failed lookup, must not take
   * the whole staff panel down.
   *
   * ⚠ **BUT NOT SILENT.** Swallowing a failure to an empty Set makes every member come back "not
   * connected" — and a dialog that then asserted "loses access to this team" would be back to
   * stating the exact falsehood this feature exists to delete. Two defences: the failure is LOGGED
   * rather than vanishing (this route still returns 200, so `withObservability` would never see
   * it), and the dialog's base sentence is scoped to *coaching* access, so it stays true even when
   * this comes back wrongly empty. **A `false` from here means "not known to be", never "isn't".**
   *
   * ⚠ Runs ALONGSIDE the staff read, not after it: the two are independent, and serialising them
   * charged every open of this panel an extra round trip for a label.
   */
  const [staff, familyEmails] = await Promise.all([
    getTeamStaffPanelList(teamId, ctx.org.id),
    listVerifiedFamilyEmails(teamId).catch((err) => {
      console.error('[staff] family-connection lookup failed; labels omitted for this load', err);
      return new Set<string>();
    }),
  ]);

  const alsoFollows = (email: string | null): boolean => {
    const normalized = normalizeGuardianEmail(email);
    return !!normalized && familyEmails.has(normalized);
  };

  return NextResponse.json({
    staff: staff.map(m => ({
      memberId: m.id,
      userId: m.userId,
      coachRole: m.coachRole,
      displayName: m.displayName,
      email: m.email,
      // The current effective grant per area (head coach = full), so the grid renders live state.
      capabilities: resolveCoachCapabilities(m.coachRole, m.capabilities),
      isSelf: m.userId === ctx.user.id,
      alsoFollowsTeam: alsoFollows(m.email),
    })),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff' });
