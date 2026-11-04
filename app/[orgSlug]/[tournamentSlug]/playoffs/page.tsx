import { forwardToOwnAddress } from '@/lib/club-forward';
import { notFound } from 'next/navigation';
import { getPublicTournamentPageData } from '@/lib/public-tournament-data';
import PublicPlayoffs from '@/components/public/PublicPlayoffs';

export const dynamic = 'force-dynamic';

export default async function PlayoffsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/playoffs`);
  const initialData = await getPublicTournamentPageData(orgSlug, tournamentSlug, 'playoffs');
  if (!initialData?.tournament) notFound();
  return <PublicPlayoffs orgSlug={orgSlug} tournamentSlug={tournamentSlug} initialData={initialData} initialNow={new Date().toISOString()} />;
}
