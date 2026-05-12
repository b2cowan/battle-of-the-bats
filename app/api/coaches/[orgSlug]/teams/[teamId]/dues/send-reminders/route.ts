// AWS EventBridge Scheduler (daily 9 AM) — invoke this endpoint as a cron target:
// aws scheduler create-schedule \
//   --name "fieldlogichq-dues-reminders" \
//   --schedule-expression "cron(0 9 * * ? *)" \
//   --target '{"Arn":"<lambda-or-api-arn>","RoleArn":"<role-arn>","Input":"{}"}' \
//   --flexible-time-window '{"Mode":"OFF"}'

import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getDueReminderCandidates,
  markInstallmentsReminderSent,
} from '@/lib/db';
import { sendEmail } from '@/lib/email';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext();
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

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-CA', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },
) {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { team } = resolved;

  const candidates = await getDueReminderCandidates(teamId, 3);

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

    const rows = items
      .map(
        i =>
          `<li style="margin-bottom:0.5rem;">
            <strong>${i.playerFirstName} ${i.playerLastName}</strong> — ${fmt(i.amount)} due ${fmtDate(i.dueDate)}
            (Installment ${i.installmentNumber} of ${i.totalInstallments})
          </li>`,
      )
      .join('');

    const html = `
<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:2rem;">
  <p>Hi ${guardianFirst},</p>
  <p>This is a friendly reminder that the following dues installments are coming up for your player(s) on <strong>${team.name}</strong>:</p>
  <ul style="padding-left:1.25rem;">${rows}</ul>
  <p>To view your full payment schedule or if you have already submitted payment, please contact your coach directly.</p>
  <p style="color:rgba(0,0,0,0.5);font-size:0.85rem;margin-top:2rem;">FieldLogicHQ</p>
</div>`;

    await sendEmail(email, `Reminder: Player dues due soon — ${team.name}`, html);
    emailsSent++;
    for (const i of items) taggedIds.push(i.installmentId);
  }

  if (taggedIds.length) {
    await markInstallmentsReminderSent(taggedIds);
  }

  return NextResponse.json({
    remindersChecked: candidates.length,
    emailsSent,
    installmentsTagged: taggedIds.length,
  });
}
