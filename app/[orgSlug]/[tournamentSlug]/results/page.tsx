import { redirect } from 'next/navigation';

export default async function TournamentResultsRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  redirect(`/${orgSlug}/${tournamentSlug}/standings`);
}
