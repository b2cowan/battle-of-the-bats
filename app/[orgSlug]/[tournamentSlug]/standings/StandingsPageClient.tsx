'use client';
import { useParams } from 'next/navigation';
import StandingsContent from '@/components/public/StandingsContent';

export default function StandingsPage() {
  const { orgSlug, tournamentSlug } = useParams();
  return (
    <StandingsContent
      orgSlug={orgSlug as string}
      tournamentSlug={tournamentSlug as string}
    />
  );
}
