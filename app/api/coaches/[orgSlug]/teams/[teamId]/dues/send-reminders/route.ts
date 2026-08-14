import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getDueReminderCandidates,
  markInstallmentsReminderSent,
  markInstallments30ReminderSent,
  markInstallments7ReminderSent,
} from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { duesReminderEmail } from '@/lib/dues-reminder-email';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';

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

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const window: 30 | 7 | undefined = body.window === 30 ? 30 : body.window === 7 ? 7 : undefined;

  // Automated reminder windows: respect coach toggle
  if (window !== undefined && !programYear.autoRemindersEnabled) {
    return NextResponse.json({ remindersChecked: 0, emailsSent: 0, installmentsTagged: 0, skipped: true });
  }

  const daysAhead = window === 30 ? 32 : window === 7 ? 9 : 3;
  const candidates = await getDueReminderCandidates(teamId, daysAhead, window);

  if (!candidates.length) {
    return NextResponse.json({ remindersChecked: 0, emailsSent: 0, installmentsTagged: 0 });
  }

  // Group by guardian email; skip candidates with no guardian email
  const byGuardian = new Map<string, typeof candidates>();
  for (const c of candidates) {
    if (!c.guardianEmail) continue;
    const list = byGuardian.get(c.guardianEmail) ?? [];
    list.push(c);
    byGuardian.set(c.guardianEmail, list);
  }

  let emailsSent = 0;
  const taggedIds: string[] = [];

  for (const [email, items] of byGuardian) {
    const first = items[0];
    const guardianFirst = first.guardianFirstName ?? 'there';

    // ONE template (lib/dues-reminder-email.ts) — shared with the sweep, the org-admin route,
    // and the on-screen "See an example" preview, so the sample a coach reads is the send.
    const { subject, html } = duesReminderEmail({
      teamName: team.name,
      window: window ?? null,
      guardianFirst,
      items,
    });

    await sendEmail(email, subject, html);
    emailsSent++;
    for (const i of items) taggedIds.push(i.installmentId);
  }

  if (taggedIds.length) {
    if (window === 30) {
      await markInstallments30ReminderSent(taggedIds);
    } else if (window === 7) {
      await markInstallments7ReminderSent(taggedIds);
    } else {
      await markInstallmentsReminderSent(taggedIds);
    }
  }

  return NextResponse.json({
    remindersChecked: candidates.length,
    emailsSent,
    installmentsTagged: taggedIds.length,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/dues/send-reminders' });
