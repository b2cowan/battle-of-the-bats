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
  getRepTeamGameMomentsForPlayer,
} from '@/lib/db';
import { PLAYER_MOMENTS_SHOWN } from '@/lib/coach-game-moments';
import type { RepRosterStatus, LineupProfile } from '@/lib/types';
import { BATS_OPTIONS, THROWS_OPTIONS, JERSEY_SIZE_OPTIONS, normalizeOption } from '@/lib/rep-roster-options';
import { getSportPack } from '@/lib/sports';
import { buildLineupProfileWrite } from '@/lib/lineup-profile';
import { withObservability } from '@/lib/observability';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';
import {
  denyUnless, canLogGameMoment, canViewMoney, hasRecordAccess, redactRosterPlayer,
} from '@/lib/coach-capabilities';

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

// READ: season-scoped (Chunk F). Without this, tapping a player on an archived roster landed on
// "No active program year for this team" — a dead end at the end of a door the archive opened.
// The player must belong to the SEASON being read, not merely to the team, or a past season's
// page would happily show a current player's record.
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveCoachSeasonRead(orgSlug, teamId, req);
  if ('error' in resolved) return resolved.error;
  const { ctx, capabilities, programYear, isReadOnly } = resolved;
  // A1 (2026-08-03): a player's own page is a record surface — see the roster list route.
  // `redactRosterPlayer` below is untouched and still strips PII and notes.
  const denied = denyUnless(hasRecordAccess(capabilities), 'You do not have access to the roster.');
  if (denied) return denied;

  const player = await getRepRosterPlayer(playerId);
  if (!player || player.teamId !== teamId || player.orgId !== ctx.org.id
      || player.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  /**
   * Game-Day Mode P2 — the moments tagged to THIS player (owner Q3, 2026-08-05).
   *
   * The plan called this "the recap composer handoff", but there is no composer: the family
   * season recap generates itself from records and the coach only previews it. The owner ruled
   * the COACH-SIDE version — moments are material a coach reads before the season-end
   * conversation, and they never reach a family surface. `PlayerRecapPreview` is untouched.
   *
   * ⚠ LIVE SEASON ONLY, deliberately narrower than this route's own rail. `roster/[playerId]`
   * is season-aware (an archive door), and quietly serving a new content type through it would
   * be exactly the silent archive expansion CLAUDE.md forbids. The one archive surface the
   * owner ruled on is Wrapped; widening this needs its own decision, not a side effect here.
   *
   * ⚠ Gated on the same predicate that allows capturing one — a coach who cannot run the bench
   * does not receive the staff's private lines about a child.
   */
  const showMoments = !isReadOnly && canLogGameMoment(capabilities);

  const [attendance, dues, awards, moments] = await Promise.all([
    getRepPlayerAttendanceSummary(playerId, programYear.id),
    getRepPlayerDuesSummary(playerId, programYear.id),
    getRepPlayerAwardsSummary(playerId),
    showMoments
      ? getRepTeamGameMomentsForPlayer(teamId, programYear.id, playerId, PLAYER_MOMENTS_SHOWN)
      : Promise.resolve({ moments: [], total: 0 }),
  ]);

  return NextResponse.json({
    isReadOnly,
    player: redactRosterPlayer(player, capabilities),
    attendance,
    dues: canViewMoney(capabilities) ? dues : null,
    awards,
    moments,
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
  // Year-scope guard (Batch 3 rider): a roster row from a PAST season must never be editable
  // just because the team currently has an open year — "read-only past season" has to hold
  // per-row, not only per-team. (The season-end verification found this hole: the fetch
  // above checks team/org but not which season the row belongs to.)
  if (player.programYearId !== resolved.programYear.id) {
    return NextResponse.json({ error: 'This player belongs to a past season, which is read-only.' }, { status: 409 });
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
