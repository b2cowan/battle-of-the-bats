import 'server-only';
import { getRepRosterPlayers, getRepTeamEventById } from './db';
import type { RepTeamMeasurableType } from './types';
import type { SessionScopeFields } from './development-input';

/**
 * A session's scope, PROVED (development lifecycle Phase 2; /dba Finding #41 item 3).
 *
 * The scope is stored as two id lists on the session — a snapshot of intent, not a relation — so
 * the database cannot check that the ids are this team's. This is where that is checked, ONCE, for
 * the create and the "Change scope" patch alike: every metric is one of this team's ACTIVE
 * definitions (a test or an observed skill — never a retired one: retire means "not for new
 * sessions"), every player a row of this season's ACTIVE roster (a departed player's saved rows
 * stay on the session read-only; a scope can never re-admit them), and the event — when named —
 * sits on this team's season schedule (the PATCH's rule, reused).
 */
export async function verifySessionScope(args: {
  teamId: string;
  programYearId: string;
  scope: SessionScopeFields | null;
  eventId: string | null;
  activeTypes: RepTeamMeasurableType[];
}): Promise<{ scope: SessionScopeFields | null; eventId: string | null } | { error: string }> {
  // The event and the roster are independent reads — one round trip, not two.
  const [event, roster] = await Promise.all([
    args.eventId ? getRepTeamEventById(args.eventId) : Promise.resolve(null),
    args.scope ? getRepRosterPlayers(args.programYearId) : Promise.resolve([]),
  ]);
  let eventId: string | null = null;
  if (args.eventId) {
    if (!event || event.teamId !== args.teamId || event.programYearId !== args.programYearId) {
      return { error: 'That event isn’t on this team’s schedule for this season.' };
    }
    eventId = event.id;
  }
  if (!args.scope) return { scope: null, eventId };

  const activeIds = new Set(args.activeTypes.filter(t => t.isActive).map(t => t.id));
  if (args.scope.metricIds.some(id => !activeIds.has(id))) {
    return { error: 'Choose metrics from this team’s active list — a retired one can’t be recorded in a new session.' };
  }
  const activePlayers = new Set(roster.filter(p => p.status === 'active').map(p => p.id));
  if (args.scope.playerIds.some(id => !activePlayers.has(id))) {
    return { error: 'Choose players from this season’s active roster.' };
  }
  return { scope: args.scope, eventId };
}
