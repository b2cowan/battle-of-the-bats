/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE BALANCED DRAFT (Club Tier Stage 9c, rulings Q8, 9c·3, 9c·7, 9c·8; build prompt argument 3).
 *
 * A pure function: players with a rating (not rated counts as a 3), locks, teams, and a seed in; a team for every
 * unlocked player out. The rule, as the setup window says it ("Strongest first, and the order reverses each round. Ties
 * and the first pick are drawn at random."):
 *   1. Locked players stay where they are and their ratings start their team's total and size.
 *   2. Everyone else is sorted strongest first; equal ratings are shuffled by the seed.
 *   3. They are dealt in snake order: the first round runs from the team with the lowest locked total (ties drawn by the
 *      seed), the next round runs back, and so on.
 *   4. **Sizes come first:** a team skips its turn while it has more players than the smallest team, so locks never
 *      leave the teams uneven, and the sizes end at most one apart wherever the locks allow it.
 * The owner ruled "snake" and "counts their ratings"; rule 4 is what keeps a lock from costing another team a player.
 *
 * The draft writes nothing: `league_division_draft_apply` (mig 377) lands its answer whole. Tests:
 * tests/unit/house-league-draft.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** What an unrated player counts as (9c·8). */
export const NOT_RATED_COUNTS_AS = 3;

export interface DraftPlayer {
  id: string;
  /** 1-5, or null when not rated (counts as a 3). */
  rating: number | null;
  /** The team this player is locked to, or null. A lock to a team not in the draft is ignored. */
  lockedTeamId: string | null;
}

export type DraftRefusal = 'noTeams' | 'noPlayers' | 'tooFew' | 'lockedFull';

export type DraftResult =
  | { ok: true; deal: Map<string, string> }
  | { ok: false; refusal: DraftRefusal };

export const ratingOf = (p: { rating: number | null }): number => p.rating ?? NOT_RATED_COUNTS_AS;

/** A small seeded generator (mulberry32): the same seed deals the same teams, so a test can pin a deal. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Why a draft can't run, before any dealing (copy §4.3). */
export function draftRefusal(players: readonly DraftPlayer[], teamIds: readonly string[]): DraftRefusal | null {
  if (teamIds.length === 0) return 'noTeams';
  if (players.length === 0) return 'noPlayers';
  if (players.length < teamIds.length) return 'tooFew';
  const teams = new Set(teamIds);
  if (players.every(p => p.lockedTeamId && teams.has(p.lockedTeamId))) return 'lockedFull';
  return null;
}

export function runDraft(players: readonly DraftPlayer[], teamIds: readonly string[], seed: number): DraftResult {
  const refusal = draftRefusal(players, teamIds);
  if (refusal) return { ok: false, refusal };
  const random = seededRandom(seed);
  const teams = new Set(teamIds);
  const size = new Map<string, number>(teamIds.map(t => [t, 0]));
  const total = new Map<string, number>(teamIds.map(t => [t, 0]));

  const free: DraftPlayer[] = [];
  for (const p of players) {
    if (p.lockedTeamId && teams.has(p.lockedTeamId)) {
      size.set(p.lockedTeamId, size.get(p.lockedTeamId)! + 1);
      total.set(p.lockedTeamId, total.get(p.lockedTeamId)! + ratingOf(p));
    } else {
      free.push(p);
    }
  }

  // Strongest first; a tie is drawn at random (shuffle, then a stable sort keeps the shuffled order inside a rating).
  const order = shuffled(free, random).sort((a, b) => ratingOf(b) - ratingOf(a));
  // The first round starts from the lowest locked total; equal totals are drawn at random the same way.
  const round = shuffled(teamIds, random).sort((a, b) => total.get(a)! - total.get(b)!);

  const deal = new Map<string, string>();
  let turn = 0;
  const snake = (i: number) => {
    const lap = Math.floor(i / round.length);
    const at = i % round.length;
    return round[lap % 2 === 0 ? at : round.length - 1 - at];
  };
  for (const player of order) {
    const smallest = Math.min(...size.values());
    // Skip any team that is already bigger than the smallest; within a lap there is always one that isn't.
    let team = snake(turn);
    while (size.get(team)! > smallest) team = snake(++turn);
    turn += 1;
    deal.set(player.id, team);
    size.set(team, size.get(team)! + 1);
    total.set(team, total.get(team)! + ratingOf(player));
  }
  return { ok: true, deal };
}

/** A team's average rating to one decimal, counting a not-rated player as a 3, or null when nobody on it is rated. */
export function teamAverage(players: readonly { rating: number | null }[]): number | null {
  if (players.length === 0 || players.every(p => p.rating === null)) return null;
  return Math.round((players.reduce((sum, p) => sum + ratingOf(p), 0) / players.length) * 10) / 10;
}
