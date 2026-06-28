export const COACHES_HOME_PATH = '/coaches';
export const COACHES_JOIN_PATH = '/coaches/join';
export const COACHES_START_PATH = '/coaches/start';
export const COACHES_TOURNAMENTS_PATH = '/coaches/tournaments';
export const COACHES_TEAMS_PATH = '/coaches/teams';
/** Org-less Basic coach team home (identity-resolved by `basic_coach_teams.id`).
 *  Distinct from the Premium workspace list at COACHES_TEAMS_PATH (`/coaches/teams`). */
export const COACHES_TEAM_PATH = '/coaches/team';
export const COACHES_CLAIM_PATH = '/coaches/claim';
export const COACHES_CHECKOUT_COMPLETE_PATH = '/coaches/checkout/complete';
export const COACHES_HELP_PATH = '/coaches/help';

/** A standalone Premium workspace org is always named `"{teamName} Coaches Portal"`
 *  (see team-checkout/provisioning). Surfacing that raw name next to portal chrome that
 *  already says "Coaches Portal" stutters — strip the suffix for display so the user sees
 *  just their team. Falls back to the original if stripping leaves nothing. */
export function teamWorkspaceDisplayName(orgName: string | null | undefined): string {
  const name = (orgName ?? '').trim();
  const stripped = name.replace(/\s*Coaches Portal\s*$/i, '').trim();
  return stripped || name;
}

/** Build the path to a single org-less Basic coach team home. */
export function coachTeamPath(basicCoachTeamId: string): string {
  return `${COACHES_TEAM_PATH}/${basicCoachTeamId}`;
}

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/**
 * Authenticated tournament coach-portal routes that render inside `CoachPortalShell`
 * (and therefore suppress the global marketing top nav + footer). The signup /
 * marketing surfaces — `/coaches/join`, `/coaches/start`, `/coaches/claim`,
 * `/coaches/checkout` — are intentionally excluded: they keep the marketing chrome
 * and the shell passes their children through untouched. `/coaches/help` IS included so the
 * marketing nav + footer are suppressed — but `CoachPortalShell` renders it as a FOCUSED
 * full-page guide (no rail / bottom-nav), matching how admin help renders without the admin
 * sidebar. Help must never collide with the global top bar nor keep an app side nav.
 */
export function isCoachPortalShellPath(pathname: string): boolean {
  return (
    pathname === COACHES_HOME_PATH ||
    pathname === COACHES_HELP_PATH ||
    pathname === COACHES_TOURNAMENTS_PATH ||
    pathname.startsWith(`${COACHES_TOURNAMENTS_PATH}/`) ||
    pathname === COACHES_TEAMS_PATH ||
    pathname.startsWith(`${COACHES_TEAMS_PATH}/`) ||
    pathname === COACHES_TEAM_PATH ||
    pathname.startsWith(`${COACHES_TEAM_PATH}/`)
  );
}

function formatUrl(pathname: string, search: string, hash: string) {
  return `${pathname}${search}${hash}`;
}

export function rewriteLegacyCoachPortalPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return value;

  let url: URL;
  try {
    url = new URL(value, 'https://fieldlogichq.local');
  } catch {
    return value;
  }

  const { pathname, search, hash } = url;

  if (pathname === '/my') return formatUrl('/coaches', search, hash);
  if (pathname === '/my/join') return formatUrl(COACHES_JOIN_PATH, search, hash);
  if (pathname === '/my/registrations') return formatUrl(COACHES_TOURNAMENTS_PATH, search, hash);
  if (pathname.startsWith('/my/registrations/')) {
    return formatUrl(pathname.replace('/my/registrations', COACHES_TOURNAMENTS_PATH), search, hash);
  }

  if (pathname === '/team') return formatUrl(COACHES_START_PATH, search, hash);
  if (pathname === '/team/checkout/complete') return formatUrl(COACHES_CHECKOUT_COMPLETE_PATH, search, hash);
  if (pathname.startsWith('/team/claim/')) {
    return formatUrl(pathname.replace('/team/claim', COACHES_CLAIM_PATH), search, hash);
  }

  return value;
}

export function normalizeCoachPortalNext(
  value: string | null | undefined,
  fallback = COACHES_TOURNAMENTS_PATH,
): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return rewriteLegacyCoachPortalPath(value);
}

export function pathWithSearchParams(
  pathname: string,
  searchParams: SearchParamsRecord,
  options: { normalizeNext?: boolean } = {},
) {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach(item => {
        next.append(key, options.normalizeNext && key === 'next' ? normalizeCoachPortalNext(item) : item);
      });
      continue;
    }

    if (typeof value === 'string') {
      next.set(key, options.normalizeNext && key === 'next' ? normalizeCoachPortalNext(value) : value);
    }
  }

  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}
