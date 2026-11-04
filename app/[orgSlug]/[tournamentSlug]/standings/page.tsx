import { forwardToOwnAddress } from '@/lib/club-forward';
import PublicStandings from '@/components/public/PublicStandings';

/**
 * The tournament's standings. The body is a client component (PublicStandings); this server page forwards a club with its own
 * web address to it first (Club Tier Stage 4e, lib/club-forward.ts).
 */
export default async function StandingsPage({ params }: { params: Promise<{ orgSlug: string; tournamentSlug: string }> }) {
  const { orgSlug, tournamentSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/standings`);
  return <PublicStandings orgSlug={orgSlug} tournamentSlug={tournamentSlug} />;
}
