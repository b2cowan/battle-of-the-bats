import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';
import { getFollowedTeamsForUser } from '@/lib/fan-follows';
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
  const accountFollows = signedIn ? await getFollowedTeamsForUser(user!.id) : [];

  return <FollowingList accountFollows={accountFollows} signedIn={signedIn} />;
}
