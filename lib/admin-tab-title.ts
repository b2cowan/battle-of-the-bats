/**
 * THE ADMIN BROWSER TAB'S TITLE — "{page} - {tournament} - {organization} - FieldLogicHQ", built in one pure function so it
 * can be tested (`AdminTitleManager` sets it). The page name says what the page title says.
 *
 * ⚖ The tournament's name is added ONLY on a tournament's pages (Stage 13 fix-now 5, F-R2-2 / F-A2-9 / F-O5-8): the
 * last-chosen tournament stays chosen while a club admin works in house league, rep teams or the organization, and every
 * one of those tabs read "House league - Harbourtown Invitational 2026".
 */
import { isTournamentEventPath, SETTINGS_ACCESS_TITLE } from './admin-kit-nav.ts';
import { PLAN_BILLING_TITLE } from './plan-billing-title.ts';

const ROUTE_LABELS: Array<[RegExp, string]> = [
  [/\/admin\/onboarding$/, 'Onboarding'],
  [/\/admin\/dashboard$/, 'Admin Dashboard'],
  [/\/admin\/help(?:\/.*)?$/, 'Help'],
  // One name per page (Tournament admin redesign Stage 4): the tab says what the title says.
  [/\/admin\/org\/tournaments(?:\/.*)?$/, 'Tournaments'],
  [/\/admin\/org\/members(?:\/.*)?$/, 'Members'],
  [/\/admin\/org\/billing(?:\/.*)?$/, 'Billing'],
  [/\/admin\/org\/venues(?:\/.*)?$/, 'Venues'],
  [/\/admin\/org\/settings(?:\/.*)?$/, 'Organization settings'],
  [/\/admin\/org(?:\/)?$/, 'Organization'],
  [/\/admin\/tournaments\/preview\/[^/]+(?:\/.*)?$/, 'Preview Site'],
  // ⚖ Navigation Phase 2 Part B (2026-11-10): the strip names a tournament's page in the sidebar's words (E2), so the tab
  // says those words too — "Teams", not "Registrations"; "Public site", not "Tournament branding".
  [/\/admin\/tournaments\/dashboard$/, 'Dashboard'],
  [/\/admin\/tournaments\/manage(?:\/.*)?$/, 'Tournaments'],
  [/\/admin\/tournaments\/archives(?:\/.*)?$/, 'Tournaments'],
  [/\/admin\/tournaments\/venues(?:\/.*)?$/, 'Venues & facilities'],
  [/\/admin\/tournaments\/divisions(?:\/.*)?$/, 'Divisions'],
  [/\/admin\/tournaments\/registrations(?:\/.*)?$/, 'Teams'],
  [/\/admin\/tournaments\/schedule(?:\/.*)?$/, 'Schedule'],
  [/\/admin\/tournaments\/results(?:\/.*)?$/, 'Results'],
  [/\/admin\/tournaments\/check-in(?:\/.*)?$/, 'Check-in'],
  [/\/admin\/tournaments\/chat(?:\/.*)?$/, 'Chat'],
  [/\/admin\/tournaments\/rules(?:\/.*)?$/, 'Rules & resources'],
  [/\/admin\/tournaments\/communication(?:\/.*)?$/, 'Communications'],
  [/\/admin\/tournaments\/branding(?:\/.*)?$/, 'Public site'],
  [/\/admin\/tournaments\/summary(?:\/.*)?$/, 'Summary'],
  // Stage 6 (2026-10-07): the tab said "Admin" — and "Staff Kit" before that; one spelling, the title's.
  [/\/admin\/tournaments\/staff-kit(?:\/.*)?$/, 'Staff kit'],
  [/\/admin\/tournaments\/settings\/event(?:\/.*)?$/, 'Event settings'],
  [/\/admin\/tournaments\/settings\/notifications(?:\/.*)?$/, 'Your notifications'],
  // A Tournament plan's Settings & access is a place with tabs (Part B, E3 + P1): each tab says its own name.
  [/\/admin\/tournaments\/settings\/members\/audit(?:\/.*)?$/, 'Audit log'],
  [/\/admin\/tournaments\/settings\/members(?:\/.*)?$/, 'Members'],
  [/\/admin\/tournaments\/settings\/payouts(?:\/.*)?$/, 'Payouts'],
  [/\/admin\/tournaments\/settings\/pdf(?:\/.*)?$/, 'PDF settings'],
  [/\/admin\/tournaments\/settings\/web-address(?:\/.*)?$/, 'Web address'],
  [/\/admin\/tournaments\/settings\/subscription(?:\/.*)?$/, PLAN_BILLING_TITLE],
  [/\/admin\/tournaments\/settings(?:\/.*)?$/, SETTINGS_ACCESS_TITLE],
  [/\/admin\/tournaments(?:\/)?$/, 'Tournaments'],
  [/\/admin\/house-league(?:\/.*)?$/, 'House league'],
  [/\/admin\/rep-teams(?:\/.*)?$/, 'Rep teams'],
  [/\/admin\/accounting(?:\/.*)?$/, 'Accounting'],
  [/\/admin\/public-site(?:\/.*)?$/, 'Public site'],
  [/\/admin\/org\/notifications(?:\/.*)?$/, 'Organization notifications'],
  [/\/admin(?:\/)?$/, 'Admin'],
];

/** The page's name, as its title says it ("Admin" where no rule names it). */
function adminRouteLabel(pathname: string): string {
  return ROUTE_LABELS.find(([pattern]) => pattern.test(pathname))?.[1] ?? 'Admin';
}

/** A tournament address: `/{org}/admin/tournaments` and everything under it — never the club's other areas. The title manager
 *  keeps the tab's title on these (`AdminTitleManager`). */
export const isTournamentRoute = (pathname: string) => /\/admin\/tournaments(?:\/|$)/.test(pathname);

/** One of a tournament's OWN pages — a tournament address that is not the organization's (the list, Settings & access and its
 *  tabs, Plan & billing: `isTournamentOrgScreen`, navigation Phase 2 Part B, A10/Q6). Only these carry the event's name. */
export const isTournamentEventPage = (pathname: string) =>
  isTournamentRoute(pathname)
  && isTournamentEventPath(pathname, pathname.slice(0, pathname.indexOf('/admin/tournaments') + '/admin'.length));

export function adminTabTitle(p: {
  pathname: string;
  orgName?: string | null;
  tournamentName?: string | null;
  /** The people page's name for this org ("Members", or "Staff & access" in a one-team workspace). */
  membersLabel: string;
}): string {
  const routed = adminRouteLabel(p.pathname);
  const label = routed === 'Members' ? p.membersLabel : routed;
  return [
    label,
    isTournamentEventPage(p.pathname) ? p.tournamentName : null,
    p.orgName,
    'FieldLogicHQ',
  ].filter(Boolean).join(' - ');
}
