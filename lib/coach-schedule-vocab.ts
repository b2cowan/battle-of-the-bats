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
import { COACH_GAME_EVENT_TYPES, sideWord } from './coach-tournament-games.ts';

/**
 * The colour per event type — the other half of how a coach recognises one at a glance, alongside
 * the icon (`components/coaches/eventTypeMark.tsx`, which re-exports this so a caller gets the pair
 * from one import).
 *
 * ⚠ **A TOKEN, NEVER A LITERAL.** The warm portal theme remaps every one of these in `globals.css`,
 * so a hard-coded hex looks right in the dark theme and wrong in the warm one — a defect class this
 * repo has paid for repeatedly.
 *
 * ⚠⚠ **THE COLOUR NEVER CARRIES THE MEANING ON ITS OWN.** League-green and tournament-amber sit
 * close enough to be a coin-flip for a red-green colour-blind coach, so every caller keeps the WORD
 * beside the mark, or keeps the facts that make the row readable without it. The colour reinforces;
 * it never informs.
 *
 * ⚠ It lives HERE rather than beside the icons because it is pure data and this module is where the
 * rest of the event vocabulary already lives (`EVENT_LABELS`, `EVENT_WORD`, `EVENT_NAME_PREFIX`) —
 * so it stays testable under plain `node --test` and the vocabulary stays in one place. Only the
 * icons genuinely need React (`/simplify`, 2026-08-18).
 */
export const EVENT_COLORS: Record<RepEventType, string> = {
  external_tournament: 'var(--evt-external-tournament)',
  tournament_game:     'var(--evt-tournament-game)',
  league_game:         'var(--evt-league-game)',
  practice:            'var(--evt-practice)',
  team_event:          'var(--evt-team-event)',
};

/** Display label per event type. THIS IS THE EXPORT'S "Event Type" COLUMN — changing a string here
 *  changes what a coach's exported spreadsheet says, and what the importer must accept.
 *  ⚠ `league_game` reads "Game" (owner ruling D1, 2026-09-20): a scrimmage is a Game with a box
 *  ticked, so the export writes that state through `eventTypeCell`, never through this map alone. */
export const EVENT_LABELS: Record<RepEventType, string> = {
  external_tournament: 'Tournament',
  tournament_game:     'Game (Tournament)',
  league_game:         'Game',
  practice:            'Practice',
  team_event:          'Team Event',
};

/** The export's word for a ticked Game. Also what the importer reads back as Game + scrimmage. */
export const SCRIMMAGE_LABEL = 'Scrimmage';

/**
 * The box a WRITE may store, given the kind it is being stored on: true only for a Game that asked
 * for it. A tournament game is scored by its organizer and never carries the box (owner ruling D3,
 * 2026-09-20); every other kind stores false whatever the body said. The routes and the db layer
 * both call this — the one place the rule is written.
 */
export function scrimmageFlagFor(eventType: string | null | undefined, requested: unknown): boolean {
  return eventType === 'league_game' && requested === true;
}

/**
 * What a STORED row means, read through the vocabulary. A row whose kind is still the pre-306
 * `scrimmage` — written by code older than the migration, in the window between applying it and
 * the deploy — reads as exactly what the migration's fold makes it: a Game with the box ticked.
 * Every reader that maps a raw row goes through here (the event mapper, the opponent-book fetch,
 * the masthead feed), so the belt is one line to delete once prod is folded.
 */
export function readStoredEventKind(row: { event_type: string; is_scrimmage?: boolean | null }): { eventType: RepEventType; isScrimmage: boolean } {
  const legacy = row.event_type === 'scrimmage';
  return {
    eventType: (legacy ? 'league_game' : row.event_type) as RepEventType,
    isScrimmage: legacy || row.is_scrimmage === true,
  };
}

/** The "Event Type" cell for ONE event — the label, except a ticked Game writes "Scrimmage" so the
 *  sheet still carries the fact and round-trips through `parseEventTypeCell`. One column, two words
 *  for the two states of one kind. */
export function eventTypeCell(e: { eventType: RepEventType; isScrimmage: boolean }): string {
  return e.isScrimmage && e.eventType === 'league_game' ? SCRIMMAGE_LABEL : EVENT_LABELS[e.eventType];
}

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
  league_game:         'game',
  practice:            'practice',
  team_event:          'team event',
};

/** The word for ONE event inside a sentence — "scrimmage" when the box is ticked, else the kind's
 *  word. Every sentence-builder reads this, not `EVENT_WORD` directly, so the masthead's
 *  "Next: Sat 1:00 p.m. scrimmage" survived scrimmage ceasing to be a kind. */
export function eventWord(e: { eventType: RepEventType; isScrimmage: boolean }): string {
  return e.isScrimmage ? 'scrimmage' : (EVENT_WORD[e.eventType] ?? 'event');
}

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

/** Friendly default name when the coach leaves the name blank and there is no opponent to derive
 *  one from. A GAME with an opponent never uses this — `deriveGameName` writes "vs X" / "@ X". */
export const EVENT_NAME_PREFIX: Record<RepEventType, string> = {
  external_tournament: 'Tournament',
  tournament_game: 'Tournament Game',
  league_game: 'Game',
  practice: 'Practice',
  team_event: 'Team Event',
};

/** Event types that capture an opponent + home/away. Re-uses the list `coach-tournament-games`
 *  already owns — a second copy of "which types are games" is exactly the drift this module was
 *  extracted to prevent. */
export const needsOpponent = (t: RepEventType) => (COACH_GAME_EVENT_TYPES as RepEventType[]).includes(t);

/** Event types that can be set to repeat weekly: practices, games (scrimmage or not — a standing
 *  Tuesday against a partner club is a series like any other, D5), generic team events. Tournament
 *  games stay one-off (tournament-bound). */
export const RECURRABLE_TYPES: RepEventType[] = ['practice', 'league_game', 'team_event'];
export const needsRecurrence = (t: RepEventType) => RECURRABLE_TYPES.includes(t);

/**
 * Auto-derived name for a game from its opponent and side ('' when not a game / no opponent yet).
 *
 * A GAME reads "vs Oakville Royals" at home (or neutral) and "@ Oakville Royals" away — no kind
 * word, because the kind is the mark beside the row and "scrimmage" is a chip, not a name (owner
 * ruling D2, 2026-09-20). A tournament game keeps its prefix ("Tournament Game vs X"): it belongs
 * to a tournament and this project left that kind alone (D3).
 *
 * Reads `sideWord` — the same word `opponentSuffix` (lib/coach-tournament-games) appends to a name
 * that does not already carry the matchup — so one grammar holds whichever path wrote the row.
 */
export function deriveGameName(type: RepEventType, opponent: string, homeAway?: string | null): string {
  const opp = opponent.trim();
  if (!needsOpponent(type) || !opp) return '';
  if (type === 'league_game') return `${sideWord(homeAway)} ${opp}`;
  return `${EVENT_NAME_PREFIX[type]} vs ${opp}`;
}

/**
 * Whether `name` is one the PRODUCT wrote rather than the coach — exactly what `deriveGameName`
 * writes for THIS opponent and THIS side, either of the pre-306 shapes ("League Game vs X",
 * "Scrimmage vs X"), or a bare kind word. An edit that changes the opponent or the side re-derives
 * such a name; a name a coach typed is never touched — which is why the side matters: "vs X" on an
 * AWAY game is not what the product writes (it writes "@ X"), so it is the coach's and stays
 * (/review, 2026-09-21). Mig 306's rename step encodes the same predicate in SQL — keep in step.
 */
export function isAutoShapedName(name: string, type: RepEventType, opponent: string | null | undefined, homeAway?: string | null): boolean {
  const n = name.trim();
  if (!n) return true;
  if (n === EVENT_NAME_PREFIX[type] || n === 'League Game' || n === 'Scrimmage') return true;
  const opp = (opponent ?? '').trim();
  if (!opp) return false;
  return n === deriveGameName(type, opp, homeAway)
    || n === `League Game vs ${opp}` || n === `Scrimmage vs ${opp}`;
}

export const HOME_AWAY_CHOICES: { value: string; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'away', label: 'Away' },
  { value: 'neutral', label: 'Neutral' },
];

const norm = (v: string) => v.trim().toLowerCase().replace(/[\s_-]+/g, ' ');

/** What an "Event Type" cell resolves to: the kind, and whether the Game is a scrimmage. */
export interface ParsedEventType { type: RepEventType; isScrimmage: boolean }

/**
 * An "Event Type" cell → a kind (+ the scrimmage box), or null when it is not one we know.
 *
 * Accepts the exact label the export writes, the stored key itself (so a hand-built sheet using
 * `league_game` still reads), the words the export USED to write ("League Game", and "Scrimmage"
 * — which is still what a ticked Game exports as), and the few spellings a coach plausibly types.
 * It does NOT guess: an unrecognised value comes back null and the row is handed to the coach with
 * the reason, rather than being filed as whatever seemed closest (H2 rule 3).
 */
export function parseEventTypeCell(raw: string | null | undefined): ParsedEventType | null {
  const text = norm(raw ?? '');
  if (!text) return null;
  for (const [key, label] of Object.entries(EVENT_LABELS) as [RepEventType, string][]) {
    if (text === norm(label) || text === norm(key)) return { type: key, isScrimmage: false };
  }
  const scrimmageWords = [norm(SCRIMMAGE_LABEL), 'exhibition', 'friendly', 'exh'];
  if (scrimmageWords.includes(text)) return { type: 'league_game', isScrimmage: true };
  const aliases: Record<string, RepEventType> = {
    'league game': 'league_game',
    'league': 'league_game',
    'game league': 'league_game',
    'tournament game': 'tournament_game',
    'training': 'practice',
    'event': 'team_event',
    'team': 'team_event',
  };
  const type = aliases[text];
  return type ? { type, isScrimmage: false } : null;
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
