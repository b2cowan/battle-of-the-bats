import { notFound } from 'next/navigation';
import { getOrganizationBySlug, getPublicTournamentBySlug } from '@/lib/db';
import TournamentNavSync from '@/components/TournamentNavSync';

export const dynamic = 'force-dynamic';

export default async function TournamentLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();
  const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
  if (!tournament) notFound();

  return (
    <>
      <TournamentNavSync slug={tournament.slug} tournamentName={tournament.name} />
      {children}
    </>
  );
}
