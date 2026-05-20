import type { Organization } from '@/lib/types';
import { hasPlanFeature } from '@/lib/plan-features';

export function canUseAdvancedTournamentBranding(org: Pick<Organization, 'planId'>): boolean {
  return hasPlanFeature(org.planId, 'advanced_tournament_branding');
}
