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
 * Canonical, ordered list of selectable sports. Used by the league/rep/coach sport
 * dropdowns (which support any sport). The TOURNAMENT picker uses the narrower
 * TOURNAMENT_SPORT_OPTIONS — per owner decision (2026-06-18) it only offers sports we
 * genuinely support yet, never a half-built one.
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
 * Sports with a fully tailored SportPack today. The TOURNAMENT sport picker only offers
 * these plus 'other' (a neutral fallback), and the list grows as packs are added — we
 * never surface a sport whose tournament experience we can't do well yet.
 */
export const TAILORED_SPORT_IDS: readonly SportId[] = ['softball', 'basketball'];

/** What the tournament-creation sport picker offers (Phase 1 consumer). */
export const TOURNAMENT_SPORT_OPTIONS: readonly SportOption[] = SPORT_OPTIONS.filter(
  o => TAILORED_SPORT_IDS.includes(o.id) || o.id === 'other',
);

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
}

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
};

// First non-softball pack — proves the model. Basketball: points (not runs), four
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
};

const TAILORED_PACKS: Partial<Record<SportId, SportPack>> = {
  softball: SOFTBALL_PACK,
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
