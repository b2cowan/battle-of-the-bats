'use client';
import { useParams } from 'next/navigation';
import StandingsContent from '@/components/public/StandingsContent';
import PublicStandings from '@/components/public/PublicStandings';

export default function StandingsPage({ frameOn = false }: { frameOn?: boolean }) {
  const { orgSlug, tournamentSlug } = useParams();
  if (frameOn) return <PublicStandings orgSlug={orgSlug as string} tournamentSlug={tournamentSlug as string} />;
  return (
    <StandingsContent
      orgSlug={orgSlug as string}
      tournamentSlug={tournamentSlug as string}
    />
  );
}
