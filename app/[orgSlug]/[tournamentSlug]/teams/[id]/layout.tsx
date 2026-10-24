import type { ReactNode } from 'react';
import { forwardToOwnAddress } from '@/lib/club-forward';

/**
 * A team's profile in a tournament. The page is a client component, so the forward to a club's own web address (Club Tier
 * Stage 4e, lib/club-forward.ts) runs here, in the one server file around it. This segment has no children of its own, so the
 * path is exactly this page's.
 */
export default async function TournamentTeamLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ orgSlug: string; tournamentSlug: string; id: string }>;
}) {
  const { orgSlug, tournamentSlug, id } = await params;
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/teams/${id}`);
  return <>{children}</>;
}
