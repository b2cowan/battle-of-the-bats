import {
  resolveCoachCapabilities,
  staffKindLabel,
  type AssistantCapabilityGrants,
  type StaffKind,
} from './coach-capabilities';

/**
 * lib/coach-names-policy.ts — THE CLUB DECIDES WHO IS LISTED AS A COACH (mig 352, Club Tier; owner rulings 2026-10-23,
 * docs/projects/active/COACH_NAMES_CLUB_POLICY_PLAN.md).
 *
 * ONE rule, one table, and every consumer calls it: the team page's Coaches shelf, the coach's own row in Team
 * settings, the family tryout page's head-coach name, and the notice to a coach a choice newly lists. No second copy.
 *
 * | Policy                      | Head coach | Assistant coach | Manager, treasurer, helper |
 * |-----------------------------|------------|-----------------|----------------------------|
 * | coaches_choose              | own switch | own switch      | own switch                 |
 * | heads_always                | listed     | own switch      | own switch                 |
 * | heads_and_assistants_always | listed     | listed          | own switch                 |
 * | none                        | not listed | not listed      | not listed                 |
 *
 * ⚠ The policy is READ beside a coach's own switch and NEVER writes it: going back to `coaches_choose` returns everyone
 * to exactly what they had set. And it is a DISPLAY rule — `staffKindLabel` is documented display-only; never use this
 * to gate access to anything. The role is the display word, not `coach_role` (a manager or treasurer has
 * `coach_role = 'assistant_coach'`).
 */
export type CoachNamesPolicy = 'coaches_choose' | 'heads_always' | 'heads_and_assistants_always' | 'none';

export const COACH_NAMES_POLICIES: ReadonlyArray<CoachNamesPolicy> = [
  'coaches_choose',
  'heads_always',
  'heads_and_assistants_always',
  'none',
];

export const DEFAULT_COACH_NAMES_POLICY: CoachNamesPolicy = 'coaches_choose';

/** A stored value or client body → a policy; anything else is the default (the fail-closed reading). */
export function sanitizeCoachNamesPolicy(input: unknown): CoachNamesPolicy {
  return typeof input === 'string' && (COACH_NAMES_POLICIES as readonly string[]).includes(input)
    ? (input as CoachNamesPolicy)
    : DEFAULT_COACH_NAMES_POLICY;
}

/** Strict form for a request body: null when the value is not one of the four. */
export function parseCoachNamesPolicy(input: unknown): CoachNamesPolicy | null {
  return typeof input === 'string' && (COACH_NAMES_POLICIES as readonly string[]).includes(input)
    ? (input as CoachNamesPolicy)
    : null;
}

/** The role word the rule is written in: head, assistant, or one of the other three staff kinds. */
export type CoachNamesRole = 'head' | StaffKind;

/** The part of a team seat the rule reads — `TeamStaffMembership` satisfies it. */
export interface CoachNamesSeat {
  coachRole: 'head_coach' | 'assistant_coach';
  capabilities: AssistantCapabilityGrants | null;
  staffKind: StaffKind | null;
  showNamePublic: boolean;
}

/** The seat's role word. A row with no stored kind falls back to its grant shape (existing behaviour). */
export function coachNamesRoleOf(seat: Pick<CoachNamesSeat, 'coachRole' | 'capabilities' | 'staffKind'>): CoachNamesRole {
  return staffKindLabel(resolveCoachCapabilities(seat.coachRole, seat.capabilities), seat.staffKind);
}

export interface CoachNameListing {
  /** Is this person named on the team's public page? */
  listed: boolean;
  /** Does the coach's own switch apply (so the switch is shown and decides)? False where the club has decided. */
  ownSwitchApplies: boolean;
}

/** The rule. `ownSwitch` is the coach's stored "Show my name" value, read and never written here. */
export function coachNameListing(policy: CoachNamesPolicy, role: CoachNamesRole, ownSwitch: boolean): CoachNameListing {
  switch (policy) {
    case 'none':
      return { listed: false, ownSwitchApplies: false };
    case 'heads_always':
      if (role === 'head') return { listed: true, ownSwitchApplies: false };
      break;
    case 'heads_and_assistants_always':
      if (role === 'head' || role === 'assistant') return { listed: true, ownSwitchApplies: false };
      break;
    default:
      break;
  }
  return { listed: ownSwitch, ownSwitchApplies: true };
}

/** The rule for a seat. */
export function seatNameListing(policy: CoachNamesPolicy, seat: CoachNamesSeat): CoachNameListing {
  return coachNameListing(policy, coachNamesRoleOf(seat), seat.showNamePublic);
}

// ── What a change of choice does — the window's counts and the notice's audience ─────────────────────────────────

/** One active seat on a team with a live season, reduced to what the comparison reads. */
export interface ListingSeat {
  teamId: string;
  userId: string;
  role: CoachNamesRole;
  ownSwitch: boolean;
  /** A name is on file — a public page never prints an account address, so a nameless coach is never counted. */
  hasName: boolean;
}

export interface ListingChange {
  /** Distinct people a move from `from` to `to` newly lists: the CLUB's rule now lists them on a seat where they were not
   *  listed before. A coach whose own switch is what lists them (going from No coach names back to Coaches choose, or an
   *  assistant who switched themselves on under Head coaches always) is control handed back, never "newly listed" — no
   *  notice and no count. */
  newlyListedUserIds: string[];
  /** The first team each newly listed person is newly listed on — where the notice sends them. */
  newlyListedFirstTeam: Map<string, string>;
  /** Of those people: how many are newly listed as a head coach / as an assistant coach on at least one team. */
  heads: number;
  assistants: number;
  /** How many teams gain at least one name. */
  teams: number;
  /** Distinct people listed under `from` who would not be listed under `to`. */
  noLongerListed: number;
}

/** Pure: who a change from one choice to another newly lists (and who it stops listing). Seats without a name are skipped. */
export function listingChange(from: CoachNamesPolicy, to: CoachNamesPolicy, seats: readonly ListingSeat[]): ListingChange {
  const newly = new Map<string, string>();
  const heads = new Set<string>();
  const assistants = new Set<string>();
  const teams = new Set<string>();
  const stopped = new Set<string>();
  for (const s of seats) {
    if (!s.hasName) continue;
    const before = coachNameListing(from, s.role, s.ownSwitch).listed;
    const afterListing = coachNameListing(to, s.role, s.ownSwitch);
    const after = afterListing.listed;
    if (after && !before && !afterListing.ownSwitchApplies) {
      if (!newly.has(s.userId)) newly.set(s.userId, s.teamId);
      if (s.role === 'head') heads.add(s.userId);
      else if (s.role === 'assistant') assistants.add(s.userId);
      teams.add(s.teamId);
    } else if (before && !after) {
      stopped.add(s.userId);
    }
  }
  return {
    newlyListedUserIds: [...newly.keys()],
    newlyListedFirstTeam: newly,
    heads: heads.size,
    assistants: assistants.size,
    teams: teams.size,
    noLongerListed: stopped.size,
  };
}
