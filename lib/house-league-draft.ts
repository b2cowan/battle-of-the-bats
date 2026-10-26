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
  /** The household: the guardian's email. Blank or absent, the child stands alone. Read only with `together`. */
  household?: string | null;
}

export interface DraftOptions {
  /** Families together (A7): a household's children in this division go to one team. Absent or false: today's deal. */
  together?: boolean;
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

export function runDraft(players: readonly DraftPlayer[], teamIds: readonly string[], seed: number, options: DraftOptions = {}): DraftResult {
  const refusal = draftRefusal(players, teamIds);
  if (refusal) return { ok: false, refusal };
  // Families together, only when there is a family to keep together: otherwise the deal below, untouched — so the
  // switch off (or a division with no brothers and sisters) deals exactly as before A7, seed for seed.
  if (options.together) {
    const units = familyUnits(players, teamIds);
    if (units) return { ok: true, deal: dealUnits(units, teamIds, seed) };
  }
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

/**
 * ── FAMILIES TOGETHER (HOUSE_LEAGUE_DRAFT_BOARD_AT_SCALE A7; the household unit, owner 2026-10-26) ──────────────────
 * A household is the same guardian email (trimmed, lower-cased); a blank one stands alone. With the switch on:
 *   1. Locks stay, as always, and count toward their team.
 *   2. A household with locks on ONE team: its unlocked children follow onto that team (placed before the deal, counted
 *      like locks). Locks on two or more teams: the locks win, and the unlocked children are a unit of their own.
 *   3. The rest are units — a family (two or more unlocked children) or a single player. Families are dealt first,
 *      biggest first, then by their summed rating (not rated = 3), strongest first; then the single players, strongest
 *      first. Dealt first, a family lands while the teams are small, and the single players even the sizes out —
 *      so a family never arrives at a full team late. Ties are drawn by the seed.
 *   4. The same snake, and the same size rule: a team takes a turn only while it is among the smallest. A unit of k
 *      adds k. When a division is nearly all families the sizes may end more than one apart; the family stays whole.
 */
interface DraftUnit { ids: string[]; rating: number }
interface FamilyPlan { placed: Map<string, string>; size: Map<string, number>; total: Map<string, number>; families: DraftUnit[]; singles: DraftUnit[] }

const householdOf = (p: DraftPlayer) => (p.household ?? '').trim().toLowerCase() || null;

/** The units to deal, or null when no household has two children to keep together (then the deal is today's). */
function familyUnits(players: readonly DraftPlayer[], teamIds: readonly string[]): FamilyPlan | null {
  const teams = new Set(teamIds);
  const size = new Map<string, number>(teamIds.map(t => [t, 0]));
  const total = new Map<string, number>(teamIds.map(t => [t, 0]));
  const lockedTo = (p: DraftPlayer) => (p.lockedTeamId && teams.has(p.lockedTeamId) ? p.lockedTeamId : null);
  const byHome = new Map<string, DraftPlayer[]>();
  for (const p of players) {
    const home = householdOf(p);
    if (!home) continue;
    const list = byHome.get(home);
    if (list) list.push(p); else byHome.set(home, [p]);
  }
  // Something to keep together: two unlocked children, or one unlocked child whose family is locked to ONE team. A lone
  // unlocked child of a family locked across two teams has nobody to follow, so it deals as before.
  const keeps = (list: readonly DraftPlayer[]) => {
    const free = list.filter(p => !lockedTo(p)).length;
    const lockTeams = new Set(list.map(lockedTo).filter(Boolean)).size;
    return free >= 2 || (free === 1 && lockTeams === 1);
  };
  if (![...byHome.values()].some(keeps)) return null;

  const add = (team: string, p: DraftPlayer) => {
    size.set(team, size.get(team)! + 1);
    total.set(team, total.get(team)! + ratingOf(p));
  };
  const placed = new Map<string, string>();
  const families: DraftUnit[] = [];
  const singles: DraftUnit[] = [];
  const unit = (list: readonly DraftPlayer[]): DraftUnit => ({ ids: list.map(p => p.id), rating: list.reduce((s, p) => s + ratingOf(p), 0) });
  const seen = new Set<string>();
  for (const p of players) {
    const team = lockedTo(p);
    if (team) { add(team, p); continue; }
    if (seen.has(p.id)) continue;
    const home = householdOf(p);
    const kin = home ? byHome.get(home)! : [p];
    const free = kin.filter(k => !lockedTo(k));
    for (const k of free) seen.add(k.id);
    const lockTeams = new Set(kin.map(lockedTo).filter((t): t is string => !!t));
    if (lockTeams.size === 1) {
      const [team1] = lockTeams;
      for (const k of free) { placed.set(k.id, team1); add(team1, k); }
    } else if (free.length >= 2) {
      families.push(unit(free));
    } else {
      singles.push(unit(free));
    }
  }
  return { placed, size, total, families, singles };
}

function dealUnits(plan: FamilyPlan, teamIds: readonly string[], seed: number): Map<string, string> {
  const random = seededRandom(seed);
  const { size, total } = plan;
  const families = shuffled(plan.families, random).sort((a, b) => b.ids.length - a.ids.length || b.rating - a.rating);
  const singles = shuffled(plan.singles, random).sort((a, b) => b.rating - a.rating);
  const round = shuffled(teamIds, random).sort((a, b) => total.get(a)! - total.get(b)!);
  const snake = (i: number) => {
    const lap = Math.floor(i / round.length);
    const at = i % round.length;
    return round[lap % 2 === 0 ? at : round.length - 1 - at];
  };
  const deal = new Map(plan.placed);
  const single = new Map<string, { team: string; rating: number }>();
  let turn = 0;
  for (const u of [...families, ...singles]) {
    const smallest = Math.min(...size.values());
    let team = snake(turn);
    while (size.get(team)! > smallest) team = snake(++turn);
    turn += 1;
    for (const id of u.ids) deal.set(id, team);
    if (u.ids.length === 1) single.set(u.ids[0], { team, rating: u.rating });
    size.set(team, size.get(team)! + u.ids.length);
    total.set(team, total.get(team)! + u.rating);
  }
  evenOut(single, deal, size, total);
  return deal;
}

/**
 * 5. Evening out. A family can't be split to balance a team, so after the deal the strongest and weakest teams (by
 *    average) swap two single players while that brings their averages closer and narrows the gap across all teams.
 *    Families, the children who followed a lock, and locked players never move; sizes never change. Bounded, and
 *    deterministic: the same seed gives the same teams.
 */
function evenOut(
  single: Map<string, { team: string; rating: number }>, deal: Map<string, string>,
  size: ReadonlyMap<string, number>, total: Map<string, number>,
) {
  const teams = [...size.keys()].filter(t => size.get(t)! > 0);
  const avg = (t: string) => total.get(t)! / size.get(t)!;
  // How uneven the teams are: the gap between the strongest and weakest average first, then the spread of all of them.
  const score = (): [number, number] => {
    const all = teams.map(avg);
    const mean = all.reduce((s, x) => s + x, 0) / all.length;
    return [Math.max(...all) - Math.min(...all), all.reduce((s, x) => s + (x - mean) ** 2, 0)];
  };
  const better = (x: [number, number], y: [number, number]) => x[0] < y[0] - 1e-9 || (Math.abs(x[0] - y[0]) <= 1e-9 && x[1] < y[1] - 1e-9);
  const players = [...single.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (let pass = 0; pass < 500; pass++) {
    const before = score();
    let best: { a: string; b: string; from: string; to: string; d: number; after: [number, number] } | null = null;
    for (const [a, sa] of players) {
      for (const [b, sb] of players) {
        if (sa.team === sb.team || sb.rating >= sa.rating || avg(sa.team) <= avg(sb.team)) continue;
        const d = sa.rating - sb.rating;
        total.set(sa.team, total.get(sa.team)! - d); total.set(sb.team, total.get(sb.team)! + d);
        const after = score();
        total.set(sa.team, total.get(sa.team)! + d); total.set(sb.team, total.get(sb.team)! - d);
        if (better(after, before) && (!best || better(after, best.after))) best = { a, b, from: sa.team, to: sb.team, d, after };
      }
    }
    if (!best) return;
    total.set(best.from, total.get(best.from)! - best.d); total.set(best.to, total.get(best.to)! + best.d);
    single.get(best.a)!.team = best.to; single.get(best.b)!.team = best.from;
    deal.set(best.a, best.to); deal.set(best.b, best.from);
  }
}

/** A team's average rating to one decimal, counting a not-rated player as a 3, or null when nobody on it is rated. */
export function teamAverage(players: readonly { rating: number | null }[]): number | null {
  if (players.length === 0 || players.every(p => p.rating === null)) return null;
  return Math.round((players.reduce((sum, p) => sum + ratingOf(p), 0) / players.length) * 10) / 10;
}
