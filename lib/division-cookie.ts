const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// NOTE: Cookie key intentionally kept as fl_agpref_* (not renamed to fl_divpref_*)
// to preserve existing browser sessions. Changing the key would silently reset
// every user's stored division preference.
function key(orgSlug: string) {
  return `fl_agpref_${orgSlug}`;
}

export function getDivisionPref(orgSlug: string): string | null {
  if (typeof document === 'undefined') return null;
  const k = key(orgSlug);
  const match = document.cookie.split('; ').find(r => r.startsWith(`${k}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

export function setDivisionPref(orgSlug: string, divisionName: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${key(orgSlug)}=${encodeURIComponent(divisionName)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}
