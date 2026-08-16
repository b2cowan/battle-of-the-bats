import { NextResponse } from 'next/server';
import {
  getRepRosterPlayers,
  getRepTeamAttendanceReliability,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { denyUnless } from '@/lib/coach-capabilities';

const EMPTY_STAT = { attended: 0, known: 0, recorded: 0 };

/**
 * Season attendance reliability for the whole active roster (Coaches Portal Phase 4 F3).
 * Gated on the attendance duty (A1, 2026-08-03 — it was roster view, back when names were a
 * grantable thing). Attendance is not guardian PII. Active players with no recorded
 * attendance come back with zeroed stats so the view can show them as "not tracked yet".
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear } = resolved;
  // A1 (2026-08-03): was `canViewRoster` — attendance rode roster visibility because the report
  // lists players by name, and names were grantable. They are baseline now, so this gates on the
  // duty the screen is actually for. A helper holds no attendance grant, so it stays shut for them.
  const denied = denyUnless(capabilities.attendance, 'You do not have access to attendance. Ask the head coach to grant it.');
  if (denied) return denied;

  const [players, reliability] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    getRepTeamAttendanceReliability(programYear.id),
  ]);

  const rows = players
    .filter(p => p.status === 'active')
    .map(p => {
      const r = reliability.get(p.id);
      return {
        playerId: p.id,
        playerFirstName: p.playerFirstName,
        playerLastName: p.playerLastName,
        games: r?.games ?? EMPTY_STAT,
        practices: r?.practices ?? EMPTY_STAT,
      };
    });

  return NextResponse.json({ players: rows });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/attendance' });
