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

import type { PlayoffTierConfig } from './types';

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

  // Single elimination. The auto-generator emits R{teamsInRound}- for fields of
  // 16+ ("Round of 16/32" — more teams = earlier, rank -n). The MANUAL builder
  // emits R{roundNumber}- (1,2,3 …), where "Round of 1/2/3" is nonsense — those are
  // round NUMBERS, so label them "Round N" and order them ascending (round 1 first).
  if (/^R\d+-/.test(c)) {
    const n = parseInt(c.match(/^R(\d+)-/)?.[1] ?? '0', 10) || 0;
    return n >= 16
      ? { key: `R${n}`, title: `Round of ${n}`, rank: -n }
      : { key: `R${n}`, title: `Round ${n}`, rank: n };
  }
  if (c.startsWith('QF')) return { key: 'QF', title: 'Quarterfinals', rank: -8 };
  if (c.startsWith('SF')) return { key: 'SF', title: 'Semifinals', rank: -4 };
  if (c === 'FIN' || c === 'IF' || c === '3RD' || c === 'P3') return { key: 'FIN', title: 'Finals', rank: -2 };

  return { key: c || 'EXTRA', title: code || 'Bracket', rank: 1000 };
}

/**
 * Fan-friendly SINGULAR round name for ONE bracket game — "Final", "Semifinal",
 * "Quarterfinal", "Round of 16", "3rd Place", "Grand Final", etc. Unlike
 * bracketRoundInfo (which groups games into display COLUMNS and so deliberately
 * files the 3rd-place game under the "Finals" column), this names the individual
 * game the way a spectator would say it. Use it for standalone badges/labels on
 * public surfaces; keep bracketRoundInfo for grouping a bracket into columns.
 * Falls back to the raw code (or "Playoff") for anything it doesn't recognise.
 */
export function bracketRoundLabel(code: string | null | undefined): string {
  const c = (code || '').toUpperCase();
  if (!c) return 'Playoff';

  // 3rd-place / bronze game — explicitly NOT the Final (bracketRoundInfo lumps it there).
  if (c === 'P3' || c === '3RD') return '3rd Place';

  // Full placement / classification (PL{place} deciding game; PL{place}R{round}-{game} sub-bracket)
  if (c.startsWith('PL')) {
    const m = c.match(/^PL(\d+)(?:R(\d+))?/);
    const place = m ? parseInt(m[1], 10) || 0 : 0;
    if (!place) return 'Placement';
    return m && m[2] ? `${ordinal(place)} Place Bracket` : `${ordinal(place)} Place`;
  }

  // Double elimination
  if (c === 'GF') return 'Grand Final';
  if (c === 'GF2') return 'Grand Final (Game 2)';
  if (c.startsWith('WB')) return 'Winners Bracket';
  if (c.startsWith('LB')) return 'Losers Bracket';
  if (c.startsWith('CON')) return 'Consolation';

  // Single elimination championship path (auto: Round of N for 16+; manual: Round N)
  if (/^R\d+-/.test(c)) {
    const n = parseInt(c.match(/^R(\d+)-/)?.[1] ?? '0', 10) || 0;
    return n >= 16 ? `Round of ${n}` : `Round ${n}`;
  }
  if (c.startsWith('QF')) return 'Quarterfinal';
  if (c.startsWith('SF')) return 'Semifinal';
  if (c === 'FIN' || c === 'IF') return 'Final';

  // Unknown / manual code — show it as-is rather than guess a meaning.
  return code || 'Playoff';
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
 * Canonical participant-placeholder options for a manual bracket game.
 *
 * Returns the exact strings `advancePlayoffs` (lib/db.ts) and the bracket
 * connectors string-match on — `Seed #N`, `Winner <code>`, `Loser <code>` (the
 * space is required). Shared by the bracket builder and the Add Game modal so
 * both emit identical, resolvable references.
 *
 * @param seedCount  highest seed offered (teams qualifying, or accepted-team count)
 * @param bracketCodes existing playoff game codes in the division (e.g. ['SF1','SF2'])
 */
export function buildPlaceholderOptions(
  seedCount: number,
  bracketCodes: string[],
): { seeds: string[]; winners: string[]; losers: string[] } {
  const n = Math.max(0, Math.floor(Number.isFinite(seedCount) ? seedCount : 0));
  const seeds = Array.from({ length: n }, (_, i) => `Seed #${i + 1}`);
  const codes = Array.from(new Set(bracketCodes.filter(Boolean)));
  return {
    seeds,
    winners: codes.map(c => `Winner ${c}`),
    losers: codes.map(c => `Loser ${c}`),
  };
}

/**
 * Resolve the outcome of an elimination game (pure; J1-083).
 *
 * An elimination game CANNOT end in a tie — a tied score has no winner, so the
 * old `home > away ? home : away` logic silently (and arbitrarily) advanced the
 * away team. This returns:
 *   - { tie: true }                              when scores are equal and the
 *                                                game is NOT a forfeit → caller
 *                                                must NOT advance anyone.
 *   - { tie: false, winner, loser }              otherwise.
 *
 * Forfeits always have a decisive nominal margin (the present team's score is
 * higher), so they never read as a tie. `advancePlayoffs` calls this and bails
 * on a tie, leaving the bracket visibly stalled until the organizer resolves it.
 */
export function resolvePlayoffWinner(g: {
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status?: string;
}):
  | { tie: true }
  | { tie: false; winner: string; loser: string } {
  const home = g.homeScore || 0;
  const away = g.awayScore || 0;
  if (g.status !== 'forfeit' && home === away) return { tie: true };
  const homeWon = home > away;
  return {
    tie: false,
    winner: homeWon ? g.homeTeamId : g.awayTeamId,
    loser: homeWon ? g.awayTeamId : g.homeTeamId,
  };
}

export interface LoadableBracketGame {
  id: string;
  bracketId?: string | null;
  bracketLabel?: string | null;
  bracketCode?: string | null;
  roundLabel?: string | null;
  homePlaceholder?: string | null;
  awayPlaceholder?: string | null;
  date?: string | null;
  time?: string | null;
  venueId?: string | null;
  venueFacilityId?: string | null;
  location?: string | null;
}

export interface BracketPreviewRow {
  round: string;
  code: string;
  home: string;
  away: string;
  date: string;
  time: string;
  venueId: string;
  venueFacilityId?: string;
  location?: string;
  /** Links this canvas row back to its existing game so a save can DIFF (update vs insert). */
  sourceGameId?: string;
  /** Tier/group name when the division has multiple brackets (tiers / per-pool). Drives the canvas split. */
  pool?: string;
}

/**
 * Convert an existing division's playoff games into canvas `templatePreview` rows
 * so a saved bracket can be loaded back into the BracketBuilder for editing.
 * Groups into rounds via `bracketRoundInfo` (same as the read-only view), threads
 * each game's id as `sourceGameId`, and uses the stored Seed/Winner/Loser
 * placeholder as the slot label (so wiring round-trips).
 */
export function gamesToBracketPreview(games: LoadableBracketGame[]): BracketPreviewRow[] {
  // Group by bracketId — tiers / per-pool brackets reuse codes, so each must compute
  // its own columns and render as its own canvas group (BracketBuilder splits by the
  // `pool` field). A single bracket → one group, emitted ungrouped (no `pool`).
  const groups = groupGamesByBracketId(games);
  const multi = groups.length > 1;

  const ranked: { rank: number; row: BracketPreviewRow }[] = [];
  groups.forEach((grp, gi) => {
    const poolName = multi ? (grp.label || `Bracket ${gi + 1}`) : undefined;
    const colMap = computeBracketColumns(grp.games);
    for (const g of grp.games) {
      const info = colMap.get(g.id) || bracketRoundInfo(g.bracketCode || '');
      ranked.push({
        rank: info.rank,
        row: {
          round: info.title,
          code: g.bracketCode || '',
          home: g.homePlaceholder || '',
          away: g.awayPlaceholder || '',
          date: g.date || '',
          time: g.time || '',
          venueId: g.venueId || '',
          venueFacilityId: g.venueFacilityId || undefined,
          location: g.location || '',
          sourceGameId: g.id,
          pool: poolName,
        },
      });
    }
  });
  // Order globally by structural rank so BracketBuilder's shared (by round-NAME)
  // column array lands left-to-right even when tiers of DIFFERENT sizes share round
  // names (e.g. a 4-team tier's "Final" vs an 8-team tier's "Quarterfinal"); then by
  // group + code for a stable read.
  ranked.sort((a, b) =>
    a.rank - b.rank ||
    (a.row.pool || '').localeCompare(b.row.pool || '') ||
    (a.row.code || '').localeCompare(b.row.code || ''),
  );
  return ranked.map(r => r.row);
}

export interface BracketGroup<T> {
  /** bracket_id of the group (or a sentinel for the ungrouped single bracket). */
  key: string;
  /** Display name from bracket_label (tier name); null = unnamed / single bracket. */
  label: string | null;
  games: T[];
}

/**
 * Split a division's playoff games into independent bracket groups by `bracketId`
 * — each tier / per-pool bracket is its own id and reuses codes, so they must be
 * rendered as SEPARATE diagrams (one column computation each) to avoid cross-wiring.
 * An ordinary single bracket returns one group. Named groups (a tier name lives on
 * `bracketLabel`) are ordered by label (Tier 1 < Tier 2, Gold < Silver); unnamed
 * groups keep first-seen order. `groups.length > 1` ⇒ render tiers separately.
 */
export function groupGamesByBracketId<T extends { bracketId?: string | null; bracketLabel?: string | null }>(
  games: T[],
): BracketGroup<T>[] {
  const map = new Map<string, T[]>();
  const order: string[] = [];
  for (const g of games) {
    const key = g.bracketId || '__single__';
    let arr = map.get(key);
    if (!arr) { arr = []; map.set(key, arr); order.push(key); }
    arr.push(g);
  }
  const enriched = order.map((key, i) => ({
    key,
    label: map.get(key)!.find(x => x.bracketLabel)?.bracketLabel ?? null,
    games: map.get(key)!,
    seen: i,
  }));
  enriched.sort((a, b) => {
    if (a.label && b.label) return a.label.localeCompare(b.label);
    if (a.label) return -1;
    if (b.label) return 1;
    return a.seen - b.seen;
  });
  return enriched.map(({ key, label, games }) => ({ key, label, games }));
}

export interface BracketTimingGame {
  code?: string | null;
  home?: string | null;
  away?: string | null;
  date?: string | null;
  time?: string | null;
}

export interface BracketSchedulingViolation {
  /** Dependent game's code. */
  game: string;
  /** Feeder game's code it is scheduled at/before. */
  feeder: string;
  reason: 'earlier-date' | 'same-day-unordered';
}

const ADVANCEMENT_REF_RE = /^(?:winner|loser)\s+(.+)$/i;

function timingStartMinutes(time?: string | null): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * Detect games scheduled before a game they depend on. A dependent game (one whose
 * Home/Away is `Winner <code>` / `Loser <code>`) must come AFTER the referenced
 * feeder. Unscheduled games (no date) can't be "before" anything, so they're
 * skipped — this lets a structure-only bracket save. Cross-day ordering needs no
 * times (a later date is always fine); SAME-day pairs require both times in order,
 * because otherwise the feeder's winner can't reach the dependent in time.
 *
 * Pure + dependency-free for `node --test`.
 */
export function findBracketSchedulingViolations(games: BracketTimingGame[]): BracketSchedulingViolation[] {
  const byCode = new Map<string, BracketTimingGame>();
  for (const g of games) if (g.code) byCode.set(g.code.trim().toUpperCase(), g);

  const out: BracketSchedulingViolation[] = [];
  const seen = new Set<string>();
  for (const y of games) {
    if (!y.date) continue; // an unscheduled dependent can't be "before" its feeder
    for (const ph of [y.home, y.away]) {
      const m = (ph ?? '').match(ADVANCEMENT_REF_RE);
      if (!m) continue;
      const x = byCode.get(m[1].trim().toUpperCase());
      if (!x || x === y || !x.date) continue; // feeder unscheduled → can't compare
      let reason: BracketSchedulingViolation['reason'] | null = null;
      if (y.date < x.date) {
        reason = 'earlier-date';
      } else if (y.date === x.date) {
        const ys = timingStartMinutes(y.time);
        const xs = timingStartMinutes(x.time);
        if (ys == null || xs == null || ys <= xs) reason = 'same-day-unordered';
      }
      if (reason) {
        const key = `${y.code}>${x.code}`;
        if (!seen.has(key)) { seen.add(key); out.push({ game: y.code ?? '?', feeder: x.code ?? '?', reason }); }
      }
    }
  }
  return out;
}

export interface ManualCodeGame {
  bracketCode?: string | null;
  homePlaceholder?: string | null;
  awayPlaceholder?: string | null;
}

/**
 * Choose a fresh, collision-free bracket code for a hand-added playoff game.
 *
 * Bracket codes are internal wiring — `advancePlayoffs` matches `Winner <code>` /
 * `Loser <code>` against them. Users never type codes (they wire games via the
 * Winner/Loser pickers), so this assigns one automatically; a stray keystroke can
 * no longer orphan downstream references.
 *
 * Emits the canonical manual scheme `R{round}-{n}` (rendered as ordered "Round N"
 * columns by `bracketRoundInfo`). `round` is the new game's depth in the
 * Winner/Loser feed graph over `existing`: a game that references only seeds/teams
 * is Round 1; one that references the Winner/Loser of round-r games is round r+1.
 * `n` is the next index not already used by an existing code in that round.
 */
export function nextManualBracketCode(
  existing: ManualCodeGame[],
  homePlaceholder?: string | null,
  awayPlaceholder?: string | null,
): string {
  const byCode = new Map<string, ManualCodeGame>();
  for (const g of existing) if (g.bracketCode) byCode.set(g.bracketCode, g);

  const depCodes = (home?: string | null, away?: string | null): string[] =>
    [home, away]
      .map(p => ADVANCEMENT_REF_RE.exec(p || '')?.[1]?.trim())
      .filter((c): c is string => !!c && byCode.has(c));

  // Round of each existing game (fixpoint over the feed graph).
  const round = new Map<string, number>();
  for (let guard = 0; guard < 200; guard++) {
    let changed = false;
    for (const g of existing) {
      if (!g.bracketCode) continue;
      const deps = depCodes(g.homePlaceholder, g.awayPlaceholder);
      let r: number;
      if (deps.length === 0) r = 1;
      else { if (!deps.every(d => round.has(d))) continue; r = 1 + Math.max(...deps.map(d => round.get(d)!)); }
      if (round.get(g.bracketCode) !== r) { round.set(g.bracketCode, r); changed = true; }
    }
    if (!changed) break;
  }
  // A game the fixpoint couldn't resolve (a dependency cycle or a dangling ref —
  // only external/legacy data can create these, never the UI) still gets a Round 1
  // floor, so a real feeder is never silently dropped from the new game's depth.
  for (const g of existing) if (g.bracketCode && !round.has(g.bracketCode)) round.set(g.bracketCode, 1);

  // Round of the NEW game from its picked placeholders.
  const newDeps = depCodes(homePlaceholder, awayPlaceholder).filter(d => round.has(d));
  const newRound = newDeps.length === 0 ? 1 : 1 + Math.max(...newDeps.map(d => round.get(d)!));

  const used = new Set([...byCode.keys()].map(c => c.toUpperCase()));
  let n = 1;
  while (used.has(`R${newRound}-${n}`.toUpperCase())) n++;
  return `R${newRound}-${n}`;
}

/** Codes that bracketRoundInfo recognizes as a real round/section (not the rank-1000 fallback). */
const RECOGNIZED_CODE_RE = /^(R\d+-|QF|SF|FIN|WB|LB|GF|CON|PL|P3|3RD|IF)/i;
/** Multi-section formats whose code-based grouping + fork rendering must stay untouched. */
const SECTION_CODE_RE = /^(WB|LB|GF|CON|PL|P3|3RD)/i;

export interface BracketColumnGame {
  id: string;
  bracketCode?: string | null;
  /** Optional custom column name; overrides the derived round TITLE (not the key/rank). */
  roundLabel?: string | null;
  homePlaceholder?: string | null;
  awayPlaceholder?: string | null;
}

/**
 * Assign each game to a bracket display COLUMN by the Winner/Loser FEED GRAPH
 * (who-feeds-whom) rather than by parsing the `bracket_code` string — so a
 * renamed code ("test") or a legacy scheme ("G1".."G7") still groups into ordered
 * round columns instead of scattering into its own rank-1000 column.
 *
 * Returns a per-game `{key,title,rank}` map in the SAME shape `bracketRoundInfo`
 * returns, so every renderer swaps a single lookup and keeps its own grouping/
 * fork code. The mode is decided for the whole bracket (never mixed):
 *
 *  - **Code path** (unchanged behavior) when EVERY code is already recognized, OR
 *    any multi-section code (WB/LB/GF/CON/PL/P3/3RD) is present: per-game
 *    `bracketRoundInfo`. Standard single-elim, double-elim, consolation, placement,
 *    and 3rd-place all render exactly as before — zero regression.
 *  - **Graph path** only when a NON-standard/legacy code appears with no
 *    multi-section structure (i.e. the brackets that scatter today): place games by
 *    their depth in the feed graph (seeds/teams-only = depth 1; Winner/Loser of a
 *    depth-r game = r+1). Columns are titled from the end (deepest = Finals, then
 *    Semifinals, Quarterfinals, else "Round N").
 */
export function computeBracketColumns(games: BracketColumnGame[]): Map<string, BracketRoundInfo> {
  const out = new Map<string, BracketRoundInfo>();
  if (!games.length) return out;

  // Apply an organizer's custom column name (round_label) as a TITLE override —
  // grouping key + rank stay structural, so only the displayed name changes. A
  // label is a COLUMN property: pick one label per structural key (first non-empty
  // wins) and apply it to EVERY game in that column, so a partially-labeled column
  // reads consistently (no first-game-wins nondeterminism / re-save spreading).
  const applyLabels = () => {
    const labelByKey = new Map<string, string>();
    for (const g of games) {
      const lbl = g.roundLabel?.trim();
      const info = lbl ? out.get(g.id) : undefined;
      if (info && !labelByKey.has(info.key)) labelByKey.set(info.key, lbl as string);
    }
    if (labelByKey.size === 0) return out;
    for (const g of games) {
      const info = out.get(g.id);
      const lbl = info && labelByKey.get(info.key);
      if (info && lbl && info.title !== lbl) out.set(g.id, { ...info, title: lbl });
    }
    return out;
  };

  const hasSection = games.some(g => SECTION_CODE_RE.test(g.bracketCode || ''));
  // A codeless game counts as "recognized" so it can't, by itself, flip a standard
  // QF/SF/FIN bracket into graph mode — it keeps its existing rank-1000 own column.
  const allRecognized = games.every(g => !g.bracketCode || RECOGNIZED_CODE_RE.test(g.bracketCode));
  if (hasSection || allRecognized) {
    for (const g of games) out.set(g.id, bracketRoundInfo(g.bracketCode || ''));
    return applyLabels();
  }

  // Graph path. A WIRED game (its winner feeds a later game) is placed by its
  // DISTANCE TO THE FINAL, so every same-round game lines up even when a bye/play-in
  // makes one branch deeper from the START than the other (the seeds-only semifinal
  // would otherwise drop a column left of its play-in-fed peer). A game that feeds
  // nothing yet — the real final, or an early game not wired forward during a manual
  // build — is placed by its DEPTH FROM THE START, so the deepest game is the final
  // and half-built early games stay on the left instead of jumping to the final column.
  const byCode = new Map<string, BracketColumnGame>();
  for (const g of games) if (g.bracketCode) byCode.set(g.bracketCode, g);
  const deps = (g: BracketColumnGame): string[] =>
    [g.homePlaceholder, g.awayPlaceholder]
      .map(p => ADVANCEMENT_REF_RE.exec(p || '')?.[1]?.trim())
      .filter((c): c is string => !!c && byCode.has(c));

  // Forward depth from the seeds (1 = no feeders), fixpoint.
  const depthByCode = new Map<string, number>();
  for (let guard = 0; guard < 500; guard++) {
    let changed = false;
    for (const g of games) {
      if (!g.bracketCode) continue;
      const d = deps(g);
      let r: number;
      if (d.length === 0) r = 1;
      else { if (!d.every(c => depthByCode.has(c))) continue; r = 1 + Math.max(...d.map(c => depthByCode.get(c)!)); }
      if (depthByCode.get(g.bracketCode) !== r) { depthByCode.set(g.bracketCode, r); changed = true; }
    }
    if (!changed) break;
  }
  const depthOf = (g: BracketColumnGame): number => {
    if (g.bracketCode && depthByCode.has(g.bracketCode)) return depthByCode.get(g.bracketCode)!;
    const d = deps(g).filter(c => depthByCode.has(c)); // codeless / cycle / dangling → placeholder depth, floor 1
    return d.length ? 1 + Math.max(...d.map(c => depthByCode.get(c)!)) : 1;
  };

  // Reverse height to the sink (0 = feeds nothing), fixpoint over who-feeds-whom.
  const feedsInto = new Map<string, Set<string>>();
  for (const g of games) {
    if (!g.bracketCode) continue;
    for (const c of deps(g)) (feedsInto.get(c) ?? feedsInto.set(c, new Set()).get(c)!).add(g.bracketCode);
  }
  const heightByCode = new Map<string, number>();
  for (let guard = 0; guard < 500; guard++) {
    let changed = false;
    for (const g of games) {
      if (!g.bracketCode) continue;
      const outs = [...(feedsInto.get(g.bracketCode) ?? [])];
      let r: number;
      if (outs.length === 0) r = 0;
      else { if (!outs.every(c => heightByCode.has(c))) continue; r = 1 + Math.max(...outs.map(c => heightByCode.get(c)!)); }
      if (heightByCode.get(g.bracketCode) !== r) { heightByCode.set(g.bracketCode, r); changed = true; }
    }
    if (!changed) break;
  }
  const heightOf = (g: BracketColumnGame): number =>
    (g.bracketCode && heightByCode.has(g.bracketCode)) ? heightByCode.get(g.bracketCode)! : 0;
  const feedsSomething = (g: BracketColumnGame): boolean =>
    !!g.bracketCode && (feedsInto.get(g.bracketCode)?.size ?? 0) > 0;

  let maxDepth = 1;
  for (const g of games) { const d = depthOf(g); if (d > maxDepth) maxDepth = d; }
  // Wired game: distance-to-final (maxDepth − height). Unwired/final: depth from start.
  const rankOf = (g: BracketColumnGame): number => (feedsSomething(g) ? maxDepth - heightOf(g) : depthOf(g));

  const rG = new Map<string, number>();
  let maxRank = 1;
  for (const g of games) { const r = rankOf(g); rG.set(g.id, r); if (r > maxRank) maxRank = r; }
  const titleFor = (rank: number): string => {
    if (rank === maxRank) return 'Finals';
    const fromEnd = maxRank - rank;
    if (fromEnd === 1) return 'Semifinals';
    if (fromEnd === 2) return 'Quarterfinals';
    return `Round ${rank}`;
  };
  for (const g of games) { const r = rG.get(g.id)!; out.set(g.id, { key: `RND${r}`, title: titleFor(r), rank: r }); }
  return applyLabels();
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

// ── Tiered brackets (split one division's overall standings into N brackets) ──
//
// A tier covers a contiguous range of OVERALL seeds [fromSeed..toSeed]. Its
// bracket is generated locally (seeds 1..size via generateBracket) then each
// local `Seed #k` ref is rewritten to the GLOBAL `Seed #(fromSeed-1+k)` so that
// advancePlayoffs resolves it against overall division standings. Each tier gets
// its own bracketId at save time so identical Winner/Loser codes never collide.

/** Rewrite a local `Seed #k` ref into the global `Seed #(fromSeed-1+k)`; other refs pass through. */
export function remapTierSeed(ref: string, fromSeed: number): string {
  const m = ref.match(/^Seed #(\d+)$/);
  if (!m) return ref;
  return `Seed #${fromSeed - 1 + Number(m[1])}`;
}

/**
 * Suggest a default tier split for `eligibleCount` teams: two contiguous,
 * equal-ish tiers (top half / bottom half). Fewer than 4 teams → a single tier.
 * e.g. 9 → [Tier 1: 1–5, Tier 2: 6–9]; 8 → [1–4, 5–8].
 */
export function suggestDefaultTiers(eligibleCount: number): PlayoffTierConfig[] {
  const n = Math.max(0, Math.floor(eligibleCount));
  if (n < 2) return [];
  if (n < 4) return [{ name: 'Tier 1', fromSeed: 1, toSeed: n, format: 'single' }];
  const cut = Math.ceil(n / 2);
  return [
    { name: 'Tier 1', fromSeed: 1, toSeed: cut, format: 'single' },
    { name: 'Tier 2', fromSeed: cut + 1, toSeed: n, format: 'single' },
  ];
}

export interface TierValidationResult {
  ok: boolean;
  /** Human-readable reason when ok === false. */
  error?: string;
}

/**
 * Validate tier ranges for saving: non-empty unique names, each tier ≥ 2 seeds,
 * ranges contiguous from seed #1 with no gaps/overlaps, and the highest seed
 * within the accepted-team count (when known). Pure — safe to call on every render.
 */
export function validateTierRanges(tiers: PlayoffTierConfig[] | undefined, acceptedCount = 0): TierValidationResult {
  if (!tiers || tiers.length === 0) return { ok: false, error: 'Add at least one tier.' };

  const names = new Set<string>();
  for (const t of tiers) {
    const name = (t.name || '').trim();
    if (!name) return { ok: false, error: 'Every tier needs a name.' };
    if (names.has(name.toLowerCase())) return { ok: false, error: `Duplicate tier name "${name}".` };
    names.add(name.toLowerCase());
  }

  const sorted = [...tiers].sort((a, b) => a.fromSeed - b.fromSeed);
  let prevTo = 0;
  for (const t of sorted) {
    if (!Number.isInteger(t.fromSeed) || !Number.isInteger(t.toSeed) || t.fromSeed < 1 || t.toSeed < t.fromSeed) {
      return { ok: false, error: `"${t.name}" has an invalid seed range.` };
    }
    if (t.toSeed - t.fromSeed < 1) {
      return { ok: false, error: `"${t.name}" must contain at least 2 seeds — single-team tiers have no games.` };
    }
    if (t.fromSeed !== prevTo + 1) {
      return {
        ok: false,
        error: prevTo === 0
          ? 'Tiers must start at seed #1.'
          : `Tier ranges must be contiguous — gap or overlap near seed #${prevTo + 1}.`,
      };
    }
    prevTo = t.toSeed;
  }

  if (acceptedCount > 0 && prevTo > acceptedCount) {
    return { ok: false, error: `Tiers cover ${prevTo} seeds but only ${acceptedCount} teams are accepted — lower the last tier's range.` };
  }
  return { ok: true };
}
