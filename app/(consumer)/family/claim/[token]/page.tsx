import type { Metadata } from 'next';
import ClaimClient from './ClaimClient';

/**
 * /family/claim/[token] — claiming a coach-sent guardian invite.
 *
 * Client-rendered from the token so no team or player identity appears in the SSR HTML, the
 * same posture as the join page.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Connect to your player',
  robots: { index: false, follow: false },
};

export default async function FamilyClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClaimClient token={token} />;
}
