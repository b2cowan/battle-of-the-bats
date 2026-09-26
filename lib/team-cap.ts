import { NextResponse } from 'next/server';
import { PLAN_CONFIG } from './plan-config';
import { moveDirection } from './plan-move';
import type { OrgPlan } from './types';

/**
 * The team-limit refusal (Club Repackaging's cap), with a STRUCTURED next step (Club Tier Stage 1b,
 * specimen 7: "the team-cap error offers the move in place"). Creating a team and un-archiving one
 * both answer this; the screen offers `moveUp` as the same move window the plan page opens, or the
 * contact line when no larger band exists.
 *
 *   409 { error, code: 'team_limit_reached', teamLimit, activeTeams,
 *         moveUp: { planKey, label, teamLimit } | null, contactUs: boolean }
 *
 * `error` keeps today's sentence so today's screens read the same; the new fields are additive.
 */
export function teamLimitRefusal(planId: OrgPlan, teamLimit: number, activeTeams: number): NextResponse {
  const up = (Object.keys(PLAN_CONFIG) as OrgPlan[])
    .filter(p => moveDirection(planId, p) === 'up' && PLAN_CONFIG[p].teamLimit > teamLimit)
    .sort((a, b) => PLAN_CONFIG[a].teamLimit - PLAN_CONFIG[b].teamLimit)[0] ?? null;
  const nextStep = up
    ? ` Upgrade to ${PLAN_CONFIG[up].label} to add up to ${PLAN_CONFIG[up].teamLimit} teams.`
    : ' Contact us to raise your team limit for a larger association.';
  return NextResponse.json(
    {
      error: `You've reached your plan's limit of ${teamLimit} teams.${nextStep}`,
      code: 'team_limit_reached',
      teamLimit,
      activeTeams,
      moveUp: up ? { planKey: up, label: PLAN_CONFIG[up].label, teamLimit: PLAN_CONFIG[up].teamLimit } : null,
      contactUs: !up,
    },
    { status: 409 },
  );
}
