import { forwardToOwnAddress } from '@/lib/club-forward';
import PublicTeams from '@/components/public/PublicTeams';

/**
 * The tournament's teams. The body is a client component (PublicTeams); this server page forwards a club with its own web
 * address to it first (Club Tier Stage 4e, lib/club-forward.ts).
 */
export default async function TeamsPage({ params }: { params: Promise<{ orgSlug: string; tournamentSlug: string }> }) {
  const { orgSlug, tournamentSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/teams`);
  return <PublicTeams orgSlug={orgSlug} tournamentSlug={tournamentSlug} />;
}
