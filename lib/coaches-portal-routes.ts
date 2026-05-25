export const COACHES_JOIN_PATH = '/coaches/join';
export const COACHES_START_PATH = '/coaches/start';
export const COACHES_TOURNAMENTS_PATH = '/coaches/tournaments';
export const COACHES_CLAIM_PATH = '/coaches/claim';
export const COACHES_CHECKOUT_COMPLETE_PATH = '/coaches/checkout/complete';

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

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
