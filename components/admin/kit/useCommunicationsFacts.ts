'use client';
/**
 * The signed-in person's Communications facts (Club Communications Stage 1), for the buttons that start a group email on
 * another screen: the season's Email families, Registrations' Email, a season's owing list, a Families list. Ask 5: the
 * switch off = those buttons are ABSENT; each route refuses on its own too (`lib/club-communications-auth.ts`).
 */
import { useOrg } from '@/lib/org-context';
import { familyDoor, placeFacts, seasonDoorOpen, type PlaceFacts } from '@/lib/club-communications-place';

export function useCommunicationsFacts(): PlaceFacts | null {
  const { currentOrg, userRole, userCapabilities, limitedToTeamGroups } = useOrg();
  if (!currentOrg || !userRole) return null;
  return placeFacts({ role: userRole, capabilities: userCapabilities, limited: limitedToTeamGroups }, currentOrg);
}

/** May this person email a season's families from the season's own screens? (The house-league `email` right AND the switch.) */
export function useSeasonEmailOpen(): boolean {
  const f = useCommunicationsFacts();
  return !!f && seasonDoorOpen(f);
}

/** May this person use the club's family window (a Families list's "Email these families")? The owner and admins only. */
export function useClubFamilyEmailOpen(): boolean {
  const f = useCommunicationsFacts();
  return !!f && familyDoor(f) === 'club';
}
