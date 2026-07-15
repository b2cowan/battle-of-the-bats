export interface BracketNode {
  id: string;
  round: number;       // column index (0 = earliest, e.g. QF)
  position: number;    // vertical position within the column
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerId: string | null;  // computed from scores — not a DB column
  bracketCode: string;
  isLive: boolean;          // in its live time-window NOW (lib/game-status.isGameLive) with both slots resolved
  date: string;
  time: string;
  status: 'scheduled' | 'submitted' | 'completed' | 'cancelled';
  /** Short field/diamond label resolved LIVE from venues (e.g. "Diamond 2"); '' when unknown. */
  venueLabel?: string;
}
