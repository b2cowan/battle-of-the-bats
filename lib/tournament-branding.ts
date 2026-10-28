import type { Organization } from './types';
import { hasPlanFeature } from './plan-features';

export function canUseAdvancedTournamentBranding(org: Pick<Organization, 'planId'>): boolean {
  return hasPlanFeature(org.planId, 'advanced_tournament_branding');
}
