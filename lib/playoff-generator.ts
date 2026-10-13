/**
 * THE PLAYOFF GENERATOR'S RULES, PURE (Tournament admin redesign, Stage 3 addendum — A61–A70 ruled 2026-10-12, built to
 * the sheet `docs/projects/archive/TOURNAMENT_PLAYOFF_GENERATOR_SHEET.html`, PG1–PG7).
 *
 *   who plays      Brackets first (one bracket · one per pool [2+ pools] · tiers [4+ teams]), then the teams that
 *                  advance, then seeding — a choice only with exactly two pools (they cross over, or go by the
 *                  standings); a playoffs-only event seeds by hand.
 *   the plan       the settings ARE the division's playoff plan (A63): `planOf` writes the keys the public pages read,
 *                  `settingsFromPlan` reads a saved one back.
 *   the template   the bracket's games from the engine (`generateBracket`), with today's seed labels kept: crossing
 *                  pools interleaves the pools' places ("1st Pool Red", "1st Pool Blue", "2nd Pool Red" …); a pool's
 *                  own bracket reads its own places; a tier's local seeds become the division's (`remapTierSeed`).
 *   first round    read from the engine's OWN pairing, never a formula beside it (the seeding sentence).
 *   what you get   games and rounds, the rounds by the engine's own labels (`bracketRoundLabel`).
 *   the fit check  the bracket's rounds laid into the chosen days in order: a round's games run in waves over the
 *                  chosen fields with the turnover between, the rest between rounds, a night counting as rest (A65).
 *   the drafts     what a draft measures (shortest rest, rest before the final, when the last game ends, most games in
 *                  a day for one team), and only the drafts that differ, named by what they win (A66).
 *
 * No React, no reads: a plain Node test reads it (tests/unit/playoff-generator.test.ts).
 */
import { bracketRoundLabel, generateBracket, ordinal, remapTierSeed, type BracketFormat } from './playoff-bracket.ts';
import { formatPoolName } from './utils.ts';
import { buildBracketScheduleMetrics } from './bracket-schedule-metrics.ts';
import { minutesToTime, timeToMinutes } from './schedule-conflict.ts';
import type { PlayoffConfig } from './types';
import type { PlayoffPlan } from './playoff-plan.ts';

export type PlayoffShape = 'one' | 'pools' | 'tiers';
export type PlayoffSeeding = 'cross' | 'standings';
export type PlayoffFormat = BracketFormat;

export interface PlayoffPoolFacts { id: string; name: string; teamCount: number }

/** What the window knows of a division. */
export interface PlayoffDivisionFacts {
  /** Accepted teams (a round robin), or the seed list's teams (a playoffs-only event). */
  teamCount: number;
  /** Its pools, in order — two or more make "one per pool" and crossing possible. */
  pools: PlayoffPoolFacts[];
  /** The event has no round robin: the seeds are set by hand. */
  playoffsOnly: boolean;
}

export interface PlayoffTierSetting { name: string; toSeed: number; format: PlayoffFormat; third: boolean; reset: boolean }

export interface PlayoffSettings {
  shape: PlayoffShape;
  /** One bracket: how many teams advance. */
  top: number;
  /** One bracket with exactly two pools: cross the pools over, or seed by the standings. */
  seeding: PlayoffSeeding;
  /** One per pool: how many advance from each pool, by pool id. */
  perPool: Record<string, number>;
  tiers: PlayoffTierSetting[];
  format: PlayoffFormat;
  /** A 3rd-place game (single elimination and its consolation, every bracket with semifinals). */
  third: boolean;
  /** Double elimination: a second final if it's needed. */
  reset: boolean;
}

export const TIER_NAMES = ['Gold', 'Silver', 'Bronze', 'Copper', 'Iron', 'Tin'] as const;

const poolsOf = (d: PlayoffDivisionFacts) => (d.playoffsOnly ? [] : d.pools);

/** The bracket shapes this division can take (A62): one per pool only with 2+ pools; tiers only with 4+ teams. */
export function shapesFor(d: PlayoffDivisionFacts): PlayoffShape[] {
  const out: PlayoffShape[] = ['one'];
  if (poolsOf(d).length >= 2) out.push('pools');
  if (d.teamCount >= 4) out.push('tiers');
  return out;
}

/** Does this bracket cross two pools over? Only one bracket, only with exactly two pools. */
export function crossesPools(s: Pick<PlayoffSettings, 'shape' | 'seeding'>, d: PlayoffDivisionFacts): boolean {
  return s.shape === 'one' && s.seeding === 'cross' && poolsOf(d).length === 2;
}

/** The "Teams that advance" choices: 2 … all; by twos while crossing, and never more than the smaller pool allows. */
export function topChoices(s: Pick<PlayoffSettings, 'shape' | 'seeding'>, d: PlayoffDivisionFacts): number[] {
  const cross = crossesPools(s, d);
  const max = cross ? Math.min(d.teamCount, 2 * Math.min(...poolsOf(d).map(p => p.teamCount))) : d.teamCount;
  const out: number[] = [];
  for (let n = 2; n <= max; n += cross ? 2 : 1) out.push(n);
  return out;
}

/** A pool's choices for "From Pool Red": 2 … the pool's teams. */
export const poolChoices = (pool: PlayoffPoolFacts) => Array.from({ length: Math.max(0, pool.teamCount - 1) }, (_, i) => i + 2);

/** Two tiers to start: Gold the top half, Silver the rest (fewer than 4 teams: one tier). */
export function defaultTiers(teamCount: number): PlayoffTierSetting[] {
  if (teamCount < 2) return [];
  if (teamCount < 4) return [{ name: TIER_NAMES[0], toSeed: teamCount, format: 'single', third: false, reset: true }];
  const cut = Math.ceil(teamCount / 2);
  return [
    { name: TIER_NAMES[0], toSeed: cut, format: 'single', third: false, reset: true },
    { name: TIER_NAMES[1], toSeed: teamCount, format: 'single', third: false, reset: true },
  ];
}

/** A division with no saved plan: one bracket, the top 4 (or all, if fewer), crossing when there are two pools. */
export function defaultSettings(d: PlayoffDivisionFacts): PlayoffSettings {
  const seeding: PlayoffSeeding = poolsOf(d).length === 2 ? 'cross' : 'standings';
  const base: PlayoffSettings = {
    shape: 'one', top: Math.min(4, d.teamCount), seeding, perPool: {}, tiers: defaultTiers(d.teamCount),
    format: 'single', third: false, reset: true,
  };
  return normalizeSettings(base, d);
}

/** A saved plan read back (A63): its shape, its counts, its format. Anything it doesn't say comes from the defaults. */
export function settingsFromPlan(cfg: Partial<PlayoffConfig> | null | undefined, d: PlayoffDivisionFacts): PlayoffSettings {
  const base = defaultSettings(d);
  if (!cfg || (cfg.crossover == null && cfg.teamsQualifying == null && cfg.format == null)) return base;
  const format = (cfg.format ?? 'single') as PlayoffFormat;
  const s: PlayoffSettings = { ...base, format, third: Boolean(cfg.hasThirdPlace), reset: cfg.grandFinalReset ?? true };
  if (cfg.crossover === 'none' && poolsOf(d).length >= 2) {
    s.shape = 'pools';
    s.perPool = Object.fromEntries(poolsOf(d).map(p => [p.id, cfg.splitConfigs?.[p.id]?.teamsQualifying ?? Math.min(2, p.teamCount)]));
    s.third = Object.values(cfg.splitConfigs ?? {}).some(c => c?.hasThirdPlace) || s.third;
  } else if (cfg.crossover === 'tiers' && cfg.tierConfigs?.length) {
    s.shape = 'tiers';
    s.tiers = [...cfg.tierConfigs].sort((a, b) => a.fromSeed - b.fromSeed).map(t => ({
      name: t.name, toSeed: t.toSeed, format: (t.format ?? format) as PlayoffFormat, third: Boolean(t.hasThirdPlace), reset: t.grandFinalReset ?? true,
    }));
  } else {
    s.shape = 'one';
    s.seeding = cfg.crossover === 'standard' && poolsOf(d).length === 2 ? 'cross' : 'standings';
    if (cfg.teamsQualifying != null) s.top = cfg.teamsQualifying;
  }
  return normalizeSettings(s, d);
}

/** Settings kept possible after any change: a shape the division can take, a count it has, tiers contiguous from 1. */
export function normalizeSettings(s: PlayoffSettings, d: PlayoffDivisionFacts): PlayoffSettings {
  const shapes = shapesFor(d);
  const shape = shapes.includes(s.shape) ? s.shape : 'one';
  const seeding: PlayoffSeeding = poolsOf(d).length === 2 ? s.seeding : 'standings';
  const out: PlayoffSettings = { ...s, shape, seeding };
  if (d.playoffsOnly) out.top = d.teamCount;
  else {
    const choices = topChoices(out, d);
    if (choices.length && !choices.includes(out.top)) {
      // The nearest count at or under the one asked for (crossing an odd count steps down to the even one).
      out.top = [...choices].reverse().find(n => n <= out.top) ?? choices[0];
    }
  }
  out.perPool = Object.fromEntries(poolsOf(d).map(p => {
    const want = s.perPool[p.id] ?? Math.min(2, p.teamCount);
    return [p.id, Math.max(Math.min(2, p.teamCount), Math.min(p.teamCount, want))];
  }));
  // Tiers: each starts after the one before and holds at least 2 seeds; the last never passes the team count.
  let prev = 0;
  const tiers: PlayoffTierSetting[] = [];
  for (const t of s.tiers.length ? s.tiers : defaultTiers(d.teamCount)) {
    if (prev + 2 > d.teamCount) break;
    const toSeed = Math.min(d.teamCount, Math.max(prev + 2, t.toSeed));
    tiers.push({ ...t, toSeed });
    prev = toSeed;
  }
  out.tiers = tiers;
  return out;
}

/** The brackets these settings make: one, one per pool, or one per tier. */
export interface PlayoffBracket {
  /** The group key the saved games carry (a pool's or a tier's name), null for one bracket. */
  group: string | null;
  /** How the window names it ("Pool Red", "Gold"), null for one bracket. */
  label: string | null;
  n: number;
  /** A tier's first seed in the division's standings (1 for everything else). */
  fromSeed: number;
  format: PlayoffFormat;
  third: boolean;
  reset: boolean;
}

export function bracketsOf(s: PlayoffSettings, d: PlayoffDivisionFacts): PlayoffBracket[] {
  if (s.shape === 'pools') {
    return poolsOf(d).map(p => ({ group: p.name, label: formatPoolName(p.name), n: s.perPool[p.id] ?? 2, fromSeed: 1, format: s.format, third: s.third, reset: s.reset }));
  }
  if (s.shape === 'tiers') {
    let from = 1;
    return s.tiers.map(t => {
      const b = { group: t.name, label: t.name, n: t.toSeed - from + 1, fromSeed: from, format: t.format, third: t.third, reset: t.reset };
      from = t.toSeed + 1;
      return b;
    });
  }
  return [{ group: null, label: null, n: d.playoffsOnly ? d.teamCount : s.top, fromSeed: 1, format: s.format, third: s.third, reset: s.reset }];
}

/**
 * The division's playoff plan these settings make (A63) — the keys the public pages read, saved with the bracket in one
 * step (mig 327). One bracket crosses two pools over ('standard') or goes by the standings ('reseed'); one per pool is
 * 'none' with each pool's count; tiers keep each tier's range and format. A double elimination says whether it plays a
 * second final; nothing else does.
 */
export function planOf(s: PlayoffSettings, d: PlayoffDivisionFacts): PlayoffPlan {
  const brackets = bracketsOf(s, d);
  const reset = (format: PlayoffFormat, value: boolean) => (format === 'double' ? { grandFinalReset: value } : {});
  if (s.shape === 'pools') {
    const pools = poolsOf(d);
    return {
      type: 'single', crossover: 'none', format: s.format, ...reset(s.format, s.reset),
      hasThirdPlace: brackets.some(b => thirdOf(b)),
      teamsQualifying: Math.max(...brackets.map(b => b.n)),
      splitConfigs: Object.fromEntries(pools.map((p, i) => [p.id, { teamsQualifying: brackets[i].n, hasThirdPlace: thirdOf(brackets[i]) }])),
    };
  }
  if (s.shape === 'tiers') {
    return {
      type: 'single', crossover: 'tiers', format: brackets[0]?.format ?? 'single', hasThirdPlace: false,
      teamsQualifying: brackets.length ? brackets[brackets.length - 1].fromSeed + brackets[brackets.length - 1].n - 1 : 0,
      tierConfigs: brackets.map(b => ({
        name: b.label ?? '', fromSeed: b.fromSeed, toSeed: b.fromSeed + b.n - 1, format: b.format, hasThirdPlace: thirdOf(b), ...reset(b.format, b.reset),
      })),
    };
  }
  const [b] = brackets;
  return {
    type: 'single', crossover: crossesPools(s, d) ? 'standard' : 'reseed', format: s.format, ...reset(s.format, s.reset),
    hasThirdPlace: b ? thirdOf(b) : false, teamsQualifying: b?.n ?? 0,
  };
}

/** A 3rd-place game is offered for single elimination and its consolation, when every bracket has semifinals. */
export const thirdPlaceOffered = (format: PlayoffFormat, sizes: readonly number[]) =>
  (format === 'single' || format === 'consolation') && sizes.length > 0 && sizes.every(n => n >= 4);

/** The 3rd-place choice as the engine will read it (offered, and ticked). */
const thirdOf = (b: Pick<PlayoffBracket, 'format' | 'n' | 'third'>) => b.third && thirdPlaceOffered(b.format, [b.n]);

/** The seed labels of one crossing or standings bracket (today's `buildSeedLabels`, kept). */
function seedLabels(n: number, cross: boolean, pools: readonly PlayoffPoolFacts[]): string[] {
  if (cross && pools.length === 2) {
    const labels: string[] = [];
    for (let r = 1; r <= Math.ceil(n / 2); r++) for (const p of pools) labels.push(`${ordinal(r)} Pool ${p.name}`);
    return labels.slice(0, n);
  }
  return Array.from({ length: n }, (_, i) => `Seed #${i + 1}`);
}
const remapSeed = (ref: string, labels: readonly string[]) => {
  const m = ref.match(/^Seed #(\d+)$/);
  return m ? labels[Number(m[1]) - 1] ?? ref : ref;
};

export interface PlayoffTemplateGame {
  group: string | null;
  code: string;
  /** The engine's round, in its own label ("Semifinal", "Losers Bracket", "Grand Final"). */
  round: string;
  home: string;
  away: string;
  /** How many games deep it sits in its bracket: 1 waits on nothing, 2 on a level-1 game … */
  level: number;
  /** A double elimination's second final, played only if it's needed. */
  ifNecessary: boolean;
}

/** The bracket's games, as the engine builds them, with the division's own labels on the seeds. */
export function templateOf(s: PlayoffSettings, d: PlayoffDivisionFacts): PlayoffTemplateGame[] {
  const pools = poolsOf(d);
  const out: PlayoffTemplateGame[] = [];
  for (const b of bracketsOf(s, d)) {
    if (b.n < 2) continue;
    const generated = generateBracket(b.n, { format: b.format, thirdPlace: thirdOf(b), grandFinalReset: b.format === 'double' ? b.reset : true });
    const label = s.shape === 'pools'
      ? (ref: string) => remapSeed(ref, Array.from({ length: b.n }, (_, i) => `${ordinal(i + 1)} Pool ${b.group}`))
      : s.shape === 'tiers'
        ? (ref: string) => remapTierSeed(ref, b.fromSeed)
        : (ref: string) => remapSeed(ref, seedLabels(b.n, crossesPools(s, d), pools));
    const rows = generated.map(m => ({
      group: b.group, code: m.code, round: bracketRoundLabel(m.code), home: label(m.home), away: label(m.away), level: 0,
      ifNecessary: Boolean(m.ifNecessary),
    }));
    levelInto(rows);
    out.push(...rows);
  }
  return out;
}

const FEEDER = /^(?:winner|loser)\s+(\S+)$/i;
/** The game a side waits on: "Winner SF1" → "SF1"; a seed or a team → null. */
export const feederCode = (side: string): string | null => side.match(FEEDER)?.[1] ?? null;

/** Each game's level within its own bracket (a game fed by another waits one level more). A game is its bracket and
 *  its code: tiers and pools all reuse SF1 and FIN, so a code alone would read one bracket's depth into another's. */
export function levelInto<T extends { group?: string | null; code: string; home: string; away: string; level: number }>(rows: T[]): T[] {
  const keyOf = (group: string | null | undefined, code: string) => `${group ?? ''}::${code}`;
  const byKey = new Map(rows.map(r => [keyOf(r.group, r.code), r]));
  const memo = new Map<string, number>();
  const depth = (key: string, stack = new Set<string>()): number => {
    const known = memo.get(key);
    if (known != null) return known;
    const r = byKey.get(key);
    if (!r || stack.has(key)) return 0;
    stack.add(key);
    const feeds = [r.home, r.away].map(feederCode).map(c => (c ? keyOf(r.group, c) : null)).filter((k): k is string => !!k && byKey.has(k));
    const v = 1 + Math.max(0, ...feeds.map(k => depth(k, stack)));
    stack.delete(key);
    memo.set(key, v);
    return v;
  };
  for (const r of rows) r.level = depth(keyOf(r.group, r.code));
  return rows;
}

/** The first round, as the engine pairs it: who plays whom, and who skips it (a bye). In the bracket's labels. */
export function firstRoundOf(s: PlayoffSettings, d: PlayoffDivisionFacts): { plays: Array<[string, string]>; skips: string[] } {
  const [b] = bracketsOf(s, d);
  if (!b || b.n < 2) return { plays: [], skips: [] };
  const generated = generateBracket(b.n, { format: b.format, thirdPlace: false, grandFinalReset: true });
  const seedOf = (ref: string) => Number(ref.match(/^Seed #(\d+)$/)?.[1] ?? 0);
  const firsts = generated.filter(m => seedOf(m.home) && seedOf(m.away));
  const playing = new Set(firsts.flatMap(m => [seedOf(m.home), seedOf(m.away)]));
  const pairs = firsts
    .map(m => [Math.min(seedOf(m.home), seedOf(m.away)), Math.max(seedOf(m.home), seedOf(m.away))] as [number, number])
    .sort((x, y) => x[0] - y[0]);
  // A placement bracket (or any) may start the same seeds twice: each pair once.
  const seen = new Set<string>();
  const uniq = pairs.filter(p => { const k = p.join('-'); if (seen.has(k)) return false; seen.add(k); return true; });
  const labels = seedLabels(b.n, crossesPools(s, d), poolsOf(d));
  const name = (seed: number) => {
    const l = labels[seed - 1] ?? `Seed #${seed}`;
    return /^Seed #\d+$/.test(l) ? ordinal(seed) : l;
  };
  const skips = Array.from({ length: b.n }, (_, i) => i + 1).filter(seed => !playing.has(seed));
  return { plays: uniq.map(([a, c]) => [name(a), name(c)]), skips: skips.map(name) };
}

/** The seeds (1-based) that skip the first round of an n-team bracket: the engine pairs every other seed in it. */
export function seedsSkippingFirstRound(n: number, format: PlayoffFormat = 'single'): number[] {
  if (n < 2) return [];
  const seedOf = (ref: string) => Number(ref.match(/^Seed #(\d+)$/)?.[1] ?? 0);
  const playing = new Set(generateBracket(n, { format }).filter(m => seedOf(m.home) && seedOf(m.away)).flatMap(m => [seedOf(m.home), seedOf(m.away)]));
  return Array.from({ length: n }, (_, i) => i + 1).filter(seed => !playing.has(seed));
}

/** What the settings make, counted: games, rounds one after another, and each bracket's rounds by the engine's labels. */
export interface PlayoffGets {
  games: number;
  /** Rounds one after another — the deepest level in any bracket. */
  depth: number;
  brackets: Array<{ label: string | null; games: number; rounds: Array<[string, number]> }>;
}
export function getsOf(s: PlayoffSettings, d: PlayoffDivisionFacts): PlayoffGets {
  const rows = templateOf(s, d);
  const brackets: PlayoffGets['brackets'] = [];
  for (const b of bracketsOf(s, d)) {
    const mine = rows.filter(r => r.group === b.group);
    if (mine.length === 0) continue;
    const rounds = new Map<string, number>();
    for (const r of mine) rounds.set(r.round, (rounds.get(r.round) ?? 0) + 1);
    brackets.push({ label: b.label, games: mine.length, rounds: [...rounds.entries()] });
  }
  return { games: rows.length, depth: rows.reduce((m, r) => Math.max(m, r.level), 0), brackets };
}

// ── The fit check (A65) ─────────────────────────────────────────────────────────────────────────────────────────────

export interface FitWindow { date: string; startMinute: number; endMinute: number }
export interface FitResult {
  fits: boolean;
  /** Rounds one after another. */
  depth: number;
  /** About how long the rounds take back to back: Σ waves × length + turnovers, + a rest between rounds. */
  spanMinutes: number;
  /** What the chosen days hold, end to end. */
  holdsMinutes: number;
}

/**
 * Lay the bracket's levels into the days, in order: a level's games run in waves over `lanes` fields (the turnover
 * between waves), the next level starts `rest` after the last one ends, and a game that won't finish inside its day
 * moves to the next day's start — a night counts as rest. About, because the drafts place the real games.
 */
export function fitOf(input: {
  levels: readonly number[];
  lanes: number;
  gameLength: number;
  turnover: number;
  rest: number;
  windows: readonly FitWindow[];
}): FitResult {
  const byLevel = new Map<number, number>();
  for (const l of input.levels) byLevel.set(l, (byLevel.get(l) ?? 0) + 1);
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  const lanes = Math.max(1, Math.floor(input.lanes) || 1);
  const len = Math.max(1, input.gameLength);
  const windows = [...input.windows].filter(w => w.endMinute > w.startMinute).sort((a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute);
  let span = 0;
  for (const l of levels) {
    const waves = Math.ceil((byLevel.get(l) ?? 0) / lanes);
    span += waves * len + Math.max(0, waves - 1) * input.turnover;
  }
  span += Math.max(0, levels.length - 1) * input.rest;
  const holds = windows.reduce((t, w) => t + (w.endMinute - w.startMinute), 0);
  if (levels.length === 0 || windows.length === 0) return { fits: true, depth: levels.length, spanMinutes: span, holdsMinutes: holds };

  let w = 0;
  let cursor = windows[0].startMinute;
  let prevEnd: number | null = null;
  let fits = true;
  outer: for (const l of levels) {
    const waves = Math.ceil((byLevel.get(l) ?? 0) / lanes);
    if (prevEnd != null) cursor = prevEnd + input.rest;
    let waveEnd: number | null = null;
    for (let i = 0; i < waves; i++) {
      if (waveEnd != null) cursor = waveEnd + input.turnover;
      if (cursor < windows[w].startMinute) cursor = windows[w].startMinute;
      while (cursor + len > windows[w].endMinute) {
        w += 1;
        if (w >= windows.length) { fits = false; break outer; }
        cursor = windows[w].startMinute; // the night between days counts as the rest
      }
      waveEnd = cursor + len;
    }
    prevEnd = waveEnd;
  }
  return { fits, depth: levels.length, spanMinutes: span, holdsMinutes: holds };
}

// ── The drafts (A66) ────────────────────────────────────────────────────────────────────────────────────────────────

/** The final game of a bracket: single, consolation (FIN), double (GF, and its second final GF2), placement (PL1). */
export const isFinalCode = (code: string | null | undefined) => /^(FIN|GF2?|PL1)$/i.test((code ?? '').trim());

export interface PlayoffDraftRow {
  group: string | null;
  code: string;
  home: string;
  away: string;
  date: string;
  time: string;
  /** The field it is on, in words. */
  field: string;
}

export interface PlayoffDraftMeasures {
  /** The tightest turnaround any advancing team gets, in minutes (null: no game feeds another). */
  shortestRest: number | null;
  /** The tightest turnaround into a final. */
  restBeforeFinal: number | null;
  /** When the last game ends: its day, its end as a clock, and as minutes to compare by. */
  lastEnd: { date: string; time: string; at: number } | null;
  /** The final, when there is one bracket: its day, time and field. */
  final: { date: string; time: string; field: string } | null;
  /** Most games one advancing team could play in a day. */
  maxGamesInDay: number;
}

/** A game's start as calendar minutes (its day + its clock), never a local instant: a clocks-change day keeps 24 h. */
const minutesAt = (date: string, time: string) => {
  const [y, mo, d] = date.split('-').map(Number);
  const t = timeToMinutes(time);
  return y && mo && d && !Number.isNaN(t) ? Date.UTC(y, mo - 1, d) / 60_000 + t : null;
};

export function draftMeasures(rows: readonly PlayoffDraftRow[], gameLength: number): PlayoffDraftMeasures {
  const m = buildBracketScheduleMetrics(
    rows.map(r => ({ code: r.code, home: r.home, away: r.away, date: r.date || null, time: r.time || null, pool: r.group })),
    { gameDurationMinutes: gameLength },
  );
  const key = (group: string | null, code: string) => `${group ?? ''}::${code.toUpperCase()}`;
  const byKey = new Map(rows.map(r => [key(r.group, r.code), r]));
  let restBeforeFinal: number | null = null;
  const finals = rows.filter(r => isFinalCode(r.code) && r.code.toUpperCase() !== 'GF2');
  for (const f of finals) {
    const start = minutesAt(f.date, f.time);
    if (start == null) continue;
    for (const side of [f.home, f.away]) {
      const feeder = byKey.get(key(f.group, feederCode(side) ?? ''));
      const fs = feeder ? minutesAt(feeder.date, feeder.time) : null;
      if (fs == null) continue;
      const rest = start - (fs + gameLength);
      restBeforeFinal = restBeforeFinal == null ? rest : Math.min(restBeforeFinal, rest);
    }
  }
  let lastEnd: PlayoffDraftMeasures['lastEnd'] = null;
  for (const r of rows) {
    const s = minutesAt(r.date, r.time);
    if (s == null) continue;
    const at = s + gameLength;
    if (!lastEnd || at > lastEnd.at) {
      const [h, mm] = r.time.split(':').map(Number);
      lastEnd = { date: r.date, time: minutesToTime(h * 60 + mm + gameLength), at };
    }
  }
  const final = finals.length === 1 && finals[0].date && finals[0].time
    ? { date: finals[0].date, time: finals[0].time, field: finals[0].field } : null;
  return { shortestRest: m.tightestTurnaroundMinutes, restBeforeFinal, lastEnd, final, maxGamesInDay: m.worstCaseGamesPerDay };
}

export type DraftWin = 'rest' | 'earliest' | 'finalRest' | 'lightDays';
/** The order cards are named in: what a coach asks of a playoff day first. */
export const DRAFT_WINS: readonly DraftWin[] = ['rest', 'earliest', 'finalRest', 'lightDays'];

const valueOf = (m: PlayoffDraftMeasures, w: DraftWin): number | null => {
  switch (w) {
    case 'rest': return m.shortestRest;
    case 'earliest': return m.lastEnd ? -m.lastEnd.at : null;
    case 'finalRest': return m.restBeforeFinal;
    case 'lightDays': return -m.maxGamesInDay;
  }
};

/**
 * Only the drafts that differ, named by what they win (A66). Two drafts differ when one of the four measures does; a
 * draft that wins nothing among those shown is left out (it is no one's best); the engine's order is kept, so its best
 * reads first. At most three cards. One draft left → no card column (the caller's). `matchedAll`: every draft left out
 * measured the same as one shown — the only time the window may say "every other draft it tried matched one of these".
 */
export function distinctDrafts(measures: readonly PlayoffDraftMeasures[]): { cards: Array<{ index: number; win: DraftWin | null }>; matchedAll: boolean } {
  const sig = (m: PlayoffDraftMeasures) => [m.shortestRest, m.restBeforeFinal, m.lastEnd?.at ?? null, m.maxGamesInDay].join('|');
  const seen = new Set<string>();
  const pool: number[] = [];
  measures.forEach((m, i) => { const s = sig(m); if (!seen.has(s)) { seen.add(s); pool.push(i); } });
  const shown = (cards: Array<{ index: number; win: DraftWin | null }>) => ({ cards, matchedAll: pool.length === cards.length });
  if (pool.length <= 1) return shown(pool.map(index => ({ index, win: null })));
  const best = new Map<DraftWin, number>();
  for (const w of DRAFT_WINS) {
    const values = pool.map(i => valueOf(measures[i], w)).filter((v): v is number => v != null);
    if (values.length) best.set(w, Math.max(...values));
  }
  // A measure every shown draft ties on decides nothing: no card is named by it.
  const decides = (w: DraftWin) => new Set(pool.map(i => valueOf(measures[i], w))).size > 1;
  const taken = new Set<DraftWin>();
  const out: Array<{ index: number; win: DraftWin | null }> = [];
  for (const i of pool) {
    const win = DRAFT_WINS.find(w => decides(w) && !taken.has(w) && valueOf(measures[i], w) === best.get(w)) ?? null;
    if (!win) continue;
    taken.add(win);
    out.push({ index: i, win });
    if (out.length === 3) break;
  }
  return shown(out.length ? out : [{ index: pool[0], win: null }]);
}
