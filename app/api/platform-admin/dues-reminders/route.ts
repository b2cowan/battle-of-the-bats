import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { isCronRequest } from '@/lib/cron-auth';
import { runDuesRemindersSweep } from '@/lib/dues-reminders';

/**
 * Dues reminders — platform-wide daily sweep trigger. Runs BOTH proximity waves (30-day and
 * 7-day) for every rep team with a current program year, across all orgs, honoring each team's
 * Automatic Dues Reminders toggle. Sent-stamps + the 7-day resend cooldown make it safe to
 * fire any time (a double-fire sends nothing twice); families with a sending failure are NOT
 * stamped, so the next tick retries them.
 *
 * Callers: the pg_cron scheduler (daily, via x-cron-secret — migration 183) or a super-admin
 * by hand. Body (all optional): { orgId?, teamId?, dryRun? } — dryRun computes every wave and
 * returns per-guardian previews without sending or stamping.
 */

// Raise the serverless timeout: the sweep sends sequentially across all teams. Comfortable at
// today's scale; the plan's "batch/paginate per-org" note is the fix if team count ever makes
// even 300s tight. (pg_net's own 27s dispatch timeout is fire-and-forget — the handler keeps
// running past it, so the audit-log write still lands.)
export const maxDuration = 300;

export const POST = withObservability(async (req: Request) => {
  const machine = isCronRequest(req);
  let actor = 'cron-scheduler';
  if (!machine) {
    const auth = await requireSuperAdmin();
    if (auth.response) return auth.response;
    actor = auth.user.email ?? 'platform-admin';
  }

  let body: { orgId?: string; teamId?: string; dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // empty body = full sweep
  }
  const orgId = typeof body.orgId === 'string' && body.orgId ? body.orgId : undefined;
  const teamId = typeof body.teamId === 'string' && body.teamId ? body.teamId : undefined;
  const dryRun = body.dryRun === true;

  const result = await runDuesRemindersSweep({ orgId, teamId, dryRun });

  await writePlatformAuditLog(
    actor,
    null,
    'dues_reminders_sweep',
    'result',
    null,
    {
      dryRun,
      orgId: orgId ?? null,
      teamId: teamId ?? null,
      teamsConsidered: result.teamsConsidered,
      teamsSkippedToggle: result.teamsSkippedToggle,
      remindersChecked: result.remindersChecked,
      emailsSent: result.emailsSent,
      emailsFailed: result.emailsFailed,
      noGuardianEmail: result.noGuardianEmail,
      installmentsTagged: result.installmentsTagged,
      errorCount: result.errors.length,
    },
  );

  return NextResponse.json(
    { ok: result.errors.length === 0 && result.emailsFailed === 0, ...result },
    { status: result.errors.length > 0 ? 207 : 200 },
  );
}, { route: '/api/platform-admin/dues-reminders' });
