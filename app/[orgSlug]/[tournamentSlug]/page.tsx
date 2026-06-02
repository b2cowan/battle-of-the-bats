import { getOrganizationBySlug, getPublicTournamentBySlug } from '@/lib/db';
import TournamentHomeContent from '@/components/public/TournamentHomeContent';

export const dynamic = 'force-dynamic';

export default async function TournamentHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org || org.subscriptionStatus === 'canceled') return null;

  const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
  if (!tournament) return null;

  return (
    <TournamentHomeContent
      orgSlug={orgSlug}
      tournamentSlug={tournamentSlug}
      org={org}
      tournament={tournament}
    />
  );
}
