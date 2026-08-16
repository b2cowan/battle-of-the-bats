import { NextResponse } from 'next/server';
import {
  getCoachTeamMilestones,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';

/**
 * The Overview progress trail's data (Coach Portal Batch 2, P0 #6) — "which first-week milestones
 * has this team actually reached".
 *
 * Capability-aware by design: a step a coach can't act on is returned as `null`, not `false`, so
 * the trail can drop it entirely rather than showing a restricted assistant a permanently-unlit
 * dot for money they're not allowed to see. Any coach assigned to the team may read the rest —
 * these are counts of their own team's work, and every underlying page is already reachable.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear } = resolved;

  const m = await getCoachTeamMilestones(programYear.id, teamId);
  const caps = capabilities;

  return NextResponse.json({
    milestones: {
      hasLineup: caps.lineups ? m.hasLineup : null,
      hasSentAnnouncement: caps.announcementsSend ? m.hasSentAnnouncement : null,
      moneyStarted: caps.money !== 'off' ? m.moneyStarted : null,
      // Only the head coach invites assistants or manages the document library, so these steps
      // are meaningless (and unreachable) for an assistant.
      assistants: caps.isHeadCoach ? m.assistants : null,
      teamDocuments: caps.documents === 'manage' || caps.isHeadCoach ? m.teamDocuments : null,
    },
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/milestones' });
