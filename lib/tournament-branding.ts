import type { Organization } from '@/lib/types';

export function canUseAdvancedTournamentBranding(org: Pick<Organization, 'planId'>): boolean {
  return org.planId !== 'tournament';
}
