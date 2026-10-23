import 'server-only';
import { getOrgMemberDisplayNames } from './db';
import { listActiveMemberships, listPublicNameMemberships, resolveMembershipCapabilities } from './coach-membership';
import { staffKindWord } from './coach-capabilities';
import { DEFAULT_COACH_NAMES_POLICY, seatNameListing, type CoachNamesPolicy } from './coach-names-policy';
import { publicPersonName } from './tryout-contact-rules';

/**
 * lib/club-team-coaches.ts — THE PUBLIC TEAM PAGE'S "Coaches" (Club Tier Stage 4c-2 Part B, Stage 4 Ask 2; words
 * CLUB_TIER_STAGE4C2_COPY.md §G).
 *
 * Only coaches who turned on their own "Show my name on the team's public page", and only while their seat is active
 * (every removal also turns the switch off). **Name and role only** — this module returns no email and no phone, and a
 * coach with no name on file is LEFT OUT rather than shown by their account address (the staff pages' fallback must
 * never reach a public page). No player is ever read here. `tests/unit/club-stage4c2b-guard.test.ts`.
 */
export interface PublicTeamCoach {
  name: string;
  role: string;
}

export async function getPublicTeamCoaches(
  orgId: string,
  teamId: string,
  policy: CoachNamesPolicy = DEFAULT_COACH_NAMES_POLICY,
): Promise<PublicTeamCoach[]> {
  // The club's choice (mig 352): "No coach names" reads nothing; "Coaches choose" keeps the switch-on read exactly as it
  // was; the two "always" choices read every active seat and let the one rule decide who is listed.
  if (policy === 'none') return [];
  const seats = policy === 'coaches_choose'
    ? await listPublicNameMemberships(orgId, teamId)
    : (await listActiveMemberships(orgId, teamId)).filter(m => seatNameListing(policy, m).listed);
  if (seats.length === 0) return [];
  // One members read; only a member the club never named pays for an account read (a public page: no per-coach call).
  const names = await getOrgMemberDisplayNames(orgId, seats.map(m => m.userId));
  return seats
    .map(m => ({
      head: m.coachRole === 'head_coach',
      name: publicPersonName(names[m.userId]),
      role: staffKindWord(resolveMembershipCapabilities(m), m.staffKind),
    }))
    .filter((c): c is { head: boolean; name: string; role: string } => !!c.name)
    .sort((a, b) => Number(b.head) - Number(a.head) || a.name.localeCompare(b.name))
    .map(({ name, role }) => ({ name, role }));
}
