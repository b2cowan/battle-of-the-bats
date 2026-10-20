import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { orgSectionsFor, type OrgSection } from '@/lib/org-public-sections';
import type { Organization, OrgPublicSiteContent } from '@/lib/types';
import { clubTeamsAddress, isPublicClubSiteOpen } from './public-club-access';

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
 * The row only ever asks yes/no questions, so these ask the DATABASE yes/no questions —
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

/** Does the club list a team — one that is not archived (Club Tier Stage 4b-2a: the Teams tab's own question; an archived
 *  team's page still opens for old links, but it is not listed, so it puts no tab up). */
export async function anyListedTeam(orgId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from('rep_teams')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('is_archived', false);
  if (error) {
    console.error('[org-sections] teams availability check failed', error);
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
 * platform-plain org page is correct by design. Those tiers get no tabs: the club's name in its bar is the way home.
 */
export async function resolveOrgSections(
  org: Organization,
  /** The club's site content, which the org layout reads for the club's bar and footer too (one read, two uses) —
   *  passed as the read in flight, so it runs beside the two checks below rather than before them. */
  siteContentRead: Promise<OrgPublicSiteContent | null>,
): Promise<OrgSection[]> {
  // A club whose public site is closed (switch off, or cancelled) gets NO section row: every club page refuses
  // (Club Tier Stage 4a, lib/public-club-access.ts), so a row would advertise dead links.
  if (!isPublicClubSiteOpen(org)) return [];
  if (!hasModuleEntitlement(org, 'module_public_site')) return [];

  const [league, teams, archivesExist, siteContent] = await Promise.all([
    hasModuleEntitlement(org, 'module_house_league')
      ? anyLeagueSeasonPublished(org.id)
      : Promise.resolve(false),
    // The Teams tab (Stage 4b-2a): the plan carries rep teams (the same question the Teams page asks —
    // `clubTeamsAddress`) and the club lists at least one. A tab that opens an empty list is worse than no tab.
    clubTeamsAddress(org) === 'teams-page' ? anyListedTeam(org.id) : Promise.resolve(false),
    anyArchive(org.id),
    siteContentRead,
  ]);

  // The club's own "show past tournaments" switch: its home already hides that section when it is off, and a tab
  // contradicting the page it sits on is worse than no tab at all.
  return orgSectionsFor({
    league,
    teams,
    archives: archivesExist && siteContent?.showArchivesLink !== false,
  });
}
