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
    if (t - loadedAt >= ttl && t - attemptedAt >= missGap) await refresh();
    else if (missed && t - attemptedAt >= missGap) await refresh();
    else if (inFlight) await inFlight;
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
  const res = await fetch(`${url}/rest/v1/org_custom_domains?select=full_name,status,org_id,organizations!inner(slug)`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`club hosts: ${res.status}`);
  const rows = (await res.json()) as { full_name: string; status: ClubDomainStatus; org_id: string; organizations: { slug: string } | { slug: string }[] | null }[];
  return rows.flatMap(r => {
    const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
    return org?.slug ? [{ host: r.full_name.toLowerCase(), orgId: r.org_id, slug: org.slug, status: r.status }] : [];
  });
}

/** The one cache of this bundle. */
export const clubHosts: ClubHostCache = createClubHostCache({ load: fetchClubHosts });

// ── What a path on a club's own host means ──────────────────────────────────────────────────────────────

/** The club's public sections (the same list the consumer chrome knows): the only reserved words that are NOT off-limits here. */
const PUBLIC_SECTIONS = new Set(['about', 'archives', 'league', 'news', 'register', 'results', 'rules', 'schedule', 'standings', 'teams', 'tryouts']);
/** Day-of and operator shells: never served on a club's own address, whatever their slug. */
const OPERATOR_SECTIONS = new Set(['admin', 'check-in', 'coaches', 'official', 'scorekeeper']);
/** API paths a club's own host must never reach: the signed-in operator and platform surfaces have no session here anyway. */
const BLOCKED_API = ['/api/admin', '/api/platform-admin', '/api/dev', '/api/billing', '/api/coaches'];

export type ClubHostRoute =
  | { kind: 'pass' } // static files, data routes the public pages call: left alone
  | { kind: 'rewrite'; to: string } // the club's own page, served from /{slug}{path}
  | { kind: 'redirect'; to: string } // the club's name typed in the path: drop it
  | { kind: 'notfound' }; // anything that is not the club's public face

const hasExtension = (pathname: string) => /\.[a-z0-9]{2,8}$/i.test(pathname.split('/').pop() ?? '');
/** The folders under /public. A file inside one is ours to serve as it is (a logo, an icon, the offline page's art). */
const PUBLIC_STATIC_DIRS = new Set(['brand', 'help', 'icons', 'marketing', 'stock-logos']);

export function routeClubHostPath(slug: string, pathname: string): ClubHostRoute {
  const path = pathname === '' ? '/' : pathname;
  const segs = path.split('/').filter(Boolean);
  const first = segs[0]?.toLowerCase() ?? '';

  // Static: the framework's files, a file at the root (robots.txt, favicon.ico, sw.js) or inside a /public folder. A path with an
  // extension deeper than that is a CLUB route that happens to have one (a tournament's manifest.webmanifest): it is rewritten.
  if (first === '_next') return { kind: 'pass' };
  if (hasExtension(path) && (segs.length === 1 || PUBLIC_STATIC_DIRS.has(first))) return { kind: 'pass' };
  if (first === 'api') return BLOCKED_API.some(p => path === p || path.startsWith(`${p}/`)) ? { kind: 'notfound' } : { kind: 'pass' };

  // The club's own name in the path (an unconverted link, an old bookmark): one hop to the same page without it.
  if (first === slug.toLowerCase()) {
    const rest = segs.slice(1).join('/');
    return { kind: 'redirect', to: rest ? `/${rest}` : '/' };
  }

  if (OPERATOR_SECTIONS.has(first)) return { kind: 'notfound' };
  // A reserved word is a top-level route of ours (auth, discover, coaches ...), never the club's, unless it is a public section.
  if (first && RESERVED_ORG_SLUGS.has(first) && !PUBLIC_SECTIONS.has(first)) return { kind: 'notfound' };
  // The club's own sections may not be reached through a tournament slug that spells an operator word (`/spring/admin`).
  if (segs.length >= 2 && OPERATOR_SECTIONS.has(segs[1].toLowerCase())) return { kind: 'notfound' };

  return { kind: 'rewrite', to: `/${slug}${path === '/' ? '' : path}` };
}
