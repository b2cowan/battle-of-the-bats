'use client';
import { useParams } from 'next/navigation';
import TeamsContent from '@/components/public/TeamsContent';
import PublicTeams from '@/components/public/PublicTeams';

export default function TeamsPage({ frameOn = false }: { frameOn?: boolean }) {
  const { orgSlug, tournamentSlug } = useParams();
  if (frameOn) return <PublicTeams orgSlug={orgSlug as string} tournamentSlug={tournamentSlug as string} />;
  return (
    <TeamsContent
      orgSlug={orgSlug as string}
      tournamentSlug={tournamentSlug as string}
    />
  );
}
