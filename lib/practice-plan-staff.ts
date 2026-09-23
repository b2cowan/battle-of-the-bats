import 'server-only';
import { getActiveTeamMembership, getTeamStaffPanelList, resolveMembershipCapabilities, type TeamStaffPanelMember } from './coach-membership';
import { canViewSchedule, staffKindLabel, staffKindWord } from './coach-capabilities';
import type { PracticeStaffPerson } from './practice-plan-send';
import type { RepTeamTag } from './types';

/**
 * The team's staff THIS SEASON as people a practice plan can name and reach (mig 303) — the
 * picker's "People on this team" group, the send sheet's audiences, and the "mine" resolution
 * on every read of the plan.
 *
 * ⚠ Read from the MEMBERSHIPS (the access truth since mig 245), not the season's coach record:
 * the stored staff kind and the current capabilities live there, and "can they open the plan"
 * has to be answered by the same predicate the plan route gates on (`canViewSchedule`).
 *
 * ⚠ `name` is never blank. The resolved name is the club's word for them, then their own account
 * name (`resolveCoachUserIdentities`), and only then the email's local part. That last rung used to
 * carry almost everyone — the member display name is optional and is blank for anybody who signed
 * up rather than accepting an invitation, which is the whole reason the old name match failed (F01)
 * and why the picker offered people by the front of their email address. It is now what it was
 * meant to be: the last resort for an account with no name anywhere. A linked tag keeps the coach's
 * OWN word for them; this name is only what the picker and the sheet print beside the kind word.
 */
export async function getPracticeStaffPeople(
  teamId: string,
  orgId: string,
  staffTags: readonly Pick<RepTeamTag, 'id' | 'userId'>[],
): Promise<PracticeStaffPerson[]> {
  return staffPeopleFromMembers(await getTeamStaffPanelList(teamId, orgId), staffTags);
}

/**
 * Is this person on the team's staff right now? The one-row membership read — for the tag
 * routes' "link a word to a person" proof, which needs a yes/no and not every identity resolved.
 */
export async function isOnTeamStaff(orgId: string, teamId: string, userId: string): Promise<boolean> {
  return (await getActiveTeamMembership(orgId, teamId, userId)) != null;
}

/** The pure half: the memberships (already resolved) as people. */
export function staffPeopleFromMembers(
  members: readonly TeamStaffPanelMember[],
  staffTags: readonly Pick<RepTeamTag, 'id' | 'userId'>[],
): PracticeStaffPerson[] {
  const tagByUser = new Map<string, string>();
  for (const t of staffTags) if (t.userId) tagByUser.set(t.userId, t.id);
  return members.map(m => {
    const caps = resolveMembershipCapabilities(m);
    return {
      userId: m.userId,
      name: m.displayName?.trim() || m.email?.split('@')[0] || 'A coach',
      kind: staffKindLabel(caps, m.staffKind),
      kindWord: staffKindWord(caps, m.staffKind),
      canReadPlan: canViewSchedule(caps),
      tagId: tagByUser.get(m.userId) ?? null,
      email: m.email ?? null,
    };
  });
}

/** The wire shape — the same person without the address. */
export function stripStaffPersonForWire(p: PracticeStaffPerson): Omit<PracticeStaffPerson, 'email'> {
  return { userId: p.userId, name: p.name, kind: p.kind, kindWord: p.kindWord, canReadPlan: p.canReadPlan, tagId: p.tagId };
}
