import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { isCronRequest } from '@/lib/cron-auth';
import { runInsightsDigestSweep } from '@/lib/insights-digest';

/**
 * Coach Insights weekly digest — sweep trigger. Ticked every Sunday evening by the pg_cron
 * scheduler (via x-cron-secret — migration 183) or fired by a super-admin by hand. Safe to
 * fire any time: a per-team dedupe window (~6 days) means a double-fire sends nothing twice,
 * and quiet teams send nothing at all.
 *
 * Body (all optional): { orgId?, teamId?, dryRun? } — narrow a test run to one org/team;
 * dryRun computes every digest and returns per-recipient previews without sending.
 * It dispatches push notifications to customers — hence super-admin or scheduler secret only.
 */

// Raise the serverless timeout — the sweep composes inputs + notifies per team sequentially.
// (pg_net's 27s dispatch timeout is fire-and-forget; the handler runs to completion past it.)
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

  const result = await runInsightsDigestSweep({ orgId, teamId, dryRun });

  await writePlatformAuditLog(
    actor,
    null,
    'insights_digest_sweep',
    'result',
    null,
    {
      dryRun,
      orgId: orgId ?? null,
      teamId: teamId ?? null,
      teamsConsidered: result.teamsConsidered,
      teamsSkippedRecent: result.teamsSkippedRecent,
      teamsQuiet: result.teamsQuiet,
      digestsSent: result.digestsSent,
      errorCount: result.errors.length,
    },
  );

  return NextResponse.json(
    { ok: result.errors.length === 0, ...result },
    { status: result.errors.length > 0 ? 207 : 200 },
  );
}, { route: '/api/platform-admin/insights-digest' });
