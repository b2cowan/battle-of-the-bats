import { notFound } from 'next/navigation';
import { getOrganizationBySlug, getTournamentBySlug } from '@/lib/db';
import TournamentNavSync from '@/components/TournamentNavSync';

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
  const tournament = await getTournamentBySlug(org.id, tournamentSlug);
  if (!tournament) notFound();

  return (
    <>
      <TournamentNavSync slug={tournament.slug} tournamentName={tournament.name} />
      {children}
    </>
  );
}
