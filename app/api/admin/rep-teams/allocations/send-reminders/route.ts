// POST /api/admin/rep-teams/allocations/send-reminders
// Scans all unpaid allocation installments due within the specified window, sends
// a consolidated summary email to the requesting admin, and marks them reminded.

import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getAllocationReminderCandidates,
  markAllocationReminderSent,
} from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { supabaseAdmin } from '@/lib/supabase-admin';
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

  const body = await req.json().catch(() => ({}));
  const daysAhead: number = typeof body.daysAhead === 'number' ? body.daysAhead : 30;

  let allCandidates = await getAllocationReminderCandidates(ctx!.org.id, daysAhead);

  if (ctx!.repGroupIds) {
    const { data: scopedTeams } = await supabaseAdmin
      .from('rep_teams')
      .select('id')
      .eq('org_id', ctx!.org.id)
      .in('group_id', ctx!.repGroupIds);
    const scopedSet = new Set((scopedTeams ?? []).map((t: any) => t.id as string));
    allCandidates = allCandidates.filter(c => scopedSet.has(c.teamId));
  }

  const candidates = allCandidates;

  if (!candidates.length) {
    return NextResponse.json({ remindersChecked: 0, emailsSent: 0, installmentsTagged: 0 });
  }

  // Group by team for readability
  const byTeam = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const list = byTeam.get(c.teamId) ?? [];
    list.push(c);
    byTeam.set(c.teamId, list);
  }

  const sections = [...byTeam.values()]
    .map(items => {
      const teamName = items[0].teamName;
      const rows = items
        .map(
          i =>
            `<li style="margin-bottom:0.4rem;">
              <strong>${i.allocationDescription}</strong> — ${fmt(i.amount)} due ${fmtDate(i.dueDate)}
              (Installment ${i.installmentNumber} of ${i.totalInstallments})
            </li>`,
        )
        .join('');
      return `<h3 style="margin:1.5rem 0 0.5rem;">${teamName}</h3><ul style="padding-left:1.25rem;">${rows}</ul>`;
    })
    .join('');

  const adminEmail = ctx!.user.email;
  if (!adminEmail) {
    return NextResponse.json({ error: 'No email on admin account' }, { status: 400 });
  }

  const html = `
<div style="font-family:Inter,sans-serif;max-width:700px;margin:0 auto;padding:2rem;">
  <p>The following allocation installments are due within the next <strong>${daysAhead} days</strong> and have not yet been marked as paid:</p>
  ${sections}
  <p style="margin-top:2rem;">Log in to your FieldLogicHQ accounting dashboard to review and mark these as paid once settled.</p>
  <p style="color:rgba(0,0,0,0.5);font-size:0.85rem;margin-top:2rem;">FieldLogicHQ</p>
</div>`;

  await sendEmail(
    adminEmail,
    `Allocation payment reminders — ${ctx!.org.name}`,
    html,
  );

  await markAllocationReminderSent(candidates.map(c => c.installmentId));

  return NextResponse.json({
    remindersChecked: candidates.length,
    emailsSent: 1,
    installmentsTagged: candidates.length,
  });
}, { route: '/api/admin/rep-teams/allocations/send-reminders' });
