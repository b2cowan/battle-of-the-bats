/**
 * An issue's title as a sentence (Support console Stage 5, Part 5; drawing C: "TypeError on the Registrations page").
 *
 * The stored title is `${errorName} @ ${route}` — a whole address with its ids (`TypeError @ /[orgSlug]/admin/house-league/
 * seasons/[seasonId]/registrations`). Support reads the error's name and the page in words; the exact route stays in its own
 * column and in the issue's band, in the data face. Pure, so it is unit-tested and shared by the list and the record.
 *
 * Only a title in the platform's own `name @ route` shape is reworded. Anything else (a title a caller wrote by hand, a
 * title with no route) is shown exactly as stored — a sentence built from a guess would be a worse lie than the address.
 */

const TITLE_SHAPE = /^(.+?) @ (\/\S*)$/;
const LOOKS_LIKE_AN_ID = /^(?:\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** "house-league" -> "House league". */
function words(segment: string): string {
  const spaced = decodeURIComponent(segment).replace(/[-_]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The page (or call) a route names, in words: its last segment that is a name rather than a parameter (`[seasonId]`) or an
 * id. Null when the route has none (the site's front page).
 */
export function routeInWords(route: string): { kind: 'page' | 'call'; name: string } | null {
  const path = route.split(/[?#]/)[0];
  const segments = path.split('/').filter(Boolean);
  const isCall = segments[0] === 'api';
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    if (/^\[.*\]$/.test(s) || LOOKS_LIKE_AN_ID.test(s)) continue;
    if (s === 'api') break;
    try {
      return { kind: isCall ? 'call' : 'page', name: words(s) };
    } catch {
      return null; // a malformed %-escape: leave the stored title as it is
    }
  }
  return null;
}

/**
 * "TypeError on the Registrations page" / "Error in the Teams call". `title` is the stored title; `errorName` and `route`
 * are the group's own columns (used when the title is empty). Falls back to the stored title, then the name, then
 * "Untitled error".
 */
export function issueSentence(title: string | null | undefined, errorName?: string | null, route?: string | null): string {
  const stored = (title ?? '').trim();
  const shaped = TITLE_SHAPE.exec(stored);
  const name = (shaped?.[1] ?? (stored ? '' : errorName ?? '')).replace(/\s*\(returned\)\s*$/, '').trim();
  const where = shaped?.[2] ?? (stored ? '' : route ?? '');
  if (name && where) {
    const place = routeInWords(where);
    if (place) return `${name} ${place.kind === 'page' ? 'on' : 'in'} the ${place.name} ${place.kind}`;
  }
  return stored || errorName?.trim() || 'Untitled error';
}
