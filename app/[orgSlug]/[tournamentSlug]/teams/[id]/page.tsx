import PublicTeamPage from '@/components/public/PublicTeamPage';

/** The sibling server layout retains the club's own-address forward. */
export default async function TeamProfilePage({ params }: {
  params: Promise<{ orgSlug: string; tournamentSlug: string; id: string }>;
}) {
  const { orgSlug, tournamentSlug, id } = await params;
  return <PublicTeamPage orgSlug={orgSlug} tournamentSlug={tournamentSlug} teamId={id} />;
}
