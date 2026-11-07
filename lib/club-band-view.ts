/**
 * THE CLUB BAND — what the Overview's "The club today" band reads (Club Tier Stage 13b, Session A1; owner Asks 2 and 4).
 *
 * The shape the route (`/api/admin/club-band`) answers and the screen (`ClubBand.tsx`) draws, and every word the band
 * speaks, in one place (the /marketing pass reads this file). No server import here: the screen imports it.
 *
 * ⚖ A key is present only for a reader who holds the gate of the page that part opens (Accounting for cash and owed, the
 * club calendar's programs for this week, Rep teams / House league / Families for a Needs someone line). A tile the reader
 * cannot open is ABSENT, never greyed. A part whose read failed is named in `failed`, so one slow or broken read costs its
 * own tile and nothing else.
 */

export type ClubBandPart = 'cash' | 'owed' | 'week' | 'needs';

export interface ClubBand {
  /** The org-zone day the band was read for (YYYY-MM-DD). */
  today: string;
  /** Cash on hand: the club's own books (never a team's), and how many they are. */
  cash?: { amount: number; books: number };
  /**
   * Owed to the club. `teams` is Accounting's Owed by the teams (one definition); `league` is house league's Still owing,
   * summed over the live seasons (each season's own Money figure). A half the reader cannot open is absent.
   */
  owed?: {
    teams?: { amount: number; overdue: number };
    league?: { amount: number; players: number };
  };
  /** This week: bookings in the next seven days that are on, and the next one (within six weeks) when none are. */
  week?: { count: number; next: { day: string; who: string } | null };
  /** Needs someone: only what "This morning" does not already say. Each line is absent where the reader cannot open its page. */
  needs?: {
    noHeadCoach?: { count: number; firstTeamId: string | null; firstTeamName: string | null };
    /** Registrations (players, never households) with a house-league balance, and the season the door opens. */
    leagueOwing?: { players: number; seasonId: string | null };
    formsMissing?: { forms: number };
  };
  failed: ClubBandPart[];
}

/** Every word the band speaks. */
export const CLUB_BAND_WORDS = {
  title: 'The club today',
  eyebrow: (day: string) => `The club today · ${day}`,
  cash: {
    label: 'Cash on hand',
    books: (n: number) => (n === 1 ? 'in the club’s 1 book' : `in the club’s ${n} books`),
    none: 'No books yet',
  },
  owed: {
    label: 'Owed to the club',
    nothing: 'Nothing owed',
    teams: (amt: string, overdue: string | null) => (overdue ? `teams ${amt} (${overdue} overdue)` : `teams ${amt}`),
    league: (amt: string) => `house league ${amt}`,
    overdueShort: (overdue: string) => `${overdue} overdue`,
    door: 'see each team’s standing',
  },
  week: {
    label: 'This week',
    nothing: 'Nothing booked',
    on: (n: number) => (n === 1 ? '1 booking' : `${n} bookings`),
    next: (day: string, who: string) => `Next: ${day} · ${who}`,
    nextShort: (day: string) => `Next: ${day}`,
    nothingSoon: 'Nothing in the next six weeks',
  },
  needs: {
    label: 'Needs someone',
    noHeadCoach: (n: number, team: string | null) =>
      n === 1 && team ? `${team} has no head coach` : `${n} teams have no head coach`,
    noHeadCoachShort: (n: number, team: string | null) => (n === 1 && team ? `${team}: no head coach` : `${n} teams: no head coach`),
    leagueOwing: (n: number) => `${n} ${n === 1 ? 'player owes' : 'players owe'} house league fees`,
    leagueOwingShort: (n: number) => `${n} ${n === 1 ? 'player owes' : 'players owe'}`,
    formsMissing: (n: number) => `${n} rep-team ${n === 1 ? 'form' : 'forms'} missing`,
    nobody: 'Nothing to chase today',
  },
  failed: 'The club today didn’t load.',
  retry: 'Try again',
  tileFailed: 'Didn’t load',
} as const;
