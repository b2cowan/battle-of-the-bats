import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { DEMO_ORG_SLUGS, isDemoOrgSlug } from './demo-org';

/**
 * lib/demo-org-server.ts — server-side resolution of the demo-org allow-list to row ids.
 *
 * `lib/demo-org.ts` holds the hardcoded truth, keyed by slug. Plenty of server code, though,
 * only ever holds an org *id* — `notify({ orgId })` is the important one — so this module
 * resolves the allow-list to ids once and answers `isDemoOrgId()` cheaply thereafter.
 *
 * ── Fail-closed, and why the cache is shaped the way it is ──────────────────────────────────
 *
 * The dangerous failure is answering "no, not a demo org" when it actually is one, because that
 * is what would let a notification out of the sandbox. So:
 *
 *   • The cache is only ever populated from a SUCCESSFUL query. A failed lookup is not cached
 *     as an empty set — it is left unresolved so the next call retries.
 *   • `isDemoOrgId()` THROWS if it cannot resolve the list. Callers in a send path must treat an
 *     exception as "do not send" — which is exactly what a `try` around a dispatch already does.
 *     Silently returning `false` here would be the one bug that defeats the whole guarantee.
 *   • There is a synchronous companion, `isKnownDemoOrgId()`, for callers that genuinely cannot
 *     await. It answers only from an already-warm cache and is deliberately named so a reader
 *     can see it is the weaker check.
 *
 * The cache never expires: the allow-list is a compile-time constant and org ids do not change.
 * A reseed reuses the same org row precisely so this stays true.
 */

let demoOrgIds: Set<string> | null = null;
/** slug → row id, from the same successful query that populates `demoOrgIds`. */
let demoIdBySlug: Map<string, string> = new Map();
let inFlight: Promise<Set<string>> | null = null;

async function loadDemoOrgIds(): Promise<Set<string>> {
  if (demoOrgIds) return demoOrgIds;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    if (DEMO_ORG_SLUGS.length === 0) {
      // Genuinely complete: there is nothing to resolve, so this IS the final answer.
      demoIdBySlug = new Map();
      demoOrgIds = new Set();
      return demoOrgIds;
    }
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('id, slug')
      .in('slug', DEMO_ORG_SLUGS as string[]);
    if (error) throw new Error(`demo-org lookup failed: ${error.message}`);

    const resolved = new Map((data ?? []).map(row => [row.slug as string, row.id as string]));

    // ⚠ Only a COMPLETE resolution is cached. A partial one — some allow-listed org not seeded in
    // this environment yet — is returned but NOT remembered, so the next call re-queries.
    //
    // The first build cached it, and an empty Set is truthy, so a single call made before the seed
    // ran would pin "there are no demo orgs" for the life of the process. That is not a cosmetic
    // staleness: `isDemoOrgId()` is what `notify()` and the fan-alert pipeline ask before sending,
    // so a warm server that once observed a pre-seed state would answer "not a demo org" forever
    // and let the sandbox's scores email real people. Caught by the 2026-08-03 adversarial review.
    //
    // The cost of not caching a partial result is one cheap indexed query per call in an
    // environment where the sandbox does not exist — which is the environment where nothing is
    // asking. Once every allow-listed org is seeded, this caches exactly as before.
    if (resolved.size === DEMO_ORG_SLUGS.length) {
      demoIdBySlug = resolved;
      demoOrgIds = new Set(resolved.values());
      return demoOrgIds;
    }
    demoIdBySlug = resolved;
    return new Set(resolved.values());
  })().finally(() => { inFlight = null; });

  return inFlight;
}

/**
 * The row id of a demo org, or null when that org has not been seeded in this environment.
 *
 * Rides the same cache as `isDemoOrgId`, so after the first call it costs nothing. The door
 * (`/see-it-live`) uses it to answer one question before it signs anybody in: **is there actually
 * a sandbox here?** — so a prospect arriving in an environment where the seed has never run is
 * sent back to the marketing page rather than dropped on a 404.
 *
 * @throws if the allow-list cannot be resolved (same fail-closed contract as `isDemoOrgId`).
 */
export async function demoOrgIdForSlug(slug: string): Promise<string | null> {
  if (!isDemoOrgSlug(slug)) return null;
  await loadDemoOrgIds();
  return demoIdBySlug.get(slug.trim().toLowerCase()) ?? null;
}

/**
 * Is this org id a sandbox org?
 *
 * @throws if the allow-list cannot be resolved. Callers on a send/write path must let that
 *         propagate (or catch it and refuse) — never treat a failure as "not a demo org".
 */
export async function isDemoOrgId(orgId: string | null | undefined): Promise<boolean> {
  if (!orgId) return false;
  const ids = await loadDemoOrgIds();
  return ids.has(orgId);
}

/**
 * The weaker, synchronous check: true only when the cache is already warm AND this id is in it.
 * Use only where awaiting is impossible; prefer `isDemoOrgId`.
 */
export function isKnownDemoOrgId(orgId: string | null | undefined): boolean {
  if (!orgId || !demoOrgIds) return false;
  return demoOrgIds.has(orgId);
}

/** Warm the cache. Cheap to call; safe to call repeatedly. */
export async function primeDemoOrgIds(): Promise<void> {
  await loadDemoOrgIds();
}

/**
 * Every seeded demo org's row id, or an empty list if the lookup fails.
 *
 * The ONE place that deliberately swallows the fail-closed contract, because its callers are
 * cosmetic: keeping the sandbox out of our own metrics and out of error alerting. A failed lookup
 * there should leave the numbers slightly wrong for one request, not take down the platform
 * overview. Never use this on a write or send path — use `isDemoOrgId`, and let it throw.
 */
export async function listDemoOrgIdsQuietly(): Promise<string[]> {
  try {
    return [...(await loadDemoOrgIds())];
  } catch {
    return [];
  }
}

/** Resolve an org id to its slug when (and only when) it is a demo org. */
export async function demoOrgSlugForId(orgId: string): Promise<string | null> {
  if (!(await isDemoOrgId(orgId))) return null;
  const { data } = await supabaseAdmin.from('organizations').select('slug').eq('id', orgId).maybeSingle();
  return data?.slug && isDemoOrgSlug(data.slug) ? (data.slug as string) : null;
}

/** Test seam: forget the cached ids so the next call re-queries. */
export function resetDemoOrgIdCacheForTests(): void {
  demoOrgIds = null;
  demoIdBySlug = new Map();
  inFlight = null;
}
