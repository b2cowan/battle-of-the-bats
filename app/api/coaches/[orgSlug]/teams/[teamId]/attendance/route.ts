import { NextResponse } from 'next/server';
import {
  getRepRosterPlayers,
  getRepTeamAttendanceReliability,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';
import { denyUnless, canViewRoster } from '@/lib/coach-capabilities';

const EMPTY_STAT = { attended: 0, known: 0, recorded: 0 };

/**
 * Season attendance reliability for the whole active roster (Coaches Portal Phase 4 F3).
 * Gated on roster view — attendance is not guardian PII. Active players with no recorded
 * attendance come back with zeroed stats so the view can show them as "not tracked yet".
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachSeasonRead(orgSlug, teamId, req);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear } = resolved;
  const denied = denyUnless(canViewRoster(capabilities), 'You do not have access to this team roster. Ask the head coach to grant it.');
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
