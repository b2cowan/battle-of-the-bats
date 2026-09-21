import 'server-only';
import {
  getClubSharingSiblingTeams,
  getRepTeamOpponentsForTeams,
  getRepTeamOpponentAliasesForTeams,
  getRepTeamOpponentObservationsForOpponents,
  getRepTeamOpponentObservationCountsForTeams,
  getRepTeamGameEventsForOpponentBookByTeam,
} from './db';
import {
  buildClubBookBlock, buildClubListExtras, buildClubObservationCount,
  type ClubBookReader, type ClubBookBlock,
} from './coach-club-book';
import { captureError } from './observability';
import type { ClubPickerSpelling } from './coach-opponent-picker';

/**
 * The Club Shared Book's database adapter — and nothing else.
 *
 * All of the assembly lives in `lib/coach-club-book.ts` behind `ClubBookReader`, so the two-org
 * leakage fixture can run the REAL logic against fake reads. What remains here is the wiring,
 * kept deliberately dumb: every method forwards its `orgId` to a helper that filters on it.
 *
 * READ-ONLY by construction — this file contains no mutation of any kind, which is the
 * "writes stay home" ruling made structural rather than remembered. INSTRUMENT, off the season
 * rail like the rest of the book: sibling games from every season feed the LIVE season's
 * preparation, and an archived season shows no club layer anywhere.
 */
const dbReader: ClubBookReader = {
  siblingTeams: getClubSharingSiblingTeams,
  opponents: getRepTeamOpponentsForTeams,
  aliases: getRepTeamOpponentAliasesForTeams,
  observations: getRepTeamOpponentObservationsForOpponents,
  observationCounts: getRepTeamOpponentObservationCountsForTeams,
  gameEventsByTeam: getRepTeamGameEventsForOpponentBookByTeam,
};

/**
 * ⚠ **THE CLUB LAYER IS ABSENT, NEVER BLOCKING.** It is an enrichment read over OTHER teams'
 * data hanging off two pages whose real job is the coach's own book. A transient failure in a
 * sibling's read must cost the club section, never the page — before this guard existed, one
 * bad row in another team's book could 500 a coach's own opponent card, and `withObservability`
 * re-throws by design so nothing downstream would have softened it.
 *
 * The failure is CAPTURED, not swallowed: silent degradation is how a broken club layer ships
 * unnoticed. `captureError` never throws, so this cannot become the thing it is guarding.
 */
async function absentOnFailure<T>(work: Promise<T>, fallback: T, route: string): Promise<T> {
  try {
    return await work;
  } catch (err) {
    await captureError(err, { route, severity: 'warning' });
    return fallback;
  }
}

/** "What does the rest of the club know about this opponent?" Null = nothing to show. */
export function assembleClubBookBlock(opts: {
  orgId: string;
  viewerTeamId: string;
  matchKeys: string[];
}): Promise<ClubBookBlock | null> {
  return absentOnFailure(
    buildClubBookBlock(dbReader, { ...opts, nowIso: new Date().toISOString() }),
    null,
    'club-shared-book/card',
  );
}

/**
 * Just the number, for the game drawer's one-line teaser — no records, no observation text.
 * 0 on failure, same "absent, never blocking" rule as the block itself.
 */
export function resolveClubObservationCount(opts: {
  orgId: string;
  viewerTeamId: string;
  matchKeys: string[];
}): Promise<number> {
  return absentOnFailure(
    buildClubObservationCount(dbReader, opts), 0, 'club-shared-book/count',
  );
}

/** The opponents-list badge keys AND the Opponent field's club spellings (Opponent Picker D5) — one
 *  cheap pass, in the viewer's own key space. `viewerEntries` may be a promise so the caller can
 *  start this alongside its own reads (see buildClubListExtras). Absent on failure, like every
 *  club read: a sibling's bad row costs the club group, never the schedule. */
export function resolveClubListExtras(opts: {
  orgId: string;
  viewerTeamId: string;
  viewerEntries: { key: string; aliasKeys: string[] }[] | Promise<{ key: string; aliasKeys: string[] }[]>;
}): Promise<{ keys: string[]; spellings: ClubPickerSpelling[] }> {
  return absentOnFailure(buildClubListExtras(dbReader, opts), { keys: [], spellings: [] }, 'club-shared-book/list');
}
