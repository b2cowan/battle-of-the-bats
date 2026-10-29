import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { getSeasonGamesEveryStatus } from './db';
import { heldGames, lastSentView, sendClaim, type GameSnapshot, type HeldChange, type HeldGame } from './league-game-changes';
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

/** The fields of a game families read (mig 409's `league_game_snapshot`), plus its id. */
export type GameFaceFields = Pick<LeagueGame, 'id' | 'scheduledAt' | 'endsAt' | 'location' | 'orgVenueId' | 'orgVenueFacilityId' | 'status' | 'movedFrom'>;

export function snapshotOf(g: Omit<GameFaceFields, 'id'>): GameSnapshot {
  return {
    scheduledAt: g.scheduledAt, endsAt: g.endsAt, location: g.location, venueId: g.orgVenueId,
    facilityId: g.orgVenueFacilityId, status: g.status, movedFrom: g.movedFrom,
  };
}

function withSnapshot<G extends GameFaceFields>(g: G, s: GameSnapshot): G {
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
export function asLastSent<G extends GameFaceFields>(games: readonly G[], held: readonly HeldChange[]): G[] {
  const byGame = new Map<string, HeldChange[]>();
  for (const c of held) (byGame.get(c.gameId) ?? byGame.set(c.gameId, []).get(c.gameId)!).push(c);
  const out: G[] = [];
  for (const g of games) {
    const seen = lastSentView(snapshotOf(g), byGame.get(g.id) ?? []);
    if (seen) out.push(withSnapshot(g, seen));
  }
  return out;
}

/** A held game with the division and the two teams it tells (f2's rows and who hears each). */
export interface HeldGameOf extends HeldGame { divisionId: string; homeTeamId: string; awayTeamId: string }

/** What families will be told about a game: something to send, or a game played since (listed, never emailed). */
export const isShownHeld = (g: HeldGame) => !!g.news || g.played;

/**
 * Every held game of a season (or one division), reduced to what it will tell families (`heldGames`) against the game as it
 * is now. `heldRows` is the held rows when the caller has read them already. ⚠ A failed read THROWS.
 */
export async function heldGamesOf(seasonId: string, divisionId?: string, heldRows?: readonly HeldChange[]): Promise<HeldGameOf[]> {
  const held = heldRows ?? await heldChangesOf(seasonId, divisionId);
  if (!held.length) return [];
  // (A mapped type: league-game-changes-guard reads any object key named for the trigger's date as a write of it.)
  type Nullable = 'scheduled_at' | 'ends_at' | 'location' | 'org_venue_id' | 'org_venue_facility_id' | 'moved_from';
  const rows = await fetchAllIn<{ id: string; division_id: string; home_team_id: string; away_team_id: string; status: LeagueGame['status'] }
    & { [K in Nullable]: string | null }>([...new Set(held.map(h => h.gameId))], (c, a, b) => supabaseAdmin.from('league_games')
    .select('id, division_id, home_team_id, away_team_id, scheduled_at, ends_at, location, org_venue_id, org_venue_facility_id, status, moved_from')
    .in('id', c).order('id').range(a, b));
  const byId = new Map(rows.map(r => [r.id, r]));
  const current = new Map(rows.map(r => [r.id, {
    scheduledAt: r.scheduled_at, endsAt: r.ends_at, location: r.location, venueId: r.org_venue_id,
    facilityId: r.org_venue_facility_id, status: r.status, movedFrom: r.moved_from,
  } satisfies GameSnapshot]));
  return heldGames(held, current).flatMap(g => {
    const r = byId.get(g.gameId);
    return r ? [{ ...g, divisionId: r.division_id, homeTeamId: r.home_team_id, awayTeamId: r.away_team_id }] : [];
  });
}

/** A season's active children on these teams, with the guardian's email (the households a send reaches, f2). */
export async function childrenOnTeams(seasonId: string, teamIds: readonly string[]) {
  const rows = await fetchAllIn<{ id: string; team_id: string; guardian_email: string | null; player_first_name: string | null; player_last_name: string | null }>(
    teamIds, (c, a, b) => supabaseAdmin.from('league_registrations')
      .select('id, team_id, guardian_email, player_first_name, player_last_name')
      .eq('season_id', seasonId).eq('status', 'active').in('team_id', c).order('id').range(a, b));
  return rows.map(r => ({
    registrationId: r.id, teamId: r.team_id, email: r.guardian_email ?? '',
    childName: (r.player_first_name ?? '').trim(), lastName: (r.player_last_name ?? '').trim(),
  }));
}

export type SendHeldResult =
  /** `notice`: the games_changed notice whose family rows the send wrote (null when it told nobody). */
  | { refusal: null; families: number; sentAt: string; news: number; notice: string | null }
  | { refusal: 'nothing' | 'changed' | 'finished' }
  | { refusal: 'already'; by: string | null; at: string | null };

/**
 * SEND THE CHANGES (f2), or one urgent cancel or postpone (f5): the held rows the sender saw (`changeIds`) are claimed once,
 * in `league_division_changes_send` (locked on the division, refused `changed` when a change landed or was undone while
 * the window was open). What families are told is worked out HERE from the rows and the game now — never taken from the
 * client — so a stale or edited request can only be refused, not mis-sent.
 */
export async function sendHeldChanges(p: {
  orgId: string; seasonId: string; divisionId: string; actorId: string; changeIds: readonly string[];
}): Promise<SendHeldResult> {
  const named = new Set(p.changeIds);
  const games = (await heldGamesOf(p.seasonId, p.divisionId)).filter(g => g.changeIds.some(id => named.has(id)));
  const { data, error } = await supabaseAdmin.rpc('league_division_changes_send', {
    p_org: p.orgId, p_season: p.seasonId, p_division: p.divisionId, p_actor: p.actorId,
    p_changes: [...named], p_news: sendClaim(games).newsGameIds,
  });
  if (error) throw new Error(`Changes to send didn't save: ${error.message}`);
  const r = (Array.isArray(data) ? data[0] : data) as {
    refusal: string | null; sent_at: string | null; sent_by: string | null; families: number; notice: string | null;
  };
  if (r.refusal === 'already') return { refusal: 'already', by: r.sent_by, at: r.sent_at };
  if (r.refusal === 'nothing' || r.refusal === 'changed' || r.refusal === 'finished') return { refusal: r.refusal };
  return { refusal: null, families: r.families, sentAt: r.sent_at!, news: games.filter(g => g.news).length, notice: r.notice };
}

/**
 * The public schedule's games (g2): every status, published divisions only, as families last heard them. The divisions
 * not yet published come back by id, for "{division}'s schedule is coming".
 */
export async function publicSeasonGames(seasonId: string, divisions: readonly LeagueDivision[]) {
  const published = new Set(divisions.filter(d => d.schedulePublishedAt).map(d => d.id));
  if (!published.size) return { games: [] as LeagueGame[], published };
  // ⚠ The games first, THEN the held rows: a change landing between the two reads has its row by the time the rows are read
  // (the trigger writes both in one statement), so it reads as held. The other order shows an unsent date to the public.
  const games = await getSeasonGamesEveryStatus(seasonId);
  const held = await heldChangesOf(seasonId);
  return { games: asLastSent(games.filter(g => published.has(g.divisionId)), held), published };
}
