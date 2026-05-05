const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function key(orgSlug: string) {
  return `fl_agpref_${orgSlug}`;
}

export function getAgPref(orgSlug: string): string | null {
  if (typeof document === 'undefined') return null;
  const k = key(orgSlug);
  const match = document.cookie.split('; ').find(r => r.startsWith(`${k}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

export function setAgPref(orgSlug: string, ageGroupName: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${key(orgSlug)}=${encodeURIComponent(ageGroupName)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}
