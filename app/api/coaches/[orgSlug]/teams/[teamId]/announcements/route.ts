import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
} from '@/lib/db';
import {
  REP_TEAM_ANNOUNCEMENT_NO_RECIPIENTS_ERROR,
  REP_TEAM_ANNOUNCEMENT_RATE_LIMIT_ERROR,
  REP_TEAM_ANNOUNCEMENT_RECIPIENT_LIMIT_ERROR,
  getRepTeamAnnouncementRecipientSummary,
  getRepTeamAnnouncements,
  normalizeRepTeamAnnouncementBody,
  sendRepTeamAnnouncement,
} from '@/lib/rep-team-announcements';
import { denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

function validationError(error: unknown): string | null {
  const message = error instanceof Error ? error.message : '';
  return [
    'A subject is required.',
    'A message is required.',
    REP_TEAM_ANNOUNCEMENT_NO_RECIPIENTS_ERROR,
    REP_TEAM_ANNOUNCEMENT_RECIPIENT_LIMIT_ERROR,
    REP_TEAM_ANNOUNCEMENT_RATE_LIMIT_ERROR,
  ].includes(message)
    ? message
    : null;
}

/** List the recent announcement log + current recipient summary (coach only). */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { programYear } = resolved;

  const [announcements, recipientSummary] = await Promise.all([
    getRepTeamAnnouncements(programYear.id),
    getRepTeamAnnouncementRecipientSummary(programYear.id),
  ]);
  return NextResponse.json({ ok: true, announcements, recipientSummary });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/announcements' });

/** Send a one-way announcement to the active roster's guardian emails (coach only). */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.announcementsSend, 'Only the head coach can send announcements. You can draft one for the head coach to send.');
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { input, error } = normalizeRepTeamAnnouncementBody(body);
    if (error) return NextResponse.json({ error }, { status: 400 });
    if (!input.subject) return NextResponse.json({ error: 'A subject is required.' }, { status: 400 });
    if (!input.body) return NextResponse.json({ error: 'A message is required.' }, { status: 400 });

    const result = await sendRepTeamAnnouncement({
      orgId: ctx.org.id,
      teamId,
      programYearId: programYear.id,
      teamName: team.name,
      createdByUserId: ctx.user.id,
      input,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = validationError(error);
    if (message) return NextResponse.json({ error: message }, { status: 400 });
    console.error('[rep team announcements POST] error:', error);
    return NextResponse.json({ error: 'Could not send the announcement.' }, { status: 500 });
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/announcements' });
