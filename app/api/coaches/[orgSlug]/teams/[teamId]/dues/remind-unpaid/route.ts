import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getUnpaidDuesReminderTargets,
  type UnpaidDuesReminderTarget,
} from '@/lib/db';
import { sendEmail } from '@/lib/email';
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

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * "Haven't paid anything yet" reminder (Coaches Portal Phase 4 F1).
 *
 * Nudges the guardians of players who OWE dues but have recorded zero payments. Distinct from
 * the proximity reminder (`/dues/send-reminders`), which only emails when an installment falls
 * due within a few days — it would skip exactly these never-paid families. Body: `{ playerId? }`
 * — one player, or (omitted) every never-paid player. Requires money = write.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const playerId: string | undefined = typeof body.playerId === 'string' ? body.playerId : undefined;

  let targets = await getUnpaidDuesReminderTargets(teamId);
  if (playerId) targets = targets.filter(t => t.playerId === playerId);

  if (!targets.length) {
    return NextResponse.json({ emailsSent: 0, playersReminded: 0, playersMissingEmail: 0 });
  }

  const withEmail = targets.filter(t => t.guardianEmail);
  const playersMissingEmail = targets.length - withEmail.length;

  // Group by guardian email — one family with two never-paid players gets a single email.
  const byGuardian = new Map<string, UnpaidDuesReminderTarget[]>();
  for (const t of withEmail) {
    const list = byGuardian.get(t.guardianEmail!) ?? [];
    list.push(t);
    byGuardian.set(t.guardianEmail!, list);
  }

  let emailsSent = 0;
  let playersReminded = 0;
  const subject = `A reminder about player dues — ${team.name}`;

  for (const [email, items] of byGuardian) {
    const guardianFirst = items[0].guardianFirstName ?? 'there';
    const rows = items
      .map(
        i =>
          `<li style="margin-bottom:0.5rem;">
            <strong>${[i.playerFirstName, i.playerLastName].filter(Boolean).join(' ')}</strong> — ${fmt(i.outstanding)} outstanding
          </li>`,
      )
      .join('');

    const html = `
<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:2rem;">
  <p>Hi ${guardianFirst},</p>
  <p>Our records show no dues payments yet for the following player(s) on <strong>${team.name}</strong>:</p>
  <ul style="padding-left:1.25rem;">${rows}</ul>
  <p>If you've already sent payment, please disregard this note or let your coach know so we can update our records. Otherwise, please reach out to your coach to arrange payment.</p>
  <p style="color:rgba(0,0,0,0.5);font-size:0.85rem;margin-top:2rem;">FieldLogicHQ</p>
</div>`;

    await sendEmail(email, subject, html);
    emailsSent++;
    playersReminded += items.length;
  }

  return NextResponse.json({ emailsSent, playersReminded, playersMissingEmail });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/dues/remind-unpaid' });
