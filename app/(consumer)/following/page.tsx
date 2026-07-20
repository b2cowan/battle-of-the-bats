import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';
import { getFollowedTeamsForUser, getFollowedTournamentsForUser, getFollowedOrgsForUser } from '@/lib/fan-follows';
import { getFollowFeed } from '@/lib/follow-feed';
import { getWholeEventFollowCards, getOrgFollowRollups } from '@/lib/entity-follow-status';
import FollowingList from '@/components/consumer/FollowingList';

// Auth-dependent (account follows) + device-personal — dynamic, never indexed.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Following',
  robots: { index: false, follow: false },
};

export default async function FollowingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const signedIn = !!user?.email;

  const [accountFollows, followedTournaments, followedOrgs] = signedIn
    ? await Promise.all([
        getFollowedTeamsForUser(user!.id),
        getFollowedTournamentsForUser(user!.id),
        getFollowedOrgsForUser(user!.id),
      ])
    : [[], [], []];

  const [feedEntries, wholeEvent, organizations] = await Promise.all([
    accountFollows.length > 0
      ? getFollowFeed(accountFollows.map(a => ({ teamId: a.teamId, teamName: a.teamName, orgSlug: a.orgSlug, tournamentSlug: a.tournamentSlug })))
      : Promise.resolve([]),
    getWholeEventFollowCards(followedTournaments.map(t => ({ orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug, tournamentName: t.tournamentName }))),
    getOrgFollowRollups(followedOrgs.map(o => ({ orgSlug: o.orgSlug, orgId: o.orgId, orgName: o.orgName, logoUrl: o.logoUrl }))),
  ]);

  return (
    <FollowingList
      accountFollows={accountFollows}
      feedEntries={feedEntries}
      accountWholeEvent={wholeEvent}
      accountOrgs={organizations}
      signedIn={signedIn}
    />
  );
}
