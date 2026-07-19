import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSportPack } from '@/lib/sports';
import { provinceName, isProvinceCode } from '@/lib/canadian-provinces';
import { tournamentToday } from '@/lib/timezone';

// Shared data layer for the public tournament discovery directory (/discover).
// Called by BOTH the public API route (client-driven filtering/pagination) and the
// server-rendered /discover page (SEO / first paint). server-only so the service-role
// client can never be bundled into the browser.

export const DIRECTORY_PAGE_SIZE = 24;
export const DIRECTORY_MAX_LIMIT = 48;
const SCAN_CEILING = 2000;

// Unified public search (Home search bar → /api/public/search). Min query length before we
// run a scan (a 1-char query is expensive and useless), and the per-type instant-result cap.
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_RESULT_LIMIT = 8;

export type Timeframe = 'upcoming' | 'live' | 'completed';

export interface DirectoryItem {
  id: string;
  tournamentName: string;
  tournamentSlug: string;
  orgName: string;
  orgSlug: string;
  logoUrl: string | null;
  sport: string;
  sportLabel: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  timeframe: Timeframe;
  province: string | null;
  provinceName: string | null;
  divisionCount: number;
  teamCount: number;
  href: string;
}

export interface DirectoryFacets {
  sports: { id: string; label: string }[];
  provinces: { code: string; name: string }[];
}

export interface DirectoryResult {
  items: DirectoryItem[];
  total: number;
  hasMore: boolean;
  capped: boolean;
  facets: DirectoryFacets;
}

export interface DirectoryParams {
  q?: string;
  sport?: string;
  province?: string;
  timeframe?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

// ── Unified search result shapes (Home: Tournaments / Organizations / Teams) ────
export interface OrgDirectoryResult {
  id: string;
  orgName: string;
  orgSlug: string;
  logoUrl: string | null;
  href: string;
}

export interface TeamDirectoryResult {
  id: string;
  teamName: string;
  tournamentName: string;
  tournamentSlug: string;
  orgName: string;
  orgSlug: string;
  logoUrl: string | null;
  href: string;
}

export type SearchEntityType = 'tournament' | 'org' | 'team';

export interface DirectorySearchResults {
  q: string;
  // `total` = full JS-match count for that type; `items` is capped at SEARCH_RESULT_LIMIT.
  // A `total` above `items.length` means the type was capped (surfaced in the UI, not hidden).
  tournaments: { items: DirectoryItem[]; total: number };
  organizations: { items: OrgDirectoryResult[]; total: number };
  teams: { items: TeamDirectoryResult[]; total: number };
}

/** Derive the fan-facing timeframe from db status + dates (YYYY-MM-DD strings sort lexically). */
export function computeTimeframe(status: string, startDate: string | null, endDate: string | null, today: string): Timeframe {
  if (status === 'completed') return 'completed';
  if (endDate && endDate < today) return 'completed';
  if (!startDate) return 'upcoming';        // undated → treat as upcoming
  if (startDate > today) return 'upcoming';
  if (!endDate || endDate >= today) return 'live';
  return 'completed';
}

/** Ids of orgs whose public pages are blocked (canceled) — never link to them. */
async function getCanceledOrgIds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('subscription_status', 'canceled');
  if (error) throw error;
  return (data ?? []).map(o => o.id);
}

// Minimal fluent shape used to apply the shared filter — kept separate from the (deeply generic)
// supabase builder type so composing it never triggers TS's deep-instantiation guard.
interface ListedTournamentFilter {
  eq(column: string, value: string | boolean): ListedTournamentFilter;
  in(column: string, values: readonly string[]): ListedTournamentFilter;
  not(column: string, operator: string, value: string): ListedTournamentFilter;
}

/**
 * The single definition of "a publicly-listed tournament row": opted into the directory, in a
 * public status, and not owned by a canceled org. Every directory/search/sitemap query composes
 * this so the visibility rule can never drift between them. The unconstrained `T` preserves each
 * caller's own `.select()` row typing; the internal cast just borrows the fluent filter methods.
 */
function scopeListedTournaments<T>(query: T, canceledIds: string[]): T {
  let q = query as unknown as ListedTournamentFilter;
  q = q.eq('list_in_directory', true).in('status', ['active', 'completed']);
  if (canceledIds.length) q = q.not('org_id', 'in', `(${canceledIds.join(',')})`);
  return q as unknown as T;
}

export async function getDirectoryListings(
  params: DirectoryParams,
  // Search reuses this for its tournament channel but throws the facets away — let it skip that scan.
  opts: { includeFacets?: boolean } = {},
): Promise<DirectoryResult> {
  const includeFacets = opts.includeFacets ?? true;
  const limit  = Math.min(Math.max(params.limit ?? DIRECTORY_PAGE_SIZE, 1), DIRECTORY_MAX_LIMIT);
  const offset = Math.max(params.offset ?? 0, 0);

  const q = (params.q ?? '').trim().toLowerCase().slice(0, 80);
  const sportParam = (params.sport ?? '').trim().toLowerCase();
  const provinceParam = (params.province ?? '').trim().toUpperCase();
  const tfParam = (params.timeframe ?? 'current').trim().toLowerCase();
  const dateFrom = (params.dateFrom ?? '').trim();
  const dateTo   = (params.dateTo ?? '').trim();

  // America/Toronto date (not UTC) so timeframe bucketing doesn't roll over mid-evening Eastern.
  const today = tournamentToday();

  const canceledIds = await getCanceledOrgIds();

  // ── Facets (stable dropdown options): every opted-in + public tournament's sport/province,
  //    independent of the current sport/province/text/timeframe selection. Skipped for search. ──
  let facetRows: { sport: string; directory_province: string | null }[] = [];
  if (includeFacets) {
    const facetQuery = scopeListedTournaments(
      supabaseAdmin.from('tournaments').select('sport, directory_province'),
      canceledIds,
    );
    const { data, error: facetErr } = await facetQuery.limit(SCAN_CEILING);
    if (facetErr) throw facetErr;
    facetRows = data ?? [];
  }

  const sportIds = Array.from(new Set(facetRows.map(r => getSportPack(r.sport).id)));
  const sportFacets = sportIds
    .map(id => ({ id, label: getSportPack(id).label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const provinceCodes = Array.from(
    new Set(facetRows.map(r => r.directory_province).filter((c): c is string => isProvinceCode(c))),
  );
  const provinceFacets = provinceCodes
    .map(code => ({ code, name: provinceName(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const facets: DirectoryFacets = { sports: sportFacets, provinces: provinceFacets };

  // ── Hard-filtered fetch (SQL): opted-in + public + not-canceled, plus sport/province/date-range. ──
  let query = scopeListedTournaments(
    supabaseAdmin
      .from('tournaments')
      .select('id, name, slug, sport, status, start_date, end_date, directory_province, org_id, logo_url'),
    canceledIds,
  );
  if (sportParam) query = query.eq('sport', sportParam);
  if (provinceParam && isProvinceCode(provinceParam)) query = query.eq('directory_province', provinceParam);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) query = query.gte('start_date', dateFrom);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo))   query = query.lte('start_date', dateTo);

  const { data: rows, error: tErr } = await query.limit(SCAN_CEILING);
  if (tErr) throw tErr;

  const hardRows = rows ?? [];
  // No silent caps: surface + log when the scan ceiling is hit so missing rows aren't invisible.
  const capped = hardRows.length >= SCAN_CEILING || facetRows.length >= SCAN_CEILING;
  if (capped) console.warn(`[directory] scan ceiling ${SCAN_CEILING} reached — directory results may be incomplete.`);
  if (hardRows.length === 0) {
    return { items: [], total: 0, hasMore: false, capped, facets };
  }

  // Resolve org display info (and confirm the org is live — drops any row whose org vanished).
  const orgIds = Array.from(new Set(hardRows.map(r => r.org_id)));
  const { data: orgRows, error: orgErr } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, logo_url')
    .in('id', orgIds);
  if (orgErr) throw orgErr;
  const orgMap = new Map((orgRows ?? []).map(o => [o.id, o]));

  // Enrich + JS filters (text search + timeframe) — keeps user text out of any SQL filter string.
  const tfFilter: Timeframe | 'all' | 'current' =
    tfParam === 'upcoming' || tfParam === 'live' || tfParam === 'completed' ? tfParam
    : tfParam === 'all' ? 'all'
    : 'current'; // default → upcoming + live (handled below)

  let enriched = hardRows
    .map(r => {
      const org = orgMap.get(r.org_id);
      if (!org) return null; // org missing → would be a dead link
      const timeframe = computeTimeframe(r.status, r.start_date, r.end_date, today);
      return {
        id: r.id,
        tournamentName: r.name as string,
        tournamentSlug: r.slug as string,
        orgName: org.name as string,
        orgSlug: org.slug as string,
        // Prefer the tournament's own event logo (matches the rest of the app, where
        // tournaments.logo_url overrides the org logo); fall back to the org logo, then
        // the client renders a lettered monogram when both are null.
        logoUrl: ((r.logo_url ?? org.logo_url) ?? null) as string | null,
        sport: getSportPack(r.sport).id,
        sportLabel: getSportPack(r.sport).label,
        startDate: r.start_date as string | null,
        endDate: r.end_date as string | null,
        status: r.status as string,
        timeframe,
        province: (r.directory_province ?? null) as string | null,
        provinceName: provinceName(r.directory_province),
        href: `/${org.slug}/${r.slug}`,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (q) {
    enriched = enriched.filter(
      t => t.tournamentName.toLowerCase().includes(q) || t.orgName.toLowerCase().includes(q),
    );
  }
  if (tfFilter === 'current') {
    enriched = enriched.filter(t => t.timeframe !== 'completed');
  } else if (tfFilter !== 'all') {
    enriched = enriched.filter(t => t.timeframe === tfFilter);
  }

  // Sort: completed view = most-recent first; everything else = soonest first.
  const completedView = tfFilter === 'completed';
  enriched.sort((a, b) => {
    const av = a.startDate ?? (completedView ? '0000-00-00' : '9999-12-31');
    const bv = b.startDate ?? (completedView ? '0000-00-00' : '9999-12-31');
    return completedView ? bv.localeCompare(av) : av.localeCompare(bv);
  });

  const total = enriched.length;
  const page = enriched.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  // Division/team counts only for the page in view (bounds the count queries to `limit` rows).
  const pageIds = page.map(t => t.id);
  let divisionCount: Record<string, number> = {};
  let teamCount: Record<string, number> = {};
  if (pageIds.length) {
    const [{ data: divRows, error: dErr }, { data: teamRows, error: teErr }] = await Promise.all([
      supabaseAdmin.from('divisions').select('tournament_id').in('tournament_id', pageIds),
      supabaseAdmin.from('teams').select('tournament_id').in('tournament_id', pageIds).eq('status', 'accepted'),
    ]);
    if (dErr) throw dErr;
    if (teErr) throw teErr;
    divisionCount = (divRows ?? []).reduce<Record<string, number>>((m, r) => { m[r.tournament_id] = (m[r.tournament_id] ?? 0) + 1; return m; }, {});
    teamCount = (teamRows ?? []).reduce<Record<string, number>>((m, r) => { m[r.tournament_id] = (m[r.tournament_id] ?? 0) + 1; return m; }, {});
  }

  const items: DirectoryItem[] = page.map(t => ({
    ...t,
    divisionCount: divisionCount[t.id] ?? 0,
    teamCount: teamCount[t.id] ?? 0,
  }));

  return { items, total, hasMore, capped, facets };
}

/**
 * Every opted-in, publicly-visible, non-canceled tournament URL — for the sitemap.
 * Lean (no filters/pagination/counts): just enough to enumerate crawlable pages.
 */
export async function getDirectorySitemapEntries(): Promise<{ href: string; lastModified?: string }[]> {
  const canceledIds = await getCanceledOrgIds();

  const query = scopeListedTournaments(
    supabaseAdmin.from('tournaments').select('slug, org_id, created_at'),
    canceledIds,
  );
  const { data: rows, error } = await query.limit(SCAN_CEILING);
  if (error) throw error;
  const tournaments = rows ?? [];
  if (!tournaments.length) return [];

  const orgIds = Array.from(new Set(tournaments.map(r => r.org_id)));
  const { data: orgRows, error: orgErr } = await supabaseAdmin
    .from('organizations')
    .select('id, slug')
    .in('id', orgIds);
  if (orgErr) throw orgErr;
  const orgSlug = new Map((orgRows ?? []).map(o => [o.id, o.slug]));

  const out: { href: string; lastModified?: string }[] = [];
  for (const t of tournaments) {
    const slug = orgSlug.get(t.org_id);
    if (!slug) continue; // org vanished → skip (would be a dead URL)
    out.push({
      href: `/${slug}/${t.slug}`,
      ...(t.created_at ? { lastModified: String(t.created_at) } : {}),
    });
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────────
// Unified public search — Organizations & Teams
//
// Both mirror getDirectoryListings' posture: a SQL hard-filter narrows to publicly-
// reachable rows, then the user's text is matched in JS (never interpolated into a SQL
// filter string — the project-wide "keep user text out of SQL" rule). Anonymous/public:
// no auth, no PII (org/team NAME + event only — never coach email, roster, or contacts).
// ────────────────────────────────────────────────────────────────────────────────

/** Case-insensitive substring, then prefix-matches-first ranking helper. */
// Match a row when the needle is a substring of ANY of its `fields` (each matched independently
// so a query can never bridge two fields across a join char); rank prefix-matches on the first
// field ahead of the rest, then alphabetically. Lowercases each field once.
function rankByNeedle<T>(rows: T[], fields: (r: T) => string[], needle: string): T[] {
  return rows
    .map(r => ({ r, fs: fields(r).map(f => f.toLowerCase()) }))
    .filter(x => x.fs.some(f => f.includes(needle)))
    .sort((a, b) => {
      const ap = a.fs[0].startsWith(needle) ? 0 : 1;
      const bp = b.fs[0].startsWith(needle) ? 0 : 1;
      return ap - bp || a.fs[0].localeCompare(b.fs[0]);
    })
    .map(x => x.r);
}

/**
 * Organizations matching `q`, scoped to real, publicly-reachable orgs so no result is a
 * dead link. Reuses the existing organizations.is_discoverable flag (owner-settled 2026-07-18
 * — the fan-search discoverability gate is the SAME switch as the coach→org link picker,
 * not a second flag). The predicate mirrors the /{orgSlug} page's own visibility gate
 * (notFound on !is_public || canceled) plus isNormalLinkableOrg (excludes team-workspace
 * shadow orgs), so a match always resolves to a live org page.
 */
export async function searchOrgsForDirectory(
  q: string,
  limit = SEARCH_RESULT_LIMIT,
): Promise<{ items: OrgDirectoryResult[]; total: number }> {
  const needle = (q ?? '').trim().toLowerCase().slice(0, 80);
  if (needle.length < SEARCH_MIN_CHARS) return { items: [], total: 0 };

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, logo_url')
    .eq('is_discoverable', true)
    .eq('is_public', true)
    .neq('account_kind', 'team_workspace')
    .neq('plan_id', 'team')
    .neq('subscription_status', 'canceled')
    .limit(SCAN_CEILING);
  if (error) throw error;

  const rows = data ?? [];
  if (rows.length >= SCAN_CEILING) {
    console.warn(`[search:orgs] scan ceiling ${SCAN_CEILING} reached — org search may be incomplete.`);
  }

  const matched = rankByNeedle(rows, o => [o.name, o.slug], needle)
    .map(o => ({
      id: o.id as string,
      orgName: o.name as string,
      orgSlug: o.slug as string,
      logoUrl: (o.logo_url ?? null) as string | null,
      href: `/${o.slug}`,
    }));

  return { items: matched.slice(0, limit), total: matched.length };
}

/**
 * Teams matching `q`, scoped STRICTLY to accepted teams inside directory-listed, public,
 * non-canceled tournaments (mirrors getDirectoryListings' hard filter). A team in an
 * unlisted/private event is never searchable — the privacy posture that keeps rosters out
 * of public search. Each result presents as "team in {tournament}" and deep-links to that
 * tournament's public team page.
 */
export async function searchTeamsForDirectory(
  q: string,
  limit = SEARCH_RESULT_LIMIT,
): Promise<{ items: TeamDirectoryResult[]; total: number }> {
  const needle = (q ?? '').trim().toLowerCase().slice(0, 80);
  if (needle.length < SEARCH_MIN_CHARS) return { items: [], total: 0 };

  // 1) The directory-listed tournaments that scope the team search (same gate as Browse).
  const canceledIds = await getCanceledOrgIds();
  const tq = scopeListedTournaments(
    supabaseAdmin.from('tournaments').select('id, name, slug, org_id, logo_url'),
    canceledIds,
  );
  const { data: tRows, error: tErr } = await tq.limit(SCAN_CEILING);
  if (tErr) throw tErr;
  const listed = tRows ?? [];
  if (!listed.length) return { items: [], total: 0 };

  // 2+3) Resolve org context AND fetch accepted teams in parallel — the teams query is scoped by
  // the listed tournament ids (known from step 1), and any team whose org vanished is dropped by the
  // tournamentCtx lookup below, so the org resolution isn't a prerequisite for the teams fetch.
  const orgIds = Array.from(new Set(listed.map(t => t.org_id)));
  const listedIds = listed.map(t => t.id);
  const [orgRes, teamRes] = await Promise.all([
    supabaseAdmin.from('organizations').select('id, name, slug, logo_url').in('id', orgIds),
    supabaseAdmin.from('teams').select('id, name, tournament_id').in('tournament_id', listedIds).eq('status', 'accepted').limit(SCAN_CEILING),
  ]);
  if (orgRes.error) throw orgRes.error;
  if (teamRes.error) throw teamRes.error;
  const orgMap = new Map((orgRes.data ?? []).map(o => [o.id, o]));

  const tournamentCtx = new Map<
    string,
    { name: string; slug: string; orgName: string; orgSlug: string; logoUrl: string | null }
  >();
  for (const t of listed) {
    const org = orgMap.get(t.org_id);
    if (!org) continue; // org vanished → its team pages would be dead links, so drop it
    tournamentCtx.set(t.id, {
      name: t.name as string,
      slug: t.slug as string,
      orgName: org.name as string,
      orgSlug: org.slug as string,
      logoUrl: ((t.logo_url ?? org.logo_url) ?? null) as string | null,
    });
  }

  const teams = teamRes.data ?? [];
  if (teams.length >= SCAN_CEILING) {
    console.warn(`[search:teams] scan ceiling ${SCAN_CEILING} reached — team search may be incomplete.`);
  }

  const matched = rankByNeedle(teams, t => [t.name as string], needle)
    .map(t => {
      const ctx = tournamentCtx.get(t.tournament_id);
      if (!ctx) return null;
      return {
        id: t.id as string,
        teamName: t.name as string,
        tournamentName: ctx.name,
        tournamentSlug: ctx.slug,
        orgName: ctx.orgName,
        orgSlug: ctx.orgSlug,
        logoUrl: ctx.logoUrl,
        href: `/${ctx.orgSlug}/${ctx.slug}/teams/${t.id}`,
      };
    })
    .filter((x): x is TeamDirectoryResult => x !== null);

  return { items: matched.slice(0, limit), total: matched.length };
}

/** Parse the `types=` param (comma list) → the set of entity types to search; default = all three. */
function parseSearchTypes(raw?: string): Set<SearchEntityType> {
  const all: SearchEntityType[] = ['tournament', 'org', 'team'];
  if (!raw) return new Set(all);
  const wanted = raw.split(',').map(s => s.trim().toLowerCase());
  const picked = all.filter(t => wanted.includes(t));
  return new Set(picked.length ? picked : all);
}

/**
 * The unified public search — one call fans out to all requested entity types on a single
 * lifecycle. Returns empty for a sub-threshold query so the client and server agree on when
 * a scan is worth running. Tournaments reuse getDirectoryListings verbatim (timeframe 'all'
 * so a completed event is still findable by name).
 */
export async function searchDirectory(params: {
  q: string;
  types?: string;
}): Promise<DirectorySearchResults> {
  const q = (params.q ?? '').trim().slice(0, 80);
  const empty: DirectorySearchResults = {
    q,
    tournaments: { items: [], total: 0 },
    organizations: { items: [], total: 0 },
    teams: { items: [], total: 0 },
  };
  if (q.length < SEARCH_MIN_CHARS) return empty;

  const types = parseSearchTypes(params.types);

  const [tournaments, organizations, teams] = await Promise.all([
    types.has('tournament')
      ? getDirectoryListings({ q, timeframe: 'all', limit: SEARCH_RESULT_LIMIT }, { includeFacets: false }).then(r => ({
          items: r.items,
          total: r.total,
        }))
      : Promise.resolve({ items: [] as DirectoryItem[], total: 0 }),
    types.has('org') ? searchOrgsForDirectory(q, SEARCH_RESULT_LIMIT) : Promise.resolve({ items: [], total: 0 }),
    types.has('team') ? searchTeamsForDirectory(q, SEARCH_RESULT_LIMIT) : Promise.resolve({ items: [], total: 0 }),
  ]);

  return { q, tournaments, organizations, teams };
}
