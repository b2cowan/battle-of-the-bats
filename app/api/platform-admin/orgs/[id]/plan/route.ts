import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { applyOperatorPlanChange, PlanUpdateError } from '@/lib/operator-plan-change';
import type { OrgPlan } from '@/lib/types';
import { withObservability } from '@/lib/observability';

function isOrgPlan(planId: unknown): planId is OrgPlan {
  return typeof planId === 'string' && planId in PLAN_CONFIG;
}

// The plan change itself — Club trial, the write, the shared side effects, the reactivation restore,
// the over-cap archive and the audit trail — is ONE rule in lib/operator-plan-change.ts, shared with
// Bulk Operations. This route only checks the request and shapes the reply.
export const PATCH = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('club_billing');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json() as { planId?: string; tournamentLimit?: number; teamLimit?: number | null; reason?: string };
  const { planId, tournamentLimit, teamLimit, reason } = body;

  if (!isOrgPlan(planId) || typeof tournamentLimit !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  if (!reason?.trim()) {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
  }
  // Sanity ceiling on the custom team-cap override — well above any real association
  // (largest custom deals are tens of teams), guards against a runaway/typo value.
  if (typeof teamLimit === 'number' && teamLimit > 1000) {
    return NextResponse.json({ error: 'Team limit override is too large (max 1000).' }, { status: 400 });
  }

  let change;
  try {
    change = await applyOperatorPlanChange({
      orgId: id,
      planId,
      tournamentLimit,
      teamLimit,
      reason: reason.trim(),
      actor: auth.user.email!,
      audit: { action: 'update_org_plan_and_limit' },
    });
  } catch (err) {
    if (err instanceof PlanUpdateError) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    throw err;
  }
  // Parts of a plan change that fail AFTER the plan is saved: reported to the operator, never
  // swallowed into a plain success (the same rule as the over-cap archive's warning).
  const planChangeWarnings = change.warnings;

  return NextResponse.json({
    ok: true,
    planId,
    tournamentLimit: change.effectiveTournamentLimit,
    teamLimit: change.teamLimitProvided
      ? change.normalizedTeamLimit
      : (change.clearedTeamLimit ? null : (change.current?.team_limit ?? null)),
    archivedTournaments: change.archivedTournaments,
    ...(change.archiveWarning ? { archiveWarning: change.archiveWarning } : {}),
    // Added 2026-09-25 (Club Tier Stage 1b), additively:
    clubTrialDays: change.clubTrialDays,
    foundingCompRevoked: change.revokedComps > 0,
    teamLimitCleared: change.clearedTeamLimit,
    ...(planChangeWarnings.length > 0 ? { planChangeWarning: planChangeWarnings.join(' ') } : {}),
  });
}, { route: '/api/platform-admin/orgs/[id]/plan' });
