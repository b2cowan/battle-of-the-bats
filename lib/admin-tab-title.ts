/**
 * THE ADMIN BROWSER TAB'S TITLE — "{page} - {tournament} - {organization} - FieldLogicHQ", built in one pure function so it
 * can be tested (`AdminTitleManager` sets it). The page name says what the page title says.
 *
 * ⚖ The tournament's name is added ONLY on a tournament's pages (Stage 13 fix-now 5, F-R2-2 / F-A2-9 / F-O5-8): the
 * last-chosen tournament stays chosen while a club admin works in house league, rep teams or the organization, and every
 * one of those tabs read "House league - Harbourtown Invitational 2026".
 */

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
  [/\/admin\/tournaments\/dashboard$/, 'Tournament dashboard'],
  [/\/admin\/tournaments\/manage(?:\/.*)?$/, 'Tournaments'],
  [/\/admin\/tournaments\/venues(?:\/.*)?$/, 'Venues'],
  [/\/admin\/tournaments\/divisions(?:\/.*)?$/, 'Divisions'],
  [/\/admin\/tournaments\/registrations(?:\/.*)?$/, 'Registrations'],
  [/\/admin\/tournaments\/schedule(?:\/.*)?$/, 'Schedule'],
  [/\/admin\/tournaments\/results(?:\/.*)?$/, 'Results'],
  [/\/admin\/tournaments\/rules(?:\/.*)?$/, 'Rules & resources'],
  [/\/admin\/tournaments\/communication(?:\/.*)?$/, 'Communication'],
  [/\/admin\/tournaments\/branding(?:\/.*)?$/, 'Tournament branding'],
  [/\/admin\/tournaments\/summary(?:\/.*)?$/, 'Summary'],
  // Stage 6 (2026-10-07): the tab said "Admin" — and "Staff Kit" before that; one spelling, the title's.
  [/\/admin\/tournaments\/staff-kit(?:\/.*)?$/, 'Staff kit'],
  [/\/admin\/tournaments\/settings\/event(?:\/.*)?$/, 'Event settings'],
  [/\/admin\/tournaments\/settings(?:\/.*)?$/, 'Tournament settings'],
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

/** A tournament's own pages: `/{org}/admin/tournaments` and everything under it — never the club's other areas. */
export const isTournamentRoute = (pathname: string) => /\/admin\/tournaments(?:\/|$)/.test(pathname);

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
    isTournamentRoute(p.pathname) ? p.tournamentName : null,
    p.orgName,
    'FieldLogicHQ',
  ].filter(Boolean).join(' - ');
}
