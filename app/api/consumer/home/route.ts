/**
 * GET /api/consumer/home
 *
 * Unified Home personalization, client-fetched (Phase 1). The /discover SSR shell stays
 * 100% anon-safe — it never branches on user identity — and ALL per-account data (pending
 * invites, workspaces, following, lapsed workspaces) rides this one authed call instead.
 * This is the FP-2 viewer-identity fix pattern: no per-user data is ever SSR'd into
 * cacheable HTML, and the SW's blanket `/api/` no-cache rule covers this route.
 *
 * Signed-out callers get an empty payload; the Home client then renders device-local
 * follows itself (localStorage has no server session to resolve them from).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import { getUserAccessContexts, getLapsedWorkspacesForUser } from '@/lib/user-contexts';
import { getFollowedTeamsForUser, getFollowedTournamentsForUser, getFollowedOrgsForUser } from '@/lib/fan-follows';
import { getFollowFeed } from '@/lib/follow-feed';
import { rollupFollowFeedByTournament, mergeWholeEventIntoRollup, type ConsumerHomePayload } from '@/lib/home-following';
import { getWholeEventFollowCards, getOrgFollowRollups } from '@/lib/entity-follow-status';
import { getCoachedRegistrationTeamIds } from '@/lib/basic-coach-teams';
import { reconcilePendingInvitesForUser, listPendingInvitesForUser } from '@/lib/invite-reconciliation';

const EMPTY: ConsumerHomePayload = {
  signedIn: false,
  pendingInvites: [],
  workspaces: [],
  lapsed: [],
  followCount: 0,
  following: { current: [], past: [] },
  organizations: [],
};

export const GET = withObservability(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json(EMPTY, { headers: { 'Cache-Control': 'no-store' } });

  // Reconcile pending invites onto this identity so a self-registered invitee's orphaned
  // invite surfaces on Home (mirrors the retired /home launchpad). Idempotent — safe on load.
  await reconcilePendingInvitesForUser({ id: user.id, email: user.email, emailConfirmedAt: user.email_confirmed_at });

  const [contexts, pendingInvites, follows, followedTournaments, followedOrgs, lapsed] = await Promise.all([
    getUserAccessContexts({ id: user.id, email: user.email }),
    listPendingInvitesForUser(user.id),
    getFollowedTeamsForUser(user.id),
    getFollowedTournamentsForUser(user.id),
    getFollowedOrgsForUser(user.id),
    getLapsedWorkspacesForUser(user.id),
  ]);

  // Dedupe (§3c): a team you COACH must not also render as a fan "Following" card — role wins.
  // Only pay the basic-coach registration scan when the user actually has a Basic-coach context
  // (Premium coaching is a different id namespace and never collides with a team follow).
  let visibleFollows = follows;
  if (contexts.some(c => c.kind === 'coaches_basic')) {
    const coachedTeamIds = await getCoachedRegistrationTeamIds({ userId: user.id, email: user.email });
    if (coachedTeamIds.size > 0) {
      visibleFollows = follows.filter(f => !coachedTeamIds.has(f.teamId));
    }
  }

  const feedEntries = visibleFollows.length > 0
    ? await getFollowFeed(
        visibleFollows.map(f => ({
          teamId: f.teamId,
          teamName: f.teamName,
          orgSlug: f.orgSlug,
          tournamentSlug: f.tournamentSlug,
        })),
      )
    : [];

  const teamRollup = rollupFollowFeedByTournament(feedEntries);

  // F6 dedupe — the ORG-follow rule only: "your own admin org shows as a workspace card, never a
  // follow card", so drop org follows for orgs the user staffs. A WHOLE-EVENT follow is a distinct,
  // deliberate fan action (follow THIS specific event), so it is NOT dropped for staffed orgs —
  // it shows on Home + All following consistently, and Scores absorbs it via reason precedence
  // (a staffed tournament renders as a Staff tile, not a duplicate).
  const staffedOrgSlugs = new Set(contexts.filter(c => c.kind !== 'fan' && c.orgSlug).map(c => c.orgSlug!));

  // Pre-filter whole-event follows against team-follow keys BEFORE resolving their status (F6: a team
  // follow wins the card) so a tournament that's both team- and whole-event-followed isn't fetched twice.
  const teamKeys = new Set([...teamRollup.current, ...teamRollup.past].map(c => c.key));
  const wholeEventInputs = followedTournaments
    .filter(t => !teamKeys.has(`${t.orgSlug}/${t.tournamentSlug}`))
    .map(t => ({ orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug, tournamentName: t.tournamentName }));
  const orgInputs = followedOrgs
    .filter(o => !staffedOrgSlugs.has(o.orgSlug))
    .map(o => ({ orgSlug: o.orgSlug, orgId: o.orgId, orgName: o.orgName, logoUrl: o.logoUrl }));

  // The two rollups are independent — resolve concurrently.
  const [wholeEventCards, organizations] = await Promise.all([
    getWholeEventFollowCards(wholeEventInputs),
    getOrgFollowRollups(orgInputs),
  ]);
  const following = mergeWholeEventIntoRollup(teamRollup, wholeEventCards);

  const payload: ConsumerHomePayload = {
    signedIn: true,
    pendingInvites: pendingInvites.map(i => ({
      memberId: i.memberId,
      orgSlug: i.orgSlug,
      orgName: i.orgName,
      role: i.role,
    })),
    workspaces: contexts.filter(c => c.kind !== 'fan'),
    lapsed,
    // Raw follow count (post coach-dedupe) — carried alongside the enriched cards so the client
    // can tell "follows nothing" apart from "follows teams whose game info dropped out" (a followed
    // team's tournament unpublished/canceled → getFollowFeed legitimately returns no card for it).
    followCount: visibleFollows.length + followedTournaments.length,
    following,
    organizations,
  };
  // Per-user, never shared: no-store is defense-in-depth beyond the SW's /api/ no-cache rule,
  // and matches every sibling consumer API (alert-prefs, follows, tournament-viewer).
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}, { route: '/api/consumer/home' });
