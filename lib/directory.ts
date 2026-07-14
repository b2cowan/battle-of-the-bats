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

export async function getDirectoryListings(params: DirectoryParams): Promise<DirectoryResult> {
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
  //    independent of the current sport/province/text/timeframe selection. ──
  let facetQuery = supabaseAdmin
    .from('tournaments')
    .select('sport, directory_province')
    .eq('list_in_directory', true)
    .in('status', ['active', 'completed']);
  if (canceledIds.length) facetQuery = facetQuery.not('org_id', 'in', `(${canceledIds.join(',')})`);
  const { data: facetRows, error: facetErr } = await facetQuery.limit(SCAN_CEILING);
  if (facetErr) throw facetErr;

  const sportIds = Array.from(new Set((facetRows ?? []).map(r => getSportPack(r.sport).id)));
  const sportFacets = sportIds
    .map(id => ({ id, label: getSportPack(id).label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const provinceCodes = Array.from(
    new Set((facetRows ?? []).map(r => r.directory_province).filter((c): c is string => isProvinceCode(c))),
  );
  const provinceFacets = provinceCodes
    .map(code => ({ code, name: provinceName(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const facets: DirectoryFacets = { sports: sportFacets, provinces: provinceFacets };

  // ── Hard-filtered fetch (SQL): opted-in + public + not-canceled, plus sport/province/date-range. ──
  let query = supabaseAdmin
    .from('tournaments')
    .select('id, name, slug, sport, status, start_date, end_date, directory_province, org_id, logo_url')
    .eq('list_in_directory', true)
    .in('status', ['active', 'completed']);
  if (canceledIds.length) query = query.not('org_id', 'in', `(${canceledIds.join(',')})`);
  if (sportParam) query = query.eq('sport', sportParam);
  if (provinceParam && isProvinceCode(provinceParam)) query = query.eq('directory_province', provinceParam);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) query = query.gte('start_date', dateFrom);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo))   query = query.lte('start_date', dateTo);

  const { data: rows, error: tErr } = await query.limit(SCAN_CEILING);
  if (tErr) throw tErr;

  const hardRows = rows ?? [];
  // No silent caps: surface + log when the scan ceiling is hit so missing rows aren't invisible.
  const capped = hardRows.length >= SCAN_CEILING || (facetRows?.length ?? 0) >= SCAN_CEILING;
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

  let query = supabaseAdmin
    .from('tournaments')
    .select('slug, org_id, created_at')
    .eq('list_in_directory', true)
    .in('status', ['active', 'completed']);
  if (canceledIds.length) query = query.not('org_id', 'in', `(${canceledIds.join(',')})`);
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
