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
import { getFollowedTeamsForUser } from '@/lib/fan-follows';
import { getFollowFeed } from '@/lib/follow-feed';
import { rollupFollowFeedByTournament, type ConsumerHomePayload } from '@/lib/home-following';
import { getCoachedRegistrationTeamIds } from '@/lib/basic-coach-teams';
import { reconcilePendingInvitesForUser, listPendingInvitesForUser } from '@/lib/invite-reconciliation';

const EMPTY: ConsumerHomePayload = {
  signedIn: false,
  pendingInvites: [],
  workspaces: [],
  lapsed: [],
  followCount: 0,
  following: { current: [], past: [] },
};

export const GET = withObservability(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json(EMPTY, { headers: { 'Cache-Control': 'no-store' } });

  // Reconcile pending invites onto this identity so a self-registered invitee's orphaned
  // invite surfaces on Home (mirrors the retired /home launchpad). Idempotent — safe on load.
  await reconcilePendingInvitesForUser({ id: user.id, email: user.email, emailConfirmedAt: user.email_confirmed_at });

  const [contexts, pendingInvites, follows, lapsed] = await Promise.all([
    getUserAccessContexts({ id: user.id, email: user.email }),
    listPendingInvitesForUser(user.id),
    getFollowedTeamsForUser(user.id),
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
    followCount: visibleFollows.length,
    following: rollupFollowFeedByTournament(feedEntries),
  };
  // Per-user, never shared: no-store is defense-in-depth beyond the SW's /api/ no-cache rule,
  // and matches every sibling consumer API (alert-prefs, follows, tournament-viewer).
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}, { route: '/api/consumer/home' });
