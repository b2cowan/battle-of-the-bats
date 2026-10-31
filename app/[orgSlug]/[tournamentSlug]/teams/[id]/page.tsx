import { isPublicFrameOn } from '@/lib/public-frame-server';
import PublicTeamPage from '@/components/public/PublicTeamPage';
import LegacyTeamProfile from './LegacyTeamProfile';

/** The sibling server layout retains the club's own-address forward. */
export default async function TeamProfilePage({ params }: {
  params: Promise<{ orgSlug: string; tournamentSlug: string; id: string }>;
}) {
  const frameOn = await isPublicFrameOn();
  if (frameOn) {
    const { orgSlug, tournamentSlug, id } = await params;
    return <PublicTeamPage orgSlug={orgSlug} tournamentSlug={tournamentSlug} teamId={id} />;
  }
  return <LegacyTeamProfile params={params} />;
}
