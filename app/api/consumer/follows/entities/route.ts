/**
 * POST /api/consumer/follows/entities
 *
 * Signed-out (device) resolution for Phase-6 whole-tournament + organization follows — the
 * localStorage lists (lib/follow) have no server session, so the client POSTs them here and
 * gets back Home-ready cards. Public data only (statuses are computed from each event's own
 * public schedule; the LIST comes from the caller's device) → no auth, mirrors
 * /api/consumer/follows/feed. no-store.
 *
 * Body: { tournaments?: { orgSlug, tournamentSlug, name? }[], orgs?: { orgSlug, name? }[] }
 * Returns: { wholeEvent: TournamentFollowCard[], organizations: OrgFollowCard[] }
 */
import { NextResponse } from 'next/server';
import { getWholeEventFollowCards, getOrgFollowRollups } from '@/lib/entity-follow-status';
import { resolveFollowableOrgsBySlugs } from '@/lib/directory';
import { withObservability } from '@/lib/observability';

interface TournItem { orgSlug?: string; tournamentSlug?: string; name?: string; }
interface OrgItem { orgSlug?: string; name?: string; }

const MAX = 100; // sanity cap per type — mirrors the other device endpoints

export const POST = withObservability(async (req: Request) => {
  let body: { tournaments?: TournItem[]; orgs?: OrgItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const tournInputs = (Array.isArray(body.tournaments) ? body.tournaments.slice(0, MAX) : [])
    .filter((t): t is Required<Pick<TournItem, 'orgSlug' | 'tournamentSlug'>> & TournItem => !!t.orgSlug && !!t.tournamentSlug)
    .map(t => ({ orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug, tournamentName: t.name ?? '' }));

  const orgSlugs = (Array.isArray(body.orgs) ? body.orgs.slice(0, MAX) : [])
    .map(o => o.orgSlug)
    .filter((s): s is string => !!s);

  // Resolve device org slugs → followable orgs (drops any that went private/canceled).
  const resolvedOrgs = await resolveFollowableOrgsBySlugs(orgSlugs);

  const [wholeEvent, organizations] = await Promise.all([
    getWholeEventFollowCards(tournInputs),
    getOrgFollowRollups(resolvedOrgs),
  ]);

  return NextResponse.json({ wholeEvent, organizations }, { headers: { 'Cache-Control': 'no-store' } });
}, { route: '/api/consumer/follows/entities' });
