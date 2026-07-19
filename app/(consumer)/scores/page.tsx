import type { Metadata } from 'next';
import { getDirectoryListings, DIRECTORY_MAX_LIMIT } from '@/lib/directory';
import ScoresClient, { type ScoresBoardItem } from '@/components/consumer/ScoresClient';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fieldlogichq.ca';

// The SSR shell stays 100% anon-safe: it renders ONLY the platform-wide live board (public
// directory data), so search engines and first paint get real content and no per-account data
// is ever baked into cacheable HTML. All personalization (the union of memberships + follows)
// is client-fetched from /api/consumer/scores (FP-2 viewer-identity pattern).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Live Scores',
  description:
    'Live scores for the teams and events you follow — plus tournaments live right now across the FieldLogicHQ community.',
  alternates: { canonical: `${SITE_URL}/scores` },
  openGraph: {
    title: 'Live Scores | FieldLogicHQ',
    description: 'Tournaments live right now across the FieldLogicHQ community.',
    url: `${SITE_URL}/scores`,
    type: 'website',
  },
};

export default async function ScoresPage() {
  const live = await getDirectoryListings({ timeframe: 'live', limit: DIRECTORY_MAX_LIMIT, offset: 0 });
  const liveBoard: ScoresBoardItem[] = live.items.map(t => ({
    id: t.id,
    href: t.href,
    logoUrl: t.logoUrl,
    tournamentName: t.tournamentName,
    orgName: t.orgName,
    sportLabel: t.sportLabel,
  }));

  return <ScoresClient liveBoard={liveBoard} />;
}
