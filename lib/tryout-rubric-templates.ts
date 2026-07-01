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

/** The suggested starter scorecard. V1 returns the diamond set (softball/baseball); add a sport
 *  param + a per-sport lookup here when non-diamond sports land (sport-neutrality carry-over). */
export function getRubricStarter(): RubricTemplate {
  return DIAMOND_TEMPLATE;
}
