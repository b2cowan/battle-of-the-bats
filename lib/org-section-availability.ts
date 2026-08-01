import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getOrgPublicSiteContent } from '@/lib/db';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { orgSectionsFor, type OrgSection } from '@/lib/org-public-sections';
import type { Organization } from '@/lib/types';

/**
 * lib/org-section-availability.ts — which section tabs an org actually has (Nav Unification Stage F).
 *
 * WHY EXISTENCE CHECKS RATHER THAN LIST FETCHES:
 * the org layout wraps EVERY route under `/{orgSlug}` — admin, coaches, scorekeeper, and every
 * tournament page — and it cannot tell them apart, because a Server Component has no pathname and
 * `proxy.ts` deliberately does NOT run on org public routes (its matcher covers the operator shells
 * and APIs only, which is exactly what keeps an anonymous public page free of session work). So
 * this runs on more routes than render the row, and the honest answer is to make it cheap rather
 * than to pretend we can skip it.
 *
 * The row only ever asks two yes/no questions, so these ask the DATABASE two yes/no questions —
 * `head: true` counts that transfer no row data. The obvious alternative, reusing `getLeagueSeasons`
 * + `getArchivesByOrg`, pulls every season and every archive row, and archive rows each carry a full
 * sealed-tournament JSON snapshot — fetched, mapped and thrown away to learn whether a count was
 * above zero.
 */

/** True when at least one row matches. `head: true` = a count, so no row data crosses the wire.
 *  Fails QUIET and closed: a hiccup here costs a tab, never the page. */
async function anyLeagueSeasonPublished(orgId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from('league_seasons')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .neq('status', 'draft'); // a draft season is not public — it must not put a League tab up
  if (error) {
    console.error('[org-sections] league availability check failed', error);
    return false;
  }
  return (count ?? 0) > 0;
}

async function anyArchive(orgId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from('tournament_archives')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);
  if (error) {
    console.error('[org-sections] archives availability check failed', error);
    return false;
  }
  return (count ?? 0) > 0;
}

/**
 * The section tabs this org should render, or fewer than two entries when there is nowhere to go.
 *
 * Gated on the public-site module (League/Club) per the /design ruling: on tournament tiers the only
 * possible entries are Home and Archives — a whole chrome layer for two words, on the tier whose
 * platform-plain org page is correct by design. Those tiers keep the Stage E crumb instead.
 */
export async function resolveOrgSections(org: Organization): Promise<OrgSection[]> {
  // A non-public org gets NO section row. Its org home and league pages already 404 for visitors,
  // so a row there would advertise sections whose links are dead — and `/{org}/archives` does NOT
  // check isPublic, so that page renders and would otherwise carry a row disclosing that a private
  // org has league seasons. The sibling public surfaces (app/[orgSlug]/page.tsx,
  // lib/public-league.ts) both apply this gate; this one has to as well.
  if (!org.isPublic) return [];
  if (!hasModuleEntitlement(org, 'module_public_site')) return [];

  const [league, archivesExist, siteContent] = await Promise.all([
    hasModuleEntitlement(org, 'module_house_league')
      ? anyLeagueSeasonPublished(org.id)
      : Promise.resolve(false),
    anyArchive(org.id),
    // The org's own "show archives link" switch. Its home page already hides the Archives CTA when
    // this is off, and a tab row contradicting the page it sits on is worse than no tab at all.
    getOrgPublicSiteContent(org.id).catch(() => null),
  ]);

  return orgSectionsFor({
    league,
    archives: archivesExist && siteContent?.showArchivesLink !== false,
  });
}
