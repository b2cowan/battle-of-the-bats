import { forwardToOwnAddress } from '@/lib/club-forward';
import { redirect } from 'next/navigation';
import { orgLinks } from '@/lib/org-links';

export default async function TournamentResultsRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/results`);
  redirect((await orgLinks(orgSlug))(`/${tournamentSlug}/standings`));
}
