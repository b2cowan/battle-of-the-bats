import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { orgSectionsFor, type OrgSection } from '@/lib/org-public-sections';
import type { Organization, OrgPublicSiteContent } from '@/lib/types';
import { clubTeamsAddress, isPublicClubSiteOpen } from './public-club-access';
import { anyListedTryout } from './club-tryouts';
import { tournamentToday } from './timezone';
import { normalizeHiddenSections, normalizeSectionOrder, shownByClub } from './club-site-sections';

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

/** How many teams the club lists — not archived (Club Tier Stage 4b-2a: the Teams tab's own question; an archived team's
 *  page still opens for old links, but it is not listed, so it puts no tab up). The editor's Teams row says the number
 *  (Stage 4c-1). Fails quiet and closed: 0. */
export async function countListedTeams(orgId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('rep_teams')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('is_archived', false);
  if (error) {
    console.error('[org-sections] teams availability check failed', error);
    return 0;
  }
  return count ?? 0;
}
export const anyListedTeam = async (orgId: string) => (await countListedTeams(orgId)) > 0;

/** How many sealed tournaments the club has (the Tournaments tab's question). Fails quiet: 0. */
export async function countArchives(orgId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('tournament_archives')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);
  if (error) {
    console.error('[org-sections] archives availability check failed', error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Does the club have a tournament of this kind, asked as a yes/no count (fails quiet and closed). A draft never counts;
 * an archived one counts only through its sealed record (countArchives).
 *   · listed — active or completed: every one is either current or finished on the Tournaments page;
 *   · current — running or coming: active, no champion crowned yet (a crowned event reads Finished), its last day (the end
 *     date, else the start date) today or later, or no dates yet. ⚠ The same rule as `clubTournamentParts`' current run (lib/club-site-home.ts), spelled as a filter: change
 *     one, change both.
 */
async function anyTournament(orgId: string, kind: 'listed' | 'current', today: string): Promise<boolean> {
  const query = supabaseAdmin
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);
  const { count, error } = kind === 'listed'
    ? await query.in('status', ['active', 'completed'])
    : await query.eq('status', 'active')
        .is('champions_crowned_at', null)
        .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today}),and(end_date.is.null,start_date.is.null)`);
  if (error) {
    console.error(`[org-sections] ${kind} tournament check failed`, error);
    return false;
  }
  return (count ?? 0) > 0;
}

/**
 * The Tournaments tab (Stage 4f, ruled 2026-10-25): the club shows Tournaments and the page has something to show.
 * While Past tournaments (its sub-option) shows too, that is any listed tournament — each is current or finished, and a
 * finished one is a past row (as its own site, or as its sealed record) — or any sealed record. With the sub-option off,
 * only a current or coming one. Nothing is asked of a club that hid Tournaments.
 */
async function tournamentsTabShows(orgId: string, today: string, hidden: readonly string[] | null | undefined): Promise<boolean> {
  if (!shownByClub('tournaments', hidden)) return false;
  if (!shownByClub('archives', hidden)) return anyTournament(orgId, 'current', today);
  const [listed, sealed] = await Promise.all([anyTournament(orgId, 'listed', today), countArchives(orgId)]);
  return listed || sealed > 0;
}

/**
 * The section tabs this org should render, or fewer than two entries when there is nowhere to go.
 *
 * Gated on the public-site module (League/Club) per the /design ruling: on tournament tiers the only
 * possible entries are Home and Tournaments — a whole chrome layer for two words, on the tier whose
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

  const withTeams = clubTeamsAddress(org) === 'teams-page';
  const [league, teams, tryouts, tournaments, siteContent] = await Promise.all([
    hasModuleEntitlement(org, 'module_house_league')
      ? anyLeagueSeasonPublished(org.id)
      : Promise.resolve(false),
    // The Teams tab (Stage 4b-2a): the plan carries rep teams (the same question the Teams page asks —
    // `clubTeamsAddress`) and the club lists at least one. A tab that opens an empty list is worse than no tab.
    withTeams ? anyListedTeam(org.id) : Promise.resolve(false),
    // The Tryouts tab (Stage 4b-2b, Ask 14): seasonal — while any listed team is open, not open yet, or finished in the
    // last four weeks (`tryoutsTabShows`, asked yes/no). Its address keeps working all year; only the tab leaves.
    withTeams ? anyListedTryout(org.id, tournamentToday()) : Promise.resolve(false),
    // The page refuses without the tournaments module (PAGE_MODULE.tournaments), so the tab needs it too.
    hasModuleEntitlement(org, 'module_tournaments')
      ? siteContentRead.then(c => tournamentsTabShows(org.id, tournamentToday(), c?.homeSectionsHidden))
      : Promise.resolve(false),
    siteContentRead,
  ]);

  // The club's own show/hide and order from its editor (Stage 4c-1): a section it hid has no tab (a tab contradicting
  // the page it sits on is worse than no tab at all), and the order sorts the rest. Tryouts has no switch of its own;
  // Tournaments asked the club's switches itself, above (Stage 4f: Past tournaments is its sub-option).
  const hidden = normalizeHiddenSections(siteContent?.homeSectionsHidden);
  return orgSectionsFor(
    {
      league: league && !hidden.includes('league'),
      teams: teams && !hidden.includes('teams'),
      tryouts,
      tournaments,
    },
    normalizeSectionOrder(siteContent?.homeSectionOrder),
  );
}
