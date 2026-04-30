export interface Tournament {
  id: string;
  year: number;        // e.g. 2026
  name: string;        // e.g. "Battle of the Bats 2026"
  isActive: boolean;   // the tournament shown on the public site
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD
}

export interface Diamond {
  id: string;
  tournamentId: string;
  name: string;     // e.g. "Diamond 1 — Lions Park"
  address: string;  // full address for Google Maps
  notes?: string;   // parking info, field notes, etc.
}

export interface Contact {
  id: string;
  tournamentId: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

export interface PlayoffConfig {
  type: 'single';
  crossover: 'standard' | 'top-bottom' | 'none';
  hasThirdPlace: boolean;
  teamsQualifying: number;
  tieBreakers: ('h2h' | 'rf' | 'ra' | 'rd')[];
}

export interface BracketSlot {
  id: string;
  seedLabel: string;       // "Seed #1", "1st Pool A", or team name
  teamId?: string;         // Resolved team ID (null until seeded)
  isBye: boolean;
}

export interface BracketMatchup {
  id: string;
  roundIndex: number;
  position: number;        // Vertical position within the round
  bracketCode: string;     // "QF1", "SF2", "FIN", etc.
  homeSlot: BracketSlot;
  awaySlot: BracketSlot;
  winnersTo?: string;      // bracketCode of next matchup for winner
  losersTo?: string;       // bracketCode for consolation/3rd place
}

export interface BracketConfig {
  rounds: {
    name: string;          // "Quarterfinals", "Semifinals", etc.
    matchups: BracketMatchup[];
  }[];
  consolation: BracketMatchup[];  // 3rd place / consolation bracket
}

export interface AgeGroup {
  id: string;
  tournamentId: string;
  name: string; // e.g. "U11"
  minAge: number;
  maxAge: number;
  order: number;
  contactId?: string; // links to a managed Contact
  isClosed?: boolean; // if true, public registration is disabled
  capacity?: number;  // threshold for waitlist
  poolCount?: number;
  poolNames?: string; // (Legacy) Comma separated
  requiresPoolSelection?: boolean; // if true, user picks pool during registration
  pools?: Pool[]; // The new way
  playoffConfig?: PlayoffConfig;
}

export interface Pool {
  id: string;
  ageGroupId: string;
  name: string;
  order: number;
}

export interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
}

export interface Team {
  id: string;
  tournamentId: string;
  ageGroupId: string;
  name: string;
  coach: string;
  email: string;
  players: Player[];
  status: 'pending' | 'accepted' | 'waitlist' | 'rejected';
  paymentStatus: 'pending' | 'paid';
  registeredAt: string;
  adminNotes?: string;
  poolId?: string; // The new way (link to pools table)
}

export type GameStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Game {
  id: string;
  tournamentId: string; // which tournament year this game belongs to
  ageGroupId: string;
  homeTeamId: string;
  awayTeamId: string;
  date: string; // ISO date string YYYY-MM-DD
  time: string; // HH:MM
  location: string;      // display name (kept for backward compat)
  diamondId?: string;    // links to a managed Diamond record
  homeScore?: number | null;
  awayScore?: number | null;
  status: GameStatus;
  isPlayoff?: boolean;
  bracketId?: string;
  bracketCode?: string;
  homePlaceholder?: string;
  awayPlaceholder?: string;
  notes?: string;
}

export interface Announcement {
  id: string;
  tournamentId: string;
  title: string;
  body: string;
  date: string; // ISO date string
  pinned: boolean;
}
