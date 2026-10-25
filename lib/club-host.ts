/**
 * A CLUB'S OWN ADDRESS, AT THE DOOR (Club Tier Stage 4e, Part 4a): which club a host belongs to, and what a path on that
 * host means. Used by `proxy.ts` for every request to a host that is not ours; also by the page layer, which asks the same
 * cache whether the club has its own address (the forward, the links handed out).
 *
 * No `server-only` and no SDK, so the proxy bundle can load it and a plain Node test can pin it.
 *
 * ⚖ NEVER a database read per request. The whole table is a few hundred rows at the very most (one per club that has its own
 * address), so each server instance reads all of it at most once every few minutes and answers from memory. Servers are
 * ephemeral and the proxy and page bundles each hold their own copy, so staleness is bounded by the time-to-live alone:
 * a club that connects or stops is served or dropped within `TTL_MS`. A host nobody knows is looked for again, but never
 * more often than `MISS_GAP_MS`, so a club that just went live is served within seconds without a crawler of unknown hosts
 * turning into a read per request.
 */
import { bareHost } from './own-hosts';
import { RESERVED_ORG_SLUGS } from './reserved-slugs';
import type { ClubDomainStatus } from './club-domain';

export interface ClubHostEntry {
  host: string;
  orgId: string;
  slug: string;
  status: ClubDomainStatus;
}

/** How long a read of the whole table is trusted. */
export const CLUB_HOST_TTL_MS = 3 * 60 * 1000;
/** The least time between two reads when a host was not found (a club that just connected is picked up within this). */
export const CLUB_HOST_MISS_GAP_MS = 15 * 1000;

export type ClubHostLookup = ClubHostEntry | null | 'unavailable';

export interface ClubHostCache {
  /** The club for this host; null when none; `unavailable` only when the table could not be read and nothing is remembered. */
  lookup(host: string | null | undefined): Promise<ClubHostLookup>;
  /** The club's own host by its slug (for the page layer: does this club have its own address, and which?). */
  forSlug(slug: string): Promise<ClubHostEntry | null | 'unavailable'>;
}

export function createClubHostCache(deps: {
  load: () => Promise<ClubHostEntry[]>;
  now?: () => number;
  ttlMs?: number;
  missGapMs?: number;
}): ClubHostCache {
  const now = deps.now ?? (() => Date.now());
  const ttl = deps.ttlMs ?? CLUB_HOST_TTL_MS;
  const missGap = deps.missGapMs ?? CLUB_HOST_MISS_GAP_MS;

  let byHost = new Map<string, ClubHostEntry>();
  let bySlug = new Map<string, ClubHostEntry>();
  let loadedAt = -Infinity; // the last SUCCESSFUL read
  let attemptedAt = -Infinity; // the last read of any kind
  let hasData = false;
  let inFlight: Promise<void> | null = null;

  function refresh(): Promise<void> {
    if (inFlight) return inFlight;
    attemptedAt = now();
    inFlight = deps
      .load()
      .then(rows => {
        byHost = new Map(rows.map(r => [r.host, r]));
        bySlug = new Map(rows.map(r => [r.slug, r]));
        loadedAt = now();
        hasData = true;
      })
      .catch(() => {
        // Keep what we remember: a stale answer is better than taking every club's address down for a blip.
      })
      .finally(() => { inFlight = null; });
    return inFlight;
  }

  async function ensure(missed: boolean): Promise<void> {
    const t = now();
    if (t - loadedAt >= ttl && t - attemptedAt >= missGap) {
      // Stale. With something remembered, answer from it and refresh in the background: a slow table read must never stall a
      // page. Only a cold cache (nothing remembered) waits for the first read.
      const reading = refresh();
      if (!hasData) await reading;
      return;
    }
    if (missed && t - attemptedAt >= missGap) { await refresh(); return; }
    if (!hasData && inFlight) await inFlight;
  }

  return {
    async lookup(host) {
      const h = bareHost(host);
      if (!h) return null;
      await ensure(false);
      let hit = byHost.get(h);
      if (!hit && hasData) {
        await ensure(true);
        hit = byHost.get(h);
      }
      if (hit) return hit;
      return hasData ? null : 'unavailable';
    },
    async forSlug(slug) {
      await ensure(false);
      const hit = bySlug.get(slug);
      if (hit) return hit;
      return hasData ? null : 'unavailable';
    },
  };
}

/** Read every row through the REST door with the service key: no client library, so the proxy bundle stays light. */
export async function fetchClubHosts(): Promise<ClubHostEntry[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('club hosts: Supabase is not configured');
  type Row = { full_name: string; status: ClubDomainStatus; org_id: string; organizations: { slug: string } | { slug: string }[] | null };
  const rows: Row[] = [];
  // PostgREST answers at most 1000 rows a request: read in pages until one comes back short, so a growing table never silently
  // drops the clubs past the cap. Each page has its own deadline: a hung read must not hold every page of the site.
  for (let from = 0; from < 20_000; from += 1000) {
    const res = await fetch(`${url}/rest/v1/org_custom_domains?select=full_name,status,org_id,organizations!inner(slug)&order=full_name`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Range-Unit': 'items', Range: `${from}-${from + 999}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error(`club hosts: ${res.status}`);
    const page = (await res.json()) as Row[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows.flatMap(r => {
    const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
    return org?.slug ? [{ host: r.full_name.toLowerCase(), orgId: r.org_id, slug: org.slug, status: r.status }] : [];
  });
}

/** The one cache of this bundle. */
export const clubHosts: ClubHostCache = createClubHostCache({ load: fetchClubHosts });

// ── What a path on a club's own host means ──────────────────────────────────────────────────────────────

/** The club's public sections (the same list the consumer chrome knows): the only reserved words that are NOT off-limits here. */
const PUBLIC_SECTIONS = new Set(['about', 'archives', 'league', 'news', 'register', 'results', 'rules', 'schedule', 'standings', 'teams', 'tournaments', 'tryouts']);
/** Day-of and operator shells: never served on a club's own address, whatever their slug. */
const OPERATOR_SECTIONS = new Set(['admin', 'check-in', 'coaches', 'official', 'scorekeeper']);
/**
 * The ONLY API paths a club's own host forwards: the public pages' own data and forms, the registration a visitor files, the
 * public follow and feedback doors, and the two sign-up calls a registration makes. Everything else is a 404 (an ALLOW-list:
 * a new operator or signed-in API is closed here by default). A club's host has no session, but "no session" is a fact about
 * cookies today, not a gate.
 */
const ALLOWED_API = [
  '/api/public', '/api/register', '/api/registrations', '/api/league', '/api/events', '/api/calendar', '/api/client',
  '/api/feedback', '/api/consumer', '/api/auth/coach-signup', '/api/auth/resend-verification',
];

export type ClubHostRoute =
  | { kind: 'pass' } // static files, data routes the public pages call: left alone
  | { kind: 'rewrite'; to: string } // the club's own page, served from /{slug}{path}
  | { kind: 'redirect'; to: string } // the club's name typed in the path: drop it
  | { kind: 'notfound' }; // anything that is not the club's public face

const hasExtension = (pathname: string) => /\.[a-z0-9]{2,8}$/i.test(pathname.split('/').pop() ?? '');
/** The folders under /public. A file inside one is ours to serve as it is (a logo, an icon, the offline page's art). */
const PUBLIC_STATIC_DIRS = new Set(['brand', 'help', 'icons', 'marketing', 'stock-logos']);

export function routeClubHostPath(slug: string, pathname: string): ClubHostRoute {
  const original = pathname === '' ? '/' : pathname;
  // Every DECISION is made on the decoded, lower-cased path: Next decodes a path before it matches a route, so `/%61dmin` is
  // `/admin` to the router and must be to this check too. An undecodable path, an encoded slash or a backslash is never a page.
  let decoded: string;
  try { decoded = decodeURIComponent(original); } catch { return { kind: 'notfound' }; }
  if (/%2f|%5c/i.test(original) || decoded.includes('\\') || /%2f|%5c/i.test(decoded)) return { kind: 'notfound' };
  const path = decoded.toLowerCase();
  const segs = path.split('/').filter(Boolean);
  const first = segs[0] ?? '';

  // Static: the framework's files, a file at the root (robots.txt, favicon.ico, sw.js) or inside a /public folder. A path with an
  // extension deeper than that is a CLUB route that happens to have one (a tournament's manifest.webmanifest): it is rewritten.
  if (first === '_next') return { kind: 'pass' };
  if (hasExtension(path) && (segs.length === 1 || PUBLIC_STATIC_DIRS.has(first))) return { kind: 'pass' };
  if (first === 'api') return ALLOWED_API.some(p => path === p || path.startsWith(`${p}/`)) ? { kind: 'pass' } : { kind: 'notfound' };

  // The club's own name in the path (an unconverted link, an old bookmark): one hop to the same page without it.
  if (first === slug.toLowerCase()) {
    const rest = original.split('/').filter(Boolean).slice(1).join('/');
    return { kind: 'redirect', to: rest ? `/${rest}` : '/' };
  }

  if (OPERATOR_SECTIONS.has(first)) return { kind: 'notfound' };
  // A reserved word is a top-level route of ours (auth, discover, coaches ...), never the club's, unless it is a public section.
  if (first && RESERVED_ORG_SLUGS.has(first) && !PUBLIC_SECTIONS.has(first)) return { kind: 'notfound' };
  // The club's own sections may not be reached through a tournament slug that spells an operator word (`/spring/admin`).
  if (segs.length >= 2 && OPERATOR_SECTIONS.has(segs[1])) return { kind: 'notfound' };

  // The decisions are made; the page is asked for by the path as it came (a slug's own case and encodings are the page's).
  return { kind: 'rewrite', to: `/${slug}${original === '/' ? '' : original}` };
}
