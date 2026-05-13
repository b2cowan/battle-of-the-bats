import { notFound } from 'next/navigation';
import { getTournamentBySlug } from '@/lib/db';
import { getAuthContextWithScope } from '@/lib/api-auth';
import TournamentHomeContent from '@/components/public/TournamentHomeContent';

export const dynamic = 'force-dynamic';

export default async function TournamentPreviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const ctx = await getAuthContextWithScope();
  if (!ctx || ctx.org.slug !== orgSlug) notFound();

  const tournament = await getTournamentBySlug(ctx.org.id, tournamentSlug);
  if (!tournament) notFound();
  if (ctx.assignedTournamentIds !== null && !ctx.assignedTournamentIds.includes(tournament.id)) {
    notFound();
  }

  return (
    <TournamentHomeContent
      orgSlug={orgSlug}
      tournamentSlug={tournamentSlug}
      org={ctx.org}
      tournament={tournament}
      isPreview
    />
  );
}
