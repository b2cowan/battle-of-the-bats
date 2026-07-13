import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepRosterPlayer,
  updateRepRosterPlayer,
  getRepPlayerAttendanceSummary,
  getRepPlayerDuesSummary,
  getRepPlayerAwardsSummary,
} from '@/lib/db';
import type { RepRosterStatus, LineupProfile } from '@/lib/types';
import { BATS_OPTIONS, THROWS_OPTIONS, JERSEY_SIZE_OPTIONS, normalizeOption } from '@/lib/rep-roster-options';
import { getSportPack } from '@/lib/sports';
import { buildLineupProfileWrite } from '@/lib/lineup-profile';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney, canViewRoster, redactRosterPlayer } from '@/lib/coach-capabilities';

function trimmedOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

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

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canViewRoster(assignment.capabilities), 'You do not have access to the roster.');
  if (denied) return denied;

  const player = await getRepRosterPlayer(playerId);
  if (!player || player.teamId !== teamId || player.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [attendance, dues, awards] = await Promise.all([
    getRepPlayerAttendanceSummary(playerId, resolved.programYear.id),
    getRepPlayerDuesSummary(playerId, resolved.programYear.id),
    getRepPlayerAwardsSummary(playerId),
  ]);

  return NextResponse.json({
    player: redactRosterPlayer(player, assignment.capabilities),
    attendance,
    dues: canViewMoney(assignment.capabilities) ? dues : null,
    awards,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment } = resolved;
  const denied = denyUnless(assignment.capabilities.rosterWrite, 'Only the head coach can edit the roster.');
  if (denied) return denied;

  const player = await getRepRosterPlayer(playerId);
  if (!player || player.teamId !== teamId || player.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();

  // Lineup Intelligence: the Best/Okay/Never picker sends a `lineupProfile` payload; derive the
  // primary/secondary columns + the stored profile from it server-side so they can't drift. Falls
  // back to explicit primary/secondary for legacy/quick-add-style callers.
  let positionWrite: {
    primaryPosition?: string | null;
    secondaryPosition?: string | null;
    lineupProfile?: LineupProfile | null;
  };
  if (body.lineupProfile != null) {
    const pack = getSportPack(team.sport);
    positionWrite = buildLineupProfileWrite(body.lineupProfile, pack.positions, pack.pitcherPosition);
  } else {
    positionWrite = {
      primaryPosition:  body.primaryPosition  !== undefined ? (body.primaryPosition?.trim() || null)   : undefined,
      secondaryPosition:body.secondaryPosition!== undefined ? (body.secondaryPosition?.trim() || null) : undefined,
    };
  }

  const updated = await updateRepRosterPlayer(playerId, {
    // First name is required — skip the write when it's null/undefined rather than coercing
    // `String(null)` into the literal text "null". (`!= null` covers both null and undefined.)
    playerFirstName:  body.playerFirstName  != null ? String(body.playerFirstName).trim()  : undefined,
    // Optional fields: an emptied field must store real null, never the string "null".
    playerLastName:   body.playerLastName   !== undefined ? trimmedOrNull(body.playerLastName)   : undefined,
    playerDateOfBirth:body.playerDateOfBirth !== undefined ? (body.playerDateOfBirth || null)     : undefined,
    playerNumber:     body.playerNumber     !== undefined ? (body.playerNumber?.trim() || null)   : undefined,
    ...positionWrite,
    status:           body.status           !== undefined ? body.status as RepRosterStatus        : undefined,
    guardianFirstName:body.guardianFirstName !== undefined ? trimmedOrNull(body.guardianFirstName): undefined,
    guardianLastName: body.guardianLastName  !== undefined ? trimmedOrNull(body.guardianLastName) : undefined,
    guardianEmail:    body.guardianEmail     !== undefined ? trimmedOrNull(body.guardianEmail)    : undefined,
    guardianPhone:    body.guardianPhone     !== undefined ? (body.guardianPhone?.trim() || null) : undefined,
    notes:            body.notes            !== undefined ? (body.notes?.trim() || null)          : undefined,
    adminNotes:       body.adminNotes       !== undefined ? (body.adminNotes?.trim() || null)     : undefined,
    medicalNotes:          body.medicalNotes          !== undefined ? trimmedOrNull(body.medicalNotes)          : undefined,
    emergencyContactName:  body.emergencyContactName  !== undefined ? trimmedOrNull(body.emergencyContactName)  : undefined,
    emergencyContactPhone: body.emergencyContactPhone !== undefined ? trimmedOrNull(body.emergencyContactPhone) : undefined,
    bats:        body.bats        !== undefined ? normalizeOption(body.bats, BATS_OPTIONS)               : undefined,
    throws:      body.throws      !== undefined ? normalizeOption(body.throws, THROWS_OPTIONS)           : undefined,
    jerseySize:  body.jerseySize  !== undefined ? normalizeOption(body.jerseySize, JERSEY_SIZE_OPTIONS)  : undefined,
  });

  return NextResponse.json({ player: updated });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]' });
