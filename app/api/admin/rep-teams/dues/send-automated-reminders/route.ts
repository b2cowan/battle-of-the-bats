// POST /api/admin/rep-teams/dues/send-automated-reminders
// Called by the cron scheduler (AWS EventBridge / Vercel cron) or manually by an org admin.
// Scans ALL active teams in the org, respects per-team auto_reminders_enabled toggle,
// and sends 30-day or 7-day reminder waves based on the `window` body param.

import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getRepTeams,
  getActiveRepProgramYear,
  getDueReminderCandidates,
  markInstallments30ReminderSent,
  markInstallments7ReminderSent,
} from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-CA', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const POST = withObservability(async (req: Request) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  // Org-owned reminder wave to every guardian — owner/admin only (audit J4-004).
  // gate() only checks the module cap; this blocks a non-owner/admin who holds it.
  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const body = await req.json().catch(() => ({}));
  const window: 30 | 7 = body.window === 7 ? 7 : 30;
  const daysAhead = window === 30 ? 32 : 9;

  const teams = await getRepTeams(ctx!.org.id, undefined, ctx!.repGroupIds ?? undefined);

  let totalChecked = 0;
  let totalEmailed = 0;
  let totalTagged = 0;
  let teamsSkipped = 0;

  for (const team of teams) {
    const programYear = await getActiveRepProgramYear(team.id);
    if (!programYear) continue;

    if (!programYear.autoRemindersEnabled) {
      teamsSkipped++;
      continue;
    }

    const candidates = await getDueReminderCandidates(team.id, daysAhead, window);
    totalChecked += candidates.length;

    const byGuardian = new Map<string, typeof candidates>();
    for (const c of candidates) {
      if (!c.guardianEmail) continue;
      const list = byGuardian.get(c.guardianEmail) ?? [];
      list.push(c);
      byGuardian.set(c.guardianEmail, list);
    }

    const taggedIds: string[] = [];

    for (const [email, items] of byGuardian) {
      const first = items[0];
      const guardianFirst = first.guardianFirstName ?? 'there';
      const windowLabel = window === 30 ? 'in approximately 30 days' : 'in about one week';

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
  <p>This is a friendly reminder that the following dues installments are due ${windowLabel} for your player(s) on <strong>${team.name}</strong>:</p>
  <ul style="padding-left:1.25rem;">${rows}</ul>
  <p>To view your full payment schedule or if you have already submitted payment, please contact your coach directly.</p>
  <p style="color:rgba(0,0,0,0.5);font-size:0.85rem;margin-top:2rem;">FieldLogicHQ</p>
</div>`;

      await sendEmail(email, `Upcoming dues reminder (${window} days) — ${team.name}`, html);
      totalEmailed++;
      for (const i of items) taggedIds.push(i.installmentId);
    }

    if (taggedIds.length) {
      if (window === 30) {
        await markInstallments30ReminderSent(taggedIds);
      } else {
        await markInstallments7ReminderSent(taggedIds);
      }
      totalTagged += taggedIds.length;
    }
  }

  return NextResponse.json({
    window,
    teamsProcessed: teams.length - teamsSkipped,
    teamsSkipped,
    remindersChecked: totalChecked,
    emailsSent: totalEmailed,
    installmentsTagged: totalTagged,
  });
}, { route: '/api/admin/rep-teams/dues/send-automated-reminders' });
