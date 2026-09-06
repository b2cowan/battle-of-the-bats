import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getUnpaidDuesReminderTargets,
  markInstallmentsReminderSent,
  type UnpaidDuesReminderTarget,
} from '@/lib/db';
import { sendEmail, escapeHtml as esc } from '@/lib/email';
import { duesReminderFooterHtml } from '@/lib/dues-reminder-email';
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
 * Nudges the guardian of ONE player who OWES dues but has recorded zero payments. Distinct from
 * the proximity reminder (`/dues/send-reminders`), which only emails when an installment falls
 * due within a few days — it would skip exactly this never-paid family. Body: `{ playerId }`,
 * required. Requires money = write.
 *
 * ⚠ THERE IS NO WHOLE-TEAM SEND HERE, AND THERE IS NOT MEANT TO BE (owner ruling 2026-09-03).
 * An omitted `playerId` used to mean "every never-paid player", behind a "Remind all N" button on
 * a chase card above the dues table. Both were deleted: chasing the whole team is already served
 * twice over — automatic reminders cover everyone on the 30-day and 7-day waves, and "Send due
 * reminders" emails everyone outstanding on demand. A third bulk send that deliberately targeted
 * families who had paid NOTHING added nothing those two do not, and the button cost a permanent
 * band on the screen. What survives is the single-family nudge, from that player's own panel.
 * Re-adding the branch means re-arguing the ruling, not restoring a convenience.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const playerId: string = typeof body.playerId === 'string' ? body.playerId : '';
  // ⚠ REFUSE rather than fan out. Defaulting a missing id to "everyone" is exactly the branch the
  // 2026-09-03 ruling removed, and a bulk send is not something to arrive at by accident.
  if (!playerId) {
    return NextResponse.json({ error: 'A playerId is required — this route nudges one family.' }, { status: 400 });
  }

  const targets = (await getUnpaidDuesReminderTargets(teamId)).filter(t => t.playerId === playerId);

  if (!targets.length) {
    return NextResponse.json({ emailsSent: 0, playersReminded: 0, playersMissingEmail: 0 });
  }

  /**
   * ⚠ THE COURTESY IS NOT THE OTHER ROUTE'S ALONE (owner ruling 2026-09-05, closing the call §140
   * left open as Part I2). One button — "Remind this family" — reaches two letters: a late family
   * gets the installment notice through `/dues/send-reminders`, which has honoured a seven-day
   * courtesy since it was built; a never-paid family gets THIS one, which honoured nothing. So the
   * same button, pressed twice on a Tuesday, was safe for one family and emailed the other's parent
   * twice — with no stamp left behind to show it had happened. Same column, same window, one rule.
   */
  if (targets.some(t => t.recentlyReminded)) {
    return NextResponse.json({ emailsSent: 0, playersReminded: 0, playersMissingEmail: 0, skippedRecent: true });
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

  // ⚠ THE FIFTH COPY. `lib/dues-reminder-email.ts` exists because three senders carried the dues
  // email byte-for-byte and drifted; this one was never folded in, and it drifted exactly as
  // predicted — it lost the escaping and never gained the sender identification. It shares the
  // FOOTER now, which is the part compliance depends on. The body still differs on purpose (this
  // notice is "nothing paid yet", not an installment schedule), so merging it fully would change
  // what a family reads and is a product decision, not a refactor. Do not add a sixth.

  for (const [email, items] of byGuardian) {
    const guardianFirst = items[0].guardianFirstName ?? 'there';
    // ⚠ Player and guardian names are people-entered text going into a third party's inbox, so
    // they are escaped — they were not until 2026-08-18, which made this the one dues notice a
    // typed-in name could inject markup into. The shared template has always escaped; this body
    // is hand-built (see the note above the send) and quietly missed it.
    const rows = items
      .map(
        i =>
          `<li style="margin-bottom:0.5rem;">
            <strong>${esc([i.playerFirstName, i.playerLastName].filter(Boolean).join(' '))}</strong> — ${fmt(i.outstanding)} outstanding
          </li>`,
      )
      .join('');

    const html = `
<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:2rem;">
  <p>Hi ${esc(guardianFirst)},</p>
  <p>Our records show no dues payments yet for the following player(s) on <strong>${esc(team.name)}</strong>:</p>
  <ul style="padding-left:1.25rem;">${rows}</ul>
  <p>If you've already sent payment, please disregard this note or let your coach know so we can update our records. Otherwise, please reach out to your coach to arrange payment.</p>
  ${duesReminderFooterHtml({ orgName: ctx.org.name, teamName: team.name })}
</div>`;

    await sendEmail(email, subject, html);
    emailsSent++;
    playersReminded += items.length;
  }

  // ⚠ ONE CLOCK, ON THE BILL THE FAMILY IS ACTUALLY ABOUT TO BE CHASED FOR — see the field's own
  // note in lib/db.ts for why this is NOT every unpaid bill. Nothing is stamped for a family with
  // no address on file: a letter that never went must never read back as "Last reminded" in their
  // panel, nor hold the next send back for a week.
  await markInstallmentsReminderSent(
    withEmail.map(t => t.nextUnpaidInstallmentId).filter((id): id is string => !!id));

  return NextResponse.json({ emailsSent, playersReminded, playersMissingEmail });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/dues/remind-unpaid' });
