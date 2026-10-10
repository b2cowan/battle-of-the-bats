/**
 * A TOURNAMENT'S VENUES, IN WORDS — one home (Tournament admin redesign Stage 5, E5; hub v45; the words are
 * /marketing's, 2026-10-10, `.probe/s5b/words-final.md` §7). A lane is the sport's word ("Diamond").
 *
 *   - A venue is a record with its diamonds inside it: the row names them, or says "No diamonds yet" (amber).
 *   - The in-use rule is said BEFORE any tap: a venue with a played game is renamed, never deleted.
 *   - A copy from the club's Venue library says so, truly: the tournament keeps its own copy, and a change here or in
 *     the library stays where it is made (lib/venue-library-server: a library rename reaches the club's upcoming
 *     bookings, never a tournament's copy).
 *
 * Pure, so a plain Node unit test reads it.
 */
import { facilityNoun } from './venue-facilities.ts';
import type { FacilityType } from './types.ts';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const VENUE_WORDS = {
  title: 'Venues & facilities',
  add: 'Add a venue',
  addMany: (n: number) => (n <= 1 ? 'Add venue' : `Add ${n} venues`),
  adding: 'Adding…',
  addIdentity: (tournament: string) => tournament,
  none: 'No venues yet.',
  noneLine: 'Add the parks and fields this tournament plays at.',
  colVenue: 'Venue',
  colAddress: 'Address',
  colGames: 'Games',
  noGames: 'No games yet',
  games: (n: number) => plural(n, 'game', 'games'),
  /** A facility's line in the record: "5 games · 2 played". */
  facilityGames: (total: number, played: number) =>
    total === 0 ? 'No games' : `${plural(total, 'game', 'games')}${played > 0 ? ` · ${played} played` : ''}`,
  played: (n: number) => `${n} played`,
  address: 'Address',
  noAddress: 'No address',
  maps: 'Open in Maps',
  note: 'Note',
  notePlaceholder: 'Parking, washrooms, gate code…',
  name: 'Name',
  addressHint: 'Used for the Maps link on every schedule.',
  fromLibrary: 'Brought in from the club’s Venue library. This tournament keeps its own copy: a change here or in the library stays where it’s made.',
  fromLibraryShort: 'From the club’s Venue library',
  openLibrary: 'Open in the Venue library',
  inUse: 'It has played games, so you can rename it but not delete it.',
  deleteVenue: 'Delete this venue',
  edit: (name: string) => `Edit ${name}`,
  remove: (name: string) => `Remove ${name}`,
  laneName: (n: number) => `Name ${n}`,
  alreadyHere: 'Already in this tournament',
  /** Taking out a lane that upcoming games use — asked first (their lane goes; they stay at the venue). */
  takeOut: (lane: string) => `Take ${lane} out?`,
  takeOutBody: (n: number, venue: string, word: string) =>
    `${n === 1 ? '1 game uses it' : `${n} games use it`}. ${n === 1 ? 'It stays' : 'They stay'} at ${venue} with no ${word} until you give ${n === 1 ? 'it' : 'them'} one.`,
  takeOutAction: 'Take it out',
  // Mistakes — held, said in the pill; nothing typed is lost.
  nameHeld: 'Give the venue a name to save it.',
  laneNameHeld: (word: string) => `Give every ${word} a name to save it.`,
  laneTwiceHeld: (word: string) => `Two ${word}s have the same name.`,
  saveFailed: 'Couldn’t save',
  addFailed: (names: string) => `Couldn’t add ${names}. The others were added.`,
} as const;

/** "Diamond 1 · Diamond 2 · Diamond 3 · Diamond 4" (four names at most, then "and 2 more"). */
export function lanesLine(names: readonly string[]): string {
  const shown = names.slice(0, 4);
  const more = names.length - shown.length;
  return `${shown.join(' · ')}${more > 0 ? ` and ${more} more` : ''}`;
}

/** "No diamonds yet" — in the sport's word. */
export const noLanes = (kind: FacilityType) => `No ${facilityNoun(kind, 2)} yet`;

/** "Diamonds" — the record's section, in the sport's word. */
export const lanesHeading = (kind: FacilityType) => {
  const word = facilityNoun(kind, 2);
  return word.charAt(0).toUpperCase() + word.slice(1);
};

/** "Add a diamond". */
export const addLane = (kind: FacilityType) => `Add a ${facilityNoun(kind, 1)}`;

/** The delete question: what happens to its games (none played — the record shows no Delete otherwise). */
export function deleteVenueQuestion(name: string, upcoming: number): { title: string; body: string; action: string } {
  return {
    title: `Delete ${name}?`,
    body: upcoming === 0
      ? 'Nothing is scheduled there.'
      : `${plural(upcoming, 'upcoming game is', 'upcoming games are')} scheduled there. Deleting it takes the venue off ${upcoming === 1 ? 'that game' : 'them'}, so ${upcoming === 1 ? 'it shows' : 'they show'} as TBD until you give ${upcoming === 1 ? 'it' : 'them'} a new one.`,
    action: `Delete ${name}`,
  };
}
