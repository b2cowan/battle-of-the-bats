import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll } from './supabase-paging';
import { getSeasonGamesEveryStatus } from './db';
import { lastSentView, type GameSnapshot, type HeldChange } from './league-game-changes';
import type { LeagueDivision, LeagueGame } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT FAMILIES SEE OF A SEASON'S GAMES (House League 9d-2b; rulings 9d2·1, 9d2·16; mig 409). The public schedule and the
 * coach's team page read through here, never the raw games:
 *   · only a division whose schedule is PUBLISHED shows games; the rest are "coming" (g2);
 *   · a game with a held change reads as families last heard it (`lastSentView`), and a game added since is not shown.
 * The league admin's own screen reads the games as they are, with the held changes beside them.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export function snapshotOf(g: Pick<LeagueGame, 'scheduledAt' | 'endsAt' | 'location' | 'orgVenueId' | 'orgVenueFacilityId' | 'status' | 'movedFrom'>): GameSnapshot {
  return {
    scheduledAt: g.scheduledAt, endsAt: g.endsAt, location: g.location, venueId: g.orgVenueId,
    facilityId: g.orgVenueFacilityId, status: g.status, movedFrom: g.movedFrom,
  };
}

function withSnapshot(g: LeagueGame, s: GameSnapshot): LeagueGame {
  return {
    ...g, scheduledAt: s.scheduledAt, endsAt: s.endsAt, location: s.location, orgVenueId: s.venueId,
    orgVenueFacilityId: s.facilityId, status: s.status, movedFrom: s.movedFrom,
  };
}

interface ChangeRow {
  id: string; game_id: string; kind: HeldChange['kind']; before: GameSnapshot | null; after: GameSnapshot;
  source: HeldChange['source']; created_at: string;
}
const mapChange = (r: ChangeRow): HeldChange => ({
  id: r.id, gameId: r.game_id, kind: r.kind, before: r.before, after: r.after, source: r.source, createdAt: r.created_at,
});

/** Every change still waiting to be sent in a season (or one division). ⚠ A failed read THROWS (it decides what families see). */
export async function heldChangesOf(seasonId: string, divisionId?: string): Promise<HeldChange[]> {
  const rows = await fetchAll<ChangeRow>((a, b) => {
    let q = supabaseAdmin.from('league_game_changes')
      .select('id, game_id, kind, before, after, source, created_at')
      .eq('season_id', seasonId).is('sent_at', null);
    if (divisionId) q = q.eq('division_id', divisionId);
    return q.order('created_at').order('id').range(a, b);
  });
  return rows.map(mapChange);
}

/** These games as families last heard them: a held change reads its `before`; a game added since is dropped. */
export function asLastSent(games: readonly LeagueGame[], held: readonly HeldChange[]): LeagueGame[] {
  const byGame = new Map<string, HeldChange[]>();
  for (const c of held) (byGame.get(c.gameId) ?? byGame.set(c.gameId, []).get(c.gameId)!).push(c);
  const out: LeagueGame[] = [];
  for (const g of games) {
    const seen = lastSentView(snapshotOf(g), byGame.get(g.id) ?? []);
    if (seen) out.push(withSnapshot(g, seen));
  }
  return out;
}

/**
 * The public schedule's games (g2): every status, published divisions only, as families last heard them. The divisions
 * not yet published come back by id, for "{division}'s schedule is coming".
 */
export async function publicSeasonGames(seasonId: string, divisions: readonly LeagueDivision[]) {
  const published = new Set(divisions.filter(d => d.schedulePublishedAt).map(d => d.id));
  if (!published.size) return { games: [] as LeagueGame[], published };
  const [games, held] = await Promise.all([getSeasonGamesEveryStatus(seasonId), heldChangesOf(seasonId)]);
  return { games: asLastSent(games.filter(g => published.has(g.divisionId)), held), published };
}
