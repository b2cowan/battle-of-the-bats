/**
 * DIVISIONS, IN WORDS — one home (Tournament admin redesign Stage 5, E4; hub v45; the words are /marketing's,
 * 2026-10-10, `.probe/s5b/words-final.md` §6).
 *
 *   - A full division is GOOD NEWS: "6 of 6 · full", in the row's own ink — never red (Q 3.1).
 *   - Registration open or closed is said in words; it changes on Teams (J1-040), so the record's door goes there.
 *   - "Its own settings" says, for fee, game length, tie-breakers and contact, whether the division has its own or uses
 *     the event's — the facts the old window hid behind "Division Overrides".
 *   - Delete asks ONCE, with the counts the record already knows, and its button names everything that goes.
 *   - An Exhibition's division never speaks of playoff seeding (F88).
 *
 * Pure, so a plain Node unit test reads it.
 */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const andList = (items: readonly string[]) =>
  items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;

export type DivisionCounts = { games: number; scoredGames: number; teams: number; waitlist: number };

export const DIVISION_WORDS = {
  title: 'Divisions',
  add: 'Add division',
  noun: 'division',
  none: 'No divisions yet.',
  noneLine: 'Add a division for each age group or category teams register in.',
  colDivision: 'Division',
  colAges: 'Ages',
  colPools: 'Pools',
  colRegistration: 'Registration',
  colTeams: 'Teams',
  /** "18 of 18 spots taken" — the list's foot. */
  spotsTaken: (taken: number, spots: number) => `${taken} of ${spots} spots taken`,
  teamsAccepted: (n: number) => plural(n, 'team accepted', 'teams accepted'),

  // ── The record ──
  registration: 'Registration',
  teams: 'Teams',
  waitlist: 'Waitlist',
  registrationOpen: 'Open',
  registrationClosed: 'Closed',
  registrationDoor: 'Open or close it on Teams',
  pools: 'Pools',
  noPools: 'None',
  whoPicks: 'Who picks',
  teamsPick: 'Teams pick when they register',
  youAssign: 'You assign them',
  ownSettings: 'Its own settings',
  fee: 'Fee',
  gameLength: 'Game length',
  tieBreakers: 'Tie-breakers',
  contact: 'Contact',
  theEvents: 'The event’s',
  theEventsContact: 'The event’s contact',
  theEventsLength: (minutes: number) => `The event’s ${minutes} min`,
  ownLength: (minutes: number) => `${minutes} min`,
  noFee: 'No fee set',
  deleteDivision: 'Delete this division',
  edit: 'Edit the division',

  // ── The form ──
  name: 'Name',
  youngest: 'Youngest',
  oldest: 'Oldest',
  agesHint: 'Leave either blank for no limit.',
  capacity: 'Teams it holds',
  capacityHint: 'No limit if blank.',
  splitPools: 'Split into pools',
  poolCount: 'How many pools',
  poolName: (letter: string) => `Pool ${letter}`,
  teamsPickSwitch: 'Teams pick their pool when they register',
  contactEvents: 'The event’s contact',
  useEvents: 'Use the event’s',
  ownFee: 'Its own fee',
  depositAmount: 'Deposit',
  depositDue: 'Deposit due',
  totalFee: 'Total fee',
  totalDue: 'Total due',
  ownTiming: 'Its own game length',
  gameMinutes: 'Game length (minutes)',
  bufferMinutes: 'Between games (minutes)',
  ownTieBreakers: 'Its own tie-breakers',
  /** The tie-breakers' line: an Exhibition has no playoffs to seed (F88). */
  tieBreakersFor: (exhibition: boolean) => (exhibition
    ? 'The order that breaks a tie in this division’s standings.'
    : 'The order that breaks a tie in this division’s standings and playoff seeding.'),
  requiredHere: 'This event sets it for each division.',
  cancel: 'Cancel',
  creating: 'Adding…',

  // ── Mistakes, under their field (no browser alert box) ──
  nameHeld: 'Give the division a name to save it.',
  agesWhole: 'Ages are whole numbers, or blank for no limit.',
  agesOrder: 'The youngest age can’t be more than the oldest.',
  capacityWhole: 'Teams it holds must be a whole number, or blank for no limit.',
  saveFailed: 'Couldn’t save',
} as const;

/** "Ages 9–11" / "Ages 13 and up" / "Up to age 11" / null when open. */
export function agesLine(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min == null && max == null) return null;
  if (min == null) return `Up to age ${max}`;
  if (max == null) return `Ages ${min} and up`;
  return min === max ? `Age ${min}` : `Ages ${min}–${max}`;
}

/** The row's caption: "Ages 9–11 · pools Red and Blue · registration open". */
export function divisionCaption(d: { minAge?: number | null; maxAge?: number | null; poolNames: readonly string[]; isClosed: boolean }): string {
  return [
    agesLine(d.minAge, d.maxAge),
    d.poolNames.length >= 2 ? `pools ${andList(d.poolNames)}` : null,
    d.isClosed ? 'registration closed' : 'registration open',
  ].filter(Boolean).join(' · ');
}

/** "6 of 6 · full" / "7 of 8" / "0 of 8" / "6 teams" (no limit). */
export function teamsFigure(accepted: number, capacity: number | null | undefined): string {
  if (capacity == null || capacity <= 0) return plural(accepted, 'team', 'teams');
  return accepted >= capacity ? `${accepted} of ${capacity} · full` : `${accepted} of ${capacity}`;
}

/** The delete question — asked ONCE, with what goes (the counts the record already read). */
export function deleteQuestion(name: string, c: DivisionCounts): { title: string; body: string; action: string } {
  const title = `Delete ${name}?`;
  if (c.games === 0 && c.teams === 0) return { title, body: 'Nothing is in it.', action: `Delete ${name}` };
  const games = c.games > 0
    ? `${plural(c.games, 'game', 'games')}${c.scoredGames > 0 ? ` (${c.scoredGames} with a score)` : ''}`
    : null;
  const teams = c.teams > 0
    ? `${plural(c.teams, 'team', 'teams')}${c.waitlist > 0 ? `, ${c.waitlist} of them on the waitlist` : ''}`
    : null;
  const holds = [games, teams].filter(Boolean).join(' and ');
  const all = c.games + c.teams === 1 ? 'it' : 'all of them';
  const keep = c.teams > 0 ? ' To keep the teams, move them to another division on Teams first.' : '';
  const goes = [c.games > 0 ? plural(c.games, 'game', 'games') : null, c.teams > 0 ? plural(c.teams, 'team', 'teams') : null]
    .filter(Boolean).join(' and ');
  return {
    title,
    body: `It holds ${holds}. Deleting it removes ${all} for good.${keep}`,
    action: `Delete ${name}, its ${goes}`,
  };
}
