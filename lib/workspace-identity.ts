/**
 * THE WORKSPACE'S NAME, ADDRESS AND BIRTHDAY DATE — who may change them, and how long a name may be.
 * Settings in both workspaces, Session 2 (owner rulings A1, A3, A5, A6 and C1–C6, 2026-11-20; build prompt
 * docs/projects/active/SETTINGS_BOTH_WORKSPACES_BUILD_PROMPT.md § Session 2).
 *
 *  - A Premium coach renames the TEAM; the workspace follows as "{team} Coaches Portal" (A5) — one database function
 *    (`rename_team_workspace`, mig 517) does both, with the copies C1 ruled follow.
 *  - The Organization rows (Team name, Web address, When birthdays count from) are the workspace OWNER's; a head coach
 *    who is not the owner reads them (A3). The section itself is a standalone workspace's, head coach only.
 *  - The birthday cutoff applies to a club with teams to count AND to a standalone Premium workspace (A6). A Tournament
 *    plan has neither, so its card never appears.
 *
 * Pure (relative imports only), so a plain Node unit test reads it.
 */
import { hasModuleEntitlement } from './module-entitlements';
import { orgManagesOwnSeasons } from './season-doors';
import type { Organization } from './types';

/** One limit for both names a customer types here: the drawing's "19 / 40", the club's Settings' 40. */
export const NAME_MAX = 40;

/** The workspace's own name, as the product has always made it (team-checkout, provisioning). */
export function workspaceNameFor(teamName: string): string {
  return `${teamName} Coaches Portal`;
}

/** A typed name, trimmed and checked: the words of a refusal, or the name to save. */
export function cleanName(raw: unknown): { name: string } | { error: string } {
  if (typeof raw !== 'string') return { error: 'Enter a name.' };
  const name = raw.trim();
  if (!name) return { error: 'Enter a name.' };
  if (name.length > NAME_MAX) return { error: `A name can be at most ${NAME_MAX} characters.` };
  return { name };
}

/** May this person change the Organization rows (the team's name, the web address, the birthday date)? The workspace's
 *  owner, on a standalone Premium workspace — never a club's team (its club owns those). */
export function mayChangeWorkspaceIdentity(
  org: Pick<Organization, 'accountKind' | 'planId' | 'teamWorkspaceStatus'> | null | undefined,
  orgRole: string | null | undefined,
): boolean {
  return orgManagesOwnSeasons(org) && orgRole === 'owner';
}

/** "When birthdays count from" exists for an organization with teams to count: a club with rep teams or house league,
 *  or a standalone Premium workspace (A6). Not a Tournament plan. */
export function birthdayCutoffApplies(org: Parameters<typeof hasModuleEntitlement>[0] & Pick<Organization, 'accountKind' | 'planId' | 'teamWorkspaceStatus'>): boolean {
  return hasModuleEntitlement(org, 'module_rep_teams')
    || hasModuleEntitlement(org, 'module_house_league')
    || orgManagesOwnSeasons(org);
}
