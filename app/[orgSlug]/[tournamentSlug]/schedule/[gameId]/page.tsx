import { forwardToOwnAddress } from '@/lib/club-forward';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicTournamentPageData } from '@/lib/public-tournament-data';
import { orgLinks } from '@/lib/org-links';
import { publicGameDetailView } from '@/lib/public-game-detail';
import PublicGameDetails, { PublicGameUnavailable } from '@/components/public/PublicGameDetails';

type GameDetailParams = Promise<{
  orgSlug: string;
  tournamentSlug: string;
  gameId: string;
}>;

export async function generateMetadata({ params }: { params: GameDetailParams }): Promise<Metadata> {
  try {
    const { orgSlug, tournamentSlug, gameId } = await params;
    const data = await getPublicTournamentPageData(orgSlug, tournamentSlug, 'schedule');
    const game = data?.games.find(item => item.id === gameId);
    if (!data?.tournament || !game) return {};

    const view = publicGameDetailView(game, { ...data, requireFinalization: data.organization.requireScoreFinalization ?? true });
    const [away, home] = view.sides;
    const title = view.hasScore ? `${away.name} ${away.score} – ${home.score} ${home.name} · ${view.stateLabel}` : `${away.name} vs ${home.name}`;
    const description = [data.tournament.name, view.round, view.date, view.field].join(' · ');
    return { title, description, openGraph: { title, description }, twitter: { card: 'summary_large_image', title, description } };
  } catch {
    return {};
  }
}

/** A game's page. The body is PublicGameDetails (Stage 8 Part 3b deleted the old body that rendered with the switch off). */
export default async function PublicGameDetailsPage({
  params,
}: {
  params: GameDetailParams;
}) {
  const { orgSlug, tournamentSlug, gameId } = await params;
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/schedule/${gameId}`);
  const data = await getPublicTournamentPageData(orgSlug, tournamentSlug, 'schedule');
  if (!data) notFound();

  const orgHref = await orgLinks(orgSlug);
  const homeHref = orgHref(`/${tournamentSlug}`);

  if (!data.pageEnabled || !data.tournament) return <PublicGameUnavailable homeHref={homeHref} />;

  const game = data.games.find(item => item.id === gameId);
  if (!game) notFound();

  return <PublicGameDetails game={game} data={data} orgSlug={orgSlug} tournamentSlug={tournamentSlug} orgHref={orgHref} />;
}
