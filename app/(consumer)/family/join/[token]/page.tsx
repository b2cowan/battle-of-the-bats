import type { Metadata } from 'next';
import JoinClient from './JoinClient';

/**
 * /family/join/[token] — the team family link's landing page.
 *
 * Rendered entirely client-side from the token so NO team identity appears in the SSR
 * HTML: the anonymous-public invariant applies here too, and a server-rendered team name
 * would put a premium customer's team into any crawler or cache that ever saw the URL.
 * The token is the credential; the page fetches with it.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Follow a team',
  robots: { index: false, follow: false },
};

export default async function FamilyJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <JoinClient token={token} />;
}
