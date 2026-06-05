/**
 * Unified playoff bracket generator (pure, seeding-agnostic).
 *
 * This is the single bracket-structure engine used by ALL tournaments — full
 * (round-robin) and bracket-only alike. It knows nothing about *where* seeds
 * come from: it emits matchups whose participants are abstract references
 * (`Seed #N`, `Winner <code>`, `Loser <code>`). The caller (the playoff wizard)
 * maps those `Seed #N` references to real seed labels (pool standings) or to
 * directly-seeded teams, then persists them as game rows whose advancement is
 * driven by the existing `advancePlayoffs()` string matching in lib/db.ts.
 *
 * Supports any number of teams (with automatic byes on the top seeds) in three
 * formats:
 *   - 'single'      — single elimination (1-game guarantee)
 *   - 'consolation' — single elimination + a consolation bracket so every team
 *                     plays at least twice (2-game guarantee)
 *   - 'double'      — double elimination (lose twice to be out); includes the
 *                     "if-necessary" grand final reset game (toggle).
 *
 * Codes are unique within a bracket so `Winner <code>` / `Loser <code>` refs
 * resolve unambiguously.
 */

export type BracketFormat = 'single' | 'consolation' | 'double' | 'placement';

/** Which structural section a matchup belongs to (for display/scheduling). */
export type BracketSection = 'W' | 'L' | 'GF' | 'CONS' | 'P';

export interface GeneratedMatchup {
  /** Unique bracket code, e.g. "QF1", "SF2", "FIN", "WB2-1", "LB3-1", "GF", "CON1-1", "P3". */
  code: string;
  /** Human round name, e.g. "Quarterfinal", "Winners Round 2", "Grand Final". */
  round: string;
  /** 0-based round index within the matchup's section (for ordering). */
  roundIndex: number;
  section: BracketSection;
  /** Home participant reference: "Seed #1" | "Winner QF1" | "Loser SF1". */
  home: string;
  /** Away participant reference. */
  away: string;
  /** True for the double-elim grand-final reset game (only played if the losers-bracket team wins GF). */
  ifNecessary?: boolean;
}

export interface GenerateBracketOptions {
  format?: BracketFormat;
  /** Add a 3rd-place game between the two semifinal losers (single & consolation). */
  thirdPlace?: boolean;
  /** Double elimination only: include the if-necessary grand-final reset. Default true. */
  grandFinalReset?: boolean;
}

const seedRef = (n: number) => `Seed #${n}`;
const winnerRef = (code: string) => `Winner ${code}`;
const loserRef = (code: string) => `Loser ${code}`;

/** Ordinal label: 1 → "1st", 3 → "3rd", 11 → "11th". */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** Smallest power of two >= n (min 1). */
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(1, p);
}

/**
 * Standard single-elimination seeding order for a bracket of `size` (a power of
 * two). Returns the seed number occupying each bracket position so that top
 * seeds are maximally separated (1 vs lowest, 2 in the opposite half, etc.).
 * e.g. seedOrder(8) -> [1,8,4,5,2,7,3,6]  (pairs: 1v8, 4v5, 2v7, 3v6)
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const len = order.length * 2;
    const next: number[] = [];
    for (const s of order) {
      next.push(s);
      next.push(len + 1 - s);
    }
    order = next;
  }
  return order;
}

/** Friendly round name + code prefix for a single-elim/winners round by team count. */
function mainRoundMeta(teamsInRound: number): { name: string; code: (game: number) => string } {
  switch (teamsInRound) {
    case 2:
      return { name: 'Final', code: () => 'FIN' };
    case 4:
      return { name: 'Semifinal', code: g => `SF${g}` };
    case 8:
      return { name: 'Quarterfinal', code: g => `QF${g}` };
    default:
      return { name: `Round of ${teamsInRound}`, code: g => `R${teamsInRound}-${g}` };
  }
}

interface WinnersResult {
  matchups: GeneratedMatchup[];
  /** "Loser <code>" refs grouped by round index (round 0 = first round played). */
  losersByRound: string[][];
  /** Ref that wins the bracket (e.g. "Winner FIN"). */
  championRef: string;
  /** Codes of the two semifinal matchups, if any (for 3rd place). */
  semifinalCodes: string[];
  /** "Loser <code>" of each matchup that is some team's FIRST game (used by consolation). */
  firstGameLoserRefs: string[];
}

/**
 * Build a single-elimination tree over seeds 1..N with byes on the top seeds.
 * When `double` is true, uses Winners-bracket naming/codes (WB{r}-{g}).
 */
function buildWinners(n: number, double: boolean): WinnersResult {
  const size = nextPow2(n);
  // Round-0 slots: real seed ref, or null for a bye (seed number > n).
  let current: (string | null)[] = seedOrder(size).map(s => (s <= n ? seedRef(s) : null));

  const matchups: GeneratedMatchup[] = [];
  const losersByRound: string[][] = [];
  const firstGameLoserRefs: string[] = [];
  const semifinalCodes: string[] = [];
  let roundIndex = 0;

  while (current.length > 1) {
    const teamsInRound = current.length;
    const meta = mainRoundMeta(teamsInRound);
    const roundNum = roundIndex + 1;
    const next: (string | null)[] = [];
    const roundLosers: string[] = [];
    let game = 0;

    for (let i = 0; i < current.length; i += 2) {
      const a = current[i];
      const b = current[i + 1];
      if (a && b) {
        game += 1;
        const code = double ? `WB${roundNum}-${game}` : meta.code(game);
        const round = double ? `Winners ${meta.name}` : meta.name;
        matchups.push({ code, round, roundIndex, section: 'W', home: a, away: b });
        next.push(winnerRef(code));
        roundLosers.push(loserRef(code));
        if (!double && teamsInRound === 4) semifinalCodes.push(code);
        // A matchup is some team's FIRST game if either side entered as a raw
        // seed: round 0 (both seeds) or a byed top seed playing its opener.
        const hasFreshSeed = a.startsWith('Seed #') || b.startsWith('Seed #');
        if (hasFreshSeed) firstGameLoserRefs.push(loserRef(code));
      } else {
        // Bye: exactly one side is null; the real seed advances untouched.
        next.push(a ?? b);
      }
    }

    losersByRound.push(roundLosers);
    current = next;
    roundIndex += 1;
  }

  return {
    matchups,
    losersByRound,
    championRef: (current[0] as string) ?? seedRef(1),
    semifinalCodes,
    firstGameLoserRefs,
  };
}

/** Pair a flat list of refs; if odd, the LAST ref gets a bye and advances. */
function pairList(
  refs: string[],
  makeCode: (game: number) => string,
  round: string,
  roundIndex: number,
  section: BracketSection,
): { matchups: GeneratedMatchup[]; advancers: string[] } {
  const matchups: GeneratedMatchup[] = [];
  const advancers: string[] = [];
  const even = refs.length - (refs.length % 2);
  let game = 0;
  for (let i = 0; i < even; i += 2) {
    game += 1;
    const code = makeCode(game);
    matchups.push({ code, round, roundIndex, section, home: refs[i], away: refs[i + 1] });
    advancers.push(winnerRef(code));
  }
  if (refs.length % 2 === 1) advancers.push(refs[refs.length - 1]); // bye
  return { matchups, advancers };
}

/**
 * Minor losers-bracket round: pair current survivors against this round's
 * winners-bracket drop-ins. Drop-ins are reversed to reduce immediate rematches.
 * Any leftover (count mismatch from byes) advances on a bye.
 */
function mixRound(
  survivors: string[],
  drop: string[],
  makeCode: (game: number) => string,
  round: string,
  roundIndex: number,
): { matchups: GeneratedMatchup[]; advancers: string[] } {
  const matchups: GeneratedMatchup[] = [];
  const advancers: string[] = [];
  const d = [...drop].reverse();
  const pairs = Math.min(survivors.length, d.length);
  let game = 0;
  for (let i = 0; i < pairs; i += 1) {
    game += 1;
    const code = makeCode(game);
    matchups.push({ code, round, roundIndex, section: 'L', home: survivors[i], away: d[i] });
    advancers.push(winnerRef(code));
  }
  // Carry any unpaired survivors/drop-ins forward on a bye.
  for (let i = pairs; i < survivors.length; i += 1) advancers.push(survivors[i]);
  for (let i = pairs; i < d.length; i += 1) advancers.push(d[i]);
  return { matchups, advancers };
}

function buildSingleElim(n: number, thirdPlace: boolean): GeneratedMatchup[] {
  const wb = buildWinners(n, false);
  const out = [...wb.matchups];
  if (thirdPlace && wb.semifinalCodes.length === 2) {
    out.push({
      code: 'P3',
      round: '3rd Place',
      roundIndex: 0,
      section: 'P',
      home: loserRef(wb.semifinalCodes[0]),
      away: loserRef(wb.semifinalCodes[1]),
    });
  }
  return out;
}

function buildConsolation(n: number, thirdPlace: boolean): GeneratedMatchup[] {
  const out = buildSingleElim(n, thirdPlace);
  // Every first-game loser feeds a single-elim consolation bracket so no team is
  // eliminated after a single game. For N>=4 every team plays at least twice.
  // Edge cases: N=2 has no first round so no consolation is added; for N=3 the
  // byed top seed can win a one-game final (never eliminated, but plays once) —
  // a 3-team 2-game guarantee is really a round robin (the other tournament path).
  let pool = [...new Set(buildWinners(n, false).firstGameLoserRefs)];
  let roundIndex = 0;
  while (pool.length > 1) {
    const r = roundIndex + 1;
    const { matchups, advancers } = pairList(
      pool,
      g => `CON${r}-${g}`,
      pool.length <= 2 ? 'Consolation Final' : `Consolation Round ${r}`,
      roundIndex,
      'CONS',
    );
    out.push(...matchups);
    pool = advancers;
    roundIndex += 1;
  }
  return out;
}

function buildDoubleElim(n: number, grandFinalReset: boolean): GeneratedMatchup[] {
  const wb = buildWinners(n, true);
  const out = [...wb.matchups];

  // ── Losers bracket ────────────────────────────────────────────────────────
  // Alternate "minor" rounds (survivors vs the next WB round's losers) with
  // "major" consolidation rounds, the standard generalized double-elim shape.
  const losersByRound = wb.losersByRound;
  let survivors: string[] = [];
  let lbRound = 0;

  for (let r = 0; r < losersByRound.length; r += 1) {
    const drop = losersByRound[r];
    if (drop.length === 0) continue;

    if (survivors.length === 0) {
      lbRound += 1;
      const { matchups, advancers } = pairList(
        drop,
        g => `LB${lbRound}-${g}`,
        `Losers Round ${lbRound}`,
        lbRound - 1,
        'L',
      );
      out.push(...matchups);
      survivors = advancers;
    } else {
      lbRound += 1;
      const minor = mixRound(survivors, drop, g => `LB${lbRound}-${g}`, `Losers Round ${lbRound}`, lbRound - 1);
      out.push(...minor.matchups);
      survivors = minor.advancers;

      // Major consolidation between minor rounds (not after the final drop).
      if (r < losersByRound.length - 1 && survivors.length > 1) {
        lbRound += 1;
        const major = pairList(survivors, g => `LB${lbRound}-${g}`, `Losers Round ${lbRound}`, lbRound - 1, 'L');
        out.push(...major.matchups);
        survivors = major.advancers;
      }
    }
  }

  // Reduce the losers bracket down to a single champion.
  while (survivors.length > 1) {
    lbRound += 1;
    const { matchups, advancers } = pairList(survivors, g => `LB${lbRound}-${g}`, `Losers Round ${lbRound}`, lbRound - 1, 'L');
    out.push(...matchups);
    survivors = advancers;
  }

  const lbChampionRef = survivors[0];

  // ── Grand final (+ if-necessary reset) ────────────────────────────────────
  if (lbChampionRef) {
    out.push({
      code: 'GF',
      round: 'Grand Final',
      roundIndex: 0,
      section: 'GF',
      home: wb.championRef,
      away: lbChampionRef,
    });
    if (grandFinalReset) {
      // The reset is a rematch of the grand final between the same two teams.
      // Referencing Winner/Loser GF (rather than the bracket champions directly)
      // makes it depend on GF so it schedules after it and resolves once GF is
      // played; it is only actually necessary if the losers-bracket team (the
      // away/LB side) wins GF.
      out.push({
        code: 'GF2',
        round: 'Grand Final (if necessary)',
        roundIndex: 1,
        section: 'GF',
        home: winnerRef('GF'),
        away: loserRef('GF'),
        ifNecessary: true,
      });
    }
  }

  return out;
}

// ── Full placement (classification) bracket ─────────────────────────────────
// Every team plays through to a final ranking. The winners path is the standard
// championship bracket (1st–2nd, 3rd–4th); each round's losers cascade into a
// classification bracket for the next band of places (5th–6th, 7th–8th, …). Built
// by recursively ranking the seed list: pair → winners rank for the better places,
// losers rank for the worse places.

function placementCode(championship: boolean, placeOffset: number, teamsInRound: number, roundNum: number, game: number): string {
  if (championship) {
    if (teamsInRound === 2) return 'FIN';
    if (teamsInRound === 4) return `SF${game}`;
    if (teamsInRound === 8) return `QF${game}`;
    return `R${teamsInRound}-${game}`;
  }
  if (teamsInRound === 2) return `PL${placeOffset}`;
  return `PL${placeOffset}R${roundNum}-${game}`;
}

function placementRoundName(championship: boolean, placeOffset: number, teamsInRound: number): string {
  if (championship) {
    if (teamsInRound === 2) return 'Final';
    if (teamsInRound === 4) return 'Semifinal';
    if (teamsInRound === 8) return 'Quarterfinal';
    return `Round of ${teamsInRound}`;
  }
  if (teamsInRound === 2) return `${ordinal(placeOffset)} Place`;
  return `${ordinal(placeOffset)} Place Bracket`;
}

function rankInto(
  out: GeneratedMatchup[],
  refs: (string | null)[],
  placeOffset: number,
  championship: boolean,
  roundNum: number,
  places?: Map<string, number>,
): void {
  const real = refs.filter((r): r is string => r != null);
  if (real.length <= 1) {
    // a lone team takes `placeOffset` with no game (its ref's final landing place)
    if (real.length === 1 && places) places.set(real[0], placeOffset);
    return;
  }
  const realCount = real.length;

  const next: (string | null)[] = [];
  const losers: string[] = [];
  let game = 0;
  for (let i = 0; i < refs.length; i += 2) {
    const a = refs[i];
    const b = refs[i + 1];
    if (a && b) {
      game += 1;
      const code = placementCode(championship, placeOffset, realCount, roundNum, game);
      out.push({
        code,
        round: placementRoundName(championship, placeOffset, realCount),
        roundIndex: roundNum - 1,
        section: championship ? 'W' : 'P',
        home: a,
        away: b,
      });
      next.push(winnerRef(code));
      losers.push(loserRef(code));
    } else if (a || b) {
      next.push((a ?? b) as string); // bye advances (only the championship round 1 has byes)
    }
  }

  const advancers = next.filter((r): r is string => r != null);
  rankInto(out, advancers, placeOffset, championship, roundNum + 1, places);     // better places
  rankInto(out, losers, placeOffset + advancers.length, false, 1, places);       // worse places
}

function buildPlacement(n: number): GeneratedMatchup[] {
  const out: GeneratedMatchup[] = [];
  const size = nextPow2(n);
  const initial: (string | null)[] = seedOrder(size).map(s => (s <= n ? seedRef(s) : null));
  rankInto(out, initial, 1, true, 1);
  return out;
}

/**
 * Map each final landing ref (e.g. "Winner FIN" → 1, "Loser FIN" → 2, "Winner PL5" → 5,
 * a bye-eliminated "Loser R3-1" → 3, …) to its place, for a full-placement bracket of `n`.
 * The source of truth for the 1..N ranking; callers resolve each ref to a team via results.
 */
export function placementPlaces(n: number): Map<string, number> {
  const places = new Map<string, number>();
  if (n >= 2) {
    const size = nextPow2(n);
    const initial: (string | null)[] = seedOrder(size).map(s => (s <= n ? seedRef(s) : null));
    rankInto([], initial, 1, true, 1, places);
  }
  return places;
}

export interface BracketRoundInfo {
  /** Group key — all matchups in the same display column share this. */
  key: string;
  /** Human column title, e.g. "Quarterfinals", "Winners Round 2", "Grand Final". */
  title: string;
  /** Sort rank for left-to-right column order (earlier rounds first). */
  rank: number;
}

/**
 * Map a bracket `code` to its display column (key + title + sort rank). Lets every
 * bracket renderer group matchups by round consistently — single elimination
 * (incl. large Round-of-N), the double-elim winners/losers brackets + grand final,
 * and the consolation bracket. Pure; mirrors the code scheme `generateBracket` emits.
 */
export function bracketRoundInfo(code: string): BracketRoundInfo {
  const c = (code || '').toUpperCase();
  const after = (prefix: string) => parseInt(c.slice(prefix.length).replace(/^(\d+).*/, '$1'), 10) || 0;

  // Full placement / classification (PL{place} = deciding game; PL{place}R{round}-{game} = bracket round)
  if (c.startsWith('PL')) {
    const m = c.match(/^PL(\d+)(?:R(\d+))?/);
    const place = m ? parseInt(m[1], 10) || 0 : 0;
    const round = m && m[2] ? parseInt(m[2], 10) || 0 : 0;
    if (round > 0) return { key: `PL${place}R${round}`, title: `${ordinal(place)} Place Bracket`, rank: 800 + place + round * 0.01 };
    return { key: `PL${place}`, title: `${ordinal(place)} Place`, rank: 800 + place + 0.5 };
  }

  // Double elimination
  if (c.startsWith('WB')) { const r = after('WB'); return { key: `WB${r}`, title: `Winners Round ${r}`, rank: 100 + r }; }
  if (c.startsWith('LB')) { const r = after('LB'); return { key: `LB${r}`, title: `Losers Round ${r}`, rank: 300 + r }; }
  if (c === 'GF' || c === 'GF2') return { key: 'GF', title: 'Grand Final', rank: 500 };
  if (c.startsWith('CON')) { const r = after('CON'); return { key: `CON${r}`, title: r > 0 ? `Consolation Round ${r}` : 'Consolation', rank: 700 + r }; }

  // Single elimination (negative ranks → before any double-elim section)
  if (/^R\d+-/.test(c)) { const n = parseInt(c.match(/^R(\d+)-/)?.[1] ?? '0', 10) || 0; return { key: `R${n}`, title: `Round of ${n}`, rank: -n }; }
  if (c.startsWith('QF')) return { key: 'QF', title: 'Quarterfinals', rank: -8 };
  if (c.startsWith('SF')) return { key: 'SF', title: 'Semifinals', rank: -4 };
  if (c === 'FIN' || c === 'IF' || c === '3RD' || c === 'P3') return { key: 'FIN', title: 'Finals', rank: -2 };

  return { key: c || 'EXTRA', title: code || 'Bracket', rank: 1000 };
}

/**
 * Display-only relabel for the forked double-elim bracket UI. Winners-bracket
 * round 1 IS the shared "Seed Round" shown ahead of the fork, so the winners
 * bracket proper should read WB1, WB2, … (not WB2, WB3, …). Rewrite WB round
 * tokens in any string (a bare code or a "Winner/Loser WB2-1" placeholder):
 *   WB1-x → SR-x   (seed round)   ·   WB{n}-x → WB{n-1}-x  (n ≥ 2)
 * The underlying game `bracketCode` is left untouched so advancement still
 * matches on the real codes. The trailing `-` anchors the match to game codes
 * (e.g. `WB10-1`) and never the bare round key.
 */
export function displayBracketRefs(text: string | null | undefined): string {
  return (text ?? '').replace(/\bWB(\d+)-/gi, (_m, n: string) => {
    const r = parseInt(n, 10);
    return r <= 1 ? 'SR-' : `WB${r - 1}-`;
  });
}

/**
 * Matching relabel for a round's display TITLE: "Winners Round 1" becomes the
 * "Seed Round", and every later winners round shifts down one ("Winners Round
 * 2" → "Winners Round 1"). Losers / grand-final / single-elim titles pass
 * through unchanged.
 */
export function displayRoundTitle(title: string | null | undefined): string {
  const m = (title ?? '').match(/^Winners Round (\d+)$/i);
  if (!m) return title ?? '';
  const r = parseInt(m[1], 10);
  return r <= 1 ? 'Seed Round' : `Winners Round ${r - 1}`;
}

/**
 * Generate a complete bracket for `seedCount` teams.
 * Returns matchups in creation order with abstract participant references.
 */
export function generateBracket(seedCount: number, options: GenerateBracketOptions = {}): GeneratedMatchup[] {
  const n = Math.floor(seedCount);
  if (n < 2) return [];
  const format = options.format ?? 'single';
  const thirdPlace = options.thirdPlace ?? false;
  const grandFinalReset = options.grandFinalReset ?? true;

  switch (format) {
    case 'double':
      return buildDoubleElim(n, grandFinalReset);
    case 'consolation':
      return buildConsolation(n, thirdPlace);
    case 'placement':
      return buildPlacement(n);
    case 'single':
    default:
      return buildSingleElim(n, thirdPlace);
  }
}
