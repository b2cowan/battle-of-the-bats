// POST /api/admin/rep-teams/dues/send-automated-reminders
// Manual org-admin wave button ("30-day wave" / "7-day wave" on the org Accounting page).
// Scans ALL active teams in the org, respects per-team auto_reminders_enabled toggle,
// and sends 30-day or 7-day reminder waves based on the `window` body param.
// The SCHEDULED daily equivalent is the platform-wide sweep (lib/dues-reminders.ts via
// POST /api/platform-admin/dues-reminders, pg_cron mig 183) — same candidates, same stamps,
// same copy. Across DAYS they never double-send (the sent-stamp + 7-day cooldown dedupe both
// callers). The read→send→stamp sequence is NOT atomic, so firing this button at the exact
// moment the daily tick runs the same team could send one duplicate email — bounded to that
// single installment and self-limited by the cooldown. Accepted (pre-existing on this route).

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
import { duesReminderEmail } from '@/lib/dues-reminder-email';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
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

      // ONE template (lib/dues-reminder-email.ts) — shared with the coach route, the sweep, and
      // the on-screen "See an example" preview, so the sample a coach reads is the send.
      const { subject, html } = duesReminderEmail({
        teamName: team.name,
        orgName: ctx!.org.name,
        window,
        guardianFirst,
        items,
      });

      await sendEmail(email, subject, html);
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
