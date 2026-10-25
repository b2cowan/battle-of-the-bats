/**
 * Find's "Recent" — the last five club or person records this browser opened (Support console Stage 2, drawings state 2;
 * threat T8). Browser storage ONLY: it never leaves the browser and is cleared at sign-out (the account menu's console
 * sign-out and the console's sign-in page both call `clearConsoleRecent`), so a shared computer does not show the last
 * person's lookups. Every read and write is wrapped: a private window or blocked storage just means no Recent.
 *
 * Also the hand-off from Find's "All N in …" doors to a list: the words go through session storage, never the address
 * (an address would put them in the error catcher's logs, T6).
 */

export type RecentRecord = { kind: 'club' | 'person'; id: string; title: string; at: number };

const RECENT_KEY = 'flhq.console.recent.v1';
const LIST_SEARCH_KEY = 'flhq.console.list-search.v1';
const MAX = 5;

export function readConsoleRecent(): RecentRecord[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is RecentRecord =>
        !!r && typeof r === 'object' && (r.kind === 'club' || r.kind === 'person') && typeof r.id === 'string'
        && typeof r.title === 'string' && typeof r.at === 'number')
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function rememberConsoleRecent(record: Omit<RecentRecord, 'at'>): void {
  try {
    const next = [{ ...record, at: Date.now() }, ...readConsoleRecent().filter(r => !(r.kind === record.kind && r.id === record.id))];
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, MAX)));
  } catch {
    // No storage: no Recent. Nothing depends on it.
  }
}

export function clearConsoleRecent(): void {
  try {
    window.localStorage.removeItem(RECENT_KEY);
    window.sessionStorage.removeItem(LIST_SEARCH_KEY);
  } catch {
    // Nothing stored, or nothing reachable.
  }
}

/** Find's door into a list: the words wait in this tab's session storage for that list to pick up once. */
export function handListSearch(list: 'clubs' | 'people', words: string): void {
  try {
    window.sessionStorage.setItem(LIST_SEARCH_KEY, JSON.stringify({ list, words }));
  } catch {
    // The list opens unfiltered.
  }
}

/** The words Find handed this list, taken once (a reload does not filter again). */
export function takeListSearch(list: 'clubs' | 'people'): string | null {
  try {
    const raw = window.sessionStorage.getItem(LIST_SEARCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { list?: string; words?: unknown };
    if (parsed.list !== list || typeof parsed.words !== 'string') return null;
    window.sessionStorage.removeItem(LIST_SEARCH_KEY);
    return parsed.words;
  } catch {
    return null;
  }
}
