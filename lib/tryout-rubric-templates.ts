/**
 * Starter evaluation-rubric templates (Phase 2B). Seeds a coach's scorecard so they don't start
 * from a blank page. Kept out of the UI so categories/vocab stay data-driven and sport-configurable.
 *
 * V1: softball + baseball share the diamond skill set. Add other sports (or route category vocab
 * through lib/sports.ts) here when non-diamond sports land — the caller passes the team's sport.
 */
import type { RepTryoutRubricCategory } from '@/lib/types';

export interface RubricTemplate {
  scaleMax: number;
  categories: RepTryoutRubricCategory[];
}

const DIAMOND_TEMPLATE: RubricTemplate = {
  scaleMax: 5,
  categories: [
    { key: 'hitting',  label: 'Hitting',              weight: 1 },
    { key: 'fielding', label: 'Fielding',             weight: 1 },
    { key: 'throwing', label: 'Throwing / arm',       weight: 1 },
    { key: 'speed',    label: 'Speed / baserunning',  weight: 1 },
    { key: 'attitude', label: 'Attitude / coachability', weight: 1 },
  ],
};

/** The suggested starter scorecard for a team's sport. V1: every offered sport is a diamond
 *  sport, so every lookup resolves to the diamond set — but the seam is here NOW so the day a
 *  non-diamond sport is enabled, this is a template addition, not an API change (§1.7 carry-over).
 */
export function getRubricStarter(_sport?: string | null): RubricTemplate {
  return DIAMOND_TEMPLATE;
}
