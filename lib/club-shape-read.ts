/**
 * What the club RUNS — the server's read of its shape (`ClubShape`, lib/admin-kit-nav.ts), in ONE place.
 *
 * Two callers, one answer: `/api/admin/club-brief` (the brief's `shape`) and the admin layout, which hands the same
 * answer to `ClubBriefProvider` as its first-paint seed (navigation Phase 1 Part B, owner 2026-11-09, ask 1 = A). Before
 * that seed the sidebar drew the plan's guess and changed itself 5–20 seconds later, when the brief arrived: Programs
 * reordered, "Also on your plan" changed and the foot's Tournaments door appeared. The same fix Phase 0 made for the
 * tournament event (a server read handed to a provider), for the same reason: nothing in the sidebar may swap after the
 * first paint. The brief's COUNTS still arrive later — they decorate rows; they do not move them.
 *
 * Server only (service-role client). Never throws: a failed read answers with the plan's own facts and says so in
 * `error`, so the layout (every admin page's) can never be broken by it and the route can still report it.
 */
import { supabaseAdmin } from '@/lib/supabase-admin';
import { planCarriesModule, type EntitlementOrg } from '@/lib/module-entitlements';
import { orgRunsHouseLeague } from '@/lib/board-roles';
import type { ClubShape } from '@/lib/admin-kit-nav';

type ClubShapeRead = { shape: ClubShape; error: unknown };

export async function readClubShape(org: EntitlementOrg & { id: string }): Promise<ClubShapeRead> {
  try {
    const [runsHouseLeague, tournamentsRes] = await Promise.all([
      orgRunsHouseLeague(org),
      planCarriesModule(org, 'module_tournaments')
        ? supabaseAdmin.from('tournaments').select('id', { count: 'exact', head: true })
            .eq('org_id', org.id).neq('status', 'archived')
        : Promise.resolve({ count: 0, error: null }),
    ]);
    return {
      shape: { runsHouseLeague, hostsTournaments: (tournamentsRes.count ?? 0) > 0 },
      error: tournamentsRes.error,
    };
  } catch (error) {
    return { shape: { runsHouseLeague: false, hostsTournaments: false }, error };
  }
}
