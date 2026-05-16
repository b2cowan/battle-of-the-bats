import type { Tournament } from '@/lib/types';

export const PUBLIC_PAGE_OPTIONS = [
  { key: 'news', label: 'News' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'standings', label: 'Standings' },
  { key: 'teams', label: 'Teams' },
  { key: 'rules', label: 'Rules' },
  { key: 'register', label: 'Registration' },
] as const;

export type PublicPageKey = typeof PUBLIC_PAGE_OPTIONS[number]['key'];

const PUBLIC_PAGE_KEYS = new Set<PublicPageKey>(PUBLIC_PAGE_OPTIONS.map(page => page.key));

export function normalizeHiddenPublicPages(value: unknown): PublicPageKey[] {
  if (!Array.isArray(value)) return [];
  const hidden = new Set(value.filter((item): item is PublicPageKey => PUBLIC_PAGE_KEYS.has(item as PublicPageKey)));
  return PUBLIC_PAGE_OPTIONS.map(page => page.key).filter(key => hidden.has(key));
}

export function isPublicPageEnabled(tournament: Pick<Tournament, 'publicHiddenPages'> | null | undefined, key: PublicPageKey): boolean {
  return !normalizeHiddenPublicPages(tournament?.publicHiddenPages).includes(key);
}

export function visiblePublicPages(tournament: Pick<Tournament, 'publicHiddenPages'> | null | undefined) {
  const hidden = normalizeHiddenPublicPages(tournament?.publicHiddenPages);
  return PUBLIC_PAGE_OPTIONS.filter(page => !hidden.includes(page.key));
}
