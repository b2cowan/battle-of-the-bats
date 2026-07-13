import type { Metadata } from 'next';
import { getDirectoryListings, DIRECTORY_PAGE_SIZE } from '@/lib/directory';
import DiscoverClient from './DiscoverClient';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fieldlogichq.ca';

// Server-render the directory so search engines (and the first paint) get real
// listings, not a client-only shell. Always fresh so newly-listed tournaments
// appear without waiting on a cache.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Browse Tournaments',
  description:
    'Discover youth and community sports tournaments across the FieldLogicHQ community — live scores, schedules, and standings, free to follow.',
  alternates: { canonical: `${SITE_URL}/discover` },
  openGraph: {
    title: 'Browse Tournaments | FieldLogicHQ',
    description:
      'Discover tournaments across the FieldLogicHQ community — live scores, schedules, and standings.',
    url: `${SITE_URL}/discover`,
    type: 'website',
  },
};

export default async function DiscoverPage() {
  // Default view (upcoming + live, first page). Filtering/pagination is taken over
  // client-side from here.
  const initial = await getDirectoryListings({
    timeframe: 'current',
    limit: DIRECTORY_PAGE_SIZE,
    offset: 0,
  });

  return <DiscoverClient initial={initial} />;
}
