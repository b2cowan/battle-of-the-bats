// The coach schedule's shared vocabulary — event-type labels, name derivation and home/away.
//
// Lifted out of the schedule page in Chunk C because THREE surfaces now have to agree on it: the
// page renders it, the export writes it, and the importer reads it back. Chunk H2 rule 4 states
// the obligation plainly — "an exporter and an importer that don't share a column vocabulary are
// two features, not one" — and the recurrence writer needs the name prefix too, so a series of
// twelve opponents names each game after its own.
//
// Pure data + pure functions, no React, no I/O. Relative WITH the .ts extension so the unit tests
// can run under plain `node --test`.
import type { RepEventType, RepAttendanceStatus } from './types.ts';
import { COACH_GAME_EVENT_TYPES } from './coach-tournament-games.ts';

/** Display label per event type. THIS IS THE EXPORT'S "Event Type" COLUMN — changing a string here
 *  changes what a coach's exported spreadsheet says, and what the importer must accept. */
export const EVENT_LABELS: Record<RepEventType, string> = {
  external_tournament: 'Tournament',
  tournament_game:     'Game (Tournament)',
  scrimmage:           'Scrimmage',
  league_game:         'League Game',
  practice:            'Practice',
  team_event:          'Team Event',
};

/**
 * The short, lowercase word for an event type, for use INSIDE a sentence — "Next: Thu 6:00 p.m.
 * practice" (the team masthead's status line, A2).
 *
 * Deliberately not `EVENT_LABELS`: those strings are the export/import column contract, so they
 * are title-case headers ("Game (Tournament)") that read as a label rather than as the tail of a
 * sentence. Sport-neutral by rule — a league game and a tournament game are both just a "game".
 */
export const EVENT_WORD: Record<RepEventType, string> = {
  external_tournament: 'tournament',
  tournament_game:     'game',
  scrimmage:           'scrimmage',
  league_game:         'game',
  practice:            'practice',
  team_event:          'team event',
};

/**
 * The four words for the four attendance answers. Lives here, with the rest of the schedule's
 * vocabulary, because more than one surface now says them: the Schedule's attendance control, and
 * the lineup builder's bench rail. Two hand-kept copies of four words is how "Out" on one screen
 * becomes "Absent" on the next.
 */
export const ATTENDANCE_WORD: Record<RepAttendanceStatus, string> = {
  attending: 'In',
  late:      'Late',
  absent:    'Out',
  unknown:   'No reply',
};

/** Prefix used to auto-name an event. Games derive "{prefix} vs {opponent}"; other types use it as
 *  a friendly default when the coach leaves the name blank. */
export const EVENT_NAME_PREFIX: Record<RepEventType, string> = {
  external_tournament: 'Tournament',
  tournament_game: 'Tournament Game',
  scrimmage: 'Scrimmage',
  league_game: 'League Game',
  practice: 'Practice',
  team_event: 'Team Event',
};

/** Event types that capture an opponent + home/away. Re-uses the list `coach-tournament-games`
 *  already owns — a second copy of "which types are games" is exactly the drift this module was
 *  extracted to prevent. */
export const needsOpponent = (t: RepEventType) => (COACH_GAME_EVENT_TYPES as RepEventType[]).includes(t);

/** Event types that can be set to repeat weekly: practices, league games, generic team events.
 *  Scrimmages and tournament games stay one-off (tournament-bound / ad hoc). */
export const RECURRABLE_TYPES: RepEventType[] = ['practice', 'league_game', 'team_event'];
export const needsRecurrence = (t: RepEventType) => RECURRABLE_TYPES.includes(t);

/** Auto-derived name for a game type from its opponent ('' when not a game / no opponent yet). */
export function deriveGameName(type: RepEventType, opponent: string): string {
  const opp = opponent.trim();
  return needsOpponent(type) && opp ? `${EVENT_NAME_PREFIX[type]} vs ${opp}` : '';
}

export const HOME_AWAY_CHOICES: { value: string; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'away', label: 'Away' },
  { value: 'neutral', label: 'Neutral' },
];

const norm = (v: string) => v.trim().toLowerCase().replace(/[\s_-]+/g, ' ');

/**
 * An "Event Type" cell → a `RepEventType`, or null when it is not one we know.
 *
 * Accepts the exact label the export writes, the stored key itself (so a hand-built sheet using
 * `league_game` still reads), and the few spellings a coach plausibly types. It does NOT guess:
 * an unrecognised value comes back null and the row is handed to the coach with the reason,
 * rather than being filed as whatever seemed closest (H2 rule 3).
 */
export function parseEventTypeCell(raw: string | null | undefined): RepEventType | null {
  const text = norm(raw ?? '');
  if (!text) return null;
  for (const [key, label] of Object.entries(EVENT_LABELS) as [RepEventType, string][]) {
    if (text === norm(label) || text === norm(key)) return key;
  }
  const aliases: Record<string, RepEventType> = {
    'game': 'league_game',
    'league': 'league_game',
    'game league': 'league_game',
    'tournament game': 'tournament_game',
    'exhibition': 'scrimmage',
    'friendly': 'scrimmage',
    'training': 'practice',
    'event': 'team_event',
    'team': 'team_event',
  };
  return aliases[text] ?? null;
}

/** A "Home/Away" cell → a stored value, or null when blank/unknown (never guessed). */
export function parseHomeAwayCell(raw: string | null | undefined): string | null {
  const text = norm(raw ?? '');
  if (!text) return null;
  if (text === 'h' || text === 'home') return 'home';
  if (text === 'a' || text === 'away') return 'away';
  if (text === 'n' || text === 'neutral') return 'neutral';
  return null;
}
