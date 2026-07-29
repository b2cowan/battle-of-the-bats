/**
 * lib/tournament-game-mirror.ts — the PURE reconcile rules behind Batch 4's tournament-game mirror.
 *
 * Split from the IO half (`lib/rep-tournament-game-mirror.ts`) on the same pattern as
 * season-wrapped / rep-season-wrapped: these rules decide whether a coach keeps or loses a saved
 * lineup, so they are unit-tested directly rather than inferred from a query log.
 *
 * THE FIELD-OWNERSHIP CONTRACT (binding — also enforced by the events PATCH/DELETE guards):
 *   ORGANIZER owns  name · starts_at · location · opponent · home_away · team_score ·
 *                   opponent_score · result · status   → overwritten on every sync
 *   COACH owns      arrival_time · uniform · field_number · description · resources · tags ·
 *                   attendance · lineup                → never touched by a sync
 */

/** The organizer-owned columns, in DB naming — the only fields a sync ever writes on a live row. */
export interface MirrorOwnedFields {
  name: string;
  starts_at: string;
  location: string | null;
  opponent: string | null;
  home_away: 'home' | 'away' | null;
  team_score: number | null;
  opponent_score: number | null;
  result: 'win' | 'loss' | 'tie' | null;
  status: 'scheduled' | 'cancelled';
}

/**
 * What the planner needs from one real tournament game. Structurally satisfied by
 * `CoachScheduleTournamentGame` — declared here so the pure module never reaches into
 * server-only transport code.
 */
export interface MirrorSourceGame {
  id: string;
  /** ISO local start ("YYYY-MM-DDThh:mm"); null for an unresolved bracket slot. */
  startsAt: string | null;
  gameDate: string | null;
  opponentName: string;
  homeAway: 'home' | 'away';
  location: string | null;
  myScore: number | null;
  oppScore: number | null;
  status: string;
  result: 'win' | 'loss' | 'tie' | null;
  tournamentName: string;
}

/** The subset of an existing mirrored event the planner reasons about. */
export interface ExistingMirrorRow extends MirrorOwnedFields {
  id: string;
  source_tournament_game_id: string;
  /** Coach-owned fields — read-only here; they decide whether an orphan is cancelled or removed. */
  arrival_time: string | null;
  uniform: string | null;
  field_number: string | null;
  description: string | null;
  resources: unknown;
}

export interface MirrorPlan {
  inserts: (MirrorOwnedFields & { source_tournament_game_id: string })[];
  /** Rows to update. `source_tournament_game_id` is present ONLY on a re-point. */
  updates: { id: string; fields: Partial<MirrorOwnedFields> & { source_tournament_game_id?: string } }[];
  /** Mirrors whose source game is gone and which could not be re-pointed. */
  orphans: ExistingMirrorRow[];
}

/** Fallback title for a game whose tournament name didn't resolve — kept in ONE place so the
 *  re-point matcher and the writer can never disagree about what an event is called. */
export const UNNAMED_TOURNAMENT = 'Tournament game';

/** A game with no date yet (unresolved bracket slot) can't be mirrored — `starts_at` is NOT NULL. */
const isDated = (g: MirrorSourceGame) => Boolean(g.gameDate && g.startsAt);

/**
 * An opponent too vague to identify a game by. A re-point that matched "TBD" against "TBD" would
 * be a coin flip with a coach's lineup riding on it.
 */
const OPAQUE_OPPONENTS = new Set(['tbd', 'bye', '']);
const identifiable = (opponent: string | null | undefined) =>
  Boolean(opponent) && !OPAQUE_OPPONENTS.has(opponent!.trim().toLowerCase());
const sameOpponent = (a: string | null | undefined, b: string | null | undefined) =>
  identifiable(a) && identifiable(b) && a!.trim().toLowerCase() === b!.trim().toLowerCase();

/**
 * "2026-05-16T09:00:00+00:00" / "2026-05-16T09:00" → "2026-05-16T09:00" (wall-clock minute).
 * Shared with the client half (`lib/coach-tournament-games.ts`) so the mirror's "did this change"
 * and the coach's "did this move" can never disagree about what counts as the same minute.
 */
export function toMinute(value: string | null | undefined): string {
  return (value ?? '').slice(0, 16);
}
export const toDay = (value: string | null | undefined) => (value ?? '').slice(0, 10);

/** The organizer-owned shape for one source game. */
export function ownedFieldsFromGame(game: MirrorSourceGame): MirrorOwnedFields {
  return {
    // The tournament's own name titles the event; the opponent renders beside it on every surface
    // the portal shows a game on, so it is never duplicated into the title.
    name: game.tournamentName || UNNAMED_TOURNAMENT,
    starts_at: game.startsAt!,
    location: game.location ?? null,
    opponent: game.opponentName ?? null,
    home_away: game.homeAway ?? null,
    team_score: game.myScore ?? null,
    opponent_score: game.oppScore ?? null,
    result: game.result ?? null,
    status: game.status === 'cancelled' ? 'cancelled' : 'scheduled',
  };
}

/** The columns a sync writes on a live mirrored row — the organizer-owned set, in DB naming. */
export const MIRROR_SYNCED_COLUMNS: (keyof MirrorOwnedFields)[] = [
  'name', 'starts_at', 'location', 'opponent', 'home_away',
  'team_score', 'opponent_score', 'result', 'status',
];

/**
 * The API field names the coach may NOT write on a mirrored game — the ONE list the events PATCH
 * guard imports, so the contract can't drift into two half-maintained copies.
 *
 * Deliberately a SUPERSET of `MIRROR_SYNCED_COLUMNS`: `endsAt` and `locationAddress` have no
 * tournament-side source, so the sync never fills them — but they are still part of the game's
 * WHEN and WHERE, which belong to the organizer. Refusing them keeps the rule "a coach can never
 * make their calendar disagree with the tournament" true, rather than leaving two fields that only
 * one side of the pairing knows about. (If a coach ever needs the street address for the map link,
 * that is a deliberate move of `locationAddress` to the coach-owned side — not an oversight to
 * quietly patch in the route.)
 */
export const ORGANIZER_OWNED_API_FIELDS = [
  'name', 'startsAt', 'endsAt', 'location', 'locationAddress',
  'opponent', 'homeAway', 'teamScore', 'opponentScore', 'result', 'status',
] as const;

/** Compare ONLY the organizer-owned columns; returns the changed subset (empty = nothing to write). */
export function changedOwnedFields(
  existing: MirrorOwnedFields,
  desired: MirrorOwnedFields,
): Partial<MirrorOwnedFields> {
  const out: Partial<MirrorOwnedFields> = {};
  for (const key of MIRROR_SYNCED_COLUMNS) {
    // `starts_at` round-trips through Postgres as a full timestamptz while the source builds a
    // local "YYYY-MM-DDThh:mm" string — compare the wall-clock minute, not the literal, or every
    // sync would rewrite every row forever.
    if (key === 'starts_at') {
      if (toMinute(existing.starts_at) !== toMinute(desired.starts_at)) out.starts_at = desired.starts_at;
      continue;
    }
    if (existing[key] !== desired[key]) (out as Record<string, unknown>)[key] = desired[key];
  }
  return out;
}

/**
 * Whether the coach has set anything of their own ON THE EVENT ROW. Attendance, lineups and tags
 * live in child tables and are checked by the caller — this covers only the row itself.
 */
export function hasCoachOwnedFields(row: ExistingMirrorRow): boolean {
  return Boolean(
    row.arrival_time ||
    row.uniform ||
    row.field_number ||
    (row.description && row.description.trim()) ||
    (Array.isArray(row.resources) && row.resources.length > 0),
  );
}

/**
 * The reconcile decision table.
 *
 * `seasonFloor` (YYYY-MM-DD, or null for no floor) drops games played before this season began, so
 * a rollover never resurrects last season's tournament into a fresh record.
 */
export function planTournamentGameMirror(
  sourceGames: MirrorSourceGame[],
  existing: ExistingMirrorRow[],
  opts: { seasonFloor: string | null },
): MirrorPlan {
  const eligible = sourceGames.filter(g =>
    isDated(g) && (!opts.seasonFloor || g.gameDate! >= opts.seasonFloor),
  );

  const bySourceId = new Map(existing.map(row => [row.source_tournament_game_id, row]));
  const matchedSourceIds = new Set<string>();
  const updates: MirrorPlan['updates'] = [];
  const unmatchedSource: MirrorSourceGame[] = [];

  for (const game of eligible) {
    const row = bySourceId.get(game.id);
    if (!row) { unmatchedSource.push(game); continue; }
    matchedSourceIds.add(game.id);
    const fields = changedOwnedFields(row, ownedFieldsFromGame(game));
    if (Object.keys(fields).length > 0) updates.push({ id: row.id, fields });
  }

  const orphanRows = existing.filter(row => !matchedSourceIds.has(row.source_tournament_game_id));

  // ── Re-point pass ─────────────────────────────────────────────────────────
  // Some organizers reschedule by deleting and re-creating, and regenerating a bracket
  // re-identifies every game at once. Treating that as "one death, one birth" would strand the
  // coach's lineup on a dead row and hand them an empty new game. Match orphan → replacement on
  // tournament + opponent, preferring the same calendar day, and ONLY when the pairing is
  // unambiguous from BOTH sides. Anything else falls through to the cancel/delete rule rather
  // than guessing with a coach's work.
  //
  // Resolved as an explicit FIXED POINT, not a single ordered sweep: claiming one pairing can make
  // a previously-ambiguous one unique, and which pairings resolve must not depend on the order the
  // rows happened to arrive in. Each round claims only pairings that are unique from both sides,
  // then re-evaluates; it stops when a round claims nothing.
  const claimedGames = new Set<string>();
  const repointedRows = new Set<string>();

  const candidatesFor = (row: ExistingMirrorRow, sameDayOnly: boolean) =>
    unmatchedSource.filter(g =>
      !claimedGames.has(g.id) &&
      sameOpponent(g.opponentName, row.opponent) &&
      (g.tournamentName || UNNAMED_TOURNAMENT) === row.name &&
      (!sameDayOnly || g.gameDate === toDay(row.starts_at)),
    );

  // Same-day pairings resolve first (the common delete-and-recreate); a looser tournament+opponent
  // round then catches a re-create that also moved the game.
  for (const sameDayOnly of [true, false]) {
    for (;;) {
      // One candidate list per remaining row, computed ONCE per round.
      const proposals = orphanRows
        .filter(row => !repointedRows.has(row.id))
        .map(row => ({ row, candidates: candidatesFor(row, sameDayOnly) }));
      // Invert: which rows want each game. A pairing is claimable only when the row has exactly
      // one candidate AND that game has exactly one row proposing it.
      const proposersByGame = new Map<string, number>();
      for (const p of proposals) {
        for (const game of p.candidates) proposersByGame.set(game.id, (proposersByGame.get(game.id) ?? 0) + 1);
      }
      const claimable = proposals.filter(
        p => p.candidates.length === 1 && proposersByGame.get(p.candidates[0].id) === 1,
      );
      if (claimable.length === 0) break;

      for (const { row, candidates } of claimable) {
        const game = candidates[0];
        claimedGames.add(game.id);
        repointedRows.add(row.id);
        updates.push({
          id: row.id,
          fields: { ...ownedFieldsFromGame(game), source_tournament_game_id: game.id },
        });
      }
    }
  }

  // ── "Gone" vs "no longer visible to you" ──────────────────────────────────
  // A game leaves the source set for two very different reasons, and they look identical here:
  // the organizer DELETED it, or the reveal rules stopped showing it (the division's schedule was
  // taken offline — which happens automatically when an organizer reopens registration — or the
  // team's registration is no longer `accepted`). Treating the second as the first would mark a
  // coach's whole tournament weekend "Cancelled", which is simply untrue and would have them
  // phoning the organizer.
  //
  // We can't ask why, but we can ask whether that tournament is still showing this team ANY games.
  // If it is, a missing game really is missing. If the tournament has gone silent entirely, leave
  // its rows exactly as they are — and let them heal on their own when it comes back.
  const revealedTournaments = new Set(
    eligible.map(g => g.tournamentName || UNNAMED_TOURNAMENT),
  );
  const orphans = orphanRows.filter(
    row => !repointedRows.has(row.id) && revealedTournaments.has(row.name),
  );

  return {
    inserts: unmatchedSource
      .filter(g => !claimedGames.has(g.id))
      .map(g => ({ ...ownedFieldsFromGame(g), source_tournament_game_id: g.id })),
    updates,
    orphans,
  };
}

/**
 * What happens to a mirror whose source game is gone and which could not be re-pointed.
 * `hasChildWork` = the caller found attendance, a lineup, or tags for it.
 *
 * Cancel rather than delete whenever the coach has touched it: a cancelled event already drops out
 * of the record and the attendance rollups, so nothing double-counts — and nothing is lost.
 */
export function decideOrphanFate(
  row: ExistingMirrorRow,
  hasChildWork: boolean,
): 'cancel' | 'delete' | 'noop' {
  if (!hasChildWork && !hasCoachOwnedFields(row)) return 'delete';
  return row.status === 'cancelled' ? 'noop' : 'cancel';
}
