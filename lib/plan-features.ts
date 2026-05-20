import type { OrgPlan } from './types';

export type PlanFeature =
  | 'auto_schedule'
  | 'playoff_generator'
  | 'sealed_archives'
  | 'advanced_tournament_branding'
  | 'schedule_notification';

export const PLAN_RANK: Record<OrgPlan, number> = {
  tournament:      0,
  tournament_plus: 1,
  league:          2,
  club:            3,
};

export const FEATURE_MIN_PLAN: Record<PlanFeature, OrgPlan> = {
  auto_schedule:                'tournament_plus',
  playoff_generator:            'tournament_plus',
  sealed_archives:              'tournament_plus',
  advanced_tournament_branding: 'tournament_plus',
  schedule_notification:        'tournament_plus',
};

export function hasPlanFeature(planId: OrgPlan, feature: PlanFeature): boolean {
  return PLAN_RANK[planId] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]];
}

export function requiresTournamentPlusCopy(feature: PlanFeature): string {
  switch (feature) {
    case 'auto_schedule':
      return 'Automated schedule generation is included with Tournament Plus, League, and Club.';
    case 'playoff_generator':
      return 'The playoff bracket generator is included with Tournament Plus, League, and Club.';
    case 'sealed_archives':
      return 'Permanent sealed archives are included with Tournament Plus, League, and Club.';
    case 'advanced_tournament_branding':
      return 'Advanced tournament branding is included with Tournament Plus, League, and Club.';
    case 'schedule_notification':
      return 'Email notifications to registered teams are included with Tournament Plus, League, and Club.';
  }
}
