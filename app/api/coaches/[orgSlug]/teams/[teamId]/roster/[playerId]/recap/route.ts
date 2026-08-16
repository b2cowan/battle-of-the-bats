import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewDevelopmentGoals } from '@/lib/coach-capabilities';
import { assemblePlayerSeasonRecap } from '@/lib/rep-player-season-recap';

/**
 * GET the season recap a family will read for ONE player — the coach's PREVIEW (Chunk D 3.2).
 *
 * ⚠ LIVE SEASON ONLY, deliberately. This route does not touch `lib/coach-team-read.ts`, so
 * it resolves the team's ACTIVE year and cannot address a past season at all — the archive's
 * fail-closed default (owner ruling 2026-08-01). That is also the right MOMENT for a preview:
 * once a season closes, every write to it is refused, so there is nothing a coach could act on
 * after seeing it. They preview while they can still log a last reading or give an award.
 *
 * The gate is `notes` alone (A1, 2026-08-03 — it was roster visibility AND notes, and the roster
 * half became redundant once names went baseline: see the note on the check itself). The payload
 * carries development focus areas, which
 * are coach-judgment content about a minor and ride `notes` everywhere else in the portal
 * (`canViewDevelopmentGoals`). Redacting them instead would hand the coach a "preview" that is
 * not what the family sees, which defeats the point of previewing.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();

  // A1 (2026-08-03): was `canViewRoster && canViewDevelopmentGoals`. Coaching notes are the
  // sensitive half and imply record access, so the roster clause was always redundant once names
  // stopped being grantable — this is the same set of people, stated once.
  const denied = denyUnless(
    canViewDevelopmentGoals(assignment.capabilities),
    'You do not have access to player recaps.',
  );
  if (denied) return denied;

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return NextResponse.json({ error: 'No active program year for this team' }, { status: 404 });
  }

  const recap = await assemblePlayerSeasonRecap(team, programYear, playerId, {
    orgName: ctx.org.name,
    fallbackColor: ctx.org.themePrimary ?? null,
  });
  // The player is not on THIS season's roster. One 404 for "wrong player" and "wrong season"
  // alike — the difference is not the caller's business.
  if (!recap) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ recap });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/recap' });
