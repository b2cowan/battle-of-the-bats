import { hasModuleEntitlement } from './module-entitlements';
import { isOrgBillingSuspended } from './org-billing-access';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import type { Capability } from './roles';
import type { Organization } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ONE RULE FOR A CLUB'S PUBLIC PAGES (Club Tier Stage 4a; Ask 5 ruled 2026-10-19).
 *
 * The one question every public club page and route asks BEFORE it renders: does the club exist, is it not cancelled,
 * is its site on (`organizations.is_public`, the owner's switch), and does its plan carry what this page shows? Before
 * 4a only the home and the league pages asked it; the team page, the tryout pages, the sign-up form and its submit, the
 * team calendar and the archives each asked part of it or none (F06, F07).
 *
 * Pure, so the rule is unit-tested; the server door (`requirePublicClubPage` / `resolvePublicClub`) is
 * `lib/public-club-page.ts`. ⚠ Tournament pages never ask it — the site switch does not gate them
 * (BUSINESS_DECISIONS 2026-07-22), and a guard keeps it that way.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Which kind of club page is asking. `teams` covers the team page, its calendar and every tryout address. */
export type PublicClubPage = 'home' | 'teams' | 'league' | 'archives';

/**
 * What each page needs the plan to carry. The home needs nothing beyond the switch: a tournament-only org without the
 * public-site module keeps its basic home (the home itself picks its layout from the plan). Archives are sealed
 * tournaments, which every plan carries.
 */
const PAGE_MODULE: Record<PublicClubPage, Capability | null> = {
  home: null,
  teams: 'module_rep_teams',
  league: 'module_house_league',
  archives: 'module_tournaments',
};

export type PublicClubAccessOrg = Pick<Organization,
  'isPublic' | 'subscriptionStatus' | 'planId' | 'enabledAddons' | 'freeFloor' | 'accountKind'>;

/**
 * Is the club's public site open at all: the owner's switch on, and the club not cancelled. `past_due` stays open (the
 * billing rail's rule, `isOrgBillingSuspended`).
 */
export function isPublicClubSiteOpen(org: Pick<Organization, 'isPublic' | 'subscriptionStatus'>): boolean {
  return org.isPublic !== false && !isOrgBillingSuspended(org);
}

/**
 * `no-club` — no such club. `site-closed` — the switch is off or the club is cancelled. `not-in-plan` — the site is
 * open but the plan does not carry this page. `null` — render.
 */
export type PublicClubRefusal = 'no-club' | 'site-closed' | 'not-in-plan';

/**
 * What `/{org}/teams` is (Club Tier Stage 4b-2a, Ask 9A). For a club whose plan carries a public site AND rep teams it is
 * the club's Teams page (which then asks the one rule like any club page — a closed site is the refusal). For any other
 * org (a tournament-only org, a League-plan club, a standalone coaches-portal team) it stays the shortcut it was: it
 * forwards into the running tournament's teams, because printed tournament links and QR codes carry that address, and
 * with none running it is the club's "not found" (lib/club-shortcut.ts). The Teams tab asks this too, so the tab and the
 * page cannot disagree.
 */
export function clubTeamsAddress(org: PublicClubAccessOrg): 'teams-page' | 'shortcut' {
  if (isTeamWorkspaceOrg(org)) return 'shortcut';
  return hasModuleEntitlement(org, 'module_public_site') && hasModuleEntitlement(org, 'module_rep_teams')
    ? 'teams-page'
    : 'shortcut';
}

export function publicClubRefusal(org: PublicClubAccessOrg | null, page: PublicClubPage): PublicClubRefusal | null {
  if (!org) return 'no-club';
  if (!isPublicClubSiteOpen(org)) return 'site-closed';
  // A standalone Coaches-Portal team (the `team` plan) carries its rep team PER TEAM (team_entitlements), never through
  // the plan's modules — its team page and feed stay up, and the schedule on them is gated per team downstream
  // (getPublicTeamSchedule → isFamilyLayerEnabled), exactly as before 4a.
  if (page === 'teams' && isTeamWorkspaceOrg(org)) return null;
  const needs = PAGE_MODULE[page];
  if (needs && !hasModuleEntitlement(org, needs)) return 'not-in-plan';
  return null;
}
