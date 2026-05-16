import TournamentHomeContent from '@/components/public/TournamentHomeContent';
import { getTournamentPreviewContext } from '@/lib/tournament-preview';

export const dynamic = 'force-dynamic';

export default async function TournamentPreviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const { org, tournament } = await getTournamentPreviewContext(orgSlug, tournamentSlug);

  return (
    <TournamentHomeContent
      orgSlug={orgSlug}
      tournamentSlug={tournamentSlug}
      org={org}
      tournament={tournament}
      isPreview
    />
  );
}
