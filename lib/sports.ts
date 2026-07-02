import type { FacilityType } from './types';
import type { TieBreaker } from './tie-breakers';

/**
 * Single source of truth for "what sport is this?" across the platform.
 *
 * Two layers:
 *  1. SPORT_OPTIONS — the canonical, ordered list of selectable sports. Every existing
 *     sport dropdown (coach signup, rep teams, house-league seasons, onboarding) sources
 *     its options here so the vocabulary can never drift again.
 *  2. SportPack — the per-sport behaviour bundle (score word, default tie-breakers,
 *     points-per-win, whether a mercy/diff cap applies, default surface, period word,
 *     countdown verb). Screens read labels/rules from the pack instead of hard-coding
 *     "Runs", so adding a new sport later is a data change, not a code hunt.
 *
 * Phase 0 (this file) is purely additive — it establishes the foundation and the
 * existing dropdowns consume SPORT_OPTIONS. Tournaments gain a `sport` field and start
 * reading from the packs in later phases. See
 * docs/projects/active/MULTISPORT_TOURNAMENTS_PLAN.md.
 */

export type SportId =
  | 'softball'
  | 'baseball'
  | 'basketball'
  | 'soccer'
  | 'hockey'
  | 'volleyball'
  | 'lacrosse'
  | 'other';

export interface SportOption {
  id: SportId;
  label: string;
}

/**
 * Canonical, ordered list of ALL known sports — the full vocabulary for normalizing and
 * labelling stored values (incl. legacy data) and the SportId type. This is NOT what the
 * dropdowns show: every customer-facing picker offers the narrower OFFERED_SPORT_OPTIONS
 * (softball + baseball) so we never advertise a sport we don't support yet.
 */
export const SPORT_OPTIONS: readonly SportOption[] = [
  { id: 'softball', label: 'Softball' },
  { id: 'baseball', label: 'Baseball' },
  { id: 'basketball', label: 'Basketball' },
  { id: 'soccer', label: 'Soccer' },
  { id: 'hockey', label: 'Hockey' },
  { id: 'volleyball', label: 'Volleyball' },
  { id: 'lacrosse', label: 'Lacrosse' },
  { id: 'other', label: 'Other' },
];

/** Legacy default applied when a sport is blank/unknown. Keeps existing rows on softball. */
export const DEFAULT_SPORT: SportId = 'softball';

/**
 * Sports actually OFFERED in pickers today. Multi-sport is paused (owner, 2026-06-24) —
 * softball + baseball only until we expand. EVERY customer-facing sport dropdown (coach
 * signup, rep teams, house-league seasons, onboarding, and the tournament picker) sources
 * this list, NOT the full SPORT_OPTIONS, so we never advertise a sport we can't run well yet.
 * Narrowing the offered list (rather than the canonical SPORT_OPTIONS) keeps existing-data
 * labels intact; expanding later = add an id here (plus a SportPack for tailored behaviour).
 */
export const OFFERED_SPORT_IDS: readonly SportId[] = ['softball', 'baseball'];
export const OFFERED_SPORT_OPTIONS: readonly SportOption[] = SPORT_OPTIONS.filter(o =>
  OFFERED_SPORT_IDS.includes(o.id),
);

/**
 * What the tournament-creation sport picker offers — the same softball + baseball set as the
 * other pickers (kept as a distinct name in case tournaments ever diverge). Was softball +
 * basketball + "Other" during the (now-paused) multi-sport build; realigned 2026-06-25.
 */
export const TOURNAMENT_SPORT_OPTIONS: readonly SportOption[] = OFFERED_SPORT_OPTIONS;

const SPORT_ID_SET = new Set<string>(SPORT_OPTIONS.map(o => o.id));
const ID_BY_LABEL_LOWER = new Map<string, SportId>(
  SPORT_OPTIONS.map(o => [o.label.toLowerCase(), o.id]),
);

/**
 * Coerce an arbitrary stored / free-text sport into a canonical SportId. Accepts either
 * the id ('softball') or the display label ('Softball'), case-insensitively. Unknown →
 * 'other'; blank/null → 'softball' (the legacy default).
 */
export function normalizeSportId(value: string | null | undefined): SportId {
  const trimmed = (value ?? '').trim().toLowerCase();
  if (!trimmed) return DEFAULT_SPORT;
  if (SPORT_ID_SET.has(trimmed)) return trimmed as SportId;
  return ID_BY_LABEL_LOWER.get(trimmed) ?? 'other';
}

/** Display label for a sport id/value (falls back to 'Other'). */
export function sportLabel(value: SportId | string | null | undefined): string {
  const id = normalizeSportId(value);
  return SPORT_OPTIONS.find(o => o.id === id)?.label ?? 'Other';
}

/** Scoring vocabulary surfaced in standings columns, tiles, and tooltips. */
export interface ScoreLabels {
  /** "Runs For" / "Goals For" / "Points For". */
  for: string;
  against: string;
  diff: string;
  /** Short column headers, e.g. "RF" / "GF" / "PF". */
  forAbbr: string;
  againstAbbr: string;
  diffAbbr: string;
  /** Singular / plural unit, e.g. "Run"/"Runs", "Point"/"Points". */
  unit: string;
  unitPlural: string;
}

/**
 * Everything that differs between sports. One object per sport; screens read from it
 * instead of hard-coding softball assumptions.
 */
export interface SportPack {
  id: SportId;
  label: string;
  score: ScoreLabels;
  /** Tie-breaker order seeded for a NEW tournament of this sport. */
  defaultTieBreakers: TieBreaker[];
  /** Points awarded for the standings "Pts" column. */
  pointsPerWin: number;
  pointsPerDraw: number;
  /** Whether draws/ties are a normal outcome (false where overtime always resolves). */
  usesDraws: boolean;
  /** Primary standings ranking: a points total, or win percentage (basketball). */
  standingsPrimary: 'points' | 'winPct';
  /** Whether a per-game score-difference (mercy) cap applies — hide the cap UI when false. */
  hasDiffCap: boolean;
  /** Label for the diff-cap input when hasDiffCap is true. */
  diffCapLabel: string;
  /** Default playing-surface type for new venues of this sport. */
  defaultFacilityType: FacilityType;
  /** What one scoring period is called, plus a sensible default count. */
  periodLabel: string;
  periodLabelPlural: string;
  defaultPeriodCount: number;
  /** Phrase before "in …" in the pre-event countdown ("First pitch", "Tip-off", "Kickoff"). */
  startVerb: string;
  /** Roster positions offered as a dropdown (empty = free-text only). Shared vocabulary
   *  with game lineups so a player's position reads the same everywhere. */
  positions: string[];
  /** The on-field positions the lineup auto-fill assigns — exactly one player each, per
   *  inning/period. A subset of `positions`, excluding bat-only / catch-all roles (DH, the
   *  generic OF). Empty when the sport has no fixed fielding slots (auto-fill degrades to a
   *  no-op). Keep the generator sport-neutral by passing this in, never hard-coding codes. */
  fieldPositions: string[];
  /** The one position governed by a pitcher depth chart + arm-care innings caps in the lineup
   *  builder (e.g. 'P' for the diamond). null when the sport has no such role — the pitching
   *  UI and generator pitching logic are then skipped entirely. */
  pitcherPosition: string | null;
}

/** Diamond field positions the lineup auto-fill assigns — the 9 standard defensive spots,
 *  one player each per inning. Shared by softball and baseball. */
const DIAMOND_FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
/** Full diamond roster vocabulary — the 9 field spots plus the generic OF catch-all and DH. */
const DIAMOND_POSITIONS = [...DIAMOND_FIELD_POSITIONS, 'OF', 'DH'];

const SOFTBALL_PACK: SportPack = {
  id: 'softball',
  label: 'Softball',
  score: {
    for: 'Runs For',
    against: 'Runs Against',
    diff: 'Run Diff',
    forAbbr: 'RF',
    againstAbbr: 'RA',
    diffAbbr: 'RD',
    unit: 'Run',
    unitPlural: 'Runs',
  },
  defaultTieBreakers: ['h2h', 'rd', 'rf', 'ra'],
  pointsPerWin: 2,
  pointsPerDraw: 1,
  usesDraws: true,
  standingsPrimary: 'points',
  hasDiffCap: true,
  diffCapLabel: 'Max run differential per game',
  defaultFacilityType: 'diamond',
  periodLabel: 'Inning',
  periodLabelPlural: 'Innings',
  defaultPeriodCount: 7,
  startVerb: 'First pitch',
  positions: DIAMOND_POSITIONS,
  fieldPositions: DIAMOND_FIELD_POSITIONS,
  pitcherPosition: 'P',
};

// Baseball ≈ softball scoring (runs, innings, first pitch, diamond, mercy/diff cap), so it
// reads as baseball end-to-end instead of falling back to the neutral generic pack. Default
// 9 innings (organizers can change it). One of the two sports we offer today.
const BASEBALL_PACK: SportPack = {
  id: 'baseball',
  label: 'Baseball',
  score: {
    for: 'Runs For',
    against: 'Runs Against',
    diff: 'Run Diff',
    forAbbr: 'RF',
    againstAbbr: 'RA',
    diffAbbr: 'RD',
    unit: 'Run',
    unitPlural: 'Runs',
  },
  defaultTieBreakers: ['h2h', 'rd', 'rf', 'ra'],
  pointsPerWin: 2,
  pointsPerDraw: 1,
  usesDraws: true,
  standingsPrimary: 'points',
  hasDiffCap: true,
  diffCapLabel: 'Max run differential per game',
  defaultFacilityType: 'diamond',
  periodLabel: 'Inning',
  periodLabelPlural: 'Innings',
  defaultPeriodCount: 9,
  startVerb: 'First pitch',
  positions: DIAMOND_POSITIONS,
  fieldPositions: DIAMOND_FIELD_POSITIONS,
  pitcherPosition: 'P',
};

// First differently-scored pack — proves the model. Basketball: points (not runs), four
// quarters, ranked by win % (no points total), no mercy/diff cap, played on a court.
const BASKETBALL_PACK: SportPack = {
  id: 'basketball',
  label: 'Basketball',
  score: {
    for: 'Points For',
    against: 'Points Against',
    diff: 'Point Diff',
    forAbbr: 'PF',
    againstAbbr: 'PA',
    diffAbbr: 'PD',
    unit: 'Point',
    unitPlural: 'Points',
  },
  defaultTieBreakers: ['h2h', 'rd', 'rf'],
  pointsPerWin: 2,
  pointsPerDraw: 0,
  usesDraws: false,
  standingsPrimary: 'winPct',
  hasDiffCap: false,
  diffCapLabel: 'Max point differential per game',
  defaultFacilityType: 'court',
  periodLabel: 'Quarter',
  periodLabelPlural: 'Quarters',
  defaultPeriodCount: 4,
  startVerb: 'Tip-off',
  positions: ['PG', 'SG', 'SF', 'PF', 'C'],
  fieldPositions: ['PG', 'SG', 'SF', 'PF', 'C'],
  pitcherPosition: null,
};

// Neutral fallback for any sport without a tailored pack yet (incl. 'other'). Sport-safe
// wording, conventional 2-1-0 points, no mercy cap. getSportPack() stamps the real
// id/label on top so the countdown and headings still name the chosen sport.
const GENERIC_PACK: SportPack = {
  id: 'other',
  label: 'Other',
  score: {
    for: 'Score For',
    against: 'Score Against',
    diff: 'Score Diff',
    forAbbr: 'SF',
    againstAbbr: 'SA',
    diffAbbr: 'SD',
    unit: 'Score',
    unitPlural: 'Score',
  },
  defaultTieBreakers: ['h2h', 'rd', 'rf', 'ra'],
  pointsPerWin: 2,
  pointsPerDraw: 1,
  usesDraws: true,
  standingsPrimary: 'points',
  hasDiffCap: false,
  diffCapLabel: 'Max score differential per game',
  defaultFacilityType: 'other',
  periodLabel: 'Period',
  periodLabelPlural: 'Periods',
  defaultPeriodCount: 2,
  startVerb: 'Tournament starts',
  positions: [],
  fieldPositions: [],
  pitcherPosition: null,
};

const TAILORED_PACKS: Partial<Record<SportId, SportPack>> = {
  softball: SOFTBALL_PACK,
  baseball: BASEBALL_PACK,
  basketball: BASKETBALL_PACK,
};

/**
 * Resolve the SportPack for a sport. Tailored sports return their bespoke pack; everything
 * else returns the neutral generic pack stamped with the requested sport's id + label.
 */
export function getSportPack(value: SportId | string | null | undefined): SportPack {
  const id = normalizeSportId(value);
  const tailored = TAILORED_PACKS[id];
  if (tailored) return tailored;
  return { ...GENERIC_PACK, id, label: sportLabel(id) };
}
