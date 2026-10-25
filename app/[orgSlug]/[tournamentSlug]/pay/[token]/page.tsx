import type { Metadata } from 'next';
import { buildTeamPayView } from '@/lib/team-pay-view';
import TeamPayContent from '@/components/public/TeamPayContent';

export const dynamic = 'force-dynamic';

/** A pay link is a key: never indexed, never cached. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * A TOURNAMENT TEAM'S PAY PAGE (Club Tier Stage 12a). The signed link names one team; the page shows what it owes, Pay by
 * card, and its receipts — under the tournament's own address and theme. `?paid={session}` is Stripe's return (the page
 * then waits for the record); `?left=1` is a team that left Stripe's page before paying.
 */
export default async function TeamPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string; token: string }>;
  searchParams: Promise<{ paid?: string; left?: string }>;
}) {
  const { orgSlug, tournamentSlug, token } = await params;
  const { paid, left } = await searchParams;
  const view = await buildTeamPayView(token, { orgSlug, tournamentSlug });
  return <TeamPayContent token={token} view={view} returnedSession={paid ?? null} left={left === '1'} />;
}
