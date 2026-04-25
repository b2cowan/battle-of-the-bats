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
  poolCount?: number; // how many pools to split into
}

export interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
}

export interface Team {
  id: string;
  tournamentId: string; // which tournament year this roster belongs to
  ageGroupId: string;
  name: string;
  coach: string;
  email?: string;
  players: Player[];
  pool?: string; // pool name/index e.g. "A"
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
  homeScore?: number;
  awayScore?: number;
  status: GameStatus;
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
