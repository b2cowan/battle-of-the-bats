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
  isLive: boolean;          // transient client state — 5s flash on Realtime update
}
